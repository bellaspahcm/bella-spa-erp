'use client';

import React, { useState, useMemo } from 'react';
import {
  LineChart,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Bed,
  Users,
  Package,
  Stethoscope,
  BarChart3,
  Calendar,
  Filter,
  Sparkles,
  AlertCircle,
  HelpCircle,
  X
} from 'lucide-react';

// ─── HOSPITAL FINANCIAL REPORT TYPES ──────────────────────────────────────────
interface MonthlyPnL {
  month: string;
  grossRevenue: number;         // Doanh thu gộp
  adjustments: number;          // Khấu trừ / Miễn giảm y tế
  netRevenue: number;           // Doanh thu thuần
  cogs: number;                 // Chi phí trực tiếp thuốc/vật tư (COGS)
  grossProfit: number;          // Lợi nhuận gộp
  opex: number;                 // Chi phí vận hành lâm sàng (OPEX)
  netProfit: number;            // Lợi nhuận ròng (Net Profit)
  grossMargin: number;          // Biên lợi nhuận gộp (%)
  netMargin: number;            // Biên lợi nhuận ròng (%)
}

interface RevenueByDept {
  deptId: string;
  deptName: string;
  patientCount: number;
  revenueInpatient: number;
  revenueSurgery: number;
  revenueLab: number;
  revenueImaging: number;
  totalRevenue: number;
  directCost: number;
  grossMargin: number;          // Biên gộp
  netMargin: number;            // Biên ròng
}

// ─── RECONCILED DATA MODELS ──────────────────────────────────────────────────
const MOCK_MONTHLY_PNL: MonthlyPnL[] = [
  {
    month: 'Tháng 3',
    grossRevenue: 1_260_000_000,
    adjustments: 60_000_000,
    netRevenue: 1_200_000_000,
    cogs: 723_000_000,
    grossProfit: 477_000_000,
    opex: 167_000_000,
    netProfit: 310_000_000,
    grossMargin: 39.8,
    netMargin: 25.8,
  },
  {
    month: 'Tháng 4',
    grossRevenue: 1_420_000_000,
    adjustments: 70_000_000,
    netRevenue: 1_350_000_000,
    cogs: 792_000_000,
    grossProfit: 558_000_000,
    opex: 128_000_000,
    netProfit: 430_000_000,
    grossMargin: 41.3,
    netMargin: 31.9,
  },
  {
    month: 'Tháng 5',
    grossRevenue: 1_245_000_000,
    adjustments: 65_000_000,
    netRevenue: 1_180_000_000,
    cogs: 720_000_000,
    grossProfit: 460_000_000,
    opex: 150_000_000,
    netProfit: 310_000_000,
    grossMargin: 39.0,
    netMargin: 26.3,
  },
  {
    month: 'Tháng 6',
    grossRevenue: 1_490_000_000,
    adjustments: 70_000_000,
    netRevenue: 1_420_000_000,
    cogs: 812_000_000,
    grossProfit: 608_000_000,
    opex: 138_000_000,
    netProfit: 470_000_000,
    grossMargin: 42.8,
    netMargin: 33.1,
  },
  {
    month: 'Tháng 7',
    grossRevenue: 1_660_000_000,
    adjustments: 80_000_000,
    netRevenue: 1_580_000_000,
    cogs: 885_000_000,
    grossProfit: 695_000_000,
    opex: 125_000_000,
    netProfit: 570_000_000,
    grossMargin: 44.0,
    netMargin: 36.1,
  },
  {
    month: 'Tháng 8*', // Current Month
    grossRevenue: 1_520_000_000,
    adjustments: 75_000_000,
    netRevenue: 1_445_000_000,
    cogs: 872_000_000,
    grossProfit: 573_000_000, // Reconciles with 39.7% Gross Margin
    opex: 108_000_000,
    netProfit: 465_000_000, // Reconciles with 32.2% Net Margin
    grossMargin: 39.7,
    netMargin: 32.2,
  },
];

const MOCK_DEPT_REVENUE: RevenueByDept[] = [
  {
    deptId: 'icu',
    deptName: 'ICU / Hồi sức',
    patientCount: 28,
    revenueInpatient: 145_000_000,
    revenueSurgery: 0,
    revenueLab: 28_000_000,
    revenueImaging: 12_000_000,
    totalRevenue: 185_000_000,
    directCost: 112_000_000,
    netMargin: 18.4,
    grossMargin: 39.5,
  },
  {
    deptId: 'surgery',
    deptName: 'Khoa Ngoại',
    patientCount: 65,
    revenueInpatient: 88_000_000,
    revenueSurgery: 320_000_000,
    revenueLab: 15_000_000,
    revenueImaging: 22_000_000,
    totalRevenue: 445_000_000,
    directCost: 265_000_000,
    netMargin: 29.2,
    grossMargin: 40.4,
  },
  {
    deptId: 'internal',
    deptName: 'Khoa Nội',
    patientCount: 88,
    revenueInpatient: 210_000_000,
    revenueSurgery: 0,
    revenueLab: 45_000_000,
    revenueImaging: 18_000_000,
    totalRevenue: 273_000_000,
    directCost: 175_000_000,
    netMargin: 21.2,
    grossMargin: 35.9,
  },
  {
    deptId: 'cardio',
    deptName: 'Tim Mạch',
    patientCount: 42,
    revenueInpatient: 165_000_000,
    revenueSurgery: 280_000_000,
    revenueLab: 55_000_000,
    revenueImaging: 42_000_000,
    totalRevenue: 542_000_000,
    directCost: 320_000_000,
    netMargin: 31.4,
    grossMargin: 41.0,
  },
];

const fmtFull = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export default function HospitalRevenuePage() {
  const [activeTab, setActiveTab] = useState<'dept' | 'pnl'>('pnl');

  // Filters state
  const [filterPeriod, setFilterPeriod] = useState('2026-Q3');
  const [filterPayer, setFilterPayer] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');

  const currentMonth = MOCK_MONTHLY_PNL[MOCK_MONTHLY_PNL.length - 1];
  const previousMonth = MOCK_MONTHLY_PNL[MOCK_MONTHLY_PNL.length - 2];

  // Month-over-Month variances
  const revenueGrowth = (((currentMonth.netRevenue - previousMonth.netRevenue) / previousMonth.netRevenue) * 100).toFixed(1);
  const profitGrowth = (((currentMonth.netProfit - previousMonth.netProfit) / previousMonth.netProfit) * 100).toFixed(1);
  const netMarginDiff = (currentMonth.netMargin - previousMonth.netMargin).toFixed(1);
  const grossMarginDiff = (currentMonth.grossMargin - previousMonth.grossMargin).toFixed(1);

  const isRevenueUp = currentMonth.netRevenue >= previousMonth.netRevenue;
  const isProfitUp = currentMonth.netProfit >= previousMonth.netProfit;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 select-none">
      
      {/* Header Banner - Financial P&L theme (emerald/teal gradient container) */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-955 to-slate-950 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden border border-emerald-500/10">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-950/20 via-transparent to-transparent pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
          <div>
            <div className="flex items-center space-x-2 text-emerald-400 mb-1">
              <DollarSign className="w-5 h-5 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-widest">
                Bella Hospital • Inpatient Revenue & Profit/Loss Analytics
              </span>
            </div>
            <h1 className="text-3xl font-black tracking-tight text-white !text-white">
              Doanh Thu & Chi Phí Bệnh Viện (P&L)
            </h1>
            <p className="text-emerald-200/85 text-sm mt-1 max-w-xl leading-relaxed">
              Phân tích cơ cấu tài chính, tỷ lệ khấu trừ bảo hiểm y tế, kiểm soát chi phí vận hành lâm sàng và tối ưu hóa biên lợi nhuận.
            </p>
          </div>

          {/* Corrected & Reconciled margins header KPIs */}
          <div className="grid grid-cols-4 gap-2.5 shrink-0 w-full md:w-auto text-center font-bold">
            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-lg font-black text-white">{fmtFull(currentMonth.netRevenue)}</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Doanh thu thuần</div>
              <div className={`text-[9px] mt-1 flex items-center justify-center space-x-0.5 ${isRevenueUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isRevenueUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{revenueGrowth}% MoM</span>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-lg font-black text-white">{fmtFull(currentMonth.netProfit)}</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Lợi nhuận ròng</div>
              <div className={`text-[9px] mt-1 flex items-center justify-center space-x-0.5 ${isProfitUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isProfitUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{profitGrowth}% MoM</span>
              </div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-amber-500/30 transition-all duration-300">
              <div className="text-xl font-black text-amber-300">{currentMonth.netMargin}%</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Biên LN Ròng</div>
              <div className="text-[9px] text-rose-400 mt-1">{netMarginDiff} điểm %</div>
            </div>

            <div className="bg-white/5 backdrop-blur-md rounded-xl p-2.5 border border-white/10 hover:border-emerald-500/30 transition-all duration-300">
              <div className="text-xl font-black text-emerald-300">{currentMonth.grossMargin}%</div>
              <div className="text-[9px] text-slate-300 font-semibold uppercase mt-0.5">Biên LN Gộp</div>
              <div className="text-[9px] text-rose-400 mt-1">{grossMarginDiff} điểm %</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter panel */}
      <div className="bg-white border border-slate-200 rounded-xl p-3.5 shadow-sm flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center space-x-2 text-xs font-bold text-slate-500">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Bộ lọc:</span>
        </div>

        <div className="flex flex-wrap gap-3 flex-1 justify-start">
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <span>Kỳ báo cáo:</span>
            <select
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-800"
            >
              <option value="2026-Q3">Q3 / 2026</option>
              <option value="2026-08">Tháng 8 / 2026</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <span>Đối tượng Payer:</span>
            <select
              value={filterPayer}
              onChange={(e) => setFilterPayer(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-800"
            >
              <option value="all">Tất cả Payers</option>
              <option value="bhyt">Bảo hiểm Y tế (BHYT)</option>
              <option value="commercial">Bảo hiểm thương mại (TPA)</option>
              <option value="selfpay">Bệnh nhân tự chi trả</option>
            </select>
          </div>

          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600">
            <span>Nhóm doanh thu:</span>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="bg-transparent border-none outline-none font-bold text-slate-800"
            >
              <option value="all">Tất cả dịch vụ</option>
              <option value="inpatient">Giường bệnh nội trú</option>
              <option value="surgery">Phẫu thuật/Thủ thuật</option>
              <option value="labs">Xét nghiệm & Hình ảnh</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1 bg-white p-1 rounded-xl shadow-sm">
        {[
          { key: 'pnl',  label: 'P&L Theo Tháng',          icon: LineChart },
          { key: 'dept', label: 'Doanh Thu Theo Khoa Phòng', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`flex-1 py-2.5 px-4 text-xs font-bold flex items-center justify-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Icon className="w-4 h-4 shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* TAB 1: MONTHLY P&L & MOM VARIANCE */}
      {activeTab === 'pnl' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* LEFT: P&L LEDGER */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: 'Tổng doanh thu thuần (6 tháng)', value: fmtFull(MOCK_MONTHLY_PNL.reduce((s, m) => s + m.netRevenue, 0)), icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
                { label: 'Tổng chi phí vận hành (OPEX + COGS)', value: fmtFull(MOCK_MONTHLY_PNL.reduce((s, m) => s + (m.cogs + m.opex), 0)), icon: Package, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
                { label: 'Tổng lợi nhuận ròng (6 tháng)', value: fmtFull(MOCK_MONTHLY_PNL.reduce((s, m) => s + m.netProfit, 0)), icon: DollarSign, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
              ].map(({ label, value, icon: Icon, color, bg }) => (
                <div key={label} className={`rounded-xl border p-5 shadow-sm flex flex-col justify-between ${bg}`}>
                  <Icon className={`w-5 h-5 mb-2 ${color}`} />
                  <div>
                    <div className={`text-lg font-black ${color}`}>{value}</div>
                    <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">{label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Structured P&L Table */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider">
                  Bảng báo cáo Kết quả hoạt động kinh doanh y khoa (Structured P&L)
                </h4>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left min-w-[1050px]">
                  <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Tháng</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Doanh thu gộp</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Miễn giảm / Khấu trừ</th>
                      <th className="px-4 py-3 text-right text-slate-900 whitespace-nowrap">Doanh thu thuần</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Chi phí COGS</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Lợi nhuận gộp</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Chi phí OPEX</th>
                      <th className="px-4 py-3 text-right text-emerald-800 font-black whitespace-nowrap">Lợi nhuận ròng</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Biên LN ròng</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                    {MOCK_MONTHLY_PNL.map((m, idx) => {
                      const isLatest = idx === MOCK_MONTHLY_PNL.length - 1;
                      return (
                        <tr key={m.month} className={isLatest ? 'bg-emerald-50/60' : 'hover:bg-slate-50/50'}>
                          <td className="px-4 py-3.5 font-extrabold text-slate-800 whitespace-nowrap">
                            <div className="flex items-center space-x-1.5">
                              <span>{m.month}</span>
                              {isLatest && (
                                <span className="text-[8px] bg-emerald-600 text-white font-black px-1.5 py-0.5 rounded whitespace-nowrap">
                                  HIỆN TẠI
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right text-slate-500 font-mono whitespace-nowrap">{fmtFull(m.grossRevenue)}</td>
                          <td className="px-4 py-3.5 text-right text-rose-500 font-mono whitespace-nowrap">({fmtFull(m.adjustments)})</td>
                          <td className="px-4 py-3.5 text-right text-slate-900 font-mono font-extrabold whitespace-nowrap">{fmtFull(m.netRevenue)}</td>
                          <td className="px-4 py-3.5 text-right text-rose-700 font-mono whitespace-nowrap">({fmtFull(m.cogs)})</td>
                          <td className="px-4 py-3.5 text-right text-emerald-700 font-mono whitespace-nowrap">{fmtFull(m.grossProfit)}</td>
                          <td className="px-4 py-3.5 text-right text-rose-700 font-mono whitespace-nowrap">({fmtFull(m.opex)})</td>
                          <td className="px-4 py-3.5 text-right text-emerald-800 font-mono font-black whitespace-nowrap">{fmtFull(m.netProfit)}</td>
                          <td className="px-4 py-3.5 text-right text-blue-700 font-mono whitespace-nowrap">{m.netMargin}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

          {/* RIGHT: MoM VARIANCE & AI FINANCE INSIGHTS */}
          <div className="lg:col-span-1 space-y-4">
            
            {/* Variance card */}
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-4">
              <h4 className="font-extrabold text-slate-800 text-xs uppercase tracking-wider border-b border-slate-100 pb-2">
                Phân tích chênh lệch Tháng 8 (MoM Variance)
              </h4>
              <div className="space-y-3 font-bold text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Doanh thu thuần:</span>
                  <div className="flex items-center space-x-1 text-rose-600 font-mono">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                    <span>-8.5% (Giảm 135M)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Chi phí vận hành (OPEX + COGS):</span>
                  <div className="flex items-center space-x-1 text-emerald-600 font-mono">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                    <span>-3.0% (Giảm 30M)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Lợi nhuận ròng:</span>
                  <div className="flex items-center space-x-1 text-rose-600 font-mono">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                    <span>-18.4% (Giảm 105M)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-slate-100">
                  <span className="text-slate-500">Biên lợi nhuận ròng:</span>
                  <div className="flex items-center space-x-1 text-rose-600 font-mono">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                    <span>-3.9 pp (điểm phần trăm)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Biên lợi nhuận gộp:</span>
                  <div className="flex items-center space-x-1 text-rose-600 font-mono">
                    <TrendingDown className="w-3.5 h-3.5 shrink-0" />
                    <span>-4.3 pp (điểm phần trăm)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* AI CFO Advisory insights */}
            <div className="bg-gradient-to-br from-emerald-900 to-teal-950 rounded-2xl p-5 text-white shadow-xl space-y-4 relative overflow-hidden border border-emerald-500/20">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-emerald-300 animate-pulse" />
                <h4 className="font-extrabold text-sm uppercase tracking-wider text-emerald-100">AI CFO Intelligence Advisory</h4>
              </div>

              <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
                <div className="flex items-center space-x-1 text-amber-300 font-black">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Cảnh báo: Thu hẹp biên lợi nhuận (Margin Compression)</span>
                </div>
                <p className="font-medium text-slate-100 leading-relaxed">
                  Biên lợi nhuận ròng tháng 8 giảm xuống <strong>32.2%</strong> (↓ 3.9 điểm phần trăm MoM). Phân tích liên kết chỉ ra các nguyên nhân chính:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-[11px] text-slate-200 font-medium">
                  <li>Chi phí thuốc ICU tăng vọt 14% do lỗi LASA Meropenem làm hỏng quy trình dự phòng.</li>
                  <li>LOS khoa Tim Mạch tăng 11% (lên 7.3 ngày) làm gia tăng chi phí giường bệnh.</li>
                  <li>Doanh thu bảo hiểm thương mại giảm nhẹ 8.5% do trễ hạn nộp hồ sơ giám định BHYT.</li>
                </ul>
              </div>

              <div className="space-y-2 text-xs">
                <span className="text-[10px] text-emerald-300 uppercase block font-extrabold">Đề xuất giải pháp khắc phục tài chính:</span>
                <ul className="space-y-1.5 list-disc pl-4 text-[11px] text-emerald-100 font-medium">
                  <li>Tối ưu hóa quản lý sử dụng thuốc tại ICU để kiểm soát hao phí vật tư y tế.</li>
                  <li>Rà soát quy trình xuất viện tại khoa Tim mạch để rút ngắn LOS về mức tiêu chuẩn (6.5 ngày).</li>
                  <li>Kết nối EMR trực tiếp với cổng XML 130 để đẩy hồ sơ BHYT tự động trong ngày.</li>
                </ul>
              </div>
            </div>

          </div>

        </div>
      )}

      {/* TAB 2: DEPARTMENT ECONOMICS LEDGER */}
      {activeTab === 'dept' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
            <div>
              <h3 className="font-extrabold text-slate-800 text-sm uppercase tracking-wider">Hiệu Suất Kinh Tế Khoa Phòng (Department Economics)</h3>
              <p className="text-xs text-slate-400 mt-0.5">Phân tích dòng chi phí trực tiếp, doanh thu chi tiết và lợi nhuận ròng từng đơn vị lâm sàng.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left min-w-[700px]">
              <thead className="bg-slate-100 border-b border-slate-200 font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Khoa Phòng</th>
                  <th className="px-4 py-3 text-center">Lượt BN nội trú</th>
                  <th className="px-4 py-3 text-right">Doanh thu giường nội trú</th>
                  <th className="px-4 py-3 text-right">Doanh thu thủ thuật/CVC</th>
                  <th className="px-4 py-3 text-right">Xét nghiệm & Hình ảnh học</th>
                  <th className="px-4 py-3 text-right text-slate-900">Tổng doanh thu</th>
                  <th className="px-4 py-3 text-right text-rose-700">Chi phí trực tiếp (COGS)</th>
                  <th className="px-4 py-3 text-right text-emerald-800 font-black">Lợi nhuận gộp</th>
                  <th className="px-4 py-3 text-right">Biên gộp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-600">
                {MOCK_DEPT_REVENUE.map((dept) => (
                  <tr key={dept.deptId} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3.5 font-extrabold text-slate-800">{dept.deptName}</td>
                    <td className="px-4 py-3.5 text-center text-slate-500">{dept.patientCount} ca</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-500">{fmtFull(dept.revenueInpatient)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-500">{fmtFull(dept.revenueSurgery)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-500">{fmtFull(dept.revenueLab + dept.revenueImaging)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-900 font-extrabold">{fmtFull(dept.totalRevenue)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-rose-700">({fmtFull(dept.directCost)})</td>
                    <td className="px-4 py-3.5 text-right font-mono text-emerald-800 font-black">{fmtFull(dept.totalRevenue - dept.directCost)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-blue-700">{dept.grossMargin}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
