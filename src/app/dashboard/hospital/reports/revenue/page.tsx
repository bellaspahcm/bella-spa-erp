'use client';

import React, { useState } from 'react';
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
} from 'lucide-react';

// ─── Hospital Revenue & P&L Types ────────────────────────────────────────────
interface RevenueByDept {
  deptId: string;
  deptName: string;
  revenueInpatient: number;
  revenueSurgery: number;
  revenueLab: number;
  revenueImaging: number;
  totalRevenue: number;
  directCost: number;
  grossMargin: number;
}

interface MonthlyPnL {
  month: string;
  revenue: number;
  expenses: number;
  netProfit: number;
}

const MOCK_DEPT_REVENUE: RevenueByDept[] = [
  {
    deptId: 'icu',
    deptName: 'ICU / Hồi sức',
    revenueInpatient: 145_000_000,
    revenueSurgery: 0,
    revenueLab: 28_000_000,
    revenueImaging: 12_000_000,
    totalRevenue: 185_000_000,
    directCost: 112_000_000,
    grossMargin: 39.5,
  },
  {
    deptId: 'surgery',
    deptName: 'Khoa Ngoại',
    revenueInpatient: 88_000_000,
    revenueSurgery: 320_000_000,
    revenueLab: 15_000_000,
    revenueImaging: 22_000_000,
    totalRevenue: 445_000_000,
    directCost: 265_000_000,
    grossMargin: 40.4,
  },
  {
    deptId: 'internal',
    deptName: 'Khoa Nội',
    revenueInpatient: 210_000_000,
    revenueSurgery: 0,
    revenueLab: 45_000_000,
    revenueImaging: 18_000_000,
    totalRevenue: 273_000_000,
    directCost: 175_000_000,
    grossMargin: 35.9,
  },
  {
    deptId: 'cardio',
    deptName: 'Tim Mạch',
    revenueInpatient: 165_000_000,
    revenueSurgery: 280_000_000,
    revenueLab: 55_000_000,
    revenueImaging: 42_000_000,
    totalRevenue: 542_000_000,
    directCost: 320_000_000,
    grossMargin: 41.0,
  },
];

const MOCK_MONTHLY_PNL: MonthlyPnL[] = [
  { month: 'Tháng 3', revenue: 1_200_000_000, expenses: 890_000_000, netProfit: 310_000_000 },
  { month: 'Tháng 4', revenue: 1_350_000_000, expenses: 920_000_000, netProfit: 430_000_000 },
  { month: 'Tháng 5', revenue: 1_180_000_000, expenses: 870_000_000, netProfit: 310_000_000 },
  { month: 'Tháng 6', revenue: 1_420_000_000, expenses: 950_000_000, netProfit: 470_000_000 },
  { month: 'Tháng 7', revenue: 1_580_000_000, expenses: 1_010_000_000, netProfit: 570_000_000 },
  { month: 'Tháng 8*', revenue: 1_445_000_000, expenses: 980_000_000, netProfit: 465_000_000 },
];

const fmt = (n: number) =>
  new Intl.NumberFormat('vi-VN', {
    notation: 'compact',
    maximumFractionDigits: 1,
    style: 'currency',
    currency: 'VND',
  }).format(n);

const fmtFull = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export default function HospitalRevenuePage() {
  const [activeTab, setActiveTab] = useState<'dept' | 'pnl'>('pnl');

  const totalRevenue = MOCK_DEPT_REVENUE.reduce((s, d) => s + d.totalRevenue, 0);
  const totalCost = MOCK_DEPT_REVENUE.reduce((s, d) => s + d.directCost, 0);
  const totalMargin = ((totalRevenue - totalCost) / totalRevenue) * 100;

  const lastMonth = MOCK_MONTHLY_PNL[MOCK_MONTHLY_PNL.length - 1];
  const prevMonth = MOCK_MONTHLY_PNL[MOCK_MONTHLY_PNL.length - 2];
  const revenueGrowth = (((lastMonth.revenue - prevMonth.revenue) / prevMonth.revenue) * 100).toFixed(1);
  const profitGrowth = (((lastMonth.netProfit - prevMonth.netProfit) / prevMonth.netProfit) * 100).toFixed(1);
  const isRevenueUp = lastMonth.revenue >= prevMonth.revenue;
  const isProfitUp = lastMonth.netProfit >= prevMonth.netProfit;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-blue-900 rounded-2xl p-6 text-white shadow-xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center space-x-2 text-emerald-300 mb-1">
              <LineChart className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">
                Bella Hospital • Inpatient Revenue & Profit/Loss Analytics
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold">Doanh Thu & Chi Phí Bệnh Viện (P&L)</h1>
            <p className="text-emerald-100 text-sm mt-1">
              Phân tích doanh thu nội trú theo khoa phòng, chi phí trực tiếp và biên lợi nhuận gộp.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-lg font-black text-emerald-200">{fmtFull(lastMonth.revenue)}</div>
              <div className="text-[10px] text-emerald-300 font-semibold">Doanh thu tháng này</div>
              <div className={`text-[10px] mt-0.5 flex items-center justify-center space-x-0.5 ${isRevenueUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isRevenueUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{revenueGrowth}% so tháng trước</span>
              </div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-lg font-black text-blue-200">{fmtFull(lastMonth.netProfit)}</div>
              <div className="text-[10px] text-blue-300 font-semibold">Lợi nhuận ròng</div>
              <div className={`text-[10px] mt-0.5 flex items-center justify-center space-x-0.5 ${isProfitUp ? 'text-emerald-300' : 'text-rose-300'}`}>
                {isProfitUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                <span>{profitGrowth}% so tháng trước</span>
              </div>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-3 border border-white/20">
              <div className="text-2xl font-black text-amber-300">{totalMargin.toFixed(1)}%</div>
              <div className="text-[10px] text-amber-200 font-semibold">Biên lợi nhuận gộp</div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        {[
          { key: 'pnl',  label: 'P&L Theo Tháng',          icon: LineChart },
          { key: 'dept', label: 'Doanh Thu Theo Khoa Phòng', icon: BarChart3 },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key as typeof activeTab)}
            className={`py-3 px-5 text-sm font-semibold flex items-center space-x-2 border-b-2 transition-all ${
              activeTab === key
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'pnl' && (
        <div className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Tổng doanh thu 6 tháng', value: fmtFull(MOCK_MONTHLY_PNL.reduce((s, m) => s + m.revenue, 0)), icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200' },
              { label: 'Tổng chi phí vận hành', value: fmtFull(MOCK_MONTHLY_PNL.reduce((s, m) => s + m.expenses, 0)), icon: Package, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
              { label: 'Tổng lợi nhuận ròng', value: fmtFull(MOCK_MONTHLY_PNL.reduce((s, m) => s + m.netProfit, 0)), icon: DollarSign, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className={`rounded-xl border p-5 ${bg}`}>
                <Icon className={`w-5 h-5 mb-2 ${color}`} />
                <div className={`text-lg font-black ${color}`}>{value}</div>
                <div className="text-xs text-slate-600 mt-1">{label}</div>
              </div>
            ))}
          </div>

          {/* P&L Table */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-bold text-slate-600 uppercase">Tháng</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Doanh thu</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Chi phí</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Lợi nhuận ròng</th>
                  <th className="text-right px-4 py-3 text-xs font-bold text-slate-600 uppercase">Biên LN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {MOCK_MONTHLY_PNL.map((m, i) => {
                  const margin = ((m.netProfit / m.revenue) * 100).toFixed(1);
                  const isLatest = i === MOCK_MONTHLY_PNL.length - 1;
                  return (
                    <tr key={m.month} className={isLatest ? 'bg-emerald-50' : 'hover:bg-slate-50'}>
                      <td className="px-4 py-3 font-semibold text-slate-800">
                        {m.month} {isLatest && <span className="text-[10px] text-emerald-600 font-bold ml-1">(hiện tại)</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">{fmtFull(m.revenue)}</td>
                      <td className="px-4 py-3 text-right text-rose-700 font-semibold">{fmtFull(m.expenses)}</td>
                      <td className="px-4 py-3 text-right font-black text-emerald-700">{fmtFull(m.netProfit)}</td>
                      <td className="px-4 py-3 text-right font-bold text-blue-700">{margin}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'dept' && (
        <div className="space-y-4">
          {MOCK_DEPT_REVENUE.map((dept) => {
            const maxRevenue = Math.max(...MOCK_DEPT_REVENUE.map((d) => d.totalRevenue));
            const barWidth = (dept.totalRevenue / maxRevenue) * 100;
            return (
              <div key={dept.deptId} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="font-bold text-slate-800">{dept.deptName}</div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Tổng DT: <span className="font-bold text-slate-800">{fmtFull(dept.totalRevenue)}</span>
                      {' · '}Chi phí: <span className="font-bold text-rose-700">{fmtFull(dept.directCost)}</span>
                      {' · '}Biên LN: <span className="font-bold text-emerald-700">{dept.grossMargin}%</span>
                    </div>
                  </div>
                </div>
                {/* Revenue bar */}
                <div className="w-full bg-slate-100 rounded-full h-2.5 mb-3">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                {/* Revenue breakdown */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                  {[
                    { label: 'Nội trú/Giường', value: dept.revenueInpatient, icon: Bed },
                    { label: 'Phẫu thuật/Thủ thuật', value: dept.revenueSurgery, icon: Stethoscope },
                    { label: 'Xét nghiệm', value: dept.revenueLab, icon: Package },
                    { label: 'Hình ảnh học', value: dept.revenueImaging, icon: BarChart3 },
                  ].map(({ label, value, icon: Icon }) => (
                    <div key={label} className="bg-slate-50 rounded-lg p-2 border border-slate-100">
                      <div className="flex items-center space-x-1 text-slate-500 mb-0.5">
                        <Icon className="w-3 h-3" />
                        <span>{label}</span>
                      </div>
                      <div className="font-bold text-slate-800">{fmt(value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
