import type { ItemId, LocationId, Quantity } from '../../logistics/contracts/inventory.contract';

export type ManufacturingId = string;
export type TenantId = string;
export type UserId = string;
export type FactoryOrgUnitId = string;

export type ProductionOrderStatus = 'draft' | 'released' | 'in_progress' | 'completed' | 'cancelled';
export type BOMRevisionStatus = 'draft' | 'approved' | 'archived';
export type MaterialRequirementStatus = 'not_checked' | 'available' | 'shortage' | 'not_proven';
export type QualityDisposition =
  | 'accepted'
  | 'conditional_accept'
  | 'rework'
  | 'scrap'
  | 'discard_reject'
  | 'pending';
export type QualityDispositionSourceQuantityType = 'accepted' | 'rejected' | 'scrap' | 'pending';
export type ManufacturingPermission =
  | 'manufacturing:production_order:write'
  | 'manufacturing:production_order:release'
  | 'manufacturing:production_order:complete'
  | 'manufacturing:bom:write'
  | 'manufacturing:bom:approve'
  | 'manufacturing:material_requirement:calculate'
  | 'manufacturing:availability:read'
  | 'manufacturing:execution:record'
  | 'manufacturing:quality_disposition:record';

export interface ManufacturingActor {
  tenantId: TenantId;
  userId: UserId;
  roles: string[];
  factoryOrgUnitId: FactoryOrgUnitId;
}

export interface ProductionOrder {
  id: ManufacturingId;
  tenantId: TenantId;
  factoryOrgUnitId: FactoryOrgUnitId;
  orderNumber: string;
  finishedGoodItemId: ItemId;
  targetQuantity: Quantity;
  uom: string;
  status: ProductionOrderStatus;
  lines: ProductionOrderLine[];
  bomRevisionId?: ManufacturingId;
  createdBy: UserId;
  createdAt: string;
  releasedBy?: UserId;
  releasedAt?: string;
  completedBy?: UserId;
  completedAt?: string;
}

export interface ProductionOrderLine {
  id: ManufacturingId;
  tenantId: TenantId;
  productionOrderId: ManufacturingId;
  finishedGoodItemId: ItemId;
  targetQuantity: Quantity;
  uom: string;
}

export interface BOMRevision {
  id: ManufacturingId;
  tenantId: TenantId;
  finishedGoodItemId: ItemId;
  revisionCode: string;
  status: BOMRevisionStatus;
  components: BOMComponent[];
  createdBy: UserId;
  createdAt: string;
  approvedBy?: UserId;
  approvedAt?: string;
}

export interface BOMComponent {
  id: ManufacturingId;
  componentItemId: ItemId;
  quantityPerUnit: Quantity;
  uom: string;
  scrapAllowancePercent?: number;
}

export interface MaterialRequirement {
  id: ManufacturingId;
  tenantId: TenantId;
  productionOrderId: ManufacturingId;
  bomRevisionId: ManufacturingId;
  componentItemId: ItemId;
  sourceLocationId: LocationId;
  requiredQuantity: Quantity;
  availableQuantity?: Quantity;
  status: MaterialRequirementStatus;
  checkedAt?: string;
}

export interface ProductionExecution {
  id: ManufacturingId;
  tenantId: TenantId;
  factoryOrgUnitId: FactoryOrgUnitId;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  materialIssueDocumentId: string;
  materialIssueMovementId: string;
  materialRequirementId?: ManufacturingId;
  actualQuantity: Quantity;
  acceptedQuantity: Quantity;
  rejectedQuantity: Quantity;
  scrapQuantity: Quantity;
  uom: string;
  recordedBy: UserId;
  recordedAt: string;
}

export interface MaterialIssueLogisticsEvidence {
  issueDocumentId: string;
  movementId: string;
  traceabilityEventId: string;
  itemId: ItemId;
  locationId: LocationId;
  quantity: Quantity;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  materialRequirementId?: ManufacturingId;
}

export interface FinishedGoodsReceiptLogisticsEvidence {
  receiptDocumentId: string;
  receiptLineId: string;
  movementId: string;
  traceabilityEventId: string;
  itemId: ItemId;
  locationId: LocationId;
  quantity: Quantity;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  acceptedQuantity: Quantity;
  rejectedQuantity?: Quantity;
  pendingQuantity?: Quantity;
}

export interface FinishedGoodsReceiptEvidence {
  productionOrderLineId: ManufacturingId;
  receiptDocumentId: string;
  receiptLineId: string;
  acceptedQuantity: Quantity;
  rejectedQuantity?: Quantity;
  pendingQuantity?: Quantity;
  logisticsEvidence: FinishedGoodsReceiptLogisticsEvidence;
}

export interface QualityDispositionEvidence {
  id: ManufacturingId;
  tenantId: TenantId;
  factoryOrgUnitId: FactoryOrgUnitId;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  productionExecutionId: ManufacturingId;
  receiptDocumentId?: string;
  receiptLineId?: string;
  sourceQuantityType: QualityDispositionSourceQuantityType;
  disposition: QualityDisposition;
  quantity: Quantity;
  acceptedOutputQuantity: Quantity;
  reasonCode?: string;
  reasonText?: string;
  evidenceReference?: string;
  finalHandlingDecision?: boolean;
  conditionalAcceptPolicyApproved?: boolean;
  terminal: boolean;
  decidedBy: UserId;
  decidedAt: string;
}

export interface ProductionCompletion {
  id: ManufacturingId;
  tenantId: TenantId;
  factoryOrgUnitId: FactoryOrgUnitId;
  productionOrderId: ManufacturingId;
  completedQuantity: Quantity;
  rejectedQuantity: Quantity;
  scrapQuantity: Quantity;
  uom: string;
  receiptEvidence: FinishedGoodsReceiptEvidence[];
  qualityDispositionEvidence: QualityDispositionEvidence[];
  completedBy: UserId;
  completedAt: string;
}

export interface CommandLogEntry<T = unknown> {
  tenantId: TenantId;
  factoryOrgUnitId: FactoryOrgUnitId;
  operation: string;
  businessKey: string;
  payloadHash: string;
  result: T;
  createdAt: string;
}

export interface CreateProductionOrderCommand {
  idempotencyKey: string;
  orderNumber: string;
  finishedGoodItemId: ItemId;
  targetQuantity: Quantity;
  uom: string;
}

export interface CreateBOMRevisionCommand {
  idempotencyKey: string;
  finishedGoodItemId: ItemId;
  revisionCode: string;
  components: Array<{
    componentItemId: ItemId;
    quantityPerUnit: Quantity;
    uom: string;
    scrapAllowancePercent?: number;
  }>;
}

export interface ApproveBOMRevisionCommand {
  idempotencyKey: string;
  bomRevisionId: ManufacturingId;
}

export interface CalculateMaterialRequirementsCommand {
  idempotencyKey: string;
  productionOrderId: ManufacturingId;
  bomRevisionId: ManufacturingId;
  sourceLocationId: LocationId;
}

export interface ReleaseProductionOrderCommand {
  idempotencyKey: string;
  productionOrderId: ManufacturingId;
  bomRevisionId: ManufacturingId;
}

export interface RecordProductionExecutionCommand {
  idempotencyKey: string;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  materialIssueDocumentId: string;
  materialIssueMovementId: string;
  materialIssueEvidence: MaterialIssueLogisticsEvidence;
  materialRequirementId?: ManufacturingId;
  actualQuantity: Quantity;
  acceptedQuantity: Quantity;
  rejectedQuantity?: Quantity;
  scrapQuantity?: Quantity;
  uom: string;
}

export interface RecordQualityDispositionCommand {
  idempotencyKey: string;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  productionExecutionId: ManufacturingId;
  receiptDocumentId?: string;
  receiptLineId?: string;
  sourceQuantityType: QualityDispositionSourceQuantityType;
  disposition: QualityDisposition;
  quantity: Quantity;
  acceptedOutputQuantity: Quantity;
  reasonCode?: string;
  reasonText?: string;
  evidenceReference?: string;
  finalHandlingDecision?: boolean;
  conditionalAcceptPolicyApproved?: boolean;
}

export interface CompleteProductionOrderCommand {
  idempotencyKey: string;
  productionOrderId: ManufacturingId;
  receiptEvidence: FinishedGoodsReceiptEvidence[];
}

export interface IdempotentCommandResult<T> {
  value: T;
  isDuplicate: boolean;
}
