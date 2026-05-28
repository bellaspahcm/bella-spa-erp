// Shared finance helpers. Plain module (no 'use server') — server-only code
// invoked exclusively by the finance server-action sub-modules.

export async function resolveTenantId(): Promise<string> {
  try {
    const { createClient } = await import('@/lib/supabase-server');
    const supabase = await createClient();
    const { getCurrentUser } = await import('../user-actions');
    const currentUser = await getCurrentUser();
    if (currentUser?.tenant_id) return currentUser.tenant_id;

    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) {
      const { data: profile } = await supabase
        .from('users')
        .select('tenant_id')
        .or(`id.eq.${authUser.id},email.eq.${authUser.email}`)
        .limit(1)
        .single();
      if (profile?.tenant_id) return profile.tenant_id;
    }
  } catch (e) {
    console.warn('[finance] Tenant resolution error:', e);
  }
  throw new Error('Unauthorized: Không xác định được chi nhánh hoạt động hợp lệ.');
}
