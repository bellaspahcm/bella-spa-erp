import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  normalizePreschoolGuardianPhone,
  PreschoolGuardianAuthorizationService,
} from '../services/preschool-guardian-authorization.service';

interface FakeParty {
  id: string;
  tenant_id: string;
  party_type: string;
  display_name: string;
  legal_name?: string;
}

interface FakeIdentifier {
  id: string;
  tenant_id: string;
  party_id: string;
  identifier_type: string;
  identifier_value: string;
}

interface FakeRelationship {
  id: string;
  tenant_id: string;
  source_party_id: string;
  target_party_id: string;
  relationship_type: string;
  attributes: Record<string, unknown>;
}

interface FakePickupAuthorization {
  id: string;
  tenant_id: string;
  student_party_id: string;
  guardian_party_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface FakeDb {
  party_parties: FakeParty[];
  party_identifiers: FakeIdentifier[];
  party_relationships: FakeRelationship[];
  edu_preschool_pickup_authorizations: FakePickupAuthorization[];
}

type FakeTableName = keyof FakeDb;
type FakeRow = FakeDb[FakeTableName][number];
type FakeResult<T> = Promise<{ data: T; error: null | { code?: string; message: string } }>;

class FakeQueryBuilder {
  private readonly filters = new Map<string, unknown>();
  private readonly inFilters = new Map<string, readonly unknown[]>();
  private insertedRow: Record<string, unknown> | null = null;

  constructor(
    private readonly db: FakeDb,
    private readonly table: FakeTableName,
  ) {}

  select(): FakeQueryBuilder {
    return this;
  }

  eq(column: string, value: unknown): FakeQueryBuilder {
    this.filters.set(column, value);
    return this;
  }

  in(column: string, values: readonly unknown[]): FakeQueryBuilder {
    this.inFilters.set(column, values);
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

  then<TResult1 = { data: FakeRow | FakeRow[]; error: null | { code?: string; message: string } }, TResult2 = never>(
    onfulfilled?: ((value: { data: FakeRow | FakeRow[]; error: null | { code?: string; message: string } }) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    const result = this.insertedRow
      ? this.insertAndReturn()
      : Promise.resolve({ data: this.matchRows(), error: null });

    return result.then(onfulfilled, onrejected);
  }

  private matchRows(): FakeRow[] {
    return this.tableRows().filter((row) => {
      const record = row as Record<string, unknown>;
      for (const [column, value] of this.filters) {
        if (record[column] !== value) return false;
      }
      for (const [column, values] of this.inFilters) {
        if (!values.includes(record[column])) return false;
      }
      return true;
    });
  }

  private tableRows(): FakeRow[] {
    return this.db[this.table] as FakeRow[];
  }

  private async insertAndReturn(): FakeResult<FakeRow> {
    const row = this.insertedRow ?? {};
    if (this.table === 'party_identifiers') {
      const duplicate = this.db.party_identifiers.some((identifier) => (
        identifier.tenant_id === row.tenant_id
        && identifier.identifier_type === row.identifier_type
        && identifier.identifier_value === row.identifier_value
      ));
      if (duplicate) {
        return { data: null as unknown as FakeRow, error: { code: '23505', message: 'duplicate identifier' } };
      }
    }

    if (this.table === 'party_relationships') {
      const duplicate = this.db.party_relationships.some((relationship) => (
        relationship.tenant_id === row.tenant_id
        && relationship.source_party_id === row.source_party_id
        && relationship.target_party_id === row.target_party_id
        && relationship.relationship_type === row.relationship_type
      ));
      if (duplicate) {
        return { data: null as unknown as FakeRow, error: { code: '23505', message: 'duplicate relationship' } };
      }
    }

    if (this.table === 'edu_preschool_pickup_authorizations') {
      const duplicate = this.db.edu_preschool_pickup_authorizations.some((authorization) => (
        authorization.tenant_id === row.tenant_id
        && authorization.student_party_id === row.student_party_id
        && authorization.guardian_party_id === row.guardian_party_id
        && authorization.status === 'authorized'
      ));
      if (duplicate) {
        return { data: null as unknown as FakeRow, error: { code: '23505', message: 'duplicate authorization' } };
      }
    }

    const now = '2026-09-27T00:00:00.000Z';
    const persisted = {
      id: typeof row.id === 'string' ? row.id : `${this.table}-${this.tableRows().length + 1}`,
      created_at: now,
      updated_at: now,
      ...row,
    } as FakeRow;

    this.tableRows().push(persisted);
    return { data: persisted, error: null };
  }
}

class FakeSupabase {
  readonly db: FakeDb = {
    party_parties: [],
    party_identifiers: [],
    party_relationships: [],
    edu_preschool_pickup_authorizations: [],
  };

  from(table: FakeTableName): FakeQueryBuilder {
    return new FakeQueryBuilder(this.db, table);
  }
}

function createService(fake: FakeSupabase): PreschoolGuardianAuthorizationService {
  return new PreschoolGuardianAuthorizationService(fake as unknown as SupabaseClient<Database>);
}

describe('PreschoolGuardianAuthorizationService', () => {
  it('normalizes guardian phone deterministically for the bounded Preschool flow', () => {
    expect(normalizePreschoolGuardianPhone('+84 909 000 000')).toBe('0909000000');
    expect(normalizePreschoolGuardianPhone('0909-000-000')).toBe('0909000000');
  });

  it('creates a guardian Party, guardian_of relationship, and pickup authorization once', async () => {
    const fake = new FakeSupabase();
    const service = createService(fake);
    const tenantId = 'tenant-a';
    const studentPartyId = 'student-party-a';

    fake.db.party_parties.push({
      id: studentPartyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: 'Student A',
    });

    const first = await service.establishForEnrollment({
      tenantId,
      studentPartyId,
      guardianName: 'Guardian A',
      guardianPhone: '+84 909 000 000',
      actorId: 'actor-a',
    });
    const second = await service.establishForEnrollment({
      tenantId,
      studentPartyId,
      guardianName: 'Guardian A',
      guardianPhone: '0909000000',
      actorId: 'actor-a',
    });

    expect(second.guardianPartyId).toBe(first.guardianPartyId);
    expect(fake.db.party_parties.filter((party) => party.display_name === 'Guardian A')).toHaveLength(1);
    expect(fake.db.party_identifiers).toHaveLength(1);
    expect(fake.db.party_relationships).toHaveLength(1);
    expect(fake.db.edu_preschool_pickup_authorizations).toHaveLength(1);

    const guardians = await service.getAuthorizedGuardians(tenantId, [studentPartyId]);
    expect(guardians.get(studentPartyId)).toEqual([
      expect.objectContaining({
        guardianPartyId: first.guardianPartyId,
        displayName: 'Guardian A',
        phone: '0909000000',
        status: 'authorized',
      }),
    ]);
  });

  it('does not reuse a guardian Party across tenants for the same phone', async () => {
    const fake = new FakeSupabase();
    const service = createService(fake);

    const first = await service.establishForEnrollment({
      tenantId: 'tenant-a',
      studentPartyId: 'student-party-a',
      guardianName: 'Guardian A',
      guardianPhone: '0909000000',
      actorId: 'actor-a',
    });
    const second = await service.establishForEnrollment({
      tenantId: 'tenant-b',
      studentPartyId: 'student-party-b',
      guardianName: 'Guardian B',
      guardianPhone: '0909000000',
      actorId: 'actor-b',
    });

    expect(second.guardianPartyId).not.toBe(first.guardianPartyId);
    expect(fake.db.party_identifiers).toHaveLength(2);
  });
});
