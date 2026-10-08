import { randomUUID } from 'crypto';

import {
  AdjustmentReason,
  TransactionStatus,
  type InventoryBalance,
  type InventoryLedgerEntry,
  type ItemId,
  type LocationId,
} from '../contracts/inventory.contract';
import {
  ValuationMethod,
  type FinancialContext,
  type IEventBus,
  type InventoryAdjustedEvent,
} from '../contracts/events.contract';
import {
  ActorType,
  TraceabilityEventType,
  type ITraceabilityService,
  type TraceabilityEvent,
} from '../contracts/traceability.contract';

export type WarehouseStockAdjustmentSourceType =
  | 'cycle_count'
  | 'damage'
  | 'loss'
  | 'found'
  | 'reconciliation'
  | 'correction';

const inventoryAdjustedEventReasonByAdjustmentReason: Record<
  AdjustmentReason,
  InventoryAdjustedEvent['reason']
> = {
  [AdjustmentReason.DAMAGE]: 'damage',
  [AdjustmentReason.LOSS]: 'loss',
  [AdjustmentReason.FOUND]: 'found',
  [AdjustmentReason.CYCLE_COUNT]: 'cycle_count',
  [AdjustmentReason.RECONCILIATION]: 'reconciliation',
  [AdjustmentReason.CORRECTION]: 'correction',
};

export interface WarehouseStockAdjustmentCommand {
  tenantId: string;
  actorId: string;
  correlationId?: string;
  adjustmentDocument: {
    id: string;
    number?: string;
    type: WarehouseStockAdjustmentSourceType;
  };
  lines: WarehouseStockAdjustmentLineCommand[];
}

export interface WarehouseStockAdjustmentLineCommand {
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: ItemId;
  locationId: LocationId;
  quantityDelta: number;
  unitOfMeasure: string;
  reason: AdjustmentReason;
  lotNumber?: string;
  serialNumbers?: string[];
  sourceLineId?: string;
  notes?: string;
  unitCost?: number;
  currency?: string;
  valuationMethod?: ValuationMethod;
  metadata?: Record<string, unknown>;
}

export interface CanonicalAdjustmentMutation {
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity_delta: number;
  reason: AdjustmentReason;
  actor_id: string;
  reference_id: string;
  metadata: Record<string, unknown>;
}

export interface CanonicalAdjustmentMovementRecord {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity_delta: number;
  reason: AdjustmentReason;
  status: TransactionStatus.COMPLETED;
  actor_id: string;
  created_at: Date;
}

export interface WarehouseStockAdjustmentReadBackEvidence {
  balance: InventoryBalance;
  ledgerEntry: InventoryLedgerEntry;
  movement: CanonicalAdjustmentMovementRecord;
  traceability: TraceabilityEvent;
}

export interface WarehouseStockAdjustmentPorts {
  balance: {
    getCurrentBalance(params: {
      tenant_id: string;
      item_id: ItemId;
      location_id: LocationId;
    }): Promise<InventoryBalance>;
    applyStockAdjustment(mutation: CanonicalAdjustmentMutation): Promise<InventoryBalance>;
  };
  movementLedger: {
    recordStockAdjustment(params: {
      mutation: CanonicalAdjustmentMutation;
      balanceBefore: InventoryBalance;
      balanceAfter: InventoryBalance;
      occurredAt: Date;
    }): Promise<{
      movement: CanonicalAdjustmentMovementRecord;
      ledgerEntry: InventoryLedgerEntry;
    }>;
  };
  traceability: Pick<ITraceabilityService, 'recordEvent'>;
  events: Pick<IEventBus, 'publish'>;
  readBack: {
    getStockAdjustmentEvidence(params: {
      tenant_id: string;
      item_id: ItemId;
      location_id: LocationId;
      movement_id: string;
      traceability_event_id: string;
    }): Promise<WarehouseStockAdjustmentReadBackEvidence>;
  };
}

export type WarehouseStockAdjustmentErrorCode =
  | 'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_CANONICAL_SKU_MISSING'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_LOCATION_MISSING'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_QUANTITY_DELTA'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_REASON'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_SERIAL_REQUIRES_LOT'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_NEGATIVE_BALANCE'
  | 'WAREHOUSE_STOCK_ADJUSTMENT_RUNTIME_FAILED';

export type WarehouseStockAdjustmentResult =
  | {
      ok: true;
      value: {
        tenantId: string;
        adjustmentDocumentId: string;
        lines: WarehouseStockAdjustmentLineEvidence[];
      };
    }
  | {
      ok: false;
      error: {
        code: WarehouseStockAdjustmentErrorCode;
        message: string;
        lineIndex?: number;
      };
    };

export interface WarehouseStockAdjustmentLineEvidence {
  itemId: ItemId;
  locationId: LocationId;
  quantityDelta: number;
  balanceBefore: InventoryBalance;
  balanceAfter: InventoryBalance;
  movement: CanonicalAdjustmentMovementRecord;
  ledgerEntry: InventoryLedgerEntry;
  traceabilityEvent: TraceabilityEvent;
  readBack: WarehouseStockAdjustmentReadBackEvidence;
}

export interface WarehouseStockAdjustmentCanonicalFacadeOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class WarehouseStockAdjustmentCanonicalFacade {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly ports: WarehouseStockAdjustmentPorts,
    options: WarehouseStockAdjustmentCanonicalFacadeOptions = {}
  ) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async execute(command: WarehouseStockAdjustmentCommand): Promise<WarehouseStockAdjustmentResult> {
    const commandError = this.validateCommand(command);
    if (commandError) return commandError;

    const lines: WarehouseStockAdjustmentLineEvidence[] = [];

    try {
      for (let lineIndex = 0; lineIndex < command.lines.length; lineIndex += 1) {
        const line = command.lines[lineIndex];
        const lineError = this.validateLine(line, lineIndex);
        if (lineError) return lineError;

        const balanceBefore = await this.ports.balance.getCurrentBalance({
          tenant_id: command.tenantId,
          item_id: line.itemId,
          location_id: line.locationId,
        });

        if (balanceBefore.on_hand + line.quantityDelta < 0) {
          return failure(
            'WAREHOUSE_STOCK_ADJUSTMENT_NEGATIVE_BALANCE',
            'stock adjustment would make inventory balance negative',
            lineIndex
          );
        }

        const occurredAt = this.now();
        const mutation = this.toAdjustmentMutation(command, line);
        const balanceAfter = await this.ports.balance.applyStockAdjustment(mutation);
        const { movement, ledgerEntry } =
          await this.ports.movementLedger.recordStockAdjustment({
            mutation,
            balanceBefore,
            balanceAfter,
            occurredAt,
          });
        const traceabilityEvent = await this.ports.traceability.recordEvent({
          tenant_id: command.tenantId,
          event_type: TraceabilityEventType.ADJUSTED,
          item_id: line.itemId,
          quantity: Math.abs(line.quantityDelta),
          lot_number: line.lotNumber,
          serial_numbers: line.serialNumbers,
          current_location_id: line.locationId,
          actor_id: command.actorId,
          actor_type: ActorType.USER,
          transaction_id: movement.id,
          transaction_type: 'warehouse_stock_adjustment',
          reference_id: command.adjustmentDocument.id,
          reference_type: command.adjustmentDocument.type,
          occurred_at: occurredAt,
          reason: line.reason,
          notes: line.notes,
          metadata: {
            warehouse_sku_id: line.warehouseSkuId,
            warehouse_bin_id: line.warehouseBinId,
            source_line_id: line.sourceLineId,
            adjustment_document_number: command.adjustmentDocument.number,
            quantity_delta: line.quantityDelta,
            ...line.metadata,
          },
        });

        await this.ports.events.publish(this.toInventoryAdjustedEvent({
          command,
          line,
          balanceBefore,
          balanceAfter,
          occurredAt,
          movementId: movement.id,
        }));

        const readBack = await this.ports.readBack.getStockAdjustmentEvidence({
          tenant_id: command.tenantId,
          item_id: line.itemId,
          location_id: line.locationId,
          movement_id: movement.id,
          traceability_event_id: traceabilityEvent.id,
        });

        lines.push({
          itemId: line.itemId,
          locationId: line.locationId,
          quantityDelta: line.quantityDelta,
          balanceBefore,
          balanceAfter,
          movement,
          ledgerEntry,
          traceabilityEvent,
          readBack,
        });
      }

      return {
        ok: true,
        value: {
          tenantId: command.tenantId,
          adjustmentDocumentId: command.adjustmentDocument.id,
          lines,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'WAREHOUSE_STOCK_ADJUSTMENT_RUNTIME_FAILED',
          message: error instanceof Error
            ? error.message
            : 'Warehouse stock adjustment runtime failed',
        },
      };
    }
  }

  private validateCommand(
    command: WarehouseStockAdjustmentCommand
  ): WarehouseStockAdjustmentResult | null {
    if (!hasText(command.tenantId)) {
      return failure('WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND', 'tenantId is required');
    }

    if (!hasText(command.actorId)) {
      return failure('WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND', 'actorId is required');
    }

    if (!hasText(command.adjustmentDocument.id)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND',
        'adjustmentDocument.id is required'
      );
    }

    if (command.lines.length === 0) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND',
        'at least one stock adjustment line is required'
      );
    }

    return null;
  }

  private validateLine(
    line: WarehouseStockAdjustmentLineCommand,
    lineIndex: number
  ): WarehouseStockAdjustmentResult | null {
    if (!hasText(line.warehouseSkuId)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND',
        'warehouseSkuId is required',
        lineIndex
      );
    }

    if (!hasText(line.warehouseBinId)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_COMMAND',
        'warehouseBinId is required',
        lineIndex
      );
    }

    if (!hasText(line.itemId)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_CANONICAL_SKU_MISSING',
        'canonical itemId is required before stock adjustment',
        lineIndex
      );
    }

    if (!hasText(line.locationId)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_LOCATION_MISSING',
        'canonical locationId is required before stock adjustment',
        lineIndex
      );
    }

    if (!Number.isFinite(line.quantityDelta) || line.quantityDelta === 0) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_QUANTITY_DELTA',
        'quantityDelta must be a non-zero finite number',
        lineIndex
      );
    }

    if (!Object.values(AdjustmentReason).includes(line.reason)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_REASON',
        'adjustment reason is not supported',
        lineIndex
      );
    }

    if (line.serialNumbers && line.serialNumbers.length > 0 && !hasText(line.lotNumber)) {
      return failure(
        'WAREHOUSE_STOCK_ADJUSTMENT_SERIAL_REQUIRES_LOT',
        'serial numbers require lot number',
        lineIndex
      );
    }

    return null;
  }

  private toAdjustmentMutation(
    command: WarehouseStockAdjustmentCommand,
    line: WarehouseStockAdjustmentLineCommand
  ): CanonicalAdjustmentMutation {
    return {
      tenant_id: command.tenantId,
      item_id: line.itemId,
      location_id: line.locationId,
      quantity_delta: line.quantityDelta,
      reason: line.reason,
      actor_id: command.actorId,
      reference_id: command.adjustmentDocument.id,
      metadata: {
        warehouse_sku_id: line.warehouseSkuId,
        warehouse_bin_id: line.warehouseBinId,
        source_line_id: line.sourceLineId,
        adjustment_document_type: command.adjustmentDocument.type,
        adjustment_document_number: command.adjustmentDocument.number,
        unit_of_measure: line.unitOfMeasure,
        lot_number: line.lotNumber,
        serial_numbers: line.serialNumbers,
        notes: line.notes,
        ...line.metadata,
      },
    };
  }

  private toInventoryAdjustedEvent(params: {
    command: WarehouseStockAdjustmentCommand;
    line: WarehouseStockAdjustmentLineCommand;
    balanceBefore: InventoryBalance;
    balanceAfter: InventoryBalance;
    occurredAt: Date;
    movementId: string;
  }): InventoryAdjustedEvent {
    const { command, line, balanceBefore, balanceAfter, occurredAt, movementId } = params;

    return {
      metadata: {
        event_id: this.idFactory(),
        event_type: 'InventoryAdjustedEvent',
        tenant_id: command.tenantId,
        occurred_at: occurredAt,
        actor_id: command.actorId,
        correlation_id: command.correlationId,
        causation_id: movementId,
      },
      item_id: line.itemId,
      location_id: line.locationId,
      quantity_delta: line.quantityDelta,
      quantity_before: balanceBefore.on_hand,
      quantity_after: balanceAfter.on_hand,
      reason: toInventoryAdjustedEventReason(line.reason),
      lot_number: line.lotNumber,
      adjustment_id: movementId,
      financial: this.toFinancialContext(line),
    };
  }

  private toFinancialContext(line: WarehouseStockAdjustmentLineCommand): FinancialContext {
    const unitCost = line.unitCost;

    return {
      unit_cost: unitCost,
      transaction_value: unitCost === undefined
        ? undefined
        : unitCost * Math.abs(line.quantityDelta),
      currency: line.currency ?? 'VND',
      valuation_method: line.valuationMethod ?? ValuationMethod.WEIGHTED_AVERAGE,
      financial_posting_status: 'not_posted',
      metadata: {
        finance_os_posting_required: true,
        source: 'warehouse_stock_adjustment',
      },
    };
  }
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function toInventoryAdjustedEventReason(
  reason: AdjustmentReason
): InventoryAdjustedEvent['reason'] {
  return inventoryAdjustedEventReasonByAdjustmentReason[reason];
}

function failure(
  code: WarehouseStockAdjustmentErrorCode,
  message: string,
  lineIndex?: number
): WarehouseStockAdjustmentResult {
  return {
    ok: false,
    error: {
      code,
      message,
      lineIndex,
    },
  };
}
