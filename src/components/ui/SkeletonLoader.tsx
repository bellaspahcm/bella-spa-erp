'use client';

import { cn } from '@/lib/utils';

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'text' | 'circular' | 'rectangular' | 'card';
  width?: string | number;
  height?: string | number;
}

export default function SkeletonLoader({
  className,
  variant = 'rectangular',
  width,
  height,
  style,
  ...props
}: SkeletonProps) {
  const customStyle: React.CSSProperties = {
    ...style,
    width: width !== undefined ? width : undefined,
    height: height !== undefined ? height : undefined,
  };

  return (
    <div
      className={cn(
        "animate-pulse bg-slate-200/50 dark:bg-slate-800/40 backdrop-blur-[2px] transition-all duration-300",
        {
          "rounded-md": variant === 'text',
          "rounded-full": variant === 'circular',
          "rounded-2xl": variant === 'rectangular',
          "rounded-[2.5rem] border border-white/20 dark:border-white/5 shadow-sm p-6": variant === 'card',
        },
        className
      )}
      style={customStyle}
      {...props}
    />
  );
}

export function SkeletonCard() {
  return (
    <SkeletonLoader variant="card" className="w-full h-48 flex flex-col justify-between">
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <SkeletonLoader variant="circular" width={40} height={40} />
          <div className="space-y-1.5">
            <SkeletonLoader variant="text" width={120} height={16} />
            <SkeletonLoader variant="text" width={80} height={12} />
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <SkeletonLoader variant="text" width="90%" height={12} />
          <SkeletonLoader variant="text" width="75%" height={12} />
        </div>
      </div>
      <div className="flex justify-between items-center pt-4">
        <SkeletonLoader variant="text" width={60} height={20} className="rounded-full" />
        <SkeletonLoader variant="text" width={80} height={32} className="rounded-xl" />
      </div>
    </SkeletonLoader>
  );
}

export function SkeletonTable() {
  return (
    <div className="space-y-4 w-full">
      <div className="flex justify-between items-center pb-2 border-b border-slate-100 dark:border-slate-800/60">
        <SkeletonLoader variant="text" width={100} height={16} />
        <SkeletonLoader variant="text" width={60} height={16} />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between items-center py-2.5">
          <div className="flex items-center gap-3">
            <SkeletonLoader variant="circular" width={32} height={32} />
            <div className="space-y-1">
              <SkeletonLoader variant="text" width={140} height={14} />
              <SkeletonLoader variant="text" width={90} height={10} />
            </div>
          </div>
          <SkeletonLoader variant="text" width={80} height={14} />
        </div>
      ))}
    </div>
  );
}
