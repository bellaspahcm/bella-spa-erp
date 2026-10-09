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

describe('Bella Hospitality Phase 2 architecture boundary', () => {
  const sourceFiles = getSourceFiles(PRODUCT_ROOT)
    .filter((file) => path.basename(file).startsWith('guest-reservation'));

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

  it('does not introduce later Hospitality phase concepts in source', () => {
    const combinedSource = sourceFiles
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(combinedSource).not.toMatch(/hospitality_stays/);
    expect(combinedSource).not.toMatch(/hospitality_folios/);
    expect(combinedSource).not.toMatch(/hospitality_payments/);
    expect(combinedSource).not.toMatch(/hospitality_housekeeping/);
    expect(combinedSource).not.toMatch(/hospitality_travel/);
    expect(combinedSource).not.toMatch(/resource_allocation/);
    expect(combinedSource).not.toMatch(/global_resource_kernel/);
  });
});
