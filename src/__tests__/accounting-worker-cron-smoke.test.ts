const {
  assertWorkerResponseHealthy,
  buildAppNotificationDedupeQueryUrl,
  buildWorkerRunsQueryUrl,
  createCronFailureNotification,
  getCronSmokeConfig,
  normalizeBaseUrl,
  runAccountingWorkerCronSmoke,
} = require('../../scripts/check-accounting-worker-cron-smoke.cjs');

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
  baseUrl: 'https://bella-spa-erp.vercel.app',
  cronUrl: 'https://bella-spa-erp.vercel.app/api/cron/accounting-worker',
  cronSecret: 'cron-secret',
  vercelBypassSecret: '',
  alertTenantId: 'tenant-alert',
  supabaseUrl: 'https://test.supabase.co',
  serviceRoleKey: 'service-role-key',
};

describe('accounting worker cron smoke script', () => {
  it('normalizes production URLs without a scheme', () => {
    expect(normalizeBaseUrl('bella-spa-erp.vercel.app/')).toBe('https://bella-spa-erp.vercel.app');
    expect(normalizeBaseUrl('https://bella-spa-erp.vercel.app/')).toBe('https://bella-spa-erp.vercel.app');
  });

  it('resolves required config from supported env names', () => {
    const config = getCronSmokeConfig({
      ACCOUNTING_WORKER_BASE_URL: 'bella-spa-erp.vercel.app',
      CRON_SECRET: 'cron-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'service-role-key',
    });

    expect(config).toEqual(expect.objectContaining({
      isConfigured: true,
      cronUrl: 'https://bella-spa-erp.vercel.app/api/cron/accounting-worker',
      alertTenantId: '',
      supabaseUrl: 'https://test.supabase.co',
      serviceRoleKey: 'service-role-key',
    }));
  });

  it('resolves the optional tenant id for app alert notifications', () => {
    const config = getCronSmokeConfig({
      ACCOUNTING_WORKER_BASE_URL: 'bella-spa-erp.vercel.app',
      ACCOUNTING_ALERT_TENANT_ID: 'tenant-hq',
      CRON_SECRET: 'cron-secret',
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      SUPABASE_SECRET_KEY: 'service-role-key',
    });

    expect(config).toEqual(expect.objectContaining({
      isConfigured: true,
      alertTenantId: 'tenant-hq',
    }));
  });

  it('allows partial_failure responses when the worker still persisted its run log', () => {
    expect(assertWorkerResponseHealthy({
      success: false,
      status: 'partial_failure',
      processed: 2,
      failureCount: 1,
      workerRunLogged: true,
    })).toEqual(expect.objectContaining({
      status: 'partial_failure',
      processed: 2,
      failureCount: 1,
    }));
  });

  it('rejects worker responses that do not confirm persisted run logging', () => {
    expect(() => assertWorkerResponseHealthy({
      success: true,
      status: 'success',
      processed: 0,
      workerRunLogged: false,
    })).toThrow(/workerRunLogged=true/);
  });

  it('builds the accounting_worker_runs query with a since guard', () => {
    const url = buildWorkerRunsQueryUrl('https://test.supabase.co/', '2026-06-07T00:00:00.000Z');

    expect(url).toContain('/rest/v1/accounting_worker_runs?');
    expect(url).toContain('started_at=gte.2026-06-07T00%3A00%3A00.000Z');
    expect(url).toContain('order=started_at.desc');
    expect(url).toContain('limit=1');
  });

  it('builds the app notification dedupe query with json containment', () => {
    const url = buildAppNotificationDedupeQueryUrl(
      'https://test.supabase.co/',
      'tenant-alert',
      'accounting_worker_cron_alert',
      'dedupe-1'
    );

    expect(url).toContain('/rest/v1/app_notifications?');
    expect(url).toContain('tenant_id=eq.tenant-alert');
    expect(url).toContain('type=eq.accounting_worker_cron_alert');
    expect(url).toContain('is_read=eq.false');
    expect(decodeURIComponent(url)).toContain('data=cs.{"dedupe_key":"dedupe-1"}');
  });

  it('calls the cron endpoint and verifies a fresh worker run row exists', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse({
        success: true,
        status: 'success',
        processed: 0,
        workerRunLogged: true,
      }))
      .mockResolvedValueOnce(mockJsonResponse([
        {
          id: 'worker-run-1',
          status: 'success',
          started_at: '2026-06-07T00:00:01.000Z',
          finished_at: '2026-06-07T00:00:02.000Z',
          claimed_count: 0,
          success_count: 0,
          dead_letter_count: 0,
          failure_count: 0,
          critical_failure_count: 0,
          error: null,
        },
      ]));

    const result = await runAccountingWorkerCronSmoke({
      config: COMPLETE_CONFIG,
      fetchImpl: fetchMock,
      now: new Date('2026-06-07T00:01:00.000Z'),
    });

    expect(result.latestRun).toEqual(expect.objectContaining({
      id: 'worker-run-1',
      status: 'success',
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(1, COMPLETE_CONFIG.cronUrl, expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer cron-secret',
      }),
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, expect.stringContaining('/rest/v1/accounting_worker_runs?'), expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({
        Authorization: 'Bearer service-role-key',
        apikey: 'service-role-key',
      }),
    }));
  });

  it('creates an app notification when production cron smoke fails', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse([]))
      .mockResolvedValueOnce(mockJsonResponse([{ id: 'notif-1' }]));

    const result = await createCronFailureNotification({
      config: COMPLETE_CONFIG,
      fetchImpl: fetchMock,
      now: new Date('2026-06-07T02:00:00.000Z'),
      error: new Error('Accounting worker endpoint failed (500): timeout'),
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
      body: expect.stringContaining('Accounting worker endpoint failed'),
    }));
  });

  it('does not insert a duplicate app notification for the same daily cron failure', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(mockJsonResponse([{ id: 'notif-existing' }]));

    const result = await createCronFailureNotification({
      config: COMPLETE_CONFIG,
      fetchImpl: fetchMock,
      now: new Date('2026-06-07T02:00:00.000Z'),
      error: new Error('Accounting worker endpoint failed (500): timeout'),
    });

    expect(result).toEqual(expect.objectContaining({
      created: false,
      notificationId: 'notif-existing',
      tenantId: 'tenant-alert',
    }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
