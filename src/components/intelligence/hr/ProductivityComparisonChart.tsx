'use client';

/**
 * ProductivityComparisonChart Component
 * 
 * Displays productivity comparison (sessions vs revenue) for top performers
 * Used in Employee Performance Dashboard
 * 
 * Features:
 * - Scatter plot showing sessions completed vs revenue contribution
 * - Bubble size represents overall performance score
 * - Top 15 performers only (to avoid clutter)
 * - Vietnamese localization
 * - Responsive design with Recharts
 */

import React from 'react';
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
} from 'recharts';
import type { EmployeePerformance } from '@/services/intelligence/hr/queries';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface ProductivityComparisonChartProps {
  data: EmployeePerformance[];
}

export function ProductivityComparisonChart({ data }: ProductivityComparisonChartProps) {
  const vocab = useModuleVocabulary();

  // Sort by performance score and take top 15 to avoid clutter
  const topPerformers = [...data]
    .sort((a, b) => b.overallPerformanceScore - a.overallPerformanceScore)
    .slice(0, 15)
    .map((ktv) => ({
      name: ktv.ktvName,
      sessions: ktv.totalSessionsCompleted,
      revenue: ktv.totalRevenueContributed / 1000000, // Convert to millions for better display
      score: ktv.overallPerformanceScore,
    }));

  if (topPerformers.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-gray-500">
        Không có dữ liệu
      </div>
    );
  }

  const workUnitLabel = `${vocab.workUnit.singular} hoàn thành`;
  const workUnitShortLabel = `Số ${vocab.workUnit.singular.toLowerCase()}`;

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ScatterChart
        margin={{
          top: 20,
          right: 20,
          left: -15,
          bottom: 30,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis
          type="number"
          dataKey="sessions"
          name={workUnitLabel}
          tick={{ fill: '#4b5563', fontSize: 12 }}
          height={40}
        />
        <YAxis
          type="number"
          dataKey="revenue"
          name="Doanh thu"
          tick={{ fill: '#4b5563', fontSize: 12 }}
        />
        <ZAxis type="number" dataKey="score" range={[100, 1000]} name="Điểm hiệu suất" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
          }}
          formatter={(value, name) => {
            if (name === workUnitLabel) return [value, workUnitShortLabel];
            if (name === 'Doanh thu') return [`${Number(value).toFixed(1)}M VNĐ`, 'Doanh thu'];
            if (name === 'Điểm hiệu suất') return [Number(value).toFixed(1), 'Điểm'];
            return [value, name];
          }}
          labelFormatter={(label) => `${vocab.worker.short}: ${topPerformers[label]?.name || label}`}
        />
        <Scatter
          name={vocab.worker.short}
          data={topPerformers}
          fill="#8b5cf6"
          fillOpacity={0.6}
        />
      </ScatterChart>
    </ResponsiveContainer>
  );
}
