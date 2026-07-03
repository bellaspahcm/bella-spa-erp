'use client';

/**
 * LTV Distribution Chart (Histogram)
 * Shows distribution of customers across LTV value ranges
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CustomerLTV } from '@/services/intelligence/customer/queries-simple';

interface LtvDistributionChartProps {
  data: CustomerLTV[];
  height?: number;
}

export function LtvDistributionChart({ data, height = 350 }: LtvDistributionChartProps) {
  // Create LTV buckets
  const buckets = [
    { range: '0-5M', min: 0, max: 5000000, count: 0 },
    { range: '5-10M', min: 5000000, max: 10000000, count: 0 },
    { range: '10-20M', min: 10000000, max: 20000000, count: 0 },
    { range: '20-50M', min: 20000000, max: 50000000, count: 0 },
    { range: '50M+', min: 50000000, max: Infinity, count: 0 },
  ];

  data.forEach(customer => {
    const ltv = customer.lifetimeRevenue;
    const bucket = buckets.find(b => ltv >= b.min && ltv < b.max);
    if (bucket) bucket.count++;
  });

  const chartData = buckets.map(b => ({
    range: b.range,
    count: b.count,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="range"
          tick={{ fill: '#64748b', fontSize: 12 }}
          label={{ value: 'Khoảng LTV', position: 'insideBottom', offset: -5 }}
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
        <Bar dataKey="count" name="Số khách hàng" fill="#3b82f6" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
