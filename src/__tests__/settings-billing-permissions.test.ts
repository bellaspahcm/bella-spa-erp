import { readFileSync } from 'fs';
import path from 'path';

describe('settings billing table permissions', () => {
  const migrationSql = readFileSync(
    path.join(
      process.cwd(),
      'supabase/migrations/20260607003000_grant_subscription_and_royalty_access.sql'
    ),
    'utf8'
  );

  it('grants subscription invoice table access required by settings SaaS tab', () => {
    expect(migrationSql).toContain('REVOKE ALL ON TABLE public.subscription_invoices FROM anon');
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.subscription_invoices TO authenticated'
    );
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.subscription_invoices TO service_role'
    );
  });

  it('grants royalty invoice table access required by settings HQ billing tab', () => {
    expect(migrationSql).toContain('REVOKE ALL ON TABLE public.franchise_royalty_invoices FROM anon');
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE ON TABLE public.franchise_royalty_invoices TO authenticated'
    );
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.franchise_royalty_invoices TO service_role'
    );
    expect(migrationSql).toContain("NOTIFY pgrst, 'reload schema'");
  });
});
