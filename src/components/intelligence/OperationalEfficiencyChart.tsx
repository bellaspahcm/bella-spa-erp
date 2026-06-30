'use client';

import { RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer } from 'recharts';

interface EfficiencyMetric {
  name: string;
  value: number;
  fill: string;
}

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
  height = 300,
}: OperationalEfficiencyChartProps) {
  const data: EfficiencyMetric[] = [
    {
      name: 'Hoàn thành',
      value: completionRate,
      fill: '#3b82f6',
    },
    {
      name: 'Đánh giá',
      value: (sessionRating / 5) * 100,
      fill: '#8b5cf6',
    },
    {
      name: 'Sử dụng KTV',
      value: ktvUtilization,
      fill: '#06b6d4',
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <RadialBarChart
        cx="50%"
        cy="50%"
        innerRadius="20%"
        outerRadius="90%"
        data={data}
        startAngle={180}
        endAngle={0}
      >
        <PolarAngleAxis
          type="number"
          domain={[0, 100]}
          angleAxisId={0}
          tick={false}
        />
        <RadialBar
          background
          dataKey="value"
          cornerRadius={10}
          label={{
            position: 'insideStart',
            fill: '#fff',
            fontSize: 12,
            formatter: (value) => `${Number(value || 0).toFixed(0)}%`,
          }}
        />
      </RadialBarChart>
    </ResponsiveContainer>
  );
}
