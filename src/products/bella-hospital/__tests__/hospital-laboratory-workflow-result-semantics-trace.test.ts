/**
 * BELLA HOSPITAL - LABORATORY WORKFLOW / RESULT SEMANTICS TRACE
 *
 * Trace-only guard. This suite proves the Laboratory source-supported
 * lifecycle and result semantics, while keeping Hospital runtime, downstream
 * consumers, and Real DB proof explicitly NOT_PROVEN.
 */

import fs from 'fs';
import path from 'path';

const repoRoot = process.cwd();

const labContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/laboratory-engine.contract.ts');
const labOrderPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/domain/lab-order.entity.ts');
const specimenPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/domain/specimen.entity.ts');
const labResultPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/domain/lab-result.entity.ts');
const labServicePath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/laboratory-engine.service.ts');
const labEventsPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/events/laboratory.events.ts');
const labSubscriberPath = path.join(repoRoot, 'src/platform/healthcare/engines/laboratory-engine/events/order-approved-subscriber.ts');
const temporalHandlerPath = path.join(repoRoot, 'src/platform/healthcare/engines/temporal-engine/events/temporal-event-handler.ts');
const temporalContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/temporal-engine.contract.ts');
const auditContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/audit-compliance.contract.ts');
const financeAdapterPath = path.join(repoRoot, 'src/platform/healthcare/finance-integration/hospital-finance-adapter.ts');
const hospitalAdmissionServicePath = path.join(repoRoot, 'src/products/bella-hospital/services/hospital-admission.service.ts');
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

    return /\.(ts|tsx)$/.test(entry.name) ? [fullPath] : [];
  });
}

function relative(filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

describe('Bella Hospital Laboratory Workflow Result Semantics Trace', () => {
  it('traces the source-supported LabOrder lifecycle without inventing unsupported states', () => {
    const labContract = read(labContractPath);
    const labOrder = read(labOrderPath);

    expect(labOrder).toContain("export type LabOrderStatus =");
    expect(labOrder).toContain("'ORDERED'");
    expect(labOrder).toContain("'COLLECTED'");
    expect(labOrder).toContain("'RECEIVED'");
    expect(labOrder).toContain("'PROCESSING'");
    expect(labOrder).toContain("'RESULTED'");
    expect(labOrder).toContain("'VERIFIED'");
    expect(labOrder).not.toContain("'ACCEPTED'");

    expect(labContract).toContain('collectSpecimen(');
    expect(labContract).toContain('receiveSpecimen(tenantId: string, labOrderId: string)');
    expect(labContract).toContain('startProcessing(tenantId: string, labOrderId: string)');
    expect(labContract).toContain('recordResult(');
    expect(labContract).toContain('verifyResult(');
  });

  it('traces specimen semantics and keeps specimen identifier support NOT_SUPPORTED', () => {
    const specimen = read(specimenPath);
    const labOrder = read(labOrderPath);
    const labEvents = read(labEventsPath);

    expect(specimen).toContain('sampleType: string');
    expect(specimen).toContain('tubeColor: string');
    expect(specimen).toContain('collectedAt?: Date');
    expect(specimen).toContain('receivedAt?: Date');
    expect(specimen).toContain('processingAt?: Date');
    expect(specimen).toContain('markReceived(receivedAt: Date = new Date())');
    expect(specimen).toContain('markProcessing(processingAt: Date = new Date())');

    expect(labOrder).toContain('specimen?: Specimen');
    expect(labEvents).toContain('export interface SpecimenCollectedPayload');
    expect(labEvents).toContain('labOrderId: string');
    expect(labEvents).not.toContain('specimenId');
  });

  it('traces result semantics and keeps result identifier support NOT_SUPPORTED', () => {
    const labResult = read(labResultPath);
    const labEvents = read(labEventsPath);

    expect(labResult).toContain('value: string');
    expect(labResult).toContain('unit: string');
    expect(labResult).toContain('referenceRange: string');
    expect(labResult).toContain('assessment: RangeAssessment');
    expect(labResult).toContain('verifiedAt?: Date');
    expect(labResult).toContain('verifiedBy?: string');
    expect(labResult).not.toContain('id: string');

    expect(labEvents).toContain('export interface ResultVerifiedPayload');
    expect(labEvents).toContain('labOrderId: string');
    expect(labEvents).toContain('encounterId: string');
    expect(labEvents).toContain('value: string');
    expect(labEvents).toContain('referenceRange: string');
    expect(labEvents).toContain('verifiedBy: string');
    expect(labEvents).toContain('verifiedAt: string');
    expect(labEvents).not.toContain('resultId');
    expect(labEvents).not.toContain('patientId');
  });

  it('traces verification semantics and event-after-persistence ordering', () => {
    const labOrder = read(labOrderPath);
    const labService = read(labServicePath);

    expect(labOrder).toContain('public verify(verifiedBy: string, verifiedAt: Date = new Date())');
    expect(labOrder).toContain("if (this.props.status !== 'RESULTED')");
    expect(labOrder).toContain("this.props.status = 'VERIFIED'");
    expect(labOrder).toContain("this.props.safetyState = 'ESCALATION_REQUIRED'");

    const saveIndex = labService.indexOf('await this.repository.save(labOrder);');
    const verifiedEventIndex = labService.indexOf("eventType: 'ResultVerified'");
    expect(saveIndex).toBeGreaterThan(-1);
    expect(verifiedEventIndex).toBeGreaterThan(saveIndex);
    expect(labService).toContain("eventType: 'CriticalResultEscalated'");
  });

  it('keeps Clinical Order to LabOrder bootstrap public access as NOT_PROVEN', () => {
    const labContract = read(labContractPath);
    const labSubscriber = read(labSubscriberPath);

    expect(labSubscriber).toContain('const LAB_ORDER_TYPES = new Set([\'LAB\', \'laboratory\'])');
    expect(labSubscriber).toContain('clinicalOrderId: orderId');
    expect(labSubscriber).toContain('patientId,');

    expect(labContract).not.toContain('createLabOrder');
    expect(labContract).not.toContain('getLabOrder');
    expect(labContract).not.toContain('findByClinicalOrderId');
  });

  it('traces downstream evidence and keeps runtime consumers NOT_PROVEN', () => {
    const temporalContract = read(temporalContractPath);
    const temporalHandler = read(temporalHandlerPath);
    const auditContract = read(auditContractPath);
    const financeAdapter = read(financeAdapterPath);
    const admissionService = read(hospitalAdmissionServicePath);

    expect(temporalContract).toContain("'LAB_RESULTS'");
    expect(temporalHandler).toContain("type: 'hos.lab.result_finalized.v1'");
    expect(temporalHandler).not.toContain("'ResultVerified'");

    expect(auditContract).toContain('recordAuditEntry(input: AuditEntryInputDTO)');
    expect(financeAdapter).toContain("serviceType?: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'PHARMACY'");

    expect(admissionService).not.toContain('LAB_RESULTS');
    expect(admissionService).not.toContain('ResultVerified');
    expect(admissionService).not.toContain('laboratory-engine');
  });

  it('does not introduce direct Laboratory persistence or legacy Lab actions in Hospital Product implementation', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivateLabEngine = /platform\/healthcare\/engines\/laboratory-engine/.test(line);
        const importsLegacyHealthcareLabService = /from ['"]@?\/?services\/healthcare\/(?:lis-ris-actions|laboratory-service|healthcare-actions)/.test(line);
        const directKernelPersistence = /\b(?:hc_lab_orders|hc_clinical_orders)\b/.test(line);

        if (importsPrivateLabEngine || importsLegacyHealthcareLabService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Laboratory semantics boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
