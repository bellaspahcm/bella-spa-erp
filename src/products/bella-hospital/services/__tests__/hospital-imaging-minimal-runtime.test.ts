/**
 * BELLA HOSPITAL - IMAGING MINIMAL RUNTIME TESTS
 *
 * Proves Hospital can drive Clinical Order -> Imaging Order bootstrap ->
 * verified radiology result through public contracts only.
 */

import fs from 'fs';
import path from 'path';
import { ImagingEngineService } from '../../../../platform/healthcare/engines/imaging-engine/imaging-engine.service';
import type {
  IImagingRepository,
  ImagingOrderRecord,
} from '../../../../platform/healthcare/engines/imaging-engine/repositories/imaging-repository.interface';
import type { ImagingOrderDetails } from '../../../../platform/healthcare/contracts/order-engine.contract';
import type {
  HospitalClinicalOrderRuntimeDTO,
  HospitalClinicalOrdersProductService,
} from '../hospital-clinical-orders.service';
import { HospitalImagingProductService } from '../hospital-imaging.service';

type ClinicalOrdersContractSubset = Pick<
  HospitalClinicalOrdersProductService,
  'createClinicalOrder' | 'approveClinicalOrder'
>;

class InMemoryImagingRepository implements IImagingRepository {
  public records: ImagingOrderRecord[] = [];

  public async findById(tenantId: string, id: string): Promise<ImagingOrderRecord | null> {
    return this.records.find((record) => record.tenantId === tenantId && record.id === id) ?? null;
  }

  public async findByClinicalOrderId(tenantId: string, clinicalOrderId: string): Promise<ImagingOrderRecord[]> {
    return this.records.filter((record) => (
      record.tenantId === tenantId && record.clinicalOrderId === clinicalOrderId
    ));
  }

  public async save(record: ImagingOrderRecord): Promise<void> {
    this.records.push(record);
  }

  public async recordResult(
    tenantId: string,
    imagingOrderId: string,
    radiologistReport: string,
    radiologistId: string,
    verifiedAt: string
  ): Promise<ImagingOrderRecord> {
    const index = this.records.findIndex((record) => (
      record.tenantId === tenantId && record.id === imagingOrderId
    ));

    if (index < 0) {
      throw new Error('IMAGING_ORDER_NOT_FOUND');
    }

    const updated: ImagingOrderRecord = {
      ...this.records[index],
      radiologistReport,
      radiologistId,
      verifiedAt,
      status: 'VERIFIED',
    };
    this.records[index] = updated;

    return updated;
  }
}

const imagingDetails: ImagingOrderDetails = {
  modalityCode: 'XRAY',
  bodyRegion: 'Chest',
  withContrast: false,
  clinicalIndication: 'Fever and cough',
};

const createdImagingOrder: HospitalClinicalOrderRuntimeDTO = {
  tenantId: 'tenant-1',
  encounterId: 'encounter-1',
  orderId: 'order-imaging-1',
  orderType: 'IMAGING',
  orderStatus: 'VALIDATED',
  priority: 'ROUTINE',
  orderedBy: 'doctor-1',
  orderedAt: '2026-10-07T00:00:00.000Z',
};

const approvedImagingOrder: HospitalClinicalOrderRuntimeDTO = {
  ...createdImagingOrder,
  orderStatus: 'APPROVED',
};

describe('HospitalImagingProductService', () => {
  let createClinicalOrderCalls: Array<Parameters<ClinicalOrdersContractSubset['createClinicalOrder']>[0]>;
  let approveClinicalOrderCalls: Array<Parameters<ClinicalOrdersContractSubset['approveClinicalOrder']>[0]>;
  let clinicalOrders: ClinicalOrdersContractSubset;
  let repository: InMemoryImagingRepository;
  let imaging: ImagingEngineService;
  let service: HospitalImagingProductService;

  beforeEach(() => {
    createClinicalOrderCalls = [];
    approveClinicalOrderCalls = [];
    repository = new InMemoryImagingRepository();
    imaging = new ImagingEngineService(repository);

    clinicalOrders = {
      createClinicalOrder: async (request) => {
        createClinicalOrderCalls.push(request);
        return createdImagingOrder;
      },
      approveClinicalOrder: async (request) => {
        approveClinicalOrderCalls.push(request);
        return approvedImagingOrder;
      },
    };

    service = new HospitalImagingProductService(clinicalOrders, imaging);
  });

  it('proves Clinical Order -> Imaging Order -> verified radiology result through public contracts', async () => {
    const result = await service.completeImagingWorkflow({
      requestId: 'req-imaging-create-1',
      approvalRequestId: 'req-imaging-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: imagingDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
      verifiedAt: '2026-10-07T01:00:00.000Z',
    });

    expect(result).toMatchObject({
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      orderId: 'order-imaging-1',
      modalityCode: 'XRAY',
      bodyRegion: 'Chest',
      orderStatus: 'APPROVED',
      imagingWorkflowStatus: 'VERIFIED',
      resultStatus: 'VERIFIED',
      idempotency: { reusedExisting: false },
      downstream: {
        temporal: 'NOT_PROVEN',
        auditEvidence: 'NOT_PROVEN',
        discharge: 'NOT_PROVEN',
        billing: 'NOT_PROVEN',
      },
    });
    expect(result.imagingOrderId).toBeTruthy();

    const stored = await repository.findById('tenant-1', result.imagingOrderId);
    expect(stored?.status).toBe('VERIFIED');
    expect(stored?.radiologistReport).toBe('No acute cardiopulmonary abnormality.');
    expect(stored?.radiologistId).toBe('radiologist-1');
    expect(stored?.clinicalOrderId).toBe('order-imaging-1');
  });

  it('preserves order, patient, encounter, tenant, and imaging order linkage', async () => {
    const result = await service.completeImagingWorkflow({
      requestId: 'req-imaging-create-1',
      approvalRequestId: 'req-imaging-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: imagingDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
    });

    expect(createClinicalOrderCalls[0]).toMatchObject({
      requestId: 'req-imaging-create-1',
      tenantId: 'tenant-1',
      encounterId: 'encounter-1',
      patientId: 'patient-1',
      orderType: 'IMAGING',
      orderDetails: imagingDetails,
    });
    expect(approveClinicalOrderCalls[0]).toEqual({
      requestId: 'req-imaging-approve-1',
      tenantId: 'tenant-1',
      orderId: 'order-imaging-1',
      actor: { actorId: 'doctor-1', role: 'doctor' },
    });

    const stored = await repository.findById('tenant-1', result.imagingOrderId);
    expect(stored?.tenantId).toBe('tenant-1');
    expect(stored?.patientId).toBe('patient-1');
    expect(stored?.encounterId).toBe('encounter-1');
    expect(stored?.clinicalOrderId).toBe('order-imaging-1');
    expect(stored?.id).toBe(result.imagingOrderId);
  });

  it('reuses bootstrap idempotency and does not create duplicate ImagingOrders', async () => {
    const first = await service.completeImagingWorkflow({
      requestId: 'req-imaging-create-1',
      approvalRequestId: 'req-imaging-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: imagingDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
    });
    const second = await service.completeImagingWorkflow({
      requestId: 'req-imaging-create-2',
      approvalRequestId: 'req-imaging-approve-2',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: imagingDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
    });

    expect(second.imagingOrderId).toBe(first.imagingOrderId);
    expect(second.idempotency).toEqual({ reusedExisting: true });
    expect(repository.records).toHaveLength(1);
  });

  it('blocks unsupported non-IMAGING order runtime path', async () => {
    clinicalOrders.createClinicalOrder = async (request) => {
      createClinicalOrderCalls.push(request);
      return {
        ...createdImagingOrder,
        orderType: 'LAB',
      };
    };

    await expect(service.completeImagingWorkflow({
      requestId: 'req-imaging-create-1',
      approvalRequestId: 'req-imaging-approve-1',
      tenantId: 'tenant-1',
      patientId: 'patient-1',
      encounterId: 'encounter-1',
      priority: 'ROUTINE',
      orderDetails: imagingDetails,
      actor: { actorId: 'doctor-1', role: 'doctor' },
      radiologistReport: 'No acute cardiopulmonary abnormality.',
      radiologistId: 'radiologist-1',
    })).rejects.toThrow('IMAGING_RUNTIME_UNSUPPORTED_ORDER_TYPE: LAB');
  });

  it('uses public contracts and does not import Imaging repository or direct persistence in Hospital service', () => {
    const sourcePath = path.join(
      process.cwd(),
      'src/products/bella-hospital/services/hospital-imaging.service.ts'
    );
    const source = fs.readFileSync(sourcePath, 'utf8');

    expect(source).toContain("from '../../../platform/healthcare/contracts/imaging-engine.contract'");
    expect(source).toContain("from './hospital-clinical-orders.service'");
    expect(source).not.toContain('platform/healthcare/engines/imaging-engine');
    expect(source).not.toContain('IImagingRepository');
    expect(source).not.toContain('SupabaseImagingRepository');
    expect(source).not.toContain('hc_imaging_orders');
    expect(source).not.toContain('hc_clinical_orders');
    expect(source).not.toContain('new ImagingEngine');
  });
});
