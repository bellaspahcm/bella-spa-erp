/**
 * Budget Utilization Gauge Chart
 * 
 * Visualizes overall budget utilization as a circular progress gauge.
 * Shows percentage utilization with color-coded status indicators.
 * 
 * Uses custom SVG gauge visualization.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';

interface BudgetUtilizationData {
  totalBudget: number;
  totalActual: number;
  utilization: number;
  categoriesUnder: number;
  categoriesOnTarget: number;
  categoriesOver: number;
}

interface BudgetUtilizationChartProps {
  data: BudgetUtilizationData;
  height?: number;
}

export function BudgetUtilizationChart({ data, height = 250 }: BudgetUtilizationChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  const formatNumber = (value: number, decimals = 0) => {
    return new Intl.NumberFormat('vi-VN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(value);
  };

  // Determine utilization status
  const getUtilizationStatus = (percent: number): { color: string; label: string } => {
    if (percent > 100) return { color: '#ef4444', label: 'Vượt ngân sách' };
    if (percent >= 90) return { color: '#f59e0b', label: 'Gần đạt mức' };
    if (percent >= 75) return { color: '#3b82f6', label: 'Đúng kế hoạch' };
    return { color: '#10b981', label: 'Dưới ngân sách' };
  };

  const utilizationStatus = getUtilizationStatus(data.utilization);

  // Calculate circle properties (semi-circle gauge)
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const progressOffset = circumference - (Math.min(data.utilization, 100) / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center" style={{ height }}>
      {/* Utilization Gauge (Full circle) */}
      <div className="relative w-full max-w-[180px]">
        <svg viewBox="0 0 200 200" className="w-full transform -rotate-90">
          {/* Background Circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="16"
          />
          
          {/* Progress Circle */}
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={utilizationStatus.color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={progressOffset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        </svg>

        {/* Center Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold text-slate-900">
            {formatNumber(data.utilization, 1)}%
          </span>
          <span className="text-xs font-medium text-slate-600 mt-1">Sử dụng</span>
        </div>
      </div>

      {/* Status Badge */}
      <div className="mt-4">
        <span
          className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
          style={{
            backgroundColor: `${utilizationStatus.color}20`,
            color: utilizationStatus.color,
          }}
        >
          {utilizationStatus.label}
        </span>
      </div>

      {/* Budget Summary */}
      <div className="w-full mt-4 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Tổng ngân sách</span>
          <span className="font-bold text-slate-900">{formatCurrency(data.totalBudget)}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-600">Đã chi tiêu</span>
          <span className="font-bold text-orange-600">{formatCurrency(data.totalActual)}</span>
        </div>
      </div>

      {/* Category Status Summary */}
      <div className="w-full mt-4 grid grid-cols-3 gap-2 pt-4 border-t border-slate-100">
        <div className="flex flex-col items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mb-1" />
          <span className="text-xs font-medium text-slate-600">Dưới</span>
          <span className="text-lg font-bold text-green-600">{data.categoriesUnder}</span>
        </div>
        <div className="flex flex-col items-center">
          <AlertTriangle className="h-5 w-5 text-blue-600 mb-1" />
          <span className="text-xs font-medium text-slate-600">Đúng</span>
          <span className="text-lg font-bold text-blue-600">{data.categoriesOnTarget}</span>
        </div>
        <div className="flex flex-col items-center">
          <XCircle className="h-5 w-5 text-red-600 mb-1" />
          <span className="text-xs font-medium text-slate-600">Vượt</span>
          <span className="text-lg font-bold text-red-600">{data.categoriesOver}</span>
        </div>
      </div>
    </div>
  );
}
