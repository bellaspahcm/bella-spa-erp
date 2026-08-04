/**
 * Budget Variance Grouped Bar Chart
 * 
 * Visualizes budget vs actual spending by category.
 * Shows side-by-side comparison with color-coded variance indicators.
 * 
 * Uses Recharts BarChart with grouped bars.
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
  Legend, Cell,
} from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';

interface BudgetVarianceItem {
  category: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePercent: number;
  status: 'under' | 'on_target' | 'over';
}

interface BudgetVarianceChartProps {
  data: BudgetVarianceItem[];
  height?: number;
}

export function BudgetVarianceChart({ data, height = 350 }: BudgetVarianceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const chartData = data.map(item => ({
    name: item.category,
    'Ngân sách': item.budgetAmount,
    'Chi tiêu thực tế': item.actualAmount,
    status: item.status,
  }));

  // Color mapping for actual spending based on status
  const getActualColor = (status: string) => {
    if (status === 'over') return '#ef4444'; // red
    if (status === 'under') return '#10b981'; // green
    return '#3b82f6'; // blue (on_target)
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 20, left: -15, bottom: 30 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          angle={-30}
          textAnchor="end"
          height={40}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [formatCurrency(numValue), ''];
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
          iconType="rect"
          wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
        />
        <Bar
          dataKey="Ngân sách"
          fill="#94a3b8"
          radius={[8, 8, 0, 0]}
        />
        <Bar
          dataKey="Chi tiêu thực tế"
          radius={[8, 8, 0, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getActualColor(entry.status)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
