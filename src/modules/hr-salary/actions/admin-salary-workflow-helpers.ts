import { revalidatePath } from 'next/cache';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { findMissingRequiredFields, inferBusinessEventType } from '@/services/accounting/template-rules';
import { recordAuditLog } from '@/services/audit-actions';
import { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

type SalaryWorkflowClient = SupabaseClient<Database>;
type ActionFailure = { success: false; error: string };

interface SalaryExpenseInput {
  supabase: SalaryWorkflowClient;
  tenantId: string;
  amount: number;
  description: string;
  expenseDate: string;
  context: string;
}

interface SalaryAuditInput {
  recordId: string;
  status: string;
  amount?: number | null;
  ktvName?: string | null;
  extraData?: Record<string, unknown>;
}

function resolveAccountingReviewStatus(
  businessEventType: ReturnType<typeof inferBusinessEventType>,
  payload: Record<string, unknown>
) {
  if (!businessEventType) return 'NEEDS_REVIEW';
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? 'NEEDS_REVIEW'
    : 'UNREVIEWED';
}

export async function getSalaryMonthLockFailure(
  monthYear: string,
  lockedError: string
): Promise<ActionFailure | null> {
  const { checkMonthLock } = await import('@/services/audit-actions');
  const { isLocked } = await checkMonthLock(monthYear);

  return isLocked ? { success: false, error: lockedError } : null;
}

export async function createSalaryExpense({
  supabase,
  tenantId,
  amount,
  description,
  expenseDate,
  context,
}: SalaryExpenseInput) {
  const businessEventType = inferBusinessEventType({
    sourceTable: 'expenses',
    category: 'salary',
  });
  const accountingPayload = {
    amount,
    payment_method: 'bank_transfer',
    expense_date: expenseDate,
    description,
  };

  await assertOpenAccountingPeriod(supabase, {
    tenantId,
    date: expenseDate,
    context,
  });

  const expensePayload: Database['public']['Tables']['expenses']['Insert'] = {
    amount,
    category: 'salary',
    description,
    status: 'submitted',
    expense_date: expenseDate,
    tenant_id: tenantId,
    business_event_type: businessEventType,
    accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
    accounting_metadata: accountingPayload,
  };

  const { error } = await supabase.from('expenses').insert(expensePayload);
  if (error) throw error;
}

export async function recordSalaryStatusAudit({
  recordId,
  status,
  amount,
  ktvName,
  extraData,
}: SalaryAuditInput) {
  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'salary_records',
    record_id: recordId,
    new_data: {
      status,
      ...(amount !== undefined ? { amount } : {}),
      ...(ktvName !== undefined ? { ktv_name: ktvName } : {}),
      ...(extraData ?? {}),
    },
  });
}

export function revalidateSalaryPage() {
  revalidatePath('/dashboard/salary');
}

export function revalidateSalaryAndFinancePages() {
  revalidatePath('/dashboard/salary');
  revalidatePath('/dashboard/finance');
}

export function revalidateApprovedSalaryViews() {
  revalidatePath('/dashboard/finance', 'page');
  revalidatePath('/dashboard/salary', 'page');
  revalidatePath('/', 'layout');
}
