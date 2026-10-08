import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { HospitalityPropertyRoomRepository, type HospitalitySqlClient } from '../repositories/property-room.repository';
import { HospitalityGuestReservationRepository } from '../repositories/guest-reservation.repository';
import { HospitalityFrontOfficeStayRepository } from '../repositories/front-office-stay.repository';
import { HospitalityPropertyRoomService } from '../services/property-room.service';
import { HospitalityGuestReservationService } from '../services/guest-reservation.service';
import { HospitalityFrontOfficeStayService } from '../services/front-office-stay.service';
import type { HospitalityPropertyRoomFoundation } from '../types/property-room.types';
import type { HospitalityGuestReservation } from '../types/guest-reservation.types';
import type { HospitalityFrontOfficeStay } from '../types/front-office-stay.types';

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

type StayVisibilityRow = {
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

describeWithRealDb('Hospitality Phase 3 Front Office / Stay Real DB proof', () => {
  let client: Client;
  let propertyService: HospitalityPropertyRoomService;
  let reservationService: HospitalityGuestReservationService;
  let frontOfficeService: HospitalityFrontOfficeStayService;
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
    frontOfficeService = new HospitalityFrontOfficeStayService(
      new HospitalityFrontOfficeStayRepository(sqlClient)
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
        `Hospitality Phase3 Tenant A ${Date.now()}`,
        tenantBId,
        `Hospitality Phase3 Tenant B ${Date.now()}`,
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
      'DELETE FROM public.hospitality_room_occupancies WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
    await client.query(
      'DELETE FROM public.hospitality_stays WHERE tenant_id = ANY($1::uuid[])',
      [[tenantAId, tenantBId]]
    );
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

  async function createFoundation(label: string): Promise<HospitalityPropertyRoomFoundation> {
    const suffix = `${Date.now()}-${label}`;
    return propertyService.createPropertyRoomFoundation({
      tenantId: tenantAId,
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
        roomNumber: `30${label}`,
        displayName: `Room ${label}`,
      },
    });
  }

  async function createReservationChain(
    label: string,
    foundation: HospitalityPropertyRoomFoundation,
    checkInDate: string,
    checkOutDate: string
  ): Promise<HospitalityGuestReservation> {
    const partyId = await seedParty(tenantAId, `Phase3 Guest ${label}`);
    return reservationService.createGuestReservation({
      tenantId: tenantAId,
      propertyId: foundation.property.id,
      guest: { partyId },
      reservation: {
        reservationCode: `RSV-${Date.now()}-${label}`,
        checkInDate,
        checkOutDate,
        adults: 1,
      },
      reservedRoom: {
        roomTypeId: foundation.roomType.id,
        roomId: foundation.room.id,
      },
    });
  }

  async function checkInReservation(
    reservationChain: HospitalityGuestReservation
  ): Promise<HospitalityFrontOfficeStay> {
    return frontOfficeService.checkIn({
      tenantId: tenantAId,
      propertyId: reservationChain.reservation.propertyId,
      reservationId: reservationChain.reservation.id,
      guestId: reservationChain.guest.id,
      reservationRoomId: reservationChain.reservedRoom.id,
      roomId: reservationChain.reservedRoom.roomId,
      checkedInAt: `${reservationChain.reservation.checkInDate}T08:00:00.000Z`,
    });
  }

  it('checks in a reserved room into an active stay and room occupancy', async () => {
    const foundation = await createFoundation('A');
    const reservationChain = await createReservationChain('A', foundation, '2027-02-01', '2027-02-03');

    const frontOffice = await checkInReservation(reservationChain);

    expect(frontOffice.stay.tenantId).toBe(tenantAId);
    expect(frontOffice.stay.reservationId).toBe(reservationChain.reservation.id);
    expect(frontOffice.stay.guestId).toBe(reservationChain.guest.id);
    expect(frontOffice.stay.status).toBe('active');
    expect(frontOffice.occupancy.stayId).toBe(frontOffice.stay.id);
    expect(frontOffice.occupancy.reservationRoomId).toBe(reservationChain.reservedRoom.id);
    expect(frontOffice.occupancy.roomId).toBe(foundation.room.id);
    expect(frontOffice.occupancy.status).toBe('occupied');
  });

  it('checks out an active stay and releases room occupancy', async () => {
    const foundation = await createFoundation('B');
    const reservationChain = await createReservationChain('B', foundation, '2027-03-01', '2027-03-04');
    const frontOffice = await checkInReservation(reservationChain);

    const checkedOut = await frontOfficeService.checkOut({
      tenantId: tenantAId,
      stayId: frontOffice.stay.id,
      checkedOutAt: '2027-03-04T03:00:00.000Z',
    });

    expect(checkedOut.stay.status).toBe('completed');
    expect(checkedOut.stay.checkedOutAt).toBe('2027-03-04T03:00:00.000Z');
    expect(checkedOut.occupancy.status).toBe('released');
    expect(checkedOut.occupancy.releasedAt).toBe('2027-03-04T03:00:00.000Z');
  });

  it('rejects active room occupancy conflict and rolls back the attempted stay', async () => {
    const foundation = await createFoundation('C');
    const firstReservation = await createReservationChain('C1', foundation, '2027-04-01', '2027-04-03');
    const secondReservation = await createReservationChain('C2', foundation, '2027-04-04', '2027-04-06');

    await checkInReservation(firstReservation);

    await expect(checkInReservation(secondReservation)).rejects.toThrow();

    const failedStayCount = await client.query<CountRow>(
      `
        SELECT COUNT(*)::int AS count
        FROM public.hospitality_stays
        WHERE tenant_id = $1::uuid
          AND reservation_id = $2::uuid
      `,
      [tenantAId, secondReservation.reservation.id]
    );
    expect(failedStayCount.rows[0]?.count).toBe(0);
  });

  it('enforces RLS same-tenant visibility and cross-tenant invisibility for stays', async () => {
    const foundation = await createFoundation('D');
    const reservationChain = await createReservationChain('D', foundation, '2027-05-01', '2027-05-02');
    const frontOffice = await checkInReservation(reservationChain);

    const sameTenantRows = await queryAsTenant<StayVisibilityRow>(
      tenantAId,
      'SELECT id, tenant_id FROM public.hospitality_stays WHERE id = $1',
      [frontOffice.stay.id]
    );
    const crossTenantRows = await queryAsTenant<StayVisibilityRow>(
      tenantBId,
      'SELECT id, tenant_id FROM public.hospitality_stays WHERE id = $1',
      [frontOffice.stay.id]
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].tenant_id).toBe(tenantAId);
    expect(crossTenantRows).toHaveLength(0);
  });
});
