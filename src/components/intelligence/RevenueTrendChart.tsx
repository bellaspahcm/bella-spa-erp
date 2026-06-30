'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

interface RevenueDataPoint {
  date: string;
  revenue: number;
  target?: number;
}

interface RevenueTrendChartProps {
  data: RevenueDataPoint[];
  height?: number;
}

export function RevenueTrendChart({ data, height = 300 }: RevenueTrendChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="date" 
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis 
          stroke="#64748b"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value) => 
            new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value))
          }
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Legend 
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
        <Line
          type="monotone"
          dataKey="revenue"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="Doanh thu"
        />
        {data.some(d => d.target) && (
          <Line
            type="monotone"
            dataKey="target"
            stroke="#94a3b8"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
            name="Mục tiêu"
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
