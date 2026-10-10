import { randomUUID } from 'crypto';
import { existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { parse as parseEnv } from 'dotenv';
import { Client, type QueryResultRow } from 'pg';

import {
  WarehouseStockInCanonicalFacade,
  type WarehouseStockInLineEvidence,
} from '../stock-in-canonical.facade';
import { createWarehousePostgresStockInPorts } from '../postgres-stock-in-ports';

const EXPECTED_E2E_PROJECT_REF = 'bmnbqbcdbuklhopfbopv';
const EXPECTED_E2E_SUPABASE_HOST = `${EXPECTED_E2E_PROJECT_REF}.supabase.co`;

loadLogisticsE2eEnv();

const dbUrl =
  process.env.E2E_SUPABASE_DB_URL ||
  process.env.SUPABASE_DB_URL ||
  process.env.SUPABASE_DATABASE_URL ||
  process.env.DATABASE_URL ||
  '';

const idempotencyMigrationSql = readFileSync(
  path.resolve(__dirname, '../../../../../supabase/migrations/20261010030000_create_logistics_stock_in_idempotency.sql'),
  'utf8'
);

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && isAllowedE2eProject() && isAllowedE2eDbUrl(dbUrl) ? describe : describe.skip;

class AuthenticatedLogisticsSqlClient {
  constructor(
    private readonly client: Client,
    private readonly context: { userId: string; tenantId: string }
  ) {}

  async query<Row extends QueryResultRow = QueryResultRow>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<{ rows: Row[]; rowCount: number | null }> {
    if (sql.trim().toUpperCase() === 'BEGIN') {
      await this.client.query('BEGIN');
      await this.client.query('SET LOCAL ROLE authenticated');
      await this.client.query('SET LOCAL row_security = on');
      await this.client.query(
        `
          SELECT
            set_config('app.current_user_id', $1, TRUE),
            set_config('app.current_tenant_id', $2, TRUE),
            set_config('request.jwt.claim.sub', $1, TRUE),
            set_config('request.jwt.claim.role', 'authenticated', TRUE)
        `,
        [this.context.userId, this.context.tenantId]
      );
      return { rows: [], rowCount: 0 };
    }

    const result = await this.client.query<Row>(sql, values ? [...values] : undefined);
    return { rows: result.rows, rowCount: result.rowCount };
  }
}

type CountRow = QueryResultRow & { count: string };

describeWithRealDb('Logistics production-order stock-in real DB idempotency', () => {
  jest.setTimeout(120_000);

  const marker = `log-stock-in-${Date.now()}`;
  const ids = {
    tenant: randomUUID(),
    user: randomUUID(),
    otherTenant: randomUUID(),
    otherUser: randomUUID(),
    item: randomUUID(),
    location: randomUUID(),
    receiptDocument: randomUUID(),
    receiptLine: randomUUID(),
    productionOrder: randomUUID(),
    productionOrderLine: randomUUID(),
  };

  let admin: Client;

  beforeAll(async () => {
    admin = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await admin.connect();
    await admin.query(idempotencyMigrationSql);
    await assertLogisticsTablesExist();
    await seedTenant(ids.tenant, `${marker} Tenant`);
    await seedTenant(ids.otherTenant, `${marker} Other Tenant`);
    await seedRuntimeUser(ids.user, ids.tenant, `${marker}@example.com`);
    await seedRuntimeUser(ids.otherUser, ids.otherTenant, `${marker}-other@example.com`);
    await seedLogisticsItem();
    await seedLogisticsLocation();
  });

  afterAll(async () => {
    if (!admin) return;
    try {
      await cleanupFixtures();
    } finally {
      await admin.end();
    }
  });

  it('persists idempotency and returns duplicate without a second stock mutation', async () => {
    const first = await createFacade(ids.user, ids.tenant);
    try {
      const command = productionOrderStockInCommand(`${marker}-retry-same-payload`, 3);
      const firstResult = await first.facade.execute(command);
      const duplicateResult = await first.facade.execute(command);

      expect(firstResult.ok).toBe(true);
      expect(duplicateResult.ok).toBe(true);
      if (!firstResult.ok || !duplicateResult.ok) throw new Error('production-order stock in failed');
      expect(firstResult.value.isDuplicate).toBe(false);
      expect(duplicateResult.value.isDuplicate).toBe(true);
      expect(firstResult.value.productionOutputReference).toEqual(expect.objectContaining({
        productionOrderId: ids.productionOrder,
        productionOrderLineId: ids.productionOrderLine,
        receiptLineId: ids.receiptLine,
        idempotencyKey: `${marker}-retry-same-payload`,
      }));
      expect(duplicateResult.value.lines[0].movement.id).toBe(firstResult.value.lines[0].movement.id);
      expectProductionReferenceReadBack(firstResult.value.lines[0], `${marker}-retry-same-payload`);
      expectProductionReferenceReadBack(duplicateResult.value.lines[0], `${marker}-retry-same-payload`);
      await expectInventoryOnHand(3);
      await expectMovementCount(1);
      await expectIdempotencyCount(`${marker}-retry-same-payload`, 1);
    } finally {
      await first.client.end();
    }
  });

  it('rejects same idempotency key with a conflicting payload without extra stock mutation', async () => {
    const client = await createFacade(ids.user, ids.tenant);
    try {
      const firstResult = await client.facade.execute(
        productionOrderStockInCommand(`${marker}-conflict-payload`, 2)
      );
      expect(firstResult.ok).toBe(true);

      const conflictResult = await client.facade.execute(
        productionOrderStockInCommand(`${marker}-conflict-payload`, 1)
      );

      expect(conflictResult).toEqual({
        ok: false,
        error: {
          code: 'WAREHOUSE_STOCK_IN_IDEMPOTENCY_CONFLICT',
          message: 'idempotency key was already claimed with a different payload',
        },
      });
      await expectMovementCount(2);
      await expectInventoryOnHand(5);
      await expectIdempotencyCount(`${marker}-conflict-payload`, 1);
    } finally {
      await client.client.end();
    }
  });

  it('serializes concurrent duplicate requests so stock is received only once', async () => {
    const first = await createFacade(ids.user, ids.tenant);
    const second = await createFacade(ids.user, ids.tenant);
    try {
      const command = productionOrderStockInCommand(`${marker}-concurrent-duplicate`, 2);
      const results = await Promise.all([
        first.facade.execute(command),
        second.facade.execute(command),
      ]);

      const successes = results.filter((result) => result.ok);
      expect(successes).toHaveLength(2);
      if (!results[0].ok || !results[1].ok) {
        throw new Error('concurrent production-order stock in failed');
      }
      expect(results.some((result) => result.ok && result.value.isDuplicate)).toBe(true);
      expect(results[0].value.lines[0].movement.id).toBe(results[1].value.lines[0].movement.id);
      await expectInventoryOnHand(7);
      await expectMovementCount(3);
      await expectIdempotencyCount(`${marker}-concurrent-duplicate`, 1);
    } finally {
      await first.client.end();
      await second.client.end();
    }
  });

  it('denies cross-tenant stock-in through authenticated RLS before stock mutation is committed', async () => {
    const client = await createFacade(ids.otherUser, ids.otherTenant);
    try {
      const result = await client.facade.execute(
        productionOrderStockInCommand(`${marker}-cross-tenant-denied`, 1)
      );

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('cross-tenant stock in unexpectedly succeeded');
      expect(result.error.code).toBe('WAREHOUSE_STOCK_IN_RUNTIME_FAILED');
      await expectMovementCount(3);
      await expectInventoryOnHand(7);
      await expectIdempotencyCount(`${marker}-cross-tenant-denied`, 0);
    } finally {
      await client.client.end();
    }
  });

  async function createFacade(userId: string, tenantId: string) {
    const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    return {
      client,
      facade: new WarehouseStockInCanonicalFacade(
        createWarehousePostgresStockInPorts(
          new AuthenticatedLogisticsSqlClient(client, { userId, tenantId }),
          { idFactory: () => randomUUID() }
        )
      ),
    };
  }

  function productionOrderStockInCommand(idempotencyKey: string, quantity: number) {
    return {
      tenantId: ids.tenant,
      actorId: ids.user,
      correlationId: `${marker}-${idempotencyKey}`,
      sourceDocument: {
        id: ids.receiptDocument,
        number: `${marker}-FGR`,
        type: 'production_order' as const,
      },
      productionOutputReference: {
        productionOrderId: ids.productionOrder,
        productionOrderLineId: ids.productionOrderLine,
        receiptLineId: ids.receiptLine,
        idempotencyKey,
      },
      lines: [{
        warehouseSkuId: `${marker}-sku`,
        warehouseBinId: `${marker}-bin`,
        itemId: ids.item,
        locationId: ids.location,
        quantity,
        unitOfMeasure: 'EA',
        lotNumber: `${marker}-lot`,
        sourceLineId: ids.receiptLine,
        qualityDisposition: {
          acceptedQuantity: quantity,
          rejectedQuantity: 1,
          pendingQuantity: 0,
          qualityInspectionId: `${marker}-qc`,
        },
      }],
    };
  }

  async function assertLogisticsTablesExist(): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'logistics'
          AND c.relname = ANY($1::text[])
      `,
      [[
        'locations',
        'inventory',
        'inventory_movements',
        'traceability',
        'stock_in_idempotency',
      ]]
    );
    expect(Number(result.rows[0].count)).toBe(5);
  }

  async function seedTenant(tenantId: string, name: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO public.tenants (id, name, status, enabled_modules)
        VALUES ($1::uuid, $2, 'active', '{}'::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            enabled_modules = EXCLUDED.enabled_modules
      `,
      [tenantId, name]
    );
  }

  async function seedRuntimeUser(userId: string, tenantId: string, email: string): Promise<void> {
    await admin.query(
      `
        INSERT INTO auth.users (
          instance_id, id, aud, role, email, encrypted_password,
          email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        )
        VALUES (
          '00000000-0000-0000-0000-000000000000'::uuid,
          $1::uuid,
          'authenticated',
          'authenticated',
          $2,
          '',
          NOW(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          '{}'::jsonb,
          NOW(),
          NOW()
        )
        ON CONFLICT (id) DO NOTHING
      `,
      [userId, email]
    );
    await admin.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'ktv', 'active')
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            status = EXCLUDED.status
      `,
      [userId, tenantId, email, `${marker} Operator`]
    );
  }

  async function seedLogisticsLocation(): Promise<void> {
    const columns = await tableColumns('logistics', 'locations');
    const row = buildInsertRow(columns, {
      id: ids.location,
      tenant_id: ids.tenant,
      location_code: `${marker}-LOC`,
      code: `${marker}-LOC`,
      name: `${marker} Location`,
      location_type: 'WAREHOUSE',
      status: 'ACTIVE',
      created_by: ids.user,
      updated_by: ids.user,
    });
    await insertRow('logistics.locations', row, 'id');
  }

  async function seedLogisticsItem(): Promise<void> {
    const columns = await tableColumns('logistics', 'items');
    const row = buildInsertRow(columns, {
      id: ids.item,
      tenant_id: ids.tenant,
      sku_code: `${marker}-FG`,
      name: `${marker} Finished Good`,
      type: 'GOODS',
      category: 'FINISHED_GOOD',
      base_uom: 'EA',
      lot_tracked: true,
      serial_tracked: false,
      expiry_tracked: false,
      status: 'ACTIVE',
      created_by: ids.user,
      updated_by: ids.user,
    });
    await insertRow('logistics.items', row, 'id');
  }

  async function tableColumns(schema: string, table: string): Promise<TableColumn[]> {
    const result = await admin.query<TableColumn>(
      `
        SELECT column_name, data_type, udt_name, is_nullable, column_default, is_generated
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position
      `,
      [schema, table]
    );
    return result.rows;
  }

  function buildInsertRow(
    columns: TableColumn[],
    provided: Record<string, unknown>
  ): Record<string, unknown> {
    const row: Record<string, unknown> = {};
    for (const column of columns) {
      if (column.is_generated === 'ALWAYS') continue;
      if (column.column_name in provided) {
        row[column.column_name] = provided[column.column_name];
      } else if (column.is_nullable === 'NO' && !column.column_default) {
        row[column.column_name] = fallbackValue(column);
      }
    }
    return row;
  }

  async function insertRow(
    tableName: string,
    row: Record<string, unknown>,
    conflictColumn?: string
  ): Promise<void> {
    const columns = Object.keys(row);
    const placeholders = columns.map((_, index) => `$${index + 1}`);
    const conflict = conflictColumn ? ` ON CONFLICT (${conflictColumn}) DO NOTHING` : '';
    await admin.query(
      `
        INSERT INTO ${tableName} (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
        ${conflict}
      `,
      columns.map((column) => row[column])
    );
  }

  async function expectInventoryOnHand(expected: number): Promise<void> {
    const result = await admin.query<QueryResultRow & { quantity_on_hand: string | number }>(
      `
        SELECT quantity_on_hand
        FROM logistics.inventory
        WHERE tenant_id = $1::uuid
          AND item_id = $2
          AND location_id = $3
          AND lot_number = $4
      `,
      [ids.tenant, ids.item, ids.location, `${marker}-lot`]
    );
    expect(Number(result.rows[0].quantity_on_hand)).toBe(expected);
  }

  async function expectMovementCount(expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM logistics.inventory_movements
        WHERE tenant_id = $1::uuid
          AND item_id = $2
          AND source_document_type = 'warehouse_stock_in'
      `,
      [ids.tenant, ids.item]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  async function expectIdempotencyCount(idempotencyKey: string, expected: number): Promise<void> {
    const result = await admin.query<CountRow>(
      `
        SELECT COUNT(*)::text AS count
        FROM logistics.stock_in_idempotency
        WHERE tenant_id = $1::uuid
          AND operation = 'warehouse_stock_in.production_order'
          AND idempotency_key = $2
          AND status = 'completed'
      `,
      [ids.tenant, idempotencyKey]
    );
    expect(Number(result.rows[0].count)).toBe(expected);
  }

  function expectProductionReferenceReadBack(
    line: WarehouseStockInLineEvidence,
    idempotencyKey: string
  ): void {
    const events = readCustodyEvents(line.readBack.traceability.metadata);
    const matchingEvent = events.find((event) => {
      const metadata = event.metadata;
      return isRecord(metadata) &&
        metadata.production_order_id === ids.productionOrder &&
        metadata.production_order_line_id === ids.productionOrderLine &&
        metadata.production_receipt_line_id === ids.receiptLine &&
        metadata.production_output_idempotency_key === idempotencyKey;
    });
    expect(matchingEvent).toBeDefined();
  }

  async function cleanupFixtures(): Promise<void> {
    await admin.query('SET row_security = off');
    await admin.query('DELETE FROM logistics.stock_in_idempotency WHERE tenant_id = $1::uuid', [
      ids.tenant,
    ]);
    await admin.query(
      'DELETE FROM logistics.inventory_movements WHERE tenant_id = $1::uuid AND item_id = $2',
      [ids.tenant, ids.item]
    );
    await admin.query(
      'DELETE FROM logistics.traceability WHERE tenant_id = $1::uuid AND item_id = $2',
      [ids.tenant, ids.item]
    );
    await admin.query(
      'DELETE FROM logistics.inventory WHERE tenant_id = $1::uuid AND item_id = $2',
      [ids.tenant, ids.item]
    );
    await admin.query('DELETE FROM logistics.locations WHERE tenant_id = $1::uuid AND id = $2', [
      ids.tenant,
      ids.location,
    ]);
    await admin.query('DELETE FROM logistics.items WHERE tenant_id = $1::uuid AND id = $2', [
      ids.tenant,
      ids.item,
    ]);
    await admin.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [
      [ids.user, ids.otherUser],
    ]);
    for (const tenantId of [ids.tenant, ids.otherTenant]) {
      await admin
        .query('DELETE FROM public.tenants WHERE id = $1::uuid', [tenantId])
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          console.warn(
            `[Logistics production-order stock-in Real DB cleanup] retained tenant shell because public.timeline_events is append-only and may hold tenant FK rows: ${tenantId}. ${message}`
          );
        });
    }
  }
});

interface TableColumn extends QueryResultRow {
  column_name: string;
  data_type: string;
  udt_name: string;
  is_nullable: 'YES' | 'NO';
  column_default: string | null;
  is_generated: 'ALWAYS' | 'NEVER';
}

function fallbackValue(column: TableColumn): unknown {
  if (column.udt_name === 'uuid') return randomUUID();
  if (column.data_type.includes('timestamp')) return new Date();
  if (column.data_type === 'boolean') return true;
  if (column.data_type === 'jsonb' || column.data_type === 'json') return {};
  if (column.data_type === 'integer' || column.data_type === 'numeric') return 0;
  return `${column.column_name}-test`;
}

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function loadLogisticsE2eEnv(): void {
  for (const filePath of candidateE2eEnvFiles()) {
    if (!existsSync(filePath)) continue;
    const parsed = parseEnv(readFileSync(filePath));
    for (const [key, value] of Object.entries(parsed)) {
      if (!process.env[key]?.trim()) {
        process.env[key] = value;
      }
    }
  }
  mapE2eAliases();
}

function candidateE2eEnvFiles(): string[] {
  const candidates = [
    process.env.E2E_ENV_FILE,
    path.join(tmpdir(), 'bella-spa-e2e.env'),
    path.resolve(process.cwd(), '.env.e2e'),
    path.resolve(process.cwd(), '../BELLA SPA ERP/.env.e2e'),
  ].filter((filePath): filePath is string => Boolean(filePath));

  return [...new Set(candidates.map((filePath) => path.resolve(filePath)))];
}

function mapE2eAliases(): void {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.E2E_SUPABASE_URL) {
    process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.E2E_SUPABASE_URL;
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.E2E_SUPABASE_SERVICE_ROLE_KEY) {
    process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.E2E_SUPABASE_SERVICE_ROLE_KEY;
  }
  if (!process.env.SUPABASE_DB_URL && process.env.E2E_SUPABASE_DB_URL) {
    process.env.SUPABASE_DB_URL = process.env.E2E_SUPABASE_DB_URL;
  }
}

function isAllowedE2eProject(): boolean {
  const supabaseUrl =
    process.env.E2E_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    '';
  try {
    return new URL(supabaseUrl).host === EXPECTED_E2E_SUPABASE_HOST;
  } catch {
    return false;
  }
}

function isAllowedE2eDbUrl(value: string): boolean {
  return value.toLowerCase().includes(EXPECTED_E2E_PROJECT_REF);
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

function readCustodyEvents(metadata: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  const events = metadata?.custody_events;
  if (!Array.isArray(events)) return [];
  return events.filter(isRecord);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
