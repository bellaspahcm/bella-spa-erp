'use client';

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface CustomerDataPoint {
  date: string;
  newCustomers: number;
  returningCustomers: number;
}

interface CustomerMetricsChartProps {
  data: CustomerDataPoint[];
  height?: number;
}

export function CustomerMetricsChart({ data, height = 300 }: CustomerMetricsChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart
        data={data}
        margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
      >
        <defs>
          <linearGradient id="colorNew" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#a855f7" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
          </linearGradient>
          <linearGradient id="colorReturning" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ec4899" stopOpacity={0.8}/>
            <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="date" 
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis 
          stroke="#64748b"
          fontSize={12}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Area
          type="monotone"
          dataKey="newCustomers"
          stroke="#a855f7"
          fillOpacity={1}
          fill="url(#colorNew)"
          name="Khách mới"
        />
        <Area
          type="monotone"
          dataKey="returningCustomers"
          stroke="#ec4899"
          fillOpacity={1}
          fill="url(#colorReturning)"
          name="Khách quay lại"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
