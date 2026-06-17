import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

/**
 * Type alias for the Supabase client used in accounting operations.
 * 
 * @remarks
 * This type ensures consistency across all accounting service functions
 * and provides proper type inference for database operations.
 */
export type AccountingSupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Create a Supabase client for accounting data operations.
 * 
 * @returns Supabase client configured for accounting operations
 * 
 * @remarks
 * In production, uses service role client with elevated privileges for accounting operations.
 * In test environment, returns standard user client for proper test isolation.
 * 
 * The service role client bypasses Row Level Security (RLS) which is required for:
 * - Cross-tenant accounting reports
 * - Batch journal posting operations
 * - Automated accounting worker processes
 * 
 * **Security**: Always validate tenant context before using this client in production.
 * 
 * @example
 * ```typescript
 * const supabase = await createAccountingDataClient();
 * const { data, error } = await supabase
 *   .from('journal_entries')
 *   .select('*')
 *   .eq('tenant_id', currentTenantId);
 * ```
 */
export async function createAccountingDataClient(): Promise<AccountingSupabaseClient> {
  if (process.env.NODE_ENV === 'test') {
    return createClient();
  }

  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    return createClient();
  }

  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  return createAdminClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as AccountingSupabaseClient;
}
