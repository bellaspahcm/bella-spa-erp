'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface FinancialData {
  name: string;
  value: number;
  color: string;
}

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
  height = 300,
}: FinancialHealthChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const data: FinancialData[] = [
    {
      name: 'Biên LN (%)',
      value: profitMargin,
      color: profitMargin >= 20 ? '#10b981' : profitMargin >= 10 ? '#f59e0b' : '#ef4444',
    },
    {
      name: 'Dòng tiền',
      value: cashFlow / 1000000, // Convert to millions for display
      color: cashFlow >= 0 ? '#10b981' : '#ef4444',
    },
    {
      name: 'Công nợ',
      value: receivables / 1000000, // Convert to millions
      color: receivables > 50000000 ? '#ef4444' : receivables > 20000000 ? '#f59e0b' : '#10b981',
    },
  ];

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis 
          dataKey="name" 
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis 
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(value) => {
            if (data[0].name.includes('%')) return `${value}%`;
            return formatCurrency(value * 1000000);
          }}
        />
        <Tooltip
          formatter={(value) => {
            const numValue = Number(value);
            if (data[0].name.includes('%')) return `${numValue.toFixed(1)}%`;
            return new Intl.NumberFormat('vi-VN', { 
              style: 'currency', 
              currency: 'VND' 
            }).format(numValue * 1000000);
          }}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
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
