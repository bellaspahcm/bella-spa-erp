'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';

export async function getAccountingPeriods() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase
    .from('accounting_periods')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('start_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function previewClosingEntries(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can preview closing entries.');
  }

  const { data, error } = await supabase.rpc('preview_closing_entries', {
    p_period_id: periodId,
  });

  if (error) throw error;
  return data || [];
}

export async function closePeriodAction(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can close accounting periods.');
  }

  // RPC close_accounting_period handles validation, generation, lock cascade atomically
  const { error } = await supabase.rpc('close_accounting_period', { p_period_id: periodId });
  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_periods',
    record_id: periodId,
    new_data: { status: 'CLOSED', closed_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/periods');
  await safeRevalidatePath('/dashboard/accounting/journals');
  return { success: true };
}

export async function reopenPeriodAction(periodId: string) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user) throw new Error('Unauthorized.');

  const { error } = await supabase.rpc('reopen_accounting_period', { p_period_id: periodId });
  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_periods',
    record_id: periodId,
    new_data: { status: 'OPEN', reopened_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/periods');
  return { success: true };
}
