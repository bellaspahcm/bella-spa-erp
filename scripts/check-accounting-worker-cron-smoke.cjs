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
  const alertTenantId =
    env.ACCOUNTING_ALERT_TENANT_ID ||
    env.ALERT_TENANT_ID ||
    env.TENANT_ID ||
    '';
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
    alertTenantId,
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

function getSupabaseWriteHeaders(serviceRoleKey) {
  return {
    ...getSupabaseHeaders(serviceRoleKey),
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

function buildActiveTenantQueryUrl(supabaseUrl) {
  const params = new URLSearchParams({
    select: 'id,name,status',
    status: 'eq.active',
    order: 'created_at.asc',
    limit: '1',
  });

  return `${trimTrailingSlash(supabaseUrl)}/rest/v1/tenants?${params.toString()}`;
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

function buildAppNotificationDedupeQueryUrl(supabaseUrl, tenantId, type, dedupeKey) {
  const params = new URLSearchParams({
    select: 'id,created_at',
    tenant_id: `eq.${tenantId}`,
    type: `eq.${type}`,
    is_read: 'eq.false',
    data: `cs.${JSON.stringify({ dedupe_key: dedupeKey })}`,
    limit: '1',
  });

  return `${trimTrailingSlash(supabaseUrl)}/rest/v1/app_notifications?${params.toString()}`;
}

function buildAppNotificationInsertUrl(supabaseUrl) {
  return `${trimTrailingSlash(supabaseUrl)}/rest/v1/app_notifications`;
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

async function resolveAlertTenantId({
  config,
  fetchImpl = globalThis.fetch,
}) {
  if (config.alertTenantId) {
    return config.alertTenantId;
  }

  const response = await fetchImpl(buildActiveTenantQueryUrl(config.supabaseUrl), {
    method: 'GET',
    headers: getSupabaseHeaders(config.serviceRoleKey),
  });
  const bodyText = await response.text().catch(() => '');

  if (!response.ok) {
    throw new Error(`active tenant lookup failed (${response.status}): ${parseResponseError(bodyText)}`);
  }

  const rows = parseResponseBody(bodyText);
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.id) {
    throw new Error('No active tenant found for accounting worker alert notification.');
  }

  return rows[0].id;
}

function buildCronFailureDedupeKey({ baseUrl, now = new Date() }) {
  const dayKey = now.toISOString().slice(0, 10);
  return `accounting_worker_cron_smoke:${baseUrl || 'unknown-base-url'}:${dayKey}`;
}

function buildCronFailureNotificationPayload({ tenantId, error, config, now = new Date() }) {
  const message = error instanceof Error ? error.message : String(error);
  const dedupeKey = buildCronFailureDedupeKey({ baseUrl: config.baseUrl, now });

  return {
    tenant_id: tenantId,
    type: 'accounting_worker_cron_alert',
    title: 'Cron kế toán production đang lỗi',
    message: `Smoke check không xác nhận được worker kế toán production: ${message}`,
    data: {
      source: 'github_actions_cron_smoke',
      severity: 'critical',
      dedupe_key: dedupeKey,
      href: '/dashboard/accounting/health',
      outbox_href: '/dashboard/accounting/outbox',
      base_url: config.baseUrl || null,
      failed_at: now.toISOString(),
      error: message.slice(0, 800),
    },
    is_read: false,
  };
}

async function createCronFailureNotification({
  config,
  error,
  fetchImpl = globalThis.fetch,
  now = new Date(),
}) {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error('Cannot create cron failure notification without Supabase URL and service-role key.');
  }

  const tenantId = await resolveAlertTenantId({ config, fetchImpl });
  const payload = buildCronFailureNotificationPayload({ tenantId, error, config, now });
  const dedupeKey = payload.data.dedupe_key;
  const existingResponse = await fetchImpl(
    buildAppNotificationDedupeQueryUrl(config.supabaseUrl, tenantId, payload.type, dedupeKey),
    {
      method: 'GET',
      headers: getSupabaseHeaders(config.serviceRoleKey),
    }
  );
  const existingBodyText = await existingResponse.text().catch(() => '');

  if (!existingResponse.ok) {
    throw new Error(`app_notifications dedupe lookup failed (${existingResponse.status}): ${parseResponseError(existingBodyText)}`);
  }

  const existingRows = parseResponseBody(existingBodyText);
  if (Array.isArray(existingRows) && existingRows.length > 0) {
    return {
      created: false,
      notificationId: existingRows[0]?.id || null,
      tenantId,
      dedupeKey,
    };
  }

  const insertResponse = await fetchImpl(buildAppNotificationInsertUrl(config.supabaseUrl), {
    method: 'POST',
    headers: getSupabaseWriteHeaders(config.serviceRoleKey),
    body: JSON.stringify(payload),
  });
  const insertBodyText = await insertResponse.text().catch(() => '');

  if (!insertResponse.ok) {
    throw new Error(`app_notifications insert failed (${insertResponse.status}): ${parseResponseError(insertBodyText)}`);
  }

  const insertedRows = parseResponseBody(insertBodyText);
  const notificationId = Array.isArray(insertedRows) ? insertedRows[0]?.id || null : null;

  if (!notificationId) {
    throw new Error('app_notifications insert returned no notification id.');
  }

  return {
    created: true,
    notificationId,
    tenantId,
    dedupeKey,
  };
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
    try {
      const notification = await createCronFailureNotification({ config, error });
      if (notification.created) {
        console.error(`[FAIL] Created app notification ${notification.notificationId} for tenant ${notification.tenantId}.`);
      } else {
        console.error(`[FAIL] Existing unread app notification ${notification.notificationId || '(unknown)'} already covers this failure.`);
      }
    } catch (notificationError) {
      console.error('[FAIL] Could not create app notification for cron smoke failure.');
      console.error(notificationError instanceof Error ? notificationError.message : String(notificationError));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  assertWorkerResponseHealthy,
  buildActiveTenantQueryUrl,
  buildAppNotificationDedupeQueryUrl,
  buildAppNotificationInsertUrl,
  buildWorkerRunsQueryUrl,
  callAccountingWorker,
  createCronFailureNotification,
  fetchLatestWorkerRunSince,
  getCronSmokeConfig,
  getSupabaseCredentials,
  normalizeBaseUrl,
  parseResponseError,
  runAccountingWorkerCronSmoke,
};
