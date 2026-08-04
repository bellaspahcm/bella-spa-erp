'use client';

/**
 * Revenue by Segment Chart (Bar Chart)
 * Shows total revenue contribution by customer segment
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip} from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import type { SegmentDistribution } from '@/services/intelligence/customer/queries';

interface RevenueBySegmentChartProps {
  data: SegmentDistribution[];
  height?: number;
}

export function RevenueBySegmentChart({ data, height = 350 }: RevenueBySegmentChartProps) {
  const chartData = data
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .map(d => ({
      segment: d.segment,
      revenue: d.totalRevenue,
      count: d.customerCount,
    }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 5, right: 20, left: -15, bottom: 30 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="segment"
          angle={-30}
          textAnchor="end"
          height={40}
          tick={{ fill: '#64748b', fontSize: 11 }}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <Tooltip
          formatter={(value) => {
            if (typeof value === 'number') {
              return formatCurrency(value);
            }
            return value;
          }}
          labelStyle={{ fontWeight: 'bold' }}
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
          }}
        />
        <Bar dataKey="revenue" name="Doanh thu" fill="#10b981" radius={[8, 8, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
