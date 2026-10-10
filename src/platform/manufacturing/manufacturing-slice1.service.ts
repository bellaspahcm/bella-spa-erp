import {
  ManufacturingIdempotencyConflictError,
  ManufacturingNotFoundError,
  ManufacturingStateError,
  ManufacturingValidationError,
} from './domain/errors';
import type {
  ApproveBOMRevisionCommand,
  BOMRevision,
  CalculateMaterialRequirementsCommand,
  CreateBOMRevisionCommand,
  CreateProductionOrderCommand,
  IdempotentCommandResult,
  ManufacturingActor,
  MaterialRequirement,
  ReleaseProductionOrderCommand,
  ProductionOrder,
} from './domain/types';
import type {
  ManufacturingAuthorizationPort,
  ManufacturingClock,
  ManufacturingIdFactory,
  ManufacturingRepository,
  MaterialAvailabilityPort,
} from './ports';

type CommandPayload = unknown;

export class ManufacturingSlice1Service {
  constructor(
    private readonly repository: ManufacturingRepository,
    private readonly authorization: ManufacturingAuthorizationPort,
    private readonly availability: MaterialAvailabilityPort,
    private readonly ids: ManufacturingIdFactory,
    private readonly clock: ManufacturingClock
  ) {}

  async createProductionOrder(
    actor: ManufacturingActor,
    command: CreateProductionOrderCommand
  ): Promise<IdempotentCommandResult<ProductionOrder>> {
    this.assertPositiveQuantity(command.targetQuantity, 'targetQuantity');
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_order.create',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:production_order:write',
        });

        const existingNumber = await repository.findProductionOrderByNumber(
          actor.tenantId,
          command.orderNumber
        );
        if (existingNumber) {
          throw new ManufacturingValidationError('Production order number already exists for tenant');
        }

        const order: ProductionOrder = {
          id: this.ids.next('mfg_po'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          orderNumber: command.orderNumber,
          finishedGoodItemId: command.finishedGoodItemId,
          targetQuantity: command.targetQuantity,
          uom: command.uom,
          status: 'draft',
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        await repository.saveProductionOrder(order);
        return order;
      },
    });
  }

  async createBOMRevision(
    actor: ManufacturingActor,
    command: CreateBOMRevisionCommand
  ): Promise<IdempotentCommandResult<BOMRevision>> {
    if (command.components.length === 0) {
      throw new ManufacturingValidationError('BOM revision requires at least one component');
    }
    for (const component of command.components) {
      this.assertPositiveQuantity(component.quantityPerUnit, 'quantityPerUnit');
      if (component.scrapAllowancePercent !== undefined && component.scrapAllowancePercent < 0) {
        throw new ManufacturingValidationError('scrapAllowancePercent cannot be negative');
      }
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.bom_revision.create',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:bom:write',
        });

        const existingRevision = await repository.findBOMRevisionByCode({
          tenantId: actor.tenantId,
          finishedGoodItemId: command.finishedGoodItemId,
          revisionCode: command.revisionCode,
        });
        if (existingRevision) {
          throw new ManufacturingValidationError('BOM revision code already exists for finished good');
        }

        const revision: BOMRevision = {
          id: this.ids.next('mfg_bom'),
          tenantId: actor.tenantId,
          finishedGoodItemId: command.finishedGoodItemId,
          revisionCode: command.revisionCode,
          status: 'draft',
          components: command.components.map((component) => ({
            id: this.ids.next('mfg_bom_component'),
            componentItemId: component.componentItemId,
            quantityPerUnit: component.quantityPerUnit,
            uom: component.uom,
            scrapAllowancePercent: component.scrapAllowancePercent,
          })),
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        await repository.saveBOMRevision(revision);
        return revision;
      },
    });
  }

  async approveBOMRevision(
    actor: ManufacturingActor,
    command: ApproveBOMRevisionCommand
  ): Promise<IdempotentCommandResult<BOMRevision>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.bom_revision.approve',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:bom:approve',
        });

        const revision = await this.requireBOMRevision(repository, actor.tenantId, command.bomRevisionId);
        if (revision.status !== 'draft') {
          throw new ManufacturingStateError('Only draft BOM revisions can be approved');
        }

        const approved: BOMRevision = {
          ...revision,
          status: 'approved',
          approvedBy: actor.userId,
          approvedAt: this.clock.now(),
        };
        await repository.saveBOMRevision(approved);
        return approved;
      },
    });
  }

  async calculateMaterialRequirements(
    actor: ManufacturingActor,
    command: CalculateMaterialRequirementsCommand
  ): Promise<IdempotentCommandResult<MaterialRequirement[]>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.material_requirement.calculate',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:material_requirement:calculate',
        });
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:availability:read',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'draft') {
          throw new ManufacturingStateError('Material requirements can only be calculated for draft orders');
        }

        const revision = await this.requireBOMRevision(repository, actor.tenantId, command.bomRevisionId);
        if (revision.status !== 'approved') {
          throw new ManufacturingStateError('Material requirements require an approved BOM revision');
        }
        if (revision.finishedGoodItemId !== order.finishedGoodItemId) {
          throw new ManufacturingValidationError('BOM finished good does not match production order');
        }

        const checkedAt = this.clock.now();
        const requirements: MaterialRequirement[] = [];
        for (const component of revision.components) {
          const requiredQuantity = this.roundQuantity(
            order.targetQuantity *
              component.quantityPerUnit *
              (1 + (component.scrapAllowancePercent ?? 0) / 100)
          );
          const availableQuantity = await this.availability.getAvailable({
            tenantId: actor.tenantId,
            itemId: component.componentItemId,
            locationId: command.sourceLocationId,
          });
          requirements.push({
            id: this.ids.next('mfg_req'),
            tenantId: actor.tenantId,
            productionOrderId: order.id,
            bomRevisionId: revision.id,
            componentItemId: component.componentItemId,
            sourceLocationId: command.sourceLocationId,
            requiredQuantity,
            availableQuantity,
            status: availableQuantity >= requiredQuantity ? 'available' : 'shortage',
            checkedAt,
          });
        }

        await repository.saveMaterialRequirements(requirements);
        return requirements;
      },
    });
  }

  async releaseProductionOrder(
    actor: ManufacturingActor,
    command: ReleaseProductionOrderCommand
  ): Promise<IdempotentCommandResult<ProductionOrder>> {
    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_order.release',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:production_order:release',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'draft') {
          throw new ManufacturingStateError('Only draft production orders can be released');
        }

        const revision = await this.requireBOMRevision(repository, actor.tenantId, command.bomRevisionId);
        if (revision.status !== 'approved') {
          throw new ManufacturingStateError('Production order release requires an approved BOM revision');
        }
        if (revision.finishedGoodItemId !== order.finishedGoodItemId) {
          throw new ManufacturingValidationError('BOM finished good does not match production order');
        }

        const requirements = await repository.getMaterialRequirements({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          bomRevisionId: revision.id,
        });
        if (requirements.length === 0) {
          throw new ManufacturingStateError('Production order release requires calculated material requirements');
        }
        if (requirements.some((requirement) => requirement.status !== 'available')) {
          throw new ManufacturingStateError('Production order release requires all materials to be available');
        }

        const released: ProductionOrder = {
          ...order,
          status: 'released',
          bomRevisionId: revision.id,
          releasedBy: actor.userId,
          releasedAt: this.clock.now(),
        };
        await repository.saveProductionOrder(released);
        return released;
      },
    });
  }

  private async runIdempotent<T>(params: {
    actor: ManufacturingActor;
    operation: string;
    businessKey: string;
    payload: CommandPayload;
    execute: (repository: ManufacturingRepository) => Promise<T>;
  }): Promise<IdempotentCommandResult<T>> {
    const payloadHash = stablePayloadHash(params.payload);
    try {
      return await this.repository.withTransaction(async (repository) => {
        const existing = await repository.getCommandLog<T>({
          tenantId: params.actor.tenantId,
          operation: params.operation,
          businessKey: params.businessKey,
        });
        if (existing) {
          if (existing.payloadHash !== payloadHash) {
            throw new ManufacturingIdempotencyConflictError();
          }
          return { value: existing.result, isDuplicate: true };
        }

        const value = await params.execute(repository);
        await repository.saveCommandLog<T>({
          tenantId: params.actor.tenantId,
          factoryOrgUnitId: params.actor.factoryOrgUnitId,
          operation: params.operation,
          businessKey: params.businessKey,
          payloadHash,
          result: value,
          createdAt: this.clock.now(),
        });
        return { value, isDuplicate: false };
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.repository.getCommandLog<T>({
        tenantId: params.actor.tenantId,
        operation: params.operation,
        businessKey: params.businessKey,
      });
      if (!existing) throw error;
      if (existing.payloadHash !== payloadHash) {
        throw new ManufacturingIdempotencyConflictError();
      }
      return { value: existing.result, isDuplicate: true };
    }
  }

  private async requireProductionOrder(
    repository: ManufacturingRepository,
    tenantId: string,
    id: string
  ): Promise<ProductionOrder> {
    const order = await repository.getProductionOrder(tenantId, id);
    if (!order) throw new ManufacturingNotFoundError('ProductionOrder', id);
    return order;
  }

  private async requireBOMRevision(
    repository: ManufacturingRepository,
    tenantId: string,
    id: string
  ): Promise<BOMRevision> {
    const revision = await repository.getBOMRevision(tenantId, id);
    if (!revision) throw new ManufacturingNotFoundError('BOMRevision', id);
    return revision;
  }

  private assertSameFactory(actor: ManufacturingActor, factoryOrgUnitId: string): void {
    if (actor.factoryOrgUnitId !== factoryOrgUnitId) {
      throw new ManufacturingStateError('Actor factory scope does not match production order factory');
    }
  }

  private assertPositiveQuantity(quantity: number, field: string): void {
    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new ManufacturingValidationError(`${field} must be a positive finite quantity`);
    }
  }

  private roundQuantity(quantity: number): number {
    return Math.round(quantity * 1_000_000) / 1_000_000;
  }
}

function stablePayloadHash(payload: CommandPayload): string {
  return JSON.stringify(sortValue(payload));
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === '23505'
  );
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sortValue(item));
  }
  if (value && typeof value === 'object') {
    const input = value as Record<string, unknown>;
    return Object.keys(input)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = sortValue(input[key]);
        return acc;
      }, {});
  }
  return value;
}
