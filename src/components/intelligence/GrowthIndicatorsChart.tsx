'use client';

/**
 * Growth Indicators Chart Component
 * 
 * Displays MoM and YoY growth comparison using bar chart
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#64748b"
          style={{ fontSize: '12px' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value) => {
            if (typeof value !== 'number') return ['', 'Tăng trưởng'];
            return [`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`, 'Tăng trưởng'];
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
