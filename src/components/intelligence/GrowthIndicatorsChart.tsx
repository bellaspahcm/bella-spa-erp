'use client';

/**
 * Growth Indicators Chart Component
 * 
 * Displays MoM and YoY growth comparison using bar chart
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';

interface GrowthIndicatorsChartProps {
  momGrowth: number;
  yoyGrowth: number;
  projectedGrowth?: number;
  height?: number;
}

export function GrowthIndicatorsChart({
  momGrowth,
  yoyGrowth,
  projectedGrowth = 15,
  height = 200,
}: GrowthIndicatorsChartProps) {
  const data = [
    {
      name: 'MoM',
      value: momGrowth,
      color: momGrowth >= 0 ? '#10b981' : '#ef4444',
    },
    {
      name: 'YoY',
      value: yoyGrowth,
      color: yoyGrowth >= 0 ? '#06b6d4' : '#ef4444',
    },
    {
      name: 'Dự báo',
      value: projectedGrowth,
      color: '#a855f7',
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 15, right: 5, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.03)" vertical={false} />
        <XAxis 
          dataKey="name" 
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
          tickFormatter={(value) => `${value}%`}
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
            if (typeof value !== 'number') return ['', 'Tăng trưởng'];
            return [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'Tăng trưởng'];
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]} barSize={28}>
          {data.map((entry, index) => {
            const fill = entry.name === 'Dự báo' ? 'var(--primary, #db2777)' : entry.color;
            return <Cell key={`cell-${index}`} fill={fill} />;
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
