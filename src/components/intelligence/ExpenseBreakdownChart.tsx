'use client';

/**
 * Expense Breakdown Pie Chart
 * 
 * Shows expense distribution by category with percentages.
 */

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface ExpenseBreakdownItem {
  category: string; // e.g., 'Lương KTV', 'Chi phí vận hành', 'Marketing'
  expense: number;
  percentage: number; // calculated percentage of total
}

interface ExpenseBreakdownChartProps {
  data: ExpenseBreakdownItem[];
  height?: number;
}

// Color palette for expense categories (red/orange shades)
const COLORS = ['#ef4444', '#f59e0b', '#84cc16', '#06b6d4', '#8b5cf6', '#ec4899'];

/**
 * Expense Breakdown Pie Chart Component
 * 
 * Displays expense distribution by category with color-coded slices.
 * Shows percentage labels on slices and detailed info in tooltip.
 * 
 * @param data - Array of expense items with category, amount, and percentage
 * @param height - Chart height in pixels (default: 300)
 */
export function ExpenseBreakdownChart({ data, height = 300 }: ExpenseBreakdownChartProps) {
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
          dataKey="expense"
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
            const item = data.find(d => d.category === value);
            return `${value} (${item?.percentage || 0}%)`;
          }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
