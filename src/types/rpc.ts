// Typed helpers for Supabase RPC calls.
//
// Most RPCs are already typed via the auto-generated `Database['public']['Functions']`.
// This module provides:
//   1. Convenience aliases for frequently-consumed RPC return shapes.
//   2. Typed declarations for RPCs not yet present in database.types.ts
//      (i.e. added by a migration but before `supabase gen types` was re-run).

import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';

type DbFunctions = Database['public']['Functions'];

// ── Convenience aliases for existing RPC returns ─────────────────────────────

export type KtvLeaderboardRow = DbFunctions['get_ktv_leaderboard']['Returns'][number];
export type AccountLedgerRow = DbFunctions['get_account_ledger']['Returns'][number];
export type TrialBalanceRow = DbFunctions['get_trial_balance']['Returns'][number];
export type ServicePerformanceRow = DbFunctions['get_service_performance']['Returns'][number];
export type KtvSalaryDetailRow = DbFunctions['get_ktv_salary_detail']['Returns'][number];

// ── RPCs not yet in the generated schema ─────────────────────────────────────
// Added by migration 20260528010000_distributed_rate_limit.sql.
// Remove this block and use the generated type once `supabase gen types` is re-run.

export interface PendingRpcDefs {
  consume_token: {
    Args: { p_key: string; p_capacity: number; p_refill_per_sec: number };
    Returns: boolean;
  };
}

/**
 * Calls an RPC that exists in the database but is not yet in the generated
 * `Database` types. Provides argument + return typing via PendingRpcDefs so
 * callers stay type-safe without resorting to `as any`.
 */
export async function callPendingRpc<K extends keyof PendingRpcDefs>(
  client: SupabaseClient<Database>,
  fn: K,
  args: PendingRpcDefs[K]['Args']
): Promise<{ data: PendingRpcDefs[K]['Returns'] | null; error: { message: string } | null }> {
  // The generated client type does not know about this RPC name yet; the cast is
  // localized here so no other call site needs `any`.
  const rpcClient = client as unknown as {
    rpc: (
      fn: K,
      args: PendingRpcDefs[K]['Args']
    ) => Promise<{ data: PendingRpcDefs[K]['Returns'] | null; error: { message: string } | null }>;
  };
  return rpcClient.rpc(fn, args);
}
