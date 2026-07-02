'use client';

/**
 * Customer Metrics Chart Component
 * 
 * Displays new vs returning customers trend using area chart
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface CustomerTrendData {
  date: string;
  newCustomers: number;
  returningCustomers: number;
}

interface CustomerMetricsChartProps {
  data: CustomerTrendData[];
  height?: number;
}

export function CustomerMetricsChart({ data, height = 200 }: CustomerMetricsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <defs>
          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorReturning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="date" 
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '12px' }}
          formatter={(value) => {
            if (value === 'newCustomers') return 'Khách mới';
            if (value === 'returningCustomers') return 'Khách quay lại';
            return value;
          }}
        />
        <Area
          type="monotone"
          dataKey="newCustomers"
          stroke="#a855f7"
          fillOpacity={1}
          fill="url(#colorNew)"
        />
        <Area
          type="monotone"
          dataKey="returningCustomers"
          stroke="#06b6d4"
          fillOpacity={1}
          fill="url(#colorReturning)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
