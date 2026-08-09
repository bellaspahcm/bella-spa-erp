'use client';

import { useState, useEffect, useCallback } from 'react';
import { 
  Calendar, Clock, MapPin, ChevronLeft, Loader2,
  CalendarDays, PhoneCall, Users, FileText, CheckCircle
} from 'lucide-react';
import { getCalendarEvents, CalendarEvent } from '@/services/workforce-actions';
import { toast } from 'sonner';
import Link from 'next/link';

export default function WorkCalendar() {
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }); // YYYY-MM-DD
  });
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Generate days of current week
  const getWeekDays = () => {
    const days = [];
    const today = new Date();
    // Get start of week (Monday)
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    const startOfWeek = new Date(today.setDate(diff));

    for (let i = 0; i < 7; i++) {
      const current = new Date(startOfWeek);
      current.setDate(startOfWeek.getDate() + i);
      const dateString = current.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
      days.push({
        name: ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'][i],
        day: current.getDate(),
        fullDate: dateString,
        isToday: dateString === new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
      });
    }
    return days;
  };

  const weekDays = getWeekDays();

  const loadEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getCalendarEvents(selectedDate);
      setEvents(data);
    } catch (err: unknown) {
      toast.error('Lỗi khi tải lịch làm việc');
    } finally {
      setIsLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'visit': return <MapPin className="w-5 h-5 text-indigo-500" />;
      case 'meeting': return <PhoneCall className="w-5 h-5 text-emerald-500" />;
      case 'session': return <Users className="w-5 h-5 text-purple-500" />;
      default: return <FileText className="w-5 h-5 text-slate-500" />;
    }
  };

  return (
    <div className="pb-24 min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* HEADER */}
      <div className="px-6 pt-8 pb-4 bg-white dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800 sticky top-0 z-30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/workforce/dashboard" className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h2 className="text-base font-black uppercase tracking-wider text-slate-800 dark:text-slate-200">Lịch Làm Việc</h2>
        </div>
      </div>

      {/* WEEK SELECTION ROW */}
      <div className="bg-white dark:bg-slate-900 p-5 border-b border-slate-100 dark:border-slate-800">
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map(d => (
            <button
              key={d.fullDate}
              onClick={() => setSelectedDate(d.fullDate)}
              className={`p-3 rounded-2xl flex flex-col items-center gap-1.5 transition-all ${selectedDate === d.fullDate ? 'bg-primary text-white shadow-md shadow-primary/20 scale-105' : 'bg-slate-50 dark:bg-slate-850 hover:bg-slate-100'}`}
            >
              <span className={`text-[10px] font-black uppercase tracking-wider ${selectedDate === d.fullDate ? 'text-white/80' : 'text-slate-400'}`}>
                {d.name}
              </span>
              <span className="text-sm font-black leading-none">
                {d.day}
              </span>
              {d.isToday && selectedDate !== d.fullDate && (
                <span className="w-1.5 h-1.5 bg-primary rounded-full" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* EVENTS FOR SELECTED DAY */}
      <div className="p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-widest text-slate-450 flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-primary" /> Chi tiết ngày {new Date(selectedDate).toLocaleDateString('vi-VN')}
          </h3>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="mt-2 text-xs text-slate-400 font-bold uppercase tracking-wider">Đang tải lịch hẹn...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-12 text-center border border-slate-100 dark:border-slate-850">
            <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="mt-2 text-xs text-slate-450 font-bold uppercase tracking-wider">Không có lịch hẹn trong ngày này</p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {events.map(evt => (
              <div 
                key={evt.id}
                className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-slate-800 p-5 shadow-sm flex items-start gap-4"
              >
                {/* Time Indicator */}
                <div className="space-y-0.5 text-center flex-shrink-0 w-14">
                  <span className="text-xs font-black text-slate-800 dark:text-slate-200">{evt.time_start}</span>
                  <span className="text-[10px] text-slate-450 block font-bold">{evt.time_end}</span>
                </div>

                {/* Vertical Divider */}
                <div className="w-0.5 self-stretch bg-slate-100 dark:bg-slate-800 flex-shrink-0" />

                {/* Content */}
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <div className="p-1 bg-slate-50 dark:bg-slate-800 rounded-lg flex-shrink-0">
                      {getEventIcon(evt.type)}
                    </div>
                    <span className={`px-1.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-md border ${evt.status === 'completed' ? 'bg-emerald-50 text-emerald-600 border-emerald-250 dark:bg-emerald-950/20' : 'bg-primary/5 text-primary border-primary/20 dark:bg-primary/10'}`}>
                      {evt.status === 'completed' ? 'Hoàn thành' : 'Sắp diễn ra'}
                    </span>
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 leading-snug">{evt.title}</h4>
                    <p className="text-[11px] text-slate-550 dark:text-slate-400 font-medium">{evt.subtitle}</p>
                  </div>
                  {evt.location && (
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold pt-1">
                      <MapPin className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate max-w-[200px]">{evt.location}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
