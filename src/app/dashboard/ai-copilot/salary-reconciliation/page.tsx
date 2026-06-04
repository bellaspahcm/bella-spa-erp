import { getSalaryReconciliation } from '@/services/salary-reconciliation-actions';
import {
AlertTriangle,
CheckCircle2,
DollarSign,
HelpCircle,
Scale,
TrendingUp,
Users,
XCircle,
} from 'lucide-react';

/* ── helpers ─────────────────────────────────────────────── */
function fmt(n: number) {
  return n.toLocaleString('vi-VN') + 'đ';
}

function fmtPct(n: number | null) {
  if (n === null) return '—';
  return n.toFixed(2) + '%';
}

const STATUS_META = {
  MATCH:      { label: 'Khớp',           icon: CheckCircle2,   cls: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  MINOR_DIFF: { label: 'Lệch nhỏ',       icon: AlertTriangle,  cls: 'text-amber-500   bg-amber-500/10   border-amber-500/20'   },
  MAJOR_DIFF: { label: 'Lệch lớn',       icon: XCircle,        cls: 'text-rose-500    bg-rose-500/10    border-rose-500/20'    },
  NO_LEGACY:  { label: 'Chưa chốt lương',icon: HelpCircle,     cls: 'text-slate-400   bg-slate-400/10   border-slate-400/20'   },
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
        <p className="text-rose-500 font-bold text-sm">⚠️ {error ?? 'Không tải được dữ liệu đối soát.'}</p>
      </div>
    );
  }

  const { rows, totalKtv, matchCount, minorCount, majorCount, totalDiffAbs } = data;
  const displayMonth = new Date(month).toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });

  return (
    <div className="space-y-8 p-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
            <Scale className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent uppercase tracking-wider">
              Đối soát Bảng lương
            </h1>
            <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">
              AI tính vs Kế toán chốt • {displayMonth}
            </p>
          </div>
        </div>

        {/* Month picker (GET-based, no JS) */}
        <form method="GET" className="flex items-center gap-2">
          <label className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Tháng:</label>
          <input
            type="month"
            name="month"
            defaultValue={month.slice(0, 7)}
            className="bg-muted border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-primary"
          />
          <button
            type="submit"
            className="bg-primary text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-xl hover:bg-primary/90 transition-all"
          >
            Xem
          </button>
        </form>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Tổng KTV', value: totalKtv,     icon: Users,      cls: 'from-slate-600 to-slate-500' },
          { label: 'Khớp',     value: matchCount,   icon: CheckCircle2, cls: 'from-emerald-600 to-emerald-500' },
          { label: 'Lệch nhỏ', value: minorCount,   icon: AlertTriangle, cls: 'from-amber-600 to-amber-500' },
          { label: 'Lệch lớn', value: majorCount,   icon: XCircle,      cls: 'from-rose-600 to-rose-500' },
        ].map(({ label, value, icon: Icon, cls }) => (
          <div key={label} className="bg-card/60 border border-border rounded-2xl p-5 flex items-center gap-4 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cls} flex items-center justify-center shrink-0`}>
              <Icon className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-2xl font-black text-foreground">{value}</p>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Total diff callout */}
      {totalDiffAbs > 0 && (
        <div className={`flex items-center gap-3 rounded-2xl px-5 py-4 border text-sm font-bold ${
          majorCount > 0
            ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            : minorCount > 0
              ? 'bg-amber-500/10 border-amber-500/20 text-amber-400'
              : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
        }`}>
          <DollarSign className="w-5 h-5 shrink-0" />
          <span>
            Tổng chênh lệch tuyệt đối:{' '}
            <span className="font-black">{fmt(totalDiffAbs)}</span>
            {majorCount > 0 && ' — Cần xem xét ngay các trường hợp lệch lớn.'}
            {!majorCount && minorCount > 0 && ' — Chênh lệch nhỏ, kiểm tra lại chiết khấu hoặc thưởng làm tròn.'}
            {!majorCount && !minorCount && ' — Toàn bộ sai số nằm trong ngưỡng chấp nhận được.'}
          </span>
        </div>
      )}

      {/* ── Data table ── */}
      <div className="bg-card/60 border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-4 border-b border-border">
          <h3 className="text-xs font-black text-foreground uppercase tracking-widest flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" /> Chi tiết đối soát từng KTV
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                {['KTV', 'AI tính (đ)', 'Kế toán chốt (đ)', 'Chênh lệch (đ)', 'Chênh lệch %', 'Trạng thái chốt', 'Kết quả'].map(h => (
                  <th key={h} className="px-4 py-3 text-left font-extrabold uppercase tracking-widest text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground font-bold">
                    Không có dữ liệu KTV nào cho tháng này.
                  </td>
                </tr>
              ) : rows.map((row) => {
                const meta = STATUS_META[row.status];
                const Icon = meta.icon;
                const diffPositive = row.diff_amount >= 0;

                return (
                  <tr key={row.ktv_id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3 font-bold text-foreground">{row.ktv_name}</td>
                    <td className="px-4 py-3 font-mono font-bold text-foreground">{fmt(row.ai_total)}</td>
                    <td className="px-4 py-3 font-mono text-muted-foreground">
                      {row.has_legacy_record ? fmt(row.legacy_total) : <span className="italic text-slate-500">Chưa có</span>}
                    </td>
                    <td className={`px-4 py-3 font-mono font-bold ${diffPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {row.has_legacy_record ? (diffPositive ? '+' : '') + fmt(row.diff_amount) : '—'}
                    </td>
                    <td className={`px-4 py-3 font-mono font-bold ${
                      row.diff_percent === null ? 'text-slate-500'
                        : row.diff_percent < 1 ? 'text-emerald-400'
                        : row.diff_percent < 5 ? 'text-amber-400'
                        : 'text-rose-400'
                    }`}>
                      {fmtPct(row.diff_percent)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{row.legacy_status}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[10px] font-black uppercase tracking-widest ${meta.cls}`}>
                        <Icon className="w-3 h-3" />
                        {meta.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 py-5 px-6 bg-card/30 border border-border/50 rounded-2xl shadow-sm mt-4">
        {Object.entries(STATUS_META).map(([key, { label, icon: Icon, cls }]) => (
          <div key={key} className="flex items-center">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-[10px] font-black uppercase tracking-widest shadow-sm ${cls}`}>
              <Icon className="w-3.5 h-3.5" /> {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export const dynamic = 'force-dynamic';
