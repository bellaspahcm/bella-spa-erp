'use server';

import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '@/services/audit-actions';
import { getCurrentUser } from '@/services/user-actions';
import { createAccountingDataClient } from './client';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import {
  calculateReadinessScore,
  findMissingRequiredFields,
  inferBusinessEventType,
} from './template-rules';
import type {
  AccountingBackfillActionResult,
  AccountingEventTemplate,
  AccountingReadinessSummary,
  AccountingReviewItem,
  AccountingReviewResolutionStatus,
  AccountingSourceTable,
  AccountingStandardProfile,
  BusinessEventType,
} from './types';
import type { Json } from '@/types/database.types';

export async function getAccountingEventTemplates(
  standardProfile: AccountingStandardProfile = 'TT133'
): Promise<AccountingEventTemplate[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');
  const supabase = await createAccountingDataClient();

  const { data, error } = await supabase
    .from('accounting_event_templates')
    .select('*')
    .eq('standard_profile', standardProfile)
    .eq('is_active', true)
    .or(`tenant_id.is.null,tenant_id.eq.${user.tenant_id}`)
    .order('is_system', { ascending: false })
    .order('business_event_type', { ascending: true });

  if (error) throw error;
  return (data || []) as unknown as AccountingEventTemplate[];
}

export async function getAccountingReviewQueue(filters?: {
  status?: 'AUTO_POSTED' | 'NEEDS_REVIEW' | 'APPROVED_FOR_POSTING' | 'REJECTED' | 'POSTING_FAILED';
  severity?: 'low' | 'medium' | 'high' | 'critical';
}): Promise<AccountingReviewItem[]> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được xem hàng chờ kế toán.');
  }

  const supabase = await createAccountingDataClient();

  let query = supabase
    .from('accounting_review_queue')
    .select('*')
    .eq('tenant_id', user.tenant_id);

  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.severity) query = query.eq('severity', filters.severity);

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as unknown as AccountingReviewItem[];
}

export async function getAccountingReadinessSummary(): Promise<AccountingReadinessSummary> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được xem mức sẵn sàng kế toán.');
  }

  const supabase = await createAccountingDataClient();

  const { data, error } = await supabase.rpc('get_accounting_readiness', {
    p_tenant_id: user.tenant_id,
  });

  if (error) throw error;

  const rows = (data || []).map((row) => ({
    source_table: row.source_table,
    total_records: Number(row.total_records || 0),
    classified_records: Number(row.classified_records || 0),
    missing_business_event: Number(row.missing_business_event || 0),
    needs_review: Number(row.needs_review || 0),
    posting_failed: Number(row.posting_failed || 0),
  }));

  const summary = rows.reduce(
    (acc, row) => {
      acc.total_records += row.total_records;
      acc.classified_records += row.classified_records;
      acc.missing_business_event += row.missing_business_event;
      acc.needs_review += row.needs_review;
      acc.posting_failed += row.posting_failed;
      return acc;
    },
    {
      total_records: 0,
      classified_records: 0,
      missing_business_event: 0,
      needs_review: 0,
      posting_failed: 0,
    }
  );

  const readiness_score = calculateReadinessScore({
    totalRecords: summary.total_records,
    missingBusinessEvent: summary.missing_business_event,
    needsReview: summary.needs_review,
    postingFailed: summary.posting_failed,
  });

  return {
    rows,
    ...summary,
    readiness_score,
    can_enable_professional:
      readiness_score >= 95 &&
      summary.missing_business_event === 0 &&
      summary.needs_review === 0 &&
      summary.posting_failed === 0,
  };
}

export async function createAccountingReviewItem(params: {
  tenantId: string;
  sourceTable: AccountingSourceTable;
  sourceId: string;
  businessEventType?: BusinessEventType | null;
  reasonCode: string;
  message: string;
  missingFields?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  suggestedTemplateId?: string | null;
  payload?: Record<string, unknown>;
}) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được tạo hàng chờ kế toán.');
  }
  if (user.tenant_id !== params.tenantId && user.role !== 'super_admin') {
    throw new Error('Unauthorized: không được tạo review item cho tenant khác.');
  }

  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const { url, adminKey } = requireSupabaseAdminEnv();

  const adminClient = createAdmin(url, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let existingQuery = adminClient
    .from('accounting_review_queue')
    .select('id')
    .eq('tenant_id', params.tenantId)
    .eq('source_table', params.sourceTable)
    .eq('source_id', params.sourceId)
    .in('status', ['NEEDS_REVIEW', 'POSTING_FAILED']);

  existingQuery = params.businessEventType
    ? existingQuery.eq('business_event_type', params.businessEventType)
    : existingQuery.is('business_event_type', null);

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) throw existingError;

  const payload = {
      tenant_id: params.tenantId,
      source_table: params.sourceTable,
      source_id: params.sourceId,
      business_event_type: params.businessEventType ?? null,
      status: 'NEEDS_REVIEW',
      severity: params.severity ?? 'medium',
      reason_code: params.reasonCode,
      message: params.message,
      missing_fields: params.missingFields ?? [],
      suggested_template_id: params.suggestedTemplateId ?? null,
      payload: (params.payload ?? {}) as Json,
      updated_at: new Date().toISOString(),
    };

  const mutation = existing?.id
    ? adminClient.from('accounting_review_queue').update(payload).eq('id', existing.id)
    : adminClient.from('accounting_review_queue').insert(payload);

  const { data, error } = await mutation
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_review_queue',
    record_id: data.id,
    new_data: {
      source_table: params.sourceTable,
      source_id: params.sourceId,
      reason_code: params.reasonCode,
    },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  return { success: true, data };
}

export async function resolveAccountingReviewItem(params: {
  reviewItemId: string;
  status: AccountingReviewResolutionStatus;
}) {
  try {
    const supabase = await createDevelopmentBypassClient();
    const user = await getCurrentUser();
    if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
      return { success: false, error: 'Unauthorized: chỉ admin/kế toán mới được xử lý hàng chờ kế toán.' };
    }

    const { data, error } = await supabase.rpc('resolve_accounting_review_item', {
      p_review_item_id: params.reviewItemId,
      p_status: params.status,
    });

    if (error) {
      return { success: false, error: `Lỗi cơ sở dữ liệu: ${error.message}` };
    }

    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'accounting_review_queue',
      record_id: params.reviewItemId,
      new_data: {
        status: params.status,
        resolved_result: data?.[0] ?? null,
      },
    });

    await safeRevalidatePath('/dashboard/accounting/readiness');
    await safeRevalidatePath('/dashboard/accounting/reconciliation');

    return { success: true, data: data?.[0] ?? null };
  } catch (err: unknown) {
    console.error('[resolveAccountingReviewItem] Failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi hệ thống khi xử lý hàng chờ kế toán.',
    };
  }
}

export async function runAccountingMetadataBackfill(params?: {
  limit?: number;
  tenantId?: string | null;
}): Promise<AccountingBackfillActionResult> {
  try {
    const supabase = await createAccountingDataClient();
    const user = await getCurrentUser();
    if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
      return { success: false, error: 'Unauthorized: chỉ admin/kế toán mới được chạy backfill metadata kế toán.' };
    }
    if (params?.tenantId && params.tenantId !== user.tenant_id && user.role !== 'super_admin') {
      return { success: false, error: 'Unauthorized: không được chạy backfill cho tenant khác.' };
    }

    const limit = Math.min(Math.max(params?.limit ?? 500, 1), 2000);
    const { data, error } = await supabase.rpc('backfill_accounting_metadata', {
      p_tenant_id: params?.tenantId ?? user.tenant_id,
      p_limit: limit,
    });

    if (error) {
      return { success: false, error: `Lỗi cơ sở dữ liệu: ${error.message}` };
    }

    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'accounting_metadata_backfill',
      record_id: user.tenant_id,
      new_data: {
        limit,
        result: data ?? [],
      },
    });

    await safeRevalidatePath('/dashboard/accounting/readiness');
    await safeRevalidatePath('/dashboard/accounting/reconciliation');

    const mappedData = (data ?? []).map((row) => ({
      source_table: row.source_table,
      scanned_records: Number(row.scanned_records || 0),
      classified_records: Number(row.classified_records || 0),
      review_created: Number(row.review_created || 0),
    }));

    return { success: true, data: mappedData };
  } catch (err: unknown) {
    console.error('[runAccountingMetadataBackfill] Failed:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Lỗi hệ thống khi chạy backfill metadata kế toán.',
    };
  }
}
export async function classifyAccountingSourcePreview(input: {
  sourceTable: AccountingSourceTable;
  category?: string | null;
  revenueType?: string | null;
  reason?: string | null;
  status?: string | null;
  payload?: Record<string, unknown>;
}) {
  const eventType = inferBusinessEventType(input);
  if (!eventType) {
    return {
      business_event_type: null,
      missing_fields: [],
      requires_review: true,
      reason_code: 'UNCLASSIFIED_EVENT',
    };
  }

  const missingFields = findMissingRequiredFields(eventType, input.payload ?? {});
  return {
    business_event_type: eventType,
    missing_fields: missingFields,
    requires_review: missingFields.length > 0,
    reason_code: missingFields.length > 0 ? 'MISSING_REQUIRED_FIELDS' : 'READY_FOR_TEMPLATE',
  };
}
