'use client';

/**
 * LTV by Cohort Chart (Premium Area Chart)
 * Shows average LTV trends by customer signup cohort with smooth gradient fills
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CohortAnalysis } from '@/services/intelligence/customer/queries-simple';

interface LtvByCohortChartProps {
  data: CohortAnalysis[];
  height?: number;
}

export function LtvByCohortChart({ data, height = 350 }: LtvByCohortChartProps) {
  const chartData = data
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    .map(d => ({
      cohort: d.cohortMonth.substring(5, 7) + '/' + d.cohortMonth.substring(2, 4),
      ltv: d.avgLTV, // Changed from avgLtv to avgLTV
      size: d.cohortSize,
    }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatCurrencyFull = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Custom tooltips matching glassmorphism
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-xl text-xs font-bold text-slate-800">
          <p className="text-slate-500 mb-1 uppercase tracking-wider">Cohort: {entry.payload.cohort}</p>
          <p className="text-sm font-black text-slate-900 mb-1">
            LTV TB: <span className="text-primary">{formatCurrencyFull(entry.value)}</span>
          </p>
          <p className="text-[10px] text-slate-400 font-normal">
            Quy mô cohort: {entry.payload.size} KH
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 15, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="ltvGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.25} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="cohort"
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tickFormatter={formatCurrency}
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="ltv"
          name="LTV Trung Bình"
          stroke="var(--primary)"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#ltvGradient)"
          dot={{ fill: 'var(--primary)', stroke: '#fff', strokeWidth: 2, r: 6 }}
          activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
