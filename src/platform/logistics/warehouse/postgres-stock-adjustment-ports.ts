import { randomUUID } from 'crypto';

import type { QueryResult, QueryResultRow } from 'pg';

import {
  AdjustmentReason,
  LedgerEntryType,
  TransactionStatus,
  type InventoryBalance,
} from '../contracts/inventory.contract';
import {
  ActorType,
  TraceabilityEventType,
  type TraceabilityEvent,
} from '../contracts/traceability.contract';
import type {
  CanonicalAdjustmentMovementRecord,
  WarehouseStockAdjustmentPorts,
} from './stock-adjustment-canonical.facade';

export interface WarehousePostgresAdjustmentExecutor {
  query<TRow extends QueryResultRow = QueryResultRow>(
    text: string,
    values?: readonly unknown[]
  ): Promise<QueryResult<TRow>>;
}

export interface WarehousePostgresStockAdjustmentPortsOptions {
  idFactory?: () => string;
}

interface InventoryRow extends QueryResultRow {
  tenant_id: string;
  item_id: string;
  location_id: string;
  quantity_on_hand: string | number;
  quantity_reserved: string | number;
  quantity_available: string | number;
  updated_at: Date | string;
}

interface LocationRow extends QueryResultRow {
  location_type: string;
}

interface MovementRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  item_id: string;
  location_id: string;
  quantity: string | number;
  status: string;
  created_by: string | null;
  created_at: Date | string;
}

interface TraceabilityRow extends QueryResultRow {
  id: string;
  tenant_id: string;
  item_id: string;
  lot_number: string | null;
  serial_number: string | null;
  custody_events: unknown;
  compliance_status: string;
  updated_at: Date | string;
}

export function createWarehousePostgresStockAdjustmentPorts(
  db: WarehousePostgresAdjustmentExecutor,
  options: WarehousePostgresStockAdjustmentPortsOptions = {}
): WarehouseStockAdjustmentPorts {
  const idFactory = options.idFactory ?? randomUUID;

  return {
    balance: {
      getCurrentBalance: (params) => readLocationBalance(db, params),
      applyStockAdjustment: async (mutation) => {
        const lotNumber = readOptionalText(mutation.metadata.lot_number);
        const serialNumber = readFirstSerial(mutation.metadata.serial_numbers);
        const locationType = await getLocationType(db, mutation.tenant_id, mutation.location_id);

        const existing = await db.query<InventoryRow>(
          `
          SELECT tenant_id, item_id, location_id, quantity_on_hand, quantity_reserved,
                 quantity_available, updated_at
          FROM logistics.inventory
          WHERE tenant_id = $1
            AND item_id = $2
            AND location_id = $3
            AND lot_number IS NOT DISTINCT FROM $4
            AND serial_number IS NOT DISTINCT FROM $5
          FOR UPDATE
          `,
          [mutation.tenant_id, mutation.item_id, mutation.location_id, lotNumber, serialNumber]
        );

        if (existing.rowCount && existing.rows[0]) {
          const updated = await db.query<InventoryRow>(
            `
            UPDATE logistics.inventory
            SET quantity_on_hand = quantity_on_hand + $6
            WHERE tenant_id = $1
              AND item_id = $2
              AND location_id = $3
              AND lot_number IS NOT DISTINCT FROM $4
              AND serial_number IS NOT DISTINCT FROM $5
            RETURNING tenant_id, item_id, location_id, quantity_on_hand, quantity_reserved,
                      quantity_available, updated_at
            `,
            [
              mutation.tenant_id,
              mutation.item_id,
              mutation.location_id,
              lotNumber,
              serialNumber,
              mutation.quantity_delta,
            ]
          );
          return toInventoryBalance(requireRow(
            updated.rows[0],
            'stock-adjustment inventory update did not return a row'
          ));
        }

        if (mutation.quantity_delta < 0) {
          throw new Error('stock-adjustment negative delta requires existing inventory row');
        }

        const inserted = await db.query<InventoryRow>(
          `
          INSERT INTO logistics.inventory (
            tenant_id,
            item_id,
            location_id,
            location_type,
            quantity_on_hand,
            quantity_reserved,
            lot_number,
            serial_number,
            status
          )
          VALUES ($1, $2, $3, $4, $5, 0, $6, $7, 'AVAILABLE')
          RETURNING tenant_id, item_id, location_id, quantity_on_hand, quantity_reserved,
                    quantity_available, updated_at
          `,
          [
            mutation.tenant_id,
            mutation.item_id,
            mutation.location_id,
            locationType,
            mutation.quantity_delta,
            lotNumber,
            serialNumber,
          ]
        );

        return toInventoryBalance(requireRow(
          inserted.rows[0],
          'stock-adjustment inventory insert did not return a row'
        ));
      },
    },
    movementLedger: {
      recordStockAdjustment: async ({ mutation, balanceAfter, occurredAt }) => {
        const movementId = idFactory();
        const locationType = await getLocationType(db, mutation.tenant_id, mutation.location_id);
        const sourceDocumentId = readUuid(mutation.reference_id);
        const sourceLineId = readUuid(readOptionalText(mutation.metadata.source_line_id));
        const movementType = mutation.quantity_delta > 0
          ? 'ADJUSTMENT_INCREASE'
          : 'ADJUSTMENT_DECREASE';
        const direction = mutation.quantity_delta > 0 ? 'INBOUND' : 'OUTBOUND';

        const movement = await db.query<MovementRow>(
          `
          INSERT INTO logistics.inventory_movements (
            id,
            movement_number,
            tenant_id,
            movement_date,
            created_by,
            movement_type,
            direction,
            item_id,
            from_location_id,
            from_location_type,
            to_location_id,
            to_location_type,
            quantity,
            unit_of_measure,
            lot_number,
            serial_number,
            unit_cost,
            total_cost,
            currency,
            source_document_type,
            source_document_id,
            source_document_number,
            source_line_item_id,
            reason,
            notes,
            status,
            completed_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8,
            $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19,
            $20, $21, $22, $23, $24, $25, 'COMPLETED', $4
          )
          RETURNING id, tenant_id, item_id,
                    COALESCE(to_location_id, from_location_id) AS location_id,
                    quantity, status, created_by, created_at
          `,
          [
            movementId,
            `WH-ADJ-${movementId.slice(0, 8).toUpperCase()}`,
            mutation.tenant_id,
            occurredAt,
            mutation.actor_id,
            movementType,
            direction,
            mutation.item_id,
            mutation.quantity_delta < 0 ? mutation.location_id : null,
            mutation.quantity_delta < 0 ? locationType : null,
            mutation.quantity_delta > 0 ? mutation.location_id : null,
            mutation.quantity_delta > 0 ? locationType : null,
            Math.abs(mutation.quantity_delta),
            readText(mutation.metadata.unit_of_measure, 'EA'),
            readOptionalText(mutation.metadata.lot_number),
            readFirstSerial(mutation.metadata.serial_numbers),
            readOptionalNumber(mutation.metadata.unit_cost),
            readOptionalNumber(mutation.metadata.unit_cost) === undefined
              ? undefined
              : readOptionalNumber(mutation.metadata.unit_cost)! * Math.abs(mutation.quantity_delta),
            readOptionalText(mutation.metadata.currency),
            'warehouse_stock_adjustment',
            sourceDocumentId,
            readOptionalText(mutation.metadata.adjustment_document_number),
            sourceLineId,
            mutation.reason,
            readOptionalText(mutation.metadata.notes),
          ]
        );

        const movementRecord = toMovementRecord(
          requireRow(movement.rows[0], 'stock-adjustment movement insert did not return a row'),
          mutation.quantity_delta,
          mutation.reason,
          mutation.actor_id
        );

        return {
          movement: movementRecord,
          ledgerEntry: {
            id: movementRecord.id,
            tenant_id: mutation.tenant_id,
            item_id: mutation.item_id,
            location_id: mutation.location_id,
            entry_type: LedgerEntryType.ADJUSTMENT,
            quantity_delta: mutation.quantity_delta,
            balance_after: balanceAfter.on_hand,
            transaction_id: movementRecord.id,
            actor_id: mutation.actor_id,
            reason: mutation.reason,
            created_at: occurredAt,
            metadata: mutation.metadata,
          },
        };
      },
    },
    traceability: {
      recordEvent: async (request) => {
        const lotNumber = request.lot_number;
        const serialNumber = request.serial_numbers?.[0];

        if (!lotNumber && !serialNumber) {
          throw new Error('canonical traceability requires lotNumber or serialNumbers');
        }

        const eventId = idFactory();
        const custodyEvent = {
          event_id: eventId,
          timestamp: (request.occurred_at ?? new Date()).toISOString(),
          location_id: request.current_location_id ?? request.to_location_id,
          location_type: 'WAREHOUSE',
          action: request.event_type,
          user_id: request.actor_id,
          quantity: request.quantity,
          transaction_id: request.transaction_id,
          notes: request.notes,
          metadata: request.metadata,
        };

        const existing = await db.query<TraceabilityRow>(
          `
          SELECT id, tenant_id, item_id, lot_number, serial_number, custody_events,
                 compliance_status, updated_at
          FROM logistics.traceability
          WHERE tenant_id = $1
            AND item_id = $2
            AND lot_number IS NOT DISTINCT FROM $3
            AND serial_number IS NOT DISTINCT FROM $4
          FOR UPDATE
          `,
          [request.tenant_id, request.item_id, lotNumber ?? null, serialNumber ?? null]
        );

        const row = existing.rowCount && existing.rows[0]
          ? await appendTraceabilityEvent(db, existing.rows[0].id, custodyEvent)
          : await insertTraceabilityEvent(db, {
              id: eventId,
              tenantId: request.tenant_id,
              itemId: request.item_id,
              lotNumber,
              serialNumber,
              occurredAt: request.occurred_at ?? new Date(),
              custodyEvent,
            });

        return toTraceabilityEvent(row, request, eventId);
      },
    },
    events: {
      publish: async () => {
        return;
      },
    },
    readBack: {
      getStockAdjustmentEvidence: async (params) => {
        const balance = await readLocationBalance(db, {
          tenant_id: params.tenant_id,
          item_id: params.item_id,
          location_id: params.location_id,
        });

        const movement = await db.query<MovementRow>(
          `
          SELECT id, tenant_id, item_id, COALESCE(to_location_id, from_location_id) AS location_id,
                 quantity, status, created_by, created_at
          FROM logistics.inventory_movements
          WHERE tenant_id = $1 AND id = $2
          `,
          [params.tenant_id, params.movement_id]
        );
        if (!movement.rows[0]) throw new Error('stock-adjustment read-back movement not found');

        const traceability = await db.query<TraceabilityRow>(
          `
          SELECT id, tenant_id, item_id, lot_number, serial_number, custody_events,
                 compliance_status, updated_at
          FROM logistics.traceability
          WHERE tenant_id = $1 AND id = $2
          `,
          [params.tenant_id, params.traceability_event_id]
        );
        if (!traceability.rows[0]) {
          throw new Error('stock-adjustment read-back traceability not found');
        }

        const movementRecord = toMovementRecord(
          requireRow(movement.rows[0], 'stock-adjustment read-back movement not found'),
          0,
          AdjustmentReason.CORRECTION,
          ''
        );

        return {
          balance,
          ledgerEntry: {
            id: movementRecord.id,
            tenant_id: movementRecord.tenant_id,
            item_id: movementRecord.item_id,
            location_id: movementRecord.location_id,
            entry_type: LedgerEntryType.ADJUSTMENT,
            quantity_delta: movementRecord.quantity_delta,
            balance_after: balance.on_hand,
            transaction_id: movementRecord.id,
            actor_id: movementRecord.actor_id,
            reason: movementRecord.reason,
            created_at: movementRecord.created_at,
          },
          movement: movementRecord,
          traceability: toReadBackTraceabilityEvent(
            requireRow(traceability.rows[0], 'stock-adjustment read-back traceability not found'),
            movementRecord
          ),
        };
      },
    },
  };
}

async function readLocationBalance(
  db: WarehousePostgresAdjustmentExecutor,
  params: { tenant_id: string; item_id: string; location_id: string }
): Promise<InventoryBalance> {
  const result = await db.query<InventoryRow>(
    `
    SELECT
      tenant_id,
      item_id,
      location_id,
      COALESCE(SUM(quantity_on_hand), 0) AS quantity_on_hand,
      COALESCE(SUM(quantity_reserved), 0) AS quantity_reserved,
      COALESCE(SUM(quantity_available), 0) AS quantity_available,
      CURRENT_TIMESTAMP AS updated_at
    FROM logistics.inventory
    WHERE tenant_id = $1 AND item_id = $2 AND location_id = $3
    GROUP BY tenant_id, item_id, location_id
    `,
    [params.tenant_id, params.item_id, params.location_id]
  );

  if (!result.rows[0]) {
    return {
      tenant_id: params.tenant_id,
      item_id: params.item_id,
      location_id: params.location_id,
      on_hand: 0,
      allocated: 0,
      available: 0,
      updated_at: new Date(),
    };
  }

  return toInventoryBalance(result.rows[0]);
}

async function getLocationType(
  db: WarehousePostgresAdjustmentExecutor,
  tenantId: string,
  locationId: string
): Promise<string> {
  const result = await db.query<LocationRow>(
    `
    SELECT location_type
    FROM logistics.locations
    WHERE tenant_id = $1 AND id = $2
    `,
    [tenantId, locationId]
  );

  if (!result.rows[0]) {
    throw new Error('canonical location not found for stock adjustment');
  }

  return result.rows[0].location_type;
}

async function appendTraceabilityEvent(
  db: WarehousePostgresAdjustmentExecutor,
  traceabilityId: string,
  custodyEvent: Record<string, unknown>
): Promise<TraceabilityRow> {
  const result = await db.query<TraceabilityRow>(
    `
    UPDATE logistics.traceability
    SET custody_events = custody_events || $2::jsonb
    WHERE id = $1
    RETURNING id, tenant_id, item_id, lot_number, serial_number, custody_events,
              compliance_status, updated_at
    `,
    [traceabilityId, JSON.stringify([custodyEvent])]
  );
  return requireRow(result.rows[0], 'traceability append did not return a row');
}

async function insertTraceabilityEvent(
  db: WarehousePostgresAdjustmentExecutor,
  params: {
    id: string;
    tenantId: string;
    itemId: string;
    lotNumber?: string;
    serialNumber?: string;
    occurredAt: Date;
    custodyEvent: Record<string, unknown>;
  }
): Promise<TraceabilityRow> {
  const result = await db.query<TraceabilityRow>(
    `
    INSERT INTO logistics.traceability (
      id,
      tenant_id,
      item_id,
      lot_number,
      serial_number,
      received_date,
      custody_events,
      compliance_status,
      recall_status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, 'COMPLIANT', 'NONE')
    RETURNING id, tenant_id, item_id, lot_number, serial_number, custody_events,
              compliance_status, updated_at
    `,
    [
      params.id,
      params.tenantId,
      params.itemId,
      params.lotNumber ?? null,
      params.serialNumber ?? null,
      params.occurredAt,
      JSON.stringify([params.custodyEvent]),
    ]
  );
  return requireRow(result.rows[0], 'traceability insert did not return a row');
}

function toInventoryBalance(row: InventoryRow): InventoryBalance {
  return {
    tenant_id: row.tenant_id,
    item_id: row.item_id,
    location_id: row.location_id,
    on_hand: toNumber(row.quantity_on_hand),
    allocated: toNumber(row.quantity_reserved),
    available: toNumber(row.quantity_available),
    updated_at: new Date(row.updated_at),
  };
}

function toMovementRecord(
  row: MovementRow,
  quantityDelta: number,
  reason: AdjustmentReason,
  fallbackActorId: string
): CanonicalAdjustmentMovementRecord {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    item_id: row.item_id,
    location_id: row.location_id,
    quantity_delta: quantityDelta === 0 ? toNumber(row.quantity) : quantityDelta,
    reason,
    status: TransactionStatus.COMPLETED,
    actor_id: row.created_by ?? fallbackActorId,
    created_at: new Date(row.created_at),
  };
}

function toTraceabilityEvent(
  row: TraceabilityRow,
  request: {
    event_type: TraceabilityEventType;
    quantity: number;
    from_location_id?: string;
    to_location_id?: string;
    current_location_id?: string;
    actor_id: string;
    actor_type: ActorType;
    transaction_id?: string;
    transaction_type?: string;
    reference_id?: string;
    reference_type?: string;
    occurred_at?: Date;
    notes?: string;
    reason?: string;
    metadata?: Record<string, unknown>;
  },
  eventId: string
): TraceabilityEvent {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    event_type: request.event_type,
    item_id: row.item_id,
    lot_number: row.lot_number ?? undefined,
    serial_numbers: row.serial_number ? [row.serial_number] : undefined,
    quantity: request.quantity,
    from_location_id: request.from_location_id,
    to_location_id: request.to_location_id,
    current_location_id: request.current_location_id,
    actor_id: request.actor_id,
    actor_type: request.actor_type,
    transaction_id: request.transaction_id,
    transaction_type: request.transaction_type,
    reference_id: request.reference_id,
    reference_type: request.reference_type,
    occurred_at: request.occurred_at ?? new Date(),
    recorded_at: new Date(row.updated_at),
    notes: request.notes,
    reason: request.reason,
    metadata: {
      ...request.metadata,
      custody_event_id: eventId,
      compliance_status: row.compliance_status,
    },
  };
}

function toReadBackTraceabilityEvent(
  row: TraceabilityRow,
  movement: CanonicalAdjustmentMovementRecord
): TraceabilityEvent {
  return {
    id: row.id,
    tenant_id: row.tenant_id,
    event_type: TraceabilityEventType.ADJUSTED,
    item_id: row.item_id,
    lot_number: row.lot_number ?? undefined,
    serial_numbers: row.serial_number ? [row.serial_number] : undefined,
    quantity: Math.abs(movement.quantity_delta),
    current_location_id: movement.location_id,
    actor_id: movement.actor_id,
    actor_type: ActorType.USER,
    transaction_id: movement.id,
    transaction_type: 'warehouse_stock_adjustment',
    occurred_at: movement.created_at,
    recorded_at: new Date(row.updated_at),
    reason: movement.reason,
    metadata: {
      compliance_status: row.compliance_status,
      custody_events: row.custody_events,
    },
  };
}

function requireRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) throw new Error(message);
  return row;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

function readText(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim().length > 0 ? value : fallback;
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function readFirstSerial(value: unknown): string | undefined {
  return Array.isArray(value) && typeof value[0] === 'string' && value[0].trim().length > 0
    ? value[0]
    : undefined;
}

function readUuid(value: string | undefined): string | null {
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return value && uuidPattern.test(value)
    ? value
    : null;
}
