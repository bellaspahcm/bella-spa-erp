import { createBrowserClient } from "@supabase/ssr";
import { Database } from "@/types/database.types";


type TypedSupabaseClient = ReturnType<typeof createBrowserClient<Database>>;
let supabaseInstance: TypedSupabaseClient | null = null;

export const getSupabase = (): TypedSupabaseClient => {
  if (supabaseInstance) return supabaseInstance;
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase credentials (NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  supabaseInstance = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

export const supabase = typeof window !== 'undefined' ? getSupabase() : null;

export function createClient() {
  return getSupabase();
}
