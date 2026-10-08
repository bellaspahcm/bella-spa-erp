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

describe('Bella Hospitality Phase 3 architecture boundary', () => {
  const sourceFiles = getSourceFiles(PRODUCT_ROOT);

  it('does not import other industry kernels or product verticals', () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      const relative = path.relative(PRODUCT_ROOT, file);
      const forbiddenImport = /from\s+['"].*(platform\/(beauty|healthcare|education|logistics)|products\/(bella-hospital|bella-education|bella-english-center|nail|beauty-spa-v2))/;
      if (forbiddenImport.test(content)) {
        violations.push(relative);
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not make Front Office / Stay files depend on later phase concepts', () => {
    const phase3Source = sourceFiles
      .filter((file) => path.basename(file).includes('front-office-stay'))
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(phase3Source).not.toMatch(/hospitality_folios/);
    expect(phase3Source).not.toMatch(/hospitality_folio_items/);
    expect(phase3Source).not.toMatch(/hospitality_payments/);
    expect(phase3Source).not.toMatch(/hospitality_housekeeping/);
    expect(phase3Source).not.toMatch(/hospitality_maintenance/);
    expect(phase3Source).not.toMatch(/hospitality_fnb/);
    expect(phase3Source).not.toMatch(/hospitality_travel/);
    expect(phase3Source).not.toMatch(/resource_allocation/);
    expect(phase3Source).not.toMatch(/global_resource_kernel/);
  });
});
