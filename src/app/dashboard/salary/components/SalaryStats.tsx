'use client';

import { motion } from 'framer-motion';
import { DollarSign, TrendingUp, CheckCircle2 } from 'lucide-react';
import { KtvSalaryRecord, CurrentUser } from '@/types/domain';

import SkeletonLoader from '@/components/ui/SkeletonLoader';

interface SalaryStatsProps {
  totalPayout: number;
  totalSessions: number;
  ktvSalaries: KtvSalaryRecord[];
  currentUser: CurrentUser | null;
  prevMonthYear: string;
  isLoading?: boolean;
}

export default function SalaryStats({
  totalPayout,
  totalSessions,
  ktvSalaries,
  currentUser,
  prevMonthYear,
  isLoading = false,
}: SalaryStatsProps) {
  if (isLoading) {
    return (
      <div className="mb-6 grid grid-cols-1 gap-4 md:mb-10 md:grid-cols-3 md:gap-6">
        <SkeletonLoader variant="card" className="w-full h-48 bg-gradient-to-r from-pink-500/10 via-rose-500/10 to-pink-500/10 border-pink-200/20" />
        <SkeletonLoader variant="card" className="w-full h-48 bg-white/40 dark:bg-zinc-800/40" />
        <SkeletonLoader variant="card" className="w-full h-48 bg-white/40 dark:bg-zinc-800/40" />
      </div>
    );
  }

  const maxSalary = ktvSalaries.length > 0 
    ? Math.max(...ktvSalaries.map((s) => s.totalSalary)) 
    : 0;

  return (
    <div className="mb-6 grid grid-cols-1 gap-4 md:mb-10 md:grid-cols-3 md:gap-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="luxury-card-pink relative overflow-hidden rounded-[2rem] p-5 sm:p-6 md:rounded-[40px] md:p-8"
      >
        <div className="relative z-10 text-white">
          <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center mb-6 backdrop-blur-md border border-white/20">
            <DollarSign className="w-6 h-6 text-white" />
          </div>
          <p className="text-sm font-black !text-white/90 uppercase tracking-widest mb-2">
            {currentUser?.role?.toLowerCase() === 'ktv' ? 'Thu nhập của bạn' : 'Tổng quỹ lương tháng'}
          </p>
          <h3 className="mb-4 text-3xl font-black sm:text-4xl !text-white">{totalPayout.toLocaleString()}đ</h3>
          <div className="flex items-center gap-2 !text-white/90 font-black text-sm">
            <TrendingUp className="w-4 h-4" />
            So với tháng {prevMonthYear}
          </div>
        </div>
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-5 sm:p-6 md:rounded-[40px] md:p-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center">
            <CheckCircle2 className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Tổng buổi hoàn thành</p>
            <h4 className="text-2xl font-black text-slate-900">{totalSessions} Buổi</h4>
          </div>
        </div>
        <p className="text-xs font-bold text-slate-500">Dựa trên dữ liệu thực tế hệ thống</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="luxury-card-white flex flex-col justify-center rounded-[2rem] p-5 sm:p-6 md:rounded-[40px] md:p-8"
      >
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Thu nhập cao nhất</p>
            <h4 className="text-2xl font-black text-slate-900">
              {maxSalary.toLocaleString('vi-VN')}đ
            </h4>
          </div>
        </div>
        <p className="text-xs font-bold text-slate-500">Nhân viên đạt hiệu suất tốt nhất</p>
      </motion.div>
    </div>
  );
}
