/**
 * Budget Status Pie Chart
 * 
 * Visualizes distribution of budget categories by status (under/on_target/over).
 * Shows percentage breakdown with color-coded segments.
 * 
 * Uses Recharts PieChart with custom labels.
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

interface BudgetStatusItem {
  status: 'under' | 'on_target' | 'over';
  count: number;
  percentage: number;
}

interface BudgetStatusChartProps {
  data: BudgetStatusItem[];
  height?: number;
}

const STATUS_COLORS: Record<string, string> = {
  under: '#10b981', // green
  on_target: '#3b82f6', // blue
  over: '#ef4444', // red
};

const STATUS_LABELS: Record<string, string> = {
  under: 'Dưới ngân sách',
  on_target: 'Đúng kế hoạch',
  over: 'Vượt ngân sách',
};

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null
);

const readNumber = (value: unknown): number | null => (
  typeof value === 'number' && Number.isFinite(value) ? value : null
);

const isBudgetStatus = (value: unknown): value is BudgetStatusItem['status'] => (
  value === 'under' || value === 'on_target' || value === 'over'
);

export function BudgetStatusChart({ data, height = 250 }: BudgetStatusChartProps) {
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
          dataKey="count"
          nameKey="status"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name) => {
            const status = isBudgetStatus(name) ? name : null;
            const item = status ? data.find((d) => d.status === status) : null;
            const numValue = typeof value === 'number' ? value : 0;
            return [
              `${numValue} danh mục (${item?.percentage.toFixed(1) || 0}%)`,
              status ? STATUS_LABELS[status] : name,
            ];
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
          formatter={(value: string) => {
            return STATUS_LABELS[value] || value;
          }}
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
