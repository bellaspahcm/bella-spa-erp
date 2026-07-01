'use client';

/**
 * Cash Flow Analysis Stacked Bar Chart
 * 
 * Shows cash inflows and outflows by payment method with:
 * - Stacked bars for each payment method
 * - Green bars for inflows
 * - Red bars for outflows
 * - Net cash flow calculation in tooltip
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CashFlowBreakdown {
  paymentMethod: string; // 'cash', 'bank_transfer', 'credit_card', etc.
  inflows: number;
  outflows: number;
}

interface CashFlowAnalysisChartProps {
  data: CashFlowBreakdown[];
  height?: number;
}

// Payment method labels (Vietnamese)
const PAYMENT_METHOD_LABELS: Record<string, string> = {
  'cash': 'Tiền mặt',
  'bank_transfer': 'Chuyển khoản',
  'credit_card': 'Thẻ tín dụng',
  'qr_code': 'QR Code',
  'e_wallet': 'Ví điện tử',
};

/**
 * Cash Flow Analysis Stacked Bar Chart Component
 * 
 * Displays cash inflows (green) and outflows (red) side-by-side
 * for each payment method to visualize cash movement patterns.
 * 
 * @param data - Array of payment methods with inflows and outflows
 * @param height - Chart height in pixels (default: 300)
 */
export function CashFlowAnalysisChart({ data, height = 300 }: CashFlowAnalysisChartProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      notation: 'compact',
      compactDisplay: 'short',
    }).format(value);
  };

  const formatTooltipCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(value);
  };

  // Transform data to display Vietnamese labels
  const chartData = data.map(item => ({
    paymentMethod: PAYMENT_METHOD_LABELS[item.paymentMethod] || item.paymentMethod,
    inflows: item.inflows,
    outflows: item.outflows,
    net: item.inflows - item.outflows,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        <XAxis
          dataKey="paymentMethod"
          stroke="#64748b"
          fontSize={12}
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          formatter={(value, name) => {
            if (name === 'Dòng tiền vào') return [formatTooltipCurrency(Number(value)), name];
            if (name === 'Dòng tiền ra') return [formatTooltipCurrency(Number(value)), name];
            return [formatTooltipCurrency(Number(value)), name];
          }}
          labelFormatter={(label) => String(label)}
          contentStyle={{
            backgroundColor: 'white',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
          }}
          content={({ active, payload, label }) => {
            if (!active || !payload || payload.length === 0) return null;

            const inflows = payload.find(p => p.dataKey === 'inflows')?.value as number || 0;
            const outflows = payload.find(p => p.dataKey === 'outflows')?.value as number || 0;
            const net = inflows - outflows;

            return (
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
                <p className="font-medium text-slate-900 mb-2">{label}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-green-600">Dòng tiền vào:</span>
                    <span className="font-medium">{formatTooltipCurrency(inflows)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-red-600">Dòng tiền ra:</span>
                    <span className="font-medium">{formatTooltipCurrency(outflows)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200">
                    <span className={net >= 0 ? 'text-blue-600' : 'text-red-600'}>Ròng:</span>
                    <span className="font-bold">{formatTooltipCurrency(net)}</span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />
        <Bar
          dataKey="inflows"
          fill="#10b981"
          name="Dòng tiền vào"
          radius={[4, 4, 0, 0]}
        />
        <Bar
          dataKey="outflows"
          fill="#ef4444"
          name="Dòng tiền ra"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
