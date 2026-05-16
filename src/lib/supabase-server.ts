import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { Database } from '@/types/database.types';

export async function createClient() {
  const { cookies } = await import('next/headers');
  const cookieStore = await cookies(); console.log("[supabase-server] Cookies:", cookieStore.getAll().map(c => c.name));

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const val = cookieStore.get(name)?.value; console.log("[supabase-server] Cookie get:", name, !!val); return val;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch (error) {
            // The `set` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options });
          } catch (error) {
            // The `remove` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
