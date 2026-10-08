/**
 * BELLA HOSPITAL - MEDICATION / PHARMACY / MAR CONTRACT TRACE
 *
 * Trace-only guard. This suite proves Medication -> Pharmacy -> MAR has
 * reusable Healthcare public contracts and existing engine consumers, while
 * keeping Hospital runtime and downstream semantics explicitly NOT_PROVEN.
 */

import fs from 'fs';
import path from 'path';
import { ORDER_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/order-engine.contract';
import { PHARMACY_ENGINE_CONTRACT } from '../../../platform/healthcare/contracts/pharmacy-engine.contract';

const repoRoot = process.cwd();

const pharmacyContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/pharmacy-engine.contract.ts');
const pharmacySubscriberPath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/pharmacy-engine/events/order-approved-subscriber.ts'
);
const pharmacyServicePath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/pharmacy-engine/pharmacy-engine.service.ts'
);
const prescriptionEntityPath = path.join(
  repoRoot,
  'src/platform/healthcare/engines/pharmacy-engine/domain/prescription.entity.ts'
);
const hospitalPharmacyHookPath = path.join(repoRoot, 'src/products/bella-hospital/hooks/use-pharmacy-engine.ts');
const temporalContractPath = path.join(repoRoot, 'src/platform/healthcare/contracts/temporal-engine.contract.ts');
const financeAdapterPath = path.join(repoRoot, 'src/platform/healthcare/finance-integration/hospital-finance-adapter.ts');
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

describe('Bella Hospital Medication / Pharmacy / MAR Contract Trace', () => {
  it('traces Medication orders through public Order and Pharmacy contracts', () => {
    const orderApproved = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderApproved');
    const orderCompleted = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderCompleted');
    const orderDiscontinued = ORDER_ENGINE_CONTRACT.events.find((event) => event.eventType === 'OrderDiscontinued');
    const pharmacyContract = read(pharmacyContractPath);

    expect(orderApproved?.description).toContain('pharmacy dispensing workflow');
    expect(orderApproved?.subscribers).toContain('pharmacy-engine');
    expect(orderCompleted?.subscribers).toEqual(expect.arrayContaining(['billing-engine', 'encounter-engine']));
    expect(orderDiscontinued?.subscribers).toEqual(expect.arrayContaining(['pharmacy-engine', 'billing-engine']));

    expect(PHARMACY_ENGINE_CONTRACT.name).toBe('pharmacy-engine');
    expect(PHARMACY_ENGINE_CONTRACT.owner).toBe('Healthcare Platform Team');
    expect(PHARMACY_ENGINE_CONTRACT.status).toBe('active');

    expect(pharmacyContract).toContain('export interface PharmacyEngineContract');
    expect(pharmacyContract).toContain('recordMedicationAdministration(request: MARAdministrationRequest)');
    expect(pharmacyContract).toContain('getMedicationOrders(tenantId: string, encounterId: string)');
    expect(pharmacyContract).toContain('dispenseMedication(request: { tenantId: string; medicationOrderId: string; dispensedBy: string })');
  });

  it('finds existing OrderApproved to Pharmacy subscriber without proving Hospital runtime semantics', () => {
    const subscriber = read(pharmacySubscriberPath);

    expect(subscriber).toContain('export class OrderApprovedSubscriber');
    expect(subscriber).toContain("if (snapshot.orderType !== 'MEDICATION')");
    expect(subscriber).toContain('findPrescriptionByClinicalOrderId(tenantId, orderId)');
    expect(subscriber).toContain('Prescription.create({');
    expect(subscriber).toContain('encounterId');
    expect(subscriber).toContain('patientPartyId: patientId');
    expect(subscriber).toContain('clinicalOrderId: orderId');
    expect(subscriber).toContain('savePrescription(prescription)');
    expect(subscriber).toContain('Handled as idempotent success');
  });

  it('traces Pharmacy dispense and MAR events but keeps downstream semantics unproven', () => {
    const service = read(pharmacyServicePath);
    const entity = read(prescriptionEntityPath);

    expect(entity).toContain('PENDING_VERIFICATION');
    expect(entity).toContain('VERIFIED');
    expect(entity).toContain('DISPENSED');
    expect(entity).toContain('MAR_READY');
    expect(entity).toContain("export type MARStatus = 'scheduled' | 'administered' | 'refused' | 'held' | 'missed'");

    expect(service).toContain('async dispenseMedication');
    expect(service).toContain('await this.pharmacyRepository.savePrescription(prescription, originalVersion)');
    expect(service).toContain("eventType: 'MedicationDispensed'");

    expect(service).toContain('async recordMedicationAdministration');
    expect(service).toContain('findPrescriptionByClinicalOrderId');
    expect(service).toContain('MAREntry.create({');
    expect(service).toContain('await this.pharmacyRepository.saveMAR(mar)');
    expect(service).toContain("eventType: 'MedicationAdministered'");
    expect(service).toContain('patientId: request.patientId');
    expect(service).toContain('encounterId: request.encounterId');
    expect(service).toContain('administeredAt: request.administeredAt');
  });

  it('finds Hospital consumer surface only through public Pharmacy contract', () => {
    const hook = read(hospitalPharmacyHookPath);

    expect(hook).toContain("getHealthcareService<PharmacyEngineContract>('pharmacy-engine', supabase)");
    expect(hook).toContain('getMedicationOrders');
    expect(hook).toContain('recordMedicationAdministration');
    expect(hook).toContain("from '@/platform/healthcare/contracts/pharmacy-engine.contract'");
    expect(hook).not.toContain('platform/healthcare/engines/pharmacy-engine');
    expect(hook).not.toContain('hc_prescriptions');
    expect(hook).not.toContain('hc_medication_administration_records');
  });

  it('keeps Temporal, Audit/Evidence, and Billing downstream proof out of current scope', () => {
    const temporalContract = read(temporalContractPath);
    const financeAdapter = read(financeAdapterPath);

    expect(temporalContract).toContain("'MEDICATIONS' | 'ALLERGIES' | 'LAB_RESULTS' | 'VITAL_SIGNS' | 'ORDERS' | 'DECISIONS'");
    expect(financeAdapter).toContain('async publishMedicationDispensed');
    expect(financeAdapter).toContain("eventType: 'MEDICATION_DISPENSED'");

    const hook = read(hospitalPharmacyHookPath);
    expect(hook).not.toContain('recordTemporalEvent');
    expect(hook).not.toContain('issueEvidencePackage');
    expect(hook).not.toContain('publishMedicationDispensed');
  });

  it('does not introduce private Pharmacy engine or direct persistence access in Hospital Product implementation', () => {
    const implementationFiles = listSourceFiles(productRoot).filter((file) => !relative(file).includes('__tests__/'));
    const violations: string[] = [];

    for (const file of implementationFiles) {
      const source = read(file);
      source.split(/\r?\n/).forEach((line, index) => {
        const importsPrivatePharmacyEngine = /platform\/healthcare\/engines\/pharmacy-engine/.test(line);
        const importsLegacyHealthcareService = /from ['"]@?\/?services\/healthcare/.test(line);
        const directKernelPersistence =
          /\b(?:hc_prescriptions|hc_medication_administration_records)\b/.test(line);

        if (importsPrivatePharmacyEngine || importsLegacyHealthcareService || directKernelPersistence) {
          violations.push(`${relative(file)}:L${index + 1} Medication/Pharmacy/MAR contract boundary bypass`);
        }
      });
    }

    expect(violations).toEqual([]);
  });
});
