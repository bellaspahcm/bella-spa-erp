jest.mock('server-only', () => ({}), { virtual: true });

const mockGetCurrentUser = jest.fn();
const mockFrom = jest.fn();
const mockAllocateConfirmedPaymentToInvoiceReceivable = jest.fn();
const mockRequireSupabaseAdminEnv = jest.fn();

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve({
    from: (...args: unknown[]) => mockFrom(...args),
  })),
}));

jest.mock('@/lib/supabase-admin-env', () => ({
  requireSupabaseAdminEnv: () => mockRequireSupabaseAdminEnv(),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({ from: jest.fn(), rpc: jest.fn() })),
}));

jest.mock('@/platform/finance/gateways/supabase-receivable-charge.gateway', () => ({
  SupabaseReceivableChargeGateway: jest.fn().mockImplementation(() => ({})),
}));

jest.mock('@/platform/finance/services/semantic-receivable-charge.service', () => ({
  SemanticReceivableChargeService: jest.fn().mockImplementation(() => ({
    allocateConfirmedPaymentToInvoiceReceivable: (...args: unknown[]) =>
      mockAllocateConfirmedPaymentToInvoiceReceivable(...args),
  })),
}));

import {
  collectHaircutF3ReceivablePayment,
  getHaircutF3OpenReceivables,
} from '@/services/haircut-f3-reconciliation-actions';

type QueryResult = { data: unknown; error: { message: string } | null };

function createQuery(
  table: string,
  terminal: () => QueryResult | Promise<QueryResult>,
  options: { readonly terminalOnIn?: boolean } = {},
) {
  const filters: Array<{ method: string; column: string; value: unknown }> = [];
  const query = {
    filters,
    table,
    select: jest.fn(() => query),
    eq: jest.fn((column: string, value: unknown) => {
      filters.push({ method: 'eq', column, value });
      return query;
    }),
    in: jest.fn((column: string, value: unknown) => {
      filters.push({ method: 'in', column, value });
      return options.terminalOnIn ? terminal() : query;
    }),
    gt: jest.fn((column: string, value: unknown) => {
      filters.push({ method: 'gt', column, value });
      return terminal();
    }),
    order: jest.fn(() => query),
    single: jest.fn(() => terminal()),
  };
  query.order.mockImplementationOnce(() => query).mockImplementationOnce(() => terminal());
  return query;
}

describe('haircut F3 reconciliation actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      id: 'admin-1',
      tenant_id: 'tenant-a',
      role: 'admin',
    });
    mockRequireSupabaseAdminEnv.mockReturnValue({
      url: 'https://supabase.test',
      adminKey: 'service-role-key',
    });
    mockAllocateConfirmedPaymentToInvoiceReceivable.mockResolvedValue({
      transactionId: 'txn-1',
      cashMovementId: 'cash-1',
      allocatedAmountMinor: 40000,
      duplicate: false,
      allocations: [{
        invoiceId: 'invoice-a',
        receivablePositionId: 'pos-a',
        allocationId: 'alloc-1',
        allocatedAmountMinor: 40000,
        duplicate: false,
      }],
    });
  });

  it('reads tenant-scoped Haircut F3 open receivables with amount from receivable position', async () => {
    const queries: Record<string, ReturnType<typeof createQuery>[]> = {};
    mockFrom.mockImplementation((table: string) => {
      const query = createQuery(table, () => {
        if (table === 'finance_invoices') {
          return {
            data: [{
              id: 'invoice-a',
              invoice_number: 'FRC-001',
              customer_id: 'customer-a',
              issue_date: '2026-09-30',
              created_at: '2026-09-30T00:00:00.000Z',
              currency: 'VND',
              metadata: {
                business_source_type: 'HAIRCUT_SESSION_DONE',
                booking_id: 'booking-a',
                booking_number: 'BK-001',
                package_name: 'Combo Haircut',
                session_log_id: 'session-a',
              },
            }],
            error: null,
          };
        }
        if (table === 'finance_receivable_positions') {
          return {
            data: [{
              id: 'pos-a',
              invoice_id: 'invoice-a',
              outstanding_amount_minor: 40000,
              currency: 'VND',
            }],
            error: null,
          };
        }
        return {
          data: [{
            id: 'customer-a',
            name_mother: 'Nguyen An',
            phone: '0900000000',
          }],
          error: null,
        };
      }, { terminalOnIn: table === 'customers' });
      queries[table] = [...(queries[table] ?? []), query];
      return query;
    });

    const result = await getHaircutF3OpenReceivables();

    expect(result.success).toBe(true);
    expect(result.data).toEqual([
      expect.objectContaining({
        invoiceId: 'invoice-a',
        receivablePositionId: 'pos-a',
        customerId: 'customer-a',
        customerName: 'Nguyen An',
        bookingId: 'booking-a',
        bookingNumber: 'BK-001',
        sessionLogId: 'session-a',
        outstandingAmountMinor: 40000,
      }),
    ]);
    expect(queries.finance_invoices[0].filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', column: 'tenant_id', value: 'tenant-a' },
        { method: 'eq', column: 'metadata->>business_source_type', value: 'HAIRCUT_SESSION_DONE' },
      ]),
    );
    expect(queries.finance_receivable_positions[0].filters).toEqual(
      expect.arrayContaining([
        { method: 'eq', column: 'tenant_id', value: 'tenant-a' },
        { method: 'gt', column: 'outstanding_amount_minor', value: 0 },
      ]),
    );
  });

  it('collects one tenant-owned F3 invoice and reads back the position', async () => {
    const positionResults = [
      {
        data: {
          id: 'pos-a',
          invoice_id: 'invoice-a',
          outstanding_amount_minor: 50000,
          currency: 'VND',
        },
        error: null,
      },
      {
        data: {
          id: 'pos-a',
          invoice_id: 'invoice-a',
          outstanding_amount_minor: 10000,
          currency: 'VND',
        },
        error: null,
      },
    ];
    mockFrom.mockImplementation((table: string) => {
      if (table === 'finance_invoices') {
        return createQuery(table, () => ({
          data: {
            id: 'invoice-a',
            invoice_number: 'FRC-001',
            customer_id: 'customer-a',
            currency: 'VND',
            metadata: { business_source_type: 'HAIRCUT_SESSION_DONE' },
          },
          error: null,
        }));
      }
      return createQuery(table, () => positionResults.shift() as QueryResult);
    });

    const result = await collectHaircutF3ReceivablePayment({
      invoiceId: 'invoice-a',
      amountMinor: 40000,
      paymentMethod: 'bank_transfer',
      receivedAt: '2026-09-30',
      notes: 'Collect F3',
    });

    if (!result.success) console.log(result);
    expect(result.success).toBe(true);
    expect(mockAllocateConfirmedPaymentToInvoiceReceivable).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-a',
        invoiceId: 'invoice-a',
        paymentSourceType: 'HAIRCUT_F3_DEBT_COLLECTION',
        paymentSourceId: 'invoice-a',
        amountMinor: 40000,
        currency: 'VND',
        idempotencyKey: 'haircut-f3-collection:v1:tenant-a:invoice-a:40000:bank_transfer:2026-09-30',
      }),
    );
    expect(result.data).toEqual(expect.objectContaining({
      beforeOutstandingAmountMinor: 50000,
      afterOutstandingAmountMinor: 10000,
      allocationId: 'alloc-1',
    }));
  });

  it('rejects overpayment before calling Finance allocation', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'finance_invoices') {
        return createQuery(table, () => ({
          data: {
            id: 'invoice-a',
            invoice_number: 'FRC-001',
            customer_id: 'customer-a',
            currency: 'VND',
            metadata: { business_source_type: 'HAIRCUT_SESSION_DONE' },
          },
          error: null,
        }));
      }
      return createQuery(table, () => ({
        data: {
          id: 'pos-a',
          invoice_id: 'invoice-a',
          outstanding_amount_minor: 10000,
          currency: 'VND',
        },
        error: null,
      }));
    });

    const result = await collectHaircutF3ReceivablePayment({
      invoiceId: 'invoice-a',
      amountMinor: 40000,
      paymentMethod: 'cash',
      receivedAt: '2026-09-30',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('vượt quá công nợ F3');
    expect(mockAllocateConfirmedPaymentToInvoiceReceivable).not.toHaveBeenCalled();
  });

  it('rejects cross-tenant invoice lookup before financial mutation', async () => {
    mockFrom.mockImplementation((table: string) => createQuery(table, () => ({
      data: null,
      error: { message: 'JSON object requested, multiple or no rows returned' },
    })));

    const result = await collectHaircutF3ReceivablePayment({
      invoiceId: 'tenant-b-invoice',
      amountMinor: 40000,
      paymentMethod: 'cash',
      receivedAt: '2026-09-30',
    });

    expect(result.success).toBe(false);
    expect(mockAllocateConfirmedPaymentToInvoiceReceivable).not.toHaveBeenCalled();
  });
});

