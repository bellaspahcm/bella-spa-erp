import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261011020000_bind_manufacturing_operation_progress_evidence.sql'
);

const migrationSql = readFileSync(migrationPath, 'utf8');
const migrationSqlWithoutComments = migrationSql
  .split('\n')
  .filter((line) => !line.trimStart().startsWith('--'))
  .join('\n');

describe('Manufacturing operation progress evidence migration shape', () => {
  it('adds Manufacturing-owned execution evidence fields to operation progress', () => {
    expect(migrationSql).toContain('ALTER TABLE public.manufacturing_operation_progress');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS production_execution_id UUID');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS completed_quantity NUMERIC(18, 6)');
    expect(migrationSql).toContain('ADD COLUMN IF NOT EXISTS quantity_uom TEXT');
  });

  it('binds completed operation progress to production execution evidence', () => {
    expect(migrationSql).toContain('uq_manufacturing_production_executions_line_id');
    expect(migrationSql).toContain('fk_manufacturing_operation_progress_execution_line');
    expect(migrationSql).toContain(
      'REFERENCES public.manufacturing_production_executions(tenant_id, production_order_line_id, id)'
    );
    expect(migrationSql).toContain('ck_manufacturing_operation_progress_completed_evidence');
    expect(migrationSql).toContain("status <> 'completed'");
    expect(migrationSql).toContain('completed_quantity > 0');
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
