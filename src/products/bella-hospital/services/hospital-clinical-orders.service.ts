/**
 * BELLA HOSPITAL - CLINICAL ORDERS GO-LIVE PRODUCT SERVICE
 *
 * Minimal Hospital runtime integration with the public Healthcare Order Engine
 * contract. This service does not access Order Engine internals, direct DB
 * tables, CDS internals, Nursing, Pharmacy, Lab/Imaging, Billing, or Finance.
 *
 * @module src/products/bella-hospital/services/hospital-clinical-orders.service
 */

import type {
  ApproveOrderRequest,
  ClinicalOrder,
  CreateOrderRequest,
  CreateOrderResult,
  GetActiveOrdersRequest,
  OrderEngineContract,
  OrderPriority,
  OrderStatus,
  OrderType,
} from '../../../platform/healthcare/contracts/order-engine.contract';
import type { EngineResponse } from '../../../platform/healthcare/shared-kernel/types';

export type HospitalClinicalOrdersActorRole = 'nurse' | 'doctor' | 'admin';

export interface HospitalClinicalOrdersActorDTO {
  actorId: string;
  role: HospitalClinicalOrdersActorRole;
}

export interface HospitalCreateClinicalOrderDTO {
  requestId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  orderType: OrderType;
  priority: OrderPriority;
  orderDetails: CreateOrderRequest['orderDetails'];
  notes?: string;
  actor: HospitalClinicalOrdersActorDTO;
}

export interface HospitalApproveClinicalOrderDTO {
  requestId: string;
  tenantId: string;
  orderId: string;
  actor: HospitalClinicalOrdersActorDTO;
}

export interface HospitalGetActiveClinicalOrdersDTO {
  tenantId: string;
  encounterId: string;
  orderType?: OrderType;
  actor: HospitalClinicalOrdersActorDTO;
}

export interface HospitalClinicalOrderRuntimeDTO {
  tenantId: string;
  orderId: string;
  encounterId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  priority: OrderPriority;
  orderedBy: string;
  orderedAt: string;
  cdsCheckStatus?: CreateOrderResult['cdsCheckStatus'];
  cdsAlertsCount?: number;
}

type HospitalClinicalOrdersContract = Pick<
  OrderEngineContract,
  'createOrder' | 'approveOrder' | 'getActiveOrders'
>;

export class HospitalClinicalOrdersProductService {
  constructor(private readonly orderContract: HospitalClinicalOrdersContract) {}

  async createClinicalOrder(
    dto: HospitalCreateClinicalOrderDTO
  ): Promise<HospitalClinicalOrderRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'createOrder');
    assertRequired(dto.requestId, 'requestId');
    assertRequired(dto.encounterId, 'encounterId');
    assertRequired(dto.patientId, 'patientId');

    const request: CreateOrderRequest = {
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      patientId: dto.patientId,
      orderType: dto.orderType,
      priority: dto.priority,
      orderedBy: dto.actor.actorId,
      orderDetails: dto.orderDetails,
      notes: dto.notes,
    };

    const result = unwrapRequiredEngineResponse(
      await this.orderContract.createOrder(request),
      'CLINICAL_ORDER_CREATE_FAILED'
    );

    return mapCreatedOrder(result);
  }

  async approveClinicalOrder(
    dto: HospitalApproveClinicalOrderDTO
  ): Promise<HospitalClinicalOrderRuntimeDTO> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'approveOrder');
    assertRequired(dto.requestId, 'requestId');
    assertRequired(dto.orderId, 'orderId');

    const request: ApproveOrderRequest = {
      requestId: dto.requestId,
      tenantId: dto.tenantId,
      orderId: dto.orderId,
      approvedBy: dto.actor.actorId,
    };

    const order = unwrapRequiredEngineResponse(
      await this.orderContract.approveOrder(request),
      'CLINICAL_ORDER_APPROVE_FAILED'
    );

    return mapOrder(order);
  }

  async getActiveClinicalOrders(
    dto: HospitalGetActiveClinicalOrdersDTO
  ): Promise<HospitalClinicalOrderRuntimeDTO[]> {
    assertTenant(dto.tenantId);
    assertActor(dto.actor);
    assertAuthorized(dto.actor.role, 'getActiveOrders');
    assertRequired(dto.encounterId, 'encounterId');

    const request: GetActiveOrdersRequest = {
      tenantId: dto.tenantId,
      encounterId: dto.encounterId,
      orderType: dto.orderType,
    };

    const orders = unwrapRequiredEngineResponse(
      await this.orderContract.getActiveOrders(request),
      'CLINICAL_ORDER_GET_ACTIVE_FAILED'
    );

    return orders.map(mapOrder);
  }
}

function assertTenant(tenantId: string): void {
  if (!tenantId.trim()) {
    throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
  }
}

function assertActor(actor: HospitalClinicalOrdersActorDTO): void {
  if (!actor.actorId.trim()) {
    throw new Error('AUTHORIZATION_VIOLATION: actorId is required');
  }
}

function assertAuthorized(role: HospitalClinicalOrdersActorRole, operation: string): void {
  const allowedByOperation: Record<string, HospitalClinicalOrdersActorRole[]> = {
    createOrder: ['nurse', 'doctor', 'admin'],
    approveOrder: ['doctor', 'admin'],
    getActiveOrders: ['nurse', 'doctor', 'admin'],
  };
  const allowedRoles = allowedByOperation[operation] ?? [];

  if (!allowedRoles.includes(role)) {
    throw new Error(`AUTHORIZATION_VIOLATION: ${role} cannot ${operation}`);
  }
}

function assertRequired(value: string, field: string): void {
  if (!value.trim()) {
    throw new Error(`CLINICAL_ORDER_VALIDATION_FAILED: ${field} is required`);
  }
}

function mapCreatedOrder(result: CreateOrderResult): HospitalClinicalOrderRuntimeDTO {
  return {
    ...mapOrder(result.order),
    cdsCheckStatus: result.cdsCheckStatus,
    cdsAlertsCount: result.cdsAlerts.length,
  };
}

function mapOrder(order: ClinicalOrder): HospitalClinicalOrderRuntimeDTO {
  return {
    tenantId: order.tenantId,
    orderId: order.id,
    encounterId: order.encounterId,
    orderType: order.orderType,
    orderStatus: order.orderStatus,
    priority: order.priority,
    orderedBy: order.orderedBy,
    orderedAt: order.orderedAt,
    cdsCheckStatus: order.cdsCheckStatus,
  };
}

function unwrapRequiredEngineResponse<T>(response: EngineResponse<T>, fallbackCode: string): T {
  if (response.success && response.data !== undefined) {
    return response.data;
  }

  const code = response.error?.code ?? fallbackCode;
  const message = response.error?.message ?? fallbackCode;
  throw new Error(`${code}: ${message}`);
}
