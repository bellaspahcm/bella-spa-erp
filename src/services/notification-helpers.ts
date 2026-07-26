import { createClient } from '@/lib/supabase-server';

export async function createSystemNotification(params: {
  userId: string;
  title: string;
  message: string;
  tenantId: string;
  type?: string;
}) {
  try {
    const supabase = await createClient();
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('Notification')
      .insert({
        id,
        userId: params.userId,
        title: params.title,
        message: params.message,
        tenantId: params.tenantId,
        type: params.type || 'system',
        isRead: false,
        createdAt: now,
        updatedAt: now
      });

    if (error) {
      console.error('[createSystemNotification] Error inserting notification:', error);
    }
  } catch (err) {
    console.error('[createSystemNotification] Exception:', err);
  }
}
