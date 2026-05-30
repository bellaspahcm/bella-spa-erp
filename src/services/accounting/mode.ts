'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';
import { calculateReadinessScore } from './template-rules';
import type { ProfessionalModeReadinessGate } from './types';
import type { Database, Json } from '@/types/database.types';

type AccountingMode = 'SIMPLE' | 'PROFESSIONAL';
type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type ReadinessRpcRow = {
  source_table: string;
  total_records: number | string | null;
  classified_records: number | string | null;
  missing_business_event: number | string | null;
  needs_review: number | string | null;
  posting_failed: number | string | null;
};

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function buildBlockingReasons(summary: {
  readiness_score: number;
  missing_business_event: number;
  needs_review: number;
  posting_failed: number;
}) {
  const reasons: string[] = [];
  if (summary.readiness_score < 95) {
    reasons.push(`Điểm sẵn sàng mới đạt ${summary.readiness_score}/100, cần tối thiểu 95/100.`);
  }
  if (summary.missing_business_event > 0) {
    reasons.push(`Còn ${summary.missing_business_event} dòng chưa phân loại nghiệp vụ kế toán.`);
  }
  if (summary.needs_review > 0) {
    reasons.push(`Còn ${summary.needs_review} dòng đang cần kế toán duyệt.`);
  }
  if (summary.posting_failed > 0) {
    reasons.push(`Còn ${summary.posting_failed} dòng hạch toán lỗi cần xử lý lại.`);
  }
  return reasons;
}

function serializeReadinessGate(gate: ProfessionalModeReadinessGate | null): Json {
  if (!gate) return null;

  return {
    rows: gate.rows.map((row) => ({
      source_table: row.source_table,
      total_records: row.total_records,
      classified_records: row.classified_records,
      missing_business_event: row.missing_business_event,
      needs_review: row.needs_review,
      posting_failed: row.posting_failed,
    })),
    total_records: gate.total_records,
    classified_records: gate.classified_records,
    missing_business_event: gate.missing_business_event,
    needs_review: gate.needs_review,
    posting_failed: gate.posting_failed,
    readiness_score: gate.readiness_score,
    can_enable_professional: gate.can_enable_professional,
    blocking_reasons: gate.blocking_reasons,
  };
}

async function loadProfessionalModeReadinessGate(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProfessionalModeReadinessGate> {
  const { data, error } = await supabase.rpc('get_accounting_readiness', {
    p_tenant_id: tenantId,
  });

  if (error) throw error;

  const rows = ((data || []) as ReadinessRpcRow[]).map((row) => ({
    source_table: row.source_table,
    total_records: toNumber(row.total_records),
    classified_records: toNumber(row.classified_records),
    missing_business_event: toNumber(row.missing_business_event),
    needs_review: toNumber(row.needs_review),
    posting_failed: toNumber(row.posting_failed),
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
  const blocking_reasons = buildBlockingReasons({
    readiness_score,
    missing_business_event: summary.missing_business_event,
    needs_review: summary.needs_review,
    posting_failed: summary.posting_failed,
  });

  return {
    rows,
    ...summary,
    readiness_score,
    can_enable_professional: blocking_reasons.length === 0,
    blocking_reasons,
  };
}

async function assertCanEnableProfessional(
  supabase: SupabaseClient,
  tenantId: string
): Promise<ProfessionalModeReadinessGate> {
  const gate = await loadProfessionalModeReadinessGate(supabase, tenantId);
  if (!gate.can_enable_professional) {
    throw new Error(`Chưa thể bật Professional Core: ${gate.blocking_reasons.join(' ')}`);
  }
  return gate;
}

export async function getAccountingMode(): Promise<AccountingMode> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized: missing tenant session.');

  const { data, error } = await supabase
    .from('tenants')
    .select('accounting_mode')
    .eq('id', user.tenant_id)
    .single();

  if (error || !data) {
    return 'SIMPLE';
  }
  return (data.accounting_mode as AccountingMode) || 'SIMPLE';
}

export async function getProfessionalModeReadinessGate(): Promise<ProfessionalModeReadinessGate> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được xem điều kiện bật Professional Core.');
  }

  return loadProfessionalModeReadinessGate(supabase, user.tenant_id);
}

export async function updateAccountingMode(mode: AccountingMode) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin mới được thay đổi chế độ kế toán.');
  }

  const readinessGate = mode === 'PROFESSIONAL'
    ? await assertCanEnableProfessional(supabase, user.tenant_id)
    : null;
  const payload: Database['public']['Tables']['tenants']['Update'] = {
    accounting_mode: mode,
  };

  const { error } = await supabase
    .from('tenants')
    .update(payload)
    .eq('id', user.tenant_id);

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: user.tenant_id,
    new_data: {
      accounting_mode: mode,
      readiness_gate: serializeReadinessGate(readinessGate),
      professional_rollback: mode === 'SIMPLE',
    },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  await safeRevalidatePath('/dashboard/accounting/readiness');
  return { success: true };
}

export async function syncLegacyToLedger() {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được thực hiện đồng bộ dữ liệu kế toán sổ cái.');
  }

  const tenantId = user.tenant_id;
  const supabase = await createClient();
  const readinessGate = await assertCanEnableProfessional(supabase, tenantId);

  const { data, error } = await supabase.rpc('sync_legacy_to_ledger_atomic', {
    p_tenant_id: tenantId,
    p_created_by: user.id,
  });

  if (error) throw error;

  const result = data?.[0];
  if (!result) {
    throw new Error('Đồng bộ sổ cái không trả về kết quả.');
  }

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: tenantId,
    new_data: {
      accounting_mode: 'PROFESSIONAL',
      synced_revenue: result.synced_revenue_count,
      synced_expense: result.synced_expense_count,
      synced_salary: result.synced_salary_count,
      readiness_gate: serializeReadinessGate(readinessGate),
    },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  await safeRevalidatePath('/dashboard/accounting/readiness');
  return {
    success: true,
    syncedRevenueCount: result.synced_revenue_count,
    syncedExpenseCount: result.synced_expense_count,
    syncedSalaryCount: result.synced_salary_count,
  };
}
