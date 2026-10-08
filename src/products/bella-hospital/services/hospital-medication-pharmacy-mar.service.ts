/**
 * BELLA HOSPITAL - MEDICATION / PHARMACY / MAR GO-LIVE PRODUCT SERVICE
 *
 * Minimal Hospital runtime orchestration for Medication Order -> Pharmacy
 * Fulfillment -> Medication Administration Record. This service consumes only
 * the sealed Hospital Clinical Orders boundary and the public Healthcare
 * Pharmacy Engine contract.
 *
 * It does not access Pharmacy internals, direct DB tables, CDS internals,
 * Nursing, Lab/Imaging, Billing, Finance, Real DB, or Browser E2E surfaces.
 *
 * @module src/products/bella-hospital/services/hospital-medication-pharmacy-mar.service
 */

import type {
  MedicationOrderDetails,
  OrderPriority,
} from '../../../platform/healthcare/contracts/order-engine.contract';
import type {
  MARAdministrationRequest,
  PharmacyEngineContract,
} from '../../../platform/healthcare/contracts/pharmacy-engine.contract';
import type { EngineResponse, MedicationOrder } from '../../../platform/healthcare/shared-kernel/types';
import type {
  HospitalClinicalOrdersActorDTO,
  HospitalClinicalOrderRuntimeDTO,
  HospitalClinicalOrdersProductService,
} from './hospital-clinical-orders.service';

type HospitalClinicalOrdersRuntimeContract = Pick<
  HospitalClinicalOrdersProductService,
  'createClinicalOrder' | 'approveClinicalOrder'
>;

type HospitalPharmacyMarContract = Pick<
  PharmacyEngineContract,
  'verifyPrescription' | 'dispenseMedication' | 'recordMedicationAdministration'
>;

export interface HospitalMedicationOrderDTO {
  requestId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  priority: OrderPriority;
  orderDetails: MedicationOrderDetails;
  notes?: string;
  actor: HospitalClinicalOrdersActorDTO;
}

export interface HospitalMedicationOrderContextDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  orderStatus: HospitalClinicalOrderRuntimeDTO['orderStatus'];
}

export interface HospitalMedicationFulfillmentDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  orderType: HospitalClinicalOrderRuntimeDTO['orderType'];
  pharmacistId: string;
  overrides?: Array<{ warningCode: string; rationale: string; policyVersion?: string }>;
}

export interface HospitalMedicationFulfillmentResultDTO extends HospitalMedicationOrderContextDTO {
  verificationId: string;
  verificationStatus: string;
  safetyState: string;
  dispensedMedicationStatus: MedicationOrder['status'];
  dispensedBy: string;
}

export interface HospitalMedicationAdministrationDTO {
  tenantId: string;
  patientId: string;
  encounterId: string;
  orderId: string;
  administeredBy: string;
  administeredAt: string;
  dosageGiven: MARAdministrationRequest['dosageGiven'];
  route: string;
  site?: string;
  notes?: string;
}

export interface HospitalMedicationAdministrationResultDTO extends HospitalMedicationOrderContextDTO {
  medicationAdministrationId: string;
  administeredBy: string;
  administeredAt: string;
  eventType: 'MedicationAdministered';
}

export interface HospitalMedicationPharmacyMarChainDTO
  extends HospitalMedicationOrderDTO {
  approvalRequestId: string;
  pharmacistId: string;
  administeredBy: string;
  administeredAt: string;
  dosageGiven: MARAdministrationRequest['dosageGiven'];
  route: string;
  site?: string;
  administrationNotes?: string;
  overrides?: Array<{ warningCode: string; rationale: string; policyVersion?: string }>;
}

export interface HospitalMedicationPharmacyMarRuntimeDTO {
  medicationOrder: HospitalMedicationOrderContextDTO;
  pharmacy: HospitalMedicationFulfillmentResultDTO;
  mar: HospitalMedicationAdministrationResultDTO;
  downstream: {
    discharge: 'NOT_PROVEN';
    temporal: 'NOT_PROVEN';
    auditEvidence: 'NOT_PROVEN';
    billing: 'NOT_PROVEN';
  };
}

export class HospitalMedicationPharmacyMarProductService {
  constructor(
    private readonly clinicalOrders: HospitalClinicalOrdersRuntimeContract,
    private readonly pharmacyContract: HospitalPharmacyMarContract
  ) {}

  async createMedicationOrder(dto: HospitalMedicationOrderDTO): Promise<HospitalMedicationOrderContextDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.requestId, 'requestId');

    const created = await this.clinicalOrders.createClinicalOrder({
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      orderType: 'MEDICATION',
      priority: dto.priority,
      orderDetails: dto.orderDetails,
      notes: dto.notes,
      actor: dto.actor,
    });

    assertMedicationOrder(created.orderType);
    assertSame('tenantId', dto.tenantId, created.tenantId);
    assertSame('encounterId', dto.encounterId, created.encounterId);

    return {
      tenantId: created.tenantId,
      patientId: dto.patientId,
      encounterId: created.encounterId,
      orderId: created.orderId,
      orderStatus: created.orderStatus,
    };
  }

  async approveMedicationOrder(params: {
    requestId: string;
    tenantId: string;
    patientId: string;
    encounterId: string;
    orderId: string;
    actor: HospitalClinicalOrdersActorDTO;
  }): Promise<HospitalMedicationOrderContextDTO> {
    assertTenant(params.tenantId);
    assertRequired(params.patientId, 'patientId');
    assertRequired(params.encounterId, 'encounterId');
    assertRequired(params.orderId, 'orderId');
    assertRequired(params.requestId, 'requestId');

    const approved = await this.clinicalOrders.approveClinicalOrder({
      requestId: params.requestId,
      tenantId: params.tenantId,
      orderId: params.orderId,
      actor: params.actor,
    });

    assertMedicationOrder(approved.orderType);
    assertSame('tenantId', params.tenantId, approved.tenantId);
    assertSame('encounterId', params.encounterId, approved.encounterId);
    assertSame('orderId', params.orderId, approved.orderId);

    return {
      tenantId: approved.tenantId,
      patientId: params.patientId,
      encounterId: approved.encounterId,
      orderId: approved.orderId,
      orderStatus: approved.orderStatus,
    };
  }

  async fulfillMedicationOrder(
    dto: HospitalMedicationFulfillmentDTO
  ): Promise<HospitalMedicationFulfillmentResultDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.orderId, 'orderId');
    assertRequired(dto.pharmacistId, 'pharmacistId');
    assertMedicationOrder(dto.orderType);

    const verification = unwrapRequiredEngineResponse(
      await this.pharmacyContract.verifyPrescription({
        tenantId: dto.tenantId,
        medicationOrderId: dto.orderId,
        pharmacistId: dto.pharmacistId,
        overrides: dto.overrides,
      }),
      'PHARMACY_VERIFY_FAILED'
    );

    const dispensed = unwrapRequiredEngineResponse(
      await this.pharmacyContract.dispenseMedication({
        tenantId: dto.tenantId,
        medicationOrderId: dto.orderId,
        dispensedBy: dto.pharmacistId,
      }),
      'PHARMACY_DISPENSE_FAILED'
    );

    assertMedicationLinkage({
      expectedTenantId: dto.tenantId,
      expectedPatientId: dto.patientId,
      expectedEncounterId: dto.encounterId,
      expectedOrderId: dto.orderId,
      medicationOrder: dispensed,
    });

    return {
      tenantId: dispensed.tenantId,
      patientId: dispensed.patientId,
      encounterId: dispensed.encounterId,
      orderId: dispensed.id,
      orderStatus: 'APPROVED',
      verificationId: verification.id,
      verificationStatus: verification.status,
      safetyState: verification.safetyState,
      dispensedMedicationStatus: dispensed.status,
      dispensedBy: dto.pharmacistId,
    };
  }

  async recordMedicationAdministration(
    dto: HospitalMedicationAdministrationDTO
  ): Promise<HospitalMedicationAdministrationResultDTO> {
    assertTenant(dto.tenantId);
    assertRequired(dto.patientId, 'patientId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.orderId, 'orderId');
    assertRequired(dto.administeredBy, 'administeredBy');
    assertRequired(dto.administeredAt, 'administeredAt');
    assertRequired(dto.route, 'route');

    const mar = unwrapRequiredEngineResponse(
      await this.pharmacyContract.recordMedicationAdministration({
        tenantId: dto.tenantId,
        encounterId: dto.encounterId,
        patientId: dto.patientId,
        medicationOrderId: dto.orderId,
        administeredBy: dto.administeredBy,
        administeredAt: dto.administeredAt,
        dosageGiven: dto.dosageGiven,
        route: dto.route,
        site: dto.site,
        notes: dto.notes,
      }),
      'MAR_ADMINISTRATION_FAILED'
    );

    return {
      tenantId: dto.tenantId,
      patientId: dto.patientId,
      encounterId: dto.encounterId,
      orderId: dto.orderId,
      orderStatus: 'APPROVED',
      medicationAdministrationId: mar.id,
      administeredBy: dto.administeredBy,
      administeredAt: dto.administeredAt,
      eventType: 'MedicationAdministered',
    };
  }

  async completeMedicationPharmacyMarChain(
    dto: HospitalMedicationPharmacyMarChainDTO
  ): Promise<HospitalMedicationPharmacyMarRuntimeDTO> {
    const medicationOrder = await this.createMedicationOrder(dto);
    const approvedOrder = await this.approveMedicationOrder({
      requestId: dto.approvalRequestId,
      tenantId: medicationOrder.tenantId,
      patientId: medicationOrder.patientId,
      encounterId: medicationOrder.encounterId,
      orderId: medicationOrder.orderId,
      actor: dto.actor,
    });
    const pharmacy = await this.fulfillMedicationOrder({
      tenantId: approvedOrder.tenantId,
      patientId: approvedOrder.patientId,
      encounterId: approvedOrder.encounterId,
      orderId: approvedOrder.orderId,
      orderType: 'MEDICATION',
      pharmacistId: dto.pharmacistId,
      overrides: dto.overrides,
    });
    const mar = await this.recordMedicationAdministration({
      tenantId: pharmacy.tenantId,
      patientId: pharmacy.patientId,
      encounterId: pharmacy.encounterId,
      orderId: pharmacy.orderId,
      administeredBy: dto.administeredBy,
      administeredAt: dto.administeredAt,
      dosageGiven: dto.dosageGiven,
      route: dto.route,
      site: dto.site,
      notes: dto.administrationNotes,
    });

    return {
      medicationOrder: approvedOrder,
      pharmacy,
      mar,
      downstream: {
        discharge: 'NOT_PROVEN',
        temporal: 'NOT_PROVEN',
        auditEvidence: 'NOT_PROVEN',
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
    throw new Error(`MEDICATION_PHARMACY_MAR_VALIDATION_FAILED: ${field} is required`);
  }
}

function assertMedicationOrder(orderType: HospitalClinicalOrderRuntimeDTO['orderType']): void {
  if (orderType !== 'MEDICATION') {
    throw new Error(`MEDICATION_PHARMACY_MAR_UNSUPPORTED_ORDER_TYPE: ${orderType}`);
  }
}

function assertSame(field: string, expected: string, actual: string): void {
  if (expected !== actual) {
    throw new Error(`MEDICATION_PHARMACY_MAR_LINKAGE_MISMATCH: ${field}`);
  }
}

function assertMedicationLinkage(params: {
  expectedTenantId: string;
  expectedPatientId: string;
  expectedEncounterId: string;
  expectedOrderId: string;
  medicationOrder: MedicationOrder;
}): void {
  assertSame('tenantId', params.expectedTenantId, params.medicationOrder.tenantId);
  assertSame('patientId', params.expectedPatientId, params.medicationOrder.patientId);
  assertSame('encounterId', params.expectedEncounterId, params.medicationOrder.encounterId);
  assertSame('orderId', params.expectedOrderId, params.medicationOrder.id);
}

function unwrapRequiredEngineResponse<T>(response: EngineResponse<T>, fallbackCode: string): T {
  if (response.success && response.data !== undefined) {
    return response.data;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}
