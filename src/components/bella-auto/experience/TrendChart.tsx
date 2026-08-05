'use client';

interface TrendChartProps {
  data: Array<{ month: string; value: number }>;
  color?: 'green' | 'blue' | 'red' | 'yellow';
}

export function TrendChart({ data, color = 'green' }: TrendChartProps) {
  const maxValue = Math.max(...data.map(d => d.value));
  const minValue = Math.min(...data.map(d => d.value));
  const range = maxValue - minValue || 1;

  const gradientMap = {
    green: 'from-emerald-500 to-teal-500 shadow-emerald-500/20',
    blue: 'from-blue-500 to-cyan-500 shadow-blue-500/20',
    red: 'from-rose-500 to-red-600 shadow-rose-500/20',
    yellow: 'from-amber-400 to-orange-500 shadow-amber-500/20',
  };

  return (
    <div className="space-y-4 pt-2">
      <div className="flex items-end justify-between gap-3 h-52">
        {data.map((point, index) => {
          const height = Math.max(((point.value - minValue) / range) * 100, 20);
          return (
            <div key={index} className="flex-1 flex flex-col items-center gap-2 group">
              <div className="text-xs font-extrabold text-slate-700 dark:text-slate-200 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                {point.value > 0 ? `+${point.value}` : point.value}
              </div>
              <div className="w-full bg-slate-100 dark:bg-slate-800/80 rounded-2xl relative flex-1 flex items-end p-1 shadow-inner overflow-hidden">
                <div
                  className={`w-full bg-gradient-to-t ${gradientMap[color]} rounded-xl transition-all duration-500 group-hover:brightness-110 shadow-md`}
                  style={{ height: `${height}%` }}
                />
              </div>
              <div className="text-xs font-bold text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300">
                {point.month}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
