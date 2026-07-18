'use client';

/**
 * TopEarnersChart Component
 * 
 * Displays top-earning workers with stacked salary components
 * Used in Attendance & Payroll Dashboard
 * 
 * Features:
 * - Stacked bar chart showing base salary, KPI bonus, and session/commission bonus
 * - Top 10 earners by total salary
 * - Dynamic vocabulary based on tenant module configuration
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
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { PayrollSummary } from '@/services/intelligence/hr/queries';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface TopEarnersChartProps {
  data: PayrollSummary[];
}

export function TopEarnersChart({ data }: TopEarnersChartProps) {
  const vocab = useModuleVocabulary();
  const workUnitCommissionKey = `Hoa hồng ${vocab.workUnit.singular.toLowerCase()}`;

  // Sort by total salary descending and take top 10
  const topEarners = [...data]
    .sort((a, b) => b.totalSalary - a.totalSalary)
    .slice(0, 10)
    .map((ktv) => ({
      name: ktv.ktvName,
      'Lương cơ bản': ktv.baseSalary,
      'Thưởng KPI': ktv.kpiBonus,
      [workUnitCommissionKey]: ktv.sessionBonus,
    }));

  if (topEarners.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-gray-500">
        Không có dữ liệu
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={350}>
      <BarChart
        data={topEarners}
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
          angle={-30}
          textAnchor="end"
          height={40}
          tick={{ fill: '#4b5563', fontSize: 12 }}
        />
        <YAxis
          tick={{ fill: '#4b5563', fontSize: 12 }}
          tickFormatter={(value) => {
            if (value >= 1000000) {
              return `${(value / 1000000).toFixed(1)}M`;
            }
            if (value >= 1000) {
              return `${(value / 1000).toFixed(0)}K`;
            }
            return value.toString();
          }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            padding: '12px',
          }}
          formatter={(value) =>
            new Intl.NumberFormat('vi-VN', {
              style: 'currency',
              currency: 'VND',
            }).format(value as number)
          }
        />
        <Legend
          wrapperStyle={{
            paddingTop: '20px',
          }}
        />
        <Bar dataKey="Lương cơ bản" stackId="a" fill="#3b82f6" />
        <Bar dataKey="Thưởng KPI" stackId="a" fill="#10b981" />
        <Bar dataKey={workUnitCommissionKey} stackId="a" fill="#f59e0b" />
      </BarChart>
    </ResponsiveContainer>
  );
}
