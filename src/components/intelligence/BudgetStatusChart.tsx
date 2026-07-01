'use client';

/**
 * Budget Status Pie Chart
 * 
 * Shows distribution of budget status across categories:
 * - Under Budget (green)
 * - On Target (blue)
 * - Over Budget (red)
 */

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BudgetStatusItem {
  status: 'under' | 'on_target' | 'over'; // budget status
  count: number; // number of categories
  percentage: number; // percentage of total categories
}

interface BudgetStatusChartProps {
  data: BudgetStatusItem[];
  height?: number;
}

// Status labels (Vietnamese)
const STATUS_LABELS: Record<string, string> = {
  'under': 'Dưới ngân sách',
  'on_target': 'Đúng mục tiêu',
  'over': 'Vượt ngân sách',
};

// Color mapping for status
const STATUS_COLORS: Record<string, string> = {
  'under': '#10b981',
  'on_target': '#3b82f6',
  'over': '#ef4444',
};

/**
 * Budget Status Pie Chart Component
 * 
 * Displays the distribution of expense categories by their budget status
 * (under/on target/over budget) with color-coded segments.
 * 
 * @param data - Array of status items with counts and percentages
 * @param height - Chart height in pixels (default: 250)
 */
export function BudgetStatusChart({ data, height = 250 }: BudgetStatusChartProps) {
  // Transform data for pie chart display
  const chartData = data.map(item => ({
    name: STATUS_LABELS[item.status] || item.status,
    value: item.count,
    percentage: item.percentage,
    status: item.status,
  }));

  const renderLabel = (entry: any) => {
    return `${entry.percentage.toFixed(0)}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.status]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(value, name, props) => [
            `${value} danh mục (${props.payload.percentage.toFixed(1)}%)`,
            name
          ]}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          wrapperStyle={{ fontSize: '12px' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
