import {
  buildBookingPayload,
} from '@/core/services/order/create-booking-helpers';
import {
  readRequestedBranchId,
  resolveHaircutBranchContext,
} from '@/core/services/order/haircut-branch-context';
import {
  buildManualPaymentIdempotencyKey,
  recordBookingPaymentRpc,
  type RecordRemainingPaymentParams,
} from '@/core/services/order/payment-helpers';
import {
  buildPackageSaleOutboxEvent,
  buildSessionDoneOutboxEvent,
} from '@/lib/business-rules/accounting-outbox';
import type { TenantContext } from '@/core/types/tenant';

jest.mock('@bella/shared', () => ({
  getLocalDateString: jest.fn(() => '2026-10-05'),
}));

jest.mock('@/core/services/order/commission-actions', () => ({
  resolveKtvCommission: jest.fn().mockResolvedValue(0),
}));

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

class MockQueryBuilder {
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(
    private readonly table: string,
    private readonly resolver: (table: string, filters: Array<{ column: string; value: unknown }>) => QueryResult
  ) {}

  select(): this {
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  single(): Promise<QueryResult> {
    return Promise.resolve(this.resolver(this.table, this.filters));
  }

  returns(): Promise<QueryResult> {
    return Promise.resolve(this.resolver(this.table, this.filters));
  }
}

function createMockSupabase(
  resolver: (table: string, filters: Array<{ column: string; value: unknown }>) => QueryResult
) {
  return {
    from: jest.fn((table: string) => new MockQueryBuilder(table, resolver)),
  };
}

function payment(overrides: Partial<RecordRemainingPaymentParams> = {}): RecordRemainingPaymentParams {
  return {
    booking_id: 'booking-1',
    customer_id: 'customer-1',
    amount: 250000,
    payment_method: 'bank_transfer',
    status: 'confirmed',
    notes: 'Thu phan con lai',
    revenue_type: 'remaining_payment',
    ...overrides,
  };
}

const tenantContext: TenantContext = {
  tenantId: 'tenant-haircut',
  tenantName: 'Haircut Shop',
  enabledModules: ['spa'],
  subscriptionPlan: 'basic',
  featureFlags: {},
  settings: {},
};

describe('Haircut Branch Chain', () => {
  it('extracts branch context from canonical booking metadata aliases', () => {
    expect(readRequestedBranchId({ metadata: { branch_id: 'branch-a' } })).toBe('branch-a');
    expect(readRequestedBranchId({ metadata: { branchId: 'branch-b' } })).toBe('branch-b');
    expect(readRequestedBranchId({ branch_id: 'branch-c', metadata: { branch_id: 'branch-a' } })).toBe('branch-c');
  });

  it('requires user_org_unit_access for Haircut requested branch', async () => {
    const supabase = createMockSupabase((table, filters) => {
      if (table === 'tenants') {
        return { data: { product_key: 'bella_haircut' }, error: null };
      }
      if (table === 'user_org_unit_access') {
        const branchFilter = filters.find((filter) => filter.column === 'org_unit_id');
        return {
          data: branchFilter?.value === 'branch-a' ? [{ org_unit_id: 'branch-a' }] : [],
          error: null,
        };
      }
      return { data: null, error: { message: `unexpected table ${table}` } };
    });

    await expect(resolveHaircutBranchContext({
      supabase: supabase as never,
      tenantId: 'tenant-haircut',
      currentUserId: 'user-1',
      requestedBranchId: 'branch-a',
    })).resolves.toEqual({
      requiresBranch: true,
      branchId: 'branch-a',
      source: 'requested',
    });

    await expect(resolveHaircutBranchContext({
      supabase: supabase as never,
      tenantId: 'tenant-haircut',
      currentUserId: 'user-1',
      requestedBranchId: 'branch-b',
    })).resolves.toEqual({
      error: 'Bạn không có quyền thao tác trên chi nhánh Haircut đã chọn.',
    });
  });

  it('persists branch ownership on Haircut booking payload and metadata', async () => {
    const payload = await buildBookingPayload({
      validatedData: {
        customer_id: 'customer-1',
        full_price: 500000,
        deposit_amount: 100000,
        total_sessions: 3,
        start_date: '2026-10-05',
        ktv_commission: 50000,
        preferred_time: '09:00',
        metadata: { source: 'test' },
      },
      customerId: 'customer-1',
      tenantId: 'tenant-haircut',
      existingBooking: null,
      tenantContext,
      branchContext: {
        requiresBranch: true,
        branchId: 'branch-a',
        source: 'requested',
      },
    });

    expect(payload).toEqual(expect.objectContaining({
      tenant_id: 'tenant-haircut',
      branch_id: 'branch-a',
      metadata: expect.objectContaining({
        source: 'test',
        branch_id: 'branch-a',
      }),
    }));
  });

  it('passes booking branch ownership through remaining payment RPC metadata and outbox', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { booking_id: 'booking-1', revenue_id: 'revenue-1', branch_id: 'branch-a' },
      error: null,
    });
    const input = payment();
    const expectedKey = buildManualPaymentIdempotencyKey(input, '2026-10-05');

    await recordBookingPaymentRpc({
      supabase: { rpc } as never,
      payment: input,
      tenantId: 'tenant-haircut',
      branchId: 'branch-a',
      actorId: 'user-1',
    });

    expect(rpc).toHaveBeenCalledWith(
      'record_remaining_payment_atomic',
      expect.objectContaining({
        p_accounting_metadata: expect.objectContaining({
          branch_id: 'branch-a',
          manual_payment_idempotency_key: expectedKey,
        }),
        p_outbox_payload: expect.objectContaining({
          branchId: 'branch-a',
          idempotencyKey: expectedKey,
        }),
      })
    );
  });

  it('uses originating branch in finance outbox payloads when supplied', () => {
    expect(buildPackageSaleOutboxEvent({
      tenantId: 'tenant-haircut',
      revenueId: 'revenue-1',
      totalAmount: 100000,
      branchId: 'branch-a',
    }).payload).toEqual(expect.objectContaining({
      branchId: 'branch-a',
    }));

    expect(buildSessionDoneOutboxEvent({
      tenantId: 'tenant-haircut',
      sessionLogId: 'session-1',
      bookingId: 'booking-1',
      earnedRevenueAmount: 100000,
      deferredRevenueAmount: 0,
      receivableAmount: 0,
      commissionAmount: 20000,
      branchId: 'branch-a',
    }).payload).toEqual(expect.objectContaining({
      branchId: 'branch-a',
    }));
  });
});
