import {
  LedgerEntryType,
  MovementReason,
  TransactionStatus,
} from '../../contracts/inventory.contract';
import { TraceabilityEventType } from '../../contracts/traceability.contract';
import {
  WarehouseStockTransferCanonicalFacade,
  type WarehouseStockTransferCommand,
  type WarehouseStockTransferPorts,
} from '../stock-transfer-canonical.facade';

describe('WarehouseStockTransferCanonicalFacade', () => {
  const fixedNow = new Date('2026-10-07T09:00:00.000Z');

  function validCommand(): WarehouseStockTransferCommand {
    return {
      tenantId: 'tenant-warehouse-1',
      actorId: 'user-transfer-1',
      correlationId: 'corr-transfer-1',
      transferDocument: {
        id: 'transfer-1',
        number: 'TRF-001',
        type: 'bin_transfer',
      },
      lines: [
        {
          warehouseSkuId: 'wh-sku-1',
          fromWarehouseBinId: 'bin-a',
          toWarehouseBinId: 'bin-b',
          itemId: 'item-1',
          fromLocationId: 'loc-a',
          toLocationId: 'loc-b',
          quantity: 7,
          unitOfMeasure: 'EA',
          lotNumber: 'LOT-1',
          serialNumbers: ['SN-1'],
          sourceLineId: 'transfer-line-1',
        },
      ],
    };
  }

  function createPorts(calls: string[]): WarehouseStockTransferPorts {
    return {
      balance: {
        getSourceBalance: jest.fn(async (params) => {
          calls.push('sourceBalance');
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
        applyStockTransfer: jest.fn(async (mutation) => {
          calls.push('balance');
          return {
            sourceBalance: {
              item_id: mutation.item_id,
              location_id: mutation.from_location_id,
              on_hand: 3,
              allocated: 0,
              available: 3,
              tenant_id: mutation.tenant_id,
              updated_at: fixedNow,
            },
            destinationBalance: {
              item_id: mutation.item_id,
              location_id: mutation.to_location_id,
              on_hand: 7,
              allocated: 0,
              available: 7,
              tenant_id: mutation.tenant_id,
              updated_at: fixedNow,
            },
          };
        }),
      },
      movementLedger: {
        recordStockTransfer: jest.fn(async ({ mutation, sourceBalanceAfter, destinationBalanceAfter, occurredAt }) => {
          calls.push('movementLedger');
          return {
            movement: {
              id: 'movement-transfer-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              from_location_id: mutation.from_location_id,
              to_location_id: mutation.to_location_id,
              quantity: mutation.quantity,
              reason: MovementReason.TRANSFER,
              status: TransactionStatus.COMPLETED,
              actor_id: mutation.actor_id,
              created_at: occurredAt,
            },
            ledgerEntries: [
              {
                id: 'ledger-source-1',
                tenant_id: mutation.tenant_id,
                item_id: mutation.item_id,
                location_id: mutation.from_location_id,
                entry_type: LedgerEntryType.MOVEMENT,
                quantity_delta: -mutation.quantity,
                balance_after: sourceBalanceAfter.on_hand,
                transaction_id: 'movement-transfer-1',
                actor_id: mutation.actor_id,
                reason: MovementReason.TRANSFER,
                created_at: occurredAt,
              },
              {
                id: 'ledger-destination-1',
                tenant_id: mutation.tenant_id,
                item_id: mutation.item_id,
                location_id: mutation.to_location_id,
                entry_type: LedgerEntryType.MOVEMENT,
                quantity_delta: mutation.quantity,
                balance_after: destinationBalanceAfter.on_hand,
                transaction_id: 'movement-transfer-1',
                actor_id: mutation.actor_id,
                reason: MovementReason.TRANSFER,
                created_at: occurredAt,
              },
            ],
          };
        }),
      },
      traceability: {
        recordEvent: jest.fn(async (request) => {
          calls.push('traceability');
          return {
            id: 'trace-transfer-1',
            tenant_id: request.tenant_id,
            event_type: request.event_type,
            item_id: request.item_id,
            quantity: request.quantity,
            lot_number: request.lot_number,
            serial_numbers: request.serial_numbers,
            from_location_id: request.from_location_id,
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
        getStockTransferEvidence: jest.fn(async (params) => {
          calls.push('readBack');
          return {
            sourceBalance: {
              item_id: params.item_id,
              location_id: params.from_location_id,
              on_hand: 3,
              allocated: 0,
              available: 3,
              tenant_id: params.tenant_id,
              updated_at: fixedNow,
            },
            destinationBalance: {
              item_id: params.item_id,
              location_id: params.to_location_id,
              on_hand: 7,
              allocated: 0,
              available: 7,
              tenant_id: params.tenant_id,
              updated_at: fixedNow,
            },
            movement: {
              id: params.movement_id,
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              from_location_id: params.from_location_id,
              to_location_id: params.to_location_id,
              quantity: 7,
              reason: MovementReason.TRANSFER,
              status: TransactionStatus.COMPLETED,
              actor_id: 'user-transfer-1',
              created_at: fixedNow,
            },
            ledgerEntries: [],
            traceability: {
              id: params.traceability_event_id,
              tenant_id: params.tenant_id,
              event_type: TraceabilityEventType.MOVED,
              item_id: params.item_id,
              quantity: 7,
              from_location_id: params.from_location_id,
              to_location_id: params.to_location_id,
              current_location_id: params.to_location_id,
              actor_id: 'user-transfer-1',
              actor_type: 'user',
              occurred_at: fixedNow,
              recorded_at: fixedNow,
            },
          };
        }),
      },
    };
  }

  it('executes stock transfer through canonical source balance, balance mutation, movement/ledger, audit, event, and read-back', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockTransferCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-transfer-1',
    });

    const result = await facade.execute(validCommand());

    expect(result.ok).toBe(true);
    expect(calls).toEqual([
      'sourceBalance',
      'balance',
      'movementLedger',
      'traceability',
      'event',
      'readBack',
    ]);
    expect(ports.balance.applyStockTransfer).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-warehouse-1',
        item_id: 'item-1',
        from_location_id: 'loc-a',
        to_location_id: 'loc-b',
        quantity: 7,
        reason: MovementReason.TRANSFER,
        actor_id: 'user-transfer-1',
        reference_id: 'transfer-1',
      })
    );
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          event_id: 'event-transfer-1',
          event_type: 'InventoryMovedEvent',
          tenant_id: 'tenant-warehouse-1',
          causation_id: 'movement-transfer-1',
        }),
        item_id: 'item-1',
        from_location_id: 'loc-a',
        to_location_id: 'loc-b',
        quantity: 7,
        reason: MovementReason.TRANSFER,
        transaction_id: 'movement-transfer-1',
      })
    );
  });

  it('fails before mutation when canonical SKU mapping is missing', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockTransferCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].itemId = '';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_TRANSFER_CANONICAL_SKU_MISSING',
        message: 'canonical itemId is required before stock transfer',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when source and destination locations are the same', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockTransferCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].toLocationId = 'loc-a';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_TRANSFER_SAME_LOCATION',
        message: 'source and destination locations must be different',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when source balance is insufficient', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.balance.getSourceBalance = jest.fn(async (params) => {
      calls.push('sourceBalance');
      return {
        item_id: params.item_id,
        location_id: params.location_id,
        on_hand: 6,
        allocated: 0,
        available: 6,
        tenant_id: params.tenant_id,
        updated_at: fixedNow,
      };
    });
    const facade = new WarehouseStockTransferCanonicalFacade(ports);

    const result = await facade.execute(validCommand());

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_TRANSFER_INSUFFICIENT_SOURCE_BALANCE',
        message: 'source balance is insufficient for stock transfer',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual(['sourceBalance']);
    expect(ports.balance.applyStockTransfer).not.toHaveBeenCalled();
    expect(ports.events.publish).not.toHaveBeenCalled();
  });

  it('does not publish events when movement or audit persistence fails', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.movementLedger.recordStockTransfer = jest.fn(async () => {
      calls.push('movementLedger');
      throw new Error('movement ledger write failed');
    });
    const facade = new WarehouseStockTransferCanonicalFacade(ports);

    const result = await facade.execute(validCommand());

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_TRANSFER_RUNTIME_FAILED',
        message: 'movement ledger write failed',
      },
    });
    expect(calls).toEqual(['sourceBalance', 'balance', 'movementLedger']);
    expect(ports.events.publish).not.toHaveBeenCalled();
    expect(ports.readBack.getStockTransferEvidence).not.toHaveBeenCalled();
  });
});
