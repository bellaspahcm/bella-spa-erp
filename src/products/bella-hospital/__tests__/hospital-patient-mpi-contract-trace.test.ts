/**
 * BELLA HOSPITAL - PATIENT/MPI CONTRACT TRACE BOUNDARY
 *
 * Locks the Patient/MPI boundary before Hospital runtime code is added.
 * Legacy healthcare paths are intentionally not migrated by this suite.
 */

import * as fs from 'fs';
import * as path from 'path';
import {
  HEALTHCARE_ENGINE_CONTRACTS,
  PATIENT_MPI_CONTRACT,
} from '../../../platform/healthcare/contracts';

const HOSPITAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(HOSPITAL_ROOT, '..', '..');
const HEALTHCARE_CONTRACTS_ROOT = path.resolve(REPO_ROOT, 'platform', 'healthcare', 'contracts');
const HEALTHCARE_PARTY_ENGINE = path.resolve(
  REPO_ROOT,
  'modules',
  'bella-healthcare',
  'kernel',
  'party-engine.ts'
);
const HEALTHCARE_TYPES = path.resolve(REPO_ROOT, 'types', 'healthcare.ts');

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

function getFiles(dir: string): string[] {
  let results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir)) {
    const filePath = path.join(dir, entry);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      results = results.concat(getFiles(filePath));
      continue;
    }

    results.push(filePath);
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

describe('Bella Hospital Patient/MPI Contract Trace Boundary', () => {
  const implementationFiles = getImplementationFiles(HOSPITAL_ROOT);

  it('records existing reusable Patient/MPI identity surfaces as partial reuse only', () => {
    const healthcarePartySource = fs.readFileSync(HEALTHCARE_PARTY_ENGINE, 'utf-8');
    const healthcareTypesSource = fs.readFileSync(HEALTHCARE_TYPES, 'utf-8');

    expect(healthcarePartySource).toContain('export class HealthcarePartyEngine');
    expect(healthcarePartySource).toContain('registerPatient');
    expect(healthcarePartySource).toContain('findPatientByBhyt');
    expect(healthcarePartySource).toContain('findPatientByNationalId');
    expect(healthcareTypesSource).toContain('export interface PatientProfile');
    expect(healthcareTypesSource).toContain('export interface MasterPatientIndex');
  });

  it('exposes a minimal public Healthcare Patient/MPI contract for Product consumption', () => {
    const contractFiles = getFiles(HEALTHCARE_CONTRACTS_ROOT)
      .filter((file) => file.endsWith('.ts'))
      .map((file) => relative(file));

    const patientMpiContractFiles = contractFiles.filter((file) =>
      /(?:patient|mpi|person|party).*contract\.ts$/i.test(file)
    );

    expect(patientMpiContractFiles).toEqual([
      'platform/healthcare/contracts/patient-mpi.contract.ts',
    ]);

    const contractIndex = fs.readFileSync(path.join(HEALTHCARE_CONTRACTS_ROOT, 'index.ts'), 'utf-8');
    expect(contractIndex).toContain("export * from './patient-mpi.contract'");

    expect(PATIENT_MPI_CONTRACT.name).toBe('patient-mpi');
    expect(PATIENT_MPI_CONTRACT.status).toBe('active');
    expect(HEALTHCARE_ENGINE_CONTRACTS.map((contract) => contract.name)).toContain('patient-mpi');
    expect(PATIENT_MPI_CONTRACT.endpoints?.map((endpoint) => endpoint.operationId)).toEqual(expect.arrayContaining([
      'registerPatient',
      'getPatientById',
      'findPatientByIdentifier',
      'searchPatients',
    ]));
  });

  it('does not introduce direct Patient/MPI persistence access in Hospital Product implementation', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        const directPatientTableAccess =
          /\.from\s*\(\s*['"`](?:hc_master_patient_index|patient_profiles)['"`]\s*\)/.test(line) ||
          /\.rpc\s*\(\s*['"`]\s*(?:hc_.*patient|.*patient.*)['"`]\s*\)/.test(line);

        if (directPatientTableAccess) {
          violations.push(`${relative(file)}:L${index + 1} direct Patient/MPI persistence access`);
        }
      });
    }

    expect(violations).toEqual([]);
  });

  it('does not substitute legacy/internal identity paths for a Healthcare Patient/MPI public contract', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        const importsBypassPath =
          /from\s+['"]@\/services\/healthcare(?:\/|['"])/.test(line) ||
          /from\s+['"].*modules\/bella-healthcare\/kernel\/party-engine/.test(line) ||
          /from\s+['"]@\/modules\/bella-healthcare\/kernel\/party-engine/.test(line) ||
          /from\s+['"]@\/platform\/host\/person(?:\/|['"])/.test(line) ||
          /from\s+['"].*platform\/host\/person/.test(line) ||
          /from\s+['"]@\/platform\/party(?:\/|['"])/.test(line) ||
          /from\s+['"].*platform\/party/.test(line) ||
          /from\s+['"]@\/types\/healthcare['"]/.test(line);

        if (importsBypassPath) {
          violations.push(`${relative(file)}:L${index + 1} Patient/MPI contract bypass path`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
