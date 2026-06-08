'use server';

import { createClient } from '@/lib/supabase-server';
import type { Database, Json } from '@/types/database.types';
import { getAuthorizedTenantUser } from '@/services/auth-guards';
import { decrypt, encrypt } from '@/lib/crypto';

type MetaAdAccountRow = Database['public']['Tables']['marketing_meta_ad_accounts']['Row'];
type MetaAdAccountInsert = Database['public']['Tables']['marketing_meta_ad_accounts']['Insert'];
type MetaAdAccountUpdate = Database['public']['Tables']['marketing_meta_ad_accounts']['Update'];
type MetaAdAccountTokenInsert =
  Database['public']['Tables']['marketing_meta_ad_account_tokens']['Insert'];
type MetaAdAccountTokenRow =
  Database['public']['Tables']['marketing_meta_ad_account_tokens']['Row'];
type MetaAdsInsightDailyRow =
  Database['public']['Tables']['marketing_meta_ads_insights_daily']['Row'];
type MetaAdsInsightDailyInsert =
  Database['public']['Tables']['marketing_meta_ads_insights_daily']['Insert'];
type MetaAdsSyncRunInsert = Database['public']['Tables']['marketing_meta_ads_sync_runs']['Insert'];
type MetaAdsSyncRunUpdate = Database['public']['Tables']['marketing_meta_ads_sync_runs']['Update'];

const META_ADS_MANAGE_ROLES = ['admin', 'super_admin'] as const;
const META_ADS_READ_ROLES = ['admin', 'super_admin', 'accountant'] as const;
const DEFAULT_META_API_VERSION = 'v24.0';
const MAX_SYNC_DAYS = 31;
const MAX_PAGES_PER_SYNC = 10;
const META_AD_ACCOUNT_SAFE_SELECT = [
  'id',
  'tenant_id',
  'ad_account_id',
  'account_name',
  'currency',
  'timezone_name',
  'is_active',
  'last_synced_at',
  'token_last_four',
  'token_updated_at',
  'created_at',
  'updated_at',
].join(',');

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type SaveMetaAdAccountInput = {
  adAccountId: string;
  accountName?: string | null;
  currency?: string | null;
  timezoneName?: string | null;
  isActive?: boolean;
  accessToken?: string | null;
};

type DeleteMetaAdAccountInput = {
  adAccountId: string;
};

type SyncMetaAdsInsightsInput = {
  adAccountId: string;
  dateFrom: string;
  dateTo: string;
};

type GetMetaAdsInsightsInput = {
  dateFrom: string;
  dateTo: string;
  adAccountId?: string | null;
};

type MetaAdAccountConnection = Pick<
  MetaAdAccountRow,
  | 'id'
  | 'tenant_id'
  | 'ad_account_id'
  | 'account_name'
  | 'currency'
  | 'timezone_name'
  | 'is_active'
  | 'last_synced_at'
  | 'token_last_four'
  | 'token_updated_at'
  | 'created_at'
  | 'updated_at'
>;

type MetaGraphAction = {
  action_type?: string;
  value?: string;
};

type MetaGraphInsight = {
  date_start?: string;
  date_stop?: string;
  account_id?: string;
  account_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  adset_name?: string;
  ad_id?: string;
  ad_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  actions?: MetaGraphAction[];
  [key: string]: unknown;
};

type MetaGraphInsightsResponse = {
  data?: MetaGraphInsight[];
  paging?: {
    next?: string;
  };
  error?: {
    message?: string;
    type?: string;
    code?: number;
  };
};

function actionError<T>(error: string): ActionResult<T> {
  return { success: false, error };
}

function normalizeNullableText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeAdAccountId(value: string) {
  const trimmed = value.trim();
  if (/^act_[0-9]+$/.test(trimmed)) return trimmed;
  if (/^[0-9]+$/.test(trimmed)) return `act_${trimmed}`;
  return null;
}

function getTokenLastFour(value: string) {
  const trimmed = value.trim();
  return trimmed.slice(-4) || null;
}

function parseIsoDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10) === value ? parsed : null;
}

function validateDateRange(dateFrom: string, dateTo: string) {
  const from = parseIsoDate(dateFrom);
  const to = parseIsoDate(dateTo);

  if (!from || !to) {
    return { ok: false as const, error: 'Khoang ngay Meta Ads phai dung dinh dang YYYY-MM-DD.' };
  }

  if (from.getTime() > to.getTime()) {
    return { ok: false as const, error: 'Ngay bat dau khong duoc lon hon ngay ket thuc.' };
  }

  const days = Math.floor((to.getTime() - from.getTime()) / 86_400_000) + 1;
  if (days > MAX_SYNC_DAYS) {
    return {
      ok: false as const,
      error: `Moi lan dong bo Meta Ads chi toi da ${MAX_SYNC_DAYS} ngay de tranh qua tai API.`,
    };
  }

  return { ok: true as const };
}

function toNumber(value: string | number | null | undefined) {
  const numberValue = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function toInteger(value: string | number | null | undefined) {
  return Math.trunc(toNumber(value));
}

function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value ?? null)) as Json;
}

async function getStoredMetaAccessToken(params: {
  tenantId: string;
  metaAdAccountId: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('marketing_meta_ad_account_tokens')
    .select('access_token_encrypted')
    .eq('tenant_id', params.tenantId)
    .eq('meta_ad_account_id', params.metaAdAccountId)
    .maybeSingle();

  if (error) {
    throw new Error(`[getStoredMetaAccessToken] Khong the tai Meta token: ${error.message}`);
  }

  const tokenRow = data as Pick<MetaAdAccountTokenRow, 'access_token_encrypted'> | null;
  if (!tokenRow?.access_token_encrypted) {
    return null;
  }

  const decrypted = decrypt(tokenRow.access_token_encrypted).trim();
  if (!decrypted || decrypted === tokenRow.access_token_encrypted) {
    throw new Error('Khong the giai ma Meta access token. Kiem tra DB_ENCRYPTION_KEY tren server.');
  }

  return decrypted;
}

async function resolveMetaAccessToken(params: {
  tenantId: string;
  metaAdAccountId: string;
}) {
  const storedToken = await getStoredMetaAccessToken(params);
  if (storedToken) return storedToken;

  const envToken = process.env.META_MARKETING_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;

  throw new Error(
    'Chua co Meta access token cho tai khoan nay. Vui long cap nhat token trong Cai dat > Meta Ads.',
  );
}

function buildMetaInsightsUrl(
  input: SyncMetaAdsInsightsInput & { normalizedAdAccountId: string; accessToken: string },
) {
  const version = (process.env.META_MARKETING_API_VERSION || DEFAULT_META_API_VERSION)
    .trim()
    .replace(/^\/+/, '');

  if (!/^v[0-9]+(\.[0-9]+)?$/.test(version)) {
    throw new Error('META_MARKETING_API_VERSION khong hop le.');
  }

  const url = new URL(
    `https://graph.facebook.com/${version}/${input.normalizedAdAccountId}/insights`,
  );
  url.searchParams.set('level', 'ad');
  url.searchParams.set('time_increment', '1');
  url.searchParams.set('time_range', JSON.stringify({
    since: input.dateFrom,
    until: input.dateTo,
  }));
  url.searchParams.set(
    'fields',
    [
      'date_start',
      'date_stop',
      'account_id',
      'account_name',
      'campaign_id',
      'campaign_name',
      'adset_id',
      'adset_name',
      'ad_id',
      'ad_name',
      'spend',
      'impressions',
      'reach',
      'clicks',
      'ctr',
      'cpc',
      'cpm',
      'actions',
    ].join(','),
  );
  url.searchParams.set('access_token', input.accessToken);

  return url.toString();
}

async function fetchMetaInsights(
  input: SyncMetaAdsInsightsInput & { normalizedAdAccountId: string; accessToken: string },
) {
  const insights: MetaGraphInsight[] = [];
  let nextUrl: string | null = buildMetaInsightsUrl(input);

  for (let page = 0; nextUrl && page < MAX_PAGES_PER_SYNC; page += 1) {
    const response = await fetch(nextUrl, { method: 'GET', cache: 'no-store' });
    const body = await response.json() as MetaGraphInsightsResponse;

    if (!response.ok) {
      const apiMessage = body.error?.message || `HTTP ${response.status}`;
      throw new Error(`Meta Ads API loi: ${apiMessage}`);
    }

    insights.push(...(body.data || []));
    nextUrl = body.paging?.next || null;
  }

  return insights;
}

function mapInsightToInsert(
  tenantId: string,
  adAccountId: string,
  insight: MetaGraphInsight,
  syncedAt: string,
): MetaAdsInsightDailyInsert | null {
  const dateStart = insight.date_start;
  const dateStop = insight.date_stop;
  if (!dateStart || !dateStop || !parseIsoDate(dateStart) || !parseIsoDate(dateStop)) {
    return null;
  }

  return {
    tenant_id: tenantId,
    ad_account_id: adAccountId,
    date_start: dateStart,
    date_stop: dateStop,
    campaign_id: normalizeNullableText(insight.campaign_id) ?? '',
    campaign_name: normalizeNullableText(insight.campaign_name),
    adset_id: normalizeNullableText(insight.adset_id) ?? '',
    adset_name: normalizeNullableText(insight.adset_name),
    ad_id: normalizeNullableText(insight.ad_id) ?? '',
    ad_name: normalizeNullableText(insight.ad_name),
    spend: toNumber(insight.spend),
    impressions: toInteger(insight.impressions),
    reach: toInteger(insight.reach),
    clicks: toInteger(insight.clicks),
    ctr: toNumber(insight.ctr),
    cpc: toNumber(insight.cpc),
    cpm: toNumber(insight.cpm),
    actions: toJson(insight.actions || []),
    raw_payload: toJson(insight),
    synced_at: syncedAt,
    updated_at: syncedAt,
  };
}

async function updateSyncRun(runId: string, payload: MetaAdsSyncRunUpdate) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('marketing_meta_ads_sync_runs')
    .update(payload)
    .eq('id', runId);

  if (error) {
    throw new Error(`[updateSyncRun] Khong the cap nhat trang thai dong bo Meta Ads: ${error.message}`);
  }
}

export async function saveMetaAdAccountConnection(
  input: SaveMetaAdAccountInput,
): Promise<ActionResult<MetaAdAccountConnection>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: META_ADS_MANAGE_ROLES,
    errorMessage: 'Chi admin moi duoc cau hinh Meta Ads.',
  });
  if (!auth.ok) return actionError(auth.error);

  const adAccountId = normalizeAdAccountId(input.adAccountId);
  if (!adAccountId) {
    return actionError('Meta ad account id phai co dang act_123 hoac 123.');
  }

  const now = new Date().toISOString();
  const accessToken = normalizeNullableText(input.accessToken);
  const tokenLastFour = accessToken ? getTokenLastFour(accessToken) : null;
  let encryptedAccessToken: string | null = null;

  if (accessToken) {
    try {
      encryptedAccessToken = encrypt(accessToken);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Khong the ma hoa Meta access token.';
      return actionError(`[saveMetaAdAccountConnection] ${message}`);
    }
  }

  const payload: MetaAdAccountInsert = {
    tenant_id: auth.tenantId,
    ad_account_id: adAccountId,
    account_name: normalizeNullableText(input.accountName),
    currency: normalizeNullableText(input.currency),
    timezone_name: normalizeNullableText(input.timezoneName),
    is_active: input.isActive ?? true,
    updated_at: now,
  };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('marketing_meta_ad_accounts')
    .upsert(payload, { onConflict: 'tenant_id,ad_account_id' })
    .select(META_AD_ACCOUNT_SAFE_SELECT)
    .single();

  if (error) {
    return actionError(`[saveMetaAdAccountConnection] Khong the luu cau hinh Meta Ads: ${error.message}`);
  }

  let safeData = data as unknown as MetaAdAccountConnection;

  if (encryptedAccessToken) {
    const tokenPayload: MetaAdAccountTokenInsert = {
      tenant_id: auth.tenantId,
      meta_ad_account_id: safeData.id,
      access_token_encrypted: encryptedAccessToken,
      token_last_four: tokenLastFour,
      updated_at: now,
    };

    const { error: tokenError } = await supabase
      .from('marketing_meta_ad_account_tokens')
      .upsert(tokenPayload, { onConflict: 'meta_ad_account_id' });

    if (tokenError) {
      return actionError(`[saveMetaAdAccountConnection] Khong the luu Meta access token: ${tokenError.message}`);
    }

    const tokenMetadata: MetaAdAccountUpdate = {
      token_last_four: tokenLastFour,
      token_updated_at: now,
      updated_at: now,
    };
    const { data: refreshedAccount, error: tokenMetadataError } = await supabase
      .from('marketing_meta_ad_accounts')
      .update(tokenMetadata)
      .eq('id', safeData.id)
      .select(META_AD_ACCOUNT_SAFE_SELECT)
      .single();

    if (tokenMetadataError) {
      return actionError(
        `[saveMetaAdAccountConnection] Khong the cap nhat trang thai Meta token: ${tokenMetadataError.message}`,
      );
    }

    safeData = refreshedAccount as unknown as MetaAdAccountConnection;
  }

  return { success: true, data: safeData };
}

export async function getMetaAdAccountConnections(): Promise<ActionResult<MetaAdAccountConnection[]>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: META_ADS_READ_ROLES,
    errorMessage: 'Ban khong co quyen xem Meta Ads.',
  });
  if (!auth.ok) return actionError(auth.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('marketing_meta_ad_accounts')
    .select(META_AD_ACCOUNT_SAFE_SELECT)
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return actionError(`[getMetaAdAccountConnections] Khong the tai cau hinh Meta Ads: ${error.message}`);
  }

  return { success: true, data: (data || []) as unknown as MetaAdAccountConnection[] };
}

export async function deleteUnusedMetaAdAccountConnection(
  input: DeleteMetaAdAccountInput,
): Promise<ActionResult<{ adAccountId: string }>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: META_ADS_MANAGE_ROLES,
    errorMessage: 'Chi admin moi duoc xoa cau hinh Meta Ads.',
  });
  if (!auth.ok) return actionError(auth.error);

  const adAccountId = normalizeAdAccountId(input.adAccountId);
  if (!adAccountId) {
    return actionError('Meta ad account id phai co dang act_123 hoac 123.');
  }

  const supabase = await createClient();
  const { data: account, error: accountError } = await supabase
    .from('marketing_meta_ad_accounts')
    .select('id,ad_account_id,last_synced_at')
    .eq('tenant_id', auth.tenantId)
    .eq('ad_account_id', adAccountId)
    .maybeSingle();

  if (accountError) {
    return actionError(`[deleteUnusedMetaAdAccountConnection] Khong the kiem tra tai khoan Meta Ads: ${accountError.message}`);
  }

  const accountRow = account as Pick<MetaAdAccountRow, 'id' | 'ad_account_id' | 'last_synced_at'> | null;
  if (!accountRow) {
    return actionError('Tai khoan Meta Ads nay khong ton tai trong chi nhanh hien tai.');
  }

  if (accountRow.last_synced_at) {
    return actionError('Tai khoan Meta Ads da tung dong bo du lieu nen khong xoa truc tiep de tranh mat dau bao cao.');
  }

  const { error: tokenDeleteError } = await supabase
    .from('marketing_meta_ad_account_tokens')
    .delete()
    .eq('tenant_id', auth.tenantId)
    .eq('meta_ad_account_id', accountRow.id);

  if (tokenDeleteError) {
    return actionError(`[deleteUnusedMetaAdAccountConnection] Khong the xoa Meta token: ${tokenDeleteError.message}`);
  }

  const { error: accountDeleteError } = await supabase
    .from('marketing_meta_ad_accounts')
    .delete()
    .eq('tenant_id', auth.tenantId)
    .eq('id', accountRow.id);

  if (accountDeleteError) {
    return actionError(`[deleteUnusedMetaAdAccountConnection] Khong the xoa cau hinh Meta Ads: ${accountDeleteError.message}`);
  }

  return { success: true, data: { adAccountId: accountRow.ad_account_id } };
}

export async function getMetaAdsDailyInsights(
  input: GetMetaAdsInsightsInput,
): Promise<ActionResult<MetaAdsInsightDailyRow[]>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: META_ADS_READ_ROLES,
    errorMessage: 'Ban khong co quyen xem Meta Ads.',
  });
  if (!auth.ok) return actionError(auth.error);

  const dateValidation = validateDateRange(input.dateFrom, input.dateTo);
  if (!dateValidation.ok) return actionError(dateValidation.error);

  const adAccountId = input.adAccountId ? normalizeAdAccountId(input.adAccountId) : null;
  if (input.adAccountId && !adAccountId) {
    return actionError('Meta ad account id phai co dang act_123 hoac 123.');
  }

  const supabase = await createClient();
  let query = supabase
    .from('marketing_meta_ads_insights_daily')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .gte('date_start', input.dateFrom)
    .lte('date_start', input.dateTo);

  if (adAccountId) {
    query = query.eq('ad_account_id', adAccountId);
  }

  const { data, error } = await query.order('date_start', { ascending: false });
  if (error) {
    return actionError(`[getMetaAdsDailyInsights] Khong the tai insight Meta Ads: ${error.message}`);
  }

  return { success: true, data: data || [] };
}

export async function syncMetaAdsInsights(
  input: SyncMetaAdsInsightsInput,
): Promise<ActionResult<{ rowsSynced: number; runId: string }>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: META_ADS_MANAGE_ROLES,
    errorMessage: 'Chi admin moi duoc dong bo Meta Ads.',
  });
  if (!auth.ok) return actionError(auth.error);

  const adAccountId = normalizeAdAccountId(input.adAccountId);
  if (!adAccountId) {
    return actionError('Meta ad account id phai co dang act_123 hoac 123.');
  }

  const dateValidation = validateDateRange(input.dateFrom, input.dateTo);
  if (!dateValidation.ok) return actionError(dateValidation.error);

  const supabase = await createClient();
  const { data: connection, error: connectionError } = await supabase
    .from('marketing_meta_ad_accounts')
    .select('id,tenant_id,ad_account_id,is_active')
    .eq('tenant_id', auth.tenantId)
    .eq('ad_account_id', adAccountId)
    .eq('is_active', true)
    .maybeSingle();

  if (connectionError) {
    return actionError(`[syncMetaAdsInsights] Khong the kiem tra cau hinh Meta Ads: ${connectionError.message}`);
  }

  if (!connection) {
    return actionError('Ad account nay chua duoc cau hinh hoac da tam dung cho chi nhanh hien tai.');
  }

  const now = new Date().toISOString();
  const runPayload: MetaAdsSyncRunInsert = {
    tenant_id: auth.tenantId,
    ad_account_id: adAccountId,
    date_from: input.dateFrom,
    date_to: input.dateTo,
    status: 'running',
    rows_synced: 0,
    started_at: now,
    updated_at: now,
  };

  const { data: run, error: runError } = await supabase
    .from('marketing_meta_ads_sync_runs')
    .insert(runPayload)
    .select('id')
    .single();

  if (runError || !run?.id) {
    return actionError(`[syncMetaAdsInsights] Khong the tao lich su dong bo Meta Ads: ${runError?.message || 'missing run id'}`);
  }

  try {
    const accessToken = await resolveMetaAccessToken({
      tenantId: auth.tenantId,
      metaAdAccountId: connection.id,
    });

    const insights = await fetchMetaInsights({
      ...input,
      normalizedAdAccountId: adAccountId,
      accessToken,
    });

    const syncedAt = new Date().toISOString();
    const insightPayloads = insights
      .map((insight) => mapInsightToInsert(auth.tenantId, adAccountId, insight, syncedAt))
      .filter((insight): insight is MetaAdsInsightDailyInsert => insight !== null);

    if (insightPayloads.length > 0) {
      const { error: upsertError } = await supabase
        .from('marketing_meta_ads_insights_daily')
        .upsert(insightPayloads, {
          onConflict: 'tenant_id,ad_account_id,date_start,campaign_id,adset_id,ad_id',
        });

      if (upsertError) {
        throw new Error(`[syncMetaAdsInsights] Khong the luu insight Meta Ads: ${upsertError.message}`);
      }
    }

    const accountUpdate: MetaAdAccountUpdate = {
      last_synced_at: syncedAt,
      updated_at: syncedAt,
    };
    const { error: accountUpdateError } = await supabase
      .from('marketing_meta_ad_accounts')
      .update(accountUpdate)
      .eq('id', connection.id);

    if (accountUpdateError) {
      throw new Error(`[syncMetaAdsInsights] Khong the cap nhat lan dong bo gan nhat: ${accountUpdateError.message}`);
    }

    await updateSyncRun(run.id, {
      status: 'success',
      rows_synced: insightPayloads.length,
      error_message: null,
      finished_at: syncedAt,
      updated_at: syncedAt,
    });

    return { success: true, data: { rowsSynced: insightPayloads.length, runId: run.id } };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Loi dong bo Meta Ads khong xac dinh.';
    const failedAt = new Date().toISOString();
    await updateSyncRun(run.id, {
      status: 'failed',
      rows_synced: 0,
      error_message: message,
      finished_at: failedAt,
      updated_at: failedAt,
    });
    return actionError(message);
  }
}
