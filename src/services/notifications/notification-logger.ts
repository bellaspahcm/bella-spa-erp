/**
 * Notification Logger
 * 
 * Handles logging notifications to the database.
 * Logs to waitlist_notification_logs table for audit trail.
 * 
 * @module services/notifications/notification-logger
 */

import { createClient } from '@/lib/supabase-server';
import type { WaitlistNotificationLog } from '@/types/waitlist';
import type { NotificationLogEntry } from './types';

/**
 * Log a notification attempt to database
 * 
 * @param entry - Notification log entry
 * @returns ID of inserted log entry
 */
export async function logNotificationAttempt(
  entry: Omit<NotificationLogEntry, 'metadata'> & { metadata?: Record<string, unknown> }
): Promise<string | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('waitlist_notification_logs')
      .insert({
        waitlist_entry_id: entry.waitlist_entry_id,
        customer_id: entry.customer_id,
        tenant_id: entry.tenant_id,
        notification_type: entry.notification_type,
        channel: entry.channel,
        status: entry.status,
        message_content: entry.message_content,
        message_template_id: entry.message_template_id,
        sent_at: entry.sent_at,
        delivered_at: entry.delivered_at,
        read_at: entry.read_at,
        failed_at: entry.failed_at,
        error_message: entry.error_message,
        error_code: entry.error_code,
        retry_count: entry.retry_count || 0,
        max_retries: entry.max_retries || 3,
        metadata: entry.metadata || null,
      })
      .select('id')
      .single();

    if (error) {
      console.error('Error logging notification:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Error logging notification:', error);
    return null;
  }
}

/**
 * Update notification status
 * 
 * @param logId - Notification log ID
 * @param status - New status
 * @param updates - Optional fields to update (timestamps, error info)
 */
export async function updateNotificationStatus(
  logId: string,
  status: 'pending' | 'sent' | 'failed' | 'cancelled',
  updates?: {
    sent_at?: string;
    delivered_at?: string;
    read_at?: string;
    failed_at?: string;
    error_message?: string;
    error_code?: string;
    retry_count?: number;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const supabase = createClient();

  try {
    const { error } = await supabase
      .from('waitlist_notification_logs')
      .update({
        status,
        ...updates,
      })
      .eq('id', logId);

    if (error) {
      console.error('Error updating notification status:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error updating notification status:', error);
    return false;
  }
}

/**
 * Get notification logs for a waitlist entry
 * 
 * @param entryId - Waitlist entry ID
 * @returns Array of notification logs
 */
export async function getNotificationLogs(
  entryId: string
): Promise<WaitlistNotificationLog[]> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('waitlist_notification_logs')
      .select('*')
      .eq('waitlist_entry_id', entryId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching notification logs:', error);
      return [];
    }

    return (data || []) as WaitlistNotificationLog[];
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    return [];
  }
}

/**
 * Get failed notifications that need retry
 * 
 * @param tenantId - Optional tenant ID filter
 * @param limit - Max number of entries to return
 * @returns Array of failed notification logs
 */
export async function getFailedNotificationsForRetry(
  tenantId?: string,
  limit = 100
): Promise<WaitlistNotificationLog[]> {
  const supabase = createClient();

  try {
    let query = supabase
      .from('waitlist_notification_logs')
      .select('*')
      .eq('status', 'failed')
      .lt('retry_count', supabase.rpc('max_retries')) // retry_count < max_retries
      .order('created_at', { ascending: true })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching failed notifications:', error);
      return [];
    }

    return (data || []) as WaitlistNotificationLog[];
  } catch (error) {
    console.error('Error fetching failed notifications:', error);
    return [];
  }
}

/**
 * Mark notification as cancelled
 * 
 * @param logId - Notification log ID
 * @param reason - Cancellation reason
 */
export async function cancelNotification(
  logId: string,
  reason?: string
): Promise<boolean> {
  return updateNotificationStatus(logId, 'cancelled', {
    error_message: reason || 'Cancelled',
    failed_at: new Date().toISOString(),
  });
}

/**
 * Increment retry count for a notification
 * 
 * @param logId - Notification log ID
 */
export async function incrementRetryCount(logId: string): Promise<boolean> {
  const supabase = createClient();

  try {
    // Fetch current retry_count
    const { data: current } = await supabase
      .from('waitlist_notification_logs')
      .select('retry_count')
      .eq('id', logId)
      .single();

    if (!current) return false;

    // Increment
    const { error } = await supabase
      .from('waitlist_notification_logs')
      .update({ retry_count: (current.retry_count || 0) + 1 })
      .eq('id', logId);

    if (error) {
      console.error('Error incrementing retry count:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error incrementing retry count:', error);
    return false;
  }
}

/**
 * Get notification statistics
 * 
 * @param entryId - Waitlist entry ID
 * @returns Statistics object
 */
export async function getNotificationStats(entryId: string): Promise<{
  total: number;
  sent: number;
  failed: number;
  pending: number;
}> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('waitlist_notification_logs')
      .select('status')
      .eq('waitlist_entry_id', entryId);

    if (error || !data) {
      return { total: 0, sent: 0, failed: 0, pending: 0 };
    }

    const stats = {
      total: data.length,
      sent: data.filter((n) => n.status === 'sent').length,
      failed: data.filter((n) => n.status === 'failed').length,
      pending: data.filter((n) => n.status === 'pending').length,
    };

    return stats;
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    return { total: 0, sent: 0, failed: 0, pending: 0 };
  }
}
