import type { ItemId, LocationId, Quantity } from '../../logistics/contracts/inventory.contract';

export type ManufacturingId = string;
export type TenantId = string;
export type UserId = string;
export type FactoryOrgUnitId = string;

export type ProductionOrderStatus = 'draft' | 'released' | 'cancelled';
export type BOMRevisionStatus = 'draft' | 'approved' | 'archived';
export type MaterialRequirementStatus = 'not_checked' | 'available' | 'shortage' | 'not_proven';
export type ManufacturingPermission =
  | 'manufacturing:production_order:write'
  | 'manufacturing:production_order:release'
  | 'manufacturing:bom:write'
  | 'manufacturing:bom:approve'
  | 'manufacturing:material_requirement:calculate'
  | 'manufacturing:availability:read';

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
  bomRevisionId?: ManufacturingId;
  createdBy: UserId;
  createdAt: string;
  releasedBy?: UserId;
  releasedAt?: string;
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

export interface IdempotentCommandResult<T> {
  value: T;
  isDuplicate: boolean;
}
