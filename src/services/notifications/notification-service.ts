/**
 * Notification Service
 * 
 * Main orchestrator for sending notifications.
 * Handles channel selection, provider calling, and logging.
 * 
 * @module services/notifications/notification-service
 */

import { createClient } from '@/lib/supabase-server';
import type { NotificationChannel, NotificationType, CustomerTier } from '@/types/waitlist';
import type { SendNotificationInput, SendNotificationResult, NotificationTemplateData } from './types';
import { MockNotificationProvider } from './providers/provider-interface';
import { buildMessage } from './notification-templates';
import { logNotificationAttempt, updateNotificationStatus, incrementRetryCount } from './notification-logger';

/**
 * Channel priority by customer tier
 */
const CHANNEL_PRIORITY: Record<CustomerTier, NotificationChannel[]> = {
  vip: ['zalo', 'sms', 'email'],
  loyal: ['sms', 'email', 'zalo'],
  new: ['email', 'sms'],
};

/**
 * Mock provider instance (used for all channels in Option A)
 */
const mockProvider = new MockNotificationProvider();

/**
 * Select notification channel based on customer tier
 * 
 * @param tier - Customer tier
 * @param availableChannels - Channels that can be used
 * @returns Selected channel
 */
export function selectChannel(
  tier: CustomerTier,
  availableChannels: NotificationChannel[] = ['email', 'sms', 'zalo']
): NotificationChannel {
  const priority = CHANNEL_PRIORITY[tier] || CHANNEL_PRIORITY.new;
  
  // Return first available channel from priority list
  for (const channel of priority) {
    if (availableChannels.includes(channel)) {
      return channel;
    }
  }
  
  // Fallback to email
  return 'email';
}

/**
 * Fetch customer details for notification
 * 
 * @param customerId - Customer ID
 * @returns Customer details (name, phone, email, tier)
 */
async function fetchCustomerDetails(customerId: string): Promise<{
  name: string;
  phone: string | null;
  email: string | null;
  tier: CustomerTier;
} | null> {
  const supabase = createClient();

  try {
    const { data, error } = await supabase
      .from('customers')
      .select('name_mother, phone, email, tier')
      .eq('id', customerId)
      .single();

    if (error || !data) {
      console.error('Error fetching customer:', error);
      return null;
    }

    return {
      name: data.name_mother || 'Khách hàng',
      phone: data.phone,
      email: data.email,
      tier: (data.tier as CustomerTier) || 'new',
    };
  } catch (error) {
    console.error('Error fetching customer:', error);
    return null;
  }
}

/**
 * Send a notification
 * 
 * Main entry point for sending notifications.
 * Handles channel selection, template loading, provider calling, and logging.
 * 
 * @param input - Notification details
 * @returns Result with success status and log ID
 */
export async function sendNotification(input: {
  entryId: string;
  customerId: string;
  tenantId: string;
  type: NotificationType;
  data: NotificationTemplateData;
  preferredChannel?: NotificationChannel;
}): Promise<{ success: boolean; logId?: string; error?: string }> {
  try {
    // 1. Fetch customer details
    const customer = await fetchCustomerDetails(input.customerId);
    
    if (!customer) {
      return {
        success: false,
        error: 'Customer not found',
      };
    }

    // 2. Select channel
    const channel = input.preferredChannel || selectChannel(customer.tier);

    // 3. Build message from template
    const message = buildMessage(input.type, channel, input.data);
    
    if (!message) {
      return {
        success: false,
        error: `Template not found for type="${input.type}" channel="${channel}"`,
      };
    }

    // 4. Prepare provider input
    const providerInput: SendNotificationInput = {
      entryId: input.entryId,
      customerId: input.customerId,
      tenantId: input.tenantId,
      type: input.type,
      channel,
      recipient: {
        name: customer.name,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
      },
      data: input.data,
    };

    // 5. Send via provider (Mock for now)
    const result: SendNotificationResult = await mockProvider.send(providerInput);

    // 6. Log to database
    const now = new Date().toISOString();
    const logId = await logNotificationAttempt({
      waitlist_entry_id: input.entryId,
      customer_id: input.customerId,
      tenant_id: input.tenantId,
      notification_type: input.type,
      channel,
      status: result.success ? 'sent' : 'failed',
      message_content: message.body,
      message_template_id: `${input.type}_${channel}`,
      sent_at: result.success ? now : undefined,
      failed_at: result.success ? undefined : now,
      error_message: result.error,
      error_code: result.errorCode,
      retry_count: 0,
      max_retries: 3,
      metadata: {
        messageId: result.messageId,
        provider: mockProvider.getName(),
        ...result.metadata,
      },
    });

    if (!logId) {
      console.error('Failed to log notification');
    }

    return {
      success: result.success,
      logId: logId || undefined,
      error: result.error,
    };
  } catch (error) {
    console.error('Error sending notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Retry a failed notification
 * 
 * @param logId - Notification log ID
 * @returns Result with success status
 */
export async function retryNotification(
  logId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient();

  try {
    // Fetch the original notification log
    const { data: log, error: fetchError } = await supabase
      .from('waitlist_notification_logs')
      .select('*')
      .eq('id', logId)
      .single();

    if (fetchError || !log) {
      return {
        success: false,
        error: 'Notification log not found',
      };
    }

    // Check retry limit
    if (log.retry_count >= log.max_retries) {
      return {
        success: false,
        error: 'Max retries reached',
      };
    }

    // Increment retry count
    await incrementRetryCount(logId);

    // Fetch customer details
    const customer = await fetchCustomerDetails(log.customer_id);
    
    if (!customer) {
      await updateNotificationStatus(logId, 'failed', {
        error_message: 'Customer not found during retry',
        failed_at: new Date().toISOString(),
      });
      
      return {
        success: false,
        error: 'Customer not found',
      };
    }

    // Prepare provider input (reconstruct from log)
    const providerInput: SendNotificationInput = {
      entryId: log.waitlist_entry_id,
      customerId: log.customer_id,
      tenantId: log.tenant_id,
      type: log.notification_type,
      channel: log.channel,
      recipient: {
        name: customer.name,
        phone: customer.phone || undefined,
        email: customer.email || undefined,
      },
      data: {
        customerName: customer.name,
        // Other data would need to be stored in metadata or reconstructed
      } as NotificationTemplateData,
    };

    // Retry send
    const result: SendNotificationResult = await mockProvider.send(providerInput);

    // Update log
    const now = new Date().toISOString();
    await updateNotificationStatus(
      logId,
      result.success ? 'sent' : 'failed',
      {
        sent_at: result.success ? now : undefined,
        failed_at: result.success ? undefined : now,
        error_message: result.error,
        error_code: result.errorCode,
      }
    );

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Error retrying notification:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Retry all failed notifications (for cron job)
 * 
 * @param tenantId - Optional tenant filter
 * @param limit - Max notifications to retry
 * @returns Count of retried notifications
 */
export async function retryFailedNotifications(
  tenantId?: string,
  limit = 100
): Promise<{ retried: number; succeeded: number; failed: number }> {
  const supabase = createClient();

  try {
    // Fetch failed notifications
    let query = supabase
      .from('waitlist_notification_logs')
      .select('id, retry_count, max_retries')
      .eq('status', 'failed')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (tenantId) {
      query = query.eq('tenant_id', tenantId);
    }

    const { data: logs, error } = await query;

    if (error || !logs) {
      console.error('Error fetching failed notifications:', error);
      return { retried: 0, succeeded: 0, failed: 0 };
    }

    // Filter by retry limit
    const retryable = logs.filter((log) => log.retry_count < log.max_retries);

    let succeeded = 0;
    let failed = 0;

    // Retry each
    for (const log of retryable) {
      const result = await retryNotification(log.id);
      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    return {
      retried: retryable.length,
      succeeded,
      failed,
    };
  } catch (error) {
    console.error('Error retrying failed notifications:', error);
    return { retried: 0, succeeded: 0, failed: 0 };
  }
}
