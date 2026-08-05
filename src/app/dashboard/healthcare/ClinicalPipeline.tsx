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
    { key: 'planned', label: 'Lên lịch hẹn', icon: Calendar, color: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20' },
    { key: 'arrived', label: 'Phòng chờ (Queue)', icon: UserCheck, color: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
    { key: 'in_progress', label: 'Đang điều trị', icon: Activity, color: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20' },
    { key: 'finished', label: 'Đã hoàn tất', icon: CheckCircle, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' },
  ];

  const getFiltered = (status: string) => encounters.filter((e) => e.status === status);

  return (
    <div className="flex flex-col gap-6 p-6 rounded-2xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 shadow-sm height-full">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
          📋 Hàng đợi khám & Tiếp đón (Clinical Pipeline)
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Theo dõi luồng dịch chuyển bệnh nhân trong phòng khám theo thời gian thực
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 overflow-x-auto">
        {categories.map((cat) => {
          const Icon = cat.icon;
          const items = getFiltered(cat.key);

          return (
            <div
              key={cat.key}
              className="flex flex-col gap-3 p-4 rounded-xl bg-slate-50/70 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/60 min-w-[200px]"
            >
              {/* Category Header */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200/50 dark:border-slate-800/50">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </span>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                    {cat.label}
                  </span>
                </div>
                <span className="text-[10px] font-bold px-1.5 py-0.5 bg-slate-200/80 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-full">
                  {items.length}
                </span>
              </div>

              {/* Items List */}
              <div className="flex flex-col gap-2.5 max-h-[420px] overflow-y-auto pr-0.5 scrollbar-thin">
                {items.length > 0 ? (
                  items.map((item) => {
                    const isSelected = selectedEncounterId === item.id;
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelectEncounter(item.id)}
                        className={`p-3 rounded-xl border transition-all text-left cursor-pointer group ${
                          isSelected
                            ? 'bg-white border-teal-500 shadow-md dark:bg-slate-950 scale-[1.02]'
                            : 'bg-white border-slate-200/60 hover:border-slate-300 dark:bg-slate-950 dark:border-slate-800/60'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1.5">
                          <h4 className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-teal-600 transition-colors">
                            {item.patientName}
                          </h4>
                          {item.queueNumber && (
                            <span className="text-[9px] font-bold px-1.5 py-0.5 bg-teal-50 text-teal-600 dark:bg-teal-950/40 dark:text-teal-400 rounded-lg shrink-0">
                              Stt: {item.queueNumber}
                            </span>
                          )}
                        </div>

                        {item.chiefComplaint && (
                          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                            Lý do: <b className="text-slate-600 dark:text-slate-300">{item.chiefComplaint}</b>
                          </p>
                        )}

                        <div className="flex items-center gap-1 mt-2 text-[9px] text-slate-400 dark:text-slate-500 font-semibold">
                          <User className="w-3 h-3" />
                          <span>BS: {item.doctorName || 'Chưa phân công'}</span>
                        </div>

                        {/* Status transition actions */}
                        <div className="flex items-center gap-1.5 mt-3 pt-2 border-t border-slate-100 dark:border-slate-800/60 opacity-0 group-hover:opacity-100 transition-opacity">
                          {item.status === 'planned' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'arrived');
                              }}
                              className="w-full text-center py-1 bg-amber-500 text-white font-bold text-[9px] rounded-md hover:bg-amber-600 transition-colors"
                            >
                              Check-In
                            </button>
                          )}
                          {item.status === 'arrived' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'in_progress');
                              }}
                              className="w-full text-center py-1 bg-teal-600 text-white font-bold text-[9px] rounded-md hover:bg-teal-700 transition-colors"
                            >
                              Bắt đầu điều trị
                            </button>
                          )}
                          {item.status === 'in_progress' && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateStatus(item.id, 'finished');
                              }}
                              className="w-full text-center py-1 bg-emerald-600 text-white font-bold text-[9px] rounded-md hover:bg-emerald-700 transition-colors"
                            >
                              Hoàn tất khám
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-6 text-center text-[10px] text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
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
