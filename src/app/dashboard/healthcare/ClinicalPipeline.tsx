'use client';
import React from 'react';
import { User, Clipboard, UserCheck, Calendar, Activity, CheckCircle } from 'lucide-react';

export interface EncounterItem {
  readonly id: string;
  readonly patientName: string;
  readonly doctorName?: string;
  readonly status: 'planned' | 'arrived' | 'in_progress' | 'finished';
  readonly chiefComplaint?: string;
  readonly scheduledAt?: string;
  readonly arrivedAt?: string;
  readonly queueNumber?: number;
}

export interface ClinicalPipelineProps {
  readonly encounters: EncounterItem[];
  readonly onUpdateStatus: (id: string, newStatus: EncounterItem['status']) => void;
  readonly onSelectPatient: (patientId: string) => void;
  readonly selectedEncounterId: string | null;
  readonly onSelectEncounter: (id: string) => void;
}

export function ClinicalPipeline({
  encounters,
  onUpdateStatus,
  onSelectPatient,
  selectedEncounterId,
  onSelectEncounter,
}: ClinicalPipelineProps) {
  const categories = [
    { key: 'planned', label: 'Lên lịch hẹn', icon: Calendar, color: 'text-blue-600 bg-blue-500/10 border-blue-500/20' },
    { key: 'arrived', label: 'Phòng chờ (Queue)', icon: UserCheck, color: 'text-amber-600 bg-amber-500/10 border-amber-500/20' },
    { key: 'in_progress', label: 'Đang điều trị', icon: Activity, color: 'text-teal-600 bg-teal-500/10 border-teal-500/20' },
    { key: 'finished', label: 'Đã hoàn tất', icon: CheckCircle, color: 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20' },
  ];

  const columnStyles: Record<string, string> = {
    planned: 'bg-gradient-to-b from-blue-50/40 to-slate-50/20 dark:from-blue-950/20 dark:to-slate-950/20 border-blue-200/60 dark:border-blue-900/40',
    arrived: 'bg-gradient-to-b from-amber-50/40 to-slate-50/20 dark:from-amber-950/20 dark:to-slate-950/20 border-amber-200/60 dark:border-amber-900/40',
    in_progress: 'bg-gradient-to-b from-teal-50/40 to-slate-50/20 dark:from-teal-950/20 dark:to-slate-950/20 border-teal-200/60 dark:border-teal-900/40',
    finished: 'bg-gradient-to-b from-emerald-50/40 to-slate-50/20 dark:from-emerald-950/20 dark:to-slate-950/20 border-emerald-200/60 dark:border-emerald-900/40',
  };

  const cardStyles: Record<string, { selected: string; normal: string }> = {
    planned: {
      selected: 'border-blue-500 shadow-lg shadow-blue-500/15 ring-2 ring-blue-500/30 dark:border-blue-400 dark:shadow-blue-500/25',
      normal: 'border-slate-200/80 hover:border-blue-400 hover:shadow-md dark:border-slate-800/80 dark:hover:border-blue-700'
    },
    arrived: {
      selected: 'border-amber-500 shadow-lg shadow-amber-500/15 ring-2 ring-amber-500/30 dark:border-amber-400 dark:shadow-amber-500/25',
      normal: 'border-slate-200/80 hover:border-amber-400 hover:shadow-md dark:border-slate-800/80 dark:hover:border-amber-700'
    },
    in_progress: {
      selected: 'border-teal-500 shadow-lg shadow-teal-500/15 ring-2 ring-teal-500/30 dark:border-teal-400 dark:shadow-teal-500/25',
      normal: 'border-slate-200/80 hover:border-teal-400 hover:shadow-md dark:border-slate-800/80 dark:hover:border-teal-700'
    },
    finished: {
      selected: 'border-emerald-500 shadow-lg shadow-emerald-500/15 ring-2 ring-emerald-500/30 dark:border-emerald-400 dark:shadow-emerald-500/25',
      normal: 'border-slate-200/80 hover:border-emerald-400 hover:shadow-md dark:border-slate-800/80 dark:hover:border-emerald-700'
    }
  };
  const getFiltered = (status: string) => encounters.filter((e) => e.status === status);

  return (
    <div className="flex flex-col gap-6 p-7 rounded-[28px] hc-glass-card hc-glass-card-hover border border-slate-200/90 dark:border-slate-800/90 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800/60">
        <div>
          <h2 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2 tracking-tight">
            <span className="p-1.5 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">📋</span>
            Hàng đợi khám & Tiếp đón (Clinical Pipeline)
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">
            Theo dõi luồng dịch chuyển bệnh nhân trong phòng khám theo thời gian thực
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            Tổng lượt: {encounters.length}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 overflow-x-auto p-1">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const items = getFiltered(cat.key);

          return (
            <div
              key={cat.key}
              className={`flex flex-col gap-3.5 p-4 rounded-2xl border transition-all duration-300 min-w-[220px] ${
                columnStyles[cat.key] || columnStyles.planned
              }`}
            >
              {/* Category Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-slate-800/60">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-xl border ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200 tracking-tight">
                    {cat.label}
                  </span>
                </div>
                <span className="text-[11px] font-extrabold px-2 py-0.5 bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-full shadow-inner">
                  {items.length}
                </span>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-3 max-h-[440px] overflow-y-auto p-2 scrollbar-thin">
                {items.length > 0 ? (
                  items.map((item) => {
                    const isSelected = selectedEncounterId === item.id;
                    const style = cardStyles[item.status] || cardStyles.planned;
                    const patientInitials = item.patientName.split(' ').map((n) => n[0]).join('').slice(0, 2);

                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectEncounter(item.id)}
                        className={`p-4 rounded-2xl border transition-all duration-300 text-left cursor-pointer group bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm ${
                          isSelected ? style.selected : style.normal
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-extrabold text-xs flex items-center justify-center border border-slate-200 dark:border-slate-700 shrink-0">
                              {patientInitials}
                            </div>
                            <div>
                              <h4 className="font-extrabold text-xs text-slate-900 dark:text-white group-hover:text-teal-600 dark:group-hover:text-teal-400 transition-colors leading-tight">
                                {item.patientName}
                              </h4>
                              {item.queueNumber && (
                                <span className="text-[9px] font-extrabold px-1.5 py-0.2 bg-teal-50 text-teal-600 dark:bg-teal-950/60 dark:text-teal-300 rounded-md inline-block mt-0.5">
                                  Stt: #{item.queueNumber}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {item.chiefComplaint && (
                          <div className="mt-2.5 p-2 rounded-xl bg-slate-50 dark:bg-slate-850 border border-slate-100 dark:border-slate-800">
                            <p className="text-[10px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                              Lý do: <b className="text-slate-800 dark:text-slate-200">{item.chiefComplaint}</b>
                            </p>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                          <div className="flex items-center gap-1">
                            <User className="w-3 h-3 text-slate-400" />
                            <span>{item.doctorName ? (item.doctorName.startsWith('BS') ? item.doctorName : `BS. ${item.doctorName}`) : 'BS: Chưa phân công'}</span>
                          </div>
                          {item.scheduledAt && (
                            <span className="text-[9px] text-blue-500 dark:text-blue-400">
                              {new Date(item.scheduledAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          )}
                        </div>

                        {/* Status transition actions */}
                        <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                          {item.status === 'planned' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'arrived');
                              }}
                              className="w-full text-center py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-extrabold text-[10px] rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              Check-In Tiếp Đón
                            </button>
                          )}
                          {item.status === 'arrived' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'in_progress');
                              }}
                              className="w-full text-center py-1.5 bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-600 hover:to-teal-700 text-white font-extrabold text-[10px] rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              Bắt đầu Điều trị
                            </button>
                          )}
                          {item.status === 'in_progress' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'finished');
                              }}
                              className="w-full text-center py-1.5 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-extrabold text-[10px] rounded-xl shadow-sm transition-all active:scale-95"
                            >
                              Hoàn tất Khám
                            </button>
                          )}
                          {item.status === 'finished' && (
                            <div className="w-full text-center py-1 text-emerald-600 dark:text-emerald-400 font-extrabold text-[10px] flex items-center justify-center gap-1">
                              <CheckCircle className="w-3 h-3" /> Đã hoàn thành
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-xs text-slate-400 font-medium border border-dashed border-slate-200/80 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30">
                    Không có lượt khám
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

