"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingDown, TrendingUp, Sparkles, Filter,
  Building2, Users, AlertTriangle, ArrowRight, ShieldAlert,
  ChevronRight, RefreshCw, SlidersHorizontal, Layers, CheckCircle2,
  DollarSign, Target, PieChart as PieChartIcon, Eye, ArrowDownRight
} from "lucide-react";
import { toast } from "sonner";

// ── Mock Data for BI Analytics Intelligence Layer ─────────────────────────────

interface FunnelStage {
  stage: string;
  count: number;
  pctOfPrev: number;
  isDropOffPoint?: boolean;
}

interface ChannelDelta {
  channel: string;
  t8Rate: number;
  t9Rate: number;
  delta: number;
  status: "negative" | "positive" | "neutral";
}

interface AgingInventoryItem {
  project: string;
  under30d: number; // tỷ
  range30to60d: number;
  range60to90d: number;
  over90d: number;
  warning?: boolean;
}

const FUNNEL_STAGES: FunnelStage[] = [
  { stage: "Lead mới", count: 1250, pctOfPrev: 100 },
  { stage: "Đủ điều kiện (Qualified)", count: 890, pctOfPrev: 71.2 },
  { stage: "Tham quan thực tế (Site Visit)", count: 420, pctOfPrev: 47.2 },
  { stage: "Đặt cọc (Deposit)", count: 180, pctOfPrev: 42.9, isDropOffPoint: true },
  { stage: "Ký HĐMB", count: 142, pctOfPrev: 78.9 },
];

const CHANNEL_DELTAS: ChannelDelta[] = [
  { channel: "Facebook Ads", t8Rate: 9.1, t9Rate: 7.4, delta: -1.7, status: "negative" },
  { channel: "Website Organic", t8Rate: 13.8, t9Rate: 12.9, delta: -0.9, status: "negative" },
  { channel: "Referral (Giới thiệu)", t8Rate: 18.1, t9Rate: 19.3, delta: +1.2, status: "positive" },
  { channel: "Sự kiện Mở bán", t8Rate: 17.5, t9Rate: 15.0, delta: -2.5, status: "negative" },
  { channel: "Đại lý F1", t8Rate: 10.2, t9Rate: 10.8, delta: +0.6, status: "positive" },
];

const AGING_INVENTORY: AgingInventoryItem[] = [
  { project: "Elyse Island", under30d: 45.2, range30to60d: 28.1, range60to90d: 12.0, over90d: 4.2 },
  { project: "The Grand Tower", under30d: 38.0, range30to60d: 22.5, range60to90d: 9.8, over90d: 2.1 },
  { project: "Riverside Heights", under30d: 15.0, range30to60d: 18.4, range60to90d: 22.1, over90d: 18.4, warning: true },
  { project: "Sunrise Villa", under30d: 28.4, range30to60d: 14.2, range60to90d: 6.0, over90d: 1.5 },
];

export default function BIAnalyticsPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("Tháng 9/2026");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("hcm");
  const [selectedTeam, setSelectedTeam] = useState("team_02");
  const [selectedChannel, setSelectedChannel] = useState("facebook");

  const [drillDownPath, setDrillDownPath] = useState<string[]>([
    "Chi nhánh Hồ Chí Minh",
    "Sales Team 02",
    "Kênh Facebook Ads",
    "Giai đoạn Site Visit → Deposit"
  ]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100">
      
      {/* ── 1. PAGE HEADER & GLOBAL MULTI-DIMENSION SLICERS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span>Báo cáo</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">BI Analytics</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            BI Analytics — Phân tích dữ liệu kinh doanh
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
            Khám phá dữ liệu, phân tích nguyên nhân biến động (Root Cause) & dự báo xu hướng
          </p>
        </div>

        {/* Multi-Dimension Slicers Toolbar */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          <select
            value={selectedPeriod}
            onChange={e => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs font-bold focus:outline-none shadow-2xs"
          >
            <option value="Tháng 9/2026">📅 Tháng 9/2026</option>
            <option value="Tháng 8/2026">Tháng 8/2026</option>
            <option value="Quý 3/2026">Quý 3/2026</option>
          </select>

          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none shadow-2xs"
          >
            <option value="all">Dự án: Tất cả</option>
            <option value="elyse">Elyse Island</option>
            <option value="grand">The Grand Tower</option>
            <option value="riverside">Riverside Heights</option>
          </select>

          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none shadow-2xs"
          >
            <option value="hcm">Chi nhánh: HCM</option>
            <option value="bd">Chi nhánh: Bình Dương</option>
            <option value="dn">Chi nhánh: Đà Nẵng</option>
          </select>

          <select
            value={selectedTeam}
            onChange={e => setSelectedTeam(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none shadow-2xs"
          >
            <option value="team_01">Team: Sales Team 01</option>
            <option value="team_02">Team: Sales Team 02</option>
            <option value="broker">Team: Broker Network</option>
          </select>

          <button
            onClick={() => toast.info("Đã làm mới dữ liệu phân tích BI Analytics!")}
            className="p-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 shadow-2xs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── 2. INSIGHT ENGINE (AI INTELLIGENCE ALERTS) ── */}
      <div className="bg-gradient-to-br from-blue-900 via-slate-900 to-slate-950 text-white rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-black tracking-wide uppercase text-blue-300">INSIGHT ENGINE — PHÂN TÍCH TỰ ĐỘNG</h2>
          </div>
          <span className="text-[11px] font-extrabold bg-blue-500/30 text-blue-200 px-3 py-1 rounded-full border border-blue-400/30">
            Realtime Analytics Layer
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-semibold">
          {/* Anomaly 1 */}
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-rose-500/30 space-y-2">
            <div className="flex items-center justify-between text-rose-400 font-extrabold text-xs">
              <span className="flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Cảnh báo bất thường</span>
              <span>HIGH IMPACT</span>
            </div>
            <p className="text-sm font-black text-white">Conversion giảm 2.1 điểm %</p>
            <p className="text-[11px] text-slate-300">
              Điểm rơi chính nằm ở bước <span className="text-rose-300 font-bold">Site Visit ➔ Deposit (42.9%)</span>. Cần rà soát quy trình tư vấn thực địa.
            </p>
          </div>

          {/* Anomaly 2 */}
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-amber-500/30 space-y-2">
            <div className="flex items-center justify-between text-amber-400 font-extrabold text-xs">
              <span className="flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Ứng đọng kho hàng</span>
              <span>AGING RISK</span>
            </div>
            <p className="text-sm font-black text-white">18.4 tỷ tồn kho &gt;90 ngày</p>
            <p className="text-[11px] text-slate-300">
              Tập trung chủ yếu tại dự án <span className="text-amber-300 font-bold">Riverside Heights</span>. Khuyến nghị đưa ra gói ưu đãi thanh toán đợt mới.
            </p>
          </div>

          {/* Anomaly 3 */}
          <div className="p-4 bg-white/5 backdrop-blur-md rounded-2xl border border-emerald-500/30 space-y-2">
            <div className="flex items-center justify-between text-emerald-400 font-extrabold text-xs">
              <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Kênh hiệu quả cao</span>
              <span>OPTIMIZATION</span>
            </div>
            <p className="text-sm font-black text-white">Referral có conversion 19.3%</p>
            <p className="text-[11px] text-slate-300">
              Chỉ số chuyển đổi từ nguồn giới thiệu cao hơn Facebook Ads gấp <span className="text-emerald-300 font-bold">2.6 lần</span>. Đề xuất tăng hoa hồng CTV.
            </p>
          </div>
        </div>
      </div>

      {/* ── 3. CONVERSION FUNNEL DROP-OFF ANALYSIS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-600" /> Phân tích phễu chuyển đổi & Điểm rơi (Funnel Drop-off)
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">Xác định chính xác công đoạn kinh doanh làm thất thoát khách hàng tiềm năng</p>
          </div>
          <span className="text-xs font-bold text-slate-400">Kỳ: Tháng 9/2026</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-2">
          {FUNNEL_STAGES.map((st, i) => (
            <div
              key={i}
              className={`p-4 rounded-2xl border transition-all space-y-2 relative ${
                st.isDropOffPoint
                  ? "bg-rose-50/70 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800 ring-2 ring-rose-200"
                  : "bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-800"
              }`}
            >
              {st.isDropOffPoint && (
                <span className="absolute -top-2.5 right-3 bg-rose-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow-2xs">
                  ⚠️ ĐIỂM RƠI CHÍNH
                </span>
              )}

              <span className="text-[10px] font-extrabold uppercase text-slate-400 block">Bước {i + 1}</span>
              <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">{st.stage}</h4>
              
              <div className="pt-1">
                <span className="text-2xl font-black text-slate-900 dark:text-white block">{st.count.toLocaleString()}</span>
                <span className={`text-[11px] font-extrabold block mt-0.5 ${
                  st.isDropOffPoint ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                }`}>
                  {st.pctOfPrev}% giữ lại
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 4. ROOT CAUSE DRILL-DOWN MATRIX (WHY DID CONVERSION FALL?) ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-600" /> Ma trận phân tích nguyên nhân (Root Cause Matrix)
            </h3>
            <p className="text-xs text-slate-500 font-semibold mt-0.5">So sánh biến động hiệu suất chuyển đổi T8 vs T9 theo từng kênh tiếp thị</p>
          </div>

          {/* Interactive Drill-Down Breadcrumb Path */}
          <div className="flex items-center gap-1.5 text-xs font-bold bg-slate-100 dark:bg-slate-800 px-3.5 py-2 rounded-xl text-slate-700 dark:text-slate-300 overflow-x-auto">
            <span className="text-slate-400">Drill-Down:</span>
            {drillDownPath.map((step, idx) => (
              <span key={idx} className="flex items-center gap-1 shrink-0">
                {idx > 0 && <ChevronRight className="w-3.5 h-3.5 text-slate-400" />}
                <span className={idx === drillDownPath.length - 1 ? "text-blue-600 dark:text-blue-400 font-extrabold" : ""}>{step}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Delta Matrix Table */}
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">Kênh tiếp thị</th>
                <th className="p-3 text-right">Tỷ lệ T8</th>
                <th className="p-3 text-right">Tỷ lệ T9</th>
                <th className="p-3 text-right">Biến động (Δ)</th>
                <th className="p-3 text-center">Đánh giá tác động</th>
                <th className="p-3 text-right">Thao tác Drill-down</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
              {CHANNEL_DELTAS.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-extrabold text-slate-900 dark:text-white">{item.channel}</td>
                  <td className="p-3 text-right font-mono text-slate-600 dark:text-slate-400">{item.t8Rate}%</td>
                  <td className="p-3 text-right font-mono font-bold text-slate-900 dark:text-white">{item.t9Rate}%</td>
                  <td className="p-3 text-right font-mono font-black">
                    <span className={item.delta < 0 ? "text-rose-600" : "text-emerald-600"}>
                      {item.delta > 0 ? `+${item.delta}` : item.delta} pt
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      item.status === 'negative' ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                    }`}>
                      {item.status === 'negative' ? '▼ Suy giảm' : '▲ Tăng trưởng'}
                    </span>
                  </td>
                  <td className="p-3 text-right">
                    <button
                      onClick={() => {
                        setDrillDownPath(["Chi nhánh HCM", "Sales Team 02", item.channel, "Site Visit ➔ Deposit"]);
                        toast.info(`Đang drill-down phân tích nguyên nhân kênh ${item.channel}`);
                      }}
                      className="px-2.5 py-1 text-xs font-bold text-blue-600 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-50"
                    >
                      Phân tích nguyên nhân ➔
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 5. AGING INVENTORY ANALYSIS ── */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
          <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" /> Phân tích tuổi tồn kho BĐS (Aging Inventory)
          </h3>
          <span className="text-xs font-bold text-slate-400">Đơn vị: Tỷ VNĐ</span>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
              <tr>
                <th className="p-3">Dự án</th>
                <th className="p-3 text-right">&lt; 30 ngày</th>
                <th className="p-3 text-right">30 – 60 ngày</th>
                <th className="p-3 text-right">60 – 90 ngày</th>
                <th className="p-3 text-right text-rose-600 font-black">&gt; 90 ngày (Rủi ro)</th>
                <th className="p-3 text-center">Trạng thái hấp thụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
              {AGING_INVENTORY.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                  <td className="p-3 font-extrabold text-slate-900 dark:text-white">{item.project}</td>
                  <td className="p-3 text-right font-mono text-emerald-600 font-bold">{item.under30d} tỷ</td>
                  <td className="p-3 text-right font-mono text-slate-700 dark:text-slate-300">{item.range30to60d} tỷ</td>
                  <td className="p-3 text-right font-mono text-amber-600 font-bold">{item.range60to90d} tỷ</td>
                  <td className="p-3 text-right font-mono font-black text-rose-600">{item.over90d} tỷ</td>
                  <td className="p-3 text-center">
                    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      item.warning ? 'bg-rose-50 text-rose-700 dark:bg-rose-950/40' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40'
                    }`}>
                      {item.warning ? '⚠️ Cần kích cầu' : '🟢 Tốc độ tốt'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
