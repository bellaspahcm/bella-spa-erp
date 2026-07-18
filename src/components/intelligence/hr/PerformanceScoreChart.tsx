'use client';

/**
 * PerformanceScoreChart Component
 * 
 * Displays performance score distribution across all KTVs
 * Used in Employee Performance Dashboard
 * 
 * Features:
 * - Bar chart showing count of KTVs in each performance tier
 * - Color-coded by performance level (Excellent, Good, Average, Below Average)
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
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface PerformanceScoreChartProps {
  data: EmployeePerformance[];
}

export function PerformanceScoreChart({ data }: PerformanceScoreChartProps) {
  const vocab = useModuleVocabulary();

  // Group KTVs by performance tier
  const tiers = [
    { name: 'Xuất sắc (90-100)', min: 90, max: 100, color: '#10b981', count: 0 },
    { name: 'Tốt (75-89)', min: 75, max: 89, color: '#3b82f6', count: 0 },
    { name: 'Trung bình (60-74)', min: 60, max: 74, color: '#f59e0b', count: 0 },
    { name: 'Dưới mức (0-59)', min: 0, max: 59, color: '#ef4444', count: 0 },
  ];

  data.forEach((ktv) => {
    const score = ktv.overallPerformanceScore;
    const tier = tiers.find((t) => score >= t.min && score <= t.max);
    if (tier) {
      tier.count++;
    }
  });

  const chartData = tiers.map((tier) => ({
    name: tier.name,
    count: tier.count,
    color: tier.color,
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
          right: 20,
          left: -15,
          bottom: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          dataKey="name"
          angle={-15}
          textAnchor="end"
          height={40}
          tick={{ fill: '#4b5563', fontSize: 12 }}
        />
        <YAxis
          tick={{ fill: '#4b5563', fontSize: 12 }}
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
