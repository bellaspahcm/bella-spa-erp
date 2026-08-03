"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown, BarChart3, Target, DollarSign,
  Users, Building2, FileText, Percent, RefreshCw,
  Award, AlertTriangle
} from "lucide-react";
import { fetchBIReportAction } from "@/modules/real_estate/actions/biReportActions";
import type { BIReportSnapshot } from "@/modules/real_estate/services/BIReportService";
import { PremiumSelect } from "@/components/ui/PremiumSelect";

// ─── Month options helper ─────────────────────────────────────────────────────

const MONTH_VI = [
  'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
  'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12',
];

function generateMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = `${MONTH_VI[d.getMonth()]} ${d.getFullYear()}`;
    options.push({ value, label });
  }
  return options;
}

const MONTH_OPTIONS = generateMonthOptions();

function formatVnd(amount: number): string {
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(1)} tỷ`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(0)} triệu`;
  return amount.toLocaleString("vi-VN") + " đ";
}

function StatCard({
  icon: Icon,
  title,
  value,
  sub,
  trend,
  color = "blue",
}: {
  icon: React.ElementType;
  title: string;
  value: string;
  sub?: string;
  trend?: number;
  color?: "blue" | "green" | "amber" | "purple" | "rose";
}) {
  const colors = {
    blue: "from-blue-500/5 to-blue-600/5 dark:from-blue-500/20 dark:to-blue-600/10 border-blue-200/80 dark:border-blue-500/30 text-blue-700 dark:text-blue-400 bg-blue-50/20 dark:bg-transparent",
    green: "from-emerald-500/5 to-emerald-600/5 dark:from-emerald-500/20 dark:to-emerald-600/10 border-emerald-200/80 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/20 dark:bg-transparent",
    amber: "from-amber-500/5 to-amber-600/5 dark:from-amber-500/20 dark:to-amber-600/10 border-amber-200/80 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 bg-amber-50/20 dark:bg-transparent",
    purple: "from-purple-500/5 to-purple-600/5 dark:from-purple-500/20 dark:to-purple-600/10 border-purple-200/80 dark:border-purple-500/30 text-purple-700 dark:text-purple-400 bg-purple-50/20 dark:bg-transparent",
    rose: "from-rose-500/5 to-rose-600/5 dark:from-rose-500/20 dark:to-rose-600/10 border-rose-200/80 dark:border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-50/20 dark:bg-transparent",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gradient-to-br ${colors[color]} border rounded-2xl p-5 flex gap-4 items-start`}
    >
      <div className="p-2.5 bg-slate-100 dark:bg-white/10 rounded-xl text-slate-700 dark:text-white shrink-0">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-widest mb-1">{title}</p>
        <p className="text-2xl font-black text-slate-900 dark:text-white truncate">{value}</p>
        {sub && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trend >= 0 ? (
              <TrendingUp className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            )}
            <span className={`text-xs font-bold ${trend >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
              {Math.abs(trend)}%
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function FunnelBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
        <span className="font-semibold">{label}</span>
        <span className="font-black text-slate-900 dark:text-white">{value.toLocaleString()}</span>
      </div>
      <div className="h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
          className={`h-full ${color} rounded-full`}
        />
      </div>
    </div>
  );
}

export default function BIAnalyticsPage() {
  const [data, setData] = useState<BIReportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetchBIReportAction(period);
    if (res.success && res.data) setData(res.data);
    setLoading(false);
  }, [period]);

  useEffect(() => { load(); }, [load]);

  const kpis = data?.kpis;
  const funnel = data?.funnel;
  const snapshots = data?.projectSnapshots ?? [];

  return (
    <div className="space-y-8">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            BI Analytics Dashboard
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Báo cáo thông minh theo thời gian thực</p>
        </div>
        <div className="flex items-center gap-3">
          <PremiumSelect
            options={MONTH_OPTIONS}
            value={period}
            onChange={setPeriod}
            buttonClassName="bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-sm font-semibold min-w-[170px]"
          />
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl font-bold text-sm transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Tải lại
          </button>
        </div>
      </div>

      {loading && !data && (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}

      {kpis && (
        <>
          {/* ─ KPI Grid ─ */}
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <StatCard icon={DollarSign} title="Doanh Thu" value={formatVnd(kpis.totalRevenue)} color="green" />
            <StatCard icon={FileText} title="Hợp Đồng" value={String(kpis.totalContracts)} color="blue" />
            <StatCard icon={Target} title="Đặt Cọc" value={String(kpis.totalDeposits)} color="purple" />
            <StatCard icon={Building2} title="Đặt Giữ Chỗ" value={String(kpis.totalBookings)} color="amber" />
            <StatCard icon={Percent} title="Tỷ Lệ Chốt" value={`${kpis.netConversionRate}%`} color="green" />
            <StatCard icon={AlertTriangle} title="Huỷ HĐ" value={String(kpis.totalCancelations)} color="rose" />
          </div>

          {/* ─ Funnel + Top Project ─ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Funnel */}
            {funnel && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h2 className="text-base font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-amber-500" />
                  Phễu Chuyển Đổi Tháng {period}
                </h2>
                <div className="space-y-4">
                  <FunnelBar label="Leads mới" value={funnel.leads} max={funnel.leads || 1} color="bg-slate-300 dark:bg-white/30" />
                  <FunnelBar label="Đủ điều kiện" value={funnel.qualified} max={funnel.leads || 1} color="bg-blue-500/80" />
                  <FunnelBar label="Tham quan thực tế" value={funnel.siteVisits} max={funnel.leads || 1} color="bg-purple-500/80" />
                  <FunnelBar label="Cơ hội đàm phán" value={funnel.opportunities} max={funnel.leads || 1} color="bg-amber-500/80" />
                  <FunnelBar label="Đặt giữ chỗ" value={funnel.bookings} max={funnel.leads || 1} color="bg-orange-500/80" />
                  <FunnelBar label="Đặt cọc" value={funnel.deposits} max={funnel.leads || 1} color="bg-emerald-500/80" />
                  <FunnelBar label="Ký HĐMB" value={funnel.contracts} max={funnel.leads || 1} color="bg-green-500/80" />
                </div>
              </div>
            )}

            {/* Top Project */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4 shadow-sm">
              <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500" />
                Hiệu Suất Dự Án
              </h2>
              {snapshots.length === 0 && (
                <p className="text-slate-500 dark:text-slate-400 text-sm italic">Chưa có dữ liệu dự án.</p>
              )}
              {snapshots.map((snap, i) => (
                <motion.div
                  key={snap.projectId}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="flex items-center gap-4 p-3 bg-slate-50 dark:bg-white/5 rounded-2xl"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-500/20 flex items-center justify-center text-amber-700 dark:text-amber-400 font-black text-sm shrink-0">
                    #{i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-900 dark:text-white font-bold text-sm truncate">{snap.projectName}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">
                      {snap.total - snap.available}/{snap.total} căn &middot; Tỷ lệ kín: <span className="text-amber-600 dark:text-amber-400 font-bold">{snap.occupancyRatePct}%</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{formatVnd(snap.soldValueVnd)}</p>
                    <p className="text-slate-400 dark:text-slate-500 text-xs">đã giao dịch</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* ─ Project Inventory Table ─ */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-x-auto shadow-sm">
            <h2 className="text-base font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-amber-500" />
              Bảng Tồn Kho Theo Dự Án
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left pb-3 font-semibold">Dự Án</th>
                  <th className="text-right pb-3 font-semibold">Tổng</th>
                  <th className="text-right pb-3 font-semibold">Trống</th>
                  <th className="text-right pb-3 font-semibold">Giữ Chỗ</th>
                  <th className="text-right pb-3 font-semibold">Đặt Cọc</th>
                  <th className="text-right pb-3 font-semibold">Ký HĐMB</th>
                  <th className="text-right pb-3 font-semibold">Bàn Giao</th>
                  <th className="text-right pb-3 font-semibold">Kín (%)</th>
                  <th className="text-right pb-3 font-semibold">Giá Trị Bán</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {snapshots.map(snap => (
                  <tr key={snap.projectId} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td className="py-3 text-slate-900 dark:text-white font-bold">{snap.projectName}</td>
                    <td className="py-3 text-right text-slate-700 dark:text-slate-300">{snap.total}</td>
                    <td className="py-3 text-right text-slate-700 dark:text-slate-300">{snap.available}</td>
                    <td className="py-3 text-right text-amber-600 dark:text-amber-400 font-semibold">{snap.booked}</td>
                    <td className="py-3 text-right text-orange-600 dark:text-orange-400 font-semibold">{snap.deposited}</td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">{snap.signed}</td>
                    <td className="py-3 text-right text-blue-600 dark:text-blue-400 font-semibold">{snap.handover}</td>
                    <td className="py-3 text-right">
                      <span className={`font-black ${snap.occupancyRatePct >= 80 ? "text-emerald-600 dark:text-emerald-400" : snap.occupancyRatePct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}`}>
                        {snap.occupancyRatePct}%
                      </span>
                    </td>
                    <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatVnd(snap.soldValueVnd)}</td>
                  </tr>
                ))}
                {snapshots.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">
                      Chưa có dữ liệu dự án
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* ─ Average Deal Size ─ */}
          {kpis.avgDealSizeVnd > 0 && (
            <div className="bg-gradient-to-r from-amber-500/10 to-emerald-500/10 border border-amber-500/20 dark:border-amber-500/30 rounded-3xl p-6 flex items-center gap-6 shadow-sm">
              <div className="p-4 bg-amber-100 dark:bg-amber-500/20 rounded-2xl text-amber-700 dark:text-amber-400">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <p className="text-slate-500 dark:text-slate-400 text-sm uppercase tracking-widest font-semibold">Giá Trị Hợp Đồng Trung Bình</p>
                <p className="text-4xl font-black text-slate-900 dark:text-white mt-1">{formatVnd(kpis.avgDealSizeVnd)}</p>
                {kpis.topProjectName && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                    Dự án dẫn đầu: <span className="text-amber-600 dark:text-amber-400 font-bold">{kpis.topProjectName}</span> — {formatVnd(kpis.topProjectRevenue)}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
