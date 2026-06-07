'use server';

import { createClient } from '@/lib/supabase-server';
import type { Database, Json } from '@/types/database.types';
import { getAuthorizedTenantUser } from '@/services/auth-guards';

type MetaAdAccountRow = Database['public']['Tables']['marketing_meta_ad_accounts']['Row'];
type MetaAdAccountInsert = Database['public']['Tables']['marketing_meta_ad_accounts']['Insert'];
type MetaAdAccountUpdate = Database['public']['Tables']['marketing_meta_ad_accounts']['Update'];
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

type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

type SaveMetaAdAccountInput = {
  adAccountId: string;
  accountName?: string | null;
  currency?: string | null;
  timezoneName?: string | null;
  isActive?: boolean;
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

function buildMetaInsightsUrl(input: SyncMetaAdsInsightsInput & { normalizedAdAccountId: string }) {
  const version = (process.env.META_MARKETING_API_VERSION || DEFAULT_META_API_VERSION)
    .trim()
    .replace(/^\/+/, '');

  if (!/^v[0-9]+(\.[0-9]+)?$/.test(version)) {
    throw new Error('META_MARKETING_API_VERSION khong hop le.');
  }

  const accessToken = process.env.META_MARKETING_ACCESS_TOKEN?.trim();
  if (!accessToken) {
    throw new Error('Thieu META_MARKETING_ACCESS_TOKEN trong server secrets.');
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
  url.searchParams.set('access_token', accessToken);

  return url.toString();
}

async function fetchMetaInsights(input: SyncMetaAdsInsightsInput & { normalizedAdAccountId: string }) {
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
): Promise<ActionResult<MetaAdAccountRow>> {
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
    .select('*')
    .single();

  if (error) {
    return actionError(`[saveMetaAdAccountConnection] Khong the luu cau hinh Meta Ads: ${error.message}`);
  }

  return { success: true, data };
}

export async function getMetaAdAccountConnections(): Promise<ActionResult<MetaAdAccountRow[]>> {
  const auth = await getAuthorizedTenantUser({
    allowedRoles: META_ADS_READ_ROLES,
    errorMessage: 'Ban khong co quyen xem Meta Ads.',
  });
  if (!auth.ok) return actionError(auth.error);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('marketing_meta_ad_accounts')
    .select('*')
    .eq('tenant_id', auth.tenantId)
    .order('created_at', { ascending: false });

  if (error) {
    return actionError(`[getMetaAdAccountConnections] Khong the tai cau hinh Meta Ads: ${error.message}`);
  }

  return { success: true, data: data || [] };
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
    const insights = await fetchMetaInsights({
      ...input,
      normalizedAdAccountId: adAccountId,
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
