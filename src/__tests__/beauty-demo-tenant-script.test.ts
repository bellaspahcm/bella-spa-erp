import fs from 'fs';
import path from 'path';

const projectRoot = process.cwd();

function readSource(relativePath: string) {
  return fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');
}

describe('Beauty demo tenant lifecycle script', () => {
  it('uses fixed demo identifiers so the test tenant can be found and removed safely', () => {
    const source = readSource('scripts/beauty-demo-tenant.cjs');

    expect(source).toContain("const DEMO_MARKER = 'BEAUTY_DEMO_FRANCHISE_TEST'");
    expect(source).toContain("const DEMO_TENANT_NAME = 'Beauty Spa Franchise Demo - TEST'");
    expect(source).toContain("const DEMO_TENANT_EMAIL = 'beauty-demo-branch@bellaspa.test'");
    expect(source).toContain("const DEMO_ADMIN_EMAIL = 'admin.beauty.demo@bellaspa.test'");
  });

  it('creates the tenant as a Beauty-only franchise tenant', () => {
    const source = readSource('scripts/beauty-demo-tenant.cjs');

    expect(source).toContain("enabled_modules: { babycare: false, beauty_spa: true }");
    expect(source).toContain('franchise_agreement_date: daysFromToday(0)');
    expect(source).toContain("royalty_type: 'percentage'");
    expect(source).toContain("subscription_tier: 'enterprise'");
  });

  it('requires explicit cleanup confirmation and avoids broad delete filters', () => {
    const source = readSource('scripts/beauty-demo-tenant.cjs');

    expect(source).toContain("Cleanup requires --confirm");
    expect(source).toContain("argv.includes('--confirm')");
    expect(source).toContain(".delete().eq('tenant_id', tenantId)");
    expect(source).toContain(".delete().eq('id', tenant.id)");
    expect(source).not.toContain('.delete().neq(');
    expect(source).not.toContain('.delete().not(');
  });
});
