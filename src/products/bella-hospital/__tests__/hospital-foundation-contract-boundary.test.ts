/**
 * BELLA HOSPITAL - FOUNDATION CONTRACT BOUNDARY TESTS
 *
 * Guards the next Hospital Foundation implementation slice. This suite scans
 * Hospital Product implementation files only; legacy dashboard/services remain
 * audit targets and are intentionally not refactored by this test.
 */

import * as fs from 'fs';
import * as path from 'path';
import { BED_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/bed-engine.contract';
import { ENCOUNTER_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/encounter-engine.contract';

const HOSPITAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(HOSPITAL_ROOT, '..', '..');

function getImplementationFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      if (entry !== '__tests__' && entry !== 'node_modules') {
        results = results.concat(getImplementationFiles(filePath));
      }
      continue;
    }

    if ((entry.endsWith('.ts') || entry.endsWith('.tsx')) && !entry.endsWith('.d.ts')) {
      results.push(filePath);
    }
  }

  return results;
}

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

function relative(file: string): string {
  return path.relative(REPO_ROOT, file).replace(/\\/g, '/');
}

describe('Bella Hospital Foundation Contract Boundary', () => {
  const implementationFiles = getImplementationFiles(HOSPITAL_ROOT);

  it('scans only Hospital Product implementation files', () => {
    expect(implementationFiles.length).toBeGreaterThan(0);
    expect(implementationFiles.every((file) => relative(file).startsWith('products/bella-hospital/'))).toBe(true);
    expect(implementationFiles.some((file) => relative(file).includes('/__tests__/'))).toBe(false);
  });

  it('does not introduce direct hc_* database access in Hospital Product implementation', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        if (/\.from\s*\(\s*['"`]hc_/.test(line)) {
          violations.push(`${relative(file)}:L${index + 1} direct hc_* table access`);
        }
        if (/\.rpc\s*\(\s*['"`]\s*hc_/.test(line)) {
          violations.push(`${relative(file)}:L${index + 1} direct hc_* rpc access`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('does not depend on legacy healthcare service paths from Hospital Product implementation', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        const importsLegacyHealthcareService =
          /from\s+['"]@\/services\/healthcare(?:\/|['"])/.test(line) ||
          /from\s+['"]@\/services\/healthcare-hospital-services['"]/.test(line) ||
          /from\s+['"].*src\/services\/healthcare/.test(line) ||
          /from\s+['"].*healthcare-hospital-services['"]/.test(line);

        if (importsLegacyHealthcareService) {
          violations.push(`${relative(file)}:L${index + 1} legacy healthcare service dependency`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('does not import Healthcare Kernel internals from Hospital Product implementation', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        const importsInternalKernel =
          /from\s+['"].*(?:@\/|src\/)?platform\/healthcare\/(?:engines|infrastructure|repositories)\//.test(line) &&
          !/contracts\//.test(line);

        if (importsInternalKernel) {
          violations.push(`${relative(file)}:L${index + 1} internal Healthcare Kernel import`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('keeps Admission and Bed Foundation flows on public Healthcare contracts', () => {
    const admissionService = fs.readFileSync(
      path.join(HOSPITAL_ROOT, 'services', 'hospital-admission.service.ts'),
      'utf-8'
    );

    expect(admissionService).toContain('platform/healthcare/contracts/admission-engine.contract');
    expect(admissionService).toContain('AdmissionEngineContract');
    expect(admissionService).toContain('createAdmission');
    expect(admissionService).toContain('dischargeAdmission');
    expect(admissionService).toContain('platform/healthcare/contracts/bed-engine.contract');
    expect(admissionService).toContain('BedEngineContract');
    expect(admissionService).toContain('transferBed');
  });

  it('uses public contract metadata for Bed and Encounter/provider Foundation actions', () => {
    const bedOperations = BED_ENGINE_CONTRACT.endpoints.map((endpoint) => endpoint.operationId);
    expect(bedOperations).toEqual(expect.arrayContaining([
      'allocateBed',
      'releaseBed',
      'transferBed',
      'queryBeds',
    ]));

    const encounterOperations = ENCOUNTER_ENGINE_CONTRACT.endpoints.map((endpoint) => endpoint.operationId);
    expect(encounterOperations).toEqual(expect.arrayContaining([
      'createEncounter',
      'assignProvider',
      'transferEncounter',
      'searchEncounters',
    ]));
  });
});
