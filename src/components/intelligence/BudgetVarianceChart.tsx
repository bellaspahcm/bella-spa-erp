'use client';

/**
 * Budget Variance Grouped Bar Chart
 * 
 * Shows budget vs actual spending by category with:
 * - Blue bars for budgeted amounts
 * - Color-coded bars for actual spending (green if under, red if over)
 * - Variance display in tooltip
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface BudgetVarianceItem {
  category: string; // e.g., 'Lương KTV', 'Chi phí vận hành', 'Marketing'
  budgetAmount: number;
  actualAmount: number;
  variance: number; // difference (actual - budget)
  variancePercent: number; // percentage variance
  status: 'under' | 'on_target' | 'over'; // budget status
}

interface BudgetVarianceChartProps {
  data: BudgetVarianceItem[];
  height?: number;
}

/**
 * Budget Variance Grouped Bar Chart Component
 * 
 * Displays budgeted amounts vs actual spending side-by-side
 * for each expense category with color-coded variance indicators.
 * 
 * @param data - Array of categories with budget and actual amounts
 * @param height - Chart height in pixels (default: 350)
 */
export function BudgetVarianceChart({ data, height = 350 }: BudgetVarianceChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatTooltipCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  // Transform data for chart display
  const chartData = data.map(item => ({
    category: item.category,
    budget: item.budgetAmount,
    actual: item.actualAmount,
    variance: item.variance,
    variancePercent: item.variancePercent,
    status: item.status,
  }));

  // Custom bar shape with dynamic color based on status
  const CustomBar = (props: any) => {
    const { fill, x, y, width, height, payload } = props;
    
    // Determine actual bar color based on status
    let actualColor = '#3b82f6'; // default blue (on target)
    if (payload.status === 'under') actualColor = '#10b981'; // green
    if (payload.status === 'over') actualColor = '#ef4444'; // red
    
    return <rect x={x} y={y} width={width} height={height} fill={actualColor} />;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="category"
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'Ngân sách') return [formatTooltipCurrency(Number(value)), name];
            if (name === 'Thực tế') return [formatTooltipCurrency(Number(value)), name];
            return [formatTooltipCurrency(Number(value)), name];
          }}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;

            const budget = payload.find(p => p.dataKey === 'budget')?.value as number || 0;
            const actual = payload.find(p => p.dataKey === 'actual')?.value as number || 0;
            const variance = payload.find(p => p.dataKey === 'variance')?.value as number || 0;
            const variancePercent = payload.find(p => p.dataKey === 'variancePercent')?.value as number || 0;
            const status = payload[0]?.payload?.status as string;

            const statusLabels = {
              'under': 'Dưới ngân sách',
              'on_target': 'Đúng mục tiêu',
              'over': 'Vượt ngân sách',
            };

            return (
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
                <p className="font-medium text-slate-900 mb-2">{label}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-blue-600">Ngân sách:</span>
                    <span className="font-medium">{formatTooltipCurrency(budget)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-orange-600">Thực tế:</span>
                    <span className="font-medium">{formatTooltipCurrency(actual)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200">
                    <span className={variance >= 0 ? 'text-red-600' : 'text-green-600'}>Phương sai:</span>
                    <span className="font-bold">
                      {formatTooltipCurrency(Math.abs(variance))} ({variance >= 0 ? '+' : ''}{variancePercent.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Trạng thái:</span>
                    <span className={`font-medium ${
                      status === 'under' ? 'text-green-600' :
                      status === 'over' ? 'text-red-600' : 'text-blue-600'
                    }`}>
                      {statusLabels[status as keyof typeof statusLabels]}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
        <Bar
          dataKey="budget"
          fill="#3b82f6"
          name="Ngân sách"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="actual"
          shape={CustomBar}
          name="Thực tế"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
