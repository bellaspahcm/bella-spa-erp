'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';

interface GrowthData {
  name: string;
  value: number;
}

interface GrowthIndicatorsChartProps {
  momGrowth: number;
  yoyGrowth: number;
  projectedGrowth: number;
  height?: number;
}

export function GrowthIndicatorsChart({
  momGrowth,
  yoyGrowth,
  projectedGrowth,
  height = 300,
}: GrowthIndicatorsChartProps) {
  const data: GrowthData[] = [
    {
      name: 'Tháng trước',
      value: momGrowth,
    },
    {
      name: 'Năm trước',
      value: yoyGrowth,
    },
    {
      name: 'Dự báo',
      value: projectedGrowth,
    },
  ];

  const getColor = (value: number) => {
    if (value >= 20) return '#10b981'; // Green - Excellent
    if (value >= 10) return '#3b82f6'; // Blue - Good
    if (value >= 0) return '#f59e0b'; // Orange - Fair
    return '#ef4444'; // Red - Poor
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis 
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          formatter={(value) => `${Number(value).toFixed(2)}%`}
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
        <Bar 
          dataKey="value" 
          radius={[8, 8, 0, 0]}
          name="% Tăng trưởng"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={getColor(entry.value)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

