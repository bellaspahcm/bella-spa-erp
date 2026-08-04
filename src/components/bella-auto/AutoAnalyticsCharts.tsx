'use client';

import React from 'react';
import {
  TrendingUp,
  DollarSign,
  BarChart3,
  Target,
  ArrowUpRight,
  Zap,
  Award,
  ShieldCheck,
} from 'lucide-react';

interface AutoAnalyticsChartsProps {
  totalVehicles: number;
  showroomCount: number;
  warehouseCount: number;
  allocatedCount: number;
  deliveredCount: number;
}

export const AutoAnalyticsCharts: React.FC<AutoAnalyticsChartsProps> = ({
  totalVehicles = 0,
  showroomCount = 0,
  warehouseCount = 0,
  allocatedCount = 0,
  deliveredCount = 0,
}) => {
  // Calculated metrics
  const turnoverRate = totalVehicles > 0 ? ((deliveredCount / totalVehicles) * 100).toFixed(1) : '0';
  const inventoryUtilization = totalVehicles > 0 ? (((showroomCount + allocatedCount) / totalVehicles) * 100).toFixed(1) : '0';

  // Monthly Sales & Revenue Data
  const monthlyData = [
    { month: 'Thg 3', sales: 12, revenue: 8.5 },
    { month: 'Thg 4', sales: 18, revenue: 13.2 },
    { month: 'Thg 5', sales: 22, revenue: 16.8 },
    { month: 'Thg 6', sales: 28, revenue: 21.5 },
    { month: 'Thg 7', sales: 35, revenue: 27.2 },
    { month: 'Thg 8 (Dự kiến)', sales: 42, revenue: 32.8 },
  ];

  const maxSales = 45;
  const maxRevenue = 35;

  // Sales Funnel Data
  const funnelData = [
    { label: 'Khách Hàng Tiềm Năng', count: 850, pct: 100, color: 'bg-gradient-to-r from-indigo-600 to-indigo-500' },
    { label: 'Liên Hệ Tư Vấn', count: 680, pct: 80, color: 'bg-gradient-to-r from-blue-600 to-blue-500' },
    { label: 'Lái Thử', count: 420, pct: 49.4, color: 'bg-gradient-to-r from-cyan-600 to-cyan-500' },
    { label: 'Báo Giá & Thương Thảo', count: 280, pct: 32.9, color: 'bg-gradient-to-r from-amber-500 to-amber-400' },
    { label: 'Đặt Cọc Xe', count: 120, pct: 14.1, color: 'bg-gradient-to-r from-orange-500 to-orange-400' },
    { label: 'Hoàn Tất Mua Xe', count: 98, pct: 11.5, color: 'bg-gradient-to-r from-emerald-600 to-emerald-500' },
  ];

  // Top Sales Performers
  const topSales = [
    { rank: 1, name: 'Nguyễn Văn A', team: 'Đội Showroom 1', deals: 24, value: '18.5 Tỷ', responseTime: '12 phút' },
    { rank: 2, name: 'Trần Thị B', team: 'Đội Showroom 2', deals: 19, value: '14.8 Tỷ', responseTime: '15 phút' },
    { rank: 3, name: 'Lê Hoàng C', team: 'Đội Showroom 1', deals: 16, value: '12.2 Tỷ', responseTime: '18 phút' },
    { rank: 4, name: 'Phạm Thanh D', team: 'Đội Online', deals: 14, value: '10.6 Tỷ', responseTime: '10 phút' },
  ];

  return (
    <div className="space-y-6">
      {/* Executive Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Revenue */}
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-emerald-300 dark:hover:border-emerald-700">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tổng Doanh Thu</span>
            <div className="p-2.5 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 rounded-xl border border-emerald-200 dark:border-emerald-800 shadow-sm">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">142.8 <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Tỷ VNĐ</span></div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold mt-2">
              <TrendingUp className="w-3.5 h-3.5" />
              <span>+22.5% so với tháng trước</span>
            </div>
          </div>
        </div>

        {/* Card 2: Inventory Turnover Rate */}
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-700">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Tỷ Lệ Bán Hàng</span>
            <div className="p-2.5 bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 rounded-xl border border-cyan-200 dark:border-cyan-800 shadow-sm">
              <Target className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">{turnoverRate}<span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">%</span></div>
            <div className="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full mt-3 overflow-hidden border border-slate-200 dark:border-slate-700">
              <div className="bg-gradient-to-r from-cyan-500 to-teal-500 h-full rounded-full transition-all duration-1000" style={{ width: `${turnoverRate}%` }} />
            </div>
          </div>
        </div>

        {/* Card 3: Average Deal Value */}
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Giá Trị TB/Xe</span>
            <div className="p-2.5 bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 rounded-xl border border-blue-200 dark:border-blue-800 shadow-sm">
              <BarChart3 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">1.46 <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Tỷ</span></div>
            <div className="flex items-center gap-1.5 text-xs text-slate-700 dark:text-slate-300 font-semibold mt-2">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Trung bình 98 xe bán ra</span>
            </div>
          </div>
        </div>

        {/* Card 4: Lead Response Time */}
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm transition-all duration-300 hover:shadow-md hover:border-indigo-300 dark:hover:border-indigo-700">
          <div className="flex justify-between items-start">
            <span className="text-xs font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Thời Gian Phản Hồi</span>
            <div className="p-2.5 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 rounded-xl border border-indigo-200 dark:border-indigo-800 shadow-sm">
              <Zap className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-slate-900 dark:text-white font-mono">13.8 <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Phút</span></div>
            <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 font-bold mt-2">
              <ArrowUpRight className="w-3.5 h-3.5" />
              <span>94.2% Lead phản hồi nhanh</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart 1: Sales & Revenue Trend (2 Columns) */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
                  Số Lượng Xe Bán & Doanh Thu
                </h3>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-1">
                  Đơn vị: Xe (cột trái) / Tỷ VNĐ (cột phải) - 6 tháng gần nhất
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold">
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 bg-gradient-to-r from-cyan-600 to-teal-600 rounded-sm shadow-sm" />
                  <span className="text-slate-700 dark:text-slate-300">Số Xe Bán</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-3.5 h-3.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-sm shadow-sm" />
                  <span className="text-slate-700 dark:text-slate-300">Doanh Thu</span>
                </div>
              </div>
            </div>

            {/* Custom Interactive Bars Chart */}
            <div className="h-64 flex items-end justify-between gap-4 pt-6 pb-2 px-4 border-b border-slate-200 dark:border-slate-800">
              {monthlyData.map((d, i) => {
                const salesPct = (d.sales / maxSales) * 100;
                const revPct = (d.revenue / maxRevenue) * 100;

                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group">
                    <div className="text-[11px] font-mono text-slate-700 dark:text-slate-300 opacity-90 group-hover:opacity-100 font-extrabold transition-opacity">
                      {d.sales} xe
                    </div>
                    <div className="w-full flex items-end justify-center gap-1.5 h-full max-h-48">
                      {/* Sales Bar */}
                      <div
                        className="w-1/2 bg-gradient-to-t from-cyan-600 via-cyan-500 to-teal-400 rounded-t-md transition-all duration-500 group-hover:from-cyan-500 group-hover:to-teal-300 shadow-md shadow-cyan-500/30"
                        style={{ height: `${salesPct}%` }}
                      />
                      {/* Revenue Bar */}
                      <div
                        className="w-1/2 bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 rounded-t-md transition-all duration-500 group-hover:from-emerald-500 group-hover:to-teal-300 shadow-md shadow-emerald-500/30"
                        style={{ height: `${revPct}%` }}
                      />
                    </div>
                    <span className="text-xs text-slate-800 dark:text-slate-200 font-bold mt-1">{d.month}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-between items-center pt-4 text-xs text-slate-600 dark:text-slate-400 font-semibold">
            <span>Tăng trưởng doanh số trung bình: <strong className="text-emerald-600 dark:text-emerald-400 font-mono text-sm font-extrabold">+19.8%</strong></span>
            <span className="text-slate-400 dark:text-slate-500">Cập nhật tự động</span>
          </div>
        </div>

        {/* Chart 2: Sales Funnel (1 Column) */}
        <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
          <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            Phễu Bán Hàng Ô Tô
          </h3>
          <div className="space-y-3">
            {funnelData.map((item, idx) => (
              <div key={idx} className="group">
                <div className="flex items-center justify-between text-xs font-bold mb-1.5">
                  <span className="text-slate-700 dark:text-slate-300">{item.label}</span>
                  <span className="text-slate-900 dark:text-white font-mono">{item.count.toLocaleString()}</span>
                </div>
                <div className="w-full bg-slate-100 dark:bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-200 dark:border-slate-700">
                  <div
                    className={`${item.color} h-full rounded-full transition-all duration-700 group-hover:opacity-90`}
                    style={{ width: `${item.pct}%` }}
                  />
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-0.5">
                  {item.pct.toFixed(1)}% conversion
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Sales Performers Table */}
      <div className="bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm">
        <h3 className="text-lg font-black text-slate-900 dark:text-white mb-4 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Bảng Xếp Hạng Sale Xuất Sắc Tháng
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">Hạng</th>
                <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">Tên Sale</th>
                <th className="text-left py-3 px-4 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">Đội/Chi nhánh</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">Số Xe</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">Giá Trị</th>
                <th className="text-right py-3 px-4 font-semibold text-xs text-slate-600 dark:text-slate-400 uppercase">Phản Hồi TB</th>
              </tr>
            </thead>
            <tbody>
              {topSales.map((sale) => (
                <tr key={sale.rank} className="border-b border-slate-100 dark:border-slate-900 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                  <td className="py-3 px-4">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-sm ${
                      sale.rank === 1 ? 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 border-2 border-amber-300 dark:border-amber-700' :
                      sale.rank === 2 ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-2 border-slate-300 dark:border-slate-700' :
                      sale.rank === 3 ? 'bg-orange-100 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 border-2 border-orange-300 dark:border-orange-700' :
                      'bg-slate-50 dark:bg-slate-900 text-slate-500 dark:text-slate-500 border border-slate-200 dark:border-slate-800'
                    }`}>
                      {sale.rank}
                    </div>
                  </td>
                  <td className="py-3 px-4 font-bold text-sm text-slate-900 dark:text-white">{sale.name}</td>
                  <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">{sale.team}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-cyan-600 dark:text-cyan-400">{sale.deals}</td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-sm text-emerald-600 dark:text-emerald-400">{sale.value}</td>
                  <td className="py-3 px-4 text-right text-sm text-slate-700 dark:text-slate-300">{sale.responseTime}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
