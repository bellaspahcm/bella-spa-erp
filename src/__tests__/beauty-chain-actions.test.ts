import {
  assignBeautyStaffToBranch,
  createBeautyBranch,
  createBeautyCompany,
  getBeautyChainSnapshot,
} from '../services/beauty-chain-actions';

const mockGetCurrentUser = jest.fn();
const mockCreateClient = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

jest.mock('../lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

type ScriptedResult = {
  table: string;
  op: 'select' | 'insert' | 'update';
  data?: unknown;
  error?: { message: string };
};

type DbCall = {
  table: string;
  op: ScriptedResult['op'];
  payload?: unknown;
  filters: Array<{ field: string; value: unknown; op: 'eq' | 'neq' | 'in' }>;
};

class ScriptedQueryBuilder {
  private op: ScriptedResult['op'] | null = null;

  constructor(
    private readonly table: string,
    private readonly scripts: ScriptedResult[],
    private readonly calls: DbCall[],
  ) {}

  select() {
    this.ensureCall('select');
    return this;
  }

  insert(payload: unknown) {
    this.ensureCall('insert', payload);
    return this;
  }

  update(payload: unknown) {
    this.ensureCall('update', payload);
    return this;
  }

  eq(field: string, value: unknown) {
    this.calls.at(-1)?.filters.push({ field, value, op: 'eq' });
    return this;
  }

  neq(field: string, value: unknown) {
    this.calls.at(-1)?.filters.push({ field, value, op: 'neq' });
    return this;
  }

  in(field: string, value: unknown[]) {
    this.calls.at(-1)?.filters.push({ field, value, op: 'in' });
    return this;
  }

  order() {
    return this;
  }

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then(onfulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
    return this.resolve().then(onfulfilled);
  }

  private ensureCall(op: ScriptedResult['op'], payload?: unknown) {
    if (!this.op) {
      this.op = op;
      this.calls.push({ table: this.table, op, payload, filters: [] });
    }
  }

  private resolve() {
    const expected = this.scripts.shift();
    if (!expected) {
      throw new Error(`No scripted result for ${this.table}.${this.op ?? 'unknown'}`);
    }
    if (expected.table !== this.table || expected.op !== this.op) {
      throw new Error(`Expected ${expected.table}.${expected.op}, got ${this.table}.${this.op ?? 'unknown'}`);
    }
    return Promise.resolve({ data: expected.data ?? null, error: expected.error ?? null });
  }
}

function installSupabase(scripts: ScriptedResult[]) {
  const calls: DbCall[] = [];
  mockCreateClient.mockResolvedValue({
    from: (table: string) => new ScriptedQueryBuilder(table, scripts, calls),
  });
  return calls;
}

function installAdminUser() {
  mockGetCurrentUser.mockResolvedValue({
    id: 'admin-user',
    tenant_id: 'tenant-a',
    role: 'admin',
    email: 'admin@bella.test',
    full_name: 'Admin',
  });
}

describe('beauty chain actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installAdminUser();
  });

  it('creates one company inside the current tenant', async () => {
    const calls = installSupabase([
      { table: 'org_units', op: 'select', data: null },
      {
        table: 'org_units',
        op: 'insert',
        data: {
          id: 'company-a',
          tenant_id: 'tenant-a',
          unit_type: 'company',
          name: 'Bella Beauty',
          code: 'BELLA',
          parent_id: null,
          is_active: true,
          metadata: {},
        },
      },
    ]);

    const result = await createBeautyCompany({ name: 'Bella Beauty', code: 'BELLA' });

    expect(result).toEqual({
      success: true,
      data: { id: 'company-a', name: 'Bella Beauty', code: 'BELLA' },
    });
    expect(calls[1].payload).toMatchObject({
      tenant_id: 'tenant-a',
      unit_type: 'company',
      name: 'Bella Beauty',
      code: 'BELLA',
    });
  });

  it('creates a branch only under a same-tenant company', async () => {
    const calls = installSupabase([
      { table: 'org_units', op: 'select', data: { id: 'company-a', tenant_id: 'tenant-a', unit_type: 'company', is_active: true } },
      {
        table: 'org_units',
        op: 'insert',
        data: {
          id: 'branch-a',
          tenant_id: 'tenant-a',
          unit_type: 'branch',
          name: 'Quận 1',
          code: 'Q1',
          parent_id: 'company-a',
          is_active: true,
          metadata: {},
        },
      },
    ]);

    const result = await createBeautyBranch({ companyId: 'company-a', name: 'Quận 1', code: 'Q1' });

    expect(result).toEqual({
      success: true,
      data: { id: 'branch-a', name: 'Quận 1', code: 'Q1', companyId: 'company-a', staffCount: 0 },
    });
    expect(calls[0].filters).toEqual(expect.arrayContaining([
      { field: 'id', value: 'company-a', op: 'eq' },
      { field: 'tenant_id', value: 'tenant-a', op: 'eq' },
      { field: 'unit_type', value: 'company', op: 'eq' },
    ]));
    expect(calls[1].payload).toMatchObject({
      tenant_id: 'tenant-a',
      unit_type: 'branch',
      parent_id: 'company-a',
    });
  });

  it('registers a staff person and assigns the staff to a same-tenant branch', async () => {
    const calls = installSupabase([
      {
        table: 'users',
        op: 'select',
        data: { id: 'staff-a', tenant_id: 'tenant-a', email: 'staff@bella.test', full_name: 'Nguyen A', role: 'ktv', status: 'active' },
      },
      {
        table: 'org_units',
        op: 'select',
        data: { id: 'branch-a', tenant_id: 'tenant-a', unit_type: 'branch', name: 'Quận 1', code: 'Q1', parent_id: 'company-a', is_active: true, metadata: {} },
      },
      { table: 'people_directory', op: 'select', data: null },
      {
        table: 'people_directory',
        op: 'insert',
        data: { id: 'person-a', tenant_id: 'tenant-a', user_id: 'staff-a', display_name: 'Nguyen A', person_type: 'employee', is_active: true },
      },
      { table: 'org_relationships', op: 'select', data: null },
      {
        table: 'org_relationships',
        op: 'insert',
        data: { id: 'rel-a', from_id: 'person-a', to_id: 'branch-a', rel_type: 'belongs_to', role: 'ktv', since: '2026-10-06', until: null },
      },
    ]);

    const result = await assignBeautyStaffToBranch({ userId: 'staff-a', branchId: 'branch-a' });

    expect(result).toEqual({
      success: true,
      data: { relationshipId: 'rel-a', personId: 'person-a', branchId: 'branch-a' },
    });
    expect(calls[0].filters).toContainEqual({ field: 'tenant_id', value: 'tenant-a', op: 'eq' });
    expect(calls[1].filters).toContainEqual({ field: 'tenant_id', value: 'tenant-a', op: 'eq' });
    expect(calls[3].payload).toMatchObject({
      tenant_id: 'tenant-a',
      user_id: 'staff-a',
      person_type: 'employee',
    });
    expect(calls[5].payload).toMatchObject({
      tenant_id: 'tenant-a',
      from_id: 'person-a',
      from_type: 'person',
      to_id: 'branch-a',
      to_type: 'unit',
      rel_type: 'belongs_to',
    });
  });

  it('denies cross-tenant staff assignment before writing relationships', async () => {
    const calls = installSupabase([
      { table: 'users', op: 'select', data: null },
      {
        table: 'org_units',
        op: 'select',
        data: { id: 'branch-a', tenant_id: 'tenant-a', unit_type: 'branch', name: 'Quận 1', code: null, parent_id: null, is_active: true, metadata: {} },
      },
    ]);

    const result = await assignBeautyStaffToBranch({ userId: 'staff-from-other-tenant', branchId: 'branch-a' });

    expect(result).toEqual({
      success: false,
      error: 'Nhân sự không tồn tại trong tenant hiện tại.',
    });
    expect(calls.map((call) => call.op)).toEqual(['select', 'select']);
  });

  it('reads branch access from the canonical projection', async () => {
    installSupabase([
      {
        table: 'org_units',
        op: 'select',
        data: [
          { id: 'company-a', tenant_id: 'tenant-a', unit_type: 'company', name: 'Bella Beauty', code: null, parent_id: null, is_active: true, metadata: {} },
          { id: 'branch-a', tenant_id: 'tenant-a', unit_type: 'branch', name: 'Quận 1', code: null, parent_id: 'company-a', is_active: true, metadata: {} },
        ],
      },
      {
        table: 'users',
        op: 'select',
        data: [{ id: 'staff-a', tenant_id: 'tenant-a', email: 'staff@bella.test', full_name: 'Nguyen A', role: 'ktv', status: 'active' }],
      },
      {
        table: 'people_directory',
        op: 'select',
        data: [{ id: 'person-a', tenant_id: 'tenant-a', user_id: 'staff-a', display_name: 'Nguyen A', person_type: 'employee', is_active: true }],
      },
      {
        table: 'org_relationships',
        op: 'select',
        data: [{ id: 'rel-a', from_id: 'person-a', to_id: 'branch-a', rel_type: 'belongs_to', role: 'ktv', since: null, until: null }],
      },
      {
        table: 'user_org_unit_access',
        op: 'select',
        data: [{ user_id: 'staff-a', org_unit_id: 'branch-a', access_source: 'belongs_to' }],
      },
    ]);

    const result = await getBeautyChainSnapshot();

    expect(result).toEqual({
      success: true,
      data: {
        company: { id: 'company-a', name: 'Bella Beauty', code: null },
        branches: [{ id: 'branch-a', name: 'Quận 1', code: null, companyId: 'company-a', staffCount: 1 }],
        staff: [{
          userId: 'staff-a',
          personId: 'person-a',
          fullName: 'Nguyen A',
          email: 'staff@bella.test',
          role: 'ktv',
          status: 'active',
          branchIds: ['branch-a'],
        }],
      },
    });
  });
});
