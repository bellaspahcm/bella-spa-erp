'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import type { Database } from '@/types/database.types';

type AppNotificationRow = Database['public']['Tables']['app_notifications']['Row'];
type AppNotificationUpdate = Database['public']['Tables']['app_notifications']['Update'];
type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type ActionResult<T = undefined> = T extends undefined
  ? { success: true } | { success: false; error: string }
  : { success: true; data: T } | { success: false; error: string; data: T };

async function resolveCurrentTenant(supabase: SupabaseServerClient) {
  const { data: userData, error: authError } = await supabase.auth.getUser();
  if (authError) {
    return { tenantId: null, error: `Failed to load authenticated user: ${authError.message}` };
  }
  if (!userData.user) {
    return { tenantId: null, error: 'Unauthorized' };
  }

  const { data: profile, error: profileError } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .single();

  if (profileError) {
    return { tenantId: null, error: `Failed to load notification tenant profile: ${profileError.message}` };
  }

  if (!profile?.tenant_id) {
    return { tenantId: null, error: 'No tenant found' };
  }

  return { tenantId: profile.tenant_id, error: null };
}

export async function getUnreadNotifications(): Promise<ActionResult<AppNotificationRow[]>> {
  const supabase = await createClient();

  const { tenantId, error: tenantError } = await resolveCurrentTenant(supabase);
  if (tenantError || !tenantId) {
    return { success: false, error: tenantError || 'No tenant found', data: [] };
  }

  const { data, error } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    return { success: false, error: `Failed to fetch unread notifications: ${error.message}`, data: [] };
  }

  return { success: true, data: data || [] };
}

export async function markNotificationAsRead(notificationId: string): Promise<ActionResult> {
  const supabase = await createClient();

  const { tenantId, error: tenantError } = await resolveCurrentTenant(supabase);
  if (tenantError || !tenantId) {
    return { success: false, error: tenantError || 'No tenant found' };
  }

  const updatePayload: AppNotificationUpdate = { is_read: true };
  const { data, error } = await supabase
    .from('app_notifications')
    .update(updatePayload)
    .eq('id', notificationId)
    .eq('tenant_id', tenantId)
    .select('id')
    .single();

  if (error) {
    return { success: false, error: `Failed to mark notification as read: ${error.message}` };
  }

  if (!data) {
    return { success: false, error: 'Notification not found for current tenant' };
  }

  revalidatePath('/dashboard');
  revalidatePath('/ktv/dashboard');
  return { success: true };
}

export async function markAllNotificationsAsRead(): Promise<ActionResult> {
  const supabase = await createClient();

  const { tenantId, error: tenantError } = await resolveCurrentTenant(supabase);
  if (tenantError || !tenantId) {
    return { success: false, error: tenantError || 'No tenant found' };
  }

  const updatePayload: AppNotificationUpdate = { is_read: true };
  const { error } = await supabase
    .from('app_notifications')
    .update(updatePayload)
    .eq('tenant_id', tenantId)
    .eq('is_read', false);

  if (error) {
    return { success: false, error: `Failed to mark all notifications as read: ${error.message}` };
  }

  revalidatePath('/dashboard');
  revalidatePath('/ktv/dashboard');
  return { success: true };
}
