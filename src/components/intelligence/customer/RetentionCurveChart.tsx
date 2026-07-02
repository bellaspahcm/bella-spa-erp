'use client';

/**
 * Retention Curve Chart (Line Chart)
 * Shows customer retention rate by cohort over time
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CohortAnalysis } from '@/services/intelligence/customer/queries';

interface RetentionCurveChartProps {
  data: CohortAnalysis[];
  height?: number;
}

export function RetentionCurveChart({ data, height = 350 }: RetentionCurveChartProps) {
  const chartData = data
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    .map(d => ({
      cohort: d.cohortMonth.substring(5, 7) + '/' + d.cohortMonth.substring(2, 4),
      retention: d.retentionRatePct,
      size: d.cohortSize,
    }));

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
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip
          formatter={(value) => {
            if (typeof value === 'number') {
              return `${value.toFixed(1)}%`;
            }
            return value;
          }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        <Line
          type="monotone"
          dataKey="retention"
          name="Tỷ lệ giữ chân (%)"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
