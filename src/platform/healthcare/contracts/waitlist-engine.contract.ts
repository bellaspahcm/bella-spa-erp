/**
 * IWaitlistEngine Contract
 * 
 * Healthcare Kernel H2 Temporal — Waitlist Management Capability
 * 
 * **Contract Authority:** Healthcare Platform
 * **Kernel:** H2 Temporal (Time-based resource allocation)
 * **Consumers:** Beauty Services (Spa, Haircut, Nail), Medical Services
 * 
 * **Purpose:**
 * Walk-in queue management for time-sensitive service allocation.
 * Provides priority-based queueing, slot availability processing,
 * and position management for customers waiting for service slots.
 * 
 * **Business Rules (Consumer-Specific):**
 * - Healthcare: Priority by triage/urgency (clinical decision)
 * - Spa: FIFO queue (first-come-first-served)
 * - Haircut: FIFO queue with stylist preference
 * - Nail: FIFO queue with technician preference
 * 
 * **Invariants:**
 * 1. Position uniqueness: No two active entries can have same position
 * 2. Position continuity: Positions must be sequential (no gaps)
 * 3. Single active entry: Customer can only have one active entry per service per date
 * 4. Status progression: active → notified → reserved/converted/cancelled/expired
 * 5. Timestamp immutability: created_at never changes after insert
 * 
 * @module platform/healthcare/contracts
 * @contract IWaitlistEngine
 * @since H2 Contract Extraction (Bella Haircut)
 */

/**
 * Waitlist Entry Status Lifecycle
 * 
 * - active: Customer waiting in queue
 * - notified: Customer notified of slot availability
 * - reserved: Slot temporarily held for customer (pending confirmation)
 * - converted: Entry converted to confirmed booking
 * - cancelled: Customer cancelled waitlist entry
 * - expired: Entry expired (timeout or date passed)
 */
export type WaitlistStatus = 
  | 'active' 
  | 'notified' 
  | 'reserved' 
  | 'converted' 
  | 'cancelled' 
  | 'expired';

/**
 * Customer Tier (for priority calculation)
 * 
 * Business-specific tiers affecting queue priority:
 * - platinum: Highest priority (VIP customers)
 * - gold: High priority (frequent customers)
 * - silver: Medium priority (regular customers)
 * - bronze: Standard priority (new customers)
 */
export type CustomerTier = 'platinum' | 'gold' | 'silver' | 'bronze';

/**
 * Notification Channel
 * 
 * Available channels for customer notifications:
 * - zalo: Zalo OA message
 * - sms: SMS text message
 * - email: Email notification
 * - push: Mobile push notification
 */
export type NotificationChannel = 'zalo' | 'sms' | 'email' | 'push';

/**
 * Waitlist Entry Domain Entity
 * 
 * Represents a customer's position in the waitlist queue.
 */
export interface WaitlistEntry {
  /** Entry unique identifier */
  id: string;

  /** Tenant/organization ID (multi-tenancy) */
  tenant_id: string;

  /** Customer ID */
  customer_id: string;

  /** Customer name (denormalized for display) */
  customer_name: string;

  /** Customer phone (denormalized for notifications) */
  customer_phone?: string;

  /** Customer tier (for priority calculation) */
  customer_tier?: CustomerTier;

  /** Service/package ID */
  package_id: string;

  /** Service/package name (denormalized for display) */
  package_name: string;

  /** Service duration in minutes */
  duration_minutes: number;

  /** Preferred date (YYYY-MM-DD) */
  preferred_date: string;

  /** Preferred start time (HH:MM) */
  preferred_start_time: string;

  /** Preferred end time (HH:MM, optional) */
  preferred_end_time?: string;

  /** Priority score (calculated by business rules) */
  priority_score: number;

  /** Position in queue (1-indexed, recalculated on changes) */
  position: number;

  /** Entry status */
  status: WaitlistStatus;

  /** Estimated booking value (for priority calculation) */
  booking_value: number;

  /** Additional notes from customer */
  notes?: string;

  /** Preferred notification channels */
  preferred_channels?: NotificationChannel[];

  /** Entry creation timestamp */
  created_at: string;

  /** Last update timestamp */
  updated_at: string;

  /** Expiration timestamp (auto-expire old entries) */
  expires_at?: string;

  /** Notification sent timestamp */
  notified_at?: string;

  /** Slot reserved timestamp */
  reserved_at?: string;

  /** Converted to booking timestamp */
  converted_at?: string;

  /** Cancellation timestamp */
  cancelled_at?: string;

  /** Cancellation reason */
  cancellation_reason?: string;

  /** Converted booking ID (if converted) */
  converted_booking_id?: string;
}

/**
 * Add Customer to Waitlist Input
 * 
 * Required fields for creating a new waitlist entry.
 */
export interface AddToWaitlistInput {
  /** Tenant ID */
  tenant_id: string;

  /** Customer ID */
  customer_id: string;

  /** Service/package ID */
  package_id: string;

  /** Preferred date (YYYY-MM-DD) */
  preferred_date: string;

  /** Preferred start time (HH:MM) */
  preferred_start_time: string;

  /** Preferred end time (HH:MM, optional) */
  preferred_end_time?: string;

  /** Estimated booking value */
  booking_value: number;

  /** Customer notes */
  notes?: string;

  /** Preferred notification channels */
  preferred_channels?: NotificationChannel[];

  /** Custom priority override (admin only) */
  priority_override?: number;
}

/**
 * Add Customer to Waitlist Output
 * 
 * Result of adding customer to waitlist.
 */
export interface AddToWaitlistOutput {
  /** Operation success flag */
  success: boolean;

  /** Created entry (if successful) */
  entry?: WaitlistEntry;

  /** Error message (if failed) */
  error?: string;

  /** Error code (if failed) */
  error_code?: 
    | 'DUPLICATE_ENTRY' 
    | 'INVALID_INPUT' 
    | 'DATABASE_ERROR' 
    | 'CUSTOMER_NOT_FOUND' 
    | 'PACKAGE_NOT_FOUND'
    | 'PRIORITY_CALCULATION_FAILED';
}

/**
 * Waitlist Filters
 * 
 * Query filters for listing waitlist entries.
 */
export interface WaitlistFilters {
  /** Filter by tenant ID */
  tenant_id: string;

  /** Filter by customer ID (optional) */
  customer_id?: string;

  /** Filter by package ID (optional) */
  package_id?: string;

  /** Filter by date (YYYY-MM-DD, optional) */
  preferred_date?: string;

  /** Filter by status (optional, multiple allowed) */
  status?: WaitlistStatus[];

  /** Filter by minimum priority score (optional) */
  min_priority?: number;

  /** Filter by maximum priority score (optional) */
  max_priority?: number;

  /** Pagination: page number (1-indexed) */
  page?: number;

  /** Pagination: entries per page */
  page_size?: number;

  /** Sort field (default: position) */
  sort_by?: 'position' | 'priority_score' | 'created_at' | 'updated_at';

  /** Sort direction (default: asc) */
  sort_order?: 'asc' | 'desc';
}

/**
 * Waitlist List Response
 * 
 * Paginated list of waitlist entries.
 */
export interface WaitlistListResponse {
  /** List of entries */
  entries: WaitlistEntry[];

  /** Total count (all pages) */
  total_count: number;

  /** Current page (1-indexed) */
  page: number;

  /** Entries per page */
  page_size: number;

  /** Total pages */
  total_pages: number;

  /** Has next page flag */
  has_next: boolean;

  /** Has previous page flag */
  has_prev: boolean;
}

/**
 * Available Slot
 * 
 * Represents a newly available slot for waitlist processing.
 */
export interface AvailableSlot {
  /** Tenant ID */
  tenant_id: string;

  /** Package ID */
  package_id: string;

  /** Slot date (YYYY-MM-DD) */
  slot_date: string;

  /** Slot start time (HH:MM) */
  slot_start_time: string;

  /** Slot end time (HH:MM) */
  slot_end_time: string;

  /** Staff/resource ID (optional) */
  staff_id?: string;

  /** Location/branch ID (optional) */
  branch_id?: string;

  /** Maximum customers to notify (default: 3) */
  notify_count?: number;
}

/**
 * Process Slot Available Result
 * 
 * Result of processing slot availability (auto-notify).
 */
export interface ProcessSlotResult {
  /** Operation success flag */
  success: boolean;

  /** Number of customers notified */
  notified_count: number;

  /** List of notified entry IDs */
  notified_entry_ids: string[];

  /** Error message (if failed) */
  error?: string;
}

/**
 * Update Waitlist Entry Input
 * 
 * Fields allowed for updating existing entry.
 */
export interface UpdateWaitlistEntryInput {
  /** Entry ID */
  entry_id: string;

  /** Tenant ID (required for authorization) */
  tenant_id: string;

  /** New status (optional) */
  status?: WaitlistStatus;

  /** Cancellation reason (required if status = cancelled) */
  cancellation_reason?: string;

  /** New priority override (admin only) */
  priority_override?: number;

  /** New preferred date (optional) */
  preferred_date?: string;

  /** New preferred start time (optional) */
  preferred_start_time?: string;

  /** New preferred end time (optional) */
  preferred_end_time?: string;

  /** New notes (optional) */
  notes?: string;

  /** New preferred channels (optional) */
  preferred_channels?: NotificationChannel[];
}

/**
 * Convert Waitlist to Booking Input
 * 
 * Required fields for converting waitlist entry to confirmed booking.
 */
export interface ConvertToBookingInput {
  /** Entry ID */
  entry_id: string;

  /** Tenant ID */
  tenant_id: string;

  /** Confirmed date (YYYY-MM-DD) */
  confirmed_date: string;

  /** Confirmed start time (HH:MM) */
  confirmed_start_time: string;

  /** Confirmed end time (HH:MM) */
  confirmed_end_time: string;

  /** Assigned staff ID */
  assigned_staff_id?: string;

  /** Assigned branch ID */
  assigned_branch_id?: string;

  /** Booking notes */
  booking_notes?: string;
}

/**
 * Convert Waitlist to Booking Output
 * 
 * Result of converting entry to booking.
 */
export interface ConvertToBookingOutput {
  /** Operation success flag */
  success: boolean;

  /** Created booking ID (if successful) */
  booking_id?: string;

  /** Updated entry (if successful) */
  entry?: WaitlistEntry;

  /** Error message (if failed) */
  error?: string;

  /** Error code (if failed) */
  error_code?: 
    | 'ENTRY_NOT_FOUND' 
    | 'INVALID_STATUS' 
    | 'BOOKING_CREATION_FAILED' 
    | 'DATABASE_ERROR';
}

/**
 * Waitlist Statistics
 * 
 * Aggregated statistics for waitlist monitoring.
 */
export interface WaitlistStats {
  /** Tenant ID */
  tenant_id: string;

  /** Date (YYYY-MM-DD, optional for overall stats) */
  date?: string;

  /** Total active entries */
  active_count: number;

  /** Total notified entries */
  notified_count: number;

  /** Total reserved entries */
  reserved_count: number;

  /** Total converted entries */
  converted_count: number;

  /** Total cancelled entries */
  cancelled_count: number;

  /** Total expired entries */
  expired_count: number;

  /** Average wait time (minutes, for converted entries) */
  avg_wait_time_minutes?: number;

  /** Conversion rate (converted / total entries) */
  conversion_rate?: number;

  /** Breakdown by package */
  by_package?: Array<{
    package_id: string;
    package_name: string;
    active_count: number;
    conversion_rate: number;
  }>;
}

/**
 * IWaitlistEngine Contract Interface
 * 
 * Healthcare Platform capability for waitlist queue management.
 * 
 * **Kernel Responsibility:**
 * - Position calculation and management
 * - Status lifecycle enforcement
 * - Queue invariant validation
 * - Slot availability processing
 * 
 * **Consumer Responsibility:**
 * - Priority score calculation (business-specific rules)
 * - Notification delivery (via notification service)
 * - Booking creation (via booking engine)
 * - Business rule enforcement (FIFO, triage, etc.)
 * 
 * **Data Ownership:**
 * - Kernel owns: `waitlist_entries` table structure, position, status
 * - Consumer owns: Business rules, priority calculation, notifications
 */
export interface IWaitlistEngine {
  /**
   * Add Customer to Waitlist
   * 
   * Creates new waitlist entry with calculated priority and position.
   * 
   * **Invariants enforced:**
   * - No duplicate active entries (same customer, service, date)
   * - Position uniqueness (recalculates all positions)
   * - Priority score calculation (via consumer-provided rules)
   * 
   * @param input - Waitlist entry details
   * @returns Success/failure with created entry
   */
  addToWaitlist(input: AddToWaitlistInput): Promise<AddToWaitlistOutput>;

  /**
   * Get Waitlist Entries
   * 
   * Query waitlist entries with filters and pagination.
   * 
   * @param filters - Query filters
   * @returns Paginated list of entries
   */
  getWaitlistEntries(filters: WaitlistFilters): Promise<WaitlistListResponse>;

  /**
   * Get Single Waitlist Entry
   * 
   * Retrieve entry by ID.
   * 
   * @param entryId - Entry unique identifier
   * @param tenantId - Tenant ID (for authorization)
   * @returns Entry if found, null otherwise
   */
  getWaitlistEntry(entryId: string, tenantId: string): Promise<WaitlistEntry | null>;

  /**
   * Update Waitlist Entry
   * 
   * Update entry fields (status, dates, notes, priority).
   * 
   * **Invariants enforced:**
   * - Position recalculation on priority change
   * - Status transition validation
   * - Timestamp updates
   * 
   * @param input - Update fields
   * @returns Success/failure with updated entry
   */
  updateWaitlistEntry(input: UpdateWaitlistEntryInput): Promise<AddToWaitlistOutput>;

  /**
   * Remove from Waitlist
   * 
   * Cancel waitlist entry (soft delete, status = cancelled).
   * 
   * **Invariants enforced:**
   * - Position recalculation (fill gap)
   * - Status validation (cannot cancel converted entries)
   * 
   * @param entryId - Entry ID
   * @param tenantId - Tenant ID
   * @param reason - Cancellation reason
   * @returns Success/failure
   */
  removeFromWaitlist(
    entryId: string, 
    tenantId: string, 
    reason: string
  ): Promise<{ success: boolean; error?: string }>;

  /**
   * Process Slot Available
   * 
   * Auto-notify top N customers in queue when slot becomes available.
   * 
   * **Business logic:**
   * 1. Query top N active entries (by position)
   * 2. Update status to 'notified'
   * 3. Trigger notifications (consumer responsibility)
   * 4. Return list of notified entry IDs
   * 
   * @param slot - Available slot details
   * @returns Notified count and entry IDs
   */
  processSlotAvailable(slot: AvailableSlot): Promise<ProcessSlotResult>;

  /**
   * Expire Old Entries
   * 
   * Mark entries as expired based on expiration rules.
   * 
   * **Expiration rules:**
   * - Status 'notified' for > 24 hours without conversion
   * - Preferred date in the past
   * - Custom expires_at timestamp
   * 
   * **Invariants enforced:**
   * - Position recalculation (remove expired from queue)
   * 
   * @param tenantId - Tenant ID
   * @returns Count of expired entries
   */
  expireOldEntries(tenantId: string): Promise<{ expired_count: number }>;

  /**
   * Recalculate Queue Positions
   * 
   * Rebuild position sequence for all active entries.
   * 
   * **Used when:**
   * - Entry added/removed
   * - Priority changed
   * - Status changed (active ↔ other)
   * 
   * **Algorithm:**
   * 1. Query all active entries
   * 2. Sort by priority_score DESC, created_at ASC
   * 3. Assign positions 1, 2, 3, ...
   * 4. Update database
   * 
   * @param tenantId - Tenant ID
   * @param date - Specific date to recalculate (optional, recalculates all if omitted)
   * @returns Success/failure
   */
  recalculatePositions(
    tenantId: string, 
    date?: string
  ): Promise<{ success: boolean; recalculated_count: number }>;

  /**
   * Get Waitlist Statistics
   * 
   * Aggregate statistics for monitoring and reporting.
   * 
   * @param tenantId - Tenant ID
   * @param date - Specific date (optional, overall stats if omitted)
   * @returns Aggregated statistics
   */
  getWaitlistStats(tenantId: string, date?: string): Promise<WaitlistStats>;

  /**
   * Convert Waitlist Entry to Booking
   * 
   * Create confirmed booking from waitlist entry.
   * 
   * **Flow:**
   * 1. Validate entry (status must be 'notified' or 'reserved')
   * 2. Create booking (consumer responsibility via booking engine)
   * 3. Update entry status to 'converted'
   * 4. Store converted_booking_id
   * 5. Recalculate positions (remove from queue)
   * 
   * @param input - Booking confirmation details
   * @returns Success/failure with booking ID
   */
  convertToBooking(input: ConvertToBookingInput): Promise<ConvertToBookingOutput>;
}

/**
 * Contract Metadata
 */
export const WAITLIST_ENGINE_CONTRACT_METADATA = {
  /** Contract name */
  name: 'IWaitlistEngine',

  /** Contract version (semantic versioning) */
  version: '1.0.0',

  /** Owning kernel */
  kernel: 'H2 Temporal',

  /** Kernel responsibility scope */
  kernel_responsibility: [
    'Position calculation and uniqueness',
    'Status lifecycle enforcement',
    'Queue invariant validation',
    'Slot availability processing',
    'Expiration management',
  ],

  /** Consumer responsibility scope */
  consumer_responsibility: [
    'Priority score calculation (business rules)',
    'Notification delivery',
    'Booking creation',
    'Business rule enforcement (FIFO, triage, etc.)',
  ],

  /** Known consumers */
  consumers: [
    'Bella Spa (existing)',
    'Bella Haircut (H2 extraction)',
    'Bella Nail (future)',
    'Bella Medical (future)',
  ],

  /** Data ownership */
  data_ownership: {
    kernel: ['waitlist_entries table structure', 'position', 'status', 'timestamps'],
    consumer: ['priority calculation logic', 'notification rules', 'booking rules'],
  },

  /** Extraction metadata */
  extraction: {
    source: 'src/services/waitlist/waitlist-service.ts',
    extracted_date: '2026-09-15',
    extracted_by: 'H2 Contract Extraction Phase',
    product: 'Bella Haircut',
    baseline: 'd02b4fbb3a954ab8e5fafecfbb2ff93340065acd',
  },
} as const;
