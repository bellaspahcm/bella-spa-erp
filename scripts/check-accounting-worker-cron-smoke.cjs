function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function normalizeBaseUrl(value) {
  const raw = trimTrailingSlash(value);
  if (!raw) return '';
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

function getSupabaseCredentials(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SECRET_KEY || '';
  const missing = [];

  if (!supabaseUrl) {
    missing.push('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL');
  }

  if (!serviceRoleKey) {
    missing.push('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY');
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    missing,
    isConfigured: missing.length === 0,
  };
}

function getCronSmokeConfig(env = process.env) {
  const baseUrl = normalizeBaseUrl(
    env.ACCOUNTING_WORKER_BASE_URL ||
    env.PRODUCTION_BASE_URL ||
    env.NEXT_PUBLIC_APP_URL ||
    env.E2E_BASE_URL ||
    env.VERCEL_PROJECT_PRODUCTION_URL ||
    env.VERCEL_URL ||
    ''
  );
  const cronSecret = env.CRON_SECRET || '';
  const vercelBypassSecret =
    env.E2E_VERCEL_AUTOMATION_BYPASS_SECRET ||
    env.VERCEL_AUTOMATION_BYPASS_SECRET ||
    '';
  const supabase = getSupabaseCredentials(env);
  const missing = [...supabase.missing];

  if (!baseUrl) {
    missing.push('ACCOUNTING_WORKER_BASE_URL or PRODUCTION_BASE_URL or NEXT_PUBLIC_APP_URL or E2E_BASE_URL');
  }

  if (!cronSecret) {
    missing.push('CRON_SECRET');
  }

  return {
    ...supabase,
    baseUrl,
    cronSecret,
    vercelBypassSecret,
    cronUrl: baseUrl ? `${baseUrl}/api/cron/accounting-worker` : '',
    missing,
    isConfigured: missing.length === 0,
  };
}

function parseResponseBody(bodyText) {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
}

function parseResponseError(bodyText) {
  const parsed = parseResponseBody(bodyText);
  if (!parsed) return 'No response body returned.';
  if (typeof parsed === 'string') return parsed;
  return [parsed.error, parsed.message, parsed.details, parsed.hint, parsed.code]
    .filter(Boolean)
    .join(' | ') || JSON.stringify(parsed);
}

function getCronHeaders({ cronSecret, vercelBypassSecret }) {
  const headers = {
    Accept: 'application/json',
    Authorization: `Bearer ${cronSecret}`,
  };

  if (vercelBypassSecret) {
    headers['x-vercel-protection-bypass'] = vercelBypassSecret;
  }

  return headers;
}

function getSupabaseHeaders(serviceRoleKey) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${serviceRoleKey}`,
    apikey: serviceRoleKey,
  };
}

function buildWorkerRunsQueryUrl(supabaseUrl, sinceIso) {
  const params = new URLSearchParams({
    select: 'id,status,started_at,finished_at,claimed_count,success_count,dead_letter_count,failure_count,critical_failure_count,error',
    started_at: `gte.${sinceIso}`,
    order: 'started_at.desc',
    limit: '1',
  });

  return `${trimTrailingSlash(supabaseUrl)}/rest/v1/accounting_worker_runs?${params.toString()}`;
}

function assertWorkerResponseHealthy(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Accounting worker returned an invalid JSON response.');
  }

  if (body.workerRunLogged !== true) {
    throw new Error(`Accounting worker did not confirm workerRunLogged=true. Response: ${JSON.stringify(body)}`);
  }

  if (['claim_failed', 'critical_failure', 'exception'].includes(body.status)) {
    throw new Error(`Accounting worker returned infrastructure failure status "${body.status}".`);
  }

  return {
    status: body.status || 'success',
    success: body.success !== false,
    processed: Number(body.processed || 0),
    failureCount: Number(body.failureCount || 0),
    criticalFailureCount: Number(body.criticalFailureCount || 0),
  };
}

async function callAccountingWorker({ cronUrl, cronSecret, vercelBypassSecret, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(cronUrl, {
    method: 'GET',
    headers: getCronHeaders({ cronSecret, vercelBypassSecret }),
  });
  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`Accounting worker endpoint failed (${response.status}): ${parseResponseError(bodyText)}`);
  }

  const body = parseResponseBody(bodyText);
  const summary = assertWorkerResponseHealthy(body);

  return {
    body,
    summary,
  };
}

async function fetchLatestWorkerRunSince({
  supabaseUrl,
  serviceRoleKey,
  sinceIso,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(buildWorkerRunsQueryUrl(supabaseUrl, sinceIso), {
    method: 'GET',
    headers: getSupabaseHeaders(serviceRoleKey),
  });
  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`accounting_worker_runs lookup failed (${response.status}): ${parseResponseError(bodyText)}`);
  }

  const rows = parseResponseBody(bodyText);
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error(`No accounting_worker_runs row found at or after ${sinceIso}.`);
  }

  return rows[0];
}

async function runAccountingWorkerCronSmoke({
  config = getCronSmokeConfig(),
  fetchImpl = globalThis.fetch,
  now = new Date(),
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime.');
  }

  if (!config.isConfigured) {
    throw new Error(`Accounting worker cron smoke missing config: ${config.missing.join(', ')}.`);
  }

  const sinceIso = new Date(now.getTime() - 60 * 1000).toISOString();
  const workerResult = await callAccountingWorker({
    cronUrl: config.cronUrl,
    cronSecret: config.cronSecret,
    vercelBypassSecret: config.vercelBypassSecret,
    fetchImpl,
  });
  const latestRun = await fetchLatestWorkerRunSince({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
    sinceIso,
    fetchImpl,
  });

  return {
    sinceIso,
    worker: workerResult.summary,
    latestRun,
  };
}

async function main() {
  const config = getCronSmokeConfig();

  try {
    const result = await runAccountingWorkerCronSmoke({ config });
    console.log('[OK] Accounting worker endpoint responded and persisted a worker run log.');
    console.log(`[OK] Worker status: ${result.worker.status}; processed=${result.worker.processed}; failures=${result.worker.failureCount}.`);
    console.log(`[OK] Latest worker run: ${result.latestRun.id} (${result.latestRun.status}) at ${result.latestRun.started_at}.`);
  } catch (error) {
    console.error('[FAIL] Accounting worker cron smoke failed.');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertWorkerResponseHealthy,
  buildWorkerRunsQueryUrl,
  callAccountingWorker,
  fetchLatestWorkerRunSince,
  getCronSmokeConfig,
  getSupabaseCredentials,
  normalizeBaseUrl,
  parseResponseError,
  runAccountingWorkerCronSmoke,
};
