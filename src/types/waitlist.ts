/**
 * Waitlist Domain Types
 * 
 * TypeScript types for waitlist management system.
 * These types map to database schema defined in:
 * supabase/migrations/20260712000000_create_waitlist_tables.sql
 * 
 * @module types/waitlist
 */

/**
 * Customer Tier (from membership system)
 * Affects priority calculation:
 * - vip: 40 priority points
 * - loyal: 25 priority points
 * - new: 10 priority points
 */
export type CustomerTier = 'vip' | 'loyal' | 'new';

/**
 * Waitlist Entry Status Lifecycle
 * 
 * Flow: active → notified → reserved → converted
 * Alternative endings: expired, cancelled
 */
export type WaitlistStatus = 
  | 'active'      // Waiting for slot
  | 'notified'    // Notification sent to customer
  | 'reserved'    // Slot temporarily held for customer
  | 'converted'   // Successfully booked
  | 'expired'     // Timeout (> 24 hours)
  | 'cancelled';  // Manually removed

/**
 * Notification Channel
 * Priority: Zalo (VIP) > SMS > Email > Push
 */
export type NotificationChannel = 'zalo' | 'sms' | 'email' | 'push';

/**
 * Notification Type
 */
export type NotificationType = 
  | 'slot_available'   // Slot became available
  | 'position_updated' // Moved up in queue
  | 'expiring_soon'    // Entry will expire soon (2 hours)
  | 'expired'          // Entry expired
  | 'reserved';        // Slot reserved for customer

/**
 * Notification Status
 */
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'cancelled';

/**
 * Waitlist Entry (Database Row)
 * Maps to waitlist_entries table
 */
export interface WaitlistEntry {
  // Primary Key
  id: string;
  
  // Tenant Isolation
  tenant_id: string;
  
  // Customer & Booking Context
  customer_id: string;
  customer_name: string;
  customer_tier: CustomerTier;
  booking_id: string | null;
  booking_request_id: string | null;
  
  // Service Details (packages = services in Bella ERP)
  package_id: string;
  package_name: string;
  booking_value: number; // DECIMAL(10,2) in DB
  
  // Preferred Schedule
  preferred_date: string; // DATE (YYYY-MM-DD)
  preferred_start_time: string; // TIME (HH:MM:SS)
  duration_minutes: number;
  
  // Preferred Assignments (Optional)
  preferred_ktv_id: string | null;
  preferred_ktv_name: string | null;
  preferred_resource_id: string | null;
  preferred_resource_name: string | null;
  
  // Flexibility
  is_flexible: boolean;
  
  // Priority Calculation (0-100 scale)
  priority_score: number;
  tier_score: number;
  value_score: number;
  wait_time_score: number;
  flexibility_bonus: number;
  
  // Queue Position
  position: number; // 1 = first in queue
  wait_minutes: number;
  estimated_wait_minutes: number;
  
  // Status & Timing
  status: WaitlistStatus;
  
  // Reservation (when status = 'reserved')
  reserved_at: string | null; // TIMESTAMPTZ
  reservation_expires_at: string | null; // TIMESTAMPTZ
  
  // Expiry
  expires_at: string; // TIMESTAMPTZ
  
  // Notification Tracking
  notification_channel: NotificationChannel | null;
  notified_at: string | null; // TIMESTAMPTZ
  notification_count: number;
  last_notification_at: string | null; // TIMESTAMPTZ
  
  // Conversion Tracking
  converted_to_booking_id: string | null;
  converted_at: string | null; // TIMESTAMPTZ
  
  // Cancellation/Removal
  removal_reason: string | null;
  removed_by_user_id: string | null;
  removed_at: string | null; // TIMESTAMPTZ
  
  // Metadata
  notes: string | null;
  internal_notes: string | null;
  
  // Audit
  created_by_user_id: string | null;
  created_at: string; // TIMESTAMPTZ
  updated_at: string; // TIMESTAMPTZ
}

/**
 * Waitlist Notification Log (Database Row)
 * Maps to waitlist_notification_logs table
 */
export interface WaitlistNotificationLog {
  // Primary Key
  id: string;
  
  // Tenant Isolation
  tenant_id: string;
  
  // Relationships
  waitlist_entry_id: string;
  customer_id: string;
  
  // Notification Details
  notification_type: NotificationType;
  channel: NotificationChannel;
  
  // Status
  status: NotificationStatus;
  
  // Message Content
  message_content: string | null;
  message_template_id: string | null;
  
  // Delivery Tracking
  sent_at: string | null; // TIMESTAMPTZ
  delivered_at: string | null; // TIMESTAMPTZ
  read_at: string | null; // TIMESTAMPTZ
  
  // Error Handling
  failed_at: string | null; // TIMESTAMPTZ
  error_message: string | null;
  error_code: string | null;
  retry_count: number;
  max_retries: number;
  
  // Response Tracking
  customer_response: string | null; // 'accept', 'decline', 'later'
  customer_response_at: string | null; // TIMESTAMPTZ
  
  // Metadata
  metadata: Record<string, unknown> | null; // JSONB
  
  // Audit
  created_at: string; // TIMESTAMPTZ
}

/**
 * Input for Adding to Waitlist
 * Used by service layer
 */
export interface AddToWaitlistInput {
  // Required
  tenant_id: string;
  customer_id: string;
  package_id: string;
  preferred_date: string; // YYYY-MM-DD
  preferred_start_time: string; // HH:MM
  booking_value: number;
  
  // Optional
  booking_id?: string; // If failed booking → waitlist
  duration_minutes?: number; // Default: 90
  preferred_ktv_id?: string;
  preferred_resource_id?: string;
  is_flexible?: boolean; // Default: false
  notes?: string;
  created_by_user_id?: string;
}

/**
 * Output from Adding to Waitlist
 */
export interface AddToWaitlistOutput {
  success: boolean;
  entry?: WaitlistEntry;
  position?: number;
  estimated_wait_minutes?: number;
  error?: string;
  error_code?: 'CAPACITY_FULL' | 'DUPLICATE_ENTRY' | 'VALIDATION_ERROR' | 'DATABASE_ERROR';
}

/**
 * Waitlist Filters (for listing)
 */
export interface WaitlistFilters {
  tenant_id: string;
  package_id?: string;
  customer_id?: string;
  status?: WaitlistStatus | WaitlistStatus[];
  preferred_date?: string; // Exact date
  date_from?: string; // Date range
  date_to?: string; // Date range
  min_priority?: number;
  max_priority?: number;
  page?: number;
  limit?: number;
  sort_by?: 'priority' | 'position' | 'created_at' | 'wait_time';
  sort_order?: 'asc' | 'desc';
}

/**
 * Paginated Waitlist Response
 */
export interface WaitlistListResponse {
  entries: WaitlistEntry[];
  total: number;
  page: number;
  total_pages: number;
  has_next: boolean;
  has_prev: boolean;
}

/**
 * Slot Information (for processing waitlist)
 */
export interface AvailableSlot {
  tenant_id: string;
  package_id: string;
  date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  duration_minutes: number;
  ktv_id?: string;
  resource_id?: string;
  reason: 'cancellation' | 'new_slot' | 'reschedule';
}

/**
 * Result from Processing Slot
 */
export interface ProcessSlotResult {
  slot: AvailableSlot;
  notified_customers: Array<{
    entry_id: string;
    customer_id: string;
    customer_name: string;
    notification_sent: boolean;
    notification_channel: NotificationChannel;
    match_score: number; // 0-100 (how well slot matches preferences)
  }>;
  total_notified: number;
}

/**
 * Waitlist Configuration
 * Tenant-level or system-level settings
 */
export interface WaitlistConfig {
  // Capacity
  max_waitlist_size: number; // Default: 10 per slot
  
  // Expiry
  waitlist_expiry_hours: number; // Default: 24
  
  // Reservation
  slot_reservation_minutes: number; // Default: 30
  
  // Notification
  enable_auto_notification: boolean; // Default: true
  notification_channels: NotificationChannel[]; // Preferred order
  max_notifications_per_entry: number; // Default: 3
  
  // Priority Weights
  tier_scores: {
    vip: number; // Default: 40
    loyal: number; // Default: 25
    new: number; // Default: 10
  };
  value_score_max: number; // Default: 30
  wait_time_score_max: number; // Default: 20
  flexibility_bonus: number; // Default: 10
}

/**
 * Default Waitlist Configuration
 */
export const DEFAULT_WAITLIST_CONFIG: WaitlistConfig = {
  max_waitlist_size: 10,
  waitlist_expiry_hours: 24,
  slot_reservation_minutes: 30,
  enable_auto_notification: true,
  notification_channels: ['zalo', 'sms', 'email'],
  max_notifications_per_entry: 3,
  tier_scores: {
    vip: 40,
    loyal: 25,
    new: 10,
  },
  value_score_max: 30,
  wait_time_score_max: 20,
  flexibility_bonus: 10,
};

/**
 * Waitlist Statistics (for dashboard)
 */
export interface WaitlistStats {
  tenant_id: string;
  period: 'today' | 'week' | 'month';
  
  // Counts
  total_entries: number;
  active_entries: number;
  notified_entries: number;
  converted_entries: number;
  expired_entries: number;
  
  // Conversion Metrics
  conversion_rate: number; // % (notified → converted)
  avg_wait_minutes: number;
  avg_position: number;
  
  // By Service
  top_services: Array<{
    package_id: string;
    package_name: string;
    entry_count: number;
    conversion_rate: number;
  }>;
}
