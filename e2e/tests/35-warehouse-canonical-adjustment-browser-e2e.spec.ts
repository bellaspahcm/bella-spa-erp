import { randomUUID } from 'crypto';

import { expect, test, type Page } from '@playwright/test';
import { Client, type QueryResultRow } from 'pg';

interface ProofIds {
  tenantA: string;
  tenantB: string;
  userA: string;
  userB: string;
  itemA: string;
  locationA: string;
  increaseDocument: string;
  decreaseDocument: string;
  increaseLine: string;
  decreaseLine: string;
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

test.describe('Warehouse canonical Stock Adjustment browser E2E', () => {
  test.setTimeout(120_000);
  test.use({ javaScriptEnabled: false });

  test('submits Adjustment through canonical browser entry and proves Real DB/RLS read-back', async ({ page }) => {
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

      await page.goto('/warehouse/adjustment', { waitUntil: 'domcontentloaded' });
      await expect(page).toHaveURL(/\/warehouse\/adjustment/);

      await submitAdjustment(page, {
        documentId: ids.increaseDocument,
        documentNumber: `${ids.marker}-ADJ-IN`,
        sourceLineId: ids.increaseLine,
        warehouseSkuId: `warehouse-sku-${ids.marker}`,
        warehouseBinId: `warehouse-bin-${ids.marker}`,
        itemId: ids.itemA,
        locationId: ids.locationA,
        quantityDelta: '6.75',
        lotNumber: ids.lotNumber,
        reason: 'cycle_count',
      });

      await expect(page.getByTestId('adjustment-status')).toContainText('Canonical Stock Adjustment completed');
      await expect(page.getByTestId('adjustment-balance')).toContainText('26.75');
      await expect(page.getByTestId('adjustment-movement')).toContainText('ADJUSTMENT_INCREASE:INBOUND:COMPLETED');
      await expect(page.getByTestId('adjustment-traceability')).toContainText('COMPLIANT');

      await submitAdjustment(page, {
        documentId: ids.decreaseDocument,
        documentNumber: `${ids.marker}-ADJ-OUT`,
        sourceLineId: ids.decreaseLine,
        warehouseSkuId: `warehouse-sku-${ids.marker}`,
        warehouseBinId: `warehouse-bin-${ids.marker}`,
        itemId: ids.itemA,
        locationId: ids.locationA,
        quantityDelta: '-4.25',
        lotNumber: ids.lotNumber,
        reason: 'loss',
      });

      await expect(page.getByTestId('adjustment-status')).toContainText('Canonical Stock Adjustment completed');
      await expect(page.getByTestId('adjustment-balance')).toContainText('22.5');
      await expect(page.getByTestId('adjustment-movement')).toContainText('ADJUSTMENT_DECREASE:OUTBOUND:COMPLETED');
      await expect(page.getByTestId('adjustment-traceability')).toContainText('COMPLIANT');

      const tenantAEvidence = await withAuthenticatedTenant(db, ids.userA, async () => ({
        role: await readRuntimeRole(db),
        inventory: await readInventory(db, ids),
        movements: await readMovementCounts(db, ids),
        traceability: await readTraceability(db, ids),
      }));

      expect(tenantAEvidence.role.current_user).toBe('authenticated');
      expect(tenantAEvidence.role.rolbypassrls).toBe(false);
      expect(tenantAEvidence.role.tenant_id).toBe(ids.tenantA);
      expect(toNumber(tenantAEvidence.inventory.quantity_on_hand)).toBe(22.5);
      expect(toNumber(tenantAEvidence.inventory.quantity_available)).toBe(22.5);
      expect(hasMovement(tenantAEvidence.movements, 'ADJUSTMENT_INCREASE', 'INBOUND')).toBe(true);
      expect(hasMovement(tenantAEvidence.movements, 'ADJUSTMENT_DECREASE', 'OUTBOUND')).toBe(true);
      expect(tenantAEvidence.traceability.compliance_status).toBe('COMPLIANT');
      expect(toNumber(tenantAEvidence.traceability.custody_event_count)).toBe(3);

      const tenantBNegative = await withAuthenticatedTenant(db, ids.userB, async () => {
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

async function submitAdjustment(
  page: Page,
  input: {
    documentId: string;
    documentNumber: string;
    sourceLineId: string;
    warehouseSkuId: string;
    warehouseBinId: string;
    itemId: string;
    locationId: string;
    quantityDelta: string;
    lotNumber: string;
    reason: string;
  }
): Promise<void> {
  await page.goto('/warehouse/adjustment', { waitUntil: 'domcontentloaded' });
  await page.getByTestId('adjustment-adjustmentDocumentId').fill(input.documentId);
  await page.getByTestId('adjustment-adjustmentDocumentNumber').fill(input.documentNumber);
  await page.getByTestId('adjustment-adjustmentType').selectOption('cycle_count');
  await page.getByTestId('adjustment-reason').selectOption(input.reason);
  await page.getByTestId('adjustment-sourceLineId').fill(input.sourceLineId);
  await page.getByTestId('adjustment-warehouseSkuId').fill(input.warehouseSkuId);
  await page.getByTestId('adjustment-warehouseBinId').fill(input.warehouseBinId);
  await page.getByTestId('adjustment-itemId').fill(input.itemId);
  await page.getByTestId('adjustment-locationId').fill(input.locationId);
  await page.getByTestId('adjustment-quantityDelta').fill(input.quantityDelta);
  await page.getByTestId('adjustment-unitOfMeasure').fill('EA');
  await page.getByTestId('adjustment-lotNumber').fill(input.lotNumber);
  await page.getByTestId('adjustment-notes').fill(`browser adjustment ${input.quantityDelta}`);
  await page.getByTestId('adjustment-unitCost').fill('4.25');
  await page.getByTestId('adjustment-currency').fill('VND');
  await page.getByTestId('canonical-adjustment-submit').click();
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
  const marker = `warehouse-adjustment-browser-${Date.now()}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    itemA: randomUUID(),
    locationA: randomUUID(),
    increaseDocument: randomUUID(),
    decreaseDocument: randomUUID(),
    increaseLine: randomUUID(),
    decreaseLine: randomUUID(),
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
    VALUES ($1::uuid, $2::uuid, $3, $4, 'WAREHOUSE', 'ACTIVE')
    `,
    [ids.locationA, ids.tenantA, `LOC-${ids.marker}`, `${ids.marker} Location`]
  );

  await db.query(
    `
    INSERT INTO logistics.inventory (
      tenant_id,
      item_id,
      location_id,
      location_type,
      quantity_on_hand,
      quantity_reserved,
      lot_number,
      status
    )
    VALUES ($1::uuid, $2::uuid, $3::uuid, 'WAREHOUSE', 20.0, 0, $4, 'AVAILABLE')
    `,
    [ids.tenantA, ids.itemA, ids.locationA, ids.lotNumber]
  );

  await db.query(
    `
    INSERT INTO logistics.traceability (
      tenant_id,
      item_id,
      lot_number,
      received_date,
      custody_events,
      compliance_status,
      recall_status
    )
    VALUES ($1::uuid, $2::uuid, $3, CURRENT_TIMESTAMP, $4::jsonb, 'COMPLIANT', 'NONE')
    `,
    [
      ids.tenantA,
      ids.itemA,
      ids.lotNumber,
      JSON.stringify([{ event_id: randomUUID(), action: 'seeded_for_adjustment_browser_e2e' }]),
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

async function readInventory(db: Client, ids: ProofIds): Promise<InventoryRow> {
  const result = await db.query<InventoryRow>(
    `
    SELECT quantity_on_hand, quantity_available
    FROM logistics.inventory
    WHERE tenant_id = $1::uuid
      AND item_id = $2::uuid
      AND location_id = $3::uuid
      AND lot_number = $4
    `,
    [ids.tenantA, ids.itemA, ids.locationA, ids.lotNumber]
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
      AND source_document_id = ANY($3::uuid[])
    GROUP BY movement_type, direction, status
    `,
    [ids.tenantA, ids.itemA, [ids.increaseDocument, ids.decreaseDocument]]
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
        'ADJUSTMENT_INCREASE',
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
