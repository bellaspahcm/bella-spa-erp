import { readFileSync } from 'fs';
import { join } from 'path';

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';

jest.mock('@/lib/utils', () => ({
  getLocalDateString: () => '2026-06-07',
}));

import {
  buildManualPaymentIdempotencyKey,
  recordBookingPaymentRpc,
  type RecordRemainingPaymentParams,
} from '@/core/services/order/payment-helpers';

const migrationSql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260607231500_manual_payment_idempotency.sql'),
  'utf8'
);

function payment(overrides: Partial<RecordRemainingPaymentParams> = {}): RecordRemainingPaymentParams {
  return {
    booking_id: 'booking-1',
    customer_id: 'customer-1',
    amount: 4300000,
    payment_method: 'bank_transfer',
    status: 'confirmed',
    notes: 'Thu no dot cuoi',
    revenue_type: 'remaining_payment',
    ...overrides,
  };
}

describe('manual remaining payment idempotency', () => {
  it('builds a stable business key for retrying the same manual payment', () => {
    const first = buildManualPaymentIdempotencyKey(payment(), '2026-06-07');
    const second = buildManualPaymentIdempotencyKey(payment({ notes: '  Thu   no dot cuoi  ' }), '2026-06-07');

    expect(first).toBe(second);
    expect(first).toBe(
      'manual-payment:v1|booking-1|2026-06-07|remaining_payment|4300000.00|bank_transfer|Thu no dot cuoi|'
    );
  });

  it('passes the idempotency key through RPC metadata and accounting outbox payload', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { booking_id: 'booking-1', revenue_id: 'revenue-1', idempotent: false },
      error: null,
    });
    const supabase = { rpc };
    const input = payment();
    const expectedKey = buildManualPaymentIdempotencyKey(input, '2026-06-07');

    const result = await recordBookingPaymentRpc({
      supabase: supabase as never,
      payment: input,
      tenantId: 'tenant-1',
      actorId: 'user-1',
    });

    expect(result).toEqual({
      data: { booking_id: 'booking-1', revenue_id: 'revenue-1', idempotent: false },
    });
    expect(rpc).toHaveBeenCalledWith(
      'record_remaining_payment_atomic',
      expect.objectContaining({
        p_booking_id: 'booking-1',
        p_amount: 4300000,
        p_payment_method: 'bank_transfer',
        p_accounting_metadata: expect.objectContaining({
          manual_payment_idempotency_key: expectedKey,
          payment_source: 'manual_remaining_payment',
        }),
        p_outbox_payload: expect.objectContaining({
          idempotencyKey: expectedKey,
          totalAmount: 4300000,
          branchId: 'tenant-1',
        }),
      })
    );
  });

  it('preserves an explicit idempotency key when the caller provides one', async () => {
    const rpc = jest.fn().mockResolvedValue({
      data: { booking_id: 'booking-1', revenue_id: 'revenue-1', idempotent: true },
      error: null,
    });
    const supabase = { rpc };

    await recordBookingPaymentRpc({
      supabase: supabase as never,
      payment: payment({ idempotency_key: 'manual-payment:custom-key' }),
      tenantId: 'tenant-1',
      actorId: null,
    });

    expect(rpc).toHaveBeenCalledWith(
      'record_remaining_payment_atomic',
      expect.objectContaining({
        p_accounting_metadata: expect.objectContaining({
          manual_payment_idempotency_key: 'manual-payment:custom-key',
        }),
        p_outbox_payload: expect.objectContaining({
          idempotencyKey: 'manual-payment:custom-key',
        }),
      })
    );
  });

  it('installs a tenant-scoped unique index for manual payment keys', () => {
    expect(migrationSql).toContain('idx_revenue_manual_payment_idempotency_key');
    expect(migrationSql).toContain(
      "ON public.revenue (tenant_id, (accounting_metadata->>'manual_payment_idempotency_key'))"
    );
    expect(migrationSql).toContain(
      "WHERE COALESCE(accounting_metadata->>'manual_payment_idempotency_key', '') <> ''"
    );
  });

  it('returns existing revenue on duplicate or raced manual payment keys', () => {
    expect(migrationSql).toContain('v_existing_revenue public.revenue%ROWTYPE');
    expect(migrationSql).toContain("AND accounting_metadata->>'manual_payment_idempotency_key' = v_payment_key");
    expect(migrationSql).toContain("'idempotent', TRUE");
    expect(migrationSql).toContain('EXCEPTION WHEN unique_violation THEN');
    expect(migrationSql).toContain('v_outbox_id := public.enqueue_accounting_event');
  });
});
