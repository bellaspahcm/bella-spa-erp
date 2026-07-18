'use client';

/**
 * Customer Activity Chart (Premium Composed Chart)
 * Shows correlation between customer risk volume (Bars) and average risk score (Line)
 */

import { ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { ChurnRiskAnalysis } from '@/services/intelligence/customer/queries-simple';

interface CustomerActivityChartProps {
  data: ChurnRiskAnalysis[];
  height?: number;
}

export function CustomerActivityChart({ data, height = 350 }: CustomerActivityChartProps) {
  const aggregated = data.reduce((acc, customer) => {
    const level = customer.churnRiskLevel;
    if (!acc[level]) {
      acc[level] = { count: 0, totalRevenue: 0, avgRiskScore: 0 };
    }
    acc[level].count += 1;
    acc[level].totalRevenue += customer.totalRevenue;
    acc[level].avgRiskScore += customer.churnRiskScore;
    return acc;
  }, {} as Record<string, { count: number; totalRevenue: number; avgRiskScore: number }>);

  // Calculate averages
  Object.keys(aggregated).forEach(level => {
    if (aggregated[level].count > 0) {
      aggregated[level].avgRiskScore = aggregated[level].avgRiskScore / aggregated[level].count;
    }
  });

  const chartData = [
    { 
      level: 'Thấp', 
      customers: aggregated['Low']?.count || 0,
      avgScore: Math.round(aggregated['Low']?.avgRiskScore || 0),
    },
    { 
      level: 'Trung bình', 
      customers: aggregated['Medium']?.count || 0,
      avgScore: Math.round(aggregated['Medium']?.avgRiskScore || 0),
    },
    { 
      level: 'Cao', 
      customers: aggregated['High']?.count || 0,
      avgScore: Math.round(aggregated['High']?.avgRiskScore || 0),
    },
  ];

  // Custom tooltips matching glassmorphism
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-xl text-xs font-bold text-slate-800 space-y-1.5">
          <p className="text-slate-400 uppercase tracking-wider mb-1">Rủi ro: {payload[0].payload.level}</p>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#3b82f6]" />
            <span className="text-slate-600">Số khách hàng:</span>
            <span className="text-slate-900 font-black">{payload[0].payload.customers} KH</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#f43f5e]" />
            <span className="text-slate-600">Điểm rủi ro TB:</span>
            <span className="text-slate-900 font-black">{payload[0].payload.avgScore}</span>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={chartData} margin={{ top: 15, right: 20, left: -15, bottom: 15 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="level"
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="left"
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
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
        
        {/* Count represented as beautiful custom rounded bar */}
        <Bar
          yAxisId="left"
          dataKey="customers"
          name="Số khách hàng"
          fill="#3b82f6"
          radius={[10, 10, 0, 0]}
          maxBarSize={45}
        />

        {/* Score represented as glowing trending line */}
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="avgScore"
          name="Điểm rủi ro trung bình"
          stroke="#f43f5e"
          strokeWidth={3}
          dot={{ fill: '#f43f5e', stroke: '#fff', strokeWidth: 2, r: 6 }}
          activeDot={{ r: 8, stroke: '#fff', strokeWidth: 2 }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
