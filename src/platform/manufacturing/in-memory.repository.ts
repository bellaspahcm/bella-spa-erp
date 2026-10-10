import {
  ManufacturingAuthorizationError,
  ManufacturingIdempotencyConflictError,
} from './domain/errors';
import type {
  BOMRevision,
  CommandLogEntry,
  FactoryOrgUnitId,
  ManufacturingActor,
  ManufacturingId,
  ManufacturingPermission,
  MaterialRequirement,
  ProductionCompletion,
  ProductionExecution,
  ProductionOrder,
  ProductionOrderLine,
  TenantId,
} from './domain/types';
import type {
  ManufacturingAuthorizationPort,
  ManufacturingClock,
  ManufacturingIdFactory,
  ManufacturingRepository,
} from './ports';

export class SequentialManufacturingIdFactory implements ManufacturingIdFactory {
  private nextValue = 1;

  next(prefix: string): ManufacturingId {
    const id = `${prefix}_${this.nextValue.toString().padStart(6, '0')}`;
    this.nextValue += 1;
    return id;
  }
}

export class FixedManufacturingClock implements ManufacturingClock {
  constructor(private readonly timestamp: string = '2026-10-10T00:00:00.000Z') {}

  now(): string {
    return this.timestamp;
  }
}

export class InMemoryManufacturingRepository implements ManufacturingRepository {
  private readonly productionOrders = new Map<string, ProductionOrder>();
  private readonly bomRevisions = new Map<string, BOMRevision>();
  private readonly materialRequirements = new Map<string, MaterialRequirement>();
  private readonly productionExecutions = new Map<string, ProductionExecution>();
  private readonly productionCompletions = new Map<string, ProductionCompletion>();
  private readonly commandLogs = new Map<string, CommandLogEntry<unknown>>();

  async withTransaction<T>(callback: (repository: ManufacturingRepository) => Promise<T>): Promise<T> {
    return callback(this);
  }

  async saveProductionOrder(order: ProductionOrder): Promise<void> {
    this.productionOrders.set(this.key(order.tenantId, order.id), cloneProductionOrder(order));
  }

  async getProductionOrder(tenantId: TenantId, id: ManufacturingId): Promise<ProductionOrder | null> {
    const order = this.productionOrders.get(this.key(tenantId, id));
    return order ? cloneProductionOrder(order) : null;
  }

  async findProductionOrderByNumber(tenantId: TenantId, orderNumber: string): Promise<ProductionOrder | null> {
    for (const order of this.productionOrders.values()) {
      if (order.tenantId === tenantId && order.orderNumber === orderNumber) {
        return cloneProductionOrder(order);
      }
    }
    return null;
  }

  async getProductionOrderLine(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    productionOrderLineId: ManufacturingId;
  }): Promise<ProductionOrderLine | null> {
    const order = this.productionOrders.get(this.key(params.tenantId, params.productionOrderId));
    const line = order?.lines.find((candidate) => candidate.id === params.productionOrderLineId);
    return line ? { ...line } : null;
  }

  async saveBOMRevision(revision: BOMRevision): Promise<void> {
    this.bomRevisions.set(this.key(revision.tenantId, revision.id), {
      ...revision,
      components: revision.components.map((component) => ({ ...component })),
    });
  }

  async getBOMRevision(tenantId: TenantId, id: ManufacturingId): Promise<BOMRevision | null> {
    const revision = this.bomRevisions.get(this.key(tenantId, id));
    return revision
      ? { ...revision, components: revision.components.map((component) => ({ ...component })) }
      : null;
  }

  async findBOMRevisionByCode(params: {
    tenantId: TenantId;
    finishedGoodItemId: string;
    revisionCode: string;
  }): Promise<BOMRevision | null> {
    for (const revision of this.bomRevisions.values()) {
      if (
        revision.tenantId === params.tenantId &&
        revision.finishedGoodItemId === params.finishedGoodItemId &&
        revision.revisionCode === params.revisionCode
      ) {
        return { ...revision, components: revision.components.map((component) => ({ ...component })) };
      }
    }
    return null;
  }

  async saveMaterialRequirements(requirements: MaterialRequirement[]): Promise<void> {
    for (const requirement of requirements) {
      this.materialRequirements.set(this.key(requirement.tenantId, requirement.id), { ...requirement });
    }
  }

  async getMaterialRequirements(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
    bomRevisionId: ManufacturingId;
  }): Promise<MaterialRequirement[]> {
    return Array.from(this.materialRequirements.values())
      .filter(
        (requirement) =>
          requirement.tenantId === params.tenantId &&
          requirement.productionOrderId === params.productionOrderId &&
          requirement.bomRevisionId === params.bomRevisionId
      )
      .map((requirement) => ({ ...requirement }));
  }

  async saveProductionExecution(execution: ProductionExecution): Promise<void> {
    this.productionExecutions.set(this.key(execution.tenantId, execution.id), { ...execution });
  }

  async getProductionExecutions(params: {
    tenantId: TenantId;
    productionOrderId: ManufacturingId;
  }): Promise<ProductionExecution[]> {
    return Array.from(this.productionExecutions.values())
      .filter(
        (execution) =>
          execution.tenantId === params.tenantId &&
          execution.productionOrderId === params.productionOrderId
      )
      .map((execution) => ({ ...execution }));
  }

  async saveProductionCompletion(completion: ProductionCompletion): Promise<void> {
    this.productionCompletions.set(this.key(completion.tenantId, completion.productionOrderId), {
      ...completion,
      receiptEvidence: completion.receiptEvidence.map((receipt) => ({ ...receipt })),
    });
  }

  async getProductionCompletion(
    tenantId: TenantId,
    productionOrderId: ManufacturingId
  ): Promise<ProductionCompletion | null> {
    const completion = this.productionCompletions.get(this.key(tenantId, productionOrderId));
    return completion
      ? { ...completion, receiptEvidence: completion.receiptEvidence.map((receipt) => ({ ...receipt })) }
      : null;
  }

  async getCommandLog<T = unknown>(params: {
    tenantId: TenantId;
    operation: string;
    businessKey: string;
  }): Promise<CommandLogEntry<T> | null> {
    const entry = this.commandLogs.get(this.commandKey(params.tenantId, params.operation, params.businessKey));
    return entry ? (entry as CommandLogEntry<T>) : null;
  }

  async saveCommandLog<T>(entry: CommandLogEntry<T>): Promise<void> {
    const key = this.commandKey(entry.tenantId, entry.operation, entry.businessKey);
    const existing = this.commandLogs.get(key);
    if (existing && existing.payloadHash !== entry.payloadHash) {
      throw new ManufacturingIdempotencyConflictError();
    }
    this.commandLogs.set(key, entry);
  }

  private key(tenantId: TenantId, id: ManufacturingId): string {
    return `${tenantId}:${id}`;
  }

  private commandKey(tenantId: TenantId, operation: string, businessKey: string): string {
    return `${tenantId}:${operation}:${businessKey}`;
  }
}

function cloneProductionOrder(order: ProductionOrder): ProductionOrder {
  return {
    ...order,
    lines: order.lines.map((line) => ({ ...line })),
  };
}

export class StaticManufacturingAuthorization implements ManufacturingAuthorizationPort {
  constructor(
    private readonly allowedFactoryByUser: Record<string, FactoryOrgUnitId>,
    private readonly permissionsByUser: Record<string, ManufacturingPermission[]>
  ) {}

  async ensureAllowed(params: {
    actor: ManufacturingActor;
    tenantId: TenantId;
    factoryOrgUnitId: FactoryOrgUnitId;
    permission: ManufacturingPermission;
  }): Promise<void> {
    const allowedFactory = this.allowedFactoryByUser[params.actor.userId];
    const permissions = this.permissionsByUser[params.actor.userId] ?? [];
    if (
      params.actor.tenantId !== params.tenantId ||
      params.actor.factoryOrgUnitId !== params.factoryOrgUnitId ||
      allowedFactory !== params.factoryOrgUnitId ||
      !permissions.includes(params.permission)
    ) {
      throw new ManufacturingAuthorizationError();
    }
  }
}
