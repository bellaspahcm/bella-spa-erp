'use client';

import { motion } from 'framer-motion';
import { Users, Calendar, DollarSign, Star, TrendingUp, TrendingDown } from 'lucide-react';

import SkeletonLoader from '@/components/ui/SkeletonLoader';
import type { DashboardStatsViewModel } from '@/services/dashboard-actions';

const ICON_MAP = {
  Users,
  Calendar,
  DollarSign,
  Star,
};

interface StatsGridProps {
  stats: DashboardStatsViewModel[];
  isLoading?: boolean;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1
    }
  }
};

const item = {
  hidden: { y: 20, opacity: 0 },
  show: { y: 0, opacity: 1 }
};

export function StatsGrid({ stats, isLoading }: StatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {[1, 2, 3, 4].map((i) => (
          <div 
            key={i}
            className="glass-pink p-8 rounded-[2.5rem] border border-white/50 dark:border-white/5 shadow-lg h-44 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between mb-4">
              <SkeletonLoader variant="rectangular" width={56} height={56} className="rounded-2xl" />
              <SkeletonLoader variant="text" width={56} height={22} className="rounded-full" />
            </div>
            <div className="space-y-3">
              <SkeletonLoader variant="text" width={100} height={12} className="rounded" />
              <SkeletonLoader variant="text" width={140} height={36} className="rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  return (
    <motion.div 
      variants={container}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12"
    >
      {stats.map((stat, idx) => {
        const IconComponent = ICON_MAP[stat.iconName] || Users;
        
        return (
          <motion.div 
            key={idx}
            variants={item}
            className="glass-pink p-8 rounded-[2.5rem] group relative overflow-hidden border border-white/50 shadow-lg hover:shadow-2xl transition-all duration-500"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full blur-2xl -mr-12 -mt-12 group-hover:bg-primary/5 transition-colors" />
            
            <div className="flex items-center justify-between mb-6 relative">
              <div className={`p-4 rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3 ${stat.bg} ${stat.color} shadow-sm border border-white/50`}>
                <IconComponent className="w-7 h-7" />
              </div>
              <div className={`flex items-center gap-1 font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-widest ${
                stat.trend >= 0 ? 'text-emerald-600 bg-emerald-50' : 'text-rose-600 bg-rose-50'
              }`}>
                {stat.trend >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(stat.trend)}%
              </div>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-1">{stat.label}</p>
            <h3 className="text-4xl font-black text-foreground tracking-tighter">{stat.value}</h3>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
