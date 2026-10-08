import {
  AdjustmentReason,
  LedgerEntryType,
  TransactionStatus,
} from '../../contracts/inventory.contract';
import { TraceabilityEventType } from '../../contracts/traceability.contract';
import {
  WarehouseStockAdjustmentCanonicalFacade,
  type WarehouseStockAdjustmentCommand,
  type WarehouseStockAdjustmentPorts,
} from '../stock-adjustment-canonical.facade';

describe('WarehouseStockAdjustmentCanonicalFacade', () => {
  const fixedNow = new Date('2026-10-08T08:00:00.000Z');

  function validCommand(quantityDelta = 5): WarehouseStockAdjustmentCommand {
    return {
      tenantId: 'tenant-warehouse-1',
      actorId: 'user-adjust-1',
      correlationId: 'corr-adjust-1',
      adjustmentDocument: {
        id: 'adjustment-1',
        number: 'ADJ-001',
        type: 'cycle_count',
      },
      lines: [
        {
          warehouseSkuId: 'wh-sku-1',
          warehouseBinId: 'bin-1',
          itemId: 'item-1',
          locationId: 'loc-1',
          quantityDelta,
          unitOfMeasure: 'EA',
          reason: AdjustmentReason.CYCLE_COUNT,
          lotNumber: 'LOT-1',
          serialNumbers: ['SN-1'],
          sourceLineId: 'adjustment-line-1',
          unitCost: 1000,
          currency: 'VND',
        },
      ],
    };
  }

  function createPorts(calls: string[]): WarehouseStockAdjustmentPorts {
    return {
      balance: {
        getCurrentBalance: jest.fn(async (params) => {
          calls.push('currentBalance');
          return {
            item_id: params.item_id,
            location_id: params.location_id,
            on_hand: 10,
            allocated: 0,
            available: 10,
            tenant_id: params.tenant_id,
            updated_at: fixedNow,
          };
        }),
        applyStockAdjustment: jest.fn(async (mutation) => {
          calls.push('balance');
          const onHand = 10 + mutation.quantity_delta;
          return {
            item_id: mutation.item_id,
            location_id: mutation.location_id,
            on_hand: onHand,
            allocated: 0,
            available: onHand,
            tenant_id: mutation.tenant_id,
            updated_at: fixedNow,
          };
        }),
      },
      movementLedger: {
        recordStockAdjustment: jest.fn(async ({ mutation, balanceAfter, occurredAt }) => {
          calls.push('movementLedger');
          return {
            movement: {
              id: 'movement-adjustment-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              quantity_delta: mutation.quantity_delta,
              reason: mutation.reason,
              status: TransactionStatus.COMPLETED,
              actor_id: mutation.actor_id,
              created_at: occurredAt,
            },
            ledgerEntry: {
              id: 'ledger-adjustment-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              entry_type: LedgerEntryType.ADJUSTMENT,
              quantity_delta: mutation.quantity_delta,
              balance_after: balanceAfter.on_hand,
              transaction_id: 'movement-adjustment-1',
              actor_id: mutation.actor_id,
              reason: mutation.reason,
              created_at: occurredAt,
            },
          };
        }),
      },
      traceability: {
        recordEvent: jest.fn(async (request) => {
          calls.push('traceability');
          return {
            id: 'trace-adjustment-1',
            tenant_id: request.tenant_id,
            event_type: request.event_type,
            item_id: request.item_id,
            quantity: request.quantity,
            lot_number: request.lot_number,
            serial_numbers: request.serial_numbers,
            current_location_id: request.current_location_id,
            actor_id: request.actor_id,
            actor_type: request.actor_type,
            transaction_id: request.transaction_id,
            transaction_type: request.transaction_type,
            reference_id: request.reference_id,
            reference_type: request.reference_type,
            occurred_at: request.occurred_at ?? fixedNow,
            recorded_at: fixedNow,
            reason: request.reason,
            notes: request.notes,
            metadata: request.metadata,
          };
        }),
      },
      events: {
        publish: jest.fn(async () => {
          calls.push('event');
        }),
      },
      readBack: {
        getStockAdjustmentEvidence: jest.fn(async (params) => {
          calls.push('readBack');
          return {
            balance: {
              item_id: params.item_id,
              location_id: params.location_id,
              on_hand: 15,
              allocated: 0,
              available: 15,
              tenant_id: params.tenant_id,
              updated_at: fixedNow,
            },
            movement: {
              id: params.movement_id,
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              quantity_delta: 5,
              reason: AdjustmentReason.CYCLE_COUNT,
              status: TransactionStatus.COMPLETED,
              actor_id: 'user-adjust-1',
              created_at: fixedNow,
            },
            ledgerEntry: {
              id: 'ledger-adjustment-1',
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              entry_type: LedgerEntryType.ADJUSTMENT,
              quantity_delta: 5,
              balance_after: 15,
              transaction_id: params.movement_id,
              actor_id: 'user-adjust-1',
              reason: AdjustmentReason.CYCLE_COUNT,
              created_at: fixedNow,
            },
            traceability: {
              id: params.traceability_event_id,
              tenant_id: params.tenant_id,
              event_type: TraceabilityEventType.ADJUSTED,
              item_id: params.item_id,
              quantity: 5,
              current_location_id: params.location_id,
              actor_id: 'user-adjust-1',
              actor_type: 'user',
              occurred_at: fixedNow,
              recorded_at: fixedNow,
            },
          };
        }),
      },
    };
  }

  it('executes stock adjustment through canonical balance, movement/ledger, audit, event, and read-back', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockAdjustmentCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-adjustment-1',
    });

    const result = await facade.execute(validCommand());

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'currentBalance',
      'balance',
      'movementLedger',
      'traceability',
      'event',
      'readBack',
    ]);
    expect(ports.balance.applyStockAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-warehouse-1',
        item_id: 'item-1',
        location_id: 'loc-1',
        quantity_delta: 5,
        reason: AdjustmentReason.CYCLE_COUNT,
        actor_id: 'user-adjust-1',
        reference_id: 'adjustment-1',
      })
    );
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          event_id: 'event-adjustment-1',
          event_type: 'InventoryAdjustedEvent',
          tenant_id: 'tenant-warehouse-1',
          causation_id: 'movement-adjustment-1',
        }),
        item_id: 'item-1',
        location_id: 'loc-1',
        quantity_delta: 5,
        quantity_before: 10,
        quantity_after: 15,
        reason: AdjustmentReason.CYCLE_COUNT,
        adjustment_id: 'movement-adjustment-1',
      })
    );
  });

  it('supports negative adjustment when source balance remains non-negative', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockAdjustmentCanonicalFacade(ports);

    const result = await facade.execute(validCommand(-4));

    expect(result.ok).toBe(true);
    expect(ports.balance.applyStockAdjustment).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity_delta: -4,
      })
    );
  });

  it('fails before mutation when canonical SKU mapping is missing', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockAdjustmentCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].itemId = '';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_ADJUSTMENT_CANONICAL_SKU_MISSING',
        message: 'canonical itemId is required before stock adjustment',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when quantity delta is zero', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockAdjustmentCanonicalFacade(ports);

    const result = await facade.execute(validCommand(0));

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_ADJUSTMENT_INVALID_QUANTITY_DELTA',
        message: 'quantityDelta must be a non-zero finite number',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when adjustment would make stock negative', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockAdjustmentCanonicalFacade(ports);

    const result = await facade.execute(validCommand(-11));

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_ADJUSTMENT_NEGATIVE_BALANCE',
        message: 'stock adjustment would make inventory balance negative',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual(['currentBalance']);
    expect(ports.balance.applyStockAdjustment).not.toHaveBeenCalled();
    expect(ports.events.publish).not.toHaveBeenCalled();
  });

  it('does not publish events when movement or audit persistence fails', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.movementLedger.recordStockAdjustment = jest.fn(async () => {
      calls.push('movementLedger');
      throw new Error('movement ledger write failed');
    });
    const facade = new WarehouseStockAdjustmentCanonicalFacade(ports);

    const result = await facade.execute(validCommand());

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_ADJUSTMENT_RUNTIME_FAILED',
        message: 'movement ledger write failed',
      },
    });
    expect(calls).toEqual(['currentBalance', 'balance', 'movementLedger']);
    expect(ports.events.publish).not.toHaveBeenCalled();
    expect(ports.readBack.getStockAdjustmentEvidence).not.toHaveBeenCalled();
  });
});
