'use client';

/**
 * Revenue Trend Chart Component
 * 
 * Displays 7-day revenue trend using Recharts
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface RevenueTrendData {
  date: string;
  revenue: number;
}

interface RevenueTrendChartProps {
  data: RevenueTrendData[];
  height?: number;
}

export function RevenueTrendChart({ data, height = 200 }: RevenueTrendChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 10, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary, #db2777)" stopOpacity={0.2} />
            <stop offset="95%" stopColor="var(--primary, #db2777)" stopOpacity={0} />
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
          tickFormatter={formatCurrency}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
          }}
          formatter={(value) => {
            if (typeof value !== 'number') return ['', 'Doanh thu'];
            return [
              new Intl.NumberFormat('vi-VN', {
                style: 'currency',
                currency: 'VND',
              }).format(value),
              'Doanh thu',
            ];
          }}
        />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="var(--primary, #db2777)"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#colorRevenue)"
          dot={{ fill: "var(--primary, #db2777)", r: 4, strokeWidth: 0 }}
          activeDot={{ r: 6 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
