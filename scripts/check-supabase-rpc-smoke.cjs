const DEFAULT_RPC_SMOKE_CHECKS = [
  {
    name: 'get_accounting_readiness',
    reason: 'accounting readiness dashboard',
    args: ({ tenantId }) => ({ p_tenant_id: tenantId }),
  },
  {
    name: 'preview_legacy_ledger_sync',
    reason: 'legacy-to-ledger activation preview',
    args: ({ tenantId }) => ({ p_tenant_id: tenantId }),
  },
  {
    name: 'get_reconciliation_report',
    reason: 'legacy versus ledger reconciliation',
    args: ({ tenantId, fromDate, toDate }) => ({
      p_tenant_id: tenantId,
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  },
  {
    name: 'get_salary_reconciliation_report',
    reason: 'KTV salary reconciliation',
    args: ({ tenantId, monthDate }) => ({
      p_tenant_id: tenantId,
      p_month_year: monthDate,
    }),
  },
  {
    name: 'get_ktv_leaderboard',
    reason: 'KTV leaderboard and rating metrics',
    args: ({ tenantId, monthDate }) => ({
      p_tenant_id: tenantId,
      p_month: monthDate,
    }),
  },
  {
    name: 'get_trial_balance',
    reason: 'TT133 trial balance report',
    args: ({ tenantId, toDate }) => ({
      p_tenant_id: tenantId,
      p_as_of_date: toDate,
    }),
  },
  {
    name: 'get_income_statement',
    reason: 'TT133 income statement report',
    args: ({ tenantId, fromDate, toDate }) => ({
      p_tenant_id: tenantId,
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  },
  {
    name: 'get_cash_flow_statement',
    reason: 'TT133 cash flow report',
    args: ({ tenantId, fromDate, toDate }) => ({
      p_tenant_id: tenantId,
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  },
  {
    name: 'get_consolidated_pnl',
    reason: 'HQ consolidated network P&L',
    args: ({ fromDate, toDate }) => ({
      p_from_date: fromDate,
      p_to_date: toDate,
    }),
  },
];

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getSupabaseCredentials(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  const missing = [];

  if (!supabaseUrl) {
    missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    missing.push('SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY');
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    missing,
    isConfigured: missing.length === 0,
  };
}

function getSmokeDateContext(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const fromDate = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 10);
  const toDate = new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

  return {
    fromDate,
    toDate,
    monthDate: fromDate,
  };
}

function parseResponseError(bodyText) {
  if (!bodyText) {
    return 'No response body returned.';
  }

  try {
    const parsed = JSON.parse(bodyText);
    return [parsed.message, parsed.details, parsed.hint, parsed.code].filter(Boolean).join(' | ');
  } catch {
    return bodyText;
  }
}

function buildRestUrl(supabaseUrl, path, query = '') {
  const base = `${trimTrailingSlash(supabaseUrl)}/rest/v1/${path}`;
  return query ? `${base}?${query}` : base;
}

function getHeaders(serviceRoleKey) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
    apikey: serviceRoleKey,
  };
}

async function fetchJsonOrThrow(fetchImpl, url, options, label) {
  const response = await fetchImpl(url, options);
  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`${label} failed (${response.status}): ${parseResponseError(bodyText)}`);
  }

  if (!bodyText) {
    return null;
  }

  return JSON.parse(bodyText);
}

async function fetchSmokeTenant({ supabaseUrl, serviceRoleKey, fetchImpl = globalThis.fetch }) {
  const headers = getHeaders(serviceRoleKey);
  const activeUrl = buildRestUrl(
    supabaseUrl,
    'tenants',
    'select=id,name,status&status=eq.active&order=created_at.asc&limit=1'
  );
  let rows = await fetchJsonOrThrow(fetchImpl, activeUrl, { method: 'GET', headers }, 'tenant lookup');

  if (!Array.isArray(rows) || rows.length === 0) {
    const fallbackUrl = buildRestUrl(supabaseUrl, 'tenants', 'select=id,name,status&order=created_at.asc&limit=1');
    rows = await fetchJsonOrThrow(fetchImpl, fallbackUrl, { method: 'GET', headers }, 'tenant fallback lookup');
  }

  if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.id) {
    throw new Error('No tenant found for RPC smoke checks.');
  }

  return rows[0];
}

async function callRpc({ supabaseUrl, serviceRoleKey, fn, args, fetchImpl = globalThis.fetch }) {
  const url = buildRestUrl(supabaseUrl, `rpc/${encodeURIComponent(fn)}`);
  const data = await fetchJsonOrThrow(
    fetchImpl,
    url,
    {
      method: 'POST',
      headers: getHeaders(serviceRoleKey),
      body: JSON.stringify(args || {}),
    },
    `rpc ${fn}`
  );

  return data;
}

async function runRpcSmokeChecks({
  supabaseUrl,
  serviceRoleKey,
  checks = DEFAULT_RPC_SMOKE_CHECKS,
  fetchImpl = globalThis.fetch,
  now = new Date(),
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime.');
  }

  const tenant = await fetchSmokeTenant({ supabaseUrl, serviceRoleKey, fetchImpl });
  const context = {
    tenantId: tenant.id,
    tenant,
    ...getSmokeDateContext(now),
  };
  const results = [];

  for (const check of checks) {
    try {
      const args = typeof check.args === 'function' ? check.args(context) : check.args || {};
      const data = await callRpc({
        supabaseUrl,
        serviceRoleKey,
        fn: check.name,
        args,
        fetchImpl,
      });

      results.push({
        name: check.name,
        reason: check.reason,
        ok: true,
        rowCount: Array.isArray(data) ? data.length : data === null ? 0 : 1,
        error: null,
      });
    } catch (error) {
      results.push({
        name: check.name,
        reason: check.reason,
        ok: false,
        rowCount: 0,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    tenant,
    context,
    results,
  };
}

function summarizeRpcSmokeResults(results) {
  const failed = results.filter((result) => !result.ok);

  return {
    checked: results.length,
    passed: results.length - failed.length,
    failed,
    isHealthy: failed.length === 0,
  };
}

function printResults(results) {
  for (const result of results) {
    if (result.ok) {
      console.log(`[OK] ${result.name} (${result.rowCount} rows)`);
      continue;
    }

    console.error(`[FAIL] ${result.name}: ${result.error}`);
  }
}

async function main() {
  const optional = process.env.DB_RPC_SMOKE_OPTIONAL === '1';
  const credentials = getSupabaseCredentials();

  if (!credentials.isConfigured) {
    const message = `Supabase RPC smoke missing config: ${credentials.missing.join(', ')}.`;
    if (optional) {
      console.log(`${message} Skipping because DB_RPC_SMOKE_OPTIONAL=1.`);
      return;
    }

    console.error(message);
    process.exit(1);
  }

  let smoke;
  try {
    smoke = await runRpcSmokeChecks(credentials);
  } catch (error) {
    console.error('Could not run Supabase RPC smoke checks.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log(`RPC smoke tenant: ${smoke.tenant.name || smoke.tenant.id}`);
  console.log(`RPC smoke period: ${smoke.context.fromDate} -> ${smoke.context.toDate}`);
  printResults(smoke.results);

  const summary = summarizeRpcSmokeResults(smoke.results);
  if (!summary.isHealthy) {
    console.error(`Supabase RPC smoke failed: ${summary.failed.length}/${summary.checked} RPC checks failed.`);
    process.exit(1);
  }

  console.log(`Supabase RPC smoke passed: ${summary.passed}/${summary.checked} RPC checks passed.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_RPC_SMOKE_CHECKS,
  buildRestUrl,
  callRpc,
  fetchSmokeTenant,
  getSmokeDateContext,
  getSupabaseCredentials,
  parseResponseError,
  runRpcSmokeChecks,
  summarizeRpcSmokeResults,
};
