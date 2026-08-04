'use client';

/**
 * Service Calendar Component
 * Displays service appointments in calendar view with drag-and-drop scheduling
 */

import { useState, useMemo } from 'react';
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

export function ServiceCalendar({
  appointments,
  onAppointmentClick,
  onReschedule,
  selectedDate = new Date(),
  onDateChange,
}: ServiceCalendarProps) {
  const [currentDate, setCurrentDate] = useState(selectedDate);

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

  // Filter appointments for selected date
  const dayAppointments = useMemo(() => {
    const dateStr = currentDate.toISOString().split('T')[0];
    return appointments.filter(apt => apt.scheduledDate === dateStr);
  }, [appointments, currentDate]);

  // Group appointments by time slot
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

  const handlePrevDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() - 1);
    setCurrentDate(newDate);
    onDateChange?.(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(currentDate);
    newDate.setDate(newDate.getDate() + 1);
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
        return 'from-emerald-50/60 to-emerald-100/30 dark:from-emerald-950/20 dark:to-emerald-900/10 border-emerald-200/60 dark:border-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-l-emerald-500 dark:border-l-emerald-500';
      case 'checked_in':
        return 'from-blue-50/60 to-blue-100/30 dark:from-blue-950/20 dark:to-blue-900/10 border-blue-200/60 dark:border-blue-900/30 text-blue-700 dark:text-blue-400 border-l-blue-500 dark:border-l-blue-500';
      case 'in_progress':
        return 'from-purple-50/60 to-purple-100/30 dark:from-purple-950/20 dark:to-purple-900/10 border-purple-200/60 dark:border-purple-900/30 text-purple-700 dark:text-purple-400 border-l-purple-500 dark:border-l-purple-500';
      case 'completed':
        return 'from-slate-50/60 to-slate-100/30 dark:from-slate-900/20 dark:to-slate-850/10 border-slate-200/60 dark:border-slate-800/30 text-slate-600 dark:text-slate-400 border-l-slate-400 dark:border-l-slate-600';
      case 'cancelled':
        return 'from-rose-50/60 to-rose-100/30 dark:from-rose-950/20 dark:to-rose-900/10 border-rose-200/60 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 border-l-rose-500 dark:border-l-rose-500';
      default:
        return 'from-amber-50/60 to-amber-100/30 dark:from-amber-950/20 dark:to-amber-900/10 border-amber-200/60 dark:border-amber-900/30 text-amber-700 dark:text-amber-400 border-l-amber-500 dark:border-l-amber-500';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'confirmed': return 'Đã xác nhận';
      case 'checked_in': return 'Đã check-in';
      case 'in_progress': return 'Đang thực hiện';
      case 'completed': return 'Đã hoàn thành';
      case 'cancelled': return 'Đã hủy';
      default: return 'Chờ xử lý';
    }
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('vi-VN', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  return (
    <div className="bg-white dark:bg-slate-950 rounded-3xl border border-slate-150 dark:border-slate-900 shadow-[0_4px_24px_rgba(0,0,0,0.015)] dark:shadow-[0_4px_24px_rgba(0,0,0,0.2)] overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-900 bg-slate-50/30 dark:bg-slate-950">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 text-cyan-600 dark:text-cyan-400 shadow-sm border border-cyan-100/30 dark:border-cyan-900/20">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white tracking-wide">Lịch Hẹn Dịch Vụ</h2>
              <p className="text-xs text-slate-400 mt-0.5">Quản lý và điều phối các lịch hẹn dịch vụ xe trong ngày</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1.5 self-end sm:self-auto">
            <button
              onClick={handleToday}
              className="px-3.5 py-1.5 text-xs font-bold bg-slate-100/80 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/50 dark:border-slate-800/80 rounded-xl transition-all shadow-sm"
            >
              Hôm nay
            </button>
            <div className="flex items-center bg-slate-100/80 dark:bg-slate-900 border border-slate-200/50 dark:border-slate-800/80 rounded-xl p-0.5 shadow-sm">
              <button
                onClick={handlePrevDay}
                className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-450 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-950 transition-all"
                title="Ngày trước"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={handleNextDay}
                className="p-1.5 text-slate-600 hover:text-slate-900 dark:text-slate-450 dark:hover:text-slate-200 rounded-lg hover:bg-white dark:hover:bg-slate-950 transition-all"
                title="Ngày sau"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        <div className="text-center py-4 bg-gradient-to-b from-slate-50/50 to-transparent dark:from-slate-900/10 dark:to-transparent rounded-2xl border border-slate-100/30 dark:border-slate-900/30">
          <div className="text-xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            {formatDate(currentDate)}
          </div>
          <div className="inline-flex items-center gap-1 mt-1 text-xs font-semibold text-slate-400 uppercase tracking-widest">
            <Sparkles className="w-3 h-3 text-cyan-500" />
            <span>{dayAppointments.length} lịch hẹn dự kiến</span>
          </div>
        </div>
      </div>

      {/* Time slots */}
      <div className="p-6 overflow-auto max-h-[600px] divide-y divide-slate-100 dark:divide-slate-900/80">
        {timeSlots.map(slot => (
          <div
            key={slot}
            className="flex items-start py-3 first:pt-0 last:pb-0 group transition-colors duration-250"
            style={{ minHeight: '85px' }}
          >
            {/* Time label */}
            <div className="w-20 py-2.5 text-xs text-slate-400 dark:text-slate-500 font-bold shrink-0">
              {slot}
            </div>

            {/* Appointments for this slot */}
            <div className="flex-1 px-4 py-1 space-y-3">
              {appointmentsBySlot[slot]?.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => onAppointmentClick?.(apt)}
                  className={`bg-gradient-to-r p-4 rounded-2xl border border-l-4 cursor-pointer shadow-[0_2px_8px_rgba(0,0,0,0.01)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ${getStatusColor(apt.status)}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-extrabold text-xs tracking-wider">
                          {apt.appointmentNumber}
                        </span>
                        <span className="px-2 py-0.5 text-[10px] font-bold rounded-lg bg-white/80 dark:bg-slate-950/60 border border-current opacity-85">
                          {getStatusLabel(apt.status)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-350">
                        <User className="h-3.5 w-3.5 text-slate-400" />
                        <span className="truncate">{apt.customerName}</span>
                      </div>
                      
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-450">
                        <div className="flex items-center gap-1">
                          <Car className="h-3.5 w-3.5 text-slate-400" />
                          <span className="truncate">{apt.vehicleInfo}</span>
                        </div>
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 bg-slate-900/5 dark:bg-slate-100/10 rounded text-slate-700 dark:text-slate-300 uppercase tracking-wider">
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
                          Tư vấn: <span className="font-bold text-slate-600 dark:text-slate-400">{apt.serviceAdvisorName}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {appointmentsBySlot[slot]?.length === 0 && (
                <div className="flex py-3.5 items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-900/50 rounded-2xl opacity-40 group-hover:opacity-75 transition-all duration-200">
                  <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">Trống</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer (Mini Cards Grid) */}
      <div className="p-6 bg-slate-50/50 dark:bg-slate-900/20 border-t border-slate-100 dark:border-slate-900">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 bg-gradient-to-br from-emerald-50/50 to-emerald-100/20 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-100/80 dark:border-emerald-900/30 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {dayAppointments.filter(a => a.status === 'confirmed').length}
            </div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Đã xác nhận</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-blue-50/50 to-blue-100/20 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-100/80 dark:border-blue-900/30 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-blue-600 dark:text-blue-400">
              {dayAppointments.filter(a => a.status === 'checked_in').length}
            </div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Đã check-in</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-purple-50/50 to-purple-100/20 dark:from-purple-950/20 dark:to-purple-900/10 border border-purple-100/80 dark:border-purple-900/30 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
              {dayAppointments.filter(a => a.status === 'in_progress').length}
            </div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Đang thực hiện</div>
          </div>
          <div className="p-4 bg-gradient-to-br from-slate-100/50 to-slate-200/20 dark:from-slate-900/30 dark:to-slate-800/10 border border-slate-200/80 dark:border-slate-800/50 rounded-2xl text-center shadow-[0_2px_8px_rgba(0,0,0,0.005)]">
            <div className="text-2xl font-extrabold text-slate-750 dark:text-slate-300">
              {dayAppointments.filter(a => a.status === 'completed').length}
            </div>
            <div className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mt-1">Hoàn thành</div>
          </div>
        </div>
      </div>
    </div>
  );
}
