import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261010040000_create_manufacturing_execution_completion.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing execution and completion migration shape', () => {
  it('creates only Manufacturing-owned execution and completion tables', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.manufacturing_production_executions');
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.manufacturing_production_order_completions');
    expect(migrationSql).toContain("CHECK (status IN ('draft', 'released', 'in_progress', 'completed', 'cancelled'))");
    expect(migrationSql).not.toContain('manufacturing_finance_handoffs');
    expect(migrationSql).not.toContain('manufacturing_reconciliations');
  });

  it('keeps execution and completion tenant-scoped and factory-scoped', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('factory_org_unit_id UUID NOT NULL');
    expect(migrationSql).toContain('public.manufacturing_factory_access_allowed');
    expect(migrationSql).toContain('fk_manufacturing_executions_order_tenant');
    expect(migrationSql).toContain('fk_manufacturing_completions_order_tenant');
  });

  it('requires reconciled quantities and prevents duplicate material issue evidence', () => {
    expect(migrationSql).toContain('uq_manufacturing_execution_material_movement');
    expect(migrationSql).toContain('ck_manufacturing_execution_quantity_reconciles');
    expect(migrationSql).toContain('uq_manufacturing_production_completion_order');
    expect(migrationSql).toContain('ck_manufacturing_production_completion_evidence_array');
  });

  it('enables RLS and authenticated grants for every new table', () => {
    for (const table of [
      'manufacturing_production_executions',
      'manufacturing_production_order_completions',
    ]) {
      expect(migrationSql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
      expect(migrationSql).toContain(`REVOKE ALL ON public.${table} FROM anon`);
      expect(migrationSql).toContain(`GRANT SELECT, INSERT, UPDATE, DELETE ON public.${table} TO authenticated, service_role`);
    }
  });

  it('does not introduce ProductRegistry, UI, Logistics mutation, or Finance posting surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('CREATE TABLE IF NOT EXISTS logistics.');
  });
});
