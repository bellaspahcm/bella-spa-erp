'use client';

/**
 * Turnover Rate Chart
 * 
 * Displays turnover rate trend over time.
 * Uses Recharts area chart for visualization.
 */

import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface TurnoverRateData {
  month: string;
  turnoverRate: number;
}

interface TurnoverRateChartProps {
  data: TurnoverRateData[];
  height?: number;
}

export function TurnoverRateChart({ data, height = 300 }: TurnoverRateChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
        <defs>
          <linearGradient id="turnoverGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis 
          dataKey="month" 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
        />
        <YAxis 
          tick={{ fill: '#64748b', fontSize: 12 }}
          tickLine={{ stroke: '#e2e8f0' }}
          tickFormatter={(value) => `${value}%`}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          }}
          labelFormatter={(label) => `Tháng: ${label}`}
        />
        <Area 
          type="monotone" 
          dataKey="turnoverRate" 
          name="Tỷ lệ nghỉ việc"
          stroke="#f97316" 
          strokeWidth={2}
          fill="url(#turnoverGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
