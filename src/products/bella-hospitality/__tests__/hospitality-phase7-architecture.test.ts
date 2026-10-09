import { describe, expect, it } from '@jest/globals';
import { readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';

const PRODUCT_ROOT = path.resolve(__dirname, '..');
const GATE_PATH = path.resolve(
  __dirname,
  '../../../../docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITALITY_PHASE7_MAINTENANCE_2026_10_09.md'
);

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

describe('Bella Hospitality Phase 7 maintenance architecture boundary', () => {
  const sourceFiles = getSourceFiles(PRODUCT_ROOT);
  const maintenanceFiles = sourceFiles
    .filter((file) => path.basename(file).includes('maintenance'));

  it('has a Phase 7 gate before runtime implementation', () => {
    const gate = readFileSync(GATE_PATH, 'utf8');

    expect(gate).toContain('GATE = PASS');
    expect(gate).toContain('PHASE = 7_MAINTENANCE');
    expect(gate).toContain('RESOURCE_KERNEL_AUTHORIZED = NO');
    expect(gate).toContain('FNB_AUTHORIZED = NO');
    expect(gate).toContain('TRAVEL_AUTHORIZED = NO');
  });

  it('keeps Maintenance inside the Hospitality product boundary', () => {
    expect(maintenanceFiles.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const file of maintenanceFiles) {
      const content = readFileSync(file, 'utf8');
      const relative = path.relative(PRODUCT_ROOT, file);
      const forbiddenImport = /from\s+['"].*(platform\/(beauty|healthcare|education|logistics|finance)|products\/(bella-hospital|bella-education|bella-english-center|nail|beauty-spa-v2))/;
      if (forbiddenImport.test(content)) {
        violations.push(relative);
      }
    }

    expect(violations).toEqual([]);
  });

  it('does not create F&B, Travel, allocation, or resource kernel source', () => {
    const combinedSource = maintenanceFiles
      .map((file) => readFileSync(file, 'utf8'))
      .join('\n');

    expect(combinedSource).not.toMatch(/hospitality_fnb/);
    expect(combinedSource).not.toMatch(/hospitality_travel/);
    expect(combinedSource).not.toMatch(/hospitality_tours/);
    expect(combinedSource).not.toMatch(/resource_allocation/);
    expect(combinedSource).not.toMatch(/global_resource_kernel/);
  });
});
