"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, Building2, FileText, Users, Download, Calendar,
  Filter, RefreshCw, ChevronDown, Trophy, ArrowUpRight, ArrowDownRight,
  AlertTriangle, CheckCircle2, FileSpreadsheet, FileCode, Clock, Search,
  Share2, ShieldAlert, Sparkles, Layers, SlidersHorizontal, ArrowRight,
  PieChart as PieChartIcon, BarChart3, Check
} from "lucide-react";
import { toast } from "sonner";

// ── Types & Interfaces ────────────────────────────────────────────────────────

type ReportCategory = "executive" | "inventory" | "sales" | "crm";

interface ProjectPerformance {
  rank: number;
  name: string;
  avatar: string;
  revenue: number; // tỷ
  collected: number; // tỷ
  contracts: number;
  absorption: number; // %
}

interface LeadSourceData {
  source: string;
  icon: string;
  leads: number;
  siteVisits: number;
  contracts: number;
  conversion: number; // %
}

interface ExportHistoryItem {
  time: string;
  type: string;
  period: string;
  author: string;
  status: "completed" | "processing";
}

// ── Data Mock matching Reference Image #2 ─────────────────────────────────────

const REPORT_CATEGORIES = [
  {
    id: "executive" as ReportCategory,
    label: "Báo cáo Điều hành",
    desc: "Tổng quan KPI cho Ban Giám Đốc",
    icon: TrendingUp,
  },
  {
    id: "inventory" as ReportCategory,
    label: "Báo cáo Tồn kho BĐS",
    desc: "Chi tiết trạng thái từng căn hộ",
    icon: Building2,
  },
  {
    id: "sales" as ReportCategory,
    label: "Báo cáo Kinh doanh",
    desc: "Hợp đồng, đặt cọc, thanh toán",
    icon: FileText,
  },
  {
    id: "crm" as ReportCategory,
    label: "Báo cáo CRM",
    desc: "Leads, phễu chuyển đổi, môi giới",
    icon: Users,
  },
];

const EXECUTIVE_KPIS = [
  {
    id: "revenue",
    label: "Doanh thu HĐMB",
    value: "458.5 tỷ",
    change: "+18.4%",
    subtext: "so với tháng trước",
    isPositive: true,
    color: "emerald",
    sparkline: [30, 42, 55, 60, 72, 85, 98, 110, 125.8]
  },
  {
    id: "actual_cash",
    label: "Thực thu",
    value: "371.2 tỷ",
    change: "+12.8%",
    subtext: "so với tháng trước",
    isPositive: true,
    color: "blue",
    sparkline: [25, 35, 48, 52, 60, 70, 80, 92, 102.4]
  },
  {
    id: "contracts",
    label: "Số hợp đồng",
    value: "142",
    change: "+9.2%",
    subtext: "so với tháng trước",
    isPositive: true,
    color: "purple",
    sparkline: [10, 15, 22, 28, 35, 40, 42]
  },
  {
    id: "deposits",
    label: "Số đặt cọc",
    value: "180",
    change: "+15.4%",
    subtext: "so với tháng trước",
    isPositive: true,
    color: "amber",
    sparkline: [12, 18, 25, 30, 42, 50, 65]
  },
  {
    id: "conversion",
    label: "Tỷ lệ Lead → HĐ",
    value: "11.3%",
    change: "+1.5 điểm %",
    subtext: "so với mục tiêu 10%",
    isPositive: true,
    color: "cyan",
    sparkline: [7.2, 8.1, 9.0, 9.8, 10.5, 11.3]
  },
  {
    id: "avg_deal",
    label: "Giá trị HĐ bình quân",
    value: "3.2 tỷ",
    change: "+4.2%",
    subtext: "so với kỳ trước",
    isPositive: true,
    color: "rose",
    sparkline: [2.8, 2.9, 3.0, 3.1, 3.2]
  }
];

const PROJECT_PERFORMANCE_LIST: ProjectPerformance[] = [
  { rank: 1, name: "Elyse Island", avatar: "🏝️", revenue: 125.8, collected: 102.4, contracts: 42, absorption: 58.3 },
  { rank: 2, name: "The Grand Tower", avatar: "🏢", revenue: 98.2, collected: 83.1, contracts: 36, absorption: 71.4 },
  { rank: 3, name: "Riverside Heights", avatar: "🌊", revenue: 72.1, collected: 61.3, contracts: 24, absorption: 42.8 },
  { rank: 4, name: "Sunrise Villa", avatar: "🏡", revenue: 58.4, collected: 47.2, contracts: 18, absorption: 65.1 },
  { rank: 5, name: "Ocean Park", avatar: "🌅", revenue: 42.9, collected: 31.8, contracts: 12, absorption: 38.6 },
];

const LEAD_SOURCE_LIST: LeadSourceData[] = [
  { source: "Facebook", icon: "🌐", leads: 420, siteVisits: 96, contracts: 31, conversion: 7.4 },
  { source: "Website", icon: "💻", leads: 280, siteVisits: 81, contracts: 36, conversion: 12.9 },
  { source: "Referral", icon: "🤝", leads: 150, siteVisits: 68, contracts: 29, conversion: 19.3 },
  { source: "Sự kiện", icon: "🎪", leads: 120, siteVisits: 62, contracts: 18, conversion: 15.0 },
  { source: "Khác", icon: "💬", leads: 80, siteVisits: 28, contracts: 6, conversion: 7.5 },
];

const EXPORT_HISTORY: ExportHistoryItem[] = [
  { time: "10/09/2026 11:03", type: "Báo cáo điều hành", period: "Tháng 9/2026", author: "Nguyễn Văn A", status: "completed" },
  { time: "05/09/2026 09:21", type: "Báo cáo kinh doanh", period: "Tháng 8/2026", author: "Trần Thị B", status: "completed" },
  { time: "01/09/2026 14:15", type: "Báo cáo tồn kho", period: "Tháng 8/2026", author: "Lê Hoàng C", status: "completed" },
];

export default function ReportsPage() {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>("executive");
  const [selectedPeriod, setSelectedPeriod] = useState("Tháng 9/2026");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Revenue chart month data (Tỉ VNĐ)
  const revenueChartMonths = [
    { label: "T1", fullLabel: "Tháng 1", revenue: 120, actual: 95, target: 150 },
    { label: "T2", fullLabel: "Tháng 2", revenue: 160, actual: 130, target: 180 },
    { label: "T3", fullLabel: "Tháng 3", revenue: 210, actual: 175, target: 230 },
    { label: "T4", fullLabel: "Tháng 4", revenue: 240, actual: 190, target: 260 },
    { label: "T5", fullLabel: "Tháng 5", revenue: 290, actual: 230, target: 310 },
    { label: "T6", fullLabel: "Tháng 6", revenue: 330, actual: 270, target: 360 },
    { label: "T7", fullLabel: "Tháng 7", revenue: 380, actual: 310, target: 410 },
    { label: "T8", fullLabel: "Tháng 8", revenue: 410, actual: 340, target: 450 },
    { label: "T9", fullLabel: "Tháng 9", revenue: 458.5, actual: 371.2, target: 500.0, isHovered: true },
  ];

  const handleExport = (format: string) => {
    setShowExportMenu(false);
    setIsExporting(true);
    toast.loading(`Đang khởi tạo tệp báo cáo định dạng ${format.toUpperCase()}...`);
    setTimeout(() => {
      setIsExporting(false);
      toast.dismiss();
      toast.success(`✅ Đã xuất báo cáo ${format.toUpperCase()} thành công! Tệp đã được lưu.`);
    }, 1200);
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto font-sans text-slate-900 dark:text-slate-100">
      
      {/* ── 1. PAGE HEADER & TOOLBAR ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 mb-1">
            <span>Bella Land</span>
            <span>/</span>
            <span className="text-slate-900 dark:text-white font-bold">Trung tâm báo cáo</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
            Trung tâm báo cáo
          </h1>
          <p className="text-xs md:text-sm text-slate-500 font-semibold mt-0.5">
            Phân tích hiệu quả kinh doanh, vận hành và hỗ trợ ra quyết định
          </p>
        </div>

        {/* Filters Toolbar matching Reference Image #2 */}
        <div className="flex items-center gap-2 flex-wrap text-xs font-semibold">
          
          {/* Month Selector */}
          <div className="relative">
            <select
              value={selectedPeriod}
              onChange={e => setSelectedPeriod(e.target.value)}
              className="pl-3 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-900 dark:text-white text-xs font-bold appearance-none cursor-pointer focus:outline-none shadow-2xs"
            >
              <option value="Tháng 9/2026">📅 Tháng 9/2026 (01/09 - 30/09)</option>
              <option value="Tháng 8/2026">Tháng 8/2026</option>
              <option value="Quý 3/2026">Quý 3/2026</option>
              <option value="Năm 2026">Cả năm 2026</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>

          {/* Project Selector */}
          <select
            value={selectedProject}
            onChange={e => setSelectedProject(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none shadow-2xs"
          >
            <option value="all">Tất cả dự án</option>
            <option value="elyse">Elyse Island</option>
            <option value="grand">The Grand Tower</option>
            <option value="riverside">Riverside Heights</option>
            <option value="vinhomes">Vinhomes Green Paradise</option>
          </select>

          {/* Branch Selector */}
          <select
            value={selectedBranch}
            onChange={e => setSelectedBranch(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-800 dark:text-slate-200 text-xs font-semibold focus:outline-none shadow-2xs"
          >
            <option value="all">Tất cả chi nhánh</option>
            <option value="hcm">Chi nhánh Hồ Chí Minh</option>
            <option value="bd">Chi nhánh Bình Dương</option>
            <option value="dn">Chi nhánh Đà Nẵng</option>
          </select>

          {/* Advanced Filter Trigger */}
          <button className="flex items-center gap-1.5 px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 shadow-2xs">
            <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" /> Bộ lọc
          </button>

          {/* Export Report Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="flex items-center gap-2 px-4 py-2 bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 text-white rounded-xl font-extrabold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" /> Xuất báo cáo ▾
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden text-xs py-1 font-bold">
                <button
                  onClick={() => handleExport("pdf")}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-800 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2"><FileText className="w-4 h-4 text-red-500" /> Tệp PDF Quản Trị</span>
                  <span className="text-[10px] text-slate-400 font-mono">.pdf</span>
                </button>
                <button
                  onClick={() => handleExport("excel")}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-800 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Bảng Tính Excel</span>
                  <span className="text-[10px] text-slate-400 font-mono">.xlsx</span>
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center justify-between text-slate-800 dark:text-slate-200"
                >
                  <span className="flex items-center gap-2"><FileCode className="w-4 h-4 text-blue-500" /> Dữ Liệu Thô CSV</span>
                  <span className="text-[10px] text-slate-400 font-mono">.csv</span>
                </button>
                <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                <button
                  onClick={() => { setShowExportMenu(false); toast.info("Đã lập lịch tự động gửi báo cáo vào email Ban Giám Đốc 8h00 sáng thứ Hai."); }}
                  className="w-full text-left px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-slate-500 text-[11px]"
                >
                  <Clock className="w-3.5 h-3.5 text-amber-500" /> Lập lịch gửi tự động
                </button>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── 2. REPORT CATEGORY TABS (4 CARDS MATCHING REFERENCE IMAGE #2) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        {REPORT_CATEGORIES.map(cat => {
          const Icon = cat.icon;
          const isActive = activeCategory === cat.id;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`p-4 rounded-2xl border text-left transition-all cursor-pointer flex items-start gap-3.5 ${
                isActive
                  ? "bg-blue-600 text-white border-blue-600 shadow-md ring-2 ring-blue-200 dark:ring-blue-900"
                  : "bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 hover:border-blue-400 text-slate-900 dark:text-white"
              }`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isActive ? "bg-white/20 text-white" : "bg-blue-50 dark:bg-blue-950/40 text-blue-600"
              }`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className={`font-black text-sm ${isActive ? "text-white" : "text-slate-900 dark:text-white"}`}>
                  {cat.label}
                </h3>
                <p className={`text-xs mt-0.5 truncate ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                  {cat.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── 3. 6 EXECUTIVE COMPARISON KPI CARDS WITH SPARKLINES ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        {EXECUTIVE_KPIS.map(kpi => (
          <div key={kpi.id} className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 truncate">{kpi.label}</span>
            </div>
            
            <div>
              <div className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{kpi.value}</div>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="inline-flex items-center text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400">
                  <ArrowUpRight className="w-3 h-3" /> {kpi.change}
                </span>
                <span className="text-[9px] text-slate-400 truncate">{kpi.subtext}</span>
              </div>
            </div>

            {/* Micro Sparkline Bar Visualization */}
            <div className="flex items-end gap-1 h-5 pt-1">
              {kpi.sparkline.map((val, idx) => (
                <div
                  key={idx}
                  style={{ height: `${Math.max(20, (val / Math.max(...kpi.sparkline)) * 100)}%` }}
                  className={`flex-1 rounded-xs transition-all ${
                    idx === kpi.sparkline.length - 1 ? "bg-blue-600" : "bg-slate-200 dark:bg-slate-700"
                  }`}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── 4. MAIN ANALYTICS GRID: ROW 1 (REVENUE CHART & SALES FUNNEL) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Doanh thu & Thực thu theo thời gian (60% width) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-600" /> Doanh thu & Thực thu theo thời gian
              </h3>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 text-xs font-bold">
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" /> Doanh thu HĐMB
                </span>
                <span className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Thực thu
                </span>
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="w-3 border-t-2 border-dashed border-blue-400 inline-block" /> Kế hoạch
                </span>
              </div>
              <select className="px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold">
                <option>Theo tháng</option>
                <option>Theo quý</option>
              </select>
            </div>
          </div>

          {/* Analytics Chart Container with Y-Axis & X-Axis Baseline */}
          <div className="relative pt-2 pl-10 pr-2">
            
            {/* Y-Axis Numerical Labels & Horizontal Grid Lines */}
            <div className="absolute left-0 top-2 bottom-8 w-8 flex flex-col justify-between text-[10px] font-mono font-bold text-slate-400 text-right pr-1">
              <span>500</span>
              <span>375</span>
              <span>250</span>
              <span>125</span>
              <span>0</span>
            </div>

            <div className="absolute left-10 right-2 top-2 bottom-8 flex flex-col justify-between pointer-events-none">
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-dashed border-slate-200 dark:border-slate-800 w-full" />
              <div className="border-b border-slate-300 dark:border-slate-700 w-full" />
            </div>

            {/* Target Line (-- Kế hoạch: 500.0 tỷ) */}
            <div className="absolute left-10 right-2 top-2 border-t-2 border-dashed border-blue-400 z-10 pointer-events-none">
              <span className="absolute -top-3.5 right-0 bg-blue-50 dark:bg-blue-950/80 text-blue-600 text-[9px] font-extrabold px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-900 shadow-2xs">
                Target: 500.0 tỷ
              </span>
            </div>

            {/* Bars & X-Axis */}
            <div className="h-64 flex items-end justify-between gap-2 sm:gap-3 relative z-10">
              {revenueChartMonths.map((m, idx) => {
                const maxVal = 500;
                const hRev = (m.revenue / maxVal) * 100;
                const hAct = (m.actual / maxVal) * 100;

                return (
                  <div key={idx} className="flex-1 flex flex-col items-center gap-2 group relative">
                    
                    {/* Hover Tooltip for T9 */}
                    {m.isHovered && (
                      <div className="absolute -top-24 bg-slate-900 text-white rounded-xl p-2.5 shadow-xl text-[11px] font-bold z-30 whitespace-nowrap space-y-1 ring-1 ring-white/10">
                        <p className="text-blue-400 font-extrabold border-b border-slate-800 pb-1">Tháng 9/2026</p>
                        <div className="flex justify-between gap-3"><span className="text-slate-400">• Doanh thu:</span> <span>458.5 tỷ</span></div>
                        <div className="flex justify-between gap-3"><span className="text-slate-400">• Thực thu:</span> <span className="text-emerald-400">371.2 tỷ</span></div>
                        <div className="flex justify-between gap-3"><span className="text-slate-400">• Kế hoạch:</span> <span className="text-blue-300">500.0 tỷ</span></div>
                      </div>
                    )}

                    {/* Dual Bars Container */}
                    <div className="w-full flex items-end justify-center gap-1 sm:gap-1.5 h-48">
                      {/* Revenue HĐMB Bar */}
                      <div
                        style={{ height: `${hRev}%` }}
                        className={`w-3 sm:w-4 rounded-t-md transition-all ${
                          m.isHovered ? "bg-blue-600 shadow-md ring-2 ring-blue-300" : "bg-blue-500/80 group-hover:bg-blue-600"
                        }`}
                      />
                      {/* Actual Collection Bar */}
                      <div
                        style={{ height: `${hAct}%` }}
                        className={`w-3 sm:w-4 rounded-t-md transition-all ${
                          m.isHovered ? "bg-emerald-500 shadow-md ring-2 ring-emerald-300" : "bg-emerald-400/80 group-hover:bg-emerald-500"
                        }`}
                      />
                    </div>

                    {/* X-Axis Month Label */}
                    <span className={`text-xs font-black transition-colors ${m.isHovered ? "text-blue-600" : "text-slate-500"}`}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* X-Axis Unit Label */}
            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 pt-1.5 border-t border-slate-200 dark:border-slate-800 mt-1">
              <span>Đơn vị: Tỷ VNĐ</span>
              <span>Kỳ báo cáo: 9 tháng 2026</span>
            </div>
          </div>
        </div>

        {/* Hiệu suất phễu bán hàng (Sales Funnel - 40% width) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Filter className="w-4 h-4 text-blue-600" /> Hiệu suất phễu bán hàng
            </h3>
            <span className="text-xs font-bold text-slate-400">Tháng 9/2026</span>
          </div>

          {/* Inverted Trapezoid Funnel Graphic matching Reference Image #2 */}
          <div className="space-y-2 pt-1">
            {[
              { stage: "Lead", count: "1,250", pct: "100%", width: "w-full", bg: "bg-blue-600 text-white" },
              { stage: "Tư vấn", count: "890", pct: "71.2%", width: "w-[85%]", bg: "bg-cyan-500 text-white" },
              { stage: "Tham quan dự án", count: "420", pct: "33.6%", width: "w-[70%]", bg: "bg-teal-500 text-white" },
              { stage: "Đặt cọc", count: "180", pct: "14.4%", width: "w-[55%]", bg: "bg-amber-500 text-white" },
              { stage: "Ký HĐMB", count: "142", pct: "11.3%", width: "w-[40%]", bg: "bg-purple-600 text-white" },
            ].map((f, i) => (
              <div key={i} className="flex items-center justify-between gap-3 text-xs font-bold">
                <div className={`mx-auto py-2 px-3 rounded-xl transition-all flex items-center justify-between ${f.width} ${f.bg} shadow-2xs`}>
                  <span className="font-extrabold">{f.stage}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-sm">{f.count}</span>
                    <span className="text-[10px] opacity-80 font-mono">{f.pct}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* ── 5. MAIN ANALYTICS GRID: ROW 2 (PROJECT PERFORMANCE & CRM LEAD SOURCES) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Hiệu suất theo dự án (50% width) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" /> Hiệu suất theo dự án
            </h3>
            <button onClick={() => toast.info("Xem chi tiết toàn bộ danh mục dự án")} className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1">
              Xem tất cả ➔
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-2.5 w-8">#</th>
                  <th className="p-2.5">Dự án</th>
                  <th className="p-2.5 text-right">Doanh thu (tỷ)</th>
                  <th className="p-2.5 text-right">Thực thu (tỷ)</th>
                  <th className="p-2.5 text-center">Số HĐ</th>
                  <th className="p-2.5 text-right">Tỷ lệ hấp thụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                {PROJECT_PERFORMANCE_LIST.map(p => (
                  <tr key={p.rank} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-slate-400">{p.rank}</td>
                    <td className="p-2.5 font-black text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{p.avatar}</span> {p.name}
                    </td>
                    <td className="p-2.5 text-right font-bold text-blue-600">{p.revenue}</td>
                    <td className="p-2.5 text-right font-bold text-emerald-600">{p.collected}</td>
                    <td className="p-2.5 text-center font-bold">{p.contracts}</td>
                    <td className="p-2.5 text-right font-black text-slate-800 dark:text-slate-200">{p.absorption}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Nguồn Lead hiệu quả CRM (50% width) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-600" /> Nguồn Lead hiệu quả (CRM)
            </h3>
            <span className="text-xs font-bold text-slate-400">Tháng 9/2026</span>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">Nguồn</th>
                  <th className="p-2.5 text-right">Leads</th>
                  <th className="p-2.5 text-right">Site Visit</th>
                  <th className="p-2.5 text-right">HĐMB</th>
                  <th className="p-2.5 text-right">Conversion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                {LEAD_SOURCE_LIST.map((s, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                      <span>{s.icon}</span> {s.source}
                    </td>
                    <td className="p-2.5 text-right">{s.leads}</td>
                    <td className="p-2.5 text-right text-slate-600 dark:text-slate-300">{s.siteVisits}</td>
                    <td className="p-2.5 text-right font-black text-emerald-600">{s.contracts}</td>
                    <td className="p-2.5 text-right font-black text-blue-600">{s.conversion}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── 6. MAIN ANALYTICS GRID: ROW 3 (INVENTORY DONUT & EXECUTIVE INSIGHTS) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Tồn kho theo trạng thái (50% width) */}
        <div className="lg:col-span-6 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-emerald-600" /> Tồn kho theo trạng thái
            </h3>
            <button onClick={() => toast.info("Chuyển đến bảng Báo cáo tồn kho chi tiết")} className="text-xs font-bold text-blue-600 hover:underline">
              Xem chi tiết ➔
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center pt-2">
            {/* SVG Donut Chart with Center Display */}
            <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-blue-500" strokeWidth="4.5" strokeDasharray="41.6, 100" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-amber-400" strokeWidth="4.5" strokeDasharray="8.4, 100" strokeDashoffset="-41.6" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-orange-500" strokeWidth="4.5" strokeDasharray="10.8, 100" strokeDashoffset="-50" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                <path className="text-purple-600" strokeWidth="4.5" strokeDasharray="27.3, 100" strokeDashoffset="-60.8" stroke="currentColor" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              </svg>
              <div className="absolute text-center">
                <span className="text-2xl font-black text-slate-900 dark:text-white block">286</span>
                <span className="text-[10px] text-slate-400 font-bold uppercase">Tổng căn</span>
              </div>
            </div>

            {/* Legend Items */}
            <div className="space-y-1.5 text-xs font-semibold">
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Tự do (Available)</span> <span className="font-bold">119 (41.6%)</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Giữ chỗ (Holding)</span> <span className="font-bold">24 (8.4%)</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-orange-500" /> Đặt cọc (Deposited)</span> <span className="font-bold">31 (10.8%)</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-600" /> Ký HĐMB</span> <span className="font-bold">78 (27.3%)</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-teal-500" /> Thanh toán</span> <span className="font-bold">9 (3.1%)</span></div>
              <div className="flex justify-between items-center"><span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Bàn giao</span> <span className="font-bold">25 (8.7%)</span></div>
            </div>
          </div>
        </div>

        {/* Điểm nổi bật kỳ này (Executive Insights Bar - 50% width) */}
        <div className="lg:col-span-6 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 dark:from-amber-950/20 dark:via-slate-900 dark:to-slate-900 border border-amber-200/80 dark:border-amber-900/40 rounded-3xl p-5 md:p-6 shadow-xs space-y-3.5">
          <div className="flex items-center justify-between border-b border-amber-200/60 dark:border-amber-900/40 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> Điểm nổi bật kỳ này
            </h3>
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full">
              AI Insight Summary
            </span>
          </div>

          <div className="space-y-3">
            {/* Top Project Insight */}
            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-amber-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-950/60 text-amber-600 flex items-center justify-center">
                  <Trophy className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Dự án dẫn đầu</h4>
                  <p className="text-xs text-slate-500 font-semibold">Vinhomes Green Paradise</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-amber-600 block">25.9 tỷ</span>
                <span className="text-[10px] text-slate-400 font-semibold">Giá trị giao dịch</span>
              </div>
            </div>

            {/* Best Growth Insight */}
            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-emerald-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 flex items-center justify-center">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Tăng trưởng tốt nhất</h4>
                  <p className="text-xs text-slate-500 font-semibold">Elyse Island</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-emerald-600 block">+32.4%</span>
                <span className="text-[10px] text-slate-400 font-semibold">So với tháng trước</span>
              </div>
            </div>

            {/* Attention Warning Insight */}
            <div className="p-3 bg-white dark:bg-slate-800/80 rounded-2xl border border-rose-100 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-100 dark:bg-rose-950/60 text-rose-600 flex items-center justify-center">
                  <ShieldAlert className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 dark:text-white text-xs">Cần chú ý</h4>
                  <p className="text-xs text-slate-500 font-semibold">Riverside Heights</p>
                </div>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-rose-600 block">Conversion giảm 8.2%</span>
                <span className="text-[10px] text-slate-400 font-semibold">So với tháng trước</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* ── 7. MAIN ANALYTICS GRID: ROW 4 (QUICK REPORTS & EXPORT HISTORY) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Danh sách báo cáo nhanh (40% width) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-600" /> Danh sách báo cáo nhanh
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-center">
            <button
              onClick={() => handleExport("pdf")}
              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-red-400 bg-slate-50/50 dark:bg-slate-800/40 transition-all cursor-pointer group space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-950/50 text-red-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Báo cáo tổng hợp</p>
                <span className="text-[10px] font-bold text-red-500">(PDF)</span>
              </div>
            </button>

            <button
              onClick={() => handleExport("excel")}
              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-emerald-400 bg-slate-50/50 dark:bg-slate-800/40 transition-all cursor-pointer group space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Báo cáo doanh thu</p>
                <span className="text-[10px] font-bold text-emerald-600">(Excel)</span>
              </div>
            </button>

            <button
              onClick={() => handleExport("excel")}
              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-blue-400 bg-slate-50/50 dark:bg-slate-800/40 transition-all cursor-pointer group space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Báo cáo tồn kho</p>
                <span className="text-[10px] font-bold text-blue-600">(Excel)</span>
              </div>
            </button>

            <button
              onClick={() => handleExport("pdf")}
              className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 hover:border-purple-400 bg-slate-50/50 dark:bg-slate-800/40 transition-all cursor-pointer group space-y-2"
            >
              <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 flex items-center justify-center mx-auto group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-slate-800 dark:text-slate-200">Báo cáo CRM</p>
                <span className="text-[10px] font-bold text-purple-600">(PDF)</span>
              </div>
            </button>
          </div>
        </div>

        {/* Lịch sử xuất báo cáo (60% width) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-3xl p-5 md:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
            <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" /> Lịch sử xuất báo cáo
            </h3>
            <button onClick={() => toast.info("Xem toàn bộ nhật ký xuất báo cáo hệ thống")} className="text-xs font-bold text-blue-600 hover:underline">
              Xem tất cả ➔
            </button>
          </div>

          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-[11px] font-black text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="p-2.5">Thời gian</th>
                  <th className="p-2.5">Loại báo cáo</th>
                  <th className="p-2.5">Kỳ báo cáo</th>
                  <th className="p-2.5">Người xuất</th>
                  <th className="p-2.5 text-center">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-semibold">
                {EXPORT_HISTORY.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="p-2.5 text-slate-500 font-mono text-[11px]">{item.time}</td>
                    <td className="p-2.5 font-bold text-slate-900 dark:text-white">{item.type}</td>
                    <td className="p-2.5 text-slate-600 dark:text-slate-300">{item.period}</td>
                    <td className="p-2.5 font-bold text-blue-600">{item.author}</td>
                    <td className="p-2.5 text-center">
                      <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        Hoàn thành
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
}
