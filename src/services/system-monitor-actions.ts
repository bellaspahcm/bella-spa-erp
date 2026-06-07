'use server';

import { createAccountingDataClient } from '@/services/accounting/client';
import { getBusinessHealthSummary } from '@/services/accounting/business-health';
import { getAccountingHealthSummary } from '@/services/accounting/health';
import { getCurrentUser } from '@/services/user-actions';
import type { Database, Json } from '@/types/database.types';

export type SystemMonitorStatus = 'healthy' | 'warning' | 'critical';

export interface SystemMonitorCheck {
  id: string;
  label: string;
  status: SystemMonitorStatus;
  value: string;
  message: string;
  href?: string;
}

export interface SystemMonitorSection {
  id: 'cron' | 'data' | 'config' | 'alerts';
  title: string;
  status: SystemMonitorStatus;
  score: number;
  checks: SystemMonitorCheck[];
}

export interface SystemMonitorOpenAlert {
  id: string;
  type: string;
  title: string;
  message: string;
  created_at: string | null;
  href: string;
  severity: SystemMonitorStatus;
}

export interface SystemMonitorSummary {
  generated_at: string;
  month: string;
  overall_status: SystemMonitorStatus;
  overall_score: number;
  sections: SystemMonitorSection[];
  open_alerts: SystemMonitorOpenAlert[];
  quick_metrics: {
    accounting_blockers: number;
    accounting_warnings: number;
    business_critical: number;
    business_warnings: number;
    worker_failed_runs_24h: number;
    worker_silent_with_pending: number;
    cron_smoke_open_alerts: number;
    internal_worker_open_alerts: number;
    business_rule_open_alerts: number;
  };
}

type AppNotificationRow = Pick<
  Database['public']['Tables']['app_notifications']['Row'],
  'id' | 'type' | 'title' | 'message' | 'created_at' | 'data'
>;

const SYSTEM_ALERT_TYPES = [
  'accounting_worker_cron_alert',
  'accounting_worker_health_alert',
  'business_rule_health_alert',
];

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function normalizeMonth(month?: string | null) {
  const raw = month?.slice(0, 7) || currentMonthValue();
  const [yearPart, monthPart] = raw.split('-');
  const year = Number(yearPart);
  const monthNumber = Number(monthPart);

  if (!Number.isInteger(year) || !Number.isInteger(monthNumber) || monthNumber < 1 || monthNumber > 12) {
    throw new Error('Thang giam sat he thong khong hop le.');
  }

  return `${year}-${String(monthNumber).padStart(2, '0')}`;
}

function statusRank(status: SystemMonitorStatus) {
  if (status === 'critical') return 3;
  if (status === 'warning') return 2;
  return 1;
}

function worstStatus(statuses: SystemMonitorStatus[]): SystemMonitorStatus {
  return statuses.reduce<SystemMonitorStatus>(
    (worst, status) => (statusRank(status) > statusRank(worst) ? status : worst),
    'healthy'
  );
}

function statusToScore(status: SystemMonitorStatus) {
  if (status === 'healthy') return 100;
  if (status === 'warning') return 72;
  return 35;
}

function sectionScore(checks: SystemMonitorCheck[]) {
  if (checks.length === 0) return 100;
  const total = checks.reduce((sum, check) => sum + statusToScore(check.status), 0);
  return Math.round(total / checks.length);
}

function sectionFromChecks(
  id: SystemMonitorSection['id'],
  title: string,
  checks: SystemMonitorCheck[]
): SystemMonitorSection {
  return {
    id,
    title,
    status: worstStatus(checks.map((check) => check.status)),
    score: sectionScore(checks),
    checks,
  };
}

function isRecord(value: Json | null): value is Record<string, Json | undefined> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}

function getNotificationHref(data: Json | null) {
  if (isRecord(data) && typeof data.href === 'string' && data.href.startsWith('/dashboard')) {
    return data.href;
  }

  return '/dashboard/system-monitor';
}

function getNotificationSeverity(row: AppNotificationRow): SystemMonitorStatus {
  if (row.type === 'accounting_worker_cron_alert') return 'critical';
  if (isRecord(row.data) && row.data.severity === 'critical') return 'critical';
  return 'warning';
}

function getNotificationSourceLabel(row: AppNotificationRow) {
  if (row.type === 'accounting_worker_cron_alert') return 'Cron smoke';
  if (row.type === 'business_rule_health_alert') return 'Rule engine';
  return 'Worker health';
}

function envStatus(value: string | undefined) {
  return value && value.trim() ? 'healthy' : 'warning';
}

function buildConfigChecks(): SystemMonitorCheck[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseSecret = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY;
  const cronSecret = process.env.CRON_SECRET;
  const alertTenant = process.env.ACCOUNTING_ALERT_TENANT_ID;

  return [
    {
      id: 'supabase-url',
      label: 'Supabase URL',
      status: envStatus(supabaseUrl),
      value: supabaseUrl ? 'Da cau hinh' : 'Thieu',
      message: supabaseUrl
        ? 'Runtime co dia chi Supabase de doc du lieu san xuat.'
        : 'Can cau hinh NEXT_PUBLIC_SUPABASE_URL hoac SUPABASE_URL cho runtime.',
    },
    {
      id: 'supabase-service-key',
      label: 'Supabase service key',
      status: envStatus(supabaseSecret),
      value: supabaseSecret ? 'Da cau hinh' : 'Thieu',
      message: supabaseSecret
        ? 'Runtime co service key cho cac tac vu server-side can RLS bypass.'
        : 'Can cau hinh SUPABASE_SERVICE_ROLE_KEY hoac SUPABASE_SECRET_KEY.',
    },
    {
      id: 'cron-secret',
      label: 'Cron secret',
      status: envStatus(cronSecret),
      value: cronSecret ? 'Da cau hinh' : 'Thieu',
      message: cronSecret
        ? 'Endpoint cron co secret de chan goi trai phep.'
        : 'Can cau hinh CRON_SECRET cho endpoint cron production.',
    },
    {
      id: 'alert-tenant',
      label: 'Alert tenant runtime',
      status: alertTenant ? 'healthy' : 'warning',
      value: alertTenant ? 'Da cau hinh' : 'Chua co trong app runtime',
      message: alertTenant
        ? 'Runtime co tenant dich cho canh bao he thong.'
        : 'GitHub Actions co the da cau hinh bien nay rieng; app runtime hien khong thay ACCOUNTING_ALERT_TENANT_ID.',
    },
  ];
}

async function resolveMonitorTenant() {
  const user = await getCurrentUser();
  const role = user?.role?.toLowerCase();

  if (!user?.tenant_id || !['admin', 'super_admin'].includes(role || '')) {
    throw new Error('Unauthorized: chi admin moi duoc xem trung tam giam sat he thong.');
  }

  return user.tenant_id;
}

async function loadOpenSystemAlerts(tenantId: string): Promise<AppNotificationRow[]> {
  const supabase = await createAccountingDataClient();
  const { data, error } = await supabase
    .from('app_notifications')
    .select('id, type, title, message, created_at, data')
    .eq('tenant_id', tenantId)
    .eq('is_read', false)
    .in('type', SYSTEM_ALERT_TYPES)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`[systemMonitor] Failed to load system alert notifications: ${error.message}`);
  }

  return (data ?? []) as AppNotificationRow[];
}

export async function getSystemMonitorSummary(month?: string | null): Promise<SystemMonitorSummary> {
  const tenantId = await resolveMonitorTenant();
  const monthLabel = normalizeMonth(month);
  const monthDate = `${monthLabel}-01`;
  const [accountingHealth, businessHealth, openAlertRows] = await Promise.all([
    getAccountingHealthSummary(monthDate),
    getBusinessHealthSummary(monthDate),
    loadOpenSystemAlerts(tenantId),
  ]);

  const cronSmokeOpenAlerts = openAlertRows.filter((row) => row.type === 'accounting_worker_cron_alert').length;
  const internalWorkerOpenAlerts = openAlertRows.filter((row) => row.type === 'accounting_worker_health_alert').length;
  const businessRuleOpenAlerts = openAlertRows.filter((row) => row.type === 'business_rule_health_alert').length;
  const failedOutbox = accountingHealth.metrics.outbox_failed + accountingHealth.metrics.outbox_dead;
  const pendingOutbox = accountingHealth.metrics.outbox_pending + accountingHealth.metrics.outbox_processing;

  const cronChecks: SystemMonitorCheck[] = [
    {
      id: 'worker-recency',
      label: 'Accounting worker',
      status: accountingHealth.metrics.worker_silent_with_pending > 0 ? 'warning' : 'healthy',
      value: accountingHealth.metrics.worker_last_run_at ? 'Co dau vet chay' : 'Chua co dau vet',
      message: accountingHealth.metrics.worker_silent_with_pending > 0
        ? 'Outbox con su kien dang cho/loi nhung worker khong co lan chay gan day.'
        : 'Worker co dau vet chay gan day hoac khong co outbox can xu ly.',
      href: '/dashboard/accounting/health',
    },
    {
      id: 'worker-failures-24h',
      label: 'Worker loi 24h',
      status: accountingHealth.metrics.worker_failed_runs_24h > 0 ? 'warning' : 'healthy',
      value: String(accountingHealth.metrics.worker_failed_runs_24h),
      message: accountingHealth.metrics.worker_failed_runs_24h > 0
        ? `Co ${accountingHealth.metrics.worker_failed_runs_24h} lan chay loi trong 24h gan nhat.`
        : 'Khong co lan chay worker loi trong 24h gan nhat.',
      href: '/dashboard/accounting/health',
    },
    {
      id: 'cron-smoke-alerts',
      label: 'Cron smoke production',
      status: cronSmokeOpenAlerts > 0 ? 'critical' : 'healthy',
      value: String(cronSmokeOpenAlerts),
      message: cronSmokeOpenAlerts > 0
        ? 'Dang co canh bao smoke check production chua doc.'
        : 'Khong co canh bao smoke check production dang mo.',
      href: '/dashboard',
    },
    {
      id: 'internal-worker-alerts',
      label: 'Canh bao noi bo worker',
      status: internalWorkerOpenAlerts > 0 ? 'warning' : 'healthy',
      value: String(internalWorkerOpenAlerts),
      message: internalWorkerOpenAlerts > 0
        ? 'Dang co thong bao noi bo ve worker ke toan chua duoc doc.'
        : 'Khong co thong bao noi bo worker dang mo.',
      href: '/dashboard/accounting/health',
    },
  ];

  const dataChecks: SystemMonitorCheck[] = [
    {
      id: 'accounting-health',
      label: 'Suc khoe so cai',
      status: accountingHealth.severity,
      value: `${accountingHealth.blocker_count} blocker / ${accountingHealth.warning_count} warning`,
      message: accountingHealth.can_close_month
        ? 'Preflight khoa thang khong co blocker.'
        : 'Dang co blocker can xu ly truoc khi khoa thang.',
      href: '/dashboard/accounting/health',
    },
    {
      id: 'business-health',
      label: 'Du lieu van hanh',
      status: businessHealth.severity,
      value: `${businessHealth.critical_count} loi / ${businessHealth.warning_count} canh bao`,
      message: businessHealth.can_operate_cleanly
        ? 'Du lieu lien module dang sach theo rule engine hien tai.'
        : 'Dang co loi hoac canh bao lien module can xu ly.',
      href: '/dashboard/accounting/health',
    },
    {
      id: 'business-rule-production-alerts',
      label: 'Rule engine production',
      status: businessRuleOpenAlerts > 0 ? 'critical' : 'healthy',
      value: String(businessRuleOpenAlerts),
      message: businessRuleOpenAlerts > 0
        ? 'Dang co canh bao rule engine production chua doc.'
        : 'Khong co canh bao rule engine production dang mo.',
      href: '/dashboard/system-monitor',
    },
    {
      id: 'outbox-blockers',
      label: 'Outbox failed/dead',
      status: failedOutbox > 0 ? 'critical' : pendingOutbox > 0 ? 'warning' : 'healthy',
      value: `${failedOutbox} loi / ${pendingOutbox} dang cho`,
      message: failedOutbox > 0
        ? 'Outbox co FAILED/DEAD, can replay hoac sua loi truoc khi khoa so.'
        : pendingOutbox > 0
          ? 'Outbox con su kien dang cho worker xu ly.'
          : 'Outbox khong co su kien dang cho hoac loi.',
      href: '/dashboard/accounting/outbox',
    },
    {
      id: 'readiness-tt133',
      label: 'Readiness TT133',
      status: accountingHealth.metrics.readiness_score >= 95 ? 'healthy' : 'warning',
      value: `${accountingHealth.metrics.readiness_score}/100`,
      message: accountingHealth.metrics.readiness_score >= 95
        ? 'Do san sang TT133 dat nguong van hanh.'
        : 'Can bo sung metadata/review de dat nguong san sang TT133.',
      href: '/dashboard/accounting/readiness',
    },
  ];

  const configChecks = buildConfigChecks();
  const alertChecks: SystemMonitorCheck[] = openAlertRows.length > 0
    ? openAlertRows.slice(0, 6).map((row) => ({
      id: row.id,
      label: row.title,
      status: getNotificationSeverity(row),
      value: getNotificationSourceLabel(row),
      message: row.message,
      href: getNotificationHref(row.data),
    }))
    : [{
      id: 'no-open-system-alerts',
      label: 'Canh bao dang mo',
      status: 'healthy',
      value: '0',
      message: 'Khong co canh bao he thong chua doc.',
      href: '/dashboard',
    }];

  const sections = [
    sectionFromChecks('cron', 'Cron & job production', cronChecks),
    sectionFromChecks('data', 'Du lieu va rule engine', dataChecks),
    sectionFromChecks('config', 'Cau hinh production', configChecks),
    sectionFromChecks('alerts', 'Canh bao dang mo', alertChecks),
  ];
  const overallStatus = worstStatus(sections.map((section) => section.status));
  const overallScore = Math.round(sections.reduce((sum, section) => sum + section.score, 0) / sections.length);

  return {
    generated_at: new Date().toISOString(),
    month: monthLabel,
    overall_status: overallStatus,
    overall_score: overallScore,
    sections,
    open_alerts: openAlertRows.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      created_at: row.created_at,
      href: getNotificationHref(row.data),
      severity: getNotificationSeverity(row),
    })),
    quick_metrics: {
      accounting_blockers: accountingHealth.blocker_count,
      accounting_warnings: accountingHealth.warning_count,
      business_critical: businessHealth.critical_count,
      business_warnings: businessHealth.warning_count,
      worker_failed_runs_24h: accountingHealth.metrics.worker_failed_runs_24h,
      worker_silent_with_pending: accountingHealth.metrics.worker_silent_with_pending,
      cron_smoke_open_alerts: cronSmokeOpenAlerts,
      internal_worker_open_alerts: internalWorkerOpenAlerts,
      business_rule_open_alerts: businessRuleOpenAlerts,
    },
  };
}
