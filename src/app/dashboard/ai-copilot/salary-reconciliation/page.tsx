import { getSalaryReconciliation } from '@/services/salary-reconciliation-actions';
import { SalaryReconciliationRefreshHandler } from './salary-reconciliation-refresh-handler';
import { SalaryReconciliationClient } from './salary-reconciliation-client';

/* ── helpers ─────────────────────────────────────────────── */
export function fmt(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

export function fmtPct(n: number | null) {
  if (n === null) return '—';
  return n.toFixed(2) + '%';
}

export const STATUS_META = {
  MATCH:      { label: 'Khớp',           icon: 'CheckCircle2',   cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  MINOR_DIFF: { label: 'Lệch nhỏ',       icon: 'AlertTriangle',  cls: 'text-amber-500   bg-amber-500/10   border-amber-500/20'   },
  MAJOR_DIFF: { label: 'Lệch lớn',       icon: 'XCircle',        cls: 'text-rose-500    bg-rose-500/10    border-rose-500/20'    },
  NO_LEGACY:  { label: 'Chưa chốt lương',icon: 'HelpCircle',     cls: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
} as const;

/* ── default month = current ─────────────────────────────── */
function currentMonthParam() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

/* ── page ────────────────────────────────────────────────── */
export default async function SalaryReconciliationPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const params = await searchParams;
  const month = params.month ?? currentMonthParam();

  const { data, error } = await getSalaryReconciliation(month);

  if (error || !data) {
    return (
      <div className="flex items-center justify-center h-64">
        <SalaryReconciliationRefreshHandler />
        <p className="text-rose-500 font-bold text-sm">⚠️ {error ?? 'Không tải được dữ liệu đối soát.'}</p>
      </div>
    );
  }

  const { rows, totalKtv, matchCount, minorCount, majorCount, totalDiffAbs } = data;
  const displayMonth = new Date(month).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <SalaryReconciliationClient
      month={month}
      displayMonth={displayMonth}
      rows={rows}
      totalKtv={totalKtv}
      matchCount={matchCount}
      minorCount={minorCount}
      majorCount={majorCount}
      totalDiffAbs={totalDiffAbs}
    />
  );
}

export const dynamic = 'force-dynamic';
