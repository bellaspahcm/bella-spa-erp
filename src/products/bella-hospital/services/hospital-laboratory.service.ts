/**
 * BELLA HOSPITAL - LABORATORY GO-LIVE PRODUCT SERVICE
 *
 * Minimal Hospital runtime orchestration for Clinical Order -> LabOrder
 * bootstrap -> Laboratory workflow -> result verification. This service
 * consumes only the sealed Hospital Clinical Orders boundary and the public
 * Healthcare Laboratory contract.
 *
 * It does not access Laboratory internals, repositories, direct DB tables, H9
 * Temporal, H11 Audit, Discharge, Billing, Finance, Real DB, or Browser E2E
 * surfaces.
 *
 * @module src/products/bella-hospital/services/hospital-laboratory.service
 */

import type {
  BootstrapLabOrderResult,
  ILaboratoryEngine,
} from '../../../platform/healthcare/contracts/laboratory-engine.contract';
import type {
  LabOrderDetails,
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

type HospitalLaboratoryContract = Pick<
  ILaboratoryEngine,
  | 'bootstrapLabOrder'
  | 'collectSpecimen'
  | 'receiveSpecimen'
  | 'startProcessing'
  | 'recordResult'
  | 'verifyResult'
>;

export interface HospitalLaboratoryOrderDTO {
  requestId: string;
  approvalRequestId: string;
  tenantId: string;
  patientId: string;
  encounterId: string;
  priority: OrderPriority;
  orderDetails: LabOrderDetails;
  notes?: string;
  actor: HospitalClinicalOrdersActorDTO;
}

export interface HospitalLaboratoryWorkflowDTO extends HospitalLaboratoryOrderDTO {
  sampleType: string;
  tubeColor: string;
  resultValue: string;
  resultUnit: string;
  verifiedBy: string;
}

export interface HospitalLaboratoryRuntimeDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  labOrderId: string;
  testCode: string;
  testName: string;
  orderStatus: HospitalClinicalOrderRuntimeDTO['orderStatus'];
  labWorkflowStatus: string;
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

export class HospitalLaboratoryProductService {
  constructor(
    private readonly clinicalOrders: HospitalClinicalOrdersRuntimeContract,
    private readonly laboratoryContract: HospitalLaboratoryContract
  ) {}

  async completeLaboratoryWorkflow(
    dto: HospitalLaboratoryWorkflowDTO
  ): Promise<HospitalLaboratoryRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.requestId, 'requestId');
    assertRequired(dto.approvalRequestId, 'approvalRequestId');
    assertRequired(dto.orderDetails.testCode, 'testCode');
    assertRequired(dto.orderDetails.testName, 'testName');
    assertRequired(dto.sampleType, 'sampleType');
    assertRequired(dto.tubeColor, 'tubeColor');
    assertRequired(dto.resultValue, 'resultValue');
    assertRequired(dto.resultUnit, 'resultUnit');
    assertRequired(dto.verifiedBy, 'verifiedBy');

    const created = await this.clinicalOrders.createClinicalOrder({
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      orderType: 'LAB',
      priority: dto.priority,
      orderDetails: dto.orderDetails,
      notes: dto.notes,
      actor: dto.actor,
    });
    assertLabOrder(created.orderType);
    assertSame('tenantId', dto.tenantId, created.tenantId);
    assertSame('encounterId', dto.encounterId, created.encounterId);

    const approved = await this.clinicalOrders.approveClinicalOrder({
      requestId: dto.approvalRequestId,
      tenantId: dto.tenantId,
      orderId: created.orderId,
      actor: dto.actor,
    });
    assertLabOrder(approved.orderType);
    assertSame('tenantId', dto.tenantId, approved.tenantId);
    assertSame('encounterId', dto.encounterId, approved.encounterId);
    assertSame('orderId', created.orderId, approved.orderId);

    const bootstrapped = await this.laboratoryContract.bootstrapLabOrder({
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      orderId: approved.orderId,
      testCode: dto.orderDetails.testCode,
      testName: dto.orderDetails.testName,
    });
    assertBootstrapLinkage(dto, approved, bootstrapped);

    await this.laboratoryContract.collectSpecimen(
      dto.tenantId,
      bootstrapped.labOrderId,
      dto.sampleType,
      dto.tubeColor
    );
    await this.laboratoryContract.receiveSpecimen(dto.tenantId, bootstrapped.labOrderId);
    await this.laboratoryContract.startProcessing(dto.tenantId, bootstrapped.labOrderId);
    await this.laboratoryContract.recordResult(
      dto.tenantId,
      bootstrapped.labOrderId,
      dto.resultValue,
      dto.resultUnit
    );
    const verified = await this.laboratoryContract.verifyResult(
      dto.tenantId,
      bootstrapped.labOrderId,
      dto.verifiedBy
    );

    assertSame('tenantId', dto.tenantId, verified.tenantId);
    assertSame('patientId', dto.patientId, verified.patientId);
    assertSame('encounterId', dto.encounterId, verified.encounterId);
    assertSame('orderId', approved.orderId, verified.clinicalOrderId);
    assertSame('labOrderId', bootstrapped.labOrderId, verified.id);

    if (verified.status !== 'VERIFIED') {
      throw new Error(`LABORATORY_RUNTIME_UNVERIFIED_RESULT: ${verified.status}`);
    }

    return {
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      orderId: approved.orderId,
      labOrderId: bootstrapped.labOrderId,
      testCode: bootstrapped.testCode,
      testName: bootstrapped.testName,
      orderStatus: approved.orderStatus,
      labWorkflowStatus: verified.status,
      resultStatus: 'VERIFIED',
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

function assertRequired(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`LABORATORY_RUNTIME_VALIDATION_FAILED: ${field} is required`);
  }
}

function assertLabOrder(orderType: HospitalClinicalOrderRuntimeDTO['orderType']): void {
  if (orderType !== 'LAB') {
    throw new Error(`LABORATORY_RUNTIME_UNSUPPORTED_ORDER_TYPE: ${orderType}`);
  }
}

function assertSame(field: string, expected: string, actual: string): void {
  if (expected !== actual) {
    throw new Error(`LABORATORY_RUNTIME_LINKAGE_MISMATCH: ${field}`);
  }
}

function assertBootstrapLinkage(
  dto: HospitalLaboratoryWorkflowDTO,
  approved: HospitalClinicalOrderRuntimeDTO,
  bootstrapped: BootstrapLabOrderResult
): void {
  assertSame('tenantId', dto.tenantId, bootstrapped.tenantId);
  assertSame('patientId', dto.patientId, bootstrapped.patientId);
  assertSame('encounterId', dto.encounterId, bootstrapped.encounterId);
  assertSame('orderId', approved.orderId, bootstrapped.orderId);
  assertSame('testCode', dto.orderDetails.testCode, bootstrapped.testCode);
  assertSame('testName', dto.orderDetails.testName, bootstrapped.testName);
}
