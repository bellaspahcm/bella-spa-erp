/**
 * Premium Finance Chart Components
 *
 * Highly stylized and polished implementations using Recharts,
 * matching the premium aesthetic of the Real Estate module:
 * - Linear gradients and glow effects.
 * - Glassmorphism custom tooltips.
 * - Harmonious modern color palettes (Indigo, Emerald, Rose, Amber, Blue).
 * - Smooth curves and rounded bar charts.
 */

'use client';

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  type PieLabelRenderProps,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, LineChart as LineIcon, TrendingUp } from 'lucide-react';

// ─── Color & Styling Constants ────────────────────────────────────────────────

const formatVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(v) + 'đ';

const COLORS = {
  inflow: {
    start: '#10b981', // Emerald 500
    end: '#34d399',   // Emerald 400
    glow: 'rgba(16, 185, 129, 0.25)',
  },
  outflow: {
    start: '#f43f5e', // Rose 500
    end: '#fb7185',   // Rose 400
    glow: 'rgba(244, 63, 94, 0.25)',
  },
  forecast: {
    start: '#6366f1', // Indigo 500
    end: '#818cf8',   // Indigo 400
    glow: 'rgba(99, 102, 241, 0.25)',
  },
  actual: {
    start: '#0ea5e9', // Sky 500
    end: '#38bdf8',   // Sky 400
    glow: 'rgba(14, 165, 233, 0.25)',
  },
  pie: [
    { start: '#6366f1', end: '#818cf8' }, // Indigo
    { start: '#10b981', end: '#34d399' }, // Emerald
    { start: '#f59e0b', end: '#fbbf24' }, // Amber
    { start: '#3b82f6', end: '#60a5fa' }, // Blue
    { start: '#8b5cf6', end: '#a78bfa' }, // Violet
    { start: '#14b8a6', end: '#2dd4bf' }, // Teal
  ]
};

// ─── Custom Premium Tooltip ───────────────────────────────────────────────────

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
    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xl p-4 text-xs min-w-[180px] transition-all duration-300">
      <p className="font-extrabold text-slate-850 dark:text-slate-200 mb-2 border-b border-slate-100 dark:border-slate-800 pb-1.5 font-sans tracking-wide">
        {label}
      </p>
      <div className="space-y-1.5">
        {payload.map((p, idx) => (
          <div key={idx} className="flex justify-between items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-full inline-block shadow-sm"
                style={{ backgroundColor: p.color || p.fill }}
              />
              <span className="text-slate-600 dark:text-slate-400 font-medium">{p.name}</span>
            </div>
            <span className="font-mono font-black text-slate-900 dark:text-slate-100">
              {formatVND(p.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Fallback when empty
function ChartPlaceholder({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50/50 dark:bg-slate-950/20 rounded-2xl border border-dashed border-slate-250 dark:border-slate-800 transition-all duration-300">
      <div className="text-center">
        <div className="p-3 bg-white dark:bg-slate-900 rounded-2xl shadow-sm inline-block border border-slate-100 dark:border-slate-800 mb-3">
          <Icon className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        </div>
        <p className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide uppercase">{title}</p>
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">Dữ liệu chưa sẵn sàng hoặc rỗng</p>
      </div>
    </div>
  );
}

// ─── 1. Cash Flow Analysis Chart ──────────────────────────────────────────────

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
  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Phân Tích Dòng Tiền" icon={BarChart3} /></div>;
  }

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="inflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.inflow.end} />
              <stop offset="100%" stopColor={COLORS.inflow.start} />
            </linearGradient>
            <linearGradient id="outflowGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.outflow.end} />
              <stop offset="100%" stopColor={COLORS.outflow.start} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="paymentMethod"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fontWeight: 700, fill: '#475569' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatVND}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
            width={70}
          />
          <Tooltip content={<PremiumVNDTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.8 }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 700 }}
          />
          <Bar
            dataKey="inflows"
            name="Dòng tiền vào"
            fill="url(#inflowGrad)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            style={{ filter: `drop-shadow(0 4px 6px ${COLORS.inflow.glow})` }}
          />
          <Bar
            dataKey="outflows"
            name="Dòng tiền ra"
            fill="url(#outflowGrad)"
            radius={[6, 6, 0, 0]}
            maxBarSize={36}
            style={{ filter: `drop-shadow(0 4px 6px ${COLORS.outflow.glow})` }}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 2. Burn Rate Chart ───────────────────────────────────────────────────────

export type BurnRateData = {
  monthlyBurnRate: number;
  runwayMonths: number;
  currentCash: number;
  averageDailyCashFlow: number;
};

export function BurnRateChart({ data, height }: { data: BurnRateData | null; height: number }) {
  if (!data) {
    return <div style={{ height }}><ChartPlaceholder title="Tốc Độ Đốt Tiền & Runway" icon={TrendingUp} /></div>;
  }

  const { monthlyBurnRate, runwayMonths, currentCash, averageDailyCashFlow } = data;

  // Generate Runway Projection values
  const chartData = Array.from({ length: 7 }, (_, i) => ({
    month: i === 0 ? 'Hiện tại' : `T+${i}`,
    cash: Math.max(0, currentCash - monthlyBurnRate * i),
  }));

  const runwayStatus =
    runwayMonths >= 12 ? { color: COLORS.inflow.start, label: 'An toàn tài chính', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' } :
    runwayMonths >= 6  ? { color: '#f59e0b', label: 'Cần lập kế hoạch', badge: 'bg-amber-50 text-amber-700 border-amber-200' } :
    { color: COLORS.outflow.start, label: 'Nguy cơ cạn tiền', badge: 'bg-rose-50 text-rose-700 border-rose-200' };

  return (
    <div style={{ height }} className="flex flex-col justify-between">
      {/* 4 Premium KPIs Matrix */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-slate-50/70 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Burn Rate / Tháng</span>
          <span className="text-base font-black text-rose-600 font-mono mt-1 block">
            {formatVND(monthlyBurnRate)}
          </span>
        </div>
        <div className="bg-slate-50/70 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Runway Dự Báo</span>
          <span className="text-base font-black font-mono mt-1 block" style={{ color: runwayStatus.color }}>
            {runwayMonths} Tháng
          </span>
        </div>
        <div className="bg-slate-50/70 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Tiền Mặt Khả Dụng</span>
          <span className="text-base font-black text-slate-800 dark:text-slate-100 font-mono mt-1 block">
            {formatVND(currentCash)}
          </span>
        </div>
        <div className="bg-slate-50/70 border border-slate-100 dark:bg-slate-900/50 dark:border-slate-800 rounded-2xl p-3 flex flex-col justify-between transition-all duration-300 hover:shadow-sm">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider block">Dòng Tiền / Ngày</span>
          <span className="text-base font-black text-blue-600 font-mono mt-1 block">
            {formatVND(averageDailyCashFlow)}
          </span>
        </div>
      </div>

      {/* Dynamic Health Status Indicator */}
      <div className="mb-4">
        <div className={`flex items-center justify-between px-4 py-2.5 rounded-2xl border text-xs font-black uppercase tracking-wider ${runwayStatus.badge} shadow-sm`}>
          <span>Trạng Thái Sức Khỏe Dòng Tiền</span>
          <span>{runwayStatus.label}</span>
        </div>
      </div>

      {/* Projection Trend Chart */}
      <div className="flex-1 min-h-[100px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="runwayCashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="month"
              axisLine={false}
              tickLine={false}
              tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tickFormatter={formatVND}
              tick={{ fontSize: 9, fontWeight: 650, fill: '#94a3b8' }}
              width={54}
            />
            <Tooltip content={<PremiumVNDTooltip />} />
            <Area
              type="monotone"
              dataKey="cash"
              name="Quỹ tiền mặt"
              stroke="#3b82f6"
              strokeWidth={3}
              fill="url(#runwayCashGrad)"
              dot={{ r: 4, stroke: '#3b82f6', strokeWidth: 2, fill: '#ffffff' }}
              activeDot={{ r: 6, stroke: '#3b82f6', strokeWidth: 3, fill: '#ffffff' }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── 3. Cash Flow Forecast Chart ──────────────────────────────────────────────

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

  // Find transitional month index where forecast starts
  const splitItem = data.find(d => d.actual !== undefined && d.forecast !== undefined);

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.actual.end} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COLORS.actual.start} stopOpacity={0.0} />
            </linearGradient>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.forecast.end} stopOpacity={0.25} />
              <stop offset="100%" stopColor={COLORS.forecast.start} stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="month"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatVND}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
            width={70}
          />
          <Tooltip content={<PremiumVNDTooltip />} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 700 }}
          />
          {/* Confidence interval area */}
          <Area
            type="monotone"
            dataKey="upper"
            name="Dải biên trên"
            stroke="transparent"
            fill={COLORS.forecast.start}
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
            stroke={COLORS.actual.start}
            strokeWidth={3}
            fill="url(#actualGrad)"
            dot={{ r: 4, stroke: COLORS.actual.start, strokeWidth: 2, fill: '#ffffff' }}
            activeDot={{ r: 6, stroke: COLORS.actual.start, strokeWidth: 3, fill: '#ffffff' }}
          />
          {/* Forecast curves */}
          <Area
            type="monotone"
            dataKey="forecast"
            name="Dự phóng dòng tiền"
            stroke={COLORS.forecast.start}
            strokeWidth={3}
            strokeDasharray="6 4"
            fill="url(#forecastGrad)"
            dot={{ r: 4, stroke: COLORS.forecast.start, strokeWidth: 2, fill: '#ffffff' }}
            activeDot={{ r: 6, stroke: COLORS.forecast.start, strokeWidth: 3, fill: '#ffffff' }}
          />
          {splitItem && (
            <ReferenceLine
              x={splitItem.month}
              stroke="#64748b"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              label={{
                value: 'Điểm Dự Báo',
                position: 'top',
                fill: '#475569',
                fontSize: 10,
                fontWeight: 800,
              }}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── 4. Revenue Breakdown Chart ───────────────────────────────────────────────

export type RevenueBreakdownItem = {
  source: string;
  revenue: number;
  percentage: number;
};

function PremiumPieLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' ||
      typeof innerRadius !== 'number' || typeof outerRadius !== 'number' || typeof percent !== 'number') return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.55;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.05) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={900}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function RevenueBreakdownChart({ data, height }: { data: RevenueBreakdownItem[]; height: number }) {
  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Phân Bổ Theo Phương Thức" icon={PieIcon} /></div>;
  }

  return (
    <div style={{ height }} className="flex flex-col justify-between">
      <div className="flex-1 min-h-[140px] relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <defs>
              {data.map((_, i) => {
                const gradColors = COLORS.pie[i % COLORS.pie.length];
                return (
                  <linearGradient id={`pieGrad-${i}`} key={i} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor={gradColors.end} />
                    <stop offset="100%" stopColor={gradColors.start} />
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
              innerRadius="50%"
              outerRadius="82%"
              paddingAngle={3}
              labelLine={false}
              label={(props) => <PremiumPieLabel {...props} />}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={`url(#pieGrad-${i})`} style={{ filter: 'drop-shadow(0 4px 6px rgba(15, 23, 42, 0.08))' }} />
              ))}
            </Pie>
            <Tooltip content={<PremiumVNDTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {/* Custom grid list legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 pt-3 pb-1.5 px-2 border-t border-slate-100 dark:border-slate-800">
        {data.map((item, i) => {
          const colorSet = COLORS.pie[i % COLORS.pie.length];
          return (
            <div key={i} className="flex justify-between items-center text-xs p-2 bg-slate-50/50 dark:bg-slate-900/40 rounded-xl border border-slate-100/60 dark:border-slate-800 transition-all duration-300 hover:bg-slate-50">
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: colorSet.start }} />
                <span className="text-slate-700 dark:text-slate-350 font-bold truncate">{item.source}</span>
              </div>
              <span className="font-mono font-black text-slate-800 dark:text-slate-200 text-[11px] flex-shrink-0 ml-2">
                {item.percentage}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── 5. P&L Charts ────────────────────────────────────────────────────────────

export function PnLStatementChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="P&L Statement Chart" icon={BarChart3} /></div>;
}

export function ExpenseBreakdownChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Expense Breakdown Chart" icon={PieIcon} /></div>;
}

export function ProfitabilityTrendChart({
  data,
  height,
}: {
  data: Array<{ date: string; revenue: number; expenses: number; profit: number }>;
  height: number;
}) {
  if (!data || data.length === 0) {
    return <div style={{ height }}><ChartPlaceholder title="Xu Hướng Lợi Nhuận" icon={LineIcon} /></div>;
  }

  return (
    <div style={{ height }} className="relative">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 12, right: 16, left: 8, bottom: 8 }}>
          <defs>
            <linearGradient id="pnlRev" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.inflow.end} />
              <stop offset="100%" stopColor={COLORS.inflow.start} />
            </linearGradient>
            <linearGradient id="pnlExp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.outflow.end} />
              <stop offset="100%" stopColor={COLORS.outflow.start} />
            </linearGradient>
            <linearGradient id="pnlProf" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.actual.end} />
              <stop offset="100%" stopColor={COLORS.actual.start} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tickFormatter={formatVND}
            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
            width={70}
          />
          <Tooltip content={<PremiumVNDTooltip />} cursor={{ fill: '#f8fafc', opacity: 0.8 }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ paddingBottom: 16, fontSize: 12, fontWeight: 700 }}
          />
          <Bar
            dataKey="revenue"
            name="Doanh thu"
            fill="url(#pnlRev)"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
            style={{ filter: `drop-shadow(0 4px 6px ${COLORS.inflow.glow})` }}
          />
          <Bar
            dataKey="expenses"
            name="Chi phí"
            fill="url(#pnlExp)"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
            style={{ filter: `drop-shadow(0 4px 6px ${COLORS.outflow.glow})` }}
          />
          <Bar
            dataKey="profit"
            name="Lợi nhuận"
            fill="url(#pnlProf)"
            radius={[4, 4, 0, 0]}
            maxBarSize={20}
            style={{ filter: `drop-shadow(0 4px 6px ${COLORS.actual.glow})` }}
          />
        </BarChart>
      </ResponsiveContainer>
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
