import type { SupabaseClient } from '@supabase/supabase-js';
import {
  PreschoolSafePickupHandoverService,
} from '../services/preschool-safe-pickup-handover.service';

interface FakeParty {
  id: string;
  tenant_id: string;
}

interface FakePickupAuthorization {
  id: string;
  tenant_id: string;
  student_party_id: string;
  guardian_party_id: string;
  status: string;
}

interface FakeHandoverEvent {
  id: string;
  tenant_id: string;
  student_party_id: string;
  guardian_party_id: string;
  pickup_authorization_id: string;
  handed_over_at: string;
  handed_over_by: string;
  created_at: string;
}

interface FakeDb {
  party_parties: FakeParty[];
  edu_preschool_pickup_authorizations: FakePickupAuthorization[];
  edu_preschool_pickup_handover_events: FakeHandoverEvent[];
}

type FakeRow = FakeParty | FakePickupAuthorization | FakeHandoverEvent;
type FakeResult<T> = Promise<{ data: T; error: null | { code?: string; message: string } }>;

class FakeQueryBuilder {
  private readonly filters = new Map<string, unknown>();
  private readonly gteFilters = new Map<string, string>();
  private readonly ltFilters = new Map<string, string>();
  private readonly inFilters = new Map<string, readonly unknown[]>();
  private insertedRow: Record<string, unknown> | null = null;
  private orderColumn: string | null = null;
  private orderAscending = true;
  private maxRows: number | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: keyof FakeDb,
  ) {}

  select(): FakeQueryBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.filters.set(column, value);
    return this;
  }

  gte(column: string, value: string): FakeQueryBuilder {
    this.gteFilters.set(column, value);
    return this;
  }

  lt(column: string, value: string): FakeQueryBuilder {
    this.ltFilters.set(column, value);
    return this;
  }

  in(column: string, values: readonly unknown[]): FakeQueryBuilder {
    this.inFilters.set(column, values);
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): FakeQueryBuilder {
    this.orderColumn = column;
    this.orderAscending = options?.ascending ?? true;
    return this;
  }

  limit(count: number): FakeQueryBuilder {
    this.maxRows = count;
    return this;
  }

  insert(row: Record<string, unknown>): FakeQueryBuilder {
    this.insertedRow = row;
    return this;
  }

  async maybeSingle(): FakeResult<FakeRow | null> {
    return { data: this.matchRows()[0] ?? null, error: null };
  }

  async single(): FakeResult<FakeRow> {
    if (this.insertedRow) {
      return this.insertAndReturn();
    }

    const row = this.matchRows()[0];
    if (!row) {
      return { data: null as unknown as FakeRow, error: { message: 'No rows found' } };
    }

    return { data: row, error: null };
  }

  then<TResult1 = { data: FakeRow[]; error: null }, TResult2 = never>(
    onfulfilled?: ((value: { data: FakeRow[]; error: null }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve({ data: this.matchRows(), error: null }).then(onfulfilled, onrejected);
  }

  private matchRows(): FakeRow[] {
    let rows = this.tableRows().filter((row) => {
      const record = row as Record<string, unknown>;
      for (const [column, value] of this.filters) {
        if (record[column] !== value) return false;
      }
      for (const [column, value] of this.gteFilters) {
        if (typeof record[column] !== 'string' || record[column] < value) return false;
      }
      for (const [column, value] of this.ltFilters) {
        if (typeof record[column] !== 'string' || record[column] >= value) return false;
      }
      for (const [column, values] of this.inFilters) {
        if (!values.includes(record[column])) return false;
      }
      return true;
    });

    if (this.orderColumn) {
      const column = this.orderColumn;
      const direction = this.orderAscending ? 1 : -1;
      rows = [...rows].sort((left, right) => {
        const leftValue = String((left as Record<string, unknown>)[column] ?? '');
        const rightValue = String((right as Record<string, unknown>)[column] ?? '');
        return leftValue.localeCompare(rightValue) * direction;
      });
    }

    return this.maxRows === null ? rows : rows.slice(0, this.maxRows);
  }

  private tableRows(): FakeRow[] {
    return this.db[this.table] as FakeRow[];
  }

  private async insertAndReturn(): FakeResult<FakeRow> {
    const row = this.insertedRow ?? {};
    const now = new Date().toISOString();
    const persisted = {
      id: typeof row.id === 'string' ? row.id : `${this.table}-${this.tableRows().length + 1}`,
      handed_over_at: now,
      created_at: now,
      ...row,
    } as FakeRow;

    this.tableRows().push(persisted);
    return { data: persisted, error: null };
  }
}

class FakeSupabase {
  readonly db: FakeDb = {
    party_parties: [],
    edu_preschool_pickup_authorizations: [],
    edu_preschool_pickup_handover_events: [],
  };

  from(table: keyof FakeDb): FakeQueryBuilder {
    return new FakeQueryBuilder(this.db, table);
  }
}

function createService(fake: FakeSupabase): PreschoolSafePickupHandoverService {
  return new PreschoolSafePickupHandoverService(fake as unknown as SupabaseClient);
}

function seedAuthorizedFixture(fake: FakeSupabase) {
  fake.db.party_parties.push(
    { id: 'student-party-a', tenant_id: 'tenant-a' },
    { id: 'guardian-party-a', tenant_id: 'tenant-a' },
    { id: 'student-party-b', tenant_id: 'tenant-b' },
    { id: 'guardian-party-b', tenant_id: 'tenant-b' },
  );
  fake.db.edu_preschool_pickup_authorizations.push({
    id: 'authorization-a',
    tenant_id: 'tenant-a',
    student_party_id: 'student-party-a',
    guardian_party_id: 'guardian-party-a',
    status: 'authorized',
  });
}

describe('PreschoolSafePickupHandoverService', () => {
  it('creates a handover event for an active authorized guardian', async () => {
    const fake = new FakeSupabase();
    seedAuthorizedFixture(fake);
    const service = createService(fake);

    const handover = await service.recordHandover({
      tenantId: 'tenant-a',
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId: 'operator-a',
    });

    expect(handover).toEqual(expect.objectContaining({
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      handedOverBy: 'operator-a',
    }));
    expect(fake.db.edu_preschool_pickup_handover_events).toHaveLength(1);
  });

  it('returns the persisted event through read-back by student Party', async () => {
    const fake = new FakeSupabase();
    seedAuthorizedFixture(fake);
    const service = createService(fake);

    const handover = await service.recordHandover({
      tenantId: 'tenant-a',
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId: 'operator-a',
    });

    const handovers = await service.getLatestHandovers('tenant-a', ['student-party-a']);
    expect(handovers.get('student-party-a')).toEqual(handover);
  });

  it('does not create a duplicate same-day handover for repeated submission', async () => {
    const fake = new FakeSupabase();
    seedAuthorizedFixture(fake);
    const service = createService(fake);

    const input = {
      tenantId: 'tenant-a',
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId: 'operator-a',
    };

    const first = await service.recordHandover(input);
    const second = await service.recordHandover(input);

    expect(second.id).toBe(first.id);
    expect(fake.db.edu_preschool_pickup_handover_events).toHaveLength(1);
  });

  it('rejects revoked or missing authorization without creating a handover', async () => {
    const fake = new FakeSupabase();
    seedAuthorizedFixture(fake);
    fake.db.edu_preschool_pickup_authorizations[0].status = 'revoked';
    const service = createService(fake);

    await expect(service.recordHandover({
      tenantId: 'tenant-a',
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId: 'operator-a',
    })).rejects.toThrow('ACTIVE_PICKUP_AUTHORIZATION_NOT_FOUND');
    expect(fake.db.edu_preschool_pickup_handover_events).toHaveLength(0);
  });

  it('rejects guardian/student mismatch without creating a handover', async () => {
    const fake = new FakeSupabase();
    seedAuthorizedFixture(fake);
    fake.db.party_parties.push({ id: 'guardian-party-c', tenant_id: 'tenant-a' });
    const service = createService(fake);

    await expect(service.recordHandover({
      tenantId: 'tenant-a',
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-c',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId: 'operator-a',
    })).rejects.toThrow('ACTIVE_PICKUP_AUTHORIZATION_NOT_FOUND');
    expect(fake.db.edu_preschool_pickup_handover_events).toHaveLength(0);
  });

  it('rejects cross-tenant attempts before creating a handover', async () => {
    const fake = new FakeSupabase();
    seedAuthorizedFixture(fake);
    const service = createService(fake);

    await expect(service.recordHandover({
      tenantId: 'tenant-b',
      studentPartyId: 'student-party-a',
      guardianPartyId: 'guardian-party-a',
      pickupAuthorizationId: 'authorization-a',
      operatorUserId: 'operator-b',
    })).rejects.toThrow('STUDENT_PARTY_NOT_FOUND_FOR_TENANT');
    expect(fake.db.edu_preschool_pickup_handover_events).toHaveLength(0);
  });
});
