/**
 * Booking Engine Provider Types
 * 
 * Type definitions for all Booking Engine providers:
 * - Auto-Assignment Provider
 * - Capacity Management Provider
 * - Conflict Detection Provider
 * - Waitlist Management Provider
 * - Dynamic Pricing Provider
 * - Cancellation Logic Provider
 * 
 * @module decision-engine/providers/booking
 */

/**
 * Auto-Assignment Decision Input
 * 
 * Context required to assign optimal KTV for booking request.
 */
export interface AutoAssignmentInput {
  /** Tenant identifier */
  tenantId: string;

  /** Booking request details */
  booking: {
    /** Customer identifier */
    customerId: string;
    /** Service/package identifier */
    serviceId: string;
    /** Service type (for specialization matching) */
    serviceType: string;
    /** Requested date (ISO format) */
    requestedDate: string;
    /** Requested start time (HH:mm format) */
    requestedStartTime: string;
    /** Expected duration (minutes) */
    durationMinutes: number;
  };

  /** Customer preferences */
  customer: {
    /** Customer tier (VIP, Loyal, New) */
    tier: 'vip' | 'loyal' | 'new';
    /** Preferred KTV ID (if any) */
    preferredKtvId?: string;
    /** History with KTVs (previous bookings) */
    ktvHistory?: Record<string, number>; // { ktvId: bookingCount }
  };

  /** Assignment constraints */
  constraints?: {
    /** Exclude specific KTVs */
    excludeKtvIds?: string[];
    /** Require specific skills */
    requiredSkills?: string[];
    /** Minimum rating requirement */
    minRating?: number;
    /** Prefer gender */
    preferGender?: 'male' | 'female' | 'any';
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Auto-Assignment Decision Output
 * 
 * Result of KTV assignment decision.
 */
export interface AutoAssignmentOutput {
  /** Was assignment successful? */
  success: boolean;

  /** Assigned KTV ID (null if failed) */
  assignedKtvId: string | null;

  /** Assignment confidence score (0-1) */
  confidence: number;

  /** Assignment reason */
  reason: string;

  /** Matched rules */
  matchedRules: string[];

  /** Alternative KTV suggestions (if assignment failed or for reference) */
  alternatives?: Array<{
    ktvId: string;
    score: number;
    reason: string;
  }>;

  /** Execution time (ms) */
  executionTime: number;

  /** Provider identifier */
  provider: 'AutoAssignmentProvider';
}

/**
 * KTV Candidate
 * 
 * Represents a KTV candidate for assignment evaluation.
 */
export interface KtvCandidate {
  /** KTV identifier */
  id: string;

  /** KTV name */
  name: string;

  /** KTV position/role */
  position: string;

  /** Years of service */
  yearsOfService: number;

  /** Skills */
  skills: string[];

  /** Specializations */
  specializations: string[];

  /** Average rating (0-5) */
  avgRating: number;

  /** Current workload (bookings today) */
  currentWorkload: number;

  /** Max daily bookings */
  maxDailyBookings: number;

  /** Availability status */
  availability: {
    /** Is available at requested time? */
    isAvailable: boolean;
    /** Next available slot (if not available) */
    nextAvailableSlot?: string;
  };

  /** Customer preference indicator */
  isPreferredByCustomer: boolean;

  /** History with customer */
  customerBookingCount: number;
}

/**
 * Assignment Score Breakdown
 * 
 * Detailed scoring for transparency and debugging.
 */
export interface AssignmentScoreBreakdown {
  /** Total score (0-100) */
  total: number;

  /** Component scores */
  components: {
    skillMatch: number; // 0-25
    availability: number; // 0-20
    workloadBalance: number; // 0-20
    performance: number; // 0-15
    customerPreference: number; // 0-10
    specialization: number; // 0-10
  };

  /** Penalties applied (always present, values optional) */
  penalties: {
    lowRating?: number;
    overloaded?: number;
    noHistory?: number;
  };
}

/**
 * Auto-Assignment Knowledge (for rule evaluation)
 */
export interface AutoAssignmentKnowledge {
  tenantId: string;
  customerId: string;
  serviceId: string;
  serviceType: string;
  requestedDate: string;
  requestedStartTime: string;
  durationMinutes: number;
  'customer.tier': string;
  'customer.preferredKtvId'?: string;
  'constraints.minRating'?: number;
  [key: string]: unknown;
}

/**
 * Provider evaluation options
 */
export interface AssignmentEvaluationOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Return top N alternatives */
  topN?: number;

  /** Force specific KTV (bypass rules) */
  forceKtvId?: string;

  /** Dry run (don't modify state) */
  dryRun?: boolean;
}

// ============================================================================
// CAPACITY MANAGEMENT PROVIDER TYPES (Phase 2)
// ============================================================================

/**
 * Capacity Check Input
 * 
 * Context required to check capacity for booking request.
 */
export interface CapacityCheckInput {
  /** Tenant identifier */
  tenantId: string;

  /** KTV identifier */
  ktvId: string;

  /** Booking request details */
  booking: {
    /** Requested date (ISO format YYYY-MM-DD) */
    requestedDate: string;
    /** Requested start time (HH:mm format) */
    requestedStartTime: string;
    /** Requested end time (HH:mm format) */
    requestedEndTime: string;
    /** Expected duration (minutes) */
    durationMinutes: number;
    /** Service type */
    serviceType: string;
    /** Customer tier (for buffer slots) */
    customerTier: 'vip' | 'loyal' | 'new';
  };

  /** KTV capacity configuration */
  ktvCapacity: {
    /** Maximum sessions per day */
    maxDailyBookings: number;
    /** Maximum concurrent sessions */
    maxConcurrentSessions: number;
    /** Minimum break between sessions (minutes) */
    minBreakMinutes: number;
    /** Working hours (HH:mm - HH:mm) */
    workingHours: {
      start: string;
      end: string;
    };
    /** Peak hours (higher capacity limits) */
    peakHours?: {
      start: string;
      end: string;
      maxBookings: number;
    };
  };

  /** Current bookings for KTV on requested date */
  existingBookings: Array<{
    /** Booking ID */
    id: string;
    /** Start time (HH:mm) */
    startTime: string;
    /** End time (HH:mm) */
    endTime: string;
    /** Duration (minutes) */
    durationMinutes: number;
    /** Booking status */
    status: 'pending' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled';
  }>;

  /** Tenant capacity configuration */
  tenantCapacity?: {
    /** Buffer slots for VIP/emergency (percentage 0-100) */
    bufferPercentage: number;
    /** Enable peak hour management */
    enablePeakHourManagement: boolean;
    /** Enforce break times */
    enforceBreakTimes: boolean;
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Capacity Check Output
 * 
 * Result of capacity check decision.
 */
export interface CapacityCheckOutput {
  /** Is capacity available? */
  available: boolean;

  /** Capacity check passed? */
  success: boolean;

  /** Reason for result */
  reason: string;

  /** Matched rules */
  matchedRules: string[];

  /** Capacity details */
  capacityDetails: {
    /** Current bookings count */
    currentBookings: number;
    /** Maximum allowed bookings */
    maxBookings: number;
    /** Utilization percentage (0-100) */
    utilizationPercentage: number;
    /** Buffer slots used */
    bufferSlotsUsed: number;
    /** Buffer slots available */
    bufferSlotsAvailable: number;
    /** Is peak hour? */
    isPeakHour: boolean;
  };

  /** Conflicts detected (if any) */
  conflicts?: CapacityConflict[];

  /** Alternative suggestions (if capacity not available) */
  alternatives?: Array<{
    /** Alternative time slot */
    timeSlot: string;
    /** Alternative KTV (if different KTV has capacity) */
    ktvId?: string;
    /** Reason for suggestion */
    reason: string;
  }>;

  /** Execution time (ms) */
  executionTime: number;

  /** Provider identifier */
  provider: 'CapacityManagementProvider';

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Capacity Conflict Details
 */
export interface CapacityConflict {
  /** Conflict type */
  type: 'time_overlap' | 'concurrent_limit' | 'break_time_violation' | 'daily_limit' | 'outside_working_hours';
  /** Conflict reason */
  reason: string;
  /** Conflicting booking (if applicable) */
  conflictingBooking?: {
    id: string;
    startTime: string;
    endTime: string;
  };
}



/**
 * Capacity Snapshot
 * 
 * Hourly capacity snapshot for reporting and analytics.
 */
export interface CapacitySnapshot {
  /** Snapshot ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** KTV ID */
  ktvId: string;

  /** Snapshot date */
  date: string;

  /** Hour of day (0-23) */
  hour: number;

  /** Total capacity (bookings) */
  totalCapacity: number;

  /** Bookings count */
  bookingsCount: number;

  /** Utilization percentage */
  utilizationPercentage: number;

  /** Buffer slots used */
  bufferSlotsUsed: number;

  /** Is peak hour? */
  isPeakHour: boolean;

  /** Timestamp */
  createdAt: string;
}

/**
 * Capacity Knowledge (for rule evaluation)
 */
export interface CapacityKnowledge {
  tenantId: string;
  ktvId: string;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  durationMinutes: number;
  'customer.tier': string;
  'ktv.maxDailyBookings': number;
  'ktv.maxConcurrentSessions': number;
  'ktv.minBreakMinutes': number;
  'ktv.currentBookings': number;
  'ktv.utilizationPercentage': number;
  'ktv.isPeakHour': boolean;
  'tenant.bufferPercentage': number;
  'tenant.enforceBreakTimes': boolean;
  hasTimeOverlap: boolean;
  hasBreakTimeViolation: boolean;
  exceedsDailyLimit: boolean;
  exceedsConcurrentLimit: boolean;
  isWithinWorkingHours: boolean;
  [key: string]: unknown;
}

/**
 * Capacity evaluation options
 */
export interface CapacityEvaluationOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Check capacity only (don't suggest alternatives) */
  checkOnly?: boolean;

  /** Include capacity snapshots in response */
  includeSnapshots?: boolean;

  /** Generate capacity snapshot after check */
  generateSnapshot?: boolean;
}


// ============================================================================
// CONFLICT DETECTION PROVIDER TYPES (Task 2)
// ============================================================================

/**
 * Conflict Detection Input
 * 
 * Context required to detect conflicts for booking request.
 */
export interface ConflictDetectionInput {
  /** Tenant identifier */
  tenantId: string;

  /** Booking request details */
  booking: {
    /** Customer identifier */
    customerId: string;
    /** KTV identifier (if assigned) */
    ktvId?: string;
    /** Room/bed identifier (if applicable) */
    roomId?: string;
    /** Equipment IDs required (if applicable) */
    equipmentIds?: string[];
    /** Package ID (if part of package) */
    packageId?: string;
    /** Session number in package (if applicable) */
    sessionNumber?: number;
    /** Requested date (ISO format YYYY-MM-DD) */
    requestedDate: string;
    /** Requested start time (HH:mm format) */
    requestedStartTime: string;
    /** Requested end time (HH:mm format) */
    requestedEndTime: string;
    /** Expected duration (minutes) */
    durationMinutes: number;
    /** Service type */
    serviceType: string;
    /** Customer tier (for VIP slot protection) */
    customerTier: 'vip' | 'loyal' | 'new';
  };

  /** Existing bookings to check against */
  existingBookings: {
    /** Customer's existing bookings */
    customerBookings: Array<{
      id: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
    }>;

    /** Room/bed bookings (if applicable) */
    roomBookings?: Array<{
      id: string;
      roomId: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
    }>;

    /** Equipment bookings (if applicable) */
    equipmentBookings?: Array<{
      id: string;
      equipmentId: string;
      date: string;
      startTime: string;
      endTime: string;
      status: string;
    }>;

    /** Package session history (if part of package) */
    packageSessions?: Array<{
      id: string;
      packageId: string;
      sessionNumber: number;
      date: string;
      status: string;
    }>;

    /** VIP slot reservations (if VIP slot protection enabled) */
    vipSlots?: Array<{
      date: string;
      startTime: string;
      endTime: string;
      reservedFor: 'vip' | 'any';
    }>;
  };

  /** Conflict detection configuration */
  config: {
    /** Enable customer double-booking detection */
    detectCustomerDoubleBooking: boolean;
    /** Enable room/bed conflict detection */
    detectRoomConflicts: boolean;
    /** Enable equipment conflict detection */
    detectEquipmentConflicts: boolean;
    /** Enable package sequence validation */
    validatePackageSequence: boolean;
    /** Enable VIP slot protection */
    enforceVipSlotProtection: boolean;
    /** Allow override for emergency bookings */
    allowEmergencyOverride: boolean;
  };

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Conflict Detection Output
 * 
 * Result of conflict detection check.
 */
export interface ConflictDetectionOutput {
  /** Were conflicts detected? */
  hasConflicts: boolean;

  /** Success status (false if conflicts detected) */
  success: boolean;

  /** List of detected conflicts */
  conflicts: ConflictDetail[];

  /** Conflict severity */
  severity: 'blocking' | 'warning' | 'info';

  /** Conflict resolution suggestions */
  suggestions: ConflictResolution[];

  /** Matched conflict rules */
  matchedRules: string[];

  /** Execution time (ms) */
  executionTime: number;

  /** Provider identifier */
  provider: 'ConflictDetectionProvider';
}

/**
 * Conflict Detail
 * 
 * Detailed information about a specific conflict.
 */
export interface ConflictDetail {
  /** Conflict type */
  type: ConflictType;

  /** Conflict severity */
  severity: 'blocking' | 'warning' | 'info';

  /** Human-readable conflict message */
  message: string;

  /** Conflicting resource details */
  resource: {
    /** Resource type (customer, room, equipment, package, vip_slot) */
    type: 'customer' | 'room' | 'equipment' | 'package' | 'vip_slot';
    /** Resource identifier */
    id: string;
    /** Resource name/description */
    name: string;
  };

  /** Conflicting booking details */
  conflictingBooking: {
    /** Booking ID causing conflict */
    id: string;
    /** Date */
    date: string;
    /** Start time */
    startTime: string;
    /** End time */
    endTime: string;
    /** Status */
    status: string;
  };

  /** Rule that detected this conflict */
  rule: string;

  /** Additional conflict context */
  context?: Record<string, unknown>;
}

/**
 * Conflict Type Enum
 * 
 * All possible conflict types.
 */
export type ConflictType =
  | 'customer_double_booking'  // Customer has overlapping booking
  | 'room_unavailable'         // Room/bed already booked
  | 'equipment_unavailable'    // Equipment already in use
  | 'package_sequence_violation' // Wrong session order in package
  | 'vip_slot_protected'       // Non-VIP trying to book VIP slot
  | 'time_slot_blocked';       // Slot blocked for maintenance/etc

/**
 * Conflict Resolution
 * 
 * Suggested resolution for detected conflict.
 */
export interface ConflictResolution {
  /** Resolution type */
  type: 'reschedule' | 'change_resource' | 'cancel_conflicting' | 'override';

  /** Human-readable suggestion */
  message: string;

  /** Specific resolution action */
  action: {
    /** Action type */
    type: 'reschedule' | 'change_ktv' | 'change_room' | 'change_equipment' | 'override';

    /** Action parameters */
    parameters?: {
      /** Suggested new date (YYYY-MM-DD) */
      newDate?: string;
      /** Suggested new time (HH:mm) */
      newTime?: string;
      /** Alternative KTV ID */
      alternativeKtvId?: string;
      /** Alternative room ID */
      alternativeRoomId?: string;
      /** Alternative equipment ID */
      alternativeEquipmentId?: string;
      /** Override reason */
      overrideReason?: string;
    };
  };

  /** Priority (1-10, higher = more recommended) */
  priority: number;

  /** Is this an automatic suggestion? */
  automatic: boolean;

  /** Additional resolution context */
  context?: Record<string, unknown>;
}

/**
 * Conflict Detection Knowledge (for rule evaluation)
 */
export interface ConflictDetectionKnowledge {
  tenantId: string;
  customerId: string;
  ktvId?: string;
  roomId?: string;
  equipmentIds?: string[];
  packageId?: string;
  sessionNumber?: number;
  requestedDate: string;
  requestedStartTime: string;
  requestedEndTime: string;
  durationMinutes: number;
  serviceType: string;
  'customer.tier': string;
  'config.detectCustomerDoubleBooking': boolean;
  'config.detectRoomConflicts': boolean;
  'config.detectEquipmentConflicts': boolean;
  'config.validatePackageSequence': boolean;
  'config.enforceVipSlotProtection': boolean;
  [key: string]: unknown;
}

/**
 * Conflict Detection Evaluation Options
 */
export interface ConflictDetectionEvaluationOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Allow emergency override (skip blocking conflicts) */
  emergencyOverride?: boolean;

  /** Return all suggestions (not just top recommendations) */
  allSuggestions?: boolean;

  /** Dry run (don't modify state) */
  dryRun?: boolean;
}

// ============================================================================
// WAITLIST MANAGEMENT PROVIDER TYPES (Phase 4)
// ============================================================================

/**
 * Waitlist Management Input
 * 
 * Context required to add customer to waitlist and manage waitlist entries.
 */
export interface WaitlistManagementInput {
  /** Tenant identifier */
  tenantId: string;

  /** Customer information */
  customer: {
    /** Customer identifier */
    id: string;
    /** Customer name */
    name: string;
    /** Customer tier (affects priority) */
    tier: 'vip' | 'loyal' | 'new';
    /** Customer email (for notifications) */
    email: string;
    /** Customer phone (for notifications) */
    phone: string;
    /** Contact preferences */
    contactPreferences: {
      /** Preferred notification channel */
      preferredChannel: 'email' | 'sms' | 'app';
      /** Accepts marketing communications */
      acceptsMarketing: boolean;
    };
  };

  /** Booking request details */
  booking: {
    /** Service/package identifier */
    serviceId: string;
    /** Service name */
    serviceName: string;
    /** Service type */
    serviceType: string;
    /** Booking value (for priority calculation) */
    bookingValue: number;
    /** Preferred KTV ID (if any) */
    preferredKtvId?: string;
    /** Preferred date (ISO format YYYY-MM-DD) */
    preferredDate: string;
    /** Preferred start time (HH:mm format) */
    preferredStartTime: string;
    /** Expected duration (minutes) */
    durationMinutes: number;
    /** Flexible with timing? */
    isFlexible: boolean;
    /** Alternative times acceptable (if flexible) */
    alternativeTimes?: Array<{
      date: string;
      startTime: string;
    }>;
  };

  /** Waitlist configuration */
  config: {
    /** Enable priority-based ranking */
    enablePriorityRanking: boolean;
    /** Enable auto-notification on slot availability */
    enableAutoNotification: boolean;
    /** Slot reservation duration (minutes) */
    slotReservationMinutes: number;
    /** Waitlist expiry duration (hours) */
    waitlistExpiryHours: number;
    /** Maximum waitlist size per time slot */
    maxWaitlistSize: number;
  };

  /** Existing waitlist entries for requested slot */
  existingWaitlist: WaitlistEntry[];

  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Waitlist Management Output
 * 
 * Result of waitlist management decision.
 */
export interface WaitlistManagementOutput {
  /** Was operation successful? */
  success: boolean;

  /** Operation type performed */
  operation: 'added' | 'updated' | 'removed' | 'notified' | 'expired' | 'rejected';

  /** Waitlist entry details */
  entry: {
    /** Waitlist entry ID */
    id: string;
    /** Customer ID */
    customerId: string;
    /** Booking request ID */
    bookingRequestId: string;
    /** Priority score (0-100) */
    priorityScore: number;
    /** Position in waitlist (1-based) */
    position: number;
    /** Estimated wait time (minutes) */
    estimatedWaitMinutes: number;
    /** Entry status */
    status: 'active' | 'notified' | 'reserved' | 'expired' | 'converted';
    /** Created at timestamp */
    createdAt: string;
    /** Expires at timestamp */
    expiresAt: string;
  };

  /** Reason for result */
  reason: string;

  /** Matched rules */
  matchedRules: string[];

  /** Notification details (if notification sent) */
  notification?: {
    /** Was notification sent? */
    sent: boolean;
    /** Notification channel used */
    channel: 'email' | 'sms' | 'app';
    /** Notification message */
    message: string;
    /** Sent at timestamp */
    sentAt: string;
  };

  /** Waitlist statistics */
  stats: {
    /** Total entries in waitlist */
    totalEntries: number;
    /** Current position */
    currentPosition: number;
    /** Average wait time (minutes) */
    avgWaitMinutes: number;
    /** Waitlist capacity remaining */
    capacityRemaining: number;
  };

  /** Execution time (ms) */
  executionTime: number;

  /** Provider identifier */
  provider: 'WaitlistManagementProvider';

  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Waitlist Entry
 * 
 * Represents a single waitlist entry.
 */
export interface WaitlistEntry {
  /** Entry ID */
  id: string;

  /** Tenant ID */
  tenantId: string;

  /** Customer ID */
  customerId: string;

  /** Customer name */
  customerName: string;

  /** Customer tier */
  customerTier: 'vip' | 'loyal' | 'new';

  /** Booking request ID */
  bookingRequestId: string;

  /** Service ID */
  serviceId: string;

  /** Service name */
  serviceName: string;

  /** Booking value */
  bookingValue: number;

  /** Preferred date */
  preferredDate: string;

  /** Preferred start time */
  preferredStartTime: string;

  /** Duration (minutes) */
  durationMinutes: number;

  /** Priority score (0-100) */
  priorityScore: number;

  /** Position in waitlist (1-based) */
  position: number;

  /** Wait time so far (minutes) */
  waitMinutes: number;

  /** Entry status */
  status: 'active' | 'notified' | 'reserved' | 'expired' | 'converted';

  /** Notification status */
  notificationStatus?: {
    /** Times notified */
    timesNotified: number;
    /** Last notified at */
    lastNotifiedAt: string;
    /** Notification response */
    response?: 'accepted' | 'declined' | 'no_response';
  };

  /** Slot reservation (if notified) */
  slotReservation?: {
    /** Reservation start time */
    reservedAt: string;
    /** Reservation expires at */
    expiresAt: string;
    /** Slot details */
    slot: {
      date: string;
      startTime: string;
      ktvId?: string;
    };
  };

  /** Preferred KTV ID (if any) */
  preferredKtvId?: string;

  /** Created at timestamp */
  createdAt: string;

  /** Expires at timestamp */
  expiresAt: string;

  /** Last updated at */
  updatedAt: string;
}

/**
 * Waitlist Priority Factors
 * 
 * Factors contributing to priority calculation.
 */
export interface WaitlistPriorityFactors {
  /** Base priority by customer tier */
  tierScore: number; // VIP: 40, Loyal: 25, New: 10

  /** Priority by booking value */
  valueScore: number; // 0-30 based on booking value

  /** Priority by wait time */
  waitTimeScore: number; // 0-20 based on minutes waiting

  /** Bonus for flexibility */
  flexibilityBonus: number; // 0-10 if customer is flexible with timing

  /** Total priority score */
  totalScore: number; // Sum of all factors (0-100)
}

/**
 * Waitlist Notification
 * 
 * Notification details for slot availability.
 */
export interface WaitlistNotification {
  /** Notification ID */
  id: string;

  /** Waitlist entry ID */
  waitlistEntryId: string;

  /** Customer ID */
  customerId: string;

  /** Notification channel */
  channel: 'email' | 'sms' | 'app';

  /** Notification type */
  type: 'slot_available' | 'position_updated' | 'expiring_soon' | 'expired';

  /** Notification message */
  message: string;

  /** Available slot details (if slot_available) */
  slot?: {
    date: string;
    startTime: string;
    ktvId?: string;
    reservationExpiresAt: string;
  };

  /** Notification status */
  status: 'pending' | 'sent' | 'failed' | 'read';

  /** Sent at timestamp */
  sentAt?: string;

  /** Read at timestamp */
  readAt?: string;

  /** Customer response */
  response?: {
    /** Response type */
    type: 'accepted' | 'declined';
    /** Responded at */
    respondedAt: string;
    /** Decline reason (if declined) */
    reason?: string;
  };
}

/**
 * Waitlist Slot Match
 * 
 * Details of slot that became available.
 */
export interface WaitlistSlotMatch {
  /** Slot date */
  date: string;

  /** Slot start time */
  startTime: string;

  /** Slot duration (minutes) */
  durationMinutes: number;

  /** KTV ID (if specific KTV) */
  ktvId?: string;

  /** KTV name */
  ktvName?: string;

  /** Match score (0-100) */
  matchScore: number;

  /** Match factors */
  matchFactors: {
    /** Matches preferred date? */
    matchesPreferredDate: boolean;
    /** Matches preferred time? */
    matchesPreferredTime: boolean;
    /** Matches preferred KTV? */
    matchesPreferredKtv: boolean;
    /** Time difference (minutes from preferred) */
    timeDifference: number;
  };

  /** Slot became available at */
  availableAt: string;
}

/**
 * Waitlist Knowledge (for rule evaluation)
 */
export interface WaitlistKnowledge {
  tenantId: string;
  customerId: string;
  'customer.tier': string;
  'customer.name': string;
  serviceId: string;
  serviceName: string;
  bookingValue: number;
  preferredDate: string;
  preferredStartTime: string;
  durationMinutes: number;
  isFlexible: boolean;
  'config.enablePriorityRanking': boolean;
  'config.enableAutoNotification': boolean;
  'config.maxWaitlistSize': number;
  'config.waitlistExpiryHours': number;
  currentWaitlistSize: number;
  waitMinutes: number;
  priorityScore: number;
  position: number;
  isWaitlistFull: boolean;
  isExpired: boolean;
  [key: string]: unknown;
}

/**
 * Waitlist Evaluation Options
 */
export interface WaitlistEvaluationOptions {
  /** Enable debug logging */
  debug?: boolean;

  /** Skip notification (just add to waitlist) */
  skipNotification?: boolean;

  /** Force priority override */
  forcePriority?: number;

  /** Dry run (don't modify state) */
  dryRun?: boolean;

  /** Include detailed priority breakdown */
  includeDetailedBreakdown?: boolean;
}

/**
 * Waitlist Statistics
 * 
 * Aggregated waitlist metrics for reporting.
 */
export interface WaitlistStatistics {
  /** Total entries currently in waitlist */
  totalEntries: number;

  /** Entries by status */
  entriesByStatus: {
    active: number;
    notified: number;
    reserved: number;
    expired: number;
    converted: number;
  };

  /** Average wait time (minutes) */
  avgWaitMinutes: number;

  /** Median wait time (minutes) */
  medianWaitMinutes: number;

  /** Max wait time (minutes) */
  maxWaitMinutes: number;

  /** Conversion rate (converted / total) */
  conversionRate: number;

  /** Average position in queue */
  avgPosition: number;

  /** Expiry rate (expired / total) */
  expiryRate: number;

  /** Most popular time slots */
  popularTimeSlots: Array<{
    date: string;
    startTime: string;
    entriesCount: number;
  }>;

  /** Entries by customer tier */
  entriesByTier: {
    vip: number;
    loyal: number;
    new: number;
  };

  /** Period start */
  periodStart: string;

  /** Period end */
  periodEnd: string;

  /** Last updated */
  lastUpdated: string;
}
