/**
 * Auto-Assignment Scoring & Decision Logic Tests
 * 
 * Granular validation of the mathematical correctness of candidate scoring,
 * ranking sorting, and large-scale Monte Carlo invariant checks.
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { AutoAssignmentProvider } from '../auto-assignment-provider';
import type { AutoAssignmentInput, KtvCandidate } from '../types';

describe('AutoAssignmentProvider Scoring & Ranking', () => {
  let provider: AutoAssignmentProvider;

  beforeEach(() => {
    provider = new AutoAssignmentProvider({ debug: false });
  });

  const createBaseInput = (overrides?: Partial<AutoAssignmentInput>): AutoAssignmentInput => ({
    tenantId: 'tenant-1',
    booking: {
      customerId: 'cust-1',
      serviceId: 'serv-1',
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
  });

  const createBaseCandidate = (overrides?: Partial<KtvCandidate>): KtvCandidate => ({
    id: 'ktv-1',
    name: 'KTV Test',
    position: 'KTV',
    yearsOfService: 2,
    skills: ['Massage'],
    specializations: [],
    avgRating: 4.5,
    currentWorkload: 0,
    maxDailyBookings: 8,
    availability: { isAvailable: true },
    isPreferredByCustomer: false,
    customerBookingCount: 1, // Set to 1 by default to avoid no-history penalty
    ...overrides,
  });

  // ============================================================================
  // UNIT TESTS: INDIVIDUAL SCORING COMPONENTS
  // ============================================================================

  describe('Individual Scoring Rules', () => {
    
    it('should calculate Skill Match score correctly (max 25 pts)', async () => {
      // 1. 100% Skill Match (KTV has all required skills)
      const input = createBaseInput({
        constraints: { requiredSkills: ['Massage', 'Facial'] }
      });
      const candidate100 = createBaseCandidate({ skills: ['Massage', 'Facial'] });
      const result100 = await provider.evaluate(input, [candidate100]);
      expect(result100.success).toBe(true);
      expect(result100.score?.components.skillMatch).toBe(25);

      // 2. Missing required skill -> filtered out from evaluation
      const candidateMissing = createBaseCandidate({ skills: ['Massage'] });
      const resultMissing = await provider.evaluate(input, [candidateMissing]);
      expect(resultMissing.success).toBe(false);
      expect(resultMissing.assignedKtvId).toBeNull();
      expect(resultMissing.score).toBeUndefined();

      // 3. No required skills specified -> defaults to full points (25 pts)
      const inputNoRequired = createBaseInput();
      const candidate0 = createBaseCandidate({ skills: [] });
      const result0 = await provider.evaluate(inputNoRequired, [candidate0]);
      expect(result0.success).toBe(true);
      expect(result0.score?.components.skillMatch).toBe(25);
    });

    it('should award full Availability points (20 pts) to eligible candidates', async () => {
      const input = createBaseInput();
      const candidate = createBaseCandidate();
      const result = await provider.evaluate(input, [candidate]);
      expect(result.score?.components.availability).toBe(20);
    });

    it('should calculate Workload Balance score correctly (max 20 pts)', async () => {
      const input = createBaseInput();

      // 1. 0% workload (0/8) -> 20 points
      const candidate0 = createBaseCandidate({ currentWorkload: 0 });
      const result0 = await provider.evaluate(input, [candidate0]);
      expect(result0.score?.components.workloadBalance).toBe(20);

      // 2. 50% workload (4/8) -> 10 points
      const candidate50 = createBaseCandidate({ currentWorkload: 4 });
      const result50 = await provider.evaluate(input, [candidate50]);
      expect(result50.score?.components.workloadBalance).toBe(10);

      // 3. 100% workload (8/8) -> filtered out, but 7/8 (87.5% load) -> 2.5 points
      const candidate87 = createBaseCandidate({ currentWorkload: 7 });
      const result87 = await provider.evaluate(input, [candidate87]);
      expect(result87.score?.components.workloadBalance).toBeCloseTo(2.5, 1);
    });

    it('should calculate Performance score proportionally to rating (max 15 pts)', async () => {
      const input = createBaseInput();

      // 1. 5.0 Rating -> 15 points
      const candidate5 = createBaseCandidate({ avgRating: 5.0 });
      const result5 = await provider.evaluate(input, [candidate5]);
      expect(result5.score?.components.performance).toBe(15);

      // 2. 4.0 Rating -> 12 points
      const candidate4 = createBaseCandidate({ avgRating: 4.0 });
      const result4 = await provider.evaluate(input, [candidate4]);
      expect(result4.score?.components.performance).toBe(12);
    });

    it('should calculate Customer Preference and history points correctly (max 10 pts)', async () => {
      // 1. Explicit preferred KTV -> 10 points
      const inputPreferred = createBaseInput({
        customer: { tier: 'loyal', preferredKtvId: 'ktv-preferred' }
      });
      const candidatePref = createBaseCandidate({ id: 'ktv-preferred' });
      const resultPref = await provider.evaluate(inputPreferred, [candidatePref]);
      expect(resultPref.score?.components.customerPreference).toBe(10);

      // 2. History matching: 3 previous bookings -> 3 * 2 = 6 points
      const inputHistory = createBaseInput();
      const candidateHistory = createBaseCandidate({ customerBookingCount: 3 });
      const resultHistory = await provider.evaluate(inputHistory, [candidateHistory]);
      expect(resultHistory.score?.components.customerPreference).toBe(6);

      // 3. History matching capped at 10 points (e.g. 6 bookings -> 12 -> capped at 10)
      const candidateMaxHistory = createBaseCandidate({ customerBookingCount: 6 });
      const resultMaxHistory = await provider.evaluate(inputHistory, [candidateMaxHistory]);
      expect(resultMaxHistory.score?.components.customerPreference).toBe(10);
    });

    it('should award Specialization points correctly (max 10 pts)', async () => {
      // 1. Direct specialization match -> 10 points
      const inputDirect = createBaseInput({ booking: { serviceId: 's1', serviceType: 'Massage', requestedDate: '2026-07-15', requestedStartTime: '14:00', durationMinutes: 90 } });
      const candidateDirect = createBaseCandidate({ specializations: ['Massage'] });
      const resultDirect = await provider.evaluate(inputDirect, [candidateDirect]);
      expect(resultDirect.score?.components.specialization).toBe(10);

      // 2. Partial specialization match (related category, e.g., Swedish Massage is bodywork like Massage) -> 8 points
      const inputRelated = createBaseInput({ booking: { serviceId: 's1', serviceType: 'Swedish Massage', requestedDate: '2026-07-15', requestedStartTime: '14:00', durationMinutes: 90 } });
      const candidateRelated = createBaseCandidate({ specializations: ['Massage'] }); // Related category 'bodywork'
      const resultRelated = await provider.evaluate(inputRelated, [candidateRelated]);
      expect(resultRelated.score?.components.specialization).toBe(8);

      // 3. Mismatched specialization -> 5 points
      const inputMismatch = createBaseInput({ booking: { serviceId: 's1', serviceType: 'Facial', requestedDate: '2026-07-15', requestedStartTime: '14:00', durationMinutes: 90 } });
      const candidateMismatch = createBaseCandidate({ specializations: ['Massage'] }); // Skincare vs Bodywork
      const resultMismatch = await provider.evaluate(inputMismatch, [candidateMismatch]);
      expect(resultMismatch.score?.components.specialization).toBe(5);
    });

    it('should apply VIP Seniority Bonus (+15 pts) for senior KTVs serving VIP customers', async () => {
      const inputVip = createBaseInput({ customer: { tier: 'vip' } });

      // 1. VIP + Senior KTV (5 years experience) -> should apply bonus (+15 points added to performance component)
      const candidateSenior = createBaseCandidate({ yearsOfService: 5, avgRating: 4.0 }); // Base performance = 12
      const resultSenior = await provider.evaluate(inputVip, [candidateSenior]);
      expect(resultSenior.score?.components.performance).toBe(12 + 15); // 27 points
      expect(resultSenior.matchedRules).toContain('booking-assignment-vip-seniority');

      // 2. VIP + Junior KTV (1 year experience) -> no bonus
      const candidateJunior = createBaseCandidate({ yearsOfService: 1, avgRating: 4.0 });
      const resultJunior = await provider.evaluate(inputVip, [candidateJunior]);
      expect(resultJunior.score?.components.performance).toBe(12); // remains 12
      expect(resultJunior.matchedRules).not.toContain('booking-assignment-vip-seniority');
    });

    it('should apply Penalties (Low Rating, Overloaded, No History) correctly', async () => {
      const input = createBaseInput();

      // 1. Low Rating Penalty: rating < 3.5 -> -10 points
      const candidateLow = createBaseCandidate({ avgRating: 3.2 });
      const resultLow = await provider.evaluate(input, [candidateLow]);
      expect(resultLow.score?.penalties.lowRating).toBe(-10);
      expect(resultLow.matchedRules).toContain('booking-assignment-low-rating-penalty');

      // 2. Overloaded Penalty: workload > 80% (7/8 is 87.5%) -> -5 points
      const candidateOverloaded = createBaseCandidate({ currentWorkload: 7 });
      const resultOverloaded = await provider.evaluate(input, [candidateOverloaded]);
      expect(resultOverloaded.score?.penalties.overloaded).toBe(-5);

      // 3. No History Penalty: customerBookingCount === 0 -> -2 points
      const candidateNoHistory = createBaseCandidate({ customerBookingCount: 0 });
      const resultNoHistory = await provider.evaluate(input, [candidateNoHistory]);
      expect(resultNoHistory.score?.penalties.noHistory).toBe(-2);
    });
  });

  // ============================================================================
  // RANKING & SORTING TESTS
  // ============================================================================

  describe('Ranking and Sorting Logic', () => {
    it('should correctly calculate exact total scores and sort candidates in descending order', async () => {
      const input = createBaseInput();
      
      // Let's create 3 candidates designed to get specific scores:
      // Candidate A: Alice
      // Rating: 5.0 (Performance = 15)
      // Workload: 0 (Workload = 20)
      // Skills: Match (Skill = 25)
      // Preference: History = 3 (Preference = 6)
      // Specialization: Match (Specialty = 10)
      // Base Availability = 20
      // Total = 15 + 20 + 25 + 6 + 10 + 20 = 96 points (Penalty: none) -> Capped at 96
      const candidateA = createBaseCandidate({
        id: 'ktv-A',
        name: 'Alice',
        avgRating: 5.0,
        currentWorkload: 0,
        skills: ['Massage'],
        specializations: ['Massage'],
        customerBookingCount: 3,
      });

      // Candidate B: Bob
      // Rating: 4.0 (Performance = 12)
      // Workload: 4 (Workload = 10)
      // Skills: Match (Skill = 25)
      // Preference: History = 1 (Preference = 2)
      // Specialization: None (Specialty = 5)
      // Base Availability = 20
      // Total = 12 + 10 + 25 + 2 + 5 + 20 = 74 points
      const candidateB = createBaseCandidate({
        id: 'ktv-B',
        name: 'Bob',
        avgRating: 4.0,
        currentWorkload: 4,
        skills: ['Massage'],
        specializations: [],
        customerBookingCount: 1,
      });

      // Candidate C: Charlie (Low Rating Penalty)
      // Rating: 3.0 (Performance = 9)
      // Workload: 2 (Workload = 15)
      // Skills: Match (Skill = 25)
      // Preference: No history (Preference = 0, Penalty: noHistory = -2)
      // Specialization: None (Specialty = 5)
      // Base Availability = 20
      // Total = 9 + 15 + 25 + 0 + 5 + 20 - 10 (low rating) - 2 (no history) = 62 points
      const candidateC = createBaseCandidate({
        id: 'ktv-C',
        name: 'Charlie',
        avgRating: 3.0,
        currentWorkload: 2,
        skills: ['Massage'],
        specializations: [],
        customerBookingCount: 0,
      });

      // Evaluate candidate pool containing Alice, Bob, and Charlie
      const result = await provider.evaluate(input, [candidateB, candidateA, candidateC], { topN: 3 });

      expect(result.success).toBe(true);
      expect(result.assignedKtvId).toBe('ktv-A'); // Alice has 96 score, should be selected
      expect(result.score?.total).toBeCloseTo(96, 1);

      // Verify alternatives array is sorted in descending score order
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBe(2);
      
      const firstAlt = result.alternatives![0]; // Should be Bob (74)
      const secondAlt = result.alternatives![1]; // Should be Charlie (62)

      expect(firstAlt.ktvId).toBe('ktv-B');
      expect(firstAlt.score).toBeCloseTo(74, 1);
      expect(secondAlt.ktvId).toBe('ktv-C');
      expect(secondAlt.score).toBeCloseTo(62, 1);

      // Assert descending order
      expect(firstAlt.score).toBeGreaterThan(secondAlt.score);
    });
  });

  // ============================================================================
  // MONTE CARLO INVARIANT SIMULATION
  //
  // Scope: Verify HARD INVARIANTS only — properties that must ALWAYS hold
  // regardless of algorithm weights, candidate count, or service type.
  //
  // ✅ IN SCOPE (always-true properties):
  //   - Inactive KTVs are never selected
  //   - KTVs never exceed maxDailyBookings
  //   - KTVs without required skills are never selected
  //   - VIP customers always get KTVs meeting minRating
  //   - evaluationMetadata is populated correctly
  //
  // ❌ OUT OF SCOPE (flaky statistical properties):
  //   - Distribution fairness ("A should be selected ~X% of the time")
  //   - Average score thresholds ("mean score must be > N")
  //   - Ranking frequency ("KTV B should be chosen more than KTV C")
  //   - These assertions break when algorithm weights change and belong
  //     in regression snapshots, NOT in Monte Carlo tests.
  // ============================================================================

  describe('Monte Carlo Invariant Simulation', () => {
    it('should satisfy all system invariants over 2000 randomized booking allocations', async () => {
      // 1. Generate 100 randomized KTVs
      const skillsPool = ['Massage', 'Facial', 'Manicure', 'Pedicure', 'Acupressure'];
      const positionTiers = ['Junior KTV', 'KTV', 'Senior KTV'];
      
      const ktvs: KtvCandidate[] = Array.from({ length: 100 }, (_, index) => {
        // Random rating between 3.0 and 5.0
        const avgRating = Number((3.0 + Math.random() * 2.0).toFixed(1));
        // Random skills (at least 2 skills)
        const ktvSkills = [...skillsPool].sort(() => 0.5 - Math.random()).slice(0, 2 + Math.floor(Math.random() * 3));
        const specializations = [ktvSkills[0]];
        const yearsOfService = Math.floor(Math.random() * 8);

        return {
          id: `mc-ktv-${index}`,
          name: `MC KTV ${index}`,
          position: positionTiers[Math.floor(Math.random() * positionTiers.length)],
          yearsOfService,
          skills: ktvSkills,
          specializations,
          avgRating,
          currentWorkload: 0, // Reset for simulation start
          maxDailyBookings: 8,
          availability: { isAvailable: true },
          isPreferredByCustomer: false,
          customerBookingCount: Math.floor(Math.random() * 5),
        };
      });

      // 2. Add 2 inactive/invalid KTVs to ensure they are never assigned
      const inactiveKtv1 = createBaseCandidate({ id: 'ktv-inactive-1', availability: { isAvailable: false } });
      const inactiveKtv2 = createBaseCandidate({ id: 'ktv-inactive-2', currentWorkload: 8 }); // Max workload
      const ktvPoolWithInvalids = [...ktvs, inactiveKtv1, inactiveKtv2];

      // 3. Run 2000 random evaluations and assert invariants
      const serviceTypes = ['Massage', 'Facial', 'Manicure'];
      const customerTiers: Array<'vip' | 'loyal' | 'new'> = ['vip', 'loyal', 'new'];

      for (let i = 0; i < 2000; i++) {
        const randomService = serviceTypes[Math.floor(Math.random() * serviceTypes.length)];
        const randomTier = customerTiers[Math.floor(Math.random() * customerTiers.length)];
        const requiredSkill = randomService; // Require skill matching service type

        const input = createBaseInput({
          booking: {
            customerId: `cust-mc-${i}`,
            serviceId: `serv-mc-${i}`,
            serviceType: randomService,
            requestedDate: '2026-07-15',
            requestedStartTime: '14:00',
            durationMinutes: 60,
          },
          customer: {
            tier: randomTier,
          },
          constraints: {
            requiredSkills: [requiredSkill],
            minRating: randomTier === 'vip' ? 4.0 : undefined,
          },
        });

        // Evaluate booking request
        const result = await provider.evaluate(input, ktvPoolWithInvalids);

        if (result.success) {
          expect(result.assignedKtvId).toBeDefined();
          
          // Locate the assigned KTV candidate
          const assignedKtv = ktvPoolWithInvalids.find(c => c.id === result.assignedKtvId);
          expect(assignedKtv).toBeDefined();
          
          // INVARIANT 1: No inactive KTV is ever selected
          expect(result.assignedKtvId).not.toBe('ktv-inactive-1');
          expect(result.assignedKtvId).not.toBe('ktv-inactive-2');
          expect(assignedKtv!.availability.isAvailable).toBe(true);

          // INVARIANT 2: No KTV exceeds daily booking limit
          expect(assignedKtv!.currentWorkload).toBeLessThan(assignedKtv!.maxDailyBookings);

          // INVARIANT 3: Selected KTV possesses the required skill
          expect(assignedKtv!.skills).toContain(requiredSkill);

          // INVARIANT 4: VIP customer matches rating constraints
          if (randomTier === 'vip') {
            expect(assignedKtv!.avgRating).toBeGreaterThanOrEqual(4.0);
          }

          // INVARIANT 5: evaluationMetadata is always populated
          expect(result.evaluationMetadata).toBeDefined();
          expect(result.evaluationMetadata!.algorithmVersion).toBeDefined();
          expect(result.evaluationMetadata!.totalCandidates).toBeGreaterThan(0);
          expect(result.evaluationMetadata!.eligibleCandidates).toBeGreaterThanOrEqual(1);
          expect(result.evaluationMetadata!.eligibleCandidates).toBeLessThanOrEqual(
            result.evaluationMetadata!.totalCandidates
          );
          expect(result.evaluationMetadata!.executionTimeMs).toBeGreaterThanOrEqual(0);

          // Simulate workload increment for the selected KTV for future iterations
          assignedKtv!.currentWorkload += 1;
          if (assignedKtv!.currentWorkload >= assignedKtv!.maxDailyBookings) {
            assignedKtv!.availability.isAvailable = false; // Mark busy if reached limit
          }
        }
      }
    });
  });
});
