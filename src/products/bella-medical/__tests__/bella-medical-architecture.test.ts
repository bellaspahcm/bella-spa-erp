/**
/**
 * BELLA MEDICAL CLINIC — STATIC ARCHITECTURE GUARD
 * 
 * Enforces strict Healthcare OS H12 Architectural Laws:
 * - Law 2: Product Bounded Scoping (no cross-vertical imports)
 * - Law 3: Contract-Only Access (no direct hc_* database queries or internal engine imports)
 * - Manifest Source of Truth: All registered capabilities must match the manifest.
 * 
 * @module products/bella-medical/tests/bella-medical-architecture.test
 */

import * as fs from 'fs';
import * as path from 'path';
import { medicalProductManifest } from '../manifest';

const MEDICAL_ROOT = path.resolve(__dirname, '..');
const KERNEL_ROOT_NAME = 'platform/healthcare';

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

describe('Bella Medical Clinic V2 — Static Architecture Guard', () => {
  const sourceFiles = getAllTsFiles(MEDICAL_ROOT);

  it('Law 3: Zero Direct Kernel Database Access (hc_*)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Check for direct table query access to hc_*
        const tablePattern = /\.from\s*\(\s*['"`]hc_/;
        if (tablePattern.test(line)) {
          violations.push(
            `${path.relative(MEDICAL_ROOT, file)}:L${index + 1} - Direct database query targeting 'hc_*' table is prohibited.`
          );
        }

        // Check for direct RPC database client calls to internal functions
        const rpcPattern = /\.rpc\s*\(\s*['"`]/;
        if (rpcPattern.test(line)) {
          violations.push(
            `${path.relative(MEDICAL_ROOT, file)}:L${index + 1} - Direct RPC database execution is prohibited.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Law 3: Zero Internal Kernel Imports (only contracts & shared-kernel allowed)', () => {
    const violations: string[] = [];

    sourceFiles.forEach((file) => {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, index) => {
        if (line.trim().startsWith('//') || line.trim().startsWith('*')) return;

        // Check if import goes to platform/healthcare/engines/ or platform/healthcare/infrastructure/
        // allowing only contracts or shared-kernel
        const internalKernelPattern = /import\s+.*\s+from\s+['"].*(platform\/healthcare\/(engines|infrastructure|repositories))\b/;
        if (internalKernelPattern.test(line)) {
          violations.push(
            `${path.relative(MEDICAL_ROOT, file)}:L${index + 1} - Direct import of internal Kernel modules is prohibited. Use Public Contracts instead.`
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

        // Check if importing from bella-hospital or bella-dental
        const crossVerticalPattern = /import\s+.*\s+from\s+['"].*products\/(bella-hospital|bella-dental)\b/;
        if (crossVerticalPattern.test(line)) {
          violations.push(
            `${path.relative(MEDICAL_ROOT, file)}:L${index + 1} - Cross-vertical import of other product layers is prohibited.`
          );
        }
      });
    });

    expect(violations).toEqual([]);
  });

  it('Manifest Compliance: Registered capabilities must match manifest.ts', () => {
    const registryFilePath = path.join(MEDICAL_ROOT, 'index.ts');
    expect(fs.existsSync(registryFilePath)).toBe(true);

    const content = fs.readFileSync(registryFilePath, 'utf-8');
    const registeredCapabilityIds: string[] = [];

    // Parse registered capability class instantiations
    const queryMatches = content.match(/new\s+(\w+QueryCapability)\b/g);
    const commandMatches = content.match(/new\s+(\w+CommandCapability)\b/g);

    // Statically check classes defined on disk for capability ids
    const capabilitiesDir = path.join(MEDICAL_ROOT, 'capabilities');
    if (fs.existsSync(capabilitiesDir)) {
      const capFiles = fs.readdirSync(capabilitiesDir).filter(f => f.endsWith('.ts'));
      capFiles.forEach(file => {
        const fileContent = fs.readFileSync(path.join(capabilitiesDir, file), 'utf-8');
        const idMatch = fileContent.match(/readonly\s+id\s*=\s*['"]([^'"]+)['"]/);
        if (idMatch && idMatch[1]) {
          registeredCapabilityIds.push(idMatch[1]);
        }
      });
    }

    const manifestCapabilities = medicalProductManifest.capabilities || [];
    
    // Assert all registered capability IDs exist in the manifest
    registeredCapabilityIds.forEach(id => {
      expect(manifestCapabilities).toContain(id);
    });
  });
});
