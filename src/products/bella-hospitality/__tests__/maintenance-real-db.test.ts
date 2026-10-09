import { randomUUID } from 'crypto';

import { describe, expect, it, beforeAll, afterAll } from '@jest/globals';
import { Client, type QueryResultRow } from 'pg';

import { HospitalityMaintenanceRepository } from '../repositories/maintenance.repository';
import { HospitalityPropertyRoomRepository, type HospitalitySqlClient } from '../repositories/property-room.repository';
import { HospitalityMaintenanceService } from '../services/maintenance.service';
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
  readonly userA: string;
  readonly userB: string;
  readonly marker: string;
};

type MaintenanceReadbackRow = QueryResultRow & {
  readonly request_status: string;
  readonly priority: string;
  readonly assigned_to_user_id: string | null;
  readonly room_status: string;
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

describeWithRealDb('Hospitality Phase 7 Maintenance Real DB proof', () => {
  let client: Client;
  let propertyService: HospitalityPropertyRoomService;
  let maintenanceService: HospitalityMaintenanceService;
  const ids = createProofIds();

  beforeAll(async () => {
    client = new Client({ connectionString: dbUrl, ssl: sslConfig() });
    await client.connect();
    const sqlClient = new PgHospitalitySqlClient(client);

    propertyService = new HospitalityPropertyRoomService(new HospitalityPropertyRoomRepository(sqlClient));
    maintenanceService = new HospitalityMaintenanceService(new HospitalityMaintenanceRepository(sqlClient));

    await cleanupHospitalityRows();
    await seedTenantAndUserRows();
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

  it('runs room maintenance with tenant-isolated request and Housekeeping room state', async () => {
    const foundation = await propertyService.createPropertyRoomFoundation({
      tenantId: ids.tenantA,
      property: {
        code: `MT-${ids.marker}`,
        name: 'Maintenance Proof Hotel',
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
        roomNumber: `MT-${ids.marker}`,
      },
    });

    const reported = await maintenanceService.reportRoomMaintenance({
      tenantId: ids.tenantA,
      propertyId: foundation.property.id,
      roomId: foundation.room.id,
      title: 'Bathroom exhaust fan repair',
      description: 'Guest reported fan noise before checkout',
      issueType: 'repair',
      priority: 'high',
      reportedByUserId: ids.userA,
      reportedAt: '2027-12-03T03:00:00.000Z',
    });

    expect(reported.request.status).toBe('reported');
    expect(reported.roomState.status).toBe('out_of_order');

    const assigned = await maintenanceService.assignRequest({
      tenantId: ids.tenantA,
      requestId: reported.request.id,
      assignedToUserId: ids.userA,
      assignedAt: '2027-12-03T03:15:00.000Z',
    });
    const started = await maintenanceService.startRequest({
      tenantId: ids.tenantA,
      requestId: reported.request.id,
      startedAt: '2027-12-03T03:30:00.000Z',
    });
    const completed = await maintenanceService.completeRequest({
      tenantId: ids.tenantA,
      requestId: reported.request.id,
      completedAt: '2027-12-03T04:00:00.000Z',
      completionNotes: 'Fan replaced; housekeeping inspection required',
    });

    expect(assigned.status).toBe('assigned');
    expect(started.status).toBe('in_progress');
    expect(completed.request.status).toBe('completed');
    expect(completed.roomState.status).toBe('dirty');

    const sameTenantRows = await queryAsTenant<MaintenanceReadbackRow>(
      ids.userA,
      ids.tenantA,
      `
        SELECT
          request.status AS request_status,
          request.priority,
          request.assigned_to_user_id::text,
          room_status.status AS room_status
        FROM public.hospitality_maintenance_requests request
        JOIN public.hospitality_room_housekeeping_statuses room_status
          ON room_status.tenant_id = request.tenant_id
         AND room_status.property_id = request.property_id
         AND room_status.room_id = request.room_id
        WHERE request.id = $1::uuid
      `,
      [reported.request.id]
    );

    const crossTenantRows = await queryAsTenant<MaintenanceReadbackRow>(
      ids.userB,
      ids.tenantB,
      `
        SELECT
          request.status AS request_status,
          request.priority,
          request.assigned_to_user_id::text,
          room_status.status AS room_status
        FROM public.hospitality_maintenance_requests request
        JOIN public.hospitality_room_housekeeping_statuses room_status
          ON room_status.tenant_id = request.tenant_id
         AND room_status.property_id = request.property_id
         AND room_status.room_id = request.room_id
        WHERE request.id = $1::uuid
      `,
      [reported.request.id]
    );

    const crossTenantMutationRows = await queryAsTenant<{ id: string }>(
      ids.userB,
      ids.tenantB,
      `
        UPDATE public.hospitality_maintenance_requests
        SET completion_notes = 'cross tenant mutation denied'
        WHERE id = $1::uuid
        RETURNING id
      `,
      [reported.request.id]
    );

    expect(sameTenantRows).toHaveLength(1);
    expect(sameTenantRows[0].request_status).toBe('completed');
    expect(sameTenantRows[0].priority).toBe('high');
    expect(sameTenantRows[0].assigned_to_user_id).toBe(ids.userA);
    expect(sameTenantRows[0].room_status).toBe('dirty');
    expect(crossTenantRows).toHaveLength(0);
    expect(crossTenantMutationRows).toHaveLength(0);
  });

  async function seedTenantAndUserRows(): Promise<void> {
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
  }

  async function cleanupHospitalityRows(): Promise<void> {
    await client.query('SET row_security = off');
    const tenantIds = [ids.tenantA, ids.tenantB];

    await client.query(
      'DELETE FROM public.hospitality_maintenance_requests WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_housekeeping_tasks WHERE tenant_id = ANY($1::uuid[])',
      [tenantIds]
    );
    await client.query(
      'DELETE FROM public.hospitality_room_housekeeping_statuses WHERE tenant_id = ANY($1::uuid[])',
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
    // Tenant and user shells are retained because shared E2E DB identity rows may be append-only elsewhere.
  }

  async function expectRemainingHospitalityRows(expected: number): Promise<void> {
    const tableNames = [
      'hospitality_maintenance_requests',
      'hospitality_housekeeping_tasks',
      'hospitality_room_housekeeping_statuses',
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
  userId: string,
  tenantId: string,
  sql: string,
  values?: readonly unknown[]
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
  const marker = `mt-${Date.now()}`;

  return {
    tenantA: randomUUID(),
    tenantB: randomUUID(),
    userA: randomUUID(),
    userB: randomUUID(),
    marker,
  };
}

function toNumber(value: string | number): number {
  return typeof value === 'number' ? value : Number(value);
}
