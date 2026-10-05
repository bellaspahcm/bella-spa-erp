const mockResolveSingleStaffBranchContext = jest.fn();

jest.mock('@/services/beauty-branch-context', () => ({
  resolveSingleStaffBranchContext: (...args: unknown[]) => mockResolveSingleStaffBranchContext(...args),
}));

import { createBookingServiceItems } from '@/core/services/order/create-booking-service-items-helper';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

type BookingRow = Database['public']['Tables']['bookings']['Row'];
type InsertCall = {
  table: string;
  payload: unknown;
};

function createSupabaseMock(insertCalls: InsertCall[]) {
  return {
    from: jest.fn((table: string) => ({
      insert: jest.fn((payload: unknown) => {
        insertCalls.push({ table, payload });
        return Promise.resolve({ error: null });
      }),
    })),
  } as unknown as SupabaseClient<Database>;
}

function createBooking(overrides: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'booking-1',
    tenant_id: 'tenant-1',
    assigned_ktv_id: 'ktv-1',
    status: 'completed',
    start_date: '2026-10-05',
    end_date: null,
    ...overrides,
  } as BookingRow;
}

describe('booking service items branch-aware writer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveSingleStaffBranchContext.mockResolvedValue({
      success: true,
      context: {
        branchId: 'branch-a',
        rootOrgUnitId: 'branch-a',
      },
    });
  });

  it('persists Platform-authorized branch_id on booking_service_items insert', async () => {
    const insertCalls: InsertCall[] = [];
    const supabase = createSupabaseMock(insertCalls);

    const result = await createBookingServiceItems({
      supabase,
      booking: createBooking(),
      tenantId: 'tenant-1',
      serviceItems: [
        {
          serviceName: 'Massage',
          quantity: 1,
          unitPrice: 500_000,
          ktvId: 'ktv-1',
          overrideType: 'fixed',
          overrideValue: 150_000,
        },
      ],
    });

    expect(result).toEqual({
      success: true,
      count: 1,
      totalCommission: 150_000,
    });
    expect(mockResolveSingleStaffBranchContext).toHaveBeenCalledWith(expect.objectContaining({
      tenantId: 'tenant-1',
      userId: 'ktv-1',
      asOfDate: '2026-10-05',
    }));
    expect(insertCalls).toEqual([
      {
        table: 'booking_service_items',
        payload: [
          expect.objectContaining({
            tenant_id: 'tenant-1',
            ktv_id: 'ktv-1',
            branch_id: 'branch-a',
            service_name: 'Massage',
            status: 'completed',
            completed_date: '2026-10-05',
          }),
        ],
      },
    ]);
  });

  it('denies completed service item before write when Platform branch authorization fails', async () => {
    const insertCalls: InsertCall[] = [];
    const supabase = createSupabaseMock(insertCalls);
    mockResolveSingleStaffBranchContext.mockResolvedValueOnce({
      success: false,
      error: 'KTV không thuộc chi nhánh của dịch vụ phát sinh commission này',
    });

    const result = await createBookingServiceItems({
      supabase,
      booking: createBooking({ assigned_ktv_id: 'ktv-1' }),
      tenantId: 'tenant-1',
      serviceItems: [
        {
          serviceName: 'Massage',
          quantity: 1,
          unitPrice: 500_000,
        },
      ],
    });

    expect(result).toEqual({
      success: false,
      error: 'KTV không thuộc chi nhánh của dịch vụ phát sinh commission này',
    });
    expect(insertCalls).toEqual([]);
  });
});
