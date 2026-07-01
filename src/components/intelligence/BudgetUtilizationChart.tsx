'use client';

/**
 * Budget Utilization Radial/Gauge Chart
 * 
 * Shows overall budget utilization percentage:
 * - Under budget (0-85%): Green zone
 * - On target (85-100%): Blue zone
 * - Over budget (>100%): Red zone
 * 
 * Displays utilization percentage in center with category counts below.
 */

import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { TrendingDown, Target, TrendingUp } from 'lucide-react';

interface BudgetUtilizationData {
  totalBudget: number;
  totalActual: number;
  utilization: number; // percentage (actual / budget * 100)
  categoriesUnder: number; // count
  categoriesOnTarget: number; // count
  categoriesOver: number; // count
}

interface BudgetUtilizationChartProps {
  data: BudgetUtilizationData;
  height?: number;
}

/**
 * Budget Utilization Radial Chart Component
 * 
 * Displays budget utilization as a radial gauge with color-coded zones.
 * Shows utilization percentage prominently in the center with detailed metrics below.
 * 
 * @param data - Budget utilization metrics including category status counts
 * @param height - Chart height in pixels (default: 250)
 */
export function BudgetUtilizationChart({ data, height = 250 }: BudgetUtilizationChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  // Determine status based on utilization
  const getStatus = (): 'under' | 'on_target' | 'over' => {
    if (data.utilization < 85) return 'under';
    if (data.utilization <= 100) return 'on_target';
    return 'over';
  };

  const getStatusColor = (status: 'under' | 'on_target' | 'over'): string => {
    switch (status) {
      case 'under': return '#10b981';
      case 'on_target': return '#3b82f6';
      case 'over': return '#ef4444';
    }
  };

  const getStatusLabel = (status: 'under' | 'on_target' | 'over'): string => {
    switch (status) {
      case 'under': return 'Dưới ngân sách';
      case 'on_target': return 'Đúng mục tiêu';
      case 'over': return 'Vượt ngân sách';
    }
  };

  const getStatusIcon = (status: 'under' | 'on_target' | 'over') => {
    switch (status) {
      case 'under': return <TrendingDown className="h-5 w-5" />;
      case 'on_target': return <Target className="h-5 w-5" />;
      case 'over': return <TrendingUp className="h-5 w-5" />;
    }
  };

  const status = getStatus();
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  // Prepare chart data (utilization as percentage, capped at 150% for display)
  const displayUtilization = Math.min(data.utilization, 150);

  const chartData = [
    {
      name: 'Utilization',
      value: displayUtilization,
      fill: statusColor,
    },
  ];

  return (
    <div className="flex flex-col items-center">
      {/* Radial Chart */}
      <ResponsiveContainer width="100%" height={height}>
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="60%"
          outerRadius="90%"
          data={chartData}
          startAngle={180}
          endAngle={0}
        >
          <RadialBar
            background={{ fill: '#f1f5f9' }}
            dataKey="value"
            cornerRadius={10}
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center Display - Utilization Percentage */}
      <div className="absolute" style={{ top: `${height * 0.5}px` }}>
        <div className="flex flex-col items-center">
          <p className="text-4xl font-bold text-slate-900">
            {data.utilization.toFixed(1)}%
          </p>
          <p className="text-sm text-slate-600">sử dụng</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full`} style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
        {getStatusIcon(status)}
        <span className="text-sm font-medium">{statusLabel}</span>
      </div>

      {/* Budget Summary */}
      <div className="w-full mt-6 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Tổng ngân sách:</span>
          <span className="font-medium text-blue-600">{formatCurrency(data.totalBudget)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Chi tiêu thực tế:</span>
          <span className={`font-medium ${status === 'over' ? 'text-red-600' : 'text-slate-900'}`}>
            {formatCurrency(data.totalActual)}
          </span>
        </div>
      </div>

      {/* Category Status Counts */}
      <div className="w-full mt-4 pt-4 border-t border-slate-100">
        <p className="text-xs text-slate-600 mb-2">Danh mục theo trạng thái:</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-green-50 rounded-lg p-2">
            <p className="text-lg font-bold text-green-600">{data.categoriesUnder}</p>
            <p className="text-xs text-green-700">Dưới</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-2">
            <p className="text-lg font-bold text-blue-600">{data.categoriesOnTarget}</p>
            <p className="text-xs text-blue-700">Đúng</p>
          </div>
          <div className="bg-red-50 rounded-lg p-2">
            <p className="text-lg font-bold text-red-600">{data.categoriesOver}</p>
            <p className="text-xs text-red-700">Vượt</p>
          </div>
        </div>
      </div>
    </div>
  );
}
