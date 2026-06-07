import { revalidatePath } from 'next/cache';
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { inferBusinessEventType, resolveAccountingReviewStatus } from '@/services/accounting/template-rules';
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

type ExistingSalaryExpense = {
  id: string;
  amount: number | null;
};

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
};

interface SalaryAuditInput {
  recordId: string;
  status: string;
  amount?: number | null;
  ktvName?: string | null;
  extraData?: Record<string, unknown>;
}

function isUniqueViolation(error: unknown) {
  const maybeError = error as SupabaseErrorLike | null;
  return maybeError?.code === '23505';
}

function assertMatchingSalaryExpenseAmount({
  existing,
  amount,
  description,
  context,
}: {
  existing: ExistingSalaryExpense;
  amount: number;
  description: string;
  context: string;
}) {
  if (Number(existing.amount || 0) !== Number(amount || 0)) {
    throw new Error(
      `${context}: existing salary expense amount mismatch for "${description}" (expected ${amount}, found ${existing.amount ?? 0})`,
    );
  }

  return { created: false, expenseId: existing.id };
}

async function findExistingSalaryExpense(
  supabase: SalaryWorkflowClient,
  tenantId: string,
  description: string
): Promise<ExistingSalaryExpense | null> {
  const { data: existingExpense, error: existingExpenseError } = await supabase
    .from('expenses')
    .select('id, amount')
    .eq('tenant_id', tenantId)
    .eq('category', 'salary')
    .eq('description', description)
    .maybeSingle();

  if (existingExpenseError) throw existingExpenseError;
  return existingExpense as ExistingSalaryExpense | null;
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

  const existingExpense = await findExistingSalaryExpense(supabase, tenantId, description);
  if (existingExpense) {
    return assertMatchingSalaryExpenseAmount({ existing: existingExpense, amount, description, context });
  }

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
  if (error) {
    if (isUniqueViolation(error)) {
      const racedExpense = await findExistingSalaryExpense(supabase, tenantId, description);
      if (racedExpense) {
        return assertMatchingSalaryExpenseAmount({ existing: racedExpense, amount, description, context });
      }
    }

    throw error;
  }
  return { created: true, expenseId: null };
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
