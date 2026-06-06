const DEFAULT_DATA_ACCESS_CHECKS = [
  { table: 'customers', reason: 'customer debt and booking lookup' },
  { table: 'bookings', reason: 'booking, package, and portal payment state' },
  { table: 'revenue', reason: 'confirmed payment and revenue recognition' },
  { table: 'expenses', reason: 'approved or paid operating cost reporting' },
  { table: 'salary_records', reason: 'KTV salary posting and reconciliation' },
  { table: 'session_logs', reason: 'completed session and earned revenue tracking' },
  { table: 'inventory_logs', reason: 'inventory consumption audit trail' },
  { table: 'journal_entries', reason: 'TT133 ledger header reporting' },
  { table: 'journal_lines', reason: 'TT133 ledger line reporting' },
  { table: 'accounting_outbox', reason: 'accounting event delivery safety' },
  { table: 'accounting_review_queue', reason: 'manual accounting review workflow' },
  { table: 'inter_branch_clearing_records', reason: 'inter-branch clearing reconciliation' },
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

function buildTableReadUrl(supabaseUrl, table, select = 'id') {
  const params = new URLSearchParams({
    select,
    limit: '1',
  });

  return `${trimTrailingSlash(supabaseUrl)}/rest/v1/${encodeURIComponent(table)}?${params.toString()}`;
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

async function checkTableReadAccess({
  supabaseUrl,
  serviceRoleKey,
  checks = DEFAULT_DATA_ACCESS_CHECKS,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime.');
  }

  const results = [];

  for (const check of checks) {
    const response = await fetchImpl(buildTableReadUrl(supabaseUrl, check.table, check.select || 'id'), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${serviceRoleKey}`,
        apikey: serviceRoleKey,
      },
    });

    const bodyText = await response.text().catch(() => '');
    results.push({
      table: check.table,
      reason: check.reason,
      status: response.status,
      ok: response.ok,
      error: response.ok ? null : parseResponseError(bodyText),
    });
  }

  return results;
}

function summarizeAccessResults(results) {
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
      console.log(`[OK] ${result.table}`);
      continue;
    }

    console.error(`[FAIL] ${result.table} (${result.status}): ${result.error}`);
  }
}

async function main() {
  const optional = process.env.DB_ACCESS_CHECK_OPTIONAL === '1';
  const credentials = getSupabaseCredentials();

  if (!credentials.isConfigured) {
    const message = `Supabase data access check missing config: ${credentials.missing.join(', ')}.`;
    if (optional) {
      console.log(`${message} Skipping because DB_ACCESS_CHECK_OPTIONAL=1.`);
      return;
    }

    console.error(message);
    process.exit(1);
  }

  let results;
  try {
    results = await checkTableReadAccess(credentials);
  } catch (error) {
    console.error('Could not run Supabase data access smoke check.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  printResults(results);
  const summary = summarizeAccessResults(results);

  if (!summary.isHealthy) {
    console.error(
      `Supabase data access smoke failed: ${summary.failed.length}/${summary.checked} table checks failed.`
    );
    process.exit(1);
  }

  console.log(`Supabase data access smoke passed: ${summary.passed}/${summary.checked} table checks passed.`);
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_DATA_ACCESS_CHECKS,
  buildTableReadUrl,
  checkTableReadAccess,
  getSupabaseCredentials,
  parseResponseError,
  summarizeAccessResults,
};
