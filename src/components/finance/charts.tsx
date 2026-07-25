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
export function BudgetVarianceChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Variance Chart" icon={BarChart3} /></div>;
}

export function BudgetUtilizationChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Utilization Chart" icon={PieChart} /></div>;
}

export function VarianceTrendChart({ data: _data, categories: _categories, height }: { data: any; categories: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Variance Trend Chart" icon={LineChart} /></div>;
}

export function BudgetStatusChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Budget Status Chart" icon={PieChart} /></div>;
}

// Cash Flow Charts
export function CashFlowAnalysisChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Cash Flow Analysis Chart" icon={BarChart3} /></div>;
}

export function BurnRateChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Burn Rate Chart" icon={TrendingUp} /></div>;
}

export function CashFlowForecastChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Cash Flow Forecast Chart" icon={LineChart} /></div>;
}

// P&L Charts
export function PnLStatementChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="P&L Statement Chart" icon={BarChart3} /></div>;
}

export function RevenueBreakdownChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Revenue Breakdown Chart" icon={PieChart} /></div>;
}

export function ExpenseBreakdownChart({ data: _data, height }: { data: any; height: number }) {
  return <div style={{ height }}><ChartPlaceholder title="Expense Breakdown Chart" icon={PieChart} /></div>;
}
