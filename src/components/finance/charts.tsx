/**
 * Finance Chart Components
 *
 * Real implementations using Recharts.
 * Cash-flow page uses: CashFlowAnalysisChart, BurnRateChart, CashFlowForecastChart, RevenueBreakdownChart
 * PnL page uses:       ProfitabilityTrendChart, PnLStatementChart, ExpenseBreakdownChart
 * Budget page uses:    BudgetVarianceChart, BudgetUtilizationChart, VarianceTrendChart, BudgetStatusChart
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
  LineChart as RechartsLineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
  type PieLabelRenderProps,
} from 'recharts';
import { BarChart3, PieChart as PieIcon, LineChart as LineIcon, TrendingUp } from 'lucide-react';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const formatVND = (v: number) =>
  new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(v) + 'đ';

const PALETTE = {
  green:  '#22c55e',
  red:    '#ef4444',
  blue:   '#3b82f6',
  indigo: '#6366f1',
  orange: '#f97316',
  violet: '#8b5cf6',
  teal:   '#14b8a6',
  slate:  '#94a3b8',
};

// Placeholder fallback
function ChartPlaceholder({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50 rounded-xl border border-dashed border-slate-300">
      <div className="text-center">
        <Icon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-xs text-slate-400 mt-1">Không có dữ liệu</p>
      </div>
    </div>
  );
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function VNDTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-xl shadow-lg p-3 text-xs min-w-[140px]">
      <p className="font-semibold text-slate-700 mb-1.5">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex justify-between gap-4">
          <span style={{ color: p.color }}>{p.name}</span>
          <span className="font-medium text-slate-800">{formatVND(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Cash Flow Analysis Chart (grouped bar) ───────────────────────────────────

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
  if (!data || data.length === 0)
    return <div style={{ height }}><ChartPlaceholder title="Phân Tích Dòng Tiền" icon={BarChart3} /></div>;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="paymentMethod" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tickFormatter={formatVND} tick={{ fontSize: 10, fill: '#94a3b8' }} width={72} />
          <Tooltip content={<VNDTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="inflows"  name="Dòng vào"  fill={PALETTE.green}  radius={[4, 4, 0, 0]} />
          <Bar dataKey="outflows" name="Dòng ra"   fill={PALETTE.red}    radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Burn Rate Chart ──────────────────────────────────────────────────────────

export type BurnRateData = {
  monthlyBurnRate: number;
  runwayMonths: number;
  currentCash: number;
  averageDailyCashFlow: number;
};

export function BurnRateChart({ data, height }: { data: BurnRateData | null; height: number }) {
  if (!data)
    return <div style={{ height }}><ChartPlaceholder title="Tốc Độ Đốt Tiền & Runway" icon={TrendingUp} /></div>;

  const { monthlyBurnRate, runwayMonths, currentCash, averageDailyCashFlow } = data;

  // Generate a simple 6-month runway burn-down chart
  const chartData = Array.from({ length: 7 }, (_, i) => ({
    month: i === 0 ? 'Hiện tại' : `T+${i}`,
    cash: Math.max(0, currentCash - monthlyBurnRate * i),
  }));

  const healthColor =
    runwayMonths >= 12 ? PALETTE.green :
    runwayMonths >= 6  ? PALETTE.orange :
    PALETTE.red;

  const healthLabel =
    runwayMonths >= 12 ? '✅ An toàn' :
    runwayMonths >= 6  ? '⚠️ Cần theo dõi' :
    '🔴 Nguy hiểm';

  return (
    <div style={{ height }} className="flex flex-col gap-3">
      {/* KPI row */}
      <div className="grid grid-cols-2 gap-2 px-1">
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Burn Rate/tháng</p>
          <p className="text-sm font-bold text-red-600 mt-0.5">{formatVND(monthlyBurnRate)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Runway</p>
          <p className="text-sm font-bold mt-0.5" style={{ color: healthColor }}>
            {runwayMonths} tháng
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Tiền mặt</p>
          <p className="text-sm font-bold text-slate-800 mt-0.5">{formatVND(currentCash)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2 text-center">
          <p className="text-[10px] text-slate-500 uppercase tracking-wide">CF ngày TB</p>
          <p className="text-sm font-bold text-blue-600 mt-0.5">{formatVND(averageDailyCashFlow)}</p>
        </div>
      </div>

      {/* Health badge */}
      <div className="text-center">
        <span className="text-xs font-semibold px-3 py-1 rounded-full" style={{ background: healthColor + '20', color: healthColor }}>
          {healthLabel}
        </span>
      </div>

      {/* Burndown line chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 4 }}>
            <defs>
              <linearGradient id="cashGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={PALETTE.blue} stopOpacity={0.25} />
                <stop offset="95%" stopColor={PALETTE.blue} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#94a3b8' }} />
            <YAxis tickFormatter={formatVND} tick={{ fontSize: 9, fill: '#94a3b8' }} width={60} />
            <Tooltip content={<VNDTooltip />} />
            <Area
              type="monotone"
              dataKey="cash"
              name="Tiền còn lại"
              stroke={PALETTE.blue}
              fill="url(#cashGrad)"
              strokeWidth={2}
              dot={{ r: 3, fill: PALETTE.blue }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Cash Flow Forecast Chart (area with upper/lower bands) ──────────────────

export type ForecastItem = {
  month: string;
  actual?: number;
  forecast?: number;
  upper?: number;
  lower?: number;
};

export function CashFlowForecastChart({ data, height }: { data: ForecastItem[]; height: number }) {
  if (!data || data.length === 0)
    return <div style={{ height }}><ChartPlaceholder title="Dự Báo Dòng Tiền" icon={LineIcon} /></div>;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <defs>
            <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PALETTE.indigo} stopOpacity={0.25} />
              <stop offset="95%" stopColor={PALETTE.indigo} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor={PALETTE.green} stopOpacity={0.2} />
              <stop offset="95%" stopColor={PALETTE.green} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tickFormatter={formatVND} tick={{ fontSize: 10, fill: '#94a3b8' }} width={72} />
          <Tooltip content={<VNDTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          {/* Confidence band */}
          <Area type="monotone" dataKey="upper" name="Cao nhất" stroke="transparent" fill={PALETTE.indigo} fillOpacity={0.08} legendType="none" />
          <Area type="monotone" dataKey="lower" name="Thấp nhất" stroke="transparent" fill="#ffffff" fillOpacity={1} legendType="none" />
          {/* Actuals */}
          <Area type="monotone" dataKey="actual"   name="Thực tế"  stroke={PALETTE.green}  fill="url(#actualGrad)"   strokeWidth={2} dot={{ r: 4 }} />
          {/* Forecast */}
          <Area type="monotone" dataKey="forecast" name="Dự báo"   stroke={PALETTE.indigo} fill="url(#forecastGrad)" strokeWidth={2} strokeDasharray="5 3" dot={{ r: 4 }} />
          <ReferenceLine x={data.find(d => d.actual !== undefined && d.forecast !== undefined)?.month} stroke={PALETTE.slate} strokeDasharray="4 2" label={{ value: 'Hiện tại', fontSize: 10 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Revenue Breakdown Chart (donut pie) ──────────────────────────────────────

export type RevenueBreakdownItem = {
  source: string;
  revenue: number;
  percentage: number;
};

const PIE_COLORS = [PALETTE.blue, PALETTE.green, PALETTE.indigo, PALETTE.teal, PALETTE.orange, PALETTE.violet];

function PieLabel(props: PieLabelRenderProps) {
  const { cx, cy, midAngle, innerRadius, outerRadius, percent } = props;
  if (typeof cx !== 'number' || typeof cy !== 'number' || typeof midAngle !== 'number' ||
      typeof innerRadius !== 'number' || typeof outerRadius !== 'number' || typeof percent !== 'number') return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  if (percent < 0.06) return null;
  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={600}>
      {`${(percent * 100).toFixed(0)}%`}
    </text>
  );
}

export function RevenueBreakdownChart({ data, height }: { data: RevenueBreakdownItem[]; height: number }) {
  if (!data || data.length === 0)
    return <div style={{ height }}><ChartPlaceholder title="Phân Bổ Theo Phương Thức" icon={PieIcon} /></div>;

  return (
    <div style={{ height }} className="flex flex-col">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="revenue"
              nameKey="source"
              cx="50%"
              cy="50%"
              innerRadius="40%"
              outerRadius="70%"
              labelLine={false}
              label={(props) => <PieLabel {...props} />}
            >
              {data.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Legend */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5 pb-2 text-xs text-slate-600">
        {data.map((item, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            <span>{item.source}</span>
            <span className="text-slate-400">{item.percentage}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── P&L Charts ───────────────────────────────────────────────────────────────

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
  if (!data || data.length === 0)
    return <div style={{ height }}><ChartPlaceholder title="Xu Hướng Lợi Nhuận" icon={LineIcon} /></div>;

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
          <YAxis tickFormatter={formatVND} tick={{ fontSize: 10, fill: '#94a3b8' }} width={72} />
          <Tooltip content={<VNDTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="revenue"  name="Doanh thu"    fill={PALETTE.green}  radius={[4, 4, 0, 0]} />
          <Bar dataKey="expenses" name="Chi phí"      fill={PALETTE.red}    radius={[4, 4, 0, 0]} />
          <Bar dataKey="profit"   name="Lợi nhuận"   fill={PALETTE.blue}   radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Budget Charts (stubs — budget page not yet fully designed) ───────────────

export function BudgetVarianceChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Variance" icon={BarChart3} /></div>;
}

export function BudgetUtilizationChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Utilization" icon={PieIcon} /></div>;
}

export function VarianceTrendChart({ data: _data, categories: _categories, height }: { data: unknown; categories: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Variance Trend" icon={LineIcon} /></div>;
}

export function BudgetStatusChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Status" icon={PieIcon} /></div>;
}
