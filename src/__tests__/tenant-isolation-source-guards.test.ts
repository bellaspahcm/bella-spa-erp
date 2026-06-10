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
});
