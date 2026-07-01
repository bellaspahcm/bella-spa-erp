'use client';

/**
 * KpiTrendChart Component
 * 
 * Displays top 10 KTVs by KPI score
 * Used in Employee Performance Dashboard
 * 
 * Features:
 * - Horizontal bar chart showing KPI scores
 * - Color gradient based on achievement level
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

interface KpiTrendChartProps {
  data: EmployeePerformance[];
}

export function KpiTrendChart({ data }: KpiTrendChartProps) {
  // Sort by KPI score descending and take top 10
  const topKpis = [...data]
    .sort((a, b) => b.kpiScore - a.kpiScore)
    .slice(0, 10)
    .map((ktv) => ({
      name: ktv.ktvName,
      kpiScore: ktv.kpiScore,
      color: getKpiColor(ktv.kpiScore),
    }));

  if (topKpis.length === 0) {
    return (
      <div className="flex items-center justify-center h-[350px] text-gray-500">
        Không có dữ liệu
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={topKpis}
        layout="vertical"
        margin={{
          top: 20,
          right: 30,
          left: 100,
          bottom: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: '#4b5563', fontSize: 12 }}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: '#4b5563', fontSize: 12 }}
          width={90}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
          }}
          formatter={(value) => [`${value} điểm`, 'KPI Score']}
        />
        <Bar dataKey="kpiScore" radius={[0, 8, 8, 0]}>
          {topKpis.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Get color based on KPI score
 */
function getKpiColor(score: number): string {
  if (score >= 90) return '#10b981'; // Green - Excellent
  if (score >= 75) return '#3b82f6'; // Blue - Good
  if (score >= 60) return '#f59e0b'; // Orange - Average
  return '#ef4444'; // Red - Below Average
}
