import {
  LedgerEntryType,
  TransactionStatus,
} from '../../contracts/inventory.contract';
import { TraceabilityEventType } from '../../contracts/traceability.contract';
import {
  WarehouseStockOutCanonicalFacade,
  type WarehouseStockOutCommand,
  type WarehouseStockOutPorts,
} from '../stock-out-canonical.facade';

describe('WarehouseStockOutCanonicalFacade', () => {
  const fixedNow = new Date('2026-10-08T09:00:00.000Z');

  function validCommand(quantity = 6): WarehouseStockOutCommand {
    return {
      tenantId: 'tenant-warehouse-1',
      actorId: 'user-issue-1',
      correlationId: 'corr-issue-1',
      issueDocument: {
        id: 'issue-1',
        number: 'ISS-001',
        type: 'warehouse_issue',
      },
      lines: [
        {
          warehouseSkuId: 'wh-sku-1',
          warehouseBinId: 'bin-1',
          itemId: 'item-1',
          locationId: 'loc-1',
          quantity,
          unitOfMeasure: 'EA',
          reason: 'disposal',
          lotNumber: 'LOT-1',
          serialNumbers: ['SN-1'],
          sourceLineId: 'issue-line-1',
          unitCost: 1000,
          currency: 'VND',
        },
      ],
    };
  }

  function createPorts(calls: string[]): WarehouseStockOutPorts {
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
        applyStockOut: jest.fn(async (mutation) => {
          calls.push('balance');
          const onHand = 10 - mutation.quantity;
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
        recordStockOut: jest.fn(async ({ mutation, balanceAfter, occurredAt }) => {
          calls.push('movementLedger');
          return {
            movement: {
              id: 'movement-issue-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              quantity: mutation.quantity,
              reason: mutation.reason,
              status: TransactionStatus.COMPLETED,
              actor_id: mutation.actor_id,
              created_at: occurredAt,
            },
            ledgerEntry: {
              id: 'ledger-issue-1',
              tenant_id: mutation.tenant_id,
              item_id: mutation.item_id,
              location_id: mutation.location_id,
              entry_type: LedgerEntryType.MOVEMENT,
              quantity_delta: -mutation.quantity,
              balance_after: balanceAfter.on_hand,
              transaction_id: 'movement-issue-1',
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
            id: 'trace-issue-1',
            tenant_id: request.tenant_id,
            event_type: request.event_type,
            item_id: request.item_id,
            quantity: request.quantity,
            lot_number: request.lot_number,
            serial_numbers: request.serial_numbers,
            from_location_id: request.from_location_id,
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
        getStockOutEvidence: jest.fn(async (params) => {
          calls.push('readBack');
          return {
            balance: {
              item_id: params.item_id,
              location_id: params.location_id,
              on_hand: 4,
              allocated: 0,
              available: 4,
              tenant_id: params.tenant_id,
              updated_at: fixedNow,
            },
            movement: {
              id: params.movement_id,
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              quantity: 6,
              reason: 'disposal',
              status: TransactionStatus.COMPLETED,
              actor_id: 'user-issue-1',
              created_at: fixedNow,
            },
            ledgerEntry: {
              id: 'ledger-issue-1',
              tenant_id: params.tenant_id,
              item_id: params.item_id,
              location_id: params.location_id,
              entry_type: LedgerEntryType.MOVEMENT,
              quantity_delta: -6,
              balance_after: 4,
              transaction_id: params.movement_id,
              actor_id: 'user-issue-1',
              reason: 'disposal',
              created_at: fixedNow,
            },
            traceability: {
              id: params.traceability_event_id,
              tenant_id: params.tenant_id,
              event_type: TraceabilityEventType.SHIPPED,
              item_id: params.item_id,
              quantity: 6,
              from_location_id: params.location_id,
              actor_id: 'user-issue-1',
              actor_type: 'user',
              occurred_at: fixedNow,
              recorded_at: fixedNow,
            },
          };
        }),
      },
    };
  }

  it('executes stock out through canonical source balance, balance mutation, movement/ledger, audit, event, and read-back', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-issue-1',
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
    expect(ports.balance.applyStockOut).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: 'tenant-warehouse-1',
        item_id: 'item-1',
        location_id: 'loc-1',
        quantity: 6,
        reason: 'disposal',
        actor_id: 'user-issue-1',
        reference_id: 'issue-1',
      })
    );
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({
          event_id: 'event-issue-1',
          event_type: 'InventoryIssuedEvent',
          tenant_id: 'tenant-warehouse-1',
          causation_id: 'movement-issue-1',
        }),
        item_id: 'item-1',
        from_location_id: 'loc-1',
        quantity: 6,
        reason: 'disposal',
        reference_id: 'issue-1',
      })
    );
  });

  it('records damage issue with damaged traceability event', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].reason = 'damage';

    const result = await facade.execute(command);

    expect(result.ok).toBe(true);
    expect(ports.traceability.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: TraceabilityEventType.DAMAGED,
        reason: 'damage',
      })
    );
  });

  it('fails before mutation when canonical SKU mapping is missing', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);
    const command = validCommand();
    command.lines[0].itemId = '';

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_CANONICAL_SKU_MISSING',
        message: 'canonical itemId is required before stock out',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when quantity is invalid', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);

    const result = await facade.execute(validCommand(0));

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_INVALID_QUANTITY',
        message: 'quantity must be a positive finite number',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
  });

  it('fails before mutation when source balance is insufficient', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockOutCanonicalFacade(ports);

    const result = await facade.execute(validCommand(11));

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_INSUFFICIENT_SOURCE_BALANCE',
        message: 'source balance is insufficient for stock out',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual(['sourceBalance']);
    expect(ports.balance.applyStockOut).not.toHaveBeenCalled();
    expect(ports.events.publish).not.toHaveBeenCalled();
  });

  it('does not publish events when movement or audit persistence fails', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.movementLedger.recordStockOut = jest.fn(async () => {
      calls.push('movementLedger');
      throw new Error('movement ledger write failed');
    });
    const facade = new WarehouseStockOutCanonicalFacade(ports);

    const result = await facade.execute(validCommand());

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_OUT_RUNTIME_FAILED',
        message: 'movement ledger write failed',
      },
    });
    expect(calls).toEqual(['sourceBalance', 'balance', 'movementLedger']);
    expect(ports.events.publish).not.toHaveBeenCalled();
    expect(ports.readBack.getStockOutEvidence).not.toHaveBeenCalled();
  });
});
