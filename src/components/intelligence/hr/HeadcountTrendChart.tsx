'use client';

/**
 * Headcount Trend Chart
 * 
 * Displays headcount trends over time with new hires and terminations.
 * Uses Recharts for visualization.
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface HeadcountTrendData {
  month: string;
  headcount: number;
  newHires: number;
  terminations: number;
}

interface HeadcountTrendChartProps {
  data: HeadcountTrendData[];
  height?: number;
}

export function HeadcountTrendChart({ data, height = 300 }: HeadcountTrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="month" 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
        />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }}
          iconType="line"
        />
        <Line 
          type="monotone" 
          dataKey="headcount" 
          name="Tổng nhân sự"
          stroke="#3b82f6" 
          strokeWidth={3}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
        />
        <Line 
          type="monotone" 
          dataKey="newHires" 
          name="Tuyển mới"
          stroke="#10b981" 
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#10b981', r: 3 }}
        />
        <Line 
          type="monotone" 
          dataKey="terminations" 
          name="Nghỉ việc"
          stroke="#ef4444" 
          strokeWidth={2}
          strokeDasharray="5 5"
          dot={{ fill: '#ef4444', r: 3 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
