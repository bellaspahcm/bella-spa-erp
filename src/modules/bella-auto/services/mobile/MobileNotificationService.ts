/**
 * Bella Auto Phase 10 - Mobile Notification Service
 * 
 * Manages push notifications for mobile users.
 * 
 * @module bella-auto/services/mobile/MobileNotificationService
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { Database } from '@/types/database.types';

type MobileNotification = Database['public']['Tables']['auto_mobile_notifications']['Row'];
type MobileNotificationInsert = Database['public']['Tables']['auto_mobile_notifications']['Insert'];

type NotificationType =
  | 'lead_assigned'
  | 'appointment_reminder'
  | 'repair_order_assigned'
  | 'parts_available'
  | 'approval_required'
  | 'customer_arrived'
  | 'payment_received'
  | 'task_overdue'
  | 'system_alert';

type Priority = 'low' | 'normal' | 'high' | 'critical';

interface CreateNotificationParams {
  tenantId: string;
  userId: string;
  notificationType: NotificationType;
  title: string;
  message: string;
  actionType?: string;
  actionData?: unknown;
  priority?: Priority;
  expiresAt?: string;
}

export class MobileNotificationService {
  static async create(params: CreateNotificationParams): Promise<MobileNotification> {
    const supabase = getPrimaryClient();
    
    const notificationData: MobileNotificationInsert = {
      tenant_id: params.tenantId,
      user_id: params.userId,
      notification_type: params.notificationType,
      title: params.title,
      message: params.message,
      action_type: params.actionType,
      action_data: params.actionData as unknown,
      priority: params.priority || 'normal',
      expires_at: params.expiresAt,
      status: 'pending',
    };
    
    const { data, error } = await supabase
      .from('auto_mobile_notifications')
      .insert(notificationData)
      .select()
      .single();
    
    if (error) {
      throw new Error(`Failed to create notification: ${error.message}`);
    }
    
    return data;
  }
  
  static async getUnread(tenantId: string, userId: string) {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('get_unread_notifications', {
        p_tenant_id: tenantId,
        p_user_id: userId,
      });
    
    if (error) {
      throw new Error(`Failed to fetch unread notifications: ${error.message}`);
    }
    
    return data || [];
  }
  
  static async markRead(notificationId: string, tenantId: string, userId: string): Promise<boolean> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .rpc('mark_notification_read', {
        p_notification_id: notificationId,
        p_tenant_id: tenantId,
        p_user_id: userId,
      });
    
    if (error) {
      throw new Error(`Failed to mark notification as read: ${error.message}`);
    }
    
    return data || false;
  }
  
  static async markAllRead(tenantId: string, userId: string): Promise<number> {
    const supabase = getPrimaryClient();
    
    const { data, error } = await supabase
      .from('auto_mobile_notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString(),
      })
      .eq('tenant_id', tenantId)
      .eq('user_id', userId)
      .in('status', ['pending', 'sent', 'delivered'])
      .select();
    
    if (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }
    
    return data?.length || 0;
  }
  
  static async cleanup(tenantId: string, daysToKeep: number = 30): Promise<number> {
    const supabase = getPrimaryClient();
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
    
    const { data, error } = await supabase
      .from('auto_mobile_notifications')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('status', 'read')
      .lt('read_at', cutoffDate.toISOString())
      .select();
    
    if (error) {
      throw new Error(`Failed to cleanup notifications: ${error.message}`);
    }
    
    return data?.length || 0;
  }
}
