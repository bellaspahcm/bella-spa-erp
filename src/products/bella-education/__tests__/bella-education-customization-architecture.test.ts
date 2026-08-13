/**
 * BELLA EDUCATION — STATIC CUSTOMIZATION & EXTENSION GUARD
 *
 * Verifies the Tenant Customization Laws:
 * - Rule A: Zero Tenant Hardcoding inside business logic.
 * - Rule C: Extension Sandbox Check (no imports of database or internal repositories).
 *
 * @module src/products/bella-education/__tests__/bella-education-customization-architecture.test
 */

import * as fs from 'fs';
import * as path from 'path';

const BELLA_EDUCATION_ROOT = path.resolve(__dirname, '..');
const EDUCATION_PLATFORM_ROOT = path.resolve(__dirname, '../../../platform/education');

function getAllTsFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      if (!filePath.includes('__tests__') && !filePath.includes('node_modules')) {
        results = results.concat(getAllTsFiles(filePath));
      }
    } else if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
      results.push(filePath);
    }
  });
  return results;
}

describe('Bella Education V1 — Static Customization & Extension Guard', () => {
  const productFiles = getAllTsFiles(BELLA_EDUCATION_ROOT);
  const platformFiles = getAllTsFiles(EDUCATION_PLATFORM_ROOT);
  const allSourceFiles = [...productFiles, ...platformFiles];

  it('Rule A: Zero Tenant Hardcoding inside business logic (configs or registries only)', () => {
    const violations: string[] = [];

    allSourceFiles.forEach((file) => {
      // Allow hardcoded tenant IDs only in registries, tests, seed files, or configurations
      const relativePath = path.relative(path.resolve(__dirname, '../../../..'), file);
      if (
        relativePath.includes('__tests__') ||
        relativePath.includes('registry.contract.impl.ts') ||
        relativePath.includes('extension.contract.impl.ts')
      ) {
        return;
      }

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Prohibit checks referencing specific tenant keys
        const tenantKeyPattern = /(tenant-standard|tenant-strict|tenant-corporate)/i;
        if (tenantKeyPattern.test(line)) {
          violations.push(
            `${relativePath}:L${index + 1} - Hardcoded tenant key '${line.match(tenantKeyPattern)?.[0]}' is prohibited in business logic.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Rule C: Extension Sandbox Check (only Approved Contracts allowed)', () => {
    const violations: string[] = [];

    // Find any extension files (e.g. extension.contract.impl.ts)
    allSourceFiles.forEach((file) => {
      const relativePath = path.relative(path.resolve(__dirname, '../../../..'), file);
      if (!relativePath.includes('extension.contract.impl.ts')) return;

      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Prohibit import of database libraries, internal repositories or internal engines in extension files
        const dbOrInternalPattern = /import\s+.*\s+from\s+['"].*((@supabase|supabase-js)|platform\/(education|accounting)\/(engines|repositories|domain))\b/;
        if (dbOrInternalPattern.test(line)) {
          violations.push(
            `${relativePath}:L${index + 1} - Extension imports internal module or database client directly: '${line.trim()}'. Extensions must only consume Approved Contracts.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });
});
