// apps/mobile/src/lib/fetchUserProfile.ts
// Port from src/services/user-actions.ts getCurrentUser()
// Query users table for role - NOT user_metadata

import type { CurrentUser } from '@bella/shared';
import { getMobileSupabase } from '../../lib/supabase';

export type ProfileResult =
  | { ok: true; user: CurrentUser }
  | { ok: false; error: string };

/**
 * Fetch user profile from database after authentication
 * 
 * CRITICAL: Always query users table for role - NEVER use user_metadata
 * Reason: user_metadata can be stale, incorrect, or modified outside standard flow
 * 
 * Port from src/services/user-actions.ts getCurrentUser()
 */
export async function fetchUserProfile(
  authUserId: string,
  authEmail: string,
): Promise<ProfileResult> {
  const supabase = getMobileSupabase();

  // Primary path: lookup by auth user id
  const { data: profileById, error: idError } = await supabase
    .from('users')
    .select('id, email, full_name, role, avatar_url, tenant_id')
    .eq('id', authUserId)
    .single();

  let profile = profileById ?? null;

  // Fallback: lookup by email (handles auth users created separately from public.users)
  if (!profile && authEmail) {
    const { data: profileByEmail } = await supabase
      .from('users')
      .select('id, email, full_name, role, avatar_url, tenant_id')
      .eq('email', authEmail)
      .single();
    profile = profileByEmail ?? null;
  }

  if (!profile) {
    const msg = idError?.message ?? 'Không tìm thấy profile người dùng trong hệ thống.';
    console.error('[fetchUserProfile] No profile found for auth user:', authEmail, '| auth_id:', authUserId);
    return { ok: false, error: msg };
  }

  // Standardize role to lowercase (consistent with web app)
  const user: CurrentUser = {
    ...profile,
    role: profile.role?.toLowerCase() ?? 'staff',
    isSuspended: false,
  };

  // Check if tenant is suspended
  if (user.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('status, name')
      .eq('id', user.tenant_id)
      .single();
    
    if (tenant?.status === 'suspended') {
      console.warn(`[fetchUserProfile] Tenant ${tenant.name} (${user.tenant_id}) is suspended. Blocking user.`);
      user.isSuspended = true;
    }
  }

  return { ok: true, user };
}
