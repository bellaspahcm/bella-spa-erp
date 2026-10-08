import { MovementReason, TransactionStatus } from '../../contracts/inventory.contract';
import { TraceabilityEventType } from '../../contracts/traceability.contract';
import {
  WarehouseStockInCanonicalFacade,
  type WarehouseStockInCommand,
  type WarehouseStockInPorts,
} from '../stock-in-canonical.facade';

describe('WarehouseStockInCanonicalFacade', () => {
  const fixedNow = new Date('2026-10-07T08:00:00.000Z');

  function validCommand(): WarehouseStockInCommand {
    return {
      tenantId: 'tenant-warehouse-1',
      actorId: 'user-receiver-1',
      correlationId: 'corr-1',
      sourceDocument: {
        id: 'po-1',
        number: 'PO-001',
        type: 'purchase_order',
      },
      lines: [
        {
          warehouseSkuId: 'wh-sku-1',
          warehouseBinId: 'bin-1',
          itemId: 'item-1',
          locationId: 'loc-1',
          quantity: 12,
          unitOfMeasure: 'EA',
          lotNumber: 'LOT-1',
          serialNumbers: ['SN-1'],
          unitCost: 1000,
          currency: 'VND',
          supplierId: 'supplier-1',
          sourceLineId: 'po-line-1',
        },
      ],
    };
  }

  function createPorts(calls: string[]): WarehouseStockInPorts {
    return {
      balance: {
        applyStockIn: jest.fn(async (mutation) => {
          calls.push('balance');
          return {
            item_id: mutation.item_id,
            location_id: mutation.location_id,
            on_hand: mutation.quantity_delta,
            allocated: 0,
            available: mutation.quantity_delta,
            tenant_id: mutation.tenant_id,
            updated_at: fixedNow,
          };
        }),
      },
      movementLedger: {
        recordStockIn: jest.fn(async ({ mutation, balanceAfter, occurredAt }) => {
          calls.push('movementLedger');
          return {
            movement: {
              id: 'movement-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              quantity: mutation.quantity_delta,
              reason: MovementReason.RECEIPT,
              status: TransactionStatus.COMPLETED,
              actor_id: mutation.actor_id,
              created_at: occurredAt,
            },
            ledgerEntry: {
              id: 'ledger-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              entry_type: 'movement',
              quantity_delta: mutation.quantity_delta,
              balance_after: balanceAfter.on_hand,
              transaction_id: 'movement-1',
              actor_id: mutation.actor_id,
              reason: MovementReason.RECEIPT,
              created_at: occurredAt,
            },
          };
        }),
      },
      traceability: {
        recordEvent: jest.fn(async (request) => {
          calls.push('traceability');
          return {
            id: 'trace-1',
            tenant_id: request.tenant_id,
            event_type: request.event_type,
            item_id: request.item_id,
            quantity: request.quantity,
            lot_number: request.lot_number,
            serial_numbers: request.serial_numbers,
            to_location_id: request.to_location_id,
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
        getStockInEvidence: jest.fn(async (params) => {
          calls.push('readBack');
          return {
            balance: {
              item_id: params.item_id,
              location_id: params.location_id,
              on_hand: 12,
              allocated: 0,
              available: 12,
              tenant_id: params.tenant_id,
              updated_at: fixedNow,
            },
            movement: {
              id: params.movement_id,
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              quantity: 12,
              reason: MovementReason.RECEIPT,
              status: TransactionStatus.COMPLETED,
              actor_id: 'user-receiver-1',
              created_at: fixedNow,
            },
            ledgerEntry: {
              id: 'ledger-1',
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              entry_type: 'movement',
              quantity_delta: 12,
              balance_after: 12,
              transaction_id: params.movement_id,
              actor_id: 'user-receiver-1',
              reason: MovementReason.RECEIPT,
              created_at: fixedNow,
            },
            traceability: {
              id: params.traceability_event_id,
              tenant_id: params.tenant_id,
              event_type: TraceabilityEventType.RECEIVED,
              item_id: params.item_id,
              quantity: 12,
              current_location_id: params.location_id,
              actor_id: 'user-receiver-1',
              actor_type: 'user',
              occurred_at: fixedNow,
              recorded_at: fixedNow,
            },
          };
        }),
      },
    };
  }

  it('executes stock in through canonical balance, movement/ledger, audit, event, and read-back', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockInCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-1',
    });

    const result = await facade.execute(validCommand());

    expect(result.ok).toBe(true);
    expect(calls).toEqual(['balance', 'movementLedger', 'traceability', 'event', 'readBack']);
    expect(ports.balance.applyStockIn).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-warehouse-1',
        item_id: 'item-1',
        location_id: 'loc-1',
        quantity_delta: 12,
        reason: MovementReason.RECEIPT,
        actor_id: 'user-receiver-1',
        reference_id: 'po-1',
      })
    );
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          event_id: 'event-1',
          event_type: 'InventoryReceivedEvent',
          tenant_id: 'tenant-warehouse-1',
          causation_id: 'movement-1',
        }),
        item_id: 'item-1',
        location_id: 'loc-1',
        quantity: 12,
        reference_id: 'po-1',
        reference_type: 'purchase_order',
      })
    );
  });

  it('fails before mutation when canonical SKU mapping is missing', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].itemId = '';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_CANONICAL_SKU_MISSING',
        message: 'canonical itemId is required before stock mutation',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when canonical location mapping is missing', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].locationId = '';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_CANONICAL_LOCATION_MISSING',
        message: 'canonical locationId is required before stock mutation',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('does not publish events when movement or audit persistence fails', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.movementLedger.recordStockIn = jest.fn(async () => {
      calls.push('movementLedger');
      throw new Error('movement ledger write failed');
    });
    const facade = new WarehouseStockInCanonicalFacade(ports);

    const result = await facade.execute(validCommand());

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_RUNTIME_FAILED',
        message: 'movement ledger write failed',
      },
    });
    expect(calls).toEqual(['balance', 'movementLedger']);
    expect(ports.events.publish).not.toHaveBeenCalled();
    expect(ports.readBack.getStockInEvidence).not.toHaveBeenCalled();
  });
});
