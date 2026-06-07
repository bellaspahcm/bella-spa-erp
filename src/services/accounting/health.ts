'use server';

import { revalidatePath } from 'next/cache';
import { createAccountingDataClient, type AccountingSupabaseClient } from './client';
import { getCurrentUser } from '../user-actions';
import { calculateReadinessScore } from './template-rules';
import type { Database, Json } from '@/types/database.types';
import type {
  AccountingDuplicateJournalReference,
  AccountingHealthAlertKind,
  AccountingHealthAlertNotificationResult,
  AccountingHealthCheck,
  AccountingHealthMetrics,
  AccountingHealthSummary,
  AccountingReadinessRow,
} from './types';

type SupabaseClient = AccountingSupabaseClient;
type OutboxRow = Pick<
  Database['public']['Tables']['accounting_outbox']['Row'],
  'id' | 'status' | 'event_type' | 'reference_type' | 'reference_id' | 'retry_count' | 'last_error' | 'created_at'
>;
type JournalEntryRow = Pick<
  Database['public']['Tables']['journal_entries']['Row'],
  'id' | 'status' | 'reference_type' | 'reference_id' | 'entry_date' | 'description'
>;
type WorkerRunRow = Pick<
  Database['public']['Tables']['accounting_worker_runs']['Row'],
  | 'id'
  | 'status'
  | 'started_at'
  | 'finished_at'
  | 'duration_ms'
  | 'claimed_count'
  | 'success_count'
  | 'dead_letter_count'
  | 'failure_count'
  | 'critical_failure_count'
  | 'error'
>;
type AppNotificationInsert = Database['public']['Tables']['app_notifications']['Insert'];
type AppNotificationRow = Pick<Database['public']['Tables']['app_notifications']['Row'], 'id'>;
type HealthContext = {
  supabase?: SupabaseClient;
  tenantId?: string;
};
type MonthScope = {
  monthStart: string;
  nextMonthStart: string;
  monthLabel: string;
};

const ACTIVE_REFERENCE_TYPES = new Set([
  'PACKAGE_SALE',
  'SESSION_DONE',
  'EXPENSE',
  'SALARY_PAYMENT',
  'INVENTORY_CONSUMPTION',
  'REFUND',
  'MANUAL',
]);
const ACCOUNTING_WORKER_HEALTH_ALERT_TYPE = 'accounting_worker_health_alert';

const EMPTY_METRICS: AccountingHealthMetrics = {
  outbox_pending: 0,
  outbox_processing: 0,
  outbox_completed: 0,
  outbox_failed: 0,
  outbox_dead: 0,
  journal_draft: 0,
  journal_posted: 0,
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
  worker_last_run_at: null,
  worker_minutes_since_last_run: null,
  worker_runs_24h: 0,
  worker_failed_runs_24h: 0,
  worker_failure_rate_24h: 0,
  worker_silent_with_pending: 0,
};

function getMonthScope(month?: string | null): MonthScope | null {
  if (!month) return null;

  const [yearPart, monthPart] = month.split('-');
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Thang preflight khong hop le.');
  }

  const nextMonth = monthNumber === 12
    ? { year: year + 1, monthNumber: 1 }
    : { year, monthNumber: monthNumber + 1 };
  const monthStart = `${year}-${String(monthNumber).padStart(2, '0')}-01`;
  const nextMonthStart = `${nextMonth.year}-${String(nextMonth.monthNumber).padStart(2, '0')}-01`;

  return {
    monthStart,
    nextMonthStart,
    monthLabel: `${year}-${String(monthNumber).padStart(2, '0')}`,
  };
}

function toNumber(value: number | string | null | undefined) {
  return Number(value || 0);
}

function rowsOrEmpty<T>(rows: T[] | null | undefined) {
  return rows ?? [];
}

function addCheck(checks: AccountingHealthCheck[], check: AccountingHealthCheck) {
  checks.push(check);
}

function getAlertDateKey(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

function getAccountingWorkerAlertKind(
  metrics: AccountingHealthMetrics
): AccountingHealthAlertKind | null {
  if (metrics.worker_silent_with_pending > 0) {
    return 'worker_silent_with_pending';
  }

  if (metrics.worker_failed_runs_24h > 0) {
    return 'worker_failed_runs_24h';
  }

  return null;
}

function buildAccountingWorkerAlertCopy(
  summary: AccountingHealthSummary,
  alertKind: AccountingHealthAlertKind
) {
  if (alertKind === 'worker_silent_with_pending') {
    return {
      title: 'Cron kế toán cần kiểm tra ngay',
      message:
        `Outbox còn ${summary.metrics.outbox_pending} PENDING, ${summary.metrics.outbox_processing} PROCESSING, ` +
        `${summary.metrics.outbox_failed} FAILED và ${summary.metrics.outbox_dead} DEAD nhưng worker không có lần chạy gần đây.`,
    };
  }

  return {
    title: 'Worker kế toán có lỗi trong 24h',
    message:
      `Worker kế toán có ${summary.metrics.worker_failed_runs_24h} lần chạy lỗi trong 24h gần nhất ` +
      `(tỷ lệ lỗi ${summary.metrics.worker_failure_rate_24h}%). Cần xem outbox và cấu hình cron.`,
  };
}

function buildAccountingWorkerAlertDedupeKey(params: {
  tenantId: string;
  alertKind: AccountingHealthAlertKind;
  month: string | null;
  now?: Date;
}) {
  return [
    ACCOUNTING_WORKER_HEALTH_ALERT_TYPE,
    params.tenantId,
    params.month ?? 'all-months',
    params.alertKind,
    getAlertDateKey(params.now),
  ].join(':');
}

async function resolveTenantContext(context?: HealthContext) {
  if (context?.tenantId) {
    const supabase = context?.supabase ?? await createAccountingDataClient();
    return { supabase, tenantId: context.tenantId };
  }

  const user = await getCurrentUser();
  if (!user?.tenant_id || !['admin', 'super_admin'].includes(user.role || '')) {
    throw new Error('Unauthorized: chi admin moi duoc xem suc khoe so ke toan.');
  }

  const supabase = context?.supabase ?? await createAccountingDataClient();
  return { supabase, tenantId: user.tenant_id };
}

async function loadOutboxRows(supabase: SupabaseClient, tenantId: string): Promise<OutboxRow[]> {
  const { data, error } = await supabase
    .from('accounting_outbox')
    .select('id, status, event_type, reference_type, reference_id, retry_count, last_error, created_at')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`[accountingHealth] Failed to load accounting_outbox: ${error.message}`);
  }

  return rowsOrEmpty(data) as OutboxRow[];
}

async function loadJournalRows(
  supabase: SupabaseClient,
  tenantId: string,
  scope: MonthScope | null
): Promise<JournalEntryRow[]> {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, status, reference_type, reference_id, entry_date, description')
    .eq('tenant_id', tenantId);

  if (error) {
    throw new Error(`[accountingHealth] Failed to load journal_entries: ${error.message}`);
  }

  const rows = rowsOrEmpty(data) as JournalEntryRow[];
  if (!scope) return rows;

  return rows.filter((row) => row.entry_date >= scope.monthStart && row.entry_date < scope.nextMonthStart);
}

async function loadWorkerRunRows(supabase: SupabaseClient): Promise<WorkerRunRow[]> {
  const { data, error } = await supabase
    .from('accounting_worker_runs')
    .select(
      'id, status, started_at, finished_at, duration_ms, claimed_count, success_count, dead_letter_count, failure_count, critical_failure_count, error'
    )
    .order('started_at', { ascending: false })
    .limit(200);

  if (error) {
    throw new Error(`[accountingHealth] Failed to load accounting_worker_runs: ${error.message}`);
  }

  return rowsOrEmpty(data) as WorkerRunRow[];
}

async function loadReadinessMetrics(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase.rpc('get_accounting_readiness', {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`[accountingHealth] Failed to load accounting readiness: ${error.message}`);
  }

  const rows: AccountingReadinessRow[] = rowsOrEmpty(data).map((row) => ({
    source_table: row.source_table,
    total_records: toNumber(row.total_records),
    classified_records: toNumber(row.classified_records),
    missing_business_event: toNumber(row.missing_business_event),
    needs_review: toNumber(row.needs_review),
    posting_failed: toNumber(row.posting_failed),
  }));

  const summary = rows.reduce(
    (acc, row) => {
      acc.total_records += row.total_records;
      acc.missing_business_event += row.missing_business_event;
      acc.needs_review += row.needs_review;
      acc.posting_failed += row.posting_failed;
      return acc;
    },
    {
      total_records: 0,
      missing_business_event: 0,
      needs_review: 0,
      posting_failed: 0,
    }
  );

  return {
    readiness_score: calculateReadinessScore({
      totalRecords: summary.total_records,
      missingBusinessEvent: summary.missing_business_event,
      needsReview: summary.needs_review,
      postingFailed: summary.posting_failed,
    }),
    missing_business_event: summary.missing_business_event,
    needs_review: summary.needs_review,
    posting_failed: summary.posting_failed,
  };
}

async function loadLegacySyncMetrics(supabase: SupabaseClient, tenantId: string) {
  const { data, error } = await supabase.rpc('preview_legacy_ledger_sync', {
    p_tenant_id: tenantId,
  });

  if (error) {
    throw new Error(`[accountingHealth] Failed to load legacy ledger sync preview: ${error.message}`);
  }

  const row = data?.[0];
  return {
    legacy_pending_revenue: toNumber(row?.pending_revenue_count),
    legacy_pending_expense: toNumber(row?.pending_expense_count),
    legacy_pending_salary: toNumber(row?.pending_salary_count),
    legacy_journal_entries_to_create: toNumber(row?.journal_entries_to_create),
  };
}

function countOutboxRows(rows: OutboxRow[]) {
  return rows.reduce(
    (acc, row) => {
      if (row.status === 'PENDING') acc.outbox_pending += 1;
      if (row.status === 'PROCESSING') acc.outbox_processing += 1;
      if (row.status === 'COMPLETED') acc.outbox_completed += 1;
      if (row.status === 'FAILED') acc.outbox_failed += 1;
      if (row.status === 'DEAD') acc.outbox_dead += 1;
      return acc;
    },
    {
      outbox_pending: 0,
      outbox_processing: 0,
      outbox_completed: 0,
      outbox_failed: 0,
      outbox_dead: 0,
    }
  );
}

function countJournalRows(rows: JournalEntryRow[]) {
  return rows.reduce(
    (acc, row) => {
      if (row.status === 'DRAFT') acc.journal_draft += 1;
      if (row.status === 'POSTED') acc.journal_posted += 1;
      if (row.status === 'CANCELED') acc.journal_canceled += 1;
      return acc;
    },
    {
      journal_draft: 0,
      journal_posted: 0,
      journal_canceled: 0,
    }
  );
}

function countWorkerRows(
  rows: WorkerRunRow[],
  outboxCounts: ReturnType<typeof countOutboxRows>,
  now: Date
) {
  const oneDayAgo = now.getTime() - (24 * 60 * 60 * 1000);
  const latestRun = rows[0] ?? null;
  const workerMinutesSinceLastRun = latestRun
    ? Math.max(0, Math.floor((now.getTime() - new Date(latestRun.started_at).getTime()) / 60000))
    : null;
  const runs24h = rows.filter((row) => new Date(row.started_at).getTime() >= oneDayAgo);
  const failedRuns24h = runs24h.filter((row) => row.status !== 'success').length;
  const pendingLikeOutbox =
    outboxCounts.outbox_pending +
    outboxCounts.outbox_processing +
    outboxCounts.outbox_failed +
    outboxCounts.outbox_dead;
  const workerIsSilent = pendingLikeOutbox > 0
    && (workerMinutesSinceLastRun === null || workerMinutesSinceLastRun > 15);

  return {
    worker_last_run_at: latestRun?.started_at ?? null,
    worker_minutes_since_last_run: workerMinutesSinceLastRun,
    worker_runs_24h: runs24h.length,
    worker_failed_runs_24h: failedRuns24h,
    worker_failure_rate_24h: runs24h.length > 0 ? Math.round((failedRuns24h / runs24h.length) * 100) : 0,
    worker_silent_with_pending: workerIsSilent ? 1 : 0,
  };
}

function findDuplicateActiveReferences(rows: JournalEntryRow[]): AccountingDuplicateJournalReference[] {
  const references = new Map<string, AccountingDuplicateJournalReference>();

  for (const row of rows) {
    if (
      row.status === 'CANCELED' ||
      !row.reference_type ||
      !row.reference_id ||
      !ACTIVE_REFERENCE_TYPES.has(row.reference_type)
    ) {
      continue;
    }

    const key = `${row.reference_type}:${row.reference_id}`;
    const current = references.get(key);
    if (current) {
      current.active_count += 1;
      current.entry_ids.push(row.id);
      continue;
    }

    references.set(key, {
      reference_type: row.reference_type,
      reference_id: row.reference_id,
      active_count: 1,
      entry_ids: [row.id],
    });
  }

  return Array.from(references.values()).filter((reference) => reference.active_count > 1);
}

function buildChecks(metrics: AccountingHealthMetrics, includeAdvisoryChecks: boolean) {
  const checks: AccountingHealthCheck[] = [];

  addCheck(checks, {
    id: 'outbox_dead',
    label: 'Outbox DEAD',
    status: metrics.outbox_dead > 0 ? 'fail' : 'pass',
    count: metrics.outbox_dead,
    href: '/dashboard/accounting/outbox',
    message: metrics.outbox_dead > 0
      ? `${metrics.outbox_dead} su kien da vao DEAD letter, can xu ly truoc khi khoa thang.`
      : 'Khong co su kien DEAD letter.',
  });

  addCheck(checks, {
    id: 'outbox_failed',
    label: 'Outbox FAILED',
    status: metrics.outbox_failed > 0 ? 'fail' : 'pass',
    count: metrics.outbox_failed,
    href: '/dashboard/accounting/outbox',
    message: metrics.outbox_failed > 0
      ? `${metrics.outbox_failed} su kien hach toan dang FAILED, can replay hoac sua loi truoc khi khoa thang.`
      : 'Khong co su kien FAILED.',
  });

  addCheck(checks, {
    id: 'journal_draft',
    label: 'But toan DRAFT',
    status: metrics.journal_draft > 0 ? 'fail' : 'pass',
    count: metrics.journal_draft,
    href: '/dashboard/accounting/journals',
    message: metrics.journal_draft > 0
      ? `${metrics.journal_draft} but toan con DRAFT, can post/cancel truoc khi khoa thang.`
      : 'Khong co but toan DRAFT trong pham vi kiem tra.',
  });

  addCheck(checks, {
    id: 'duplicate_active_references',
    label: 'Trung reference active',
    status: metrics.duplicate_active_references > 0 ? 'fail' : 'pass',
    count: metrics.duplicate_active_references,
    href: '/dashboard/accounting/journals',
    message: metrics.duplicate_active_references > 0
      ? `${metrics.duplicate_active_references} reference nghiep vu co hon mot but toan active.`
      : 'Khong phat hien trung reference active.',
  });

  addCheck(checks, {
    id: 'outbox_pending_processing',
    label: 'Outbox dang cho',
    status: metrics.outbox_pending + metrics.outbox_processing > 0 ? 'warn' : 'pass',
    count: metrics.outbox_pending + metrics.outbox_processing,
    href: '/dashboard/accounting/outbox',
    message: metrics.outbox_pending + metrics.outbox_processing > 0
      ? `${metrics.outbox_pending} PENDING va ${metrics.outbox_processing} PROCESSING dang cho worker.`
      : 'Khong co su kien PENDING/PROCESSING.',
  });

  addCheck(checks, {
    id: 'accounting_worker_silent',
    label: 'Worker ke toan',
    status: metrics.worker_silent_with_pending > 0 ? 'warn' : 'pass',
    count: metrics.worker_silent_with_pending,
    href: '/dashboard/accounting/outbox',
    message: metrics.worker_silent_with_pending > 0
      ? 'Outbox con su kien dang cho/loi nhung cron worker khong co lan chay gan day; can kiem tra lich cron.'
      : 'Worker ke toan co dau vet chay gan day hoac khong co outbox can xu ly.',
  });

  addCheck(checks, {
    id: 'accounting_worker_failures_24h',
    label: 'Worker loi 24h',
    status: metrics.worker_failed_runs_24h > 0 ? 'warn' : 'pass',
    count: metrics.worker_failed_runs_24h,
    href: '/dashboard/accounting/outbox',
    message: metrics.worker_failed_runs_24h > 0
      ? `${metrics.worker_failed_runs_24h} lan chay worker trong 24h gan nhat co loi; can xem outbox va cau hinh cron.`
      : 'Khong co lan chay worker loi trong 24h gan nhat.',
  });

  if (includeAdvisoryChecks) {
    const readinessIssues = metrics.missing_business_event + metrics.needs_review + metrics.posting_failed;
    addCheck(checks, {
      id: 'readiness_advisory',
      label: 'Readiness TT133',
      status: readinessIssues > 0 || metrics.readiness_score < 95 ? 'warn' : 'pass',
      count: readinessIssues,
      href: '/dashboard/accounting/readiness',
      message: readinessIssues > 0 || metrics.readiness_score < 95
        ? `Readiness ${metrics.readiness_score}/100; con ${metrics.missing_business_event} thieu nghiep vu, ${metrics.needs_review} can review, ${metrics.posting_failed} posting failed.`
        : 'Readiness TT133 dat nguong van hanh.',
    });

    addCheck(checks, {
      id: 'legacy_sync_advisory',
      label: 'Legacy ledger sync',
      status: metrics.legacy_journal_entries_to_create > 0 ? 'warn' : 'pass',
      count: metrics.legacy_journal_entries_to_create,
      href: '/dashboard/accounting/reconciliation',
      message: metrics.legacy_journal_entries_to_create > 0
        ? `${metrics.legacy_journal_entries_to_create} but toan legacy co the can dong bo vao so cai.`
        : 'Khong con but toan legacy dang cho dong bo.',
    });
  }

  return checks;
}

async function buildAccountingHealthSummary(params: {
  supabase: SupabaseClient;
  tenantId: string;
  month?: string | null;
  includeAdvisoryChecks: boolean;
}): Promise<AccountingHealthSummary> {
  const scope = getMonthScope(params.month);
  const now = new Date();
  const [outboxRows, journalRows, workerRows] = await Promise.all([
    loadOutboxRows(params.supabase, params.tenantId),
    loadJournalRows(params.supabase, params.tenantId, scope),
    loadWorkerRunRows(params.supabase),
  ]);
  const duplicateReferences = findDuplicateActiveReferences(journalRows);
  const outboxCounts = countOutboxRows(outboxRows);

  let metrics: AccountingHealthMetrics = {
    ...EMPTY_METRICS,
    ...outboxCounts,
    ...countJournalRows(journalRows),
    ...countWorkerRows(workerRows, outboxCounts, now),
    duplicate_active_references: duplicateReferences.length,
  };

  if (params.includeAdvisoryChecks) {
    const [readinessMetrics, legacySyncMetrics] = await Promise.all([
      loadReadinessMetrics(params.supabase, params.tenantId),
      loadLegacySyncMetrics(params.supabase, params.tenantId),
    ]);

    metrics = {
      ...metrics,
      ...readinessMetrics,
      ...legacySyncMetrics,
    };
  }

  const checks = buildChecks(metrics, params.includeAdvisoryChecks);
  const blockers = checks.filter((check) => check.status === 'fail');
  const warnings = checks.filter((check) => check.status === 'warn');
  const severity = blockers.length > 0 ? 'critical' : warnings.length > 0 ? 'warning' : 'healthy';

  return {
    generated_at: now.toISOString(),
    month: scope?.monthLabel ?? null,
    severity,
    can_close_month: blockers.length === 0,
    blocker_count: blockers.length,
    warning_count: warnings.length,
    metrics,
    checks,
    blockers,
    warnings,
    duplicate_journal_references: duplicateReferences,
  };
}

export async function getAccountingHealthSummary(month?: string | null): Promise<AccountingHealthSummary> {
  const { supabase, tenantId } = await resolveTenantContext();
  return buildAccountingHealthSummary({
    supabase,
    tenantId,
    month,
    includeAdvisoryChecks: true,
  });
}

export async function publishAccountingHealthAlertNotification(
  month?: string | null
): Promise<AccountingHealthAlertNotificationResult> {
  const { supabase, tenantId } = await resolveTenantContext();
  const summary = await buildAccountingHealthSummary({
    supabase,
    tenantId,
    month,
    includeAdvisoryChecks: true,
  });
  const alertKind = getAccountingWorkerAlertKind(summary.metrics);

  if (!alertKind) {
    return {
      success: true,
      created: false,
      notification_id: null,
      alert_kind: null,
      message: 'Worker kế toán đang ổn định, không cần tạo thông báo nội bộ.',
    };
  }

  const dedupeKey = buildAccountingWorkerAlertDedupeKey({
    tenantId,
    alertKind,
    month: summary.month,
  });
  const { title, message } = buildAccountingWorkerAlertCopy(summary, alertKind);

  const { data: existingRows, error: existingError } = await supabase
    .from('app_notifications')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('type', ACCOUNTING_WORKER_HEALTH_ALERT_TYPE)
    .eq('is_read', false)
    .contains('data', { dedupe_key: dedupeKey })
    .limit(1);

  if (existingError) {
    throw new Error(`[accountingHealth] Failed to check existing worker alert notification: ${existingError.message}`);
  }

  const existing = rowsOrEmpty(existingRows as AppNotificationRow[] | null)[0];
  if (existing) {
    return {
      success: true,
      created: false,
      notification_id: existing.id,
      alert_kind: alertKind,
      message: 'Đã có thông báo nội bộ chưa đọc cho cảnh báo worker hôm nay.',
    };
  }

  const notificationData: Json = {
    source: 'accounting_health',
    severity: 'warning',
    alert_kind: alertKind,
    dedupe_key: dedupeKey,
    href: '/dashboard/accounting/health',
    outbox_pending: summary.metrics.outbox_pending,
    outbox_processing: summary.metrics.outbox_processing,
    outbox_failed: summary.metrics.outbox_failed,
    outbox_dead: summary.metrics.outbox_dead,
    worker_last_run_at: summary.metrics.worker_last_run_at,
    worker_minutes_since_last_run: summary.metrics.worker_minutes_since_last_run,
    worker_failed_runs_24h: summary.metrics.worker_failed_runs_24h,
    worker_failure_rate_24h: summary.metrics.worker_failure_rate_24h,
    generated_at: summary.generated_at,
    month: summary.month,
  };
  const payload: AppNotificationInsert = {
    tenant_id: tenantId,
    type: ACCOUNTING_WORKER_HEALTH_ALERT_TYPE,
    title,
    message,
    data: notificationData,
    is_read: false,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('app_notifications')
    .insert(payload)
    .select('id')
    .single();

  if (insertError) {
    throw new Error(`[accountingHealth] Failed to create worker alert notification: ${insertError.message}`);
  }

  if (!inserted?.id) {
    throw new Error('[accountingHealth] Worker alert notification insert returned no id.');
  }

  revalidatePath('/dashboard');
  revalidatePath('/dashboard/accounting/health');

  return {
    success: true,
    created: true,
    notification_id: inserted.id,
    alert_kind: alertKind,
    message: 'Đã tạo thông báo nội bộ cho cảnh báo worker kế toán.',
  };
}

export async function getMonthClosePreflight(month: string): Promise<AccountingHealthSummary> {
  const { supabase, tenantId } = await resolveTenantContext();
  return buildAccountingHealthSummary({
    supabase,
    tenantId,
    month,
    includeAdvisoryChecks: false,
  });
}

export async function assertMonthClosePreflight(
  month: string,
  context?: HealthContext
): Promise<AccountingHealthSummary> {
  const { supabase, tenantId } = await resolveTenantContext(context);
  const summary = await buildAccountingHealthSummary({
    supabase,
    tenantId,
    month,
    includeAdvisoryChecks: false,
  });

  if (!summary.can_close_month) {
    const messages = summary.blockers.map((blocker) => `${blocker.label}: ${blocker.message}`).join(' ');
    throw new Error(`Chua the khoa so ${summary.month ?? month}: ${messages}`);
  }

  return summary;
}
