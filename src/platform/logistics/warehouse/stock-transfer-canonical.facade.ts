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
  type IEventBus,
  type InventoryMovedEvent,
} from '../contracts/events.contract';
import {
  ActorType,
  TraceabilityEventType,
  type ITraceabilityService,
  type TraceabilityEvent,
} from '../contracts/traceability.contract';

export type WarehouseStockTransferSourceType =
  | 'warehouse_transfer'
  | 'bin_transfer'
  | 'relocation';

export interface WarehouseStockTransferCommand {
  tenantId: string;
  actorId: string;
  correlationId?: string;
  transferDocument: {
    id: string;
    number?: string;
    type: WarehouseStockTransferSourceType;
  };
  lines: WarehouseStockTransferLineCommand[];
}

export interface WarehouseStockTransferLineCommand {
  warehouseSkuId: string;
  fromWarehouseBinId: string;
  toWarehouseBinId: string;
  itemId: ItemId;
  fromLocationId: LocationId;
  toLocationId: LocationId;
  quantity: Quantity;
  unitOfMeasure: string;
  lotNumber?: string;
  serialNumbers?: string[];
  sourceLineId?: string;
  metadata?: Record<string, unknown>;
}

export interface CanonicalTransferMutation {
  tenant_id: string;
  item_id: ItemId;
  from_location_id: LocationId;
  to_location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason.TRANSFER;
  actor_id: string;
  reference_id: string;
  metadata: Record<string, unknown>;
}

export interface CanonicalTransferMovementRecord {
  id: string;
  tenant_id: string;
  item_id: ItemId;
  from_location_id: LocationId;
  to_location_id: LocationId;
  quantity: Quantity;
  reason: MovementReason.TRANSFER;
  status: TransactionStatus.COMPLETED;
  actor_id: string;
  created_at: Date;
}

export interface WarehouseStockTransferReadBackEvidence {
  sourceBalance: InventoryBalance;
  destinationBalance: InventoryBalance;
  ledgerEntries: InventoryLedgerEntry[];
  movement: CanonicalTransferMovementRecord;
  traceability: TraceabilityEvent;
}

export interface WarehouseStockTransferPorts {
  balance: {
    getSourceBalance(params: {
      tenant_id: string;
      item_id: ItemId;
      location_id: LocationId;
    }): Promise<InventoryBalance>;
    applyStockTransfer(mutation: CanonicalTransferMutation): Promise<{
      sourceBalance: InventoryBalance;
      destinationBalance: InventoryBalance;
    }>;
  };
  movementLedger: {
    recordStockTransfer(params: {
      mutation: CanonicalTransferMutation;
      sourceBalanceAfter: InventoryBalance;
      destinationBalanceAfter: InventoryBalance;
      occurredAt: Date;
    }): Promise<{
      movement: CanonicalTransferMovementRecord;
      ledgerEntries: InventoryLedgerEntry[];
    }>;
  };
  traceability: Pick<ITraceabilityService, 'recordEvent'>;
  events: Pick<IEventBus, 'publish'>;
  readBack: {
    getStockTransferEvidence(params: {
      tenant_id: string;
      item_id: ItemId;
      from_location_id: LocationId;
      to_location_id: LocationId;
      movement_id: string;
      traceability_event_id: string;
    }): Promise<WarehouseStockTransferReadBackEvidence>;
  };
}

export type WarehouseStockTransferErrorCode =
  | 'WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND'
  | 'WAREHOUSE_STOCK_TRANSFER_CANONICAL_SKU_MISSING'
  | 'WAREHOUSE_STOCK_TRANSFER_SOURCE_LOCATION_MISSING'
  | 'WAREHOUSE_STOCK_TRANSFER_DESTINATION_LOCATION_MISSING'
  | 'WAREHOUSE_STOCK_TRANSFER_SAME_LOCATION'
  | 'WAREHOUSE_STOCK_TRANSFER_INVALID_QUANTITY'
  | 'WAREHOUSE_STOCK_TRANSFER_SERIAL_REQUIRES_LOT'
  | 'WAREHOUSE_STOCK_TRANSFER_INSUFFICIENT_SOURCE_BALANCE'
  | 'WAREHOUSE_STOCK_TRANSFER_RUNTIME_FAILED';

export type WarehouseStockTransferResult =
  | {
      ok: true;
      value: {
        tenantId: string;
        transferDocumentId: string;
        lines: WarehouseStockTransferLineEvidence[];
      };
    }
  | {
      ok: false;
      error: {
        code: WarehouseStockTransferErrorCode;
        message: string;
        lineIndex?: number;
      };
    };

export interface WarehouseStockTransferLineEvidence {
  itemId: ItemId;
  fromLocationId: LocationId;
  toLocationId: LocationId;
  quantity: Quantity;
  sourceBalanceBefore: InventoryBalance;
  sourceBalanceAfter: InventoryBalance;
  destinationBalanceAfter: InventoryBalance;
  movement: CanonicalTransferMovementRecord;
  ledgerEntries: InventoryLedgerEntry[];
  traceabilityEvent: TraceabilityEvent;
  readBack: WarehouseStockTransferReadBackEvidence;
}

export interface WarehouseStockTransferCanonicalFacadeOptions {
  idFactory?: () => string;
  now?: () => Date;
}

export class WarehouseStockTransferCanonicalFacade {
  private readonly idFactory: () => string;
  private readonly now: () => Date;

  constructor(
    private readonly ports: WarehouseStockTransferPorts,
    options: WarehouseStockTransferCanonicalFacadeOptions = {}
  ) {
    this.idFactory = options.idFactory ?? randomUUID;
    this.now = options.now ?? (() => new Date());
  }

  async execute(command: WarehouseStockTransferCommand): Promise<WarehouseStockTransferResult> {
    const commandError = this.validateCommand(command);
    if (commandError) return commandError;

    const lines: WarehouseStockTransferLineEvidence[] = [];

    try {
      for (let lineIndex = 0; lineIndex < command.lines.length; lineIndex += 1) {
        const line = command.lines[lineIndex];
        const lineError = this.validateLine(line, lineIndex);
        if (lineError) return lineError;

        const sourceBalanceBefore = await this.ports.balance.getSourceBalance({
          tenant_id: command.tenantId,
          item_id: line.itemId,
          location_id: line.fromLocationId,
        });

        if (sourceBalanceBefore.on_hand < line.quantity) {
          return failure(
            'WAREHOUSE_STOCK_TRANSFER_INSUFFICIENT_SOURCE_BALANCE',
            'source balance is insufficient for stock transfer',
            lineIndex
          );
        }

        const occurredAt = this.now();
        const mutation = this.toTransferMutation(command, line);
        const { sourceBalance, destinationBalance } =
          await this.ports.balance.applyStockTransfer(mutation);
        const { movement, ledgerEntries } =
          await this.ports.movementLedger.recordStockTransfer({
            mutation,
            sourceBalanceAfter: sourceBalance,
            destinationBalanceAfter: destinationBalance,
            occurredAt,
          });
        const traceabilityEvent = await this.ports.traceability.recordEvent({
          tenant_id: command.tenantId,
          event_type: TraceabilityEventType.MOVED,
          item_id: line.itemId,
          quantity: line.quantity,
          lot_number: line.lotNumber,
          serial_numbers: line.serialNumbers,
          from_location_id: line.fromLocationId,
          to_location_id: line.toLocationId,
          current_location_id: line.toLocationId,
          actor_id: command.actorId,
          actor_type: ActorType.USER,
          transaction_id: movement.id,
          transaction_type: 'warehouse_stock_transfer',
          reference_id: command.transferDocument.id,
          reference_type: command.transferDocument.type,
          occurred_at: occurredAt,
          reason: MovementReason.TRANSFER,
          metadata: {
            warehouse_sku_id: line.warehouseSkuId,
            from_warehouse_bin_id: line.fromWarehouseBinId,
            to_warehouse_bin_id: line.toWarehouseBinId,
            source_line_id: line.sourceLineId,
            transfer_document_number: command.transferDocument.number,
            ...line.metadata,
          },
        });

        await this.ports.events.publish(this.toInventoryMovedEvent({
          command,
          line,
          occurredAt,
          movementId: movement.id,
        }));

        const readBack = await this.ports.readBack.getStockTransferEvidence({
          tenant_id: command.tenantId,
          item_id: line.itemId,
          from_location_id: line.fromLocationId,
          to_location_id: line.toLocationId,
          movement_id: movement.id,
          traceability_event_id: traceabilityEvent.id,
        });

        lines.push({
          itemId: line.itemId,
          fromLocationId: line.fromLocationId,
          toLocationId: line.toLocationId,
          quantity: line.quantity,
          sourceBalanceBefore,
          sourceBalanceAfter: sourceBalance,
          destinationBalanceAfter: destinationBalance,
          movement,
          ledgerEntries,
          traceabilityEvent,
          readBack,
        });
      }

      return {
        ok: true,
        value: {
          tenantId: command.tenantId,
          transferDocumentId: command.transferDocument.id,
          lines,
        },
      };
    } catch (error) {
      return {
        ok: false,
        error: {
          code: 'WAREHOUSE_STOCK_TRANSFER_RUNTIME_FAILED',
          message: error instanceof Error
            ? error.message
            : 'Warehouse stock transfer runtime failed',
        },
      };
    }
  }

  private validateCommand(
    command: WarehouseStockTransferCommand
  ): WarehouseStockTransferResult | null {
    if (!hasText(command.tenantId)) {
      return failure('WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND', 'tenantId is required');
    }

    if (!hasText(command.actorId)) {
      return failure('WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND', 'actorId is required');
    }

    if (!hasText(command.transferDocument.id)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND',
        'transferDocument.id is required'
      );
    }

    if (command.lines.length === 0) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND',
        'at least one stock transfer line is required'
      );
    }

    return null;
  }

  private validateLine(
    line: WarehouseStockTransferLineCommand,
    lineIndex: number
  ): WarehouseStockTransferResult | null {
    if (!hasText(line.warehouseSkuId)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND',
        'warehouseSkuId is required',
        lineIndex
      );
    }

    if (!hasText(line.fromWarehouseBinId)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND',
        'fromWarehouseBinId is required',
        lineIndex
      );
    }

    if (!hasText(line.toWarehouseBinId)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_INVALID_COMMAND',
        'toWarehouseBinId is required',
        lineIndex
      );
    }

    if (!hasText(line.itemId)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_CANONICAL_SKU_MISSING',
        'canonical itemId is required before stock transfer',
        lineIndex
      );
    }

    if (!hasText(line.fromLocationId)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_SOURCE_LOCATION_MISSING',
        'canonical source locationId is required before stock transfer',
        lineIndex
      );
    }

    if (!hasText(line.toLocationId)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_DESTINATION_LOCATION_MISSING',
        'canonical destination locationId is required before stock transfer',
        lineIndex
      );
    }

    if (line.fromLocationId === line.toLocationId) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_SAME_LOCATION',
        'source and destination locations must be different',
        lineIndex
      );
    }

    if (!Number.isFinite(line.quantity) || line.quantity <= 0) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_INVALID_QUANTITY',
        'quantity must be a positive finite number',
        lineIndex
      );
    }

    if (line.serialNumbers && line.serialNumbers.length > 0 && !hasText(line.lotNumber)) {
      return failure(
        'WAREHOUSE_STOCK_TRANSFER_SERIAL_REQUIRES_LOT',
        'serial numbers require lot number',
        lineIndex
      );
    }

    return null;
  }

  private toTransferMutation(
    command: WarehouseStockTransferCommand,
    line: WarehouseStockTransferLineCommand
  ): CanonicalTransferMutation {
    return {
      tenant_id: command.tenantId,
      item_id: line.itemId,
      from_location_id: line.fromLocationId,
      to_location_id: line.toLocationId,
      quantity: line.quantity,
      reason: MovementReason.TRANSFER,
      actor_id: command.actorId,
      reference_id: command.transferDocument.id,
      metadata: {
        warehouse_sku_id: line.warehouseSkuId,
        from_warehouse_bin_id: line.fromWarehouseBinId,
        to_warehouse_bin_id: line.toWarehouseBinId,
        source_line_id: line.sourceLineId,
        transfer_document_type: command.transferDocument.type,
        transfer_document_number: command.transferDocument.number,
        unit_of_measure: line.unitOfMeasure,
        lot_number: line.lotNumber,
        serial_numbers: line.serialNumbers,
        ...line.metadata,
      },
    };
  }

  private toInventoryMovedEvent(params: {
    command: WarehouseStockTransferCommand;
    line: WarehouseStockTransferLineCommand;
    occurredAt: Date;
    movementId: string;
  }): InventoryMovedEvent {
    const { command, line, occurredAt, movementId } = params;

    return {
      metadata: {
        event_id: this.idFactory(),
        event_type: 'InventoryMovedEvent',
        tenant_id: command.tenantId,
        occurred_at: occurredAt,
        actor_id: command.actorId,
        correlation_id: command.correlationId,
        causation_id: movementId,
      },
      item_id: line.itemId,
      from_location_id: line.fromLocationId,
      to_location_id: line.toLocationId,
      quantity: line.quantity,
      reason: MovementReason.TRANSFER,
      lot_number: line.lotNumber,
      serial_numbers: line.serialNumbers,
      transaction_id: movementId,
    };
  }
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function failure(
  code: WarehouseStockTransferErrorCode,
  message: string,
  lineIndex?: number
): WarehouseStockTransferResult {
  return {
    ok: false,
    error: {
      code,
      message,
      lineIndex,
    },
  };
}
