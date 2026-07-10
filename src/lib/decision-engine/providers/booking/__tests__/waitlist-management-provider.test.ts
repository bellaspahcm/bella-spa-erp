/**
 * Waitlist Management Provider Tests
 * 
 * Test coverage:
 * 1. Priority calculation (tier, value, wait time, flexibility)
 * 2. Position calculation (ranking by priority)
 * 3. Capacity enforcement (max waitlist size)
 * 4. Auto-notification triggers
 * 5. Expiry management
 * 6. Slot matching
 * 7. Promotion logic
 * 8. Edge cases
 * 
 * @module decision-engine/providers/booking/__tests__
 */

import { WaitlistManagementProvider } from '../waitlist-management-provider';
import type {
  WaitlistManagementInput,
  WaitlistEntry,
  WaitlistSlotMatch,
} from '../types';

describe('WaitlistManagementProvider', () => {
  let provider: WaitlistManagementProvider;

  beforeEach(() => {
    provider = new WaitlistManagementProvider({ debug: false });
  });

  // ============================================================================
  // HELPER FUNCTIONS
  // ============================================================================

  function createTestInput(overrides?: Partial<WaitlistManagementInput>): WaitlistManagementInput {
    return {
      tenantId: 'test-tenant-001',
      customer: {
        id: 'customer-001',
        name: 'Nguyễn Thị A',
        tier: 'loyal',
        email: 'customer@example.com',
        phone: '0901234567',
        contactPreferences: {
          preferredChannel: 'sms',
          acceptsMarketing: true,
        },
      },
      booking: {
        serviceId: 'service-001',
        serviceName: 'Massage Body',
        serviceType: 'massage',
        bookingValue: 800000, // 800K VND
        preferredDate: '2026-07-15',
        preferredStartTime: '14:00',
        durationMinutes: 90,
        isFlexible: false,
      },
      config: {
        enablePriorityRanking: true,
        enableAutoNotification: true,
        slotReservationMinutes: 30,
        waitlistExpiryHours: 24,
        maxWaitlistSize: 10,
      },
      existingWaitlist: [],
      ...overrides,
    };
  }

  function createExistingEntry(
    priorityScore: number,
    position: number,
    tier: 'vip' | 'loyal' | 'new' = 'new'
  ): WaitlistEntry {
    return {
      id: `entry-${position}`,
      tenantId: 'test-tenant-001',
      customerId: `customer-${position}`,
      customerName: `Customer ${position}`,
      customerTier: tier,
      bookingRequestId: `booking-req-${position}`,
      serviceId: 'service-001',
      serviceName: 'Massage Body',
      bookingValue: 500000,
      preferredDate: '2026-07-15',
      preferredStartTime: '14:00',
      durationMinutes: 90,
      priorityScore,
      position,
      waitMinutes: 30,
      status: 'active',
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  // ============================================================================
  // TEST SUITE 1: PRIORITY CALCULATION
  // ============================================================================

  describe('Priority Calculation', () => {
    it('should calculate priority for VIP customer correctly', async () => {
      const input = createTestInput({
        customer: { ...createTestInput().customer, tier: 'vip' },
        booking: { ...createTestInput().booking, bookingValue: 5000000 }, // 5M VND
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.entry.priorityScore).toBeGreaterThan(50); // VIP (40) + high value (15+)
      expect(result.matchedRules).toContain('waitlist-priority-calculation');
      expect(result.matchedRules).toContain('waitlist-vip-fast-track');
      expect(result.matchedRules).toContain('waitlist-high-value-priority');
    });

    it('should calculate priority for Loyal customer correctly', async () => {
      const input = createTestInput({
        customer: { ...createTestInput().customer, tier: 'loyal' },
        booking: { ...createTestInput().booking, bookingValue: 1000000 }, // 1M VND
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.entry.priorityScore).toBeGreaterThanOrEqual(25); // Loyal (25) + value
      expect(result.entry.priorityScore).toBeLessThan(50); // Not VIP
    });

    it('should calculate priority for New customer correctly', async () => {
      const input = createTestInput({
        customer: { ...createTestInput().customer, tier: 'new' },
        booking: { ...createTestInput().booking, bookingValue: 500000 }, // 500K VND
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.entry.priorityScore).toBeGreaterThanOrEqual(10); // New (10) + value
      expect(result.entry.priorityScore).toBeLessThan(25);
    });

    it('should add flexibility bonus when customer is flexible', async () => {
      const inputNotFlexible = createTestInput({
        booking: { ...createTestInput().booking, isFlexible: false },
      });
      const inputFlexible = createTestInput({
        booking: { ...createTestInput().booking, isFlexible: true },
      });

      const resultNotFlexible = await provider.addToWaitlist(inputNotFlexible);
      const resultFlexible = await provider.addToWaitlist(inputFlexible);

      expect(resultFlexible.entry.priorityScore).toBeGreaterThan(
        resultNotFlexible.entry.priorityScore
      );
      expect(resultFlexible.matchedRules).toContain('waitlist-preferred-time-match');
    });

    it('should give bonus to high-value bookings (>= 5M VND)', async () => {
      const inputLowValue = createTestInput({
        booking: { ...createTestInput().booking, bookingValue: 1000000 }, // 1M VND
      });
      const inputHighValue = createTestInput({
        booking: { ...createTestInput().booking, bookingValue: 8000000 }, // 8M VND
      });

      const resultLow = await provider.addToWaitlist(inputLowValue);
      const resultHigh = await provider.addToWaitlist(inputHighValue);

      expect(resultHigh.entry.priorityScore).toBeGreaterThan(resultLow.entry.priorityScore);
      expect(resultHigh.matchedRules).toContain('waitlist-high-value-priority');
    });
  });

  // ============================================================================
  // TEST SUITE 2: POSITION CALCULATION
  // ============================================================================

  describe('Position Calculation', () => {
    it('should assign position 1 for first entry', async () => {
      const input = createTestInput();

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.entry.position).toBe(1);
      expect(result.stats.totalEntries).toBe(1);
    });

    it('should assign correct position based on priority score', async () => {
      const existingWaitlist = [
        createExistingEntry(60, 1, 'vip'), // Highest priority
        createExistingEntry(40, 2, 'loyal'),
        createExistingEntry(20, 3, 'new'), // Lowest priority
      ];

      const input = createTestInput({
        existingWaitlist,
        booking: { ...createTestInput().booking, bookingValue: 2000000 }, // Will score ~35
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.entry.position).toBe(3); // Between loyal (40) and new (20)
      expect(result.stats.totalEntries).toBe(4);
    });

    it('should place VIP customer ahead of non-VIP with same booking value', async () => {
      const existingWaitlist = [createExistingEntry(30, 1, 'loyal')];

      const inputVIP = createTestInput({
        existingWaitlist,
        customer: { ...createTestInput().customer, tier: 'vip' },
        booking: { ...createTestInput().booking, bookingValue: 1000000 },
      });

      const result = await provider.addToWaitlist(inputVIP);

      expect(result.success).toBe(true);
      expect(result.entry.position).toBe(1); // VIP overtakes loyal
    });

    it('should update positions correctly when new entry inserted', async () => {
      const existingWaitlist = [
        createExistingEntry(50, 1, 'loyal'),  // Will become position 2
        createExistingEntry(30, 2, 'new'),    // Will become position 3
      ];

      const input = createTestInput({
        existingWaitlist,
        customer: { ...createTestInput().customer, tier: 'vip' },
        booking: { ...createTestInput().booking, bookingValue: 2000000 }, // VIP + value = ~50-55
      });

      const result = await provider.addToWaitlist(input);

      // VIP with value should score higher than loyal (50), so takes position 1 or 2
      expect(result.entry.position).toBeLessThanOrEqual(2);
      // Note: Actual position update of existing entries would be done separately via updatePositions()
    });
  });

  // ============================================================================
  // TEST SUITE 3: CAPACITY ENFORCEMENT
  // ============================================================================

  describe('Capacity Enforcement', () => {
    it('should accept entry when waitlist has capacity', async () => {
      const existingWaitlist = [
        createExistingEntry(50, 1),
        createExistingEntry(40, 2),
        createExistingEntry(30, 3),
      ];

      const input = createTestInput({
        existingWaitlist,
        config: { ...createTestInput().config, maxWaitlistSize: 10 },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.stats.capacityRemaining).toBe(6); // 10 - 4
    });

    it('should reject entry when waitlist is full', async () => {
      const existingWaitlist = Array.from({ length: 10 }, (_, i) =>
        createExistingEntry(50 - i * 5, i + 1)
      );

      const input = createTestInput({
        existingWaitlist,
        config: { ...createTestInput().config, maxWaitlistSize: 10 },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(false);
      expect(result.operation).toBe('rejected');
      expect(result.reason).toContain('full');
      expect(result.matchedRules).toContain('waitlist-capacity-limit');
    });

    it('should show correct capacity remaining', async () => {
      const existingWaitlist = [createExistingEntry(50, 1)];

      const input = createTestInput({
        existingWaitlist,
        config: { ...createTestInput().config, maxWaitlistSize: 5 },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.stats.capacityRemaining).toBe(3); // 5 - 2
    });
  });

  // ============================================================================
  // TEST SUITE 4: AUTO-NOTIFICATION
  // ============================================================================

  describe('Auto-Notification', () => {
    it('should trigger notification for position 1 when enabled', async () => {
      const input = createTestInput({
        config: { ...createTestInput().config, enableAutoNotification: true },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      expect(result.entry.position).toBe(1);
      expect(result.notification).toBeDefined();
      expect(result.notification?.sent).toBe(true);
      expect(result.notification?.channel).toBe('sms');
    });

    it('should trigger notification for top 3 positions', async () => {
      const existingWaitlist = [
        createExistingEntry(80, 1, 'vip'),
        createExistingEntry(70, 2, 'vip'),
      ];

      const input = createTestInput({
        existingWaitlist,
        customer: { ...createTestInput().customer, tier: 'vip' },
        config: { ...createTestInput().config, enableAutoNotification: true },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.entry.position).toBeLessThanOrEqual(3);
      expect(result.notification).toBeDefined();
    });

    it('should NOT trigger notification for position > 3', async () => {
      const existingWaitlist = [
        createExistingEntry(80, 1, 'vip'),
        createExistingEntry(70, 2, 'vip'),
        createExistingEntry(60, 3, 'loyal'),
      ];

      const input = createTestInput({
        existingWaitlist,
        customer: { ...createTestInput().customer, tier: 'new' },
        booking: { ...createTestInput().booking, bookingValue: 500000 },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.entry.position).toBeGreaterThan(3);
      expect(result.notification).toBeUndefined();
    });

    it('should NOT trigger notification when disabled', async () => {
      const input = createTestInput({
        config: { ...createTestInput().config, enableAutoNotification: false },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.notification).toBeUndefined();
    });

    it('should use correct notification channel based on customer preference', async () => {
      const inputEmail = createTestInput({
        customer: {
          ...createTestInput().customer,
          contactPreferences: { preferredChannel: 'email', acceptsMarketing: true },
        },
      });

      const result = await provider.addToWaitlist(inputEmail);

      expect(result.notification?.channel).toBe('email');
    });
  });

  // ============================================================================
  // TEST SUITE 5: EXPIRY MANAGEMENT
  // ============================================================================

  describe('Expiry Management', () => {
    it('should identify expired entries correctly', async () => {
      const expiredEntry: WaitlistEntry = {
        ...createExistingEntry(50, 1),
        waitMinutes: 25 * 60, // 25 hours (expired if threshold is 24)
        status: 'active',
      };

      const config = createTestInput().config;
      const expiredIds = await provider.removeExpiredEntries([expiredEntry], config);

      expect(expiredIds).toContain(expiredEntry.id);
      expect(expiredIds.length).toBe(1);
    });

    it('should NOT expire entries within expiry window', async () => {
      const activeEntry: WaitlistEntry = {
        ...createExistingEntry(50, 1),
        waitMinutes: 12 * 60, // 12 hours (not expired)
        status: 'active',
      };

      const config = createTestInput().config;
      const expiredIds = await provider.removeExpiredEntries([activeEntry], config);

      expect(expiredIds).toHaveLength(0);
    });

    it('should NOT re-expire already expired entries', async () => {
      const alreadyExpired: WaitlistEntry = {
        ...createExistingEntry(50, 1),
        waitMinutes: 30 * 60, // 30 hours
        status: 'expired', // Already marked as expired
      };

      const config = createTestInput().config;
      const expiredIds = await provider.removeExpiredEntries([alreadyExpired], config);

      expect(expiredIds).toHaveLength(0);
    });

    it('should handle multiple entries with mixed expiry status', async () => {
      const entries: WaitlistEntry[] = [
        { ...createExistingEntry(50, 1), waitMinutes: 25 * 60, status: 'active' }, // Expired
        { ...createExistingEntry(40, 2), waitMinutes: 12 * 60, status: 'active' }, // Active
        { ...createExistingEntry(30, 3), waitMinutes: 26 * 60, status: 'active' }, // Expired
      ];

      const config = createTestInput().config;
      const expiredIds = await provider.removeExpiredEntries(entries, config);

      expect(expiredIds).toHaveLength(2);
      expect(expiredIds).toContain(entries[0].id);
      expect(expiredIds).toContain(entries[2].id);
    });
  });

  // ============================================================================
  // TEST SUITE 6: SLOT MATCHING
  // ============================================================================

  describe('Slot Matching', () => {
    it('should process waitlist when slot becomes available', async () => {
      const waitlist: WaitlistEntry[] = [
        createExistingEntry(80, 1, 'vip'),
        createExistingEntry(60, 2, 'loyal'),
        createExistingEntry(40, 3, 'new'),
      ];

      const slot: WaitlistSlotMatch = {
        date: '2026-07-15',
        startTime: '14:00',
        durationMinutes: 90,
        matchScore: 100,
        matchFactors: {
          matchesPreferredDate: true,
          matchesPreferredTime: true,
          matchesPreferredKtv: false,
          timeDifference: 0,
        },
        availableAt: new Date().toISOString(),
      };

      const results = await provider.processWaitlistOnSlotAvailable(
        slot,
        waitlist,
        'test-tenant-001',
        createTestInput().config
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(3); // Max 3 notifications
      expect(results[0].entry.position).toBe(1); // Top priority notified first
    });

    it('should notify only entries with good slot match (>= 50%)', async () => {
      const waitlist: WaitlistEntry[] = [
        {
          ...createExistingEntry(80, 1, 'vip'),
          preferredDate: '2026-07-15',
          preferredStartTime: '14:00', // Perfect match
        },
        {
          ...createExistingEntry(70, 2, 'loyal'),
          preferredDate: '2026-07-16', // Different date
          preferredStartTime: '14:00',
        },
      ];

      const slot: WaitlistSlotMatch = {
        date: '2026-07-15',
        startTime: '14:00',
        durationMinutes: 90,
        matchScore: 100,
        matchFactors: {
          matchesPreferredDate: true,
          matchesPreferredTime: true,
          matchesPreferredKtv: false,
          timeDifference: 0,
        },
        availableAt: new Date().toISOString(),
      };

      const results = await provider.processWaitlistOnSlotAvailable(
        slot,
        waitlist,
        'test-tenant-001',
        createTestInput().config
      );

      // First entry should be notified (perfect match), second may not (different date = low match)
      expect(results[0].notified).toBe(true);
    });
  });

  // ============================================================================
  // TEST SUITE 7: POSITION UPDATES
  // ============================================================================

  describe('Position Updates', () => {
    it('should recalculate positions correctly', () => {
      const waitlist: WaitlistEntry[] = [
        { ...createExistingEntry(80, 3), id: 'entry-1' },
        { ...createExistingEntry(60, 1), id: 'entry-2' },
        { ...createExistingEntry(40, 2), id: 'entry-3' },
      ];

      const updated = provider.updatePositions(waitlist);

      expect(updated[0].id).toBe('entry-1'); // Highest score = position 1
      expect(updated[0].position).toBe(1);
      expect(updated[1].id).toBe('entry-2');
      expect(updated[1].position).toBe(2);
      expect(updated[2].id).toBe('entry-3'); // Lowest score = position 3
      expect(updated[2].position).toBe(3);
    });

    it('should handle empty waitlist', () => {
      const updated = provider.updatePositions([]);
      expect(updated).toHaveLength(0);
    });

    it('should handle single entry', () => {
      const waitlist = [createExistingEntry(50, 1)];
      const updated = provider.updatePositions(waitlist);

      expect(updated).toHaveLength(1);
      expect(updated[0].position).toBe(1);
    });
  });

  // ============================================================================
  // TEST SUITE 8: EDGE CASES & ERROR HANDLING
  // ============================================================================

  describe('Edge Cases & Error Handling', () => {
    it('should handle missing required fields gracefully', async () => {
      const invalidInput = {
        ...createTestInput(),
        tenantId: '', // Missing tenant ID
      };

      const result = await provider.addToWaitlist(invalidInput);

      expect(result.success).toBe(false);
      expect(result.reason).toContain('Failed to add to waitlist');
    });

    it('should calculate estimated wait time correctly', async () => {
      const existingWaitlist = [
        { ...createExistingEntry(80, 1), waitMinutes: 45 },
        { ...createExistingEntry(70, 2), waitMinutes: 30 },
      ];

      const input = createTestInput({ existingWaitlist });

      const result = await provider.addToWaitlist(input);

      expect(result.entry.estimatedWaitMinutes).toBeGreaterThan(0);
    });

    it('should handle VIP with low booking value correctly', async () => {
      const input = createTestInput({
        customer: { ...createTestInput().customer, tier: 'vip' },
        booking: { ...createTestInput().booking, bookingValue: 300000 }, // Low value
      });

      const result = await provider.addToWaitlist(input);

      expect(result.success).toBe(true);
      // VIP tier bonus should compensate for low value
      expect(result.entry.priorityScore).toBeGreaterThan(40); // At least VIP base score
    });

    it('should handle confidence calculation correctly', async () => {
      const input = createTestInput({
        customer: { ...createTestInput().customer, tier: 'vip' },
        booking: { ...createTestInput().booking, bookingValue: 10000000 },
      });

      const result = await provider.addToWaitlist(input);

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle execution time tracking', async () => {
      const input = createTestInput();

      const result = await provider.addToWaitlist(input);

      expect(result.executionTime).toBeGreaterThanOrEqual(0); // Allow 0ms for fast execution
      expect(result.executionTime).toBeLessThan(1000); // Should be < 1 second
    });
  });
});
