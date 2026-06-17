jest.mock('server-only', () => ({}), { virtual: true });

const mockFrom = jest.fn();
const mockGetCurrentUser = jest.fn();
const mockGetAccountingHealthSummary = jest.fn();
const mockGetBusinessHealthSummary = jest.fn();

jest.mock('@/core/services/accounting/client', () => ({
  createAccountingDataClient: jest.fn(() => Promise.resolve({ from: mockFrom })),
}));

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: (...args: unknown[]) => mockGetCurrentUser(...args),
}));

jest.mock('@/core/services/accounting/health', () => ({
  getAccountingHealthSummary: (...args: unknown[]) => mockGetAccountingHealthSummary(...args),
}));

jest.mock('@/core/services/accounting/business-health', () => ({
  getBusinessHealthSummary: (...args: unknown[]) => mockGetBusinessHealthSummary(...args),
}));

import { getSystemMonitorSummary } from '@/services/system-monitor-actions';

const OLD_ENV = process.env;

class MockQueryBuilder {
  constructor(private data: unknown[] | null = [], private error: { message: string } | null = null) {}

  select() { return this; }
  eq() { return this; }
  in() { return this; }
  order() { return this; }
  limit() { return this; }

  then(onfulfilled: (value: { data: unknown[] | null; error: { message: string } | null }) => unknown) {
    return Promise.resolve({ data: this.data, error: this.error }).then(onfulfilled);
  }
}

function healthyAccountingSummary() {
  return {
    generated_at: '2026-06-07T00:00:00.000Z',
    month: '2026-06',
    severity: 'healthy',
    can_close_month: true,
    blocker_count: 0,
    warning_count: 0,
    metrics: {
      outbox_pending: 0,
      outbox_processing: 0,
      outbox_completed: 2,
      outbox_failed: 0,
      outbox_dead: 0,
      journal_draft: 0,
      journal_posted: 1,
      journal_canceled: 0,
      duplicate_active_references: 0,
      readiness_score: 100,
      missing_business_event: 0,
      needs_review: 0,
      posting_failed: 0,
      legacy_pending_revenue: 0,
      legacy_pending_expense: 0,
      legacy_pending_salary: 0,
      legacy_journal_entries_to_create: 0,
      worker_last_run_at: '2026-06-07T00:00:00.000Z',
      worker_minutes_since_last_run: 2,
      worker_runs_24h: 1,
      worker_failed_runs_24h: 0,
      worker_failure_rate_24h: 0,
      worker_silent_with_pending: 0,
    },
    checks: [],
    blockers: [],
    warnings: [],
    duplicate_journal_references: [],
  };
}

function healthyBusinessSummary() {
  return {
    generated_at: '2026-06-07T00:00:00.000Z',
    month: '2026-06',
    severity: 'healthy',
    score: 100,
    checked_groups: 4,
    critical_count: 0,
    warning_count: 0,
    can_operate_cleanly: true,
    dataset_counts: {
      bookings: 0,
      revenue: 0,
      session_logs: 0,
      salary_records: 0,
      packages: 0,
      package_materials: 0,
      inventory_items: 0,
      inventory_logs: 0,
      journal_entries: 0,
      journal_lines: 0,
      accounting_outbox: 0,
    },
    groups: [],
    findings: [],
    blockers: [],
    warnings: [],
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...OLD_ENV,
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_SECRET_KEY: 'server-secret',
    CRON_SECRET: 'cron-secret',
    ACCOUNTING_ALERT_TENANT_ID: 'tenant-a',
  };
  mockGetCurrentUser.mockResolvedValue({ id: 'admin-1', role: 'admin', tenant_id: 'tenant-a' });
  mockGetAccountingHealthSummary.mockResolvedValue(healthyAccountingSummary());
  mockGetBusinessHealthSummary.mockResolvedValue(healthyBusinessSummary());
  mockFrom.mockReturnValue(new MockQueryBuilder([]));
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('system monitor actions', () => {
  it('returns a healthy system monitor summary when engines and config are clean', async () => {
    const summary = await getSystemMonitorSummary('2026-06-01');

    expect(summary.overall_status).toBe('healthy');
    expect(summary.overall_score).toBe(100);
    expect(summary.month).toBe('2026-06');
    expect(summary.quick_metrics).toEqual(expect.objectContaining({
      accounting_blockers: 0,
      business_critical: 0,
      cron_smoke_open_alerts: 0,
      business_rule_open_alerts: 0,
      tenant_isolation_issues: 0,
    }));
    expect(mockGetAccountingHealthSummary).toHaveBeenCalledWith('2026-06-01');
    expect(mockGetBusinessHealthSummary).toHaveBeenCalledWith('2026-06-01');
  });

  it('raises critical status when cron smoke notification is still open', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder([
      {
        id: 'notif-1',
        type: 'accounting_worker_cron_alert',
        title: 'Cron kế toán production đang lỗi',
        message: 'Smoke check failed',
        created_at: '2026-06-07T00:00:00.000Z',
        data: { href: '/dashboard/accounting/health', severity: 'critical' },
      },
    ]));

    const summary = await getSystemMonitorSummary('2026-06-01');

    expect(summary.overall_status).toBe('critical');
    expect(summary.quick_metrics.cron_smoke_open_alerts).toBe(1);
    expect(summary.open_alerts[0]).toEqual(expect.objectContaining({
      id: 'notif-1',
      href: '/dashboard/accounting/health',
      severity: 'critical',
    }));
  });

  it('raises critical status when a business rule production alert is still open', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder([
      {
        id: 'notif-rule-1',
        type: 'business_rule_health_alert',
        title: 'Rule engine production can xu ly',
        message: 'Business rule guard phat hien 1 loi nghiem trong.',
        created_at: '2026-06-08T00:00:00.000Z',
        data: { href: '/dashboard/system-monitor', severity: 'critical' },
      },
    ]));

    const summary = await getSystemMonitorSummary('2026-06-01');

    expect(summary.overall_status).toBe('critical');
    expect(summary.quick_metrics.business_rule_open_alerts).toBe(1);
    expect(summary.open_alerts[0]).toEqual(expect.objectContaining({
      id: 'notif-rule-1',
      href: '/dashboard/system-monitor',
      severity: 'critical',
    }));
    expect(summary.sections.find((section) => section.id === 'data')?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'business-rule-production-alerts',
          status: 'critical',
          value: '1',
        }),
      ])
    );
  });

  it('surfaces tenant isolation issues as a dedicated data check', async () => {
    mockGetBusinessHealthSummary.mockResolvedValue({
      ...healthyBusinessSummary(),
      severity: 'critical',
      critical_count: 2,
      can_operate_cleanly: false,
      groups: [
        {
          id: 'tenant_data_isolation',
          label: 'Cách ly dữ liệu chi nhánh',
          description: 'Booking, khách hàng và ca liệu trình phải cùng tenant.',
          status: 'fail',
          critical_count: 2,
          warning_count: 0,
          checked_count: 1,
          href: '/dashboard/accounting/health',
          action_label: 'Xem lỗi dữ liệu',
        },
      ],
    });

    const summary = await getSystemMonitorSummary('2026-06-01');

    expect(summary.overall_status).toBe('critical');
    expect(summary.quick_metrics.tenant_isolation_issues).toBe(2);
    expect(summary.sections.find((section) => section.id === 'data')?.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'tenant-data-isolation',
          status: 'critical',
          value: '2',
        }),
      ])
    );
  });

  it('propagates system alert query failures instead of returning a fake healthy state', async () => {
    mockFrom.mockReturnValue(new MockQueryBuilder(null, { message: 'app notifications denied' }));

    await expect(getSystemMonitorSummary('2026-06-01')).rejects.toThrow(
      /app notifications denied/
    );
  });
});
