import type { IInventoryBalanceQuery, LocationId, Quantity } from '../logistics/contracts/inventory.contract';
import type {
  BOMRevision,
  CommandLogEntry,
  FactoryOrgUnitId,
  ManufacturingActor,
  ManufacturingId,
  ManufacturingPermission,
  MaterialRequirement,
  ProductionOrder,
  TenantId,
} from './domain/types';

export interface ManufacturingAuthorizationPort {
  ensureAllowed(params: {
    actor: ManufacturingActor;
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    permission: ManufacturingPermission;
  }): Promise<void>;
}

export interface ManufacturingRepository {
  withTransaction<T>(callback: (repository: ManufacturingRepository) => Promise<T>): Promise<T>;
  saveProductionOrder(order: ProductionOrder): Promise<void>;
  getProductionOrder(tenantId: TenantId, id: ManufacturingId): Promise<ProductionOrder | null>;
  findProductionOrderByNumber(tenantId: TenantId, orderNumber: string): Promise<ProductionOrder | null>;
  saveBOMRevision(revision: BOMRevision): Promise<void>;
  getBOMRevision(tenantId: TenantId, id: ManufacturingId): Promise<BOMRevision | null>;
  findBOMRevisionByCode(params: {
    tenantId: TenantId;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<BOMRevision | null>;
  saveMaterialRequirements(requirements: MaterialRequirement[]): Promise<void>;
  getMaterialRequirements(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    bomRevisionId: ManufacturingId;
  }): Promise<MaterialRequirement[]>;
  getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null>;
  saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void>;
}

export interface ManufacturingIdFactory {
  next(prefix: string): ManufacturingId;
}

export interface ManufacturingClock {
  now(): string;
}

export interface MaterialAvailabilityPort {
  getAvailable(params: {
    tenantId: TenantId;
    itemId: string;
    locationId: LocationId;
  }): Promise<Quantity>;
}

export class LogisticsMaterialAvailabilityAdapter implements MaterialAvailabilityPort {
  constructor(private readonly inventory: IInventoryBalanceQuery) {}

  getAvailable(params: { tenantId: TenantId; itemId: string; locationId: LocationId }): Promise<Quantity> {
    return this.inventory.getAvailable({
      tenant_id: params.tenantId,
      item_id: params.itemId,
      location_id: params.locationId,
    });
  }
}
