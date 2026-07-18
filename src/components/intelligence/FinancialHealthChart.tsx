'use client';

/**
 * Financial Health Chart Component
 * 
 * Displays profit margin, cash flow, and receivables using bar chart
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';

interface FinancialHealthChartProps {
  profitMargin: number;
  cashFlow: number;
  receivables: number;
  height?: number;
}

export function FinancialHealthChart({
  profitMargin,
  cashFlow,
  receivables,
  height = 250,
}: FinancialHealthChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const data = [
    {
      name: 'Biên LN',
      value: profitMargin,
      unit: '%',
      color: 'var(--primary, #db2777)',
    },
    {
      name: 'Dòng tiền',
      value: cashFlow / 1000000, // Convert to millions
      unit: 'M',
      color: cashFlow >= 0 ? '#10b981' : '#ef4444',
    },
    {
      name: 'Công nợ',
      value: receivables / 1000000, // Convert to millions
      unit: 'M',
      color: '#64748b',
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 15, right: 45, left: -15, bottom: 15 }}
      >
        <XAxis type="number" hide />
        <YAxis
          dataKey="name"
          type="category"
          axisLine={false}
          tickLine={false}
          stroke="#94a3b8"
          style={{ fontSize: '12px', fontWeight: 700 }}
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '12px',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.05)',
          }}
          formatter={(value: unknown, name: unknown, entry: { payload?: { unit?: string } }) => {
            if (typeof value !== 'number') return ['', String(name)];
            const unit = entry?.payload?.unit;
            if (unit === '%') {
              return [`${value.toFixed(1)}%`, 'Giá trị'];
            }
            return [`${value.toFixed(1)}M ₫`, 'Giá trị'];
          }}
        />
        <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={16}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
          <LabelList
            dataKey="value"
            position="right"
            formatter={(value: unknown, index?: number) => {
              if (typeof value !== 'number' || index === undefined) return String(value);
              const item = data[index];
              if (item?.unit === '%') {
                return `${value.toFixed(1)}%`;
              }
              return `${value.toFixed(1)}M ₫`;
            }}
            style={{ fill: '#475569', fontSize: '11px', fontWeight: 800 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
