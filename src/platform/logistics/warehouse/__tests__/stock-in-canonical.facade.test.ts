import { MovementReason, TransactionStatus } from '../../contracts/inventory.contract';
import { TraceabilityEventType } from '../../contracts/traceability.contract';
import {
  WarehouseStockInCanonicalFacade,
  type WarehouseStockInCommand,
  type WarehouseStockInIdempotencyRecord,
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

  function createPorts(
    calls: string[],
    idempotencyRecords = new Map<string, WarehouseStockInIdempotencyRecord>()
  ): WarehouseStockInPorts {
    return {
      transaction: {
        run: jest.fn(async (operation) => {
          calls.push('transaction');
          return operation();
        }),
      },
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
      idempotency: {
        claim: jest.fn(async (params) => {
          calls.push('idempotency:claim');
          const existing = idempotencyRecords.get(params.idempotencyKey);
          if (!existing) return { status: 'claimed' };
          if (existing.payloadHash !== params.payloadHash) return { status: 'conflict' };
          return { status: 'completed', record: existing };
        }),
        complete: jest.fn(async (record) => {
          calls.push('idempotency:complete');
          idempotencyRecords.set(record.idempotencyKey, record);
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

  it('executes production order stock in with required reference, QC disposition, and Logistics idempotency', async () => {
    const calls: string[] = [];
    const records = new Map<string, WarehouseStockInIdempotencyRecord>();
    const ports = createPorts(calls, records);
    const facade = new WarehouseStockInCanonicalFacade(ports, {
      now: () => fixedNow,
      idFactory: () => 'event-production-output-1',
    });
    const command = validCommand();
    command.sourceDocument = {
      id: 'finished-goods-receipt-1',
      number: 'FGR-001',
      type: 'production_order',
    };
    command.productionOutputReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      receiptLineId: 'finished-goods-receipt-line-1',
      idempotencyKey: 'finished-goods-receipt-key-1',
    };
    command.lines[0].sourceLineId = 'finished-goods-receipt-line-1';
    command.lines[0].qualityDisposition = {
      acceptedQuantity: 12,
      rejectedQuantity: 1,
      pendingQuantity: 0,
      qualityInspectionId: 'qc-1',
    };

    const first = await facade.execute(command);
    const second = await facade.execute(command);

    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) throw new Error('production order stock in failed');
    expect(first.value.isDuplicate).toBe(false);
    expect(second.value.isDuplicate).toBe(true);
    expect(ports.balance.applyStockIn).toHaveBeenCalledTimes(1);
    expect(ports.events.publish).toHaveBeenCalledTimes(1);
    expect(ports.events.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_id: 'finished-goods-receipt-1',
        reference_type: 'production_order',
      })
    );
    expect(ports.traceability.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        reference_id: 'finished-goods-receipt-1',
        reference_type: 'production_order',
        metadata: expect.objectContaining({
          production_order_id: 'production-order-1',
          production_order_line_id: 'production-order-line-1',
          production_receipt_line_id: 'finished-goods-receipt-line-1',
          production_output_idempotency_key: 'finished-goods-receipt-key-1',
          quality_disposition: expect.objectContaining({
            acceptedQuantity: 12,
            rejectedQuantity: 1,
          }),
        }),
      })
    );
    expect(calls).toEqual([
      'transaction',
      'idempotency:claim',
      'balance',
      'movementLedger',
      'traceability',
      'event',
      'readBack',
      'idempotency:complete',
      'transaction',
      'idempotency:claim',
    ]);
  });

  it('fails production order stock in before mutation without production reference', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.sourceDocument.type = 'production_order';
    command.lines[0].qualityDisposition = { acceptedQuantity: 12 };

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_PRODUCTION_REFERENCE_REQUIRED',
        message: 'production order stock in requires production order, production order line, and idempotency key',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockIn).not.toHaveBeenCalled();
  });

  it('fails production order stock in before mutation without QC disposition', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.sourceDocument.type = 'production_order';
    command.productionOutputReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'finished-goods-receipt-key-1',
    };

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_QC_DISPOSITION_REQUIRED',
        message: 'production order stock in requires QC disposition',
        lineIndex: 0,
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockIn).not.toHaveBeenCalled();
  });

  it('fails production order stock in before mutation without Logistics idempotency port', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.idempotency = undefined;
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.sourceDocument.type = 'production_order';
    command.productionOutputReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'finished-goods-receipt-key-1',
    };
    command.lines[0].qualityDisposition = { acceptedQuantity: 12 };

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_IDEMPOTENCY_REQUIRED',
        message: 'production order stock in requires Logistics idempotency',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockIn).not.toHaveBeenCalled();
  });

  it('fails production order stock in before mutation without transactional persistence', async () => {
    const calls: string[] = [];
    const ports = createPorts(calls);
    ports.transaction = undefined;
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.sourceDocument.type = 'production_order';
    command.productionOutputReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'finished-goods-receipt-key-1',
    };
    command.lines[0].qualityDisposition = { acceptedQuantity: 12 };

    const result = await facade.execute(command);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_TRANSACTION_REQUIRED',
        message: 'production order stock in requires transactional Logistics persistence',
      },
    });
    expect(calls).toEqual([]);
    expect(ports.balance.applyStockIn).not.toHaveBeenCalled();
  });

  it('rejects production order stock in retry with conflicting payload before mutation', async () => {
    const calls: string[] = [];
    const records = new Map<string, WarehouseStockInIdempotencyRecord>();
    const ports = createPorts(calls, records);
    const facade = new WarehouseStockInCanonicalFacade(ports);
    const command = validCommand();
    command.sourceDocument.type = 'production_order';
    command.productionOutputReference = {
      productionOrderId: 'production-order-1',
      productionOrderLineId: 'production-order-line-1',
      idempotencyKey: 'finished-goods-receipt-key-1',
    };
    command.lines[0].qualityDisposition = { acceptedQuantity: 12 };
    await facade.execute(command);

    const changed = validCommand();
    changed.sourceDocument.type = 'production_order';
    changed.productionOutputReference = command.productionOutputReference;
    changed.lines[0].quantity = 10;
    changed.lines[0].qualityDisposition = { acceptedQuantity: 10 };
    const result = await facade.execute(changed);

    expect(result).toEqual({
      ok: false,
      error: {
        code: 'WAREHOUSE_STOCK_IN_IDEMPOTENCY_CONFLICT',
        message: 'idempotency key was already claimed with a different payload',
      },
    });
    expect(ports.balance.applyStockIn).toHaveBeenCalledTimes(1);
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
