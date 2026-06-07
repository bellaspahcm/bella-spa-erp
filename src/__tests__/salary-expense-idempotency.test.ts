import { readFileSync } from 'fs';
import { join } from 'path';

describe('salary expense idempotency migration', () => {
  const migrationSql = readFileSync(
    join(process.cwd(), 'supabase/migrations/20260607020000_unique_salary_expense_description.sql'),
    'utf8',
  );

  it('blocks duplicate salary expense side effects at the database boundary', () => {
    expect(migrationSql).toContain('Duplicate salary expenses exist by tenant_id and description');
    expect(migrationSql).toContain('idx_expenses_salary_description_unique');
    expect(migrationSql).toContain('group by tenant_id, btrim(description)');
    expect(migrationSql).toContain("lower(category) = 'salary'");
    expect(migrationSql).toContain("coalesce(nullif(btrim(description), ''), '') <> ''");
    expect(migrationSql).toContain('create unique index if not exists idx_expenses_salary_description_unique');
    expect(migrationSql).toContain('on public.expenses (tenant_id, (btrim(description)))');
  });
});
