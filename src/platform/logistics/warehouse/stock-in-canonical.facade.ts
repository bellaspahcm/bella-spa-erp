import { randomUUID } from 'crypto';

import {
  MovementReason,
  TransactionStatus,
  type InventoryBalance,
  type InventoryLedgerEntry,
  type ItemId,
  type LocationId,
  type Quantity,
} from '../contracts/inventory.contract';
import {
  ValuationMethod,
  type FinancialContext,
  type IEventBus,
  type InventoryReceivedEvent,
} from '../contracts/events.contract';
import {
  ActorType,
  TraceabilityEventType,
  type ITraceabilityService,
  type TraceabilityEvent,
} from '../contracts/traceability.contract';

export type WarehouseStockInSourceType =
  | 'purchase_order'
  | 'production_order'
  | 'return'
  | 'transfer';

export interface WarehouseStockInCommand {
  tenantId: string;
  actorId: string;
  correlationId?: string;
  sourceDocument: {
    id: string;
    number?: string;
    type: WarehouseStockInSourceType;
  };
  lines: WarehouseStockInLineCommand[];
}

export interface WarehouseStockInLineCommand {
  warehouseSkuId: string;
  warehouseBinId: string;
  itemId: ItemId;
  locationId: LocationId;
  quantity: Quantity;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  unitCost?: number;
  currency?: string;
  valuationMethod?: ValuationMethod;
  supplierId?: string;
  sourceLineId?: string;
  metadata?: Record<string, unknown>;
}

export interface CanonicalBalanceMutation {
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity_delta: Quantity;
  reason: MovementReason.RECEIPT;
  actor_id: string;
  reference_id: string;
  metadata: Record<string, unknown>;
}

export interface CanonicalMovementRecord {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason.RECEIPT;
  status: TransactionStatus.COMPLETED;
  actor_id: string;
  created_at: Date;
}

export interface WarehouseStockInReadBackEvidence {
  balance: InventoryBalance;
  ledgerEntry: InventoryLedgerEntry;
  movement: CanonicalMovementRecord;
  traceability: TraceabilityEvent;
}

export interface WarehouseStockInPorts {
  balance: {
    applyStockIn(mutation: CanonicalBalanceMutation): Promise<InventoryBalance>;
  };
  movementLedger: {
    recordStockIn(params: {
      mutation: CanonicalBalanceMutation;
      balanceAfter: InventoryBalance;
      occurredAt: Date;
    }): Promise<{
      movement: CanonicalMovementRecord;
      ledgerEntry: InventoryLedgerEntry;
    }>;
  };
  traceability: Pick<ITraceabilityService, 'recordEvent'>;
  events: Pick<IEventBus, 'publish'>;
  readBack: {
    getStockInEvidence(params: {
      tenant_id: string;
      item_id: ItemId;
      location_id: LocationId;
      movement_id: string;
      traceability_event_id: string;
    }): Promise<WarehouseStockInReadBackEvidence>;
  };
}

export type WarehouseStockInErrorCode =
  | 'WAREHOUSE_STOCK_IN_INVALID_COMMAND'
  | 'WAREHOUSE_STOCK_IN_CANONICAL_SKU_MISSING'
  | 'WAREHOUSE_STOCK_IN_CANONICAL_LOCATION_MISSING'
  | 'WAREHOUSE_STOCK_IN_INVALID_QUANTITY'
  | 'WAREHOUSE_STOCK_IN_SERIAL_REQUIRES_LOT'
  | 'WAREHOUSE_STOCK_IN_RUNTIME_FAILED';

export type WarehouseStockInResult =
  | {
      ok: true;
      value: {
        tenantId: string;
        sourceDocumentId: string;
        lines: WarehouseStockInLineEvidence[];
      };
    }
  | {
      ok: false;
      error: {
        code: WarehouseStockInErrorCode;
        message: string;
        lineIndex?: number;
      };
    };

export interface WarehouseStockInLineEvidence {
  itemId: ItemId;
  locationId: LocationId;
  quantity: Quantity;
  balance: InventoryBalance;
  movement: CanonicalMovementRecord;
  ledgerEntry: InventoryLedgerEntry;
  traceabilityEvent: TraceabilityEvent;
  readBack: WarehouseStockInReadBackEvidence;
}

export interface WarehouseStockInCanonicalFacadeOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class WarehouseStockInCanonicalFacade {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly ports: WarehouseStockInPorts,
    options: WarehouseStockInCanonicalFacadeOptions = {}
  ) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async execute(command: WarehouseStockInCommand): Promise<WarehouseStockInResult> {
    const commandError = this.validateCommand(command);
    if (commandError) return commandError;

    const lines: WarehouseStockInLineEvidence[] = [];

    try {
      for (let lineIndex = 0; lineIndex < command.lines.length; lineIndex += 1) {
        const line = command.lines[lineIndex];
        const lineError = this.validateLine(line, lineIndex);
        if (lineError) return lineError;

        const occurredAt = this.now();
        const mutation = this.toBalanceMutation(command, line);
        const balance = await this.ports.balance.applyStockIn(mutation);
        const { movement, ledgerEntry } = await this.ports.movementLedger.recordStockIn({
          mutation,
          balanceAfter: balance,
          occurredAt,
        });
        const traceabilityEvent = await this.ports.traceability.recordEvent({
          tenant_id: command.tenantId,
          event_type: TraceabilityEventType.RECEIVED,
          item_id: line.itemId,
          quantity: line.quantity,
          lot_number: line.lotNumber,
          serial_numbers: line.serialNumbers,
          to_location_id: line.locationId,
          current_location_id: line.locationId,
          actor_id: command.actorId,
          actor_type: ActorType.USER,
          transaction_id: movement.id,
          transaction_type: 'warehouse_stock_in',
          reference_id: command.sourceDocument.id,
          reference_type: command.sourceDocument.type,
          occurred_at: occurredAt,
          reason: MovementReason.RECEIPT,
          metadata: {
            warehouse_sku_id: line.warehouseSkuId,
            warehouse_bin_id: line.warehouseBinId,
            source_line_id: line.sourceLineId,
            source_document_number: command.sourceDocument.number,
            ...line.metadata,
          },
        });

        await this.ports.events.publish(this.toInventoryReceivedEvent({
          command,
          line,
          occurredAt,
          movementId: movement.id,
        }));

        const readBack = await this.ports.readBack.getStockInEvidence({
          tenant_id: command.tenantId,
          item_id: line.itemId,
          location_id: line.locationId,
          movement_id: movement.id,
          traceability_event_id: traceabilityEvent.id,
        });

        lines.push({
          itemId: line.itemId,
          locationId: line.locationId,
          quantity: line.quantity,
          balance,
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
          sourceDocumentId: command.sourceDocument.id,
          lines,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'WAREHOUSE_STOCK_IN_RUNTIME_FAILED',
          message: error instanceof Error ? error.message : 'Warehouse stock in runtime failed',
        },
      };
    }
  }

  private validateCommand(command: WarehouseStockInCommand): WarehouseStockInResult | null {
    if (!hasText(command.tenantId)) {
      return failure('WAREHOUSE_STOCK_IN_INVALID_COMMAND', 'tenantId is required');
    }

    if (!hasText(command.actorId)) {
      return failure('WAREHOUSE_STOCK_IN_INVALID_COMMAND', 'actorId is required');
    }

    if (!hasText(command.sourceDocument.id)) {
      return failure('WAREHOUSE_STOCK_IN_INVALID_COMMAND', 'sourceDocument.id is required');
    }

    if (command.lines.length === 0) {
      return failure('WAREHOUSE_STOCK_IN_INVALID_COMMAND', 'at least one stock in line is required');
    }

    return null;
  }

  private validateLine(
    line: WarehouseStockInLineCommand,
    lineIndex: number
  ): WarehouseStockInResult | null {
    if (!hasText(line.warehouseSkuId)) {
      return failure('WAREHOUSE_STOCK_IN_INVALID_COMMAND', 'warehouseSkuId is required', lineIndex);
    }

    if (!hasText(line.warehouseBinId)) {
      return failure('WAREHOUSE_STOCK_IN_INVALID_COMMAND', 'warehouseBinId is required', lineIndex);
    }

    if (!hasText(line.itemId)) {
      return failure(
        'WAREHOUSE_STOCK_IN_CANONICAL_SKU_MISSING',
        'canonical itemId is required before stock mutation',
        lineIndex
      );
    }

    if (!hasText(line.locationId)) {
      return failure(
        'WAREHOUSE_STOCK_IN_CANONICAL_LOCATION_MISSING',
        'canonical locationId is required before stock mutation',
        lineIndex
      );
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return failure(
        'WAREHOUSE_STOCK_IN_INVALID_QUANTITY',
        'quantity must be a positive finite number',
        lineIndex
      );
    }

    if (line.serialNumbers && line.serialNumbers.length > 0 && !hasText(line.lotNumber)) {
      return failure(
        'WAREHOUSE_STOCK_IN_SERIAL_REQUIRES_LOT',
        'serial numbers require lot number',
        lineIndex
      );
    }

    return null;
  }

  private toBalanceMutation(
    command: WarehouseStockInCommand,
    line: WarehouseStockInLineCommand
  ): CanonicalBalanceMutation {
    return {
      tenant_id: command.tenantId,
      item_id: line.itemId,
      location_id: line.locationId,
      quantity_delta: line.quantity,
      reason: MovementReason.RECEIPT,
      actor_id: command.actorId,
      reference_id: command.sourceDocument.id,
      metadata: {
        warehouse_sku_id: line.warehouseSkuId,
        warehouse_bin_id: line.warehouseBinId,
        source_line_id: line.sourceLineId,
        source_document_type: command.sourceDocument.type,
        source_document_number: command.sourceDocument.number,
        unit_of_measure: line.unitOfMeasure,
        lot_number: line.lotNumber,
        serial_numbers: line.serialNumbers,
        ...line.metadata,
      },
    };
  }

  private toInventoryReceivedEvent(params: {
    command: WarehouseStockInCommand;
    line: WarehouseStockInLineCommand;
    occurredAt: Date;
    movementId: string;
  }): InventoryReceivedEvent {
    const { command, line, occurredAt, movementId } = params;

    return {
      metadata: {
        event_id: this.idFactory(),
        event_type: 'InventoryReceivedEvent',
        tenant_id: command.tenantId,
        occurred_at: occurredAt,
        actor_id: command.actorId,
        correlation_id: command.correlationId,
        causation_id: movementId,
      },
      item_id: line.itemId,
      location_id: line.locationId,
      quantity: line.quantity,
      lot_number: line.lotNumber,
      serial_numbers: line.serialNumbers,
      reference_id: command.sourceDocument.id,
      reference_type: command.sourceDocument.type,
      supplier_id: line.supplierId,
      financial: this.toFinancialContext(line),
    };
  }

  private toFinancialContext(line: WarehouseStockInLineCommand): FinancialContext {
    const unitCost = line.unitCost;

    return {
      unit_cost: unitCost,
      transaction_value: unitCost === undefined ? undefined : unitCost * line.quantity,
      currency: line.currency ?? 'VND',
      valuation_method: line.valuationMethod ?? ValuationMethod.WEIGHTED_AVERAGE,
      financial_posting_status: 'not_posted',
      metadata: {
        finance_os_posting_required: true,
        source: 'warehouse_stock_in',
      },
    };
  }
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function failure(
  code: WarehouseStockInErrorCode,
  message: string,
  lineIndex?: number
): WarehouseStockInResult {
  return {
    ok: false,
    error: {
      code,
      message,
      lineIndex,
    },
  };
}
