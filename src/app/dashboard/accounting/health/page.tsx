'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  getAccountingHealthSummary,
  type AccountingHealthCheck,
  type AccountingHealthSeverity,
  type AccountingHealthSummary,
} from '@/services/accounting-actions';
import SkeletonLoader, { SkeletonTable } from '@/components/ui/SkeletonLoader';
import { cn } from '@/lib/utils';

const SEVERITY_TONE: Record<AccountingHealthSeverity, {
  label: string;
  icon: LucideIcon;
  text: string;
  bg: string;
  border: string;
}> = {
  healthy: {
    label: 'Sổ khỏe',
    icon: CheckCircle2,
    text: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-emerald-200 dark:border-emerald-500/30',
  },
  warning: {
    label: 'Có cảnh báo',
    icon: AlertTriangle,
    text: 'text-amber-700 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-amber-200 dark:border-amber-500/30',
  },
  critical: {
    label: 'Đang bị chặn',
    icon: XCircle,
    text: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-rose-200 dark:border-rose-500/30',
  },
};

const CHECK_TONE: Record<AccountingHealthCheck['status'], string> = {
  pass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warn: 'bg-amber-50 text-amber-700 border-amber-200',
  fail: 'bg-rose-50 text-rose-700 border-rose-200',
};

const tableWrapperClassName =
  'w-full overflow-x-auto overscroll-x-contain rounded-2xl shadow-[inset_-18px_0_18px_-18px_rgba(15,23,42,0.45)] dark:shadow-[inset_-18px_0_18px_-18px_rgba(239,233,225,0.28)]';
const stickyBodyCellClassName =
  'bg-white dark:bg-[#1C1B19]';

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function formatNumber(value: number) {
  return value.toLocaleString('vi-VN');
}

export default function AccountingHealthPage() {
  const [month, setMonth] = useState(currentMonthValue);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [summary, setSummary] = useState<AccountingHealthSummary | null>(null);

  const loadData = async (monthValue = month) => {
    setRefreshing(true);
    try {
      const data = await getAccountingHealthSummary(`${monthValue}-01`);
      setSummary(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải sức khỏe sổ kế toán.';
      toast.error(message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const severity = summary?.severity ?? 'warning';
  const tone = SEVERITY_TONE[severity];
  const StatusIcon = tone.icon;
  const allAttentionChecks = useMemo(
    () => [...(summary?.blockers ?? []), ...(summary?.warnings ?? [])],
    [summary]
  );
  const failedOutbox = (summary?.metrics.outbox_failed ?? 0) + (summary?.metrics.outbox_dead ?? 0);
  const pendingOutbox = (summary?.metrics.outbox_pending ?? 0) + (summary?.metrics.outbox_processing ?? 0);

  return (
    <div className="space-y-6">
      <section className={cn('rounded-3xl md:rounded-[2rem] border p-5 md:p-8 shadow-sm', tone.bg, tone.border)}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/75 dark:bg-[#11100F]/60 flex items-center justify-center shrink-0">
              <StatusIcon className={cn('w-6 h-6', tone.text)} />
            </div>
            <div>
              <p className="text-3xs font-black uppercase tracking-[0.22em] text-slate-400 dark:text-[#CDBCAB]/60">
                Accounting health and month-close preflight
              </p>
              <h2 className="mt-2 text-xl md:text-2xl font-black uppercase tracking-tight text-slate-950 dark:text-[#EFE9E1]">
                Sức khỏe sổ kế toán
              </h2>
              <p className="mt-2 max-w-3xl text-xs md:text-sm font-medium leading-relaxed text-slate-600 dark:text-[#CDBCAB]/75">
                Kiểm tra outbox, bút toán nháp, reference trùng, readiness TT133 và dữ liệu legacy trước khi khóa tháng.
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-3">
            <label className="block min-w-0 sm:min-w-[11.5rem]">
              <span className="mb-2 block text-3xs font-black uppercase tracking-widest text-slate-400">Tháng preflight</span>
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
              Kiểm tra
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
          {loading ? (
            [1, 2, 3, 4].map((item) => <SkeletonLoader key={item} variant="card" className="h-28" />)
          ) : (
            <>
              <MetricCard
                icon={ShieldCheck}
                label="Preflight khóa tháng"
                value={summary?.can_close_month ? 'PASS' : 'BLOCK'}
                tone={summary?.can_close_month ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}
              />
              <MetricCard
                icon={Activity}
                label="Outbox lỗi"
                value={formatNumber(failedOutbox)}
                tone={failedOutbox > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={FileWarning}
                label="Bút toán DRAFT"
                value={formatNumber(summary?.metrics.journal_draft ?? 0)}
                tone={(summary?.metrics.journal_draft ?? 0) > 0 ? 'text-rose-700 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'}
              />
              <MetricCard
                icon={AlertTriangle}
                label="Readiness TT133"
                value={`${summary?.metrics.readiness_score ?? 0}/100`}
                tone={(summary?.metrics.readiness_score ?? 0) >= 95 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}
              />
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
                Blockers và cảnh báo
              </h3>
              <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
                Blocker sẽ chặn khóa tháng; warning cần theo dõi nhưng không tự động khóa sổ.
              </p>
            </div>
            <span className={cn('inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-3xs font-black uppercase tracking-widest', tone.text, tone.border, tone.bg)}>
              <StatusIcon className="h-3.5 w-3.5" />
              {tone.label}
            </span>
          </div>

          {loading ? (
            <SkeletonTable />
          ) : allAttentionChecks.length === 0 ? (
            <div className="py-12 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#EFE9E1]">
                Không có blocker hoặc cảnh báo mở
              </p>
              <p className="mt-1 text-2xs font-medium text-slate-400">Có thể tiếp tục khóa tháng sau khi kiểm tra số liệu vận hành.</p>
            </div>
          ) : (
            <div className={tableWrapperClassName}>
              <table className="w-[58rem] table-fixed border-collapse text-xs whitespace-nowrap">
                <colgroup>
                  <col className="w-[24rem]" />
                  <col className="w-[8rem]" />
                  <col className="w-[12rem]" />
                  <col className="w-[8rem]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                    <th className="py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400">Kiểm tra</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Số lượng</th>
                    <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Trạng thái</th>
                    <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Mở</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                  {allAttentionChecks.map((check) => (
                    <CheckRow key={check.id} check={check} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
          <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
            Tóm tắt vận hành
          </h3>
          <div className="mt-5 space-y-3">
            <SideMetric label="Outbox pending/processing" value={pendingOutbox} />
            <SideMetric label="Reference active trùng" value={summary?.metrics.duplicate_active_references ?? 0} />
            <SideMetric label="Thiếu business event" value={summary?.metrics.missing_business_event ?? 0} />
            <SideMetric label="Cần review/posting failed" value={(summary?.metrics.needs_review ?? 0) + (summary?.metrics.posting_failed ?? 0)} />
            <SideMetric label="Legacy cần tạo bút toán" value={summary?.metrics.legacy_journal_entries_to_create ?? 0} />
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 dark:bg-[#11100F] p-4">
            <p className="text-3xs font-black uppercase tracking-widest text-slate-400">Điều kiện preflight</p>
            <ul className="mt-3 space-y-2 text-2xs font-medium text-slate-600 dark:text-[#CDBCAB]/75">
              <li>Không có DEAD/FAILED outbox.</li>
              <li>Không có bút toán DRAFT trong tháng.</li>
              <li>Không có reference nghiệp vụ active bị trùng.</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="rounded-3xl md:rounded-[2rem] bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-5 md:p-8 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
          <div>
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-950 dark:text-[#EFE9E1]">
              Reference bút toán bị trùng
            </h3>
            <p className="mt-1 text-2xs font-medium text-slate-500 dark:text-[#CDBCAB]/60">
              Các reference này phải được đảo/cancel đúng chuẩn trước khi khóa tháng.
            </p>
          </div>
          <Link
            href="/dashboard/accounting/journals"
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-200 dark:border-[#3E3A35] px-4 py-2.5 text-3xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:bg-slate-50 dark:hover:bg-[#11100F]"
          >
            Nhật ký chung
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        {loading ? (
          <SkeletonTable />
        ) : (summary?.duplicate_journal_references ?? []).length === 0 ? (
          <div className="py-10 text-center">
            <CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500" />
            <p className="mt-3 text-xs font-black uppercase tracking-wider text-slate-700 dark:text-[#EFE9E1]">
              Không phát hiện reference active bị trùng
            </p>
          </div>
        ) : (
          <div className={tableWrapperClassName}>
            <table className="w-[64rem] table-fixed border-collapse text-xs whitespace-nowrap">
              <colgroup>
                <col className="w-[14rem]" />
                <col className="w-[20rem]" />
                <col className="w-[8rem]" />
                <col className="w-[22rem]" />
              </colgroup>
              <thead>
                <tr className="border-b border-slate-100 dark:border-[#3E3A35]/50 text-left">
                  <th className="py-3 pr-4 text-3xs font-black uppercase tracking-widest text-slate-400">Reference type</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400">Reference ID</th>
                  <th className="py-3 px-4 text-3xs font-black uppercase tracking-widest text-slate-400 text-right">Active</th>
                  <th className="py-3 pl-4 text-3xs font-black uppercase tracking-widest text-slate-400">Journal IDs</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/30">
                {(summary?.duplicate_journal_references ?? []).map((reference) => (
                  <tr key={`${reference.reference_type}:${reference.reference_id}`}>
                    <td className={`${stickyBodyCellClassName} py-4 pr-4 font-mono text-2xs font-black text-slate-800 dark:text-[#EFE9E1]`}>{reference.reference_type}</td>
                    <td className="py-4 px-4 font-mono text-3xs font-bold text-slate-500">{reference.reference_id}</td>
                    <td className="py-4 px-4 text-right font-mono font-black text-rose-700">{reference.active_count}</td>
                    <td className="py-4 pl-4 font-mono text-3xs text-slate-500">{reference.entry_ids.join(', ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: number | string;
  tone: string;
}) {
  return (
    <div className="rounded-[1.5rem] bg-white/80 dark:bg-[#11100F]/50 border border-white/70 dark:border-[#3E3A35]/50 p-5">
      <div className="flex items-center justify-between">
        <span className="text-3xs font-black uppercase tracking-widest text-slate-400">{label}</span>
        <Icon className={cn('w-5 h-5', tone)} />
      </div>
      <div className={cn('mt-4 text-2xl font-black tracking-tight', tone)}>{value}</div>
    </div>
  );
}

function CheckRow({ check }: { check: AccountingHealthCheck }) {
  return (
    <tr>
      <td className={`${stickyBodyCellClassName} py-4 pr-4 min-w-[260px]`}>
        <div className="font-black text-slate-900 dark:text-[#EFE9E1]">{check.label}</div>
        <div className="mt-1 text-3xs font-medium leading-relaxed text-slate-500 dark:text-[#CDBCAB]/60">{check.message}</div>
      </td>
      <td className="py-4 px-4 text-right font-mono font-black text-slate-700 dark:text-[#CDBCAB]">{formatNumber(check.count)}</td>
      <td className="py-4 px-4">
        <span className={cn('inline-flex rounded-full border px-3 py-1 text-4xs font-black uppercase tracking-widest', CHECK_TONE[check.status])}>
          {check.status}
        </span>
      </td>
      <td className="py-4 pl-4 text-right">
        {check.href ? (
          <Link
            href={check.href}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 dark:bg-[#11100F] px-3 py-1.5 text-3xs font-black uppercase tracking-widest text-slate-600 dark:text-[#CDBCAB] hover:text-primary"
          >
            Xem
            <ArrowRight className="w-3 h-3" />
          </Link>
        ) : (
          <span className="text-3xs font-bold text-slate-400">-</span>
        )}
      </td>
    </tr>
  );
}

function SideMetric({ label, value }: { label: string; value: number }) {
  const isClean = value === 0;
  return (
    <div className="flex items-center justify-between rounded-xl bg-slate-50 dark:bg-[#11100F] px-4 py-3">
      <span className="text-2xs font-bold text-slate-500 dark:text-[#CDBCAB]/75">{label}</span>
      <span className={cn('font-mono text-xs font-black', isClean ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400')}>
        {formatNumber(value)}
      </span>
    </div>
  );
}
