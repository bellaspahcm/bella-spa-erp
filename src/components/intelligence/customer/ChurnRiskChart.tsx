'use client';

/**
 * Churn Risk Distribution Chart (Bar Chart)
 * Shows count of customers by churn risk level
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { CustomerActivitySummary } from '@/services/intelligence/customer/queries';

interface ChurnRiskChartProps {
  data: CustomerActivitySummary[];
  height?: number;
}

const RISK_COLORS: Record<string, string> = {
  'High': '#ef4444',
  'Medium': '#f59e0b',
  'Low': '#10b981',
};

export function ChurnRiskChart({ data, height = 350 }: ChurnRiskChartProps) {
  const riskCounts = data.reduce((acc, customer) => {
    const level = customer.churnRiskLevel;
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const chartData = [
    { level: 'High', count: riskCounts['High'] || 0, label: 'Rủi ro cao' },
    { level: 'Medium', count: riskCounts['Medium'] || 0, label: 'Rủi ro trung bình' },
    { level: 'Low', count: riskCounts['Low'] || 0, label: 'Rủi ro thấp' },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="label"
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          tick={{ fill: '#64748b', fontSize: 12 }}
          label={{ value: 'Số KH', angle: -90, position: 'insideLeft' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        />
        <Bar dataKey="count" name="Số khách hàng" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.level]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
