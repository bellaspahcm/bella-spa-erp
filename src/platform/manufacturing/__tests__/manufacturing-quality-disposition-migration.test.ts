import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261010050000_create_manufacturing_quality_dispositions.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing quality disposition migration shape', () => {
  it('creates only Manufacturing-owned quality evidence and completion evidence surfaces', () => {
    expect(migrationSql).toContain('CREATE TABLE IF NOT EXISTS public.manufacturing_quality_dispositions');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS quality_disposition_evidence JSONB');
    expect(migrationSql).not.toContain('manufacturing_quality_os');
    expect(migrationSql).not.toContain('manufacturing_capa');
    expect(migrationSql).not.toContain('manufacturing_quality_workflows');
  });

  it('keeps evidence tenant-scoped, factory-scoped, and tied to execution evidence', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('factory_org_unit_id UUID NOT NULL');
    expect(migrationSql).toContain('production_execution_id UUID NOT NULL');
    expect(migrationSql).toContain('fk_manufacturing_quality_dispositions_order_tenant');
    expect(migrationSql).toContain('fk_manufacturing_quality_dispositions_order_line_tenant');
    expect(migrationSql).toContain('fk_manufacturing_quality_dispositions_execution_tenant');
    expect(migrationSql).toContain('public.manufacturing_factory_access_allowed');
  });

  it('encodes terminal, quantity, and evidence constraints without stock mutation', () => {
    expect(migrationSql).toContain("source_quantity_type IN ('accepted', 'rejected', 'scrap', 'pending')");
    expect(migrationSql).toContain("disposition IN ('accepted', 'conditional_accept', 'rework', 'scrap', 'discard_reject', 'pending')");
    expect(migrationSql).toContain('ck_manufacturing_quality_dispositions_terminal_semantics');
    expect(migrationSql).toContain('ck_manufacturing_quality_dispositions_accepted_output');
    expect(migrationSql).toContain('ck_manufacturing_production_completion_quality_evidence_array');
  });

  it('enables RLS and authenticated grants for the quality evidence table', () => {
    expect(migrationSql).toContain('ALTER TABLE public.manufacturing_quality_dispositions ENABLE ROW LEVEL SECURITY');
    expect(migrationSql).toContain('REVOKE ALL ON public.manufacturing_quality_dispositions FROM anon');
    expect(migrationSql).toContain(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON public.manufacturing_quality_dispositions TO authenticated, service_role'
    );
  });

  it('does not introduce ProductRegistry, UI, Logistics mutation, or Finance posting surfaces', () => {
    expect(migrationSqlWithoutComments).not.toContain('ProductRegistry');
    expect(migrationSqlWithoutComments).not.toContain('product_key');
    expect(migrationSqlWithoutComments).not.toContain('accounting_outbox');
    expect(migrationSqlWithoutComments).not.toContain('ledger');
    expect(migrationSqlWithoutComments).not.toContain('CREATE TABLE IF NOT EXISTS logistics.');
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
  });
});
