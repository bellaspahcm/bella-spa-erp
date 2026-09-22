'use client';

import { cloneElement, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { TrendingUp, ChevronRight, DollarSign, Star } from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  BarChart,
  Bar,
  Tooltip, 
  XAxis,
  YAxis,
  CartesianGrid
} from 'recharts';

import SkeletonLoader from '@/components/ui/SkeletonLoader';
import type { PerformanceDataPointViewModel } from '@/core/services/analytics/dashboard-actions';

interface RevenueChartProps {
  performanceData: PerformanceDataPointViewModel[];
  userRole: 'admin' | 'ktv' | null;
  isLoading?: boolean;
}

type ChartSize = { width: number; height: number };
type SizedChartElement = ReactElement<{ width?: number; height?: number }>;

function MeasuredChartFrame({
  className,
  children,
}: {
  className: string;
  children: SizedChartElement;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [chartSize, setChartSize] = useState<ChartSize | null>(null);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) {
      return;
    }

    let frameId = 0;
    const measure = () => {
      const { width, height } = node.getBoundingClientRect();
      if (width <= 0 || height <= 0) {
        setChartSize(null);
        return;
      }

      const nextSize = {
        width: Math.max(1, Math.floor(width)),
        height: Math.max(1, Math.floor(height)),
      };
      setChartSize((previousSize) => (
        previousSize?.width === nextSize.width && previousSize.height === nextSize.height
          ? previousSize
          : nextSize
      ));
    };
    const scheduleMeasure = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(measure);
    };

    if (typeof ResizeObserver === 'undefined') {
      scheduleMeasure();
      return () => cancelAnimationFrame(frameId);
    }

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(node);
    scheduleMeasure();

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  return (
    <div ref={containerRef} className={`${className} min-w-0`}>
      {chartSize ? cloneElement(children, chartSize) : null}
    </div>
  );
}

export function RevenueChart({ performanceData, userRole, isLoading }: RevenueChartProps) {
  // Memoize performance trend calculation to avoid recalculating on every render
  const performanceTrend = useMemo(() => {
    if (performanceData.length < 2) return '+0%';
    const current = performanceData[performanceData.length - 1].customers;
    const previous = performanceData[performanceData.length - 2].customers;
    if (previous === 0) return current > 0 ? '+100%' : '0%';
    const trend = ((current - previous) / previous) * 100;
    return (trend >= 0 ? '+' : '') + trend.toFixed(1) + '%';
  }, [performanceData]);

  // Memoize latest rating to avoid recalculating on every render
  const latestRating = useMemo(() => {
    return performanceData[performanceData.length - 1]?.rating ?? null;
  }, [performanceData]);

  // Default 7-day revenue sample if performanceData is empty
  const sample7DayData = useMemo(() => {
    if (performanceData && performanceData.length >= 7) {
      return performanceData.slice(-7);
    }
    return [
      { name: '13/9', revenue: 6.8, expense: 2.1, customers: 12, rating: 4.8 },
      { name: '14/9', revenue: 8.2, expense: 2.5, customers: 15, rating: 4.9 },
      { name: '15/9', revenue: 11.0, expense: 3.0, customers: 20, rating: 4.8 },
      { name: '16/9', revenue: 12.5, expense: 3.5, customers: 22, rating: 4.9 },
      { name: '17/9', revenue: 15.2, expense: 4.0, customers: 25, rating: 4.9 },
      { name: '18/9', revenue: 14.0, expense: 3.8, customers: 24, rating: 4.8 },
      { name: '19/9', revenue: 18.5, expense: 4.2, customers: 30, rating: 5.0 },
    ];
  }, [performanceData]);

  if (isLoading) {
    return (
      <div className="lg:col-span-1 space-y-8">
        {/* Performance Chart Skeleton */}
        <div className="luxury-card-pink rounded-[3rem] p-10 h-[450px] relative overflow-hidden shadow-2xl flex flex-col justify-between">
          <div className="space-y-4">
            <SkeletonLoader variant="text" width={120} height={16} className="bg-white/20 dark:bg-white/10" />
            <div className="flex items-center gap-3">
              <SkeletonLoader variant="text" width={100} height={36} className="bg-white/20 dark:bg-white/10 rounded-xl" />
              <SkeletonLoader variant="rectangular" width={28} height={28} className="bg-white/20 dark:bg-white/10 rounded-lg" />
            </div>
            <div className="h-40 w-full flex items-end gap-3 pt-6">
              {[40, 60, 45, 80, 50, 95, 70].map((h, i) => (
                <SkeletonLoader 
                  key={i} 
                  variant="rectangular" 
                  className="flex-1 bg-white/15 dark:bg-white/5 rounded-t-lg" 
                  style={{ height: `${h}%` }} 
                />
              ))}
            </div>
          </div>
          <SkeletonLoader variant="rectangular" width="100%" height={48} className="bg-white/10 dark:bg-white/5 rounded-2xl border border-white/15" />
        </div>

        {/* Finance Chart Skeleton */}
        {userRole === 'admin' && (
          <div className="glass-pink rounded-[3rem] p-8 h-[400px] border border-white/50 dark:border-white/5 shadow-lg flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-6">
              <SkeletonLoader variant="rectangular" width={32} height={32} className="rounded-lg" />
              <SkeletonLoader variant="text" width={100} height={20} />
            </div>
            <div className="h-56 w-full flex items-end gap-4 px-4 pb-4">
              {[60, 45, 75, 55, 90, 80].map((h, i) => (
                <div key={i} className="flex-1 flex gap-1.5 items-end h-full">
                  <SkeletonLoader variant="rectangular" className="w-4 rounded-t bg-emerald-300/40 dark:bg-emerald-800/20" style={{ height: `${h}%` }} />
                  <SkeletonLoader variant="rectangular" className="w-4 rounded-t bg-rose-300/40 dark:bg-rose-800/20" style={{ height: `${h * 0.7}%` }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rating Chart Skeleton */}
        <div className="glass-pink rounded-[3rem] p-8 h-[350px] border border-white/50 dark:border-white/5 shadow-lg flex flex-col justify-between">
          <div className="flex items-center gap-3 mb-6">
            <SkeletonLoader variant="rectangular" width={32} height={32} className="rounded-lg" />
            <SkeletonLoader variant="text" width={80} height={20} />
          </div>
          <div className="space-y-3">
            <SkeletonLoader variant="text" width={60} height={36} className="rounded-xl" />
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <SkeletonLoader key={s} variant="circular" width={12} height={12} />
              ))}
            </div>
          </div>
          <div className="h-28 w-full flex items-end gap-2 pt-4">
            {[30, 45, 35, 60, 50, 75, 90].map((h, i) => (
              <SkeletonLoader key={i} variant="rectangular" className="flex-1 rounded-t-lg bg-amber-200/30 dark:bg-amber-950/10" style={{ height: `${h}%` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.5 }}
      className="bg-white dark:bg-slate-900 rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col justify-between"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-[#074E44]" />
          <h2 className="text-base font-bold text-slate-900 dark:text-white">Doanh thu 7 ngày gần nhất</h2>
        </div>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer">
          <span>Doanh thu</span>
          <ChevronRight className="w-3.5 h-3.5 rotate-90 text-slate-400" />
        </div>
      </div>

      <div className="relative pt-6 pb-2">
        <MeasuredChartFrame className="h-44 w-full">
          <BarChart data={sample7DayData} margin={{ top: 25, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.04)" />
            <XAxis 
              dataKey="name" 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
              dy={6}
            />
            <YAxis 
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 700 }}
              unit="M"
              domain={[0, 20]}
              ticks={[0, 5, 10, 15, 20]}
            />
            <Tooltip 
              cursor={{ fill: 'rgba(7, 78, 68, 0.04)' }}
              contentStyle={{ 
                backgroundColor: '#074E44', 
                borderRadius: '0.75rem', 
                border: 'none',
                color: '#ffffff',
                fontSize: '11px',
                fontWeight: '800'
              }}
              formatter={(val: any) => [`${val}M VND`, 'Doanh thu']}
            />
            <Bar 
              dataKey="revenue" 
              radius={[6, 6, 0, 0]} 
              barSize={28}
              shape={(props: any) => {
                const { fill, x, y, width, height, index } = props;
                const isLast = index === sample7DayData.length - 1;
                const barColor = isLast ? '#074E44' : '#a7f3d0';
                return (
                  <g>
                    <rect x={x} y={y} width={width} height={height} rx={6} ry={6} fill={barColor} />
                    {isLast && (
                      <g>
                        <rect x={x + width / 2 - 24} y={y - 24} width={48} height={18} rx={4} fill="#074E44" />
                        <text x={x + width / 2} y={y - 11} fill="#ffffff" textAnchor="middle" fontSize={10} fontWeight={800}>
                          18.5M
                        </text>
                      </g>
                    )}
                  </g>
                );
              }}
            />
          </BarChart>
        </MeasuredChartFrame>
      </div>
    </motion.div>
  );
}

