const {
  buildActiveTenantQueryUrl,
  buildAppNotificationDedupeQueryUrl,
  buildAppNotificationInsertUrl,
} = require('./check-accounting-worker-cron-smoke.cjs');
const {
  getSupabaseCredentials,
  parseResponseError,
  runBusinessInvariantChecks,
  summarizeBusinessInvariantResults,
} = require('./check-business-invariants.cjs');

const NOTIFICATION_TYPE = 'business_rule_health_alert';
const DEFAULT_MAX_ROWS = 20000;

function trimTrailingSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function asFiniteNumber(value, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function parseResponseBody(bodyText) {
  if (!bodyText) return null;
  try {
    return JSON.parse(bodyText);
  } catch {
    return bodyText;
  }
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

function getBusinessRuleGuardConfig(env = process.env) {
  const supabase = getSupabaseCredentials(env);
  const alertTenantId =
    env.BUSINESS_RULE_ALERT_TENANT_ID ||
    env.ACCOUNTING_ALERT_TENANT_ID ||
    env.ALERT_TENANT_ID ||
    env.TENANT_ID ||
    '';
  const maxRows = Math.max(
    1000,
    asFiniteNumber(env.DB_BUSINESS_INVARIANT_MAX_ROWS || env.BUSINESS_RULE_GUARD_MAX_ROWS, DEFAULT_MAX_ROWS)
  );
  const failOnWarning =
    env.BUSINESS_RULE_GUARD_FAIL_ON_WARNING === '1' ||
    env.DB_BUSINESS_INVARIANTS_FAIL_ON_WARNING === '1';

  return {
    ...supabase,
    alertTenantId,
    maxRows,
    failOnWarning,
  };
}

function summarizeFailedGroups(summary) {
  return summary.failedChecks.map((check) => check.name);
}

function getTopFindings(results, limit = 8) {
  const findings = results.flatMap((result) =>
    result.findings.map((finding) => ({
      group: result.name,
      severity: finding.severity,
      code: finding.code,
      message: finding.message,
      recordId: finding.recordId || null,
      bookingId: finding.bookingId || null,
      sourceTable: finding.sourceTable || null,
    }))
  );

  return findings
    .sort((left, right) => {
      if (left.severity === right.severity) return 0;
      return left.severity === 'critical' ? -1 : 1;
    })
    .slice(0, limit);
}

function buildBusinessRuleFailureDedupeKey({ summary, now = new Date() }) {
  const dayKey = now.toISOString().slice(0, 10);
  const failedGroups = summary ? summarizeFailedGroups(summary).sort().join('+') : 'runtime_error';
  return `business_rule_production_guard:${dayKey}:${failedGroups || 'unknown'}`;
}

function buildBusinessRuleFailureNotificationPayload({
  tenantId,
  config,
  error,
  invariantRun,
  summary,
  now = new Date(),
}) {
  const errorMessage = error instanceof Error ? error.message : error ? String(error) : '';
  const criticalCount = summary?.criticalCount ?? 0;
  const warningCount = summary?.warningCount ?? 0;
  const severity = criticalCount > 0 || !summary ? 'critical' : 'warning';
  const dedupeKey = buildBusinessRuleFailureDedupeKey({ summary, now });
  const failedGroups = summary ? summarizeFailedGroups(summary) : [];
  const topFindings = invariantRun ? getTopFindings(invariantRun.results) : [];
  const message = summary
    ? `Business rule guard phat hien ${criticalCount} loi nghiem trong va ${warningCount} canh bao.`
    : `Business rule guard khong chay duoc: ${errorMessage}`;

  return {
    tenant_id: tenantId,
    type: NOTIFICATION_TYPE,
    title: 'Rule engine production can xu ly',
    message,
    data: {
      source: 'github_actions_business_rule_guard',
      severity,
      dedupe_key: dedupeKey,
      href: '/dashboard/system-monitor',
      accounting_health_href: '/dashboard/accounting/health',
      checked_groups: summary?.checked ?? 0,
      critical_count: criticalCount,
      warning_count: warningCount,
      failed_groups: failedGroups,
      top_findings: topFindings,
      dataset_counts: invariantRun?.datasetCounts ?? null,
      month_date: invariantRun?.context?.monthDate ?? null,
      failed_at: now.toISOString(),
      error: errorMessage ? errorMessage.slice(0, 800) : null,
    },
    is_read: false,
  };
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
    throw new Error('No active tenant found for business rule alert notification.');
  }

  return rows[0].id;
}

async function createBusinessRuleFailureNotification({
  config,
  error,
  invariantRun,
  summary,
  fetchImpl = globalThis.fetch,
  now = new Date(),
}) {
  if (!config.supabaseUrl || !config.serviceRoleKey) {
    throw new Error('Cannot create business rule notification without Supabase URL and service-role key.');
  }

  const tenantId = await resolveAlertTenantId({ config, fetchImpl });
  const payload = buildBusinessRuleFailureNotificationPayload({
    tenantId,
    config,
    error,
    invariantRun,
    summary,
    now,
  });
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

  const insertResponse = await fetchImpl(buildAppNotificationInsertUrl(trimTrailingSlash(config.supabaseUrl)), {
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

async function runBusinessRuleProductionGuard({
  config = getBusinessRuleGuardConfig(),
  fetchImpl = globalThis.fetch,
  now = new Date(),
  runInvariantChecksImpl = runBusinessInvariantChecks,
}) {
  if (typeof fetchImpl !== 'function') {
    throw new Error('Fetch API is not available in this Node runtime.');
  }

  if (!config.isConfigured) {
    throw new Error(`Business rule production guard missing config: ${config.missing.join(', ')}.`);
  }

  const invariantRun = await runInvariantChecksImpl({
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.serviceRoleKey,
    fetchImpl,
    now,
    maxRows: config.maxRows,
  });
  const summary = summarizeBusinessInvariantResults(invariantRun.results, {
    failOnWarning: config.failOnWarning,
  });

  return {
    invariantRun,
    summary,
  };
}

function printGuardResults(invariantRun, summary) {
  console.log(`Business rule guard month: ${invariantRun.context.monthDate}`);
  console.log(`Business rule guard rows: ${JSON.stringify(invariantRun.datasetCounts)}`);
  invariantRun.results.forEach((result) => {
    const marker = result.criticalCount > 0 ? 'FAIL' : result.warningCount > 0 ? 'WARN' : 'OK';
    const stream = result.criticalCount > 0 ? console.error : console.log;
    stream(`[${marker}] ${result.name}: ${result.criticalCount} critical, ${result.warningCount} warning`);
  });
  console.log(`Business rule guard summary: ${summary.criticalCount} critical, ${summary.warningCount} warning.`);
}

async function main() {
  const config = getBusinessRuleGuardConfig();
  let guardResult = null;

  try {
    guardResult = await runBusinessRuleProductionGuard({ config });
    printGuardResults(guardResult.invariantRun, guardResult.summary);

    if (!guardResult.summary.isHealthy) {
      throw new Error(
        `Business rule production guard failed: ${guardResult.summary.criticalCount} critical, ${guardResult.summary.warningCount} warning.`
      );
    }

    console.log(`Business rule production guard passed: ${guardResult.summary.checked} check groups.`);
  } catch (error) {
    console.error('[FAIL] Business rule production guard failed.');
    console.error(error instanceof Error ? error.message : String(error));
    try {
      const notification = await createBusinessRuleFailureNotification({
        config,
        error,
        invariantRun: guardResult?.invariantRun,
        summary: guardResult?.summary,
      });
      if (notification.created) {
        console.error(`[FAIL] Created app notification ${notification.notificationId} for tenant ${notification.tenantId}.`);
      } else {
        console.error(`[FAIL] Existing unread app notification ${notification.notificationId || '(unknown)'} already covers this failure.`);
      }
    } catch (notificationError) {
      console.error('[FAIL] Could not create app notification for business rule guard failure.');
      console.error(notificationError instanceof Error ? notificationError.message : String(notificationError));
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  NOTIFICATION_TYPE,
  buildBusinessRuleFailureDedupeKey,
  buildBusinessRuleFailureNotificationPayload,
  createBusinessRuleFailureNotification,
  getBusinessRuleGuardConfig,
  getTopFindings,
  runBusinessRuleProductionGuard,
};
