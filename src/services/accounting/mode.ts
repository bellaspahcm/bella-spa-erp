'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';
import { AccountingEngineService } from '../accounting-engine';

export async function getAccountingMode(): Promise<'SIMPLE' | 'PROFESSIONAL'> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized: missing tenant session.');

  const { data, error } = await supabase
    .from('tenants')
    .select('accounting_mode')
    .eq('id', user.tenant_id)
    .single();

  if (error || !data) {
    return 'SIMPLE'; // Fallback mặc định
  }
  return (data.accounting_mode as 'SIMPLE' | 'PROFESSIONAL') || 'SIMPLE';
}

export async function updateAccountingMode(mode: 'SIMPLE' | 'PROFESSIONAL') {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin mới được thay đổi chế độ kế toán.');
  }

  const { error } = await supabase
    .from('tenants')
    .update({ accounting_mode: mode })
    .eq('id', user.tenant_id);

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: user.tenant_id,
    new_data: { accounting_mode: mode },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  return { success: true };
}

export async function syncLegacyToLedger() {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin', 'accountant'].includes(user.role || '')) {
    throw new Error('Unauthorized: chỉ admin mới được thực hiện đồng bộ dữ liệu kế toán sổ cái.');
  }

  const tenantId = user.tenant_id;

  // Load service role client to post entries bypassing RLS restrictions
  const { createClient: createAdmin } = await import('@supabase/supabase-js');
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    throw new Error('Lỗi: Thiếu SUPABASE_SERVICE_ROLE_KEY trên server để thực hiện đồng bộ.');
  }
  const adminClient = createAdmin(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1. Lấy danh sách các reference_id đã được hạch toán trước đó trong journal_entries để tránh trùng
  const { data: existingEntries, error: existingError } = await adminClient
    .from('journal_entries')
    .select('reference_id')
    .eq('tenant_id', tenantId)
    .not('reference_id', 'is', null);

  if (existingError) throw existingError;
  const existingSet = new Set(existingEntries.map(e => e.reference_id));

  let syncedRevenueCount = 0;
  let syncedExpenseCount = 0;
  let syncedSalaryCount = 0;

  // ── A. ĐỒNG BỘ DOANH THU (REVENUE) ──
  const { data: revenues, error: revError } = await adminClient
    .from('revenue')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'confirmed');

  if (revError) throw revError;

  // Cache COA accounts
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

  if (cashAccErr || bankAccErr || revAccErr) {
    throw new Error('Thiếu cấu hình tài khoản kế toán 111, 112 hoặc 5111 cho chi nhánh này trong COA.');
  }

  for (const rev of (revenues || [])) {
    if (existingSet.has(rev.id)) continue; // Bỏ qua nếu đã hạch toán

    const amount = Number(rev.amount);
    if (amount <= 0) continue;

    const payAccountId = rev.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

    // Hạch toán: Nợ 111/112 Có 5111
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

  // ── B. ĐỒNG BỘ CHI PHÍ (EXPENSES) ──
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

    // Định vị tài khoản chi phí tương tự handleExpenseRecorded
    let expenseAccountCode = '6427'; // Chi phí khác bằng tiền
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

    const { data: expAcc } = await adminClient
      .from('accounting_accounts')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('account_code', expenseAccountCode)
      .eq('is_active', true)
      .single();

    if (!expAcc) continue;

    const payAccountId = exp.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

    // Hạch toán: Nợ Chi phí Có 111/112
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

  // ── C. ĐỒNG BỘ CHI PHÍ LƯƠNG (SALARY RECORDS) ──
  const { data: salaries, error: salError } = await adminClient
    .from('salary_records')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('status', 'paid');

  if (salError) throw salError;

  const { data: payableAcc } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '334')
    .eq('is_active', true)
    .single();

  const { data: salCostAcc } = await adminClient
    .from('accounting_accounts')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('account_code', '6421')
    .eq('is_active', true)
    .single();

  if (payableAcc && salCostAcc) {
    for (const sal of (salaries || [])) {
      if (existingSet.has(sal.id)) continue;

      // Tính tổng lương thực tế trả
      const totalAmount = Number(sal.base_salary || 0) + Number(sal.kpi_bonus || 0) + Number(sal.service_percentage_bonus || 0) - Number(sal.violations_deduction || 0);
      if (totalAmount <= 0) continue;

      const payAccountId = sal.payment_method?.toLowerCase() === 'cash' ? cashAcc.id : bankAcc.id;

      // Lương gồm 2 bước trong sổ kép:
      // Bước 1: Ghi nhận chi phí lương: Nợ 6421 Có 334
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

      // Bước 2: Trả lương thực tế: Nợ 334 Có 111/112 (vì đã paid)
      // Tạo ID phụ để tránh trùng lặp reference_id cho bước 2
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

  // Tự động kích hoạt chuyển sang chế độ PROFESSIONAL
  await adminClient
    .from('tenants')
    .update({ accounting_mode: 'PROFESSIONAL' })
    .eq('id', tenantId);

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'tenants',
    record_id: tenantId,
    new_data: {
      accounting_mode: 'PROFESSIONAL',
      synced_revenue: syncedRevenueCount,
      synced_expense: syncedExpenseCount,
      synced_salary: syncedSalaryCount,
    },
  });

  await safeRevalidatePath('/dashboard/accounting/reconciliation');
  return {
    success: true,
    syncedRevenueCount,
    syncedExpenseCount,
    syncedSalaryCount,
  };
}
