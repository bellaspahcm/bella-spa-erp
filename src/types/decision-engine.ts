/**
 * Decision Engine Type Definitions
 * 
 * App-wide type exports and wrappers for Decision Engine providers.
 * Provides standardized interfaces for UI/API consumption.
 * 
 * @module types/decision-engine
 */

// ============================================================================
// RE-EXPORTS FROM DECISION ENGINE
// ============================================================================

export type {
  // Auto-Assignment Provider Types
  AutoAssignmentInput,
  AutoAssignmentOutput,
  KtvCandidate,
  AssignmentScoreBreakdown,
  AutoAssignmentKnowledge,
  AssignmentEvaluationOptions,

  // Capacity Management Provider Types
  CapacityCheckInput,
  CapacityCheckOutput,
  CapacityConflict,
  CapacitySnapshot,
  CapacityKnowledge,
  CapacityEvaluationOptions,
} from '@/lib/decision-engine/providers/booking/types';

// ============================================================================
// APP-SPECIFIC WRAPPERS
// ============================================================================

/**
 * Booking Capacity Check Request
 * 
 * Simplified interface for checking booking capacity from UI/API.
 * Maps to CapacityCheckInput with proper data fetching.
 */
export interface BookingCapacityCheckRequest {
  /** Tenant identifier */
  tenantId: string;

  /** KTV identifier */
  ktvId: string;

  /** Requested date (YYYY-MM-DD) */
  requestedDate: string;

  /** Requested start time (HH:mm) */
  requestedStartTime: string;

  /** Requested end time (HH:mm) */
  requestedEndTime: string;

  /** Duration in minutes */
  durationMinutes: number;

  /** Customer tier (for buffer slot priority) */
  customerTier: 'vip' | 'loyal' | 'new';

  /** Service type (for specialization matching) */
  serviceType: string;
}

/**
 * Booking Capacity Check Response
 * 
 * Simplified interface for capacity check results.
 * Used by UI components to display availability status.
 */
export interface BookingCapacityCheckResponse {
  /** Is capacity available? */
  available: boolean;

  /** Capacity details */
  capacityDetails: {
    /** Current number of bookings */
    currentBookings: number;
    /** Maximum allowed bookings */
    maxBookings: number;
    /** Utilization percentage (0-100) */
    utilizationPercentage: number;
    /** Buffer slots currently used */
    bufferSlotsUsed: number;
    /** Buffer slots still available */
    bufferSlotsAvailable: number;
    /** Is this during peak hours? */
    isPeakHour: boolean;
  };

  /** Conflicts detected (if any) */
  conflicts?: Array<{
    /** Conflict type */
    type: 'time_overlap' | 'concurrent_limit' | 'break_time_violation' | 'daily_limit' | 'outside_working_hours';
    /** Human-readable reason */
    reason: string;
    /** Conflicting booking details (if applicable) */
    conflictingBooking?: {
      id: string;
      startTime: string;
      endTime: string;
    };
  }>;

  /** Alternative time suggestions (if conflicts detected) */
  alternatives?: Array<{
    /** Suggested date */
    suggestedDate: string;
    /** Suggested time (HH:mm) */
    suggestedTime: string;
    /** Reason for this suggestion */
    reason: string;
  }>;

  /** Execution time (milliseconds) */
  executionTime: number;
}

/**
 * KTV Auto-Assignment Request
 * 
 * Simplified interface for auto-assigning KTV from UI/API.
 * Maps to AutoAssignmentInput with proper data fetching.
 */
export interface KtvAutoAssignmentRequest {
  /** Tenant identifier */
  tenantId: string;

  /** Customer identifier */
  customerId: string;

  /** Service/package identifier */
  serviceId: string;

  /** Service type (for specialization matching) */
  serviceType: string;

  /** Requested date (YYYY-MM-DD) */
  requestedDate: string;

  /** Requested start time (HH:mm) */
  requestedStartTime: string;

  /** Duration in minutes */
  durationMinutes: number;

  /** Customer tier (affects minimum rating requirement) */
  customerTier: 'vip' | 'loyal' | 'new';

  /** Preferred KTV ID (optional - gets priority in scoring) */
  preferredKtvId?: string;

  /** Excluded KTV IDs (optional - won't be considered) */
  excludedKtvIds?: string[];

  /** Required skills (optional - must have all) */
  requiredSkills?: string[];

  /** Minimum rating requirement (optional - overrides tier default) */
  minRating?: number;
}

/**
 * KTV Auto-Assignment Response
 * 
 * Simplified interface for auto-assignment results.
 * Used by UI components to display assignment suggestion.
 */
export interface KtvAutoAssignmentResponse {
  /** Assigned KTV ID (null if no suitable KTV found) */
  assignedKtvId: string | null;

  /** Assigned KTV name (for display) */
  assignedKtvName?: string;

  /** Assignment confidence score (0-1) */
  confidence: number;

  /** Human-readable reason for assignment */
  reason: string;

  /** Alternative KTV suggestions (ordered by score) */
  alternatives?: Array<{
    /** KTV identifier */
    ktvId: string;
    /** KTV name (for display) */
    ktvName: string;
    /** Assignment score (0-100) */
    score: number;
    /** Reason for this score */
    reason: string;
  }>;

  /** Execution time (milliseconds) */
  executionTime: number;
}

/**
 * Capacity Status (for Timeline UI)
 * 
 * Real-time capacity status for a specific time slot.
 * Used by timeline grid cells to show availability indicators.
 */
export interface CapacityStatus {
  /** Is capacity available for new booking? */
  available: boolean;

  /** Utilization percentage (0-100) */
  utilization: number;

  /** Number of current bookings */
  currentBookings: number;

  /** Maximum allowed bookings */
  maxBookings: number;

  /** Is this during peak hours? */
  isPeakHour: boolean;

  /** Buffer slots used */
  bufferSlotsUsed: number;

  /** Status color for UI (green/yellow/red) */
  statusColor: 'green' | 'yellow' | 'red';

  /** Tooltip message for hover */
  tooltipMessage: string;
}

/**
 * Helper: Calculate capacity status color
 * 
 * @param utilization - Utilization percentage (0-100)
 * @returns Color indicator
 */
export function getCapacityStatusColor(utilization: number): 'green' | 'yellow' | 'red' {
  if (utilization >= 90) return 'red';
  if (utilization >= 70) return 'yellow';
  return 'green';
}

/**
 * Helper: Format capacity tooltip message
 * 
 * @param status - Capacity status
 * @returns Formatted tooltip message
 */
export function formatCapacityTooltip(status: Omit<CapacityStatus, 'tooltipMessage' | 'statusColor'>): string {
  const lines: string[] = [];

  lines.push(`Đang sử dụng: ${status.currentBookings}/${status.maxBookings} ca`);
  lines.push(`Tỷ lệ sử dụng: ${status.utilization}%`);

  if (status.isPeakHour) {
    lines.push('⚠️ Giờ cao điểm');
  }

  if (status.bufferSlotsUsed > 0) {
    lines.push(`Buffer đã dùng: ${status.bufferSlotsUsed}`);
  }

  if (!status.available) {
    lines.push('❌ Không còn chỗ');
  } else if (status.utilization >= 80) {
    lines.push('⚠️ Sắp hết chỗ');
  } else {
    lines.push('✅ Còn chỗ');
  }

  return lines.join('\n');
}

/**
 * Booking Validation Result
 * 
 * Combined result from capacity check and auto-assignment.
 * Used by booking creation flow to determine if booking can proceed.
 */
export interface BookingValidationResult {
  /** Can booking proceed? */
  canProceed: boolean;

  /** Capacity check result */
  capacity: {
    available: boolean;
    conflicts?: Array<{
      type: string;
      reason: string;
    }>;
    alternatives?: Array<{
      suggestedDate: string;
      suggestedTime: string;
      reason: string;
    }>;
  };

  /** Auto-assignment result (if applicable) */
  assignment?: {
    assignedKtvId: string;
    assignedKtvName: string;
    confidence: number;
    reason: string;
    alternatives?: Array<{
      ktvId: string;
      ktvName: string;
      score: number;
    }>;
  };

  /** Overall validation message */
  message: string;

  /** Validation type (for UI rendering) */
  type: 'success' | 'warning' | 'error';
}

/**
 * Decision Engine Configuration
 * 
 * Configuration for Decision Engine features.
 * Stored in tenant settings or environment variables.
 */
export interface DecisionEngineConfig {
  /** Enable capacity management checks */
  enableCapacityCheck: boolean;

  /** Enable auto-assignment suggestions */
  enableAutoAssignment: boolean;

  /** Enable real-time capacity indicators */
  enableCapacityIndicators: boolean;

  /** Capacity check timeout (milliseconds) */
  capacityCheckTimeout: number;

  /** Auto-assignment timeout (milliseconds) */
  autoAssignmentTimeout: number;

  /** Cache TTL for capacity status (seconds) */
  capacityCacheTTL: number;

  /** Minimum confidence for auto-assignment (0-1) */
  minAutoAssignmentConfidence: number;

  /** Show alternative suggestions in UI */
  showAlternatives: boolean;

  /** Allow manager override (skip validation) */
  allowManagerOverride: boolean;
}

/**
 * Default Decision Engine Configuration
 */
export const DEFAULT_DECISION_ENGINE_CONFIG: DecisionEngineConfig = {
  enableCapacityCheck: true,
  enableAutoAssignment: true,
  enableCapacityIndicators: true,
  capacityCheckTimeout: 5000, // 5 seconds
  autoAssignmentTimeout: 10000, // 10 seconds
  capacityCacheTTL: 60, // 1 minute
  minAutoAssignmentConfidence: 0.6, // 60%
  showAlternatives: true,
  allowManagerOverride: true,
};

/**
 * Decision Engine Feature Flags
 * 
 * Feature flags for gradual rollout.
 */
export interface DecisionEngineFeatureFlags {
  /** Enable for all users */
  enabled: boolean;

  /** Enable for specific tenant IDs */
  enabledTenants: string[];

  /** Enable for specific user IDs (staff) */
  enabledUsers: string[];

  /** Rollout percentage (0-100) */
  rolloutPercentage: number;
}

/**
 * Helper: Check if Decision Engine is enabled for user
 * 
 * @param flags - Feature flags
 * @param tenantId - Tenant ID
 * @param userId - User ID
 * @returns Is enabled?
 */
export function isDecisionEngineEnabled(
  flags: DecisionEngineFeatureFlags,
  tenantId: string,
  userId: string
): boolean {
  // Global enable/disable
  if (!flags.enabled) return false;

  // Check tenant whitelist
  if (flags.enabledTenants.includes(tenantId)) return true;

  // Check user whitelist
  if (flags.enabledUsers.includes(userId)) return true;

  // Check rollout percentage (simple hash-based)
  if (flags.rolloutPercentage > 0) {
    const hash = hashString(`${tenantId}-${userId}`);
    const bucket = hash % 100;
    return bucket < flags.rolloutPercentage;
  }

  return false;
}

/**
 * Simple string hash function (for rollout bucketing)
 * @private
 */
function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

// ============================================================================
// UI COMPONENT TYPES
// ============================================================================

/**
 * Capacity Conflict Dialog Props
 */
export interface CapacityConflictDialogProps {
  /** Is dialog open? */
  open: boolean;

  /** Close dialog callback */
  onClose: () => void;

  /** List of conflicts */
  conflicts: Array<{
    type: string;
    reason: string;
    conflictingBooking?: {
      id: string;
      startTime: string;
      endTime: string;
    };
  }>;

  /** Alternative suggestions */
  alternatives: Array<{
    suggestedDate: string;
    suggestedTime: string;
    reason: string;
  }>;

  /** Alternative selected callback */
  onSelectAlternative: (alternative: {
    suggestedDate: string;
    suggestedTime: string;
  }) => void;
}

/**
 * KTV Assignment Dialog Props
 */
export interface KtvAssignmentDialogProps {
  /** Is dialog open? */
  open: boolean;

  /** Close dialog callback */
  onClose: () => void;

  /** Assigned KTV details */
  assignedKtv: {
    ktvId: string;
    ktvName: string;
    confidence: number;
    reason: string;
  };

  /** Alternative KTV suggestions */
  alternatives: Array<{
    ktvId: string;
    ktvName: string;
    score: number;
    reason: string;
  }>;

  /** Confirm assignment callback */
  onConfirm: () => void;

  /** Select alternative callback */
  onSelectAlternative: (ktvId: string) => void;
}

/**
 * Capacity Indicator Badge Props
 */
export interface CapacityIndicatorProps {
  /** Capacity status */
  status: CapacityStatus;

  /** Size variant */
  size?: 'sm' | 'md' | 'lg';

  /** Show percentage text */
  showPercentage?: boolean;

  /** Show tooltip on hover */
  showTooltip?: boolean;
}
