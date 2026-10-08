import { describe, expect, it } from '@jest/globals';
import { readFileSync } from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20261009020000_fix_hospitality_housekeeping_scope_triggers.sql'
);

describe('Bella Hospitality Phase 6 housekeeping trigger split migration', () => {
  const migrationSql = readFileSync(migrationPath, 'utf8');

  it('uses separate validation functions for room status rows and housekeeping task rows', () => {
    expect(migrationSql).toContain('hospitality_validate_room_housekeeping_status_scope');
    expect(migrationSql).toContain('hospitality_validate_housekeeping_task_scope');
    expect(migrationSql).toContain('EXECUTE FUNCTION public.hospitality_validate_room_housekeeping_status_scope()');
    expect(migrationSql).toContain('EXECUTE FUNCTION public.hospitality_validate_housekeeping_task_scope()');
  });

  it('keeps task-only stay validation out of the room status trigger function', () => {
    const statusFunction = extractFunctionBody(
      migrationSql,
      'hospitality_validate_room_housekeeping_status_scope'
    );
    const taskFunction = extractFunctionBody(
      migrationSql,
      'hospitality_validate_housekeeping_task_scope'
    );

    expect(statusFunction).not.toContain('NEW.stay_id');
    expect(taskFunction).toContain('NEW.stay_id');
  });
});

function extractFunctionBody(sql: string, functionName: string): string {
  const pattern = new RegExp(
    `CREATE OR REPLACE FUNCTION public\\.${functionName}\\(\\)[\\s\\S]*?\\$\\$ LANGUAGE plpgsql;`,
    'm'
  );
  const match = sql.match(pattern);
  if (!match) {
    throw new Error(`Function ${functionName} not found`);
  }
  return match[0];
}
