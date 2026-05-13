import { createClient as createSupabaseClient } from '@supabase/supabase-js';

let supabaseInstance: any = null;

export const getSupabase = () => {
  if (supabaseInstance) return supabaseInstance;
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
  
  supabaseInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey);
  return supabaseInstance;
};

export const supabase = typeof window !== 'undefined' ? getSupabase() : null;

export function createClient() {
  return getSupabase();
}
