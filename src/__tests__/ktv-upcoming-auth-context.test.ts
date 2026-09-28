import { readFileSync } from 'fs';
import path from 'path';

const ktvActionsSourcePath = path.join(process.cwd(), 'src/services/ktv-actions.ts');
const ktvActionsSource = readFileSync(ktvActionsSourcePath, 'utf8');

function activeBody() {
  const start = ktvActionsSource.indexOf('export async function getKTVActiveSessions');
  const end = ktvActionsSource.indexOf('export async function getKTVUpcomingSessions');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return ktvActionsSource.slice(start, end);
}

function upcomingBody() {
  const start = ktvActionsSource.indexOf('export async function getKTVUpcomingSessions');
  const end = ktvActionsSource.indexOf('export async function getKTVOverdueSessions');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return ktvActionsSource.slice(start, end);
}

function startSessionBody() {
  const start = ktvActionsSource.indexOf('export async function startSession');
  const end = ktvActionsSource.indexOf('export async function completeKTVSession');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return ktvActionsSource.slice(start, end);
}

function completeSessionBody() {
  const start = ktvActionsSource.indexOf('export async function completeKTVSession');
  const end = ktvActionsSource.indexOf('export async function getKTVEarnings');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return ktvActionsSource.slice(start, end);
}

describe('KTV active session auth context', () => {
  it('uses the canonical development/authenticated server client for the dashboard active read path', () => {
    const body = activeBody();

    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).toContain('const tenantId = user.tenant_id');
  });

  it('keeps explicit tenant predicates while loading active sessions', () => {
    const body = activeBody();

    expect(body).toMatch(/\.eq\('completed_by_ktv_id', user\.id\)[\s\S]*?\.eq\('status', 'in_progress'\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.eq\('bookings\.tenant_id', tenantId\)/);
  });
});

describe('KTV upcoming session auth context', () => {
  it('uses the canonical development/authenticated server client for the dashboard read path', () => {
    const body = upcomingBody();

    expect(ktvActionsSource).toContain("import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server'");
    expect(body).toContain('await createDevelopmentBypassClient()');
  });

  it('keeps explicit tenant predicates while using the authenticated/dev client', () => {
    const body = upcomingBody();

    expect(body).toContain('const tenantId = user.tenant_id');
    expect(body).toMatch(/\.eq\('bookings\.assigned_ktv_id', user\.id\)[\s\S]*?\.eq\('bookings\.tenant_id', tenantId\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
    expect(body).toMatch(/\.eq\('completed_by_ktv_id', user\.id\)[\s\S]*?\.eq\('status', 'scheduled'\)[\s\S]*?\.eq\('bookings\.tenant_id', tenantId\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
    expect(body).toMatch(/\.in\('booking_id', bookingIds\)[\s\S]*?\.eq\('bookings\.tenant_id', tenantId\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
  });
});

describe('KTV start session auth context', () => {
  it('uses the canonical development/authenticated server client for the start path', () => {
    const body = startSessionBody();

    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).toContain('const tenantId = user.tenant_id');
  });

  it('keeps explicit tenant predicates on start-session read and writes', () => {
    const body = startSessionBody();

    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.select\('[^']*tenant_id[\s\S]*?'\)[\s\S]*?\.eq\('id', sessionId\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.update\(updatePayload\)[\s\S]*?\.eq\('id', sessionId\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
    expect(body).toMatch(/\.from\('bookings'\)[\s\S]*?\.update\(\{[\s\S]*?status: 'in_progress'[\s\S]*?\}\)[\s\S]*?\.eq\('id', session\.booking_id\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
  });
});

describe('KTV complete session auth context', () => {
  it('uses the canonical development/authenticated server client for the completion path', () => {
    const body = completeSessionBody();

    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).toContain('const tenantId = user.tenant_id');
  });

  it('keeps explicit tenant predicates on completion read and writes', () => {
    const body = completeSessionBody();

    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.select\(`[\s\S]*?tenant_id[\s\S]*?bookings \([\s\S]*?tenant_id[\s\S]*?`\)[\s\S]*?\.eq\('id', sessionId\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).toMatch(/\.from\('session_logs'\)[\s\S]*?\.update\(sessionUpdatePayload\)[\s\S]*?\.eq\('id', sessionId\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
    expect(body).toContain("return { success: false, error: 'Booking tenant mismatch' }");
  });
});
