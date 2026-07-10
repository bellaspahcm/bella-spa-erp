/**
 * Booking Engine - Core Types
 * 
 * Business Engine Layer - Booking-specific types
 * These types are for the Booking Engine business logic,
 * separate from Decision Engine types.
 */

import type { Database } from '@/types/supabase';

// ============================================================================
// CORE ENTITIES
// ============================================================================

export type Customer = Database['public']['Tables']['customers']['Row'];
export type Package = Database['public']['Tables']['packages']['Row'];
export type Employee = Database['public']['Tables']['employees']['Row'];
export type Booking = Database['public']['Tables']['bookings']['Row'];
export type BookingServiceItem = Database['public']['Tables']['booking_service_items']['Row'];

// ============================================================================
// BOOKING ENGINE CONTEXT
// ============================================================================

/**
 * Context chứa tất cả thông tin cần thiết cho các Provider
 */
export interface BookingEngineContext {
  // Tenant
  tenantId: string;
  
  // Customer Info
  customerId: string;
  customerTier: 'new' | 'active' | 'loyal' | 'vip';
  customerHistory?: {
    totalBookings: number;
    completedBookings: number;
    cancelledBookings: number;
    noShowCount: number;
    lifetimeValue: number;
    averageRating: number;
  };
  
  // Booking Request
  packageId: string;
  packageDetails?: Package;
  preferredDate: string; // ISO date string
  preferredTimeSlot?: 'morning' | 'afternoon' | 'evening';
  preferredKtvId?: string;
  notes?: string;
  
  // Additional Context
  branchId?: string;
  createdBy: string;
  metadata?: Record<string, any>;
}

// ============================================================================
// PROVIDER RESULTS
// ============================================================================

/**
 * Base result structure cho tất cả Providers
 */
export interface ProviderResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  confidence?: number; // 0-100
  metadata?: Record<string, any>;
}

// ============================================================================
// ASSIGNMENT PROVIDER
// ============================================================================

export interface KTVCandidate {
  ktvId: string;
  ktvName: string;
  score: number; // 0-100
  reasons: string[];
  availability: {
    isAvailable: boolean;
    currentLoad: number; // số ca hiện tại
    maxLoad: number; // max ca/ngày
    conflicts: string[];
  };
  skills: {
    specialty: string[];
    rating: number;
    completionRate: number;
  };
}

export interface AssignmentResult {
  candidates: KTVCandidate[];
  recommendation: KTVCandidate | null;
  fallbackStrategy?: 'waitlist' | 'suggest_alternative_time';
}

export type AssignmentProviderResult = ProviderResult<AssignmentResult>;

// ============================================================================
// CAPACITY PROVIDER
// ============================================================================

export interface CapacityInfo {
  date: string;
  timeSlot: string;
  totalCapacity: number;
  bookedCapacity: number;
  availableCapacity: number;
  utilizationRate: number; // 0-100
  isAvailable: boolean;
  bufferReserved: number; // capacity reserved for VIP/walk-ins
}

export interface AlternativeSlot {
  date: string;
  timeSlot: string;
  availableCapacity: number;
  score: number; // proximity to preferred time
}

export interface CapacityResult {
  current: CapacityInfo;
  alternatives: AlternativeSlot[];
  recommendation: 'accept' | 'suggest_alternative' | 'waitlist';
}

export type CapacityProviderResult = ProviderResult<CapacityResult>;

// ============================================================================
// CONFLICT PROVIDER
// ============================================================================

export type ConflictType = 
  | 'double_booking'
  | 'overbooking'
  | 'equipment_conflict'
  | 'ktv_leave'
  | 'holiday'
  | 'package_incompatibility';

export interface Conflict {
  type: ConflictType;
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  affectedResources: string[];
  suggestedResolution?: string;
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  canProceed: boolean;
  requiresApproval: boolean;
}

export type ConflictProviderResult = ProviderResult<ConflictResult>;

// ============================================================================
// WAITLIST PROVIDER
// ============================================================================

export interface WaitlistEntry {
  id: string;
  customerId: string;
  packageId: string;
  preferredDate: string;
  preferredTimeSlot?: string;
  preferredKtvId?: string;
  priorityScore: number; // 0-100 (VIP=100, Loyal=50, New=0)
  status: 'active' | 'notified' | 'converted' | 'expired' | 'cancelled';
  expiresAt: string; // ISO datetime
  createdAt: string;
}

export interface WaitlistResult {
  shouldAddToWaitlist: boolean;
  priorityScore: number;
  estimatedWaitTime?: string; // e.g., "2-3 days"
  position?: number; // position in queue
}

export type WaitlistProviderResult = ProviderResult<WaitlistResult>;

// ============================================================================
// PRICING PROVIDER
// ============================================================================

export interface PriceMultiplier {
  name: string;
  type: 'time' | 'demand' | 'customer' | 'seasonal';
  factor: number; // 1.15 = +15%
  applied: boolean;
  reason: string;
}

export interface PriceBreakdown {
  basePrice: number;
  multipliers: PriceMultiplier[];
  subtotal: number;
  discounts: Array<{
    name: string;
    amount: number;
    reason: string;
  }>;
  finalPrice: number;
  currency: 'VND';
}

export interface PricingResult {
  breakdown: PriceBreakdown;
  comparison?: {
    regularPrice: number;
    savings: number;
  };
}

export type PricingProviderResult = ProviderResult<PricingResult>;

// ============================================================================
// CANCELLATION PROVIDER
// ============================================================================

export interface RefundPolicy {
  policyName: string;
  refundPercentage: number; // 0-100
  refundAmount: number;
  rescheduleAllowed: boolean;
  rescheduleFee: number;
  reason: string;
}

export interface CancellationResult {
  canCancel: boolean;
  policy: RefundPolicy;
  retention: {
    offerRebooking: boolean;
    offerVoucher: boolean;
    voucherAmount?: number;
    voucherExpiry?: string;
  };
  waitlistAction: {
    notifyWaitlist: boolean;
    expectedConversions: number;
  };
}

export type CancellationProviderResult = ProviderResult<CancellationResult>;

// ============================================================================
// PROVIDER INTERFACES
// ============================================================================

/**
 * Assignment Provider Interface
 */
export interface IAssignmentProvider {
  /**
   * Tự động gán KTV tối ưu cho booking
   */
  assignKTV(context: BookingEngineContext): Promise<AssignmentProviderResult>;
  
  /**
   * Get list of available KTVs (without scoring)
   */
  getAvailableKTVs(
    date: string,
    timeSlot: string,
    tenantId: string
  ): Promise<Employee[]>;
}

/**
 * Capacity Provider Interface
 */
export interface ICapacityProvider {
  /**
   * Kiểm tra capacity cho time slot
   */
  checkCapacity(
    date: string,
    timeSlot: string,
    tenantId: string
  ): Promise<CapacityProviderResult>;
  
  /**
   * Suggest alternative time slots
   */
  suggestAlternatives(
    preferredDate: string,
    tenantId: string,
    limit?: number
  ): Promise<AlternativeSlot[]>;
}

/**
 * Conflict Provider Interface
 */
export interface IConflictProvider {
  /**
   * Phát hiện conflicts cho booking request
   */
  detectConflicts(context: BookingEngineContext): Promise<ConflictProviderResult>;
  
  /**
   * Validate specific conflict type
   */
  validateNoConflict(
    type: ConflictType,
    context: BookingEngineContext
  ): Promise<boolean>;
}

/**
 * Waitlist Provider Interface
 */
export interface IWaitlistProvider {
  /**
   * Đánh giá có nên add vào waitlist không
   */
  evaluateWaitlist(context: BookingEngineContext): Promise<WaitlistProviderResult>;
  
  /**
   * Add to waitlist
   */
  addToWaitlist(
    context: BookingEngineContext,
    priorityScore: number
  ): Promise<WaitlistEntry>;
  
  /**
   * Find candidates for conversion (when capacity available)
   */
  findConversionCandidates(
    date: string,
    timeSlot: string,
    tenantId: string,
    limit?: number
  ): Promise<WaitlistEntry[]>;
}

/**
 * Pricing Provider Interface
 */
export interface IPricingProvider {
  /**
   * Tính giá động cho booking
   */
  calculatePrice(context: BookingEngineContext): Promise<PricingProviderResult>;
  
  /**
   * Get base price (without multipliers)
   */
  getBasePrice(packageId: string, tenantId: string): Promise<number>;
}

/**
 * Cancellation Provider Interface
 */
export interface ICancellationProvider {
  /**
   * Đánh giá cancellation request
   */
  evaluateCancellation(
    bookingId: string,
    reason: string,
    requestedBy: string
  ): Promise<CancellationProviderResult>;
  
  /**
   * Calculate refund amount
   */
  calculateRefund(
    booking: Booking,
    cancellationDate: Date
  ): Promise<RefundPolicy>;
}

// ============================================================================
// BOOKING ENGINE INTERFACE
// ============================================================================

/**
 * Main Booking Engine Interface
 * Orchestrates all 6 providers
 */
export interface IBookingEngine {
  assignment: IAssignmentProvider;
  capacity: ICapacityProvider;
  conflict: IConflictProvider;
  waitlist: IWaitlistProvider;
  pricing: IPricingProvider;
  cancellation: ICancellationProvider;
  
  /**
   * Orchestrated booking creation (uses all providers)
   */
  createBooking(context: BookingEngineContext): Promise<BookingCreationResult>;
}

/**
 * Result của booking creation (orchestrated)
 */
export interface BookingCreationResult {
  success: boolean;
  bookingId?: string;
  waitlistId?: string;
  assignment?: AssignmentResult;
  pricing?: PricingResult;
  conflicts?: Conflict[];
  recommendation: 'booking_created' | 'added_to_waitlist' | 'rejected';
  message: string;
}
