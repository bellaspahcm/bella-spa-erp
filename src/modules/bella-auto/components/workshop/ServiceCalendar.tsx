'use client';

/**
 * Service Calendar Component
 * Displays service appointments in calendar view with drag-and-drop scheduling
 */

import { useState, useMemo } from 'react';
import { Calendar, Clock, User, Car, AlertCircle } from 'lucide-react';

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
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
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
        return 'bg-green-100 text-green-800 border-green-300';
      case 'checked_in':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'in_progress':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'completed':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
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
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold">Lịch Hẹn Dịch Vụ</h2>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleToday}
              className="px-3 py-1.5 text-sm border rounded-md hover:bg-gray-50"
            >
              Hôm nay
            </button>
            <button
              onClick={handlePrevDay}
              className="p-1.5 border rounded-md hover:bg-gray-50"
            >
              ←
            </button>
            <button
              onClick={handleNextDay}
              className="p-1.5 border rounded-md hover:bg-gray-50"
            >
              →
            </button>
          </div>
        </div>

        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {formatDate(currentDate)}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {dayAppointments.length} lịch hẹn
          </div>
        </div>
      </div>

      {/* Time slots */}
      <div className="p-4 overflow-auto" style={{ maxHeight: '600px' }}>
        {timeSlots.map(slot => (
          <div
            key={slot}
            className="flex border-b hover:bg-gray-50"
            style={{ minHeight: '80px' }}
          >
            {/* Time label */}
            <div className="w-20 py-2 px-3 text-sm text-gray-500 font-medium border-r">
              {slot}
            </div>

            {/* Appointments for this slot */}
            <div className="flex-1 p-2 space-y-2">
              {appointmentsBySlot[slot]?.map(apt => (
                <div
                  key={apt.id}
                  onClick={() => onAppointmentClick?.(apt)}
                  className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all hover:shadow-md ${getStatusColor(apt.status)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">
                          {apt.appointmentNumber}
                        </span>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-white border">
                          {apt.status}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm mb-1">
                        <User className="h-3.5 w-3.5" />
                        <span className="font-medium">{apt.customerName}</span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm mb-1">
                        <Car className="h-3.5 w-3.5" />
                        <span>{apt.vehicleInfo}</span>
                        <span className="font-mono text-xs ml-1">
                          {apt.licensePlate}
                        </span>
                      </div>

                      <div className="text-xs text-gray-600 mt-1">
                        {apt.serviceType}
                      </div>
                    </div>

                    {apt.estimatedDuration && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{apt.estimatedDuration}h</span>
                      </div>
                    )}
                  </div>

                  {apt.serviceAdvisorName && (
                    <div className="text-xs text-gray-500 mt-2 pt-2 border-t">
                      Tư vấn: {apt.serviceAdvisorName}
                    </div>
                  )}
                </div>
              ))}

              {appointmentsBySlot[slot]?.length === 0 && (
                <div className="text-sm text-gray-400 italic py-2">
                  Chưa có lịch hẹn
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Summary footer */}
      <div className="p-4 bg-gray-50 border-t">
        <div className="grid grid-cols-4 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {dayAppointments.filter(a => a.status === 'confirmed').length}
            </div>
            <div className="text-xs text-gray-600">Đã xác nhận</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">
              {dayAppointments.filter(a => a.status === 'checked_in').length}
            </div>
            <div className="text-xs text-gray-600">Đã check-in</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-purple-600">
              {dayAppointments.filter(a => a.status === 'in_progress').length}
            </div>
            <div className="text-xs text-gray-600">Đang thực hiện</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-600">
              {dayAppointments.filter(a => a.status === 'completed').length}
            </div>
            <div className="text-xs text-gray-600">Hoàn thành</div>
          </div>
        </div>
      </div>
    </div>
  );
}
