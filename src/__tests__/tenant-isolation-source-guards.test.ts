import { readFileSync } from 'fs';
import path from 'path';

function readSource(relativePath: string) {
  return readFileSync(path.join(process.cwd(), relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('dashboard tenant isolation source guards', () => {
  it('keeps inventory dashboard reads behind tenant-scoped server actions', () => {
    const source = readSource('src/app/dashboard/inventory/hooks/useInventoryPageState.ts');

    expect(source).toContain('getInventoryItems()');
    expect(source).toContain('getInventoryLogs(200)');
    expect(source).not.toMatch(/\.from\('inventory_(items|logs)'\)/);
  });

  it('keeps booking assignment updates behind the tenant-scoped booking action', () => {
    const source = readSource('src/app/dashboard/bookings/hooks/useBookingsPageActions.ts');

    expect(source).toContain('updateBooking(modalData.bookingId');
    expect(source).not.toMatch(/\.from\('bookings'\)\s*\.update/);
  });

  it('scopes audit reference maps to the current tenant', () => {
    const source = readSource('src/app/dashboard/audit/page.tsx');

    expect(source).toMatch(
      /\.from\('users'\)[\s\S]{0,160}\.select\('id, full_name'\)[\s\S]{0,160}\.eq\('tenant_id', tenantId\)/,
    );
    expect(source).toMatch(
      /\.from\('packages'\)[\s\S]{0,160}\.select\('id, name'\)[\s\S]{0,160}\.eq\('tenant_id', tenantId\)/,
    );
    expect(source).toMatch(
      /\.from\('customers'\)[\s\S]{0,180}\.select\('id, name_mother, name_baby'\)[\s\S]{0,180}\.eq\('tenant_id', tenantId\)/,
    );
  });

  it('keeps BookingModal customer and KTV pickers behind tenant-scoped server actions', () => {
    const source = readSource('src/components/features/BookingModal.tsx');

    expect(source).toContain('getScopedCustomers()');
    expect(source).toContain('getUsers()');
    expect(source).not.toMatch(/\.from\('users'\)/);
    expect(source).not.toMatch(/\.from\('customers'\)/);
  });

  it('does not read tenant identity from browser-side user queries on the services page', () => {
    const source = readSource('src/app/dashboard/services/hooks/useServicesPageState.ts');

    expect(source).not.toContain('createBrowserClient');
    expect(source).not.toContain('getTenantId');
    expect(source).not.toMatch(/\.from\('users'\)/);
    expect(source).not.toContain('tenant_id: tenantId');
  });

  it('scopes staff list reads to the current tenant', () => {
    const source = readSource('src/services/user-actions.ts');

    expect(source).toMatch(
      /export async function getUsers\(\)[\s\S]{0,500}\.from\('users'\)[\s\S]{0,260}\.eq\('tenant_id', tenantId\)/,
    );
  });

  it('keeps public online booking off first-tenant fallback and tenant-scopes rollbacks', () => {
    const source = readSource('src/modules/booking/actions/online-booking-action.ts');

    expect(source).toContain('resolvePublicBabycareTenantId');
    expect(source).not.toMatch(/\.from\('tenants'\)[\s\S]{0,120}\.limit\(1\)[\s\S]{0,80}\.single\(/);
    expect(source).toMatch(/\.from\('customers'\)[\s\S]{0,140}\.delete\(\)[\s\S]{0,140}\.eq\('tenant_id', tenantId\)/);
    expect(source).toMatch(/\.from\('bookings'\)[\s\S]{0,140}\.delete\(\)[\s\S]{0,140}\.eq\('tenant_id', tenantId\)/);
  });
});
