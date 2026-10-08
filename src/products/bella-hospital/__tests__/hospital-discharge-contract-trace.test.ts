/**
 * BELLA HOSPITAL - DISCHARGE CONTRACT TRACE
 *
 * Trace-only guard. This suite proves Hospital discharge has a reusable public
 * Admission discharge contract, Bed release contract, H9 temporal contract,
 * and H11 audit/evidence contract.
 */

import fs from 'fs';
import path from 'path';
import { BED_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/bed-engine.contract';

const repoRoot = process.cwd();

const admissionServicePath = path.join(
  repoRoot,
  'src/products/bella-hospital/services/hospital-admission.service.ts'
);
const publicAdmissionContractPath = path.join(
  repoRoot,
  'src/platform/healthcare/contracts/admission-engine.contract.ts'
);
const canonicalAdmissionContractPath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/admission-engine/contracts/admission-engine.contract.ts'
);
const bedContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/bed-engine.contract.ts');
const temporalContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/temporal-engine.contract.ts');
const clinicalAuditContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/clinical-audit.contract.ts');
const productRoot = path.join(repoRoot, 'src/products/bella-hospital');

function read(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function sectionBetween(source: string, startNeedle: string, endNeedle: string): string {
  const start = source.indexOf(startNeedle);
  const end = source.indexOf(endNeedle, start);
  if (start < 0 || end < 0) {
    return '';
  }

  return source.slice(start, end);
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

describe('Bella Hospital Discharge Contract Trace', () => {
  it('exposes discharge through the public Healthcare Admission contract', () => {
    const publicContract = read(publicAdmissionContractPath);
    const canonicalContract = read(canonicalAdmissionContractPath);

    expect(publicContract).toContain('DischargeAdmissionRequest');
    expect(publicContract).toContain('AdmissionEngineContract');

    expect(canonicalContract).toContain('export interface DischargeAdmissionRequest');
    expect(canonicalContract).toContain('tenantId: string');
    expect(canonicalContract).toContain('admissionId: string');
    expect(canonicalContract).toContain('dischargeSummary: string');
    expect(canonicalContract).toContain('dischargeAdmission(request: DischargeAdmissionRequest)');
  });

  it('traces Hospital discharge consumer to Admission, Bed, H9, and H11 public contracts', () => {
    const admissionService = read(admissionServicePath);
    const dischargeMethod = sectionBetween(
      admissionService,
      'async dischargeInpatient',
      'function unwrapEngineResponse'
    );

    expect(dischargeMethod).toContain('this.admissionContract.dischargeAdmission');
    expect(dischargeMethod).toContain('this.bedContract.releaseBed');
    expect(dischargeMethod).toContain('this.temporalContract.recordTemporalEvent');
    expect(dischargeMethod).toContain('this.auditContract.recordAuditEntry');
    expect(dischargeMethod).toContain('this.auditContract.issueEvidencePackage');
    expect(dischargeMethod).toContain("eventType: 'INPATIENT_DISCHARGED'");
    expect(dischargeMethod).toContain("aggregateType: 'Admission'");
    expect(dischargeMethod).toContain("actionType: 'INPATIENT_DISCHARGE_EXECUTE'");
    expect(dischargeMethod).toContain("h10RuleChecksum: 'SHA256:HOSPITAL_DISCHARGE_RULE_V1.0'");

    expect(admissionService).toContain("Pick<AdmissionEngineContract, 'createAdmission' | 'dischargeAdmission'>");
    expect(admissionService).toContain("Pick<BedEngineContract, 'transferBed' | 'releaseBed'>");
    expect(admissionService).toContain("Pick<ITemporalContract, 'recordTemporalEvent'>");
    expect(admissionService).toContain("Pick<IClinicalAuditContract, 'recordAuditEntry' | 'issueEvidencePackage'>");
  });

  it('finds public Bed release, H9 Temporal, and H11 Audit contracts for later semantics', () => {
    const bedOperations = BED_ENGINE_CONTRACT.endpoints.map((endpoint) => endpoint.operationId);
    const bedContract = read(bedContractPath);
    const temporalContract = read(temporalContractPath);
    const clinicalAuditContract = read(clinicalAuditContractPath);

    expect(bedOperations).toContain('releaseBed');
    expect(bedContract).toContain('export interface BedReleaseRequest');
    expect(bedContract).toContain("reason: 'discharge' | 'transfer' | 'death' | 'other'");
    expect(bedContract).toContain('releaseBed(request: BedReleaseRequest)');

    expect(temporalContract).toContain('export interface ITemporalContract');
    expect(temporalContract).toContain('recordTemporalEvent');

    expect(clinicalAuditContract).toContain('export interface IClinicalAuditContract');
    expect(clinicalAuditContract).toContain('recordAuditEntry');
    expect(clinicalAuditContract).toContain('issueEvidencePackage');
  });

  it('proves Bed release and H9 discharge temporal semantics in current consumer', () => {
    const admissionService = read(admissionServicePath);
    const dischargeMethod = sectionBetween(
      admissionService,
      'async dischargeInpatient',
      'function unwrapEngineResponse'
    );

    expect(dischargeMethod).toContain('this.bedContract.releaseBed');
    expect(dischargeMethod).toContain("reason: dischargeDispositionToBedReleaseReason(dto.dischargeDisposition)");
    expect(dischargeMethod).toContain('this.temporalContract.recordTemporalEvent');
    expect(dischargeMethod).toContain("eventType: 'INPATIENT_DISCHARGED'");
    expect(dischargeMethod).toContain('temporalEventId: temporalEvent.id');
    expect(admissionService).toContain("Pick<BedEngineContract, 'transferBed' | 'releaseBed'>");
  });

  it('does not introduce private Healthcare engine or direct persistence access in Hospital Product implementation', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateHealthcareEngine =
          /platform\/healthcare\/engines\/(?:admission-engine|bed-engine|temporal-engine|audit-compliance-engine)/.test(line);
        const directKernelPersistence =
          /\b(?:hc_admissions|hc_beds|hc_temporal_events|hc_clinical_audit_ledger|hospital_discharges)\b/.test(line);

        if (importsPrivateHealthcareEngine || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Discharge contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
