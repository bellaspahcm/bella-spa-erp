/**
 * Accounting Outbox helper utilities.
 *
 * Centralizes the enqueue pattern used across business actions:
 *   - createBooking, recordRemainingPayment  → PACKAGE_SALE
 *   - completeSession, updateSessionLog      → SESSION_DONE
 *   - confirmTransaction, createExpense      → EXPENSE_RECORDED / SALARY_PAID / PACKAGE_SALE
 *   - autoConsumeForSession                  → INVENTORY_CONSUMED
 *   - confirmSalary                          → SALARY_PAID
 *   - clearInterBranchRecord                 → INTER_BRANCH_CLEARING
 *   - reverseJournalEntry, manual entry      → REVERSAL / MANUAL_ENTRY
 *
 * Replaces inline `require('@supabase/supabase-js')` with cached dynamic import
 * to preserve tree-shaking, ESM compat, and TypeScript type-safety.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '@/types/database.types';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';

// ─────────────────────────────────────────────────────────────────────────────
// Strict union types — keep in sync with CHECK constraint on accounting_outbox
// (migration 20260525130000_accounting_outbox.sql)
// ─────────────────────────────────────────────────────────────────────────────

export type AccountingEventType =
  | 'PACKAGE_SALE'
  | 'SESSION_DONE'
  | 'EXPENSE_RECORDED'
  | 'SALARY_PAID'
  | 'INVENTORY_CONSUMED'
  | 'REFUND_ISSUED'
  | 'INTER_BRANCH_CLEARING'
  | 'MANUAL_ENTRY';

/**
 * Business reference types stored on `journal_entries.reference_type` and
 * `accounting_outbox.reference_type`. Two flavors share this enum:
 *
 *   1. Source-record types (used by outbox enqueue calls) — what kind of
 *      business row the event originated from:
 *        BOOKING, REVENUE, EXPENSE, SESSION_LOG, SALARY_RECORD, INVENTORY_LOG
 *
 *   2. Event-flavor types (used by AccountingEngineService/RevenueRecognition
 *      when posting the actual journal entry) — what business event the entry
 *      represents:
 *        PACKAGE_SALE, SESSION_DONE, REVERSAL, MANUAL
 *
 * DB column is TEXT free-form; the union here is the app-layer guard.
 */
export type AccountingReferenceType =
  // ── Source-record types ────────────────────────────────────────────
  | 'BOOKING'
  | 'REVENUE'
  | 'EXPENSE'
  | 'SESSION_LOG'
  | 'SALARY_RECORD'
  | 'INVENTORY_LOG'
  | 'INTER_BRANCH_CLEARING_RECORD'
  // ── Event-flavor types ─────────────────────────────────────────────
  | 'PACKAGE_SALE'
  | 'SESSION_DONE'
  | 'SALARY_PAYMENT'
  | 'INVENTORY_CONSUMPTION'
  | 'REFUND'
  | 'INTER_BRANCH_CLEARING'
  | 'REVERSAL'
  | 'MANUAL';

export interface EnqueueAccountingEventParams {
  tenantId: string;
  eventType: AccountingEventType;
  referenceType: AccountingReferenceType;
  referenceId: string;
  payload: Record<string, unknown>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-loaded admin client — singleton cached per process
// Uses dynamic import() instead of require() for tree-shaking + ESM compat.
// ─────────────────────────────────────────────────────────────────────────────

type AdminClient = SupabaseClient<Database>;
type EnqueueAccountingRpcArgs = Database['public']['Functions']['enqueue_accounting_event']['Args'];
type RpcError = { message: string };
type RpcCapableClient = { rpc: (...args: never[]) => unknown };
type EnqueueAccountingRpcClient = {
  rpc: (
    fn: 'enqueue_accounting_event',
    args: EnqueueAccountingRpcArgs
  ) => Promise<{ data: string | null; error: RpcError | null }>;
};

let cachedAdminClient: AdminClient | null = null;

function asEnqueueAccountingRpcClient(client: RpcCapableClient): EnqueueAccountingRpcClient {
  return client as EnqueueAccountingRpcClient;
}

async function loadAdminClient(): Promise<AdminClient | null> {
  if (cachedAdminClient) return cachedAdminClient;

  const url = getSupabaseAdminUrl();
  const key = getSupabaseAdminKey();
  if (!url || !key) return null;

  // Dynamic import keeps client-bundle clean if this module is ever imported
  // accidentally (Server Actions bundler is conservative).
  const { createClient } = await import('@supabase/supabase-js');
  cachedAdminClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedAdminClient;
}

/**
 * Get the best available client for outbox writes:
 *   1. Admin client if SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY is set → bypasses RLS.
 *   2. Fallback to the user-session client (subject to RLS — may fail in dev bypass mode).
 *
 * Returning a fallback ensures business hooks degrade gracefully instead of throwing.
 */
export async function getOutboxClient<T extends RpcCapableClient>(
  fallback: T
): Promise<T | AdminClient> {
  const admin = await loadAdminClient();
  return admin ?? fallback;
}

/**
 * Enqueue an accounting event into the transactional outbox.
 *
 * Returns `true` on success, `false` if the underlying RPC errored or did not
 * return an outbox id. Idempotency is enforced by the UNIQUE
 * (tenant_id, event_type, reference_type, reference_id) constraint.
 *
 * This helper returns an explicit boolean instead of throwing. Callers on
 * accounting-critical flows must treat `false` as a failed side effect and
 * rollback/return an explicit error.
 */
export async function enqueueAccountingEvent(
  client: RpcCapableClient,
  params: EnqueueAccountingEventParams,
  logPrefix = '[accounting-outbox]'
): Promise<boolean> {
  try {
    const rpcClient = asEnqueueAccountingRpcClient(client);
    const { data: outboxId, error } = await rpcClient.rpc('enqueue_accounting_event', {
      p_tenant_id: params.tenantId,
      p_event_type: params.eventType,
      p_reference_type: params.referenceType,
      p_reference_id: params.referenceId,
      p_payload: params.payload as Json,
    });

    if (error) {
      console.error('%s Failed to enqueue %s for %s:%s:', logPrefix, params.eventType, params.referenceType, params.referenceId, error.message);
      return false;
    }

    if (!outboxId) {
      console.error(`${logPrefix} Failed to enqueue ${params.eventType} for ${params.referenceType}:${params.referenceId}: missing outbox id`);
      return false;
    }

    console.log(`${logPrefix} Enqueued/reused ${params.eventType} for ${params.referenceType}:${params.referenceId}`);
    return true;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('%s Exception enqueuing %s:%s:', logPrefix, params.eventType, params.referenceId, msg);
    return false;
  }
}

/**
 * Convenience: combine getOutboxClient + enqueueAccountingEvent in one call.
 * Use this when the caller doesn't already need the admin client for other things.
 */
export async function enqueueWithAutoClient<T extends RpcCapableClient>(
  fallback: T,
  params: EnqueueAccountingEventParams,
  logPrefix?: string
): Promise<boolean> {
  const client = await getOutboxClient(fallback);
  return enqueueAccountingEvent(client, params, logPrefix);
}
