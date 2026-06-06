const {
  buildRestUrl,
  fetchSmokeTenant,
  getSmokeDateContext,
  getSupabaseCredentials,
  parseResponseError,
  runRpcSmokeChecks,
  summarizeRpcSmokeResults,
} = require('../../scripts/check-supabase-rpc-smoke.cjs');

describe('Supabase RPC smoke check script', () => {
  it('resolves Supabase credentials', () => {
    const credentials = getSupabaseCredentials({
      NEXT_PUBLIC_SUPABASE_URL: 'https://bella.supabase.co',
      SUPABASE_SECRET_KEY: 'service-role-key',
    });

    expect(credentials).toEqual({
      supabaseUrl: 'https://bella.supabase.co',
      serviceRoleKey: 'service-role-key',
      missing: [],
      isConfigured: true,
    });
  });

  it('builds REST URLs and stable date context', () => {
    expect(buildRestUrl('https://bella.supabase.co/', 'rpc/get_trial_balance')).toBe(
      'https://bella.supabase.co/rest/v1/rpc/get_trial_balance'
    );
    expect(getSmokeDateContext(new Date(Date.UTC(2026, 5, 6)))).toEqual({
      fromDate: '2026-06-01',
      toDate: '2026-06-06',
      monthDate: '2026-06-01',
    });
  });

  it('parses PostgREST error payloads', () => {
    expect(
      parseResponseError(
        JSON.stringify({
          message: 'Unauthorized',
          details: 'service role context missing',
          code: 'P0001',
        })
      )
    ).toBe('Unauthorized | service role context missing | P0001');
  });

  it('fetches the first active tenant', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify([{ id: 'tenant-1', name: 'Bella', status: 'active' }]),
    });

    await expect(
      fetchSmokeTenant({
        supabaseUrl: 'https://bella.supabase.co',
        serviceRoleKey: 'service-role-key',
        fetchImpl,
      })
    ).resolves.toEqual({ id: 'tenant-1', name: 'Bella', status: 'active' });
  });

  it('falls back to any tenant when no active tenant exists', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 'tenant-2', name: 'Fallback', status: 'suspended' }]),
      });

    const tenant = await fetchSmokeTenant({
      supabaseUrl: 'https://bella.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl,
    });

    expect(tenant.id).toBe('tenant-2');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('runs configured RPC smoke checks with tenant and date args', async () => {
    const fetchImpl = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ id: 'tenant-1', name: 'Bella', status: 'active' }]),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify([{ source_table: 'revenue' }]),
      });

    const smoke = await runRpcSmokeChecks({
      supabaseUrl: 'https://bella.supabase.co',
      serviceRoleKey: 'service-role-key',
      fetchImpl,
      now: new Date(Date.UTC(2026, 5, 6)),
      checks: [
        {
          name: 'get_accounting_readiness',
          reason: 'readiness',
          args: ({ tenantId, fromDate }) => ({ p_tenant_id: tenantId, p_from_date: fromDate }),
        },
      ],
    });

    expect(smoke.context).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        fromDate: '2026-06-01',
        toDate: '2026-06-06',
      })
    );
    expect(smoke.results).toEqual([
      {
        name: 'get_accounting_readiness',
        reason: 'readiness',
        ok: true,
        rowCount: 1,
        error: null,
      },
    ]);
    expect(fetchImpl).toHaveBeenLastCalledWith(
      'https://bella.supabase.co/rest/v1/rpc/get_accounting_readiness',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ p_tenant_id: 'tenant-1', p_from_date: '2026-06-01' }),
      })
    );
  });

  it('summarizes failed RPC smoke checks', () => {
    const results = [
      { name: 'ok_rpc', ok: true, rowCount: 1, reason: 'ok', error: null },
      { name: 'bad_rpc', ok: false, rowCount: 0, reason: 'bad', error: 'failed' },
    ];

    expect(summarizeRpcSmokeResults(results)).toEqual({
      checked: 2,
      passed: 1,
      failed: [results[1]],
      isHealthy: false,
    });
  });
});
