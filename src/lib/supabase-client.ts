import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";
import { requireSupabasePublicEnv } from "@/lib/supabase-public-env";


type TypedSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;
let supabaseInstance: TypedSupabaseClient | null = null;

export const getSupabase = (): TypedSupabaseClient => {
  if (supabaseInstance) return supabaseInstance;

  const { url, publicKey } = requireSupabasePublicEnv();
  
  supabaseInstance = createBrowserClient<Database>(url, publicKey);
  return supabaseInstance;
};

export const supabase = typeof window !== 'undefined' ? getSupabase() : null;

export function createClient() {
  return getSupabase();
}
