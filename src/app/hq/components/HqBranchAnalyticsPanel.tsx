'use client';

import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import type { HqDashboardStats, HqTenantRecord } from '@/types/domain';

interface HqBranchAnalyticsPanelProps {
  stats: HqDashboardStats;
  tenants: HqTenantRecord[];
  maxGrowth: number;
  compareMetric: 'revenue' | 'customers';
  onCompareMetricChange: (metric: 'revenue' | 'customers') => void;
}

export function HqBranchAnalyticsPanel({
  stats,
  tenants,
  maxGrowth,
  compareMetric,
  onCompareMetricChange,
}: HqBranchAnalyticsPanelProps) {
  return (
    <section className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 bg-white p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm space-y-6 overflow-hidden">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest text-left">
            Xu hướng phát triển chi nhánh
          </h4>
          <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
            <TrendingUp size={14} className="text-emerald-500" />
            +Tăng trưởng hữu cơ
          </span>
        </div>

        <div className="h-64 flex items-end justify-between gap-2 sm:gap-4 pt-6 px-1 sm:px-4">
          {(stats.spaGrowthData || []).map((data, idx) => {
            const percentage = (data.spas / maxGrowth) * 80 + 20;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center gap-3 group h-full justify-end">
                <div className="relative w-full flex justify-center items-end h-full">
                  <div className="absolute top-[-30px] opacity-0 group-hover:opacity-100 bg-slate-900 text-white font-black text-[9px] px-2 py-1 rounded-lg transition-all scale-95 group-hover:scale-100 z-10 uppercase tracking-widest">
                    {data.spas} Spa
                  </div>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${percentage}%` }}
                    transition={{ duration: 0.8, delay: idx * 0.1, ease: 'easeOut' }}
                    className={`w-full max-w-[40px] rounded-t-xl transition-all ${
                      idx === (stats.spaGrowthData || []).length - 1
                        ? 'bg-gradient-to-t from-primary to-secondary shadow-lg shadow-pink-200 dark:shadow-none'
                        : 'bg-slate-100 group-hover:bg-indigo-50'
                    }`}
                  />
                </div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider text-center truncate w-full">
                  {data.month}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white p-4 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-100 shadow-sm space-y-6 text-left flex flex-col justify-between">
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
              Hiệu năng các chi nhánh
            </h4>

            <div className="flex bg-slate-100 border border-slate-200/50 rounded-xl p-0.5">
              <button
                onClick={() => onCompareMetricChange('revenue')}
                className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                  compareMetric === 'revenue'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Doanh thu
              </button>
              <button
                onClick={() => onCompareMetricChange('customers')}
                className={`px-2.5 py-1 rounded-lg font-black text-[9px] uppercase tracking-wider transition-all cursor-pointer ${
                  compareMetric === 'customers'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Khách hàng
              </button>
            </div>
          </div>

          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-4">
            {compareMetric === 'revenue' ? 'So sánh tổng doanh số thực thu tích lũy' : 'Tổng số lượng tệp khách hàng đăng ký'}
          </p>

          <div className="space-y-4">
            {tenants
              .filter(t => t.name !== 'Bella Spa Headquarter')
              .sort((a, b) => {
                if (compareMetric === 'revenue') {
                  return (b.revenueSum || 0) - (a.revenueSum || 0);
                }
                return (b.customerCount || 0) - (a.customerCount || 0);
              })
              .slice(0, 5)
              .map((branch, index) => {
                const cleanName = branch.name.replace('Bella Spa ', '');
                const val = compareMetric === 'revenue' ? (branch.revenueSum || 0) : (branch.customerCount || 0);
                const maxVal = compareMetric === 'revenue'
                  ? Math.max(...tenants.filter(t => t.name !== 'Bella Spa Headquarter').map(t => t.revenueSum || 0), 1)
                  : Math.max(...tenants.filter(t => t.name !== 'Bella Spa Headquarter').map(t => t.customerCount || 0), 1);

                const ratio = (val / maxVal) * 100;
                const rankColor = index === 0
                  ? 'text-yellow-500'
                  : index === 1
                    ? 'text-slate-400'
                    : index === 2
                      ? 'text-amber-600'
                      : 'text-slate-300';

                return (
                  <div key={branch.id} className="space-y-1.5 group">
                    <div className="flex justify-between items-center text-xs font-bold">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className={`font-black text-[11px] ${rankColor}`}>#{index + 1}</span>
                        <span className="text-slate-800 truncate" title={branch.name}>{cleanName}</span>
                      </div>
                      <span className="font-black text-slate-900 shrink-0">
                        {compareMetric === 'revenue' ? formatCurrency(val) : `${val.toLocaleString('vi-VN')} khách`}
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden relative shadow-inner">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${ratio}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut' }}
                        className={`h-full rounded-full bg-gradient-to-r ${
                          compareMetric === 'revenue'
                            ? 'from-rose-500 via-purple-600 to-indigo-500 shadow-md shadow-purple-200'
                            : 'from-sky-400 via-blue-500 to-indigo-600 shadow-md shadow-blue-200'
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
          </div>
        </div>

        <div className="pt-4 border-t border-slate-50 mt-4 flex items-center justify-between text-[9px] font-black text-slate-400 uppercase tracking-widest select-none">
          <span>* Dữ liệu thời gian thực</span>
          <span className="text-emerald-500 animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            Đã đồng bộ
          </span>
        </div>
      </div>
    </section>
  );
}
