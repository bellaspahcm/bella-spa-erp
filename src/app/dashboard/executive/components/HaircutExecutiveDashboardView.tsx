'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Users,
  Activity,
  BarChart3,
  Calendar,
  RefreshCw,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Clock,
  Sparkles,
  ShieldAlert,
  ChevronRight,
  UserCheck,
  Package,
  Scissors,
  CheckCircle2,
  FileSpreadsheet,
  Download,
  AlertCircle,
  Building2,
  CreditCard,
  PieChart as PieChartIcon
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@bella/shared';
import { cn } from '@/lib/utils';

export function HaircutExecutiveDashboardView() {
  const [timeRange, setTimeRange] = useState<'today' | '7days' | '30days' | 'month'>('30days');
  const [trendView, setTrendView] = useState<'daily' | 'cumulative'>('daily');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('10:42 • 25/09/2026');

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const dateStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
      setLastUpdated(`${timeStr} • ${dateStr}`);
      toast.success('Đã cập nhật dữ liệu Bảng quản trị CEO mới nhất');
    }, 600);
  };

  return (
    <div className="p-4 sm:p-8 space-y-8 pb-24 w-full overflow-x-hidden bg-slate-50/50 min-h-screen">
      {/* 1. Header & Time Range Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase">EXECUTIVE DASHBOARD</h1>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-900 text-white uppercase tracking-wider">
              Haircut Shop CEO Command Center
            </span>
          </div>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Tổng quan điều hành hoạt động kinh doanh & kiểm soát vận hành Bella Haircut Shop
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Time Filter Ribbon */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200/80 shadow-sm text-xs font-semibold text-slate-600">
            {[
              { id: 'today', label: 'Hôm nay' },
              { id: '7days', label: '7 ngày' },
              { id: '30days', label: '30 ngày' },
              { id: 'month', label: 'Tháng này' }
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setTimeRange(item.id as typeof timeRange)}
                className={cn(
                  'px-3 py-1.5 rounded-lg transition-all',
                  timeRange === item.id
                    ? 'bg-slate-900 text-white shadow-sm font-bold'
                    : 'hover:text-slate-900 hover:bg-slate-50'
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => toast.success('Đang khởi tạo bản tổng hợp báo cáo CEO PDF/Excel...')}
            className="inline-flex items-center gap-2 bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95"
          >
            <Download className="w-3.5 h-3.5 text-emerald-400" />
            <span>Xuất báo cáo</span>
          </button>
        </div>
      </div>

      {/* 2. Top 4 Command Summary Cards (Key Metrics Bar) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DOANH THU */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">DOANH THU</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">68.500.000đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +12,4% so với kỳ trước
            </span>
            <span className="font-medium text-slate-400">432 giao dịch</span>
          </div>
        </div>

        {/* LỢI NHUẬN */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">LỢI NHUẬN THUẦN</span>
              <h3 className="text-2xl font-black text-rose-600 mt-1">-12.531.000đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
              Biên LN: -18,3%
            </span>
            <span className="font-medium text-slate-400">↓ 5,2% so với kỳ trước</span>
          </div>
        </div>

        {/* KHÁCH HÀNG */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">KHÁCH HÀNG</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">183 khách</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-emerald-600 flex items-center gap-1">
              <ArrowUpRight className="w-3.5 h-3.5" />
              +8,2% so với kỳ trước
            </span>
            <span className="font-medium text-slate-500">55 mới · 128 quay lại</span>
          </div>
        </div>

        {/* CÔNG NỢ PHẢI THU */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:border-slate-300 transition-all flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CÔNG NỢ PHẢI THU</span>
              <h3 className="text-2xl font-black text-slate-900 mt-1">17.480.000đ</h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
              18 khoản quá hạn
            </span>
            <span className="font-medium text-slate-400">42 khách hàng</span>
          </div>
        </div>
      </div>

      {/* 3. Row 1 Grid: Doanh thu 30 ngày (Left 60%) + CẦN CHÚ Ý HÔM NAY Exception Alerts (Right 40%) */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Doanh thu 30 ngày qua (3/5 cols) */}
        <div className="lg:col-span-3 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Doanh thu 30 ngày qua
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-0.5">Biểu đồ biến động doanh thu từng ngày trong kỳ</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={trendView}
                onChange={(e) => setTrendView(e.target.value as typeof trendView)}
                className="px-3 py-1.5 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-bold text-slate-700 outline-none cursor-pointer"
              >
                <option value="daily">Theo ngày (Daily)</option>
                <option value="cumulative">Lũy kế (Cumulative)</option>
              </select>
            </div>
          </div>

          {/* SVG Line / Area Chart Simulation */}
          <div className="relative h-56 w-full pt-4">
            <div className="absolute top-2 right-4 bg-slate-900 text-white p-2.5 rounded-xl shadow-lg text-xs space-y-0.5 pointer-events-none z-10">
              <div className="text-[10px] text-slate-400 font-medium">18/09/2026</div>
              <div className="font-black text-emerald-400">Doanh thu: 5.320.000đ</div>
              <div className="text-[11px] text-slate-300">Giao dịch: 42 lượt</div>
            </div>

            <svg className="w-full h-full overflow-visible" viewBox="0 0 500 180" preserveAspectRatio="none">
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              <line x1="0" y1="30" x2="500" y2="30" stroke="#f1f5f9" strokeDasharray="4 4" />
              <line x1="0" y1="80" x2="500" y2="80" stroke="#f1f5f9" strokeDasharray="4 4" />
              <line x1="0" y1="130" x2="500" y2="130" stroke="#f1f5f9" strokeDasharray="4 4" />
              <line x1="0" y1="170" x2="500" y2="170" stroke="#e2e8f0" />

              {/* Y Axis Labels */}
              <text x="5" y="25" className="text-[10px] fill-slate-400 font-medium">8 Tr</text>
              <text x="5" y="75" className="text-[10px] fill-slate-400 font-medium">5 Tr</text>
              <text x="5" y="125" className="text-[10px] fill-slate-400 font-medium">2 Tr</text>

              {/* Area */}
              <path
                d="M 20,130 Q 70,80 120,90 T 220,50 T 320,85 T 420,40 L 480,30 L 480,170 L 20,170 Z"
                fill="url(#revenueGrad)"
              />

              {/* Line */}
              <path
                d="M 20,130 Q 70,80 120,90 T 220,50 T 320,85 T 420,40 L 480,30"
                fill="none"
                stroke="#10b981"
                strokeWidth="3"
                strokeLinecap="round"
              />

              {/* Highlight Point */}
              <circle cx="280" cy="72" r="5" fill="#10b981" stroke="#ffffff" strokeWidth="2" />
            </svg>

            {/* X Axis Date Labels */}
            <div className="flex justify-between text-[10px] text-slate-400 font-semibold px-2 mt-2">
              <span>01/09</span>
              <span>05/09</span>
              <span>10/09</span>
              <span>15/09</span>
              <span>20/09</span>
              <span>25/09</span>
              <span>30/09</span>
            </div>
          </div>
        </div>

        {/* 🔴 CẦN CHÚ Ý HÔM NAY (Exception Alert Center - Core CEO Feature!) (2/5 cols) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-500 text-white flex items-center justify-center font-black text-xs shadow-sm">
                !
              </div>
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider">Cần chú ý hôm nay</h3>
            </div>
            <button
              onClick={() => toast.info('Chuyển hướng đến Trung tâm Cảnh báo Ngoại lệ CEO...')}
              className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
            >
              <span>Xem tất cả</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Exception Alert List */}
          <div className="space-y-2.5 text-xs">
            {/* Alert 1 */}
            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-slate-900">
                    Biên lợi nhuận âm <span className="text-rose-600 font-extrabold">-18,3%</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Chi phí cao hơn doanh thu trong kỳ</div>
                </div>
              </div>
              <Link
                href="/dashboard/finance/pnl"
                className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition-all shrink-0"
              >
                Xem
              </Link>
            </div>

            {/* Alert 2 */}
            <div className="p-3 bg-rose-50/60 rounded-xl border border-rose-100 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-rose-500 mt-1.5 shrink-0 animate-pulse" />
                <div>
                  <div className="font-bold text-slate-900">
                    Dòng tiền âm <span className="text-rose-600 font-extrabold">-1.620.447đ</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Cần đối thu chi trong tuần</div>
                </div>
              </div>
              <Link
                href="/dashboard/finance/cash-flow"
                className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 font-bold text-[11px] rounded-lg border border-rose-200 transition-all shrink-0"
              >
                Xem
              </Link>
            </div>

            {/* Alert 3 */}
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">
                    18 khoản công nợ quá hạn <span className="text-amber-700 font-extrabold">4.480.000đ</span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Liên hệ khách hàng để thu nợ</div>
                </div>
              </div>
              <Link
                href="/dashboard/finance/reconciliation"
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-700 font-bold text-[11px] rounded-lg border border-amber-200 transition-all shrink-0"
              >
                Xem
              </Link>
            </div>

            {/* Alert 4 */}
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-100 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">3 KTV chưa cập nhật lương</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Kỳ lương 09/2026</div>
                </div>
              </div>
              <Link
                href="/dashboard/salary"
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-700 font-bold text-[11px] rounded-lg border border-amber-200 transition-all shrink-0"
              >
                Xem
              </Link>
            </div>

            {/* Alert 5 */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between gap-2">
              <div className="flex items-start gap-2.5">
                <span className="w-2 h-2 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                <div>
                  <div className="font-bold text-slate-900">12 vật tư sắp hết</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">Tồn kho dưới mức tối thiểu</div>
                </div>
              </div>
              <Link
                href="/dashboard/inventory"
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-bold text-[11px] rounded-lg border border-slate-200 transition-all shrink-0"
              >
                Xem
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Row 2 Grid: Customer Metrics (1/3) + Revenue Source Breakdown (1/3) + Financial Health (1/3) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Column 1: Khách hàng (Customer Metrics) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Users className="w-4 h-4 text-purple-500" />
              Khách hàng
            </h3>
            <Link href="/dashboard/customers" className="text-xs font-bold text-purple-600 hover:text-purple-700 flex items-center gap-1">
              <span>Xem chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Khách hàng mới</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">55</span>
              <span className="text-[10px] font-bold text-emerald-600">↑ 15,8%</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Khách quay lại</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">128</span>
              <span className="text-[10px] font-bold text-emerald-600">↑ 6,7%</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Tỷ lệ giữ chân</span>
              <span className="text-xl font-black text-slate-900 mt-0.5 block">67,3%</span>
              <span className="text-[10px] font-bold text-emerald-600">↑ 4,2%</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Giá trị đơn TB</span>
              <span className="text-sm font-black text-slate-900 mt-1 block">175.533đ</span>
              <span className="text-[10px] font-bold text-emerald-600">↑ 9,1%</span>
            </div>
          </div>

          {/* 7-Day Customer Trend Bar Chart */}
          <div className="pt-2 border-t border-slate-100">
            <span className="text-[11px] font-bold text-slate-500 block mb-2">Xu hướng khách hàng 7 ngày qua</span>
            <div className="h-24 w-full flex items-end justify-between gap-2 px-2">
              {[
                { day: '19/9', new: 6, ret: 15 },
                { day: '20/9', new: 8, ret: 18 },
                { day: '21/9', new: 5, ret: 14 },
                { day: '22/9', new: 10, ret: 22 },
                { day: '23/9', new: 7, ret: 19 },
                { day: '24/9', new: 9, ret: 20 },
                { day: '25/9', new: 10, ret: 20 }
              ].map((item) => (
                <div key={item.day} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full flex items-end justify-center gap-1 h-16">
                    <div className="w-2 bg-purple-400 rounded-t" style={{ height: `${item.new * 3}px` }} />
                    <div className="w-2 bg-indigo-600 rounded-t" style={{ height: `${item.ret * 2.2}px` }} />
                  </div>
                  <span className="text-[9px] text-slate-400 font-medium">{item.day}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-center gap-4 text-[10px] text-slate-500 font-semibold mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-purple-400" /> Khách mới</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-indigo-600" /> Khách quay lại</span>
            </div>
          </div>
        </div>

        {/* Column 2: Cơ cấu doanh thu theo dịch vụ (Issue #4 Fix!) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-indigo-500" />
              Cơ cấu doanh thu dịch vụ
            </h3>
            <span className="text-xs font-bold text-slate-400">Theo giá trị</span>
          </div>

          {/* Donut Simulation + Legend */}
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="relative w-28 h-28 rounded-full border-8 border-slate-100 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full border-8 border-indigo-600 border-t-purple-500 border-r-cyan-500 border-b-amber-500" />
              <div className="text-center z-10">
                <span className="text-[10px] text-slate-400 font-medium block">Tổng doanh thu</span>
                <span className="text-sm font-black text-slate-900">68.5M</span>
              </div>
            </div>

            <div className="space-y-1.5 text-xs flex-1">
              {[
                { name: 'Cắt tóc', pct: '36%', val: '24.660.000đ', color: 'bg-indigo-600' },
                { name: 'Nhuộm', pct: '25%', val: '17.125.000đ', color: 'bg-purple-500' },
                { name: 'Uốn', pct: '15%', val: '10.275.000đ', color: 'bg-cyan-500' },
                { name: 'Gội / Styling', pct: '12%', val: '8.220.000đ', color: 'bg-amber-500' },
                { name: 'Sản phẩm', pct: '8%', val: '5.480.000đ', color: 'bg-emerald-500' },
                { name: 'Khác', pct: '4%', val: '2.740.000đ', color: 'bg-slate-400' }
              ].map((cat) => (
                <div key={cat.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', cat.color)} />
                    <span className="font-semibold text-slate-700 truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 font-bold">
                    <span className="text-slate-400">{cat.pct}</span>
                    <span className="text-slate-900">{cat.val}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Column 3: Sức khỏe tài chính (Financial Health - Issue #6 Fix!) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-orange-500" />
              Sức khỏe tài chính
            </h3>
            <Link href="/dashboard/finance" className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1">
              <span>Xem chi tiết</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-rose-50/60 p-3 rounded-xl border border-rose-100">
              <span className="text-rose-700 font-bold block">Biên lợi nhuận</span>
              <span className="text-xl font-black text-rose-600 mt-0.5 block">-18,3%</span>
              <span className="text-[10px] font-bold text-rose-600">↓ 5,1%</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Dòng tiền thuần</span>
              <span className="text-sm font-black text-rose-600 mt-1 block">-1.620.447đ</span>
              <span className="text-[10px] font-bold text-rose-600">↓ 8,9%</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Công nợ phải thu</span>
              <span className="text-sm font-black text-slate-900 mt-1 block">17.480.000đ</span>
              <span className="text-[10px] font-bold text-rose-600">18 khoản quá hạn</span>
            </div>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
              <span className="text-slate-400 font-medium block">Chi phí vận hành</span>
              <span className="text-sm font-black text-slate-900 mt-1 block">8.200.000đ</span>
              <span className="text-[10px] font-bold text-emerald-600">↑ 3,4%</span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Row 3 Grid: Operational Performance + Growth & Forecast (Left 65%) + Recent Activity (Right 35%) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3): Operational Performance & Growth Forecast */}
        <div className="lg:col-span-2 space-y-6">
          {/* Operational Performance (Issue #5 Fix!) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Activity className="w-4 h-4 text-cyan-500" />
                Hiệu suất vận hành
              </h3>
              <Link href="/dashboard/bookings" className="text-xs font-bold text-cyan-600 hover:text-cyan-700 flex items-center gap-1">
                <span>Xem chi tiết</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <span className="text-slate-400 font-medium block">Công suất KTV</span>
                <span className="text-2xl font-black text-cyan-600 mt-1 block">72%</span>
                <span className="text-[10px] font-bold text-emerald-600">↑ 6% so với kỳ trước</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <span className="text-slate-400 font-medium block">Booking hoàn thành</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">94%</span>
                <span className="text-[10px] font-bold text-emerald-600">↑ 4% so với kỳ trước</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <span className="text-slate-400 font-medium block">Đánh giá trung bình</span>
                <span className="text-2xl font-black text-amber-500 mt-1 block">4.8 ⭐</span>
                <span className="text-[10px] font-bold text-emerald-600">↑ 0.2 điểm</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-center">
                <span className="text-slate-400 font-medium block">Thời gian DV trung bình</span>
                <span className="text-2xl font-black text-slate-900 mt-1 block">42 phút</span>
                <span className="text-[10px] font-bold text-emerald-600">↓ 6% tối ưu thời gian</span>
              </div>
            </div>
          </div>

          {/* Growth & Forecast Panel (Issue #9 Fix!) */}
          <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Tăng trưởng & Dự báo
              </h3>
              <span className="text-xs font-bold text-slate-400">Tháng hiện tại</span>
            </div>

            <div className="grid grid-cols-3 gap-4 text-xs">
              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium block">Doanh thu tháng</span>
                <span className="text-xl font-black text-slate-900 mt-0.5 block">68,5M</span>
                <span className="text-[10px] font-bold text-emerald-600">↑ 8,2% MoM</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium block">Tăng trưởng YoY</span>
                <span className="text-xl font-black text-emerald-600 mt-0.5 block">+14,6%</span>
                <span className="text-[10px] font-medium text-slate-400">So với cùng kỳ 2025</span>
              </div>

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <span className="text-slate-400 font-medium block">Dự báo tháng tới</span>
                <span className="text-xl font-black text-indigo-600 mt-0.5 block">77,0M</span>
                <span className="text-[10px] font-bold text-indigo-600">↑ 12,4% dự kiến</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column (1/3): Recent Activity Stream */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              Hoạt động gần đây
            </h3>
            <button
              onClick={() => toast.info('Chuyển hướng đến Nhật ký Giao dịch Toàn Salon...')}
              className="text-xs font-bold text-slate-500 hover:text-slate-800"
            >
              Xem tất cả →
            </button>
          </div>

          <div className="space-y-3.5 text-xs divide-y divide-slate-100">
            {[
              { title: 'Thanh toán hóa đơn #HD0289', detail: '+320.000đ · Chuyển khoản VietQR', time: '2 phút trước', icon: DollarSign, iconBg: 'bg-emerald-50 text-emerald-600' },
              { title: 'Tạo lịch hẹn mới - Nguyễn Minh', detail: 'Cắt tóc nam Fade + Styling · 10:30', time: '15 phút trước', icon: Calendar, iconBg: 'bg-purple-50 text-purple-600' },
              { title: 'Cập nhật công nợ - Trần Thị Mai', detail: '+250.000đ · Thêm khoản nợ nhuộm', time: '32 phút trước', icon: CreditCard, iconBg: 'bg-amber-50 text-amber-600' },
              { title: 'Nhập kho sản phẩm Dầu gội', detail: 'Sản phẩm Dầu gội 500ml - 10 chai', time: '1 giờ trước', icon: Package, iconBg: 'bg-cyan-50 text-cyan-600' },
              { title: 'Tính lương KTV - Thợ Chính 1', detail: 'Tạm tính lương kỳ 09/2026', time: '2 giờ trước', icon: Scissors, iconBg: 'bg-indigo-50 text-indigo-600' }
            ].map((act, i) => {
              const IconComp = act.icon;
              return (
                <div key={i} className="pt-3 first:pt-0 flex items-start gap-3">
                  <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5', act.iconBg)}>
                    <IconComp className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-slate-900 truncate">{act.title}</div>
                    <div className="text-[11px] text-slate-500 font-medium truncate mt-0.5">{act.detail}</div>
                  </div>
                  <span className="text-[10px] text-slate-400 font-medium shrink-0 whitespace-nowrap">{act.time}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
