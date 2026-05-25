'use client';

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  PieChart,
  Activity,
  Calendar,
  ArrowLeft,
  Award,
  AlertTriangle,
} from 'lucide-react';
import type { ConsolidatedPnLRow } from '@/services/hq-actions';

interface Props {
  initialRows: ConsolidatedPnLRow[];
  initialFromDate: string;
  initialToDate: string;
  errorMessage: string | null;
}

const fmtVND = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0);

const fmtCompact = (n: number) => {
  const num = Number(n) || 0;
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(0)}K`;
  return num.toString();
};

const RANK_ICONS = ['🥇', '🥈', '🥉'];

export default function FinancialOverviewClient({
  initialRows,
  initialFromDate,
  initialToDate,
  errorMessage,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);

  // Aggregated network metrics
  const aggregates = useMemo(() => {
    const totalRevenue = initialRows.reduce((s, r) => s + Number(r.net_revenue || 0), 0);
    const totalProfit = initialRows.reduce((s, r) => s + Number(r.net_profit || 0), 0);
    const totalSessions = initialRows.reduce((s, r) => s + Number(r.total_sessions_completed || 0), 0);
    const totalBookings = initialRows.reduce((s, r) => s + Number(r.total_bookings_count || 0), 0);
    const networkMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    return { totalRevenue, totalProfit, totalSessions, totalBookings, networkMargin };
  }, [initialRows]);

  // Chart data — show top 10 branches
  const chartData = useMemo(() => {
    return initialRows.slice(0, 10).map((r) => ({
      name: r.tenant_name.length > 18 ? r.tenant_name.slice(0, 16) + '…' : r.tenant_name,
      fullName: r.tenant_name,
      revenue: Number(r.net_revenue) || 0,
      profit: Number(r.net_profit) || 0,
      margin: Number(r.net_margin_percent) || 0,
    }));
  }, [initialRows]);

  const handleApplyDateFilter = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('from', fromDate);
    params.set('to', toDate);
    router.push(`/hq/financial-overview?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-pink-50/30 to-white dark:from-[#11100F] dark:via-[#1C1B19] dark:to-[#11100F] p-6 md:p-10">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* ── HEADER ── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-2">
            <Link
              href="/hq"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-primary dark:text-[#CDBCAB]/70 dark:hover:text-[#A67D44] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Quay lại HQ Dashboard
            </Link>
            <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-tight flex items-center gap-3">
              <PieChart className="w-7 h-7 text-primary dark:text-[#A67D44]" />
              Tổng quan Tài chính Toàn Network
            </h1>
            <p className="text-xs text-slate-500 dark:text-[#CDBCAB]/70">
              So sánh P&L các chi nhánh trong hệ thống — chuẩn Thông tư 133/2016/TT-BTC
            </p>
          </div>

          {/* Date range filter */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-white dark:bg-[#1C1B19] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-3 sm:px-4 sm:py-2.5 rounded-2xl shadow-sm w-full sm:w-auto">
            <div className="flex items-center gap-2 justify-between sm:justify-start">
              <Calendar className="w-4 h-4 text-primary dark:text-[#A67D44] shrink-0" />
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2 py-1 bg-transparent text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1] w-24 sm:w-auto"
              />
              <span className="text-3xs text-slate-400">→</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2 py-1 bg-transparent text-2xs font-bold outline-none text-slate-800 dark:text-[#EFE9E1] w-24 sm:w-auto"
              />
            </div>
            <button
              onClick={handleApplyDateFilter}
              className="px-4 py-2 sm:py-1.5 rounded-xl bg-primary text-white text-3xs font-black uppercase tracking-widest hover:bg-primary/90 active:scale-95 cursor-pointer transition-all w-full sm:w-auto text-center shrink-0"
            >
              Áp dụng
            </button>
          </div>
        </div>

        {/* ── ERROR BANNER ── */}
        {errorMessage && (
          <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-700 dark:text-rose-300">
              <p className="font-bold mb-1">Không thể tải báo cáo</p>
              <p>{errorMessage}</p>
            </div>
          </div>
        )}

        {/* ── AGGREGATED METRICS CARDS ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            icon={<Building2 className="w-5 h-5" />}
            label="Chi nhánh hoạt động"
            value={initialRows.length.toString()}
            color="blue"
          />
          <MetricCard
            icon={<DollarSign className="w-5 h-5" />}
            label="Doanh thu thuần toàn mạng"
            value={fmtVND(aggregates.totalRevenue)}
            color="emerald"
          />
          <MetricCard
            icon={aggregates.totalProfit >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
            label="Lợi nhuận sau thuế"
            value={fmtVND(aggregates.totalProfit)}
            color={aggregates.totalProfit >= 0 ? 'emerald' : 'rose'}
          />
          <MetricCard
            icon={<Activity className="w-5 h-5" />}
            label="Tỷ suất lợi nhuận"
            value={`${aggregates.networkMargin.toFixed(1)}%`}
            color={aggregates.networkMargin >= 0 ? 'amber' : 'rose'}
          />
        </div>

        {/* ── COMPARISON CHART ── */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-6 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary dark:text-[#A67D44]" />
            So sánh Doanh thu thuần & Lợi nhuận sau thuế — Top 10 chi nhánh
          </h3>

          {chartData.length === 0 ? (
            <div className="py-16 text-center text-slate-400 italic">
              Chưa có dữ liệu kế toán cho kỳ này. Hãy đảm bảo các chi nhánh đã có bút toán POSTED.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#FFE4E6" className="dark:stroke-[#3E3A35]/30" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11 }} stroke="#94a3b8" />
                <Tooltip
                  formatter={(value) => fmtVND(Number(value))}
                  labelFormatter={(label, payload) => payload?.[0]?.payload?.fullName || label}
                  contentStyle={{
                    background: 'rgba(255, 255, 255, 0.95)',
                    border: '1px solid #FFE4E6',
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="revenue" name="Doanh thu thuần" fill="#BE185D" radius={[8, 8, 0, 0]} />
                <Bar dataKey="profit" name="Lợi nhuận sau thuế" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.profit >= 0 ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* ── BRANCH DETAIL TABLE ── */}
        <div className="bg-white dark:bg-[#1C1B19] rounded-[2.5rem] border border-[#FFE4E6] dark:border-[#3E3A35]/50 p-6 md:p-8 shadow-sm">
          <h3 className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] uppercase tracking-wider mb-6 flex items-center gap-2">
            <Award className="w-4 h-4 text-primary dark:text-[#A67D44]" />
            Bảng xếp hạng chi nhánh theo lợi nhuận
          </h3>

          {initialRows.length === 0 ? (
            <div className="py-12 text-center text-slate-400 italic">Chưa có chi nhánh nào hoạt động.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left bg-slate-50 dark:bg-[#11100F]/40 border-b border-slate-200 dark:border-[#3E3A35]/40">
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-center">#</th>
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest">Chi nhánh</th>
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Doanh thu thuần</th>
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Chi phí QLKD</th>
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Lợi nhuận thuần</th>
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Biên LN</th>
                    <th className="px-4 py-4 text-3xs font-black text-slate-400 dark:text-[#CDBCAB]/60 uppercase tracking-widest text-right">Số ca hoàn thành</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#3E3A35]/20">
                  {initialRows.map((row, idx) => {
                    const profit = Number(row.net_profit) || 0;
                    const margin = Number(row.net_margin_percent) || 0;
                    const isProfit = profit >= 0;
                    const rankIcon = RANK_ICONS[idx];

                    return (
                      <motion.tr
                        key={row.tenant_id}
                        whileHover={{ backgroundColor: 'rgba(244,63,94,0.02)' }}
                        className="transition-colors"
                      >
                        <td className="px-4 py-4 text-center font-mono font-black text-xs">
                          {rankIcon ? <span className="text-xl">{rankIcon}</span> : <span className="text-slate-400">{idx + 1}</span>}
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/hq?selectedBranch=${row.tenant_id}`}
                            className="text-sm font-black text-slate-900 dark:text-[#EFE9E1] hover:text-primary dark:hover:text-[#A67D44] transition-colors"
                          >
                            {row.tenant_name}
                          </Link>
                          <p className="text-3xs text-slate-400 mt-0.5">
                            {row.total_bookings_count || 0} bookings · {row.total_sessions_completed || 0} ca xong
                          </p>
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-bold text-slate-700 dark:text-[#CDBCAB]">
                          {fmtVND(row.net_revenue)}
                        </td>
                        <td className="px-4 py-4 text-right font-mono text-2xs text-rose-500">
                          {fmtVND(row.operating_expense)}
                        </td>
                        <td className={`px-4 py-4 text-right font-mono font-black ${isProfit ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {isProfit ? '+' : ''}{fmtVND(profit)}
                        </td>
                        <td className={`px-4 py-4 text-right font-mono font-bold ${margin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {margin >= 0 ? '+' : ''}{margin.toFixed(1)}%
                        </td>
                        <td className="px-4 py-4 text-right font-mono font-bold text-slate-700 dark:text-[#CDBCAB]">
                          {row.total_sessions_completed || 0}
                        </td>
                      </motion.tr>
                    );
                  })}
                </tbody>
                {/* Footer with totals */}
                <tfoot>
                  <tr className="border-t-2 border-slate-200 dark:border-[#3E3A35]/40 bg-slate-50/40 dark:bg-[#11100F]/40 font-black">
                    <td colSpan={2} className="px-4 py-4 text-xs uppercase tracking-widest text-slate-900 dark:text-[#EFE9E1]">
                      Tổng cộng toàn network
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-slate-900 dark:text-[#EFE9E1]">
                      {fmtVND(aggregates.totalRevenue)}
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-2xs text-rose-500">
                      {fmtVND(initialRows.reduce((s, r) => s + Number(r.operating_expense || 0), 0))}
                    </td>
                    <td className={`px-4 py-4 text-right font-mono text-sm ${aggregates.totalProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {aggregates.totalProfit >= 0 ? '+' : ''}{fmtVND(aggregates.totalProfit)}
                    </td>
                    <td className={`px-4 py-4 text-right font-mono text-sm ${aggregates.networkMargin >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                      {aggregates.networkMargin.toFixed(1)}%
                    </td>
                    <td className="px-4 py-4 text-right font-mono text-sm text-slate-900 dark:text-[#EFE9E1]">
                      {aggregates.totalSessions}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'blue' | 'emerald' | 'rose' | 'amber';
}) {
  const colorClasses = {
    blue: 'bg-blue-50/60 dark:bg-blue-500/10 border-blue-200/50 dark:border-blue-500/30 text-blue-600 dark:text-blue-400',
    emerald: 'bg-emerald-50/60 dark:bg-emerald-500/10 border-emerald-200/50 dark:border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
    rose: 'bg-rose-50/60 dark:bg-rose-500/10 border-rose-200/50 dark:border-rose-500/30 text-rose-600 dark:text-rose-400',
    amber: 'bg-amber-50/60 dark:bg-amber-500/10 border-amber-200/50 dark:border-amber-500/30 text-amber-600 dark:text-amber-400',
  };

  return (
    <div className={`p-5 rounded-2xl border ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-3xs font-black uppercase tracking-widest opacity-80">{label}</p>
        <span className="opacity-70">{icon}</span>
      </div>
      <p className="text-xl md:text-2xl font-mono font-black text-slate-900 dark:text-[#EFE9E1]">{value}</p>
    </div>
  );
}
