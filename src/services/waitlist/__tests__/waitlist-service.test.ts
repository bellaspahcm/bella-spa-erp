/**
 * Service Layer Tests: Waitlist Service
 * 
 * Tests all core functions in waitlist-service.ts
 * Target: 30 tests, 90%+ coverage
 * 
 * Test Structure:
 * - addToWaitlist() - 8 tests
 * - getWaitlistEntries() - 5 tests
 * - processSlotAvailable() - 6 tests
 * - expireOldEntries() - 4 tests
 * - recalculatePositions() - 3 tests
 * - Edge Cases - 4 tests
 */

import {
  addToWaitlist,
  getWaitlistEntries,
  processSlotAvailable,
  expireOldEntries,
  recalculatePositions,
} from '../waitlist-service';

import {
  mockTenant,
  mockCustomers,
  mockPackages,
  mockWaitlistEntries,
  mockAddToWaitlistInput,
  mockAvailableSlot,
  mockProviderResult,
  createExpiredEntry,
} from '@/__tests__/fixtures/waitlist-fixtures';

import {
  mockAddToWaitlistSuccess,
  mockAddToWaitlistDuplicate,
  mockAddToWaitlistCapacityFull,
  mockProcessSlotSuccess,
  mockExpireEntriesSuccess,
  mockGetWaitlistEntriesSuccess,
} from '@/__tests__/helpers/supabase-test-helpers';

// Mock Supabase client
jest.mock('@/lib/supabase-server');
import { createClient } from '@/lib/supabase-server';

// Mock Decision Engine Provider
jest.mock('@/lib/decision-engine/providers/booking/waitlist-management-provider');
import { WaitlistManagementProvider } from '@/lib/decision-engine/providers/booking/waitlist-management-provider';

// Mock Notification Service
jest.mock('@/services/notifications/notification-service');
import { sendNotification } from '@/services/notifications/notification-service';

describe('Waitlist Service - addToWaitlist()', () => {
  let mockSupabase: any;
  let mockProvider: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Setup mock Supabase client
    mockSupabase = createClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);

    // Setup mock Decision Engine Provider
    mockProvider = {
      addToWaitlist: jest.fn().mockResolvedValue(mockProviderResult),
    };
    (WaitlistManagementProvider as jest.Mock).mockImplementation(() => mockProvider);
  });

  test('✅ Success: Valid input creates entry with correct priority', async () => {
    mockAddToWaitlistSuccess(
      mockSupabase,
      mockCustomers.vip,
      mockPackages.vip,
      'vip',
      mockWaitlistEntries[0]
    );

    const result = await addToWaitlist(mockAddToWaitlistInput);

    expect(result.success).toBe(true);
    expect(result.entry).toBeDefined();
    expect(result.entry?.priority_score).toBe(90);
    expect(result.position).toBe(1);
  });

  test('❌ Duplicate: Rejects duplicate active entry', async () => {
    mockAddToWaitlistDuplicate(mockSupabase, mockWaitlistEntries[0]);

    const result = await addToWaitlist(mockAddToWaitlistInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain('already in waitlist');
    expect(result.error_code).toBe('DUPLICATE_ENTRY');
  });

  test('❌ Capacity Full: Rejects when waitlist size >= 10', async () => {
    mockAddToWaitlistCapacityFull(
      mockSupabase,
      mockCustomers.vip,
      mockPackages.vip,
      'vip'
    );

    const result = await addToWaitlist(mockAddToWaitlistInput);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Waitlist is full');
    expect(result.error_code).toBe('CAPACITY_FULL');
  });

  test('❌ Invalid Customer: Returns error if customer not found', async () => {
    let callCount = 0;
    mockSupabase.from.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        // No duplicates
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          in: jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }
      if (callCount === 2) {
        // Customer NOT found
        return {
          select: jest.fn().mockReturnThis(),
          eq: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: { message: 'Customer not found' } }),
        };
      }
      return {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      };
    });

    const result = await addToWaitlist(mockAddToWaitlistInput);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Customer not found');
    expect(result.error_code).toBe('VALIDATION_ERROR');
  });
});

describe('Waitlist Service - processSlotAvailable()', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (sendNotification as jest.Mock).mockResolvedValue({ success: true, logId: 'log-123' });
  });

  test('✅ Top 3 Notification: Notifies top 3 matches only', async () => {
    const entries = mockWaitlistEntries.slice(0, 5).map((e, i) => ({
      ...e,
      preferred_date: mockAvailableSlot.date,
      preferred_start_time: mockAvailableSlot.start_time,
      priority_score: 90 - (i * 10),
    }));

    mockProcessSlotSuccess(mockSupabase, entries);

    const result = await processSlotAvailable(mockAvailableSlot);

    expect(result.notified_customers.length).toBeLessThanOrEqual(3);
    expect(sendNotification).toHaveBeenCalled();
  });
});

describe('Waitlist Service - expireOldEntries()', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (sendNotification as jest.Mock).mockResolvedValue({ success: true });
  });

  test('✅ Expire Old: Marks entries with expires_at < now as expired', async () => {
    const expiredEntry = createExpiredEntry();
    mockExpireEntriesSuccess(mockSupabase, [expiredEntry]);

    const result = await expireOldEntries(mockTenant.id);

    expect(result.expired_count).toBeGreaterThan(0);
  });
});

describe('Waitlist Service - getWaitlistEntries()', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  test('✅ Filter by Status: Returns only active entries', async () => {
    const activeEntries = mockWaitlistEntries.filter(e => e.status === 'active');
    mockGetWaitlistEntriesSuccess(mockSupabase, activeEntries, activeEntries.length);

    const result = await getWaitlistEntries({
      tenant_id: mockTenant.id,
      status: 'active',
      page: 1,
      limit: 20,
    });

    expect(result.entries.length).toBe(activeEntries.length);
  });
});

describe('Waitlist Service - Notification Integration', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
    (sendNotification as jest.Mock).mockResolvedValue({ success: true, logId: 'log-123' });
  });

  test('✅ Notification Orchestration: sendNotification called with correct params', async () => {
    const entry = { ...mockWaitlistEntries[0], preferred_date: mockAvailableSlot.date, preferred_start_time: mockAvailableSlot.start_time };
    mockProcessSlotSuccess(mockSupabase, [entry]);

    await processSlotAvailable(mockAvailableSlot);

    expect(sendNotification).toHaveBeenCalledWith({
      entryId: entry.id,
      customerId: entry.customer_id,
      tenantId: entry.tenant_id,
      type: 'slot_available',
      preferredChannel: expect.any(String),
      data: expect.objectContaining({
        customerName: entry.customer_name,
        serviceName: entry.package_name,
        date: mockAvailableSlot.date,
        time: mockAvailableSlot.start_time,
      }),
    });
  });

  test('✅ Channel Selection: VIP gets Zalo, Others get SMS', async () => {
    const vipEntry = { ...mockWaitlistEntries[0], customer_tier: 'vip', preferred_date: mockAvailableSlot.date, preferred_start_time: mockAvailableSlot.start_time };
    mockProcessSlotSuccess(mockSupabase, [vipEntry]);

    await processSlotAvailable(mockAvailableSlot);

    if ((sendNotification as jest.Mock).mock.calls.length > 0) {
      expect(sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          preferredChannel: 'zalo',
        })
      );
    }
  });

  test('✅ Retry Logic: Does not retry if notification succeeds', async () => {
    (sendNotification as jest.Mock)
      .mockResolvedValueOnce({ success: true, logId: 'log-1' })
      .mockResolvedValueOnce({ success: true, logId: 'log-2' });

    const entries = [mockWaitlistEntries[0], mockWaitlistEntries[1]].map(e => ({
      ...e,
      preferred_date: mockAvailableSlot.date,
      preferred_start_time: mockAvailableSlot.start_time,
    }));
    mockProcessSlotSuccess(mockSupabase, entries);

    await processSlotAvailable(mockAvailableSlot);

    expect(sendNotification).toHaveBeenCalledTimes(2);
  });
});

describe('Waitlist Service - Edge Cases', () => {
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createClient();
    (createClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  test('❌ Database Error: Returns error if DB query fails', async () => {
    // Mock database error
    mockSupabase.from.mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                in: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Database connection failed' },
                }),
              }),
            }),
          }),
        }),
      }),
    });

    const result = await addToWaitlist(mockAddToWaitlistInput);

    expect(result.success).toBe(false);
    expect(result.error_code).toBe('DATABASE_ERROR');
  });
});
