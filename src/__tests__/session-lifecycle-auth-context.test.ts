import { readFileSync } from 'fs';
import path from 'path';

const updateSessionLogSourcePath = path.join(process.cwd(), 'src/core/services/order/update-session-log-action.ts');
const completeSessionSourcePath = path.join(process.cwd(), 'src/core/services/order/complete-session-action.ts');

const updateSessionLogSource = readFileSync(updateSessionLogSourcePath, 'utf8');
const completeSessionSource = readFileSync(completeSessionSourcePath, 'utf8');

function updateSessionLogBody() {
  const start = updateSessionLogSource.indexOf('export async function updateSessionLog');
  expect(start).toBeGreaterThanOrEqual(0);
  return updateSessionLogSource.slice(start);
}

function completeSessionBody() {
  const start = completeSessionSource.indexOf('export async function completeSession');
  expect(start).toBeGreaterThanOrEqual(0);
  return completeSessionSource.slice(start);
}

describe('session lifecycle auth context and tenant scope', () => {
  it('uses the canonical development/authenticated server client for updateSessionLog', () => {
    const body = updateSessionLogBody();

    expect(body).toContain("import('@/lib/supabase-dev-bypass-server')");
    expect(body).toContain('createDevelopmentBypassClient');
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain("import('@/lib/supabase-server')");
    expect(body).not.toContain('await createClient()');
  });

  it('keeps session identity and tenant predicates in updateSessionLog', () => {
    const body = updateSessionLogBody();

    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.select\('\*'\)[\s\S]*?\.eq\('id', id\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.update\(safeUpdates\)[\s\S]*?\.eq\('id', id\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.select\(\)/);
  });

  it('uses the canonical development/authenticated server client for completeSession', () => {
    const body = completeSessionBody();

    expect(body).toContain("import('@/lib/supabase-dev-bypass-server')");
    expect(body).toContain('createDevelopmentBypassClient');
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain("import('@/lib/supabase-server')");
    expect(body).not.toContain('await createClient()');
  });

  it('keeps session, booking, relationship, and tenant predicates in completeSession', () => {
    const body = completeSessionBody();

    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.select\('\*'\)[\s\S]*?\.eq\('id', sessionId\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).toContain('existingLog.booking_id !== bookingId');
    expect(body).toMatch(/\.from\('bookings'\)[\s\S]*?\.select\('assigned_ktv_id, package_id, status, branch_id, full_price, discount_percent, total_sessions'\)[\s\S]*?\.eq\('id', bookingId\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.update\(updatePayload\)[\s\S]*?\.eq\('id', sessionId\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
  });

  it('does not introduce an unconditional service-role client path', () => {
    const combined = `${updateSessionLogBody()}\n${completeSessionBody()}`;

    expect(combined).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(combined).not.toContain('createSupabaseClient');
  });
});
