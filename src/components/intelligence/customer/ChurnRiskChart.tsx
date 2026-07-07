'use client';

/**
 * Churn Risk Distribution Chart (Premium Donut Chart)
 * Shows count and percentage of customers by churn risk level
 */

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { ChurnRiskAnalysis } from '@/services/intelligence/customer/queries-simple';

interface ChurnRiskChartProps {
  data: ChurnRiskAnalysis[];
  height?: number;
}

const RISK_COLORS: Record<string, string> = {
  'High': '#F43F5E',    // premium rose-500
  'Medium': '#F59E0B',  // premium amber-500
  'Low': '#10B981',     // premium emerald-500
};

export function ChurnRiskChart({ data, height = 350 }: ChurnRiskChartProps) {
  const riskCounts = data.reduce((acc, customer) => {
    const level = customer.churnRiskLevel;
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const total = data.length;

  const chartData = [
    { level: 'High', count: riskCounts['High'] || 0, name: 'Rủi ro cao' },
    { level: 'Medium', count: riskCounts['Medium'] || 0, name: 'Rủi ro trung bình' },
    { level: 'Low', count: riskCounts['Low'] || 0, name: 'Rủi ro thấp' },
  ].filter(item => item.count > 0); // Only show segments with data

  // Custom tooltips matching glassmorphism
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0].payload;
      const percent = total > 0 ? ((entry.count / total) * 100).toFixed(1) : '0.0';
      return (
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-xl text-xs font-bold text-slate-800">
          <p className="text-slate-500 mb-1 uppercase tracking-wider">{entry.name}</p>
          <p className="text-sm font-black text-slate-900">
            {entry.count} KH <span className="text-primary font-normal">({percent}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  const renderLegend = (props: any) => {
    const { payload } = props;
    return (
      <ul className="flex justify-center gap-6 mt-4 flex-wrap">
        {payload.map((entry: any, index: number) => {
          const percent = total > 0 ? ((entry.payload.count / total) * 100).toFixed(0) : '0';
          return (
            <li key={`legend-${index}`} className="flex items-center gap-2 text-xs font-bold text-slate-600">
              <span 
                className="w-3.5 h-3.5 rounded-full shrink-0 border shadow-sm" 
                style={{ 
                  backgroundColor: entry.color,
                  borderColor: 'rgba(255, 255, 255, 0.4)' 
                }} 
              />
              <span>{entry.value}</span>
              <span className="text-slate-400 font-medium">({percent}%)</span>
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ height }}>
      <ResponsiveContainer width="100%" height="90%">
        <PieChart>
          <Tooltip content={<CustomTooltip />} />
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={80}
            outerRadius={105}
            paddingAngle={4}
            dataKey="count"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={RISK_COLORS[entry.level]} 
                style={{ 
                  filter: 'drop-shadow(0px 4px 10px rgba(0, 0, 0, 0.05))',
                  cursor: 'pointer'
                }}
              />
            ))}
          </Pie>
          <Legend content={renderLegend} />
        </PieChart>
      </ResponsiveContainer>

      {/* Hollow Center Text */}
      <div className="absolute top-[41%] left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
        <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none">{total}</p>
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Tổng KH</p>
      </div>
    </div>
  );
}
