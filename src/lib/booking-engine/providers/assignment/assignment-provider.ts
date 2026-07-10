/**
 * Assignment Provider
 * 
 * Tự động gán KTV tối ưu cho booking dựa trên:
 * - Skills match
 * - Availability
 * - Workload balance
 * - Performance score
 * - Customer preference
 * - Location proximity
 */

import { BaseBookingProvider } from '../base-provider';
import type {
  IAssignmentProvider,
  BookingEngineContext,
  AssignmentProviderResult,
  KTVCandidate,
  Employee,
} from '../../types';

export class AssignmentProvider extends BaseBookingProvider implements IAssignmentProvider {
  
  /**
   * Tự động gán KTV tối ưu
   */
  async assignKTV(context: BookingEngineContext): Promise<AssignmentProviderResult> {
    try {
      this.log('info', 'Starting KTV assignment', { context });
      
      // Validate inputs
      this.validateRequired({
        tenantId: context.tenantId,
        packageId: context.packageId,
        preferredDate: context.preferredDate,
      });

      // Step 1: Get available KTVs
      const availableKTVs = await this.getAvailableKTVs(
        context.preferredDate,
        context.preferredTimeSlot || 'morning',
        context.tenantId
      );

      if (availableKTVs.length === 0) {
        this.log('warn', 'No available KTVs', { context });
        return this.success({
          candidates: [],
          recommendation: null,
          fallbackStrategy: 'waitlist',
        }, 0);
      }

      // Step 2: Score each KTV
      const candidates = await Promise.all(
        availableKTVs.map(ktv => this.scoreKTV(ktv, context))
      );

      // Step 3: Sort by score (highest first)
      candidates.sort((a, b) => b.score - a.score);

      // Step 4: Get top recommendation
      const recommendation = candidates[0] || null;

      this.log('info', 'KTV assignment complete', { 
        totalCandidates: candidates.length,
        recommendation: recommendation?.ktvName,
      });

      return this.success({
        candidates: candidates.slice(0, 5), // Top 5
        recommendation,
      }, recommendation?.score);

    } catch (error) {
      this.log('error', 'KTV assignment failed', { error });
      return this.error(error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get list of available KTVs
   */
  async getAvailableKTVs(
    date: string,
    timeSlot: string,
    tenantId: string
  ): Promise<Employee[]> {
    // TODO: Implement database query
    // Query employees table:
    // - role = 'ktv'
    // - status = 'active'
    // - NOT on leave on this date
    // - NOT fully booked for this time slot
    
    this.log('info', 'Fetching available KTVs', { date, timeSlot });
    
    // Placeholder
    return [];
  }

  /**
   * Score individual KTV candidate
   */
  private async scoreKTV(
    ktv: Employee,
    context: BookingEngineContext
  ): Promise<KTVCandidate> {
    let score = 0;
    const reasons: string[] = [];

    // Factor 1: Skills match (0-30 points)
    const skillsScore = await this.calculateSkillsScore(ktv, context);
    score += skillsScore;
    if (skillsScore > 20) {
      reasons.push(`Skills match: ${skillsScore}/30`);
    }

    // Factor 2: Availability (0-20 points)
    const availabilityScore = await this.calculateAvailabilityScore(ktv, context);
    score += availabilityScore;
    if (availabilityScore > 15) {
      reasons.push(`High availability: ${availabilityScore}/20`);
    }

    // Factor 3: Workload balance (0-20 points)
    const workloadScore = await this.calculateWorkloadScore(ktv, context);
    score += workloadScore;
    if (workloadScore > 15) {
      reasons.push(`Balanced workload: ${workloadScore}/20`);
    }

    // Factor 4: Performance (0-15 points)
    const performanceScore = await this.calculatePerformanceScore(ktv);
    score += performanceScore;
    if (performanceScore > 10) {
      reasons.push(`High rating: ${performanceScore}/15`);
    }

    // Factor 5: Customer preference (0-10 points)
    const preferenceScore = this.calculatePreferenceScore(ktv, context);
    score += preferenceScore;
    if (preferenceScore > 5) {
      reasons.push(`Customer preferred: +${preferenceScore}`);
    }

    // Factor 6: Location proximity (0-5 points)
    const locationScore = await this.calculateLocationScore(ktv, context);
    score += locationScore;

    return {
      ktvId: ktv.id,
      ktvName: ktv.full_name || 'Unknown',
      score: Math.round(score),
      reasons,
      availability: {
        isAvailable: true, // TODO: Real check
        currentLoad: 0, // TODO: Real count
        maxLoad: 8, // TODO: From config
        conflicts: [],
      },
      skills: {
        specialty: [], // TODO: From KTV profile
        rating: 4.5, // TODO: From reviews
        completionRate: 95, // TODO: From stats
      },
    };
  }

  /**
   * Calculate skills match score (0-30 points)
   */
  private async calculateSkillsScore(
    ktv: Employee,
    context: BookingEngineContext
  ): Promise<number> {
    // TODO: Implement
    // - Match package type with KTV specialty
    // - Check certifications
    // - Experience with similar packages
    return 25; // Placeholder
  }

  /**
   * Calculate availability score (0-20 points)
   */
  private async calculateAvailabilityScore(
    ktv: Employee,
    context: BookingEngineContext
  ): Promise<number> {
    // TODO: Implement
    // - Check leave schedule
    // - Check existing bookings
    // - Check time slot preferences
    return 18; // Placeholder
  }

  /**
   * Calculate workload balance score (0-20 points)
   */
  private async calculateWorkloadScore(
    ktv: Employee,
    context: BookingEngineContext
  ): Promise<number> {
    // TODO: Implement
    // - Count sessions today
    // - Count sessions this week
    // - Compare with average
    // - Prefer less loaded KTV
    return 15; // Placeholder
  }

  /**
   * Calculate performance score (0-15 points)
   */
  private async calculatePerformanceScore(ktv: Employee): Promise<number> {
    // TODO: Implement
    // - Average rating (0-5 stars → 0-10 points)
    // - Completion rate (0-100% → 0-5 points)
    return 12; // Placeholder
  }

  /**
   * Calculate customer preference score (0-10 points)
   */
  private calculatePreferenceScore(
    ktv: Employee,
    context: BookingEngineContext
  ): number {
    // Exact match: +10 points
    if (context.preferredKtvId === ktv.id) {
      return 10;
    }

    // TODO: Check history (repeat customer → same KTV)
    return 0;
  }

  /**
   * Calculate location proximity score (0-5 points)
   */
  private async calculateLocationScore(
    ktv: Employee,
    context: BookingEngineContext
  ): Promise<number> {
    // TODO: Implement multi-branch support
    // - Same branch: +5 points
    // - Nearby branch: +2 points
    return 5; // Placeholder (single branch)
  }
}
