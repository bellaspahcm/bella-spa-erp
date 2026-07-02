/**
 * Profitability Trend Line Chart
 * 
 * Visualizes revenue, expenses, and profit trends over time.
 * Shows 3 lines (revenue, expenses, profit) with area fill for profit.
 * 
 * Uses Recharts ComposedChart with LineChart and AreaChart.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ProfitabilityDataPoint {
  date: string; // MM/YYYY or YYYY-MM-DD
  revenue: number;
  expenses: number;
  profit: number;
}

interface ProfitabilityTrendChartProps {
  data: ProfitabilityDataPoint[];
  height?: number;
}

export function ProfitabilityTrendChart({ data, height = 300 }: ProfitabilityTrendChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              revenue: 'Doanh thu',
              expenses: 'Chi phí',
              profit: 'Lợi nhuận',
            };
            const numValue = typeof value === 'number' ? value : 0;
            return [formatCurrency(numValue), labels[String(name)] || String(name)];
          }}
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="line"
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              revenue: 'Doanh thu',
              expenses: 'Chi phí',
              profit: 'Lợi nhuận',
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="profit"
          fill="url(#profitGradient)"
          stroke="none"
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ r: 4, fill: '#10b981' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ r: 4, fill: '#ef4444' }}
          activeDot={{ r: 6 }}
        />
        <Line
          type="monotone"
          dataKey="profit"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ r: 5, fill: '#3b82f6' }}
          activeDot={{ r: 7 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

