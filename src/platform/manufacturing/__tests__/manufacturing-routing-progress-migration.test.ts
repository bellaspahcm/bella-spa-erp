import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261011010000_create_manufacturing_routing_progress.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing routing and operation progress migration shape', () => {
  const routingTables = [
    'manufacturing_work_centers',
    'manufacturing_routing_revisions',
    'manufacturing_routing_operations',
    'manufacturing_operation_progress',
  ];

  it('creates only Manufacturing-owned routing and progress tables', () => {
    for (const table of routingTables) {
      expect(migrationSql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }

    expect(migrationSql).not.toContain('manufacturing_work_center_capacity');
    expect(migrationSql).not.toContain('manufacturing_machine_telemetry');
    expect(migrationSql).not.toContain('manufacturing_production_costs');
    expect(migrationSql).not.toContain('manufacturing_wip');
  });

  it('keeps routing tenant-scoped, factory-scoped, and tied to production order lines', () => {
    expect(migrationSql).toContain('tenant_id UUID NOT NULL REFERENCES public.tenants(id)');
    expect(migrationSql).toContain('factory_org_unit_id UUID NOT NULL');
    expect(migrationSql).toContain('fk_manufacturing_operation_progress_order_tenant');
    expect(migrationSql).toContain('fk_manufacturing_operation_progress_order_line_tenant');
    expect(migrationSql).toContain('fk_manufacturing_operation_progress_operation_revision');
    expect(migrationSql).toContain('public.manufacturing_factory_access_allowed');
  });

  it('enforces routing uniqueness and operation progress lifecycle shape', () => {
    expect(migrationSql).toContain('uq_manufacturing_work_centers_code');
    expect(migrationSql).toContain('uq_manufacturing_routing_revision_code');
    expect(migrationSql).toContain('uq_manufacturing_routing_operation_revision_id');
    expect(migrationSql).toContain('uq_manufacturing_routing_operation_sequence');
    expect(migrationSql).toContain('uq_manufacturing_operation_progress_operation');
    expect(migrationSql).toContain("status IN ('planned', 'ready', 'in_progress', 'completed', 'blocked')");
    expect(migrationSql).toContain('ck_manufacturing_operation_progress_blocked_reason');
  });

  it('enables RLS and authenticated grants for every routing table', () => {
    for (const table of routingTables) {
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
    expect(migrationSqlWithoutComments).not.toContain('stock_out');
    expect(migrationSqlWithoutComments).not.toContain('stock_in');
  });
});
