process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.PAYMENT_WEBHOOK_SECRET = 'payment-secret';

const mockFrom = jest.fn();
const mockRpc = jest.fn();
const mockSupabase = {
  from: mockFrom,
  rpc: mockRpc,
};

const mockEnqueueWithAutoClient = jest.fn();
const mockAssertOpenAccountingPeriod = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase),
}));

jest.mock('@/lib/accounting-outbox', () => ({
  enqueueWithAutoClient: (...args: unknown[]) => mockEnqueueWithAutoClient(...args),
}));

jest.mock('@/core/services/accounting/period-guards', () => ({
  assertOpenAccountingPeriod: (...args: unknown[]) => mockAssertOpenAccountingPeriod(...args),
}));

import { NextRequest } from 'next/server';
import { POST } from '@/app/api/webhooks/payment/route';

type TableName = 'bookings' | 'revenue' | 'audit_logs';

const booking = {
  id: 'booking-1',
  booking_number: 'BK-100',
  tenant_id: 'tenant-1',
  status: 'deposit_pending',
};

function requestFor(body: unknown) {
  return new NextRequest('http://localhost/api/webhooks/payment', {
    method: 'POST',
    headers: {
      authorization: 'Bearer payment-secret',
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function selectMaybeSingle(data: unknown, error: { message: string } | null = null) {
  const chain = {
    select: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    not: jest.fn(() => chain),
    contains: jest.fn(() => chain),
    like: jest.fn(() => chain),
    maybeSingle: jest.fn().mockResolvedValue({ data, error }),
  };
  return chain;
}

function updateQuery(error: { message: string } | null = null) {
  const chain = {
    update: jest.fn(() => chain),
    eq: jest.fn().mockResolvedValue({ error }),
  };
  return chain;
}

function insertQuery(result: { data?: unknown; error: { message: string; code?: string } | null }) {
  const chain = {
    insert: jest.fn(() => chain),
    select: jest.fn(() => chain),
    single: jest.fn().mockResolvedValue({ data: result.data ?? null, error: result.error }),
  };
  return chain;
}

function auditInsertQuery(error: { message: string } | null = null) {
  return {
    insert: jest.fn().mockResolvedValue({ error }),
  };
}

function deleteQuery(error: { message: string } | null = null) {
  const chain = {
    delete: jest.fn(() => chain),
    eq: jest.fn(() => chain),
    then: jest.fn((onfulfilled: (value: { error: { message: string } | null }) => unknown) => (
      Promise.resolve({ error }).then(onfulfilled)
    )),
  };
  return chain;
}

function setupFromQueues(queues: Partial<Record<TableName, unknown[]>>) {
  const mutableQueues: Partial<Record<TableName, unknown[]>> = {
    bookings: [...(queues.bookings ?? [])],
    revenue: [...(queues.revenue ?? [])],
    audit_logs: [...(queues.audit_logs ?? [])],
  };

  mockFrom.mockImplementation((table: TableName) => {
    const next = mutableQueues[table]?.shift();
    if (!next) {
      throw new Error(`Unexpected table access: ${table}`);
    }
    return next;
  });
}

describe('Payment webhook idempotency', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
    process.env.PAYMENT_WEBHOOK_SECRET = 'payment-secret';
    mockAssertOpenAccountingPeriod.mockResolvedValue(undefined);
    mockEnqueueWithAutoClient.mockResolvedValue(true);
  });

  it('stores the webhook transaction id in revenue metadata and creates side effects', async () => {
    const bookingUpdate = updateQuery();
    const revenueInsert = insertQuery({
      data: {
        id: 'revenue-1',
        booking_id: 'booking-1',
        tenant_id: 'tenant-1',
        amount: 1000000,
        revenue_type: 'deposit',
        payment_method: 'VietQR',
        received_date: '2026-06-03',
        status: 'confirmed',
        notes: 'Webhook payment',
        accounting_metadata: { webhook_transaction_id: 'TX123' },
      },
      error: null,
    });
    const auditInsert = auditInsertQuery();

    setupFromQueues({
      bookings: [selectMaybeSingle({ ...booking }), bookingUpdate],
      revenue: [selectMaybeSingle(null), selectMaybeSingle(null), revenueInsert],
      audit_logs: [selectMaybeSingle(null), auditInsert],
    });

    const response = await POST(requestFor({
      transferAmount: 1000000,
      content: 'BELLA BK-100',
      code: 'TX123',
      transactionDate: '2026-06-03T09:00:00.000Z',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processedCount).toBe(1);
    expect(json.details).toEqual([
      expect.objectContaining({ status: 'success', revenueId: 'revenue-1' }),
    ]);
    expect(revenueInsert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        accounting_metadata: expect.objectContaining({
          webhook_provider: 'VietQR',
          webhook_transaction_id: 'TX123',
          webhook_description: 'BELLA BK-100',
        }),
      }),
    ]);
    expect(auditInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      table_name: 'revenue',
      record_id: 'revenue-1',
      tenant_id: 'tenant-1',
    }));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({
        tenantId: 'tenant-1',
        eventType: 'PACKAGE_SALE',
        referenceType: 'REVENUE',
        referenceId: 'revenue-1',
      }),
      '[Payment Webhook]'
    );
    expect(bookingUpdate.update).toHaveBeenCalledWith({ status: 'booked' });
  });

  it('does not insert duplicate revenue and repairs missing audit/outbox side effects', async () => {
    const existingRevenue = {
      id: 'revenue-existing',
      booking_id: 'booking-1',
      tenant_id: 'tenant-1',
      amount: 1000000,
      revenue_type: 'deposit',
      payment_method: 'VietQR',
      received_date: '2026-06-03',
      status: 'confirmed',
      notes: 'Existing webhook payment',
      accounting_metadata: { webhook_transaction_id: 'TX123' },
    };
    const bookingUpdate = updateQuery();
    const auditInsert = auditInsertQuery();

    setupFromQueues({
      bookings: [selectMaybeSingle({ ...booking }), bookingUpdate],
      revenue: [selectMaybeSingle(existingRevenue)],
      audit_logs: [selectMaybeSingle(null), auditInsert],
    });

    const response = await POST(requestFor({
      transferAmount: 1000000,
      content: 'BELLA BK-100',
      code: 'TX123',
      transactionDate: '2026-06-03T09:00:00.000Z',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processedCount).toBe(0);
    expect(json.details).toEqual([
      expect.objectContaining({
        status: 'skipped',
        revenueId: 'revenue-existing',
        reason: 'Already processed',
      }),
    ]);
    expect(bookingUpdate.update).toHaveBeenCalledWith({ status: 'booked' });
    expect(auditInsert.insert).toHaveBeenCalledWith(expect.objectContaining({
      record_id: 'revenue-existing',
    }));
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ referenceId: 'revenue-existing' }),
      '[Payment Webhook]'
    );
  });

  it('fails explicitly when duplicate side-effect repair cannot enqueue accounting outbox', async () => {
    const existingRevenue = {
      id: 'revenue-existing',
      booking_id: 'booking-1',
      tenant_id: 'tenant-1',
      amount: 1000000,
      revenue_type: 'deposit',
      payment_method: 'VietQR',
      received_date: '2026-06-03',
      status: 'confirmed',
      notes: 'Existing webhook payment',
      accounting_metadata: { webhook_transaction_id: 'TX123' },
    };

    mockEnqueueWithAutoClient.mockResolvedValue(false);
    setupFromQueues({
      bookings: [selectMaybeSingle({ ...booking, status: 'booked' })],
      revenue: [selectMaybeSingle(existingRevenue)],
      audit_logs: [selectMaybeSingle({ id: 'audit-1' })],
    });

    const response = await POST(requestFor({
      transferAmount: 1000000,
      content: 'BELLA BK-100',
      code: 'TX123',
      transactionDate: '2026-06-03T09:00:00.000Z',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processedCount).toBe(0);
    expect(json.details).toEqual([
      expect.objectContaining({
        status: 'failed',
        revenueId: 'revenue-existing',
        reason: 'Failed to enqueue accounting outbox',
      }),
    ]);
  });

  it('recovers from a unique-index race by re-querying existing revenue', async () => {
    const racedRevenue = {
      id: 'revenue-raced',
      booking_id: 'booking-1',
      tenant_id: 'tenant-1',
      amount: 1000000,
      revenue_type: 'deposit',
      payment_method: 'VietQR',
      received_date: '2026-06-03',
      status: 'confirmed',
      notes: 'Raced webhook payment',
      accounting_metadata: { webhook_transaction_id: 'TX123' },
    };

    setupFromQueues({
      bookings: [selectMaybeSingle({ ...booking }), updateQuery()],
      revenue: [
        selectMaybeSingle(null),
        selectMaybeSingle(null),
        insertQuery({ error: { code: '23505', message: 'duplicate key value violates unique constraint' } }),
        selectMaybeSingle(racedRevenue),
      ],
      audit_logs: [selectMaybeSingle({ id: 'audit-1' })],
    });

    const response = await POST(requestFor({
      transferAmount: 1000000,
      content: 'BELLA BK-100',
      code: 'TX123',
      transactionDate: '2026-06-03T09:00:00.000Z',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processedCount).toBe(0);
    expect(json.details).toEqual([
      expect.objectContaining({
        status: 'skipped',
        revenueId: 'revenue-raced',
        reason: 'Already processed',
      }),
    ]);
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ referenceId: 'revenue-raced' }),
      '[Payment Webhook]'
    );
  });

  it('rolls back inserted deposit revenue and booking status when audit insert fails', async () => {
    const bookingUpdate = updateQuery();
    const bookingRollback = updateQuery();
    const revenueInsert = insertQuery({
      data: {
        id: 'revenue-1',
        booking_id: 'booking-1',
        tenant_id: 'tenant-1',
        amount: 1000000,
        revenue_type: 'deposit',
        payment_method: 'VietQR',
        received_date: '2026-06-03',
        status: 'confirmed',
        notes: 'Webhook payment',
        accounting_metadata: { webhook_transaction_id: 'TX123' },
      },
      error: null,
    });
    const revenueDelete = deleteQuery();
    const auditInsert = auditInsertQuery({ message: 'audit insert failed' });

    setupFromQueues({
      bookings: [selectMaybeSingle({ ...booking }), bookingUpdate, bookingRollback],
      revenue: [selectMaybeSingle(null), selectMaybeSingle(null), revenueInsert, revenueDelete],
      audit_logs: [selectMaybeSingle(null), auditInsert],
    });

    const response = await POST(requestFor({
      transferAmount: 1000000,
      content: 'BELLA BK-100',
      code: 'TX123',
      transactionDate: '2026-06-03T09:00:00.000Z',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processedCount).toBe(0);
    expect(json.details).toEqual([
      expect.objectContaining({
        status: 'failed',
        reason: 'Failed to insert audit log: audit insert failed',
      }),
    ]);
    expect(revenueInsert.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        booking_id: 'booking-1',
        revenue_type: 'deposit',
        status: 'confirmed',
      }),
    ]);
    expect(revenueDelete.delete).toHaveBeenCalled();
    expect(revenueDelete.eq).toHaveBeenCalledWith('id', 'revenue-1');
    expect(bookingUpdate.update).toHaveBeenCalledWith({ status: 'booked' });
    expect(bookingRollback.update).toHaveBeenCalledWith({ status: 'deposit_pending' });
    expect(mockEnqueueWithAutoClient).not.toHaveBeenCalled();
  });

  it('rolls back inserted deposit revenue and booking status when accounting outbox enqueue fails', async () => {
    mockEnqueueWithAutoClient.mockResolvedValue(false);
    const bookingUpdate = updateQuery();
    const bookingRollback = updateQuery();
    const revenueInsert = insertQuery({
      data: {
        id: 'revenue-1',
        booking_id: 'booking-1',
        tenant_id: 'tenant-1',
        amount: 1000000,
        revenue_type: 'deposit',
        payment_method: 'VietQR',
        received_date: '2026-06-03',
        status: 'confirmed',
        notes: 'Webhook payment',
        accounting_metadata: { webhook_transaction_id: 'TX123' },
      },
      error: null,
    });
    const revenueDelete = deleteQuery();

    setupFromQueues({
      bookings: [selectMaybeSingle({ ...booking }), bookingUpdate, bookingRollback],
      revenue: [selectMaybeSingle(null), selectMaybeSingle(null), revenueInsert, revenueDelete],
      audit_logs: [selectMaybeSingle({ id: 'audit-1' })],
    });

    const response = await POST(requestFor({
      transferAmount: 1000000,
      content: 'BELLA BK-100',
      code: 'TX123',
      transactionDate: '2026-06-03T09:00:00.000Z',
    }));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.processedCount).toBe(0);
    expect(json.details).toEqual([
      expect.objectContaining({
        status: 'failed',
        reason: 'Failed to enqueue accounting outbox',
      }),
    ]);
    expect(revenueDelete.delete).toHaveBeenCalled();
    expect(revenueDelete.eq).toHaveBeenCalledWith('id', 'revenue-1');
    expect(bookingRollback.update).toHaveBeenCalledWith({ status: 'deposit_pending' });
    expect(mockEnqueueWithAutoClient).toHaveBeenCalledWith(
      mockSupabase,
      expect.objectContaining({ referenceId: 'revenue-1' }),
      '[Payment Webhook]'
    );
  });
});
