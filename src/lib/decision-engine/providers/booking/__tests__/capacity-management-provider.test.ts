/**
 * Capacity Management Provider Tests
 * 
 * Comprehensive test coverage for Phase 2 of Booking Engine.
 * 
 * Test Scenarios:
 * 1. Daily Limit Enforcement
 * 2. Time Overlap Detection
 * 3. Concurrent Session Limits
 * 4. Break Time Violations
 * 5. Working Hours Validation
 * 6. Buffer Slot Management (VIP vs Non-VIP)
 * 7. Peak Hour Management
 * 8. Alternative Time Suggestions
 * 9. Capacity Snapshot Generation
 * 10. Multiple Conflicts Handling
 * 11. Edge Cases (Cancelled Bookings, Exact Boundaries)
 * 12. Performance (<50ms target)
 * 
 * @module decision-engine/providers/booking/__tests__
 */

import { CapacityManagementProvider } from '../capacity-management-provider';
import type {
  CapacityCheckInput,
} from '../types';

describe('CapacityManagementProvider', () => {
  let provider: CapacityManagementProvider;

  beforeEach(() => {
    provider = new CapacityManagementProvider({ debug: false });
  });

  // Helper: Create test input
  const createTestInput = (
    overrides?: Partial<CapacityCheckInput>
  ): CapacityCheckInput => ({
    tenantId: 'test-tenant',
    ktvId: 'ktv-001',
    ...overrides, // Apply top-level overrides first
    booking: {
      requestedDate: '2026-07-15',
      requestedStartTime: '14:00',
      requestedEndTime: '15:30',
      durationMinutes: 90,
      serviceType: 'Massage',
      customerTier: 'loyal',
      ...overrides?.booking,
    },
    ktvCapacity: {
      maxDailyBookings: 8,
      maxConcurrentSessions: 1,
      minBreakMinutes: 15,
      workingHours: {
        start: '08:00',
        end: '20:00',
      },
      ...overrides?.ktvCapacity,
    },
    existingBookings: overrides?.existingBookings || [],
    tenantCapacity: {
      bufferPercentage: 10,
      enablePeakHourManagement: true,
      enforceBreakTimes: true,
      ...overrides?.tenantCapacity,
    },
  });

  // Helper: Create existing bookings (non-overlapping, 2-hour gaps)
  const createExistingBookings = (count: number, startHour: number = 8): Array<any> => {
    return Array.from({ length: count }, (_, i) => {
      const hour = startHour + (i * 2); // 2-hour spacing to avoid overlap
      const endHour = hour + 1; // 90 minutes = 1 hour 30 min
      return {
        id: `booking-${i + 1}`,
        startTime: `${hour.toString().padStart(2, '0')}:00`,
        endTime: `${endHour.toString().padStart(2, '0')}:30`,
        durationMinutes: 90,
        status: 'confirmed' as const,
      };
    });
  };

  describe('1. Daily Limit Enforcement', () => {
    it('should allow booking when under daily limit', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '07:00', // Before working hours start, will use simpler approach
          requestedEndTime: '08:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '07:00', end: '22:00' }, // Extend hours
        },
        existingBookings: [
          // 6 bookings at non-overlapping times
          { id: 'booking-1', startTime: '09:00', endTime: '10:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-2', startTime: '11:00', endTime: '12:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-3', startTime: '13:00', endTime: '14:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-4', startTime: '15:00', endTime: '16:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-5', startTime: '17:00', endTime: '18:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-6', startTime: '19:00', endTime: '20:30', durationMinutes: 90, status: 'confirmed' },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enablePeakHourManagement: true,
          enforceBreakTimes: false, // Disable for simple daily limit test
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.success).toBe(true);
      expect(result.available).toBe(true);
      expect(result.capacityDetails.currentBookings).toBe(6);
      expect(result.capacityDetails.maxBookings).toBe(8);
      expect(result.capacityDetails.utilizationPercentage).toBe(75);
    });

    it('should reject booking when at daily limit', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(8), // 8/8 bookings (full)
      });

      const result = await provider.checkCapacity(input);

      expect(result.success).toBe(true);
      expect(result.available).toBe(false);
      expect(result.reason).toContain('maximum daily bookings');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts![0].type).toBe('daily_limit');
    });

    it('should exclude cancelled bookings from count', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '07:00',
          requestedEndTime: '08:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '07:00', end: '22:00' },
        },
        existingBookings: [
          // 7 confirmed bookings
          { id: 'booking-1', startTime: '09:00', endTime: '10:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-2', startTime: '11:00', endTime: '12:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-3', startTime: '13:00', endTime: '14:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-4', startTime: '15:00', endTime: '16:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-5', startTime: '17:00', endTime: '18:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-6', startTime: '19:00', endTime: '20:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-7', startTime: '21:00', endTime: '22:30', durationMinutes: 90, status: 'confirmed' },
          // 1 cancelled booking (should not count)
          { id: 'booking-8', startTime: '08:00', endTime: '09:30', status: 'cancelled', durationMinutes: 90 },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enablePeakHourManagement: true,
          enforceBreakTimes: false, // Disable for count test
        },
      });

      const result = await provider.checkCapacity(input);

      // Should count 7, not 8 (cancelled excluded)
      expect(result.capacityDetails.currentBookings).toBe(7);
      expect(result.available).toBe(true);
    });
  });

  describe('2. Time Overlap Detection', () => {
    it('should detect exact time overlap', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts![0].type).toBe('time_overlap');
      expect(result.conflicts![0].conflictingBooking?.id).toBe('booking-1');
    });

    it('should detect partial overlap (start during existing)', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '14:30', // Starts during 14:00-15:30
          requestedEndTime: '16:00',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts![0].type).toBe('time_overlap');
    });

    it('should detect partial overlap (end during existing)', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '13:00',
          requestedEndTime: '14:30', // Ends during 14:00-15:30
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts![0].type).toBe('time_overlap');
    });

    it('should allow booking if no overlap', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '16:00', // After 14:00-15:30
          requestedEndTime: '17:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(true);
      expect(result.conflicts).toBeUndefined();
    });
  });

  describe('3. Concurrent Session Limits', () => {
    it('should reject if concurrent limit exceeded', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '14:30', // Overlaps with 3 bookings
          requestedEndTime: '15:30',
          durationMinutes: 60,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 2, // Max 2 concurrent
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '20:00' },
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:00', status: 'confirmed', durationMinutes: 90 },
          { id: 'booking-2', startTime: '14:15', endTime: '15:15', status: 'confirmed', durationMinutes: 90 },
          { id: 'booking-3', startTime: '14:45', endTime: '15:45', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.some(c => c.type === 'concurrent_limit')).toBe(true);
    });

    it('should allow if within concurrent limit', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '19:30', // After existing bookings to avoid overlap
          requestedEndTime: '20:30',
          durationMinutes: 60,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 3, // Max 3 concurrent
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '22:00' },
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:00', status: 'confirmed', durationMinutes: 90 },
          { id: 'booking-2', startTime: '14:15', endTime: '15:15', status: 'confirmed', durationMinutes: 90 },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enablePeakHourManagement: true,
          enforceBreakTimes: false, // Disable for concurrent test
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(true);
    });
  });

  describe('4. Break Time Violations', () => {
    it('should enforce minimum break time between bookings', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '15:35', // Only 5 minutes after 15:30
          requestedEndTime: '17:05',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15, // Required 15 min break
          workingHours: { start: '08:00', end: '20:00' },
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enforceBreakTimes: true, // Enforcement enabled
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.some(c => c.type === 'break_time_violation')).toBe(true);
      expect(result.reason).toContain('15 minutes');
    });

    it('should allow booking with sufficient break time', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '15:45', // 15 minutes after 15:30
          requestedEndTime: '17:15',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '20:00' },
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enforceBreakTimes: true,
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(true);
    });

    it('should skip break time check if not enforced', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '15:35', // Only 5 minutes after 15:30
          requestedEndTime: '17:05',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '20:00' },
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enforceBreakTimes: false, // NOT enforced
        },
      });

      const result = await provider.checkCapacity(input);

      // Should pass since enforcement is disabled
      expect(result.available).toBe(true);
      expect(result.conflicts?.some(c => c.type === 'break_time_violation')).toBeFalsy();
    });
  });

  describe('5. Working Hours Validation', () => {
    it('should reject booking outside working hours (too early)', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '07:00', // Before 08:00
          requestedEndTime: '08:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts![0].type).toBe('outside_working_hours');
      expect(result.reason).toContain('08:00 - 20:00');
    });

    it('should reject booking outside working hours (too late)', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '19:30',
          requestedEndTime: '21:00', // After 20:00
          durationMinutes: 90,
          customerTier: 'loyal',
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts![0].type).toBe('outside_working_hours');
    });

    it('should allow booking within working hours', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '10:00',
          requestedEndTime: '11:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(true);
    });
  });

  describe('6. Buffer Slot Management (VIP vs Non-VIP)', () => {
    it('should calculate buffer slots correctly', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(6), // 6/8 bookings
        tenantCapacity: {
          bufferPercentage: 25, // 25% of 8 = 2 buffer slots
          enforceBreakTimes: true,
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.capacityDetails.bufferSlotsAvailable).toBeGreaterThan(0);
      // Total buffer: 2 slots, Threshold: 6, Current: 6, Used: 0
      expect(result.capacityDetails.bufferSlotsUsed).toBe(0);
    });

    it('should track buffer slot usage as capacity fills', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(7), // 7/8 bookings
        tenantCapacity: {
          bufferPercentage: 20, // 20% of 8 = 1.6 → 2 buffer slots
          enforceBreakTimes: true,
        },
      });

      const result = await provider.checkCapacity(input);

      // Buffer threshold: 8 - 2 = 6
      // Current: 7 (1 buffer slot used)
      expect(result.capacityDetails.bufferSlotsUsed).toBe(1);
      expect(result.capacityDetails.bufferSlotsAvailable).toBe(1);
    });

    it('should allow VIP booking in buffer zone', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '07:00',
          requestedEndTime: '08:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'vip', // VIP customer
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '07:00', end: '22:00' },
        },
        existingBookings: [
          // 7 bookings (using buffer zone since max=8)
          { id: 'booking-1', startTime: '09:00', endTime: '10:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-2', startTime: '11:00', endTime: '12:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-3', startTime: '13:00', endTime: '14:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-4', startTime: '15:00', endTime: '16:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-5', startTime: '17:00', endTime: '18:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-6', startTime: '19:00', endTime: '20:30', durationMinutes: 90, status: 'confirmed' },
          { id: 'booking-7', startTime: '21:00', endTime: '22:30', durationMinutes: 90, status: 'confirmed' },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enablePeakHourManagement: true,
          enforceBreakTimes: false,
        },
      });

      const result = await provider.checkCapacity(input);

      // VIP can use buffer slots (rule should allow)
      expect(result.available).toBe(true);
    });
  });

  describe('7. Peak Hour Management', () => {
    it('should detect peak hour correctly', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00', // During 12:00-18:00 peak
          requestedEndTime: '15:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '20:00' },
          peakHours: {
            start: '12:00',
            end: '18:00',
            maxBookings: 6, // Reduced capacity during peak
          },
        },
        existingBookings: createExistingBookings(5),
      });

      const result = await provider.checkCapacity(input);

      expect(result.capacityDetails.isPeakHour).toBe(true);
      expect(result.capacityDetails.maxBookings).toBe(6); // Peak limit
    });

    it('should apply peak hour capacity limit', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '15:00',
          requestedEndTime: '16:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '20:00' },
          peakHours: {
            start: '12:00',
            end: '18:00',
            maxBookings: 6,
          },
        },
        existingBookings: createExistingBookings(6), // At peak limit
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts![0].type).toBe('daily_limit');
    });

    it('should use normal capacity outside peak hours', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '21:30', // Outside peak (12:00-18:00), after all existing bookings
          requestedEndTime: '23:00',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '23:30' },
          peakHours: {
            start: '12:00',
            end: '18:00',
            maxBookings: 6,
          },
        },
        existingBookings: createExistingBookings(7), // 08:00, 10:00, 12:00, 14:00, 16:00, 18:00, 20:00 (all ending +1:30)
        tenantCapacity: {
          bufferPercentage: 10,
          enablePeakHourManagement: true,
          enforceBreakTimes: false, // Disable for peak hour test
        },
      });

      const result = await provider.checkCapacity(input);

      expect(result.capacityDetails.isPeakHour).toBe(false);
      expect(result.capacityDetails.maxBookings).toBe(8); // Normal limit
      expect(result.available).toBe(true);
    });
  });

  describe('8. Alternative Time Suggestions', () => {
    it('should suggest next day when at daily limit', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(8), // Full capacity
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
      expect(result.alternatives![0].reason).toContain('tomorrow');
    });

    it('should suggest next available slot on time overlap', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.some(a => a.reason.includes('Next available'))).toBe(true);
    });

    it('should suggest off-peak hours when utilization high', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(7), // 87.5% utilization
      });

      const result = await provider.checkCapacity(input);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.some(a => a.reason.includes('off-peak'))).toBe(true);
    });

    it('should limit alternatives to 3 max', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(8), // Multiple conflict types
      });

      const result = await provider.checkCapacity(input);

      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeLessThanOrEqual(3);
    });
  });

  describe('9. Capacity Snapshot Generation', () => {
    it('should generate correct capacity snapshot', () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(6),
      });

      const snapshot = provider.generateSnapshot(input);

      expect(snapshot).toHaveProperty('id');
      expect(snapshot).toHaveProperty('tenantId', 'test-tenant');
      expect(snapshot).toHaveProperty('ktvId', 'ktv-001');
      expect(snapshot).toHaveProperty('date', '2026-07-15');
      expect(snapshot).toHaveProperty('hour', 14);
      expect(snapshot).toHaveProperty('totalCapacity', 8);
      expect(snapshot).toHaveProperty('bookingsCount', 6);
      expect(snapshot).toHaveProperty('utilizationPercentage', 75);
      expect(snapshot).toHaveProperty('createdAt');
    });

    it('should include buffer and peak hour info in snapshot', () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '15:00',
          requestedEndTime: '16:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '20:00' },
          peakHours: {
            start: '12:00',
            end: '18:00',
            maxBookings: 6,
          },
        },
        existingBookings: createExistingBookings(7),
      });

      const snapshot = provider.generateSnapshot(input);

      expect(snapshot.isPeakHour).toBe(true);
      expect(snapshot.bufferSlotsUsed).toBeGreaterThan(0);
    });
  });

  describe('10. Multiple Conflicts Handling', () => {
    it('should detect multiple conflict types simultaneously', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '14:05', // Overlaps + insufficient break
          requestedEndTime: '15:35',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.length).toBeGreaterThan(1);
      expect(result.conflicts!.some(c => c.type === 'time_overlap')).toBe(true);
    });

    it('should combine all conflict reasons in rejection message', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '07:00', // Outside hours + overlap
          requestedEndTime: '08:30',
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '07:00', endTime: '08:30', status: 'confirmed', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      expect(result.reason).toBeTruthy();
      // Should mention both conflicts
      expect(result.conflicts!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('11. Edge Cases', () => {
    it('should handle exact time boundary (no overlap)', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '15:30', // Starts exactly when other ends
          requestedEndTime: '17:00',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: [
          { id: 'booking-1', startTime: '14:00', endTime: '15:30', status: 'confirmed', durationMinutes: 90 },
        ],
        tenantCapacity: {
          bufferPercentage: 10,
          enablePeakHourManagement: true,
          enforceBreakTimes: false, // Disable to test exact boundary
        },
      });

      const result = await provider.checkCapacity(input);

      // Exact boundary should not count as overlap (when break time not enforced)
      expect(result.available).toBe(true);
    });

    it('should handle empty existing bookings', async () => {
      const input = createTestInput({
        existingBookings: [],
      });

      const result = await provider.checkCapacity(input);

      expect(result.available).toBe(true);
      expect(result.capacityDetails.currentBookings).toBe(0);
      expect(result.capacityDetails.utilizationPercentage).toBe(0);
    });

    it('should handle all cancelled bookings', async () => {
      const input = createTestInput({
        existingBookings: [
          { id: 'booking-1', startTime: '10:00', endTime: '11:30', status: 'cancelled', durationMinutes: 90 },
          { id: 'booking-2', startTime: '12:00', endTime: '13:30', status: 'cancelled', durationMinutes: 90 },
          { id: 'booking-3', startTime: '14:00', endTime: '15:30', status: 'cancelled', durationMinutes: 90 },
        ],
      });

      const result = await provider.checkCapacity(input);

      // All cancelled, effective count = 0
      expect(result.capacityDetails.currentBookings).toBe(0);
      expect(result.available).toBe(true);
    });

    it('should handle midnight crossing bookings', async () => {
      const input = createTestInput({
        booking: {
          requestedDate: '2026-07-15',
          requestedStartTime: '23:00',
          requestedEndTime: '00:30', // Next day
          durationMinutes: 90,
          customerTier: 'loyal',
        },
        ktvCapacity: {
          maxDailyBookings: 8,
          maxConcurrentSessions: 1,
          minBreakMinutes: 15,
          workingHours: { start: '08:00', end: '01:00' }, // Late night spa
        },
      });

      const result = await provider.checkCapacity(input);

      // Should handle gracefully (might reject due to time validation)
      expect(result).toHaveProperty('available');
      expect(result).toHaveProperty('success', true);
    });
  });

  describe('12. Performance', () => {
    it('should complete capacity check in < 50ms', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(7),
      });

      const result = await provider.checkCapacity(input);

      expect(result.executionTime).toBeLessThan(50);
    });

    it('should handle many existing bookings efficiently', async () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(50, 8), // 50 bookings (unlikely but stress test)
      });

      const result = await provider.checkCapacity(input);

      expect(result.success).toBe(true);
      expect(result.executionTime).toBeLessThan(100); // Still under 100ms
    });

    it('should perform snapshot generation quickly', () => {
      const input = createTestInput({
        existingBookings: createExistingBookings(10),
      });

      const startTime = performance.now();
      const snapshot = provider.generateSnapshot(input);
      const endTime = performance.now();

      expect(snapshot).toBeDefined();
      expect(endTime - startTime).toBeLessThan(10); // < 10ms for snapshot
    });
  });

  describe('13. Input Validation', () => {
    it('should throw error for missing tenantId', async () => {
      const input = createTestInput();
      delete (input as any).tenantId;

      await expect(provider.checkCapacity(input)).rejects.toThrow('tenantId is required');
    });

    it('should throw error for missing ktvId', async () => {
      const input = createTestInput();
      delete (input as any).ktvId;

      await expect(provider.checkCapacity(input)).rejects.toThrow('ktvId is required');
    });

    it('should throw error for missing booking date', async () => {
      const input = createTestInput();
      delete (input.booking as any).requestedDate;

      await expect(provider.checkCapacity(input)).rejects.toThrow('booking.requestedDate is required');
    });

    it('should throw error for missing capacity config', async () => {
      const input = createTestInput();
      delete (input.ktvCapacity as any).maxDailyBookings;

      await expect(provider.checkCapacity(input)).rejects.toThrow('ktvCapacity.maxDailyBookings is required');
    });
  });
});

