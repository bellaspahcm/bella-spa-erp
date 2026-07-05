/**
 * Booking Business Process
 * 
 * Composes 3 independent policies to process a booking request:
 * 1. Eligibility Policy - Can customer book?
 * 2. Recommendation Policy - What's the best slot?
 * 3. Approval Policy - Auto-approve or require review?
 * 
 * Universal process that works across industries:
 * - Hospitality (hotel bookings)
 * - Healthcare (doctor appointments)
 * - Beauty Spa (treatment sessions)
 * - Consulting (meeting slots)
 * - Education (class enrollment)
 */

import { BaseBusinessProcess } from './executor';
import type { ProcessConfig, PolicyExecutionResult } from './types';
import type {
  BookingDecisionContext,
  BookingResult,
  EligibilityResult,
  RecommendationResult,
  ApprovalResult,
} from '@/lib/decision-engine/types/booking-types';
import { EligibilityPolicy } from '@/services/policies/booking/eligibility-policy';
import { RecommendationPolicy } from '@/services/policies/booking/recommendation-policy';
import { ApprovalPolicy } from '@/services/policies/booking/approval-policy';

/**
 * Booking Business Process
 * 
 * This demonstrates that the SAME Decision Engine pattern
 * works for a completely different domain (Booking vs Payroll).
 * 
 * Key Insight:
 * - NOT a "Booking Module"
 * - It's a **composition of policies**
 * - Same BaseBusinessProcess, different policies
 */
export class BookingProcess extends BaseBusinessProcess<
  BookingDecisionContext,
  BookingResult
> {
  config: ProcessConfig = {
    name: 'BookingProcess',
    version: '1.0.0',
    executionMode: 'sequential', // Eligibility → Recommendation → Approval (order matters)
    continueOnFailure: true, // Continue even if recommendation fails (can still book without optimal slot)
    timeout: 5000,
  };

  policies = [
    new EligibilityPolicy(),
    new RecommendationPolicy(),
    new ApprovalPolicy(),
  ];

  /**
   * Aggregate policy results into final booking decision
   */
  protected async aggregate(
    context: BookingDecisionContext,
    policyResults: PolicyExecutionResult[]
  ): Promise<BookingResult> {
    const components: Array<
      EligibilityResult | RecommendationResult | ApprovalResult
    > = [];

    let eligible = false;
    let recommendedSlot: string | undefined;
    let recommendedStaff: string | undefined;
    let autoApproved = false;
    let requiresDeposit = false;
    let depositAmount: number | undefined;
    let reason = '';

    // Extract results from each policy
    for (const result of policyResults) {
      if (result.status === 'success' && result.data) {
        const data = result.data;
        components.push(data);

        // Process based on policy type
        switch (result.policyType) {
          case 'booking-eligibility': {
            const eligibilityData = data as EligibilityResult;
            eligible = eligibilityData.eligible;
            requiresDeposit = eligibilityData.requiresDeposit;
            
            if (!eligible) {
              reason = eligibilityData.reason;
              // Stop here if not eligible
              break;
            }
            break;
          }

          case 'booking-recommendation': {
            const recommendationData = data as RecommendationResult;
            recommendedSlot = recommendationData.recommendedSlot;
            recommendedStaff = recommendationData.recommendedStaff;
            break;
          }

          case 'booking-approval': {
            const approvalData = data as ApprovalResult;
            autoApproved = approvalData.autoApproved;
            if (!reason) {
              reason = approvalData.reason;
            }
            break;
          }
        }
      }
    }

    // Calculate deposit if required
    if (requiresDeposit && context.rules.requiresDeposit) {
      // In real system, would fetch service price and calculate deposit
      // For demo, use fixed amount
      depositAmount = 500000; // 500k VND deposit
    }

    // Determine final status
    let status: 'confirmed' | 'pending_approval' | 'pending_deposit' | 'rejected';
    
    if (!eligible) {
      status = 'rejected';
    } else if (requiresDeposit && !depositAmount) {
      status = 'pending_deposit';
    } else if (!autoApproved) {
      status = 'pending_approval';
    } else {
      status = 'confirmed';
    }

    return {
      customerId: context.customer.id,
      requestId: `booking_${Date.now()}`,
      eligible,
      recommendedSlot,
      recommendedStaff,
      autoApproved,
      requiresDeposit,
      depositAmount,
      status,
      reason,
      components,
      metadata: {
        processName: this.config.name,
        processVersion: this.config.version,
        executionTime: 0, // Will be filled by executor
        policyComposition: policyResults.map(
          (r) => `${r.policyName}:${r.policyType}`
        ),
      },
    };
  }
}

/**
 * Factory function for creating Booking Process
 */
export function createBookingProcess(): BookingProcess {
  return new BookingProcess();
}
