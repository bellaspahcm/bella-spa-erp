'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '../audit-actions';
import { getCurrentUser } from '../user-actions';
import { AccountingEngineService } from '../accounting-engine';
import { createAccountingDataClient } from './client';
import type { AccountingReferenceType } from '@/lib/accounting-outbox';
import {
  classifyAccountingOutboxError,
  getOutboxAgeMinutes,
  getOutboxJournalReferenceType,
  getOutboxOriginHref,
  getOutboxReplayDiagnostics,
  isAccountingOutboxStale,
} from '@/lib/accounting-outbox-monitoring';
import type { Database } from '@/types/database.types';
import type { ManualJournalInput } from './types';

type OutboxRow = Database['public']['Tables']['accounting_outbox']['Row'];
type OutboxUpdate = Database['public']['Tables']['accounting_outbox']['Update'];
type OutboxReplayRow = Pick<
  OutboxRow,
  | 'id'
  | 'tenant_id'
  | 'status'
  | 'event_type'
  | 'reference_type'
  | 'reference_id'
  | 'retry_count'
  | 'max_retries'
  | 'last_error'
  | 'journal_entry_id'
  | 'created_at'
  | 'next_retry_at'
>;
type ExistingReplayJournal = {
  id: string;
  status: string;
};
type MarkOutboxCompletedRpcClient = {
  rpc: (
    fn: 'mark_outbox_completed',
    args: { p_outbox_id: string; p_journal_entry_id: string | null }
  ) => Promise<{ error: { message: string } | null }>;
};

function formatJournalDisplayDescription(description: string | null) {
  if (!description) return description;

  return description
    .replace(/Health repair:/gi, 'Đối soát bổ sung:')
    .replace(/hoan thanh buoi/gi, 'hoàn thành buổi');
}

function withDisplayDescription<T extends { description: string | null }>(row: T): T {
  return {
    ...row,
    description: formatJournalDisplayDescription(row.description),
  };
}

export type OutboxEventWithDiagnostics = OutboxRow & {
  age_minutes: number;
  is_stale: boolean;
  error_category: string;
  error_category_label: string;
  origin_href: string | null;
  journal_reference_type: string | null;
  replay_state: string;
  replay_reason: string;
};

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
  return (data || []).map(withDisplayDescription);
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
  return withDisplayDescription(data);
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
}): Promise<OutboxEventWithDiagnostics[]> {
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
  const now = new Date();

  return ((data || []) as OutboxRow[]).map((row) => {
    const errorCategory = classifyAccountingOutboxError(row.last_error);
    const replay = getOutboxReplayDiagnostics(row.status);

    return {
      ...row,
      age_minutes: getOutboxAgeMinutes(row.created_at, now),
      is_stale: isAccountingOutboxStale(row, now),
      error_category: errorCategory.category,
      error_category_label: errorCategory.label,
      origin_href: getOutboxOriginHref(row.reference_type, row.reference_id),
      journal_reference_type: getOutboxJournalReferenceType(row.event_type),
      replay_state: replay.state,
      replay_reason: replay.reason,
    };
  });
}

async function findExistingReplayJournal(
  supabase: Awaited<ReturnType<typeof createAccountingDataClient>>,
  tenantId: string,
  eventType: string,
  referenceId: string
): Promise<ExistingReplayJournal | null> {
  const journalReferenceType = getOutboxJournalReferenceType(eventType);
  if (!journalReferenceType) return null;

  const { data, error } = await supabase
    .from('journal_entries')
    .select('id,status')
    .eq('tenant_id', tenantId)
    .eq('reference_type', journalReferenceType)
    .eq('reference_id', referenceId)
    .neq('status', 'CANCELED')
    .maybeSingle();

  if (error) {
    throw new Error(`Khong the kiem tra but toan active truoc khi replay: ${error.message}`);
  }

  return data ? { id: data.id, status: data.status } : null;
}

async function markOutboxCompletedFromReplay(
  supabase: Awaited<ReturnType<typeof createAccountingDataClient>>,
  outboxId: string,
  journalEntryId: string
) {
  const rpcClient = supabase as unknown as MarkOutboxCompletedRpcClient;
  const { error } = await rpcClient.rpc('mark_outbox_completed', {
    p_outbox_id: outboxId,
    p_journal_entry_id: journalEntryId,
  });

  if (error) {
    throw new Error(`Khong the danh dau outbox da hoan tat: ${error.message}`);
  }
}

export async function replayOutboxEvent(outboxId: string): Promise<{
  success: true;
  action: 'queued_replay' | 'completed_existing_journal';
  message: string;
  data: OutboxRow | OutboxReplayRow;
}> {
  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: Only branch admins can trigger outbox retries.');
  }
  const supabase = await createAccountingDataClient();

  const { data: outbox, error: fetchError } = await supabase
    .from('accounting_outbox')
    .select('id, tenant_id, status, event_type, reference_type, reference_id, retry_count, max_retries, last_error, journal_entry_id, created_at, next_retry_at')
    .eq('id', outboxId)
    .eq('tenant_id', user.tenant_id)
    .single();

  if (fetchError || !outbox) {
    throw new Error(fetchError?.message ?? 'Khong tim thay su kien outbox can replay.');
  }

  const currentOutbox = outbox as OutboxReplayRow;
  if (currentOutbox.status === 'COMPLETED') {
    throw new Error('Outbox da hoan tat, khong can replay.');
  }
  if (currentOutbox.status === 'PROCESSING') {
    throw new Error('Outbox dang duoc worker xu ly, khong replay de tranh tao but toan lap.');
  }
  if (!['FAILED', 'DEAD'].includes(currentOutbox.status)) {
    throw new Error('Chi replay cac outbox dang FAILED hoac DEAD.');
  }

  const existingJournal = await findExistingReplayJournal(
    supabase,
    user.tenant_id,
    currentOutbox.event_type,
    currentOutbox.reference_id
  );

  if (existingJournal?.status === 'POSTED') {
    await markOutboxCompletedFromReplay(supabase, currentOutbox.id, existingJournal.id);

    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'accounting_outbox',
      record_id: outboxId,
      old_data: {
        status: currentOutbox.status,
        retry_count: currentOutbox.retry_count,
        last_error: currentOutbox.last_error,
      },
      new_data: {
        status: 'COMPLETED',
        completed_from_existing_journal: existingJournal.id,
        reset_by: user.id,
      },
    });

    await safeRevalidatePath('/dashboard/accounting/outbox');
    return {
      success: true,
      action: 'completed_existing_journal',
      message: 'Da co but toan POSTED, da danh dau outbox hoan tat ma khong post lai.',
      data: {
        ...currentOutbox,
        status: 'COMPLETED',
        journal_entry_id: existingJournal.id,
      },
    };
  }

  if (existingJournal) {
    throw new Error(`Da co but toan ${existingJournal.status} cho nghiep vu nay. Khong replay tu dong de tranh lech so.`);
  }

  const replayPayload: OutboxUpdate = {
    status: 'PENDING',
    retry_count: 0,
    last_error: null,
    next_retry_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('accounting_outbox')
    .update(replayPayload)
    .eq('id', outboxId)
    .eq('tenant_id', user.tenant_id)
    .select()
    .single();

  if (error) throw error;

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'accounting_outbox',
    record_id: outboxId,
    old_data: {
      status: currentOutbox.status,
      retry_count: currentOutbox.retry_count,
      last_error: currentOutbox.last_error,
    },
    new_data: { status: 'PENDING', reset_by: user.id },
  });

  await safeRevalidatePath('/dashboard/accounting/outbox');
  return {
    success: true,
    action: 'queued_replay',
    message: 'Da dua outbox ve PENDING de worker xu ly lai.',
    data: data as OutboxRow,
  };
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
