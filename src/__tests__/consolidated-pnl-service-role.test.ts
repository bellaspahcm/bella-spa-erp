const { readFileSync } = require('node:fs');
const path = require('node:path');

describe('consolidated P&L service role access migration', () => {
  it('allows service_role to execute the consolidated P&L RPC for operational checks', () => {
    const migrationSql = readFileSync(
      path.join(process.cwd(), 'supabase/migrations/20260606130000_allow_service_role_consolidated_pnl.sql'),
      'utf8'
    );

    expect(migrationSql).toContain("auth.role() <> ''service_role''");
    expect(migrationSql).toContain('GRANT EXECUTE ON FUNCTION public.get_consolidated_pnl(DATE, DATE) TO authenticated, service_role');
    expect(migrationSql).toContain('NOTIFY pgrst');
  });
});
