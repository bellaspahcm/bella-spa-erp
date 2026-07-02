'use client';

/**
 * Customer Activity Chart (Line Chart)
 * Shows customer activity trends (bookings/revenue) over last 3 periods
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { CustomerActivitySummary } from '@/services/intelligence/customer/queries';

interface CustomerActivityChartProps {
  data: CustomerActivitySummary[];
  height?: number;
}

export function CustomerActivityChart({ data, height = 350 }: CustomerActivityChartProps) {
  // Aggregate activity trends across all customers
  const aggregated = data.reduce((acc, customer) => {
    acc.bookingsLast90 += customer.bookingsLast90Days;
    acc.bookings90180 += customer.bookings90180DaysAgo;
    acc.bookings180270 += customer.bookings180270DaysAgo;
    acc.revenueLast90 += customer.revenueLast90Days;
    acc.revenue90180 += customer.revenue90180DaysAgo;
    acc.revenue180270 += customer.revenue180270DaysAgo;
    return acc;
  }, {
    bookingsLast90: 0,
    bookings90180: 0,
    bookings180270: 0,
    revenueLast90: 0,
    revenue90180: 0,
    revenue180270: 0,
  });

  const chartData = [
    { period: '180-270 ngày trước', bookings: aggregated.bookings180270, revenue: aggregated.revenue180270 },
    { period: '90-180 ngày trước', bookings: aggregated.bookings90180, revenue: aggregated.revenue90180 },
    { period: '90 ngày gần đây', bookings: aggregated.bookingsLast90, revenue: aggregated.revenueLast90 },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          dataKey="period"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
          label={{ value: 'Số booking', angle: -90, position: 'insideLeft' }}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tickFormatter={formatCurrency}
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <Tooltip
          formatter={(value) => {
            if (typeof value === 'number') {
              return formatCurrency(value);
            }
            return value;
          }}
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
          dataKey="bookings"
          name="Số booking"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ fill: '#3b82f6', r: 5 }}
          activeDot={{ r: 7 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="revenue"
          name="Doanh thu"
          stroke="#10b981"
          strokeWidth={3}
          dot={{ fill: '#10b981', r: 5 }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
