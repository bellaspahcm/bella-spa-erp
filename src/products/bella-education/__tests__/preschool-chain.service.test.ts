import type { SupabaseClient } from '@supabase/supabase-js';
import { PreschoolChainService } from '../services/preschool-chain.service';
import type { Database } from '@/types/database.types';
import type { IOrgUnitContract, OrgUnit } from '@/platform/org-unit';

type PreschoolChainClient = SupabaseClient<Database>;
type OrgUnitContractScope = Pick<IOrgUnitContract, 'getOrgUnit' | 'getOrgUnits'>;
type Row = Record<string, unknown>;
type Db = Record<string, Row[]>;
type QueryResult<T = unknown> = { data: T; error: { message: string } | null };

class FakeQueryBuilder implements PromiseLike<QueryResult<unknown>> {
  private readonly filters: Array<(row: Row) => boolean> = [];
  private upsertRow: Row | null = null;

  public constructor(
    private readonly db: Db,
    private readonly table: string,
  ) {}

  public select(): FakeQueryBuilder {
    return this;
  }

  public eq(column: string, value: unknown): FakeQueryBuilder {
    this.filters.push((row) => row[column] === value);
    return this;
  }

  public in(column: string, values: readonly unknown[]): FakeQueryBuilder {
    this.filters.push((row) => values.includes(row[column]));
    return this;
  }

  public upsert(row: Row): FakeQueryBuilder {
    this.upsertRow = row;
    return this;
  }

  public async maybeSingle(): Promise<QueryResult<Row | null>> {
    if (this.upsertRow) await this.executeUpsert();
    const [row] = this.filteredRows();
    return { data: row ?? null, error: null };
  }

  public async single(): Promise<QueryResult<Row | null>> {
    if (this.upsertRow) await this.executeUpsert();
    const [row] = this.filteredRows();
    return { data: row ?? null, error: null };
  }

  public then<TResult1 = QueryResult<unknown>, TResult2 = never>(
    onfulfilled?: ((value: QueryResult<unknown>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.executeUpsert().then(onfulfilled, onrejected);
  }

  private async executeUpsert(): Promise<QueryResult<unknown>> {
    if (!this.upsertRow) {
      return { data: this.filteredRows(), error: null };
    }

    const rows = this.db[this.table] ?? [];
    const uniqueColumns = this.table === 'preschool_chain_course_branch_assignments'
      ? ['tenant_id', 'course_id']
      : ['tenant_id', 'enrollment_id'];
    const existingIndex = rows.findIndex((row) => uniqueColumns.every((column) => row[column] === this.upsertRow?.[column]));
    if (existingIndex >= 0) {
      rows[existingIndex] = { ...rows[existingIndex], ...this.upsertRow };
    } else {
      rows.push({ id: `${this.table}-${rows.length + 1}`, created_at: '2026-10-06T00:00:00.000Z', ...this.upsertRow });
    }
    this.db[this.table] = rows;
    return { data: null, error: null };
  }

  private filteredRows(): Row[] {
    const rows = this.db[this.table] ?? [];
    return rows.filter((row) => this.filters.every((filter) => filter(row)));
  }
}

class FakeSupabaseClient {
  public constructor(private readonly db: Db) {}

  public from(table: string): FakeQueryBuilder {
    return new FakeQueryBuilder(this.db, table);
  }
}

function createOrgUnit(row: Row): OrgUnit {
  return {
    id: String(row.id),
    tenantId: String(row.tenant_id),
    unitType: row.unit_type as OrgUnit['unitType'],
    name: String(row.name ?? row.id),
    code: typeof row.code === 'string' ? row.code : undefined,
    parentId: typeof row.parent_id === 'string' ? row.parent_id : undefined,
    isActive: row.is_active === true,
    metadata: null,
    createdAt: new Date('2026-10-06T00:00:00.000Z'),
    updatedAt: new Date('2026-10-06T00:00:00.000Z'),
  };
}

function createOrgUnitContract(db: Db): OrgUnitContractScope {
  return {
    async getOrgUnit(id: string, tenantId: string) {
      const row = (db.org_units ?? []).find((unit) => unit.id === id && unit.tenant_id === tenantId);
      return row ? createOrgUnit(row) : null;
    },
    async getOrgUnits(filter) {
      return (db.org_units ?? [])
        .filter((unit) => unit.tenant_id === filter.tenantId)
        .filter((unit) => !filter.unitType || unit.unit_type === filter.unitType)
        .filter((unit) => filter.isActive === undefined || unit.is_active === filter.isActive)
        .map(createOrgUnit);
    },
  };
}

function createService(db: Db): PreschoolChainService {
  return new PreschoolChainService(
    new FakeSupabaseClient(db) as unknown as PreschoolChainClient,
    createOrgUnitContract(db),
  );
}

describe('PreschoolChainService', () => {
  const tenantId = 'tenant-a';
  const courseId = 'course-a';
  const enrollmentId = 'enrollment-a';
  const branchId = 'branch-a';
  const regionId = 'region-a';
  const actorUserId = 'user-a';

  function baseDb(): Db {
    return {
      org_units: [
        { id: regionId, tenant_id: tenantId, unit_type: 'region', name: 'Quận 1', is_active: true, parent_id: null },
        { id: branchId, tenant_id: tenantId, unit_type: 'branch', name: 'Bella Preschool Quận 1', code: 'Q1', is_active: true, parent_id: regionId },
      ],
      users: [{ id: actorUserId, tenant_id: tenantId, role: 'teacher' }],
      people_directory: [{ id: 'person-a', tenant_id: tenantId, user_id: actorUserId, is_active: true }],
      org_relationships: [{
        tenant_id: tenantId,
        from_id: 'person-a',
        from_type: 'person',
        to_id: regionId,
        to_type: 'unit',
        rel_type: 'manages',
        since: null,
        until: null,
      }],
      preschool_chain_course_branch_assignments: [],
      preschool_chain_enrollment_branch_assignments: [],
    };
  }

  it('persists course and enrollment branch assignments and reads back the chain', async () => {
    const db = baseDb();
    const service = createService(db);

    const assignment = await service.assignEnrollmentToBranch({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      actorUserId,
      requestId: '11111111-1111-4111-8111-111111111111',
    });

    expect(assignment).toEqual(expect.objectContaining({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      assignedBy: actorUserId,
    }));
    await expect(service.getEnrollmentChain(tenantId, enrollmentId)).resolves.toEqual(assignment);
    expect(db.preschool_chain_course_branch_assignments).toHaveLength(1);
    expect(db.preschool_chain_enrollment_branch_assignments).toHaveLength(1);
  });

  it('blocks branch assignment when the actor has no branch-chain access', async () => {
    const db = baseDb();
    db.org_relationships = [];
    const service = createService(db);

    await expect(service.assignEnrollmentToBranch({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      actorUserId,
      requestId: '22222222-2222-4222-8222-222222222222',
    })).rejects.toThrow('PRESCHOOL_CHAIN_BRANCH_ACCESS_DENIED');
  });

  it('blocks course reassignment to a different branch', async () => {
    const db = baseDb();
    db.org_units.push({ id: 'branch-b', tenant_id: tenantId, unit_type: 'branch', name: 'Bella Preschool Quận 3', is_active: true, parent_id: regionId });
    db.preschool_chain_course_branch_assignments.push({
      tenant_id: tenantId,
      course_id: courseId,
      branch_id: 'branch-b',
    });
    const service = createService(db);

    await expect(service.assignEnrollmentToBranch({
      tenantId,
      courseId,
      enrollmentId,
      branchId,
      actorUserId,
      requestId: '33333333-3333-4333-8333-333333333333',
    })).rejects.toThrow('PRESCHOOL_CHAIN_COURSE_BRANCH_CONFLICT');
  });

  it('lists only branch options accessible through the actor organization chain', async () => {
    const db = baseDb();
    db.org_units.push({ id: 'branch-b', tenant_id: tenantId, unit_type: 'branch', name: 'Bella Preschool Quận 3', code: 'Q3', is_active: true, parent_id: null });
    const service = createService(db);

    await expect(service.listAccessibleBranches(tenantId, actorUserId)).resolves.toEqual([
      { id: branchId, name: 'Bella Preschool Quận 1', code: 'Q1' },
    ]);
  });
});
