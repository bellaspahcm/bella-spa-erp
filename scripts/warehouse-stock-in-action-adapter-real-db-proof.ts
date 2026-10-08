import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';

import { Client, type QueryResultRow } from 'pg';

import {
  executeCanonicalWarehouseStockInWithContext,
  type WarehouseCanonicalStockInActionInput,
} from '../src/services/warehouse-canonical-actions';

interface CountRow extends QueryResultRow {
  count: string | number;
}

interface RuntimeRoleRow extends QueryResultRow {
  current_user: string;
  rolbypassrls: boolean;
  tenant_id: string | null;
}

interface InventoryRow extends QueryResultRow {
  quantity_on_hand: string | number;
  quantity_available: string | number;
}

interface MovementRow extends QueryResultRow {
  status: string;
  movement_type: string;
  direction: string;
  quantity: string | number;
}

interface TraceabilityRow extends QueryResultRow {
  compliance_status: string;
  custody_event_count: string | number;
}

interface ProofIds {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  itemA: string;
  locationA: string;
  sourceDocument: string;
  lotNumber: string;
  marker: string;
}

async function main(): Promise<void> {
  loadEnvFile(process.env.WAREHOUSE_ENV_FILE);

  const dbUrl = getDatabaseUrl();
  const ids = createProofIds();
  const db = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  });

  await db.connect();

  try {
    await cleanup(db, ids);
    await seedFixture(db, ids);

    const command = toStockInInput(ids);
    const actionResult = await executeCanonicalWarehouseStockInWithContext(
      command,
      {
        userId: ids.userA,
        tenantId: ids.tenantA,
      },
      {
        databaseUrl: dbUrl,
        revalidateCanonicalStockInPath: false,
      }
    );

    if (!actionResult.ok) {
      throw new Error(`${actionResult.error.code}: ${actionResult.error.message}`);
    }

    const tenantAEvidence = await withAuthenticatedTenant(db, ids.userA, async () => {
      const role = await readRuntimeRole(db);
      const inventory = await readInventory(db, ids);
      const movement = await readMovement(db, ids);
      const traceability = await readTraceability(db, ids);

      return {
        role,
        inventory,
        movement,
        traceability,
      };
    });

    const tenantBAction = await executeCanonicalWarehouseStockInWithContext(
      {
        ...command,
        sourceDocument: {
          ...command.sourceDocument,
          id: randomUUID(),
          number: `${ids.marker}-TENANT-B-BLOCKED`,
        },
      },
      {
        userId: ids.userB,
        tenantId: ids.tenantB,
      },
      {
        databaseUrl: dbUrl,
        revalidateCanonicalStockInPath: false,
      }
    );

    const tenantBReadWrite = await withAuthenticatedTenant(db, ids.userB, async () => {
      const read = await db.query(
        `
        SELECT id
        FROM logistics.inventory
        WHERE tenant_id = $1::uuid AND item_id = $2::uuid AND location_id = $3::uuid
        `,
        [ids.tenantA, ids.itemA, ids.locationA]
      );
      const update = await db.query(
        `
        UPDATE logistics.inventory
        SET quantity_on_hand = quantity_on_hand + 1
        WHERE tenant_id = $1::uuid AND item_id = $2::uuid AND location_id = $3::uuid
        `,
        [ids.tenantA, ids.itemA, ids.locationA]
      );
      const insertDeniedCode = await captureInsertDeniedCode(db, ids);

      return {
        readRows: read.rowCount ?? 0,
        updateRows: update.rowCount ?? 0,
        insertDeniedCode,
      };
    });

    await cleanup(db, ids);
    const remainingTenants = await countRemainingProofTenants(db, ids.marker);

    console.log('WAREHOUSE_STOCK_IN_CANONICAL_ACTION_ADAPTER_REAL_DB = PASS');
    console.log(`runId = ${ids.marker}`);
    console.log(`current_user = ${tenantAEvidence.role.current_user}`);
    console.log(`rolbypassrls = ${tenantAEvidence.role.rolbypassrls}`);
    console.log(`Tenant A get_auth_tenant_id = ${tenantAEvidence.role.tenant_id}`);
    console.log(`quantity_on_hand = ${tenantAEvidence.inventory.quantity_on_hand}`);
    console.log(`quantity_available = ${tenantAEvidence.inventory.quantity_available}`);
    console.log(`movement_type = ${tenantAEvidence.movement.movement_type}`);
    console.log(`movement_direction = ${tenantAEvidence.movement.direction}`);
    console.log(`movement_status = ${tenantAEvidence.movement.status}`);
    console.log(`traceability_compliance_status = ${tenantAEvidence.traceability.compliance_status}`);
    console.log(`custody_event_count = ${tenantAEvidence.traceability.custody_event_count}`);
    console.log(
      `tenantB_action_result = ${tenantBAction.ok ? 'UNEXPECTED_PASS' : tenantBAction.error.code}`
    );
    console.log(`tenantB_read_tenantA_inventory_rows = ${tenantBReadWrite.readRows}`);
    console.log(`tenantB_update_tenantA_inventory_rows = ${tenantBReadWrite.updateRows}`);
    console.log(`tenantB_insert_tenantA_movement = DENIED ${tenantBReadWrite.insertDeniedCode}`);
    console.log('cleanup = PASS');
    console.log(`remaining proof tenants = ${remainingTenants}`);

    if (tenantAEvidence.role.current_user !== 'authenticated') {
      throw new Error('proof did not execute under authenticated role');
    }
    if (tenantAEvidence.role.rolbypassrls) {
      throw new Error('proof role bypassed RLS');
    }
    if (tenantAEvidence.role.tenant_id !== ids.tenantA) {
      throw new Error('tenant context did not resolve to Tenant A');
    }
    if (toNumber(tenantAEvidence.inventory.quantity_on_hand) !== 11.25) {
      throw new Error('Stock-In action adapter quantity read-back mismatch');
    }
    if (tenantAEvidence.movement.status !== 'COMPLETED') {
      throw new Error('Stock-In movement was not completed');
    }
    if (tenantAEvidence.traceability.compliance_status !== 'COMPLIANT') {
      throw new Error('Stock-In traceability was not compliant');
    }
    if (tenantBAction.ok) {
      throw new Error('Tenant B action unexpectedly mutated Tenant A evidence');
    }
    if (
      tenantBReadWrite.readRows !== 0
      || tenantBReadWrite.updateRows !== 0
      || tenantBReadWrite.insertDeniedCode !== '42501'
    ) {
      throw new Error('Tenant B RLS negative proof failed');
    }
    if (remainingTenants !== 0) {
      throw new Error('proof cleanup left tenant rows behind');
    }
  } finally {
    await db.end();
  }
}

function loadEnvFile(envFile: string | undefined): void {
  if (!envFile) return;

  const content = readFileSync(envFile, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (process.env[key]) continue;

    process.env[key] = unwrapEnvValue(rawValue);
  }
}

function unwrapEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"'))
    || (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function getDatabaseUrl(): string {
  const dbUrl = process.env.SUPABASE_DB_URL
    ?? process.env.SUPABASE_DATABASE_URL
    ?? process.env.DATABASE_URL;

  if (!dbUrl) {
    throw new Error('SUPABASE_DB_URL, SUPABASE_DATABASE_URL, or DATABASE_URL is required');
  }

  return dbUrl;
}

function createProofIds(): ProofIds {
  const marker = `warehouse-action-adapter-${new Date().toISOString().replace(/[-:.TZ]/g, '')}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    itemA: randomUUID(),
    locationA: randomUUID(),
    sourceDocument: randomUUID(),
    lotNumber: `LOT-${marker}`,
    marker,
  };
}

function toStockInInput(ids: ProofIds): WarehouseCanonicalStockInActionInput {
  return {
    correlationId: ids.marker,
    sourceDocument: {
      id: ids.sourceDocument,
      number: `${ids.marker}-DOC`,
      type: 'purchase_order',
    },
    lines: [
      {
        warehouseSkuId: `warehouse-sku-${ids.marker}`,
        warehouseBinId: `warehouse-bin-${ids.marker}`,
        itemId: ids.itemA,
        locationId: ids.locationA,
        quantity: 11.25,
        unitOfMeasure: 'EA',
        lotNumber: ids.lotNumber,
        unitCost: 3.5,
        currency: 'VND',
        sourceLineId: randomUUID(),
        metadata: {
          proof: 'warehouse_stock_in_action_adapter_real_db',
        },
      },
    ],
  };
}

async function seedFixture(db: Client, ids: ProofIds): Promise<void> {
  await db.query(
    `
    INSERT INTO public.tenants (id, name, status)
    VALUES
      ($1::uuid, $2, 'active'),
      ($3::uuid, $4, 'active')
    `,
    [ids.tenantA, `${ids.marker} Tenant A`, ids.tenantB, `${ids.marker} Tenant B`]
  );

  await db.query(
    `
    INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
    VALUES
      ($1::uuid, $2::uuid, $3, $4, 'admin_staff', 'active'),
      ($5::uuid, $6::uuid, $7, $8, 'admin_staff', 'active')
    `,
    [
      ids.userA,
      ids.tenantA,
      `${ids.marker}-a@example.test`,
      `${ids.marker} User A`,
      ids.userB,
      ids.tenantB,
      `${ids.marker}-b@example.test`,
      `${ids.marker} User B`,
    ]
  );

  await db.query(
    `
    INSERT INTO logistics.items (
      id,
      tenant_id,
      sku_code,
      name,
      type,
      base_uom,
      lot_tracked,
      status,
      created_by
    )
    VALUES ($1::uuid, $2::uuid, $3, $4, 'GOODS', 'EA', true, 'ACTIVE', $5::uuid)
    `,
    [ids.itemA, ids.tenantA, `SKU-${ids.marker}`, `${ids.marker} Item`, ids.userA]
  );

  await db.query(
    `
    INSERT INTO logistics.locations (
      id,
      tenant_id,
      location_code,
      location_name,
      location_type,
      status
    )
    VALUES ($1::uuid, $2::uuid, $3, $4, 'WAREHOUSE', 'ACTIVE')
    `,
    [ids.locationA, ids.tenantA, `LOC-${ids.marker}`, `${ids.marker} Location`]
  );
}

async function withAuthenticatedTenant<TResult>(
  db: Client,
  userId: string,
  operation: () => Promise<TResult>
): Promise<TResult> {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
  });

  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL role = 'authenticated'");
    await db.query(
      `
      SELECT
        set_config('request.jwt.claim.sub', $1, true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt.claims', $2, true)
      `,
      [userId, claims]
    );

    const result = await operation();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function readRuntimeRole(db: Client): Promise<RuntimeRoleRow> {
  const result = await db.query<RuntimeRoleRow>(
    `
    SELECT
      current_user,
      (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS rolbypassrls,
      public.get_auth_tenant_id()::text AS tenant_id
    `
  );
  return requireRow(result.rows[0], 'runtime role evidence not returned');
}

async function readInventory(db: Client, ids: ProofIds): Promise<InventoryRow> {
  const result = await db.query<InventoryRow>(
    `
    SELECT quantity_on_hand, quantity_available
    FROM logistics.inventory
    WHERE tenant_id = $1::uuid AND item_id = $2::uuid AND location_id = $3::uuid
    `,
    [ids.tenantA, ids.itemA, ids.locationA]
  );
  return requireRow(result.rows[0], 'inventory read-back not found');
}

async function readMovement(db: Client, ids: ProofIds): Promise<MovementRow> {
  const result = await db.query<MovementRow>(
    `
    SELECT status, movement_type, direction, quantity
    FROM logistics.inventory_movements
    WHERE tenant_id = $1::uuid AND source_document_id = $2::uuid
    `,
    [ids.tenantA, ids.sourceDocument]
  );
  return requireRow(result.rows[0], 'movement read-back not found');
}

async function readTraceability(db: Client, ids: ProofIds): Promise<TraceabilityRow> {
  const result = await db.query<TraceabilityRow>(
    `
    SELECT
      compliance_status,
      jsonb_array_length(custody_events) AS custody_event_count
    FROM logistics.traceability
    WHERE tenant_id = $1::uuid AND item_id = $2::uuid AND lot_number = $3
    `,
    [ids.tenantA, ids.itemA, ids.lotNumber]
  );
  return requireRow(result.rows[0], 'traceability read-back not found');
}

async function captureInsertDeniedCode(db: Client, ids: ProofIds): Promise<string> {
  try {
    await db.query(
      `
      INSERT INTO logistics.inventory_movements (
        id,
        movement_number,
        tenant_id,
        movement_type,
        direction,
        item_id,
        to_location_id,
        to_location_type,
        quantity,
        unit_of_measure,
        status
      )
      VALUES (
        $1::uuid,
        $2,
        $3::uuid,
        'RECEIPT',
        'INBOUND',
        $4::uuid,
        $5::uuid,
        'WAREHOUSE',
        1,
        'EA',
        'COMPLETED'
      )
      `,
      [
        randomUUID(),
        `DENIED-${ids.marker}`,
        ids.tenantA,
        ids.itemA,
        ids.locationA,
      ]
    );
    return 'UNEXPECTED_PASS';
  } catch (error) {
    return readPgErrorCode(error);
  }
}

async function cleanup(db: Client, ids: ProofIds): Promise<void> {
  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL session_replication_role = 'replica'");
    await db.query(
      'DELETE FROM logistics.traceability WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM logistics.inventory_movements WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM logistics.inventory WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM logistics.locations WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM logistics.items WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.timeline_events WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.users WHERE id = ANY($1::uuid[])',
      [[ids.userA, ids.userB]]
    );
    await db.query(
      'DELETE FROM public.tenants WHERE id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function countRemainingProofTenants(db: Client, marker: string): Promise<number> {
  const result = await db.query<CountRow>(
    'SELECT COUNT(*)::int AS count FROM public.tenants WHERE name LIKE $1',
    [`${marker}%`]
  );
  return toNumber(requireRow(result.rows[0], 'remaining tenant count not returned').count);
}

function readPgErrorCode(error: unknown): string {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : 'UNKNOWN';
  }
  return 'UNKNOWN';
}

function requireRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) throw new Error(message);
  return row;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
