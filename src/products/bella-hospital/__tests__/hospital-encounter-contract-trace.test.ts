/**
 * BELLA HOSPITAL - ENCOUNTER CONTRACT TRACE
 *
 * Trace-only guard for Encounter Foundation dependency. This suite proves that
 * Encounter is a real Hospital boundary dependency and that Healthcare already
 * exposes a public Encounter contract for reuse.
 */

import * as fs from 'fs';
import * as path from 'path';
import { ENCOUNTER_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/encounter-engine.contract';

const HOSPITAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(HOSPITAL_ROOT, '..', '..');
const HEALTHCARE_CONTRACTS_ROOT = path.resolve(REPO_ROOT, 'platform', 'healthcare', 'contracts');
const ENCOUNTER_PUBLIC_CONTRACT = path.join(HEALTHCARE_CONTRACTS_ROOT, 'encounter-engine.contract.ts');
const ENCOUNTER_ENGINE_INTERFACE = path.resolve(
  REPO_ROOT,
  'platform',
  'healthcare',
  'engines',
  'encounter-engine',
  'encounter-engine.interface.ts'
);

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

describe('Bella Hospital Encounter Contract Trace', () => {
  const implementationFiles = getImplementationFiles(HOSPITAL_ROOT);

  it('traces real Hospital Foundation dependency on Encounter identifiers', () => {
    const filesWithEncounterDependency = implementationFiles
      .map((file) => ({ file, source: fs.readFileSync(file, 'utf-8') }))
      .filter(({ source }) => /\bencounterId\b/.test(stripComments(source)))
      .map(({ file }) => relative(file));

    expect(filesWithEncounterDependency).toEqual(expect.arrayContaining([
      'products/bella-hospital/services/hospital-admission.service.ts',
      'products/bella-hospital/services/hospital-clinical-alert.service.ts',
      'products/bella-hospital/hooks/use-nursing-engine.ts',
      'products/bella-hospital/hooks/use-pharmacy-engine.ts',
    ]));
  });

  it('exposes Encounter through the public Healthcare contracts boundary', () => {
    const publicContract = fs.readFileSync(ENCOUNTER_PUBLIC_CONTRACT, 'utf-8');
    const contractsIndex = fs.readFileSync(path.join(HEALTHCARE_CONTRACTS_ROOT, 'index.ts'), 'utf-8');

    expect(publicContract).toContain('export const ENCOUNTER_ENGINE_CONTRACT');
    expect(publicContract).toContain('IEncounterEngine');
    expect(publicContract).toContain('CreateEncounterRequest');
    expect(publicContract).toContain('EncounterDTO');
    expect(contractsIndex).toContain("export * from './encounter-engine.contract'");
  });

  it('exposes minimum Encounter operations needed by Hospital Foundation boundaries', () => {
    const operationIds = ENCOUNTER_ENGINE_CONTRACT.endpoints?.map((endpoint) => endpoint.operationId);

    expect(operationIds).toEqual(expect.arrayContaining([
      'createEncounter',
      'updateEncounterStatus',
      'assignProvider',
      'transferEncounter',
      'searchEncounters',
    ]));
  });

  it('traces reusable Encounter capability to the canonical Healthcare engine interface', () => {
    const engineInterface = fs.readFileSync(ENCOUNTER_ENGINE_INTERFACE, 'utf-8');

    expect(engineInterface).toContain('export interface IEncounterEngine');
    expect(engineInterface).toContain('createEncounter');
    expect(engineInterface).toContain('updateStatus');
    expect(engineInterface).toContain('assignProvider');
    expect(engineInterface).toContain('transferEncounter');
    expect(engineInterface).toContain('searchEncounters');
  });

  it('does not introduce direct Encounter persistence or internal Encounter engine access in Hospital Product implementation', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        const directEncounterPersistence =
          /\.from\s*\(\s*['"`](?:hc_encounters|encounters|hospital_encounters)['"`]\s*\)/.test(line) ||
          /\.rpc\s*\(\s*['"`]\s*.*encounter.*['"`]\s*\)/.test(line);

        const importsEncounterInternal =
          /from\s+['"].*platform\/healthcare\/engines\/encounter-engine\/(?!encounter-engine\.interface)/.test(line);

        const importsLegacyHealthcareService =
          /from\s+['"]@\/services\/healthcare(?:\/|['"])/.test(line) ||
          /from\s+['"]@\/services\/healthcare-hospital-services['"]/.test(line);

        if (directEncounterPersistence || importsEncounterInternal || importsLegacyHealthcareService) {
          violations.push(`${relative(file)}:L${index + 1} Encounter contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
