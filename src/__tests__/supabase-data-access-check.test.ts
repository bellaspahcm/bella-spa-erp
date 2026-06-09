const {
  DEFAULT_DATA_ACCESS_CHECKS,
  buildTableReadUrl,
  checkTableReadAccess,
  getSupabaseCredentials,
  parseResponseError,
  summarizeAccessResults,
} = require('../../scripts/check-supabase-data-access.cjs');

describe('Supabase data access smoke check script', () => {
  it('includes inventory transfer orders in default table checks', () => {
    expect(DEFAULT_DATA_ACCESS_CHECKS).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'inventory_transfer_orders',
          reason: expect.stringContaining('transfer orders'),
        }),
      ])
    );
  });

  it('resolves Supabase URL and service role credentials', () => {
    const credentials = getSupabaseCredentials({
      SUPABASE_URL: 'https://bella.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    });

    expect(credentials.isConfigured).toBe(true);
    expect(credentials.supabaseUrl).toBe('https://bella.supabase.co');
    expect(credentials.serviceRoleKey).toBe('service-role-key');
    expect(credentials.missing).toEqual([]);
  });

  it('reports missing data access configuration', () => {
    const credentials = getSupabaseCredentials({});

    expect(credentials.isConfigured).toBe(false);
    expect(credentials.missing).toEqual([
      'SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY',
    ]);
  });

  it('builds a minimal PostgREST table read URL', () => {
    expect(buildTableReadUrl('https://bella.supabase.co/', 'inter_branch_clearing_records')).toBe(
      'https://bella.supabase.co/rest/v1/inter_branch_clearing_records?select=id&limit=1'
    );
  });

  it('parses PostgREST error payloads without leaking credentials', () => {
    expect(
      parseResponseError(
        JSON.stringify({
          message: 'permission denied for table inter_branch_clearing_records',
          code: '42501',
        })
      )
    ).toBe('permission denied for table inter_branch_clearing_records | 42501');
  });

  it('detects a failed table permission check', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () =>
        JSON.stringify({
          message: 'permission denied for table inter_branch_clearing_records',
          code: '42501',
        }),
    });

    const results = await checkTableReadAccess({
      supabaseUrl: 'https://bella.supabase.co',
      serviceRoleKey: 'service-role-key',
      checks: [{ table: 'inter_branch_clearing_records', reason: 'clearing' }],
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://bella.supabase.co/rest/v1/inter_branch_clearing_records?select=id&limit=1',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Authorization: 'Bearer service-role-key',
          apikey: 'service-role-key',
        }),
      })
    );
    expect(results).toEqual([
      {
        table: 'inter_branch_clearing_records',
        reason: 'clearing',
        status: 401,
        ok: false,
        error: 'permission denied for table inter_branch_clearing_records | 42501',
      },
    ]);
    expect(summarizeAccessResults(results)).toEqual({
      checked: 1,
      passed: 0,
      failed: results,
      isHealthy: false,
    });
  });

  it('summarizes a healthy smoke run', () => {
    const results = [
      { table: 'revenue', ok: true, status: 200, reason: 'revenue', error: null },
      { table: 'salary_records', ok: true, status: 200, reason: 'salary', error: null },
    ];

    expect(summarizeAccessResults(results)).toEqual({
      checked: 2,
      passed: 2,
      failed: [],
      isHealthy: true,
    });
  });
});
