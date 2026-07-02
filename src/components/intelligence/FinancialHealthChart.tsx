'use client';

/**
 * Financial Health Chart Component
 * 
 * Displays profit margin, cash flow, and receivables using bar chart
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

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
      color: '#f97316',
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
      <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <YAxis 
          stroke="#64748b"
          style={{ fontSize: '12px' }}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            fontSize: '12px',
          }}
          formatter={(value, name, props: any) => {
            if (typeof value !== 'number') return ['', name];
            const unit = props.payload.unit;
            if (unit === '%') {
              return [`${value.toFixed(1)}%`, name];
            }
            return [`${value.toFixed(1)}M`, name];
          }}
        />
        <Bar dataKey="value" radius={[8, 8, 0, 0]}>
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
