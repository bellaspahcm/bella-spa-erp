import fs from 'fs';
import path from 'path';

const migrationPath = path.join(
  process.cwd(),
  'supabase/migrations/20260927060000_enable_parent_user_role.sql',
);

function readMigration() {
  return fs.readFileSync(migrationPath, 'utf8');
}

function extractAllowedRoles(sql: string): string[] {
  const match = sql.match(/CHECK\s*\(\s*role\s+IN\s*\(([\s\S]*?)\)\s*\)/i);
  if (!match) return [];

  return [...match[1].matchAll(/'([^']+)'/g)].map((role) => role[1]);
}

describe('Preschool parent user role migration', () => {
  it('preserves existing roles and adds exactly one parent role', () => {
    const roles = extractAllowedRoles(readMigration());

    expect(roles).toEqual([
      'admin',
      'ktv_lead',
      'ktv',
      'admin_staff',
      'accountant',
      'hr',
      'student',
      'parent',
    ]);
  });

  it('keeps role validation bounded and rejects arbitrary roles by omission', () => {
    const sql = readMigration();
    const roles = extractAllowedRoles(sql);

    expect(sql).toContain('DROP CONSTRAINT IF EXISTS users_role_check');
    expect(sql).toContain('ADD CONSTRAINT users_role_check');
    expect(sql).not.toMatch(/CHECK\s*\(\s*true\s*\)/i);
    expect(sql).not.toMatch(/role\s+IS\s+NOT\s+NULL/i);
    expect(sql).not.toMatch(/ALTER\s+TABLE\s+public\.users\s+DISABLE\s+ROW\s+LEVEL\s+SECURITY/i);
    expect(roles).toContain('parent');
    expect(roles).not.toContain('owner');
    expect(roles).not.toContain('guardian');
    expect(roles).not.toContain('random');
  });
});
