'use client';

/**
 * P&L Statement Waterfall Chart
 * 
 * Visualizes profit & loss flow from Revenue → Expenses → Net Profit.
 * Uses a bar chart with custom logic to simulate waterfall behavior.
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PnLData {
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number; // percentage
}

interface PnLStatementChartProps {
  data: PnLData;
  height?: number;
}

/**
 * P&L Statement Waterfall Chart Component
 * 
 * Displays the flow from revenue to profit with color-coded bars:
 * - Green for revenue (positive)
 * - Red for expenses (negative)
 * - Blue/Green for net profit (depending on sign)
 * 
 * @param data - P&L data with revenue, expenses, and profit
 * @param height - Chart height in pixels (default: 300)
 */
export function PnLStatementChart({ data, height = 300 }: PnLStatementChartProps) {
  // Transform data for waterfall visualization
  const chartData = [
    {
      name: 'Doanh thu',
      value: data.totalRevenue,
      fill: '#10b981', // green
    },
    {
      name: 'Chi phí',
      value: data.totalExpenses,
      fill: '#ef4444', // red
    },
    {
      name: 'Lợi nhuận ròng',
      value: Math.abs(data.netProfit),
      fill: data.netProfit >= 0 ? '#3b82f6' : '#ef4444', // blue or red
    },
  ];

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatTooltipCurrency = (value: any, name: any) => {
    const formatted = new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(Number(value));
    
    // Show negative sign for expenses in tooltip
    if (name === 'Chi phí') {
      return [`-${formatted}`, name];
    }
    
    return [formatted, name];
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="name"
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={formatTooltipCurrency}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
