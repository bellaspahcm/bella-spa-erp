import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { HospitalityFrontOfficeStayRepository } from '../repositories/front-office-stay.repository';
import { HospitalityGuestReservationRepository } from '../repositories/guest-reservation.repository';
import { HospitalityHousekeepingRepository } from '../repositories/housekeeping.repository';
import { HospitalityPropertyRoomRepository, type HospitalitySqlClient } from '../repositories/property-room.repository';
import { HospitalityFrontOfficeStayService } from '../services/front-office-stay.service';
import { HospitalityGuestReservationService } from '../services/guest-reservation.service';
import { HospitalityHousekeepingService } from '../services/housekeeping.service';
import { HospitalityPropertyRoomService } from '../services/property-room.service';

jest.setTimeout(120_000);

const dbUrl =
  process.env.DATABASE_URL
  || process.env.SUPABASE_DATABASE_URL
  || process.env.SUPABASE_DB_URL
  || '';

type PgRows<Row extends Record<string, unknown>> = {
  readonly rows: Row[];
};

type ProofIds = {
  readonly tenantA: string;
  readonly tenantB: string;
  readonly partyA: string;
  readonly marker: string;
};

type HousekeepingReadbackRow = QueryResultRow & {
  readonly room_status: string;
  readonly task_status: string;
  readonly task_type: string;
  readonly target_room_status: string;
};

type CountRow = QueryResultRow & {
  readonly count: string | number;
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

describeWithRealDb('Hospitality Phase 6 Housekeeping Real DB proof', () => {
  let client: Client;
  let propertyService: HospitalityPropertyRoomService;
  let reservationService: HospitalityGuestReservationService;
  let frontOfficeService: HospitalityFrontOfficeStayService;
  let housekeepingService: HospitalityHousekeepingService;
  const ids = createProofIds();

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const sqlClient = new PgHospitalitySqlClient(client);

    propertyService = new HospitalityPropertyRoomService(new HospitalityPropertyRoomRepository(sqlClient));
    reservationService = new HospitalityGuestReservationService(new HospitalityGuestReservationRepository(sqlClient));
    frontOfficeService = new HospitalityFrontOfficeStayService(new HospitalityFrontOfficeStayRepository(sqlClient));
    housekeepingService = new HospitalityHousekeepingService(new HospitalityHousekeepingRepository(sqlClient));

    await cleanupHospitalityRows();
    await seedTenantAndPartyRows();
  });

  afterAll(async () => {
    if (!client) return;
    try {
      await cleanupHospitalityRows();
      await expectRemainingHospitalityRows(0);
    } finally {
      await client.end();
    }
  });

  it('opens checkout cleaning and completes it with tenant-isolated room status', async () => {
    const foundation = await propertyService.createPropertyRoomFoundation({
      tenantId: ids.tenantA,
      property: {
        code: `HK-${ids.marker}`,
        name: 'Housekeeping Proof Hotel',
        propertyType: 'hotel',
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
        code: 'STD',
        name: 'Standard King',
        maxOccupancy: 2,
        baseAdults: 2,
      },
      room: {
        roomNumber: `HK-${ids.marker}`,
      },
    });

    const guest = await reservationService.createGuest({
      tenantId: ids.tenantA,
      partyId: ids.partyA,
    });

    const reservation = await reservationService.createReservation({
      tenantId: ids.tenantA,
      propertyId: foundation.property.id,
      guestId: guest.id,
      reservationCode: `HK-RES-${ids.marker}`,
      checkInDate: '2027-12-01',
      checkOutDate: '2027-12-02',
      adults: 1,
    });

    const reservedRoom = await reservationService.createReservationRoom({
      tenantId: ids.tenantA,
      propertyId: foundation.property.id,
      reservationId: reservation.id,
      roomTypeId: foundation.roomType.id,
      roomId: foundation.room.id,
      checkInDate: reservation.checkInDate,
      checkOutDate: reservation.checkOutDate,
      adults: 1,
    });

    const checkIn = await frontOfficeService.checkIn({
      tenantId: ids.tenantA,
      propertyId: foundation.property.id,
      reservationId: reservation.id,
      guestId: guest.id,
      reservationRoomId: reservedRoom.id,
      roomId: foundation.room.id,
      checkedInAt: '2027-12-01T07:00:00.000Z',
    });

    const checkOut = await frontOfficeService.checkOut({
      tenantId: ids.tenantA,
      stayId: checkIn.stay.id,
      checkedOutAt: '2027-12-02T04:00:00.000Z',
    });

    expect(checkOut.stay.status).toBe('completed');
    expect(checkOut.occupancy.status).toBe('released');

    const opened = await housekeepingService.openCheckoutCleaningTask({
      tenantId: ids.tenantA,
      stayId: checkOut.stay.id,
      notes: 'Checkout handoff',
    });

    expect(opened.roomState.status).toBe('dirty');
    expect(opened.task.taskType).toBe('cleaning');
    expect(opened.task.targetRoomStatus).toBe('clean');

    const completed = await housekeepingService.completeTask({
      tenantId: ids.tenantA,
      taskId: opened.task.id,
      resultingRoomStatus: 'clean',
      completedAt: '2027-12-02T05:00:00.000Z',
    });

    expect(completed.task.status).toBe('completed');
    expect(completed.roomState.status).toBe('clean');

    const sameTenantRows = await queryAsTenant<HousekeepingReadbackRow>(
      ids.tenantA,
      `
        SELECT
          status_row.status AS room_status,
          task.status AS task_status,
          task.task_type,
          task.target_room_status
        FROM public.hospitality_room_housekeeping_statuses status_row
        JOIN public.hospitality_housekeeping_tasks task
          ON task.tenant_id = status_row.tenant_id
         AND task.property_id = status_row.property_id
         AND task.room_id = status_row.room_id
        WHERE status_row.room_id = $1::uuid
      `,
      [foundation.room.id]
    );

    const crossTenantRows = await queryAsTenant<HousekeepingReadbackRow>(
      ids.tenantB,
      `
        SELECT
          status_row.status AS room_status,
          task.status AS task_status,
          task.task_type,
          task.target_room_status
        FROM public.hospitality_room_housekeeping_statuses status_row
        JOIN public.hospitality_housekeeping_tasks task
          ON task.tenant_id = status_row.tenant_id
         AND task.property_id = status_row.property_id
         AND task.room_id = status_row.room_id
        WHERE status_row.room_id = $1::uuid
      `,
      [foundation.room.id]
    );
    const crossTenantMutationRows = await queryAsTenant<{ id: string }>(
      ids.tenantB,
      `
        UPDATE public.hospitality_room_housekeeping_statuses
        SET notes = 'cross tenant mutation denied'
        WHERE room_id = $1::uuid
        RETURNING id
      `,
      [foundation.room.id]
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].room_status).toBe('clean');
    expect(sameTenantRows[0].task_status).toBe('completed');
    expect(sameTenantRows[0].task_type).toBe('cleaning');
    expect(sameTenantRows[0].target_room_status).toBe('clean');
    expect(crossTenantRows).toHaveLength(0);
    expect(crossTenantMutationRows).toHaveLength(0);
  });

  async function seedTenantAndPartyRows(): Promise<void> {
    await client.query('SET row_security = off');
    await client.query(
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

    await client.query(
      `
        INSERT INTO public.party_parties (id, tenant_id, party_type, display_name)
        VALUES ($1::uuid, $2::uuid, 'person', $3)
      `,
      [ids.partyA, ids.tenantA, `${ids.marker} Guest`]
    );
  }

  async function cleanupHospitalityRows(): Promise<void> {
    await client.query('SET row_security = off');
    const tenantIds = [ids.tenantA, ids.tenantB];

    await client.query(
      'DELETE FROM public.hospitality_housekeeping_tasks WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_housekeeping_statuses WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_occupancies WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_stays WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_reservation_rooms WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_reservations WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_guests WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_rooms WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_types WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_floors WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_buildings WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_properties WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    // Tenant and Party shells are retained because shared E2E DB tenants/parties may have append-only timeline FK behavior.
  }

  async function expectRemainingHospitalityRows(expected: number): Promise<void> {
    const tableNames = [
      'hospitality_housekeeping_tasks',
      'hospitality_room_housekeeping_statuses',
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
        [[ids.tenantA, ids.tenantB]]
      );
      expect(toNumber(result.rows[0]?.count ?? 0)).toBe(expected);
    }
  }
});

async function queryAsTenant<Row extends QueryResultRow>(
  tenantId: string,
  sql: string,
  values?: readonly unknown[]
): Promise<Row[]> {
  const client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
  const userId = `hospitality-housekeeping-proof-${tenantId}`;
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

function createProofIds(): ProofIds {
  const marker = `hk-${Date.now()}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    partyA: randomUUID(),
    marker,
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}
