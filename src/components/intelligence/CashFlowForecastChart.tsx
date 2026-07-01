'use client';

/**
 * Cash Flow Forecast Line Chart
 * 
 * Shows projected future cash flow trends with:
 * - Projected cash flow line (blue)
 * - Cumulative cash line (green)
 * - Confidence band (light blue area)
 * - Month labels on X-axis
 */

import { LineChart, Line, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface CashFlowForecastDataPoint {
  month: string; // 'Jan 26', 'Feb 26', etc.
  projected: number; // projected cash flow
  upper: number; // upper confidence bound
  lower: number; // lower confidence bound
  cumulative: number; // cumulative cash flow
}

interface CashFlowForecastChartProps {
  data: CashFlowForecastDataPoint[];
  height?: number;
}

/**
 * Cash Flow Forecast Line Chart Component
 * 
 * Displays predicted future cash flow with confidence bands.
 * Shows both monthly projected cash flow and cumulative total.
 * 
 * @param data - Array of forecast data points with projections and confidence bounds
 * @param height - Chart height in pixels (default: 300)
 */
export function CashFlowForecastChart({ data, height = 300 }: CashFlowForecastChartProps) {
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

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart
        data={data}
        margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
      >
        <defs>
          {/* Gradient for confidence band */}
          <linearGradient id="confidenceBand" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1}/>
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
        
        <XAxis
          dataKey="month"
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
            const formattedValue = formatTooltipCurrency(Number(value));
            return [formattedValue, name];
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

            const projected = payload.find(p => p.dataKey === 'projected')?.value as number || 0;
            const cumulative = payload.find(p => p.dataKey === 'cumulative')?.value as number || 0;
            const upper = payload.find(p => p.dataKey === 'upper')?.value as number || 0;
            const lower = payload.find(p => p.dataKey === 'lower')?.value as number || 0;

            return (
              <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg">
                <p className="font-medium text-slate-900 mb-2">{label}</p>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-blue-600">Dự báo:</span>
                    <span className="font-medium">{formatTooltipCurrency(projected)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-green-600">Tích lũy:</span>
                    <span className="font-medium">{formatTooltipCurrency(cumulative)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 pt-1 border-t border-slate-200">
                    <span className="text-slate-500 text-xs">Dải tin cậy:</span>
                    <span className="text-xs text-slate-600">
                      {formatTooltipCurrency(lower)} - {formatTooltipCurrency(upper)}
                    </span>
                  </div>
                </div>
              </div>
            );
          }}
        />
        
        <Legend
          wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }}
        />

        {/* Confidence band (area between upper and lower bounds) */}
        <Area
          type="monotone"
          dataKey="upper"
          fill="url(#confidenceBand)"
          stroke="none"
          fillOpacity={0.6}
          name="Dải tin cậy"
        />
        
        {/* Projected cash flow line */}
        <Line
          type="monotone"
          dataKey="projected"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={{ fill: '#3b82f6', r: 4 }}
          activeDot={{ r: 6 }}
          name="Dự báo dòng tiền"
        />
        
        {/* Cumulative cash line */}
        <Line
          type="monotone"
          dataKey="cumulative"
          stroke="#10b981"
          strokeWidth={2}
          dot={{ fill: '#10b981', r: 4 }}
          activeDot={{ r: 6 }}
          name="Tích lũy"
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
