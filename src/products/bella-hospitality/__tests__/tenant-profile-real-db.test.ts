import { randomUUID } from 'crypto';

import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { validateHospitalityTenantProfile } from '../profile-contract';

jest.setTimeout(120_000);

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
  readonly marker: string;
};

type TenantProfileRow = QueryResultRow & {
  readonly id: string;
  readonly product_key: string | null;
  readonly profile_id: string | null;
  readonly front_desk_mode: string | null;
  readonly housekeeping_cadence: string | null;
  readonly maintenance_priority: string | null;
  readonly auth_tenant_id: string | null;
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

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

const describeWithRealDb = isRunnableDbUrl(dbUrl) ? describe : describe.skip;

describeWithRealDb('Hospitality tenant profile Real DB and RLS proof', () => {
  let client: Client;
  const ids = createProofIds();

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();

    await cleanupProofRows();
    await seedTenantProfileRows();
  });

  afterAll(async () => {
    if (!client) return;
    try {
      await cleanupProofRows();
    } finally {
      await client.end();
    }
  });

  it('persists Hospitality profile metadata and enforces authenticated tenant isolation', async () => {
    const validProfile = validateHospitalityTenantProfile('hotel', {
      frontDeskMode: 'full_service',
      housekeepingCadence: 'daily',
      maintenancePriority: 'guest_blocking_first',
    });
    const invalidProfile = validateHospitalityTenantProfile('villa', {});

    expect(validProfile.success).toBe(true);
    expect(invalidProfile).toEqual({
      success: false,
      error: 'Hospitality profile không được hỗ trợ.',
    });

    const sameTenantRows = await queryAsTenant<TenantProfileRow>(
      ids.userA,
      ids.tenantA,
      `
        SELECT
          id::text,
          product_key,
          metadata #>> '{hospitality,profileId}' AS profile_id,
          metadata #>> '{hospitality,configuration,frontDeskMode}' AS front_desk_mode,
          metadata #>> '{hospitality,configuration,housekeepingCadence}' AS housekeeping_cadence,
          metadata #>> '{hospitality,configuration,maintenancePriority}' AS maintenance_priority,
          public.get_auth_tenant_id()::text AS auth_tenant_id
        FROM public.tenants
        WHERE id = $1::uuid
      `,
      [ids.tenantA],
    );

    const crossTenantRows = await queryAsTenant<TenantProfileRow>(
      ids.userB,
      ids.tenantB,
      `
        SELECT
          id::text,
          product_key,
          metadata #>> '{hospitality,profileId}' AS profile_id,
          metadata #>> '{hospitality,configuration,frontDeskMode}' AS front_desk_mode,
          metadata #>> '{hospitality,configuration,housekeepingCadence}' AS housekeeping_cadence,
          metadata #>> '{hospitality,configuration,maintenancePriority}' AS maintenance_priority,
          public.get_auth_tenant_id()::text AS auth_tenant_id
        FROM public.tenants
        WHERE id = $1::uuid
      `,
      [ids.tenantA],
    );

    const crossTenantMutationRows = await queryAsTenant<{ id: string }>(
      ids.userB,
      ids.tenantB,
      `
        UPDATE public.tenants
        SET metadata = jsonb_set(metadata::jsonb, '{hospitality,configuration,frontDeskMode}', '"full_service"', true)
        WHERE id = $1::uuid
        RETURNING id::text
      `,
      [ids.tenantA],
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].id).toBe(ids.tenantA);
    expect(sameTenantRows[0].product_key).toBe('bella_hospitality');
    expect(sameTenantRows[0].profile_id).toBe('hotel');
    expect(sameTenantRows[0].front_desk_mode).toBe('full_service');
    expect(sameTenantRows[0].housekeeping_cadence).toBe('daily');
    expect(sameTenantRows[0].maintenance_priority).toBe('guest_blocking_first');
    expect(sameTenantRows[0].auth_tenant_id).toBe(ids.tenantA);
    expect(crossTenantRows).toHaveLength(0);
    expect(crossTenantMutationRows).toHaveLength(0);
  });

  async function seedTenantProfileRows(): Promise<void> {
    const hotelProfile = validateHospitalityTenantProfile('hotel', {
      frontDeskMode: 'full_service',
      housekeepingCadence: 'daily',
      maintenancePriority: 'guest_blocking_first',
    });
    const homestayProfile = validateHospitalityTenantProfile('homestay', {
      frontDeskMode: 'self_check_in',
      housekeepingCadence: 'turnover_only',
      maintenancePriority: 'owner_approval_required',
    });

    if (!hotelProfile.success || !homestayProfile.success) {
      throw new Error('Hospitality tenant profile fixtures must be valid');
    }

    await client.query('SET row_security = off');
    await client.query(
      `
        INSERT INTO public.tenants (id, name, email, status, product_key, metadata)
        VALUES
          ($1::uuid, $2, $3, 'active', 'bella_hospitality', $4::jsonb),
          ($5::uuid, $6, $7, 'active', 'bella_hospitality', $8::jsonb)
      `,
      [
        ids.tenantA,
        `${ids.marker} Tenant A`,
        `${ids.marker}-tenant-a@bellaspahcm.test`,
        JSON.stringify({ hospitality: { schemaVersion: 1, ...hotelProfile.profile } }),
        ids.tenantB,
        `${ids.marker} Tenant B`,
        `${ids.marker}-tenant-b@bellaspahcm.test`,
        JSON.stringify({ hospitality: { schemaVersion: 1, ...homestayProfile.profile } }),
      ],
    );

    await client.query(
      `
        INSERT INTO public.users (id, tenant_id, email, full_name, role, status)
        VALUES
          ($1::uuid, $2::uuid, $3, $4, 'admin', 'active'),
          ($5::uuid, $6::uuid, $7, $8, 'admin', 'active')
      `,
      [
        ids.userA,
        ids.tenantA,
        `${ids.marker}-admin-a@bellaspahcm.test`,
        `${ids.marker} Admin A`,
        ids.userB,
        ids.tenantB,
        `${ids.marker}-admin-b@bellaspahcm.test`,
        `${ids.marker} Admin B`,
      ],
    );
  }

  async function cleanupProofRows(): Promise<void> {
    await client.query('SET row_security = off');
    await client.query('DELETE FROM public.users WHERE id = ANY($1::uuid[])', [[ids.userA, ids.userB]]);
    await client.query('DELETE FROM public.tenants WHERE id = ANY($1::uuid[])', [[ids.tenantA, ids.tenantB]]);
  }
});

async function queryAsTenant<Row extends QueryResultRow>(
  userId: string,
  tenantId: string,
  sql: string,
  values?: readonly unknown[],
): Promise<Row[]> {
  const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
  const claims = JSON.stringify({
    sub: userId,
    role: 'authenticated',
    app_metadata: {
      tenant_id: tenantId,
      role: 'admin',
    },
  });

  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query('SET LOCAL row_security = on');
    await client.query(
      `
        SELECT
          set_config('request.jwt.claim.sub', $1, true),
          set_config('request.jwt.claim.role', 'authenticated', true),
          set_config('request.jwt.claims', $2, true),
          set_config('app.current_tenant_id', $3, true)
      `,
      [userId, claims, tenantId],
    );
    const result = await client.query<Row>(sql, values ? [...values] : undefined);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

function createProofIds(): ProofIds {
  const marker = `hprof-${Date.now()}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    marker,
  };
}
