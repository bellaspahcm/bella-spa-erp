/**
 * Conflict Detection Provider Tests
 * 
 * Comprehensive test coverage for Task 2 of Booking Engine.
 * 
 * Test Scenarios:
 * 1. Customer Double-Booking Detection (5 tests)
 * 2. Room/Bed Conflict Detection (4 tests)
 * 3. Equipment Conflict Detection (4 tests)
 * 4. Package Sequence Validation (4 tests)
 * 5. VIP Slot Protection (3 tests)
 * 6. Resolution Generation (4 tests)
 * 7. Severity Calculation (2 tests)
 * 8. Edge Cases & Performance (4 tests)
 * 
 * Total: 30 comprehensive test cases
 * 
 * @module decision-engine/providers/booking/__tests__
 */

import { ConflictDetectionProvider } from '../conflict-detection-provider';
import type {
  ConflictDetectionInput,
  ConflictDetectionOutput,
  ConflictDetectionEvaluationOptions,
} from '../types';

describe('ConflictDetectionProvider', () => {
  let provider: ConflictDetectionProvider;

  beforeEach(() => {
    provider = new ConflictDetectionProvider();
  });

  // Helper: Create test input with defaults
  const createTestInput = (
    overrides?: Partial<ConflictDetectionInput>
  ): ConflictDetectionInput => ({
    tenantId: 'test-tenant',
    booking: {
      customerId: 'customer-001',
      ktvId: 'ktv-001',
      roomId: 'room-001',
      equipmentIds: ['equipment-001'],
      packageId: 'package-001',
      sessionNumber: 2,
      requestedDate: '2026-07-15',
      requestedStartTime: '14:00',
      requestedEndTime: '15:30',
      durationMinutes: 90,
      serviceType: 'Massage',
      customerTier: 'loyal',
      ...overrides?.booking,
    },
    existingBookings: {
      customerBookings: [],
      roomBookings: [],
      equipmentBookings: [],
      packageSessions: [],
      vipSlots: [],
      ...overrides?.existingBookings,
    },
    config: {
      detectCustomerDoubleBooking: true,
      detectRoomConflicts: true,
      detectEquipmentConflicts: true,
      validatePackageSequence: true,
      enforceVipSlotProtection: true,
      ...overrides?.config,
    },
  });

  // =========================================================================
  // CATEGORY 1: CUSTOMER DOUBLE-BOOKING DETECTION
  // =========================================================================

  describe('1. Customer Double-Booking Detection', () => {
    it('should detect exact time overlap', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.success).toBe(false);
      expect(result.conflicts.length).toBeGreaterThan(0);
      expect(result.conflicts[0].type).toBe('customer_double_booking');
      expect(result.conflicts[0].severity).toBe('blocking');
      expect(result.severity).toBe('blocking');
      expect(result.matchedRules).toContain('conflict-200-customer-double-booking');
    });

    it('should detect partial overlap (start during existing)', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:30', // Starts during 14:00-15:30
          requestedEndTime: '16:00',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('customer_double_booking');
      expect(result.conflicts[0].severity).toBe('blocking');
    });

    it('should detect partial overlap (end during existing)', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '13:00',
          requestedEndTime: '14:30', // Ends during 14:00-15:30
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('customer_double_booking');
    });

    it('should warn about close bookings (within 30 minutes)', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '15:45', // 15 min after 15:30
          requestedEndTime: '17:15',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.severity === 'warning')).toBe(true);
      expect(result.matchedRules).toContain('conflict-201-customer-close-bookings');
    });

    it('should allow booking with no overlap', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '16:00', // 30+ min after 15:30
          requestedEndTime: '17:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
      expect(result.conflicts.length).toBe(0);
    });
  });

  // =========================================================================
  // CATEGORY 2: ROOM/BED CONFLICT DETECTION
  // =========================================================================

  describe('2. Room/Bed Conflict Detection', () => {
    it('should detect room double-booking', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('room_unavailable');
      expect(result.conflicts[0].severity).toBe('blocking');
      expect(result.matchedRules).toContain('conflict-210-room-double-booking');
    });

    it('should allow booking different room', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-002', // Different room
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001', // Different room
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should warn about insufficient turnover time', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '15:35', // Only 5 min after 15:30
          requestedEndTime: '17:05',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.severity === 'warning')).toBe(true);
      expect(result.matchedRules).toContain('conflict-211-room-turnover-time');
    });

    it('should allow booking with sufficient turnover time', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '15:45', // 15 min after 15:30
          requestedEndTime: '17:15',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 3: EQUIPMENT CONFLICT DETECTION
  // =========================================================================

  describe('3. Equipment Conflict Detection', () => {
    it('should detect equipment unavailability', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          equipmentIds: ['equipment-001'],
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('equipment_unavailable');
      expect(result.conflicts[0].severity).toBe('blocking');
      expect(result.matchedRules).toContain('conflict-220-equipment-unavailable');
    });

    it('should allow booking different equipment', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          equipmentIds: ['equipment-002'], // Different equipment
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should detect multiple equipment conflicts', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          equipmentIds: ['equipment-001', 'equipment-002'], // Multiple equipment
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('equipment_unavailable');
    });

    it('should allow booking with no equipment', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          equipmentIds: [], // No equipment
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 4: PACKAGE SEQUENCE VALIDATION
  // =========================================================================

  describe('4. Package Sequence Validation', () => {
    it('should detect package sequence violation', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          packageId: 'package-001',
          sessionNumber: 3, // Trying to book session 3
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          packageSessions: [
            {
              packageId: 'package-001',
              sessionNumber: 1,
              status: 'completed' as const,
              date: '2026-07-01',
            },
            // Session 2 missing - violation!
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('package_sequence_violation');
      expect(result.conflicts[0].severity).toBe('blocking');
      expect(result.matchedRules).toContain('conflict-230-package-sequence-violation');
    });

    it('should allow booking if all previous sessions completed', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          packageId: 'package-001',
          sessionNumber: 3,
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          packageSessions: [
            {
              packageId: 'package-001',
              sessionNumber: 1,
              status: 'completed' as const,
              date: '2026-07-01',
            },
            {
              packageId: 'package-001',
              sessionNumber: 2,
              status: 'completed' as const,
              date: '2026-07-08',
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should warn about insufficient interval between sessions', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          packageId: 'package-001',
          sessionNumber: 2,
          requestedDate: '2026-07-01', // Same day (< 24 hours)
          requestedStartTime: '20:00', // 6 hours after session 1 (14:00)
          requestedEndTime: '21:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          packageSessions: [
            {
              packageId: 'package-001',
              sessionNumber: 1,
              status: 'completed' as const,
              date: '2026-07-01', // Same day
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.severity === 'warning')).toBe(true);
      expect(result.matchedRules).toContain('conflict-231-package-min-interval');
    });

    it('should allow booking with sufficient interval', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          packageId: 'package-001',
          sessionNumber: 2,
          requestedDate: '2026-07-03', // 2 days after session 1 (48 hours)
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          packageSessions: [
            {
              packageId: 'package-001',
              sessionNumber: 1,
              status: 'completed' as const,
              date: '2026-07-01',
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 5: VIP SLOT PROTECTION
  // =========================================================================

  describe('5. VIP Slot Protection', () => {
    it('should block non-VIP from booking VIP slot', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal', // Not VIP
        },
        existingBookings: {
          vipSlots: [
            {
              date: '2026-07-15',
              startTime: '14:00',
              endTime: '16:00',
              reservedFor: 'vip' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts[0].type).toBe('vip_slot_protected');
      expect(result.conflicts[0].severity).toBe('blocking');
      expect(result.matchedRules).toContain('conflict-240-vip-slot-protected');
    });

    it('should allow VIP to book VIP slot', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'vip', // VIP customer
        },
        existingBookings: {
          vipSlots: [
            {
              date: '2026-07-15',
              startTime: '14:00',
              endTime: '16:00',
              reservedFor: 'vip' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should warn new customers about prime time slots', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '09:00', // Morning prime time (8-11)
          requestedEndTime: '10:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'new', // New customer
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.severity === 'warning')).toBe(true);
      expect(result.matchedRules).toContain('conflict-241-prime-time-vip-priority');
    });
  });

  // =========================================================================
  // CATEGORY 6: RESOLUTION GENERATION
  // =========================================================================

  describe('6. Resolution Generation', () => {
    it('should suggest reschedule for customer double-booking', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions[0].type).toBe('reschedule');
      expect(result.suggestions[0].message).toContain('Đặt lịch vào thời gian khác');
      expect(result.suggestions[0].automatic).toBe(true);
    });

    it('should suggest change room for room conflict', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.type === 'change_resource')).toBe(true);
      expect(result.suggestions.some(s => s.message.includes('Chọn phòng khác'))).toBe(true);
    });

    it('should suggest alternative equipment for equipment conflict', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          equipmentIds: ['equipment-001'],
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.suggestions.length).toBeGreaterThan(0);
      expect(result.suggestions.some(s => s.message.includes('thiết bị thay thế'))).toBe(true);
    });

    it('should sort suggestions by priority', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.suggestions.length).toBeGreaterThan(1);
      // Suggestions should be sorted by priority (highest first)
      for (let i = 0; i < result.suggestions.length - 1; i++) {
        expect(result.suggestions[i].priority).toBeGreaterThanOrEqual(
          result.suggestions[i + 1].priority
        );
      }
    });
  });

  // =========================================================================
  // CATEGORY 7: SEVERITY CALCULATION
  // =========================================================================

  describe('7. Severity Calculation', () => {
    it('should determine blocking severity for blocking conflicts', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.severity).toBe('blocking');
      expect(result.conflicts[0].severity).toBe('blocking');
    });

    it('should determine warning severity when only warnings', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '15:45', // Close booking (warning)
          requestedEndTime: '17:15',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.severity).toBe('warning');
      expect(result.conflicts.every(c => c.severity === 'warning')).toBe(true);
    });
  });

  // =========================================================================
  // CATEGORY 8: EDGE CASES & PERFORMANCE
  // =========================================================================

  describe('8. Edge Cases & Performance', () => {
    it('should handle cancelled bookings correctly', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'cancelled' as const, // Cancelled should not conflict
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should handle empty existing bookings', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [],
          roomBookings: [],
          equipmentBookings: [],
          packageSessions: [],
          vipSlots: [],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
      expect(result.conflicts.length).toBe(0);
    });

    it('should detect multiple conflicts simultaneously', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          equipmentIds: ['equipment-001'],
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(1);
      expect(result.conflicts.some(c => c.type === 'customer_double_booking')).toBe(true);
      expect(result.conflicts.some(c => c.type === 'room_unavailable')).toBe(true);
      expect(result.conflicts.some(c => c.type === 'equipment_unavailable')).toBe(true);
      expect(result.severity).toBe('blocking');
    });

    it('should complete detection in < 50ms', async () => {
      const input = createTestInput({
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.executionTime).toBeLessThan(50);
    });
  });

  // =========================================================================
  // ADDITIONAL EDGE CASES
  // =========================================================================

  describe('9. Additional Edge Cases', () => {
    it('should handle disabled conflict detection', async () => {
      const input = createTestInput({
        config: {
          detectCustomerDoubleBooking: false, // Disabled
          detectRoomConflicts: false,
          detectEquipmentConflicts: false,
          validatePackageSequence: false,
          enforceVipSlotProtection: false,
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should handle booking without room or equipment', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: undefined,
          equipmentIds: undefined,
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.success).toBe(true);
    });

    it('should handle booking without package', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          packageId: undefined,
          sessionNumber: undefined,
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.success).toBe(true);
    });

    it('should handle evening prime time slots', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '18:30', // Evening prime time (18:00-20:00)
          requestedEndTime: '20:00',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'new',
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.some(c => c.type === 'vip_slot_protected')).toBe(true);
      expect(result.matchedRules).toContain('conflict-241-prime-time-vip-priority');
    });

    it('should allow loyal customers in prime time', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '09:00', // Morning prime time
          requestedEndTime: '10:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal', // Loyal customers allowed
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should handle large number of existing bookings efficiently', async () => {
      // Create 50 existing bookings
      const customerBookings = Array.from({ length: 50 }, (_, i) => ({
        id: `booking-${i.toString().padStart(3, '0')}`,
        customerId: 'customer-001',
        startTime: `${(8 + Math.floor(i / 5)).toString().padStart(2, '0')}:00`,
        endTime: `${(9 + Math.floor(i / 5)).toString().padStart(2, '0')}:30`,
        status: 'confirmed' as const,
      }));

      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings,
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.executionTime).toBeLessThan(100);
      expect(result.provider).toBe('ConflictDetectionProvider');
    });
  });

  // =========================================================================
  // CATEGORY 10: INTEGRATION & REAL-WORLD SCENARIOS
  // =========================================================================

  describe('10. Integration & Real-World Scenarios', () => {
    it('should handle complex scenario: customer + room + equipment conflicts', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          equipmentIds: ['equipment-001'],
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBe(3); // All 3 conflict types
      expect(result.severity).toBe('blocking');
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    it('should handle package booking with sequence and interval issues', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          packageId: 'package-001',
          sessionNumber: 3,
          requestedDate: '2026-07-02', // Too soon (< 24h)
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'loyal',
        },
        existingBookings: {
          packageSessions: [
            {
              packageId: 'package-001',
              sessionNumber: 1,
              status: 'completed' as const,
              date: '2026-07-01',
            },
            // Session 2 missing - sequence violation
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThanOrEqual(1);
      // Should have sequence violation (blocking)
      expect(result.conflicts.some(c => c.type === 'package_sequence_violation' && c.severity === 'blocking')).toBe(true);
    });

    it('should handle VIP customer booking prime time successfully', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-vip',
          ktvId: 'ktv-001',
          requestedDate: '2026-07-15',
          requestedStartTime: '09:00', // Morning prime time
          requestedEndTime: '10:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'vip',
        },
        existingBookings: {
          vipSlots: [
            {
              date: '2026-07-15',
              startTime: '08:00',
              endTime: '11:00',
              reservedFor: 'vip' as const,
            },
          ],
        },
      });

      const result = await provider.detectConflicts(input);

      expect(result.hasConflicts).toBe(false);
      expect(result.success).toBe(true);
    });

    it('should provide comprehensive conflict report', async () => {
      const input = createTestInput({
        booking: {
          customerId: 'customer-001',
          ktvId: 'ktv-001',
          roomId: 'room-001',
          equipmentIds: ['equipment-001'],
          packageId: 'package-001',
          sessionNumber: 3,
          requestedDate: '2026-07-15',
          requestedStartTime: '14:00',
          requestedEndTime: '15:30',
          durationMinutes: 90,
          serviceType: 'Massage',
          customerTier: 'new', // New customer
        },
        existingBookings: {
          customerBookings: [
            {
              id: 'booking-001',
              customerId: 'customer-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          roomBookings: [
            {
              id: 'booking-room-001',
              roomId: 'room-001',
              startTime: '13:45', // Causes turnover warning
              endTime: '15:15',
              status: 'confirmed' as const,
            },
          ],
          equipmentBookings: [
            {
              id: 'booking-equip-001',
              equipmentId: 'equipment-001',
              startTime: '14:00',
              endTime: '15:30',
              status: 'confirmed' as const,
            },
          ],
          packageSessions: [
            {
              packageId: 'package-001',
              sessionNumber: 1,
              status: 'completed' as const,
              date: '2026-07-01',
            },
            // Session 2 missing
          ],
          vipSlots: [], // No VIP slots but prime time warning applies
        },
      });

      const result = await provider.detectConflicts(input);

      // Verify comprehensive result structure
      expect(result).toHaveProperty('hasConflicts');
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('conflicts');
      expect(result).toHaveProperty('severity');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('matchedRules');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('provider', 'ConflictDetectionProvider');

      // Should have multiple conflicts
      expect(result.hasConflicts).toBe(true);
      expect(result.conflicts.length).toBeGreaterThan(2);

      // Should have blocking conflicts
      expect(result.conflicts.some(c => c.severity === 'blocking')).toBe(true);

      // Conflicts should have detailed structure
      result.conflicts.forEach(conflict => {
        expect(conflict).toHaveProperty('type');
        expect(conflict).toHaveProperty('severity');
        expect(conflict).toHaveProperty('message');
        expect(conflict).toHaveProperty('resource');
        expect(conflict).toHaveProperty('conflictingBooking');
        expect(conflict).toHaveProperty('rule');
        expect(conflict).toHaveProperty('context');
      });

      // Should have suggestions
      expect(result.suggestions.length).toBeGreaterThan(0);
      result.suggestions.forEach(suggestion => {
        expect(suggestion).toHaveProperty('type');
        expect(suggestion).toHaveProperty('message');
        expect(suggestion).toHaveProperty('action');
        expect(suggestion).toHaveProperty('priority');
        expect(suggestion).toHaveProperty('automatic');
      });

      // Should have matched rules
      expect(result.matchedRules.length).toBeGreaterThan(0);

      // Execution time should be reasonable
      expect(result.executionTime).toBeLessThan(100);
    });
  });
});
