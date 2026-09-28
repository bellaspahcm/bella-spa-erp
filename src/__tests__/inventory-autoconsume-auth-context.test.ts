import { readFileSync } from 'fs';
import path from 'path';

const sourcePath = path.join(process.cwd(), 'src/services/inventory-actions.ts');
const source = readFileSync(sourcePath, 'utf8');

function autoConsumeForSessionBody() {
  const start = source.indexOf('export async function autoConsumeForSession');
  const next = source.indexOf('export async function rollbackInventoryConsumption');
  expect(start).toBeGreaterThanOrEqual(0);
  expect(next).toBeGreaterThan(start);
  return source.slice(start, next);
}

describe('autoConsumeForSession auth context and tenant scope', () => {
  it('uses the canonical development/authenticated server client for tenant config reads', () => {
    const body = autoConsumeForSessionBody();

    expect(body).toContain("import('@/lib/supabase-dev-bypass-server')");
    expect(body).toContain('createDevelopmentBypassClient');
    expect(body).toContain('await createDevelopmentBypassClient()');
    expect(body).not.toContain('await getSupabaseWithTenant()');
    expect(body).not.toContain('await createClient()');
  });

  it('keeps tenant resolution and tenant predicates for RLS-sensitive reads', () => {
    const body = autoConsumeForSessionBody();

    expect(body).toContain('await getCurrentUser()');
    expect(body).toContain('user?.tenant_id || null');
    expect(body).toMatch(/\.from\('tenants'\)[\s\S]*?\.select\('salary_config'\)[\s\S]*?\.eq\('id', tenantId\)[\s\S]*?\.single\(\)/);
    expect(body).toMatch(/\.from\('inventory_logs'\)[\s\S]*?\.select\('id, change_amount'\)[\s\S]*?\.eq\('session_log_id', sessionLogId\)[\s\S]*?\.eq\('reason', INVENTORY_REASONS\.sessionConsumption\)[\s\S]*?\.eq\('tenant_id', tenantId\)/);
  });

  it('does not introduce an unconditional service-role client path', () => {
    const body = autoConsumeForSessionBody();

    expect(body).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(body).not.toContain('createSupabaseClient');
  });
});
