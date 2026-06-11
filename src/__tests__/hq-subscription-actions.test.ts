jest.mock('server-only', () => ({}), { virtual: true });

const mockCheckHqAuth = jest.fn();
const mockRecordAuditLog = jest.fn();
const mockSafeRevalidatePath = jest.fn();

jest.mock('@/services/hq-actions', () => ({
  checkHqAuth: () => mockCheckHqAuth(),
}));

jest.mock('@/services/audit-actions', () => ({
  recordAuditLog: (payload: unknown) => mockRecordAuditLog(payload),
}));

jest.mock('@/lib/revalidate', () => ({
  safeRevalidatePath: (path: string) => mockSafeRevalidatePath(path),
}));

type QueryResult = { data: unknown; error: { message: string } | null; count?: number | null };
type QueryOperation = 'select' | 'insert' | 'update' | 'delete';
type QueryCall = {
  table: string;
  operation: QueryOperation;
  payload?: unknown;
  selectColumns?: string;
  filters: { column: string; value: unknown }[];
  orders: { column: string; options?: unknown }[];
};

const queryCalls: QueryCall[] = [];
let scriptedResults: QueryResult[] = [];

class QueryBuilder implements PromiseLike<QueryResult> {
  private operation: QueryOperation = 'select';
  private payload?: unknown;
  private selectColumns?: string;
  private filters: { column: string; value: unknown }[] = [];
  private orders: { column: string; options?: unknown }[] = [];

  constructor(private readonly table: string) {}

  select(columns?: string) {
    this.selectColumns = columns;
    return this;
  }

  insert(payload: unknown) {
    this.operation = 'insert';
    this.payload = payload;
    return this;
  }

  update(payload: unknown) {
    this.operation = 'update';
    this.payload = payload;
    return this;
  }

  delete() {
    this.operation = 'delete';
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, value });
    return this;
  }

  order(column: string, options?: unknown) {
    this.orders.push({ column, options });
    return this;
  }

  single() {
    return this.resolve();
  }

  maybeSingle() {
    return this.resolve();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2> {
    return this.resolve().then(onfulfilled, onrejected);
  }

  private resolve() {
    queryCalls.push({
      table: this.table,
      operation: this.operation,
      payload: this.payload,
      selectColumns: this.selectColumns,
      filters: [...this.filters],
      orders: [...this.orders],
    });

    return Promise.resolve(scriptedResults.shift() ?? { data: null, error: null });
  }
}

const mockSupabase = {
  from: jest.fn((table: string) => new QueryBuilder(table)),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: () => Promise.resolve(mockSupabase),
}));

import {
  getHqSubscriptionOverview,
  resetTenantUsageCounter,
  setTenantQuotaOverride,
  updateSubscriptionPlanCatalog,
  updateSubscriptionPlanEntitlement,
  updateTenantSubscriptionPlan,
} from '@/services/hq-subscription-actions';

function overrideRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'override-1',
    tenant_id: 'tenant-1',
    feature_key: 'sms',
    limit_value: 100,
    is_unlimited: false,
    unit: 'message',
    enforcement_mode: 'hard',
    reset_period: 'monthly',
    reason: 'old reason',
    starts_at: '2026-06-01T00:00:00.000Z',
    expires_at: null,
    is_active: true,
    created_by: 'hq-admin',
    updated_by: 'hq-admin',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function usageCounterRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    tenant_id: 'tenant-1',
    feature_key: 'sms',
    period_start: '2026-06-01',
    period_end: '2026-06-30',
    used_value: 42,
    metadata: { source: 'zalo' },
    last_increment_at: '2026-06-10T00:00:00.000Z',
    updated_at: '2026-06-10T00:00:00.000Z',
    ...overrides,
  };
}

function subscriptionPlanRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    plan_code: 'pro',
    display_name: 'Chuyên nghiệp',
    description: 'Old plan description',
    price_monthly: 999000,
    is_active: true,
    sort_order: 30,
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

function subscriptionEntitlementRow(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'entitlement-1',
    plan_code: 'pro',
    feature_key: 'branch',
    limit_value: 3,
    is_unlimited: false,
    unit: 'count',
    enforcement_mode: 'hard',
    reset_period: 'none',
    description: 'Maximum active branches/locations.',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('HQ subscription actions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    queryCalls.length = 0;
    scriptedResults = [];
    mockCheckHqAuth.mockResolvedValue({
      authorized: true,
      user: { id: 'hq-admin', role: 'admin', tenant_id: 'hq-tenant' },
    });
    mockRecordAuditLog.mockResolvedValue({ success: true });
    mockSafeRevalidatePath.mockResolvedValue(undefined);
  });

  it('throws subscription overview database failures instead of returning partial state', async () => {
    scriptedResults = [{ data: null, error: { message: 'plans unavailable' } }];

    await expect(getHqSubscriptionOverview()).rejects.toThrow(
      '[getHqSubscriptionOverview] subscription_plans query failed: plans unavailable'
    );
  });

  it('loads plans, entitlements, tenants, overrides and usage counters for HQ', async () => {
    scriptedResults = [
      { data: [{ plan_code: 'basic' }], error: null },
      { data: [{ feature_key: 'sms' }], error: null },
      { data: [{ id: 'tenant-1', name: 'Branch 1' }], error: null },
      { data: [overrideRow()], error: null },
      { data: [usageCounterRow()], error: null },
    ];

    const overview = await getHqSubscriptionOverview();

    expect(overview.plans).toHaveLength(1);
    expect(overview.entitlements).toHaveLength(1);
    expect(overview.tenants).toHaveLength(1);
    expect(overview.overrides).toHaveLength(1);
    expect(overview.usageCounters).toHaveLength(1);
    expect(queryCalls.map((call) => call.table)).toEqual([
      'subscription_plans',
      'subscription_plan_entitlements',
      'tenants',
      'tenant_subscription_overrides',
      'tenant_usage_counters',
    ]);
  });

  it('updates subscription plan catalog with audit and cache revalidation', async () => {
    const existing = subscriptionPlanRow({ display_name: 'Pro old', price_monthly: 999000 });
    const updated = subscriptionPlanRow({ display_name: 'Pro Beauty', price_monthly: 1299000 });
    scriptedResults = [
      { data: existing, error: null },
      { data: updated, error: null },
    ];

    const res = await updateSubscriptionPlanCatalog({
      planCode: ' pro ',
      displayName: ' Pro Beauty ',
      description: 'Beauty spa professional plan',
      priceMonthly: 1299000,
      isActive: true,
      sortOrder: 20,
    });

    expect(res.success).toBe(true);
    expect(queryCalls[1]).toMatchObject({
      table: 'subscription_plans',
      operation: 'update',
      payload: expect.objectContaining({
        display_name: 'Pro Beauty',
        description: 'Beauty spa professional plan',
        price_monthly: 1299000,
        is_active: true,
        sort_order: 20,
      }),
      filters: [{ column: 'plan_code', value: 'pro' }],
    });
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'subscription_plans',
      record_id: 'pro',
      old_data: expect.objectContaining({ display_name: 'Pro old' }),
      new_data: expect.objectContaining({ display_name: 'Pro Beauty' }),
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/hq');
  });

  it('rolls back subscription plan catalog updates when audit logging fails', async () => {
    const existing = subscriptionPlanRow({ display_name: 'Pro old', updated_at: 'old-date' });
    const updated = subscriptionPlanRow({ display_name: 'Pro Beauty', updated_at: 'new-date' });
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
    scriptedResults = [
      { data: existing, error: null },
      { data: updated, error: null },
      { data: null, error: null },
    ];

    const res = await updateSubscriptionPlanCatalog({
      planCode: 'pro',
      displayName: 'Pro Beauty',
      priceMonthly: 1299000,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after subscription plan catalog update: audit down');
    expect(queryCalls[2]).toMatchObject({
      table: 'subscription_plans',
      operation: 'update',
      payload: expect.objectContaining({
        display_name: 'Pro old',
        price_monthly: 999000,
        updated_at: 'old-date',
      }),
      filters: [{ column: 'plan_code', value: 'pro' }],
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('creates a default branch entitlement for a subscription plan with audit', async () => {
    const inserted = subscriptionEntitlementRow({
      id: 'entitlement-branch',
      limit_value: 4,
      description: 'Main spa plus 3 branches',
    });
    scriptedResults = [
      { data: { plan_code: 'pro' }, error: null },
      { data: null, error: null },
      { data: inserted, error: null },
    ];

    const res = await updateSubscriptionPlanEntitlement({
      planCode: 'pro',
      featureKey: 'branch',
      limitValue: 4,
      isUnlimited: false,
      unit: 'count',
      enforcementMode: 'hard',
      resetPeriod: 'none',
      description: 'Main spa plus 3 branches',
    });

    expect(res.success).toBe(true);
    expect(queryCalls[2]).toMatchObject({
      table: 'subscription_plan_entitlements',
      operation: 'insert',
      payload: expect.objectContaining({
        plan_code: 'pro',
        feature_key: 'branch',
        limit_value: 4,
        is_unlimited: false,
        unit: 'count',
        reset_period: 'none',
      }),
    });
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'INSERT',
      table_name: 'subscription_plan_entitlements',
      record_id: 'entitlement-branch',
      new_data: expect.objectContaining({ feature_key: 'branch', limit_value: 4 }),
    });
  });

  it('restores an existing plan entitlement when audit logging fails', async () => {
    const existing = subscriptionEntitlementRow({ limit_value: 3, updated_at: 'old-date' });
    const updated = subscriptionEntitlementRow({ limit_value: 4, updated_at: 'new-date' });
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    scriptedResults = [
      { data: { plan_code: 'pro' }, error: null },
      { data: existing, error: null },
      { data: updated, error: null },
      { data: null, error: null },
    ];

    const res = await updateSubscriptionPlanEntitlement({
      planCode: 'pro',
      featureKey: 'branch',
      limitValue: 4,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after plan entitlement update: audit unavailable');
    expect(queryCalls[3]).toMatchObject({
      table: 'subscription_plan_entitlements',
      operation: 'update',
      payload: expect.objectContaining({
        limit_value: 3,
        updated_at: 'old-date',
      }),
      filters: [{ column: 'id', value: 'entitlement-1' }],
    });
  });

  it('updates a tenant subscription plan with audit and cache revalidation', async () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Branch 1',
      subscription_tier: 'basic',
      subscription_expires_at: '2026-06-30',
      updated_at: 'old-date',
    };

    scriptedResults = [
      { data: { plan_code: 'pro', is_active: true }, error: null },
      { data: tenant, error: null },
      { data: null, error: null },
    ];

    const res = await updateTenantSubscriptionPlan({
      tenantId: ' tenant-1 ',
      planCode: ' pro ',
      subscriptionExpiresAt: '2026-12-31',
    });

    expect(res).toEqual({ success: true });
    expect(queryCalls[2]).toMatchObject({
      table: 'tenants',
      operation: 'update',
      payload: expect.objectContaining({
        subscription_tier: 'pro',
        subscription_expires_at: '2026-12-31',
      }),
      filters: [{ column: 'id', value: 'tenant-1' }],
    });
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: 'tenant-1',
      old_data: expect.objectContaining({ subscription_tier: 'basic' }),
      new_data: expect.objectContaining({ subscription_tier: 'pro' }),
    });
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/hq');
    expect(mockSafeRevalidatePath).toHaveBeenCalledWith('/dashboard/settings');
  });

  it('rolls back tenant subscription updates when audit logging fails', async () => {
    const tenant = {
      id: 'tenant-1',
      name: 'Branch 1',
      subscription_tier: 'basic',
      subscription_expires_at: '2026-06-30',
      updated_at: 'old-date',
    };

    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit down'));
    scriptedResults = [
      { data: { plan_code: 'pro', is_active: true }, error: null },
      { data: tenant, error: null },
      { data: null, error: null },
      { data: null, error: null },
    ];

    const res = await updateTenantSubscriptionPlan({
      tenantId: 'tenant-1',
      planCode: 'pro',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after tenant subscription update: audit down');
    expect(queryCalls[3]).toMatchObject({
      table: 'tenants',
      operation: 'update',
      payload: {
        subscription_tier: 'basic',
        subscription_expires_at: '2026-06-30',
        updated_at: 'old-date',
      },
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('creates a tenant quota override with typed insert payload and audit', async () => {
    const inserted = overrideRow({
      id: 'override-new',
      limit_value: 250,
      reason: 'campaign burst',
    });
    scriptedResults = [
      { data: { id: 'tenant-1' }, error: null },
      { data: null, error: null },
      { data: inserted, error: null },
    ];

    const res = await setTenantQuotaOverride({
      tenantId: 'tenant-1',
      featureKey: 'sms',
      limitValue: 250,
      unit: 'message',
      resetPeriod: 'monthly',
      reason: 'campaign burst',
    });

    expect(res.success).toBe(true);
    expect(queryCalls[2]).toMatchObject({
      table: 'tenant_subscription_overrides',
      operation: 'insert',
      payload: expect.objectContaining({
        tenant_id: 'tenant-1',
        feature_key: 'sms',
        limit_value: 250,
        is_unlimited: false,
        created_by: 'hq-admin',
        updated_by: 'hq-admin',
      }),
    });
    expect(mockRecordAuditLog).toHaveBeenCalledWith({
      action: 'INSERT',
      table_name: 'tenant_subscription_overrides',
      record_id: 'override-new',
      new_data: expect.objectContaining({ limit_value: 250 }),
    });
  });

  it('deletes a newly inserted quota override when audit logging fails', async () => {
    const inserted = overrideRow({ id: 'override-new' });
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    scriptedResults = [
      { data: { id: 'tenant-1' }, error: null },
      { data: null, error: null },
      { data: inserted, error: null },
      { data: null, error: null },
    ];

    const res = await setTenantQuotaOverride({
      tenantId: 'tenant-1',
      featureKey: 'sms',
      limitValue: 250,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after quota override insert: audit unavailable');
    expect(queryCalls[3]).toMatchObject({
      table: 'tenant_subscription_overrides',
      operation: 'delete',
      filters: [{ column: 'id', value: 'override-new' }],
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });

  it('restores an existing quota override when update audit logging fails', async () => {
    const existing = overrideRow({ limit_value: 100, updated_at: 'old-date' });
    const updated = overrideRow({ limit_value: 300, updated_at: 'new-date' });
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    scriptedResults = [
      { data: { id: 'tenant-1' }, error: null },
      { data: existing, error: null },
      { data: updated, error: null },
      { data: null, error: null },
    ];

    const res = await setTenantQuotaOverride({
      tenantId: 'tenant-1',
      featureKey: 'sms',
      limitValue: 300,
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after quota override update: audit unavailable');
    expect(queryCalls[3]).toMatchObject({
      table: 'tenant_subscription_overrides',
      operation: 'update',
      payload: expect.objectContaining({
        limit_value: 100,
        updated_at: 'old-date',
      }),
      filters: [{ column: 'id', value: 'override-1' }],
    });
  });

  it('restores a usage counter when reset audit logging fails', async () => {
    const existing = usageCounterRow({ used_value: 42, updated_at: 'old-date' });
    const updated = usageCounterRow({ used_value: 0, updated_at: 'new-date' });
    mockRecordAuditLog.mockRejectedValueOnce(new Error('audit unavailable'));
    scriptedResults = [
      { data: existing, error: null },
      { data: updated, error: null },
      { data: null, error: null },
    ];

    const res = await resetTenantUsageCounter({
      tenantId: 'tenant-1',
      featureKey: 'sms',
      periodStart: '2026-06-01',
      periodEnd: '2026-06-30',
      reason: 'manual correction',
    });

    expect(res.success).toBe(false);
    expect(res.error).toContain('Audit log failed after usage counter reset: audit unavailable');
    expect(queryCalls[2]).toMatchObject({
      table: 'tenant_usage_counters',
      operation: 'update',
      payload: expect.objectContaining({
        used_value: 42,
        metadata: { source: 'zalo' },
        updated_at: 'old-date',
      }),
      filters: [
        { column: 'tenant_id', value: 'tenant-1' },
        { column: 'feature_key', value: 'sms' },
        { column: 'period_start', value: '2026-06-01' },
      ],
    });
    expect(mockSafeRevalidatePath).not.toHaveBeenCalled();
  });
});
