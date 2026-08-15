/**
 * Premium Finance Chart Components
 * 
 * Crafted to match the premium, custom-designed aesthetic of the Real Estate vertical.
 * Uses a combination of custom HTML/CSS grids, SVG graphics, and highly-styled
 * Recharts layouts to achieve high-fidelity transitions, shadows, and clean layouts.
 */

'use client';

import React, { useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend, ReferenceLine,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import { BarChart3, PieChart as PieIcon, LineChart as LineIcon, TrendingUp, DollarSign } from 'lucide-react';

// ─── Format helper ────────────────────────────────────────────────────────────

const formatVND = (v: number) => {
  if (v >= 1_000_000_000) {
    return (v / 1_000_000_000).toFixed(1) + ' Tỷ';
  }
  if (v >= 1_000_000) {
    return (v / 1_000_000).toFixed(0) + ' Tr';
  }
  return new Intl.NumberFormat('vi-VN').format(v) + 'đ';
};

const formatVNDFull = (v: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(v);

// ─── Custom Active Dot for Line/Area Charts ────────────────────────────────────

const PremiumActiveDot = (props: { cx?: number; cy?: number; stroke?: string; [key: string]: unknown }) => {
  const { cx, cy, stroke } = props;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={stroke} opacity={0.15} className="transition-all duration-300" />
      <circle cx={cx} cy={cy} r={5} fill={stroke} stroke="#ffffff" strokeWidth={1.5} />
    </g>
  );
};

// ─── Floating Glassmorphism Tooltip ───────────────────────────────────────────

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
  fill?: string;
}

function PremiumVNDTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-slate-200/60 dark:border-slate-800/80 rounded-2xl shadow-xl p-4 text-xs min-w-[190px] transition-all duration-350 transform scale-100 hover:scale-102">
      <p className="font-extrabold text-slate-850 dark:text-slate-200 mb-2 border-b border-slate-100/70 dark:border-slate-800/70 pb-1.5 font-sans tracking-wide">
        📅 {label}
      </p>
      <div className="space-y-2">
        {payload.map((p, idx) => (
          <div key={idx} className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                style={{ backgroundColor: p.color || p.fill }}
              />
              <span className="text-slate-650 dark:text-slate-400 font-bold">{p.name}</span>
            </div>
            <span className="font-mono font-black text-slate-900 dark:text-slate-100">
              {formatVNDFull(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Fallback Component ────────────────────────────────────────────────────────

function ChartPlaceholder({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50/50 dark:bg-slate-950/10 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800">
      <div className="text-center">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm inline-block border border-slate-100 dark:border-slate-800 mb-2.5">
          <Icon className="h-6 w-6 text-slate-450 dark:text-slate-550" />
        </div>
        <p className="text-[10px] font-black text-slate-500 dark:text-slate-455 tracking-widest uppercase">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Dữ liệu đang được kết xuất...</p>
      </div>
    </div>
  );
}

// ─── 1. Cash Flow Analysis Chart (Interactive HTML Bar Chart) ──────────────────

export type CashFlowBreakdownItem = {
  paymentMethod: string;
  inflows: number;
  outflows: number;
};

export function CashFlowAnalysisChart({
  data,
  height,
}: {
  data: CashFlowBreakdownItem[];
  height: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Phân Tích Dòng Tiền" icon={BarChart3} /></div>;
  }

  // Find max value to determine heights proportionally
  const maxVal = Math.max(...data.flatMap(d => [d.inflows, d.outflows]), 1000000);

  return (
    <div style={{ height }} className="flex flex-col justify-between font-sans relative pt-6 select-none">
      {/* Chart Plot Area */}
      <div className="relative flex-1 flex items-end justify-around gap-6 sm:gap-10 px-6 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
          <div className="border-b border-slate-100/60 dark:border-slate-800/40 w-full h-0" />
          <div className="border-b border-slate-100/60 dark:border-slate-800/40 w-full h-0" />
          <div className="border-b border-slate-100/60 dark:border-slate-800/40 w-full h-0" />
          <div className="w-full h-0" />
        </div>

        {data.map((item, idx) => {
          const inflowPct = (item.inflows / maxVal) * 100;
          const outflowPct = (item.outflows / maxVal) * 100;
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group relative z-10"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Premium Floating Value Tooltip on Hover */}
              <div
                className={`absolute bottom-full mb-3 bg-slate-900/95 dark:bg-slate-950/95 text-white text-[10px] rounded-2xl p-3 shadow-xl z-20 pointer-events-none transition-all duration-300 transform ${
                  isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
                } flex flex-col gap-1 border border-slate-800`}
              >
                <span className="font-extrabold text-slate-400 tracking-wider uppercase block">{item.paymentMethod}</span>
                <span className="text-emerald-400 font-black block">Vào: {formatVNDFull(item.inflows)}</span>
                <span className="text-rose-400 font-black block">Ra: {formatVNDFull(item.outflows)}</span>
              </div>

              {/* Group of Bars with Custom Gradients & Glow */}
              <div className="w-full flex items-end justify-center gap-2.5 h-full max-h-[82%]">
                {/* Inflow Bar */}
                <div
                  className="w-7 sm:w-10 bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 rounded-t-xl transition-all duration-500 hover:brightness-105 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/30 group-hover:scale-[1.02]"
                  style={{ height: `${inflowPct}%` }}
                />
                {/* Outflow Bar */}
                <div
                  className="w-7 sm:w-10 bg-gradient-to-t from-rose-600 via-rose-500 to-orange-400 rounded-t-xl transition-all duration-500 hover:brightness-105 shadow-md shadow-rose-500/10 hover:shadow-rose-500/30 group-hover:scale-[1.02]"
                  style={{ height: `${outflowPct}%` }}
                />
              </div>

              {/* X-Axis Label */}
              <span className="text-xs font-black text-slate-700 dark:text-slate-350 mt-3 tracking-wide">{item.paymentMethod}</span>
            </div>
          );
        })}
      </div>

      {/* Legend Block */}
      <div className="flex justify-center gap-8 pt-4 text-[10px] font-black tracking-widest text-slate-500 uppercase">
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-400 shadow-md shadow-emerald-500/30" />
          Dòng Tiền Vào
        </span>
        <span className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-gradient-to-r from-rose-500 to-orange-400 shadow-md shadow-rose-500/30" />
          Dòng Tiền Ra
        </span>
      </div>
    </div>
  );
}

// ─── 2. Burn Rate Chart (Radial + Projection Bars Combo) ──────────────────────

export type BurnRateData = {
  monthlyBurnRate: number;
  runwayMonths: number;
  currentCash: number;
  averageDailyCashFlow: number;
};

export function BurnRateChart({ data, height }: { data: BurnRateData | null; height: number }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data) {
    return <div style={{ height }}><ChartPlaceholder title="Tốc Độ Đốt Tiền & Runway" icon={TrendingUp} /></div>;
  }

  const { monthlyBurnRate, runwayMonths, currentCash, averageDailyCashFlow } = data;

  // Generate Runway Projection values (7 months: Current + 6 forward)
  const projectionSteps = Array.from({ length: 7 }, (_, i) => {
    const cashLeft = Math.max(0, currentCash - monthlyBurnRate * i);
    const pct = currentCash > 0 ? (cashLeft / currentCash) * 100 : 0;
    return {
      label: i === 0 ? 'Hiện tại' : `T+${i}`,
      cash: cashLeft,
      pct,
    };
  });

  const runwayStatus =
    runwayMonths >= 12 ? { color: 'text-emerald-500 border-emerald-200/70 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/60', iconColor: 'bg-emerald-500', label: 'AN TOÀN TÀI CHÍNH', desc: 'Dự phòng tiền mặt dồi dào (>12 tháng)' } :
    runwayMonths >= 6  ? { color: 'text-amber-500 border-amber-200/70 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900/60', iconColor: 'bg-amber-500', label: 'CẦN THEO DÕI', desc: 'Nên lập thêm phương án dự phòng' } :
    { color: 'text-rose-500 border-rose-200/70 bg-rose-50/50 dark:bg-rose-950/20 dark:border-rose-900/60', iconColor: 'bg-rose-500', label: 'CẢNH BÁO NGUY HIỂM', desc: 'Dòng tiền cạn kiệt, cần tối ưu chi phí ngay!' };

  return (
    <div style={{ height }} className="flex flex-col justify-between font-sans select-none pt-2">
      {/* 4 Premium KPIs Matrix */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:shadow-slate-100/20">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Burn Rate / Tháng</span>
          <span className="text-base font-black text-rose-500 font-mono mt-1 block">{formatVND(monthlyBurnRate)}</span>
        </div>
        <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:shadow-slate-100/20">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Runway Dự Báo</span>
          <span className="text-base font-black text-indigo-600 dark:text-indigo-400 font-mono mt-1 block">{runwayMonths} Tháng</span>
        </div>
        <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:shadow-slate-100/20">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Tiền Mặt Khả Dụng</span>
          <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-1 block">{formatVND(currentCash)}</span>
        </div>
        <div className="bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/80 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-md hover:shadow-slate-100/20">
          <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest block">Dòng Tiền / Ngày</span>
          <span className="text-base font-black text-emerald-500 font-mono mt-1 block">{formatVND(averageDailyCashFlow)}</span>
        </div>
      </div>

      {/* Runway Alert Badge */}
      <div className={`border rounded-2xl p-3 flex items-center gap-3 ${runwayStatus.color} shadow-sm`}>
        <span className={`w-2.5 h-2.5 rounded-full ${runwayStatus.iconColor} animate-pulse shrink-0`} />
        <div>
          <p className="text-[10px] font-black tracking-wider leading-none">{runwayStatus.label}</p>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium mt-1 leading-tight">{runwayStatus.desc}</p>
        </div>
      </div>

      {/* Interactive Burndown Projection Bars */}
      <div className="flex items-end justify-between gap-1 px-1 pt-4 pb-1 border-t border-slate-100 dark:border-slate-850 mt-auto">
        {projectionSteps.map((step, i) => {
          const barColor =
            step.pct > 60 ? 'from-emerald-500 via-emerald-450 to-teal-400 shadow-emerald-500/10' :
            step.pct > 30 ? 'from-amber-500 via-amber-450 to-yellow-400 shadow-amber-500/10' :
            'from-rose-500 via-rose-450 to-orange-400 shadow-rose-500/10';

          const isHovered = hoveredIdx === i;

          return (
            <div
              key={i}
              className="flex-1 flex flex-col items-center justify-end group relative z-10"
              onMouseEnter={() => setHoveredIdx(i)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Month Cash Tooltip */}
              <div
                className={`absolute bottom-full mb-2 bg-slate-900 text-white text-[9px] font-black rounded-xl px-2 py-1 shadow-lg pointer-events-none transition-all duration-200 transform ${
                  isHovered ? 'opacity-100 scale-100 -translate-y-0' : 'opacity-0 scale-95 translate-y-1'
                } whitespace-nowrap z-20`}
              >
                {formatVNDFull(step.cash)}
              </div>

              {/* Vertical progress column - Fixed height and thin pill shape */}
              <div className="w-2.5 sm:w-3.5 h-16 bg-slate-100/80 dark:bg-slate-800 rounded-t-full relative overflow-hidden border border-slate-200/10">
                <div
                  className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t ${barColor} rounded-t-full transition-all duration-1000 group-hover:brightness-105`}
                  style={{ height: `${step.pct}%` }}
                />
              </div>

              {/* Month label */}
              <span className="text-[9px] font-black text-slate-500 mt-2 truncate w-full text-center tracking-wide block">{step.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 3. Cash Flow Forecast Chart (Premium Styled Recharts Area) ────────────────

export type ForecastItem = {
  month: string;
  actual?: number;
  forecast?: number;
  upper?: number;
  lower?: number;
};

export function CashFlowForecastChart({ data, height }: { data: ForecastItem[]; height: number }) {
  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Dự Báo Dòng Tiền" icon={LineIcon} /></div>;
  }

  const splitItem = data.find(d => d.actual !== undefined && d.forecast !== undefined);

  return (
    <div style={{ height }} className="relative pt-6">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#6366f1" stopOpacity={0.2} />
              <stop offset="100%" stopColor="#6366f1" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="6 6" stroke="#e2e8f0" vertical={false} opacity={0.6} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatVND}
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            width={65}
            dx={-8}
          />
          <Tooltip
            content={<PremiumVNDTooltip />}
            cursor={{ stroke: '#94a3b8', strokeWidth: 1.5, strokeDasharray: '4 4' }}
          />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingBottom: 16, fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}
          />
          {/* Confidence interval area */}
          <Area
            type="monotone"
            dataKey="upper"
            name="Dải biên trên"
            stroke="transparent"
            fill="#6366f1"
            fillOpacity={0.05}
            legendType="none"
          />
          <Area
            type="monotone"
            dataKey="lower"
            name="Dải biên dưới"
            stroke="transparent"
            fill="#ffffff"
            fillOpacity={1}
            legendType="none"
          />
          {/* Actual curves */}
          <Area
            type="monotone"
            dataKey="actual"
            name="Thực tế thu"
            stroke="#0ea5e9"
            strokeWidth={3.5}
            fill="url(#actualGrad)"
            dot={false}
            activeDot={<PremiumActiveDot />}
          />
          {/* Forecast curves */}
          <Area
            type="monotone"
            dataKey="forecast"
            name="Dự báo"
            stroke="#6366f1"
            strokeWidth={3.5}
            strokeDasharray="6 4"
            fill="url(#forecastGrad)"
            dot={false}
            activeDot={<PremiumActiveDot />}
          />
          {splitItem && (
            <ReferenceLine
              x={splitItem.month}
              stroke="#64748b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'ĐIỂM DỰ BÁO',
                position: 'top',
                fill: '#475569',
                fontSize: 10,
                fontWeight: 900,
                letterSpacing: '0.1em'
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 4. Revenue Breakdown Chart (Thin Ring Pie + Grid Details) ─────────────────

export type RevenueBreakdownItem = {
  source: string;
  revenue: number;
  percentage: number;
};

const PIE_GRADIENTS = [
  { start: '#6366f1', end: '#818cf8', glow: 'rgba(99, 102, 241, 0.15)' }, // Indigo
  { start: '#10b981', end: '#34d399', glow: 'rgba(16, 185, 129, 0.15)' }, // Emerald
  { start: '#f59e0b', end: '#fbbf24', glow: 'rgba(245, 158, 11, 0.15)' }, // Amber
  { start: '#3b82f6', end: '#60a5fa', glow: 'rgba(59, 130, 246, 0.15)' }, // Blue
];

export function RevenueBreakdownChart({ data, height }: { data: RevenueBreakdownItem[]; height: number }) {
  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Phân Bổ Theo Phương Thức" icon={PieIcon} /></div>;
  }

  // Calculate total revenue dynamically
  const totalRev = data.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div style={{ height }} className="flex flex-col justify-between font-sans select-none relative pt-2">
      {/* Circular Donut Diagram */}
      <div className="flex-1 min-h-[140px] relative flex items-center justify-center">
        {/* Total Overlay inside Donut */}
        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none z-10">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tổng Thực Thu</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono mt-1 leading-none">
            {formatVND(totalRev)}
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((_, i) => {
                const colors = PIE_GRADIENTS[i % PIE_GRADIENTS.length];
                return (
                  <linearGradient id={`pieGradCustom-${i}`} key={i} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={colors.end} />
                    <stop offset="100%" stopColor={colors.start} />
                  </linearGradient>
                );
              })}
            </defs>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="source"
              cx="50%"
              cy="50%"
              innerRadius="66%"
              outerRadius="86%"
              cornerRadius={8}
              paddingAngle={3}
              label={false}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#pieGradCustom-${i})`}
                  style={{
                    filter: `drop-shadow(0 6px 10px ${PIE_GRADIENTS[i % PIE_GRADIENTS.length].glow})`,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<PremiumVNDTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Grid Legend List with Details */}
      <div className="grid grid-cols-2 gap-2.5 pt-4 pb-2 border-t border-slate-100 dark:border-slate-800">
        {data.map((item, i) => {
          const colorSet = PIE_GRADIENTS[i % PIE_GRADIENTS.length];
          return (
            <div
              key={i}
              className="flex justify-between items-center text-xs p-2.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100/60 dark:border-slate-800/80 transition-all duration-300 hover:bg-slate-100/50"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${colorSet.end}, ${colorSet.start})` }}
                />
                <span className="text-slate-700 dark:text-slate-300 font-extrabold truncate tracking-wide">
                  {item.source}
                </span>
              </div>
              <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-[11px] flex-shrink-0 ml-2">
                {item.percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. Profitability Trend Chart (Interactive HTML Multi-Bar Chart) ──────────

export interface PnLStatementChartData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

export function PnLStatementChart({
  data,
  height,
}: {
  data: PnLStatementChartData;
  height: number;
}) {
  if (!data) {
    return <div style={{ height }}><ChartPlaceholder title="Báo Cáo P&L" icon={BarChart3} /></div>;
  }

  const chartData = [
    {
      name: 'Doanh thu',
      value: data.totalRevenue,
      fill: 'url(#pnlRevenueGrad)',
    },
    {
      name: 'Chi phí',
      value: data.totalExpenses,
      fill: 'url(#pnlExpenseGrad)',
    },
    {
      name: 'Lợi nhuận',
      value: data.netProfit,
      fill: data.netProfit >= 0 ? 'url(#pnlProfitGrad)' : 'url(#pnlLossGrad)',
    },
  ];

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 5 }}>
          <defs>
            <linearGradient id="pnlRevenueGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#34d399" />
              <stop offset="100%" stopColor="#10b981" />
            </linearGradient>
            <linearGradient id="pnlExpenseGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f87171" />
              <stop offset="100%" stopColor="#ef4444" />
            </linearGradient>
            <linearGradient id="pnlProfitGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#60a5fa" />
              <stop offset="100%" stopColor="#3b82f6" />
            </linearGradient>
            <linearGradient id="pnlLossGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fbbf24" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="6 6" stroke="#e2e8f0" vertical={false} opacity={0.6} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 800, fill: '#475569' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatVND}
            tick={{ fontSize: 10, fontWeight: 700, fill: '#94a3b8' }}
            width={70}
          />
          <Tooltip
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={(value: any) => [formatVNDFull(Number(value)), 'Số tiền'] as any}
            contentStyle={{
              backgroundColor: 'rgba(255, 255, 255, 0.95)',
              borderRadius: '16px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)',
            }}
          />
          <Bar
            dataKey="value"
            radius={[8, 8, 0, 0]}
            maxBarSize={60}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export type ExpenseBreakdownItem = {
  category: string;
  expense: number;
  percentage: number;
};

export function ExpenseBreakdownChart({
  data,
  height,
}: {
  data: ExpenseBreakdownItem[];
  height: number;
}) {
  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Phân Bổ Chi Phí" icon={PieIcon} /></div>;
  }

  const totalExpense = data.reduce((sum, item) => sum + item.expense, 0);

  return (
    <div style={{ height }} className="flex flex-col justify-between font-sans select-none relative pt-2">
      {/* Circular Donut Diagram */}
      <div className="flex-1 min-h-[140px] relative flex items-center justify-center">
        <div className="absolute flex flex-col items-center justify-center text-center pointer-events-none z-10">
          <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tổng Chi Phí</span>
          <span className="text-xl font-black text-slate-900 dark:text-slate-100 font-mono mt-1 leading-none">
            {formatVND(totalExpense)}
          </span>
        </div>

        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((_, i) => {
                const colors = PIE_GRADIENTS[(i + 1) % PIE_GRADIENTS.length];
                return (
                  <linearGradient id={`pieGradCustomExp-${i}`} key={i} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={colors.end} />
                    <stop offset="100%" stopColor={colors.start} />
                  </linearGradient>
                );
              })}
            </defs>
            <Pie
              data={data}
              dataKey="expense"
              nameKey="category"
              cx="50%"
              cy="50%"
              innerRadius="66%"
              outerRadius="86%"
              cornerRadius={8}
              paddingAngle={3}
              label={false}
            >
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={`url(#pieGradCustomExp-${i})`}
                  style={{
                    filter: `drop-shadow(0 6px 10px ${PIE_GRADIENTS[(i + 1) % PIE_GRADIENTS.length].glow})`,
                    cursor: 'pointer',
                  }}
                />
              ))}
            </Pie>
            <Tooltip content={<PremiumVNDTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Grid Legend List with Details */}
      <div className="grid grid-cols-2 gap-2.5 pt-4 pb-2 border-t border-slate-100 dark:border-slate-800">
        {data.map((item, i) => {
          const colorSet = PIE_GRADIENTS[(i + 1) % PIE_GRADIENTS.length];
          return (
            <div
              key={i}
              className="flex justify-between items-center text-xs p-2.5 bg-slate-50/50 dark:bg-slate-900/40 rounded-2xl border border-slate-100/60 dark:border-slate-800/80 transition-all duration-300 hover:bg-slate-100/50"
            >
              <div className="flex items-center gap-2 truncate">
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${colorSet.end}, ${colorSet.start})` }}
                />
                <span className="text-slate-700 dark:text-slate-350 font-extrabold truncate tracking-wide">
                  {item.category}
                </span>
              </div>
              <span className="font-mono font-black text-slate-800 dark:text-slate-100 text-[11px] flex-shrink-0 ml-2">
                {item.percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ProfitabilityTrendChart({
  data,
  height,
}: {
  data: Array<{ date: string; revenue: number; expenses: number; profit: number }>;
  height: number;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Xu Hướng Lợi Nhuận" icon={LineIcon} /></div>;
  }

  // Find maximum value to determine column scaling
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expenses, Math.abs(d.profit)]), 1000000);

  return (
    <div style={{ height }} className="flex flex-col justify-between font-sans relative pt-6 select-none">
      {/* Chart Plot Area */}
      <div className="relative flex-1 flex items-end justify-around gap-4 px-4 pb-2 border-b border-slate-100 dark:border-slate-800/80">
        
        {/* Horizontal grid lines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none pb-8 pt-4">
          <div className="border-b border-slate-100/60 dark:border-slate-800/40 w-full h-0" />
          <div className="border-b border-slate-100/60 dark:border-slate-800/40 w-full h-0" />
          <div className="border-b border-slate-100/60 dark:border-slate-800/40 w-full h-0" />
          <div className="w-full h-0" />
        </div>

        {data.map((item, idx) => {
          const revPct = (item.revenue / maxVal) * 100;
          const expPct = (item.expenses / maxVal) * 100;
          const profPct = (Math.abs(item.profit) / maxVal) * 100;
          const isProfit = item.profit >= 0;
          const isHovered = hoveredIdx === idx;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center h-full justify-end group relative z-10"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
            >
              {/* Premium Hover Floating Tooltip */}
              <div
                className={`absolute bottom-full mb-3 bg-slate-900/95 dark:bg-slate-950/95 text-white text-[10px] rounded-2xl p-3.5 shadow-2xl z-20 pointer-events-none transition-all duration-300 transform ${
                  isHovered ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-1 scale-95'
                } flex flex-col gap-1 border border-slate-800 min-w-[150px]`}
              >
                <span className="font-extrabold text-slate-400 tracking-wider uppercase block">{item.date}</span>
                <span className="text-emerald-400 font-black block">Doanh thu: {formatVNDFull(item.revenue)}</span>
                <span className="text-rose-400 font-black block">Chi phí: {formatVNDFull(item.expenses)}</span>
                <span className={`${isProfit ? 'text-blue-400' : 'text-orange-400'} font-black block`}>
                  Lợi nhuận: {formatVNDFull(item.profit)}
                </span>
              </div>

              {/* 3 Grouped Bars: Revenue, Expense, Profit */}
              <div className="w-full flex items-end justify-center gap-1 h-full max-h-[82%]">
                {/* Revenue Bar */}
                <div
                  className="flex-1 bg-gradient-to-t from-emerald-600 via-emerald-500 to-teal-400 rounded-t-md transition-all duration-500 hover:brightness-105 shadow-md shadow-emerald-500/10"
                  style={{ height: `${revPct}%` }}
                />
                {/* Expense Bar */}
                <div
                  className="flex-1 bg-gradient-to-t from-rose-600 via-rose-500 to-orange-400 rounded-t-md transition-all duration-500 hover:brightness-105 shadow-md shadow-rose-500/10"
                  style={{ height: `${expPct}%` }}
                />
                {/* Profit Bar */}
                <div
                  className={`flex-1 bg-gradient-to-t rounded-t-md transition-all duration-500 hover:brightness-105 shadow-md ${
                    isProfit
                      ? 'from-blue-600 via-blue-500 to-sky-400 shadow-blue-500/10'
                      : 'from-orange-600 via-orange-500 to-yellow-400 shadow-orange-500/10'
                  }`}
                  style={{ height: `${profPct}%` }}
                />
              </div>

              {/* X-Axis Label */}
              <span className="text-xs font-black text-slate-700 dark:text-slate-350 mt-3 tracking-wide">{item.date}</span>
            </div>
          );
        })}
      </div>

      {/* Legend Block */}
      <div className="flex justify-center flex-wrap gap-x-6 gap-y-2 pt-4 text-[10px] font-black tracking-widest text-slate-500 uppercase">
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-emerald-500 to-teal-400" />
          Doanh thu
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-rose-500 to-orange-400" />
          Chi phí
        </span>
        <span className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-blue-500 to-sky-400" />
          Lợi nhuận
        </span>
      </div>
    </div>
  );
}

// ─── Budget Charts ────────────────────────────────────────────────────────────

export function BudgetVarianceChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Phân Tích Chênh Lệch Ngân Sách" icon={BarChart3} /></div>;
}

export function BudgetUtilizationChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Hiệu Suất Sử Dụng Ngân Sách" icon={PieIcon} /></div>;
}

export function VarianceTrendChart({ data: _data, categories: _categories, height }: { data: unknown; categories: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Xu Hướng Biến Động Ngân Sách" icon={LineIcon} /></div>;
}

export function BudgetStatusChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Trạng Thái Hạn Mức Ngân Sách" icon={PieIcon} /></div>;
}
