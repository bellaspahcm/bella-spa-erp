'use client';

import { X, User, Phone, Car, Wrench, Clock, Calendar, CheckCircle2, Play, AlertTriangle, Edit3, Save } from 'lucide-react';
import { useState, useEffect } from 'react';

export interface ServiceAppointment {
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

interface AppointmentDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: ServiceAppointment | null;
  onCheckIn: (appointmentId: string) => Promise<void>;
  onCreateRepairOrder: (appointmentId: string) => Promise<void>;
  onCancel: (appointmentId: string) => Promise<void>;
  onUpdateAppointment: (appointmentId: string, updatedData: {
    scheduledDate: string;
    scheduledTime: string;
    description: string;
    estimatedDuration: number;
  }) => Promise<void>;
}

export function AppointmentDetailModal({
  isOpen,
  onClose,
  appointment,
  onCheckIn,
  onCreateRepairOrder,
  onCancel,
  onUpdateAppointment,
}: AppointmentDetailModalProps) {
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // Form states
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDuration, setEditDuration] = useState(2);

  // Initialize form states when appointment changes or editing is enabled
  useEffect(() => {
    if (appointment) {
      setEditDate(appointment.scheduledDate);
      setEditTime(appointment.scheduledTime.substring(0, 5)); // HH:MM
      setEditDescription(appointment.serviceType);
      setEditDuration(appointment.estimatedDuration || 2);
    }
  }, [appointment, isEditing]);

  if (!isOpen || !appointment) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã xác nhận
          </span>
        );
      case 'checked_in':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <User className="w-3.5 h-3.5" />
            Đã check-in
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-200 dark:border-cyan-800">
            <Wrench className="w-3.5 h-3.5" />
            Đang sửa chữa
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-350 border border-slate-200 dark:border-slate-800">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Hoàn thành
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-rose-100 dark:bg-rose-950 text-rose-800 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <AlertTriangle className="w-3.5 h-3.5" />
            Đã hủy
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3.5 h-3.5" />
            Chờ xử lý
          </span>
        );
    }
  };

  const handleAction = async (action: () => Promise<void>) => {
    try {
      setIsActionLoading(true);
      await action();
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSaveEdit = async () => {
    try {
      setIsActionLoading(true);
      await onUpdateAppointment(appointment.id, {
        scheduledDate: editDate,
        scheduledTime: editTime,
        description: editDescription,
        estimatedDuration: Number(editDuration),
      });
      setIsEditing(false);
    } finally {
      setIsActionLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        onClick={onClose}
        className="absolute inset-0 bg-slate-950/45 dark:bg-slate-950/60 backdrop-blur-xs transition-opacity"
      />

      {/* Modal Container */}
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-950 rounded-3xl border border-slate-150 dark:border-slate-900 shadow-2xl p-6 overflow-hidden transform transition-all animate-in fade-in zoom-in-95 duration-200">
        
        {/* Close Button */}
        <button 
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-900 transition-all"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Title */}
        <div className="mb-6">
          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-600 dark:text-cyan-400">Chi Tiết Lịch Hẹn</span>
          <div className="flex items-center gap-3 mt-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              {appointment.appointmentNumber}
            </h3>
            {getStatusBadge(appointment.status)}
          </div>
        </div>

        {/* Content sections */}
        <div className="space-y-5 mb-8">
          
          {/* Customer Group */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100/50 dark:border-slate-900/50">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5" />
              Thông tin khách hàng
            </h4>
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200">
                {appointment.customerName}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                <Phone className="w-3 h-3" />
                <span>Liên hệ: {appointment.customerName === 'Nguyễn Văn A' ? '0912345678' : appointment.customerName === 'Trần Thị B' ? '0987654321' : '0909090909'}</span>
              </div>
            </div>
          </div>

          {/* Vehicle Group */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100/50 dark:border-slate-900/50">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Car className="w-3.5 h-3.5" />
              Phương tiện dịch vụ
            </h4>
            <div className="space-y-1">
              <div className="text-sm font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                <span>{appointment.vehicleInfo}</span>
                <span className="font-mono text-[10px] font-bold px-2 py-0.5 bg-slate-900/10 dark:bg-slate-100/10 text-slate-700 dark:text-slate-300 rounded uppercase tracking-wider">
                  {appointment.licensePlate}
                </span>
              </div>
            </div>
          </div>

          {/* Service Group (View/Edit modes) */}
          <div className="p-4 bg-slate-50/50 dark:bg-slate-900/30 rounded-2xl border border-slate-100/50 dark:border-slate-900/50">
            <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Wrench className="w-3.5 h-3.5" />
              Yêu cầu dịch vụ
            </h4>
            
            {isEditing ? (
              <div className="space-y-4">
                {/* Edit Description */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 block mb-1">Mô tả / Yêu cầu</label>
                  <textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    className="w-full text-xs font-semibold p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500/80 transition-all min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {/* Edit Date */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 block mb-1">Ngày hẹn</label>
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500/80 transition-all"
                    />
                  </div>

                  {/* Edit Time */}
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 block mb-1">Giờ hẹn</label>
                    <input
                      type="time"
                      value={editTime}
                      onChange={(e) => setEditTime(e.target.value)}
                      className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500/80 transition-all"
                    />
                  </div>
                </div>

                {/* Edit Duration */}
                <div>
                  <label className="text-[10px] font-bold text-slate-400 dark:text-slate-550 block mb-1">Thời gian dự kiến (Giờ)</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0.5"
                    value={editDuration}
                    onChange={(e) => setEditDuration(Number(e.target.value))}
                    className="w-full text-xs font-semibold p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 text-slate-800 dark:text-slate-200 focus:outline-hidden focus:ring-1 focus:ring-cyan-500/80 transition-all"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {appointment.serviceType}
                </div>
                
                <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-slate-100 dark:border-slate-900/80">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Thời gian hẹn</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-350 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3.5 h-3.5 text-cyan-500" />
                      {appointment.scheduledTime} - {appointment.scheduledDate}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 block">Thời gian ước tính</span>
                    <span className="text-xs font-black text-slate-700 dark:text-slate-350 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-500" />
                      {appointment.estimatedDuration || 2} giờ
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

        </div>

        {/* Actions Buttons */}
        <div className="flex flex-col sm:flex-row gap-2.5">
          {isEditing ? (
            <>
              {/* Edit Mode Actions */}
              <button
                disabled={isActionLoading}
                onClick={handleSaveEdit}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                Lưu thay đổi
              </button>
              <button
                disabled={isActionLoading}
                onClick={() => setIsEditing(false)}
                className="px-4 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl transition-all active:scale-95 disabled:opacity-50 border border-slate-200/50 dark:border-slate-800/80"
              >
                Hủy
              </button>
            </>
          ) : (
            <>
              {/* View Mode Actions */}
              {/* Action: Check-in */}
              {appointment.status === 'confirmed' && (
                <button
                  disabled={isActionLoading}
                  onClick={() => handleAction(() => onCheckIn(appointment.id))}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Check-in
                </button>
              )}

              {/* Action: Create Repair Order */}
              {appointment.status === 'checked_in' && (
                <button
                  disabled={isActionLoading}
                  onClick={() => handleAction(() => onCreateRepairOrder(appointment.id))}
                  className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-black bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-2xl shadow-md transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play className="w-4 h-4" />
                  Tạo Lệnh RO
                </button>
              )}

              {/* Action: Toggle Edit (Reschedule) */}
              {(appointment.status === 'confirmed' || appointment.status === 'checked_in') && (
                <button
                  disabled={isActionLoading}
                  onClick={() => setIsEditing(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-355 rounded-2xl transition-all active:scale-95 disabled:opacity-50 border border-slate-200/50 dark:border-slate-800/80"
                >
                  <Edit3 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  Dời lịch / Sửa
                </button>
              )}

              {/* Action: Cancel */}
              {(appointment.status === 'confirmed' || appointment.status === 'checked_in') && (
                <button
                  disabled={isActionLoading}
                  onClick={() => handleAction(() => onCancel(appointment.id))}
                  className="px-4 py-2.5 text-xs font-black text-rose-600 dark:text-rose-400 rounded-2xl hover:bg-rose-50/50 dark:hover:bg-rose-950/20 transition-all active:scale-95 disabled:opacity-50"
                >
                  Hủy lịch
                </button>
              )}

              {/* Default Close button when already in progress or completed */}
              {(appointment.status === 'in_progress' || appointment.status === 'completed' || appointment.status === 'cancelled') && (
                <button
                  onClick={onClose}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2.5 text-xs font-black bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-2xl transition-all active:scale-95"
                >
                  Đóng
                </button>
              )}
            </>
          )}
        </div>

      </div>
    </div>
  );
}
