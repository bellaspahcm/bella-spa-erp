jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/services/accounting/mode', () => ({
  assertLegacyFinanceWriteAllowed: jest.fn().mockResolvedValue(undefined),
}));

const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetInterBranchClearingRecordsResult = jest.fn();

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/services/clearing-actions', () => ({
  getInterBranchClearingRecordsResult: (...args: unknown[]) => mockGetInterBranchClearingRecordsResult(...args),
}));

import { getFinancialReconciliationSnapshot } from '@/services/reconciliation-actions';

function createHistoryQuery(data: unknown[] = [], error: { message: string } | null = null) {
  const query = {
    select: jest.fn(() => query),
    eq: jest.fn(() => query),
    order: jest.fn(() => Promise.resolve({ data, error })),
  };
  return query;
}

describe('getFinancialReconciliationSnapshot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-1',
      role: 'admin',
    });
    mockRpc.mockResolvedValue({
      data: {
        debt_alerts: [{ booking_id: 'booking-1', debt: 4300000 }],
        orphaned_revenue: [],
        mismatch_alerts: [],
      },
      error: null,
    });
    mockFrom.mockReturnValue(createHistoryQuery([
      {
        id: 'revenue-1',
        amount: 200000,
        received_date: '2026-06-06',
        notes: 'Thu cong no',
        payment_method: 'bank_transfer',
        booking_id: 'booking-1',
        bookings: {
          customers: {
            name_mother: 'Me Tien',
            name_baby: null,
          },
        },
      },
    ]));
    mockGetInterBranchClearingRecordsResult.mockResolvedValue({
      success: true,
      data: [{ id: 'clear-1', status: 'pending' }],
    });
  });

  it('returns page snapshot with finance anomalies, collection history, and clearing rows', async () => {
    const result = await getFinancialReconciliationSnapshot();

    expect(result.success).toBe(true);
    expect(result.data?.tenant_id).toBe('tenant-1');
    expect(result.data?.debt_alerts).toEqual([{ booking_id: 'booking-1', debt: 4300000 }]);
    expect(result.data?.collection_history).toEqual([
      expect.objectContaining({
        revenue_id: 'revenue-1',
        customer_name: 'Me Tien',
      }),
    ]);
    expect(result.data?.clearing_records).toEqual([{ id: 'clear-1', status: 'pending' }]);
    expect(result.data?.clearing_error).toBeNull();
    expect(mockRpc).toHaveBeenCalledWith('get_financial_anomalies', { p_tenant_id: 'tenant-1' });
  });

  it('keeps the snapshot usable when inter-branch clearing fails', async () => {
    mockGetInterBranchClearingRecordsResult.mockResolvedValue({
      success: false,
      data: [],
      error: 'clearing query failed',
    });

    const result = await getFinancialReconciliationSnapshot();

    expect(result.success).toBe(true);
    expect(result.data?.debt_alerts).toHaveLength(1);
    expect(result.data?.clearing_records).toEqual([]);
    expect(result.data?.clearing_error).toBe('clearing query failed');
  });

  it('returns explicit failure when anomalies rpc fails', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'rpc failed' } });

    const result = await getFinancialReconciliationSnapshot();

    expect(result.success).toBe(false);
    expect(result.error).toContain('rpc failed');
    expect(result.data).toBeNull();
  });
});
