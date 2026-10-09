import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { HospitalityPropertyRoomRepository, type HospitalitySqlClient } from '../repositories/property-room.repository';
import { HospitalityGuestReservationRepository } from '../repositories/guest-reservation.repository';
import { HospitalityPropertyRoomService } from '../services/property-room.service';
import { HospitalityGuestReservationService } from '../services/guest-reservation.service';
import type { HospitalityPropertyRoomFoundation } from '../types/property-room.types';

jest.setTimeout(120_000);

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

type ReservationVisibilityRow = {
  readonly id: string;
  readonly tenant_id: string;
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

async function queryAsTenant<Row extends Record<string, unknown>>(
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
    const result = await client.query<Row & QueryResultRow>(sql, values ? [...values] : undefined);
    await client.query('COMMIT');
    return result.rows;
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

describeWithRealDb('Hospitality Phase 2 Guest + Reservation Real DB proof', () => {
  let client: Client;
  let propertyService: HospitalityPropertyRoomService;
  let reservationService: HospitalityGuestReservationService;
  let tenantAId = '';
  let tenantBId = '';

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const sqlClient = new PgHospitalitySqlClient(client);
    propertyService = new HospitalityPropertyRoomService(
      new HospitalityPropertyRoomRepository(sqlClient)
    );
    reservationService = new HospitalityGuestReservationService(
      new HospitalityGuestReservationRepository(sqlClient)
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
        `Hospitality Phase2 Tenant A ${Date.now()}`,
        tenantBId,
        `Hospitality Phase2 Tenant B ${Date.now()}`,
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
      'DELETE FROM public.hospitality_reservation_rooms WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_reservations WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_guests WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
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
    // Tenant and Party shells are retained because the shared E2E DB has append-only timeline FK/RLS behavior.
  }

  async function assertNoHospitalityRowsRemain(): Promise<void> {
    const tableNames = [
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
      const result = await client.query<CountRow>(
        `SELECT COUNT(*)::int AS count FROM public.${tableName} WHERE tenant_id = ANY($1::uuid[])`,
        [[tenantAId, tenantBId]]
      );
      expect(result.rows[0]?.count).toBe(0);
    }
  }

  async function seedParty(tenantId: string, displayName: string): Promise<string> {
    const partyId = randomUUID();
    await client.query(
      `
        INSERT INTO public.party_parties (id, tenant_id, party_type, display_name)
        VALUES ($1::uuid, $2::uuid, 'person', $3)
      `,
      [partyId, tenantId, displayName]
    );
    return partyId;
  }

  async function createFoundation(label: string, tenantId = tenantAId): Promise<HospitalityPropertyRoomFoundation> {
    const suffix = `${Date.now()}-${label}`;
    return propertyService.createPropertyRoomFoundation({
      tenantId,
      property: {
        code: `PROP-${suffix}`,
        name: `Bella Hotel ${label}`,
        propertyType: 'hotel',
      },
      building: {
        code: `BLD-${label}`,
        name: `Tower ${label}`,
      },
      floor: {
        floorNumber: 1,
        code: `L1-${label}`,
        name: `Level 1 ${label}`,
      },
      roomType: {
        code: `RT-${label}`,
        name: `Room Type ${label}`,
        maxOccupancy: 2,
        baseAdults: 2,
      },
      room: {
        roomNumber: `10${label}`,
        displayName: `Room ${label}`,
      },
    });
  }

  it('persists Tenant -> Property -> Guest -> Reservation -> Reserved Room', async () => {
    const foundation = await createFoundation('A');
    const partyId = await seedParty(tenantAId, 'Phase2 Guest A');

    const chain = await reservationService.createGuestReservation({
      tenantId: tenantAId,
      propertyId: foundation.property.id,
      guest: {
        partyId,
        preferences: { pillow: 'soft' },
      },
      reservation: {
        reservationCode: `RSV-${Date.now()}-A`,
        checkInDate: '2026-11-01',
        checkOutDate: '2026-11-03',
        adults: 2,
      },
      reservedRoom: {
        roomTypeId: foundation.roomType.id,
        roomId: foundation.room.id,
      },
    });

    expect(chain.guest.partyId).toBe(partyId);
    expect(chain.reservation.guestId).toBe(chain.guest.id);
    expect(chain.reservedRoom.reservationId).toBe(chain.reservation.id);
    expect(chain.reservedRoom.roomId).toBe(foundation.room.id);

    const sameTenantReservation = await reservationService.getReservation(tenantAId, chain.reservation.id);
    const crossTenantReservation = await reservationService.getReservation(tenantBId, chain.reservation.id);
    const propertyReservations = await reservationService.listReservationsByProperty(
      tenantAId,
      foundation.property.id
    );

    expect(sameTenantReservation?.id).toBe(chain.reservation.id);
    expect(crossTenantReservation).toBeNull();
    expect(propertyReservations.map((reservation) => reservation.id)).toContain(chain.reservation.id);
  });

  it('rejects room/property mismatch and occupancy overflow through product-owned DB semantics', async () => {
    const foundationA = await createFoundation('B');
    const foundationB = await createFoundation('C');
    const partyId = await seedParty(tenantAId, 'Phase2 Guest B');
    const guest = await reservationService.createGuest({ tenantId: tenantAId, partyId });
    const reservation = await reservationService.createReservation({
      tenantId: tenantAId,
      propertyId: foundationA.property.id,
      guestId: guest.id,
      reservationCode: `RSV-${Date.now()}-B`,
      checkInDate: '2026-11-10',
      checkOutDate: '2026-11-12',
      adults: 2,
    });

    await expect(
      reservationService.createReservationRoom({
        tenantId: tenantAId,
        propertyId: foundationA.property.id,
        reservationId: reservation.id,
        roomTypeId: foundationA.roomType.id,
        roomId: foundationB.room.id,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        adults: 2,
      })
    ).rejects.toThrow('HOSPITALITY_RESERVATION_ROOM_PROPERTY_MISMATCH');

    await expect(
      reservationService.createReservationRoom({
        tenantId: tenantAId,
        propertyId: foundationA.property.id,
        reservationId: reservation.id,
        roomTypeId: foundationA.roomType.id,
        roomId: foundationA.room.id,
        checkInDate: reservation.checkInDate,
        checkOutDate: reservation.checkOutDate,
        adults: 3,
      })
    ).rejects.toThrow('HOSPITALITY_OCCUPANCY_EXCEEDS_ROOM_TYPE');
  });

  it('rejects overlapping reservation rows for the same room without creating a Resource kernel', async () => {
    const foundation = await createFoundation('D');
    const partyAId = await seedParty(tenantAId, 'Phase2 Guest C');
    const partyBId = await seedParty(tenantAId, 'Phase2 Guest D');

    await reservationService.createGuestReservation({
      tenantId: tenantAId,
      propertyId: foundation.property.id,
      guest: { partyId: partyAId },
      reservation: {
        reservationCode: `RSV-${Date.now()}-C`,
        checkInDate: '2026-12-01',
        checkOutDate: '2026-12-04',
        adults: 1,
      },
      reservedRoom: {
        roomTypeId: foundation.roomType.id,
        roomId: foundation.room.id,
      },
    });

    await expect(
      reservationService.createGuestReservation({
        tenantId: tenantAId,
        propertyId: foundation.property.id,
        guest: { partyId: partyBId },
        reservation: {
          reservationCode: `RSV-${Date.now()}-D`,
          checkInDate: '2026-12-03',
          checkOutDate: '2026-12-05',
          adults: 1,
        },
        reservedRoom: {
          roomTypeId: foundation.roomType.id,
          roomId: foundation.room.id,
        },
      })
    ).rejects.toThrow('HOSPITALITY_ROOM_ALREADY_RESERVED');
  });

  it('enforces RLS same-tenant visibility and cross-tenant invisibility', async () => {
    const foundation = await createFoundation('E');
    const partyId = await seedParty(tenantAId, 'Phase2 Guest E');
    const chain = await reservationService.createGuestReservation({
      tenantId: tenantAId,
      propertyId: foundation.property.id,
      guest: { partyId },
      reservation: {
        reservationCode: `RSV-${Date.now()}-E`,
        checkInDate: '2027-01-01',
        checkOutDate: '2027-01-02',
        adults: 1,
      },
      reservedRoom: {
        roomTypeId: foundation.roomType.id,
        roomId: foundation.room.id,
      },
    });

    const sameTenantRows = await queryAsTenant<ReservationVisibilityRow>(
      tenantAId,
      'SELECT id, tenant_id FROM public.hospitality_reservations WHERE id = $1',
      [chain.reservation.id]
    );
    const crossTenantRows = await queryAsTenant<ReservationVisibilityRow>(
      tenantBId,
      'SELECT id, tenant_id FROM public.hospitality_reservations WHERE id = $1',
      [chain.reservation.id]
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].tenant_id).toBe(tenantAId);
    expect(crossTenantRows).toHaveLength(0);
  });
});
