'use client';

/**
 * Revenue Breakdown Pie Chart
 * 
 * Shows revenue distribution by source/type with percentages.
 */

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface RevenueBreakdownItem {
  source: string; // e.g., 'Tiền ca', 'Sản phẩm', 'Combo'
  revenue: number;
  percentage: number; // calculated percentage of total
}

interface RevenueBreakdownChartProps {
  data: RevenueBreakdownItem[];
  height?: number;
}

// Color palette for revenue sources
const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/**
 * Revenue Breakdown Pie Chart Component
 * 
 * Displays revenue distribution by source with color-coded slices.
 * Shows percentage labels on slices and detailed info in tooltip.
 * 
 * @param data - Array of revenue items with source, amount, and percentage
 * @param height - Chart height in pixels (default: 300)
 */
export function RevenueBreakdownChart({ data, height = 300 }: RevenueBreakdownChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  const renderLabel = (entry: any) => {
    return `${entry.percentage}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={80}
          fill="#8884d8"
          dataKey="revenue"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
          formatter={(value, entry: any) => {
            const item = data.find(d => d.source === value);
            return `${value} (${item?.percentage || 0}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
