'use client';

/**
 * LTV by Cohort Chart (Line Chart)
 * Shows average LTV trends by customer signup cohort
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CohortAnalysis } from '@/services/intelligence/customer/queries-simple';

interface LtvByCohortChartProps {
  data: CohortAnalysis[];
  height?: number;
}

export function LtvByCohortChart({ data, height = 350 }: LtvByCohortChartProps) {
  const chartData = data
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    .map(d => ({
      cohort: d.cohortMonth.substring(5, 7) + '/' + d.cohortMonth.substring(2, 4),
      ltv: d.avgLTV, // Changed from avgLtv to avgLTV
      size: d.cohortSize,
    }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="cohort"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip
          formatter={(value) => {
            if (typeof value === 'number') {
              return formatCurrency(value);
            }
            return value;
          }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        />
        <Line
          type="monotone"
          dataKey="ltv"
          name="LTV Trung Bình"
          stroke="#8b5cf6"
          strokeWidth={3}
          dot={{ fill: '#8b5cf6', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
