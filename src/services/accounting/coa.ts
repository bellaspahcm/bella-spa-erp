'use server';

import { createClient } from '@/lib/supabase-server';
import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';
import type { CreateAccountInput } from './types';

export async function getAccounts() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');

  const { data, error } = await supabase
    .from('accounting_accounts')
    .select('*')
    .eq('tenant_id', user.tenant_id)
    .order('account_code', { ascending: true });

  if (error) throw error;
  return data;
}

export async function createAccount(input: CreateAccountInput) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can manage the Chart of Accounts.');
  }

  // Validate parent_id belongs to the same tenant if provided
  if (input.parent_id) {
    const { data: parent, error: parentError } = await supabase
      .from('accounting_accounts')
      .select('id')
      .eq('id', input.parent_id)
      .eq('tenant_id', user.tenant_id)
      .single();

    if (parentError || !parent) {
      throw new Error('Tài khoản cha không hợp lệ hoặc không thuộc chi nhánh này.');
    }
  }

  const { data, error } = await supabase
    .from('accounting_accounts')
    .insert({
      tenant_id: user.tenant_id,
      account_code: input.account_code,
      account_name: input.account_name,
      account_type: input.account_type,
      parent_id: input.parent_id || null,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    if (error.code === '23505') {
      throw new Error(`Mã tài khoản "${input.account_code}" đã tồn tại trong hệ thống.`);
    }
    throw error;
  }

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'accounting_accounts',
    record_id: data.id,
    new_data: data,
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return { success: true, data };
}

export async function updateAccount(id: string, input: Partial<CreateAccountInput> & { is_active?: boolean }) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can manage the Chart of Accounts.');
  }

  const { data, error } = await supabase
    .from('accounting_accounts')
    .update({
      account_name: input.account_name,
      is_active: input.is_active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('tenant_id', user.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_accounts',
    record_id: id,
    new_data: data,
  });

  await safeRevalidatePath('/dashboard/accounting/chart-of-accounts');
  return { success: true, data };
}
