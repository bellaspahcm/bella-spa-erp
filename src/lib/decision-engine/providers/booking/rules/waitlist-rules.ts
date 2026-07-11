/**
 * Waitlist Management Rules
 * 
 * Business rules for intelligent waitlist management:
 * - Priority calculation (customer tier, booking value, wait time)
 * - Auto-notification triggers
 * - Expiry management
 * - Slot reservation logic
 * - Waitlist capacity management
 * - Preferred time matching
 * 
 * @module decision-engine/providers/booking/rules
 */

/** Local Rule type for DSL-style waitlist management rules */
interface Rule {
  id: string;
  name: string;
  description?: string;
  priority: number;
  conditions: Array<{ field: string; operator: string; value: unknown }>;
  actions: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}


/**
 * Rule 1: Calculate Priority Score
 * 
 * Calculate waitlist priority based on:
 * - Customer tier (VIP: 40pts, Loyal: 25pts, New: 10pts)
 * - Booking value (0-30pts based on value)
 * - Wait time (0-20pts, increases over time)
 * - Flexibility bonus (0-10pts if customer flexible)
 * 
 * Total: 0-100 points
 */
export const calculatePriorityScore: Rule = {
  id: 'waitlist-priority-calculation',
  name: 'Calculate Waitlist Priority Score',
  description: 'Calculate priority score based on customer tier, booking value, wait time, and flexibility',
  priority: 100, // Highest priority rule
  conditions: [
    {
      field: 'customer.tier',
      operator: 'exists',
      value: true,
    },
    {
      field: 'bookingValue',
      operator: 'exists',
      value: true,
    },
  ],
  actions: [
    {
      type: 'calculate',
      field: 'priorityScore',
      calculation: {
        type: 'weighted_sum',
        factors: [
          {
            name: 'tierScore',
            weight: 1.0,
            formula: "customer.tier === 'vip' ? 40 : customer.tier === 'loyal' ? 25 : 10",
          },
          {
            name: 'valueScore',
            weight: 1.0,
            formula: 'Math.min(30, (bookingValue / 10000) * 30)', // Max 30pts for 10M VND booking
          },
          {
            name: 'waitTimeScore',
            weight: 1.0,
            formula: 'Math.min(20, (waitMinutes / 60) * 20)', // Max 20pts after 1 hour
          },
          {
            name: 'flexibilityBonus',
            weight: 1.0,
            formula: 'isFlexible ? 10 : 0',
          },
        ],
      },
    },
  ],
  metadata: {
    category: 'priority',
    businessImpact: 'Ensures fair and value-based waitlist ordering',
  },
};

/**
 * Rule 2: VIP Fast-Track Priority
 * 
 * Give VIP customers extra priority boost for fast-track service.
 * Additional +10 points bonus.
 */
export const vipFastTrack: Rule = {
  id: 'waitlist-vip-fast-track',
  name: 'VIP Fast-Track Priority',
  description: 'Give VIP customers additional priority boost',
  priority: 95,
  conditions: [
    {
      field: 'customer.tier',
      operator: 'equals',
      value: 'vip',
    },
    {
      field: 'priorityScore',
      operator: 'exists',
      value: true,
    },
  ],
  actions: [
    {
      type: 'modify',
      field: 'priorityScore',
      operation: 'add',
      value: 10,
    },
    {
      type: 'set_metadata',
      field: 'fastTrack',
      value: true,
    },
  ],
  metadata: {
    category: 'priority',
    businessImpact: 'Improves VIP customer experience and retention',
  },
};

/**
 * Rule 3: Auto-Notify on Slot Available
 * 
 * Automatically notify top-priority customers when slot becomes available.
 * Only notify if:
 * - Auto-notification enabled
 * - Entry status is 'active'
 * - Entry not expired
 * - Customer position <= 3 (top 3 in queue)
 */
export const autoNotifyOnSlotAvailable: Rule = {
  id: 'waitlist-auto-notify',
  name: 'Auto-Notify on Slot Available',
  description: 'Automatically notify top customers when slot becomes available',
  priority: 90,
  conditions: [
    {
      field: 'config.enableAutoNotification',
      operator: 'equals',
      value: true,
    },
    {
      field: 'position',
      operator: 'lte',
      value: 3, // Only top 3
    },
    {
      field: 'status',
      operator: 'equals',
      value: 'active',
    },
    {
      field: 'isExpired',
      operator: 'equals',
      value: false,
    },
  ],
  actions: [
    {
      type: 'trigger',
      action: 'send_notification',
      parameters: {
        channel: '{{customer.contactPreferences.preferredChannel}}',
        type: 'slot_available',
        urgent: '{{position === 1}}',
      },
    },
    {
      type: 'update_status',
      field: 'status',
      value: 'notified',
    },
  ],
  metadata: {
    category: 'notification',
    businessImpact: 'Increases conversion rate by proactive customer engagement',
  },
};

/**
 * Rule 4: Expire Old Waitlist Entries
 * 
 * Automatically expire waitlist entries that exceed expiry duration.
 * Default: 24 hours (configurable via config.waitlistExpiryHours)
 */
export const expireOldEntries: Rule = {
  id: 'waitlist-expire-old',
  name: 'Expire Old Waitlist Entries',
  description: 'Remove expired waitlist entries to free up capacity',
  priority: 85,
  conditions: [
    {
      field: 'waitMinutes',
      operator: 'gte',
      value: '{{config.waitlistExpiryHours * 60}}', // Convert hours to minutes
    },
    {
      field: 'status',
      operator: 'in',
      value: ['active', 'notified'],
    },
  ],
  actions: [
    {
      type: 'update_status',
      field: 'status',
      value: 'expired',
    },
    {
      type: 'trigger',
      action: 'send_notification',
      parameters: {
        channel: '{{customer.contactPreferences.preferredChannel}}',
        type: 'expired',
        message: 'Your waitlist entry has expired. Please book again if still interested.',
      },
    },
    {
      type: 'remove_from_waitlist',
    },
  ],
  metadata: {
    category: 'cleanup',
    businessImpact: 'Maintains waitlist accuracy and prevents stale entries',
  },
};

/**
 * Rule 5: Reserve Slot for Notified Customer
 * 
 * Reserve available slot for customer who was notified.
 * Reservation duration: configurable (default 30 minutes)
 * After reservation expires, offer to next customer in queue.
 */
export const reserveSlotOnNotification: Rule = {
  id: 'waitlist-reserve-slot',
  name: 'Reserve Slot on Notification',
  description: 'Temporarily reserve slot when customer is notified',
  priority: 80,
  conditions: [
    {
      field: 'status',
      operator: 'equals',
      value: 'notified',
    },
    {
      field: 'config.slotReservationMinutes',
      operator: 'gt',
      value: 0,
    },
  ],
  actions: [
    {
      type: 'update_status',
      field: 'status',
      value: 'reserved',
    },
    {
      type: 'set_metadata',
      field: 'slotReservation',
      value: {
        reservedAt: '{{now}}',
        expiresAt: '{{now + config.slotReservationMinutes * 60000}}', // milliseconds
      },
    },
    {
      type: 'block_slot',
      duration: '{{config.slotReservationMinutes}}',
    },
  ],
  metadata: {
    category: 'reservation',
    businessImpact: 'Prevents double-booking and gives customer time to respond',
  },
};

/**
 * Rule 6: Enforce Waitlist Capacity Limit
 * 
 * Prevent adding more entries when waitlist is full.
 * Max size: configurable per time slot (default: 10 entries)
 */
export const enforceWaitlistCapacity: Rule = {
  id: 'waitlist-capacity-limit',
  name: 'Enforce Waitlist Capacity Limit',
  description: 'Reject new entries when waitlist is full',
  priority: 100, // High priority - check early
  conditions: [
    {
      field: 'currentWaitlistSize',
      operator: 'gte',
      value: '{{config.maxWaitlistSize}}',
    },
  ],
  actions: [
    {
      type: 'reject',
      reason: 'Waitlist is full for requested time slot',
      suggestion: 'Try alternative time slots or check back later',
    },
  ],
  metadata: {
    category: 'capacity',
    businessImpact: 'Prevents oversized waitlists and manages customer expectations',
  },
};

/**
 * Rule 7: Preferred Time Matching Bonus
 * 
 * Give priority bonus to customers whose preferred time matches available slot.
 * Increases conversion likelihood.
 */
export const preferredTimeMatchBonus: Rule = {
  id: 'waitlist-preferred-time-match',
  name: 'Preferred Time Matching Bonus',
  description: 'Boost priority when preferred time matches available slot',
  priority: 75,
  conditions: [
    {
      field: 'preferredDate',
      operator: 'exists',
      value: true,
    },
    {
      field: 'preferredStartTime',
      operator: 'exists',
      value: true,
    },
  ],
  actions: [
    {
      type: 'calculate',
      field: 'timeMatchScore',
      calculation: {
        type: 'similarity',
        formula: `
          const preferredMinutes = timeToMinutes(preferredStartTime);
          const slotMinutes = timeToMinutes(availableSlot.startTime);
          const diff = Math.abs(preferredMinutes - slotMinutes);
          return diff === 0 ? 100 : Math.max(0, 100 - (diff / 30) * 20); // 100 for exact match, -20 per 30 min
        `,
      },
    },
    {
      type: 'modify',
      field: 'priorityScore',
      operation: 'add',
      value: '{{timeMatchScore * 0.15}}', // Max +15 points for perfect time match
    },
  ],
  metadata: {
    category: 'matching',
    businessImpact: 'Increases booking conversion by matching customer preferences',
  },
};

/**
 * Rule 8: High-Value Booking Priority
 * 
 * Give extra priority to high-value bookings (packages, VIP services).
 * Threshold: bookings > 5M VND get +5 bonus points.
 */
export const highValueBookingPriority: Rule = {
  id: 'waitlist-high-value-priority',
  name: 'High-Value Booking Priority',
  description: 'Boost priority for high-value bookings',
  priority: 70,
  conditions: [
    {
      field: 'bookingValue',
      operator: 'gte',
      value: 5000000, // 5M VND
    },
  ],
  actions: [
    {
      type: 'modify',
      field: 'priorityScore',
      operation: 'add',
      value: 5,
    },
    {
      type: 'set_metadata',
      field: 'highValue',
      value: true,
    },
  ],
  metadata: {
    category: 'priority',
    businessImpact: 'Prioritizes revenue-generating bookings',
  },
};

/**
 * Rule 9: Notify Before Expiry
 * 
 * Send reminder notification 2 hours before entry expires.
 * Gives customer last chance to respond.
 */
export const notifyBeforeExpiry: Rule = {
  id: 'waitlist-notify-before-expiry',
  name: 'Notify Before Expiry',
  description: 'Send reminder notification before entry expires',
  priority: 65,
  conditions: [
    {
      field: 'status',
      operator: 'in',
      value: ['active', 'notified'],
    },
    {
      field: 'waitMinutes',
      operator: 'gte',
      value: '{{(config.waitlistExpiryHours - 2) * 60}}', // 2 hours before expiry
    },
    {
      field: 'waitMinutes',
      operator: 'lt',
      value: '{{config.waitlistExpiryHours * 60}}',
    },
  ],
  actions: [
    {
      type: 'trigger',
      action: 'send_notification',
      parameters: {
        channel: '{{customer.contactPreferences.preferredChannel}}',
        type: 'expiring_soon',
        message: 'Your waitlist entry will expire in 2 hours. Please respond if still interested.',
      },
    },
  ],
  metadata: {
    category: 'notification',
    businessImpact: 'Reduces missed conversions by reminding customers',
  },
};

/**
 * Rule 10: Position Update Notification
 * 
 * Notify customers when they move up significantly in queue (e.g., into top 3).
 * Keeps customers engaged.
 */
export const positionUpdateNotification: Rule = {
  id: 'waitlist-position-update',
  name: 'Position Update Notification',
  description: 'Notify customers when they move into top positions',
  priority: 60,
  conditions: [
    {
      field: 'position',
      operator: 'lte',
      value: 3,
    },
    {
      field: 'previousPosition',
      operator: 'gt',
      value: 3,
    },
    {
      field: 'status',
      operator: 'equals',
      value: 'active',
    },
  ],
  actions: [
    {
      type: 'trigger',
      action: 'send_notification',
      parameters: {
        channel: '{{customer.contactPreferences.preferredChannel}}',
        type: 'position_updated',
        message: 'Good news! You are now #{{position}} in the waitlist.',
      },
    },
  ],
  metadata: {
    category: 'notification',
    businessImpact: 'Keeps customers engaged and informed',
  },
};

/**
 * All Waitlist Management Rules
 * 
 * Exported as array for easy consumption by WaitlistManagementProvider.
 */
export const waitlistRules: Rule[] = [
  calculatePriorityScore,
  vipFastTrack,
  autoNotifyOnSlotAvailable,
  expireOldEntries,
  reserveSlotOnNotification,
  enforceWaitlistCapacity,
  preferredTimeMatchBonus,
  highValueBookingPriority,
  notifyBeforeExpiry,
  positionUpdateNotification,
];

/**
 * Rule Categories for Organization
 */
export const waitlistRuleCategories = {
  priority: [
    calculatePriorityScore,
    vipFastTrack,
    highValueBookingPriority,
  ],
  notification: [
    autoNotifyOnSlotAvailable,
    notifyBeforeExpiry,
    positionUpdateNotification,
  ],
  cleanup: [
    expireOldEntries,
  ],
  reservation: [
    reserveSlotOnNotification,
  ],
  capacity: [
    enforceWaitlistCapacity,
  ],
  matching: [
    preferredTimeMatchBonus,
  ],
};

/**
 * Default Waitlist Configuration
 */
export const defaultWaitlistConfig = {
  enablePriorityRanking: true,
  enableAutoNotification: true,
  slotReservationMinutes: 30,
  waitlistExpiryHours: 24,
  maxWaitlistSize: 10,
  tierScores: {
    vip: 40,
    loyal: 25,
    new: 10,
  },
  valueScoreMax: 30,
  waitTimeScoreMax: 20,
  flexibilityBonus: 10,
};
