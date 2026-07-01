'use client';

/**
 * RatingDistributionChart Component
 * 
 * Displays star rating distribution across all KTVs
 * Used in Employee Performance Dashboard
 * 
 * Features:
 * - Bar chart showing count of KTVs in each rating bracket
 * - Color-coded by rating level
 * - Vietnamese localization
 * - Responsive design with Recharts
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { EmployeePerformance } from '@/services/intelligence/hr/queries';

interface RatingDistributionChartProps {
  data: EmployeePerformance[];
}

export function RatingDistributionChart({ data }: RatingDistributionChartProps) {
  // Group KTVs by rating brackets
  const brackets = [
    { name: '4.5-5.0 ⭐', min: 4.5, max: 5.0, color: '#fbbf24', count: 0 },
    { name: '4.0-4.4 ⭐', min: 4.0, max: 4.4, color: '#60a5fa', count: 0 },
    { name: '3.5-3.9 ⭐', min: 3.5, max: 3.9, color: '#34d399', count: 0 },
    { name: '3.0-3.4 ⭐', min: 3.0, max: 3.4, color: '#fb923c', count: 0 },
    { name: 'Dưới 3.0 ⭐', min: 0, max: 2.9, color: '#f87171', count: 0 },
  ];

  data.forEach((ktv) => {
    const rating = ktv.avgStarRating;
    const bracket = brackets.find((b) => rating >= b.min && rating <= b.max);
    if (bracket) {
      bracket.count++;
    }
  });

  const chartData = brackets.map((bracket) => ({
    name: bracket.name,
    count: bracket.count,
    color: bracket.color,
  }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        Không có dữ liệu
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 40,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          tick={{ fill: '#4b5563', fontSize: 12 }}
          angle={-15}
          textAnchor="end"
          height={60}
        />
        <YAxis
          tick={{ fill: '#4b5563', fontSize: 12 }}
          label={{ value: 'Số KTV', angle: -90, position: 'insideLeft', style: { fill: '#4b5563' } }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
          }}
        />
        <Bar dataKey="count" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
