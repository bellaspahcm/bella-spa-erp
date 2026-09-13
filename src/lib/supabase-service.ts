/**
 * Supabase Service Client (Server-Side Only)
 * 
 * Uses service_role key to bypass RLS for privileged operations.
 * MUST ONLY be used in server-side code (Server Actions, API routes).
 * NEVER expose to client/browser.
 * 
 * Authorization MUST be enforced at application layer before using this client.
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is required for service client');
}

if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL is required');
}

/**
 * Service role client - bypasses RLS
 * 
 * Security warning:
 * - Only use after explicit authorization check
 * - Never pass to client components
 * - Only for controlled privileged operations
 */
export const createServiceClient = () => {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
};
