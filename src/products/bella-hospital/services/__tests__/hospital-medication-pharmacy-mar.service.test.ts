/**
 * BELLA HOSPITAL - MEDICATION / PHARMACY / MAR MINIMAL RUNTIME TESTS
 *
 * Proves Hospital can drive Medication Order -> Pharmacy Fulfillment -> MAR
 * through sealed Hospital Clinical Orders and public Pharmacy contracts only.
 */

import fs from 'fs';
import path from 'path';
import type { MedicationOrderDetails } from '../../../../platform/healthcare/contracts/order-engine.contract';
import type { PharmacyEngineContract } from '../../../../platform/healthcare/contracts/pharmacy-engine.contract';
import type { EngineResponse, MedicationOrder } from '../../../../platform/healthcare/shared-kernel/types';
import type {
  HospitalClinicalOrderRuntimeDTO,
  HospitalClinicalOrdersProductService,
} from '../hospital-clinical-orders.service';
import {
  HospitalMedicationPharmacyMarProductService,
  type HospitalMedicationFulfillmentDTO,
} from '../hospital-medication-pharmacy-mar.service';

type ClinicalOrdersContractSubset = Pick<
  HospitalClinicalOrdersProductService,
  'createClinicalOrder' | 'approveClinicalOrder'
>;

type PharmacyContractSubset = Pick<
  PharmacyEngineContract,
  'verifyPrescription' | 'dispenseMedication' | 'recordMedicationAdministration'
>;

type VerifyPrescriptionRequest = Parameters<PharmacyContractSubset['verifyPrescription']>[0];
type DispenseMedicationRequest = Parameters<PharmacyContractSubset['dispenseMedication']>[0];
type RecordMedicationAdministrationRequest = Parameters<PharmacyContractSubset['recordMedicationAdministration']>[0];

const medicationDetails: MedicationOrderDetails = {
  drugCode: 'MED-PARACETAMOL',
  drugName: 'Paracetamol',
  dose: 500,
  doseUnit: 'mg',
  route: 'oral',
  frequency: 'BID',
  currentMedicationCodes: [],
};

const createdOrder: HospitalClinicalOrderRuntimeDTO = {
  tenantId: 'tenant-1',
  patientId: 'patient-1',
  encounterId: 'encounter-1',
  orderId: 'order-med-1',
  orderType: 'MEDICATION',
  orderStatus: 'VALIDATED',
  priority: 'ROUTINE',
  orderedBy: 'doctor-1',
  orderedAt: '2026-10-07T00:00:00.000Z',
  cdsCheckStatus: 'PASSED',
  cdsAlertsCount: 0,
};

const approvedOrder: HospitalClinicalOrderRuntimeDTO = {
  ...createdOrder,
  orderStatus: 'APPROVED',
};

function createMedicationOrder(status: MedicationOrder['status'] = 'active'): MedicationOrder {
  return {
    id: 'order-med-1',
    tenantId: 'tenant-1',
    encounterId: 'encounter-1',
    patientId: 'patient-1',
    medicationId: 'MED-PARACETAMOL',
    status,
    dosage: {
      value: 500,
      unit: 'mg',
      text: '500 mg',
    },
    frequency: 'BID',
    route: 'oral',
    startDate: '2026-10-07',
    prescribedBy: 'doctor-1',
    prescribedDate: '2026-10-07T00:00:00.000Z',
    dispensedBy: 'pharmacist-1',
    dispensedDate: '2026-10-07T00:10:00.000Z',
    instructions: 'Give after meal',
    createdAt: '2026-10-07T00:00:00.000Z',
    updatedAt: '2026-10-07T00:10:00.000Z',
  };
}

describe('HospitalMedicationPharmacyMarProductService', () => {
  let createClinicalOrderCalls: Array<Parameters<ClinicalOrdersContractSubset['createClinicalOrder']>[0]>;
  let approveClinicalOrderCalls: Array<Parameters<ClinicalOrdersContractSubset['approveClinicalOrder']>[0]>;
  let verifyPrescriptionCalls: VerifyPrescriptionRequest[];
  let dispenseMedicationCalls: DispenseMedicationRequest[];
  let recordMedicationAdministrationCalls: RecordMedicationAdministrationRequest[];
  let clinicalOrders: ClinicalOrdersContractSubset;
  let pharmacy: PharmacyContractSubset;
  let service: HospitalMedicationPharmacyMarProductService;

  beforeEach(() => {
    createClinicalOrderCalls = [];
    approveClinicalOrderCalls = [];
    verifyPrescriptionCalls = [];
    dispenseMedicationCalls = [];
    recordMedicationAdministrationCalls = [];

    clinicalOrders = {
      createClinicalOrder: async (request) => {
        createClinicalOrderCalls.push(request);
        return createdOrder;
      },
      approveClinicalOrder: async (request) => {
        approveClinicalOrderCalls.push(request);
        return approvedOrder;
      },
    };

    pharmacy = {
      verifyPrescription: async (request): Promise<EngineResponse<{ id: string; status: string; safetyState: string }>> => {
        verifyPrescriptionCalls.push(request);
        return {
          success: true,
          data: {
            id: request.medicationOrderId,
            status: 'VERIFIED',
            safetyState: 'CLEARED',
          },
        };
      },
      dispenseMedication: async (request): Promise<EngineResponse<MedicationOrder>> => {
        dispenseMedicationCalls.push(request);
        return {
          success: true,
          data: createMedicationOrder('active'),
        };
      },
      recordMedicationAdministration: async (request): Promise<EngineResponse<{ id: string }>> => {
        recordMedicationAdministrationCalls.push(request);
        return {
          success: true,
          data: { id: 'mar-1' },
        };
      },
    };

    service = new HospitalMedicationPharmacyMarProductService(clinicalOrders, pharmacy);
  });

  it('proves Medication Order -> Pharmacy -> MAR runtime path through public contracts', async () => {
    const result = await service.completeMedicationPharmacyMarChain({
      requestId: 'req-create-1',
      approvalRequestId: 'req-approve-1',
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      priority: 'ROUTINE',
      orderDetails: medicationDetails,
      notes: 'Give after meal',
      actor: { actorId: 'doctor-1', role: 'doctor' },
      pharmacistId: 'pharmacist-1',
      administeredBy: 'nurse-1',
      administeredAt: '2026-10-07T00:20:00.000Z',
      dosageGiven: { value: 500, unit: 'mg' },
      route: 'oral',
      administrationNotes: 'Patient tolerated medication',
    });

    expect(result.medicationOrder).toEqual({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-med-1',
      orderStatus: 'APPROVED',
    });
    expect(result.pharmacy).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-med-1',
      verificationId: 'order-med-1',
      verificationStatus: 'VERIFIED',
      safetyState: 'CLEARED',
      dispensedMedicationStatus: 'active',
      dispensedBy: 'pharmacist-1',
    });
    expect(result.mar).toEqual({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-med-1',
      orderStatus: 'APPROVED',
      medicationAdministrationId: 'mar-1',
      administeredBy: 'nurse-1',
      administeredAt: '2026-10-07T00:20:00.000Z',
      eventType: 'MedicationAdministered',
    });
    expect(result.downstream).toEqual({
      discharge: 'NOT_PROVEN',
      temporal: 'NOT_PROVEN',
      auditEvidence: 'NOT_PROVEN',
      billing: 'NOT_PROVEN',
    });
  });

  it('preserves patient, encounter, and order linkage across Pharmacy and MAR calls', async () => {
    await service.completeMedicationPharmacyMarChain({
      requestId: 'req-create-1',
      approvalRequestId: 'req-approve-1',
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      priority: 'ROUTINE',
      orderDetails: medicationDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      pharmacistId: 'pharmacist-1',
      administeredBy: 'nurse-1',
      administeredAt: '2026-10-07T00:20:00.000Z',
      dosageGiven: { value: 500, unit: 'mg' },
      route: 'oral',
    });

    expect(createClinicalOrderCalls[0]).toMatchObject({
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      orderType: 'MEDICATION',
      orderDetails: medicationDetails,
    });
    expect(approveClinicalOrderCalls[0]).toMatchObject({
      tenantId: 'tenant-1',
      orderId: 'order-med-1',
      actor: { actorId: 'doctor-1', role: 'doctor' },
    });
    expect(verifyPrescriptionCalls[0]).toEqual({
      tenantId: 'tenant-1',
      medicationOrderId: 'order-med-1',
      pharmacistId: 'pharmacist-1',
      overrides: undefined,
    });
    expect(dispenseMedicationCalls[0]).toEqual({
      tenantId: 'tenant-1',
      medicationOrderId: 'order-med-1',
      dispensedBy: 'pharmacist-1',
    });
    expect(recordMedicationAdministrationCalls[0]).toEqual({
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      medicationOrderId: 'order-med-1',
      administeredBy: 'nurse-1',
      administeredAt: '2026-10-07T00:20:00.000Z',
      dosageGiven: { value: 500, unit: 'mg' },
      route: 'oral',
      site: undefined,
      notes: undefined,
    });
  });

  it('does not route unsupported non-medication orders into Pharmacy/MAR', async () => {
    const nonMedication: HospitalMedicationFulfillmentDTO = {
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-lab-1',
      orderType: 'LAB',
      pharmacistId: 'pharmacist-1',
    };

    await expect(service.fulfillMedicationOrder(nonMedication)).rejects.toThrow(
      'MEDICATION_PHARMACY_MAR_UNSUPPORTED_ORDER_TYPE: LAB'
    );
    expect(verifyPrescriptionCalls).toHaveLength(0);
    expect(dispenseMedicationCalls).toHaveLength(0);
    expect(recordMedicationAdministrationCalls).toHaveLength(0);
  });

  it('blocks Pharmacy linkage drift instead of hiding it', async () => {
    pharmacy.dispenseMedication = async (request): Promise<EngineResponse<MedicationOrder>> => {
      dispenseMedicationCalls.push(request);
      return {
        success: true,
        data: {
          ...createMedicationOrder('active'),
          patientId: 'different-patient',
        },
      };
    };

    await expect(service.fulfillMedicationOrder({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-med-1',
      orderType: 'MEDICATION',
      pharmacistId: 'pharmacist-1',
    })).rejects.toThrow('MEDICATION_PHARMACY_MAR_LINKAGE_MISMATCH: patientId');
  });

  it('uses public contracts and does not duplicate Pharmacy/MAR engines or direct persistence', () => {
    const sourcePath = path.join(
      process.cwd(),
      'src/products/bella-hospital/services/hospital-medication-pharmacy-mar.service.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain("from '../../../platform/healthcare/contracts/pharmacy-engine.contract'");
    expect(source).toContain("from './hospital-clinical-orders.service'");
    expect(source).not.toContain('platform/healthcare/engines/pharmacy-engine');
    expect(source).not.toContain('hc_prescriptions');
    expect(source).not.toContain('hc_medication_administration_records');
    expect(source).not.toContain('new PharmacyEngine');
    expect(source).not.toContain('class PharmacyEngine');
    expect(source).not.toContain('class MAREngine');
  });
});
