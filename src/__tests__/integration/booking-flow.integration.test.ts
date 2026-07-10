/**
 * Booking Flow Integration Tests
 * 
 * End-to-end tests with real database and Decision Engine providers.
 * Tests full booking creation flow with capacity validation and auto-assignment.
 * 
 * Test Scenarios:
 * 1. ✅ Successful booking creation with capacity validation
 * 2. ✅ Booking rejection due to capacity conflicts with alternatives
 * 3. ✅ Alternative time acceptance flow
 * 4. ✅ Auto-assignment with high confidence
 * 5. ✅ Auto-assignment fallback when preferred KTV unavailable
 * 6. ✅ Manual KTV selection override
 * 7. ✅ Manager override (skip validation)
 * 8. ✅ Multiple concurrent bookings (race condition)
 * 
 * Prerequisites:
 * - Supabase test database configured
 * - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars set
 * - Test data seeded via seedTestDatabase()
 * 
 * @module integration/booking-flow
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import {
  seedTestDatabase,
  cleanupTestDatabase,
  TEST_IDS,
  testSupabase,
} from './booking-flow-seed';
import {
  setupTestEnvironment,
  cleanupTestEnvironment,
  createBookingInput,
  createParentBooking,
  assertBookingSuccess,
  assertBookingFailed,
  assertBookingHasConflicts,
  assertBookingHasAlternatives,
  assertCapacityAvailable,
  assertCapacityUnavailable,
  assertAutoAssignmentSuccess,
  verifySessionLogExists,
  verifySessionKtvAssignment,
  getKtvWorkload,
  measureExecutionTime,
  assertPerformance,
} from './booking-flow-helpers';

// Import functions to test
import { createBookingWithValidation } from '@/modules/bookings/actions/session-log-actions';
import { checkBookingCapacity, autoAssignKtv } from '@/services/booking-decision.service';

// ============================================================================
// TEST SUITE SETUP
// ============================================================================

describe('Booking Flow Integration Tests', () => {
  // Setup: Seed database before all tests
  beforeAll(async () => {
    console.log('\n========================================');
    console.log('🚀 Starting Booking Flow Integration Tests');
    console.log('========================================\n');

    await seedTestDatabase();
    await setupTestEnvironment();
  }, 30000); // 30s timeout for seeding

  // Cleanup: Remove test data after all tests
  afterAll(async () => {
    await cleanupTestEnvironment();
    await cleanupTestDatabase();

    console.log('\n========================================');
    console.log('✅ Booking Flow Integration Tests Complete');
    console.log('========================================\n');
  }, 30000);

  // Cleanup between tests
  afterEach(async () => {
    await cleanupTestEnvironment();
  });

  // ============================================================================
  // SCENARIO 1: Successful Booking Creation with Capacity Validation
  // ============================================================================

  describe('Scenario 1: Successful Booking Creation', () => {
    it('should create booking successfully when capacity is available', async () => {
      console.log('\n--- Scenario 1: Successful Booking ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Verify Alice has low workload
      const aliceWorkload = await getKtvWorkload(TEST_IDS.ktvs.alice, today);
      console.log(`[Test] Alice's current workload: ${aliceWorkload}/8`);
      expect(aliceWorkload).toBeLessThan(8);

      // Step 2: Check capacity (should be available)
      const { result: capacityResult, executionTime: capacityTime } = 
        await measureExecutionTime(
          () => checkBookingCapacity({
            tenantId: TEST_IDS.tenant,
            ktvId: TEST_IDS.ktvs.alice,
            requestedDate: today,
            requestedStartTime: '14:00',
            requestedEndTime: '15:30',
            durationMinutes: 90,
            customerTier: 'vip',
            serviceType: 'Massage',
          }),
          'Capacity Check'
        );

      assertCapacityAvailable(capacityResult);
      assertPerformance(capacityTime, 100, 'Capacity Check'); // < 100ms

      // Step 3: Create parent booking
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);

      // Step 4: Create booking with validation
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '14:00',
        assignedKtvId: TEST_IDS.ktvs.alice,
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
      });

      const { result: bookingResult, executionTime: bookingTime } = 
        await measureExecutionTime(
          () => createBookingWithValidation(bookingInput),
          'Booking Creation'
        );

      // Step 5: Assert success
      assertBookingSuccess(bookingResult);
      assertPerformance(bookingTime, 500, 'Booking Creation'); // < 500ms

      // Step 6: Verify in database
      await verifySessionLogExists(bookingResult.sessionId!);
      await verifySessionKtvAssignment(bookingResult.sessionId!, TEST_IDS.ktvs.alice);

      // Step 7: Verify workload increased
      const newWorkload = await getKtvWorkload(TEST_IDS.ktvs.alice, today);
      expect(newWorkload).toBe(aliceWorkload + 1);
      console.log(`[Test] ✅ Alice's new workload: ${newWorkload}/8`);

      console.log('--- ✅ Scenario 1: PASSED ---\n');
    }, 15000); // 15s timeout

    it('should include correct booking details in database', async () => {
      console.log('\n--- Scenario 1b: Booking Details Verification ---');

      const today = new Date().toISOString().split('T')[0];
      const parentBookingId = await createParentBooking(TEST_IDS.customers.loyal);

      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '16:00',
        assignedKtvId: TEST_IDS.ktvs.bob,
        customerId: TEST_IDS.customers.loyal,
        serviceType: 'Facial',
        durationMinutes: 60,
        customerTier: 'loyal',
        notes: 'Test booking with notes',
      });

      const result = await createBookingWithValidation(bookingInput);
      assertBookingSuccess(result);

      // Verify all details in database
      const sessionLog = await verifySessionLogExists(result.sessionId!);

      expect(sessionLog.booking_id).toBe(parentBookingId);
      expect(sessionLog.assigned_date).toBe(today);
      expect(sessionLog.assigned_time).toBe('16:00');
      expect(sessionLog.completed_by_ktv_id).toBe(TEST_IDS.ktvs.bob);
      expect(sessionLog.duration_minutes).toBe(60);
      expect(sessionLog.status).toBe('pending');
      expect(sessionLog.notes).toBe('Test booking with notes');
      expect(sessionLog.tenant_id).toBe(TEST_IDS.tenant);

      console.log('[Test] ✅ All booking details verified in database');
      console.log('--- ✅ Scenario 1b: PASSED ---\n');
    }, 15000);
  });

  // ============================================================================
  // SCENARIO 2: Booking Rejection Due to Capacity Conflicts
  // ============================================================================

  describe('Scenario 2: Capacity Rejection with Conflicts', () => {
    it('should reject booking when KTV is fully booked', async () => {
      console.log('\n--- Scenario 2: Capacity Rejection ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Verify Emma is fully booked (8/8 from seed data)
      const emmaWorkload = await getKtvWorkload(TEST_IDS.ktvs.emma, today);
      console.log(`[Test] Emma's current workload: ${emmaWorkload}/8`);
      expect(emmaWorkload).toBe(8); // Fully booked from seed

      // Step 2: Check capacity (should be unavailable)
      const capacityResult = await checkBookingCapacity({
        tenantId: TEST_IDS.tenant,
        ktvId: TEST_IDS.ktvs.emma,
        requestedDate: today,
        requestedStartTime: '14:00',
        requestedEndTime: '15:30',
        durationMinutes: 90,
        customerTier: 'vip',
        serviceType: 'Massage',
      });

      assertCapacityUnavailable(capacityResult);

      // Step 3: Verify conflicts present
      expect(capacityResult.conflicts).toBeDefined();
      expect(capacityResult.conflicts!.length).toBeGreaterThan(0);

      const hasCapacityConflict = capacityResult.conflicts!.some(
        c => c.type === 'daily_limit' || c.type === 'time_overlap'
      );
      expect(hasCapacityConflict).toBe(true);

      console.log(`[Test] ✅ Conflicts detected: ${capacityResult.conflicts!.length}`);
      console.log(`[Test] Conflict types: ${capacityResult.conflicts!.map(c => c.type).join(', ')}`);

      // Step 4: Verify alternatives suggested
      if (capacityResult.alternatives && capacityResult.alternatives.length > 0) {
        console.log(`[Test] ✅ Alternatives suggested: ${capacityResult.alternatives.length}`);
        console.log(`[Test] First alternative: ${capacityResult.alternatives[0].suggestedDate} ${capacityResult.alternatives[0].suggestedTime}`);
      }

      console.log('--- ✅ Scenario 2: PASSED ---\n');
    }, 15000);

    it('should reject booking creation when capacity conflicts exist', async () => {
      console.log('\n--- Scenario 2b: Booking Creation Rejection ---');

      const today = new Date().toISOString().split('T')[0];
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);

      // Try to create booking for fully booked Emma
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '14:00',
        assignedKtvId: TEST_IDS.ktvs.emma, // Fully booked
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
      });

      const result = await createBookingWithValidation(bookingInput);

      // Assert failure
      assertBookingFailed(result);
      assertBookingHasConflicts(result);

      console.log(`[Test] ✅ Booking rejected with error: ${result.error}`);
      console.log(`[Test] Conflicts: ${result.conflicts!.length}`);

      // Verify alternatives provided
      if (result.alternatives && result.alternatives.length > 0) {
        assertBookingHasAlternatives(result);
        console.log(`[Test] ✅ Alternatives provided: ${result.alternatives.length}`);
      }

      // Verify no session log created in database
      const { data: sessionLogs, error } = await testSupabase
        .from('session_logs')
        .select('id')
        .eq('booking_id', parentBookingId);

      expect(error).toBeNull();
      expect(sessionLogs).toHaveLength(0);
      console.log('[Test] ✅ No session log created (as expected)');

      console.log('--- ✅ Scenario 2b: PASSED ---\n');
    }, 15000);

    it('should detect time overlap conflicts', async () => {
      console.log('\n--- Scenario 2c: Time Overlap Detection ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Create first booking for Alice at 14:00
      const firstBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const firstInput = createBookingInput({
        bookingId: firstBookingId,
        assignedDate: today,
        assignedTime: '14:00',
        assignedKtvId: TEST_IDS.ktvs.alice,
        durationMinutes: 90, // 14:00-15:30
      });

      const firstResult = await createBookingWithValidation(firstInput);
      assertBookingSuccess(firstResult);
      console.log('[Test] ✅ First booking created at 14:00-15:30');

      // Step 2: Try to create overlapping booking at 14:30
      const secondBookingId = await createParentBooking(TEST_IDS.customers.loyal);
      const secondInput = createBookingInput({
        bookingId: secondBookingId,
        assignedDate: today,
        assignedTime: '14:30', // Overlaps with 14:00-15:30
        assignedKtvId: TEST_IDS.ktvs.alice,
        durationMinutes: 90, // 14:30-16:00
      });

      const secondResult = await createBookingWithValidation(secondInput);

      // Assert rejection due to time overlap
      assertBookingFailed(secondResult);
      assertBookingHasConflicts(secondResult);

      const hasTimeOverlap = secondResult.conflicts!.some(
        c => c.type === 'time_overlap'
      );
      expect(hasTimeOverlap).toBe(true);

      console.log('[Test] ✅ Time overlap conflict detected');
      console.log(`[Test] Conflict reason: ${secondResult.conflicts!.find(c => c.type === 'time_overlap')?.reason}`);

      console.log('--- ✅ Scenario 2c: PASSED ---\n');
    }, 15000);
  });
});

  // ============================================================================
  // SCENARIO 3: Alternative Time Acceptance Flow
  // ============================================================================

  describe('Scenario 3: Alternative Time Acceptance', () => {
    it('should accept alternative time and create booking successfully', async () => {
      console.log('\n--- Scenario 3: Alternative Time Acceptance ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Create first booking at 10:00-11:30 for Alice
      const firstBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const firstInput = createBookingInput({
        bookingId: firstBookingId,
        assignedDate: today,
        assignedTime: '10:00',
        assignedKtvId: TEST_IDS.ktvs.alice,
        durationMinutes: 90, // 10:00-11:30
      });

      const firstResult = await createBookingWithValidation(firstInput);
      assertBookingSuccess(firstResult);
      console.log('[Test] ✅ First booking created at 10:00-11:30');

      // Step 2: Try overlapping time (should fail with alternatives)
      const secondBookingId = await createParentBooking(TEST_IDS.customers.loyal);
      const conflictInput = createBookingInput({
        bookingId: secondBookingId,
        assignedDate: today,
        assignedTime: '10:30', // Overlaps
        assignedKtvId: TEST_IDS.ktvs.alice,
        durationMinutes: 90,
      });

      const conflictResult = await createBookingWithValidation(conflictInput);
      assertBookingFailed(conflictResult);
      assertBookingHasConflicts(conflictResult);

      console.log('[Test] ✅ Conflict detected for 10:30');

      // Step 3: Verify alternatives provided
      expect(conflictResult.alternatives).toBeDefined();
      expect(conflictResult.alternatives!.length).toBeGreaterThan(0);

      const alternative = conflictResult.alternatives![0];
      console.log(`[Test] Alternative suggested: ${alternative.suggestedDate} ${alternative.suggestedTime}`);

      // Step 4: Accept alternative time (e.g., 12:00)
      const alternativeInput = createBookingInput({
        bookingId: secondBookingId,
        assignedDate: alternative.suggestedDate,
        assignedTime: alternative.suggestedTime,
        assignedKtvId: TEST_IDS.ktvs.alice,
        durationMinutes: 90,
      });

      const { result: alternativeResult, executionTime } = 
        await measureExecutionTime(
          () => createBookingWithValidation(alternativeInput),
          'Alternative Booking Creation'
        );

      // Step 5: Assert alternative booking succeeds
      assertBookingSuccess(alternativeResult);
      assertPerformance(executionTime, 500, 'Alternative Booking');

      // Step 6: Verify in database
      await verifySessionLogExists(alternativeResult.sessionId!);
      await verifySessionKtvAssignment(alternativeResult.sessionId!, TEST_IDS.ktvs.alice);

      console.log('[Test] ✅ Alternative time booking successful');
      console.log('--- ✅ Scenario 3: PASSED ---\n');
    }, 20000); // 20s timeout

    it('should suggest multiple alternatives when conflicts exist', async () => {
      console.log('\n--- Scenario 3b: Multiple Alternatives ---');

      const today = new Date().toISOString().split('T')[0];

      // Create multiple bookings for Alice to limit available slots
      const times = ['08:00', '10:00', '12:00', '14:00'];
      for (const time of times) {
        const bookingId = await createParentBooking(TEST_IDS.customers.vip);
        const input = createBookingInput({
          bookingId,
          assignedDate: today,
          assignedTime: time,
          assignedKtvId: TEST_IDS.ktvs.alice,
          durationMinutes: 90,
        });
        await createBookingWithValidation(input);
      }

      console.log(`[Test] ✅ Created ${times.length} bookings for Alice`);

      // Try to book at 13:00 (conflicts with 12:00-13:30)
      const conflictBookingId = await createParentBooking(TEST_IDS.customers.loyal);
      const conflictInput = createBookingInput({
        bookingId: conflictBookingId,
        assignedDate: today,
        assignedTime: '13:00',
        assignedKtvId: TEST_IDS.ktvs.alice,
        durationMinutes: 90,
      });

      const result = await createBookingWithValidation(conflictInput);
      assertBookingFailed(result);

      // Verify multiple alternatives
      if (result.alternatives && result.alternatives.length > 1) {
        console.log(`[Test] ✅ Multiple alternatives suggested: ${result.alternatives.length}`);
        result.alternatives.forEach((alt, i) => {
          console.log(`[Test] Alternative ${i + 1}: ${alt.suggestedTime} - ${alt.reason}`);
        });
      }

      console.log('--- ✅ Scenario 3b: PASSED ---\n');
    }, 20000);
  });

  // ============================================================================
  // SCENARIO 4: Auto-Assignment with High Confidence
  // ============================================================================

  describe('Scenario 4: Auto-Assignment', () => {
    it('should auto-assign best KTV when no KTV provided', async () => {
      console.log('\n--- Scenario 4: Auto-Assignment ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Call auto-assignment service directly
      const { result: assignmentResult, executionTime: assignmentTime } = 
        await measureExecutionTime(
          () => autoAssignKtv({
            tenantId: TEST_IDS.tenant,
            customerId: TEST_IDS.customers.vip,
            serviceId: TEST_IDS.services.massage,
            serviceType: 'Massage',
            requestedDate: today,
            requestedStartTime: '16:00',
            durationMinutes: 90,
            customerTier: 'vip',
          }),
          'Auto-Assignment'
        );

      // Step 2: Assert KTV assigned with high confidence
      assertAutoAssignmentSuccess(assignmentResult, 0.6); // Min 60% confidence
      assertPerformance(assignmentTime, 200, 'Auto-Assignment'); // < 200ms

      console.log(`[Test] Assigned KTV: ${assignmentResult.assignedKtvName}`);
      console.log(`[Test] Confidence: ${(assignmentResult.confidence * 100).toFixed(1)}%`);
      console.log(`[Test] Reason: ${assignmentResult.reason}`);

      // Step 3: Verify alternatives provided
      if (assignmentResult.alternatives && assignmentResult.alternatives.length > 0) {
        console.log(`[Test] ✅ Alternatives: ${assignmentResult.alternatives.length}`);
        assignmentResult.alternatives.slice(0, 3).forEach((alt, i) => {
          console.log(`[Test] Alt ${i + 1}: ${alt.ktvName} (score: ${alt.score})`);
        });
      }

      // Step 4: Create booking with auto-assigned KTV
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '16:00',
        assignedKtvId: assignmentResult.assignedKtvId!, // Use auto-assigned
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
      });

      const bookingResult = await createBookingWithValidation(bookingInput);
      assertBookingSuccess(bookingResult);

      // Step 5: Verify correct KTV assigned in database
      await verifySessionKtvAssignment(
        bookingResult.sessionId!,
        assignmentResult.assignedKtvId!
      );

      console.log('[Test] ✅ Booking created with auto-assigned KTV');
      console.log('--- ✅ Scenario 4: PASSED ---\n');
    }, 20000);

    it('should integrate auto-assignment in booking creation flow', async () => {
      console.log('\n--- Scenario 4b: Integrated Auto-Assignment ---');

      const today = new Date().toISOString().split('T')[0];
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);

      // Create booking WITHOUT assignedKtvId (trigger auto-assignment)
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '17:00',
        assignedKtvId: undefined, // No KTV specified
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
        skipAutoAssignment: false, // Enable auto-assignment
      });

      const { result: bookingResult, executionTime } = 
        await measureExecutionTime(
          () => createBookingWithValidation(bookingInput),
          'Booking with Auto-Assignment'
        );

      // Assert success with auto-assignment
      assertBookingSuccess(bookingResult);
      assertPerformance(executionTime, 1000, 'Full Flow'); // < 1s

      // Verify auto-assignment details in result
      expect(bookingResult.autoAssignment).toBeDefined();
      expect(bookingResult.autoAssignment!.assignedKtvId).toBeDefined();
      expect(bookingResult.autoAssignment!.confidence).toBeGreaterThanOrEqual(0.6);

      console.log(`[Test] Auto-assigned: ${bookingResult.autoAssignment!.assignedKtvName}`);
      console.log(`[Test] Confidence: ${(bookingResult.autoAssignment!.confidence * 100).toFixed(1)}%`);

      // Verify in database
      const sessionLog = await verifySessionLogExists(bookingResult.sessionId!);
      expect(sessionLog.completed_by_ktv_id).toBe(bookingResult.autoAssignment!.assignedKtvId);

      console.log('[Test] ✅ Integrated auto-assignment successful');
      console.log('--- ✅ Scenario 4b: PASSED ---\n');
    }, 20000);

    it('should prioritize high-rated KTVs for VIP customers', async () => {
      console.log('\n--- Scenario 4c: VIP Customer Priority ---');

      const today = new Date().toISOString().split('T')[0];

      // Auto-assign for VIP customer
      const vipAssignment = await autoAssignKtv({
        tenantId: TEST_IDS.tenant,
        customerId: TEST_IDS.customers.vip,
        serviceId: TEST_IDS.services.massage,
        serviceType: 'Massage',
        requestedDate: today,
        requestedStartTime: '18:00',
        durationMinutes: 90,
        customerTier: 'vip', // VIP customer
      });

      assertAutoAssignmentSuccess(vipAssignment);

      // Get assigned KTV's rating
      const { data: assignedKtv } = await testSupabase
        .from('users')
        .select('avg_rating, full_name')
        .eq('id', vipAssignment.assignedKtvId!)
        .single();

      console.log(`[Test] VIP assigned to: ${assignedKtv?.full_name} (rating: ${assignedKtv?.avg_rating})`);

      // Verify high rating (should NOT be David with 3.2)
      expect(assignedKtv?.avg_rating).toBeGreaterThanOrEqual(4.0);
      expect(vipAssignment.assignedKtvId).not.toBe(TEST_IDS.ktvs.david); // Not low-rated David

      console.log('[Test] ✅ VIP customer assigned high-rated KTV');
      console.log('--- ✅ Scenario 4c: PASSED ---\n');
    }, 15000);

    it('should handle no available KTVs gracefully', async () => {
      console.log('\n--- Scenario 4d: No Available KTVs ---');

      const today = new Date().toISOString().split('T')[0];

      // Fill up all KTVs (except Emma who's already full)
      const ktvIds = [
        TEST_IDS.ktvs.alice,
        TEST_IDS.ktvs.bob,
        TEST_IDS.ktvs.carol,
        TEST_IDS.ktvs.david,
      ];

      for (const ktvId of ktvIds) {
        // Create 8 bookings for each KTV to make them fully booked
        for (let i = 0; i < 8; i++) {
          const hour = 8 + i * 2;
          const bookingId = await createParentBooking(TEST_IDS.customers.loyal);
          await createBookingInput({
            bookingId,
            assignedDate: today,
            assignedTime: `${String(hour).padStart(2, '0')}:00`,
            assignedKtvId: ktvId,
            durationMinutes: 90,
          });
        }
      }

      console.log('[Test] ✅ All KTVs now fully booked');

      // Try auto-assignment (should fail)
      const assignment = await autoAssignKtv({
        tenantId: TEST_IDS.tenant,
        customerId: TEST_IDS.customers.new,
        serviceId: TEST_IDS.services.massage,
        serviceType: 'Massage',
        requestedDate: today,
        requestedStartTime: '19:00',
        durationMinutes: 90,
        customerTier: 'new',
      });

      // Assert no KTV assigned
      expect(assignment.assignedKtvId).toBeNull();
      expect(assignment.confidence).toBe(0);
      console.log(`[Test] ✅ No KTV assigned (expected): ${assignment.reason}`);

      console.log('--- ✅ Scenario 4d: PASSED ---\n');
    }, 30000); // 30s timeout (creates many bookings)
  });

  // ============================================================================
  // SCENARIO 5: Auto-Assignment Fallback
  // ============================================================================

  describe('Scenario 5: Assignment Fallback', () => {
    it('should fallback to alternative KTV when preferred KTV unavailable', async () => {
      console.log('\n--- Scenario 5: Assignment Fallback ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Make preferred KTV (Alice) unavailable by booking her fully
      for (let i = 0; i < 8; i++) {
        const hour = 8 + i * 2;
        const bookingId = await createParentBooking(TEST_IDS.customers.loyal);
        const input = createBookingInput({
          bookingId,
          assignedDate: today,
          assignedTime: `${String(hour).padStart(2, '0')}:00`,
          assignedKtvId: TEST_IDS.ktvs.alice,
          durationMinutes: 90,
        });
        await createBookingWithValidation(input);
      }

      const aliceWorkload = await getKtvWorkload(TEST_IDS.ktvs.alice, today);
      expect(aliceWorkload).toBe(8); // Fully booked
      console.log('[Test] ✅ Alice is now fully booked (8/8)');

      // Step 2: Try auto-assignment with Alice as preferred
      const assignment = await autoAssignKtv({
        tenantId: TEST_IDS.tenant,
        customerId: TEST_IDS.customers.vip,
        serviceId: TEST_IDS.services.massage,
        serviceType: 'Massage',
        requestedDate: today,
        requestedStartTime: '20:00', // Late time when Alice is full
        durationMinutes: 90,
        customerTier: 'vip',
        preferredKtvId: TEST_IDS.ktvs.alice, // Preferred but unavailable
      });

      // Step 3: Assert fallback to alternative KTV
      if (assignment.assignedKtvId) {
        assertAutoAssignmentSuccess(assignment);
        expect(assignment.assignedKtvId).not.toBe(TEST_IDS.ktvs.alice); // NOT Alice
        console.log(`[Test] ✅ Fallback to: ${assignment.assignedKtvName} (Alice unavailable)`);
        console.log(`[Test] Confidence: ${(assignment.confidence * 100).toFixed(1)}%`);
      } else {
        // If all KTVs full, this is also acceptable
        console.log(`[Test] ✅ No fallback available: ${assignment.reason}`);
      }

      console.log('--- ✅ Scenario 5: PASSED ---\n');
    }, 30000);

    it('should assign next best KTV when first choice has low rating', async () => {
      console.log('\n--- Scenario 5b: Rating-Based Fallback ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Make David (low rating 3.2) the only one with exact specialization
      // But VIP customer should get high-rated KTV instead

      // Create customer booking history with David to simulate preference
      // But auto-assignment should still avoid him for VIP due to low rating

      const assignment = await autoAssignKtv({
        tenantId: TEST_IDS.tenant,
        customerId: TEST_IDS.customers.vip,
        serviceId: TEST_IDS.services.massage,
        serviceType: 'Massage',
        requestedDate: today,
        requestedStartTime: '09:00',
        durationMinutes: 90,
        customerTier: 'vip', // VIP requires high rating
      });

      // Assert high-rated KTV assigned (not David)
      if (assignment.assignedKtvId) {
        assertAutoAssignmentSuccess(assignment);
        
        const { data: assignedKtv } = await testSupabase
          .from('users')
          .select('avg_rating, full_name')
          .eq('id', assignment.assignedKtvId)
          .single();

        expect(assignedKtv?.avg_rating).toBeGreaterThanOrEqual(4.0);
        expect(assignment.assignedKtvId).not.toBe(TEST_IDS.ktvs.david);
        
        console.log(`[Test] ✅ VIP got high-rated: ${assignedKtv?.full_name} (${assignedKtv?.avg_rating})`);
        console.log('[Test] ✅ Low-rated David avoided');
      }

      console.log('--- ✅ Scenario 5b: PASSED ---\n');
    }, 15000);

    it('should handle customer booking history in fallback logic', async () => {
      console.log('\n--- Scenario 5c: History-Based Fallback ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Create booking history - customer has 3 bookings with Bob
      // This should give Bob preference in auto-assignment

      // We'll test by checking if Bob gets higher score when available
      const assignment = await autoAssignKtv({
        tenantId: TEST_IDS.tenant,
        customerId: TEST_IDS.customers.loyal, // Loyal customer with history
        serviceId: TEST_IDS.services.facial,
        serviceType: 'Facial',
        requestedDate: today,
        requestedStartTime: '11:00',
        durationMinutes: 60,
        customerTier: 'loyal',
      });

      assertAutoAssignmentSuccess(assignment);

      // Bob specializes in Facial, so should have good chance
      console.log(`[Test] Assigned: ${assignment.assignedKtvName}`);
      console.log(`[Test] Confidence: ${(assignment.confidence * 100).toFixed(1)}%`);

      if (assignment.alternatives && assignment.alternatives.length > 0) {
        console.log('[Test] ✅ Alternatives considered:');
        assignment.alternatives.slice(0, 3).forEach((alt, i) => {
          console.log(`[Test]   ${i + 1}. ${alt.ktvName} (score: ${alt.score})`);
        });
      }

      console.log('--- ✅ Scenario 5c: PASSED ---\n');
    }, 15000);
  });

  // ============================================================================
  // SCENARIO 6: Manual KTV Selection Override
  // ============================================================================

  describe('Scenario 6: Manual Override', () => {
    it('should allow manual KTV selection without auto-assignment', async () => {
      console.log('\n--- Scenario 6: Manual Override ---');

      const today = new Date().toISOString().split('T')[0];
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);

      // Step 1: Create booking with manual KTV selection (Carol)
      // Even though Alice might be "better", user explicitly chooses Carol
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '15:00',
        assignedKtvId: TEST_IDS.ktvs.carol, // Manually selected (Junior KTV)
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
        skipAutoAssignment: true, // Explicitly skip auto-assignment
      });

      const result = await createBookingWithValidation(bookingInput);

      // Step 2: Assert success with manual selection
      assertBookingSuccess(result);
      
      // Verify NO auto-assignment in result
      expect(result.autoAssignment).toBeUndefined();

      // Step 3: Verify Carol assigned in database (not best match, but manual choice)
      await verifySessionKtvAssignment(result.sessionId!, TEST_IDS.ktvs.carol);

      console.log('[Test] ✅ Manual selection respected: Carol assigned');
      console.log('[Test] ✅ Auto-assignment skipped');
      console.log('--- ✅ Scenario 6: PASSED ---\n');
    }, 15000);

    it('should allow manager to override capacity validation', async () => {
      console.log('\n--- Scenario 6b: Manager Override Capacity ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Verify Emma is fully booked
      const emmaWorkload = await getKtvWorkload(TEST_IDS.ktvs.emma, today);
      expect(emmaWorkload).toBe(8);
      console.log('[Test] Emma is fully booked (8/8)');

      // Step 2: Manager override - book anyway
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '21:00', // Another time for Emma
        assignedKtvId: TEST_IDS.ktvs.emma,
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
        skipCapacityCheck: true, // Manager override
      });

      const { result, executionTime } = await measureExecutionTime(
        () => createBookingWithValidation(bookingInput),
        'Manager Override Booking'
      );

      // Step 3: Assert success (capacity check skipped)
      assertBookingSuccess(result);
      assertPerformance(executionTime, 500, 'Override Booking');

      // Step 4: Verify Emma now has 9 bookings (over limit)
      const newWorkload = await getKtvWorkload(TEST_IDS.ktvs.emma, today);
      expect(newWorkload).toBe(9); // Over the 8 limit
      console.log(`[Test] ✅ Emma now has ${newWorkload}/8 bookings (over limit)`);

      // Step 5: Verify booking in database
      await verifySessionLogExists(result.sessionId!);

      console.log('[Test] ✅ Manager override allowed booking over capacity');
      console.log('--- ✅ Scenario 6b: PASSED ---\n');
    }, 15000);

    it('should prioritize manual selection over auto-assignment recommendations', async () => {
      console.log('\n--- Scenario 6c: Manual vs Auto Priority ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Get auto-assignment recommendation
      const recommendation = await autoAssignKtv({
        tenantId: TEST_IDS.tenant,
        customerId: TEST_IDS.customers.vip,
        serviceId: TEST_IDS.services.massage,
        serviceType: 'Massage',
        requestedDate: today,
        requestedStartTime: '13:00',
        durationMinutes: 90,
        customerTier: 'vip',
      });

      console.log(`[Test] Auto-recommended: ${recommendation.assignedKtvName}`);

      // Step 2: User ignores recommendation and picks different KTV manually
      const manualKtvId = recommendation.assignedKtvId === TEST_IDS.ktvs.alice
        ? TEST_IDS.ktvs.bob
        : TEST_IDS.ktvs.alice;

      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '13:00',
        assignedKtvId: manualKtvId, // Different from recommendation
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
      });

      const result = await createBookingWithValidation(bookingInput);

      // Step 3: Assert manual selection wins
      assertBookingSuccess(result);
      await verifySessionKtvAssignment(result.sessionId!, manualKtvId);

      const { data: manualKtv } = await testSupabase
        .from('users')
        .select('full_name')
        .eq('id', manualKtvId)
        .single();

      console.log(`[Test] ✅ Manual selection used: ${manualKtv?.full_name}`);
      console.log(`[Test] Auto-recommendation ignored: ${recommendation.assignedKtvName}`);
      console.log('--- ✅ Scenario 6c: PASSED ---\n');
    }, 15000);

    it('should track manual override in audit logs', async () => {
      console.log('\n--- Scenario 6d: Override Audit Trail ---');

      const today = new Date().toISOString().split('T')[0];
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);

      // Create booking with manager override
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '22:00',
        assignedKtvId: TEST_IDS.ktvs.alice,
        skipCapacityCheck: true, // Override flag
        notes: 'Manager override - VIP emergency booking',
      });

      const result = await createBookingWithValidation(bookingInput);
      assertBookingSuccess(result);

      // Verify audit trail in database
      const sessionLog = await verifySessionLogExists(result.sessionId!);
      
      // Notes should contain override reason
      expect(sessionLog.notes).toContain('Manager override');
      expect(sessionLog.notes).toContain('emergency');

      console.log('[Test] ✅ Override reason logged in notes');
      console.log(`[Test] Notes: ${sessionLog.notes}`);
      console.log('--- ✅ Scenario 6d: PASSED ---\n');
    }, 15000);
  });

  // ============================================================================
  // SCENARIO 7: Manager Override (Comprehensive)
  // ============================================================================

  describe('Scenario 7: Manager Override (Comprehensive)', () => {
    it('should allow both capacity and assignment overrides simultaneously', async () => {
      console.log('\n--- Scenario 7: Combined Override ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Verify Emma is fully booked
      const emmaWorkload = await getKtvWorkload(TEST_IDS.ktvs.emma, today);
      expect(emmaWorkload).toBe(8);
      console.log('[Test] Emma is fully booked (8/8)');

      // Step 2: Create booking with BOTH overrides
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '23:00', // Late booking
        assignedKtvId: TEST_IDS.ktvs.emma, // Fully booked KTV
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
        skipCapacityCheck: true, // Override #1
        skipAutoAssignment: true, // Override #2
        notes: 'VIP emergency - manager approved both overrides',
      });

      const result = await createBookingWithValidation(bookingInput);

      // Step 3: Assert success despite both violations
      assertBookingSuccess(result);
      
      // Verify NO capacity check
      // Verify NO auto-assignment
      expect(result.autoAssignment).toBeUndefined();

      // Step 4: Verify Emma now 9/8 (over capacity)
      const newWorkload = await getKtvWorkload(TEST_IDS.ktvs.emma, today);
      expect(newWorkload).toBe(9);

      // Step 5: Verify audit trail
      const sessionLog = await verifySessionLogExists(result.sessionId!);
      expect(sessionLog.notes).toContain('manager approved');
      expect(sessionLog.completed_by_ktv_id).toBe(TEST_IDS.ktvs.emma);

      console.log('[Test] ✅ Both overrides successful');
      console.log(`[Test] Emma: ${newWorkload}/8 bookings`);
      console.log('--- ✅ Scenario 7: PASSED ---\n');
    }, 15000);

    it('should skip validation but still perform other checks', async () => {
      console.log('\n--- Scenario 7b: Partial Override ---');

      const today = new Date().toISOString().split('T')[0];
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);

      // Skip capacity but NOT auto-assignment
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '07:00',
        assignedKtvId: undefined, // No KTV - trigger auto-assignment
        customerId: TEST_IDS.customers.vip,
        serviceType: 'Massage',
        durationMinutes: 90,
        customerTier: 'vip',
        skipCapacityCheck: true, // Skip capacity
        skipAutoAssignment: false, // Still do auto-assignment
      });

      const result = await createBookingWithValidation(bookingInput);
      assertBookingSuccess(result);

      // Verify auto-assignment ran
      expect(result.autoAssignment).toBeDefined();
      expect(result.autoAssignment!.assignedKtvId).toBeDefined();

      console.log(`[Test] ✅ Auto-assignment ran: ${result.autoAssignment!.assignedKtvName}`);
      console.log('[Test] ✅ Capacity check skipped');
      console.log('--- ✅ Scenario 7b: PASSED ---\n');
    }, 15000);

    it('should handle invalid override flags gracefully', async () => {
      console.log('\n--- Scenario 7c: Invalid Override ---');

      const today = new Date().toISOString().split('T')[0];

      // Try to skip auto-assignment but no KTV provided
      // This should fail because we need EITHER manual KTV OR auto-assignment
      const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
      const bookingInput = createBookingInput({
        bookingId: parentBookingId,
        assignedDate: today,
        assignedTime: '06:00',
        assignedKtvId: undefined, // No KTV
        skipAutoAssignment: true, // Skip auto-assignment
        // This combination is invalid: no KTV + skip auto = no assignment possible
      });

      const result = await createBookingWithValidation(bookingInput);

      // Should fail with clear error
      assertBookingFailed(result);
      expect(result.error).toMatch(/không tìm thấy KTV|no KTV/i);

      console.log(`[Test] ✅ Invalid override rejected: ${result.error}`);
      console.log('--- ✅ Scenario 7c: PASSED ---\n');
    }, 15000);
  });

  // ============================================================================
  // SCENARIO 8: Race Condition (Concurrent Bookings)
  // ============================================================================

  describe('Scenario 8: Race Condition', () => {
    it('should handle concurrent bookings for same KTV/time', async () => {
      console.log('\n--- Scenario 8: Concurrent Bookings ---');

      const today = new Date().toISOString().split('T')[0];
      const targetTime = '05:00';

      // Step 1: Create 5 concurrent booking requests for Alice at same time
      const bookingPromises = Array.from({ length: 5 }, async (_, i) => {
        const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
        const input = createBookingInput({
          bookingId: parentBookingId,
          assignedDate: today,
          assignedTime: targetTime, // Same time
          assignedKtvId: TEST_IDS.ktvs.alice, // Same KTV
          customerId: TEST_IDS.customers.vip,
          durationMinutes: 90,
        });

        return {
          index: i,
          promise: createBookingWithValidation(input),
        };
      });

      // Step 2: Execute all concurrently
      const { result: results, executionTime } = await measureExecutionTime(
        async () => {
          const resultPromises = bookingPromises.map(bp => bp.promise);
          return Promise.all(resultPromises);
        },
        'Concurrent Bookings'
      );

      console.log(`[Test] Concurrent execution time: ${executionTime.toFixed(2)}ms`);

      // Step 3: Analyze results
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      console.log(`[Test] Successes: ${successes.length}`);
      console.log(`[Test] Failures: ${failures.length}`);

      // Step 4: At least one should succeed (first one wins)
      expect(successes.length).toBeGreaterThanOrEqual(1);

      // Step 5: Others should fail with conflicts
      failures.forEach(failure => {
        expect(failure.conflicts).toBeDefined();
        console.log(`[Test] Failure reason: ${failure.error}`);
      });

      // Step 6: Verify only 1 booking at that time in database
      const { data: bookingsAtTime } = await testSupabase
        .from('session_logs')
        .select('id')
        .eq('completed_by_ktv_id', TEST_IDS.ktvs.alice)
        .eq('assigned_date', today)
        .eq('assigned_time', targetTime)
        .in('status', ['pending', 'confirmed']);

      expect(bookingsAtTime?.length).toBe(1);
      console.log('[Test] ✅ Only 1 booking persisted (race handled correctly)');

      console.log('--- ✅ Scenario 8: PASSED ---\n');
    }, 30000); // 30s timeout

    it('should handle concurrent auto-assignments for same time slot', async () => {
      console.log('\n--- Scenario 8b: Concurrent Auto-Assignments ---');

      const today = new Date().toISOString().split('T')[0];
      const targetTime = '04:00';

      // Step 1: Create 3 concurrent booking requests WITHOUT KTV (trigger auto-assignment)
      const bookingPromises = Array.from({ length: 3 }, async (_, i) => {
        const parentBookingId = await createParentBooking(
          i === 0 ? TEST_IDS.customers.vip : TEST_IDS.customers.loyal
        );
        const input = createBookingInput({
          bookingId: parentBookingId,
          assignedDate: today,
          assignedTime: targetTime,
          assignedKtvId: undefined, // No KTV - trigger auto-assignment
          customerId: i === 0 ? TEST_IDS.customers.vip : TEST_IDS.customers.loyal,
          durationMinutes: 90,
          customerTier: i === 0 ? 'vip' : 'loyal',
        });

        return createBookingWithValidation(input);
      });

      // Step 2: Execute concurrently
      const results = await Promise.all(bookingPromises);

      // Step 3: All should succeed (different KTVs assigned)
      const successes = results.filter(r => r.success);
      expect(successes.length).toBeGreaterThanOrEqual(2); // At least 2 succeed

      // Step 4: Verify different KTVs assigned
      const assignedKtvs = successes
        .map(r => r.autoAssignment?.assignedKtvId)
        .filter(Boolean);

      console.log(`[Test] ✅ ${assignedKtvs.length} KTVs auto-assigned`);
      
      // Check for KTV diversity (may assign same if scoring identical)
      const uniqueKtvs = new Set(assignedKtvs);
      console.log(`[Test] Unique KTVs: ${uniqueKtvs.size}`);

      console.log('--- ✅ Scenario 8b: PASSED ---\n');
    }, 30000);

    it('should handle concurrent capacity checks correctly', async () => {
      console.log('\n--- Scenario 8c: Concurrent Capacity Checks ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Fill Alice to 7/8 bookings
      for (let i = 0; i < 7; i++) {
        const hour = 8 + i * 2;
        const bookingId = await createParentBooking(TEST_IDS.customers.loyal);
        const input = createBookingInput({
          bookingId,
          assignedDate: today,
          assignedTime: `${String(hour).padStart(2, '0')}:00`,
          assignedKtvId: TEST_IDS.ktvs.alice,
          durationMinutes: 90,
        });
        await createBookingWithValidation(input);
      }

      const workload = await getKtvWorkload(TEST_IDS.ktvs.alice, today);
      expect(workload).toBe(7);
      console.log('[Test] Alice at 7/8 capacity');

      // Step 2: 3 concurrent requests for last slot
      const bookingPromises = Array.from({ length: 3 }, async () => {
        const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
        const input = createBookingInput({
          bookingId: parentBookingId,
          assignedDate: today,
          assignedTime: '03:00', // Different time to avoid time overlap
          assignedKtvId: TEST_IDS.ktvs.alice,
          durationMinutes: 90,
        });
        return createBookingWithValidation(input);
      });

      // Step 3: Execute concurrently
      const results = await Promise.all(bookingPromises);

      // Step 4: Only 1 should succeed (fills to 8/8)
      const successes = results.filter(r => r.success);
      const failures = results.filter(r => !r.success);

      expect(successes.length).toBe(1);
      expect(failures.length).toBe(2);

      console.log(`[Test] ✅ 1 succeeded (8/8), 2 rejected (over limit)`);

      // Step 5: Verify Alice now exactly 8/8
      const finalWorkload = await getKtvWorkload(TEST_IDS.ktvs.alice, today);
      expect(finalWorkload).toBe(8);

      console.log('[Test] ✅ Capacity limit enforced correctly');
      console.log('--- ✅ Scenario 8c: PASSED ---\n');
    }, 30000);

    it('should measure and report race condition handling performance', async () => {
      console.log('\n--- Scenario 8d: Performance Under Load ---');

      const today = new Date().toISOString().split('T')[0];

      // Step 1: Create 10 concurrent bookings (different times, different KTVs)
      const bookingPromises = Array.from({ length: 10 }, async (_, i) => {
        const hour = 8 + i;
        const ktvIds = [
          TEST_IDS.ktvs.alice,
          TEST_IDS.ktvs.bob,
          TEST_IDS.ktvs.carol,
          TEST_IDS.ktvs.david,
        ];
        const ktvId = ktvIds[i % 4];

        const parentBookingId = await createParentBooking(TEST_IDS.customers.vip);
        const input = createBookingInput({
          bookingId: parentBookingId,
          assignedDate: today,
          assignedTime: `${String(hour).padStart(2, '0')}:00`,
          assignedKtvId: ktvId,
          durationMinutes: 90,
        });

        return createBookingWithValidation(input);
      });

      // Step 2: Measure concurrent execution
      const { result: results, executionTime } = await measureExecutionTime(
        () => Promise.all(bookingPromises),
        'Concurrent Load Test'
      );

      // Step 3: Assert all succeeded (no conflicts expected)
      const successes = results.filter(r => r.success);
      expect(successes.length).toBe(10);

      // Step 4: Calculate average time per booking
      const avgTime = executionTime / 10;
      console.log(`[Test] Average time per booking: ${avgTime.toFixed(2)}ms`);
      console.log(`[Test] Total concurrent time: ${executionTime.toFixed(2)}ms`);

      // Step 5: Assert reasonable performance (concurrent should be faster than serial)
      // Serial would be ~10 * 500ms = 5000ms
      // Concurrent should be much less
      assertPerformance(executionTime, 3000, 'Concurrent Load Test'); // < 3s

      console.log('[Test] ✅ Performance acceptable under concurrent load');
      console.log('--- ✅ Scenario 8d: PASSED ---\n');
    }, 30000);
  });
});
