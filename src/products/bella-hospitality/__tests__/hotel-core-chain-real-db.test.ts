import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { executeHospitalityHotelCoreChainWithContext } from '@/services/hospitality-hotel-core-chain-actions';
import { getSupabaseAdminKey, getSupabaseAdminUrl } from '@/lib/supabase-admin-env';

jest.setTimeout(180_000);

const dbUrl =
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || '';

type ProofIds = {
  readonly tenantA: string;
  readonly tenantB: string;
  readonly userA: string;
  readonly userB: string;
  readonly guestParty: string;
  readonly marker: string;
};

type RuntimeRoleRow = QueryResultRow & {
  readonly current_user: string;
  readonly rolbypassrls: boolean;
  readonly tenant_id: string | null;
};

type HotelCoreReadbackRow = QueryResultRow & {
  readonly property_id: string;
  readonly room_id: string;
  readonly reservation_id: string;
  readonly stay_id: string;
  readonly stay_status: string;
  readonly occupancy_status: string;
  readonly folio_id: string;
  readonly folio_status: string;
  readonly outstanding_amount_minor: string | number;
  readonly paid_amount_minor: string | number;
  readonly finance_invoice_id: string;
  readonly finance_allocation_id: string;
  readonly payment_amount_minor: string | number;
};

type FinanceReadbackRow = QueryResultRow & {
  readonly invoice_status: string;
  readonly total_invoice_amount_minor: string | number;
  readonly position_allocated_amount_minor: string | number;
  readonly position_outstanding_amount_minor: string | number;
  readonly cash_direction: string;
  readonly cash_amount_minor: string | number;
  readonly allocation_amount_minor: string | number;
};

type CrossTenantReadback = {
  readonly folioRows: number;
  readonly financeRows: number;
  readonly updateRows: number;
};

type CountRow = QueryResultRow & {
  readonly count: string | number;
};

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function hasRunnableSupabaseAdminEnv(): boolean {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  return Boolean(
    url.trim()
    && adminKey.trim()
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key'
  );
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

const describeWithRealDb =
  isRunnableDbUrl(dbUrl) && hasRunnableSupabaseAdminEnv()
    ? describe
    : describe.skip;

describeWithRealDb('Hospitality Hotel Core full-chain Real DB proof', () => {
  let db: Client;
  const ids = createProofIds();

  beforeAll(async () => {
    db = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await db.connect();
    await enterFixtureBypassRole(db);

    await cleanupHospitalityRows(db, ids);
    await seedFixture(db, ids);
  });

  afterAll(async () => {
    if (!db) return;
    try {
      await cleanupHospitalityRows(db, ids);
      await expectRemainingHospitalityRows(db, ids, 0);
    } finally {
      await db.end();
    }
  });

  it('runs Guest -> Reservation -> Stay -> Folio -> Finance Payment -> Check-out with tenant isolation', async () => {
    const result = await executeHospitalityHotelCoreChainWithContext(
      {
        marker: ids.marker,
        guestPartyId: ids.guestParty,
        checkInDate: '2027-11-01',
        checkOutDate: '2027-11-03',
        amountMinor: 2_400_000,
        currency: 'VND',
        paymentMethod: 'cash',
      },
      {
        userId: ids.userA,
        tenantId: ids.tenantA,
      }
    );

    if (!result.ok) {
      throw new Error(`${result.error.code}: ${result.error.message}`);
    }

    expect(result).toMatchObject({
      ok: true,
      value: {
        productKey: 'bella_hospitality',
        tenantId: ids.tenantA,
        userId: ids.userA,
        stayStatus: 'completed',
        occupancyStatus: 'released',
        folioStatus: 'closed',
        folioOutstandingAmountMinor: 0,
        folioPaidAmountMinor: 2_400_000,
        financeAllocatedAmountMinor: 2_400_000,
      },
    });

    const tenantAEvidence = await withAuthenticatedUser(db, ids.userA, ids.tenantA, async () => ({
      role: await readRuntimeRole(db),
      hotel: await readHotelCoreChain(db, ids),
    }));

    expect(tenantAEvidence.role.current_user).toBe('authenticated');
    expect(tenantAEvidence.role.rolbypassrls).toBe(false);
    expect(tenantAEvidence.role.tenant_id).toBe(ids.tenantA);
    expect(tenantAEvidence.hotel.property_id).toBe(result.value.propertyId);
    expect(tenantAEvidence.hotel.room_id).toBe(result.value.roomId);
    expect(tenantAEvidence.hotel.reservation_id).toBe(result.value.reservationId);
    expect(tenantAEvidence.hotel.stay_id).toBe(result.value.stayId);
    expect(tenantAEvidence.hotel.stay_status).toBe('completed');
    expect(tenantAEvidence.hotel.occupancy_status).toBe('released');
    expect(tenantAEvidence.hotel.folio_status).toBe('closed');
    expect(toNumber(tenantAEvidence.hotel.outstanding_amount_minor)).toBe(0);
    expect(toNumber(tenantAEvidence.hotel.paid_amount_minor)).toBe(2_400_000);
    expect(toNumber(tenantAEvidence.hotel.payment_amount_minor)).toBe(2_400_000);

    const financeEvidence = await withAuthenticatedUser(db, ids.userA, ids.tenantA, async () =>
      readFinanceChain(
        db,
        tenantAEvidence.hotel.finance_invoice_id,
        tenantAEvidence.hotel.finance_allocation_id
      )
    );

    expect(financeEvidence.invoice_status).toBe('FINALIZED');
    expect(toNumber(financeEvidence.total_invoice_amount_minor)).toBe(2_400_000);
    expect(toNumber(financeEvidence.position_allocated_amount_minor)).toBe(2_400_000);
    expect(toNumber(financeEvidence.position_outstanding_amount_minor)).toBe(0);
    expect(financeEvidence.cash_direction).toBe('INFLOW');
    expect(toNumber(financeEvidence.cash_amount_minor)).toBe(2_400_000);
    expect(toNumber(financeEvidence.allocation_amount_minor)).toBe(2_400_000);

    const tenantBNegative = await withAuthenticatedUser(db, ids.userB, ids.tenantB, async () =>
      readCrossTenantNegative(db, tenantAEvidence.hotel.folio_id, tenantAEvidence.hotel.finance_invoice_id)
    );

    expect(tenantBNegative.folioRows).toBe(0);
    expect(tenantBNegative.financeRows).toBe(0);
    expect(tenantBNegative.updateRows).toBe(0);
  });
});

async function seedFixture(db: Client, ids: ProofIds): Promise<void> {
  await enterFixtureBypassRole(db);

  await db.query(
    `
    INSERT INTO public.tenants (id, name, status, product_key)
    VALUES
      ($1::uuid, $2, 'active', 'bella_hospitality'),
      ($3::uuid, $4, 'active', 'bella_hospitality')
    `,
    [
      ids.tenantA,
      `${ids.marker} Tenant A`,
      ids.tenantB,
      `${ids.marker} Tenant B`,
    ]
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
    INSERT INTO public.party_parties (id, tenant_id, party_type, display_name)
    VALUES ($1::uuid, $2::uuid, 'person', $3)
    `,
    [ids.guestParty, ids.tenantA, `${ids.marker} Guest`]
  );

  await seedFinanceFoundation(db, ids);
}

async function seedFinanceFoundation(db: Client, ids: ProofIds): Promise<void> {
  await db.query(
    `
    INSERT INTO public.finance_accounting_periods (
      tenant_id, name, period_start, period_end, status
    )
    VALUES ($1::uuid, $2, DATE '2026-01-01', DATE '2027-12-31', 'OPEN')
    `,
    [ids.tenantA, `${ids.marker}-FY2026-2027`]
  );

  await db.query(
    `
    INSERT INTO public.finance_accounts (
      tenant_id, code, name, type, normal_balance, currency, is_active
    )
    VALUES
      ($1::uuid, '131', 'Phai thu khach hang', 'ASSET', 'DEBIT', 'VND', true),
      ($1::uuid, '511', 'Doanh thu dich vu', 'REVENUE', 'CREDIT', 'VND', true),
      ($1::uuid, '111', 'Tien mat', 'ASSET', 'DEBIT', 'VND', true)
    `,
    [ids.tenantA]
  );

  const cashAccount = await db.query<{ id: string } & QueryResultRow>(
    `
    SELECT id
    FROM public.finance_accounts
    WHERE tenant_id = $1::uuid AND code = '111'
    LIMIT 1
    `,
    [ids.tenantA]
  );
  const cashAccountId = requireRow(cashAccount.rows[0], 'cash finance account not found').id;

  await db.query(
    `
    INSERT INTO public.finance_bank_accounts (
      tenant_id, bank_name, account_number, account_name, currency,
      linked_finance_account_id, is_active
    )
    VALUES ($1::uuid, 'Bella Hospitality Cash Desk', $2, 'Hospitality cash on hand', 'VND', $3::uuid, true)
    `,
    [ids.tenantA, `${ids.marker}-111`, cashAccountId]
  );

  await db.query(
    `
    INSERT INTO public.finance_control_account_mappings (
      tenant_id,
      control_type,
      account_code,
      effective_from,
      effective_to,
      authority_version
    )
    VALUES
      (
        $1::uuid,
        'TRADE_RECEIVABLE',
        '131',
        DATE '2026-01-01',
        NULL,
        'VI_TT99_2025|99/2025/TT-BTC|PROVEN'
      ),
      (
        $1::uuid,
        'SERVICE_REVENUE',
        '511',
        DATE '2026-01-01',
        NULL,
        'VI_TT99_2025|99/2025/TT-BTC|PROVEN'
      )
    `,
    [ids.tenantA]
  );
}

async function withAuthenticatedUser<TResult>(
  db: Client,
  userId: string,
  tenantId: string,
  operation: () => Promise<TResult>
): Promise<TResult> {
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: {
      tenant_id: tenantId,
      role: 'admin',
    },
  });

  await db.query('BEGIN');
  try {
    await db.query("SET LOCAL ROLE authenticated");
    await db.query('SET LOCAL row_security = on');
    await db.query(
      `
      SELECT
        set_config('request.jwt.claim.sub', $1, true),
        set_config('request.jwt.claim.role', 'authenticated', true),
        set_config('request.jwt.claims', $2, true),
        set_config('app.current_tenant_id', $3, true)
      `,
      [userId, claims, tenantId]
    );

    const result = await operation();
    await db.query('COMMIT');
    return result;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
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

async function readHotelCoreChain(db: Client, ids: ProofIds): Promise<HotelCoreReadbackRow> {
  const result = await db.query<HotelCoreReadbackRow>(
    `
    SELECT
      p.id AS property_id,
      r.id AS room_id,
      res.id AS reservation_id,
      s.id AS stay_id,
      s.status AS stay_status,
      occ.status AS occupancy_status,
      f.id AS folio_id,
      f.status AS folio_status,
      f.outstanding_amount_minor,
      f.paid_amount_minor,
      link.finance_invoice_id::text AS finance_invoice_id,
      app.finance_allocation_id::text AS finance_allocation_id,
      app.amount_minor AS payment_amount_minor
    FROM public.hospitality_properties p
    JOIN public.hospitality_rooms r
      ON r.tenant_id = p.tenant_id
     AND r.property_id = p.id
    JOIN public.hospitality_reservations res
      ON res.tenant_id = p.tenant_id
     AND res.property_id = p.id
    JOIN public.hospitality_stays s
      ON s.tenant_id = p.tenant_id
     AND s.property_id = p.id
     AND s.reservation_id = res.id
    JOIN public.hospitality_room_occupancies occ
      ON occ.tenant_id = p.tenant_id
     AND occ.property_id = p.id
     AND occ.stay_id = s.id
    JOIN public.hospitality_folios f
      ON f.tenant_id = p.tenant_id
     AND f.property_id = p.id
     AND f.stay_id = s.id
    JOIN public.hospitality_folio_finance_links link
      ON link.tenant_id = p.tenant_id
     AND link.property_id = p.id
     AND link.folio_id = f.id
    JOIN public.hospitality_folio_payment_applications app
      ON app.tenant_id = p.tenant_id
     AND app.property_id = p.id
     AND app.folio_id = f.id
     AND app.finance_invoice_id = link.finance_invoice_id
    WHERE p.tenant_id = $1::uuid
      AND p.metadata->>'proof_marker' = $2
    LIMIT 1
    `,
    [ids.tenantA, ids.marker]
  );
  return requireRow(result.rows[0], 'Hotel Core chain read-back not found');
}

async function readFinanceChain(
  db: Client,
  invoiceId: string,
  allocationId: string
): Promise<FinanceReadbackRow> {
  const result = await db.query<FinanceReadbackRow>(
    `
    SELECT
      inv.status AS invoice_status,
      inv.total_invoice_amount_minor,
      pos.allocated_amount_minor AS position_allocated_amount_minor,
      pos.outstanding_amount_minor AS position_outstanding_amount_minor,
      cash.direction AS cash_direction,
      cash.amount_minor AS cash_amount_minor,
      alloc.allocated_amount_minor AS allocation_amount_minor
    FROM public.finance_invoices inv
    JOIN public.finance_receivable_positions pos
      ON pos.tenant_id = inv.tenant_id
     AND pos.invoice_id = inv.id
    JOIN public.finance_receivable_allocations alloc
      ON alloc.tenant_id = inv.tenant_id
     AND alloc.invoice_id = inv.id
    JOIN public.finance_cash_movements cash
      ON cash.tenant_id = inv.tenant_id
     AND cash.id = alloc.cash_movement_id
    WHERE inv.id = $1::uuid
      AND alloc.id = $2::uuid
    LIMIT 1
    `,
    [invoiceId, allocationId]
  );
  return requireRow(result.rows[0], 'Finance chain read-back not found');
}

async function readCrossTenantNegative(
  db: Client,
  folioId: string,
  financeInvoiceId: string
): Promise<CrossTenantReadback> {
  const folioRead = await db.query(
    `
    SELECT id
    FROM public.hospitality_folios
    WHERE id = $1::uuid
    `,
    [folioId]
  );
  const financeRead = await db.query(
    `
    SELECT id
    FROM public.finance_invoices
    WHERE id = $1::uuid
    `,
    [financeInvoiceId]
  );
  const folioUpdate = await db.query(
    `
    UPDATE public.hospitality_folios
    SET metadata = jsonb_set(metadata, '{cross_tenant_write}', '"denied"', true)
    WHERE id = $1::uuid
    `,
    [folioId]
  );

  return {
    folioRows: folioRead.rowCount ?? 0,
    financeRows: financeRead.rowCount ?? 0,
    updateRows: folioUpdate.rowCount ?? 0,
  };
}

async function cleanupHospitalityRows(db: Client, ids: ProofIds): Promise<void> {
  await enterFixtureBypassRole(db);

  await db.query('BEGIN');
  try {
    await db.query('SET LOCAL row_security = off');
    await db.query(
      'DELETE FROM public.hospitality_folio_payment_applications WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_folio_finance_links WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_folio_items WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_folios WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_room_occupancies WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_stays WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_reservation_rooms WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_reservations WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_guests WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_rooms WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_room_types WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_floors WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_buildings WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query(
      'DELETE FROM public.hospitality_properties WHERE tenant_id = ANY($1::uuid[])',
      [[ids.tenantA, ids.tenantB]]
    );
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK').catch(() => undefined);
    throw error;
  }
}

async function enterFixtureBypassRole(db: Client): Promise<void> {
  await db.query('RESET ROLE');
  await db.query('SET row_security = off');
}

async function expectRemainingHospitalityRows(
  db: Client,
  ids: ProofIds,
  expected: number
): Promise<void> {
  const tableNames = [
    'hospitality_folio_payment_applications',
    'hospitality_folio_finance_links',
    'hospitality_folio_items',
    'hospitality_folios',
    'hospitality_room_occupancies',
    'hospitality_stays',
    'hospitality_reservation_rooms',
    'hospitality_reservations',
    'hospitality_guests',
    'hospitality_rooms',
    'hospitality_room_types',
    'hospitality_floors',
    'hospitality_buildings',
    'hospitality_properties',
  ] as const;

  for (const tableName of tableNames) {
    const result = await db.query<CountRow>(
      `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_id = ANY($1::uuid[])`,
      [[ids.tenantA, ids.tenantB]]
    );
    expect(toNumber(requireRow(result.rows[0], `${tableName} count not returned`).count)).toBe(expected);
  }
}

function createProofIds(): ProofIds {
  const marker = `hcrdb-${Date.now()}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    guestParty: randomUUID(),
    marker,
  };
}

function requireRow<TRow>(row: TRow | undefined, message: string): TRow {
  if (!row) throw new Error(message);
  return row;
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}
