/**
 * Auto-Assignment Provider
 * 
 * Phase 1 of Booking Engine - Automatically assigns optimal KTV for booking.
 * 
 * Features:
 * - Skill matching (KTV has required skills)
 * - Availability checking (no conflicts, not overloaded)
 * - Workload balancing (distribute evenly)
 * - Performance scoring (prefer high-rated KTVs)
 * - Customer preference (honor preferred KTV)
 * - Specialization matching (match service to expertise)
 * - VIP seniority rules (senior KTVs for VIP customers)
 * 
 * Architecture Compliance:
 * - ✅ Provider-based (follows Platform pattern)
 * - ✅ Stateless (no instance state)
 * - ✅ Business logic in Provider (not Engine)
 * - ✅ Returns standard result format
 * - ✅ Fully auditable via observability
 * 
 * @module decision-engine/providers/booking
 */

import { RuleReasoner } from '../../RuleReasoner';
import type { Policy } from '../../types';
import { assignmentRules } from './rules/assignment-rules';
import type {
  AutoAssignmentInput,
  AutoAssignmentOutput,
  KtvCandidate,
  AssignmentScoreBreakdown,
  AutoAssignmentKnowledge,
  AssignmentEvaluationOptions,
} from './types';

/**
 * Auto-Assignment Provider
 * 
 * Evaluates KTV candidates and assigns optimal KTV for booking request.
 * Uses rule-based decision logic with scoring system.
 * 
 * Process:
 * 1. Fetch KTV candidates (availability, skills, workload)
 * 2. Filter candidates (required skills, availability)
 * 3. Score each candidate (skill, performance, workload, preference)
 * 4. Apply rule-based adjustments (VIP seniority, specialization)
 * 5. Select best candidate (highest score)
 * 6. Return assignment decision
 */
export class AutoAssignmentProvider {
  private readonly reasoner: RuleReasoner;
  private readonly policy: Policy;

  constructor(options?: { debug?: boolean }) {
    this.reasoner = new RuleReasoner({ debug: options?.debug });
    
    // Create policy from assignment rules
    this.policy = {
      id: 'booking-assignment-policy',
      version: '1.0.0',
      name: 'Auto-Assignment Policy',
      description: 'Evaluates KTV candidates for optimal booking assignment',
      rules: assignmentRules
        .filter(r => r.enabled)
        .map(rule => ({
          id: rule.id,
          priority: rule.priority,
          conditions: this.convertConditionToReasoner(rule.condition),
          action: {
            outcome: typeof rule.action === 'function'
              ? 'APPROVE'
              : rule.action.type === 'approve' ? 'APPROVE' : 'ESCALATE',
            reason: rule.name,
            metadata: typeof rule.action === 'function' ? undefined : rule.action.data,
          },
        })),
    };
  }

  /**
   * Evaluate assignment for booking request
   * 
   * @param input - Assignment decision input
   * @param candidates - Available KTV candidates
   * @param options - Evaluation options
   * @returns Assignment decision output
   */
  async evaluate(
    input: AutoAssignmentInput,
    candidates: KtvCandidate[],
    options?: AssignmentEvaluationOptions
  ): Promise<AutoAssignmentOutput> {
    const startTime = performance.now();

    // Handle force assignment
    if (options?.forceKtvId) {
      return this.forceAssignment(options.forceKtvId, startTime);
    }

    // Step 1: Filter candidates (required skills, availability)
    const eligibleCandidates = this.filterEligibleCandidates(
      candidates,
      input
    );

    if (eligibleCandidates.length === 0) {
      return this.createFailedResult(
        'No eligible KTVs available for requested time slot',
        candidates,
        startTime
      );
    }

    // Step 2: Score each candidate
    const scoredCandidates = await Promise.all(
      eligibleCandidates.map(candidate =>
        this.scoreCandidate(candidate, input)
      )
    );

    // Step 3: Sort by score (descending)
    scoredCandidates.sort((a, b) => b.score.total - a.score.total);

    // Step 4: Select best candidate
    const bestCandidate = scoredCandidates[0];

    // Step 5: Get alternatives
    const alternatives = scoredCandidates
      .slice(1, (options?.topN || 3) + 1)
      .map(sc => ({
        ktvId: sc.candidate.id,
        score: sc.score.total,
        reason: this.buildScoreReason(sc.score),
      }));

    // Step 6: Calculate execution time
    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    // Step 7: Build result
    return {
      success: true,
      assignedKtvId: bestCandidate.candidate.id,
      confidence: this.calculateConfidence(bestCandidate.score.total),
      reason: `Assigned to ${bestCandidate.candidate.name} (score: ${bestCandidate.score.total}/100): ${this.buildScoreReason(bestCandidate.score)}`,
      matchedRules: bestCandidate.matchedRules,
      score: bestCandidate.score,
      evaluationMetadata: {
        algorithmVersion: '1.0.0',
        totalCandidates: candidates.length,
        eligibleCandidates: eligibleCandidates.length,
        executionTimeMs: executionTime,
      },
      alternatives,
      executionTime,
      provider: 'AutoAssignmentProvider',
    };
  }

  /**
   * Filter eligible candidates
   * 
   * Required:
   * - Has required skills
   * - Available at requested time
   * - Below daily booking limit
   * - Not in exclusion list
   * 
   * @private
   */
  private filterEligibleCandidates(
    candidates: KtvCandidate[],
    input: AutoAssignmentInput
  ): KtvCandidate[] {
    return candidates.filter(candidate => {
      // Check exclusion list
      if (input.constraints?.excludeKtvIds?.includes(candidate.id)) {
        return false;
      }

      // Check availability
      if (!candidate.availability.isAvailable) {
        return false;
      }

      // Check daily limit
      if (candidate.currentWorkload >= candidate.maxDailyBookings) {
        return false;
      }

      // Check required skills
      const requiredSkills = input.constraints?.requiredSkills || [];
      const hasAllSkills = requiredSkills.every(skill =>
        candidate.skills.includes(skill)
      );
      if (!hasAllSkills) {
        return false;
      }

      // Check minimum rating
      const minRating = input.constraints?.minRating || 0;
      if (candidate.avgRating < minRating) {
        return false;
      }

      return true;
    });
  }

  /**
   * Score candidate
   * 
   * Scoring components (total: 100 points):
   * - Skill match: 25 points
   * - Availability: 20 points
   * - Workload balance: 20 points
   * - Performance: 15 points
   * - Customer preference: 10 points
   * - Specialization: 10 points
   * 
   * Penalties:
   * - Low rating (< 3.5): -10 points
   * - Overloaded (> 80%): -5 points
   * - No customer history: -2 points
   * 
   * @private
   */
  private async scoreCandidate(
    candidate: KtvCandidate,
    input: AutoAssignmentInput
  ): Promise<{
    candidate: KtvCandidate;
    score: AssignmentScoreBreakdown;
    matchedRules: string[];
  }> {
    // Initialize score
    const score: AssignmentScoreBreakdown = {
      total: 0,
      components: {
        skillMatch: 0,
        availability: 0,
        workloadBalance: 0,
        performance: 0,
        customerPreference: 0,
        specialization: 0,
      },
      penalties: {},
    };

    const matchedRules: string[] = [];

    // Component 1: Skill Match (25 points)
    const requiredSkills = input.constraints?.requiredSkills || [];
    const skillMatchPercentage = this.calculateSkillMatchPercentage(
      candidate.skills,
      requiredSkills
    );
    score.components.skillMatch = (skillMatchPercentage / 100) * 25;

    // Component 2: Availability (20 points)
    // Already filtered, so full points
    score.components.availability = 20;

    // Component 3: Workload Balance (20 points)
    // Inverse proportional: lower workload = higher score
    const workloadPercentage = (candidate.currentWorkload / candidate.maxDailyBookings) * 100;
    score.components.workloadBalance = 20 * (1 - workloadPercentage / 100);

    // Component 4: Performance (15 points)
    // Based on rating (0-5 scale)
    const ratingScore = (candidate.avgRating / 5) * 15;
    score.components.performance = ratingScore;

    // Component 5: Customer Preference (10 points)
    if (candidate.id === input.customer.preferredKtvId) {
      // Candidate is the preferred KTV
      score.components.customerPreference = 10;
      matchedRules.push('booking-assignment-customer-preference');
    } else if (candidate.isPreferredByCustomer) {
      // Fallback for explicit preference flag
      score.components.customerPreference = 10;
      matchedRules.push('booking-assignment-customer-preference');
    } else if (candidate.customerBookingCount > 0) {
      // Partial points for history with customer
      score.components.customerPreference = Math.min(
        candidate.customerBookingCount * 2,
        10
      );
    }

    // Component 6: Specialization (10 points)
    const specializationMatch = this.calculateSpecializationMatch(
      candidate.specializations,
      input.booking.serviceType
    );
    score.components.specialization = (specializationMatch / 100) * 10;
    if (specializationMatch >= 80) {
      matchedRules.push('booking-assignment-specialization');
    }

    // Apply Rule-based bonuses
    // VIP Seniority Rule: +15 points for senior KTVs serving VIP customers
    if (
      input.customer.tier === 'vip' &&
      candidate.yearsOfService >= 3
    ) {
      score.components.performance += 15;
      matchedRules.push('booking-assignment-vip-seniority');
    }

    // Calculate total before penalties
    score.total =
      score.components.skillMatch +
      score.components.availability +
      score.components.workloadBalance +
      score.components.performance +
      score.components.customerPreference +
      score.components.specialization;

    // Apply Penalties
    // Low Rating Penalty: -10 points
    if (candidate.avgRating < 3.5) {
      score.penalties.lowRating = -10;
      score.total += score.penalties.lowRating;
      matchedRules.push('booking-assignment-low-rating-penalty');
    }

    // Overloaded Penalty: -5 points
    if (workloadPercentage > 80) {
      score.penalties.overloaded = -5;
      score.total += score.penalties.overloaded;
    }

    // No History Penalty: -2 points (encourage repeat bookings)
    if (candidate.customerBookingCount === 0 && !candidate.isPreferredByCustomer) {
      score.penalties.noHistory = -2;
      score.total += score.penalties.noHistory;
    }

    // Cap total at 100
    score.total = Math.min(Math.max(score.total, 0), 100);

    return { candidate, score, matchedRules };
  }

  /**
   * Calculate skill match percentage
   * @private
   */
  private calculateSkillMatchPercentage(
    candidateSkills: string[],
    requiredSkills: string[]
  ): number {
    if (requiredSkills.length === 0) return 100;

    const matchedCount = requiredSkills.filter(skill =>
      candidateSkills.includes(skill)
    ).length;

    return (matchedCount / requiredSkills.length) * 100;
  }

  /**
   * Calculate specialization match
   * @private
   */
  private calculateSpecializationMatch(
    specializations: string[],
    serviceType: string
  ): number {
    if (specializations.length === 0) return 50; // Neutral if no specialization

    // Direct match
    if (specializations.includes(serviceType)) {
      return 100;
    }

    // Partial match (service category)
    const serviceCategory = this.getServiceCategory(serviceType);
    const hasRelatedSpecialization = specializations.some(spec =>
      this.getServiceCategory(spec) === serviceCategory
    );

    return hasRelatedSpecialization ? 80 : 50;
  }

  /**
   * Get service category (for specialization matching)
   * @private
   */
  private getServiceCategory(serviceType: string): string {
    const categoryMap: Record<string, string> = {
      'Massage': 'bodywork',
      'Deep Tissue Massage': 'bodywork',
      'Swedish Massage': 'bodywork',
      'Facial': 'skincare',
      'Acne Treatment': 'skincare',
      'Anti-Aging Facial': 'skincare',
      'Manicure': 'nails',
      'Pedicure': 'nails',
      'Gel Nails': 'nails',
    };

    return categoryMap[serviceType] || 'general';
  }

  /**
   * Build score reason string
   * @private
   */
  private buildScoreReason(score: AssignmentScoreBreakdown): string {
    const reasons: string[] = [];

    if (score.components.skillMatch > 20) {
      reasons.push('excellent skill match');
    }
    if (score.components.workloadBalance >= 15) { // >= 15 points (75% or lower capacity)
      reasons.push('low workload');
    }
    if (score.components.performance > 12) {
      reasons.push('high rating');
    }
    if (score.components.customerPreference > 0) {
      reasons.push('customer preference');
    }
    if (score.components.specialization > 8) {
      reasons.push('specialization match');
    }

    if (score.penalties?.lowRating) {
      reasons.push('⚠️ low rating penalty');
    }
    if (score.penalties?.overloaded) {
      reasons.push('⚠️ high workload');
    }

    return reasons.join(', ') || 'standard assignment';
  }

  /**
   * Calculate confidence score
   * @private
   */
  private calculateConfidence(score: number): number {
    // Confidence based on score
    // 90-100: 1.0 (very confident)
    // 80-89: 0.9
    // 70-79: 0.8
    // 60-69: 0.7
    // <60: 0.6
    if (score >= 90) return 1.0;
    if (score >= 80) return 0.9;
    if (score >= 70) return 0.8;
    if (score >= 60) return 0.7;
    return 0.6;
  }

  /**
   * Create failed assignment result
   * @private
   */
  private createFailedResult(
    reason: string,
    allCandidates: KtvCandidate[],
    startTime: number
  ): AutoAssignmentOutput {
    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    // Suggest next available KTVs
    const alternatives = allCandidates
      .filter(c => c.availability.nextAvailableSlot)
      .sort((a, b) => {
        const timeA = a.availability.nextAvailableSlot || '23:59';
        const timeB = b.availability.nextAvailableSlot || '23:59';
        return timeA.localeCompare(timeB);
      })
      .slice(0, 3)
      .map(c => ({
        ktvId: c.id,
        score: 0,
        reason: `Next available: ${c.availability.nextAvailableSlot}`,
      }));

    return {
      success: false,
      assignedKtvId: null,
      confidence: 0,
      reason,
      matchedRules: [],
      alternatives,
      executionTime,
      provider: 'AutoAssignmentProvider',
    };
  }

  /**
   * Force assignment (bypass rules)
   * @private
   */
  private forceAssignment(
    ktvId: string,
    startTime: number
  ): AutoAssignmentOutput {
    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    return {
      success: true,
      assignedKtvId: ktvId,
      confidence: 1.0,
      reason: 'Manual override: Forced assignment',
      matchedRules: [],
      executionTime,
      provider: 'AutoAssignmentProvider',
    };
  }

  /**
   * Enrich knowledge for rule evaluation
   * @private
   */
  private enrichKnowledge(
    input: AutoAssignmentInput,
    candidate: KtvCandidate
  ): AutoAssignmentKnowledge {
    const requiredSkills = input.constraints?.requiredSkills || [];
    const hasRequiredSkills = requiredSkills.every(skill =>
      candidate.skills.includes(skill)
    );

    const skillMatchPercentage = this.calculateSkillMatchPercentage(
      candidate.skills,
      requiredSkills
    );

    const specializationMatchScore = this.calculateSpecializationMatch(
      candidate.specializations,
      input.booking.serviceType
    );

    const workloadPercentage =
      (candidate.currentWorkload / candidate.maxDailyBookings) * 100;

    return {
      tenantId: input.tenantId,
      customerId: input.booking.customerId,
      serviceId: input.booking.serviceId,
      serviceType: input.booking.serviceType,
      requestedDate: input.booking.requestedDate,
      requestedStartTime: input.booking.requestedStartTime,
      durationMinutes: input.booking.durationMinutes,
      'customer.tier': input.customer.tier,
      'customer.preferredKtvId': input.customer.preferredKtvId,
      'constraints.minRating': input.constraints?.minRating,
      'candidate.id': candidate.id,
      'candidate.name': candidate.name,
      'candidate.yearsOfService': candidate.yearsOfService,
      'candidate.avgRating': candidate.avgRating,
      'candidate.currentWorkload': candidate.currentWorkload,
      'candidate.maxDailyBookings': candidate.maxDailyBookings,
      'candidate.workloadPercentage': workloadPercentage,
      'candidate.availability.isAvailable': candidate.availability.isAvailable,
      'candidate.hasOverlappingBooking': false, // Already filtered
      'candidate.belowDailyLimit': candidate.currentWorkload < candidate.maxDailyBookings,
      'candidate.hasRequiredSkills': hasRequiredSkills,
      'candidate.skillMatchPercentage': skillMatchPercentage,
      'candidate.hasMatchingSpecialization': specializationMatchScore >= 80,
      'candidate.specializationMatchScore': specializationMatchScore,
      'candidate.hasRatingHistory': candidate.avgRating > 0,
      'preferredKtv.availability.isAvailable':
        candidate.id === input.customer.preferredKtvId &&
        candidate.availability.isAvailable,
      'preferredKtv.hasRequiredSkills':
        candidate.id === input.customer.preferredKtvId && hasRequiredSkills,
    };
  }

  /**
   * Convert Platform Rule condition to RuleReasoner condition
   * @private
   */
  private convertConditionToReasoner(condition: {
    type: string;
    operator?: string;
    field?: string;
    value?: unknown;
    conditions?: Array<{
      type: string;
      operator?: string;
      field?: string;
      value?: unknown;
      conditions?: unknown[];
    }>;
  }): unknown {
    if (condition.type === 'simple') {
      // Handle 'exists' operator
      if (condition.operator === 'exists') {
        return {
          type: 'comparison',
          field: condition.field,
          operator: condition.value ? '!==' : '===',
          value: undefined,
        };
      }

      return {
        type: 'comparison',
        field: condition.field,
        operator: this.mapOperator(condition.operator || 'equals'),
        value: condition.value,
      };
    }

    if (condition.type === 'all') {
      return {
        type: 'operator',
        operator: 'and',
        conditions: (condition.conditions || []).map((c) =>
          this.convertConditionToReasoner(c)
        ),
      };
    }

    if (condition.type === 'any') {
      return {
        type: 'operator',
        operator: 'or',
        conditions: (condition.conditions || []).map((c) =>
          this.convertConditionToReasoner(c)
        ),
      };
    }

    throw new Error(`Unsupported condition type: ${condition.type}`);
  }

  /**
   * Map Platform operator to RuleReasoner operator
   * @private
   */
  private mapOperator(operator: string): string {
    const operatorMap: Record<string, string> = {
      equals: '===',
      notEquals: '!==',
      greaterThan: '>',
      greaterThanOrEqual: '>=',
      lessThan: '<',
      lessThanOrEqual: '<=',
    };

    return operatorMap[operator] || '===';
  }
}
