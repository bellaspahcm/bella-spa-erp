'use client';

/**
 * Service Calendar Component
 * Displays service appointments in Day, Week, and Month calendar views
 * Designed with high contrast, modern layout, and clean typography
 */

import { useState, useMemo, useEffect } from 'react';
import { Calendar as CalendarIcon, Clock, User, Car, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

interface ServiceAppointment {
  id: string;
  appointmentNumber: string;
  customerName: string;
  vehicleInfo: string;
  licensePlate: string;
  scheduledDate: string;
  scheduledTime: string;
  serviceType: string;
  status: string;
  serviceAdvisorName?: string;
  estimatedDuration?: number;
}

interface ServiceCalendarProps {
  appointments: ServiceAppointment[];
  onAppointmentClick?: (appointment: ServiceAppointment) => void;
  onReschedule?: (appointmentId: string, newDate: string, newTime: string) => void;
  selectedDate?: Date;
  onDateChange?: (date: Date) => void;
}

type ViewMode = 'day' | 'week' | 'month';

export function ServiceCalendar({
  appointments,
  onAppointmentClick,
  onReschedule: _onReschedule,
  selectedDate = new Date(),
  onDateChange,
}: ServiceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  useEffect(() => {
    setCurrentDate(selectedDate);
  }, [selectedDate]);

  // Helper to format date string to YYYY-MM-DD in local time
  const getLocalDateStr = (date: Date) => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Generate days of the week containing the currentDate
  const weekDays = useMemo(() => {
    const current = new Date(currentDate);
    const day = current.getDay(); // 0 is Sunday, 1 is Monday...
    const diff = current.getDate() - day + (day === 0 ? -6 : 1); // Adjust to get Monday
    const monday = new Date(current.setDate(diff));
    
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Generate 42 days grid for the month view containing the currentDate
  const monthGridDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    
    let startDayOfWeek = firstDay.getDay(); // 0 is Sunday, 1 is Monday...
    // Adjust to make Monday index 0
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    
    const startDate = new Date(firstDay);
    startDate.setDate(firstDay.getDate() - startDayOfWeek);
    
    const days = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      days.push(d);
    }
    return days;
  }, [currentDate]);

  // Filter appointments for active Day view
  const dayAppointments = useMemo(() => {
    const dateStr = getLocalDateStr(currentDate);
    return appointments.filter(apt => apt.scheduledDate === dateStr);
  }, [appointments, currentDate]);

  // Map appointments to date string key for fast lookups in Week and Month views
  const appointmentsByDate = useMemo(() => {
    const map: Record<string, ServiceAppointment[]> = {};
    appointments.forEach(apt => {
      if (!map[apt.scheduledDate]) {
        map[apt.scheduledDate] = [];
      }
      map[apt.scheduledDate].push(apt);
    });
    return map;
  }, [appointments]);

  // Generate time slots (8 AM - 6 PM, 30 min intervals)
  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      slots.push(`${hour.toString().padStart(2, '0')}:00`);
      if (hour < 18) {
        slots.push(`${hour.toString().padStart(2, '0')}:30`);
      }
    }
    return slots;
  }, []);

  // Group appointments for the selected Day view by time slot
  const appointmentsBySlot = useMemo(() => {
    const grouped: Record<string, ServiceAppointment[]> = {};
    timeSlots.forEach(slot => {
      grouped[slot] = [];
    });

    dayAppointments.forEach(apt => {
      const time = apt.scheduledTime.substring(0, 5); // HH:MM
      if (grouped[time]) {
        grouped[time].push(apt);
      }
    });

    return grouped;
  }, [dayAppointments, timeSlots]);

  // Navigation handlers
  const handlePrev = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() - 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const handleNext = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'day') {
      newDate.setDate(newDate.getDate() + 1);
    } else if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else if (viewMode === 'month') {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentDate(today);
    onDateChange?.(today);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'from-emerald-50/70 to-emerald-100/40 dark:from-emerald-950/30 dark:to-emerald-900/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 border-l-4 border-l-emerald-500';
      case 'checked_in':
        return 'from-blue-50/70 to-blue-100/40 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-300 dark:border-blue-800 text-blue-800 dark:text-blue-300 border-l-4 border-l-blue-500';
      case 'in_progress':
        return 'from-cyan-50/70 to-cyan-100/40 dark:from-cyan-950/30 dark:to-cyan-900/20 border-cyan-300 dark:border-cyan-800 text-cyan-800 dark:text-cyan-300 border-l-4 border-l-cyan-500';
      case 'completed':
        return 'from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 border-l-4 border-l-slate-400';
      case 'cancelled':
        return 'from-rose-50/70 to-rose-100/40 dark:from-rose-950/30 dark:to-rose-900/20 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300 border-l-4 border-l-rose-500';
      default:
        return 'from-amber-50/70 to-amber-100/40 dark:from-amber-950/30 dark:to-amber-900/20 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 border-l-4 border-l-amber-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Đã xác nhận';
      case 'checked_in': return 'Đã check-in';
      case 'in_progress': return 'Đang sửa chữa';
      case 'completed': return 'Hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return 'Chờ xử lý';
    }
  };

  const getDayName = (date: Date) => {
    return date.toLocaleDateString('vi-VN', { weekday: 'long' });
  };

  const formatHeaderTitle = () => {
    if (viewMode === 'day') {
      return currentDate.toLocaleDateString('vi-VN', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    } else if (viewMode === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      return `Tuần: ${start.getDate()}/${start.getMonth() + 1} - ${end.getDate()}/${end.getMonth() + 1}/${end.getFullYear()}`;
    } else {
      return `Tháng ${currentDate.getMonth() + 1} năm ${currentDate.getFullYear()}`;
    }
  };

  return (
    <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-150 dark:border-slate-900 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-100/30 dark:border-cyan-900/20">
              <CalendarIcon className="h-5.5 w-5.5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-slate-900 dark:text-white tracking-wide">Lịch Hẹn Dịch Vụ</h2>
              <p className="text-xs text-slate-400 mt-0.5">Quản lý và điều phối các lịch hẹn dịch vụ xe trong ngày</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            {/* Button Hôm nay - Đưa sang bên trái của View Mode Switcher và làm nổi bật bằng gradient cyan-blue */}
            <button
              onClick={handleToday}
              className="px-4 py-2 text-xs font-black bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 dark:from-cyan-500 dark:to-blue-500 dark:hover:from-cyan-400 dark:hover:to-blue-400 text-white rounded-xl transition-all shadow-md shadow-cyan-500/10 hover:shadow-lg hover:shadow-cyan-500/20 active:scale-95 border border-cyan-500/10"
            >
              Hôm nay
            </button>

            {/* View Mode Switcher */}
            <div className="flex p-1 bg-slate-100 dark:bg-slate-900/80 rounded-xl border border-slate-200/50 dark:border-slate-800/80 shadow-inner">
              {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wider rounded-lg transition-all duration-300 ${
                    viewMode === mode
                      ? 'bg-white dark:bg-slate-950 text-cyan-600 dark:text-cyan-400 shadow-sm border border-slate-200/20 dark:border-slate-800/35'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-450 dark:hover:text-slate-200'
                  }`}
                >
                  {mode === 'day' ? 'Ngày' : mode === 'week' ? 'Tuần' : 'Tháng'}
                </button>
              ))}
            </div>

            <div className="flex items-center bg-slate-100/80 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-xl p-0.5 shadow-sm">
              <button
                onClick={handlePrev}
                className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-450 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-950 transition-all"
                title="Trước"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-450 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-950 transition-all"
                title="Sau"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Date Display */}
        <div className="text-center py-4 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/10 dark:to-transparent rounded-2xl border border-slate-100/30 dark:border-slate-900/30">
          <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatHeaderTitle()}
          </div>
          <div className="inline-flex items-center gap-1.5 mt-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>
              {viewMode === 'day' 
                ? `${dayAppointments.length} lịch hẹn dự kiến`
                : viewMode === 'week'
                ? `Lịch tuần có hoạt động`
                : `Tổng quan tháng`}
            </span>
          </div>
        </div>
      </div>

      {/* View Content */}
      <div className="p-6 overflow-auto">
        
        {/* ── 1. DAY VIEW ── */}
        {viewMode === 'day' && (
          <div className="max-h-[600px] divide-y divide-slate-100 dark:divide-slate-900/80">
            {timeSlots.map(slot => (
              <div
                key={slot}
                className="flex items-start py-3 first:pt-0 last:pb-0 group"
                style={{ minHeight: '85px' }}
              >
                <div className="w-20 py-2.5 text-xs text-slate-450 dark:text-slate-500 font-bold shrink-0">
                  {slot}
                </div>

                <div className="flex-1 px-4 py-1 space-y-3">
                  {appointmentsBySlot[slot]?.map(apt => (
                    <div
                      key={apt.id}
                      onClick={() => onAppointmentClick?.(apt)}
                      className={`bg-gradient-to-r p-4 rounded-2xl border cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${getStatusColor(apt.status)}`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-extrabold text-xs tracking-wider">
                              {apt.appointmentNumber}
                            </span>
                            <span className="px-2 py-0.5 text-[9px] font-bold rounded-lg bg-white/80 dark:bg-slate-950/60 border border-current opacity-85">
                              {getStatusLabel(apt.status)}
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800 dark:text-slate-300">
                            <User className="h-3.5 w-3.5 text-slate-400" />
                            <span className="truncate">{apt.customerName}</span>
                          </div>
                          
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                            <div className="flex items-center gap-1">
                              <Car className="h-3.5 w-3.5 text-slate-400" />
                              <span className="truncate">{apt.vehicleInfo}</span>
                            </div>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-900/5 dark:bg-slate-150/10 rounded text-slate-700 dark:text-slate-350 uppercase tracking-wider">
                              {apt.licensePlate}
                            </span>
                          </div>

                          <div className="text-[11px] font-medium text-slate-400 dark:text-slate-500 pt-1">
                            {apt.serviceType}
                          </div>
                        </div>

                        <div className="flex flex-col sm:items-end justify-between self-stretch shrink-0">
                          {apt.estimatedDuration && (
                            <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/60 dark:bg-slate-900/60 border border-slate-100/40 dark:border-slate-800/30 text-[10px] font-bold text-slate-500">
                              <Clock className="h-3 h-3 text-slate-400" />
                              <span>{apt.estimatedDuration}h</span>
                            </div>
                          )}

                          {apt.serviceAdvisorName && (
                            <div className="text-[10px] font-medium text-slate-450 dark:text-slate-500 mt-2 sm:mt-0">
                              Tư vấn: <span className="font-bold text-slate-600 dark:text-slate-450">{apt.serviceAdvisorName}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {appointmentsBySlot[slot]?.length === 0 && (
                    <div className="flex py-3.5 items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-900/40 rounded-2xl opacity-40 group-hover:opacity-75 transition-all duration-200">
                      <span className="text-[10px] font-bold text-slate-450 dark:text-slate-500 tracking-widest uppercase">Trống</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── 2. WEEK VIEW ── */}
        {viewMode === 'week' && (
          <div className="grid grid-cols-1 lg:grid-cols-7 gap-4 min-h-[400px]">
            {weekDays.map((day, idx) => {
              const dateStr = getLocalDateStr(day);
              const dayApts = appointmentsByDate[dateStr] || [];
              const isSelected = getLocalDateStr(currentDate) === dateStr;

              return (
                <div 
                  key={idx}
                  onClick={() => setCurrentDate(day)}
                  className={`flex flex-col rounded-2xl border p-4 transition-all duration-300 cursor-pointer ${
                    isSelected 
                      ? 'bg-slate-50/50 dark:bg-slate-900/30 border-cyan-500/50 dark:border-cyan-500/30 shadow-md ring-1 ring-cyan-500/20' 
                      : 'bg-white dark:bg-slate-950 border-slate-150 dark:border-slate-900 hover:border-slate-300 dark:hover:border-slate-800 hover:bg-slate-50/20 dark:hover:bg-slate-900/10'
                  }`}
                >
                  <div className="text-center pb-3 border-b border-slate-100 dark:border-slate-900 mb-3 shrink-0">
                    <p className={`text-[10px] font-extrabold uppercase tracking-wider ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-400 dark:text-slate-500'}`}>
                      {getDayName(day).replace('Thứ ', 'T')}
                    </p>
                    <p className={`text-base font-black mt-1 ${isSelected ? 'text-cyan-600 dark:text-cyan-400' : 'text-slate-900 dark:text-white'}`}>
                      {day.getDate()}
                    </p>
                  </div>

                  <div className="flex-1 space-y-2 overflow-y-auto max-h-[320px] [&::-webkit-scrollbar]:w-0.5">
                    {dayApts.length > 0 ? (
                      dayApts.map(apt => (
                        <div
                          key={apt.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onAppointmentClick?.(apt);
                          }}
                          className={`bg-gradient-to-r p-2.5 rounded-xl border text-[11px] cursor-pointer hover:scale-[1.02] transition-transform duration-200 ${getStatusColor(apt.status)}`}
                        >
                          <div className="flex items-center justify-between font-extrabold mb-1">
                            <span>{apt.scheduledTime.substring(0, 5)}</span>
                            <span className="text-[8px] opacity-75">{apt.licensePlate}</span>
                          </div>
                          <p className="font-bold truncate">{apt.customerName}</p>
                          <p className="opacity-75 truncate">{apt.serviceType}</p>
                        </div>
                      ))
                    ) : (
                      <div className="h-full flex items-center justify-center py-8">
                        <span className="text-[10px] font-bold text-slate-300 dark:text-slate-650 tracking-widest uppercase">Trống</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 3. MONTH VIEW ── */}
        {viewMode === 'month' && (
          <div className="border border-slate-150 dark:border-slate-900 rounded-2xl overflow-hidden">
            {/* Week headers */}
            <div className="grid grid-cols-7 bg-slate-50/50 dark:bg-slate-900/60 border-b border-slate-150 dark:border-slate-900 text-center py-2.5">
              {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map(h => (
                <span key={h} className="text-[11px] font-black text-slate-450 dark:text-slate-500 uppercase tracking-widest">{h}</span>
              ))}
            </div>

            {/* Days grid */}
            <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100 dark:divide-slate-900/80 bg-white dark:bg-slate-950">
              {monthGridDays.map((day, idx) => {
                const dateStr = getLocalDateStr(day);
                const dayApts = appointmentsByDate[dateStr] || [];
                const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                const isSelected = getLocalDateStr(currentDate) === dateStr;

                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setCurrentDate(day);
                      // Auto switch to day view for detail
                      setViewMode('day');
                    }}
                    className={`min-h-[90px] p-2 flex flex-col transition-all duration-300 cursor-pointer ${
                      isCurrentMonth 
                        ? 'text-slate-900 dark:text-white' 
                        : 'text-slate-300 dark:text-slate-700 bg-slate-50/20 dark:bg-slate-950/20'
                    } ${
                      isSelected 
                        ? 'bg-cyan-50/20 dark:bg-cyan-950/10 ring-1 ring-cyan-500/20' 
                        : 'hover:bg-slate-50/30 dark:hover:bg-slate-900/10'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-1.5 shrink-0">
                      <span className={`text-[11px] font-extrabold ${
                        isSelected 
                          ? 'w-5 h-5 flex items-center justify-center bg-cyan-600 dark:bg-cyan-500 text-white rounded-full' 
                          : 'text-inherit'
                      }`}>
                        {day.getDate()}
                      </span>
                      {dayApts.length > 0 && (
                        <span className="px-1.5 py-0.5 text-[8px] font-black bg-cyan-100 dark:bg-cyan-950 text-cyan-700 dark:text-cyan-300 rounded-full border border-cyan-200/50">
                          {dayApts.length} ca
                        </span>
                      )}
                    </div>

                    <div className="flex-1 space-y-1 overflow-hidden">
                      {dayApts.slice(0, 2).map(apt => (
                        <div 
                          key={apt.id}
                          className="px-1.5 py-0.5 text-[8.5px] font-bold rounded truncate bg-slate-100 dark:bg-slate-900 border border-slate-200/40 dark:border-slate-800/50 text-slate-600 dark:text-slate-400"
                        >
                          <span className="font-black text-slate-800 dark:text-slate-200 mr-1">{apt.scheduledTime.substring(0, 5)}</span>
                          {apt.customerName}
                        </div>
                      ))}
                      {dayApts.length > 2 && (
                        <div className="text-[8px] font-bold text-slate-400 dark:text-slate-500 pl-1">
                          + {dayApts.length - 2} lịch hẹn khác
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

      </div>

      {/* Summary footer (Mini Cards Grid) */}
      <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-900">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-emerald-50/50 to-emerald-100/20 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-100/80 dark:border-emerald-900/30 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {appointments.filter(a => a.status === 'confirmed').length}
            </div>
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-1">Đã xác nhận</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50/50 to-blue-100/20 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-100/80 dark:border-blue-900/30 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {appointments.filter(a => a.status === 'checked_in').length}
            </div>
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-1">Đã check-in</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-cyan-50/50 to-cyan-100/20 dark:from-cyan-950/20 dark:to-cyan-900/10 border border-cyan-100/80 dark:border-cyan-900/30 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-cyan-600 dark:text-cyan-400">
              {appointments.filter(a => a.status === 'in_progress').length}
            </div>
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-1">Đang sửa chữa</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-slate-100/50 to-slate-200/20 dark:from-slate-900/30 dark:to-slate-800/10 border border-slate-200/80 dark:border-slate-800/50 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-slate-700 dark:text-slate-300">
              {appointments.filter(a => a.status === 'completed').length}
            </div>
            <div className="text-[10px] font-bold text-slate-450 dark:text-slate-500 uppercase tracking-wider mt-1">Hoàn thành</div>
          </div>
        </div>
      </div>
    </div>
  );
}

