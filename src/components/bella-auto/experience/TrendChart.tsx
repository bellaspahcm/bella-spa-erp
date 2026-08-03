'use client';

interface TrendChartProps {
  data: Array<{ month: string; value: number }>;
  color?: 'green' | 'blue' | 'red' | 'yellow';
}

export function TrendChart({ data, color = 'blue' }: TrendChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const colorMap = {
    green: 'bg-green-500',
    blue: 'bg-blue-500',
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end justify-between gap-2 h-48">
        {data.map((point, index) => {
          const height = ((point.value - minValue) / range) * 100;
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2">
              <div className="text-xs font-semibold text-muted-foreground">
                {point.value}
              </div>
              <div className="w-full bg-gray-200 rounded-t relative flex-1 flex items-end">
                <div
                  className={`w-full ${colorMap[color]} rounded-t transition-all`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="text-xs text-muted-foreground">{point.month}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
