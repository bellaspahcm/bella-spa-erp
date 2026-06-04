'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';
import { AccountingEngineService } from '../accounting-engine';
import { createAccountingDataClient } from './client';
import type { AccountingReferenceType } from '@/lib/accounting-outbox';
import type { ManualJournalInput } from './types';

export async function getJournalEntries(filters?: {
  from_date?: string;
  to_date?: string;
  status?: 'DRAFT' | 'POSTED' | 'CANCELED';
  reference_type?: string;
}) {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');
  const supabase = await createAccountingDataClient();

  let query = supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounting_accounts (account_code, account_name)
      )
    `)
    .eq('tenant_id', user.tenant_id);

  if (filters?.from_date) {
    query = query.gte('entry_date', filters.from_date);
  }
  if (filters?.to_date) {
    query = query.lte('entry_date', filters.to_date);
  }
  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.reference_type) {
    query = query.eq('reference_type', filters.reference_type);
  }

  const { data, error } = await query.order('entry_date', { ascending: false }).order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function getJournalEntryDetails(entryId: string) {
  const user = await getCurrentUser();
  if (!user?.tenant_id) throw new Error('Unauthorized or missing tenant session.');
  const supabase = await createAccountingDataClient();

  const { data, error } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (
        *,
        accounting_accounts (account_code, account_name)
      )
    `)
    .eq('id', entryId)
    .eq('tenant_id', user.tenant_id)
    .single();

  if (error) throw error;
  return data;
}

export async function reverseJournalEntry(entryId: string, reason: string) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can reverse journal entries.');
  }
  const supabase = await createAccountingDataClient();

  // 1. Fetch original entry and lines
  const { data: original, error: fetchError } = await supabase
    .from('journal_entries')
    .select(`
      *,
      journal_lines (*)
    `)
    .eq('id', entryId)
    .eq('tenant_id', user.tenant_id)
    .single();

  if (fetchError || !original) {
    throw new Error(fetchError?.message ?? 'Không tìm thấy bút toán cần đảo.');
  }

  if (original.status !== 'POSTED') {
    throw new Error('Chỉ có thể đảo bút toán đã ghi sổ (POSTED).');
  }

  // 2. Prepare reversed entries
  const reversalInput = {
    tenant_id: user.tenant_id, // Safely use current tenant_id
    description: `Ghi đảo bút toán (Reversal of entry: ${original.id}) - Lý do: ${reason}`,
    reference_type: 'REVERSAL' as AccountingReferenceType,
    reference_id: original.id,
    entry_date: original.entry_date, // Keep the same date
    lines: original.journal_lines.map((l) => ({
      account_id: l.account_id,
      debit_amount: Number(l.credit_amount), // Swapped!
      credit_amount: Number(l.debit_amount), // Swapped!
      branch_id: l.branch_id || undefined,
      ktv_id: l.ktv_id || undefined,
      cost_center_id: l.cost_center_id || undefined,
    })),
  };

  // 3. Post reversing entry (atomic bypasses RLS safely via service-role AccountingEngineService)
  const reversalEntryId = await AccountingEngineService.postJournalEntry(reversalInput);

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'journal_entries',
    record_id: reversalEntryId,
    new_data: { reversal_of: original.id, reason },
  });

  await safeRevalidatePath(`/dashboard/accounting/journals`);
  await safeRevalidatePath(`/dashboard/accounting/journals/${entryId}`);

  return { success: true, reversalEntryId };
}

export async function getOutboxEvents(filters?: {
  status?: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD';
  event_type?: string;
}) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can monitor the transactional outbox queue.');
  }
  const supabase = await createAccountingDataClient();

  let query = supabase
    .from('accounting_outbox')
    .select('*')
    .eq('tenant_id', user.tenant_id);

  if (filters?.status) {
    query = query.eq('status', filters.status);
  }
  if (filters?.event_type) {
    query = query.eq('event_type', filters.event_type);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function replayOutboxEvent(outboxId: string) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can trigger outbox retries.');
  }
  const supabase = await createAccountingDataClient();

  // Reset outbox entry to PENDING, retry_count = 0, and clear last error to make cron worker claim it immediately
  const { data, error } = await supabase
    .from('accounting_outbox')
    .update({
      status: 'PENDING',
      retry_count: 0,
      last_error: null,
      next_retry_at: new Date().toISOString(),
    })
    .eq('id', outboxId)
    .eq('tenant_id', user.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_outbox',
    record_id: outboxId,
    new_data: { status: 'PENDING', reset_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/outbox');
  return { success: true, data };
}

export async function postManualJournalEntry(input: ManualJournalInput) {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can post manual adjusting entries.');
  }

  // Prepare input formatting
  const journalInput = {
    tenant_id: user.tenant_id,
    description: input.description,
    reference_type: 'MANUAL' as AccountingReferenceType,
    reference_id: user.id, // Reference creator admin's uuid
    entry_date: input.entry_date || new Date().toISOString().slice(0, 10),
    lines: input.lines.map(l => ({
      account_id: l.account_id,
      debit_amount: l.debit_amount,
      credit_amount: l.credit_amount,
      branch_id: l.branch_id || undefined,
      ktv_id: l.ktv_id || undefined,
      cost_center_id: l.cost_center_id || undefined,
    })),
  };

  // Standard balanced triggers are evaluated inside this call
  const entryId = await AccountingEngineService.postJournalEntry(journalInput);

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'journal_entries',
    record_id: entryId,
    new_data: { description: input.description, manual: true },
  });

  await safeRevalidatePath('/dashboard/accounting/journals');
  return { success: true, entryId };
}
