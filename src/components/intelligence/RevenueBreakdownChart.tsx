/**
 * Revenue Breakdown Pie Chart
 * 
 * Visualizes revenue distribution by source/type as a pie chart.
 * Shows percentage breakdown with color-coded segments.
 * 
 * Uses Recharts PieChart with custom labels and tooltip.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface RevenueBreakdownItem {
  source: string;
  revenue: number;
  percentage: number;
}

interface RevenueBreakdownChartProps {
  data: RevenueBreakdownItem[];
  height?: number;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#14b8a6', // teal
  '#f97316', // orange
  '#6366f1', // indigo
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export function RevenueBreakdownChart({ data, height = 300 }: RevenueBreakdownChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const renderCustomLabel = (props: unknown) => {
    if (!isRecord(props)) return null;

    const cx = readNumber(props.cx);
    const cy = readNumber(props.cy);
    const midAngle = readNumber(props.midAngle);
    const innerRadius = readNumber(props.innerRadius);
    const outerRadius = readNumber(props.outerRadius);
    const percent = readNumber(props.percent);

    if (
      cx === null ||
      cy === null ||
      midAngle === null ||
      innerRadius === null ||
      outerRadius === null ||
      percent === null
    ) {
      return null;
    }

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    // Only show label if percentage is > 5%
    if (percent < 0.05) return null;

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor={x > cx ? 'start' : 'end'}
        dominantBaseline="central"
        fontSize={12}
        fontWeight={700}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderCustomLabel}
          outerRadius={80}
          fill="#8884d8"
          dataKey="revenue"
          nameKey="source"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [formatCurrency(numValue), 'Doanh thu'];
          }}
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          formatter={(value) => {
            const item = data.find((d) => d.source === value);
            return `${value} (${item?.percentage || 0}%)`;
          }}
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

