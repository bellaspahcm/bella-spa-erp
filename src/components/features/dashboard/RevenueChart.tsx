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
    <div className="lg:col-span-1 space-y-8">
      {/* Performance Chart */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.5 }}
        className="luxury-card-pink rounded-[3rem] p-10 relative overflow-hidden shadow-2xl group flex flex-col justify-between h-[450px]"
      >
        <div className="relative z-10">
          <h2 className="text-xs font-semibold mb-1 text-white/70 uppercase tracking-[0.2em]">Hiệu suất tháng</h2>
          <div className="flex items-center gap-3 mb-8">
            <p className="text-4xl font-bold text-white tracking-tighter">
              {performanceTrend}
            </p>
            <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-md">
              <TrendingUp className="text-white w-4 h-4" />
            </div>
          </div>
          
          <MeasuredChartFrame className="h-40 w-full relative mb-6">
              <AreaChart data={performanceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPerf" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ffffff" stopOpacity={0.6}/>
                    <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.9)', 
                    borderRadius: '1rem', 
                    border: 'none',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)',
                    color: '#9D174D',
                    fontWeight: '800'
                  }}
                  itemStyle={{ color: '#9D174D' }}
                />
                <XAxis 
                  dataKey="name" 
                  axisLine={{ stroke: '#7d123e', strokeWidth: 2 }}
                  tickLine={false}
                  tick={{ fill: 'rgba(255, 255, 255, 0.6)', fontSize: 10, fontWeight: 800 }}
                  dy={10}
                />
                <YAxis hide domain={['dataMin - 10', 'dataMax + 10']} />
                <Area 
                  type="monotone" 
                  dataKey="customers" 
                  stroke="#ffffff" 
                  strokeWidth={3}
                  fillOpacity={1} 
                  fill="url(#colorPerf)" 
                  animationDuration={2000}
                />
              </AreaChart>
          </MeasuredChartFrame>
        </div>
        
        {userRole === 'admin' && (
          <Link 
            href="/dashboard/finance"
            className="w-full py-4 bg-white/10 hover:bg-white text-white hover:text-primary border border-white/20 hover:border-white rounded-2xl font-black transition-all duration-300 backdrop-blur-md uppercase tracking-widest text-[10px] active:scale-95 flex items-center justify-center gap-3 shadow-lg group/btn"
          >
            <span>Chi tiết báo cáo</span>
            <ChevronRight className="w-4 h-4 group-hover/btn:translate-x-1 transition-transform" />
          </Link>
        )}
        
        <div className="absolute top-[-10%] right-[-10%] w-72 h-72 bg-white/10 rounded-full blur-[100px]"></div>
      </motion.div>

      {/* Revenue & Expense Chart (Moved to Sidebar) */}
      {userRole === 'admin' && (
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
          className="glass-pink luxury-box-hover rounded-[3rem] p-8 shadow-sm border border-white relative overflow-hidden h-[400px]"
        >
          <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-emerald-400/30 via-primary/30 to-rose-400/30" />
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-emerald-600" />
              </div>
              <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Tài chính</h2>
            </div>
          </div>
          
          <MeasuredChartFrame className="h-56 w-full">
              <BarChart data={performanceData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#888', fontSize: 10, fontWeight: 700 }}
                  unit="tr"
                />
                <Tooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.02)' }}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    borderRadius: '1rem', 
                    border: 'none',
                    boxShadow: '0 10px 20px -5px rgba(0, 0, 0, 0.1)',
                    fontSize: '10px'
                  }}
                />
                <Bar dataKey="revenue" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="expense" fill="#f43f5e" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
          </MeasuredChartFrame>
        </motion.div>
      )}

      {/* Rating Chart (Moved to Sidebar) */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.7 }}
        className="glass-pink luxury-box-hover rounded-[3rem] p-8 shadow-sm border border-white relative overflow-hidden h-[350px] flex flex-col"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-amber-400/30 to-orange-400/30" />
        <div className="flex items-center gap-3 mb-6">
          <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
            <Star className="w-5 h-5 text-amber-500" />
          </div>
          <h2 className="text-lg font-bold text-foreground uppercase tracking-tight">Đánh giá</h2>
        </div>
        
        <div className="flex-1 flex flex-col justify-between">
          <div className="mb-4">
            <p className="text-4xl font-black text-foreground tracking-tighter">
              {latestRating !== null ? Number(latestRating).toFixed(2) : '—'}
            </p>
            <div className="flex items-center gap-1 mt-1">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-3 h-3 ${
                    latestRating !== null && s <= Math.round(latestRating)
                      ? 'text-amber-400 fill-amber-400'
                      : 'text-gray-200'
                  }`}
                />
              ))}
            </div>
          </div>

          <MeasuredChartFrame className="h-28 w-full">
              <AreaChart data={performanceData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRating" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="name" hide />
                <YAxis hide domain={[4, 5]} />
                <Area type="monotone" dataKey="rating" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorRating)" />
              </AreaChart>
          </MeasuredChartFrame>
        </div>
      </motion.div>
    </div>
  );
}
