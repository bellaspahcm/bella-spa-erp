jest.mock('server-only', () => ({}), { virtual: true });
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }));
jest.mock('../services/user-actions', () => ({
  getCurrentUser: jest.fn(),
}));

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '../services/user-actions';
import {
  createUpgradeInvoice,
  getSubscriptionInvoiceHistory,
  simulateInvoicePayment,
} from '../services/subscription-actions';

type QueryResult = { data: unknown; error: { message: string } | null };
type QueryCall = {
  table: string;
  operation: 'select' | 'insert';
  payload?: unknown;
  filters: { column: string; value: unknown }[];
  order?: { column: string; options?: unknown };
};

const queryCalls: QueryCall[] = [];
const rpcCalls: { fn: string; args: unknown }[] = [];
let scriptedResults: QueryResult[] = [];
let scriptedRpcResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryCall['operation'] = 'select';
  private payload?: unknown;
  private filters: { column: string; value: unknown }[] = [];
  private orderCall?: { column: string; options?: unknown };

  constructor(private readonly table: string) {}

  select() {
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orderCall = { column, options };
    return this.resolve();
  }

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      filters: [...this.filters],
      order: this.orderCall,
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null });
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
  rpc: jest.fn((fn: string, args: unknown) => {
    rpcCalls.push({ fn, args });
    return Promise.resolve(scriptedRpcResults.shift() ?? { data: true, error: null });
  }),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

const mockGetCurrentUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;
const mockRevalidatePath = revalidatePath as jest.MockedFunction<typeof revalidatePath>;

describe('subscription actions hardening', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    rpcCalls.length = 0;
    scriptedResults = [];
    scriptedRpcResults = [];
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      role: 'admin',
      tenant_id: 'tenant-1',
    } as Awaited<ReturnType<typeof getCurrentUser>>);
  });

  it('throws invoice history query failures instead of returning an empty list', async () => {
    scriptedResults = [{ data: null, error: { message: 'invoice db down' } }];

    await expect(getSubscriptionInvoiceHistory()).rejects.toThrow(
      '[getSubscriptionInvoiceHistory] subscription_invoices query failed: invoice db down'
    );
  });

  it('blocks non-admin users from creating upgrade invoices', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'ktv-1',
      role: 'ktv',
      tenant_id: 'tenant-1',
    } as Awaited<ReturnType<typeof getCurrentUser>>);

    const res = await createUpgradeInvoice('basic', 1);

    expect(res).toEqual({ error: 'Không có quyền tạo hóa đơn gói dịch vụ.' });
    expect(queryCalls).toEqual([]);
  });

  it('creates typed pending invoice payload for tenant admins', async () => {
    scriptedResults = [{
      data: {
        id: 'invoice-1',
        tenant_id: 'tenant-1',
        invoice_number: 'INV-1234',
        amount: 499000,
        status: 'pending',
        tier: 'basic',
        duration_months: 1,
        created_at: '2026-06-01T00:00:00.000Z',
        paid_at: null,
        payment_method: null,
      },
      error: null,
    }];

    const res = await createUpgradeInvoice('basic', 1);

    expect(res.success).toBe(true);
    expect(queryCalls[0]).toMatchObject({
      table: 'subscription_invoices',
      operation: 'insert',
      payload: expect.objectContaining({
        tenant_id: 'tenant-1',
        amount: 499000,
        status: 'pending',
        tier: 'basic',
        duration_months: 1,
      }),
    });
    expect(mockRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('scopes simulated payment to current tenant invoice before calling renewal RPC', async () => {
    scriptedResults = [{ data: { invoice_number: 'INV-9988' }, error: null }];

    const res = await simulateInvoicePayment(' inv-9988 ');

    expect(res.success).toBe(true);
    expect(queryCalls[0]).toMatchObject({
      table: 'subscription_invoices',
      operation: 'select',
      filters: [
        { column: 'invoice_number', value: 'INV-9988' },
        { column: 'tenant_id', value: 'tenant-1' },
      ],
    });
    expect(rpcCalls).toEqual([{
      fn: 'renew_tenant_subscription',
      args: {
        p_invoice_number: 'INV-9988',
        p_payment_method: 'Simulated VietQR',
      },
    }]);
  });

  it('does not call renewal RPC when invoice is not owned by current tenant', async () => {
    scriptedResults = [{ data: null, error: null }];

    const res = await simulateInvoicePayment('INV-OTHER');

    expect(res).toEqual({ error: 'Không tìm thấy hóa đơn gói dịch vụ thuộc chi nhánh hiện tại.' });
    expect(rpcCalls).toEqual([]);
    expect(mockRevalidatePath).not.toHaveBeenCalled();
  });
});
