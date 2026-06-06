jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockAssertOpenAccountingPeriod = jest.fn();
const mockAssertLegacyFinanceWriteAllowed = jest.fn();
const mockEnqueueWithAutoClient = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: (...args: unknown[]) => mockAssertOpenAccountingPeriod(...args),
}));

jest.mock('@/services/accounting/mode', () => ({
  assertLegacyFinanceWriteAllowed: (...args: unknown[]) => mockAssertLegacyFinanceWriteAllowed(...args),
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: unknown[]) => mockEnqueueWithAutoClient(...args),
}));

import { allocateOrphanedRevenue, collectDebtPayment } from '@/services/reconciliation-actions';

type RevenueQueryOptions = {
  insertData?: { id: string; tenant_id: string; amount: number; notes: string | null };
  insertError?: { message: string } | null;
  deleteError?: { message: string } | null;
};

function installRevenueQuery(options: RevenueQueryOptions = {}) {
  const insertPayloads: unknown[] = [];
  const deleteIds: string[] = [];

  mockFrom.mockImplementation((table: string) => {
    if (table !== 'revenue') throw new Error(`Unexpected table ${table}`);

    let operation: 'insert' | 'delete' | null = null;
    const query = {
      insert: jest.fn((payload: unknown) => {
        operation = 'insert';
        insertPayloads.push(payload);
        return query;
      }),
      select: jest.fn(() => query),
      single: jest.fn(() => Promise.resolve({
        data: options.insertData ?? {
          id: 'revenue-1',
          tenant_id: 'tenant-1',
          amount: 4300000,
          notes: 'Thu doi soat cong no',
        },
        error: options.insertError ?? null,
      })),
      delete: jest.fn(() => {
        operation = 'delete';
        return query;
      }),
      eq: jest.fn((column: string, value: string) => {
        if (operation === 'delete' && column === 'id') {
          deleteIds.push(value);
          return Promise.resolve({ error: options.deleteError ?? null });
        }
        return query;
      }),
    };

    return query;
  });

  return { insertPayloads, deleteIds };
}

type AllocationQueryOptions = {
  existingRevenue?: {
    amount: number;
    payment_method: string | null;
    notes: string | null;
    received_date: string;
    tenant_id: string;
    status: string | null;
    revenue_type: string | null;
    business_event_type: string | null;
    accounting_review_status: string | null;
    accounting_metadata: unknown;
  };
  booking?: {
    id: string;
    tenant_id: string;
    status: string | null;
    package_name: string | null;
    deposit_amount: number | null;
  };
  allocationError?: { message: string } | null;
  rollbackError?: { message: string } | null;
};

function installAllocationQuery(options: AllocationQueryOptions = {}) {
  const revenueUpdatePayloads: unknown[] = [];
  const bookingLookups: string[] = [];

  mockFrom.mockImplementation((table: string) => {
    if (table === 'bookings') {
      const query = {
        select: jest.fn(() => query),
        eq: jest.fn((column: string, value: string) => {
          if (column === 'id') bookingLookups.push(value);
          return query;
        }),
        single: jest.fn(() => Promise.resolve({
          data: options.booking ?? {
            id: 'booking-1',
            tenant_id: 'tenant-1',
            status: 'active',
            package_name: 'Tam Be Chuan Y Khoa Tai Nha',
            deposit_amount: 200000,
          },
          error: null,
        })),
      };
      return query;
    }

    if (table !== 'revenue') throw new Error(`Unexpected table ${table}`);

    let operation: 'select' | 'update' = 'select';
    let updateSelectRequested = false;
    const query = {
      select: jest.fn(() => {
        if (operation === 'update') updateSelectRequested = true;
        return query;
      }),
      update: jest.fn((payload: unknown) => {
        operation = 'update';
        revenueUpdatePayloads.push(payload);
        return query;
      }),
      eq: jest.fn(() => query),
      is: jest.fn(() => query),
      single: jest.fn(() => {
        if (operation === 'update' && updateSelectRequested) {
          return Promise.resolve({
            data: {
              id: 'rev-orphan',
              tenant_id: 'tenant-1',
              amount: 200000,
              notes: 'Coc Me Tien',
            },
            error: options.allocationError ?? null,
          });
        }

        return Promise.resolve({
          data: options.existingRevenue ?? {
            amount: 200000,
            payment_method: 'bank_transfer',
            notes: 'Coc Me Tien',
            received_date: '2026-06-06',
            tenant_id: 'tenant-1',
            status: 'pending',
            revenue_type: 'additional',
            business_event_type: null,
            accounting_review_status: null,
            accounting_metadata: null,
          },
          error: null,
        });
      }),
      then: (onfulfilled?: (value: { error: { message: string } | null }) => unknown) => (
        Promise.resolve({ error: options.rollbackError ?? null }).then(onfulfilled)
      ),
    };
    return query;
  });

  return { revenueUpdatePayloads, bookingLookups };
}

describe('finance reconciliation write actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
    mockAssertOpenAccountingPeriod.mockResolvedValue(undefined);
    mockAssertLegacyFinanceWriteAllowed.mockResolvedValue(undefined);
    mockEnqueueWithAutoClient.mockResolvedValue(true);
  });

  it('records debt collection as remaining payment and enqueues PACKAGE_SALE accounting', async () => {
    const { insertPayloads, deleteIds } = installRevenueQuery();

    const result = await collectDebtPayment({
      bookingId: 'booking-1',
      amount: 4_300_000,
      paymentMethod: 'bank_transfer',
      customerName: 'Me Tien',
      packageName: 'Tam Be Chuan Y Khoa Tai Nha',
    });

    expect(result.success).toBe(true);
    expect(insertPayloads).toEqual([
      expect.objectContaining({
        tenant_id: 'tenant-1',
        booking_id: 'booking-1',
        amount: 4_300_000,
        revenue_type: 'remaining_payment',
        status: 'confirmed',
        payment_method: 'bank_transfer',
        recorded_by_id: 'admin-1',
        business_event_type: 'CUSTOMER_REMAINING_PAYMENT',
        accounting_review_status: 'UNREVIEWED',
      }),
    ]);
    expect(mockAssertOpenAccountingPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-1',
        context: 'Collect debt payment',
      })
    );
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: 'revenue-1',
        payload: expect.objectContaining({
          totalAmount: 4_300_000,
          vatRate: 0,
          branchId: 'tenant-1',
        }),
      }),
      '[collectDebtPayment]'
    );
    expect(deleteIds).toEqual([]);
  });

  it('rolls back inserted debt revenue when accounting outbox enqueue fails', async () => {
    const { deleteIds } = installRevenueQuery();
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);

    const result = await collectDebtPayment({
      bookingId: 'booking-1',
      amount: 4_300_000,
      paymentMethod: 'bank_transfer',
      customerName: 'Me Tien',
      packageName: 'Tam Be Chuan Y Khoa Tai Nha',
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to enqueue PACKAGE_SALE accounting event/);
    expect(deleteIds).toEqual(['revenue-1']);
  });

  it('allocates orphaned deposit revenue to a booking and enqueues PACKAGE_SALE accounting', async () => {
    const { revenueUpdatePayloads, bookingLookups } = installAllocationQuery();

    const result = await allocateOrphanedRevenue('rev-orphan', 'booking-1');

    expect(result.success).toBe(true);
    expect(bookingLookups).toEqual(['booking-1']);
    expect(revenueUpdatePayloads).toEqual([
      expect.objectContaining({
        booking_id: 'booking-1',
        status: 'confirmed',
        revenue_type: 'deposit',
        business_event_type: 'CUSTOMER_DEPOSIT',
        accounting_review_status: 'UNREVIEWED',
        accounting_metadata: expect.objectContaining({
          amount: 200000,
          payment_method: 'bank_transfer',
          booking_id: 'booking-1',
        }),
      }),
    ]);
    expect(mockAssertOpenAccountingPeriod).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-1',
        date: '2026-06-06',
        context: 'Allocate orphaned revenue',
      })
    );
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: 'rev-orphan',
        payload: expect.objectContaining({
          totalAmount: 200000,
          vatRate: 0,
          description: 'Coc Me Tien',
          branchId: 'tenant-1',
        }),
      }),
      '[allocateOrphanedRevenue]'
    );
  });

  it('rolls back orphan allocation when accounting outbox enqueue fails', async () => {
    const { revenueUpdatePayloads } = installAllocationQuery();
    mockEnqueueWithAutoClient.mockResolvedValueOnce(false);

    const result = await allocateOrphanedRevenue('rev-orphan', 'booking-1');

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Failed to enqueue PACKAGE_SALE accounting event/);
    expect(revenueUpdatePayloads).toEqual([
      expect.objectContaining({
        booking_id: 'booking-1',
        status: 'confirmed',
        revenue_type: 'deposit',
      }),
      {
        booking_id: null,
        status: 'pending',
        revenue_type: 'additional',
        business_event_type: null,
        accounting_review_status: null,
        accounting_metadata: null,
      },
    ]);
  });
});
