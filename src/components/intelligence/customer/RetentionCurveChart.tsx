'use client';

/**
 * Retention Curve Chart (Premium Area Chart)
 * Shows customer retention rate by cohort over time with smooth green gradient fills
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { SafeResponsiveContainer as ResponsiveContainer } from '@/components/ui/SafeResponsiveContainer';
import type { CohortAnalysis } from '@/services/intelligence/customer/queries-simple';

interface RetentionCurveChartProps {
  data: CohortAnalysis[];
  height?: number;
}

export function RetentionCurveChart({ data, height = 350 }: RetentionCurveChartProps) {
  const chartData = data
    .sort((a, b) => a.cohortMonth.localeCompare(b.cohortMonth))
    .map(d => ({
      cohort: d.cohortMonth.substring(5, 7) + '/' + d.cohortMonth.substring(2, 4),
      retention: d.retentionRate, // Changed from retentionRatePct to retentionRate
      size: d.cohortSize,
    }));

  // Custom tooltips matching glassmorphism
  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ value: number; payload: { cohort: string; size: number } }> }) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      return (
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-xl text-xs font-bold text-slate-800">
          <p className="text-slate-500 mb-1 uppercase tracking-wider">Cohort: {entry.payload.cohort}</p>
          <p className="text-sm font-black text-slate-900 mb-1">
            Giữ chân: <span className="text-primary">{entry.value.toFixed(1)}%</span>
          </p>
          <p className="text-[10px] text-slate-400 font-normal">
            Quy mô ban đầu: {entry.payload.size} KH
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={chartData} margin={{ top: 15, right: 20, left: -15, bottom: 15 }}>
        <defs>
          <linearGradient id="retentionGradient" x1="0" y1="0" x2="0" y2="1">
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
          domain={[0, 100]}
          tickFormatter={(value) => `${value}%`}
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          wrapperStyle={{ paddingTop: '20px' }} 
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">{value}</span>}
        />
        <Area
          type="monotone"
          dataKey="retention"
          name="Tỷ lệ giữ chân (%)"
          stroke="var(--primary)"
          strokeWidth={3}
          fillOpacity={1}
          fill="url(#retentionGradient)"
          dot={{ fill: 'var(--primary)', stroke: '#fff', strokeWidth: 2, r: 6 }}
          activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
