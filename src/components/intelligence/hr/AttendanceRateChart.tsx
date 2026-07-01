'use client';

/**
 * Attendance Rate Chart
 * 
 * Displays attendance and on-time rates for top-performing KTVs.
 * Uses Recharts bar chart for visualization.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AttendanceRateData {
  name: string;
  attendanceRate: number;
  onTimeRate: number;
}

interface AttendanceRateChartProps {
  data: AttendanceRateData[];
  height?: number;
}

export function AttendanceRateChart({ data, height = 300 }: AttendanceRateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="name" 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
          angle={-45}
          textAnchor="end"
          height={100}
        />
        <YAxis 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
          domain={[0, 100]}
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
        />
        <Bar 
          dataKey="attendanceRate" 
          name="Tỷ lệ đi làm (%)"
          fill="#10b981" 
          radius={[8, 8, 0, 0]}
        />
        <Bar 
          dataKey="onTimeRate" 
          name="Tỷ lệ đúng giờ (%)"
          fill="#3b82f6" 
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
