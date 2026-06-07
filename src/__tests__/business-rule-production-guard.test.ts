const {
  buildBusinessRuleFailureDedupeKey,
  buildBusinessRuleFailureNotificationPayload,
  createBusinessRuleFailureNotification,
  getBusinessRuleGuardConfig,
  runBusinessRuleProductionGuard,
} = require('../../scripts/check-business-rule-production-guard.cjs');

function mockJsonResponse(body: unknown, ok = true, status = ok ? 200 : 500) {
  return {
    ok,
    status,
    text: jest.fn().mockResolvedValue(JSON.stringify(body)),
  };
}

const COMPLETE_CONFIG = {
  isConfigured: true,
  missing: [],
  alertTenantId: 'tenant-alert',
  supabaseUrl: 'https://test.supabase.co',
  serviceRoleKey: 'service-role-key',
  maxRows: 20000,
  failOnWarning: false,
};

const FAILING_INVARIANT_RUN = {
  datasetCounts: {
    bookings: 2,
    revenue: 1,
  },
  context: {
    monthDate: '2026-06-01',
  },
  results: [
    {
      name: 'booking_financial_integrity',
      ok: false,
      criticalCount: 1,
      warningCount: 0,
      findings: [
        {
          severity: 'critical',
          code: 'portal_deposit_qr_should_be_closed',
          message: 'Confirmed deposit is already recorded.',
          recordId: 'booking-me-tien',
          sourceTable: 'bookings',
        },
      ],
    },
    {
      name: 'salary',
      ok: true,
      criticalCount: 0,
      warningCount: 1,
      findings: [
        {
          severity: 'warning',
          code: 'draft_salary_session_count_drift',
          message: 'Draft salary sessions drift.',
          recordId: 'salary-1',
          sourceTable: 'salary_records',
        },
      ],
    },
  ],
};

describe('business rule production guard script', () => {
  it('resolves production guard config from supported env names', () => {
    const config = getBusinessRuleGuardConfig({
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'service-role-key',
      BUSINESS_RULE_ALERT_TENANT_ID: 'tenant-business',
      BUSINESS_RULE_GUARD_FAIL_ON_WARNING: '1',
      DB_BUSINESS_INVARIANT_MAX_ROWS: '25000',
    });

    expect(config).toEqual(expect.objectContaining({
      isConfigured: true,
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'service-role-key',
      alertTenantId: 'tenant-business',
      failOnWarning: true,
      maxRows: 25000,
    }));
  });

  it('falls back to the accounting alert tenant when a business tenant is not set', () => {
    const config = getBusinessRuleGuardConfig({
      SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
      ACCOUNTING_ALERT_TENANT_ID: 'tenant-accounting',
    });

    expect(config.alertTenantId).toBe('tenant-accounting');
  });

  it('runs invariant checks and summarizes unhealthy production data', async () => {
    const runInvariantChecksImpl = jest.fn().mockResolvedValue(FAILING_INVARIANT_RUN);

    const result = await runBusinessRuleProductionGuard({
      config: COMPLETE_CONFIG,
      fetchImpl: jest.fn(),
      now: new Date('2026-06-08T00:00:00.000Z'),
      runInvariantChecksImpl,
    });

    expect(runInvariantChecksImpl).toHaveBeenCalledWith(expect.objectContaining({
      supabaseUrl: COMPLETE_CONFIG.supabaseUrl,
      serviceRoleKey: COMPLETE_CONFIG.serviceRoleKey,
      maxRows: 20000,
    }));
    expect(result.summary).toEqual(expect.objectContaining({
      checked: 2,
      criticalCount: 1,
      warningCount: 1,
      isHealthy: false,
    }));
  });

  it('builds a daily dedupe key from failing rule groups', () => {
    const summary = {
      failedChecks: [
        { name: 'salary' },
        { name: 'booking_financial_integrity' },
      ],
    };

    expect(buildBusinessRuleFailureDedupeKey({
      summary,
      now: new Date('2026-06-08T02:00:00.000Z'),
    })).toBe('business_rule_production_guard:2026-06-08:booking_financial_integrity+salary');
  });

  it('builds notification payload with top findings and monitor links', () => {
    const summary = {
      checked: 2,
      criticalCount: 1,
      warningCount: 1,
      failedChecks: [{ name: 'booking_financial_integrity' }],
    };

    const payload = buildBusinessRuleFailureNotificationPayload({
      tenantId: 'tenant-alert',
      config: COMPLETE_CONFIG,
      invariantRun: FAILING_INVARIANT_RUN,
      summary,
      now: new Date('2026-06-08T02:00:00.000Z'),
    });

    expect(payload).toEqual(expect.objectContaining({
      tenant_id: 'tenant-alert',
      type: 'business_rule_health_alert',
      is_read: false,
    }));
    expect(payload.data).toEqual(expect.objectContaining({
      severity: 'critical',
      href: '/dashboard/system-monitor',
      accounting_health_href: '/dashboard/accounting/health',
      critical_count: 1,
      warning_count: 1,
      month_date: '2026-06-01',
    }));
    expect(payload.data.top_findings).toEqual([
      expect.objectContaining({
        group: 'booking_financial_integrity',
        code: 'portal_deposit_qr_should_be_closed',
      }),
      expect.objectContaining({
        group: 'salary',
        code: 'draft_salary_session_count_drift',
      }),
    ]);
  });

  it('creates an app notification when the production guard fails', async () => {
    const summary = {
      checked: 2,
      criticalCount: 1,
      warningCount: 0,
      failedChecks: [{ name: 'booking_financial_integrity' }],
    };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse([{ id: 'notif-1' }]));

    const result = await createBusinessRuleFailureNotification({
      config: COMPLETE_CONFIG,
      invariantRun: FAILING_INVARIANT_RUN,
      summary,
      fetchImpl: fetchMock,
      now: new Date('2026-06-08T02:00:00.000Z'),
    });

    expect(result).toEqual(expect.objectContaining({
      created: true,
      notificationId: 'notif-1',
      tenantId: 'tenant-alert',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(1, expect.stringContaining('/rest/v1/app_notifications?'), expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer service-role-key',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, 'https://test.supabase.co/rest/v1/app_notifications', expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Prefer: 'return=representation',
      }),
      body: expect.stringContaining('business_rule_health_alert'),
    }));
  });

  it('does not insert a duplicate unread notification for the same daily failure', async () => {
    const summary = {
      checked: 2,
      criticalCount: 1,
      warningCount: 0,
      failedChecks: [{ name: 'booking_financial_integrity' }],
    };
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse([{ id: 'notif-existing' }]));

    const result = await createBusinessRuleFailureNotification({
      config: COMPLETE_CONFIG,
      invariantRun: FAILING_INVARIANT_RUN,
      summary,
      fetchImpl: fetchMock,
      now: new Date('2026-06-08T02:00:00.000Z'),
    });

    expect(result).toEqual(expect.objectContaining({
      created: false,
      notificationId: 'notif-existing',
      tenantId: 'tenant-alert',
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
