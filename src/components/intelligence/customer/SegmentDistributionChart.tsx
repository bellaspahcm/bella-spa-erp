'use client';

/**
 * Segment Distribution Chart (Pie Chart)
 * Shows customer count by segment
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { SegmentDistribution } from '@/services/intelligence/customer/queries';

interface SegmentDistributionChartProps {
  data: SegmentDistribution[];
  height?: number;
}

const COLORS = ['#10b981', '#06b6d4', '#8b5cf6', '#6366f1', '#3b82f6', '#f59e0b', '#ef4444', '#dc2626', '#9ca3af', '#6b7280', '#14b8a6'];

export function SegmentDistributionChart({ data, height = 350 }: SegmentDistributionChartProps) {
  const chartData = data.map(d => ({
    name: d.segment,
    value: d.customerCount,
    percent: d.percentageOfTotal,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name} (${percent ? percent.toFixed(1) : 0}%)`}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                  <p className="font-semibold text-sm">{data.name}</p>
                  <p className="text-xs text-gray-600">{data.value} khách hàng ({data.percent ? data.percent.toFixed(1) : 0}%)</p>
                </div>
              );
            }
            return null;
          }}
        />
        <Legend verticalAlign="bottom" height={36} />
      </PieChart>
    </ResponsiveContainer>
  );
}
