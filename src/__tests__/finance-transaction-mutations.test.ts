jest.mock('next/cache', () => ({
  revalidatePath: jest.fn(),
}));

jest.mock('server-only', () => ({}), { virtual: true });

const mockFrom = jest.fn();
const mockAssertLegacyFinanceWriteAllowed = jest.fn();
const mockAssertOpenAccountingPeriod = jest.fn();
const mockEnqueueWithAutoClient = jest.fn();
const mockResolveTenantId = jest.fn();

jest.mock('../lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('../services/accounting-actions', () => ({
  assertLegacyFinanceWriteAllowed: (...args: unknown[]) => mockAssertLegacyFinanceWriteAllowed(...args),
}));

jest.mock('../services/finance/shared', () => ({
  resolveTenantId: () => mockResolveTenantId(),
}));

jest.mock('../services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: (...args: unknown[]) => mockAssertOpenAccountingPeriod(...args),
}));

jest.mock('../services/accounting/template-rules', () => ({
  inferBusinessEventType: jest.fn((input: { sourceTable?: string; revenueType?: string | null }) => {
    if (input.sourceTable === 'revenue' && input.revenueType === 'refund') {
      return 'REFUND_TO_CUSTOMER';
    }
    return 'PACKAGE_SALE';
  }),
}));

jest.mock('../services/finance/transaction-review', () => ({
  resolveReviewStatus: jest.fn(() => 'ready'),
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: unknown[]) => mockEnqueueWithAutoClient(...args),
}));

type ScriptedResult = {
  table: string;
  op: 'delete' | 'insert' | 'select' | 'update';
  data?: unknown;
  error?: { message: string };
};

type DbCall = {
  table: string;
  op: ScriptedResult['op'];
  payload?: unknown;
};

class ScriptedQueryBuilder {
  private op: ScriptedResult['op'] | '' = '';

  constructor(
    private table: string,
    private scripts: ScriptedResult[],
    private calls: DbCall[],
  ) {}

  select() {
    if (!this.op) {
      this.op = 'select';
      this.calls.push({ table: this.table, op: 'select' });
    }
    return this;
  }

  update(payload: unknown) {
    this.op = 'update';
    this.calls.push({ table: this.table, op: 'update', payload });
    return this;
  }

  insert(payload: unknown) {
    this.op = 'insert';
    this.calls.push({ table: this.table, op: 'insert', payload });
    return this;
  }

  delete() {
    this.op = 'delete';
    this.calls.push({ table: this.table, op: 'delete' });
    return this;
  }

  eq() { return this; }

  single() {
    return this.resolve();
  }

  then(onfulfilled: (value: { data: unknown; error: unknown }) => unknown) {
    return this.resolve().then(onfulfilled);
  }

  private resolve() {
    const next = this.scripts.shift();
    if (!next) {
      throw new Error(`No scripted result for ${this.table}.${this.op}`);
    }
    if (next.table !== this.table || next.op !== this.op) {
      throw new Error(`Expected ${next.table}.${next.op}, got ${this.table}.${this.op}`);
    }
    return Promise.resolve({ data: next.data ?? null, error: next.error ?? null });
  }
}

import { confirmTransaction, recordTransaction } from '../services/finance/transaction-mutations';

describe('finance transaction mutation outbox rollbacks', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockAssertLegacyFinanceWriteAllowed.mockResolvedValue(undefined);
    mockAssertOpenAccountingPeriod.mockResolvedValue(undefined);
    mockResolveTenantId.mockResolvedValue('tenant-1');
    mockEnqueueWithAutoClient.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  function installScriptedSupabase(scripts: ScriptedResult[]) {
    const calls: DbCall[] = [];
    mockFrom.mockImplementation((table: string) => new ScriptedQueryBuilder(table, scripts, calls));
    return calls;
  }

  it('restores revenue state when confirm revenue outbox enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockRejectedValueOnce(new Error('outbox failed'));
    const calls = installScriptedSupabase([
      {
        table: 'revenue',
        op: 'select',
        data: {
          id: 'rev-1',
          revenue_type: 'deposit',
          amount: 100000,
          payment_method: 'bank_transfer',
          booking_id: 'booking-1',
          notes: 'deposit',
          tenant_id: 'tenant-1',
          status: 'pending',
          received_date: null,
          business_event_type: null,
          accounting_review_status: null,
          accounting_metadata: null,
        },
      },
      {
        table: 'revenue',
        op: 'update',
        data: {
          id: 'rev-1',
          revenue_type: 'deposit',
          amount: 100000,
          notes: 'deposit',
          tenant_id: 'tenant-1',
        },
      },
      { table: 'revenue', op: 'update' },
    ]);

    await expect(confirmTransaction('rev-1', 'revenue')).rejects.toThrow('outbox failed');

    expect(calls.filter(c => c.table === 'revenue' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ status: 'confirmed' }),
      {
        status: 'pending',
        received_date: null,
        business_event_type: null,
        accounting_review_status: null,
        accounting_metadata: null,
      },
    ]);
  });

  it('restores expense state when confirm expense outbox enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockRejectedValueOnce(new Error('expense outbox failed'));
    const calls = installScriptedSupabase([
      {
        table: 'expenses',
        op: 'select',
        data: {
          id: 'exp-1',
          category: 'materials',
          amount: 50000,
          description: 'materials',
          tenant_id: 'tenant-1',
          status: 'submitted',
          expense_date: '2026-05-31',
          business_event_type: null,
          accounting_review_status: null,
          accounting_metadata: null,
        },
      },
      {
        table: 'expenses',
        op: 'update',
        data: {
          id: 'exp-1',
          category: 'materials',
          amount: 50000,
          description: 'materials',
          tenant_id: 'tenant-1',
        },
      },
      { table: 'expenses', op: 'update' },
    ]);

    await expect(confirmTransaction('exp-1', 'expense')).rejects.toThrow('expense outbox failed');

    expect(calls.filter(c => c.table === 'expenses' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ status: 'approved' }),
      {
        status: 'submitted',
        expense_date: '2026-05-31',
        business_event_type: null,
        accounting_review_status: null,
        accounting_metadata: null,
      },
    ]);
  });

  it('deletes inserted confirmed revenue when record revenue outbox enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockRejectedValueOnce(new Error('record revenue outbox failed'));
    const calls = installScriptedSupabase([
      {
        table: 'revenue',
        op: 'insert',
        data: {
          id: 'rev-new',
          revenue_type: 'deposit',
          amount: 120000,
          notes: 'deposit',
          tenant_id: 'tenant-1',
        },
      },
      { table: 'revenue', op: 'delete' },
    ]);

    await expect(
      recordTransaction({
        amount: 120000,
        type: 'revenue',
        category: 'deposit',
        notes: 'deposit',
        status: 'confirmed',
      })
    ).rejects.toThrow('record revenue outbox failed');

    expect(calls.map(c => `${c.table}.${c.op}`)).toEqual(['revenue.insert', 'revenue.delete']);
  });

  it('records confirmed negative finance revenue as refund and enqueues REFUND_ISSUED split payload', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'revenue',
        op: 'insert',
        data: {
          id: 'rev-refund',
          revenue_type: 'refund',
          amount: 300000,
          notes: 'refund customer',
          payment_method: 'bank_transfer',
          tenant_id: 'tenant-1',
        },
      },
    ]);

    await recordTransaction({
      amount: -300000,
      type: 'revenue',
      category: 'refund',
      notes: 'refund customer',
      status: 'confirmed',
      booking_id: 'booking-1',
    });

    expect(calls).toEqual([
      expect.objectContaining({
        table: 'revenue',
        op: 'insert',
        payload: expect.objectContaining({
          amount: 300000,
          revenue_type: 'refund',
          business_event_type: 'REFUND_TO_CUSTOMER',
          accounting_metadata: expect.objectContaining({
            amount: 300000,
            booking_id: 'booking-1',
            deferredRefundAmount: 0,
            revenueReductionAmount: 300000,
          }),
        }),
      }),
    ]);
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'REFUND_ISSUED',
        referenceType: 'REVENUE',
        referenceId: 'rev-refund',
        payload: {
          amount: 300000,
          deferredRefundAmount: 0,
          revenueReductionAmount: 300000,
          paymentMethod: 'bank_transfer',
          description: 'refund customer',
          branchId: 'tenant-1',
        },
      }),
      '[recordTransaction]'
    );
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'PACKAGE_SALE' }),
      expect.anything()
    );
  });

  it('confirms pending refund revenue by enqueuing REFUND_ISSUED split payload', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'revenue',
        op: 'select',
        data: {
          id: 'rev-refund-pending',
          revenue_type: 'refund',
          amount: 300000,
          payment_method: 'bank_transfer',
          booking_id: 'booking-1',
          notes: 'pending refund',
          tenant_id: 'tenant-1',
          status: 'pending',
          received_date: null,
          business_event_type: null,
          accounting_review_status: null,
          accounting_metadata: null,
        },
      },
      {
        table: 'revenue',
        op: 'update',
        data: {
          id: 'rev-refund-pending',
          revenue_type: 'refund',
          amount: 300000,
          payment_method: 'bank_transfer',
          notes: 'pending refund',
          tenant_id: 'tenant-1',
        },
      },
    ]);

    await confirmTransaction('rev-refund-pending', 'revenue');

    expect(calls.filter(c => c.table === 'revenue' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({
        status: 'confirmed',
        business_event_type: 'REFUND_TO_CUSTOMER',
        accounting_metadata: expect.objectContaining({
          amount: 300000,
          deferredRefundAmount: 0,
          revenueReductionAmount: 300000,
        }),
      }),
    ]);
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'REFUND_ISSUED',
        referenceType: 'REVENUE',
        referenceId: 'rev-refund-pending',
        payload: {
          amount: 300000,
          deferredRefundAmount: 0,
          revenueReductionAmount: 300000,
          paymentMethod: 'bank_transfer',
          description: 'pending refund',
          branchId: 'tenant-1',
        },
      }),
      '[confirmTransaction]'
    );
  });

  it('restores pending refund state when confirm refund outbox enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockRejectedValueOnce(new Error('refund outbox failed'));
    const calls = installScriptedSupabase([
      {
        table: 'revenue',
        op: 'select',
        data: {
          id: 'rev-refund-fail',
          revenue_type: 'refund',
          amount: 300000,
          payment_method: 'bank_transfer',
          booking_id: 'booking-1',
          notes: 'pending refund',
          tenant_id: 'tenant-1',
          status: 'pending',
          received_date: null,
          business_event_type: null,
          accounting_review_status: null,
          accounting_metadata: null,
        },
      },
      {
        table: 'revenue',
        op: 'update',
        data: {
          id: 'rev-refund-fail',
          revenue_type: 'refund',
          amount: 300000,
          payment_method: 'bank_transfer',
          notes: 'pending refund',
          tenant_id: 'tenant-1',
        },
      },
      { table: 'revenue', op: 'update' },
    ]);

    await expect(confirmTransaction('rev-refund-fail', 'revenue')).rejects.toThrow('refund outbox failed');

    expect(calls.filter(c => c.table === 'revenue' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ status: 'confirmed', business_event_type: 'REFUND_TO_CUSTOMER' }),
      {
        status: 'pending',
        received_date: null,
        business_event_type: null,
        accounting_review_status: null,
        accounting_metadata: null,
      },
    ]);
  });

  it('keeps positive package payment revenue on the PACKAGE_SALE outbox path', async () => {
    const calls = installScriptedSupabase([
      {
        table: 'revenue',
        op: 'insert',
        data: {
          id: 'rev-package',
          revenue_type: 'package_payment',
          amount: 500000,
          notes: 'package payment',
          tenant_id: 'tenant-1',
        },
      },
    ]);

    await recordTransaction({
      amount: 500000,
      type: 'revenue',
      category: 'package_payment',
      notes: 'package payment',
      status: 'confirmed',
      booking_id: 'booking-1',
    });

    expect(calls).toEqual([
      expect.objectContaining({
        table: 'revenue',
        op: 'insert',
        payload: expect.objectContaining({
          amount: 500000,
          revenue_type: 'package_payment',
        }),
      }),
    ]);
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: 'rev-package',
        payload: expect.objectContaining({
          totalAmount: 500000,
          vatRate: 0,
          branchId: 'tenant-1',
        }),
      }),
      '[recordTransaction]'
    );
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ eventType: 'REFUND_ISSUED' }),
      expect.anything()
    );
  });

  it('reports rollback failure when deleting inserted expense fails after outbox failure', async () => {
    mockEnqueueWithAutoClient.mockRejectedValueOnce(new Error('record expense outbox failed'));
    installScriptedSupabase([
      {
        table: 'expenses',
        op: 'insert',
        data: {
          id: 'exp-new',
          category: 'materials',
          amount: 50000,
          description: 'materials',
          tenant_id: 'tenant-1',
        },
      },
      { table: 'expenses', op: 'delete', error: { message: 'delete failed' } },
    ]);

    await expect(
      recordTransaction({
        amount: 50000,
        type: 'expense',
        category: 'materials',
        notes: 'materials',
        status: 'confirmed',
      })
    ).rejects.toThrow(/record expense outbox failed.*rollback failed: delete failed/i);
  });

  it('restores salary record and expense state when salary paid outbox enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockRejectedValueOnce(new Error('salary outbox failed'));
    const calls = installScriptedSupabase([
      {
        table: 'expenses',
        op: 'select',
        data: {
          id: 'exp-salary',
          category: 'salary',
          amount: 7000000,
          description: 'salary [salary_record_id:salary-1] [ktv_id:ktv-1]',
          tenant_id: 'tenant-1',
          status: 'submitted',
          expense_date: '2026-05-31',
          business_event_type: null,
          accounting_review_status: null,
          accounting_metadata: null,
        },
      },
      {
        table: 'expenses',
        op: 'update',
        data: {
          id: 'exp-salary',
          category: 'salary',
          amount: 7000000,
          description: 'salary [salary_record_id:salary-1] [ktv_id:ktv-1]',
          tenant_id: 'tenant-1',
        },
      },
      {
        table: 'salary_records',
        op: 'select',
        data: {
          status: 'published',
          paid_date: null,
          paid_method: null,
          business_event_type: null,
          accounting_review_status: null,
          accounting_metadata: null,
        },
      },
      { table: 'salary_records', op: 'update' },
      { table: 'salary_records', op: 'update' },
      { table: 'expenses', op: 'update' },
    ]);

    await expect(confirmTransaction('exp-salary', 'expense')).rejects.toThrow('salary outbox failed');

    expect(calls.filter(c => c.table === 'salary_records' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ status: 'paid' }),
      {
        status: 'published',
        paid_date: null,
        paid_method: null,
        business_event_type: null,
        accounting_review_status: null,
        accounting_metadata: null,
      },
    ]);
    expect(calls.filter(c => c.table === 'expenses' && c.op === 'update').map(c => c.payload)).toEqual([
      expect.objectContaining({ status: 'approved' }),
      {
        status: 'submitted',
        expense_date: '2026-05-31',
        business_event_type: null,
        accounting_review_status: null,
        accounting_metadata: null,
      },
    ]);
  });
});
