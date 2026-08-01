"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileBarChart2, Download, Calendar, Filter, RefreshCw,
  TrendingUp, Building2, FileText, Users, CheckCircle2,
  Clock, AlertTriangle, ChevronDown
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">Trung Tâm Báo Cáo</h1>
          <p className="text-white/40 text-sm mt-1">Xuất và xem báo cáo quản trị theo kỳ</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative">
            <input
              type="month"
              value={period}
              onChange={e => setPeriod(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-white text-sm pr-8 focus:outline-none focus:border-amber-500/50"
            />
            <ChevronDown className="w-4 h-4 text-white/40 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all"
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

      {/* Report Type Tabs */}
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
                  ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                  : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Icon className={`w-5 h-5 mt-0.5 shrink-0 ${active ? "text-amber-400" : ""}`} />
              <div>
                <p className={`font-bold text-sm ${active ? "text-white" : ""}`}>{rt.label}</p>
                <p className="text-xs opacity-60 mt-0.5">{rt.desc}</p>
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
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2.5 bg-amber-500/20 rounded-xl">
                    <TrendingUp className="w-5 h-5 text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-black text-white">Báo Cáo Điều Hành</h2>
                    <p className="text-white/40 text-xs">Kỳ: {period} · Tạo lúc: {new Date(data.generatedAt).toLocaleString("vi-VN")}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {[
                    { label: "Tổng Doanh Thu (Ký HĐMB)", value: formatVnd(kpis.totalRevenue), icon: "💰" },
                    { label: "Số Hợp Đồng HĐMB", value: String(kpis.totalContracts), icon: "📋" },
                    { label: "Số Đặt Cọc", value: String(kpis.totalDeposits), icon: "🤝" },
                    { label: "Số Đặt Giữ Chỗ", value: String(kpis.totalBookings), icon: "📌" },
                    { label: "Tỷ Lệ Chốt Lead → HĐ", value: `${kpis.netConversionRate}%`, icon: "🎯" },
                    { label: "Giá Trị HĐ Bình Quân", value: formatVnd(kpis.avgDealSizeVnd), icon: "📊" },
                  ].map(item => (
                    <div key={item.label} className="bg-white/5 rounded-2xl p-4">
                      <p className="text-2xl mb-2">{item.icon}</p>
                      <p className="text-white font-black text-xl">{item.value}</p>
                      <p className="text-white/40 text-xs mt-1">{item.label}</p>
                    </div>
                  ))}
                </div>

                {kpis.topProjectName && (
                  <div className="mt-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-4">
                    <CheckCircle2 className="w-6 h-6 text-amber-400 shrink-0" />
                    <div>
                      <p className="text-white font-bold">🏆 Dự Án Dẫn Đầu: {kpis.topProjectName}</p>
                      <p className="text-white/40 text-sm">Giá trị giao dịch: {formatVnd(kpis.topProjectRevenue)}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Funnel summary */}
              {funnel && (
                <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                  <h3 className="font-black text-white mb-4 flex items-center gap-2">
                    <Filter className="w-4 h-4 text-amber-400" />
                    Hiệu Suất Phễu Bán Hàng
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {[
                      { label: "Leads Mới", value: funnel.leads, color: "text-white/60" },
                      { label: "Đủ ĐK (Qualified)", value: funnel.qualified, color: "text-blue-400" },
                      { label: "Tham Quan Thực Tế", value: funnel.siteVisits, color: "text-purple-400" },
                      { label: "Ký HĐMB (Đích Đến)", value: funnel.contracts, color: "text-emerald-400" },
                    ].map(f => (
                      <div key={f.label} className="text-center p-3 bg-white/5 rounded-xl">
                        <p className={`text-3xl font-black ${f.color}`}>{f.value}</p>
                        <p className="text-white/40 text-xs mt-1">{f.label}</p>
                      </div>
                    ))}
                  </div>
                  <p className="text-center text-white/30 text-sm mt-4">
                    Tỷ lệ chuyển đổi tổng thể: <span className="text-amber-400 font-black">{funnel.conversionLeadToContract}%</span>
                  </p>
                </div>
              )}
            </>
          )}

          {/* Inventory Report */}
          {selectedReport === "inventory" && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6 overflow-x-auto">
              <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                Báo Cáo Tồn Kho Bất Động Sản — {period}
              </h2>
              <table className="w-full text-sm min-w-[700px]">
                <thead>
                  <tr className="text-white/30 text-xs uppercase tracking-wider border-b border-white/10">
                    {["Dự Án", "Tổng SP", "Trống", "Giữ Chỗ", "Đặt Cọc", "Ký HĐ", "Bàn Giao", "Kín (%)", "Giá Trị Danh Mục", "Đã Giao Dịch"].map(h => (
                      <th key={h} className="text-right first:text-left pb-3 font-semibold">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {snapshots.map(s => (
                    <tr key={s.projectId} className="hover:bg-white/5 transition-colors">
                      <td className="py-3 text-white font-bold">{s.projectName}</td>
                      <td className="py-3 text-right text-white/60">{s.total}</td>
                      <td className="py-3 text-right text-white/60">{s.available}</td>
                      <td className="py-3 text-right text-amber-400">{s.booked}</td>
                      <td className="py-3 text-right text-orange-400">{s.deposited}</td>
                      <td className="py-3 text-right text-emerald-400">{s.signed}</td>
                      <td className="py-3 text-right text-blue-400">{s.handover}</td>
                      <td className="py-3 text-right font-black">
                        <span className={s.occupancyRatePct >= 80 ? "text-emerald-400" : s.occupancyRatePct >= 50 ? "text-amber-400" : "text-rose-400"}>
                          {s.occupancyRatePct}%
                        </span>
                      </td>
                      <td className="py-3 text-right text-white/50">{formatVnd(s.totalValueVnd)}</td>
                      <td className="py-3 text-right text-emerald-400 font-bold">{formatVnd(s.soldValueVnd)}</td>
                    </tr>
                  ))}
                  {snapshots.length === 0 && (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-white/20 text-sm italic">
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
              <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
                <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-amber-400" />
                  Báo Cáo Kinh Doanh — {period}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <h3 className="text-white/50 text-xs uppercase tracking-widest font-bold">Giao Dịch</h3>
                    {[
                      { label: "Số đặt giữ chỗ trong kỳ", value: kpis.totalBookings, icon: <Clock className="w-4 h-4 text-amber-400" /> },
                      { label: "Số đặt cọc", value: kpis.totalDeposits, icon: <CheckCircle2 className="w-4 h-4 text-orange-400" /> },
                      { label: "Số hợp đồng HĐMB ký", value: kpis.totalContracts, icon: <FileText className="w-4 h-4 text-emerald-400" /> },
                      { label: "Số hợp đồng bị huỷ", value: kpis.totalCancelations, icon: <AlertTriangle className="w-4 h-4 text-rose-400" /> },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5">
                        <div className="flex items-center gap-2 text-white/60 text-sm">{row.icon}{row.label}</div>
                        <span className="text-white font-black">{row.value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-white/50 text-xs uppercase tracking-widest font-bold">Doanh Thu</h3>
                    {[
                      { label: "Tổng doanh thu HĐMB ký", value: formatVnd(kpis.totalRevenue) },
                      { label: "Giá trị HĐ trung bình", value: formatVnd(kpis.avgDealSizeVnd) },
                      { label: "Tỷ lệ chốt (Lead → HĐ)", value: `${kpis.netConversionRate}%` },
                      { label: "Dự án có DT cao nhất", value: kpis.topProjectName ?? "—" },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-2 border-b border-white/5">
                        <span className="text-white/60 text-sm">{row.label}</span>
                        <span className="text-emerald-400 font-black text-sm">{row.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* CRM Report */}
          {selectedReport === "crm" && funnel && (
            <div className="bg-white/5 border border-white/10 rounded-3xl p-6">
              <h2 className="text-lg font-black text-white mb-5 flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                Báo Cáo CRM — {period}
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Tổng Leads Mới", value: funnel.leads, color: "text-white", bg: "bg-white/5" },
                  { label: "Leads Đủ ĐK", value: funnel.qualified, color: "text-blue-400", bg: "bg-blue-500/10" },
                  { label: "Đã Tham Quan TT", value: funnel.siteVisits, color: "text-purple-400", bg: "bg-purple-500/10" },
                  { label: "Đang Đàm Phán", value: funnel.opportunities, color: "text-amber-400", bg: "bg-amber-500/10" },
                  { label: "Đã Đặt Giữ Chỗ", value: funnel.bookings, color: "text-orange-400", bg: "bg-orange-500/10" },
                  { label: "Đã Đặt Cọc", value: funnel.deposits, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                  { label: "Đã Ký HĐMB", value: funnel.contracts, color: "text-green-400", bg: "bg-green-500/10" },
                  { label: "Tỷ Lệ Chuyển Đổi", value: `${funnel.conversionLeadToContract}%`, color: "text-amber-400", bg: "bg-amber-500/10" },
                ].map(item => (
                  <div key={item.label} className={`${item.bg} rounded-2xl p-4 text-center`}>
                    <p className={`text-3xl font-black ${item.color}`}>{item.value}</p>
                    <p className="text-white/40 text-xs mt-2">{item.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Footer note */}
      <p className="text-white/20 text-xs text-center flex items-center justify-center gap-2">
        <Calendar className="w-3 h-3" />
        Dữ liệu được truy xuất trực tiếp từ hệ thống · Cập nhật mỗi lần tải trang
      </p>
    </div>
  );
}
