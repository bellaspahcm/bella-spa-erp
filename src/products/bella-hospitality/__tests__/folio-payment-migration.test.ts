import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const MIGRATION_PATH = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261008050000_create_hospitality_folio_payment_foundation.sql'
);

const migrationSql = readFileSync(MIGRATION_PATH, 'utf8');

describe('Hospitality Phase 4 migration shape', () => {
  it('creates only the approved Folio + Payment link tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_folios');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_folio_items');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_folio_finance_links');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.hospitality_folio_payment_applications');

    expect(migrationSql).not.toContain('CREATE TABLE IF NOT EXISTS public.hospitality_payments');
    expect(migrationSql).not.toContain('hospitality_housekeeping');
    expect(migrationSql).not.toContain('hospitality_maintenance');
    expect(migrationSql).not.toContain('hospitality_fnb');
    expect(migrationSql).not.toContain('hospitality_travel');
    expect(migrationSql).not.toContain('hospitality_tours');
    expect(migrationSql).not.toContain('resource_allocation');
    expect(migrationSql).not.toContain('global_resource_kernel');
  });

  it('stores opaque Finance identifiers without direct Finance table dependencies', () => {
    expect(migrationSql).toContain('finance_invoice_id UUID NOT NULL');
    expect(migrationSql).toContain('finance_cash_movement_id UUID NOT NULL');
    expect(migrationSql).toContain('finance_allocation_id UUID NOT NULL');

    expect(migrationSql).not.toMatch(/REFERENCES public\.finance_/);
    expect(migrationSql).not.toMatch(/INSERT INTO public\.finance_/);
    expect(migrationSql).not.toMatch(/UPDATE public\.finance_/);
    expect(migrationSql).not.toMatch(/DELETE FROM public\.finance_/);
  });

  it('enforces tenant ownership, RLS, grants, and folio invariants', () => {
    const tables = [
      'hospitality_folios',
      'hospitality_folio_items',
      'hospitality_folio_finance_links',
      'hospitality_folio_payment_applications',
    ];

    for (const table of tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }

    expect(migrationSql).toContain('hospitality_validate_folio');
    expect(migrationSql).toContain('hospitality_validate_folio_item');
    expect(migrationSql).toContain('hospitality_validate_folio_finance_link');
    expect(migrationSql).toContain('hospitality_validate_folio_payment_application');
    expect(migrationSql).toContain('HOSPITALITY_FOLIO_PAYMENT_EXCEEDS_OUTSTANDING');
    expect(migrationSql).toContain('public.get_auth_tenant_id()');
    expect(migrationSql).toContain("current_setting('app.current_tenant_id', TRUE)");
  });
});
