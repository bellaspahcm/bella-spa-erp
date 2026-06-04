import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

export type AccountingSupabaseClient = Awaited<ReturnType<typeof createClient>>;

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
