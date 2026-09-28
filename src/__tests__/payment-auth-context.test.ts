import { readFileSync } from 'fs';
import path from 'path';

const actionSource = readFileSync(
  path.join(process.cwd(), 'src/core/services/order/payment-actions.ts'),
  'utf8'
);
const helperSource = readFileSync(
  path.join(process.cwd(), 'src/core/services/order/payment-helpers.ts'),
  'utf8'
);

function recordRemainingPaymentBody() {
  const start = actionSource.indexOf('export async function recordRemainingPayment');
  const next = actionSource.indexOf('export async function generateShareToken');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(next).toBeGreaterThan(start);
  return actionSource.slice(start, next);
}

function getBookingPaymentSnapshotBody() {
  const start = helperSource.indexOf('export async function getBookingPaymentSnapshot');
  const next = helperSource.indexOf('export function validateRemainingPaymentAmount');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(next).toBeGreaterThan(start);
  return helperSource.slice(start, next);
}

function recordBookingPaymentRpcBody() {
  const start = helperSource.indexOf('export async function recordBookingPaymentRpc');
  const next = helperSource.indexOf('export async function findExistingManualPaymentByIdempotencyKey');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(next).toBeGreaterThan(start);
  return helperSource.slice(start, next);
}

describe('recordRemainingPayment auth context and tenant scope', () => {
  it('uses the canonical development/authenticated server client for payment execution', () => {
    const body = recordRemainingPaymentBody();

    expect(body).toContain("import('@/lib/supabase-dev-bypass-server')");
    expect(body).toContain('createDevelopmentBypassClient');
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).toContain('await getCurrentUser()');
    expect(body).not.toContain("import('@/lib/supabase-server')");
    expect(body).not.toContain('await createClient()');
  });

  it('preserves tenant-scoped booking identity and payment truth reads', () => {
    const snapshotBody = getBookingPaymentSnapshotBody();

    expect(snapshotBody).toContain(".from('bookings')");
    expect(snapshotBody).toContain(".eq('id', bookingId)");
    expect(snapshotBody).toContain(".eq('tenant_id', tenantId)");
    expect(snapshotBody).toContain('revenue(amount, status, revenue_type)');
  });

  it('preserves the payment RPC contract without adding service-role dependency', () => {
    const actionBody = recordRemainingPaymentBody();
    const rpcBody = recordBookingPaymentRpcBody();

    expect(actionBody).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(actionBody).not.toContain('createSupabaseClient');
    expect(rpcBody).toContain("'record_remaining_payment_atomic'");
    expect(rpcBody).toContain('p_booking_id: payment.booking_id');
    expect(rpcBody).toContain('p_amount: payment.amount');
    expect(rpcBody).toContain('p_payment_method: payment.payment_method');
    expect(rpcBody).toContain('p_status: payment.status ||');
    expect(rpcBody).toContain('p_revenue_type: revenueType');
    expect(rpcBody).toContain('p_outbox_payload');
  });
});
