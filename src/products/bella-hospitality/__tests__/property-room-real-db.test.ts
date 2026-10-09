import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { HospitalityPropertyRoomRepository, type HospitalitySqlClient } from '../repositories/property-room.repository';
import { HospitalityPropertyRoomService } from '../services/property-room.service';

jest.setTimeout(90_000);

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

function sslConfig(): { rejectUnauthorized: boolean } | undefined {
  return dbUrl.includes('localhost') || dbUrl.includes('127.0.0.1')
    ? undefined
    : { rejectUnauthorized: false };
}

const describeWithRealDb = isRunnableDbUrl(dbUrl) ? describe : describe.skip;

type PgRows<Row extends Record<string, unknown>> = {
  readonly rows: Row[];
};

type CountRow = {
  readonly count: number;
};

class PgHospitalitySqlClient implements HospitalitySqlClient {
  constructor(private readonly client: Client) {}

  async query<Row extends Record<string, unknown>>(
    sql: string,
    values?: readonly unknown[]
  ): Promise<PgRows<Row>> {
    const result = await this.client.query<Row & QueryResultRow>(sql, values ? [...values] : undefined);
    return { rows: result.rows };
  }
}

async function queryAsTenant<Row extends QueryResultRow>(
  tenantId: string,
  sql: string,
  values?: readonly unknown[]
): Promise<Row[]> {
  const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
  const userId = `hospitality-proof-${tenantId}`;
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
      [userId, claims, tenantId]
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

describeWithRealDb('Hospitality Phase 1 Property/Room Real DB proof', () => {
  let client: Client;
  let service: HospitalityPropertyRoomService;
  let tenantAId = '';
  let tenantBId = '';

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    service = new HospitalityPropertyRoomService(
      new HospitalityPropertyRoomRepository(new PgHospitalitySqlClient(client))
    );

    tenantAId = randomUUID();
    tenantBId = randomUUID();

    await cleanupHospitalityRows();

    await client.query(
      `
        INSERT INTO public.tenants (id, name, status, product_key)
        VALUES
          ($1, $2, 'active', 'bella_hospitality'),
          ($3, $4, 'active', 'bella_hospitality')
      `,
      [
        tenantAId,
        `Hospitality Phase1 Tenant A ${Date.now()}`,
        tenantBId,
        `Hospitality Phase1 Tenant B ${Date.now()}`,
      ]
    );
  });

  afterAll(async () => {
    if (client) {
      try {
        await cleanupHospitalityRows();
        await assertNoHospitalityRowsRemain();
      } finally {
        await client.end();
      }
    }
  });

  async function cleanupHospitalityRows(): Promise<void> {
    await client.query('SET row_security = off');

    await client.query(
      'DELETE FROM public.hospitality_rooms WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_types WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_floors WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_buildings WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_properties WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    // Tenant shells are retained because shared E2E DB tenants have append-only timeline FK/RLS behavior.
  }

  async function assertNoHospitalityRowsRemain(): Promise<void> {
    const tableNames = [
      'hospitality_rooms',
      'hospitality_room_types',
      'hospitality_floors',
      'hospitality_buildings',
      'hospitality_properties',
    ] as const;

    for (const tableName of tableNames) {
      const result = await client.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantAId, tenantBId]]
      );
      expect(result.rows[0]?.count).toBe(0);
    }
  }

  it('persists the approved Property -> Building -> Floor -> Room Type -> Room chain', async () => {
    const foundation = await service.createPropertyRoomFoundation({
      tenantId: tenantAId,
      property: {
        code: `PROP-${Date.now()}`,
        name: 'Bella Hotel Saigon',
        propertyType: 'hotel',
        city: 'Ho Chi Minh City',
      },
      building: {
        code: 'MAIN',
        name: 'Main Tower',
      },
      floor: {
        floorNumber: 1,
        code: 'L1',
        name: 'Level 1',
      },
      roomType: {
        code: 'DLX',
        name: 'Deluxe King',
        maxOccupancy: 2,
        baseAdults: 2,
        bedConfig: { king: 1 },
      },
      room: {
        roomNumber: '101',
        displayName: '101 - Deluxe King',
      },
    });

    expect(foundation.property.tenantId).toBe(tenantAId);
    expect(foundation.building.propertyId).toBe(foundation.property.id);
    expect(foundation.floor.buildingId).toBe(foundation.building.id);
    expect(foundation.roomType.propertyId).toBe(foundation.property.id);
    expect(foundation.room.floorId).toBe(foundation.floor.id);
    expect(foundation.room.roomTypeId).toBe(foundation.roomType.id);

    const sameTenantRoom = await service.getRoom(tenantAId, foundation.room.id);
    const crossTenantRoom = await service.getRoom(tenantBId, foundation.room.id);
    const propertyRooms = await service.listRoomsByProperty(tenantAId, foundation.property.id);

    expect(sameTenantRoom?.id).toBe(foundation.room.id);
    expect(crossTenantRoom).toBeNull();
    expect(propertyRooms.map((room) => room.id)).toContain(foundation.room.id);
  });

  it('rejects cross-property room type assignment through product-owned foreign keys', async () => {
    const foundationA = await service.createPropertyRoomFoundation({
      tenantId: tenantAId,
      property: { code: `PROPA-${Date.now()}`, name: 'Property A' },
      building: { code: 'MAIN', name: 'Main' },
      floor: { floorNumber: 1, code: 'L1', name: 'Level 1' },
      roomType: { code: 'STD', name: 'Standard', maxOccupancy: 2 },
      room: { roomNumber: `A-${Date.now()}` },
    });

    const foundationB = await service.createPropertyRoomFoundation({
      tenantId: tenantAId,
      property: { code: `PROPB-${Date.now()}`, name: 'Property B' },
      building: { code: 'MAIN', name: 'Main' },
      floor: { floorNumber: 1, code: 'L1', name: 'Level 1' },
      roomType: { code: 'STE', name: 'Suite', maxOccupancy: 3 },
      room: { roomNumber: `B-${Date.now()}` },
    });

    await expect(
      service.createRoom({
        tenantId: tenantAId,
        propertyId: foundationA.property.id,
        buildingId: foundationA.building.id,
        floorId: foundationA.floor.id,
        roomTypeId: foundationB.roomType.id,
        roomNumber: `X-${Date.now()}`,
      })
    ).rejects.toThrow();
  });

  it('enforces RLS same-tenant visibility and cross-tenant invisibility', async () => {
    const foundation = await service.createPropertyRoomFoundation({
      tenantId: tenantAId,
      property: { code: `RLS-${Date.now()}`, name: 'RLS Property' },
      building: { code: 'MAIN', name: 'Main' },
      floor: { floorNumber: 1, code: 'L1', name: 'Level 1' },
      roomType: { code: 'RLS', name: 'RLS Type', maxOccupancy: 2 },
      room: { roomNumber: `RLS-${Date.now()}` },
    });

    const sameTenantRows = await queryAsTenant<{ id: string; tenant_id: string }>(
      tenantAId,
      'SELECT id, tenant_id FROM public.hospitality_rooms WHERE id = $1',
      [foundation.room.id]
    );
    const crossTenantRows = await queryAsTenant<{ id: string; tenant_id: string }>(
      tenantBId,
      'SELECT id, tenant_id FROM public.hospitality_rooms WHERE id = $1',
      [foundation.room.id]
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].tenant_id).toBe(tenantAId);
    expect(crossTenantRows).toHaveLength(0);
  });
});
