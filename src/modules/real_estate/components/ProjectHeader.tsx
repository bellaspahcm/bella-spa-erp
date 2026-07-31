'use client';

import React from 'react';
import { Database } from '@/types/database.types';
import { Building2, MapPin, RefreshCw } from 'lucide-react';

type ProjectRow = Database['public']['Tables']['real_estate_projects']['Row'];
type ProductRow = Database['public']['Tables']['real_estate_products']['Row'];

interface ProjectHeaderProps {
  project: ProjectRow | null;
  products: ProductRow[];
  onRefresh?: () => void;
}

export const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  products,
  onRefresh,
}) => {
  const totalUnits = products.length;

  const counts = products.reduce(
    (acc, p) => {
      const st = p.status || 'available';
      acc[st] = (acc[st] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  const availableCount = counts['available'] || 0;
  const bookedCount = counts['booked'] || 0;
  const depositedCount = counts['deposited'] || 0;
  const contractedCount = counts['contracted'] || 0;
  const paidCount = counts['paid'] || 0;
  const handedOverCount = counts['handed_over'] || 0;

  return (
    <div className="backdrop-blur-md bg-white/70 dark:bg-slate-900/80 border border-slate-200/50 dark:border-slate-800/50 shadow-xl shadow-slate-100/40 dark:shadow-none rounded-2xl p-6 mb-6 transition-all duration-300">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 dark:from-blue-600 dark:to-indigo-800 text-white shadow-lg shadow-blue-500/10 dark:shadow-none hidden sm:block">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center flex-wrap gap-2">
              <span className="px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-full bg-blue-50 text-blue-700 border border-blue-200/50 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-900/40">
                Dự Án Bất Động Sản
              </span>
              <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/50 px-2 py-0.5 rounded-full border border-slate-100 dark:border-slate-850">
                ID: {project?.id ? project.id.substring(0, 8) : 'N/A'}
              </span>
            </div>
            <h1 className="text-2xl font-black text-slate-800 dark:text-slate-100 mt-1.5 tracking-tight">
              {project?.name || 'Vinhomes Green Paradise'}
            </h1>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-rose-500" />
              {project?.location || 'TP. Hồ Chí Minh'}
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            onClick={onRefresh}
            className="self-start md:self-auto px-4 py-2.5 text-xs font-bold text-slate-700 bg-slate-50 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700/80 rounded-xl transition-all border border-slate-200/60 dark:border-slate-750 flex items-center gap-2 hover:scale-[1.02] active:scale-95 shadow-sm"
          >
            <RefreshCw className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" />
            Tải lại dữ liệu
          </button>
        )}
      </div>

      <hr className="my-6 border-slate-100 dark:border-slate-800/60" />

      {/* KPI Counters Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-3">
        {/* Total Units */}
        <div className="p-3.5 rounded-xl bg-slate-50/50 dark:bg-slate-800/30 border border-slate-200/40 dark:border-slate-850 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Tổng Số Căn</p>
          <p className="text-2xl font-extrabold text-slate-800 dark:text-white mt-1 group-hover:scale-105 transition-transform duration-300">{totalUnits}</p>
        </div>

        {/* Tự Do */}
        <div className="p-3.5 rounded-xl bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/30 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Tự Do</p>
          <p className="text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 mt-1 group-hover:scale-105 transition-transform duration-300">{availableCount}</p>
        </div>

        {/* Giữ Chỗ */}
        <div className="p-3.5 rounded-xl bg-amber-50/40 dark:bg-amber-950/10 border border-amber-100 dark:border-amber-900/30 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Giữ Chỗ</p>
          <p className="text-2xl font-extrabold text-amber-700 dark:text-amber-400 mt-1 group-hover:scale-105 transition-transform duration-300">{bookedCount}</p>
        </div>

        {/* Đã Cọc */}
        <div className="p-3.5 rounded-xl bg-rose-50/40 dark:bg-rose-950/10 border border-rose-100 dark:border-rose-900/30 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Đã Cọc</p>
          <p className="text-2xl font-extrabold text-rose-700 dark:text-rose-400 mt-1 group-hover:scale-105 transition-transform duration-300">{depositedCount}</p>
        </div>

        {/* Ký HĐMB */}
        <div className="p-3.5 rounded-xl bg-purple-50/40 dark:bg-purple-950/10 border border-purple-100 dark:border-purple-900/30 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Ký HĐMB</p>
          <p className="text-2xl font-extrabold text-purple-700 dark:text-purple-400 mt-1 group-hover:scale-105 transition-transform duration-300">{contractedCount}</p>
        </div>

        {/* Thanh Toán */}
        <div className="p-3.5 rounded-xl bg-blue-50/40 dark:bg-blue-950/10 border border-blue-100 dark:border-blue-900/30 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Thanh Toán</p>
          <p className="text-2xl font-extrabold text-blue-700 dark:text-blue-400 mt-1 group-hover:scale-105 transition-transform duration-300">{paidCount}</p>
        </div>

        {/* Bàn Giao */}
        <div className="p-3.5 rounded-xl bg-yellow-50/40 dark:bg-yellow-950/10 border border-yellow-100 dark:border-yellow-900/30 text-center hover:shadow-md transition-all duration-300 group">
          <p className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Bàn Giao</p>
          <p className="text-2xl font-extrabold text-yellow-700 dark:text-yellow-400 mt-1 group-hover:scale-105 transition-transform duration-300">{handedOverCount}</p>
        </div>
      </div>
    </div>
  );
};

