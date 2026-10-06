import {
  getBeautyRuntimeBranchContext,
  selectBeautyRuntimeBranch,
} from '../services/beauty-runtime-branch-actions';
import { resolveSingleStaffBranchContext } from '../services/beauty-branch-context';

const mockGetCurrentUser = jest.fn();
const mockCreateClient = jest.fn();

jest.mock('server-only', () => ({}), { virtual: true });

jest.mock('../services/user-actions', () => ({
  getCurrentUser: () => mockGetCurrentUser(),
}));

jest.mock('../lib/supabase-server', () => ({
  createClient: () => mockCreateClient(),
}));

type ScriptedResult = {
  table: string;
  op: 'select';
  data?: unknown;
  error?: { message: string };
};

type DbCall = {
  table: string;
  filters: Array<{ field: string; value: unknown; op: 'eq' }>;
};

class ScriptedQueryBuilder {
  private selected = false;

  constructor(
    private readonly table: string,
    private readonly scripts: ScriptedResult[],
    private readonly calls: DbCall[],
  ) {}

  select() {
    if (!this.selected) {
      this.selected = true;
      this.calls.push({ table: this.table, filters: [] });
    }
    return this;
  }

  eq(field: string, value: unknown) {
    this.calls.at(-1)?.filters.push({ field, value, op: 'eq' });
    return this;
  }

  then(onfulfilled: (value: { data: unknown; error: { message: string } | null }) => unknown) {
    return this.resolve().then(onfulfilled);
  }

  private resolve() {
    const expected = this.scripts.shift();
    if (!expected) {
      throw new Error(`No scripted result for ${this.table}.select`);
    }
    if (expected.table !== this.table || !this.selected) {
      throw new Error(`Expected ${expected.table}.select, got ${this.table}.${this.selected ? 'select' : 'unknown'}`);
    }
    return Promise.resolve({ data: expected.data ?? null, error: expected.error ?? null });
  }
}

function installSupabase(scripts: ScriptedResult[]) {
  const calls: DbCall[] = [];
  const supabase = {
    from: (table: string) => new ScriptedQueryBuilder(table, scripts, calls),
  };
  mockCreateClient.mockResolvedValue(supabase);
  return { calls, supabase };
}

function installKtvUser() {
  mockGetCurrentUser.mockResolvedValue({
    id: 'staff-a',
    tenant_id: 'tenant-a',
    role: 'ktv',
  });
}

describe('beauty runtime branch context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    installKtvUser();
  });

  it('reads accessible branches from user_org_unit_access and auto-selects a single branch', async () => {
    const { calls } = installSupabase([
      {
        table: 'org_units',
        op: 'select',
        data: [
          { id: 'company-a', tenant_id: 'tenant-a', unit_type: 'company', name: 'Bella Beauty', code: null, parent_id: null, is_active: true },
          { id: 'branch-a', tenant_id: 'tenant-a', unit_type: 'branch', name: 'Quận 1', code: 'Q1', parent_id: 'company-a', is_active: true },
        ],
      },
      {
        table: 'user_org_unit_access',
        op: 'select',
        data: [{ user_id: 'staff-a', tenant_id: 'tenant-a', org_unit_id: 'branch-a', root_org_unit_id: 'branch-a', access_source: 'belongs_to' }],
      },
    ]);

    const result = await getBeautyRuntimeBranchContext();

    expect(result).toEqual({
      success: true,
      data: {
        branches: [{
          id: 'branch-a',
          name: 'Quận 1',
          code: 'Q1',
          accessSource: 'belongs_to',
          rootOrgUnitId: 'branch-a',
        }],
        activeBranchId: 'branch-a',
        requiresSelection: false,
      },
    });
    expect(calls.find((call) => call.table === 'user_org_unit_access')?.filters).toEqual(expect.arrayContaining([
      { field: 'tenant_id', value: 'tenant-a', op: 'eq' },
      { field: 'user_id', value: 'staff-a', op: 'eq' },
    ]));
  });

  it('denies selecting a branch outside the user access projection', async () => {
    installSupabase([
      {
        table: 'org_units',
        op: 'select',
        data: [
          { id: 'branch-a', tenant_id: 'tenant-a', unit_type: 'branch', name: 'Quận 1', code: null, parent_id: null, is_active: true },
          { id: 'branch-b', tenant_id: 'tenant-a', unit_type: 'branch', name: 'Quận 7', code: null, parent_id: null, is_active: true },
        ],
      },
      {
        table: 'user_org_unit_access',
        op: 'select',
        data: [{ user_id: 'staff-a', tenant_id: 'tenant-a', org_unit_id: 'branch-a', root_org_unit_id: 'branch-a', access_source: 'belongs_to' }],
      },
    ]);

    const result = await selectBeautyRuntimeBranch('branch-b');

    expect(result).toEqual({
      success: false,
      error: 'Không có quyền thao tác tại chi nhánh này.',
    });
  });

  it('resolves writer branch context from user_org_unit_access before write', async () => {
    const { supabase } = installSupabase([
      {
        table: 'user_org_unit_access',
        op: 'select',
        data: [{ user_id: 'staff-a', org_unit_id: 'branch-a', root_org_unit_id: 'branch-a', access_source: 'belongs_to' }],
      },
      {
        table: 'org_units',
        op: 'select',
        data: [{ id: 'branch-a', parent_id: null, unit_type: 'branch' }],
      },
    ]);

    const result = await resolveSingleStaffBranchContext({
      supabase: supabase as never,
      tenantId: 'tenant-a',
      userId: 'staff-a',
      asOfDate: '2026-10-06',
    });

    expect(result).toEqual({
      success: true,
      context: {
        branchId: 'branch-a',
        rootOrgUnitId: 'branch-a',
      },
    });
  });
});
