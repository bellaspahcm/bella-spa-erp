import type { IInventoryBalanceQuery, LocationId, Quantity } from '../logistics/contracts/inventory.contract';
import type { WarehouseStockOutCommand, WarehouseStockOutResult } from '../logistics/warehouse/stock-out-canonical.facade';
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

export interface ProductionConsumptionIssueRequest {
  tenantId: TenantId;
  actorId: string;
  correlationId?: string;
  productionOrderId: ManufacturingId;
  productionOrderLineId: ManufacturingId;
  idempotencyKey: string;
  issueDocumentId: string;
  issueDocumentNumber?: string;
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: string;
  locationId: LocationId;
  quantity: Quantity;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  materialRequirementId?: ManufacturingId;
}

export interface ProductionConsumptionIssuePort {
  issue(request: ProductionConsumptionIssueRequest): Promise<WarehouseStockOutResult>;
}

export interface LogisticsStockOutContract {
  execute(command: WarehouseStockOutCommand): Promise<WarehouseStockOutResult>;
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

export class LogisticsProductionConsumptionIssueAdapter implements ProductionConsumptionIssuePort {
  constructor(private readonly stockOut: LogisticsStockOutContract) {}

  issue(request: ProductionConsumptionIssueRequest): Promise<WarehouseStockOutResult> {
    const command: WarehouseStockOutCommand = {
      tenantId: request.tenantId,
      actorId: request.actorId,
      correlationId: request.correlationId,
      issueDocument: {
        id: request.issueDocumentId,
        number: request.issueDocumentNumber,
        type: 'production_consumption',
      },
      productionConsumptionReference: {
        productionOrderId: request.productionOrderId,
        productionOrderLineId: request.productionOrderLineId,
        idempotencyKey: request.idempotencyKey,
      },
      lines: [
        {
          warehouseSkuId: request.warehouseSkuId,
          warehouseBinId: request.warehouseBinId,
          itemId: request.itemId,
          locationId: request.locationId,
          quantity: request.quantity,
          unitOfMeasure: request.unitOfMeasure,
          reason: 'production_consumption',
          lotNumber: request.lotNumber,
          serialNumbers: request.serialNumbers,
          sourceLineId: request.materialRequirementId,
          metadata: {
            production_order_id: request.productionOrderId,
            production_order_line_id: request.productionOrderLineId,
            material_requirement_id: request.materialRequirementId,
          },
        },
      ],
    };
    return this.stockOut.execute(command);
  }
}
