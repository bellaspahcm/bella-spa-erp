/**
 * Cash Flow Analysis Grouped Bar Chart
 * 
 * Visualizes cash inflows and outflows by payment method.
 * Shows side-by-side comparison of inflows vs outflows.
 * 
 * Uses Recharts BarChart with grouped bars.
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface CashFlowBreakdownItem {
  paymentMethod: string;
  inflows: number;
  outflows: number;
}

interface CashFlowAnalysisChartProps {
  data: CashFlowBreakdownItem[];
  height?: number;
}

export function CashFlowAnalysisChart({ data, height = 300 }: CashFlowAnalysisChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(Math.abs(value));
  };

  // Transform payment method labels
  const getPaymentMethodLabel = (method: string): string => {
    const labels: Record<string, string> = {
      'cash': 'Tiền mặt',
      'bank_transfer': 'Chuyển khoản',
      'credit_card': 'Thẻ tín dụng',
      'qr_code': 'QR Code',
      'e_wallet': 'Ví điện tử',
    };
    return labels[method] || method;
  };

  const chartData = data.map(item => ({
    name: getPaymentMethodLabel(item.paymentMethod),
    'Dòng tiền vào': item.inflows,
    'Dòng tiền ra': item.outflows,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 20, left: -15, bottom: 15 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          axisLine={{ stroke: '#cbd5e1' }}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value) => {
            const numValue = typeof value === 'number' ? value : 0;
            return [formatCurrency(numValue), ''];
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
          iconType="rect"
          wrapperStyle={{ fontSize: '12px', fontWeight: 600 }}
        />
        <Bar
          dataKey="Dòng tiền vào"
          fill="#10b981"
          radius={[8, 8, 0, 0]}
        />
        <Bar
          dataKey="Dòng tiền ra"
          fill="#ef4444"
          radius={[8, 8, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
