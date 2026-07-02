/**
 * P&L Statement Waterfall Chart
 * 
 * Visualizes Profit & Loss statement as a waterfall chart showing:
 * - Total Revenue (starting bar)
 * - Total Expenses (negative bar)
 * - Net Profit (ending bar)
 * 
 * Uses Recharts BarChart with color-coded bars based on value type.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

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
  Cell,
} from 'recharts';

interface PnLStatementData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
}

interface PnLStatementChartProps {
  data: PnLStatementData;
  height?: number;
}

export function PnLStatementChart({ data, height = 300 }: PnLStatementChartProps) {
  // Transform data for waterfall chart
  const chartData = [
    {
      name: 'Doanh thu',
      value: data.totalRevenue,
      fill: '#10b981', // green
    },
    {
      name: 'Chi phí',
      value: -data.totalExpenses,
      fill: '#ef4444', // red
    },
    {
      name: 'Lợi nhuận ròng',
      value: data.netProfit,
      fill: data.netProfit >= 0 ? '#3b82f6' : '#ef4444', // blue or red
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Math.abs(value));
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value: number) => [formatCurrency(value), '']}
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
