/**
 * Supabase Service Role Client (Server-Side Only)
 * 
 * CRITICAL: This client bypasses Row Level Security (RLS)
 * - Use ONLY in server-side code (API routes, server actions, tests)
 * - NEVER expose service role key to client-side code
 * - For tests: Use to create test data that would normally be blocked by RLS
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';

export function createServiceClient() {
  if (typeof window !== 'undefined') {
    return null as unknown;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set');
  }

  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
