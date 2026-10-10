import {
  FixedManufacturingClock,
  InMemoryManufacturingRepository,
  LogisticsMaterialAvailabilityAdapter,
  ManufacturingAuthorizationError,
  ManufacturingIdempotencyConflictError,
  ManufacturingSlice1Service,
  ManufacturingStateError,
  SequentialManufacturingIdFactory,
  StaticManufacturingAuthorization,
  type ManufacturingActor,
  type MaterialAvailabilityPort,
} from '..';
import type { IInventoryBalanceQuery } from '../../logistics/contracts/inventory.contract';

function createActor(overrides: Partial<ManufacturingActor> = {}): ManufacturingActor {
  return {
    tenantId: 'tenant-a',
    userId: 'planner-1',
    roles: ['manufacturing_planner'],
    factoryOrgUnitId: 'factory-branch-a',
    ...overrides,
  };
}

function createAvailability(availableByItem: Record<string, number>): MaterialAvailabilityPort & {
  calls: Array<{ tenantId: string; itemId: string; locationId: string }>;
} {
  return {
    calls: [],
    async getAvailable(params) {
      this.calls.push(params);
      return availableByItem[params.itemId] ?? 0;
    },
  };
}

function createService(availability: MaterialAvailabilityPort = createAvailability({ component_a: 100 })) {
  const repository = new InMemoryManufacturingRepository();
  const authorization = new StaticManufacturingAuthorization(
    { 'planner-1': 'factory-branch-a' },
    {
      'planner-1': [
        'manufacturing:production_order:write',
        'manufacturing:production_order:release',
        'manufacturing:bom:write',
        'manufacturing:bom:approve',
        'manufacturing:material_requirement:calculate',
        'manufacturing:availability:read',
      ],
    }
  );
  const service = new ManufacturingSlice1Service(
    repository,
    authorization,
    availability,
    new SequentialManufacturingIdFactory(),
    new FixedManufacturingClock()
  );
  return { service, repository };
}

async function createApprovedBomAndOrder(
  service: ManufacturingSlice1Service,
  actor: ManufacturingActor,
  options: { targetQuantity?: number; componentQuantity?: number; availableLocation?: string } = {}
) {
  const order = await service.createProductionOrder(actor, {
    idempotencyKey: 'create-po-1',
    orderNumber: 'PO-001',
    finishedGoodItemId: 'finished_good_a',
    targetQuantity: options.targetQuantity ?? 10,
    uom: 'EA',
  });
  const bom = await service.createBOMRevision(actor, {
    idempotencyKey: 'create-bom-1',
    finishedGoodItemId: 'finished_good_a',
    revisionCode: 'REV-1',
    components: [
      {
        componentItemId: 'component_a',
        quantityPerUnit: options.componentQuantity ?? 2,
        uom: 'EA',
      },
    ],
  });
  const approvedBom = await service.approveBOMRevision(actor, {
    idempotencyKey: 'approve-bom-1',
    bomRevisionId: bom.value.id,
  });
  return { order: order.value, bom: approvedBom.value };
}

describe('Manufacturing Slice 1', () => {
  it('creates a production order, calculates requirements from an approved BOM, and releases only after availability is proven', async () => {
    const availability = createAvailability({ component_a: 25 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);

    const requirements = await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-req-1',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });

    expect(requirements.value).toHaveLength(1);
    expect(requirements.value[0]).toMatchObject({
      tenantId: 'tenant-a',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      componentItemId: 'component_a',
      requiredQuantity: 20,
      availableQuantity: 25,
      status: 'available',
    });
    expect(availability.calls).toEqual([
      { tenantId: 'tenant-a', itemId: 'component_a', locationId: 'warehouse-bin-a' },
    ]);

    const released = await service.releaseProductionOrder(actor, {
      idempotencyKey: 'release-po-1',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
    });

    expect(released.value.status).toBe('released');
    expect(released.value.bomRevisionId).toBe(bom.id);
  });

  it('blocks invalid production order release before material requirements are calculated', async () => {
    const { service } = createService();
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);

    await expect(
      service.releaseProductionOrder(actor, {
        idempotencyKey: 'release-before-requirements',
        productionOrderId: order.id,
        bomRevisionId: bom.id,
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('marks material shortage and blocks release when Logistics availability is insufficient', async () => {
    const availability = createAvailability({ component_a: 5 });
    const { service } = createService(availability);
    const actor = createActor();
    const { order, bom } = await createApprovedBomAndOrder(service, actor);

    const requirements = await service.calculateMaterialRequirements(actor, {
      idempotencyKey: 'calc-shortage',
      productionOrderId: order.id,
      bomRevisionId: bom.id,
      sourceLocationId: 'warehouse-bin-a',
    });

    expect(requirements.value[0].status).toBe('shortage');
    await expect(
      service.releaseProductionOrder(actor, {
        idempotencyKey: 'release-shortage',
        productionOrderId: order.id,
        bomRevisionId: bom.id,
      })
    ).rejects.toThrow(ManufacturingStateError);
  });

  it('enforces tenant and factory authorization before Manufacturing mutation', async () => {
    const { service } = createService();
    const actor = createActor({ factoryOrgUnitId: 'factory-branch-b' });

    await expect(
      service.createProductionOrder(actor, {
        idempotencyKey: 'unauthorized-create',
        orderNumber: 'PO-UNAUTHORIZED',
        finishedGoodItemId: 'finished_good_a',
        targetQuantity: 1,
        uom: 'EA',
      })
    ).rejects.toThrow(ManufacturingAuthorizationError);
  });

  it('returns the original result for duplicate commands with the same payload', async () => {
    const { service } = createService();
    const actor = createActor();
    const command = {
      idempotencyKey: 'duplicate-create',
      orderNumber: 'PO-DUP',
      finishedGoodItemId: 'finished_good_a',
      targetQuantity: 10,
      uom: 'EA',
    };

    const first = await service.createProductionOrder(actor, command);
    const second = await service.createProductionOrder(actor, command);

    expect(first.isDuplicate).toBe(false);
    expect(second.isDuplicate).toBe(true);
    expect(second.value.id).toBe(first.value.id);
  });

  it('rejects duplicate command keys with conflicting payloads', async () => {
    const { service } = createService();
    const actor = createActor();
    await service.createProductionOrder(actor, {
      idempotencyKey: 'conflict-create',
      orderNumber: 'PO-CONFLICT',
      finishedGoodItemId: 'finished_good_a',
      targetQuantity: 10,
      uom: 'EA',
    });

    await expect(
      service.createProductionOrder(actor, {
        idempotencyKey: 'conflict-create',
        orderNumber: 'PO-CONFLICT-CHANGED',
        finishedGoodItemId: 'finished_good_a',
        targetQuantity: 10,
        uom: 'EA',
      })
    ).rejects.toThrow(ManufacturingIdempotencyConflictError);
  });

  it('reads material availability through the Logistics inventory balance contract', async () => {
    const calls: Array<{ tenant_id: string; item_id: string; location_id: string }> = [];
    const inventory: IInventoryBalanceQuery = {
      async getAvailable(params) {
        calls.push(params);
        return 42;
      },
      async getOnHand() {
        throw new Error('not used by Manufacturing Slice 1');
      },
      async getBalance() {
        throw new Error('not used by Manufacturing Slice 1');
      },
      async getBalancesByItem() {
        throw new Error('not used by Manufacturing Slice 1');
      },
      async getBalancesByLocation() {
        throw new Error('not used by Manufacturing Slice 1');
      },
    };

    const adapter = new LogisticsMaterialAvailabilityAdapter(inventory);
    const available = await adapter.getAvailable({
      tenantId: 'tenant-a',
      itemId: 'component_a',
      locationId: 'warehouse-bin-a',
    });

    expect(available).toBe(42);
    expect(calls).toEqual([
      {
        tenant_id: 'tenant-a',
        item_id: 'component_a',
        location_id: 'warehouse-bin-a',
      },
    ]);
  });

  it('keeps approved BOM revisions immutable for Slice 1 approval flow', async () => {
    const { service } = createService();
    const actor = createActor();
    const bom = await service.createBOMRevision(actor, {
      idempotencyKey: 'create-bom-immutable',
      finishedGoodItemId: 'finished_good_a',
      revisionCode: 'REV-IMMUTABLE',
      components: [{ componentItemId: 'component_a', quantityPerUnit: 1, uom: 'EA' }],
    });

    await service.approveBOMRevision(actor, {
      idempotencyKey: 'approve-bom-immutable',
      bomRevisionId: bom.value.id,
    });

    await expect(
      service.approveBOMRevision(actor, {
        idempotencyKey: 'approve-bom-again',
        bomRevisionId: bom.value.id,
      })
    ).rejects.toThrow(ManufacturingStateError);
  });
});
