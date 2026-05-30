'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';
import { AccountingEngineService } from '../accounting-engine';
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

  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error('Lỗi: Thiếu SUPABASE_SERVICE_ROLE_KEY trên server để thực hiện đồng bộ.');
  }
  const adminClient = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: existingEntries, error: existingError } = await adminClient
    .from('journal_entries')
    .select('reference_id')
    .eq('tenant_id', tenantId)
    .not('reference_id', 'is', null);

  if (existingError) throw existingError;
  const existingSet = new Set((existingEntries || []).map((entry) => entry.reference_id));

  let syncedRevenueCount = 0;
  let syncedExpenseCount = 0;
  let syncedSalaryCount = 0;

  const { data: revenues, error: revError } = await adminClient
    .from('revenue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed');

  if (revError) throw revError;

  const { data: cashAcc, error: cashAccErr } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '111')
    .eq('is_active', true)
    .single();

  const { data: bankAcc, error: bankAccErr } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '112')
    .eq('is_active', true)
    .single();

  const { data: revAcc, error: revAccErr } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '5111')
    .eq('is_active', true)
    .single();

  if (cashAccErr || bankAccErr || revAccErr || !cashAcc || !bankAcc || !revAcc) {
    throw new Error('Thiếu cấu hình tài khoản kế toán 111, 112 hoặc 5111 cho chi nhánh này trong COA.');
  }

  for (const rev of (revenues || [])) {
    if (existingSet.has(rev.id)) continue;

    const amount = Number(rev.amount);
    if (amount <= 0) continue;

    const payAccountId = rev.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

    await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `[Đồng bộ lịch sử] ${rev.description || 'Doanh thu dịch vụ'}`,
      reference_type: 'PACKAGE_SALE',
      reference_id: rev.id,
      entry_date: rev.received_date ? rev.received_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      lines: [
        { account_id: payAccountId, debit_amount: amount, credit_amount: 0, branch_id: rev.branch_id || undefined },
        { account_id: revAcc.id, debit_amount: 0, credit_amount: amount, branch_id: rev.branch_id || undefined },
      ],
    });
    syncedRevenueCount++;
  }

  const { data: expenses, error: expError } = await adminClient
    .from('expenses')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved');

  if (expError) throw expError;

  for (const exp of (expenses || [])) {
    if (existingSet.has(exp.id)) continue;

    const amount = Number(exp.amount);
    if (amount <= 0) continue;

    let expenseAccountCode = '6427';
    const normCategory = exp.category?.toLowerCase();
    if (normCategory === 'rent') {
      expenseAccountCode = '6423';
    } else if (normCategory === 'utilities') {
      expenseAccountCode = '6424';
    } else if (normCategory === 'marketing') {
      expenseAccountCode = '6425';
    } else if (normCategory === 'materials') {
      expenseAccountCode = '632';
    } else if (normCategory === 'salary') {
      expenseAccountCode = '6421';
    }

    const { data: expAcc, error: expAccError } = await adminClient
      .from('accounting_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('account_code', expenseAccountCode)
      .eq('is_active', true)
      .single();

    if (expAccError) throw expAccError;
    if (!expAcc) continue;

    const payAccountId = exp.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

    await AccountingEngineService.postJournalEntry({
      tenant_id: tenantId,
      description: `[Đồng bộ lịch sử] ${exp.description || 'Chi phí vận hành'}`,
      reference_type: 'EXPENSE',
      reference_id: exp.id,
      entry_date: exp.expense_date ? exp.expense_date.slice(0, 10) : new Date().toISOString().slice(0, 10),
      lines: [
        { account_id: expAcc.id, debit_amount: amount, credit_amount: 0, branch_id: exp.branch_id || undefined },
        { account_id: payAccountId, debit_amount: 0, credit_amount: amount, branch_id: exp.branch_id || undefined },
      ],
    });
    syncedExpenseCount++;
  }

  const { data: salaries, error: salError } = await adminClient
    .from('salary_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid');

  if (salError) throw salError;

  const { data: payableAcc, error: payableAccError } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '334')
    .eq('is_active', true)
    .single();

  const { data: salCostAcc, error: salCostAccError } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '6421')
    .eq('is_active', true)
    .single();

  if (payableAccError) throw payableAccError;
  if (salCostAccError) throw salCostAccError;

  if (payableAcc && salCostAcc) {
    for (const sal of (salaries || [])) {
      if (existingSet.has(sal.id)) continue;

      const totalAmount =
        Number(sal.base_salary || 0) +
        Number(sal.kpi_bonus || 0) +
        Number(sal.service_percentage_bonus || 0) -
        Number(sal.violations_deduction || 0);
      if (totalAmount <= 0) continue;

      const payAccountId = sal.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

      await AccountingEngineService.postJournalEntry({
        tenant_id: tenantId,
        description: `[Đồng bộ lịch sử] Hạch toán chi phí lương KTV - Kỳ ${sal.month_year}`,
        reference_type: 'SALARY_PAYMENT',
        reference_id: sal.id,
        entry_date: sal.month_year ? sal.month_year.slice(0, 10) : new Date().toISOString().slice(0, 10),
        lines: [
          { account_id: salCostAcc.id, debit_amount: totalAmount, credit_amount: 0, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
          { account_id: payableAcc.id, debit_amount: 0, credit_amount: totalAmount, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
        ],
      });

      await AccountingEngineService.postJournalEntry({
        tenant_id: tenantId,
        description: `[Đồng bộ lịch sử] Chi trả lương KTV - Kỳ ${sal.month_year}`,
        reference_type: 'SALARY_PAYMENT',
        reference_id: `${sal.id}-PAY`,
        entry_date: sal.month_year ? sal.month_year.slice(0, 10) : new Date().toISOString().slice(0, 10),
        lines: [
          { account_id: payableAcc.id, debit_amount: totalAmount, credit_amount: 0, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
          { account_id: payAccountId, debit_amount: 0, credit_amount: totalAmount, branch_id: sal.branch_id || undefined, ktv_id: sal.ktv_id || undefined },
        ],
      });

      syncedSalaryCount++;
    }
  }

  const updatePayload: Database['public']['Tables']['tenants']['Update'] = {
    accounting_mode: 'PROFESSIONAL',
  };
  const { error: modeUpdateError } = await adminClient
    .from('tenants')
    .update(updatePayload)
    .eq('id', tenantId);

  if (modeUpdateError) throw modeUpdateError;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: tenantId,
    new_data: {
      accounting_mode: 'PROFESSIONAL',
      synced_revenue: syncedRevenueCount,
      synced_expense: syncedExpenseCount,
      synced_salary: syncedSalaryCount,
      readiness_gate: serializeReadinessGate(readinessGate),
    },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  await safeRevalidatePath('/dashboard/accounting/readiness');
  return {
    success: true,
    syncedRevenueCount,
    syncedExpenseCount,
    syncedSalaryCount,
  };
}
