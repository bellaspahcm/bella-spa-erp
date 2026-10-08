/**
 * BELLA HOSPITAL - LABORATORY WORKFLOW / RESULT MINIMAL RUNTIME TESTS
 *
 * Proves Hospital can drive Clinical Order -> LabOrder bootstrap -> Laboratory
 * workflow -> result verification through public contracts only.
 */

import fs from 'fs';
import path from 'path';
import { LaboratoryEngineService } from '../../../../platform/healthcare/engines/laboratory-engine/laboratory-engine.service';
import { LabOrder } from '../../../../platform/healthcare/engines/laboratory-engine/domain/lab-order.entity';
import type { ILaboratoryRepository } from '../../../../platform/healthcare/engines/laboratory-engine/repositories/laboratory-repository.interface';
import type { LabOrderDetails } from '../../../../platform/healthcare/contracts/order-engine.contract';
import type {
  HospitalClinicalOrderRuntimeDTO,
  HospitalClinicalOrdersProductService,
} from '../hospital-clinical-orders.service';
import { HospitalLaboratoryProductService } from '../hospital-laboratory.service';

type ClinicalOrdersContractSubset = Pick<
  HospitalClinicalOrdersProductService,
  'createClinicalOrder' | 'approveClinicalOrder'
>;

class InMemoryLaboratoryRepository implements ILaboratoryRepository {
  public records: LabOrder[] = [];

  public async findById(tenantId: string, id: string): Promise<LabOrder | null> {
    return this.records.find((record) => record.tenantId === tenantId && record.id === id) ?? null;
  }

  public async findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<LabOrder[]> {
    return this.records.filter((record) => (
      record.tenantId === tenantId && record.clinicalOrderId === clinicalOrderId
    ));
  }

  public async save(labOrder: LabOrder): Promise<void> {
    const existingIndex = this.records.findIndex((record) => (
      record.tenantId === labOrder.tenantId && record.id === labOrder.id
    ));

    if (existingIndex >= 0) {
      this.records[existingIndex] = labOrder;
      return;
    }

    this.records.push(labOrder);
  }
}

const labDetails: LabOrderDetails = {
  testCode: 'K',
  testName: 'Potassium',
  specimenType: 'Serum',
};

const createdLabOrder: HospitalClinicalOrderRuntimeDTO = {
  tenantId: 'tenant-1',
  encounterId: 'encounter-1',
  orderId: 'order-lab-1',
  orderType: 'LAB',
  orderStatus: 'VALIDATED',
  priority: 'ROUTINE',
  orderedBy: 'doctor-1',
  orderedAt: '2026-10-07T00:00:00.000Z',
};

const approvedLabOrder: HospitalClinicalOrderRuntimeDTO = {
  ...createdLabOrder,
  orderStatus: 'APPROVED',
};

describe('HospitalLaboratoryProductService', () => {
  let createClinicalOrderCalls: Array<Parameters<ClinicalOrdersContractSubset['createClinicalOrder']>[0]>;
  let approveClinicalOrderCalls: Array<Parameters<ClinicalOrdersContractSubset['approveClinicalOrder']>[0]>;
  let clinicalOrders: ClinicalOrdersContractSubset;
  let repository: InMemoryLaboratoryRepository;
  let laboratory: LaboratoryEngineService;
  let service: HospitalLaboratoryProductService;

  beforeEach(() => {
    createClinicalOrderCalls = [];
    approveClinicalOrderCalls = [];
    repository = new InMemoryLaboratoryRepository();
    laboratory = new LaboratoryEngineService(repository);

    clinicalOrders = {
      createClinicalOrder: async (request) => {
        createClinicalOrderCalls.push(request);
        return createdLabOrder;
      },
      approveClinicalOrder: async (request) => {
        approveClinicalOrderCalls.push(request);
        return approvedLabOrder;
      },
    };

    service = new HospitalLaboratoryProductService(clinicalOrders, laboratory);
  });

  it('proves Clinical Order -> LabOrder -> workflow -> result verification through public contracts', async () => {
    const result = await service.completeLaboratoryWorkflow({
      requestId: 'req-lab-create-1',
      approvalRequestId: 'req-lab-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: labDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      sampleType: 'Serum',
      tubeColor: 'Gold',
      resultValue: '4.5',
      resultUnit: 'mEq/L',
      verifiedBy: 'lab-tech-1',
    });

    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-lab-1',
      testCode: 'K',
      testName: 'Potassium',
      orderStatus: 'APPROVED',
      labWorkflowStatus: 'VERIFIED',
      resultStatus: 'VERIFIED',
      idempotency: { reusedExisting: false },
      downstream: {
        temporal: 'NOT_PROVEN',
        auditEvidence: 'NOT_PROVEN',
        discharge: 'NOT_PROVEN',
        billing: 'NOT_PROVEN',
      },
    });
    expect(result.labOrderId).toBeTruthy();

    const stored = await repository.findById('tenant-1', result.labOrderId);
    expect(stored?.status).toBe('VERIFIED');
    expect(stored?.result?.value).toBe('4.5');
    expect(stored?.result?.verifiedBy).toBe('lab-tech-1');
    expect(stored?.clinicalOrderId).toBe('order-lab-1');
  });

  it('preserves order, patient, encounter, tenant, and lab order linkage', async () => {
    const result = await service.completeLaboratoryWorkflow({
      requestId: 'req-lab-create-1',
      approvalRequestId: 'req-lab-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: labDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      sampleType: 'Serum',
      tubeColor: 'Gold',
      resultValue: '4.5',
      resultUnit: 'mEq/L',
      verifiedBy: 'lab-tech-1',
    });

    expect(createClinicalOrderCalls[0]).toMatchObject({
      requestId: 'req-lab-create-1',
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      orderType: 'LAB',
      orderDetails: labDetails,
    });
    expect(approveClinicalOrderCalls[0]).toEqual({
      requestId: 'req-lab-approve-1',
      tenantId: 'tenant-1',
      orderId: 'order-lab-1',
      actor: { actorId: 'doctor-1', role: 'doctor' },
    });

    const stored = await repository.findById('tenant-1', result.labOrderId);
    expect(stored?.tenantId).toBe('tenant-1');
    expect(stored?.patientId).toBe('patient-1');
    expect(stored?.encounterId).toBe('encounter-1');
    expect(stored?.clinicalOrderId).toBe('order-lab-1');
    expect(stored?.id).toBe(result.labOrderId);
  });

  it('reuses bootstrap idempotency and does not create duplicate LabOrders', async () => {
    const existing = LabOrder.create({
      id: 'lab-order-existing-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      clinicalOrderId: 'order-lab-1',
      testCode: 'K',
      testName: 'Potassium',
      status: 'ORDERED',
      safetyState: 'NORMAL',
      version: 1,
    });
    await repository.save(existing);

    const result = await service.completeLaboratoryWorkflow({
      requestId: 'req-lab-create-1',
      approvalRequestId: 'req-lab-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: labDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      sampleType: 'Serum',
      tubeColor: 'Gold',
      resultValue: '4.5',
      resultUnit: 'mEq/L',
      verifiedBy: 'lab-tech-1',
    });

    expect(result.labOrderId).toBe('lab-order-existing-1');
    expect(result.idempotency).toEqual({ reusedExisting: true });
    expect(repository.records).toHaveLength(1);
  });

  it('blocks unsupported non-LAB order runtime path', async () => {
    clinicalOrders.createClinicalOrder = async (request) => {
      createClinicalOrderCalls.push(request);
      return {
        ...createdLabOrder,
        orderType: 'IMAGING',
      };
    };

    await expect(service.completeLaboratoryWorkflow({
      requestId: 'req-lab-create-1',
      approvalRequestId: 'req-lab-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: labDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      sampleType: 'Serum',
      tubeColor: 'Gold',
      resultValue: '4.5',
      resultUnit: 'mEq/L',
      verifiedBy: 'lab-tech-1',
    })).rejects.toThrow('LABORATORY_RUNTIME_UNSUPPORTED_ORDER_TYPE: IMAGING');
  });

  it('uses public contracts and does not import Laboratory repository or direct persistence in Hospital service', () => {
    const sourcePath = path.join(
      process.cwd(),
      'src/products/bella-hospital/services/hospital-laboratory.service.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain("from '../../../platform/healthcare/contracts/laboratory-engine.contract'");
    expect(source).toContain("from './hospital-clinical-orders.service'");
    expect(source).not.toContain('platform/healthcare/engines/laboratory-engine');
    expect(source).not.toContain('ILaboratoryRepository');
    expect(source).not.toContain('SupabaseLaboratoryRepository');
    expect(source).not.toContain('hc_lab_orders');
    expect(source).not.toContain('hc_clinical_orders');
    expect(source).not.toContain('new LaboratoryEngine');
  });
});
