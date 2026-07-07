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
      <AreaChart data={data} margin={{ top: 10, right: 5, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorReturning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#06b6d4" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
        <XAxis 
          dataKey="date" 
          stroke="#94a3b8"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '11px', fontWeight: 600 }}
          dy={8}
        />
        <YAxis 
          stroke="#94a3b8"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: '11px', fontWeight: 600 }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '11px', fontWeight: 700, paddingTop: '15px' }}
          formatter={(value) => {
            if (value === 'newCustomers') return 'Khách mới';
            if (value === 'returningCustomers') return 'Khách quay lại';
            return value;
          }}
          iconType="circle"
        />
        <Area
          type="monotone"
          dataKey="newCustomers"
          stroke="#a855f7"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorNew)"
        />
        <Area
          type="monotone"
          dataKey="returningCustomers"
          stroke="#06b6d4"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorReturning)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
