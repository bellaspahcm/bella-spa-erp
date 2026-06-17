import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

/**
 * Assert that an accounting period is open before allowing write operations.
 * 
 * @param supabase - Supabase client for database operations
 * @param input - Guard parameters including tenant ID, date, and context description
 * @throws Error if tenant is missing, period is closed, or RPC call fails
 * 
 * @remarks
 * This guard function prevents modifications to journal entries, revenue, expenses,
 * and salary records when the accounting period is closed (after month-end close).
 * 
 * The RPC `ensure_open_period` checks:
 * - Period exists for the given date
 * - Period status is 'OPEN' (not 'CLOSED' or 'LOCKED')
 * - No retroactive changes to closed months
 * 
 * **Critical**: Always call this guard before:
 * - Posting journal entries
 * - Recording revenue/expenses
 * - Updating salary records
 * - Running accounting backfills
 * 
 * @example
 * ```typescript
 * // Before posting a journal entry
 * await assertOpenAccountingPeriod(supabase, {
 *   tenantId: user.tenant_id,
 *   date: '2025-06-15',
 *   context: 'Post journal entry',
 * });
 * 
 * // Will throw if June 2025 period is closed:
 * // Error: "Post journal entry: accounting period is closed or unavailable"
 * ```
 */
export async function assertOpenAccountingPeriod(
  supabase: SupabaseClient<Database>,
  input: {
    tenantId: string | null | undefined;
    date: string;
    context: string;
  }
) {
  if (!input.tenantId) {
    throw new Error(`${input.context}: missing tenant for accounting period guard.`);
  }

  const periodDate = input.date.slice(0, 10);
  const { error } = await supabase.rpc('ensure_open_period', {
    p_tenant_id: input.tenantId,
    p_date: periodDate,
  });

  if (error) {
    throw new Error(`${input.context}: accounting period is closed or unavailable: ${error.message}`);
  }
}
