'use client';

/**
 * Technician Dashboard Component
 * Displays technician workload, active jobs, and performance metrics
 */

import { User, Wrench, Clock, TrendingUp, Award, Activity } from 'lucide-react';

interface TechnicianWorkload {
  technicianId: string;
  technicianName: string;
  role?: string;
  activeOrders: number;
  totalHoursToday: number;
  completedToday: number;
  efficiency?: number; // percentage
  qualityScore?: number; // 0-100
  currentJobs: Array<{
    orderNumber: string;
    vehicleInfo: string;
    status: string;
    progress?: number;
    estimatedCompletion?: string;
  }>;
}

interface TechnicianDashboardProps {
  technicians: TechnicianWorkload[];
  onTechnicianClick?: (technicianId: string) => void;
}

export function TechnicianDashboard({
  technicians,
  onTechnicianClick,
}: TechnicianDashboardProps) {
  const getEfficiencyColor = (efficiency?: number) => {
    if (!efficiency) return 'text-slate-400';
    if (efficiency >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (efficiency >= 70) return 'text-cyan-600 dark:text-cyan-400';
    if (efficiency >= 50) return 'text-amber-605 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-450';
  };

  const getQualityColor = (score?: number) => {
    if (!score) return 'text-slate-400';
    if (score >= 90) return 'text-emerald-600 dark:text-emerald-400';
    if (score >= 70) return 'text-cyan-600 dark:text-cyan-400';
    if (score >= 50) return 'text-amber-605 dark:text-amber-400';
    return 'text-rose-600 dark:text-rose-450';
  };

  const getWorkloadStatus = (activeOrders: number) => {
    if (activeOrders === 0) {
      return { label: 'Rảnh', color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100/30 dark:border-emerald-900/20' };
    }
    if (activeOrders <= 2) {
      return { label: 'Bình thường', color: 'bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-400 border border-blue-100/30 dark:border-blue-900/20' };
    }
    if (activeOrders <= 4) {
      return { label: 'Bận', color: 'bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100/30 dark:border-amber-900/20' };
    }
    return { label: 'Quá tải', color: 'bg-rose-50 text-rose-700 dark:bg-rose-950/30 dark:text-rose-450 border border-rose-100/30 dark:border-rose-900/20' };
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[parts.length - 2][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getAvatarGradient = (id: string) => {
    const idx = parseInt(id) || 1;
    const gradients = [
      'from-cyan-500 to-blue-600',
      'from-indigo-500 to-purple-600',
      'from-violet-500 to-pink-600',
    ];
    return gradients[(idx - 1) % gradients.length];
  };

  return (
    <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-150 dark:border-slate-900 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-100/30 dark:border-cyan-900/20">
            <User className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Dashboard Kỹ Thuật Viên</h2>
            <p className="text-xs text-slate-400 mt-0.5">Quản lý khối lượng công việc, hiệu suất và chất lượng KTV</p>
          </div>
        </div>
        
        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100/80 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-xl text-xs font-bold text-slate-650 dark:text-slate-350 shadow-sm">
          Nhân sự hiện diện: <span className="text-cyan-600 dark:text-cyan-400">{technicians.length}</span> kỹ thuật viên
        </div>
      </div>

      {/* Technician Cards Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {technicians.map(tech => {
          const workloadStatus = getWorkloadStatus(tech.activeOrders);
          
          return (
            <div
              key={tech.technicianId}
              onClick={() => onTechnicianClick?.(tech.technicianId)}
              className="border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 cursor-pointer bg-white dark:bg-slate-900/20 flex flex-col"
            >
              {/* Card Header (Avatar + Workload) */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${getAvatarGradient(tech.technicianId)} text-white font-extrabold text-xs flex items-center justify-center shadow-sm shrink-0 uppercase`}>
                    {getInitials(tech.technicianName)}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                      {tech.technicianName}
                    </div>
                    {tech.role && (
                      <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-0.5 truncate">{tech.role}</div>
                    )}
                  </div>
                </div>
                
                <span className={`px-2 py-0.5 text-[9px] font-extrabold border uppercase tracking-wider rounded-md shrink-0 ${workloadStatus.color}`}>
                  {workloadStatus.label}
                </span>
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-3 gap-2 py-3 border-t border-b border-slate-100/50 dark:border-slate-800/30 mb-4 bg-slate-50/30 dark:bg-slate-900/10 rounded-xl">
                <div className="text-center">
                  <div className="text-lg font-black text-cyan-600 dark:text-cyan-400">
                    {tech.activeOrders}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Lệnh chạy</div>
                </div>
                
                <div className="text-center border-l border-r border-slate-100 dark:border-slate-800/50">
                  <div className="text-lg font-black text-purple-600 dark:text-purple-400">
                    {tech.totalHoursToday.toFixed(1)}h
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Thời gian</div>
                </div>
                
                <div className="text-center">
                  <div className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                    {tech.completedToday}
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Xong hôm nay</div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="flex items-center justify-around py-2.5 mb-4 bg-slate-50/50 dark:bg-slate-900/30 border border-slate-100/50 dark:border-slate-850/40 rounded-xl">
                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <TrendingUp className="h-3.5 w-3.5 text-slate-400" />
                    <span className={`text-xs font-black ${getEfficiencyColor(tech.efficiency)}`}>
                      {tech.efficiency ? `${tech.efficiency}%` : '—'}
                    </span>
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Hiệu suất</div>
                </div>

                <div className="w-px h-6 bg-slate-200 dark:bg-slate-850" />

                <div className="text-center flex-1">
                  <div className="flex items-center justify-center gap-1.5 mb-0.5">
                    <Award className="h-3.5 w-3.5 text-slate-400" />
                    <span className={`text-xs font-black ${getQualityColor(tech.qualityScore)}`}>
                      {tech.qualityScore ? `${tech.qualityScore}` : '—'}
                    </span>
                  </div>
                  <div className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Chất lượng</div>
                </div>
              </div>

              {/* Current Jobs */}
              <div className="mt-auto">
                {tech.currentJobs.length > 0 ? (
                  <div className="border-t border-slate-100/50 dark:border-slate-800/30 pt-3">
                    <div className="text-[10px] font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">
                      Lệnh đang xử lý:
                    </div>
                    <div className="space-y-2.5">
                      {tech.currentJobs.slice(0, 2).map((job, idx) => (
                        <div key={idx} className="text-xs">
                          <div className="flex items-center justify-between gap-2 mb-1.5">
                            <span className="font-extrabold text-[11px] tracking-wider text-slate-700 dark:text-slate-350">{job.orderNumber}</span>
                            <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 truncate">{job.vehicleInfo}</span>
                          </div>
                          {job.progress !== undefined && (
                            <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-1.5 overflow-hidden border border-slate-200/10 dark:border-slate-800/20 shadow-inner">
                              <div
                                className="bg-gradient-to-r from-cyan-500 to-blue-600 h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${job.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      ))}
                      {tech.currentJobs.length > 2 && (
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium italic text-right mt-1">
                          +{tech.currentJobs.length - 2} công việc khác
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="border-t border-slate-100/50 dark:border-slate-800/30 pt-3 text-[10px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider text-center italic py-2">
                    Chưa phân bổ việc
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {technicians.length === 0 && (
        <div className="p-12 text-center text-slate-400 dark:text-slate-500 border-t border-slate-100 dark:border-slate-900 bg-slate-50/10">
          <User className="h-10 w-10 mx-auto mb-3 opacity-40 text-cyan-600" />
          <p className="text-xs font-bold uppercase tracking-wider">Chưa có dữ liệu kỹ thuật viên</p>
        </div>
      )}

      {/* Summary Footer */}
      {technicians.length > 0 && (
        <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-900">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
              <div className="text-xl font-extrabold text-blue-600 dark:text-blue-450">
                {technicians.reduce((sum, t) => sum + t.activeOrders, 0)}
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Tổng việc</div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
              <div className="text-xl font-extrabold text-purple-600 dark:text-purple-450">
                {technicians.reduce((sum, t) => sum + t.totalHoursToday, 0).toFixed(1)}h
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Tổng giờ làm</div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
              <div className="text-xl font-extrabold text-emerald-600 dark:text-emerald-450">
                {technicians.reduce((sum, t) => sum + t.completedToday, 0)}
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Đã bàn giao</div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-900 rounded-2xl shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
              <div className="text-xl font-extrabold text-slate-650 dark:text-slate-350">
                {technicians.filter(t => t.activeOrders === 0).length}
              </div>
              <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">KTV rảnh</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
