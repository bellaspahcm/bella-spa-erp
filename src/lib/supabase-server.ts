import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/database.types';
import { requireSupabasePublicEnv } from '@/lib/supabase-public-env';

export async function createClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies();
  const { url, publicKey } = requireSupabasePublicEnv();

  return createServerClient<Database>(
    url,
    publicKey,
    {
      cookies: {
        get(name: string) {
          const val = cookieStore.get(name)?.value;
          return val;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
