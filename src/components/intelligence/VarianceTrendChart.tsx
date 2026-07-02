/**
 * Variance Trend Line Chart
 * 
 * Visualizes budget variance percentage trends over time by category.
 * Shows multiple lines for top categories with color-coded performance.
 * 
 * Uses Recharts LineChart with multiple series.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';

interface VarianceTrendDataPoint {
  month: string;
  [category: string]: string | number;
}

interface VarianceTrendChartProps {
  data: VarianceTrendDataPoint[];
  categories: string[];
  height?: number;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
];

export function VarianceTrendChart({ data, categories, height = 300 }: VarianceTrendChartProps) {
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          tickFormatter={formatPercent}
        />
        <Tooltip
          formatter={(value: number, name: string) => [formatPercent(value), name]}
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
          wrapperStyle={{ fontSize: '11px', fontWeight: 600 }}
        />
        
        {/* Zero reference line */}
        <ReferenceLine
          y={0}
          stroke="#94a3b8"
          strokeDasharray="3 3"
          label={{ value: 'Đúng ngân sách', fontSize: 10, fill: '#94a3b8' }}
        />

        {/* Category lines */}
        {categories.map((category, index) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            stroke={COLORS[index % COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4, fill: COLORS[index % COLORS.length] }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
