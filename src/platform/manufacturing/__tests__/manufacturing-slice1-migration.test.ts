import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261010010000_create_manufacturing_slice1_foundation.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing Slice 1 migration shape', () => {
  const slice1Tables = [
    'manufacturing_production_orders',
    'manufacturing_production_order_lines',
    'manufacturing_bom_revisions',
    'manufacturing_bom_components',
    'manufacturing_material_requirements',
    'manufacturing_command_idempotency',
  ];

  it('creates only the approved Manufacturing Slice 1 tables', () => {
    for (const table of slice1Tables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }

    expect(migrationSql).not.toContain('manufacturing_material_issues');
    expect(migrationSql).not.toContain('manufacturing_finished_goods_receipts');
    expect(migrationSql).not.toContain('manufacturing_finance_handoffs');
    expect(migrationSql).not.toContain('manufacturing_reconciliations');
  });

  it('keeps Manufacturing ownership tenant-scoped and factory-scoped', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('factory_org_unit_id UUID NOT NULL');
    expect(migrationSql).toContain('REFERENCES public.org_units(id)');
    expect(migrationSql).toContain('public.user_org_unit_access');
    expect(migrationSql).toContain('public.manufacturing_factory_access_allowed');
  });

  it('enforces idempotency and same-tenant child references', () => {
    expect(migrationSql).toContain('CONSTRAINT uq_manufacturing_command_idempotency UNIQUE (tenant_id, operation, business_key)');
    expect(migrationSql).toContain('CONSTRAINT uq_manufacturing_production_order_lines_order_item');
    expect(migrationSql).toContain('fk_manufacturing_order_lines_order_tenant');
    expect(migrationSql).toContain('fk_manufacturing_bom_components_revision_tenant');
    expect(migrationSql).toContain('fk_manufacturing_material_requirements_order_tenant');
    expect(migrationSql).toContain('fk_manufacturing_material_requirements_bom_tenant');
  });

  it('enables RLS and revokes anon access on every Slice 1 table', () => {
    for (const table of slice1Tables) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }
  });

  it('does not introduce ProductRegistry, stock mutation, or Finance posting surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
  });
});
