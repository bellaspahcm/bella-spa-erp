/**
 * @fileoverview Booking-specific decision context and result types
 *
 * This file contains type definitions for booking decisions, including context and results.
 */

export type {
  BookingDecisionContext,
  DecisionContext,
} from './decision-context';

export interface EligibilityResult {
  eligible: boolean;
  requiresDeposit: boolean;
  reason: string;
  requiresApproval?: boolean;
  maxAdvanceDays?: number;
  matchedRules?: string[];
}

export interface RecommendationResult {
  recommendedSlot?: string;
  recommendedStaff?: string;
  recommendedResource?: string;
  alternativeSlots?: string[];
  confidenceScore?: number;
  reason?: string;
  matchedRules?: string[];
}

export interface ApprovalResult {
  autoApproved: boolean;
  reason: string;
  requiredApprovers?: string[];
  estimatedReviewTime?: string;
  matchedRules?: string[];
}

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

export interface BookingSlot {
  date: string;
  time: string;
  staffId: string;
  resourceId: string;
  available: boolean;
}
