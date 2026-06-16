import type { ModuleId } from './module';

/**
 * Notification recipient types.
 * 
 * @remarks
 * Determines who the notification is for:
 * - `user`: Internal staff/employees (KTVs, receptionists, managers)
 * - `customer`: External customers who book services
 * - `admin`: System administrators and owner accounts
 */
export type RecipientType = 'user' | 'customer' | 'admin';

/**
 * Notification delivery channels.
 * 
 * @remarks
 * Supported delivery methods for notifications:
 * - `in_app`: Show in the application's notification center
 * - `email`: Send email to recipient's email address
 * - `sms`: Send SMS to recipient's phone number
 * - `webhook`: POST to external webhook URL for integrations
 * - `push`: Send push notification to mobile device (requires app)
 */
export type NotificationChannel = 'in_app' | 'email' | 'sms' | 'webhook' | 'push';

/**
 * Notification priority levels.
 * 
 * @remarks
 * Controls notification urgency and handling:
 * - `low`: Informational, can be batched or delayed (e.g., weekly summaries)
 * - `medium`: Standard notifications (e.g., booking confirmations)
 * - `high`: Important notifications requiring attention (e.g., payment received)
 * - `urgent`: Critical notifications requiring immediate action (e.g., system errors, security alerts)
 */
export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * Notification event for multi-channel system notifications.
 * 
 * @remarks
 * Used to send notifications through various channels:
 * - `in_app`: Show in application notification center
 * - `email`: Send email to recipient
 * - `sms`: Send SMS to recipient's phone
 * - `webhook`: Send to external webhook URL
 * - `push`: Send push notification to mobile device
 * 
 * @example
 * ```typescript
 * const notification: NotificationEvent = {
 *   id: 'notif-uuid',
 *   tenantId: 'tenant-uuid',
 *   moduleId: 'spa',
 *   type: 'booking_confirmed',
 *   recipientId: 'customer-uuid',
 *   recipientType: 'customer',
 *   channels: ['in_app', 'sms'],
 *   priority: 'high',
 *   title: 'Booking Confirmed',
 *   message: 'Your spa appointment has been confirmed for June 1, 2025 at 9:00 AM',
 *   metadata: {
 *     bookingId: 'booking-uuid',
 *     actionUrl: '/bookings/booking-uuid',
 *   },
 *   createdAt: '2025-06-01T08:00:00Z',
 * };
 * ```
 */
export interface NotificationEvent {
  /** Unique identifier (UUID) */
  id: string;
  
  /** Tenant this notification belongs to */
  tenantId: string;
  
  /** Module that generated this notification (optional) */
  moduleId?: ModuleId;
  
  /** Notification type/category (e.g., 'booking_confirmed', 'payment_received') */
  type: string;
  
  /** Recipient user/customer ID */
  recipientId: string;
  
  /** Type of recipient */
  recipientType: RecipientType;
  
  /** Channels to deliver notification through */
  channels: NotificationChannel[];
  
  /** Notification priority */
  priority: NotificationPriority;
  
  /** Notification title */
  title: string;
  
  /** Notification message body */
  message: string;
  
  /** 
   * Additional data (action URL, button config, images, etc.).
   * 
   * @remarks
   * Store notification-specific data for rich UI rendering and action handling.
   * 
   * **Common fields**:
   * - `actionUrl: string` - URL to navigate when notification is clicked
   * - `actionLabel: string` - Label for action button (e.g., "View Booking")
   * - `imageUrl: string` - URL to notification icon or image
   * - `expiresAt: string` - ISO timestamp when notification expires
   * 
   * **Booking notifications**:
   * - `bookingId: string` - Reference to booking
   * - `customerName: string` - Customer display name
   * - `serviceName: string` - Service/package name
   * - `scheduledTime: string` - Appointment time
   * 
   * **Payment notifications**:
   * - `paymentId: string` - Reference to payment
   * - `amount: number` - Payment amount
   * - `currency: string` - Currency code
   * - `receiptUrl: string` - Link to payment receipt
   * 
   * **System notifications**:
   * - `severity: string` - Error severity level
   * - `stackTrace: string` - Error stack trace (for admin notifications)
   * - `affectedUsers: number` - Count of affected users
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata: Record<string, any>;
  
  /** When notification was created (ISO 8601 timestamp) */
  createdAt: string;
}
