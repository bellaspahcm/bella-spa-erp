import { readFileSync } from 'fs';
import path from 'path';

const migrationSql = readFileSync(
  path.join(
    process.cwd(),
    'supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql',
  ),
  'utf8',
);

describe('Beauty Spa phase 2 foundation schema', () => {
  it('extends packages instead of creating a parallel service table', () => {
    expect(migrationSql).toContain('ALTER TABLE public.packages');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS module_key TEXT');
    expect(migrationSql).toContain("CHECK (module_key IN ('babycare', 'beauty_spa'))");
    expect(migrationSql).toContain("CHECK (service_kind IN ('single_service', 'treatment_package', 'retail_product', 'consultation'))");
    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.beauty_services');
  });

  it('creates tenant-scoped schedulable resources with RLS and no anon access', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.booking_resources');
    expect(migrationSql).toContain("CHECK (resource_type IN ('bed', 'room', 'machine', 'chair', 'other'))");
    expect(migrationSql).toContain("CHECK (status IN ('available', 'in_use', 'maintenance', 'inactive'))");
    expect(migrationSql).toContain('ALTER TABLE public.booking_resources ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('public.get_auth_tenant_id()');
    expect(migrationSql).toContain('REVOKE ALL ON TABLE public.booking_resources FROM anon');
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_resources TO authenticated');
    expect(migrationSql).toContain('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.booking_resources TO service_role');
  });
});
