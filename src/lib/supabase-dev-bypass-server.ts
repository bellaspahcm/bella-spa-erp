import 'server-only';

import { createClient } from '@/lib/supabase-server';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export type DatabaseSupabaseClient = SupabaseClient<Database>;

export async function createDevelopmentBypassClient(): Promise<DatabaseSupabaseClient> {
  const supabase = await createClient();

  if (process.env.NODE_ENV !== 'development') {
    return supabase as DatabaseSupabaseClient;
  }

  const { headers } = await import('next/headers');
  const mockEmail = (await headers()).get('x-mock-user-email');
  const adminUrl = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();

  if (!mockEmail || !adminUrl || !adminKey) {
    return supabase as DatabaseSupabaseClient;
  }

  const { createClient: createAdminClient } = await import('@supabase/supabase-js');
  return createAdminClient<Database>(adminUrl, adminKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
