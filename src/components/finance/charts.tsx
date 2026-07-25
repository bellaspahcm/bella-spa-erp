/**
 * Finance Chart Components - Stub Implementation
 * 
 * TODO: Implement actual chart components for Finance dashboard
 * These are placeholder components to allow the build to pass.
 * Replace with real Recharts/Chart.js implementations.
 */

import React from 'react';
import { BarChart3, PieChart, LineChart, TrendingUp } from 'lucide-react';

// Placeholder component
function ChartPlaceholder({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center justify-center h-full bg-slate-50 rounded-xl border border-dashed border-slate-300">
      <div className="text-center">
        <Icon className="h-12 w-12 text-slate-300 mx-auto mb-2" />
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-xs text-slate-400 mt-1">Component coming soon</p>
      </div>
    </div>
  );
}

// Budget Charts
export function BudgetVarianceChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Variance Chart" icon={BarChart3} /></div>;
}

export function BudgetUtilizationChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Utilization Chart" icon={PieChart} /></div>;
}

export function VarianceTrendChart({ data: _data, categories: _categories, height }: { data: unknown; categories: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Variance Trend Chart" icon={LineChart} /></div>;
}

export function BudgetStatusChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Status Chart" icon={PieChart} /></div>;
}

// Cash Flow Charts
export function CashFlowAnalysisChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Cash Flow Analysis Chart" icon={BarChart3} /></div>;
}

export function BurnRateChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Burn Rate Chart" icon={TrendingUp} /></div>;
}

export function CashFlowForecastChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Cash Flow Forecast Chart" icon={LineChart} /></div>;
}

// P&L Charts
export function PnLStatementChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="P&L Statement Chart" icon={BarChart3} /></div>;
}

export function RevenueBreakdownChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Revenue Breakdown Chart" icon={PieChart} /></div>;
}

export function ExpenseBreakdownChart({ data: _data, height }: { data: unknown; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Expense Breakdown Chart" icon={PieChart} /></div>;
}

export function ProfitabilityTrendChart({
  data,
  height,
}: {
  data: Array<{ date: string; revenue: number; expenses: number; profit: number }>;
  height: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div style={{ height }}>
        <ChartPlaceholder title="Profitability Trend Chart" icon={LineChart} />
      </div>
    );
  }

  const maxValue = Math.max(...data.flatMap((d) => [d.revenue, d.expenses, d.profit]));
  const barWidth = Math.floor(100 / data.length);

  return (
    <div style={{ height }} className="flex flex-col">
      {/* Y-axis labels + bars */}
      <div className="flex-1 flex items-end gap-1 px-2 pb-6 relative">
        {data.map((item, idx) => {
          const revPct = maxValue > 0 ? (item.revenue / maxValue) * 100 : 0;
          const expPct = maxValue > 0 ? (item.expenses / maxValue) * 100 : 0;
          const profPct = maxValue > 0 ? (Math.abs(item.profit) / maxValue) * 100 : 0;
          const isProfit = item.profit >= 0;

          return (
            <div
              key={idx}
              className="flex-1 flex flex-col items-center gap-0.5 group"
              style={{ width: `${barWidth}%` }}
            >
              {/* Tooltip on hover */}
              <div className="hidden group-hover:block absolute bottom-full mb-2 bg-slate-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10 pointer-events-none">
                <p>📅 {item.date}</p>
                <p className="text-green-300">DT: {new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(item.revenue)}đ</p>
                <p className="text-red-300">CP: {new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(item.expenses)}đ</p>
                <p className={isProfit ? 'text-blue-300' : 'text-orange-300'}>
                  LN: {new Intl.NumberFormat('vi-VN', { notation: 'compact' }).format(item.profit)}đ
                </p>
              </div>

              {/* Bars */}
              <div className="w-full flex items-end gap-px h-full">
                <div
                  className="flex-1 bg-green-400 rounded-t opacity-80 transition-all duration-300 hover:opacity-100"
                  style={{ height: `${revPct}%`, minHeight: '2px' }}
                />
                <div
                  className="flex-1 bg-red-400 rounded-t opacity-80 transition-all duration-300 hover:opacity-100"
                  style={{ height: `${expPct}%`, minHeight: '2px' }}
                />
                <div
                  className={`flex-1 rounded-t opacity-80 transition-all duration-300 hover:opacity-100 ${isProfit ? 'bg-blue-500' : 'bg-orange-400'}`}
                  style={{ height: `${profPct}%`, minHeight: '2px' }}
                />
              </div>

              {/* Month label */}
              <span className="text-[10px] text-slate-500 mt-1 truncate w-full text-center">{item.date}</span>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-4 pt-1 pb-1 text-xs text-slate-600">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-400 inline-block" /> Doanh thu</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block" /> Chi phí</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-500 inline-block" /> Lợi nhuận</span>
      </div>
    </div>
  );
}
