'use client';

/**
 * RFM Matrix Chart (Scatter Plot)
 * Displays customer distribution by RFM scores
 */

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import type { CustomerSegment } from '@/services/intelligence/customer/queries';

interface RFMMatrixChartProps {
  data: CustomerSegment[];
  height?: number;
}

export function RFMMatrixChart({ data, height = 400 }: RFMMatrixChartProps) {
  const chartData = data.map(c => ({
    recency: c.recencyScore,
    frequency: c.frequencyScore,
    monetary: c.monetaryScore,
    name: c.customerName,
    segment: c.segment,
    revenue: c.totalRevenue,
  }));

  const getSegmentColor = (segment: string): string => {
    const colorMap: Record<string, string> = {
      'Champions': '#10b981',
      'Loyal Customers': '#06b6d4',
      'Potential Loyalists': '#8b5cf6',
      'At Risk': '#ef4444',
      'Cannot Lose': '#dc2626',
    };
    return colorMap[segment] || '#6b7280';
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis
          type="number"
          dataKey="recency"
          name="Recency"
          domain={[0, 5]}
          label={{ value: 'Điểm Recency', position: 'insideBottom', offset: -10 }}
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <YAxis
          type="number"
          dataKey="frequency"
          name="Frequency"
          domain={[0, 5]}
          label={{ value: 'Điểm Frequency', angle: -90, position: 'insideLeft' }}
          tick={{ fill: '#64748b', fontSize: 12 }}
        />
        <ZAxis type="number" dataKey="monetary" range={[50, 400]} name="Monetary" />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          content={({ active, payload }) => {
            if (active && payload && payload.length) {
              const data = payload[0].payload;
              return (
                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                  <p className="font-semibold text-sm">{data.name}</p>
                  <p className="text-xs text-gray-600">{data.segment}</p>
                  <p className="text-xs mt-1">R: {data.recency} | F: {data.frequency} | M: {data.monetary}</p>
                </div>
              );
            }
            return null;
          }}
        />
        {['Champions', 'Loyal Customers', 'Potential Loyalists', 'At Risk', 'Cannot Lose'].map((segment) => {
          const segmentData = chartData.filter(d => d.segment === segment);
          return (
            <Scatter
              key={segment}
              name={segment}
              data={segmentData}
              fill={getSegmentColor(segment)}
            />
          );
        })}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
