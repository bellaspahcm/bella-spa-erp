'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';

export async function getUnreadNotifications() {
  const supabase = await createClient();
  
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Unauthorized', data: [] };

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.tenant_id) return { error: 'No tenant found', data: [] };

  const { data, error } = await supabase
    .from('app_notifications')
    .select('*')
    .eq('tenant_id', profile.tenant_id)
    .eq('is_read', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching notifications:', error);
    return { error: error.message, data: [] };
  }

  return { data };
}

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();
  
  const { error } = await supabase
    .from('app_notifications')
    .update({ is_read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    return { error: error.message };
  }
  
  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const supabase = await createClient();
  
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { error: 'Unauthorized' };

  const { data: profile } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userData.user.id)
    .single();

  if (!profile?.tenant_id) return { error: 'No tenant found' };

  const { error } = await supabase
    .from('app_notifications')
    .update({ is_read: true })
    .eq('tenant_id', profile.tenant_id)
    .eq('is_read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    return { error: error.message };
  }

  return { success: true };
}
