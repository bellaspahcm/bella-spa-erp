'use client';

/**
 * SalaryDistributionChart Component
 * 
 * Displays aggregated salary component distribution across all KTVs
 * Used in Attendance & Payroll Dashboard
 * 
 * Features:
 * - Bar chart showing total amounts for each salary component
 * - Base salary, KPI bonus, session bonus, deductions breakdown
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
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { PayrollSummary } from '@/services/intelligence/hr/queries';
import { useModuleVocabulary } from '@/hooks/useModuleVocabulary';

interface SalaryDistributionChartProps {
  data: PayrollSummary[];
}

export function SalaryDistributionChart({ data }: SalaryDistributionChartProps) {
  const vocab = useModuleVocabulary();

  // Aggregate all salary components
  const totals = data.reduce(
    (acc, ktv) => ({
      baseSalary: acc.baseSalary + ktv.baseSalary,
      kpiBonus: acc.kpiBonus + ktv.kpiBonus,
      sessionBonus: acc.sessionBonus + ktv.sessionBonus,
      deductions: acc.deductions + ktv.violationsDeduction,
    }),
    { baseSalary: 0, kpiBonus: 0, sessionBonus: 0, deductions: 0 }
  );

  const chartData = [
    {
      name: 'Lương cơ bản',
      value: totals.baseSalary,
      color: '#3b82f6',
    },
    {
      name: 'Thưởng KPI',
      value: totals.kpiBonus,
      color: '#10b981',
    },
    {
      name: `Hoa hồng ${vocab.workUnit.singular.toLowerCase()}`,
      value: totals.sessionBonus,
      color: '#f59e0b',
    },
    {
      name: 'Trừ vi phạm',
      value: totals.deductions,
      color: '#ef4444',
    },
  ].filter(item => Math.abs(item.value) > 0);

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
          tick={{ fill: '#4b5563', fontSize: 12 }}
          angle={-15}
          textAnchor="end"
          height={40}
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
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
