'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '../../../services/user-actions';

export type SalaryAccrualResult = {
  salary_record_id: string;
  ktv_id: string;
  month_year: string;
  base_component: number;
  entry_id: string | null;
  action: 'CREATED' | 'SKIPPED_ZERO';
};

/**
 * Tạo bút toán SALARY_ACCRUAL cho phần lương cố định (base_salary, kpi, rating)
 * của các salary_records chưa có bút toán accrual.
 *
 * Phần session_bonus đã được SESSION_DONE ghi nhận rồi → chỉ hạch toán phần chênh lệch.
 * Nợ 6421 / Có 334.
 *
 * Hàm này idempotent — chạy nhiều lần an toàn.
 */
export async function createSalaryAccrualJournals(
  fromDate: string,
  toDate: string,
): Promise<{
  success: true;
  results: SalaryAccrualResult[];
  created: number;
  skipped: number;
}> {
  const user = await getCurrentUser();
  if (
    !user?.tenant_id ||
    !['admin', 'super_admin', 'accountant'].includes(user.role || '')
  ) {
    throw new Error('Unauthorized: chỉ admin/kế toán mới được tạo bút toán lương.');
  }

  const supabase = await createClient();

  const { data, error } = await supabase.rpc('create_salary_accrual_journals', {
    p_tenant_id: user.tenant_id,
    p_from_date: fromDate,
    p_to_date: toDate,
    p_created_by: user.id,
  });

  if (error) throw error;

  const results: SalaryAccrualResult[] = ((data as SalaryAccrualResult[]) || []).map(
    (row) => ({
      salary_record_id: row.salary_record_id,
      ktv_id: row.ktv_id,
      month_year: row.month_year,
      base_component: Number(row.base_component),
      entry_id: row.entry_id,
      action: row.action,
    }),
  );

  return {
    success: true,
    results,
    created: results.filter((r) => r.action === 'CREATED').length,
    skipped: results.filter((r) => r.action === 'SKIPPED_ZERO').length,
  };
}
