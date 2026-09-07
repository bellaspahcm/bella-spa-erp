/**
 * TG-1 Gate Test Suite
 * 
 * Tests schema-type synchronization enforcement.
 * 
 * T1: PASS when types aligned
 * T2: BLOCK when types stale
 * T3: PASS after regeneration
 * T4: PASS despite timestamp change (false positive resistance)
 */

import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { runTG1Gate, normalizeTypeContent } from '../tg1-schema-type-sync';

describe('TG-1 Schema-Type Sync Gate', () => {
  const typesPath = path.join(process.cwd(), 'src/types/database.types.ts');
  let originalTypes: string;
  let backupPath: string;

  beforeAll(() => {
    // Backup current types
    backupPath = `${typesPath}.tg1-test-backup`;
    if (fs.existsSync(typesPath)) {
      originalTypes = fs.readFileSync(typesPath, 'utf-8');
      fs.copyFileSync(typesPath, backupPath);
    }
  });

  afterAll(() => {
    // Restore original types
    if (fs.existsSync(backupPath)) {
      fs.copyFileSync(backupPath, typesPath);
      fs.unlinkSync(backupPath);
    }
  });

  test('T1: PASS when types aligned with schema', async () => {
    // Ensure types are current
    execSync('npx supabase gen types typescript --linked 2>/dev/null > src/types/database.types.ts', {
      stdio: 'ignore'
    });

    const result = await runTG1Gate();

    expect(result.pass).toBe(true);
    expect(result.message).toContain('PASS');
    expect(result.message).toContain('synchronized');
  }, 120000); // 2 min timeout for type generation

  test('T2: BLOCK when types stale (simulated drift)', async () => {
    // Simulate stale types by modifying committed file
    const currentTypes = fs.readFileSync(typesPath, 'utf-8');
    
    // Add a comment to simulate drift (semantic change)
    const modifiedTypes = `// SIMULATED DRIFT: This comment represents schema change\n${currentTypes}`;
    fs.writeFileSync(typesPath, modifiedTypes, 'utf-8');

    const result = await runTG1Gate();

    // Restore types for other tests
    fs.writeFileSync(typesPath, currentTypes, 'utf-8');

    expect(result.pass).toBe(false);
    expect(result.message).toContain('BLOCK');
    expect(result.message).toContain('do not match');
    expect(result.diff).toBeDefined();
  }, 120000);

  test('T3: PASS after regeneration (recovery)', async () => {
    // This test is similar to T1 but validates recovery scenario
    // Regenerate types fresh
    execSync('npx supabase gen types typescript --linked 2>/dev/null > src/types/database.types.ts', {
      stdio: 'ignore'
    });

    const result = await runTG1Gate();

    expect(result.pass).toBe(true);
    expect(result.message).toContain('PASS');
  }, 120000);

  test('T4: PASS despite timestamp change (false positive resistance)', async () => {
    // Ensure types aligned first
    execSync('npx supabase gen types typescript --linked 2>/dev/null > src/types/database.types.ts', {
      stdio: 'ignore'
    });

    // Run gate first time
    const result1 = await runTG1Gate();
    expect(result1.pass).toBe(true);

    // Touch file (change timestamp only, not content)
    const currentTypes = fs.readFileSync(typesPath, 'utf-8');
    fs.writeFileSync(typesPath, currentTypes, 'utf-8'); // Rewrite same content

    // Run gate again - should still pass
    const result2 = await runTG1Gate();

    expect(result2.pass).toBe(true);
    expect(result2.message).toContain('PASS');
    // Proves gate is content-based, not timestamp-based
  }, 120000);

  test('normalizeTypeContent strips line endings and whitespace consistently', () => {
    const contentWithCRLF = 'export type Test = {\r\n  id: string;  \r\n}\r\n';
    const contentWithLF = 'export type Test = {\n  id: string;\n}\n';

    const normalized1 = normalizeTypeContent(contentWithCRLF);
    const normalized2 = normalizeTypeContent(contentWithLF);

    expect(normalized1).toBe(normalized2);
  });

  test('normalizeTypeContent preserves semantic content', () => {
    const content = `
export type Database = {
  public: {
    Tables: {
      users: {
        Row: { id: string; name: string; }
      }
    }
  }
}
`;

    const normalized = normalizeTypeContent(content);

    expect(normalized).toContain('export type Database');
    expect(normalized).toContain('users');
    expect(normalized).toContain('id: string');
    expect(normalized).toContain('name: string');
  });
});
