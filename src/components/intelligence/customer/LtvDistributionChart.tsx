'use client';

/**
 * LTV Distribution Chart (Premium Bar Chart)
 * Shows distribution of customers across LTV value ranges with modern gradients
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CustomerLTV } from '@/services/intelligence/customer/queries-simple';

interface LtvDistributionChartProps {
  data: CustomerLTV[];
  height?: number;
}

export function LtvDistributionChart({ data, height = 350 }: LtvDistributionChartProps) {
  // Create LTV buckets
  const buckets = [
    { range: '0-5M', min: 0, max: 5000000, count: 0 },
    { range: '5-10M', min: 5000000, max: 10000000, count: 0 },
    { range: '10-20M', min: 10000000, max: 20000000, count: 0 },
    { range: '20-50M', min: 20000000, max: 50000000, count: 0 },
    { range: '50M+', min: 50000000, max: Infinity, count: 0 },
  ];

  data.forEach(customer => {
    const ltv = customer.lifetimeRevenue;
    const bucket = buckets.find(b => ltv >= b.min && ltv < b.max);
    if (bucket) bucket.count++;
  });

  const chartData = buckets.map(b => ({
    range: b.range,
    count: b.count,
  }));

  const total = data.length;

  // Custom tooltips matching glassmorphism
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const entry = payload[0];
      const percent = total > 0 ? ((entry.value / total) * 100).toFixed(1) : '0.0';
      return (
        <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-slate-200/50 shadow-xl text-xs font-bold text-slate-800">
          <p className="text-slate-500 mb-1 uppercase tracking-wider">Khoảng: {entry.payload.range}</p>
          <p className="text-sm font-black text-slate-900">
            Số lượng: <span className="text-primary">{entry.value} KH</span> <span className="text-slate-400 font-normal">({percent}%)</span>
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={chartData} margin={{ top: 15, right: 20, left: -15, bottom: 15 }}>
        <defs>
          <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.9} />
            <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.4} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="range"
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: '700' }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="count" 
          name="Số khách hàng" 
          fill="url(#barGradient)" 
          radius={[10, 10, 0, 0]}
          maxBarSize={50}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
