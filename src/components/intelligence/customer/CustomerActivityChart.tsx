'use client';

/**
 * Customer Activity Chart (Line Chart)
 * Shows customer activity trends (simplified version for basic churn data)
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ChurnRiskAnalysis } from '@/services/intelligence/customer/queries-simple';

interface CustomerActivityChartProps {
  data: ChurnRiskAnalysis[];
  height?: number;
}

export function CustomerActivityChart({ data, height = 350 }: CustomerActivityChartProps) {
  // For simplified version, show basic metrics by risk level
  const aggregated = data.reduce((acc, customer) => {
    const level = customer.churnRiskLevel;
    if (!acc[level]) {
      acc[level] = { count: 0, totalRevenue: 0, avgRiskScore: 0 };
    }
    acc[level].count += 1;
    acc[level].totalRevenue += customer.totalRevenue;
    acc[level].avgRiskScore += customer.churnRiskScore;
    return acc;
  }, {} as Record<string, { count: number; totalRevenue: number; avgRiskScore: number }>);

  // Calculate averages
  Object.keys(aggregated).forEach(level => {
    if (aggregated[level].count > 0) {
      aggregated[level].avgRiskScore = aggregated[level].avgRiskScore / aggregated[level].count;
    }
  });

  const chartData = [
    { 
      level: 'Rủi ro thấp', 
      customers: aggregated['Low']?.count || 0,
      avgScore: aggregated['Low']?.avgRiskScore || 0,
    },
    { 
      level: 'Rủi ro trung bình', 
      customers: aggregated['Medium']?.count || 0,
      avgScore: aggregated['Medium']?.avgRiskScore || 0,
    },
    { 
      level: 'Rủi ro cao', 
      customers: aggregated['High']?.count || 0,
      avgScore: aggregated['High']?.avgRiskScore || 0,
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="level"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
          label={{ value: 'Số KH', angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
          label={{ value: 'Điểm rủi ro TB', angle: 90, position: 'insideRight' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        />
        <Legend wrapperStyle={{ paddingTop: '20px' }} />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="customers"
          name="Số khách hàng"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ fill: '#3b82f6', r: 5 }}
          activeDot={{ r: 7 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgScore"
          name="Điểm rủi ro trung bình"
          stroke="#ef4444"
          strokeWidth={3}
          dot={{ fill: '#ef4444', r: 5 }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
