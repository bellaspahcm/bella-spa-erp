/**
 * BELLA HOSPITAL - BED / TRANSFER CONTRACT TRACE
 *
 * Trace/runtime guard. This suite proves Bed/Transfer is a real Hospital
 * Foundation dependency and that required Healthcare public contracts are
 * consumed through the product boundary.
 */

import fs from 'fs';
import path from 'path';
import { BED_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/bed-engine.contract';

const repoRoot = process.cwd();

const admissionServicePath = path.join(
  repoRoot,
  'src/products/bella-hospital/services/hospital-admission.service.ts'
);
const bedContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/bed-engine.contract.ts');
const temporalContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/temporal-engine.contract.ts');
const clinicalAuditContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/clinical-audit.contract.ts');
const productRoot = path.join(repoRoot, 'src/products/bella-hospital');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function listSourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      return listSourceFiles(fullPath);
    }

    if (!/\.(ts|tsx)$/.test(entry.name)) {
      return [];
    }

    return [fullPath];
  });
}

function relative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

describe('Bella Hospital Bed / Transfer Contract Trace', () => {
  it('traces Bed/Transfer as a real Hospital Foundation dependency', () => {
    const admissionService = read(admissionServicePath);

    expect(admissionService).toContain('BedEngineContract');
    expect(admissionService).toContain('BedTransferRequest');
    expect(admissionService).toContain("Pick<BedEngineContract, 'transferBed' | 'releaseBed'>");
    expect(admissionService).toContain('async transferBed');
    expect(admissionService).toContain('this.bedContract.transferBed');
    expect(admissionService).toContain('this.bedContract.releaseBed');
    expect(admissionService).toContain('ENCOUNTER_BOUNDARY_VIOLATION');
  });

  it('exposes Bed/Transfer through a public Healthcare contract', () => {
    const operations = BED_ENGINE_CONTRACT.endpoints.map((endpoint) => endpoint.operationId);

    expect(BED_ENGINE_CONTRACT.name).toBe('bed-engine');
    expect(BED_ENGINE_CONTRACT.owner).toBe('Healthcare Platform Team');
    expect(BED_ENGINE_CONTRACT.status).toBe('active');
    expect(operations).toEqual(expect.arrayContaining([
      'allocateBed',
      'releaseBed',
      'transferBed',
      'queryBeds',
    ]));
  });

  it('defines minimum Bed transfer and release request boundaries needed by Hospital', () => {
    const bedContract = read(bedContractPath);

    expect(bedContract).toContain('export interface BedTransferRequest');
    expect(bedContract).toContain('tenantId: string');
    expect(bedContract).toContain('fromBedId: string');
    expect(bedContract).toContain('toBedId: string');
    expect(bedContract).toContain('encounterId: string; // Law 1: Encounter aggregate root');
    expect(bedContract).toContain('patientId: string');
    expect(bedContract).toContain('admissionId: string');
    expect(bedContract).toContain('transferredBy: string');

    expect(bedContract).toContain('export interface BedReleaseRequest');
    expect(bedContract).toContain("reason: 'discharge' | 'transfer' | 'death' | 'other'");
    expect(bedContract).toContain('releaseBed(request: BedReleaseRequest)');
  });

  it('finds public H9 Temporal and H11 Audit contracts for transfer/discharge invariants', () => {
    const temporalContract = read(temporalContractPath);
    const clinicalAuditContract = read(clinicalAuditContractPath);
    const admissionService = read(admissionServicePath);

    expect(temporalContract).toContain('export interface ITemporalContract');
    expect(temporalContract).toContain('recordTemporalEvent');
    expect(temporalContract).toContain('export interface ITemporalEventInput');
    expect(temporalContract).toContain('aggregateType: HealthcareAggregateType');
    expect(temporalContract).toContain('aggregateId: string');
    expect(temporalContract).toContain('deltaPayload: Record<string, unknown>');

    expect(clinicalAuditContract).toContain('export interface IClinicalAuditContract');
    expect(clinicalAuditContract).toContain('recordAuditEntry');
    expect(clinicalAuditContract).toContain('issueEvidencePackage');
    expect(clinicalAuditContract).toContain('export interface IRecordAuditInput');

    expect(admissionService).toContain("Pick<ITemporalContract, 'recordTemporalEvent'>");
    expect(admissionService).toContain("Pick<IClinicalAuditContract, 'recordAuditEntry' | 'issueEvidencePackage'>");
  });

  it('does not introduce private Healthcare engine or direct persistence access in Hospital Product implementation', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateHealthcareEngine =
          /platform\/healthcare\/engines\/(?:bed-engine|temporal-engine|audit-compliance-engine)/.test(line);
        const importsLegacyHealthcareService = /from ['"]@?\/?services\/healthcare/.test(line);
        const directKernelPersistence =
          /\b(?:hc_beds|hc_temporal_events|hc_clinical_audit_ledger|hospital_beds)\b/.test(line);

        if (importsPrivateHealthcareEngine || importsLegacyHealthcareService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Bed/Transfer contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
