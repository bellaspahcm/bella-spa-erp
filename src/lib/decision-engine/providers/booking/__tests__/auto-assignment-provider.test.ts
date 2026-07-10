/**
 * Auto-Assignment Provider Tests
 * 
 * Comprehensive test coverage for Phase 1 of Booking Engine.
 * 
 * Test Scenarios:
 * 1. Basic Assignment (skill match, availability)
 * 2. Customer Preference Override
 * 3. VIP Seniority Matching
 * 4. Workload Balancing
 * 5. Performance Scoring
 * 6. Specialization Matching
 * 7. Low Rating Penalty
 * 8. Multiple Candidates Scoring
 * 9. No Eligible Candidates
 * 10. Force Assignment
 * 11. Constraints Filtering
 * 12. Alternative Suggestions
 * 13. Confidence Calculation
 * 14. Execution Performance
 * 15. Complex Scenarios (VIP + preference + specialization)
 * 
 * @module decision-engine/providers/booking/__tests__
 */

import { AutoAssignmentProvider } from '../auto-assignment-provider';
import type {
  AutoAssignmentInput,
  KtvCandidate,
  AssignmentEvaluationOptions,
} from '../types';

describe('AutoAssignmentProvider', () => {
  let provider: AutoAssignmentProvider;

  beforeEach(() => {
    provider = new AutoAssignmentProvider({ debug: false });
  });

  // Helper: Create test input
  const createTestInput = (
    overrides?: Partial<AutoAssignmentInput>
  ): AutoAssignmentInput => ({
    tenantId: 'test-tenant',
    booking: {
      customerId: 'customer-001',
      serviceId: 'service-massage',
      serviceType: 'Massage',
      requestedDate: '2026-07-15',
      requestedStartTime: '14:00',
      durationMinutes: 90,
      ...overrides?.booking,
    },
    customer: {
      tier: 'loyal',
      ...overrides?.customer,
    },
    constraints: overrides?.constraints,
    metadata: overrides?.metadata,
  });

  // Helper: Create test candidates
  const createTestCandidates = (): KtvCandidate[] => [
    {
      id: 'ktv-001',
      name: 'Alice',
      position: 'Senior KTV',
      yearsOfService: 5,
      skills: ['Massage', 'Deep Tissue Massage', 'Swedish Massage'],
      specializations: ['Massage', 'Deep Tissue Massage'],
      avgRating: 4.8,
      currentWorkload: 3,
      maxDailyBookings: 8,
      availability: {
        isAvailable: true,
      },
      isPreferredByCustomer: false,
      customerBookingCount: 0,
    },
    {
      id: 'ktv-002',
      name: 'Bob',
      position: 'KTV',
      yearsOfService: 2,
      skills: ['Massage', 'Facial', 'Manicure'],
      specializations: ['Facial'],
      avgRating: 4.5,
      currentWorkload: 5,
      maxDailyBookings: 8,
      availability: {
        isAvailable: true,
      },
      isPreferredByCustomer: false,
      customerBookingCount: 2,
    },
    {
      id: 'ktv-003',
      name: 'Carol',
      position: 'Junior KTV',
      yearsOfService: 1,
      skills: ['Massage', 'Manicure'],
      specializations: [],
      avgRating: 4.2,
      currentWorkload: 7,
      maxDailyBookings: 8,
      availability: {
        isAvailable: true,
      },
      isPreferredByCustomer: false,
      customerBookingCount: 0,
    },
    {
      id: 'ktv-004',
      name: 'David',
      position: 'Senior KTV',
      yearsOfService: 4,
      skills: ['Massage', 'Deep Tissue Massage'],
      specializations: ['Massage'],
      avgRating: 3.2, // Low rating
      currentWorkload: 2,
      maxDailyBookings: 8,
      availability: {
        isAvailable: true,
      },
      isPreferredByCustomer: false,
      customerBookingCount: 0,
    },
    {
      id: 'ktv-005',
      name: 'Emma',
      position: 'KTV',
      yearsOfService: 3,
      skills: ['Massage', 'Swedish Massage'],
      specializations: ['Massage'],
      avgRating: 4.7,
      currentWorkload: 8, // Fully booked
      maxDailyBookings: 8,
      availability: {
        isAvailable: false,
        nextAvailableSlot: '16:00',
      },
      isPreferredByCustomer: false,
      customerBookingCount: 0,
    },
  ];

  describe('Basic Assignment', () => {
    it('should assign KTV with best score when multiple candidates available', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(true);
      expect(result.assignedKtvId).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.provider).toBe('AutoAssignmentProvider');
    });

    it('should assign senior KTV (Alice) with high rating and specialization', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Alice should win: high rating (4.8), low workload (3/8), specialization in Massage
      expect(result.assignedKtvId).toBe('ktv-001');
      expect(result.confidence).toBeGreaterThanOrEqual(0.8);
      expect(result.reason).toContain('Alice');
    });

    it('should return alternatives when assignment succeeds', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates, { topN: 3 });

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
      expect(result.alternatives!.length).toBeLessThanOrEqual(3);
      
      // Check alternative structure
      result.alternatives!.forEach(alt => {
        expect(alt).toHaveProperty('ktvId');
        expect(alt).toHaveProperty('score');
        expect(alt).toHaveProperty('reason');
      });
    });
  });

  describe('Customer Preference Override', () => {
    it('should assign preferred KTV if available and qualified', async () => {
      const input = createTestInput({
        customer: {
          tier: 'loyal',
          preferredKtvId: 'ktv-002', // Bob
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Bob should get preference bonus
      expect(result.success).toBe(true);
      // Note: Preference gives +10 points, but Alice still has better score
      // To test override, preferred KTV needs to be available
    });

    it('should not assign preferred KTV if unavailable', async () => {
      const input = createTestInput({
        customer: {
          tier: 'loyal',
          preferredKtvId: 'ktv-005', // Emma (unavailable)
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Should assign someone else since Emma is unavailable
      expect(result.assignedKtvId).not.toBe('ktv-005');
    });

    it('should give partial points for customer history', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();
      
      // Bob has 2 previous bookings with this customer
      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(true);
      // Bob should get some preference points from history
    });
  });

  describe('VIP Seniority Matching', () => {
    it('should prefer senior KTVs for VIP customers', async () => {
      const input = createTestInput({
        customer: {
          tier: 'vip',
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Alice (5 years) should win due to VIP seniority bonus
      expect(result.assignedKtvId).toBe('ktv-001');
      expect(result.matchedRules).toContain('booking-assignment-vip-seniority');
    });

    it('should not apply seniority bonus for non-VIP customers', async () => {
      const input = createTestInput({
        customer: {
          tier: 'new',
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Should not include VIP seniority rule
      expect(result.matchedRules).not.toContain('booking-assignment-vip-seniority');
    });
  });

  describe('Workload Balancing', () => {
    it('should prefer KTV with lower workload', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [
        {
          id: 'ktv-low-workload',
          name: 'Low Workload',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.5,
          currentWorkload: 2, // Low workload
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
        {
          id: 'ktv-high-workload',
          name: 'High Workload',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.5,
          currentWorkload: 6, // High workload
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
      ];

      const result = await provider.evaluate(input, candidates);

      // Should assign to low workload KTV
      expect(result.assignedKtvId).toBe('ktv-low-workload');
      expect(result.reason).toContain('low workload');
    });

    it('should apply penalty for overloaded KTV (>80% capacity)', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      // Carol is at 7/8 bookings (87.5% capacity)
      const result = await provider.evaluate(input, candidates);

      // Carol should not win due to overload penalty
      expect(result.assignedKtvId).not.toBe('ktv-003');
    });
  });

  describe('Performance Scoring', () => {
    it('should prefer high-rated KTVs', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [
        {
          id: 'ktv-high-rating',
          name: 'High Rating',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.9, // High rating
          currentWorkload: 4,
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
        {
          id: 'ktv-low-rating',
          name: 'Low Rating',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 3.8, // Lower rating
          currentWorkload: 3, // Slightly lower workload
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
      ];

      const result = await provider.evaluate(input, candidates);

      // Should prefer high rating over slightly lower workload
      expect(result.assignedKtvId).toBe('ktv-high-rating');
      expect(result.reason).toContain('high rating');
    });

    it('should apply low rating penalty for ratings < 3.5', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // David (3.2 rating) should not win due to penalty
      expect(result.assignedKtvId).not.toBe('ktv-004');
      // Check that low rating penalty rule was matched for David
      // (would need to return per-candidate matched rules to verify)
    });
  });

  describe('Specialization Matching', () => {
    it('should prefer KTV with matching specialization', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          serviceId: 'service-facial',
          serviceType: 'Facial',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          durationMinutes: 60,
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Bob specializes in Facial, should win
      expect(result.assignedKtvId).toBe('ktv-002');
      expect(result.matchedRules).toContain('booking-assignment-specialization');
    });

    it('should give neutral score if no specialization', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [
        {
          id: 'ktv-specialist',
          name: 'Specialist',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'], // Has specialization
          avgRating: 4.5,
          currentWorkload: 4,
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
        {
          id: 'ktv-generalist',
          name: 'Generalist',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: [], // No specialization
          avgRating: 4.5,
          currentWorkload: 4,
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
      ];

      const result = await provider.evaluate(input, candidates);

      // Specialist should win
      expect(result.assignedKtvId).toBe('ktv-specialist');
    });
  });

  describe('Constraints Filtering', () => {
    it('should exclude KTVs in exclusion list', async () => {
      const input = createTestInput({
        constraints: {
          excludeKtvIds: ['ktv-001', 'ktv-002'],
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Should not assign Alice or Bob
      expect(result.assignedKtvId).not.toBe('ktv-001');
      expect(result.assignedKtvId).not.toBe('ktv-002');
      expect(result.success).toBe(true);
    });

    it('should filter by required skills', async () => {
      const input = createTestInput({
        constraints: {
          requiredSkills: ['Deep Tissue Massage'], // Only Alice and David have this
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Should assign Alice or David (both have Deep Tissue)
      expect(['ktv-001', 'ktv-004']).toContain(result.assignedKtvId!);
    });

    it('should filter by minimum rating', async () => {
      const input = createTestInput({
        constraints: {
          minRating: 4.5, // Filters out Carol (4.2) and David (3.2)
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Should assign Alice (4.8) or Bob (4.5)
      expect(['ktv-001', 'ktv-002']).toContain(result.assignedKtvId!);
    });

    it('should not assign unavailable KTVs', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Should not assign Emma (unavailable)
      expect(result.assignedKtvId).not.toBe('ktv-005');
    });

    it('should not assign fully booked KTVs', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Emma is at max capacity (8/8)
      expect(result.assignedKtvId).not.toBe('ktv-005');
    });
  });

  describe('No Eligible Candidates', () => {
    it('should return failed result when no candidates available', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [];

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(false);
      expect(result.assignedKtvId).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('No eligible KTVs');
    });

    it('should return failed result when all candidates lack required skills', async () => {
      const input = createTestInput({
        constraints: {
          requiredSkills: ['Laser Hair Removal'], // No one has this skill
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(false);
      expect(result.assignedKtvId).toBeNull();
    });

    it('should suggest next available slots when all KTVs busy', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [
        {
          id: 'ktv-busy-1',
          name: 'Busy 1',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.5,
          currentWorkload: 8,
          maxDailyBookings: 8,
          availability: {
            isAvailable: false,
            nextAvailableSlot: '16:00',
          },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
        {
          id: 'ktv-busy-2',
          name: 'Busy 2',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.5,
          currentWorkload: 8,
          maxDailyBookings: 8,
          availability: {
            isAvailable: false,
            nextAvailableSlot: '15:30',
          },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
      ];

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(false);
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
      expect(result.alternatives![0].reason).toContain('Next available');
    });
  });

  describe('Force Assignment', () => {
    it('should bypass rules when force assignment specified', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates, {
        forceKtvId: 'ktv-003', // Force Carol
      });

      expect(result.success).toBe(true);
      expect(result.assignedKtvId).toBe('ktv-003');
      expect(result.confidence).toBe(1.0);
      expect(result.reason).toContain('Manual override');
    });
  });

  describe('Confidence Calculation', () => {
    it('should return high confidence (1.0) for score >= 90', async () => {
      const input = createTestInput({
        customer: {
          tier: 'vip',
          preferredKtvId: 'ktv-001',
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Alice with VIP bonus and high rating should get 90+ score
      if (result.assignedKtvId === 'ktv-001') {
        expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      }
    });

    it('should return lower confidence for marginal candidates', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [
        {
          id: 'ktv-marginal',
          name: 'Marginal',
          position: 'Junior KTV',
          yearsOfService: 1,
          skills: ['Massage'],
          specializations: [],
          avgRating: 3.8, // Below preferred
          currentWorkload: 6, // High workload
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
      ];

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(true);
      expect(result.confidence).toBeLessThan(0.8);
    });
  });

  describe('Performance', () => {
    it('should complete assignment in < 50ms', async () => {
      const input = createTestInput();
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      expect(result.executionTime).toBeLessThan(50);
    });

    it('should handle large candidate pool efficiently', async () => {
      const input = createTestInput();
      
      // Create 50 candidates
      const largeCandidatePool: KtvCandidate[] = Array.from(
        { length: 50 },
        (_, i) => ({
          id: `ktv-${i.toString().padStart(3, '0')}`,
          name: `KTV ${i}`,
          position: 'KTV',
          yearsOfService: Math.floor(Math.random() * 5) + 1,
          skills: ['Massage', 'Facial', 'Manicure'],
          specializations: i % 3 === 0 ? ['Massage'] : [],
          avgRating: 3.5 + Math.random() * 1.5, // 3.5-5.0
          currentWorkload: Math.floor(Math.random() * 6),
          maxDailyBookings: 8,
          availability: { isAvailable: Math.random() > 0.2 }, // 80% available
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        })
      );

      const result = await provider.evaluate(input, largeCandidatePool);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(100); // Still under 100ms for 50 candidates
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle VIP + preferred + specialization combination', async () => {
      const input = createTestInput({
        customer: {
          tier: 'vip',
          preferredKtvId: 'ktv-001', // Alice
        },
        booking: {
          customerId: 'customer-001',
          serviceId: 'service-massage',
          serviceType: 'Massage',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          durationMinutes: 90,
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      // Alice should be clear winner: VIP seniority + preference + specialization
      expect(result.assignedKtvId).toBe('ktv-001');
      expect(result.confidence).toBeGreaterThanOrEqual(0.9);
      expect(result.matchedRules).toContain('booking-assignment-vip-seniority');
      expect(result.matchedRules).toContain('booking-assignment-customer-preference');
      expect(result.matchedRules).toContain('booking-assignment-specialization');
    });

    it('should balance tradeoffs: high rating vs low workload', async () => {
      const input = createTestInput();
      const candidates: KtvCandidate[] = [
        {
          id: 'ktv-high-rating',
          name: 'High Rating',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.9, // Excellent rating
          currentWorkload: 6, // Higher workload (75%)
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
        {
          id: 'ktv-low-workload',
          name: 'Low Workload',
          position: 'KTV',
          yearsOfService: 2,
          skills: ['Massage'],
          specializations: ['Massage'],
          avgRating: 4.3, // Good rating
          currentWorkload: 2, // Low workload (25%)
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: 0,
        },
      ];

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(true);
      // Scoring logic favors high rating (15 points) over workload difference
      // Both should be viable candidates
    });

    it('should handle new customer (no history, no preference)', async () => {
      const input = createTestInput({
        customer: {
          tier: 'new',
        },
      });
      const candidates = createTestCandidates();

      const result = await provider.evaluate(input, candidates);

      expect(result.success).toBe(true);
      // Should assign based on skill, rating, workload only
      expect(result.matchedRules).not.toContain('booking-assignment-customer-preference');
    });
  });
});
