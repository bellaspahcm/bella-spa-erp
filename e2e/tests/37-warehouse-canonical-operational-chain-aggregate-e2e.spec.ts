import { randomUUID } from 'crypto';

import { expect, test, type Page } from '@playwright/test';
import { Client, type QueryResultRow } from 'pg';

interface ProofIds {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  itemA: string;
  sourceLocation: string;
  destinationLocation: string;
  stockInDocument: string;
  transferDocument: string;
  adjustmentDocument: string;
  stockOutDocument: string;
  stockInLine: string;
  transferLine: string;
  adjustmentLine: string;
  stockOutLine: string;
  lotNumber: string;
  marker: string;
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

interface MovementCountRow extends QueryResultRow {
  movement_type: string;
  direction: string;
  status: string;
  count: string | number;
}

interface TraceabilityRow extends QueryResultRow {
  compliance_status: string;
  custody_event_count: string | number;
}

interface CountRow extends QueryResultRow {
  count: string | number;
}

test.describe('Warehouse canonical operational chain aggregate browser E2E', () => {
  test.setTimeout(180_000);
  test.use({ javaScriptEnabled: false });

  test('runs Stock-In -> Transfer -> Adjustment -> Stock-Out through canonical browser entries', async ({ page }) => {
    const db = new Client({
      connectionString: getDatabaseUrl(),
      ssl: { rejectUnauthorized: false },
    });
    const ids = createProofIds();
    let testError: unknown = null;

    await db.connect();

    try {
      await cleanup(db, ids);
      await seedFixture(db, ids);
      await loginWithMockUser(page, `${ids.marker}-a@example.test`);

      await submitStockIn(page, ids);
      await expect(page.getByTestId('stock-in-status')).toContainText('Canonical Stock-In completed');
      await expect(page.getByTestId('stock-in-balance-on-hand')).toContainText('30.5');
      await expect(page.getByTestId('stock-in-movement')).toContainText('RECEIPT:COMPLETED');
      await expect(page.getByTestId('stock-in-traceability')).toContainText('COMPLIANT');

      await submitTransfer(page, ids);
      await expect(page.getByTestId('transfer-status')).toContainText('Canonical Stock Transfer completed');
      await expect(page.getByTestId('transfer-source-balance')).toContainText('22.25');
      await expect(page.getByTestId('transfer-destination-balance')).toContainText('8.25');
      await expect(page.getByTestId('transfer-movement')).toContainText('RELOCATION:NEUTRAL:COMPLETED');
      await expect(page.getByTestId('transfer-traceability')).toContainText('COMPLIANT');

      await submitAdjustment(page, ids);
      await expect(page.getByTestId('adjustment-status')).toContainText('Canonical Stock Adjustment completed');
      await expect(page.getByTestId('adjustment-balance')).toContainText('29');
      await expect(page.getByTestId('adjustment-movement')).toContainText('ADJUSTMENT_INCREASE:INBOUND:COMPLETED');
      await expect(page.getByTestId('adjustment-traceability')).toContainText('COMPLIANT');

      await submitStockOut(page, ids);
      await expect(page.getByTestId('stock-out-status')).toContainText('Canonical Stock-Out completed');
      await expect(page.getByTestId('stock-out-balance')).toContainText('23.5');
      await expect(page.getByTestId('stock-out-movement')).toContainText('ISSUE:OUTBOUND:COMPLETED');
      await expect(page.getByTestId('stock-out-traceability')).toContainText('COMPLIANT');

      const tenantAEvidence = await withAuthenticatedTenant(db, ids.userA, async () => ({
        role: await readRuntimeRole(db),
        sourceInventory: await readInventory(db, ids, ids.sourceLocation),
        destinationInventory: await readInventory(db, ids, ids.destinationLocation),
        movements: await readMovementCounts(db, ids),
        traceability: await readTraceability(db, ids),
      }));

      expect(tenantAEvidence.role.current_user).toBe('authenticated');
      expect(tenantAEvidence.role.rolbypassrls).toBe(false);
      expect(tenantAEvidence.role.tenant_id).toBe(ids.tenantA);
      expect(toNumber(tenantAEvidence.sourceInventory.quantity_on_hand)).toBe(23.5);
      expect(toNumber(tenantAEvidence.sourceInventory.quantity_available)).toBe(23.5);
      expect(toNumber(tenantAEvidence.destinationInventory.quantity_on_hand)).toBe(8.25);
      expect(toNumber(tenantAEvidence.destinationInventory.quantity_available)).toBe(8.25);
      expect(hasMovement(tenantAEvidence.movements, 'RECEIPT', 'INBOUND')).toBe(true);
      expect(hasMovement(tenantAEvidence.movements, 'RELOCATION', 'NEUTRAL')).toBe(true);
      expect(hasMovement(tenantAEvidence.movements, 'ADJUSTMENT_INCREASE', 'INBOUND')).toBe(true);
      expect(hasMovement(tenantAEvidence.movements, 'ISSUE', 'OUTBOUND')).toBe(true);
      expect(tenantAEvidence.traceability.compliance_status).toBe('COMPLIANT');
      expect(toNumber(tenantAEvidence.traceability.custody_event_count)).toBe(4);

      const tenantBNegative = await withAuthenticatedTenant(db, ids.userB, async () => {
        const read = await db.query(
          `
          SELECT id
          FROM logistics.inventory
          WHERE tenant_id = $1::uuid AND item_id = $2::uuid
          `,
          [ids.tenantA, ids.itemA]
        );
        const update = await db.query(
          `
          UPDATE logistics.inventory
          SET quantity_on_hand = quantity_on_hand + 1
          WHERE tenant_id = $1::uuid AND item_id = $2::uuid
          `,
          [ids.tenantA, ids.itemA]
        );
        const insertDeniedCode = await captureInsertDeniedCode(db, ids);

        return {
          readRows: read.rowCount ?? 0,
          updateRows: update.rowCount ?? 0,
          insertDeniedCode,
        };
      });

      expect(tenantBNegative.readRows).toBe(0);
      expect(tenantBNegative.updateRows).toBe(0);
      expect(tenantBNegative.insertDeniedCode).toBe('42501');
    } catch (error) {
      testError = error;
    }

    try {
      await cleanup(db, ids);
      await expectRemainingProofTenants(db, ids.marker, 0);
    } catch (cleanupError) {
      if (testError) {
        throw new Error(`${String(testError)}; cleanup also failed: ${String(cleanupError)}`);
      }
      throw cleanupError;
    } finally {
      await db.end();
    }

    if (testError) throw testError;
  });
});

async function submitStockIn(page: Page, ids: ProofIds): Promise<void> {
  await page.goto('/warehouse/stock-in', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('stock-in-sourceDocumentId').fill(ids.stockInDocument);
  await page.getByTestId('stock-in-sourceDocumentNumber').fill(`${ids.marker}-IN`);
  await page.getByTestId('stock-in-sourceType').selectOption('purchase_order');
  await page.getByTestId('stock-in-sourceLineId').fill(ids.stockInLine);
  await page.getByTestId('stock-in-warehouseSkuId').fill(`warehouse-sku-${ids.marker}`);
  await page.getByTestId('stock-in-warehouseBinId').fill(`warehouse-bin-source-${ids.marker}`);
  await page.getByTestId('stock-in-itemId').fill(ids.itemA);
  await page.getByTestId('stock-in-locationId').fill(ids.sourceLocation);
  await page.getByTestId('stock-in-quantity').fill('30.5');
  await page.getByTestId('stock-in-unitOfMeasure').fill('EA');
  await page.getByTestId('stock-in-lotNumber').fill(ids.lotNumber);
  await page.getByTestId('stock-in-unitCost').fill('4.25');
  await page.getByTestId('stock-in-currency').fill('VND');
  await page.getByTestId('canonical-stock-in-submit').click();
}

async function submitTransfer(page: Page, ids: ProofIds): Promise<void> {
  await page.goto('/warehouse/transfer', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('transfer-transferDocumentId').fill(ids.transferDocument);
  await page.getByTestId('transfer-transferDocumentNumber').fill(`${ids.marker}-TR`);
  await page.getByTestId('transfer-transferType').selectOption('warehouse_transfer');
  await page.getByTestId('transfer-sourceLineId').fill(ids.transferLine);
  await page.getByTestId('transfer-warehouseSkuId').fill(`warehouse-sku-${ids.marker}`);
  await page.getByTestId('transfer-fromWarehouseBinId').fill(`warehouse-bin-source-${ids.marker}`);
  await page.getByTestId('transfer-toWarehouseBinId').fill(`warehouse-bin-destination-${ids.marker}`);
  await page.getByTestId('transfer-itemId').fill(ids.itemA);
  await page.getByTestId('transfer-fromLocationId').fill(ids.sourceLocation);
  await page.getByTestId('transfer-toLocationId').fill(ids.destinationLocation);
  await page.getByTestId('transfer-quantity').fill('8.25');
  await page.getByTestId('transfer-unitOfMeasure').fill('EA');
  await page.getByTestId('transfer-lotNumber').fill(ids.lotNumber);
  await page.getByTestId('canonical-transfer-submit').click();
}

async function submitAdjustment(page: Page, ids: ProofIds): Promise<void> {
  await page.goto('/warehouse/adjustment', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('adjustment-adjustmentDocumentId').fill(ids.adjustmentDocument);
  await page.getByTestId('adjustment-adjustmentDocumentNumber').fill(`${ids.marker}-ADJ`);
  await page.getByTestId('adjustment-adjustmentType').selectOption('cycle_count');
  await page.getByTestId('adjustment-reason').selectOption('cycle_count');
  await page.getByTestId('adjustment-sourceLineId').fill(ids.adjustmentLine);
  await page.getByTestId('adjustment-warehouseSkuId').fill(`warehouse-sku-${ids.marker}`);
  await page.getByTestId('adjustment-warehouseBinId').fill(`warehouse-bin-source-${ids.marker}`);
  await page.getByTestId('adjustment-itemId').fill(ids.itemA);
  await page.getByTestId('adjustment-locationId').fill(ids.sourceLocation);
  await page.getByTestId('adjustment-quantityDelta').fill('6.75');
  await page.getByTestId('adjustment-unitOfMeasure').fill('EA');
  await page.getByTestId('adjustment-lotNumber').fill(ids.lotNumber);
  await page.getByTestId('adjustment-notes').fill('aggregate browser adjustment proof');
  await page.getByTestId('adjustment-unitCost').fill('4.25');
  await page.getByTestId('adjustment-currency').fill('VND');
  await page.getByTestId('canonical-adjustment-submit').click();
}

async function submitStockOut(page: Page, ids: ProofIds): Promise<void> {
  await page.goto('/warehouse/stock-out', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('stock-out-issueDocumentId').fill(ids.stockOutDocument);
  await page.getByTestId('stock-out-issueDocumentNumber').fill(`${ids.marker}-OUT`);
  await page.getByTestId('stock-out-issueType').selectOption('warehouse_issue');
  await page.getByTestId('stock-out-reason').selectOption('disposal');
  await page.getByTestId('stock-out-sourceLineId').fill(ids.stockOutLine);
  await page.getByTestId('stock-out-warehouseSkuId').fill(`warehouse-sku-${ids.marker}`);
  await page.getByTestId('stock-out-warehouseBinId').fill(`warehouse-bin-source-${ids.marker}`);
  await page.getByTestId('stock-out-itemId').fill(ids.itemA);
  await page.getByTestId('stock-out-locationId').fill(ids.sourceLocation);
  await page.getByTestId('stock-out-quantity').fill('5.5');
  await page.getByTestId('stock-out-unitOfMeasure').fill('EA');
  await page.getByTestId('stock-out-lotNumber').fill(ids.lotNumber);
  await page.getByTestId('stock-out-notes').fill('aggregate browser stock-out proof');
  await page.getByTestId('stock-out-unitCost').fill('4.25');
  await page.getByTestId('stock-out-currency').fill('VND');
  await page.getByTestId('canonical-stock-out-submit').click();
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

function getE2eBaseUrl(): string {
  return process.env.E2E_BASE_URL?.trim() || `http://localhost:${process.env.E2E_PORT ?? '3000'}`;
}

function createProofIds(): ProofIds {
  const marker = `warehouse-aggregate-browser-${Date.now()}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    itemA: randomUUID(),
    sourceLocation: randomUUID(),
    destinationLocation: randomUUID(),
    stockInDocument: randomUUID(),
    transferDocument: randomUUID(),
    adjustmentDocument: randomUUID(),
    stockOutDocument: randomUUID(),
    stockInLine: randomUUID(),
    transferLine: randomUUID(),
    adjustmentLine: randomUUID(),
    stockOutLine: randomUUID(),
    lotNumber: `LOT-${marker}`,
    marker,
  };
}

async function loginWithMockUser(page: Page, email: string): Promise<void> {
  await page.context().addCookies([
    {
      name: 'mock_user_email',
      value: email,
      url: getE2eBaseUrl(),
      sameSite: 'Lax',
    },
  ]);
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
      ($1::uuid, $2::uuid, $3, $4, 'admin', 'active'),
      ($5::uuid, $6::uuid, $7, $8, 'admin', 'active')
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
    VALUES
      ($1::uuid, $2::uuid, $3, $4, 'WAREHOUSE', 'ACTIVE'),
      ($5::uuid, $2::uuid, $6, $7, 'WAREHOUSE', 'ACTIVE')
    `,
    [
      ids.sourceLocation,
      ids.tenantA,
      `SRC-${ids.marker}`,
      `${ids.marker} Source`,
      ids.destinationLocation,
      `DST-${ids.marker}`,
      `${ids.marker} Destination`,
    ]
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

async function readInventory(
  db: Client,
  ids: ProofIds,
  locationId: string
): Promise<InventoryRow> {
  const result = await db.query<InventoryRow>(
    `
    SELECT quantity_on_hand, quantity_available
    FROM logistics.inventory
    WHERE tenant_id = $1::uuid
      AND item_id = $2::uuid
      AND location_id = $3::uuid
      AND lot_number = $4
    `,
    [ids.tenantA, ids.itemA, locationId, ids.lotNumber]
  );
  return requireRow(result.rows[0], 'inventory read-back not found');
}

async function readMovementCounts(db: Client, ids: ProofIds): Promise<MovementCountRow[]> {
  const result = await db.query<MovementCountRow>(
    `
    SELECT movement_type, direction, status, COUNT(*)::int AS count
    FROM logistics.inventory_movements
    WHERE tenant_id = $1::uuid
      AND item_id = $2::uuid
      AND lot_number = $3
      AND movement_type = ANY($4::text[])
    GROUP BY movement_type, direction, status
    `,
    [
      ids.tenantA,
      ids.itemA,
      ids.lotNumber,
      [
        'RECEIPT',
        'RELOCATION',
        'ADJUSTMENT_INCREASE',
        'ISSUE',
      ],
    ]
  );
  return result.rows;
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
        from_location_id,
        from_location_type,
        quantity,
        unit_of_measure,
        status
      )
      VALUES (
        $1::uuid,
        $2,
        $3::uuid,
        'ISSUE',
        'OUTBOUND',
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
        ids.sourceLocation,
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

async function expectRemainingProofTenants(
  db: Client,
  marker: string,
  expected: number
): Promise<void> {
  const result = await db.query<CountRow>(
    'SELECT COUNT(*)::int AS count FROM public.tenants WHERE name LIKE $1',
    [`${marker}%`]
  );
  expect(toNumber(requireRow(result.rows[0], 'tenant count not returned').count)).toBe(expected);
}

function hasMovement(
  rows: MovementCountRow[],
  movementType: string,
  direction: string
): boolean {
  return rows.some((row) =>
    row.movement_type === movementType &&
    row.direction === direction &&
    row.status === 'COMPLETED' &&
    toNumber(row.count) === 1
  );
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
