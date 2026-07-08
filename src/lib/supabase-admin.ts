/**
 * Supabase Admin Client Factory
 * Creates admin clients with service role key for privileged operations
 */

import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type AdminClient = ReturnType<typeof createClient<Database>>;

/**
 * Creates a Supabase admin client with service role key
 * Returns null if admin credentials are not configured
 * 
 * Use this for privileged operations like:
 * - Deleting auth users
 * - Bypassing RLS policies
 * - Admin-only database operations
 * 
 * @example
 * ```ts
 * const admin = createSupabaseAdminClient();
 * if (admin) {
 *   await admin.auth.admin.deleteUser(userId);
 * }
 * ```
 */
export function createSupabaseAdminClient(): AdminClient | null {
  const url = getSupabaseAdminUrl();
  const key = getSupabaseAdminKey();
  
  if (!url || !key) {
    console.warn('[createSupabaseAdminClient] Missing SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient<Database>(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  });
}

/**
 * Deletes a user from Supabase Auth (auth.users table)
 * This frees the email for reuse in new accounts
 * 
 * @param userId - UUID of the auth user to delete
 * @returns Error message if failed, empty string if successful or if admin client unavailable
 * 
 * @example
 * ```ts
 * const error = await deleteAuthUser('user-uuid');
 * if (error) {
 *   console.error('Failed to delete auth user:', error);
 * }
 * ```
 */
export async function deleteAuthUser(userId: string): Promise<string> {
  const admin = createSupabaseAdminClient();
  
  if (!admin) {
    console.warn('[deleteAuthUser] Admin client unavailable, skipping auth deletion');
    return ''; // Silent skip if no admin key - not a critical error
  }
  
  try {
    const { error } = await admin.auth.admin.deleteUser(userId);
    
    if (error) {
      console.error('[deleteAuthUser] Failed:', error);
      return error.message;
    }
    
    console.log('[deleteAuthUser] Successfully deleted user from auth.users:', userId);
    return '';
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[deleteAuthUser] Exception:', message);
    return message;
  }
}
