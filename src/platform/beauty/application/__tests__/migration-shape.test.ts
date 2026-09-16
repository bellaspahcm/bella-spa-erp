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
});
