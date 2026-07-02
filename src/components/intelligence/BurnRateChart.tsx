/**
 * Burn Rate Gauge Chart
 * 
 * Visualizes monthly burn rate and runway in a semi-circular gauge.
 * Shows current cash balance and estimated runway months.
 * 
 * Uses custom SVG gauge visualization (Recharts doesn't have native gauge).
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';

interface BurnRateData {
  monthlyBurnRate: number;
  runwayMonths: number;
  currentCash: number;
  averageDailyCashFlow: number;
}

interface BurnRateChartProps {
  data: BurnRateData;
  height?: number;
}

export function BurnRateChart({ data, height = 250 }: BurnRateChartProps) {
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

  // Determine runway health status
  const getRunwayStatus = (months: number): { color: string; label: string } => {
    if (months >= 12) return { color: '#10b981', label: 'Tốt' };
    if (months >= 6) return { color: '#f59e0b', label: 'Cảnh báo' };
    return { color: '#ef4444', label: 'Nguy hiểm' };
  };

  const runwayStatus = getRunwayStatus(data.runwayMonths);

  return (
    <div className="flex flex-col items-center justify-center" style={{ height }}>
      {/* Runway Gauge (Semi-circle) */}
      <div className="relative w-full max-w-[200px]">
        <svg viewBox="0 0 200 120" className="w-full">
          {/* Background Arc */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="20"
            strokeLinecap="round"
          />
          
          {/* Runway Arc (colored based on health) */}
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={runwayStatus.color}
            strokeWidth="20"
            strokeLinecap="round"
            strokeDasharray={`${Math.min(data.runwayMonths / 24, 1) * 251.2} 251.2`}
            style={{ transition: 'stroke-dasharray 0.5s ease' }}
          />

          {/* Center Text - Runway Months */}
          <text
            x="100"
            y="80"
            textAnchor="middle"
            fontSize="36"
            fontWeight="700"
            fill="#0f172a"
          >
            {formatNumber(data.runwayMonths, 1)}
          </text>
          <text
            x="100"
            y="100"
            textAnchor="middle"
            fontSize="14"
            fontWeight="600"
            fill="#64748b"
          >
            tháng
          </text>
        </svg>

        {/* Status Badge */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider"
            style={{
              backgroundColor: `${runwayStatus.color}20`,
              color: runwayStatus.color,
            }}
          >
            {runwayStatus.label}
          </span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="w-full mt-6 space-y-3">
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <span className="text-sm font-medium text-slate-600">Tiền mặt hiện tại</span>
          <span className="text-sm font-bold text-slate-900">
            {formatCurrency(data.currentCash)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <span className="text-sm font-medium text-slate-600">Tốc độ đốt tiền/tháng</span>
          <span className="text-sm font-bold text-red-600">
            {formatCurrency(data.monthlyBurnRate)}
          </span>
        </div>

        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <span className="text-sm font-medium text-slate-600">Dòng tiền TB/ngày</span>
          <span className={`text-sm font-bold ${data.averageDailyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.averageDailyCashFlow)}
          </span>
        </div>
      </div>
    </div>
  );
}
