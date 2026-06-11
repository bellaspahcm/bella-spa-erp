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

  it('seeds and verifies the demo accounting chart before posting demo journals', () => {
    const source = readSource('scripts/beauty-demo-tenant.cjs');

    expect(source).toContain("const REQUIRED_DEMO_ACCOUNT_CODES = ['111', '112', '131', '334', '3387', '5111', '6421']");
    expect(source).toContain("client.rpc('seed_default_coa'");
    expect(source).toContain(".from('accounting_accounts')");
    expect(source).toContain('ensureDemoAccountingAccounts(client, tenantId)');
    expect(source).toContain('ensureDemoAccountingAccounts(client, tenant.id)');
    expect(source).toContain('Verified accounting accounts');
  });

  it('covers the Beauty operating flow from service package to resource, session, revenue and accounting', () => {
    const source = readSource('scripts/beauty-demo-tenant.cjs');

    const packageIndex = source.indexOf("const packages = await mustInsert(client, 'packages'");
    const resourceIndex = source.indexOf("const bookingResources = await mustInsert(client, 'booking_resources'");
    const customerIndex = source.indexOf("const customers = await mustInsert(client, 'customers'");
    const bookingIndex = source.indexOf("const bookings = await mustInsert(client, 'bookings'");
    const sessionIndex = source.indexOf("const sessionLogs = await mustInsert(client, 'session_logs'");
    const revenueIndex = source.indexOf("const revenues = await mustInsert(client, 'revenue'");

    expect(packageIndex).toBeGreaterThan(-1);
    expect(resourceIndex).toBeGreaterThan(packageIndex);
    expect(customerIndex).toBeGreaterThan(resourceIndex);
    expect(bookingIndex).toBeGreaterThan(customerIndex);
    expect(sessionIndex).toBeGreaterThan(bookingIndex);
    expect(revenueIndex).toBeGreaterThan(sessionIndex);

    expect(source).toContain("module_key: 'beauty_spa'");
    expect(source).toContain('booking_resource_id: bookingResources[0].id');
    expect(source).toContain('booking_resource_id: bookingResources[1].id');
    expect(source).toContain('booking_resource_id: bookingResources[2].id');
    expect(source).toContain("mustEnqueueAccountingEvent(client, buildPackageSaleOutboxEvent");
    expect(source).toContain("mustEnqueueAccountingEvent(client, buildSessionDoneOutboxEvent");
    expect(source).toContain('commissionAmount: asMoney(booking.ktv_commission)');
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
