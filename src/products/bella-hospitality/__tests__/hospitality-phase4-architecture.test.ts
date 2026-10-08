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

describe('Bella Hospitality Phase 4 architecture boundary', () => {
  const sourceFiles = getSourceFiles(PRODUCT_ROOT);

  it('consumes Finance only through public contracts', () => {
    const violations: string[] = [];

    for (const file of sourceFiles) {
      const content = readFileSync(file, 'utf8');
      const relative = path.relative(PRODUCT_ROOT, file);
      const directFinanceImport = /from\s+['"].*(platform\/finance\/(?!contracts))/;
      const directFinanceSql = /(?:FROM|JOIN|INSERT INTO|UPDATE|DELETE FROM)\s+public\.finance_/i;
      if (directFinanceImport.test(content) || directFinanceSql.test(content)) {
        violations.push(relative);
      }
    }

    expect(violations).toEqual([]);
  });

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

  it('does not introduce later Hospitality phase concepts or a resource kernel', () => {
    const combinedSource = sourceFiles
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(combinedSource).not.toMatch(/hospitality_housekeeping/);
    expect(combinedSource).not.toMatch(/hospitality_maintenance/);
    expect(combinedSource).not.toMatch(/hospitality_fnb/);
    expect(combinedSource).not.toMatch(/hospitality_travel/);
    expect(combinedSource).not.toMatch(/hospitality_tours/);
    expect(combinedSource).not.toMatch(/resource_allocation/);
    expect(combinedSource).not.toMatch(/global_resource_kernel/);
    expect(combinedSource).not.toMatch(/hospitality_payments/);
  });
});
