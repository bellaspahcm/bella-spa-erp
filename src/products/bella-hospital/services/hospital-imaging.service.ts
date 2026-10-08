/**
 * BELLA HOSPITAL - IMAGING GO-LIVE PRODUCT SERVICE
 *
 * Minimal Hospital runtime orchestration for Clinical Order -> Imaging Order
 * bootstrap -> verified radiology result through public Healthcare contracts.
 *
 * It does not access Imaging internals, repositories, direct DB tables, H9
 * Temporal, H11 Audit, Discharge, Billing, Finance, Real DB, or Browser E2E
 * surfaces.
 *
 * @module src/products/bella-hospital/services/hospital-imaging.service
 */

import type {
  BootstrapImagingOrderResult,
  IImagingEngine,
} from '../../../platform/healthcare/contracts/imaging-engine.contract';
import type {
  ImagingOrderDetails,
  OrderPriority,
} from '../../../platform/healthcare/contracts/order-engine.contract';
import type {
  HospitalClinicalOrdersActorDTO,
  HospitalClinicalOrderRuntimeDTO,
  HospitalClinicalOrdersProductService,
} from './hospital-clinical-orders.service';

type HospitalClinicalOrdersRuntimeContract = Pick<
  HospitalClinicalOrdersProductService,
  'createClinicalOrder' | 'approveClinicalOrder'
>;

type HospitalImagingContract = Pick<
  IImagingEngine,
  | 'bootstrapImagingOrder'
  | 'recordImagingResult'
>;

export interface HospitalImagingOrderDTO {
  requestId: string;
  approvalRequestId: string;
  tenantId: string;
  patientId: string;
  encounterId: string;
  priority: OrderPriority;
  orderDetails: ImagingOrderDetails;
  notes?: string;
  actor: HospitalClinicalOrdersActorDTO;
}

export interface HospitalImagingWorkflowDTO extends HospitalImagingOrderDTO {
  radiologistReport: string;
  radiologistId: string;
  verifiedAt?: string;
}

export interface HospitalImagingRuntimeDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  imagingOrderId: string;
  modalityCode: string;
  bodyRegion: string;
  orderStatus: HospitalClinicalOrderRuntimeDTO['orderStatus'];
  imagingWorkflowStatus: 'VERIFIED';
  resultStatus: 'VERIFIED';
  idempotency: {
    reusedExisting: boolean;
  };
  downstream: {
    temporal: 'NOT_PROVEN';
    auditEvidence: 'NOT_PROVEN';
    discharge: 'NOT_PROVEN';
    billing: 'NOT_PROVEN';
  };
}

export class HospitalImagingProductService {
  constructor(
    private readonly clinicalOrders: HospitalClinicalOrdersRuntimeContract,
    private readonly imagingContract: HospitalImagingContract
  ) {}

  async completeImagingWorkflow(
    dto: HospitalImagingWorkflowDTO
  ): Promise<HospitalImagingRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.requestId, 'requestId');
    assertRequired(dto.approvalRequestId, 'approvalRequestId');
    assertRequired(dto.orderDetails.modalityCode, 'modalityCode');
    assertRequired(dto.orderDetails.bodyRegion, 'bodyRegion');
    assertRequired(dto.orderDetails.clinicalIndication, 'clinicalIndication');
    assertRequired(dto.radiologistReport, 'radiologistReport');
    assertRequired(dto.radiologistId, 'radiologistId');

    const created = await this.clinicalOrders.createClinicalOrder({
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      orderType: 'IMAGING',
      priority: dto.priority,
      orderDetails: dto.orderDetails,
      notes: dto.notes,
      actor: dto.actor,
    });
    assertImagingOrder(created.orderType);
    assertSame('tenantId', dto.tenantId, created.tenantId);
    assertSame('encounterId', dto.encounterId, created.encounterId);

    const approved = await this.clinicalOrders.approveClinicalOrder({
      requestId: dto.approvalRequestId,
      tenantId: dto.tenantId,
      orderId: created.orderId,
      actor: dto.actor,
    });
    assertImagingOrder(approved.orderType);
    assertSame('tenantId', dto.tenantId, approved.tenantId);
    assertSame('encounterId', dto.encounterId, approved.encounterId);
    assertSame('orderId', created.orderId, approved.orderId);

    const bootstrapped = await this.imagingContract.bootstrapImagingOrder({
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      orderId: approved.orderId,
      modalityCode: dto.orderDetails.modalityCode,
      bodyRegion: dto.orderDetails.bodyRegion,
      clinicalIndication: dto.orderDetails.clinicalIndication,
      withContrast: dto.orderDetails.withContrast,
    });
    assertBootstrapLinkage(dto, approved, bootstrapped);

    const verified = await this.imagingContract.recordImagingResult({
      tenantId: dto.tenantId,
      imagingOrderId: bootstrapped.imagingOrderId,
      radiologistReport: dto.radiologistReport,
      radiologistId: dto.radiologistId,
      verifiedAt: dto.verifiedAt,
    });
    assertSame('tenantId', dto.tenantId, verified.tenantId);
    assertSame('imagingOrderId', bootstrapped.imagingOrderId, verified.imagingOrderId);

    return {
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      orderId: approved.orderId,
      imagingOrderId: bootstrapped.imagingOrderId,
      modalityCode: bootstrapped.modalityCode,
      bodyRegion: bootstrapped.bodyRegion,
      orderStatus: approved.orderStatus,
      imagingWorkflowStatus: verified.status,
      resultStatus: verified.status,
      idempotency: {
        reusedExisting: bootstrapped.reusedExisting,
      },
      downstream: {
        temporal: 'NOT_PROVEN',
        auditEvidence: 'NOT_PROVEN',
        discharge: 'NOT_PROVEN',
        billing: 'NOT_PROVEN',
      },
    };
  }
}

function assertTenant(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
  }
}

function assertRequired(value: string | undefined, field: string): void {
  if (!value?.trim()) {
    throw new Error(`IMAGING_RUNTIME_VALIDATION_FAILED: ${field} is required`);
  }
}

function assertImagingOrder(orderType: HospitalClinicalOrderRuntimeDTO['orderType']): void {
  if (orderType !== 'IMAGING') {
    throw new Error(`IMAGING_RUNTIME_UNSUPPORTED_ORDER_TYPE: ${orderType}`);
  }
}

function assertSame(field: string, expected: string, actual: string): void {
  if (expected !== actual) {
    throw new Error(`IMAGING_RUNTIME_LINKAGE_MISMATCH: ${field}`);
  }
}

function assertBootstrapLinkage(
  dto: HospitalImagingWorkflowDTO,
  approved: HospitalClinicalOrderRuntimeDTO,
  bootstrapped: BootstrapImagingOrderResult
): void {
  assertSame('tenantId', dto.tenantId, bootstrapped.tenantId);
  assertSame('patientId', dto.patientId, bootstrapped.patientId);
  assertSame('encounterId', dto.encounterId, bootstrapped.encounterId);
  assertSame('orderId', approved.orderId, bootstrapped.orderId);
  assertSame('modalityCode', dto.orderDetails.modalityCode, bootstrapped.modalityCode);
  assertSame('bodyRegion', dto.orderDetails.bodyRegion, bootstrapped.bodyRegion);
}
