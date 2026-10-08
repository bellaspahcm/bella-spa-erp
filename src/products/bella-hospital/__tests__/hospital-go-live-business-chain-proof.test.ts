/**
 * BELLA HOSPITAL - GO-LIVE BUSINESS CHAIN PROOF
 *
 * Aggregates the sealed Hospital capability evidence into one code/runtime-scope
 * business-chain guard. This is not Real DB/RLS, Browser E2E, CI, or production
 * proof.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();
const productIndexPath = path.join(repoRoot, 'src/products/bella-hospital/index.ts');
const productRoot = path.join(repoRoot, 'src/products/bella-hospital');

const requiredArtifacts = [
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_PATIENT_MPI_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_ENCOUNTER_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_BED_TRANSFER_CONTRACT_TRACE_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_CLINICAL_ORDERS_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_CDS_GATE_RUNTIME_WIRING_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_MEDICATION_PHARMACY_MAR_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_LABORATORY_WORKFLOW_RESULT_MINIMAL_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_IMAGING_MINIMAL_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_NURSING_CONTRACT_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_DISCHARGE_BED_RELEASE_TEMPORAL_RUNTIME_2026_10_07.md',
  'docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_BILLING_FINANCE_MINIMAL_RUNTIME_2026_10_07.md',
];

const requiredTests = [
  'src/products/bella-hospital/services/__tests__/hospital-patient-mpi.service.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-encounter.service.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-clinical-orders.service.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-medication-pharmacy-mar.service.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-laboratory-workflow-result-minimal-runtime.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-imaging-minimal-runtime.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-nursing-minimal-runtime.test.ts',
  'src/products/bella-hospital/services/__tests__/hospital-billing-finance-minimal-runtime.test.ts',
  'src/products/bella-hospital/__tests__/hospital-discharge-contract-trace.test.ts',
  'src/products/bella-hospital/__tests__/hospital-finance-downstream-ledger-proof.test.ts',
];

function read(relativePath: string): string {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function exists(relativePath: string): boolean {
  return fs.existsSync(path.join(repoRoot, relativePath));
}

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function relative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

describe('Bella Hospital Go-Live business chain proof', () => {
  it('has sealed evidence artifacts for each required business-chain node', () => {
    for (const artifactPath of requiredArtifacts) {
      expect(exists(artifactPath)).toBe(true);
    }

    expect(read('docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_BILLING_FINANCE_MINIMAL_RUNTIME_2026_10_07.md'))
      .toContain('HOSPITAL_BILLING_FINANCE_MINIMAL_RUNTIME = PASS_FOR_FINANCE_OUTBOX_SCOPE');
    expect(read('docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_DISCHARGE_BED_RELEASE_TEMPORAL_RUNTIME_2026_10_07.md'))
      .toContain('DISCHARGE_H9_TEMPORAL_RUNTIME = PROVEN');
    expect(read('docs/architecture/ARCHITECTURE_GATE_RESULT_HOSPITAL_NURSING_CONTRACT_RUNTIME_2026_10_07.md'))
      .toContain('NURSING_VITAL_SIGNS_RUNTIME = PROVEN_FOR_SUPPORTED_GO_LIVE_SCOPE');
  });

  it('has focused tests for each required runtime or downstream proof node', () => {
    for (const testPath of requiredTests) {
      expect(exists(testPath)).toBe(true);
    }
  });

  it('exports the product services that form the current Hospital business chain', () => {
    const productIndex = fs.readFileSync(productIndexPath, 'utf8');

    expect(productIndex).toContain("export * from './services/hospital-patient-mpi.service'");
    expect(productIndex).toContain("export * from './services/hospital-admission.service'");
    expect(productIndex).toContain("export * from './services/hospital-encounter.service'");
    expect(productIndex).toContain("export * from './services/hospital-clinical-orders.service'");
    expect(productIndex).toContain("export * from './services/hospital-medication-pharmacy-mar.service'");
    expect(productIndex).toContain("export * from './services/hospital-laboratory.service'");
    expect(productIndex).toContain("export * from './services/hospital-imaging.service'");
    expect(productIndex).toContain("export * from './services/hospital-nursing.service'");
    expect(productIndex).toContain("export * from './services/hospital-billing-finance.service'");
  });

  it('keeps Hospital product code out of direct healthcare and finance persistence', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = fs.readFileSync(file, 'utf8');
      source.split(/\r?\n/).forEach((line, index) => {
        const directHealthcarePersistence =
          /\b(?:hc_master_patient_index|hc_inpatient_admissions|hc_encounters|hc_beds|hc_nursing_vital_signs|hc_imaging_orders|hc_laboratory_orders|hc_medication_administration_records|hc_temporal_events|hc_clinical_audit_ledger)\b/.test(line);
        const directFinancePersistence =
          /\b(?:finance_outbox_events|finance_receivable_ledger|finance_receivable_positions|journal_entries|journal_lines|accounting_outbox)\b/.test(line);
        const privateEngineImport =
          /platform\/healthcare\/engines\/|platform\/finance\/engines\//.test(line);

        if (directHealthcarePersistence || directFinancePersistence || privateEngineImport) {
          violations.push(`${relative(file)}:L${index + 1} Go-Live chain boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
