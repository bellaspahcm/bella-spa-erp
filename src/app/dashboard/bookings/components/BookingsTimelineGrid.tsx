'use client';

import { useRef } from 'react';
import { Clock, Loader2, Plus } from 'lucide-react';

import {
  formatBookingCustomerLabel,
  getKtvFallbackSpecialtyByName,
  getPackageSpecialty,
} from '@/lib/business-rules/tenant-module-presentation';
import type { TenantModuleKey } from '@/lib/business-rules/tenant-modules';
import type { KtvSpecialty } from './BookingsSpecialtyFilter';

export type TimelineSession = {
  id: string;
  booking_id: string;
  assigned_date: string;
  assigned_time?: string | null;
  notes?: string | null;
  session_number?: number | null;
  status?: string | null;
  completed_by_ktv_id?: string | null;
  bookings?: {
    assigned_ktv_id?: string | null;
    booking_number?: string | null;
    completed_sessions?: number | null;
    total_sessions?: number | null;
    assigned_ktv?: {
      full_name?: string | null;
    } | null;
    customers?: {
      name_mother?: string | null;
      name_baby?: string | null;
      address?: string | null;
    } | null;
    packages?: {
      name?: string | null;
      module_key?: string | null;
      service_category?: string | null;
    } | null;
    package_name?: string | null;
  } | null;
};

export type KtvColumn = {
  id: string | null;
  full_name: string;
  role?: string | null;
  isUnassigned?: boolean;
};

type BookingsTimelineGridProps = {
  sessions: TimelineSession[];
  ktvs: KtvColumn[];
  selectedDate: Date;
  ktvSpecialty: KtvSpecialty;
  tenantModuleKey: TenantModuleKey;
  isSyncing: boolean;
  isSameDay: (d1: Date | string, d2: Date | string) => boolean;
  onSessionSelect: (session: TimelineSession) => void;
  onEmptySlotClick: (hour: number) => void;
};

function getSessionCategory(session: TimelineSession, tenantModuleKey: TenantModuleKey): KtvSpecialty {
  return getPackageSpecialty({
    tenantModuleKey,
    packageModuleKey: session.bookings?.packages?.module_key,
    serviceCategory: session.bookings?.packages?.service_category,
    packageName: session.bookings?.packages?.name || session.bookings?.package_name,
  });
}

function getSessionHourBlock(timeStr?: string | null) {
  if (!timeStr) return 9;

  const match = timeStr.match(/^(\d{2}):(\d{2})/);
  return match ? parseInt(match[1], 10) : 9;
}

export function BookingsTimelineGrid({
  sessions,
  ktvs,
  selectedDate,
  ktvSpecialty,
  tenantModuleKey,
  isSyncing,
  isSameDay,
  onSessionSelect,
  onEmptySlotClick,
}: BookingsTimelineGridProps) {
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  const getKtvSpecialty = (ktv: KtvColumn): KtvSpecialty => {
    const ktvSessions = sessions.filter((session) => {
      const activeKtvId = session.completed_by_ktv_id || session.bookings?.assigned_ktv_id;
      return activeKtvId === ktv.id && isSameDay(new Date(session.assigned_date), selectedDate);
    });

    if (ktvSessions.length > 0) {
      return getSessionCategory(ktvSessions[0], tenantModuleKey);
    }

    return getKtvFallbackSpecialtyByName(ktv.full_name, tenantModuleKey);
  };

  const filteredKtvs = ktvs.filter((ktv) => ktvSpecialty === 'all' || getKtvSpecialty(ktv) === ktvSpecialty);
  const columns: KtvColumn[] = [
    { id: null, full_name: 'Chưa phân công', role: 'ktv', isUnassigned: true },
    ...filteredKtvs,
  ];
  const hours = Array.from({ length: 12 }, (_, i) => 9 + i);

  return (
    <div className="relative border border-slate-200/60 rounded-[40px] bg-white shadow-xl shadow-slate-100/50 overflow-hidden flex flex-col">
      {isSyncing && (
        <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-40 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
        </div>
      )}

      <div className="flex bg-slate-50/50 border-b border-slate-100 sticky top-0 z-20">
        <div className="w-20 md:w-24 border-r border-slate-100 flex-shrink-0 bg-slate-50 flex items-center justify-center text-[10px] font-black uppercase text-slate-400 tracking-wider select-none">
          Giờ
        </div>

        <div
          ref={timelineScrollRef}
          className="flex flex-1 overflow-x-auto select-none no-scrollbar"
          onScroll={(event) => {
            const body = document.getElementById('timeline-body');
            if (body) body.scrollLeft = event.currentTarget.scrollLeft;
          }}
        >
          {columns.map((col) => (
            <div
              key={col.id || 'unassigned'}
              className="min-w-[200px] md:min-w-[240px] flex-1 py-4 px-6 text-center border-r border-slate-100 flex-shrink-0 flex flex-col items-center justify-center gap-1.5"
            >
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm select-none ${
                  col.isUnassigned
                    ? 'bg-rose-50 text-rose-500 border-2 border-rose-100 border-dashed animate-pulse'
                    : 'bg-gradient-to-tr from-rose-400 to-rose-300 text-white shadow-inner'
                }`}
              >
                {col.isUnassigned ? '?' : col.full_name[0]}
              </div>
              <div>
                <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">{col.full_name}</h3>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                  {col.isUnassigned
                    ? `${sessions.filter((session) => isSameDay(new Date(session.assigned_date), selectedDate) && !(session.completed_by_ktv_id || session.bookings?.assigned_ktv_id)).length} ca`
                    : `${sessions.filter((session) => isSameDay(new Date(session.assigned_date), selectedDate) && (session.completed_by_ktv_id || session.bookings?.assigned_ktv_id) === col.id).length} ca`}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        id="timeline-body"
        className="flex-1 overflow-x-auto no-scrollbar max-h-[640px]"
        onScroll={(event) => {
          const header = timelineScrollRef.current;
          if (header) header.scrollLeft = event.currentTarget.scrollLeft;
        }}
      >
        <div className="flex relative">
          <div className="w-20 md:w-24 border-r border-slate-100 flex-shrink-0 bg-white flex flex-col select-none">
            {hours.map((hour) => (
              <div key={hour} className="h-[116px] border-b border-slate-100/60 flex items-center justify-center">
                <span className="text-xs font-black text-slate-400 tracking-wider bg-slate-50 px-2.5 py-1 rounded-xl">
                  {String(hour).padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          <div className="flex flex-1">
            {columns.map((col) => (
              <div
                key={col.id || 'unassigned'}
                className="min-w-[200px] md:min-w-[240px] flex-1 flex-shrink-0 border-r border-slate-100 relative bg-slate-50/20"
              >
                {hours.map((hour) => {
                  const cellSessions = sessions.filter((session) => {
                    const activeKtvId = session.completed_by_ktv_id || session.bookings?.assigned_ktv_id;
                    const isKtvMatch = col.isUnassigned ? !activeKtvId : activeKtvId === col.id;

                    return (
                      isKtvMatch &&
                      isSameDay(new Date(session.assigned_date), selectedDate) &&
                      getSessionHourBlock(session.assigned_time) === hour
                    );
                  });

                  return (
                    <div
                      key={hour}
                      className="h-[116px] border-b border-slate-100/60 p-2.5 relative flex flex-col justify-start gap-2 group/cell transition-colors hover:bg-slate-50/40"
                    >
                      {cellSessions.length > 0 ? (
                        <div className="flex flex-col gap-2 overflow-y-auto max-h-full custom-scrollbar pr-0.5 z-10">
                          {cellSessions.map((session) => {
                            const isCompleted = session.status === 'completed';
                            const isInProgress = session.status === 'in_progress';
                            const isScheduled = session.status === 'scheduled';

                            return (
                              <div
                                key={session.id}
                                onClick={() => onSessionSelect(session)}
                                className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md select-none text-left ${
                                  isCompleted
                                    ? 'bg-emerald-50/80 border-emerald-100/80 hover:border-emerald-300 hover:bg-emerald-50'
                                    : isInProgress
                                      ? 'bg-sky-50/80 border-sky-100 hover:border-sky-300 hover:bg-sky-50'
                                      : isScheduled
                                        ? 'bg-rose-50/40 border-rose-100/50 hover:border-rose-200 hover:bg-rose-50'
                                        : 'bg-slate-50 border-slate-100 hover:bg-slate-100'
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1.5 mb-1">
                                  <span
                                    className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                      isCompleted
                                        ? 'bg-emerald-100 text-emerald-700'
                                        : isInProgress
                                          ? 'bg-sky-100 text-sky-700'
                                          : isScheduled
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-slate-100 text-slate-700'
                                    }`}
                                  >
                                    {isCompleted ? 'Xong' : isInProgress ? 'Chạy' : 'Sắp'}
                                  </span>
                                  <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5 shrink-0">
                                    <Clock className="w-2.5 h-2.5 text-rose-400" />
                                    {session.assigned_time || '09:00'}
                                  </span>
                                </div>
                                <h4 className="font-extrabold text-slate-800 text-xs truncate">
                                  {formatBookingCustomerLabel({
                                    moduleKey: tenantModuleKey,
                                    primaryName: session.bookings?.customers?.name_mother,
                                  })}
                                </h4>
                                {session.bookings?.customers?.name_baby && (
                                  <p className="text-[9px] font-bold text-rose-400 truncate">
                                    {formatBookingCustomerLabel({
                                      moduleKey: tenantModuleKey,
                                      primaryName: '',
                                      secondaryName: session.bookings.customers.name_baby,
                                    }).replace(/^.* - /, '')}
                                  </p>
                                )}
                                <p className="text-[9px] font-bold text-slate-400 truncate mt-0.5">
                                  {session.bookings?.packages?.name || session.bookings?.package_name || 'Liệu trình'}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          onClick={() => onEmptySlotClick(hour)}
                          className="absolute inset-0 rounded-xl m-1 flex items-center justify-center border border-dashed border-transparent hover:border-slate-200 hover:bg-white/70 cursor-pointer group transition-all duration-200 z-0"
                        >
                          <Plus className="w-4 h-4 text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
