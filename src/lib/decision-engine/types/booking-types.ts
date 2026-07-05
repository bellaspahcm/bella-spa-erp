/**
 * Booking Domain Types
 * 
 * Universal booking types that work across industries:
 * - Hospitality (hotel rooms)
 * - Healthcare (doctor appointments)
 * - Beauty Spa (treatment sessions)
 * - Consulting (meeting slots)
 * - Education (class enrollment)
 * 
 * Same types, different context.
 */

/**
 * Customer/Member making the booking
 */
export interface BookingCustomer {
  id: string;
  name: string;
  membershipTier: 'vip' | 'regular' | 'new';
  totalBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  paymentStatus: 'good' | 'pending' | 'overdue';
  registrationDate: string;
}

/**
 * Booking request details
 */
export interface BookingRequest {
  serviceType: string;
  preferredDate: string; // ISO 8601
  preferredTime?: string; // HH:mm
  preferredStaff?: string;
  duration: number; // minutes
  notes?: string;
}

/**
 * System availability data
 */
export interface BookingAvailability {
  slots: BookingSlot[];
  staffCapacity: Record<string, number>; // staff_id -> available slots
  resourceCapacity: Record<string, number>; // room_id -> available slots
}

export interface BookingSlot {
  date: string;
  time: string;
  staffId?: string;
  resourceId?: string; // room, equipment, etc.
  available: boolean;
}

/**
 * Business rules for booking
 */
export interface BookingRules {
  advanceBookingDays: Record<string, number>; // tier -> days (e.g., VIP: 30, Regular: 14)
  cancellationPolicyHours: number;
  maxActiveBookings: number;
  requiresDeposit: boolean;
  depositPercentage: number;
}

/**
 * Decision Context for Booking Process
 */
export interface BookingDecisionContext {
  customer: BookingCustomer;
  request: BookingRequest;
  availability: BookingAvailability;
  rules: BookingRules;
  metadata?: Record<string, any>;
}

/**
 * Eligibility decision result
 */
export interface EligibilityResult {
  eligible: boolean;
  reason: string;
  maxAdvanceDays?: number;
  requiresApproval: boolean;
  requiresDeposit: boolean;
  matchedRules: string[];
}

/**
 * Recommendation result
 */
export interface RecommendationResult {
  recommendedSlot: string; // ISO 8601 datetime
  recommendedStaff?: string;
  recommendedResource?: string;
  alternativeSlots: string[];
  confidenceScore: number; // 0-1
  reason: string;
  matchedRules: string[];
}

/**
 * Approval result
 */
export interface ApprovalResult {
  autoApproved: boolean;
  requiredApprovers: string[];
  estimatedReviewTime?: string; // e.g., "24 hours"
  reason: string;
  matchedRules: string[];
}

/**
 * Final booking decision
 */
export interface BookingResult {
  customerId: string;
  requestId: string;
  eligible: boolean;
  recommendedSlot?: string;
  recommendedStaff?: string;
  autoApproved: boolean;
  requiresDeposit: boolean;
  depositAmount?: number;
  status: 'confirmed' | 'pending_approval' | 'pending_deposit' | 'rejected';
  reason: string;
  components: Array<EligibilityResult | RecommendationResult | ApprovalResult>;
  metadata: {
    processName: string;
    processVersion: string;
    executionTime: number;
    policyComposition: string[];
  };
}
