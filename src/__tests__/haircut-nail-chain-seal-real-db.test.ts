import { randomUUID } from 'crypto';
import { Client } from 'pg';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

import {
  getSupabaseAdminKey,
  getSupabaseAdminUrl,
} from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

const dbUrl =
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || '';

function isRunnableDbUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value);
    return Boolean(parsed.hostname && parsed.hostname !== 'base');
  } catch {
    return false;
  }
}

function hasRealSupabaseAdminEnv(): boolean {
  const url = getSupabaseAdminUrl();
  const adminKey = getSupabaseAdminKey();
  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
}

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

const describeIfRealDb = isRunnableDbUrl(dbUrl) && hasRealSupabaseAdminEnv()
  ? describe
  : describe.skip;

type AccessRow = {
  org_unit_id: string;
};

type BooleanRow = {
  allowed: boolean;
};

type CountRow = {
  count: number;
};

type BookingBranchRow = {
  branch_id: string | null;
  metadata_branch_id: string | null;
};

type AppointmentBranchRow = {
  branch_id: string | null;
};

describeIfRealDb('Haircut + Nail Platform Chain seal real DB proof', () => {
  jest.setTimeout(120_000);

  const marker = `chain-seal-${Date.now()}`;
  const ids = {
    haircutTenant: '00000000-0000-4100-9000-00000000c501',
    haircutBranchA: randomUUID(),
    haircutBranchB: randomUUID(),
    haircutPerson: randomUUID(),
    haircutCustomer: randomUUID(),
    haircutBooking: randomUUID(),
    nailTenant: '00000000-0000-4100-9000-00000000c502',
    nailBranchA: randomUUID(),
    nailBranchB: randomUUID(),
    nailPerson: randomUUID(),
    nailCustomer: randomUUID(),
    nailAppointment: randomUUID(),
  };

  let client: Client;
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  const authUserIds: string[] = [];
  let haircutUserId = '';
  let nailUserId = '';

  beforeAll(async () => {
    const adminUrl = getSupabaseAdminUrl();
    const adminKey = getSupabaseAdminKey();
    supabase = createSupabaseClient<Database>(adminUrl, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    client = new Client({
      connectionString: dbUrl,
      ssl: sslConfig(),
    });
    await client.connect();

    haircutUserId = await createAuthUser('haircut');
    nailUserId = await createAuthUser('nail');
    await seedHaircutTenant();
    await seedNailTenant();
  });

  afterAll(async () => {
    let cleanupError: unknown = null;
    if (client) {
      try {
        await cleanupDatabaseRows();
        await assertNoBusinessRowsRemain();
      } catch (error) {
        cleanupError = error;
      } finally {
        await client.end();
      }
    }

    await Promise.all(
      authUserIds.map(async (userId) => {
        await supabase.auth.admin.deleteUser(userId);
      }),
    );

    if (cleanupError) {
      throw cleanupError;
    }
  });

  async function createAuthUser(label: string): Promise<string> {
    const email = `${marker}-${label}-${randomUUID()}@example.com`;
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password: `${randomUUID()}A1!`,
      email_confirm: true,
    });

    expect(error).toBeNull();
    expect(data.user?.id).toBeTruthy();

    const userId = data.user!.id;
    authUserIds.push(userId);
    return userId;
  }

  async function seedTenant(input: {
    tenantId: string;
    name: string;
    productKey: string;
  }) {
    await client.query(
      `
        INSERT INTO public.tenants (id, name, status, product_key, enabled_modules)
        VALUES ($1::uuid, $2, 'active', $3, '{"beauty_spa": true}'::jsonb)
        ON CONFLICT (id) DO UPDATE
        SET name = EXCLUDED.name,
            status = EXCLUDED.status,
            product_key = EXCLUDED.product_key,
            enabled_modules = EXCLUDED.enabled_modules
      `,
      [input.tenantId, input.name, input.productKey],
    );
  }

  async function seedPublicUser(input: {
    tenantId: string;
    userId: string;
    email: string;
    fullName: string;
    role: string;
  }) {
    await client.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, $5, 'active')
        ON CONFLICT (id) DO UPDATE
        SET tenant_id = EXCLUDED.tenant_id,
            email = EXCLUDED.email,
            full_name = EXCLUDED.full_name,
            role = EXCLUDED.role,
            status = EXCLUDED.status
      `,
      [input.userId, input.tenantId, input.email, input.fullName, input.role],
    );
  }

  async function seedBranchAccess(input: {
    tenantId: string;
    branchA: string;
    branchB: string;
    personId: string;
    userId: string;
    label: string;
  }) {
    await client.query(
      `
        INSERT INTO public.org_units (id, tenant_id, unit_type, name, code, is_active, metadata)
        VALUES
          ($1::uuid, $3::uuid, 'branch', $4, $6, TRUE, '{"proof":"chain-seal"}'::jsonb),
          ($2::uuid, $3::uuid, 'branch', $5, $7, TRUE, '{"proof":"chain-seal"}'::jsonb)
      `,
      [
        input.branchA,
        input.branchB,
        input.tenantId,
        `${input.label} Branch A`,
        `${input.label} Branch B`,
        `${marker}-${input.label}-A`,
        `${marker}-${input.label}-B`,
      ],
    );

    await client.query(
      `
        INSERT INTO public.people_directory (id, tenant_id, user_id, person_type, display_name, is_active, metadata)
        VALUES ($1::uuid, $2::uuid, $3::uuid, 'employee', $4, TRUE, '{"proof":"chain-seal"}'::jsonb)
      `,
      [input.personId, input.tenantId, input.userId, `${input.label} chain user`],
    );

    await client.query(
      `
        INSERT INTO public.org_relationships (
          tenant_id,
          from_id,
          from_type,
          to_id,
          to_type,
          rel_type,
          role,
          since,
          metadata
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          'person',
          $3::uuid,
          'unit',
          'belongs_to',
          'operator',
          CURRENT_DATE,
          '{"proof":"chain-seal"}'::jsonb
        )
      `,
      [input.tenantId, input.personId, input.branchA],
    );
  }

  async function seedHaircutTenant() {
    await seedTenant({
      tenantId: ids.haircutTenant,
      name: `${marker} Haircut Tenant`,
      productKey: 'bella_haircut',
    });
    await seedPublicUser({
      tenantId: ids.haircutTenant,
      userId: haircutUserId,
      email: `${marker}-haircut-public@example.com`,
      fullName: `${marker} Haircut User`,
      role: 'ktv',
    });
    await seedBranchAccess({
      tenantId: ids.haircutTenant,
      branchA: ids.haircutBranchA,
      branchB: ids.haircutBranchB,
      personId: ids.haircutPerson,
      userId: haircutUserId,
      label: 'haircut',
    });
    await client.query(
      `
        INSERT INTO public.customers (id, tenant_id, phone, name_mother, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'active')

      `,
      [ids.haircutCustomer, ids.haircutTenant, `09${Date.now().toString().slice(-8)}`, `${marker} Haircut Customer`],
    );
  }

  async function seedNailTenant() {
    await seedTenant({
      tenantId: ids.nailTenant,
      name: `${marker} Nail Tenant`,
      productKey: 'bella_nail',
    });
    await seedPublicUser({
      tenantId: ids.nailTenant,
      userId: nailUserId,
      email: `${marker}-nail-public@example.com`,
      fullName: `${marker} Nail User`,
      role: 'ktv',
    });
    await seedBranchAccess({
      tenantId: ids.nailTenant,
      branchA: ids.nailBranchA,
      branchB: ids.nailBranchB,
      personId: ids.nailPerson,
      userId: nailUserId,
      label: 'nail',
    });
    await client.query(
      `
        INSERT INTO public.customers (id, tenant_id, phone, name_mother, status)
        VALUES ($1::uuid, $2::uuid, $3, $4, 'active')

      `,
      [ids.nailCustomer, ids.nailTenant, `08${Date.now().toString().slice(-8)}`, `${marker} Nail Customer`],
    );
  }

  async function setAppContext(userId: string, tenantId: string) {
    await client.query(
      `
        SELECT
          set_config('app.current_user_id', $1, FALSE),
          set_config('app.current_tenant_id', $2, FALSE),
          set_config('request.jwt.claim.sub', $1, FALSE),
          set_config('request.jwt.claim.role', 'authenticated', FALSE)
      `,
      [userId, tenantId],
    );
  }

  async function resetAppContext() {
    await client.query(
      `
        SELECT
          set_config('app.current_user_id', '', FALSE),
          set_config('app.current_tenant_id', '', FALSE),
          set_config('request.jwt.claim.sub', '', FALSE),
          set_config('request.jwt.claim.role', '', FALSE)
      `,
    );
  }

  async function readAccessibleBranches(tenantId: string): Promise<string[]> {
    const result = await client.query<AccessRow>(
      `
        SELECT org_unit_id::text
        FROM public.user_org_unit_access
        WHERE tenant_id = $1::uuid
        ORDER BY org_unit_id::text
      `,
      [tenantId],
    );
    return result.rows.map((row) => row.org_unit_id);
  }

  async function readHaircutAccessAllowed(tenantId: string, branchId: string | null): Promise<boolean> {
    const result = await client.query<BooleanRow>(
      `
        SELECT public.haircut_branch_access_allowed($1::uuid, $2::uuid) AS allowed
      `,
      [tenantId, branchId],
    );
    return result.rows[0]?.allowed ?? false;
  }

  async function cleanupDatabaseRows() {
    await client.query('SET row_security = off');
    await resetAppContext();

    await client.query(
      `
        DELETE FROM public.beauty_sessions
        WHERE tenant_id = $1::uuid
      `,
      [ids.nailTenant],
    );
    await client.query(
      `
        DELETE FROM public.beauty_appointments
        WHERE tenant_id = $1::uuid
      `,
      [ids.nailTenant],
    );
    await client.query(
      `
        DELETE FROM public.accounting_outbox
        WHERE tenant_id = $1::uuid
      `,
      [ids.haircutTenant],
    );
    await client.query(
      `
        DELETE FROM public.audit_logs
        WHERE tenant_id = $1::uuid
      `,
      [ids.haircutTenant],
    );
    await client.query(
      `
        DELETE FROM public.revenue
        WHERE tenant_id = $1::uuid
      `,
      [ids.haircutTenant],
    );
    await client.query(
      `
        DELETE FROM public.session_logs
        WHERE tenant_id = $1::uuid
      `,
      [ids.haircutTenant],
    );
    await client.query(
      `
        DELETE FROM public.bookings
        WHERE tenant_id = $1::uuid
      `,
      [ids.haircutTenant],
    );
    await client.query(
      `
        DELETE FROM public.customers
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.haircutTenant, ids.nailTenant]],
    );
    await client.query(
      `
        DELETE FROM public.org_relationships
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.haircutTenant, ids.nailTenant]],
    );
    await client.query(
      `
        DELETE FROM public.people_directory
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.haircutTenant, ids.nailTenant]],
    );
    await client.query(
      `
        DELETE FROM public.users
        WHERE id = ANY($1::uuid[])
      `,
      [authUserIds],
    );
    await client.query(
      `
        DELETE FROM public.org_units
        WHERE tenant_id = ANY($1::uuid[])
      `,
      [[ids.haircutTenant, ids.nailTenant]],
    );

    console.warn(
      `[Haircut/Nail Chain seal cleanup] retained tenant shells because public.timeline_events has append-only/RLS FK behavior: ${ids.haircutTenant}, ${ids.nailTenant}`,
    );
    await resetAppContext();
  }

  async function assertNoBusinessRowsRemain() {
    const tableChecks = [
      ['bookings', ids.haircutTenant],
      ['session_logs', ids.haircutTenant],
      ['revenue', ids.haircutTenant],
      ['beauty_appointments', ids.nailTenant],
      ['beauty_sessions', ids.nailTenant],
    ] as const;

    for (const [tableName, tenantId] of tableChecks) {
      const result = await client.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_id = $1::uuid`,
        [tenantId],
      );
      expect(result.rows[0]?.count).toBe(0);
    }
  }

  it('seals Haircut branch chain with Platform access, restrictive DB guard, branch read-back, and negative branch denial', async () => {
    await setAppContext(haircutUserId, ids.haircutTenant);

    const accessibleBranches = await readAccessibleBranches(ids.haircutTenant);
    expect(accessibleBranches).toEqual([ids.haircutBranchA]);

    await expect(readHaircutAccessAllowed(ids.haircutTenant, ids.haircutBranchA)).resolves.toBe(true);
    await expect(readHaircutAccessAllowed(ids.haircutTenant, ids.haircutBranchB)).resolves.toBe(false);
    await expect(readHaircutAccessAllowed(ids.haircutTenant, null)).resolves.toBe(false);

    const schemaResult = await client.query<{ table_name: string }>(
      `
        SELECT table_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND column_name = 'branch_id'
          AND table_name = ANY($1::text[])
        ORDER BY table_name
      `,
      [['attendance', 'bookings', 'revenue', 'salary_records', 'session_logs']],
    );
    expect(schemaResult.rows.map((row) => row.table_name)).toEqual([
      'attendance',
      'bookings',
      'revenue',
      'salary_records',
      'session_logs',
    ]);

    const policyResult = await client.query<{ tablename: string; permissive: string }>(
      `
        SELECT tablename, permissive
        FROM pg_policies
        WHERE schemaname = 'public'
          AND policyname IN (
            'haircut_bookings_branch_guard',
            'haircut_revenue_branch_guard',
            'haircut_session_logs_branch_guard',
            'haircut_attendance_branch_guard',
            'haircut_salary_records_branch_guard'
          )
        ORDER BY tablename
      `,
    );
    expect(policyResult.rows).toHaveLength(5);
    expect(policyResult.rows.every((row) => row.permissive === 'RESTRICTIVE')).toBe(true);

    await client.query(
      `
        INSERT INTO public.bookings (
          id,
          tenant_id,
          customer_id,
          booking_number,
          branch_id,
          status,
          deposit_amount,
          full_price,
          total_sessions,
          metadata
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4,
          $5::uuid,
          'deposit_pending',
          0,
          120000,
          1,
          jsonb_build_object('proof', $6::text, 'branch_id', $5::text)
        )
      `,
      [
        ids.haircutBooking,
        ids.haircutTenant,
        ids.haircutCustomer,
        `${marker}-HC-001`,
        ids.haircutBranchA,
        marker,
      ],
    );

    const bookingReadback = await client.query<BookingBranchRow>(
      `
        SELECT branch_id::text, metadata->>'branch_id' AS metadata_branch_id
        FROM public.bookings
        WHERE id = $1::uuid
      `,
      [ids.haircutBooking],
    );
    expect(bookingReadback.rows[0]).toEqual({
      branch_id: ids.haircutBranchA,
      metadata_branch_id: ids.haircutBranchA,
    });
  });

  it('seals Nail branch chain consumption with Platform access and Beauty H8 branch read-back', async () => {
    await setAppContext(nailUserId, ids.nailTenant);

    const accessibleBranches = await readAccessibleBranches(ids.nailTenant);
    expect(accessibleBranches).toEqual([ids.nailBranchA]);

    await client.query(
      `
        INSERT INTO public.beauty_appointments (
          id,
          tenant_id,
          branch_id,
          customer_id,
          service_id,
          status,
          starts_at,
          ends_at
        )
        VALUES (
          $1::uuid,
          $2::uuid,
          $3::uuid,
          $4::uuid,
          $5::uuid,
          'PENDING',
          NOW(),
          NOW() + INTERVAL '45 minutes'
        )
      `,
      [
        ids.nailAppointment,
        ids.nailTenant,
        ids.nailBranchA,
        ids.nailCustomer,
        randomUUID(),
      ],
    );

    const appointmentReadback = await client.query<AppointmentBranchRow>(
      `
        SELECT branch_id::text
        FROM public.beauty_appointments
        WHERE id = $1::uuid
          AND tenant_id = $2::uuid
      `,
      [ids.nailAppointment, ids.nailTenant],
    );
    expect(appointmentReadback.rows[0]).toEqual({
      branch_id: ids.nailBranchA,
    });

    expect(accessibleBranches).not.toContain(ids.nailBranchB);
  });
});

if (!isRunnableDbUrl(dbUrl) || !hasRealSupabaseAdminEnv()) {
  console.warn(
    'Skipping Haircut + Nail Chain seal real DB proof: runnable DB URL and real Supabase admin credentials are required.',
  );
}
