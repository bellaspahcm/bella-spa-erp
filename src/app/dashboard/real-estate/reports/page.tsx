"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileBarChart2, Download, Calendar, Filter, RefreshCw,
  TrendingUp, Building2, FileText, Users, CheckCircle2,
  Clock, AlertTriangle, ChevronDown,
  DollarSign, FileSignature, Wallet, Bookmark, Target, BarChart3, Trophy
} from "lucide-react";
import { fetchBIReportAction } from "@/modules/real_estate/actions/biReportActions";
import type { BIReportSnapshot } from "@/modules/real_estate/services/BIReportService";

function formatVnd(v: number) {
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)} tỷ VNĐ`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(0)} triệu VNĐ`;
  return `${v.toLocaleString("vi-VN")} đ`;
}

const REPORT_TYPES = [
  { id: "executive", label: "Báo Cáo Điều Hành", icon: TrendingUp, desc: "Tổng quan KPI cho Ban Giám Đốc" },
  { id: "inventory", label: "Báo Cáo Tồn Kho BĐS", icon: Building2, desc: "Chi tiết trạng thái từng căn hộ" },
  { id: "sales", label: "Báo Cáo Kinh Doanh", icon: FileText, desc: "Hợp đồng, đặt cọc, thanh toán tiến độ" },
  { id: "crm", label: "Báo Cáo CRM", icon: Users, desc: "Leads, phễu chuyển đổi, môi giới" },
] as const;

type ReportId = (typeof REPORT_TYPES)[number]["id"];

export default function ReportsPage() {
  const [data, setData] = useState<BIReportSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReport, setSelectedReport] = useState<ReportId>("executive");
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

  const handlePrint = () => window.print();

  const kpis = data?.kpis;
  const funnel = data?.funnel;
  const snapshots = data?.projectSnapshots ?? [];

  return (
    <div className="space-y-8">
      {/* ─ Header ─ */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <FileBarChart2 className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
            </div>
            Trung Tâm Báo Cáo
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            Xuất và xem báo cáo quản trị theo kỳ
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-slate-900 dark:text-white text-sm pr-8 focus:outline-none focus:border-amber-500/50"
            />
            <ChevronDown className="w-4 h-4 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Tải lại
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-black px-4 py-2 rounded-xl text-sm font-bold transition-all"
          >
            <Download className="w-4 h-4" />
            Xuất PDF
          </button>
        </div>
      </div>

      {/* ─ Report Type Tabs ─ */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REPORT_TYPES.map(rt => {
          const Icon = rt.icon;
          const active = selectedReport === rt.id;
          return (
            <button
              key={rt.id}
              onClick={() => setSelectedReport(rt.id)}
              className={`flex items-start gap-3 p-4 rounded-2xl border transition-all text-left ${
                active
                  ? "bg-amber-50 dark:bg-amber-500/15 border-amber-300 dark:border-amber-500/40"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-300 dark:hover:border-amber-700/50"
              }`}
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? "text-amber-600 dark:text-amber-400" : "text-slate-400 dark:text-slate-500"}`} />
              <div>
                <p className={`font-bold text-sm ${active ? "text-amber-700 dark:text-amber-300" : "text-slate-700 dark:text-slate-300"}`}>{rt.label}</p>
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{rt.desc}</p>
              </div>
            </button>
          );
        })}
      </div>

      {loading && (
        <div className="flex items-center justify-center h-64">
          <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
        </div>
      )}

      {/* ─── Report Body ─── */}
      {!loading && data && (
        <motion.div
          key={selectedReport}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Executive Summary */}
          {selectedReport === "executive" && kpis && (
            <>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-slate-900 dark:text-white">Báo Cáo Điều Hành</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Kỳ: {period} · Tạo lúc: {new Date(data.generatedAt).toLocaleString("vi-VN")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {([
                    { label: "Tổng Doanh Thu (Ký HĐMB)", value: formatVnd(kpis.totalRevenue), Icon: DollarSign, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
                    { label: "Số Hợp Đồng HĐMB", value: String(kpis.totalContracts), Icon: FileSignature, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
                    { label: "Số Đặt Cọc", value: String(kpis.totalDeposits), Icon: Wallet, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-100 dark:bg-violet-900/30" },
                    { label: "Số Đặt Giữ Chỗ", value: String(kpis.totalBookings), Icon: Bookmark, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
                    { label: "Tỷ Lệ Chốt Lead → HĐ", value: `${kpis.netConversionRate}%`, Icon: Target, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-100 dark:bg-rose-900/30" },
                    { label: "Giá Trị HĐ Bình Quân", value: formatVnd(kpis.avgDealSizeVnd), Icon: BarChart3, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-100 dark:bg-cyan-900/30" },
                  ] as const).map(item => (
                    <div key={item.label} className="bg-slate-50 dark:bg-slate-800/50 rounded-2xl p-4">
                      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${item.bg}`}>
                        <item.Icon className={`w-5 h-5 ${item.color}`} />
                      </div>
                      <p className="text-slate-900 dark:text-white font-black text-xl">{item.value}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-xs mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>

                {kpis.topProjectName && (
                  <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-2xl flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                      <p className="text-slate-900 dark:text-white font-bold">Dự Án Dẫn Đầu: {kpis.topProjectName}</p>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">Giá trị giao dịch: {formatVnd(kpis.topProjectRevenue)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Funnel summary */}
              {funnel && (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                  <h3 className="font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-500" />
                    Hiệu Suất Phễu Bán Hàng
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Leads Mới", value: funnel.leads, color: "text-slate-700 dark:text-slate-300" },
                      { label: "Đủ ĐK (Qualified)", value: funnel.qualified, color: "text-blue-600 dark:text-blue-400" },
                      { label: "Tham Quan Thực Tế", value: funnel.siteVisits, color: "text-purple-600 dark:text-purple-400" },
                      { label: "Ký HĐMB (Đích Đến)", value: funnel.contracts, color: "text-emerald-600 dark:text-emerald-400" },
                    ].map(f => (
                      <div key={f.label} className="text-center p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
                        <p className={`text-3xl font-black ${f.color}`}>{f.value}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">{f.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-slate-500 dark:text-slate-400 text-sm mt-4">
                    Tỷ lệ chuyển đổi tổng thể: <span className="text-amber-600 dark:text-amber-400 font-black">{funnel.conversionLeadToContract}%</span>
                  </p>
                </div>
              )}
            </>
          )}

          {/* Inventory Report */}
          {selectedReport === "inventory" && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 overflow-x-auto shadow-sm">
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                Báo Cáo Tồn Kho Bất Động Sản — {period}
              </h2>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                    {["Dự Án", "Tổng SP", "Trống", "Giữ Chỗ", "Đặt Cọc", "Ký HĐ", "Bàn Giao", "Kín (%)", "Giá Trị Danh Mục", "Đã Giao Dịch"].map(h => (
                      <th key={h} className="text-right first:text-left pb-3 font-bold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {snapshots.map(s => (
                    <tr key={s.projectId} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-slate-900 dark:text-white font-bold">{s.projectName}</td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-400">{s.total}</td>
                      <td className="py-3 text-right text-slate-600 dark:text-slate-400">{s.available}</td>
                      <td className="py-3 text-right text-amber-600 dark:text-amber-400">{s.booked}</td>
                      <td className="py-3 text-right text-orange-600 dark:text-orange-400">{s.deposited}</td>
                      <td className="py-3 text-right text-emerald-600 dark:text-emerald-400">{s.signed}</td>
                      <td className="py-3 text-right text-blue-600 dark:text-blue-400">{s.handover}</td>
                      <td className="py-3 text-right font-black">
                        <span className={s.occupancyRatePct >= 80 ? "text-emerald-600 dark:text-emerald-400" : s.occupancyRatePct >= 50 ? "text-amber-600 dark:text-amber-400" : "text-rose-600 dark:text-rose-400"}>
                          {s.occupancyRatePct}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-slate-500 dark:text-slate-400">{formatVnd(s.totalValueVnd)}</td>
                      <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-bold">{formatVnd(s.soldValueVnd)}</td>
                    </tr>
                  ))}
                  {snapshots.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-400 dark:text-slate-500 text-sm italic">
                        Chưa có dữ liệu dự án nào
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Sales Report */}
          {selectedReport === "sales" && kpis && (
            <div className="space-y-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-500" />
                  Báo Cáo Kinh Doanh — {period}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest font-bold">Giao Dịch</h3>
                    {[
                      { label: "Số đặt giữ chỗ trong kỳ", value: kpis.totalBookings, icon: <Clock className="w-4 h-4 text-amber-500" /> },
                      { label: "Số đặt cọc", value: kpis.totalDeposits, icon: <CheckCircle2 className="w-4 h-4 text-orange-500" /> },
                      { label: "Số hợp đồng HĐMB ký", value: kpis.totalContracts, icon: <FileText className="w-4 h-4 text-emerald-500" /> },
                      { label: "Số hợp đồng bị huỷ", value: kpis.totalCancelations, icon: <AlertTriangle className="w-4 h-4 text-rose-500" /> },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                        <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 text-sm">{row.icon}{row.label}</div>
                        <span className="text-slate-900 dark:text-white font-black">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-slate-500 dark:text-slate-400 text-xs uppercase tracking-widest font-bold">Doanh Thu</h3>
                    {[
                      { label: "Tổng doanh thu HĐMB ký", value: formatVnd(kpis.totalRevenue) },
                      { label: "Giá trị HĐ trung bình", value: formatVnd(kpis.avgDealSizeVnd) },
                      { label: "Tỷ lệ chốt (Lead → HĐ)", value: `${kpis.netConversionRate}%` },
                      { label: "Dự án có DT cao nhất", value: kpis.topProjectName ?? "—" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800">
                        <span className="text-slate-600 dark:text-slate-400 text-sm">{row.label}</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CRM Report */}
          {selectedReport === "crm" && funnel && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm">
              <h2 className="text-lg font-black text-slate-900 dark:text-white mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                Báo Cáo CRM — {period}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Tổng Leads Mới", value: funnel.leads, color: "text-slate-700 dark:text-slate-300", bg: "bg-slate-50 dark:bg-slate-800/40" },
                  { label: "Leads Đủ ĐK", value: funnel.qualified, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-950/30" },
                  { label: "Đã Tham Quan TT", value: funnel.siteVisits, color: "text-purple-600 dark:text-purple-400", bg: "bg-purple-50 dark:bg-purple-950/30" },
                  { label: "Đang Đàm Phán", value: funnel.opportunities, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
                  { label: "Đã Đặt Giữ Chỗ", value: funnel.bookings, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/30" },
                  { label: "Đã Đặt Cọc", value: funnel.deposits, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
                  { label: "Đã Ký HĐMB", value: funnel.contracts, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/30" },
                  { label: "Tỷ Lệ Chuyển Đổi", value: `${funnel.conversionLeadToContract}%`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/30" },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-2xl p-4 text-center`}>
                    <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
                    <p className="text-slate-500 dark:text-slate-400 text-xs mt-2">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Footer note */}
      <p className="text-slate-400 dark:text-slate-500 text-xs text-center flex items-center justify-center gap-2">
        <Calendar className="w-3 h-3" />
        Dữ liệu được truy xuất trực tiếp từ hệ thống · Cập nhật mỗi lần tải trang
      </p>
    </div>
  );
}
