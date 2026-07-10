/**
 * Booking Decision Service Tests
 * 
 * Tests for Phase 1+2 integration functions:
 * - checkBookingCapacity() - Capacity Management integration
 * - autoAssignKtv() - Auto-Assignment integration
 * 
 * Test Strategy:
 * - Mock Supabase calls (database already tested separately)
 * - Mock Decision Engine providers (providers already tested separately)
 * - Focus on integration logic: data fetching, mapping, orchestration
 * 
 * @module services/__tests__
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkBookingCapacity,
  autoAssignKtv,
} from '../booking-decision.service';

// Mock Supabase
vi.mock('@/lib/supabase-server', () => ({
  createClient: vi.fn(),
}));

// Mock Decision Engine Providers
vi.mock('@/lib/decision-engine/providers/booking/capacity-management-provider', () => ({
  CapacityManagementProvider: vi.fn(),
}));

vi.mock('@/lib/decision-engine/providers/booking/auto-assignment-provider', () => ({
  AutoAssignmentProvider: vi.fn(),
}));

import { createClient } from '@/lib/supabase-server';
import { CapacityManagementProvider } from '@/lib/decision-engine/providers/booking/capacity-management-provider';
import { AutoAssignmentProvider } from '@/lib/decision-engine/providers/booking/auto-assignment-provider';

describe('Booking Decision Service', () => {
  let mockSupabase: any;
  let mockCapacityProvider: any;
  let mockAutoAssignmentProvider: any;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();


    // Mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn(),
      in: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
    };
    (createClient as any).mockResolvedValue(mockSupabase);

    // Mock Capacity Provider
    mockCapacityProvider = {
      checkCapacity: vi.fn(),
    };
    (CapacityManagementProvider as any).mockImplementation(() => mockCapacityProvider);

    // Mock Auto-Assignment Provider
    mockAutoAssignmentProvider = {
      evaluate: vi.fn(),
    };
    (AutoAssignmentProvider as any).mockImplementation(() => mockAutoAssignmentProvider);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ============================================================================
  // checkBookingCapacity() Tests
  // ============================================================================

  describe('checkBookingCapacity()', () => {
    const mockInput = {
      tenantId: 'tenant-001',
      ktvId: 'ktv-123',
      requestedDate: '2026-07-15',
      requestedStartTime: '14:00',
      requestedEndTime: '15:30',
      durationMinutes: 90,
      customerTier: 'vip' as const,
      serviceType: 'Massage',
    };

    it('should fetch KTV profile and validate existence', async () => {
      // Mock KTV not found
      mockSupabase.single.mockResolvedValueOnce({ data: null, error: null });

      await expect(checkBookingCapacity(mockInput))
        .rejects
        .toThrow('KTV not found: ktv-123');

      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.select).toHaveBeenCalledWith('id, full_name, position, max_daily_bookings');
      expect(mockSupabase.eq).toHaveBeenCalledWith('id', 'ktv-123');
      expect(mockSupabase.eq).toHaveBeenCalledWith('role', 'ktv');
    });

    it('should successfully check capacity when available', async () => {
      // Mock KTV profile
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'ktv-123',
            full_name: 'Alice Nguyen',
            position: 'Senior KTV',
            max_daily_bookings: 8,
          },
          error: null,
        })
        // Mock tenant config
        .mockResolvedValueOnce({
          data: {
            id: 'tenant-001',
            capacity_config: {
              minBreakMinutes: 15,
              workingHoursStart: '08:00',
              workingHoursEnd: '20:00',
              bufferPercentage: 10,
            },
          },
          error: null,
        });

      // Mock existing bookings query
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          {
            id: 'booking-1',
            assigned_time: '10:00',
            duration_minutes: 90,
            status: 'confirmed',
          },
        ],
        error: null,
      });

      // Mock capacity provider result
      mockCapacityProvider.checkCapacity.mockResolvedValueOnce({
        success: true,
        available: true,
        capacityDetails: {
          currentBookings: 1,
          maxBookings: 8,
          utilizationPercentage: 12.5,
          bufferSlotsUsed: 0,
          bufferSlotsAvailable: 1,
          isPeakHour: false,
        },
        conflicts: [],
        executionTime: 5,
      });

      const result = await checkBookingCapacity(mockInput);

      expect(result.available).toBe(true);
      expect(result.capacityDetails.currentBookings).toBe(1);
      expect(result.capacityDetails.maxBookings).toBe(8);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    it('should return conflicts when capacity not available', async () => {
      // Mock KTV profile
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'ktv-123',
            full_name: 'Alice Nguyen',
            position: 'Senior KTV',
            max_daily_bookings: 8,
          },
          error: null,
        })
        // Mock tenant config
        .mockResolvedValueOnce({
          data: { id: 'tenant-001', capacity_config: {} },
          error: null,
        });

      // Mock existing bookings (8 bookings = at limit)
      mockSupabase.select.mockResolvedValueOnce({
        data: Array.from({ length: 8 }, (_, i) => ({
          id: `booking-${i + 1}`,
          assigned_time: '10:00',
          duration_minutes: 90,
          status: 'confirmed',
        })),
        error: null,
      });

      // Mock capacity provider result (unavailable)
      mockCapacityProvider.checkCapacity.mockResolvedValueOnce({
        success: true,
        available: false,
        capacityDetails: {
          currentBookings: 8,
          maxBookings: 8,
          utilizationPercentage: 100,
          bufferSlotsUsed: 0,
          bufferSlotsAvailable: 0,
          isPeakHour: false,
        },
        conflicts: [
          {
            type: 'daily_limit',
            reason: 'KTV has reached maximum daily bookings (8/8)',
          },
        ],
        alternatives: [
          {
            suggestedDate: '2026-07-16',
            suggestedTime: '14:00',
            reason: 'Next available day with capacity',
          },
        ],
        executionTime: 5,
      });

      const result = await checkBookingCapacity(mockInput);

      expect(result.available).toBe(false);
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.length).toBeGreaterThan(0);
      expect(result.conflicts![0].type).toBe('daily_limit');
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it('should map existing bookings correctly with time calculations', async () => {
      // Mock KTV profile
      mockSupabase.single
        .mockResolvedValueOnce({
          data: {
            id: 'ktv-123',
            full_name: 'Alice Nguyen',
            position: 'Senior KTV',
            max_daily_bookings: 8,
          },
          error: null,
        })
        // Mock tenant config
        .mockResolvedValueOnce({
          data: { id: 'tenant-001', capacity_config: {} },
          error: null,
        });

      // Mock existing bookings
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          {
            id: 'booking-1',
            assigned_time: '10:00',
            duration_minutes: 90,
            status: 'confirmed',
          },
          {
            id: 'booking-2',
            assigned_time: '13:30',
            duration_minutes: 60,
            status: 'pending',
          },
        ],
        error: null,
      });

      // Capture input sent to provider
      let capturedInput: any;
      mockCapacityProvider.checkCapacity.mockImplementation((input: any) => {
        capturedInput = input;
        return Promise.resolve({
          success: true,
          available: true,
          capacityDetails: {
            currentBookings: 2,
            maxBookings: 8,
            utilizationPercentage: 25,
            bufferSlotsUsed: 0,
            bufferSlotsAvailable: 1,
            isPeakHour: false,
          },
          executionTime: 5,
        });
      });

      await checkBookingCapacity(mockInput);

      // Verify booking mapping
      expect(capturedInput.existingBookings).toHaveLength(2);
      
      // First booking: 10:00 + 90min = 11:30
      expect(capturedInput.existingBookings[0]).toMatchObject({
        id: 'booking-1',
        startTime: '10:00',
        endTime: '11:30',
        durationMinutes: 90,
        status: 'confirmed',
      });

      // Second booking: 13:30 + 60min = 14:30
      expect(capturedInput.existingBookings[1]).toMatchObject({
        id: 'booking-2',
        startTime: '13:30',
        endTime: '14:30',
        durationMinutes: 60,
        status: 'pending',
      });
    });
  });

  // ============================================================================
  // autoAssignKtv() Tests
  // ============================================================================

  describe('autoAssignKtv()', () => {
    const mockInput = {
      tenantId: 'tenant-001',
      customerId: 'customer-456',
      serviceId: 'service-massage',
      serviceType: 'Massage',
      requestedDate: '2026-07-15',
      requestedStartTime: '14:00',
      durationMinutes: 90,
      customerTier: 'vip' as const,
    };

    it('should return null when no KTVs available', async () => {
      // Mock empty KTV list
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null,
      });

      const result = await autoAssignKtv(mockInput);

      expect(result.assignedKtvId).toBeNull();
      expect(result.confidence).toBe(0);
      expect(result.reason).toContain('Không có KTV nào khả dụng');
      expect(result.executionTime).toBe(0);
    });

    it('should successfully assign KTV with high confidence', async () => {
      // Mock KTV list
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            {
              id: 'ktv-001',
              full_name: 'Alice Nguyen',
              position: 'Senior KTV',
              skills: ['Massage', 'Deep Tissue'],
              specializations: ['Massage'],
              avg_rating: 4.8,
              years_of_service: 5,
              max_daily_bookings: 8,
            },
            {
              id: 'ktv-002',
              full_name: 'Bob Tran',
              position: 'KTV',
              skills: ['Massage', 'Facial'],
              specializations: ['Facial'],
              avg_rating: 4.5,
              years_of_service: 2,
              max_daily_bookings: 8,
            },
          ],
          error: null,
        })
        // Mock customer history
        .mockResolvedValueOnce({
          data: [
            { assigned_ktv_id: 'ktv-002' },
            { assigned_ktv_id: 'ktv-002' },
          ],
          error: null,
        })
        // Mock workload for ktv-001
        .mockResolvedValueOnce({ data: [{ id: '1' }, { id: '2' }], error: null })
        // Mock workload for ktv-002
        .mockResolvedValueOnce({ data: [{ id: '1' }], error: null });

      // Mock auto-assignment provider result
      mockAutoAssignmentProvider.evaluate.mockResolvedValueOnce({
        success: true,
        assignedKtvId: 'ktv-001',
        confidence: 0.85,
        reason: 'Alice Nguyen is the best match (score: 85.0)',
        scoreBreakdown: {
          skillMatch: 25,
          availability: 20,
          workload: 20,
          performance: 15,
          preference: 0,
          specialization: 10,
        },
        alternatives: [
          {
            ktvId: 'ktv-002',
            score: 65,
            reason: 'Bob Tran (score: 65.0)',
          },
        ],
        executionTime: 8,
        provider: 'AutoAssignmentProvider',
      });

      const result = await autoAssignKtv(mockInput);

      expect(result.assignedKtvId).toBe('ktv-001');
      expect(result.assignedKtvName).toBe('Alice Nguyen');
      expect(result.confidence).toBe(0.85);
      expect(result.reason).toContain('Alice Nguyen');
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBe(1);
      expect(result.alternatives![0].ktvId).toBe('ktv-002');
      expect(result.alternatives![0].ktvName).toBe('Bob Tran');
    });

    it('should build candidate workload correctly', async () => {
      // Mock KTV list
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            {
              id: 'ktv-001',
              full_name: 'Alice Nguyen',
              position: 'Senior KTV',
              skills: ['Massage'],
              specializations: ['Massage'],
              avg_rating: 4.8,
              years_of_service: 5,
              max_daily_bookings: 8,
            },
          ],
          error: null,
        })
        // Mock customer history (empty)
        .mockResolvedValueOnce({ data: [], error: null })
        // Mock workload for ktv-001 (5 bookings today)
        .mockResolvedValueOnce({
          data: [
            { id: '1' },
            { id: '2' },
            { id: '3' },
            { id: '4' },
            { id: '5' },
          ],
          error: null,
        });

      // Capture candidates sent to provider
      let capturedCandidates: any[];
      mockAutoAssignmentProvider.evaluate.mockImplementation((_input: any, candidates: any[]) => {
        capturedCandidates = candidates;
        return Promise.resolve({
          success: true,
          assignedKtvId: 'ktv-001',
          confidence: 0.8,
          reason: 'Assigned',
          executionTime: 5,
          provider: 'AutoAssignmentProvider',
        });
      });

      await autoAssignKtv(mockInput);

      // Verify candidate structure
      expect(capturedCandidates!).toHaveLength(1);
      expect(capturedCandidates![0]).toMatchObject({
        id: 'ktv-001',
        name: 'Alice Nguyen',
        position: 'Senior KTV',
        currentWorkload: 5,
        maxDailyBookings: 8,
        availability: {
          isAvailable: true,
        },
        isPreferredByCustomer: false,
        customerBookingCount: 0,
      });
    });

    it('should prioritize preferred KTV when specified', async () => {
      const inputWithPreference = {
        ...mockInput,
        preferredKtvId: 'ktv-002',
      };

      // Mock KTV list
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            {
              id: 'ktv-001',
              full_name: 'Alice Nguyen',
              position: 'Senior KTV',
              skills: ['Massage'],
              specializations: ['Massage'],
              avg_rating: 4.8,
              years_of_service: 5,
              max_daily_bookings: 8,
            },
            {
              id: 'ktv-002',
              full_name: 'Bob Tran',
              position: 'KTV',
              skills: ['Massage'],
              specializations: [],
              avg_rating: 4.5,
              years_of_service: 2,
              max_daily_bookings: 8,
            },
          ],
          error: null,
        })
        // Mock customer history
        .mockResolvedValueOnce({ data: [], error: null })
        // Mock workload for ktv-001
        .mockResolvedValueOnce({ data: [], error: null })
        // Mock workload for ktv-002
        .mockResolvedValueOnce({ data: [], error: null });

      // Capture candidates sent to provider
      let capturedCandidates: any[];
      mockAutoAssignmentProvider.evaluate.mockImplementation((_input: any, candidates: any[]) => {
        capturedCandidates = candidates;
        return Promise.resolve({
          success: true,
          assignedKtvId: 'ktv-002',
          confidence: 0.9,
          reason: 'Bob Tran (preferred by customer)',
          executionTime: 5,
          provider: 'AutoAssignmentProvider',
        });
      });

      await autoAssignKtv(inputWithPreference);

      // Verify preferred flag set correctly
      const preferredCandidate = capturedCandidates!.find((c: any) => c.id === 'ktv-002');
      expect(preferredCandidate?.isPreferredByCustomer).toBe(true);
      
      const nonPreferredCandidate = capturedCandidates!.find((c: any) => c.id === 'ktv-001');
      expect(nonPreferredCandidate?.isPreferredByCustomer).toBe(false);
    });

    it('should track customer booking history correctly', async () => {
      // Mock KTV list
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            {
              id: 'ktv-001',
              full_name: 'Alice Nguyen',
              position: 'Senior KTV',
              skills: ['Massage'],
              specializations: ['Massage'],
              avg_rating: 4.8,
              years_of_service: 5,
              max_daily_bookings: 8,
            },
            {
              id: 'ktv-002',
              full_name: 'Bob Tran',
              position: 'KTV',
              skills: ['Massage'],
              specializations: [],
              avg_rating: 4.5,
              years_of_service: 2,
              max_daily_bookings: 8,
            },
          ],
          error: null,
        })
        // Mock customer history (3 bookings with ktv-001, 1 with ktv-002)
        .mockResolvedValueOnce({
          data: [
            { assigned_ktv_id: 'ktv-001' },
            { assigned_ktv_id: 'ktv-001' },
            { assigned_ktv_id: 'ktv-001' },
            { assigned_ktv_id: 'ktv-002' },
          ],
          error: null,
        })
        // Mock workload for ktv-001
        .mockResolvedValueOnce({ data: [], error: null })
        // Mock workload for ktv-002
        .mockResolvedValueOnce({ data: [], error: null });

      // Capture candidates sent to provider
      let capturedCandidates: any[];
      mockAutoAssignmentProvider.evaluate.mockImplementation((_input: any, candidates: any[]) => {
        capturedCandidates = candidates;
        return Promise.resolve({
          success: true,
          assignedKtvId: 'ktv-001',
          confidence: 0.8,
          reason: 'Assigned',
          executionTime: 5,
          provider: 'AutoAssignmentProvider',
        });
      });

      await autoAssignKtv(mockInput);

      // Verify booking count
      const aliceCandidate = capturedCandidates!.find((c: any) => c.id === 'ktv-001');
      expect(aliceCandidate?.customerBookingCount).toBe(3);
      
      const bobCandidate = capturedCandidates!.find((c: any) => c.id === 'ktv-002');
      expect(bobCandidate?.customerBookingCount).toBe(1);
    });

    it('should mark KTV as unavailable when fully booked', async () => {
      // Mock KTV list
      mockSupabase.select
        .mockResolvedValueOnce({
          data: [
            {
              id: 'ktv-001',
              full_name: 'Alice Nguyen',
              position: 'Senior KTV',
              skills: ['Massage'],
              specializations: ['Massage'],
              avg_rating: 4.8,
              years_of_service: 5,
              max_daily_bookings: 8,
            },
          ],
          error: null,
        })
        // Mock customer history
        .mockResolvedValueOnce({ data: [], error: null })
        // Mock workload for ktv-001 (8/8 bookings = fully booked)
        .mockResolvedValueOnce({
          data: Array.from({ length: 8 }, (_, i) => ({ id: `${i + 1}` })),
          error: null,
        });

      // Capture candidates sent to provider
      let capturedCandidates: any[];
      mockAutoAssignmentProvider.evaluate.mockImplementation((_input: any, candidates: any[]) => {
        capturedCandidates = candidates;
        return Promise.resolve({
          success: true,
          assignedKtvId: null,
          confidence: 0,
          reason: 'No available KTV',
          executionTime: 5,
          provider: 'AutoAssignmentProvider',
        });
      });

      await autoAssignKtv(mockInput);

      // Verify availability flag
      expect(capturedCandidates![0].availability.isAvailable).toBe(false);
      expect(capturedCandidates![0].currentWorkload).toBe(8);
      expect(capturedCandidates![0].maxDailyBookings).toBe(8);
    });
  });
});
