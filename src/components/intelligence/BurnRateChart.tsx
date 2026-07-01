'use client';

/**
 * Burn Rate Radial/Gauge Chart
 * 
 * Shows monthly burn rate and runway health status:
 * - Critical (0-3 months): Red zone
 * - Warning (3-6 months): Orange zone
 * - Healthy (6+ months): Green zone
 * 
 * Displays runway months in center with supporting metrics below.
 */

import { RadialBarChart, RadialBar, Legend, ResponsiveContainer } from 'recharts';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface BurnRateData {
  monthlyBurnRate: number; // negative value (cash burned per month)
  runwayMonths: number; // months until cash runs out
  currentCash: number;
  averageDailyCashFlow: number;
}

interface BurnRateChartProps {
  data: BurnRateData;
  height?: number;
}

/**
 * Burn Rate Radial Chart Component
 * 
 * Displays burn rate health status as a radial gauge with color-coded zones.
 * Shows runway months prominently in the center with detailed metrics below.
 * 
 * @param data - Burn rate metrics including runway and daily cash flow
 * @param height - Chart height in pixels (default: 250)
 */
export function BurnRateChart({ data, height = 250 }: BurnRateChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  // Determine status based on runway
  const getStatus = (): 'critical' | 'warning' | 'healthy' => {
    if (data.runwayMonths < 3) return 'critical';
    if (data.runwayMonths < 6) return 'warning';
    return 'healthy';
  };

  const getStatusColor = (status: 'critical' | 'warning' | 'healthy'): string => {
    switch (status) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'healthy': return '#10b981';
    }
  };

  const getStatusLabel = (status: 'critical' | 'warning' | 'healthy'): string => {
    switch (status) {
      case 'critical': return 'Nguy hiểm';
      case 'warning': return 'Cảnh báo';
      case 'healthy': return 'Khỏe mạnh';
    }
  };

  const getStatusIcon = (status: 'critical' | 'warning' | 'healthy') => {
    switch (status) {
      case 'critical': return <XCircle className="h-5 w-5" />;
      case 'warning': return <AlertTriangle className="h-5 w-5" />;
      case 'healthy': return <CheckCircle className="h-5 w-5" />;
    }
  };

  const status = getStatus();
  const statusColor = getStatusColor(status);
  const statusLabel = getStatusLabel(status);

  // Prepare chart data (runway as percentage of 12 months max)
  const runwayPercent = Math.min((data.runwayMonths / 12) * 100, 100);

  const chartData = [
    {
      name: 'Runway',
      value: runwayPercent,
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

      {/* Center Display - Runway Months */}
      <div className="absolute" style={{ top: `${height * 0.5}px` }}>
        <div className="flex flex-col items-center">
          <p className="text-4xl font-bold text-slate-900">
            {data.runwayMonths.toFixed(1)}
          </p>
          <p className="text-sm text-slate-600">tháng</p>
        </div>
      </div>

      {/* Status Badge */}
      <div className={`flex items-center gap-2 mt-4 px-3 py-1.5 rounded-full`} style={{ backgroundColor: `${statusColor}20`, color: statusColor }}>
        {getStatusIcon(status)}
        <span className="text-sm font-medium">{statusLabel}</span>
      </div>

      {/* Metrics */}
      <div className="w-full mt-6 space-y-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Tốc độ đốt tiền/tháng:</span>
          <span className="font-medium text-red-600">{formatCurrency(Math.abs(data.monthlyBurnRate))}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Tiền mặt hiện tại:</span>
          <span className="font-medium text-slate-900">{formatCurrency(data.currentCash)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-600">Dòng tiền TB/ngày:</span>
          <span className={`font-medium ${data.averageDailyCashFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(data.averageDailyCashFlow)}
          </span>
        </div>
      </div>
    </div>
  );
}
