/**
 * Cash Flow Forecast Chart
 * 
 * Visualizes projected cash flow with confidence bands.
 * Shows predicted values with upper/lower bounds as area fill.
 * 
 * Uses Recharts ComposedChart with Line and Area components.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend, } from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';

interface ForecastDataPoint {
  month: string;
  projected: number;
  upper: number;
  lower: number;
  cumulative: number;
}

interface CashFlowForecastChartProps {
  data: ForecastDataPoint[];
  height?: number;
}

export function CashFlowForecastChart({ data, height = 300 }: CashFlowForecastChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value);
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 10, right: 20, left: -15, bottom: 15 }}
      >
        <defs>
          <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value, name) => {
            const labels: Record<string, string> = {
              projected: 'Dự báo',
              upper: 'Mức cao',
              lower: 'Mức thấp',
              cumulative: 'Tích lũy',
            };
            const numValue = typeof value === 'number' ? value : 0;
            return [formatCurrency(numValue), labels[String(name)] || String(name)];
          }}
          contentStyle={{
            backgroundColor: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
        />
        <Legend
          verticalAlign="top"
          height={36}
          iconType="line"
          formatter={(value: string) => {
            const labels: Record<string, string> = {
              projected: 'Dự báo',
              upper: 'Mức cao',
              lower: 'Mức thấp',
              cumulative: 'Tích lũy',
            };
            return labels[value] || value;
          }}
          wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
        />
        
        {/* Confidence Band (Area between upper and lower) */}
        <Area
          type="monotone"
          dataKey="upper"
          fill="url(#confidenceBand)"
          stroke="none"
          legendType="none"
        />
        <Area
          type="monotone"
          dataKey="lower"
          fill="url(#confidenceBand)"
          stroke="none"
          legendType="none"
        />

        {/* Upper Bound Line */}
        <Line
          type="monotone"
          dataKey="upper"
          stroke="#93c5fd"
          strokeWidth={1}
          strokeDasharray="5 5"
          dot={false}
        />

        {/* Lower Bound Line */}
        <Line
          type="monotone"
          dataKey="lower"
          stroke="#93c5fd"
          strokeWidth={1}
          strokeDasharray="5 5"
          dot={false}
        />

        {/* Projected Line (Main) */}
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#3b82f6"
          strokeWidth={3}
          dot={{ r: 5, fill: '#3b82f6' }}
          activeDot={{ r: 7 }}
        />

        {/* Cumulative Line */}
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke="#8b5cf6"
          strokeWidth={2}
          dot={{ r: 4, fill: '#8b5cf6' }}
          activeDot={{ r: 6 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

