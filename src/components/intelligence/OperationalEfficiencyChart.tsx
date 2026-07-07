'use client';

/**
 * Operational Efficiency Chart Component
 * 
 * Displays KTV utilization, session rating, and completion rate using radial bars
 */

import { RadialBarChart, RadialBar, Legend, ResponsiveContainer } from 'recharts';

interface OperationalEfficiencyChartProps {
  ktvUtilization: number;
  sessionRating: number;
  completionRate: number;
  height?: number;
}

export function OperationalEfficiencyChart({
  ktvUtilization,
  sessionRating,
  completionRate,
  height = 250,
}: OperationalEfficiencyChartProps) {
  const data = [
    {
      name: 'Sử dụng KTV',
      value: ktvUtilization,
      fill: '#06b6d4',
    },
    {
      name: 'Đánh giá',
      value: (sessionRating / 5) * 100, // Convert 5-star to percentage
      fill: '#a855f7',
    },
    {
      name: 'Hoàn thành',
      value: completionRate,
      fill: 'var(--primary, #db2777)',
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="10%"
        outerRadius="90%"
        barSize={20}
        data={data}
        startAngle={90}
        endAngle={-270}
      >
        <RadialBar
          label={{ position: 'insideStart', fill: '#fff', fontSize: 12 }}
          background
          dataKey="value"
        />
        <Legend
          iconSize={10}
          layout="horizontal"
          verticalAlign="bottom"
          align="center"
          wrapperStyle={{ fontSize: '12px' }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
