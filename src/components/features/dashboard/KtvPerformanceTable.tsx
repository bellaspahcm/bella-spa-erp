'use client';

import { motion } from 'framer-motion';
import { Users, Clock, Star, Trophy, Diamond } from 'lucide-react';

import SkeletonLoader from '@/components/ui/SkeletonLoader';

interface KtvItem {
  name: string;
  sessions: number;
  rating: number;
  status: string;
  bonus: string;
}

interface KtvPerformanceTableProps {
  topKTVs: KtvItem[];
  isLoading?: boolean;
}

export function KtvPerformanceTable({ topKTVs, isLoading }: KtvPerformanceTableProps) {
  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white dark:border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
        <div className="flex items-center gap-3 mb-8">
          <SkeletonLoader variant="rectangular" width={40} height={40} className="rounded-xl" />
          <SkeletonLoader variant="text" width={220} height={28} className="rounded-md" />
        </div>
        
        <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
          <table className="bella-data-table min-w-[600px]">
            <thead>
              <tr className="text-left border-b border-pink-100">
                <th className="pb-4"><SkeletonLoader variant="text" width={100} height={14} /></th>
                <th className="pb-4"><SkeletonLoader variant="text" width={80} height={14} /></th>
                <th className="pb-4"><SkeletonLoader variant="text" width={70} height={14} /></th>
                <th className="pb-4 text-center"><SkeletonLoader variant="text" width={80} height={14} className="mx-auto" /></th>
                <th className="pb-4 text-right"><SkeletonLoader variant="text" width={80} height={14} className="ml-auto" /></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-pink-50">
              {[1, 2, 3, 4].map((i) => (
                <tr key={i}>
                  <td className="py-6"><SkeletonLoader variant="text" width={140} height={16} /></td>
                  <td className="py-6"><SkeletonLoader variant="text" width={80} height={16} /></td>
                  <td className="py-6">
                    <div className="flex items-center gap-1">
                      <SkeletonLoader variant="text" width={40} height={16} />
                      <SkeletonLoader variant="circular" width={16} height={16} />
                    </div>
                  </td>
                  <td className="py-6 text-center">
                    <SkeletonLoader variant="text" width={90} height={24} className="rounded-full mx-auto" />
                  </td>
                  <td className="py-6 text-right">
                    <SkeletonLoader variant="text" width={70} height={16} className="ml-auto" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    );
  }
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.6 }}
      className="glass-pink luxury-box-hover rounded-[3rem] p-10 shadow-sm border border-white relative overflow-hidden"
    >
      <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-primary/30 via-secondary/30 to-primary/30" />
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center">
          <Trophy className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground uppercase tracking-tight">Top KTV Xuất Sắc</h2>
      </div>
      
      <div className="overflow-x-auto overscroll-x-contain custom-scrollbar">
        <table className="bella-data-table min-w-[600px]">
          <thead>
            <tr className="text-left border-b border-pink-100">
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground flex items-center gap-2 whitespace-nowrap">
                <Users className="w-4 h-4" /> Tên KTV
              </th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                <Clock className="w-4 h-4 inline mr-2" /> Buổi
              </th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground whitespace-nowrap">
                <Star className="w-4 h-4 inline mr-2" /> Rating
              </th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-center whitespace-nowrap">Status</th>
              <th className="pb-4 font-bold text-xs uppercase tracking-widest text-muted-foreground text-right whitespace-nowrap">
                <Diamond className="w-4 h-4 inline mr-2" /> Bonus
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {topKTVs.map((ktv, idx) => (
              <tr key={idx} className="group hover:bg-white/40 transition-colors">
                <td className="py-6 font-bold text-foreground whitespace-nowrap">{ktv.name}</td>
                <td className="py-6 font-bold text-muted-foreground whitespace-nowrap">{ktv.sessions} buổi</td>
                <td className="py-6 font-bold text-muted-foreground whitespace-nowrap">
                  <div className="flex items-center gap-1">
                    {ktv.rating} <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                  </div>
                </td>
                <td className="py-6 text-center whitespace-nowrap">
                  <span className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest whitespace-nowrap ${
                    ktv.status === 'Xuất Sắc' 
                      ? 'bg-emerald-100 text-emerald-600 border border-emerald-200' 
                      : 'bg-blue-100 text-blue-600 border border-blue-200'
                  }`}>
                    {ktv.status}
                  </span>
                </td>
                <td className="py-6 text-right font-bold text-primary whitespace-nowrap">{ktv.bonus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
