/**
 * Automated Tests for Overbooking Detection
 * 
 * Tests the checkBookingConflicts() function with various scenarios.
 * 
 * @phase Phase B - Week 1
 * @status 🧪 Testing
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { checkBookingConflicts } from '../booking-decisions';
import { overbookingDetectionPolicy } from '@/policies/booking/overbooking-detection';
import { createClient } from '@/lib/supabase-server';

// Mock dependencies
jest.mock('@/lib/supabase-server');
jest.mock('@/policies/booking/overbooking-detection');

const mockCreateClient = createClient as jest.MockedFunction<typeof createClient>;
const mockPolicy = overbookingDetectionPolicy as jest.Mocked<typeof overbookingDetectionPolicy>;

describe('checkBookingConflicts', () => {
  // Mock user and tenant context
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client with auth and database
    const mockSupabase = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-123' } },
          error: null,
        }),
      },
      from: jest.fn((table: string) => ({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { tenant_id: '11111111-1111-1111-1111-111111111111' },
          error: null,
        }),
      })),
    };

    mockCreateClient.mockResolvedValue(mockSupabase as any);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 1: Happy Path - No Conflicts
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE when no conflicts exist', async () => {
    // Mock policy returns approve
    mockPolicy.evaluate.mockResolvedValue({
      decision: 'approve',
      reason: 'Không phát hiện xung đột',
      confidence: 1.0,
      metadata: {},
    });

    const result = await checkBookingConflicts({
      bookingId: 'booking-123',
      ktvId: 'ktv-1',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '09:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE');
    expect(result.message).toContain('Không phát hiện xung đột');
    expect(mockPolicy.evaluate).toHaveBeenCalledWith({
      ktvId: 'ktv-1',
      roomId: 'room-1',
      preferredTime: '09:00',
      preferredDate: '2026-06-22',
      duration: 90,
      tenantId: '11111111-1111-1111-1111-111111111111',
      bookingId: 'booking-123',
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 2: KTV Double Booking - Should REJECT
  // ─────────────────────────────────────────────────────────────────────────

  it('should REJECT when KTV has conflicting booking', async () => {
    // Mock policy returns reject with conflict details
    mockPolicy.evaluate.mockResolvedValue({
      decision: 'reject',
      reason: 'KTV đã có lịch trùng thời gian',
      confidence: 1.0,
      metadata: {
        conflicts: [
          {
            type: 'ktv_double_booking',
            time: '09:00',
            customer: 'Nguyễn Thị A',
            bookingId: 'booking-existing',
          },
        ],
      },
    });

    const result = await checkBookingConflicts({
      bookingId: 'booking-new',
      ktvId: 'ktv-1',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '09:30', // Overlaps with existing 09:00
      durationMinutes: 90,
    });

    expect(result.decision).toBe('REJECT');
    expect(result.message).toContain('KTV đã có lịch trùng thời gian');
    expect(result.context?.conflicts).toBeDefined();
    expect(result.context?.conflicts[0].type).toBe('ktv_double_booking');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 3: Room Double Booking - Should REJECT
  // ─────────────────────────────────────────────────────────────────────────

  it('should REJECT when room has conflicting booking', async () => {
    mockPolicy.evaluate.mockResolvedValue({
      decision: 'reject',
      reason: 'Phòng đã có lịch trùng thời gian',
      confidence: 1.0,
      metadata: {
        conflicts: [
          {
            type: 'room_double_booking',
            time: '14:00',
            room: 'Phòng VIP 1',
            bookingId: 'booking-existing',
          },
        ],
      },
    });

    const result = await checkBookingConflicts({
      bookingId: 'booking-new',
      ktvId: 'ktv-2', // Different KTV
      bookingResourceId: 'room-1', // Same room
      assignedDate: '2026-06-22',
      assignedTime: '14:30',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('REJECT');
    expect(result.message).toContain('Phòng đã có lịch trùng thời gian');
    expect(result.context?.conflicts[0].type).toBe('room_double_booking');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 4: Soft Limit Warning (>8 sessions) - Should APPROVE with WARNING
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE_WITH_WARNING when KTV has >8 sessions', async () => {
    mockPolicy.evaluate.mockResolvedValue({
      decision: 'approve',
      reason: 'KTV đã có 9 ca trong ngày (khuyến nghị tối đa 8 ca)',
      confidence: 0.7,
      metadata: {
        isWarning: true,
        sessionCount: 9,
      },
    });

    const result = await checkBookingConflicts({
      bookingId: 'booking-9th',
      ktvId: 'ktv-busy',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '20:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE_WITH_WARNING');
    expect(result.message).toContain('khuyến nghị');
    expect(result.context?.sessionCount).toBe(9);
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 5: Hard Limit Block (≥10 sessions) - Should REJECT
  // ─────────────────────────────────────────────────────────────────────────

  it('should REJECT when KTV has ≥10 sessions', async () => {
    mockPolicy.evaluate.mockResolvedValue({
      decision: 'reject',
      reason: 'KTV đã đạt giới hạn tối đa 10 ca/ngày',
      confidence: 1.0,
      metadata: {
        sessionCount: 10,
      },
    });

    const result = await checkBookingConflicts({
      bookingId: 'booking-10th',
      ktvId: 'ktv-busy',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '21:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('REJECT');
    expect(result.message).toContain('giới hạn tối đa');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 6: No KTV Assigned - Should Skip Check
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE when no KTV is assigned', async () => {
    const result = await checkBookingConflicts({
      bookingId: 'booking-no-ktv',
      ktvId: null, // No KTV
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '09:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE');
    expect(result.message).toContain('no KTV');
    expect(mockPolicy.evaluate).not.toHaveBeenCalled(); // Skip policy check
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 7: No Date Assigned - Should Skip Check
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE when no date is assigned', async () => {
    const result = await checkBookingConflicts({
      bookingId: 'booking-no-date',
      ktvId: 'ktv-1',
      bookingResourceId: 'room-1',
      assignedDate: null, // No date
      assignedTime: '09:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE');
    expect(result.message).toContain('no KTV or date');
    expect(mockPolicy.evaluate).not.toHaveBeenCalled();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 8: Fail-Open Strategy - Error Should Allow Booking
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE (fail-open) when policy throws error', async () => {
    // Mock policy throws error
    mockPolicy.evaluate.mockRejectedValue(new Error('Database connection failed'));

    const result = await checkBookingConflicts({
      bookingId: 'booking-error',
      ktvId: 'ktv-1',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '09:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE');
    expect(result.message).toContain('fail-open');
    expect(result.context?.error).toBeDefined();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 9: No Tenant Context - Should Skip Check
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE when no tenant context exists', async () => {
    // Mock no tenant_id
    const mockSupabaseNoTenant = {
      auth: {
        getUser: jest.fn().mockResolvedValue({
          data: { user: { id: 'test-user-123' } },
          error: null,
        }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: null, // No profile
          error: null,
        }),
      }),
    };

    mockCreateClient.mockResolvedValue(mockSupabaseNoTenant as any);

    const result = await checkBookingConflicts({
      bookingId: 'booking-no-tenant',
      ktvId: 'ktv-1',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '09:00',
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE');
    expect(result.message).toContain('no tenant context');
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Test 10: Adjacent Time Slots - Should NOT Conflict
  // ─────────────────────────────────────────────────────────────────────────

  it('should APPROVE when time slots are adjacent (no overlap)', async () => {
    mockPolicy.evaluate.mockResolvedValue({
      decision: 'approve',
      reason: 'Không phát hiện xung đột',
      confidence: 1.0,
      metadata: {
        note: 'Time slots are adjacent but not overlapping',
      },
    });

    // First booking: 09:00-10:30
    // Second booking: 10:30-12:00 (starts when first ends)
    const result = await checkBookingConflicts({
      bookingId: 'booking-adjacent',
      ktvId: 'ktv-1',
      bookingResourceId: 'room-1',
      assignedDate: '2026-06-22',
      assignedTime: '10:30', // Starts when previous ends
      durationMinutes: 90,
    });

    expect(result.decision).toBe('APPROVE');
  });
});
