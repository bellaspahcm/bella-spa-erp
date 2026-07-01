'use client';

/**
 * Variance Trend Multi-line Chart
 * 
 * Shows variance trends for top categories over time:
 * - Multiple lines (one per category, max 5)
 * - Reference line at 0% (break-even point)
 * - Color-coded category lines
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

interface VarianceTrendDataPoint {
  month: string; // 'Jan 26', 'Feb 26', etc.
  [category: string]: string | number; // dynamic keys for each category variance %
}

interface VarianceTrendChartProps {
  data: VarianceTrendDataPoint[];
  categories: string[]; // list of category names to display
  height?: number;
}

// Color palette for category lines
const CATEGORY_COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'];

/**
 * Variance Trend Multi-line Chart Component
 * 
 * Displays variance percentage trends for multiple expense categories
 * over time with a reference line at 0% for break-even visualization.
 * 
 * @param data - Array of monthly data points with variance % for each category
 * @param categories - List of category names to display (max 5)
 * @param height - Chart height in pixels (default: 300)
 */
export function VarianceTrendChart({ data, categories, height = 300 }: VarianceTrendChartProps) {
  const formatPercent = (value: number) => {
    return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        
        <XAxis
          dataKey="month"
          stroke="#64748b"
          fontSize={12}
        />
        
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={formatPercent}
        />

        {/* Reference line at 0% (break-even) */}
        <ReferenceLine
          y={0}
          stroke="#94a3b8"
          strokeDasharray="5 5"
          strokeWidth={1}
        />
        
        <Tooltip
          formatter={(value, name) => [formatPercent(Number(value)), name]}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />

        {/* Generate line for each category */}
        {categories.slice(0, 5).map((category, index) => (
          <Line
            key={category}
            type="monotone"
            dataKey={category}
            stroke={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
            name={category}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
