/**
 * Conflict Detection Rules
 * 
 * Rule definitions for cross-booking conflict detection.
 * 
 * Rule Categories:
 * 1. Customer Double-Booking (200-209)
 * 2. Room/Bed Conflicts (210-219)
 * 3. Equipment Conflicts (220-229)
 * 4. Package Sequence Violations (230-239)
 * 5. VIP Slot Protection (240-249)
 * 
 * @module decision-engine/providers/booking/rules
 */

/** Local Rule type for json-rules-engine style conflict detection rules */
interface Rule {
  id: string;
  name: string;
  description?: string;
  category?: string;
  priority?: number;
  enabled: boolean;
  conditions: Array<{ fact: string; operator: string; value: unknown }>;
  event: {
    type: string;
    params: Record<string, unknown>;
  };
}


// ============================================================================
// CATEGORY 1: CUSTOMER DOUBLE-BOOKING (200-209)
// ============================================================================

/**
 * Rule 200: Customer Cannot Have Overlapping Bookings
 * 
 * Prevents customer from booking multiple services at same time.
 * Severity: BLOCKING
 */
export const RULE_CUSTOMER_DOUBLE_BOOKING: Rule = {
  id: 'conflict-200-customer-double-booking',
  name: 'Customer Cannot Have Overlapping Bookings',
  description: 'Customer must not have overlapping bookings at the same time',
  category: 'conflict-detection',
  priority: 200,
  enabled: true,

  conditions: [
    {
      fact: 'config.detectCustomerDoubleBooking',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'existingCustomerBookings',
      operator: 'notEqual',
      value: [],
    },
  ],

  event: {
    type: 'conflict-detected',
    params: {
      conflictType: 'customer_double_booking',
      severity: 'blocking',
      message: 'Customer đã có lịch hẹn trùng thời gian',
    },
  },
};

/**
 * Rule 201: Detect Close Bookings (Warning)
 * 
 * Warn if customer books two services within 30 minutes (not overlapping).
 * Severity: WARNING
 */
export const RULE_CUSTOMER_CLOSE_BOOKINGS: Rule = {
  id: 'conflict-201-customer-close-bookings',
  name: 'Warn Customer About Close Bookings',
  description: 'Warn if customer has bookings within 30 minutes of each other',
  category: 'conflict-detection',
  priority: 201,
  enabled: true,

  conditions: [
    {
      fact: 'config.detectCustomerDoubleBooking',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'hasCloseBookings',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-warning',
    params: {
      conflictType: 'customer_double_booking',
      severity: 'warning',
      message: 'Customer có lịch hẹn gần nhau (trong vòng 30 phút)',
    },
  },
};

// ============================================================================
// CATEGORY 2: ROOM/BED CONFLICTS (210-219)
// ============================================================================

/**
 * Rule 210: Room Cannot Be Double-Booked
 * 
 * Prevents booking room/bed that's already occupied.
 * Severity: BLOCKING
 */
export const RULE_ROOM_CONFLICT: Rule = {
  id: 'conflict-210-room-double-booking',
  name: 'Room Cannot Be Double-Booked',
  description: 'Room/bed must be available at requested time',
  category: 'conflict-detection',
  priority: 210,
  enabled: true,

  conditions: [
    {
      fact: 'config.detectRoomConflicts',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'roomId',
      operator: 'notEqual',
      value: null,
    },
    {
      fact: 'hasRoomConflict',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-detected',
    params: {
      conflictType: 'room_unavailable',
      severity: 'blocking',
      message: 'Phòng/giường đã được đặt cho khung giờ này',
    },
  },
};

/**
 * Rule 211: Room Turnover Time
 * 
 * Enforce minimum turnover time between bookings (15 minutes for cleaning).
 * Severity: WARNING
 */
export const RULE_ROOM_TURNOVER: Rule = {
  id: 'conflict-211-room-turnover-time',
  name: 'Room Needs Turnover Time',
  description: 'Room requires 15-minute turnover time between bookings',
  category: 'conflict-detection',
  priority: 211,
  enabled: true,

  conditions: [
    {
      fact: 'config.detectRoomConflicts',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'roomId',
      operator: 'notEqual',
      value: null,
    },
    {
      fact: 'hasInsufficientTurnoverTime',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-warning',
    params: {
      conflictType: 'room_unavailable',
      severity: 'warning',
      message: 'Phòng cần thời gian dọn dẹp (15 phút) trước lịch hẹn tiếp theo',
    },
  },
};

// ============================================================================
// CATEGORY 3: EQUIPMENT CONFLICTS (220-229)
// ============================================================================

/**
 * Rule 220: Equipment Must Be Available
 * 
 * Prevents booking equipment that's already in use.
 * Severity: BLOCKING
 */
export const RULE_EQUIPMENT_CONFLICT: Rule = {
  id: 'conflict-220-equipment-unavailable',
  name: 'Equipment Must Be Available',
  description: 'Specialized equipment must not be in use at requested time',
  category: 'conflict-detection',
  priority: 220,
  enabled: true,

  conditions: [
    {
      fact: 'config.detectEquipmentConflicts',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'equipmentIds',
      operator: 'notEqual',
      value: [],
    },
    {
      fact: 'hasEquipmentConflict',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-detected',
    params: {
      conflictType: 'equipment_unavailable',
      severity: 'blocking',
      message: 'Thiết bị chuyên dụng đã được sử dụng cho khung giờ này',
    },
  },
};

/**
 * Rule 221: Equipment Maintenance Window
 * 
 * Block bookings during equipment maintenance schedules.
 * Severity: BLOCKING
 */
export const RULE_EQUIPMENT_MAINTENANCE: Rule = {
  id: 'conflict-221-equipment-maintenance',
  name: 'Equipment Maintenance Window',
  description: 'Equipment cannot be used during scheduled maintenance',
  category: 'conflict-detection',
  priority: 221,
  enabled: true,

  conditions: [
    {
      fact: 'config.detectEquipmentConflicts',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'equipmentIds',
      operator: 'notEqual',
      value: [],
    },
    {
      fact: 'isMaintenanceWindow',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-detected',
    params: {
      conflictType: 'equipment_unavailable',
      severity: 'blocking',
      message: 'Thiết bị đang trong thời gian bảo trì',
    },
  },
};

// ============================================================================
// CATEGORY 4: PACKAGE SEQUENCE VIOLATIONS (230-239)
// ============================================================================

/**
 * Rule 230: Package Sessions Must Follow Sequence
 * 
 * Ensures package sessions are completed in correct order.
 * Severity: BLOCKING
 */
export const RULE_PACKAGE_SEQUENCE: Rule = {
  id: 'conflict-230-package-sequence-violation',
  name: 'Package Sessions Must Follow Sequence',
  description: 'Package sessions must be completed in order (session 1 before 2, etc.)',
  category: 'conflict-detection',
  priority: 230,
  enabled: true,

  conditions: [
    {
      fact: 'config.validatePackageSequence',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'packageId',
      operator: 'notEqual',
      value: null,
    },
    {
      fact: 'hasSequenceViolation',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-detected',
    params: {
      conflictType: 'package_sequence_violation',
      severity: 'blocking',
      message: 'Phải hoàn thành các ca trước mới được đặt ca này',
    },
  },
};

/**
 * Rule 231: Package Session Minimum Interval
 * 
 * Enforce minimum time between package sessions (e.g., postpartum care).
 * Severity: WARNING
 */
export const RULE_PACKAGE_MIN_INTERVAL: Rule = {
  id: 'conflict-231-package-min-interval',
  name: 'Package Session Minimum Interval',
  description: 'Minimum 24 hours required between package sessions',
  category: 'conflict-detection',
  priority: 231,
  enabled: true,

  conditions: [
    {
      fact: 'config.validatePackageSequence',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'packageId',
      operator: 'notEqual',
      value: null,
    },
    {
      fact: 'hasInsufficientInterval',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-warning',
    params: {
      conflictType: 'package_sequence_violation',
      severity: 'warning',
      message: 'Nên cách ít nhất 24 giờ giữa các ca trong gói',
    },
  },
};

// ============================================================================
// CATEGORY 5: VIP SLOT PROTECTION (240-249)
// ============================================================================

/**
 * Rule 240: VIP Slots Reserved for VIP Customers
 * 
 * Prevents non-VIP customers from booking VIP-reserved slots.
 * Severity: BLOCKING
 */
export const RULE_VIP_SLOT_PROTECTION: Rule = {
  id: 'conflict-240-vip-slot-protected',
  name: 'VIP Slots Reserved for VIP Customers',
  description: 'Certain time slots are reserved for VIP customers only',
  category: 'conflict-detection',
  priority: 240,
  enabled: true,

  conditions: [
    {
      fact: 'config.enforceVipSlotProtection',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'customer.tier',
      operator: 'notEqual',
      value: 'vip',
    },
    {
      fact: 'isVipSlot',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-detected',
    params: {
      conflictType: 'vip_slot_protected',
      severity: 'blocking',
      message: 'Khung giờ này dành riêng cho khách hàng VIP',
    },
  },
};

/**
 * Rule 241: Prime Time Slot Priority
 * 
 * Give VIP customers priority for prime time slots (morning 8-11, evening 18-20).
 * Severity: WARNING
 */
export const RULE_PRIME_TIME_VIP_PRIORITY: Rule = {
  id: 'conflict-241-prime-time-vip-priority',
  name: 'Prime Time Slot Priority for VIP',
  description: 'VIP customers get priority for prime time slots',
  category: 'conflict-detection',
  priority: 241,
  enabled: true,

  conditions: [
    {
      fact: 'config.enforceVipSlotProtection',
      operator: 'equal',
      value: true,
    },
    {
      fact: 'customer.tier',
      operator: 'equal',
      value: 'new',
    },
    {
      fact: 'isPrimeTimeSlot',
      operator: 'equal',
      value: true,
    },
  ],

  event: {
    type: 'conflict-warning',
    params: {
      conflictType: 'vip_slot_protected',
      severity: 'warning',
      message: 'Khung giờ vàng này ưu tiên cho khách hàng VIP và Loyal',
    },
  },
};

// ============================================================================
// RULE EXPORT
// ============================================================================

/**
 * All Conflict Detection Rules
 * 
 * Organized by category and priority.
 */
export const CONFLICT_DETECTION_RULES: Rule[] = [
  // Customer Double-Booking (200-209)
  RULE_CUSTOMER_DOUBLE_BOOKING,        // 200 - BLOCKING
  RULE_CUSTOMER_CLOSE_BOOKINGS,        // 201 - WARNING

  // Room/Bed Conflicts (210-219)
  RULE_ROOM_CONFLICT,                  // 210 - BLOCKING
  RULE_ROOM_TURNOVER,                  // 211 - WARNING

  // Equipment Conflicts (220-229)
  RULE_EQUIPMENT_CONFLICT,             // 220 - BLOCKING
  RULE_EQUIPMENT_MAINTENANCE,          // 221 - BLOCKING

  // Package Sequence Violations (230-239)
  RULE_PACKAGE_SEQUENCE,               // 230 - BLOCKING
  RULE_PACKAGE_MIN_INTERVAL,           // 231 - WARNING

  // VIP Slot Protection (240-249)
  RULE_VIP_SLOT_PROTECTION,            // 240 - BLOCKING
  RULE_PRIME_TIME_VIP_PRIORITY,        // 241 - WARNING
];

/**
 * Get rules by category
 */
export function getConflictRulesByCategory(category: string): Rule[] {
  const categoryRanges: Record<string, [number, number]> = {
    customer: [200, 209],
    room: [210, 219],
    equipment: [220, 229],
    package: [230, 239],
    vip: [240, 249],
  };

  const range = categoryRanges[category];
  if (!range) return [];

  return CONFLICT_DETECTION_RULES.filter((rule) => {
    const priority = rule.priority || 0;
    return priority >= range[0] && priority <= range[1];
  });
}

/**
 * Get blocking rules only (severity: blocking)
 */
export function getBlockingConflictRules(): Rule[] {
  const blockingRuleIds = [
    'conflict-200-customer-double-booking',
    'conflict-210-room-double-booking',
    'conflict-220-equipment-unavailable',
    'conflict-221-equipment-maintenance',
    'conflict-230-package-sequence-violation',
    'conflict-240-vip-slot-protected',
  ];

  return CONFLICT_DETECTION_RULES.filter((rule) =>
    blockingRuleIds.includes(rule.id)
  );
}

/**
 * Get warning rules only (severity: warning)
 */
export function getWarningConflictRules(): Rule[] {
  const warningRuleIds = [
    'conflict-201-customer-close-bookings',
    'conflict-211-room-turnover-time',
    'conflict-231-package-min-interval',
    'conflict-241-prime-time-vip-priority',
  ];

  return CONFLICT_DETECTION_RULES.filter((rule) =>
    warningRuleIds.includes(rule.id)
  );
}
