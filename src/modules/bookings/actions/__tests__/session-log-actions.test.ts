/**
 * Session Log Actions Tests
 * 
 * Tests for booking creation with Decision Engine integration:
 * - createBookingWithValidation() - Main booking creation flow
 * - updateSessionLog() - Session rescheduling
 * - deleteSessionLog() - Session deletion
 * 
 * Test Strategy:
 * - Mock Supabase calls (database already tested separately)
 * - Mock service functions (services already tested separately)
 * - Focus on orchestration logic: validation, security, flow control
 * 
 * @module bookings/actions/__tests__
 */



const mockCreateClient = jest.fn();
const mockCheckBookingCapacity = jest.fn();
const mockAutoAssignKtv = jest.fn();
const mockCheckBookingConflicts = jest.fn();
const mockRevalidatePath = jest.fn();

// Mock Supabase
jest.mock('@/lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

// Mock booking decision service
jest.mock('@/services/booking-decision.service', () => ({
  checkBookingCapacity: (...args: unknown[]) => mockCheckBookingCapacity(...args),
  autoAssignKtv: (...args: unknown[]) => mockAutoAssignKtv(...args),
  checkBookingConflicts: (...args: unknown[]) => mockCheckBookingConflicts(...args),
}));

// Mock Next.js cache
jest.mock('next/cache', () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));

import {
  createBookingWithValidation,
  updateSessionLog,
  deleteSessionLog,
} from '../session-log-actions';

describe('Session Log Actions', () => {
  let mockSupabase: any; // eslint-disable-line @typescript-eslint/no-explicit-any
  let mockQueryBuilder: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock Query Builder
    mockQueryBuilder = {
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn(),
      maybeSingle: jest.fn(),
      then: jest.fn((onfulfilled: any) => onfulfilled({ data: null, error: null })), // eslint-disable-line @typescript-eslint/no-explicit-any
    };

    // Mock Supabase client
    mockSupabase = {
      auth: {
        getUser: jest.fn(),
      },
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    };
    mockCreateClient.mockResolvedValue(mockSupabase);

    // Default mock response for checkBookingConflicts
    mockCheckBookingConflicts.mockResolvedValue({
      conflicts: [],
      alternatives: [],
    });

    // Default mock response for single()
    mockQueryBuilder.single.mockResolvedValue({
      data: {
        id: 'session-001',
        booking_id: 'booking-123',
        tenant_id: 'tenant-001',
        status: 'pending',
        assigned_date: '2026-07-15',
        assigned_time: '14:00',
        completed_by_ktv_id: 'ktv-456',
        completed_date: null,
      },
      error: null,
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // ============================================================================
  // createBookingWithValidation() Tests
  // ============================================================================

  describe('createBookingWithValidation()', () => {
    const mockInput = {
      bookingId: 'booking-123',
      assignedDate: '2026-07-15',
      assignedTime: '14:00',
      assignedKtvId: 'ktv-456',
      customerId: 'customer-789',
      serviceType: 'Massage',
      durationMinutes: 90,
      customerTier: 'vip' as const,
      tenantId: 'tenant-001',
      serviceId: 'service-massage',
    };

    // ========== Input Validation Tests ==========

    it('should reject invalid input - missing bookingId', async () => {
      const invalidInput = { ...mockInput, bookingId: '' };
      const result = await createBookingWithValidation(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('bookingId is required');
    });

    it('should reject invalid input - missing assignedDate', async () => {
      const invalidInput = { ...mockInput, assignedDate: '' };
      const result = await createBookingWithValidation(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('assignedDate is required');
    });

    it('should reject invalid input - missing assignedTime', async () => {
      const invalidInput = { ...mockInput, assignedTime: '' };
      const result = await createBookingWithValidation(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('assignedTime is required');
    });

    it('should reject invalid date format', async () => {
      const invalidInput = { ...mockInput, assignedDate: '15-07-2026' };
      const result = await createBookingWithValidation(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('assignedDate must be in YYYY-MM-DD format');
    });

    it('should reject invalid time format', async () => {
      const invalidInput = { ...mockInput, assignedTime: '14:00:00' };
      const result = await createBookingWithValidation(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('assignedTime must be in HH:mm format');
    });

    it('should reject invalid durationMinutes', async () => {
      const invalidInput = { ...mockInput, durationMinutes: -30 };
      const result = await createBookingWithValidation(invalidInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('durationMinutes must be positive');
    });

    // ========== Authentication Tests ==========

    it('should reject when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await createBookingWithValidation(mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    // ========== Booking Verification Tests ==========

    it('should reject when booking does not exist', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: null,
        error: new Error('Booking not found'),
      });

      const result = await createBookingWithValidation(mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Booking không tồn tại');
    });

    it('should reject when booking belongs to different tenant', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'booking-123',
          tenant_id: 'different-tenant',
          customer_id: 'customer-789',
          status: 'active',
        },
        error: null,
      });

      const result = await createBookingWithValidation(mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Booking không thuộc chi nhánh này');
    });

    // ========== Capacity Check Tests ==========

    it('should check capacity when KTV assigned and not skipped', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'booking-123',
            tenant_id: 'tenant-001',
            customer_id: 'customer-789',
            status: 'active',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'session-001' },
          error: null,
        });

      mockCheckBookingCapacity.mockResolvedValueOnce({
        available: true,
        capacityDetails: {
          currentBookings: 3,
          maxBookings: 8,
          utilizationPercentage: 37.5,
          bufferSlotsUsed: 0,
          bufferSlotsAvailable: 1,
          isPeakHour: false,
        },
        executionTime: 5,
      });

      const result = await createBookingWithValidation(mockInput);

      expect(mockCheckBookingCapacity).toHaveBeenCalledWith({
        tenantId: 'tenant-001',
        ktvId: 'ktv-456',
        requestedDate: '2026-07-15',
        requestedStartTime: '14:00',
        requestedEndTime: '15:30',
        durationMinutes: 90,
        customerTier: 'vip',
        serviceType: 'Massage',
      });
      expect(result.success).toBe(true);
    });

    it('should return conflicts when capacity not available', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'booking-123',
          tenant_id: 'tenant-001',
          customer_id: 'customer-789',
          status: 'active',
        },
        error: null,
      });

      mockCheckBookingCapacity.mockResolvedValueOnce({
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
            reason: 'Next available day',
          },
        ],
        executionTime: 5,
      });

      const result = await createBookingWithValidation(mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Không thể tạo lịch hẹn do xung đột');
      expect(result.conflicts).toBeDefined();
      expect(result.conflicts!.length).toBeGreaterThan(0);
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives!.length).toBeGreaterThan(0);
    });

    it('should skip capacity check when skipCapacityCheck=true', async () => {
      const inputWithSkip = { ...mockInput, skipCapacityCheck: true };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'booking-123',
            tenant_id: 'tenant-001',
            customer_id: 'customer-789',
            status: 'active',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'session-001' },
          error: null,
        });

      await createBookingWithValidation(inputWithSkip);

      expect(mockCheckBookingCapacity).not.toHaveBeenCalled();
    });

    // ========== Auto-Assignment Tests ==========

    it('should auto-assign KTV when not provided and not skipped', async () => {
      const inputNoKtv = { ...mockInput, assignedKtvId: undefined };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'booking-123',
            tenant_id: 'tenant-001',
            customer_id: 'customer-789',
            status: 'active',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'session-001' },
          error: null,
        });

      mockAutoAssignKtv.mockResolvedValueOnce({
        assignedKtvId: 'ktv-auto-assigned',
        assignedKtvName: 'Alice Nguyen',
        confidence: 0.85,
        reason: 'Alice Nguyen is the best match',
        executionTime: 8,
      });

      const result = await createBookingWithValidation(inputNoKtv);

      expect(mockAutoAssignKtv).toHaveBeenCalledWith({
        tenantId: 'tenant-001',
        customerId: 'customer-789',
        serviceId: 'service-massage',
        serviceType: 'Massage',
        requestedDate: '2026-07-15',
        requestedStartTime: '14:00',
        durationMinutes: 90,
        customerTier: 'vip',
      });
      expect(result.success).toBe(true);
      expect(result.autoAssignment).toBeDefined();
      expect(result.autoAssignment?.assignedKtvId).toBe('ktv-auto-assigned');
      expect(result.autoAssignment?.assignedKtvName).toBe('Alice Nguyen');
    });

    it('should fail when auto-assignment returns no KTV', async () => {
      const inputNoKtv = { ...mockInput, assignedKtvId: undefined };

      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single.mockResolvedValueOnce({
        data: {
          id: 'booking-123',
          tenant_id: 'tenant-001',
          customer_id: 'customer-789',
          status: 'active',
        },
        error: null,
      });

      mockAutoAssignKtv.mockResolvedValueOnce({
        assignedKtvId: null,
        confidence: 0,
        reason: 'Không có KTV nào khả dụng',
        executionTime: 5,
      });

      const result = await createBookingWithValidation(inputNoKtv);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Không tìm thấy KTV phù hợp');
    });

    // ========== Full Flow Success Tests ==========

    it('should successfully create session log with all validations', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'booking-123',
            tenant_id: 'tenant-001',
            customer_id: 'customer-789',
            status: 'active',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: { id: 'session-001' },
          error: null,
        });

      mockCheckBookingCapacity.mockResolvedValueOnce({
        available: true,
        capacityDetails: {
          currentBookings: 3,
          maxBookings: 8,
          utilizationPercentage: 37.5,
          bufferSlotsUsed: 0,
          bufferSlotsAvailable: 1,
          isPeakHour: false,
        },
        executionTime: 5,
      });

      const result = await createBookingWithValidation(mockInput);

      expect(result.success).toBe(true);
      expect(result.sessionId).toBe('session-001');
      expect(mockSupabase.from).toHaveBeenCalledWith('session_logs');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings/booking-123');
    });

    it('should handle database insert errors gracefully', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      mockQueryBuilder.single
        .mockResolvedValueOnce({
          data: {
            id: 'booking-123',
            tenant_id: 'tenant-001',
            customer_id: 'customer-789',
            status: 'active',
          },
          error: null,
        })
        .mockResolvedValueOnce({
          data: null,
          error: new Error('Database constraint violation'),
        });

      mockCheckBookingCapacity.mockResolvedValueOnce({
        available: true,
        capacityDetails: {
          currentBookings: 3,
          maxBookings: 8,
          utilizationPercentage: 37.5,
          bufferSlotsUsed: 0,
          bufferSlotsAvailable: 1,
          isPeakHour: false,
        },
        executionTime: 5,
      });

      const result = await createBookingWithValidation(mockInput);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Không thể tạo session log');
    });
  });

  // ============================================================================
  // updateSessionLog() Tests
  // ============================================================================

  describe('updateSessionLog()', () => {
    it('should update session log successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const result = await updateSessionLog(
        'session-001',
        'tenant-001',
        {
          assignedDate: '2026-07-16',
          assignedTime: '15:00',
          status: 'confirmed',
        }
      );

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('session_logs');
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
    });

    it('should reject when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await updateSessionLog(
        'session-001',
        'tenant-001',
        { status: 'confirmed' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });
  });

  // ============================================================================
  // deleteSessionLog() Tests
  // ============================================================================

  describe('deleteSessionLog()', () => {
    it('should delete session log successfully', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      const result = await deleteSessionLog('session-001', 'tenant-001');

      expect(result.success).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('session_logs');
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
      expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/bookings');
    });

    it('should reject when user not authenticated', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: null },
        error: new Error('Not authenticated'),
      });

      const result = await deleteSessionLog('session-001', 'tenant-001');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unauthorized');
    });

    it('should handle database delete errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValueOnce({
        data: { user: { id: 'user-123' } },
        error: null,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockQueryBuilder.then.mockImplementationOnce((onfulfilled: any) => onfulfilled({
        error: new Error('Foreign key constraint'),
      }));

      const result = await deleteSessionLog('session-001', 'tenant-001');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });
});
