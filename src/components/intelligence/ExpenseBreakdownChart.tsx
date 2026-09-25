/**
 * Expense Breakdown Pie Chart
 * 
 * Visualizes expense distribution by category as a pie chart.
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
  Legend, } from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';

interface ExpenseBreakdownItem {
  category: string;
  expense: number;
  percentage: number;
}

interface ExpenseBreakdownChartProps {
  data: ExpenseBreakdownItem[];
  height?: number;
}

const COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#f59e0b', // amber
  '#eab308', // yellow
  '#84cc16', // lime
  '#22c55e', // green
  '#14b8a6', // teal
  '#06b6d4', // cyan
];

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

export function ExpenseBreakdownChart({ data, height = 300 }: ExpenseBreakdownChartProps) {
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
          dataKey="expense"
          nameKey="category"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [formatCurrency(numValue), 'Chi phí'];
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
            const item = data.find((d) => d.category === value);
            return `${value} (${item?.percentage || 0}%)`;
          }}
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

