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

import { collectDebtPayment } from '@/services/reconciliation-actions';

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
    mockEnqueueWithAutoClient.mockResolvedValue({ success: true });
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
});
