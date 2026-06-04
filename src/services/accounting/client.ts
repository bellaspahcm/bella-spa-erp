import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';

export type AccountingSupabaseClient = Awaited<ReturnType<typeof createClient>>;

export async function createAccountingDataClient(): Promise<AccountingSupabaseClient> {
  if (process.env.NODE_ENV === 'test') {
    return createClient();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return createClient();
  }

  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  return createAdminClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as AccountingSupabaseClient;
}
