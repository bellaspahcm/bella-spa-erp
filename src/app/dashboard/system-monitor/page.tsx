'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BellRing,
  CheckCircle2,
  Database,
  RefreshCw,
  ServerCog,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import SkeletonLoader from '@/components/ui/SkeletonLoader';
import { usePageRefresh } from '@/hooks/usePageRefresh';
import { cn } from '@/lib/utils';
import {
  getSystemMonitorSummary,
  type SystemMonitorCheck,
  type SystemMonitorSection,
  type SystemMonitorStatus,
  type SystemMonitorSummary,
} from '@/services/system-monitor-actions';

const STATUS_TONE: Record<SystemMonitorStatus, {
  label: string;
  icon: LucideIcon;
  bg: string;
  border: string;
  text: string;
  solid: string;
}> = {
  healthy: {
    label: 'Ổn định',
    icon: CheckCircle2,
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
    text: 'text-emerald-700 dark:text-emerald-400',
    solid: 'bg-emerald-600 text-white dark:bg-emerald-500 dark:text-[#11100F]',
  },
  warning: {
    label: 'Cần rà soát',
    icon: AlertTriangle,
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
    text: 'text-amber-700 dark:text-amber-400',
    solid: 'bg-amber-600 text-white dark:bg-amber-500 dark:text-[#11100F]',
  },
  critical: {
    label: 'Nguy cấp',
    icon: AlertTriangle,
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
    text: 'text-rose-700 dark:text-rose-400',
    solid: 'bg-rose-600 text-white dark:bg-rose-500 dark:text-[#11100F]',
  },
};

const SECTION_ICON: Record<SystemMonitorSection['id'], LucideIcon> = {
  cron: ServerCog,
  data: Database,
  config: ShieldCheck,
  alerts: BellRing,
};

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN');
}

function formatGeneratedAt(value?: string | null) {
  if (!value) return 'Chưa có';
  return new Date(value).toLocaleString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
  });
}

export default function SystemMonitorPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [summary, setSummary] = useState<SystemMonitorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (monthValue = month) => {
    setRefreshing(true);
    try {
      const data = await getSystemMonitorSummary(`${monthValue}-01`);
      setSummary(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải trung tâm giám sát hệ thống.';
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  usePageRefresh(() => loadData(month));

  const overallStatus = summary?.overall_status ?? 'warning';
  const overallTone = STATUS_TONE[overallStatus];
  const OverallIcon = overallTone.icon;
  const primarySections = summary?.sections ?? [];
  const quickMetrics = summary?.quick_metrics;
  const urgentCount = useMemo(() => {
    if (!summary) return 0;
    return summary.sections.reduce(
      (count, section) => count + section.checks.filter((check) => check.status === 'critical').length,
      0
    );
  }, [summary]);

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <section className={cn('rounded-3xl md:rounded-[2rem] border p-5 md:p-8 shadow-sm', overallTone.bg, overallTone.border)}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/80 dark:bg-[#11100F]/60">
              <OverallIcon className={cn('h-6 w-6', overallTone.text)} />
            </div>
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-[#CDBCAB]/60">
                Production system monitor
              </p>
              <h1 className="mt-2 text-xl md:text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
                Trung tâm giám sát hệ thống
              </h1>
              <p className="mt-2 max-w-3xl text-xs md:text-sm font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
                Gom trạng thái cron, worker kế toán, dữ liệu vận hành, cấu hình production và cảnh báo nội bộ vào một màn hình.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block min-w-0 sm:min-w-[11.5rem]">
              <span className="mb-2 block text-3xs font-black uppercase tracking-widest text-slate-400">Tháng giám sát</span>
              <input
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-11 w-full min-w-[11.5rem] rounded-xl border border-white/80 dark:border-[#3E3A35] bg-white/90 dark:bg-[#11100F] pl-4 pr-11 text-xs font-black text-slate-800 dark:text-[#EFE9E1] outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() => loadData(month)}
              disabled={refreshing}
              className="inline-flex h-11 w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-slate-950 dark:bg-[#EFE9E1] px-4 text-3xs font-black uppercase tracking-widest text-white dark:text-[#11100F] hover:opacity-90 disabled:opacity-60"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
              Quét lại
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((item) => <SkeletonLoader key={item} variant="card" className="h-28" />)
          ) : (
            <>
              <MetricCard
                icon={Activity}
                label="Điểm vận hành"
                value={`${summary?.overall_score ?? 0}/100`}
                status={overallStatus}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Mục nguy cấp"
                value={formatNumber(urgentCount)}
                status={urgentCount > 0 ? 'critical' : 'healthy'}
              />
              <MetricCard
                icon={BellRing}
                label="Cảnh báo mở"
                value={formatNumber(summary?.open_alerts.length ?? 0)}
                status={(summary?.open_alerts.length ?? 0) > 0 ? 'warning' : 'healthy'}
              />
              <MetricCard
                icon={RefreshCw}
                label="Lần quét"
                value={formatGeneratedAt(summary?.generated_at)}
                status="healthy"
              />
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {loading ? (
          [1, 2, 3, 4].map((item) => <SkeletonLoader key={item} variant="card" className="h-40" />)
        ) : (
          primarySections.map((section) => <SectionSummary key={section.id} section={section} />)
        )}
      </section>

      <section className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
        {loading ? (
          [1, 2, 3, 4].map((item) => <SkeletonLoader key={item} variant="card" className="h-72" />)
        ) : (
          primarySections.map((section) => (
            <MonitorSection key={section.id} section={section} />
          ))
        )}
      </section>

      <section className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
              Chỉ số cần theo dõi nhanh
            </h2>
            <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
              Các con số này lấy từ cùng engine với Accounting Health và Business Health.
            </p>
          </div>
          <Link
            href="/dashboard/accounting/health"
            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 text-3xs font-black uppercase tracking-widest text-slate-600 hover:bg-slate-50 dark:border-[#3E3A35] dark:text-[#CDBCAB] dark:hover:bg-[#11100F]"
          >
            Mở Accounting Health
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((item) => <SkeletonLoader key={item} variant="rectangular" className="h-20" />)}
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-3">
            <QuickStat label="Accounting blockers" value={quickMetrics?.accounting_blockers ?? 0} />
            <QuickStat label="Accounting warnings" value={quickMetrics?.accounting_warnings ?? 0} />
            <QuickStat label="Business critical" value={quickMetrics?.business_critical ?? 0} />
            <QuickStat label="Business warnings" value={quickMetrics?.business_warnings ?? 0} />
            <QuickStat label="Worker lỗi 24h" value={quickMetrics?.worker_failed_runs_24h ?? 0} />
            <QuickStat label="Worker im lặng" value={quickMetrics?.worker_silent_with_pending ?? 0} />
            <QuickStat label="Cron smoke alert" value={quickMetrics?.cron_smoke_open_alerts ?? 0} />
            <QuickStat label="Worker alert mở" value={quickMetrics?.internal_worker_open_alerts ?? 0} />
            <QuickStat label="Rule alert mở" value={quickMetrics?.business_rule_open_alerts ?? 0} />
          </div>
        )}
      </section>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  status: SystemMonitorStatus;
}) {
  const tone = STATUS_TONE[status];

  return (
    <div className="rounded-2xl bg-white/85 dark:bg-[#11100F]/55 border border-white/70 dark:border-[#3E3A35]/50 p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-3xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <Icon className={cn('h-5 w-5', tone.text)} />
      </div>
      <div className={cn('mt-4 text-xl md:text-2xl font-black tracking-tight', tone.text)}>{value}</div>
    </div>
  );
}

function SectionSummary({ section }: { section: SystemMonitorSection }) {
  const tone = STATUS_TONE[section.status];
  const Icon = SECTION_ICON[section.id];

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div className={cn('flex h-10 w-10 items-center justify-center rounded-xl border', tone.bg, tone.border)}>
          <Icon className={cn('h-5 w-5', tone.text)} />
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-4xs font-black uppercase tracking-widest', tone.solid)}>
          {tone.label}
        </span>
      </div>
      <h3 className="mt-4 text-sm font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
        {section.title}
      </h3>
      <p className="mt-2 text-2xs font-bold text-slate-400 dark:text-[#CDBCAB]/60">
        {section.score}/100 · {section.checks.length} điểm kiểm tra
      </p>
    </div>
  );
}

function MonitorSection({ section }: { section: SystemMonitorSection }) {
  const tone = STATUS_TONE[section.status];
  const Icon = SECTION_ICON[section.id];

  return (
    <div className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 md:p-6 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border', tone.bg, tone.border)}>
            <Icon className={cn('h-5 w-5', tone.text)} />
          </div>
          <div>
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
              {section.title}
            </h2>
            <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
              Điểm nhóm {section.score}/100
            </p>
          </div>
        </div>
        <span className={cn('rounded-full px-3 py-1.5 text-4xs font-black uppercase tracking-widest', tone.solid)}>
          {tone.label}
        </span>
      </div>

      <div className="mt-5 divide-y divide-slate-100 dark:divide-[#3E3A35]/40">
        {section.checks.map((check) => (
          <MonitorCheckRow key={check.id} check={check} />
        ))}
      </div>
    </div>
  );
}

function MonitorCheckRow({ check }: { check: SystemMonitorCheck }) {
  const tone = STATUS_TONE[check.status];
  const Icon = tone.icon;

  return (
    <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone.text)} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-black text-slate-900 dark:text-[#EFE9E1]">{check.label}</p>
            <span className={cn('rounded-full border px-2 py-0.5 text-4xs font-black uppercase tracking-widest', tone.bg, tone.border, tone.text)}>
              {check.value}
            </span>
          </div>
          <p className="mt-1 text-2xs font-medium leading-relaxed text-slate-500 dark:text-[#CDBCAB]/65">
            {check.message}
          </p>
        </div>
      </div>
      {check.href ? (
        <Link
          href={check.href}
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-slate-50 px-3 text-4xs font-black uppercase tracking-widest text-slate-600 hover:text-primary dark:bg-[#11100F] dark:text-[#CDBCAB]"
        >
          Mở
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </div>
  );
}

function QuickStat({ label, value }: { label: string; value: number }) {
  const isClean = value === 0;

  return (
    <div className="rounded-2xl bg-slate-50 dark:bg-[#11100F] px-4 py-4">
      <p className="text-4xs font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className={cn('mt-2 font-mono text-lg font-black', isClean ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
        {formatNumber(value)}
      </p>
    </div>
  );
}
