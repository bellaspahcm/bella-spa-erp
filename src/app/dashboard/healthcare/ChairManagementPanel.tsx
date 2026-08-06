'use client';

import React from 'react';
import { Armchair, Sparkles, CheckCircle2, Clock, Activity, AlertCircle, RefreshCw, UserCheck } from 'lucide-react';
import type { ChairInfo, ResourceUtilization } from '@/modules/bella-healthcare/types/encounter-aggregate';

export interface ChairManagementPanelProps {
  readonly chairs: ChairInfo[];
  readonly metrics: ResourceUtilization;
  readonly onAssignChair?: (chairId: string) => void;
  readonly onToggleStatus?: (chairId: string, newStatus: ChairInfo['status']) => void;
}

export function ChairManagementPanel({
  chairs,
  metrics,
  onAssignChair,
  onToggleStatus,
}: ChairManagementPanelProps) {
  const getStatusBadge = (status: ChairInfo['status']) => {
    switch (status) {
      case 'occupied':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black bg-teal-500/10 text-teal-600 dark:text-teal-400 border border-teal-500/20 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
            ĐANG ĐIỀU TRỊ
          </span>
        );
      case 'available':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            SẴN SÀNG
          </span>
        );
      case 'sanitizing':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 rounded-full flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-amber-500" />
            KHỬ TRÙNG
          </span>
        );
      case 'maintenance':
        return (
          <span className="px-2.5 py-0.5 text-[10px] font-black bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 rounded-full flex items-center gap-1">
            BẢO TRÌ
          </span>
        );
    }
  };

  return (
    <div className="p-6 rounded-[28px] hc-glass-card border border-slate-200/90 dark:border-slate-800/90 shadow-xl space-y-6">
      {/* Header & Resource Utilization Metrics */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <span className="p-1.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <Armchair className="w-5 h-5" />
            </span>
            Chair & Resource Management (Ma trận Ghế điều trị)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Quản lý và điều phối ghế điều trị, công suất bác sĩ và phòng kỹ thuật theo thời gian thực
          </p>
        </div>

        {/* Live Utilization Metrics Pills */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-left">
            <span className="text-[9px] font-bold text-teal-600 dark:text-teal-400 uppercase block">Chair Utilization</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{metrics.chairOccupancyRate}% công suất</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-left">
            <span className="text-[9px] font-bold text-blue-600 dark:text-blue-400 uppercase block">Doctor Utilization</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{metrics.doctorOccupancyRate}% hiệu suất</span>
          </div>

          <div className="px-3.5 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-left">
            <span className="text-[9px] font-bold text-amber-600 dark:text-amber-400 uppercase block">Chờ trung bình</span>
            <span className="text-sm font-black text-slate-900 dark:text-white">{metrics.avgWaitTimeMinutes} phút</span>
          </div>
        </div>
      </div>

      {/* Chair Cards Matrix Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {chairs.map((chair) => (
          <div
            key={chair.id}
            className={`p-4 rounded-2xl border transition-all duration-300 text-left relative group ${
              chair.status === 'occupied'
                ? 'bg-teal-50/40 dark:bg-teal-950/20 border-teal-200/80 dark:border-teal-900/50 shadow-sm'
                : chair.status === 'sanitizing'
                ? 'bg-amber-50/40 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/50'
                : 'bg-white/90 dark:bg-slate-900/90 border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="font-extrabold text-xs text-slate-900 dark:text-white flex items-center gap-1.5">
                <Armchair className="w-4 h-4 text-slate-500" />
                {chair.code}
              </span>
              {getStatusBadge(chair.status)}
            </div>

            <p className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 mb-3">{chair.zone}</p>

            {chair.status === 'occupied' ? (
              <div className="space-y-1.5 pt-2 border-t border-teal-100 dark:border-teal-900/40">
                <p className="text-xs font-bold text-slate-900 dark:text-white leading-tight">
                  BN: {chair.currentPatientName || 'Nguyễn Văn Hùng'}
                </p>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">
                  BS: <b className="text-slate-700 dark:text-slate-300">{chair.currentDoctorName || 'BS. Lê Minh'}</b>
                </p>
                {chair.estimatedMinutesRemaining !== undefined && (
                  <div className="flex items-center justify-between text-[10px] font-extrabold text-teal-600 dark:text-teal-400 pt-1">
                    <span>Còn lại: ~{chair.estimatedMinutesRemaining}p</span>
                    <Clock className="w-3 h-3 animate-spin" />
                  </div>
                )}
              </div>
            ) : chair.status === 'sanitizing' ? (
              <div className="space-y-1.5 pt-2 border-t border-amber-100 dark:border-amber-900/40 text-[10px]">
                <p className="font-bold text-amber-700 dark:text-amber-300">Đang khử trùng tia UV & lau cồn</p>
                <p className="text-slate-500">Hoàn thành trong 5 phút</p>
              </div>
            ) : (
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center py-2">
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400">Ghế trống sẵn sàng</p>
                {onAssignChair && (
                  <button
                    onClick={() => onAssignChair(chair.id)}
                    className="mt-2 w-full py-1 text-[10px] font-extrabold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-all active:scale-95"
                  >
                    + Phân ghế ngay
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
