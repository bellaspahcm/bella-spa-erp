'use client';

import React from 'react';
import {
  TrendingUp,
  DollarSign,
  PieChart as PieChartIcon,
  BarChart3,
  Award,
  Zap,
  Target,
  ArrowUpRight,
  ShieldCheck,
} from 'lucide-react';

interface CEODashboardChartsProps {
  totalProductsCount: number;
  availableCount: number;
  reservedCount: number;
  depositedCount: number;
  signedCount: number;
  paidCount: number;
  deliveredCount: number;
}

export const CEODashboardCharts: React.FC<CEODashboardChartsProps> = ({
  totalProductsCount = 48,
  availableCount = 12,
  reservedCount = 8,
  depositedCount = 10,
  signedCount = 14,
  deliveredCount = 4,
}) => {
  // Calculated Absorption Rate
  const totalOccupied = depositedCount + signedCount + deliveredCount;
  const absorptionRate = totalProductsCount > 0 ? ((totalOccupied / totalProductsCount) * 100).toFixed(1) : '74.2';

  // Monthly Revenue & Cashflow Data (Millions VND)
  const monthlyData = [
    { month: 'Thg 3', revenue: 42, cashflow: 38 },
    { month: 'Thg 4', revenue: 58, cashflow: 50 },
    { month: 'Thg 5', revenue: 75, cashflow: 68 },
    { month: 'Thg 6', revenue: 92, cashflow: 84 },
    { month: 'Thg 7', revenue: 115, cashflow: 102 },
    { month: 'Thg 8 (Dự kiến)', revenue: 140, cashflow: 125 },
  ];

  const maxVal = 150;

  // Funnel Data
  const funnelData = [
    { label: 'Lead Tiếp Nhận', count: 1250, pct: 100, color: 'bg-gradient-to-r from-indigo-600 to-indigo-500' },
    { label: 'Phân Công Sale (SLA 15m)', count: 1180, pct: 94.4, color: 'bg-gradient-to-r from-blue-600 to-blue-500' },
    { label: 'Tương Tác & Tư Vấn', count: 890, pct: 71.2, color: 'bg-gradient-to-r from-cyan-600 to-cyan-500' },
    { label: 'Đi Xem Dự Án (Site Visit)', count: 420, pct: 33.6, color: 'bg-gradient-to-r from-amber-500 to-amber-400' },
    { label: 'Giữ Chỗ & Đặt Cọc', count: 180, pct: 14.4, color: 'bg-gradient-to-r from-orange-500 to-orange-400' },
    { label: 'Ký HĐMB Thành Công', count: 142, pct: 11.3, color: 'bg-gradient-to-r from-emerald-600 to-emerald-500' },
  ];

  // Top Sales Leaderboard Data
  const topSales = [
    { rank: 1, name: 'Nguyễn Văn A', team: 'Đội 1 — Shophouse', deals: 14, value: '42.5 Tỷ', sLACompliance: '98%' },
    { rank: 2, name: 'Trần Thị B', team: 'Đội 2 — Villa Marina', deals: 11, value: '38.0 Tỷ', sLACompliance: '96%' },
    { rank: 3, name: 'Lê Hoàng C', team: 'Đội 1 — Shophouse', deals: 9, value: '29.2 Tỷ', sLACompliance: '94%' },
    { rank: 4, name: 'Phạm Thanh D', team: 'Đội 3 — Penthouse', deals: 7, value: '24.8 Tỷ', sLACompliance: '91%' },
  ];

  return (
    <div className="space-y-6 mt-6">
      {/* Executive Metric Cards - Clean Modern Light Glass Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Gross Contract Value */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:shadow-xl hover:border-emerald-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Tổng Doanh Thu HĐMB</span>
            <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl border border-emerald-200/80 shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">458.5 <span className="text-sm font-bold text-emerald-600">Tỷ VNĐ</span></div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+18.4% so với tháng trước</span>
            </div>
          </div>
        </div>

        {/* Card 2: Absorption Rate */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:shadow-xl hover:border-indigo-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Tỷ Lệ Hấp Thụ Sản Phẩm</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200/80 shadow-sm">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">{absorptionRate}<span className="text-sm font-bold text-indigo-600">%</span></div>
            <div className="w-full bg-slate-100 h-2.5 rounded-full mt-3 overflow-hidden border border-slate-200">
              <div className="bg-gradient-to-r from-indigo-500 to-blue-600 h-full rounded-full transition-all duration-1000" style={{ width: `${absorptionRate}%` }} />
            </div>
          </div>
        </div>

        {/* Card 3: Avg Price per Sqm */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:shadow-xl hover:border-blue-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Giá Bán Bình Quân</span>
            <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-200/80 shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">125.8 <span className="text-sm font-bold text-blue-600">Tr/m²</span></div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 font-semibold mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span>Dự án Elyse Island Marina</span>
            </div>
          </div>
        </div>

        {/* Card 4: SLA Compliance Rate */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-lg shadow-slate-200/50 transition-all duration-300 hover:shadow-xl hover:border-indigo-300">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 uppercase tracking-wider">Tốc Độ Xử Lý SLA Lead</span>
            <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-200/80 shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 font-mono">14.2 <span className="text-sm font-bold text-indigo-600">Phút</span></div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-bold mt-2">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>96.5% Lead phản hồi trong SLA</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Revenue & Cash Flow Trend (2 Columns) */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-6 shadow-lg shadow-slate-200/50 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-indigo-600" />
                  Doanh Thu HĐMB & Dòng Tiền Thực Thu Dự Án
                </h3>
                <p className="text-xs font-medium text-slate-500 mt-1">
                  Đơn vị tính: Tỷ VNĐ (Dữ liệu lũy kế 6 tháng gần nhất)
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 bg-gradient-to-r from-indigo-600 to-blue-600 rounded-sm shadow-sm" />
                  <span className="text-slate-700">Doanh Thu Ký HĐMB</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-sm shadow-sm" />
                  <span className="text-slate-700">Thực Thu Tiền Cọc & Đợt</span>
                </div>
              </div>
            </div>

            {/* Custom Interactive Bars Chart */}
            <div className="h-64 flex items-end justify-between gap-4 pt-6 pb-2 px-4 border-b border-slate-200">
              {monthlyData.map((d, i) => {
                const revPct = (d.revenue / maxVal) * 100;
                const cashPct = (d.cashflow / maxVal) * 100;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[11px] font-mono text-slate-700 opacity-90 group-hover:opacity-100 font-extrabold transition-opacity">
                      {d.revenue}B
                    </div>
                    <div className="w-full flex items-end justify-center gap-1.5 h-full max-h-48">
                      {/* Revenue Bar */}
                      <div
                        className="w-1/2 bg-gradient-to-t from-indigo-600 via-indigo-500 to-blue-500 rounded-t-md transition-all duration-500 group-hover:from-indigo-500 group-hover:to-blue-400 shadow-md shadow-indigo-500/30"
                        style={{ height: `${revPct}%` }}
                      />
                      {/* Cashflow Bar */}
                      <div
                        className="w-1/2 bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 rounded-t-md transition-all duration-500 group-hover:from-emerald-500 group-hover:to-teal-300 shadow-md shadow-emerald-500/30"
                        style={{ height: `${cashPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-800 font-bold mt-1">{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 text-xs text-slate-600 font-semibold">
            <span>Tăng trưởng doanh thu trung bình hàng tháng: <strong className="text-emerald-600 font-mono text-sm font-extrabold">+16.2%</strong></span>
            <span className="text-slate-400">Cập nhật tự động</span>
          </div>
        </div>

        {/* Chart 2: Product Absorption & Status Breakdown (1 Column) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-lg shadow-slate-200/50 flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
              <PieChartIcon className="w-5 h-5 text-indigo-600" />
              Cơ Cấu Tồn Kho & Giao Dịch
            </h3>

            {/* Circular Graphic Indicator */}
            <div className="relative w-40 h-40 mx-auto my-4 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-indigo-600 transition-all duration-1000"
                  strokeDasharray={`${absorptionRate}, 100`}
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute flex flex-col items-center justify-center text-center">
                <span className="text-3xl font-black text-slate-900 font-mono">{absorptionRate}%</span>
                <span className="text-[10px] text-slate-500 uppercase font-extrabold">Đã Hấp Thụ</span>
              </div>
            </div>

            {/* Breakdown Status Items */}
            <div className="space-y-2.5 mt-4">
              <div className="flex justify-between items-center text-xs p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-emerald-500 rounded-full shadow-sm" />
                  <span className="text-slate-800 font-bold">Tự Do (Available)</span>
                </div>
                <span className="font-mono font-black text-emerald-700 text-sm">{availableCount} Căn</span>
              </div>

              <div className="flex justify-between items-center text-xs p-2.5 bg-amber-50/60 rounded-xl border border-amber-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-amber-500 rounded-full shadow-sm" />
                  <span className="text-slate-800 font-bold">Giữ Chỗ (Holding)</span>
                </div>
                <span className="font-mono font-black text-amber-700 text-sm">{reservedCount} Căn</span>
              </div>

              <div className="flex justify-between items-center text-xs p-2.5 bg-orange-50/60 rounded-xl border border-orange-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-orange-500 rounded-full shadow-sm" />
                  <span className="text-slate-800 font-bold">Đã Cọc (Deposited)</span>
                </div>
                <span className="font-mono font-black text-orange-700 text-sm">{depositedCount} Căn</span>
              </div>

              <div className="flex justify-between items-center text-xs p-2.5 bg-indigo-50/60 rounded-xl border border-indigo-200/70">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-indigo-600 rounded-full shadow-sm" />
                  <span className="text-slate-800 font-bold">Ký HĐMB (Contracted)</span>
                </div>
                <span className="font-mono font-black text-indigo-700 text-sm">{signedCount} Căn</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary Row: Sales Funnel & Top Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Sales Funnel Conversion Chart */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-lg shadow-slate-200/50">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2 mb-4">
            <Target className="w-5 h-5 text-indigo-600" />
            Phễu Chuyển Đổi Lead & Bán Hàng Real Estate
          </h3>

          <div className="space-y-3.5">
            {funnelData.map((f, i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between text-xs font-bold">
                  <span className="text-slate-800">{f.label}</span>
                  <span className="text-slate-700 font-mono">
                    <strong className="text-slate-900 text-sm font-black">{f.count}</strong> ({f.pct}%)
                  </span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden border border-slate-200/80 shadow-inner">
                  <div className={`${f.color} h-full rounded-full transition-all duration-700 shadow-sm`} style={{ width: `${f.pct}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top Sales Performance Leaderboard */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-lg shadow-slate-200/50">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Bảng Xếp Hạng Đội Sale Xuất Sắc
            </h3>
            <span className="text-xs font-extrabold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-lg border border-indigo-200/80">Tháng 7/2026</span>
          </div>

          <div className="divide-y divide-slate-100">
            {topSales.map((s) => (
              <div key={s.rank} className="py-3 flex justify-between items-center hover:bg-slate-50 px-3 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full font-black text-xs flex items-center justify-center shadow-sm ${
                    s.rank === 1 ? 'bg-amber-400 text-slate-950 ring-2 ring-amber-300' : s.rank === 2 ? 'bg-slate-200 text-slate-950' : 'bg-amber-700 text-white'
                  }`}>
                    #{s.rank}
                  </div>
                  <div>
                    <div className="font-extrabold text-slate-900 text-sm">{s.name}</div>
                    <div className="text-xs text-slate-500 font-semibold">{s.team}</div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-black text-emerald-600 text-sm">{s.value}</div>
                  <div className="text-xs text-slate-600 font-bold">{s.deals} Giao dịch • SLA {s.sLACompliance}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
