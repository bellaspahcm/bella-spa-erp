/**
 * BELLA HOSPITAL - ADMISSION CONTRACT TRACE
 *
 * Trace-only guard for Admission Foundation dependency. This suite proves that
 * the reusable Healthcare Admission public contract exists and that Hospital
 * Product code is not wired to Admission internals or direct persistence.
 */

import * as fs from 'fs';
import * as path from 'path';

const HOSPITAL_ROOT = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(HOSPITAL_ROOT, '..', '..');
const HEALTHCARE_CONTRACTS_ROOT = path.resolve(REPO_ROOT, 'platform', 'healthcare', 'contracts');
const ADMISSION_PUBLIC_CONTRACT = path.join(HEALTHCARE_CONTRACTS_ROOT, 'admission-engine.contract.ts');
const ADMISSION_ENGINE_CONTRACT = path.resolve(
  REPO_ROOT,
  'platform',
  'healthcare',
  'engines',
  'admission-engine',
  'contracts',
  'admission-engine.contract.ts'
);
const HOSPITAL_ADMISSION_SERVICE = path.join(HOSPITAL_ROOT, 'services', 'hospital-admission.service.ts');

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

describe('Bella Hospital Admission Contract Trace', () => {
  const implementationFiles = getImplementationFiles(HOSPITAL_ROOT);

  it('exposes the existing Admission Engine contract through the public Healthcare contracts boundary', () => {
    const publicContract = fs.readFileSync(ADMISSION_PUBLIC_CONTRACT, 'utf-8');
    const contractsIndex = fs.readFileSync(path.join(HEALTHCARE_CONTRACTS_ROOT, 'index.ts'), 'utf-8');

    expect(publicContract).toContain('Admission Engine Public Contract Re-Export');
    expect(publicContract).toContain('AdmissionEngineContract');
    expect(publicContract).toContain('CreateAdmissionRequest');
    expect(publicContract).toContain('DischargeAdmissionRequest');
    expect(publicContract).toContain('../engines/admission-engine/contracts/admission-engine.contract');
    expect(contractsIndex).toContain("export * from './admission-engine.contract'");
  });

  it('traces reusable Admission capability to the canonical Healthcare engine contract', () => {
    const engineContract = fs.readFileSync(ADMISSION_ENGINE_CONTRACT, 'utf-8');

    expect(engineContract).toContain('export interface AdmissionEngineContract');
    expect(engineContract).toContain('createAdmission(request: CreateAdmissionRequest)');
    expect(engineContract).toContain('dischargeAdmission(request: DischargeAdmissionRequest)');
    expect(engineContract).toContain('getAdmissionById(tenantId: string, admissionId: string)');
    expect(engineContract).toContain('getAdmissionByEncounterId(tenantId: string, encounterId: string)');
  });

  it('keeps Hospital Admission Product service on the public contract path', () => {
    const source = fs.readFileSync(HOSPITAL_ADMISSION_SERVICE, 'utf-8');

    expect(source).toContain('../../../platform/healthcare/contracts/admission-engine.contract');
    expect(source).toContain('AdmissionEngineContract');
    expect(source).toContain('createAdmission');
    expect(source).toContain('dischargeAdmission');
    expect(source).not.toContain('platform/healthcare/engines/admission-engine');
    expect(source).not.toContain('healthcare-hospital-services');
  });

  it('does not introduce direct Admission persistence access in Hospital Product implementation', () => {
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = stripComments(fs.readFileSync(file, 'utf-8'));
      const lines = source.split('\n');

      lines.forEach((line, index) => {
        const directAdmissionPersistence =
          /\.from\s*\(\s*['"`](?:hc_inpatient_admissions|inpatient_admissions)['"`]\s*\)/.test(line) ||
          /\.rpc\s*\(\s*['"`]\s*.*admission.*['"`]\s*\)/.test(line);

        const importsAdmissionInternal =
          /from\s+['"].*platform\/healthcare\/engines\/admission-engine\/(?!contracts\/)/.test(line);

        const importsLegacyHospitalService =
          /from\s+['"].*healthcare-hospital-services['"]/.test(line) ||
          /from\s+['"]@\/services\/healthcare-hospital-services['"]/.test(line);

        if (directAdmissionPersistence || importsAdmissionInternal || importsLegacyHospitalService) {
          violations.push(`${relative(file)}:L${index + 1} Admission contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
