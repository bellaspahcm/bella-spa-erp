/**
 * BELLA LAND — STATIC ARCHITECTURE GUARD
 *
 * Enforces strict Real Estate OS Architectural Laws:
 * - Law 2: Product Bounded Scoping (no cross-vertical imports)
 * - Law 3: Contract-Only Access (no direct database queries to real_estate_*, re_*, journal_* or accounting_*)
 * - Kernel Decoupling: Zero imports of internal engine files outside platform/real-estate/contracts.
 *
 * @module src/products/bella-land/__tests__/bella-land-architecture.test
 */

import * as fs from 'fs';
import * as path from 'path';
import { bellaLandManifest } from '../manifest';

const BELLA_LAND_ROOT = path.resolve(__dirname, '..');

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

describe('Bella Land V2 — Static Architecture Guard', () => {
  const sourceFiles = getAllTsFiles(BELLA_LAND_ROOT);

  it('Law 3: Zero Direct Kernel Database Access (real_estate_*, re_*, journal_*, accounting_*)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Check for direct table query access to real_estate_*, re_*, journal_*, accounting_*
        const tablePattern = /\.from\s*\(\s*['"`](real_estate_|re_|journal_|accounting_)/;
        if (tablePattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_LAND_ROOT, file)}:L${index + 1} - Direct database query targeting '${line.match(tablePattern)?.[0]}' is prohibited in the Product layer.`
          );
        }

        // Check for direct RPC database client calls
        const rpcPattern = /\.rpc\s*\(\s*['"`]/;
        if (rpcPattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_LAND_ROOT, file)}:L${index + 1} - Direct RPC database execution is prohibited in the Product layer.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Law 3: Zero Internal Kernel Imports (only contracts allowed)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Prohibit direct imports from internal engines/repositories for real-estate or accounting
        const internalKernelPattern = /import\s+.*\s+from\s+['"].*(platform\/(real-estate|accounting)\/(engines|repositories|domain))\b/;
        if (internalKernelPattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_LAND_ROOT, file)}:L${index + 1} - Direct import of internal Kernel modules is prohibited. Use Public Contracts instead.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Law 2: Zero Cross-Vertical Leakage (no imports of other product verticals)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Prohibit cross-vertical imports to healthcare products
        const crossVerticalPattern = /import\s+.*\s+from\s+['"].*products\/(bella-medical|bella-dental)\b/;
        if (crossVerticalPattern.test(line)) {
          violations.push(
            `${path.relative(BELLA_LAND_ROOT, file)}:L${index + 1} - Cross-vertical import of other product layers is prohibited.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Manifest Compliance: Manifest.ts capability list is present', () => {
    expect(bellaLandManifest.id).toBe('bella-land');
    expect(bellaLandManifest.capabilities).toContain('property_inventory_query');
    expect(bellaLandManifest.capabilities).toContain('sales_reservation_command');
    expect(bellaLandManifest.capabilities).toContain('sales_contract_command');
    expect(bellaLandManifest.capabilities).toContain('commission_policy_command');
  });
});
