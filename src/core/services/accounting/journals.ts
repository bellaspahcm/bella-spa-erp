'use server';

import { safeRevalidatePath } from '@/lib/revalidate';
import { recordAuditLog } from '@/services/audit-actions';
import { getCurrentUser } from '@/services/user-actions';
import { AccountingEngineService } from '@/services/accounting-engine';
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

/**
 * Formats journal entry descriptions for display in Vietnamese.
 * 
 * Translates common English phrases to Vietnamese for better UX.
 * 
 * @param description - Raw journal entry description (can be null)
 * @returns Formatted description with Vietnamese translations, or null if input is null
 * 
 * @remarks
 * **Translations Applied:**
 * - "Health repair:" → "Đối soát bổ sung:"
 * - "hoan thanh buoi" → "hoàn thành buổi"
 * 
 * **Case Insensitive:**
 * Uses case-insensitive matching (`/gi` flag) to handle various input formats.
 * 
 * @example
 * ```typescript
 * formatJournalDisplayDescription('Health repair: Missing revenue entry')
 * // 'Đối soát bổ sung: Missing revenue entry'
 * 
 * formatJournalDisplayDescription('KTV hoan thanh buoi dich vu')
 * // 'KTV hoàn thành buổi dich vu'
 * 
 * formatJournalDisplayDescription(null) // null
 * ```
 */
function formatJournalDisplayDescription(description: string | null) {
  if (!description) return description;

  return description
    .replace(/Health repair:/gi, 'Đối soát bổ sung:')
    .replace(/hoan thanh buoi/gi, 'hoàn thành buổi');
}

/**
 * Enriches a database row with formatted display description.
 * 
 * Generic helper that applies {@link formatJournalDisplayDescription} to any row
 * with a `description` field.
 * 
 * @template T - Type of the row object (must have `description: string | null`)
 * @param row - Database row object
 * @returns Row with formatted `description` field
 * 
 * @example
 * ```typescript
 * const row = { id: '123', description: 'Health repair: test' };
 * const formatted = withDisplayDescription(row);
 * // formatted.description === 'Đối soát bổ sung: test'
 * ```
 * 
 * @see {@link formatJournalDisplayDescription} for formatting rules
 */
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

/**
 * Fetches journal entries with optional filtering.
 * 
 * Returns journal entries with their associated journal lines and account details.
 * Only returns entries for the current user's tenant.
 * 
 * @param filters - Optional filter criteria
 * @param filters.from_date - Start date (ISO format: YYYY-MM-DD)
 * @param filters.to_date - End date (ISO format: YYYY-MM-DD)
 * @param filters.status - Entry status ('DRAFT' | 'POSTED' | 'CANCELED')
 * @param filters.reference_type - Reference type (e.g., 'SESSION_COMPLETION', 'SALARY_EXPENSE', 'MANUAL')
 * @returns Array of journal entries with formatted descriptions
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If database query fails
 * 
 * @remarks
 * **Query Joins:**
 * - Includes all `journal_lines` for each entry
 * - Includes `accounting_accounts` data (code, name) for each line
 * 
 * **Ordering:**
 * - Primary: `entry_date` descending (newest first)
 * - Secondary: `created_at` descending (newest first)
 * 
 * **Tenant Isolation:**
 * Automatically filters by current user's `tenant_id` via RLS (Row Level Security).
 * 
 * @example
 * ```typescript
 * // Get all posted entries for June 2026
 * const entries = await getJournalEntries({
 *   from_date: '2026-06-01',
 *   to_date: '2026-06-30',
 *   status: 'POSTED'
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Get all manual adjusting entries
 * const manualEntries = await getJournalEntries({
 *   reference_type: 'MANUAL'
 * });
 * ```
 * 
 * @see {@link getJournalEntryDetails} for fetching a single entry by ID
 * @see {@link formatJournalDisplayDescription} for description formatting
 */
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

/**
 * Fetches detailed information for a single journal entry by ID.
 * 
 * Returns the journal entry with all associated lines and account details.
 * 
 * @param entryId - UUID of the journal entry
 * @returns Journal entry object with formatted description
 * 
 * @throws {Error} If user is not authenticated or missing tenant session
 * @throws {Error} If journal entry is not found or user doesn't have access
 * @throws {Error} If database query fails
 * 
 * @remarks
 * **Query Joins:**
 * - Includes all `journal_lines` for the entry
 * - Includes `accounting_accounts` data (code, name) for each line
 * 
 * **Tenant Isolation:**
 * Enforces tenant boundary by requiring `entry.tenant_id === user.tenant_id`.
 * 
 * **Error Handling:**
 * - Throws if entry doesn't exist (`.single()` fails)
 * - Throws if entry belongs to different tenant
 * 
 * @example
 * ```typescript
 * const entry = await getJournalEntryDetails('entry-uuid-123');
 * console.log(entry.description); // Formatted Vietnamese description
 * console.log(entry.journal_lines.length); // Number of lines
 * ```
 * 
 * @see {@link getJournalEntries} for fetching multiple entries
 * @see {@link reverseJournalEntry} for reversing an entry
 */
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

/**
 * Reverses a posted journal entry by creating an offsetting entry.
 * 
 * Creates a new journal entry with debits/credits swapped to reverse the original entry.
 * Only admins can reverse entries, and only POSTED entries can be reversed.
 * 
 * @param entryId - UUID of the journal entry to reverse
 * @param reason - Human-readable reason for the reversal (required for audit trail)
 * @returns Success object with reversalEntryId
 * 
 * @throws {Error} If user is not authenticated or not an admin
 * @throws {Error} If entry is not found or user doesn't have access
 * @throws {Error} If entry status is not 'POSTED'
 * @throws {Error} If database operations fail
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin` or `super_admin` roles can reverse entries
 * - Tenant isolation enforced
 * 
 * **Reversal Logic:**
 * 1. Fetches original entry and all journal lines
 * 2. Validates entry status is 'POSTED'
 * 3. Creates new entry with debits ↔ credits swapped
 * 4. Sets `reference_type: 'REVERSAL'` and `reference_id: original.id`
 * 5. Uses same `entry_date` as original (not current date)
 * 6. Posts atomically via {@link AccountingEngineService}
 * 
 * **Audit Trail:**
 * - Records audit log with reversal reason
 * - Preserves link between original and reversal entry
 * 
 * **Cache Invalidation:**
 * - Revalidates `/dashboard/accounting/journals` list
 * - Revalidates specific entry detail page
 * 
 * **Example Scenario:**
 * Original entry:
 * - Debit: 1111 (Cash) 1,000,000đ
 * - Credit: 5111 (Revenue) 1,000,000đ
 * 
 * Reversal entry:
 * - Debit: 5111 (Revenue) 1,000,000đ
 * - Credit: 1111 (Cash) 1,000,000đ
 * 
 * @example
 * ```typescript
 * const result = await reverseJournalEntry(
 *   'entry-uuid-123',
 *   'Nhập sai số tiền, cần sửa lại'
 * );
 * console.log(result.reversalEntryId); // New entry UUID
 * ```
 * 
 * @see {@link getJournalEntryDetails} for viewing entry before reversal
 * @see {@link AccountingEngineService.postJournalEntry} for atomic posting
 */
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

/**
 * Fetches accounting outbox events with diagnostic enrichment.
 * 
 * Returns transactional outbox queue events with error categorization, staleness detection,
 * and replay diagnostics for monitoring and troubleshooting.
 * 
 * @param filters - Optional filter criteria
 * @param filters.status - Event status ('PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'DEAD')
 * @param filters.event_type - Event type (e.g., 'SESSION_COMPLETED', 'SALARY_FINALIZED')
 * @returns Array of outbox events with diagnostic metadata
 * 
 * @throws {Error} If user is not authenticated or not an admin
 * @throws {Error} If database query fails
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin` or `super_admin` roles can monitor outbox
 * - Tenant isolation enforced
 * 
 * **Diagnostic Enrichment:**
 * Each outbox event is enriched with:
 * - `age_minutes`: How long event has been in queue
 * - `is_stale`: Whether event exceeds staleness threshold
 * - `error_category`: Categorized error type (e.g., 'DUPLICATE', 'UNBALANCED', 'MISSING_ACCOUNT')
 * - `error_category_label`: Human-readable error category
 * - `origin_href`: Deep link to source entity (e.g., `/dashboard/sessions/123`)
 * - `journal_reference_type`: Journal entry reference type for this event
 * - `replay_state`: Replay eligibility ('CAN_REPLAY', 'CANNOT_REPLAY', 'ALREADY_COMPLETED')
 * - `replay_reason`: Human-readable replay eligibility reason
 * 
 * **Ordering:**
 * - Results ordered by `created_at` descending (newest first)
 * 
 * **Use Cases:**
 * - Admin dashboard outbox monitoring
 * - Identifying stale/stuck events
 * - Troubleshooting accounting failures
 * - Replay eligibility checks
 * 
 * @example
 * ```typescript
 * // Get all failed events
 * const failedEvents = await getOutboxEvents({ status: 'FAILED' });
 * 
 * failedEvents.forEach(event => {
 *   console.log(`Event ${event.id}:`);
 *   console.log(`  Age: ${event.age_minutes} minutes`);
 *   console.log(`  Stale: ${event.is_stale}`);
 *   console.log(`  Error: ${event.error_category_label}`);
 *   console.log(`  Replay: ${event.replay_state} - ${event.replay_reason}`);
 * });
 * ```
 * 
 * @example
 * ```typescript
 * // Get all session completion events
 * const sessionEvents = await getOutboxEvents({
 *   event_type: 'SESSION_COMPLETED'
 * });
 * ```
 * 
 * @see {@link replayOutboxEvent} for manually replaying failed events
 * @see {@link getOutboxReplayDiagnostics} for replay eligibility logic
 * @see {@link classifyAccountingOutboxError} for error categorization
 */
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

/**
 * Finds existing journal entry for outbox event replay validation.
 * 
 * Checks if a non-canceled journal entry already exists for the given event,
 * preventing duplicate postings during replay.
 * 
 * @param supabase - Accounting data client
 * @param tenantId - Tenant identifier
 * @param eventType - Outbox event type (e.g., 'SESSION_COMPLETED')
 * @param referenceId - Business entity ID (e.g., session_log_id)
 * @returns Existing journal entry info, or null if none found
 * 
 * @throws {Error} If database query fails
 * 
 * @remarks
 * **Purpose:**
 * Before replaying an outbox event, check if a journal entry was already successfully
 * posted for the same business entity to prevent duplicate accounting entries.
 * 
 * **Query Logic:**
 * - Maps `event_type` to `reference_type` via {@link getOutboxJournalReferenceType}
 * - Filters by `reference_id` (business entity UUID)
 * - Excludes CANCELED entries (they don't count as active)
 * - Returns single match if found, null otherwise
 * 
 * **Use Case:**
 * 1. Outbox event fails after journal entry is posted
 * 2. Admin clicks "Replay"
 * 3. This function finds the existing POSTED entry
 * 4. System marks outbox COMPLETED without re-posting
 * 
 * @example
 * ```typescript
 * const existing = await findExistingReplayJournal(
 *   supabase,
 *   'tenant-uuid',
 *   'SESSION_COMPLETED',
 *   'session-log-uuid'
 * );
 * 
 * if (existing?.status === 'POSTED') {
 *   console.log('Journal already posted, skip replay');
 * }
 * ```
 * 
 * @see {@link replayOutboxEvent} for usage in replay workflow
 * @see {@link getOutboxJournalReferenceType} for event-to-reference mapping
 */
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

/**
 * Marks an outbox event as COMPLETED using existing journal entry.
 * 
 * Updates outbox status to COMPLETED and links to existing journal entry
 * when replay discovers the entry was already posted.
 * 
 * @param supabase - Accounting data client
 * @param outboxId - Outbox event UUID
 * @param journalEntryId - Existing journal entry UUID to link
 * @throws {Error} If RPC call fails
 * 
 * @remarks
 * **Purpose:**
 * When replaying an outbox event, if we find an existing POSTED journal entry
 * for the same business entity, mark the outbox COMPLETED without re-posting.
 * 
 * **Implementation:**
 * Uses PostgreSQL RPC `mark_outbox_completed` to atomically:
 * 1. Set `status = 'COMPLETED'`
 * 2. Set `journal_entry_id = <existing_entry_id>`
 * 3. Prevent worker from processing this event
 * 
 * **Concurrency Safety:**
 * The RPC ensures atomic update to prevent race conditions with workers.
 * 
 * @example
 * ```typescript
 * // Found existing journal entry during replay
 * await markOutboxCompletedFromReplay(
 *   supabase,
 *   'outbox-uuid',
 *   'journal-entry-uuid'
 * );
 * ```
 * 
 * @see {@link replayOutboxEvent} for usage in replay workflow
 * @see {@link findExistingReplayJournal} for finding existing entries
 */
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

/**
 * Replays a failed or dead outbox event by resetting it to PENDING status.
 * 
 * Attempts to retry journal entry posting for failed accounting outbox events.
 * Handles idempotency by checking for existing journal entries before replay.
 * 
 * @param outboxId - UUID of the outbox event to replay
 * @returns Success object with action and data
 * 
 * @throws {Error} If user is not authenticated or not an admin
 * @throws {Error} If outbox event not found or user doesn't have access
 * @throws {Error} If outbox is already COMPLETED or PROCESSING
 * @throws {Error} If outbox status is not FAILED or DEAD
 * @throws {Error} If existing DRAFT journal entry found (potential duplicate)
 * @throws {Error} If database operations fail
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin` or `super_admin` roles can trigger replays
 * - Tenant isolation enforced
 * 
 * **Replay Logic:**
 * 1. **Fetch outbox event**: Validate exists and belongs to tenant
 * 2. **Status validation**: Only FAILED or DEAD events can be replayed
 * 3. **Idempotency check**: Search for existing journal entries
 *    - If existing POSTED entry found → Mark outbox COMPLETED (no re-posting)
 *    - If existing DRAFT entry found → Throw error (manual intervention needed)
 *    - If no entry found → Reset outbox to PENDING for worker retry
 * 4. **Audit trail**: Record who triggered replay and why
 * 5. **Cache invalidation**: Revalidate outbox dashboard
 * 
 * **Return Actions:**
 * - `'completed_existing_journal'`: Found existing POSTED entry, marked outbox COMPLETED
 * - `'queued_replay'`: Reset to PENDING, worker will process again
 * 
 * **Worker Processing:**
 * After replay sets status to PENDING, the accounting outbox worker will:
 * - Pick up the event within 1 minute
 * - Re-attempt journal entry posting
 * - Apply exponential backoff on subsequent failures
 * 
 * **Critical Safety Rules:**
 * - **Never replay PROCESSING events** (prevents duplicate posts)
 * - **Never replay if DRAFT journal exists** (prevents inconsistent ledger)
 * - **Always check for POSTED entries first** (idempotency)
 * 
 * @example
 * ```typescript
 * // Replay a failed session completion event
 * const result = await replayOutboxEvent('outbox-uuid-123');
 * 
 * if (result.action === 'completed_existing_journal') {
 *   console.log('Found existing journal, marked outbox complete');
 * } else {
 *   console.log('Queued for worker retry');
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Handle different replay outcomes
 * try {
 *   const result = await replayOutboxEvent('outbox-uuid');
 *   
 *   switch (result.action) {
 *     case 'completed_existing_journal':
 *       alert('Đã có bút toán POSTED, outbox đã đánh dấu hoàn tất');
 *       break;
 *     case 'queued_replay':
 *       alert('Đã đưa về PENDING, worker sẽ xử lý lại');
 *       break;
 *   }
 * } catch (error) {
 *   console.error('Replay failed:', error.message);
 * }
 * ```
 * 
 * @see {@link getOutboxEvents} for fetching events to replay
 * @see {@link findExistingReplayJournal} for idempotency check
 * @see {@link markOutboxCompletedFromReplay} for existing entry handling
 */
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

/**
 * Posts a manual adjusting journal entry.
 * 
 * Allows admins to manually create journal entries for corrections, adjustments,
 * or one-time transactions not handled by automated workflows.
 * 
 * @param input - Manual journal entry input
 * @param input.description - Human-readable description of the entry
 * @param input.entry_date - Entry date (ISO format: YYYY-MM-DD), defaults to today
 * @param input.lines - Array of journal lines (debits and credits)
 * @returns Success object with entryId
 * 
 * @throws {Error} If user is not authenticated or not an admin
 * @throws {Error} If journal entry is unbalanced (debits ≠ credits)
 * @throws {Error} If account validation fails
 * @throws {Error} If database operations fail
 * 
 * @remarks
 * **Authorization:**
 * - Only `admin` or `super_admin` roles can post manual entries
 * - Tenant isolation enforced
 * 
 * **Entry Structure:**
 * - `reference_type`: Always set to 'MANUAL'
 * - `reference_id`: Set to creator admin's UUID (for audit trail)
 * - `entry_date`: Defaults to current date if not provided
 * - `lines`: Array of debits/credits with optional dimensions (branch, KTV, cost center)
 * 
 * **Validation:**
 * The {@link AccountingEngineService.postJournalEntry} performs:
 * - **Balance check**: Sum of debits must equal sum of credits
 * - **Account validation**: All accounts must exist and be active
 * - **Period validation**: Entry date must be in open accounting period
 * 
 * **Audit Trail:**
 * - Records audit log with description and manual flag
 * - Preserves who created the entry (via `reference_id`)
 * 
 * **Cache Invalidation:**
 * - Revalidates `/dashboard/accounting/journals` list
 * 
 * **Use Cases:**
 * - Accounting corrections
 * - Manual revenue/expense adjustments
 * - One-time transactions
 * - Period-end adjustments
 * - Depreciation entries
 * 
 * @example
 * ```typescript
 * // Post a manual correction entry
 * const result = await postManualJournalEntry({
 *   description: 'Điều chỉnh doanh thu tháng 6',
 *   entry_date: '2026-06-30',
 *   lines: [
 *     {
 *       account_id: 'account-debit-uuid',
 *       debit_amount: 1000000,
 *       credit_amount: 0
 *     },
 *     {
 *       account_id: 'account-credit-uuid',
 *       debit_amount: 0,
 *       credit_amount: 1000000
 *     }
 *   ]
 * });
 * 
 * console.log(`Entry posted: ${result.entryId}`);
 * ```
 * 
 * @example
 * ```typescript
 * // Post entry with dimensional tracking
 * await postManualJournalEntry({
 *   description: 'Chi phí marketing chi nhánh A',
 *   lines: [
 *     {
 *       account_id: 'marketing-expense-uuid',
 *       debit_amount: 5000000,
 *       credit_amount: 0,
 *       branch_id: 'branch-a-uuid',
 *       cost_center_id: 'marketing-center-uuid'
 *     },
 *     {
 *       account_id: 'cash-uuid',
 *       debit_amount: 0,
 *       credit_amount: 5000000,
 *       branch_id: 'branch-a-uuid'
 *     }
 *   ]
 * });
 * ```
 * 
 * @see {@link AccountingEngineService.postJournalEntry} for validation and posting logic
 * @see {@link getJournalEntries} for viewing posted entries
 * @see {@link reverseJournalEntry} for reversing manual entries
 */
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
