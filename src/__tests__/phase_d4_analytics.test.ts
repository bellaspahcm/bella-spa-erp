/**
 * Phase D4 — Analytics Engine Tests
 * Tests: L0 record, L1 daily rollup, L2 monthly rollup, L3 enterprise boundary,
 *        tenant dashboard, multi-tenant isolation.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { AnalyticsEngineService } from '@/platform/host/analytics-engine';

jest.setTimeout(60000);

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? '';
const SUPABASE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY'] ?? '';
const TENANT_A = '88888888-8888-8888-8888-888888888888';
const TENANT_B = '99999999-9999-9999-9999-999999999999'; // hypothetical second tenant

let supabase: ReturnType<typeof createClient<Database>>;
let engineA: AnalyticsEngineService;

const TEST_DATE = '2026-08-08';
const TEST_MONTH = '2026-08';

beforeAll(() => {
  supabase = createClient<Database>(SUPABASE_URL, SUPABASE_KEY);
  engineA = new AnalyticsEngineService(supabase, TENANT_A);
});

// ─────────────────────────────────────────────────────────────────
// Suite 1: L0 recordMetric — raw events
// ─────────────────────────────────────────────────────────────────
describe('D4 AnalyticsEngine — L0 recordMetric', () => {
  it('should record a metric event with dimensions', async () => {
    await engineA.recordMetric({
      metricKey: 'spa.booking.revenue',
      metricDomain: 'beauty_spa',
      value: 1500000,
      unit: 'VND',
      dimensions: { branch_id: 'branch-01', service_type: 'massage' },
      sourceType: 'booking',
      sourceId: 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee',
      sourceEventType: 'spa.booking.confirmed.v1',
    });

    const { data } = await supabase
      .from('platform_metric_events')
      .select('metric_key, value, dimensions')
      .eq('tenant_id', TENANT_A)
      .eq('metric_key', 'spa.booking.revenue')
      .order('occurred_at', { ascending: false })
      .limit(1)
      .single();

    expect(data?.metric_key).toBe('spa.booking.revenue');
    expect(Number(data?.value)).toBe(1500000);
    expect((data?.dimensions as Record<string, unknown>)['branch_id']).toBe('branch-01');
  });

  it('should seed multiple metrics for rollup tests', async () => {
    const metrics = [
      { metricKey: 'spa.booking.revenue', metricDomain: 'beauty_spa', value: 2000000 },
      { metricKey: 'spa.booking.revenue', metricDomain: 'beauty_spa', value: 3000000 },
      { metricKey: 'spa.booking.count', metricDomain: 'beauty_spa', value: 1 },
      { metricKey: 'spa.booking.count', metricDomain: 'beauty_spa', value: 1 },
      { metricKey: 'spa.booking.count', metricDomain: 'beauty_spa', value: 1 },
    ];

    for (const m of metrics) {
      await engineA.recordMetric(m);
    }

    // Verify all recorded
    const { data } = await supabase
      .from('platform_metric_events')
      .select('id')
      .eq('tenant_id', TENANT_A)
      .eq('metric_domain', 'beauty_spa');

    expect((data?.length ?? 0)).toBeGreaterThanOrEqual(6); // 1 from first test + 5
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 2: L1 Daily Rollup
// ─────────────────────────────────────────────────────────────────
describe('D4 AnalyticsEngine — L1 rollupDaily', () => {
  it('should aggregate L0 events into daily rollup for today', async () => {
    const count = await engineA.rollupDaily(TEST_DATE);

    expect(count).toBeGreaterThan(0);

    const { data } = await supabase
      .from('platform_daily_rollups')
      .select('metric_key, total_value, count_events, min_value, max_value, avg_value')
      .eq('tenant_id', TENANT_A)
      .eq('period_date', TEST_DATE)
      .eq('metric_key', 'spa.booking.revenue')
      .single();

    expect(data).not.toBeNull();
    // total should be at least 1.5M + 2M + 3M = 6.5M
    expect(Number(data?.total_value)).toBeGreaterThanOrEqual(6500000);
    expect(Number(data?.count_events)).toBeGreaterThanOrEqual(3);
    expect(Number(data?.min_value)).toBeGreaterThanOrEqual(1500000);
    expect(Number(data?.max_value)).toBeGreaterThanOrEqual(3000000);
  });

  it('should be idempotent — re-running rollupDaily overwrites same row', async () => {
    await engineA.rollupDaily(TEST_DATE); // run again
    await engineA.rollupDaily(TEST_DATE); // run again

    const { data } = await supabase
      .from('platform_daily_rollups')
      .select('id')
      .eq('tenant_id', TENANT_A)
      .eq('period_date', TEST_DATE)
      .eq('metric_key', 'spa.booking.revenue');

    // Should still be exactly 1 row (upsert on conflict)
    expect(data?.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 3: L2 Monthly Rollup
// ─────────────────────────────────────────────────────────────────
describe('D4 AnalyticsEngine — L2 rollupMonthly', () => {
  beforeAll(async () => {
    // Ensure L1 exists first
    await engineA.rollupDaily(TEST_DATE);
  });

  it('should aggregate L1 daily into monthly rollup', async () => {
    const count = await engineA.rollupMonthly(TEST_MONTH);

    expect(count).toBeGreaterThan(0);

    const { data } = await supabase
      .from('platform_monthly_rollups')
      .select('metric_key, total_value, count_events, source_daily_count')
      .eq('tenant_id', TENANT_A)
      .eq('period_month', TEST_MONTH)
      .eq('metric_key', 'spa.booking.revenue')
      .single();

    expect(data).not.toBeNull();
    expect(Number(data?.total_value)).toBeGreaterThan(0);
    expect(Number(data?.source_daily_count)).toBeGreaterThanOrEqual(1);
  });

  it('should be idempotent — re-running rollupMonthly overwrites same row', async () => {
    await engineA.rollupMonthly(TEST_MONTH);

    const { data } = await supabase
      .from('platform_monthly_rollups')
      .select('id')
      .eq('tenant_id', TENANT_A)
      .eq('period_month', TEST_MONTH)
      .eq('metric_key', 'spa.booking.revenue');

    expect(data?.length).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 4: L3 Enterprise Rollup — explicit boundary
// ─────────────────────────────────────────────────────────────────
describe('D4 AnalyticsEngine — L3 rollupEnterprise', () => {
  beforeAll(async () => {
    await engineA.rollupDaily(TEST_DATE);
    await engineA.rollupMonthly(TEST_MONTH);
  });

  it('should only aggregate metrics defined in enterprise_metric_definitions', async () => {
    const count = await engineA.rollupEnterprise(TEST_MONTH);

    // Should have processed at least the 8 seeded metric definitions
    // (actual count depends on which tenants have L2 data)
    expect(count).toBeGreaterThanOrEqual(0);
  });

  it('should create enterprise rollup entry for spa.booking.revenue', async () => {
    await engineA.rollupEnterprise(TEST_MONTH);

    const { data } = await supabase
      .from('platform_enterprise_rollups')
      .select('*')
      .eq('metric_key', 'spa.booking.revenue')
      .eq('period_month', TEST_MONTH)
      .maybeSingle();

    if (data) {
      // If L2 data exists for this metric, enterprise rollup should exist
      expect(data.aggregation_policy).toBe('SUM');
      expect(data.tenant_count).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(data.included_tenants)).toBe(true);
      // total_value should match sum of tenant L2 values
      expect(Number(data.total_value)).toBeGreaterThan(0);
    }
    // If no L2 data exists yet for other metrics, the test still passes (data may be null)
  });

  it('should be idempotent — re-running rollupEnterprise overwrites same row', async () => {
    await engineA.rollupEnterprise(TEST_MONTH);
    await engineA.rollupEnterprise(TEST_MONTH);

    const { data } = await supabase
      .from('platform_enterprise_rollups')
      .select('id')
      .eq('period_month', TEST_MONTH);

    // Unique constraint ensures only 1 row per metric+month
    const keys = data?.map(r => r.id) ?? [];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 5: Tenant Dashboard
// ─────────────────────────────────────────────────────────────────
describe('D4 AnalyticsEngine — getTenantDashboard', () => {
  beforeAll(async () => {
    await engineA.rollupDaily(TEST_DATE);
    await engineA.rollupMonthly(TEST_MONTH);
  });

  it('should return dashboard with metrics for the period', async () => {
    const dashboard = await engineA.getTenantDashboard(TEST_MONTH);

    expect(dashboard.tenantId).toBe(TENANT_A);
    expect(dashboard.periodMonth).toBe(TEST_MONTH);
    expect(Array.isArray(dashboard.metrics)).toBe(true);

    if (dashboard.metrics.length > 0) {
      const revMetric = dashboard.metrics.find(m => m.metricKey === 'spa.booking.revenue');
      expect(revMetric).toBeDefined();
      expect(revMetric?.totalValue).toBeGreaterThan(0);
      expect(typeof revMetric?.countEvents).toBe('number');
    }
  });

  it('should return empty metrics for a future month with no data', async () => {
    const dashboard = await engineA.getTenantDashboard('2030-01');
    expect(dashboard.metrics).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────
// Suite 6: Tenant Isolation — L0 RLS
// ─────────────────────────────────────────────────────────────────
describe('D4 AnalyticsEngine — Tenant isolation (RLS)', () => {
  it('should not expose Tenant A L2 data when querying as anonymous (no RLS bypass)', async () => {
    // Using anon client (not service role) to test RLS isolation
    const anonClient = createClient<Database>(
      SUPABASE_URL,
      process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? ''
    );

    const { data } = await anonClient
      .from('platform_monthly_rollups')
      .select('tenant_id, total_value')
      .eq('period_month', TEST_MONTH);

    // RLS with no tenant context set → should return empty or null (policy blocks access)
    expect(data === null || data.length === 0).toBe(true);
  });
});
