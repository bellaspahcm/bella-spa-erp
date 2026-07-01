'use client';

/**
 * Profitability Trend Line Chart
 * 
 * Shows historical profitability trends with 3 lines:
 * - Revenue (green)
 * - Expenses (red)
 * - Profit (blue)
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ProfitabilityDataPoint {
  date: string; // e.g., '2026-05', 'Jan 26'
  revenue: number;
  expenses: number;
  profit: number;
}

interface ProfitabilityTrendChartProps {
  data: ProfitabilityDataPoint[];
  height?: number;
}

/**
 * Profitability Trend Line Chart Component
 * 
 * Displays historical trends for revenue, expenses, and profit.
 * Three lines with different colors for easy comparison.
 * 
 * @param data - Array of data points with date, revenue, expenses, and profit
 * @param height - Chart height in pixels (default: 300)
 */
export function ProfitabilityTrendChart({ data, height = 300 }: ProfitabilityTrendChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatTooltipCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value) => formatTooltipCurrency(Number(value))}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="Doanh thu"
        />
        <Line
          type="monotone"
          dataKey="expenses"
          stroke="#ef4444"
          strokeWidth={2}
          dot={{ fill: '#ef4444', r: 4 }}
          activeDot={{ r: 6 }}
          name="Chi phí"
        />
        <Line
          type="monotone"
          dataKey="profit"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="Lợi nhuận"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
