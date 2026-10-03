import fs from 'node:fs';
import path from 'node:path';

describe('Bella Haircut H8 migration shape', () => {
  it('contains additive Beauty tables, RLS, and canonical history structures', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20260916000000_beauty_os_h8_persistence.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS beauty_appointments');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS beauty_sessions');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS beauty_professional_assignments');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS beauty_resource_allocations');
    expect(sql).toContain('beauty_professional_assignment_history');
    expect(sql).toContain('beauty_resource_allocation_history');
    expect(sql.match(/ENABLE ROW LEVEL SECURITY/g)).toHaveLength(6);
    expect(sql).not.toMatch(/DROP\s+(TABLE|COLUMN)\s+(hc_|education_|logistics_)/i);
  });

  it('hardens approved Beauty OS history tables as append-only', () => {
    const migrationPath = path.resolve(process.cwd(), 'supabase/migrations/20261002040000_beauty_os_history_append_only.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    expect(sql).toContain('REVOKE UPDATE, DELETE ON public.beauty_professional_assignment_history FROM authenticated');
    expect(sql).toContain('REVOKE UPDATE, DELETE ON public.beauty_resource_allocation_history FROM authenticated');
    expect(sql).toContain('DROP POLICY IF EXISTS beauty_assignment_history_tenant_isolation');
    expect(sql).toContain('DROP POLICY IF EXISTS beauty_allocation_history_tenant_isolation');
    expect(sql).toContain('CREATE POLICY beauty_assignment_history_select');
    expect(sql).toContain('CREATE POLICY beauty_assignment_history_insert');
    expect(sql).toContain('CREATE POLICY beauty_assignment_history_no_update');
    expect(sql).toContain('CREATE POLICY beauty_assignment_history_no_delete');
    expect(sql).toContain('CREATE POLICY beauty_allocation_history_select');
    expect(sql).toContain('CREATE POLICY beauty_allocation_history_insert');
    expect(sql).toContain('CREATE POLICY beauty_allocation_history_no_update');
    expect(sql).toContain('CREATE POLICY beauty_allocation_history_no_delete');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.fn_prevent_beauty_history_mutation()');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.beauty_professional_assignment_history');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.beauty_resource_allocation_history');
    expect(sql).toContain('trg_beauty_assignment_history_append_only');
    expect(sql).toContain('trg_beauty_allocation_history_append_only');
    expect(sql).not.toMatch(/service_role/i);
  });
});
