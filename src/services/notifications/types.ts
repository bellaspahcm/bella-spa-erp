/**
 * Notification Service Types
 * 
 * Types for the multi-channel notification system.
 * Supports SMS, Email, and Zalo notifications.
 * 
 * @module services/notifications/types
 */

import type { NotificationChannel, NotificationType } from '@/types/waitlist';

/**
 * Input for sending a notification
 */
export interface SendNotificationInput {
  // Entry context
  entryId: string;
  customerId: string;
  tenantId: string;
  
  // Notification details
  type: NotificationType;
  channel: NotificationChannel;
  
  // Recipient
  recipient: {
    phone?: string;
    email?: string;
    zaloId?: string;
    name: string;
  };
  
  // Template data (for variable interpolation)
  data: NotificationTemplateData;
}

/**
 * Template data for notifications
 */
export interface NotificationTemplateData {
  customerName: string;
  serviceName: string;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:MM
  position?: number;
  estimatedWait?: number; // minutes
  matchScore?: number; // 0-100
  bookingLink?: string;
  contactPhone?: string;
  reason?: string;
  [key: string]: string | number | undefined; // Allow additional dynamic fields
}

/**
 * Result from sending a notification
 */
export interface SendNotificationResult {
  success: boolean;
  messageId?: string; // Provider's message ID (Twilio SID, SendGrid ID)
  error?: string;
  errorCode?: string;
  deliveryStatus?: 'queued' | 'sent' | 'delivered' | 'failed';
  metadata?: Record<string, unknown>; // Provider-specific metadata
}

/**
 * Provider configuration
 */
export interface ProviderConfig {
  // API credentials
  apiKey?: string;
  apiSecret?: string;
  accountSid?: string;
  authToken?: string;
  
  // Provider settings
  fromPhone?: string;
  fromEmail?: string;
  fromName?: string;
  appId?: string;
  
  // Behavior
  enabled: boolean;
  maxRetries: number;
  timeoutMs: number;
}

/**
 * Notification log entry (to be inserted into DB)
 */
export interface NotificationLogEntry {
  // Relations
  waitlist_entry_id: string;
  customer_id: string;
  tenant_id: string;
  
  // Notification details
  notification_type: NotificationType;
  channel: NotificationChannel;
  
  // Status
  status: 'pending' | 'sent' | 'failed' | 'cancelled';
  
  // Message
  message_content: string;
  message_template_id?: string;
  
  // Delivery tracking
  sent_at?: string; // ISO timestamp
  delivered_at?: string;
  read_at?: string;
  
  // Error handling
  failed_at?: string;
  error_message?: string;
  error_code?: string;
  retry_count: number;
  max_retries: number;
  
  // Provider metadata
  metadata?: Record<string, unknown>;
}

/**
 * Notification template
 */
export interface NotificationTemplate {
  id: string;
  type: NotificationType;
  channel: NotificationChannel;
  
  // Template content
  subject?: string; // Email only
  body: string; // Plain text
  htmlBody?: string; // Email only
  
  // Variables used in template (for validation)
  variables: string[];
}

/**
 * Channel selection result
 */
export interface ChannelSelectionResult {
  channel: NotificationChannel;
  fallbackChannels: NotificationChannel[];
  reason: string;
}

