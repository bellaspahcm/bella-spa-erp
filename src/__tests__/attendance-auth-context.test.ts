import { readFileSync } from 'fs';
import path from 'path';

const attendanceActionsSourcePath = path.join(process.cwd(), 'src/services/attendance-actions.ts');
const attendanceActionsSource = readFileSync(attendanceActionsSourcePath, 'utf8');

function functionBody(functionName: string) {
  const start = attendanceActionsSource.indexOf(`export async function ${functionName}`);
  expect(start).toBeGreaterThanOrEqual(0);

  const nextExport = attendanceActionsSource.indexOf('\nexport async function ', start + 1);
  return attendanceActionsSource.slice(start, nextExport === -1 ? undefined : nextExport);
}

describe('attendance auth context and tenant scope', () => {
  it('uses the canonical development/authenticated server client for getKTVTodayAttendance', () => {
    const body = functionBody('getKTVTodayAttendance');

    expect(attendanceActionsSource).toContain(
      "import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server'"
    );
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain('await createClient()');
  });

  it("keeps today's attendance read scoped to KTV identity, tenant, and date", () => {
    const body = functionBody('getKTVTodayAttendance');

    expect(body).toContain('const user = currentUser || await getCurrentUser()');
    expect(body).toContain('const tenantId = user.tenant_id');
    expect(body).toMatch(/\.from\('attendance'\)[\s\S]*?\.select\('\*'\)[\s\S]*?\.eq\('ktv_id', user\.id\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.eq\('date', todayStr\)[\s\S]*?\.maybeSingle\(\)/);
  });

  it('uses the canonical development/authenticated server client for ktvCheckIn', () => {
    const body = functionBody('ktvCheckIn');

    expect(attendanceActionsSource).toContain(
      "import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server'"
    );
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain('await createClient()');
  });

  it('keeps check-in identity, date, and tenant predicates', () => {
    const body = functionBody('ktvCheckIn');

    expect(body).toContain('const user = await getCurrentUser()');
    expect(body).toContain('const tenantId = user.tenant_id');
    expect(body).toMatch(/\.from\('attendance'\)[\s\S]*?\.select\('id'\)[\s\S]*?\.eq\('ktv_id', user\.id\)[\s\S]*?\.eq\('date', todayStr\)[\s\S]*?\.maybeSingle\(\)/);
    expect(body).toMatch(/\.insert\(\{[\s\S]*?ktv_id: user\.id,[\s\S]*?date: todayStr,[\s\S]*?checkin_time: now\.toISOString\(\),[\s\S]*?status,[\s\S]*?tenant_id: tenantId,[\s\S]*?\}\)/);
  });

  it('uses the canonical development/authenticated server client for ktvCheckOut', () => {
    const body = functionBody('ktvCheckOut');

    expect(attendanceActionsSource).toContain(
      "import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server'"
    );
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain('await createClient()');
  });

  it('keeps check-out identity, date, and tenant predicates', () => {
    const body = functionBody('ktvCheckOut');

    expect(body).toContain('const user = await getCurrentUser()');
    expect(body).toContain('const tenantId = user.tenant_id');
    expect(body).toMatch(/\.from\('attendance'\)[\s\S]*?\.select\('\*'\)[\s\S]*?\.eq\('ktv_id', user\.id\)[\s\S]*?\.eq\('date', todayStr\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.maybeSingle\(\)/);
    expect(body).toMatch(/\.from\('attendance'\)[\s\S]*?\.update\(\{[\s\S]*?checkout_time: now\.toISOString\(\),[\s\S]*?\}\)[\s\S]*?\.eq\('id', existing\.id\)[\s\S]*?\.eq\('tenant_id', tenantId\)[\s\S]*?\.select\(\)/);
  });

  it('does not introduce an unconditional service-role client path', () => {
    const combined = `${functionBody('ktvCheckIn')}\n${functionBody('ktvCheckOut')}`;

    expect(combined).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(combined).not.toContain('createSupabaseClient');
  });
});
