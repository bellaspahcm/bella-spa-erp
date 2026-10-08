import {
  AdjustmentReason,
  LedgerEntryType,
  MovementReason,
  TransactionStatus,
  type InventoryBalance,
  type InventoryLedgerEntry,
} from '../../contracts/inventory.contract';
import {
  ActorType,
  TraceabilityEventType,
  type TraceabilityEvent,
} from '../../contracts/traceability.contract';
import {
  WarehouseStockAdjustmentCanonicalFacade,
  type WarehouseStockAdjustmentPorts,
} from '../stock-adjustment-canonical.facade';
import {
  WarehouseStockInCanonicalFacade,
  type WarehouseStockInPorts,
} from '../stock-in-canonical.facade';
import {
  WarehouseStockOutCanonicalFacade,
  type WarehouseStockOutPorts,
} from '../stock-out-canonical.facade';
import {
  WarehouseStockTransferCanonicalFacade,
  type WarehouseStockTransferPorts,
} from '../stock-transfer-canonical.facade';

const tenantId = 'tenant-operational-chain';
const actorId = 'user-operational-chain';
const itemId = 'item-operational-chain';
const sourceLocationId = 'location-source';
const destinationLocationId = 'location-destination';
const lotNumber = 'LOT-CHAIN-1';

interface OperationalMovementRecord {
  id: string;
  movementType: string;
  direction: 'INBOUND' | 'OUTBOUND' | 'NEUTRAL';
  status: TransactionStatus.COMPLETED;
  itemId: string;
  sourceLocationId?: string;
  destinationLocationId?: string;
  quantity: number;
}

class OperationalChainStore {
  readonly movements: OperationalMovementRecord[] = [];
  readonly ledgerEntries: InventoryLedgerEntry[] = [];
  readonly traceabilityEvents: TraceabilityEvent[] = [];
  readonly publishedEventTypes: string[] = [];
  readonly callOrder: string[] = [];

  private readonly balances = new Map<string, InventoryBalance>();
  private movementCounter = 0;
  private ledgerCounter = 0;
  private traceabilityCounter = 0;

  getBalance(locationId: string): InventoryBalance {
    const balance = this.balances.get(this.balanceKey(locationId));
    if (balance) return balance;

    return this.setBalance(locationId, 0);
  }

  addBalance(locationId: string, quantityDelta: number): InventoryBalance {
    const current = this.getBalance(locationId);
    return this.setBalance(locationId, current.on_hand + quantityDelta);
  }

  moveBalance(fromLocationId: string, toLocationId: string, quantity: number): {
    sourceBalance: InventoryBalance;
    destinationBalance: InventoryBalance;
  } {
    return {
      sourceBalance: this.addBalance(fromLocationId, -quantity),
      destinationBalance: this.addBalance(toLocationId, quantity),
    };
  }

  recordLedger(params: {
    locationId: string;
    quantityDelta: number;
    balanceAfter: number;
    transactionId: string;
    reason: string;
    actorId: string;
    createdAt: Date;
    entryType: LedgerEntryType;
  }): InventoryLedgerEntry {
    this.ledgerCounter += 1;
    const entry: InventoryLedgerEntry = {
      id: `ledger-${this.ledgerCounter}`,
      tenant_id: tenantId,
      item_id: itemId,
      location_id: params.locationId,
      entry_type: params.entryType,
      quantity_delta: params.quantityDelta,
      balance_after: params.balanceAfter,
      transaction_id: params.transactionId,
      actor_id: params.actorId,
      reason: params.reason,
      created_at: params.createdAt,
    };

    this.ledgerEntries.push(entry);
    return entry;
  }

  nextMovementId(): string {
    this.movementCounter += 1;
    return `movement-${this.movementCounter}`;
  }

  recordTraceability(params: {
    eventType: TraceabilityEventType;
    quantity: number;
    fromLocationId?: string;
    toLocationId?: string;
    currentLocationId?: string;
    transactionId?: string;
    transactionType?: string;
    referenceId?: string;
    referenceType?: string;
    reason?: string;
    occurredAt?: Date;
    metadata?: Record<string, unknown>;
  }): TraceabilityEvent {
    this.traceabilityCounter += 1;
    const event: TraceabilityEvent = {
      id: `trace-${this.traceabilityCounter}`,
      tenant_id: tenantId,
      event_type: params.eventType,
      item_id: itemId,
      lot_number: lotNumber,
      quantity: params.quantity,
      from_location_id: params.fromLocationId,
      to_location_id: params.toLocationId,
      current_location_id: params.currentLocationId,
      actor_id: actorId,
      actor_type: ActorType.USER,
      transaction_id: params.transactionId,
      transaction_type: params.transactionType,
      reference_id: params.referenceId,
      reference_type: params.referenceType,
      occurred_at: params.occurredAt ?? new Date('2026-10-08T08:00:00.000Z'),
      recorded_at: new Date('2026-10-08T08:00:00.000Z'),
      reason: params.reason,
      metadata: params.metadata,
    };

    this.traceabilityEvents.push(event);
    return event;
  }

  getMovement(movementId: string): OperationalMovementRecord {
    const movement = this.movements.find((entry) => entry.id === movementId);
    if (!movement) throw new Error(`movement not found: ${movementId}`);
    return movement;
  }

  getLedgerByTransaction(transactionId: string): InventoryLedgerEntry[] {
    return this.ledgerEntries.filter((entry) => entry.transaction_id === transactionId);
  }

  getTraceability(traceabilityEventId: string): TraceabilityEvent {
    const event = this.traceabilityEvents.find((entry) => entry.id === traceabilityEventId);
    if (!event) throw new Error(`traceability event not found: ${traceabilityEventId}`);
    return event;
  }

  getTotalOnHand(): number {
    return this.getBalance(sourceLocationId).on_hand + this.getBalance(destinationLocationId).on_hand;
  }

  private setBalance(locationId: string, onHand: number): InventoryBalance {
    const balance: InventoryBalance = {
      tenant_id: tenantId,
      item_id: itemId,
      location_id: locationId,
      on_hand: onHand,
      allocated: 0,
      available: onHand,
      updated_at: new Date('2026-10-08T08:00:00.000Z'),
    };
    this.balances.set(this.balanceKey(locationId), balance);
    return balance;
  }

  private balanceKey(locationId: string): string {
    return `${tenantId}:${itemId}:${locationId}`;
  }
}

describe('Warehouse operational chain balance, ledger, audit, and read-back', () => {
  it('proves Stock-In -> Transfer -> Adjustment -> Stock-Out canonical read-back chain', async () => {
    const store = new OperationalChainStore();
    const occurredAt = new Date('2026-10-08T09:00:00.000Z');

    const stockIn = new WarehouseStockInCanonicalFacade(createStockInPorts(store), {
      idFactory: () => 'event-stock-in',
      now: () => occurredAt,
    });
    const transfer = new WarehouseStockTransferCanonicalFacade(createTransferPorts(store), {
      idFactory: () => 'event-transfer',
      now: () => occurredAt,
    });
    const adjustment = new WarehouseStockAdjustmentCanonicalFacade(createAdjustmentPorts(store), {
      idFactory: () => 'event-adjustment',
      now: () => occurredAt,
    });
    const stockOut = new WarehouseStockOutCanonicalFacade(createStockOutPorts(store), {
      idFactory: () => 'event-stock-out',
      now: () => occurredAt,
    });

    const stockInResult = await stockIn.execute({
      tenantId,
      actorId,
      correlationId: 'corr-chain',
      sourceDocument: {
        id: '11111111-1111-4111-8111-111111111111',
        number: 'RCV-CHAIN-1',
        type: 'purchase_order',
      },
      lines: [{
        warehouseSkuId: 'warehouse-sku-chain',
        warehouseBinId: 'bin-source',
        itemId,
        locationId: sourceLocationId,
        quantity: 20,
        unitOfMeasure: 'EA',
        lotNumber,
      }],
    });
    expect(stockInResult.ok).toBe(true);
    if (!stockInResult.ok) throw new Error(stockInResult.error.message);

    const transferResult = await transfer.execute({
      tenantId,
      actorId,
      correlationId: 'corr-chain',
      transferDocument: {
        id: '22222222-2222-4222-8222-222222222222',
        number: 'TRF-CHAIN-1',
        type: 'warehouse_transfer',
      },
      lines: [{
        warehouseSkuId: 'warehouse-sku-chain',
        fromWarehouseBinId: 'bin-source',
        toWarehouseBinId: 'bin-destination',
        itemId,
        fromLocationId: sourceLocationId,
        toLocationId: destinationLocationId,
        quantity: 8,
        unitOfMeasure: 'EA',
        lotNumber,
      }],
    });
    expect(transferResult.ok).toBe(true);
    if (!transferResult.ok) throw new Error(transferResult.error.message);

    const adjustmentIncreaseResult = await adjustment.execute({
      tenantId,
      actorId,
      correlationId: 'corr-chain',
      adjustmentDocument: {
        id: '33333333-3333-4333-8333-333333333333',
        number: 'ADJ-CHAIN-IN',
        type: 'cycle_count',
      },
      lines: [{
        warehouseSkuId: 'warehouse-sku-chain',
        warehouseBinId: 'bin-destination',
        itemId,
        locationId: destinationLocationId,
        quantityDelta: 3,
        unitOfMeasure: 'EA',
        reason: AdjustmentReason.FOUND,
        lotNumber,
      }],
    });
    expect(adjustmentIncreaseResult.ok).toBe(true);
    if (!adjustmentIncreaseResult.ok) throw new Error(adjustmentIncreaseResult.error.message);

    const adjustmentDecreaseResult = await adjustment.execute({
      tenantId,
      actorId,
      correlationId: 'corr-chain',
      adjustmentDocument: {
        id: '44444444-4444-4444-8444-444444444444',
        number: 'ADJ-CHAIN-OUT',
        type: 'correction',
      },
      lines: [{
        warehouseSkuId: 'warehouse-sku-chain',
        warehouseBinId: 'bin-source',
        itemId,
        locationId: sourceLocationId,
        quantityDelta: -2,
        unitOfMeasure: 'EA',
        reason: AdjustmentReason.CORRECTION,
        lotNumber,
      }],
    });
    expect(adjustmentDecreaseResult.ok).toBe(true);
    if (!adjustmentDecreaseResult.ok) throw new Error(adjustmentDecreaseResult.error.message);

    const stockOutResult = await stockOut.execute({
      tenantId,
      actorId,
      correlationId: 'corr-chain',
      issueDocument: {
        id: '55555555-5555-4555-8555-555555555555',
        number: 'ISS-CHAIN-1',
        type: 'warehouse_issue',
      },
      lines: [{
        warehouseSkuId: 'warehouse-sku-chain',
        warehouseBinId: 'bin-destination',
        itemId,
        locationId: destinationLocationId,
        quantity: 4.5,
        unitOfMeasure: 'EA',
        reason: 'disposal',
        lotNumber,
      }],
    });
    expect(stockOutResult.ok).toBe(true);
    if (!stockOutResult.ok) throw new Error(stockOutResult.error.message);

    expect(store.getBalance(sourceLocationId).on_hand).toBe(10);
    expect(store.getBalance(destinationLocationId).on_hand).toBe(6.5);
    expect(store.getTotalOnHand()).toBe(16.5);
    expect(store.movements.map((movement) => movement.movementType)).toEqual([
      'RECEIPT',
      'TRANSFER',
      'ADJUSTMENT_INCREASE',
      'ADJUSTMENT_DECREASE',
      'ISSUE',
    ]);
    expect(store.movements.every((movement) => movement.status === TransactionStatus.COMPLETED))
      .toBe(true);
    expect(store.ledgerEntries).toHaveLength(6);
    expect(store.traceabilityEvents.map((event) => event.event_type)).toEqual([
      TraceabilityEventType.RECEIVED,
      TraceabilityEventType.MOVED,
      TraceabilityEventType.ADJUSTED,
      TraceabilityEventType.ADJUSTED,
      TraceabilityEventType.SHIPPED,
    ]);
    expect(store.publishedEventTypes).toEqual([
      'InventoryReceivedEvent',
      'InventoryMovedEvent',
      'InventoryAdjustedEvent',
      'InventoryAdjustedEvent',
      'InventoryIssuedEvent',
    ]);
    expect(store.callOrder).toEqual([
      'stock-in:balance',
      'stock-in:movement-ledger',
      'stock-in:traceability',
      'stock-in:event',
      'stock-in:read-back',
      'transfer:source-balance',
      'transfer:balance',
      'transfer:movement-ledger',
      'transfer:traceability',
      'transfer:event',
      'transfer:read-back',
      'adjustment:current-balance',
      'adjustment:balance',
      'adjustment:movement-ledger',
      'adjustment:traceability',
      'adjustment:event',
      'adjustment:read-back',
      'adjustment:current-balance',
      'adjustment:balance',
      'adjustment:movement-ledger',
      'adjustment:traceability',
      'adjustment:event',
      'adjustment:read-back',
      'stock-out:source-balance',
      'stock-out:balance',
      'stock-out:movement-ledger',
      'stock-out:traceability',
      'stock-out:event',
      'stock-out:read-back',
    ]);
  });
});

function createStockInPorts(store: OperationalChainStore): WarehouseStockInPorts {
  return {
    balance: {
      applyStockIn: async (mutation) => {
        store.callOrder.push('stock-in:balance');
        return store.addBalance(mutation.location_id, mutation.quantity_delta);
      },
    },
    movementLedger: {
      recordStockIn: async ({ mutation, balanceAfter, occurredAt }) => {
        store.callOrder.push('stock-in:movement-ledger');
        const movement = {
          id: store.nextMovementId(),
          tenant_id: mutation.tenant_id,
          item_id: mutation.item_id,
          location_id: mutation.location_id,
          quantity: mutation.quantity_delta,
          reason: MovementReason.RECEIPT,
          status: TransactionStatus.COMPLETED,
          actor_id: mutation.actor_id,
          created_at: occurredAt,
        };
        store.movements.push({
          id: movement.id,
          movementType: 'RECEIPT',
          direction: 'INBOUND',
          status: movement.status,
          itemId: movement.item_id,
          destinationLocationId: movement.location_id,
          quantity: movement.quantity,
        });
        const ledgerEntry = store.recordLedger({
          locationId: mutation.location_id,
          quantityDelta: mutation.quantity_delta,
          balanceAfter: balanceAfter.on_hand,
          transactionId: movement.id,
          reason: MovementReason.RECEIPT,
          actorId: mutation.actor_id,
          createdAt: occurredAt,
          entryType: LedgerEntryType.MOVEMENT,
        });
        return { movement, ledgerEntry };
      },
    },
    traceability: {
      recordEvent: async (request) => {
        store.callOrder.push('stock-in:traceability');
        return store.recordTraceability({
          eventType: request.event_type,
          quantity: request.quantity,
          toLocationId: request.to_location_id,
          currentLocationId: request.current_location_id,
          transactionId: request.transaction_id,
          transactionType: request.transaction_type,
          referenceId: request.reference_id,
          referenceType: request.reference_type,
          reason: request.reason,
          occurredAt: request.occurred_at,
          metadata: request.metadata,
        });
      },
    },
    events: {
      publish: async (event) => {
        store.callOrder.push('stock-in:event');
        store.publishedEventTypes.push(event.metadata.event_type);
      },
    },
    readBack: {
      getStockInEvidence: async (params) => {
        store.callOrder.push('stock-in:read-back');
        return {
          balance: store.getBalance(params.location_id),
          ledgerEntry: store.getLedgerByTransaction(params.movement_id)[0],
          movement: {
            id: params.movement_id,
            tenant_id: params.tenant_id,
            item_id: params.item_id,
            location_id: params.location_id,
            quantity: store.getMovement(params.movement_id).quantity,
            reason: MovementReason.RECEIPT,
            status: TransactionStatus.COMPLETED,
            actor_id: actorId,
            created_at: new Date('2026-10-08T09:00:00.000Z'),
          },
          traceability: store.getTraceability(params.traceability_event_id),
        };
      },
    },
  };
}

function createTransferPorts(store: OperationalChainStore): WarehouseStockTransferPorts {
  return {
    balance: {
      getSourceBalance: async (params) => {
        store.callOrder.push('transfer:source-balance');
        return store.getBalance(params.location_id);
      },
      applyStockTransfer: async (mutation) => {
        store.callOrder.push('transfer:balance');
        return store.moveBalance(
          mutation.from_location_id,
          mutation.to_location_id,
          mutation.quantity
        );
      },
    },
    movementLedger: {
      recordStockTransfer: async ({
        mutation,
        sourceBalanceAfter,
        destinationBalanceAfter,
        occurredAt,
      }) => {
        store.callOrder.push('transfer:movement-ledger');
        const movement = {
          id: store.nextMovementId(),
          tenant_id: mutation.tenant_id,
          item_id: mutation.item_id,
          from_location_id: mutation.from_location_id,
          to_location_id: mutation.to_location_id,
          quantity: mutation.quantity,
          reason: MovementReason.TRANSFER,
          status: TransactionStatus.COMPLETED,
          actor_id: mutation.actor_id,
          created_at: occurredAt,
        };
        store.movements.push({
          id: movement.id,
          movementType: 'TRANSFER',
          direction: 'NEUTRAL',
          status: movement.status,
          itemId: movement.item_id,
          sourceLocationId: movement.from_location_id,
          destinationLocationId: movement.to_location_id,
          quantity: movement.quantity,
        });
        const sourceLedgerEntry = store.recordLedger({
          locationId: mutation.from_location_id,
          quantityDelta: -mutation.quantity,
          balanceAfter: sourceBalanceAfter.on_hand,
          transactionId: movement.id,
          reason: MovementReason.TRANSFER,
          actorId: mutation.actor_id,
          createdAt: occurredAt,
          entryType: LedgerEntryType.MOVEMENT,
        });
        const destinationLedgerEntry = store.recordLedger({
          locationId: mutation.to_location_id,
          quantityDelta: mutation.quantity,
          balanceAfter: destinationBalanceAfter.on_hand,
          transactionId: movement.id,
          reason: MovementReason.TRANSFER,
          actorId: mutation.actor_id,
          createdAt: occurredAt,
          entryType: LedgerEntryType.MOVEMENT,
        });
        return {
          movement,
          ledgerEntries: [sourceLedgerEntry, destinationLedgerEntry],
        };
      },
    },
    traceability: {
      recordEvent: async (request) => {
        store.callOrder.push('transfer:traceability');
        return store.recordTraceability({
          eventType: request.event_type,
          quantity: request.quantity,
          fromLocationId: request.from_location_id,
          toLocationId: request.to_location_id,
          currentLocationId: request.current_location_id,
          transactionId: request.transaction_id,
          transactionType: request.transaction_type,
          referenceId: request.reference_id,
          referenceType: request.reference_type,
          reason: request.reason,
          occurredAt: request.occurred_at,
          metadata: request.metadata,
        });
      },
    },
    events: {
      publish: async (event) => {
        store.callOrder.push('transfer:event');
        store.publishedEventTypes.push(event.metadata.event_type);
      },
    },
    readBack: {
      getStockTransferEvidence: async (params) => {
        store.callOrder.push('transfer:read-back');
        const movement = store.getMovement(params.movement_id);
        return {
          sourceBalance: store.getBalance(params.from_location_id),
          destinationBalance: store.getBalance(params.to_location_id),
          ledgerEntries: store.getLedgerByTransaction(params.movement_id),
          movement: {
            id: params.movement_id,
            tenant_id: params.tenant_id,
            item_id: params.item_id,
            from_location_id: params.from_location_id,
            to_location_id: params.to_location_id,
            quantity: movement.quantity,
            reason: MovementReason.TRANSFER,
            status: TransactionStatus.COMPLETED,
            actor_id: actorId,
            created_at: new Date('2026-10-08T09:00:00.000Z'),
          },
          traceability: store.getTraceability(params.traceability_event_id),
        };
      },
    },
  };
}

function createAdjustmentPorts(store: OperationalChainStore): WarehouseStockAdjustmentPorts {
  return {
    balance: {
      getCurrentBalance: async (params) => {
        store.callOrder.push('adjustment:current-balance');
        return store.getBalance(params.location_id);
      },
      applyStockAdjustment: async (mutation) => {
        store.callOrder.push('adjustment:balance');
        return store.addBalance(mutation.location_id, mutation.quantity_delta);
      },
    },
    movementLedger: {
      recordStockAdjustment: async ({ mutation, balanceAfter, occurredAt }) => {
        store.callOrder.push('adjustment:movement-ledger');
        const movement = {
          id: store.nextMovementId(),
          tenant_id: mutation.tenant_id,
          item_id: mutation.item_id,
          location_id: mutation.location_id,
          quantity_delta: mutation.quantity_delta,
          reason: mutation.reason,
          status: TransactionStatus.COMPLETED,
          actor_id: mutation.actor_id,
          created_at: occurredAt,
        };
        store.movements.push({
          id: movement.id,
          movementType: mutation.quantity_delta > 0
            ? 'ADJUSTMENT_INCREASE'
            : 'ADJUSTMENT_DECREASE',
          direction: mutation.quantity_delta > 0 ? 'INBOUND' : 'OUTBOUND',
          status: movement.status,
          itemId: movement.item_id,
          destinationLocationId: mutation.quantity_delta > 0 ? movement.location_id : undefined,
          sourceLocationId: mutation.quantity_delta < 0 ? movement.location_id : undefined,
          quantity: Math.abs(movement.quantity_delta),
        });
        const ledgerEntry = store.recordLedger({
          locationId: mutation.location_id,
          quantityDelta: mutation.quantity_delta,
          balanceAfter: balanceAfter.on_hand,
          transactionId: movement.id,
          reason: mutation.reason,
          actorId: mutation.actor_id,
          createdAt: occurredAt,
          entryType: LedgerEntryType.ADJUSTMENT,
        });
        return { movement, ledgerEntry };
      },
    },
    traceability: {
      recordEvent: async (request) => {
        store.callOrder.push('adjustment:traceability');
        return store.recordTraceability({
          eventType: request.event_type,
          quantity: request.quantity,
          currentLocationId: request.current_location_id,
          transactionId: request.transaction_id,
          transactionType: request.transaction_type,
          referenceId: request.reference_id,
          referenceType: request.reference_type,
          reason: request.reason,
          occurredAt: request.occurred_at,
          metadata: request.metadata,
        });
      },
    },
    events: {
      publish: async (event) => {
        store.callOrder.push('adjustment:event');
        store.publishedEventTypes.push(event.metadata.event_type);
      },
    },
    readBack: {
      getStockAdjustmentEvidence: async (params) => {
        store.callOrder.push('adjustment:read-back');
        const movement = store.getMovement(params.movement_id);
        const ledgerEntry = store.getLedgerByTransaction(params.movement_id)[0];
        return {
          balance: store.getBalance(params.location_id),
          ledgerEntry,
          movement: {
            id: params.movement_id,
            tenant_id: params.tenant_id,
            item_id: params.item_id,
            location_id: params.location_id,
            quantity_delta: ledgerEntry.quantity_delta,
            reason: toAdjustmentReason(ledgerEntry.reason),
            status: TransactionStatus.COMPLETED,
            actor_id: actorId,
            created_at: new Date('2026-10-08T09:00:00.000Z'),
          },
          traceability: store.getTraceability(params.traceability_event_id),
        };
      },
    },
  };
}

function toAdjustmentReason(value: string): AdjustmentReason {
  if (value === AdjustmentReason.DAMAGE) return AdjustmentReason.DAMAGE;
  if (value === AdjustmentReason.LOSS) return AdjustmentReason.LOSS;
  if (value === AdjustmentReason.FOUND) return AdjustmentReason.FOUND;
  if (value === AdjustmentReason.CYCLE_COUNT) return AdjustmentReason.CYCLE_COUNT;
  if (value === AdjustmentReason.RECONCILIATION) return AdjustmentReason.RECONCILIATION;
  if (value === AdjustmentReason.CORRECTION) return AdjustmentReason.CORRECTION;
  throw new Error(`unsupported adjustment reason: ${value}`);
}

function createStockOutPorts(store: OperationalChainStore): WarehouseStockOutPorts {
  return {
    balance: {
      getSourceBalance: async (params) => {
        store.callOrder.push('stock-out:source-balance');
        return store.getBalance(params.location_id);
      },
      applyStockOut: async (mutation) => {
        store.callOrder.push('stock-out:balance');
        return store.addBalance(mutation.location_id, -mutation.quantity);
      },
    },
    movementLedger: {
      recordStockOut: async ({ mutation, balanceAfter, occurredAt }) => {
        store.callOrder.push('stock-out:movement-ledger');
        const movement = {
          id: store.nextMovementId(),
          tenant_id: mutation.tenant_id,
          item_id: mutation.item_id,
          location_id: mutation.location_id,
          quantity: mutation.quantity,
          reason: mutation.reason,
          status: TransactionStatus.COMPLETED,
          actor_id: mutation.actor_id,
          created_at: occurredAt,
        };
        store.movements.push({
          id: movement.id,
          movementType: 'ISSUE',
          direction: 'OUTBOUND',
          status: movement.status,
          itemId: movement.item_id,
          sourceLocationId: movement.location_id,
          quantity: movement.quantity,
        });
        const ledgerEntry = store.recordLedger({
          locationId: mutation.location_id,
          quantityDelta: -mutation.quantity,
          balanceAfter: balanceAfter.on_hand,
          transactionId: movement.id,
          reason: mutation.reason,
          actorId: mutation.actor_id,
          createdAt: occurredAt,
          entryType: LedgerEntryType.MOVEMENT,
        });
        return { movement, ledgerEntry };
      },
    },
    traceability: {
      recordEvent: async (request) => {
        store.callOrder.push('stock-out:traceability');
        return store.recordTraceability({
          eventType: request.event_type,
          quantity: request.quantity,
          fromLocationId: request.from_location_id,
          transactionId: request.transaction_id,
          transactionType: request.transaction_type,
          referenceId: request.reference_id,
          referenceType: request.reference_type,
          reason: request.reason,
          occurredAt: request.occurred_at,
          metadata: request.metadata,
        });
      },
    },
    events: {
      publish: async (event) => {
        store.callOrder.push('stock-out:event');
        store.publishedEventTypes.push(event.metadata.event_type);
      },
    },
    readBack: {
      getStockOutEvidence: async (params) => {
        store.callOrder.push('stock-out:read-back');
        const movement = store.getMovement(params.movement_id);
        return {
          balance: store.getBalance(params.location_id),
          ledgerEntry: store.getLedgerByTransaction(params.movement_id)[0],
          movement: {
            id: params.movement_id,
            tenant_id: params.tenant_id,
            item_id: params.item_id,
            location_id: params.location_id,
            quantity: movement.quantity,
            reason: 'disposal',
            status: TransactionStatus.COMPLETED,
            actor_id: actorId,
            created_at: new Date('2026-10-08T09:00:00.000Z'),
          },
          traceability: store.getTraceability(params.traceability_event_id),
        };
      },
    },
  };
}
