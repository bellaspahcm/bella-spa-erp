'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Users,
  Calendar,
  DollarSign,
  Star,
  Search,
  Plus,
  ChevronRight,
  ChevronDown,
  Sparkles,
  AlertTriangle,
  Package,
  TrendingUp,
  MoreHorizontal,
  Bell,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type {
  DashboardStatsViewModel,
  DashboardSessionViewModel,
  KtvPerformanceViewModel,
  PerformanceDataPointViewModel,
  InventorySummaryViewModel,
  DashboardAlert,
} from '@/core/services/analytics/dashboard-actions';

interface BeautySpaV2DashboardViewProps {
  stats: DashboardStatsViewModel[];
  sessions: DashboardSessionViewModel[];
  topKTVs: KtvPerformanceViewModel[];
  alerts: DashboardAlert[];
  performanceData: PerformanceDataPointViewModel[];
  inventorySummary: InventorySummaryViewModel;
  selectedMonth: number;
  setSelectedMonth: (m: number) => void;
  selectedYear: number;
  setSelectedYear: (y: number) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isLoading: boolean;
  isSecondaryLoading: boolean;
  onOpenBookingModal: () => void;
  userRole: 'admin' | 'ktv' | null;
  handleCompleteSession: (sessionId: string, bookingId: string, note: string) => Promise<void>;
  updatingId: string | null;
}

type AppointmentTab = 'all' | 'serving' | 'waiting' | 'done';

function isServingSession(status: string | null) {
  return status === 'in_progress' || status === 'serving';
}

function isCompletedSession(status: string | null) {
  return status === 'completed';
}

function isWaitingSession(status: string | null) {
  return status === null
    || status === 'pending'
    || status === 'waiting'
    || status === 'scheduled'
    || status === 'confirmed';
}

function matchesAppointmentTab(session: DashboardSessionViewModel, tab: AppointmentTab) {
  if (tab === 'all') return true;
  if (tab === 'serving') return isServingSession(session.status);
  if (tab === 'waiting') return isWaitingSession(session.status);
  if (tab === 'done') return isCompletedSession(session.status);
  return true;
}

// ─── PerfChart: interactive area-line chart with hover tooltip ────────────────
function PerfChart({
  W, H, areaPath, linePath, values, toX, toY, performanceData, activePerfTab,
}: {
  W: number; H: number;
  areaPath: string; linePath: string;
  values: number[];
  toX: (i: number) => number;
  toY: (v: number) => number;
  performanceData: PerformanceDataPointViewModel[];
  activePerfTab: string;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  return (
    <div className="relative h-40 w-full">
      <svg
        className="w-full overflow-visible"
        style={{ height: 'calc(100% - 18px)' }}
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="perfAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary, #10B981)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--primary, #10B981)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill="url(#perfAreaGrad)" />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke="var(--primary, #10B981)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Data points + hover hit areas */}
        {values.map((v, i) => {
          const x = toX(i);
          const y = toY(v);
          const isHov = hoveredIdx === i;
          const label = activePerfTab === 'revenue'
            ? `${v.toFixed(1)}M`
            : `${v} khách`;
          const month = performanceData[i]?.name ?? '';
          const boxW = 66;
          const boxX = x + boxW > W ? x - boxW - 4 : x + 4;

          return (
            <g
              key={i}
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
              style={{ cursor: 'pointer' }}
            >
              {/* Invisible larger hit zone */}
              <circle cx={x} cy={y} r="14" fill="transparent" />

              {/* Dot (always visible on hover) */}
              {isHov && (
                <circle cx={x} cy={y} r="4" fill="white" stroke="var(--primary, #10B981)" strokeWidth="2" />
              )}

              {/* Tooltip */}
              {isHov && (
                <g style={{ pointerEvents: 'none' }}>
                  <rect
                    x={boxX} y={y - 30}
                    width={boxW} height={28}
                    rx="5" ry="5"
                    fill="#0F172A" fillOpacity="0.93"
                  />
                  <text
                    x={boxX + boxW / 2} y={y - 19}
                    textAnchor="middle"
                    fill="#94A3B8"
                    fontSize="7"
                    fontWeight="600"
                  >
                    {month}
                  </text>
                  <text
                    x={boxX + boxW / 2} y={y - 7}
                    textAnchor="middle"
                    fill="white"
                    fontSize="9"
                    fontWeight="700"
                  >
                    {label}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>

      {/* X-axis month labels */}
      <div className="absolute bottom-0 left-0 right-0 flex justify-between">
        {performanceData.map((d, i) => (
          <span key={i} className="text-[9px] font-semibold text-slate-400 text-center" style={{ width: `${100 / performanceData.length}%` }}>
            {d.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export function BeautySpaV2DashboardView({
  stats,
  sessions,
  topKTVs,
  alerts,
  performanceData,
  inventorySummary,
  selectedMonth,
  setSelectedMonth,
  selectedYear,
  setSelectedYear,
  searchQuery,
  setSearchQuery,
  isLoading,
  isSecondaryLoading,
  onOpenBookingModal,
  userRole,
  handleCompleteSession,
  updatingId,
}: BeautySpaV2DashboardViewProps) {
  const [activeAppointmentTab, setActiveAppointmentTab] = useState<AppointmentTab>('all');
  const [activePerfTab, setActivePerfTab] = useState<'revenue' | 'booking' | 'new_customer' | 'returning'>('revenue');
  const visibleSessions = sessions.filter((session) => matchesAppointmentTab(session, activeAppointmentTab));

  const now = new Date();
  const dateString = now.toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });

  return (
    <div className="bella-dashboard-view flex-1 bg-[#F4F6F8] min-h-screen p-6 md:p-8 lg:p-12 pb-32 space-y-8 text-slate-800 font-sans">
      {/* ─── TOP HEADER BAR ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white/60 backdrop-blur-md p-4 md:p-6 rounded-2xl border border-slate-200/60 shadow-xs">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            Chào buổi sáng{userRole === 'admin' ? ', Admin' : ''}! <span className="animate-bounce inline-block">👋</span>
          </h1>
          <p className="text-xs md:text-sm font-medium text-slate-500 mt-1 flex items-center gap-2">
            <span>{dateString}</span>
            <span className="text-slate-300">•</span>
            <span className="text-primary font-semibold">Dashboard</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm kiếm nhanh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary w-44 md:w-56 shadow-2xs"
            />
          </div>

          <div className="relative p-2 bg-primary/10 hover:bg-primary/20 border border-primary/20 rounded-xl text-primary cursor-pointer transition-colors">
            <Bell className="w-4 h-4 text-primary" />
            {alerts.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full shadow-2xs">
                {alerts.length}
              </span>
            )}
          </div>

          <button
            onClick={onOpenBookingModal}
            className="flex items-center gap-2 bg-primary hover:bg-primary-hover text-primary-foreground px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>TẠO BOOKING</span>
          </button>
        </div>
      </div>

      {/* ─── TOP METRIC CARDS ROW ──────────────────────────────────────── */}
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-${stats.length > 0 ? stats.length : 4} gap-4`}>
        {stats.map((stat, idx) => {
          const Icon = stat.iconName === 'Users' ? Users : stat.iconName === 'Calendar' ? Calendar : stat.iconName === 'DollarSign' ? DollarSign : Star;
          const trendIcon = stat.trend >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />;
          const trendBg = stat.trend >= 0 ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-rose-50 text-rose-600 border-rose-100';

          return (
            <div key={idx} className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-full ${stat.bg} ${stat.color} flex items-center justify-center`}>
                  <Icon className="w-4 h-4" />
                </div>
                <span className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${trendBg}`}>
                  {trendIcon} {Math.abs(stat.trend)}%
                </span>
              </div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{stat.label}</p>
              <div className="text-2xl font-black text-slate-900 mt-1">{stat.value}</div>
            </div>
          );
        })}
      </div>

      {/* ─── MIDDLE ROW: 3 MAIN COLUMNS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COL 1: LỊCH HẸN HÔM NAY (5 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Calendar className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  LỊCH HẸN HÔM NAY <span className="text-slate-400 font-semibold text-sm">({sessions.length})</span>
                </h2>
              </div>
              <Link href="/dashboard/bookings" className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {[
                { key: 'all', label: 'Tất cả', count: sessions.length, activeClass: 'bg-primary text-primary-foreground', inactiveClass: 'bg-slate-100 text-slate-600' },
                { key: 'serving', label: 'Đang phục vụ', count: sessions.filter(s => isServingSession(s.status)).length, activeClass: 'bg-emerald-600 text-white', inactiveClass: 'bg-emerald-50 text-emerald-700' },
                { key: 'waiting', label: 'Đang chờ', count: sessions.filter(s => isWaitingSession(s.status)).length, activeClass: 'bg-amber-500 text-white', inactiveClass: 'bg-amber-50 text-amber-700' },
                { key: 'done', label: 'Hoàn thành', count: sessions.filter(s => isCompletedSession(s.status)).length, activeClass: 'bg-blue-600 text-white', inactiveClass: 'bg-blue-50 text-blue-700' },
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveAppointmentTab(tab.key as AppointmentTab)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                    activeAppointmentTab === tab.key ? tab.activeClass : tab.inactiveClass
                  }`}
                >
                  {tab.label} <span className="ml-0.5 opacity-80">{tab.count}</span>
                </button>
              ))}
            </div>

            {/* List items */}
            <div className="space-y-3">
              {visibleSessions.slice(0, 5).map((app) => {
                const customerName = app.bookings?.customers?.name_mother || 'Khách hàng';
                const packageName = app.bookings?.package_name || 'Dịch vụ';
                const ktvName = app.bookings?.assigned_ktv?.full_name || 'Chưa xếp KTV';
                const statusLabel = isCompletedSession(app.status)
                  ? 'Hoàn thành'
                  : isServingSession(app.status)
                    ? 'Đang phục vụ'
                    : 'Đang chờ';
                const statusClass = isCompletedSession(app.status)
                  ? 'bg-blue-50 text-blue-600 border-blue-200'
                  : isServingSession(app.status)
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200';

                return (
                  <div
                    key={app.id}
                    className="grid grid-cols-[3.25rem_2.25rem_minmax(0,1fr)_auto_auto] items-center gap-2.5 p-3 rounded-xl bg-slate-50/70 hover:bg-slate-100/80 border border-slate-100 transition-colors"
                  >
                    <span className="text-xs font-extrabold text-slate-700 tabular-nums shrink-0">
                      {app.assigned_time ? app.assigned_time.substring(0, 5) : '00:00'}
                    </span>

                    <div className="w-9 h-9 rounded-full bg-white border border-slate-200 text-slate-700 flex items-center justify-center font-black text-xs uppercase shadow-2xs">
                      {customerName.charAt(0)}
                    </div>

                    <div className="min-w-0 pr-1">
                      <p className="text-xs font-extrabold text-slate-900 truncate leading-tight">
                        {customerName}
                      </p>
                      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-[10.5px] font-semibold text-slate-500 leading-tight">
                        <span className="truncate">{packageName}</span>
                        <span className="h-1 w-1 rounded-full bg-slate-300 shrink-0" />
                        <span className="truncate">KTV: {ktvName}</span>
                      </p>
                    </div>

                    <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border whitespace-nowrap ${statusClass}`}>
                      {statusLabel}
                    </span>

                    <button
                      className="w-7 h-7 rounded-full text-slate-400 hover:text-slate-700 hover:bg-white border border-transparent hover:border-slate-200 flex items-center justify-center transition-colors"
                      aria-label={`Mở tuỳ chọn lịch hẹn của ${customerName}`}
                    >
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
              {visibleSessions.length === 0 && (
                 <div className="p-4 text-center text-slate-400 text-xs italic">Không có lịch hẹn hôm nay</div>
              )}
            </div>
          </div>
        </div>

        {/* COL 2: BELLA AI COPILOT (BETA) (4 Cols) */}
        <div className="lg:col-span-4 bg-gradient-to-br from-[#F8F5FF] via-[#F3EEFE] to-[#EDE4FF] rounded-2xl p-5 border border-purple-100 shadow-xs flex flex-col justify-between relative overflow-hidden">
          {/* Subtle AI background decoration */}
          <div className="absolute -top-10 -right-10 w-40 h-40 bg-purple-200/30 rounded-full blur-2xl pointer-events-none" />

          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary text-primary-foreground flex items-center justify-center shadow-xs">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-purple-950 tracking-tight flex items-center gap-1.5">
                  Bella AI Copilot
                  <span className="bg-purple-200 text-purple-800 text-[10px] font-extrabold px-1.5 py-0.5 rounded-md uppercase">
                    BETA
                  </span>
                </h2>
              </div>
              <Link href="/dashboard/ai-copilot" className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1">
                Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <h3 className="text-lg font-bold text-slate-900 leading-snug mb-5">
              Phân tích hoạt động kinh doanh hôm nay.
            </h3>

            {/* AI Insights List */}
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-purple-100/80 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {alerts.filter(a => a.type === 'warning').length} thông báo cảnh báo cần xử lý
                </p>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl bg-white/80 border border-purple-100/80 shadow-2xs">
                <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
                  <Package className="w-4 h-4" />
                </div>
                <p className="text-xs font-bold text-slate-800">
                  {inventorySummary.lowStockCount} vật tư có nguy cơ hết hàng
                </p>
              </div>
            </div>
          </div>

          <Link
            href="/dashboard/ai-copilot"
            className="w-full py-3 px-4 bg-primary hover:bg-primary-hover text-primary-foreground rounded-xl text-xs font-bold tracking-wide transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span>Xem gợi ý & hành động</span>
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* COL 3: TÀI CHÍNH THÁNG (3 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">TÀI CHÍNH</h2>
              </div>
              <div className="flex items-center gap-1 bg-slate-100 px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-600 cursor-pointer">
                <span>Theo tháng</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 text-[11px] font-bold text-slate-500 mb-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500 inline-block" /> Doanh thu
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-rose-500 inline-block" /> Chi phí
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-xs bg-amber-500 inline-block" /> Lợi nhuận
              </span>
            </div>

            {/* Custom Bar Chart Illustration with Tooltip */}
            <div className="relative h-44 w-full pt-6 pb-2 flex items-end justify-between gap-1.5 border-b border-slate-100">
              {performanceData.length > 0 ? performanceData.map((bar, idx) => {
                const maxVal = Math.max(...performanceData.map(d => Math.max(d.revenue, d.expense, (d.revenue - d.expense) > 0 ? (d.revenue - d.expense) : 0)));
                const revPct = maxVal > 0 ? (bar.revenue / maxVal) * 100 : 0;
                const expPct = maxVal > 0 ? (bar.expense / maxVal) * 100 : 0;
                const profVal = bar.revenue - bar.expense;
                const profPct = maxVal > 0 ? (Math.max(0, profVal) / maxVal) * 100 : 0;
                
                return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1 h-full justify-end relative group">
                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-slate-900 text-white p-2 rounded-lg text-[10px] font-semibold shadow-lg z-10 w-28 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="text-slate-300 font-bold mb-0.5">{bar.name}</p>
                    <p className="flex items-center justify-between"><span className="text-emerald-400"> Doanh thu:</span> <span>{bar.revenue}M</span></p>
                    <p className="flex items-center justify-between"><span className="text-rose-400"> Chi phí:</span> <span>{bar.expense}M</span></p>
                    <p className="flex items-center justify-between"><span className="text-amber-400"> Lợi nhuận:</span> <span>{profVal.toFixed(1)}M</span></p>
                  </div>
                  <div className="w-full flex items-end justify-center gap-0.5 h-32">
                    <div style={{ height: `${revPct}%` }} className="w-2.5 bg-emerald-500 rounded-t-xs" />
                    <div style={{ height: `${expPct}%` }} className="w-2.5 bg-rose-500 rounded-t-xs" />
                    <div style={{ height: `${profPct}%` }} className="w-2.5 bg-amber-500 rounded-t-xs" />
                  </div>
                  <span className="text-[10px] font-semibold text-slate-400">{bar.name}</span>
                </div>
              )}) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-slate-400 italic">Chưa có dữ liệu</div>
              )}
            </div>

            {/* Bottom Breakdown Stats */}
            {(() => {
              const totalRev = performanceData.reduce((sum, d) => sum + d.revenue, 0);
              const totalExp = performanceData.reduce((sum, d) => sum + d.expense, 0);
              const totalProf = totalRev - totalExp;
              return (
                <div className="grid grid-cols-3 gap-2 pt-3">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Doanh thu</span>
                    <span className="text-sm font-black text-slate-900 block">{totalRev.toFixed(1)}M</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Chi phí</span>
                    <span className="text-sm font-black text-slate-900 block">{totalExp.toFixed(1)}M</span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 block uppercase">Lợi nhuận</span>
                    <span className="text-sm font-black text-slate-900 block">{totalProf.toFixed(1)}M</span>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ROW 1: 3 COLUMNS ────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* COL 1: HIỆU SUẤT KINH DOANH (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">HIỆU SUẤT KINH DOANH</h2>
              </div>
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-none">
              <button
                onClick={() => setActivePerfTab('revenue')}
                className={`px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap transition-colors ${
                  activePerfTab === 'revenue' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Doanh thu
              </button>
              <button
                onClick={() => setActivePerfTab('booking')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                  activePerfTab === 'booking' ? 'bg-primary text-primary-foreground' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Khách hàng
              </button>
            </div>

            {/* Dynamic SVG Line Chart */}
            {performanceData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-slate-400 text-xs italic">
                Chưa có dữ liệu hiệu suất
              </div>
            ) : (() => {
              const W = 300;
              const H = 100;
              const PAD_X = 4;
              const PAD_TOP = 12;
              const PAD_BOT = 4;
              const values = performanceData.map(d =>
                activePerfTab === 'revenue' ? d.revenue : d.customers
              );
              const maxVal = Math.max(...values, 1);
              const minVal = Math.min(...values, 0);
              const range = maxVal - minVal || 1;
              const toX = (i: number) => PAD_X + (i / Math.max(values.length - 1, 1)) * (W - PAD_X * 2);
              const toY = (v: number) => H - PAD_BOT - ((v - minVal) / range) * (H - PAD_TOP - PAD_BOT);
              const areaPath = `M${toX(0)},${toY(values[0])} ` +
                values.slice(1).map((v, i) => `L${toX(i + 1)},${toY(v)}`).join(' ') +
                ` L${toX(values.length - 1)},${H} L${toX(0)},${H} Z`;
              const linePath = `M${toX(0)},${toY(values[0])} ` +
                values.slice(1).map((v, i) => `L${toX(i + 1)},${toY(v)}`).join(' ');
              return (
                <PerfChart
                  W={W} H={H} areaPath={areaPath} linePath={linePath}
                  values={values} toX={toX} toY={toY}
                  performanceData={performanceData} activePerfTab={activePerfTab}
                />
              );
            })()}
          </div>
        </div>

        {/* COL 2: TOP KĨ THUẬT VIÊN (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">TOP KỸ THUẬT VIÊN</h2>
              </div>
              <Link href="/dashboard/hr" className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1">
                Xem tất cả <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* Table */}
            <div className="w-full text-left">
              <div className="grid grid-cols-12 text-[10px] font-bold text-slate-400 uppercase border-b border-slate-100 pb-2 mb-2">
                <span className="col-span-1">#</span>
                <span className="col-span-5">KỸ THUẬT VIÊN</span>
                <span className="col-span-2 text-center">BUỔI</span>
                <span className="col-span-2 text-right">THƯỞNG</span>
                <span className="col-span-2 text-right">RATING</span>
              </div>

              <div className="space-y-2.5">
                {topKTVs.slice(0, 5).map((ktv, i) => (
                  <div key={i} className="grid grid-cols-12 items-center text-xs py-1 hover:bg-slate-50 rounded-lg transition-colors">
                    <span className="col-span-1 font-bold text-slate-500">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                    </span>
                    <div className="col-span-5 flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center shrink-0 uppercase">
                        {ktv.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900 truncate">{ktv.name}</span>
                    </div>
                    <span className="col-span-2 text-center font-bold text-slate-600">{ktv.sessions}</span>
                    <span className="col-span-2 text-right font-bold text-slate-900">{ktv.bonus}</span>
                    <span className="col-span-2 text-right font-bold text-amber-600 flex items-center justify-end gap-0.5">
                      ⭐ {ktv.rating}
                    </span>
                  </div>
                ))}
                {topKTVs.length === 0 && (
                  <div className="py-4 text-center text-slate-400 text-xs italic">Chưa có dữ liệu KTV</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* COL 3: ĐÁNH GIÁ KHÁCH HÀNG (4 Cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-500 flex items-center justify-center">
                  <Star className="w-4 h-4 fill-amber-400" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">ĐÁNH GIÁ KHÁCH HÀNG</h2>
              </div>
              <Link href="/dashboard/crm" className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1">
                Xem chi tiết <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="flex items-center gap-4 my-4">
              <div className="text-center">
                <div className="text-4xl font-black text-slate-900">{stats.find(s => s.iconName === 'Star')?.value || '4.8'}</div>
                <div className="text-xs text-slate-400 font-semibold mt-0.5">/ 5</div>
                <div className="flex items-center justify-center gap-0.5 mt-1">
                  {[1,2,3,4,5].map(n => <Star key={n} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {[[5, 82], [4, 12], [3, 4], [2, 1], [1, 1]].map(([star, pct]) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-500 w-4 text-right shrink-0">{star}</span>
                    <Star className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                    <div className="flex-1 bg-slate-100 rounded-full h-1.5">
                      <div
                        className="bg-amber-400 h-1.5 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 w-6 text-right shrink-0">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── BOTTOM ROW 2: 2 WIDE CARDS ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* CARD 1: CẦN XỬ LÝ NGAY (8) (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">
                  CẦN XỬ LÝ NGAY <span className="text-slate-400 font-semibold text-sm">({alerts.length})</span>
                </h2>
              </div>
            </div>

            {/* Action Badges/Tabs */}
            <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-1 scrollbar-none">
              {[
                { type: 'warning', emoji: '🚨', label: alerts.filter(a => a.type === 'warning').length + ' Buổi liệu trình quá hạn', className: 'bg-rose-50 text-rose-700 border-rose-200' },
                { type: 'info', emoji: '📋', label: alerts.filter(a => a.type === 'info').length + ' Công nợ cần đối soát', className: 'bg-amber-50 text-amber-700 border-amber-200' },
                { type: 'danger', emoji: '⚠️', label: alerts.filter(a => a.type === 'danger').length + ' Vật tư sắp hết', className: 'bg-orange-50 text-orange-700 border-orange-200' },
                { type: 'success', emoji: '💬', label: alerts.filter(a => a.type === 'success').length + ' Phản hồi khách hàng', className: 'bg-blue-50 text-blue-700 border-blue-200' },
              ].filter(t => parseInt(t.label) > 0).map((t, i) => (
                <button
                  key={i}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold cursor-pointer whitespace-nowrap border ${t.className}`}
                >
                  {t.emoji} <span>{t.label}</span>
                </button>
              ))}
              {alerts.length === 0 && (
                <span className="text-xs text-slate-400 italic">Không có cảnh báo</span>
              )}
            </div>

            {/* Horizontal Urgent Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {alerts.slice(0, 3).map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-slate-100/80 transition-colors flex flex-col justify-between space-y-3"
                >
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 line-clamp-1">{item.title}</h4>
                    <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{item.message}</p>
                    {item.timestamp && (
                      <p className="text-[10px] text-slate-400 mt-2">{new Date(item.timestamp).toLocaleDateString('vi-VN')}</p>
                    )}
                  </div>

                  <Link href={item.link || '#'} className="w-full py-1.5 px-3 bg-white border border-slate-200 text-slate-700 hover:text-primary hover:border-primary/40 rounded-lg text-[11px] font-bold transition-colors cursor-pointer text-center inline-block">
                    Xem & xử lý
                  </Link>
                </div>
              ))}
              {alerts.length === 0 && (
                <div className="col-span-3 py-4 text-center text-slate-400 text-xs italic">Không có việc cần xử lý gấp</div>
              )}
            </div>
          </div>
        </div>

        {/* CARD 2: VẬT TƯ & TỒN KHO (5 Cols) */}
        <div className="lg:col-span-5 bg-white rounded-2xl p-5 border border-slate-100 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <h2 className="text-base font-bold text-slate-900 tracking-tight">VẬT TƯ & TỒN KHO</h2>
              </div>
              <Link href="/dashboard/inventory" className="text-xs font-bold text-primary hover:opacity-80 flex items-center gap-1">
                Quản lý kho <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            {/* 3 Stat Boxes Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              {/* Box 1: Low stock */}
              <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-100 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-rose-600">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>MẶT HÀNG SẮP HẾT</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-rose-900 block">{inventorySummary.lowStockCount}</span>
                  <span className="text-[11px] font-medium text-rose-700">sản phẩm</span>
                </div>
              </div>

              {/* Box 2: Total Items */}
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <Package className="w-3.5 h-3.5" />
                  <span>TỔNG MẶT HÀNG</span>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-black text-slate-900 dark:text-white block">{inventorySummary.totalItems}</span>
                  <span className="text-[11px] font-medium text-primary">loại</span>
                </div>
              </div>

              {/* Box 3: Total Stock Value */}
              <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 flex flex-col justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <TrendingUp className="w-3.5 h-3.5" />
                  <span>GIÁ TRỊ TỒN KHO</span>
                </div>
                <div className="mt-3">
                  <span className="text-xl font-black text-slate-900 dark:text-white block">{(inventorySummary.totalValue / 1000000).toFixed(1)}M</span>
                  <span className="text-[11px] font-medium text-primary">VNĐ</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Spacer to guarantee scroll clearance at the bottom of the viewport */}
      <div className="h-24 md:h-32 w-full shrink-0" />
    </div>
  );
}
