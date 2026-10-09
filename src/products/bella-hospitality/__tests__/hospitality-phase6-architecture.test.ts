import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const PRODUCT_ROOT = path.resolve(__dirname, '..');

function getSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = path.join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      if (entry !== '__tests__') {
        results.push(...getSourceFiles(fullPath));
      }
    } else if (entry.endsWith('.ts') && !entry.endsWith('.d.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Bella Hospitality Phase 6 housekeeping architecture boundary', () => {
  const sourceFiles = getSourceFiles(PRODUCT_ROOT);
  const housekeepingFiles = sourceFiles
    .filter((file) => path.basename(file).includes('housekeeping'));

  it('keeps Housekeeping inside the Hospitality product boundary', () => {
    expect(housekeepingFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of housekeepingFiles) {
      const content = readFileSync(file, 'utf8');
      const relative = path.relative(PRODUCT_ROOT, file);
      const forbiddenImport = /from\s+['"].*(platform\/(beauty|healthcare|education|logistics|finance)|products\/(bella-hospital|bella-education|bella-english-center|nail|beauty-spa-v2))/;
      if (forbiddenImport.test(content)) {
        violations.push(relative);
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not create later Hospitality domains or a resource kernel', () => {
    const combinedSource = housekeepingFiles
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(combinedSource).not.toMatch(/hospitality_maintenance/);
    expect(combinedSource).not.toMatch(/hospitality_fnb/);
    expect(combinedSource).not.toMatch(/hospitality_travel/);
    expect(combinedSource).not.toMatch(/hospitality_tours/);
    expect(combinedSource).not.toMatch(/resource_allocation/);
    expect(combinedSource).not.toMatch(/global_resource_kernel/);
  });
});
