/**
 * Booking Recommendation Policy
 * 
 * Recommends the best booking slot based on:
 * - Customer preference
 * - Staff availability
 * - Resource availability
 * - Historical patterns
 * 
 * Universal algorithm that works across industries:
 * - Hospitality: room + amenities
 * - Healthcare: doctor + equipment
 * - Beauty Spa: KTV + treatment room
 * - Consulting: consultant + meeting room
 */

import type {
  BookingDecisionContext,
  RecommendationResult,
  BookingSlot,
} from '@/lib/decision-engine/types/booking-types';
import type { BookingPolicy } from './eligibility-policy';

export class RecommendationPolicy
  implements BookingPolicy<RecommendationResult>
{
  readonly name = 'RecommendationPolicy';
  readonly version = '1.0.0';
  readonly decisionType = 'booking-recommendation';

  async evaluate(
    context: BookingDecisionContext
  ): Promise<RecommendationResult> {
    const { customer, request, availability } = context;
    const matchedRules: string[] = [];

    // Rule 1: Try to match exact preference
    const exactMatch = this.findExactMatch(request, availability.slots);
    if (exactMatch) {
      matchedRules.push('exact-preference-match');
      return {
        recommendedSlot: `${exactMatch.date}T${exactMatch.time}`,
        recommendedStaff: exactMatch.staffId,
        recommendedResource: exactMatch.resourceId,
        alternativeSlots: [],
        confidenceScore: 1.0,
        reason: 'Exact match found for customer preference',
        matchedRules,
      };
    }

    // Rule 2: Find best available slot (similar time, available staff)
    const alternativeSlots = this.findAlternativeSlots(request, availability.slots);
    
    if (alternativeSlots.length === 0) {
      matchedRules.push('no-availability');
      return {
        recommendedSlot: '',
        alternativeSlots: [],
        confidenceScore: 0,
        reason: 'No available slots found for requested date/time',
        matchedRules,
      };
    }

    // Rule 3: Score slots based on multiple factors
    const scoredSlots = alternativeSlots.map((slot) => ({
      slot,
      score: this.scoreSlot(slot, request, customer),
    }));

    // Sort by score descending
    scoredSlots.sort((a, b) => b.score - a.score);

    const bestSlot = scoredSlots[0].slot;
    const confidenceScore = scoredSlots[0].score;

    matchedRules.push('best-alternative-found');
    
    return {
      recommendedSlot: `${bestSlot.date}T${bestSlot.time}`,
      recommendedStaff: bestSlot.staffId,
      recommendedResource: bestSlot.resourceId,
      alternativeSlots: scoredSlots.slice(1, 4).map(s => `${s.slot.date}T${s.slot.time}`),
      confidenceScore,
      reason: `Best available slot with ${Math.round(confidenceScore * 100)}% match confidence`,
      matchedRules,
    };
  }

  private findExactMatch(
    request: { preferredDate: string; preferredTime?: string; preferredStaff?: string },
    slots: BookingSlot[]
  ): BookingSlot | undefined {
    return slots.find(
      (slot) =>
        slot.available &&
        slot.date === request.preferredDate &&
        (request.preferredTime ? slot.time === request.preferredTime : true) &&
        (request.preferredStaff ? slot.staffId === request.preferredStaff : true)
    );
  }

  private findAlternativeSlots(
    request: { preferredDate: string; preferredTime?: string },
    slots: BookingSlot[]
  ): BookingSlot[] {
    // Find slots on same date or ±1 day
    const requestedDate = new Date(request.preferredDate);
    const oneDayBefore = new Date(requestedDate);
    oneDayBefore.setDate(oneDayBefore.getDate() - 1);
    const oneDayAfter = new Date(requestedDate);
    oneDayAfter.setDate(oneDayAfter.getDate() + 1);

    const dateRange = [
      oneDayBefore.toISOString().split('T')[0],
      request.preferredDate,
      oneDayAfter.toISOString().split('T')[0],
    ];

    return slots.filter(
      (slot) => slot.available && dateRange.includes(slot.date)
    );
  }

  private scoreSlot(
    slot: BookingSlot,
    request: { preferredDate: string; preferredTime?: string; preferredStaff?: string },
    customer: { membershipTier?: string }
  ): number {
    let score = 0.5; // Base score

    // +0.3 if same date
    if (slot.date === request.preferredDate) {
      score += 0.3;
    }

    // +0.2 if preferred time match (within 1 hour)
    if (request.preferredTime && slot.time) {
      const requestedHour = parseInt(request.preferredTime.split(':')[0]);
      const slotHour = parseInt(slot.time.split(':')[0]);
      const hourDiff = Math.abs(requestedHour - slotHour);
      if (hourDiff <= 1) {
        score += 0.2 - hourDiff * 0.05;
      }
    }

    // +0.1 if preferred staff available
    if (request.preferredStaff && slot.staffId === request.preferredStaff) {
      score += 0.1;
    }

    // Small boost for VIP customers (priority access)
    if (customer.membershipTier === 'vip') {
      score += 0.05;
    }

    return Math.min(score, 1.0); // Cap at 1.0
  }
}
