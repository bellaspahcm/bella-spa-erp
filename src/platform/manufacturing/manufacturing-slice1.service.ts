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
  CompleteProductionOrderCommand,
  CreateBOMRevisionCommand,
  CreateProductionOrderCommand,
  IdempotentCommandResult,
  ManufacturingActor,
  MaterialRequirement,
  ProductionCompletion,
  ProductionExecution,
  QualityDispositionEvidence,
  ReleaseProductionOrderCommand,
  RecordProductionExecutionCommand,
  RecordQualityDispositionCommand,
  ProductionOrder,
} from './domain/types';
import type {
  ManufacturingAuthorizationPort,
  ManufacturingClock,
  ManufacturingIdFactory,
  ManufacturingRepository,
  LogisticsEvidenceBindingPort,
  MaterialAvailabilityPort,
} from './ports';

type CommandPayload = unknown;

export class ManufacturingSlice1Service {
  constructor(
    private readonly repository: ManufacturingRepository,
    private readonly authorization: ManufacturingAuthorizationPort,
    private readonly availability: MaterialAvailabilityPort,
    private readonly logisticsEvidence: LogisticsEvidenceBindingPort,
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
          lines: [{
            id: this.ids.next('mfg_po_line'),
            tenantId: actor.tenantId,
            productionOrderId: '',
            finishedGoodItemId: command.finishedGoodItemId,
            targetQuantity: command.targetQuantity,
            uom: command.uom,
          }],
          createdBy: actor.userId,
          createdAt: this.clock.now(),
        };
        order.lines = order.lines.map((line) => ({ ...line, productionOrderId: order.id }));
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

  async recordProductionExecution(
    actor: ManufacturingActor,
    command: RecordProductionExecutionCommand
  ): Promise<IdempotentCommandResult<ProductionExecution>> {
    this.assertPositiveQuantity(command.actualQuantity, 'actualQuantity');
    this.assertNonNegativeQuantity(command.acceptedQuantity, 'acceptedQuantity');
    this.assertNonNegativeQuantity(command.rejectedQuantity ?? 0, 'rejectedQuantity');
    this.assertNonNegativeQuantity(command.scrapQuantity ?? 0, 'scrapQuantity');
    if (!command.materialIssueDocumentId.trim() || !command.materialIssueMovementId.trim()) {
      throw new ManufacturingValidationError('Production execution requires material issue evidence');
    }
    const rejectedQuantity = command.rejectedQuantity ?? 0;
    const scrapQuantity = command.scrapQuantity ?? 0;
    if (
      this.roundQuantity(command.acceptedQuantity + rejectedQuantity + scrapQuantity) !==
      this.roundQuantity(command.actualQuantity)
    ) {
      throw new ManufacturingValidationError(
        'Production execution quantities must reconcile actual, accepted, rejected, and scrap'
      );
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_execution.record',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:execution:record',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'released' && order.status !== 'in_progress') {
          throw new ManufacturingStateError('Production execution can only be recorded for released orders');
        }

        const line = await repository.getProductionOrderLine({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          productionOrderLineId: command.productionOrderLineId,
        });
        if (!line) {
          throw new ManufacturingNotFoundError('ProductionOrderLine', command.productionOrderLineId);
        }
        if (line.uom !== command.uom) {
          throw new ManufacturingValidationError('Production execution UOM must match production order line UOM');
        }
        await this.assertMaterialRequirementEvidence(repository, order, command);
        await this.assertMaterialIssueEvidenceBinding(order, line.id, command);

        const execution: ProductionExecution = {
          id: this.ids.next('mfg_exec'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          materialIssueDocumentId: command.materialIssueDocumentId,
          materialIssueMovementId: command.materialIssueMovementId,
          materialRequirementId: command.materialRequirementId,
          actualQuantity: this.roundQuantity(command.actualQuantity),
          acceptedQuantity: this.roundQuantity(command.acceptedQuantity),
          rejectedQuantity: this.roundQuantity(rejectedQuantity),
          scrapQuantity: this.roundQuantity(scrapQuantity),
          uom: command.uom,
          recordedBy: actor.userId,
          recordedAt: this.clock.now(),
        };
        await repository.saveProductionExecution(execution);
        if (order.status === 'released') {
          await repository.saveProductionOrder({ ...order, status: 'in_progress' });
        }
        return execution;
      },
    });
  }

  async recordQualityDisposition(
    actor: ManufacturingActor,
    command: RecordQualityDispositionCommand
  ): Promise<IdempotentCommandResult<QualityDispositionEvidence>> {
    this.assertPositiveQuantity(command.quantity, 'quantity');
    this.assertNonNegativeQuantity(command.acceptedOutputQuantity, 'acceptedOutputQuantity');
    if (command.acceptedOutputQuantity > command.quantity) {
      throw new ManufacturingValidationError('Quality disposition accepted output cannot exceed disposition quantity');
    }
    if ((command.receiptDocumentId && !command.receiptLineId) || (!command.receiptDocumentId && command.receiptLineId)) {
      throw new ManufacturingValidationError('Quality disposition receipt evidence requires both document and line references');
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.quality_disposition.record',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:quality_disposition:record',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'in_progress') {
          throw new ManufacturingStateError('Quality disposition requires in-progress production execution');
        }

        const line = await repository.getProductionOrderLine({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
          productionOrderLineId: command.productionOrderLineId,
        });
        if (!line) {
          throw new ManufacturingNotFoundError('ProductionOrderLine', command.productionOrderLineId);
        }

        const executions = await repository.getProductionExecutions({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        const execution = executions.find((candidate) => candidate.id === command.productionExecutionId);
        if (!execution || execution.productionOrderLineId !== line.id) {
          throw new ManufacturingStateError('Quality disposition must reference execution evidence from the order line');
        }

        this.assertDispositionQuantityWithinSource(execution, command);
        const terminal = this.resolveQualityDispositionTerminal(command);
        const evidence: QualityDispositionEvidence = {
          id: this.ids.next('mfg_qd'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          productionOrderLineId: line.id,
          productionExecutionId: execution.id,
          receiptDocumentId: command.receiptDocumentId,
          receiptLineId: command.receiptLineId,
          sourceQuantityType: command.sourceQuantityType,
          disposition: command.disposition,
          quantity: this.roundQuantity(command.quantity),
          acceptedOutputQuantity: this.roundQuantity(command.acceptedOutputQuantity),
          reasonCode: command.reasonCode,
          reasonText: command.reasonText,
          evidenceReference: command.evidenceReference,
          finalHandlingDecision: command.finalHandlingDecision,
          conditionalAcceptPolicyApproved: command.conditionalAcceptPolicyApproved,
          terminal,
          decidedBy: actor.userId,
          decidedAt: this.clock.now(),
        };

        await repository.saveQualityDisposition(evidence);
        return evidence;
      },
    });
  }

  async completeProductionOrder(
    actor: ManufacturingActor,
    command: CompleteProductionOrderCommand
  ): Promise<IdempotentCommandResult<ProductionCompletion>> {
    if (command.receiptEvidence.length === 0) {
      throw new ManufacturingValidationError('Production completion requires finished goods receipt evidence');
    }
    for (const receipt of command.receiptEvidence) {
      this.assertPositiveQuantity(receipt.acceptedQuantity, 'receipt.acceptedQuantity');
      this.assertNonNegativeQuantity(receipt.rejectedQuantity ?? 0, 'receipt.rejectedQuantity');
      this.assertNonNegativeQuantity(receipt.pendingQuantity ?? 0, 'receipt.pendingQuantity');
      if (!receipt.receiptDocumentId.trim() || !receipt.receiptLineId.trim()) {
        throw new ManufacturingValidationError('Finished goods receipt evidence requires document and line references');
      }
    }

    return this.runIdempotent({
      actor,
      operation: 'manufacturing.production_order.complete',
      businessKey: command.idempotencyKey,
      payload: command,
      execute: async (repository) => {
        await this.authorization.ensureAllowed({
          actor,
          tenantId: actor.tenantId,
          factoryOrgUnitId: actor.factoryOrgUnitId,
          permission: 'manufacturing:production_order:complete',
        });

        const order = await this.requireProductionOrder(repository, actor.tenantId, command.productionOrderId);
        this.assertSameFactory(actor, order.factoryOrgUnitId);
        if (order.status !== 'in_progress') {
          throw new ManufacturingStateError('Production order completion requires in-progress execution');
        }
        const existingCompletion = await repository.getProductionCompletion(actor.tenantId, order.id);
        if (existingCompletion) {
          throw new ManufacturingStateError('Production order is already completed');
        }

        const executions = await repository.getProductionExecutions({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        if (executions.length === 0) {
          throw new ManufacturingStateError('Production order completion requires recorded execution');
        }

        const qualityDispositionEvidence = await repository.getQualityDispositions({
          tenantId: actor.tenantId,
          productionOrderId: order.id,
        });
        await this.assertFinishedGoodsReceiptEvidenceBinding(order, command.receiptEvidence);
        const reconciliation = this.reconcileCompletion(
          order,
          executions,
          command.receiptEvidence,
          qualityDispositionEvidence
        );
        const completedAt = this.clock.now();
        const completion: ProductionCompletion = {
          id: this.ids.next('mfg_completion'),
          tenantId: actor.tenantId,
          factoryOrgUnitId: order.factoryOrgUnitId,
          productionOrderId: order.id,
          completedQuantity: reconciliation.acceptedQuantity,
          rejectedQuantity: reconciliation.rejectedQuantity,
          scrapQuantity: reconciliation.scrapQuantity,
          uom: order.uom,
          receiptEvidence: command.receiptEvidence.map((receipt) => ({ ...receipt })),
          qualityDispositionEvidence: qualityDispositionEvidence.map((evidence) => ({ ...evidence })),
          completedBy: actor.userId,
          completedAt,
        };
        await repository.saveProductionCompletion(completion);
        await repository.saveProductionOrder({
          ...order,
          status: 'completed',
          completedBy: actor.userId,
          completedAt,
        });
        return completion;
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

  private assertNonNegativeQuantity(quantity: number, field: string): void {
    if (!Number.isFinite(quantity) || quantity < 0) {
      throw new ManufacturingValidationError(`${field} must be a non-negative finite quantity`);
    }
  }

  private async assertMaterialRequirementEvidence(
    repository: ManufacturingRepository,
    order: ProductionOrder,
    command: RecordProductionExecutionCommand
  ): Promise<void> {
    if (!command.materialRequirementId) return;
    if (!order.bomRevisionId) {
      throw new ManufacturingStateError('Production execution material evidence requires released BOM');
    }
    const requirements = await repository.getMaterialRequirements({
      tenantId: order.tenantId,
      productionOrderId: order.id,
      bomRevisionId: order.bomRevisionId,
    });
    if (!requirements.some((requirement) => requirement.id === command.materialRequirementId)) {
      throw new ManufacturingStateError('Material issue evidence must reference a requirement from the order');
    }
  }

  private async assertMaterialIssueEvidenceBinding(
    order: ProductionOrder,
    productionOrderLineId: string,
    command: RecordProductionExecutionCommand
  ): Promise<void> {
    const evidence = command.materialIssueEvidence;
    if (
      evidence.issueDocumentId !== command.materialIssueDocumentId ||
      evidence.movementId !== command.materialIssueMovementId
    ) {
      throw new ManufacturingValidationError('Material issue evidence does not match execution references');
    }
    if (
      evidence.productionOrderId !== order.id ||
      evidence.productionOrderLineId !== productionOrderLineId
    ) {
      throw new ManufacturingValidationError('Material issue evidence must reference the production order line');
    }
    if (
      command.materialRequirementId !== undefined &&
      evidence.materialRequirementId !== command.materialRequirementId
    ) {
      throw new ManufacturingValidationError('Material issue evidence must reference the material requirement');
    }
    await this.logisticsEvidence.verifyMaterialIssueEvidence({
      tenantId: order.tenantId,
      productionOrderId: order.id,
      productionOrderLineId,
      materialRequirementId: command.materialRequirementId,
      evidence,
    });
  }

  private async assertFinishedGoodsReceiptEvidenceBinding(
    order: ProductionOrder,
    receipts: CompleteProductionOrderCommand['receiptEvidence']
  ): Promise<void> {
    const orderLineIds = new Set(order.lines.map((line) => line.id));
    for (const receipt of receipts) {
      const evidence = receipt.logisticsEvidence;
      if (!orderLineIds.has(receipt.productionOrderLineId)) {
        throw new ManufacturingValidationError('Finished goods receipt evidence references an unknown order line');
      }
      if (
        evidence.receiptDocumentId !== receipt.receiptDocumentId ||
        evidence.receiptLineId !== receipt.receiptLineId ||
        evidence.productionOrderId !== order.id ||
        evidence.productionOrderLineId !== receipt.productionOrderLineId
      ) {
        throw new ManufacturingValidationError('Finished goods receipt evidence does not match completion references');
      }
      await this.logisticsEvidence.verifyFinishedGoodsReceiptEvidence({
        tenantId: order.tenantId,
        productionOrderId: order.id,
        receipt,
      });
    }
  }

  private assertDispositionQuantityWithinSource(
    execution: ProductionExecution,
    command: RecordQualityDispositionCommand
  ): void {
    if (command.sourceQuantityType === 'pending') {
      if (!command.receiptDocumentId || !command.receiptLineId) {
        throw new ManufacturingValidationError('Pending quality disposition requires FGR receipt evidence');
      }
      return;
    }

    const sourceQuantity = this.getExecutionSourceQuantity(execution, command.sourceQuantityType);
    if (this.roundQuantity(command.quantity) > sourceQuantity) {
      throw new ManufacturingValidationError('Quality disposition quantity exceeds source execution quantity');
    }
  }

  private resolveQualityDispositionTerminal(command: RecordQualityDispositionCommand): boolean {
    switch (command.disposition) {
      case 'accepted':
        if (command.acceptedOutputQuantity !== command.quantity) {
          throw new ManufacturingValidationError('Accepted disposition must fully count as accepted output');
        }
        return true;
      case 'conditional_accept':
        if (!command.conditionalAcceptPolicyApproved || !command.evidenceReference?.trim()) {
          throw new ManufacturingValidationError('Conditional accept requires policy approval evidence');
        }
        return true;
      case 'rework':
        this.assertNoAcceptedOutput(command, 'Rework is not accepted output');
        return false;
      case 'scrap':
        this.requireReasonAndEvidence(command, 'Scrap disposition requires reason and evidence');
        this.assertNoAcceptedOutput(command, 'Scrap is not accepted output');
        return true;
      case 'discard_reject':
        this.requireReasonAndEvidence(command, 'Discard/reject disposition requires reason and evidence');
        if (!command.finalHandlingDecision) {
          throw new ManufacturingValidationError('Discard/reject disposition requires a final handling decision');
        }
        this.assertNoAcceptedOutput(command, 'Discard/reject is not accepted output');
        return true;
      case 'pending':
        this.assertNoAcceptedOutput(command, 'Pending quality disposition is not accepted output');
        return false;
    }
  }

  private assertNoAcceptedOutput(command: RecordQualityDispositionCommand, message: string): void {
    if (command.acceptedOutputQuantity !== 0) {
      throw new ManufacturingValidationError(message);
    }
  }

  private requireReasonAndEvidence(command: RecordQualityDispositionCommand, message: string): void {
    if (!command.reasonCode?.trim() || !command.evidenceReference?.trim()) {
      throw new ManufacturingValidationError(message);
    }
  }

  private getExecutionSourceQuantity(
    execution: ProductionExecution,
    sourceQuantityType: RecordQualityDispositionCommand['sourceQuantityType']
  ): number {
    switch (sourceQuantityType) {
      case 'accepted':
        return execution.acceptedQuantity;
      case 'rejected':
        return execution.rejectedQuantity;
      case 'scrap':
        return execution.scrapQuantity;
      case 'pending':
        return 0;
    }
  }

  private reconcileCompletion(
    order: ProductionOrder,
    executions: ProductionExecution[],
    receipts: CompleteProductionOrderCommand['receiptEvidence'],
    qualityDispositions: QualityDispositionEvidence[]
  ): { acceptedQuantity: number; rejectedQuantity: number; scrapQuantity: number } {
    let acceptedQuantity = 0;
    let rejectedQuantity = 0;
    let scrapQuantity = 0;
    const receiptLineKeys = new Set<string>();

    for (const line of order.lines) {
      const lineExecutions = executions.filter((execution) => execution.productionOrderLineId === line.id);
      if (lineExecutions.length === 0) {
        throw new ManufacturingStateError('Every production order line requires recorded execution');
      }

      const actual = this.sumQuantities(lineExecutions.map((execution) => execution.actualQuantity));
      const accepted = this.sumQuantities(lineExecutions.map((execution) => execution.acceptedQuantity));
      const rejected = this.sumQuantities(lineExecutions.map((execution) => execution.rejectedQuantity));
      const scrap = this.sumQuantities(lineExecutions.map((execution) => execution.scrapQuantity));
      if (actual !== this.roundQuantity(line.targetQuantity)) {
        throw new ManufacturingStateError('Production execution must explain the full target quantity before completion');
      }
      if (this.roundQuantity(accepted + rejected + scrap) !== actual) {
        throw new ManufacturingStateError('Production execution quantities are not reconciled');
      }

      const lineReceipts = receipts.filter((receipt) => receipt.productionOrderLineId === line.id);
      const receiptAccepted = this.sumQuantities(lineReceipts.map((receipt) => receipt.acceptedQuantity));
      const receiptRejected = this.sumQuantities(lineReceipts.map((receipt) => receipt.rejectedQuantity ?? 0));
      const receiptPending = this.sumQuantities(lineReceipts.map((receipt) => receipt.pendingQuantity ?? 0));
      for (const receipt of lineReceipts) {
        const key = `${receipt.receiptDocumentId}:${receipt.receiptLineId}`;
        if (receiptLineKeys.has(key)) {
          throw new ManufacturingValidationError('Finished goods receipt evidence must not contain duplicate lines');
        }
        receiptLineKeys.add(key);
      }
      if (receiptPending !== 0) {
        throw new ManufacturingStateError('Production order completion requires no pending finished goods quantity');
      }
      const lineDispositions = qualityDispositions.filter(
        (evidence) => evidence.productionOrderLineId === line.id
      );
      const qualityReconciliation = this.reconcileQualityDispositions({
        lineDispositions,
        accepted,
        rejected,
        scrap,
        receiptPending,
      });
      const expectedReceiptAccepted = this.roundQuantity(accepted + qualityReconciliation.acceptedAdjustment);
      const expectedReceiptRejected = this.roundQuantity(rejected - qualityReconciliation.acceptedAdjustment);
      if (receiptAccepted !== expectedReceiptAccepted || receiptRejected !== expectedReceiptRejected) {
        throw new ManufacturingStateError('Finished goods receipt evidence must reconcile with production execution');
      }

      acceptedQuantity = this.roundQuantity(acceptedQuantity + expectedReceiptAccepted);
      rejectedQuantity = this.roundQuantity(rejectedQuantity + expectedReceiptRejected);
      scrapQuantity = this.roundQuantity(scrapQuantity + scrap);
    }

    return { acceptedQuantity, rejectedQuantity, scrapQuantity };
  }

  private reconcileQualityDispositions(params: {
    lineDispositions: QualityDispositionEvidence[];
    accepted: number;
    rejected: number;
    scrap: number;
    receiptPending: number;
  }): { acceptedAdjustment: number } {
    if (params.lineDispositions.some((evidence) => !evidence.terminal)) {
      throw new ManufacturingStateError('Production order completion requires terminal quality dispositions');
    }

    const dispositionAccepted = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'accepted')
        .map((evidence) => evidence.quantity)
    );
    const dispositionRejected = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'rejected')
        .map((evidence) => evidence.quantity)
    );
    const dispositionScrap = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'scrap')
        .map((evidence) => evidence.quantity)
    );
    const dispositionPending = this.sumQuantities(
      params.lineDispositions
        .filter((evidence) => evidence.sourceQuantityType === 'pending')
        .map((evidence) => evidence.quantity)
    );

    if (dispositionAccepted > params.accepted) {
      throw new ManufacturingStateError('Quality disposition accepted quantity exceeds execution accepted quantity');
    }
    if (params.rejected > 0 && dispositionRejected !== params.rejected) {
      throw new ManufacturingStateError('Rejected production quantity requires terminal quality disposition');
    }
    if (params.scrap > 0 && dispositionScrap !== params.scrap) {
      throw new ManufacturingStateError('Scrap production quantity requires terminal quality disposition');
    }
    if (dispositionPending > params.receiptPending) {
      throw new ManufacturingStateError('Pending quality disposition exceeds FGR pending quantity');
    }

    const acceptedAdjustment = this.sumQuantities(
      params.lineDispositions
        .filter(
          (evidence) =>
            evidence.sourceQuantityType === 'rejected' &&
            evidence.disposition === 'conditional_accept'
        )
        .map((evidence) => evidence.acceptedOutputQuantity)
    );
    if (acceptedAdjustment > params.rejected) {
      throw new ManufacturingStateError('Conditional accepted output exceeds rejected execution quantity');
    }

    return { acceptedAdjustment };
  }

  private sumQuantities(values: number[]): number {
    return this.roundQuantity(values.reduce((total, value) => total + value, 0));
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
