/**
 * Discount Provider Types
 * 
 * Type definitions for Discount Provider integration with Decision Engine.
 * Follows Platform Architecture Commandment #2 (Provider-based) and #7 (Standard contract).
 * 
 * @module decision-engine/providers/discount
 */

/**
 * Customer tier for discount eligibility
 */
export type CustomerTier = 'vip' | 'loyal' | 'active' | 'new';

/**
 * Discount type classification
 */
export type DiscountType =
  | 'membership'   // Tier-based discounts (VIP, Loyal, Active, New)
  | 'seasonal'     // Time-based campaigns (Lunar New Year, Summer, etc.)
  | 'bundle'       // Multi-service discounts
  | 'referral'     // Referral program rewards
  | 'birthday'     // Birthday month specials
  | 'weekend'      // Weekend promotions
  | 'firsttime'    // First-time customer incentives
  | 'none';        // No discount

/**
 * Discount decision input (Knowledge)
 * 
 * This is the "Knowledge" passed to Decision Engine.
 * Follows Commandment #4 (Stateless) - all required data must be in input.
 */
export interface DiscountDecisionInput {
  /** Tenant ID for multi-tenant isolation */
  tenantId: string;

  /** Purchase total amount (before discount) */
  totalAmount: number;

  /** Customer information */
  customer: {
    id: string;
    status: string | null;
    totalSpending: number; // Lifetime spending
    completedBookingsCount: number;
    isFirstBooking?: boolean;
    birthdayMonth?: number; // 1-12
  };

  /** Campaign information (optional) */
  campaign?: {
    code: string;
    startDate: string; // ISO date
    endDate: string; // ISO date
  };

  /** Purchase details */
  purchase?: {
    serviceCount?: number;
    referralCode?: string;
    bookingDate?: Date;
  };

  /** Optional: Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Discount decision output (DecisionResult)
 * 
 * This is the "DecisionResult" returned by Decision Engine.
 * Follows Commandment #7 (Standard contract).
 */
export interface DiscountDecisionOutput {
  /** Whether discount is eligible */
  eligible: boolean;

  /** Discount percentage (0-100) */
  discountPercent: number;

  /** Discount amount in VND */
  discountAmount: number;

  /** Discount type */
  discountType: DiscountType;

  /** Final amount after discount */
  finalAmount: number;

  /** Decision reason (human-readable) */
  reason: string;

  /** Matched rule IDs (for audit trail) */
  matchedRules: string[];

  /** Restrictions/conditions */
  restrictions: string[];

  /** Campaign code (if applicable) */
  campaignCode?: string;

  /** Decision confidence (0.0 - 1.0) */
  confidence: number;

  /** Execution time in milliseconds */
  executionTime: number;

  /** Provider used */
  provider: string;

  /** Customer tier (for debugging) */
  customerTier: CustomerTier;
}

/**
 * Discount Knowledge (internal)
 * 
 * Enriched knowledge passed to RuleReasoner.
 * Extends DiscountDecisionInput with computed fields.
 */
export interface DiscountKnowledge extends Record<string, unknown> {
  // Direct inputs
  tenantId: string;
  totalAmount: number;
  customerId: string;
  completedBookingsCount: number;
  totalSpending: number;
  isFirstBooking: boolean;

  // Computed fields
  customerTier: CustomerTier;
  isWithinCampaign: boolean;
  isBirthdayMonth: boolean;
  isWeekend: boolean;
  serviceCount: number;
  hasReferralCode: boolean;
  campaignCode?: string;

  // Metadata
  metadata?: Record<string, unknown>;
}
