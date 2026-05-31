'use client';

import { Calendar as CalendarIcon, CalendarDays, Plus } from 'lucide-react';

import PremiumExportButton from '@/components/ui/PremiumExportButton';

export type BookingsViewMode = 'calendar' | 'timeline';

type BookingsPageHeaderProps = {
  view: BookingsViewMode;
  onViewChange: (view: BookingsViewMode) => void;
  onCreateClick: () => void;
};

export function BookingsPageHeader({
  view,
  onViewChange,
  onCreateClick,
}: BookingsPageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lịch hẹn</h1>
        <p className="text-slate-500 font-medium mt-1">Điều phối và theo dõi lịch chăm sóc</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shadow-inner w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={() => onViewChange('timeline')}
            type="button"
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
              view === 'timeline'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5 text-rose-500" />
            <span>Timeline KTV</span>
          </button>
          <button
            onClick={() => onViewChange('calendar')}
            type="button"
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
              view === 'calendar'
                ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <CalendarIcon className="w-3.5 h-3.5 text-rose-500" />
            <span>Lịch tháng</span>
          </button>
        </div>

        <div className="flex items-center gap-2 justify-center w-full sm:w-auto">
          <div className="shrink-0">
            <PremiumExportButton />
          </div>
          <button
            type="button"
            onClick={onCreateClick}
            className="flex-grow sm:flex-initial flex items-center justify-center gap-2 bg-primary hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 dark:shadow-none active:scale-95 text-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>
    </div>
  );
}
