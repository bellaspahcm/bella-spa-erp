import { readFileSync } from 'fs';
import path from 'path';

const sourcePath = path.join(process.cwd(), 'src/core/services/order/update-booking-action.ts');
const source = readFileSync(sourcePath, 'utf8');

function updateBookingBody() {
  const start = source.indexOf('export async function updateBooking');
  const syncStart = source.indexOf('async function syncBookingProgress');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(syncStart).toBeGreaterThan(start);
  return source.slice(start, syncStart);
}

describe('updateBooking auth context and tenant scope', () => {
  it('uses the canonical development/authenticated server client for updateBooking', () => {
    const body = updateBookingBody();

    expect(body).toContain("import('@/lib/supabase-dev-bypass-server')");
    expect(body).toContain('createDevelopmentBypassClient');
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain("import('@/lib/supabase-server')");
    expect(body).not.toContain('await createClient()');
  });

  it('keeps booking identity and tenant predicates on the initial booking read', () => {
    const body = updateBookingBody();

    expect(body).toMatch(/\.from\('bookings'\)[\s\S]*?\.select\('\*'\)[\s\S]*?\.eq\('id', id\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).not.toContain(".eq('booking_number'");
  });

  it('keeps booking identity and tenant predicates on the booking update', () => {
    const body = updateBookingBody();

    expect(body).toMatch(/\.from\('bookings'\)[\s\S]*?\.update\(updatePayload\)[\s\S]*?\.eq\('id', id\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.select\(\)/);
  });

  it('does not introduce an unconditional service-role client path', () => {
    const body = updateBookingBody();

    expect(body).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(body).not.toContain('createSupabaseClient');
  });
});
