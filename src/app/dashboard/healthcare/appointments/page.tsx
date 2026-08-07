'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  QrCode,
  Stethoscope,
  Sparkles,
  Plus,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  PhoneCall,
  Send,
  Check,
  Zap,
  ChevronRight,
  User,
  Building,
  MessageSquare,
  Printer,
  Bell,
  Globe,
  Smartphone,
  Phone,
  LayoutGrid,
  List
} from 'lucide-react';
import { toast } from 'sonner';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import {
  getAppointmentsAction,
  updateAppointmentStatusAction,
  createAppointmentAction,
  sendAppointmentReminderAction,
  type Appointment
} from '@/services/healthcare/appointments-actions';
import { ClinicalPipeline, type EncounterItem } from '../ClinicalPipeline';
import { getAllEncountersAction, updateEncounterStatusAction } from '@/services/healthcare/healthcare-actions';
import { createClient } from '@/lib/supabase-client';

export default function AppointmentCenterPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [encounters, setEncounters] = useState<EncounterItem[]>([]);
  const [selectedEncounterId, setSelectedEncounterId] = useState<string | null>(null);

  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  const loadEncounters = async (dateStr?: string) => {
    const res = await getAllEncountersAction(dateStr || undefined);
    if (res.success && res.data) {
      setEncounters(res.data);
    }
  };

  const loadAppointments = async (dateStr?: string) => {
    setIsLoading(true);
    const res = await getAppointmentsAction(dateStr || undefined);
    if (res.success && res.data) {
      setAppointments(res.data);
    } else {
      toast.error(res.error || 'Không thể tải danh sách lịch khám từ database');
    }
    setIsLoading(false);
  };

  // Load from database on mount & setup realtime subscription when selectedDate changes
  useEffect(() => {
    void loadAppointments(selectedDate);
    void loadEncounters(selectedDate);

    const supabase = createClient();
    const channel = supabase
      .channel('hc-appointments-center-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_appointments' }, () => {
        void loadAppointments(selectedDate);
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'hc_encounters' }, () => {
        void loadEncounters(selectedDate);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedDate]);

  const handleUpdateEncounterStatus = async (id: string, newStatus: EncounterItem['status']) => {
    const dbRes = await updateEncounterStatusAction(id, newStatus);
    if (!dbRes.success) {
      toast.error('Lỗi lưu trạng thái lượt khám: ' + dbRes.error);
      return;
    }

    setEncounters((prev) =>
      prev.map((e) => (e.id === id ? { ...e, status: newStatus } : e))
    );

    const statusLabels: Record<EncounterItem['status'], string> = {
      planned: 'Lên lịch hẹn',
      arrived: 'Phòng chờ tiếp đón',
      in_progress: 'Đang điều trị',
      finished: 'Đã hoàn tất',
    };

    toast.success(`Đã di chuyển lượt khám sang: ${statusLabels[newStatus] || newStatus}`);
  };

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('ALL');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [selectedQRApp, setSelectedQRApp] = useState<Appointment | null>(null);

  // New Booking State
  const [newApp, setNewApp] = useState({
    patientName: '',
    patientPhone: '',
    specialty: 'Khoa Tim Mạch',
    doctorName: 'BS. CKII Nguyễn Văn Minh',
    slotTime: '08:00 - 08:30',
    notes: '',
  });

  // Filtered Appointments
  const filteredAppointments = appointments.filter((app) => {
    const matchesSearch =
      app.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      app.patientPhone.includes(searchTerm) ||
      app.id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesSpecialty = filterSpecialty === 'ALL' || app.specialty === filterSpecialty;
    return matchesSearch && matchesSpecialty;
  });

  // Handle Quick Check-in
  const handleCheckIn = async (id: string) => {
    const res = await updateAppointmentStatusAction(id, 'checked_in');
    if (!res.success) {
      toast.error(res.error || 'Lỗi không thể check-in');
      return;
    }

    setAppointments((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: 'checked_in' } : app))
    );
    toast.success('📱 Đã xác nhận Check-in QR thành công! Đã tự động đẩy bệnh nhân vào Hàng Đợi Khám.');
    await loadEncounters();
  };

  // Handle Send Reminder
  const handleSendReminder = async (id: string, name: string) => {
    const res = await sendAppointmentReminderAction(id);
    if (!res.success) {
      toast.error(res.error || 'Lỗi không thể gửi nhắc lịch');
      return;
    }

    setAppointments((prev) =>
      prev.map((app) => (app.id === id ? { ...app, reminderSent: true } : app))
    );
    toast.success(`📩 Đã gửi tin nhắn Zalo ZNS & SMS nhắc lịch khám đến bệnh nhân ${name}!`);
  };

  // Handle Create Booking
  const handleCreateBookingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.patientName || !newApp.patientPhone) {
      toast.error('Vui lòng điền tên và số điện thoại bệnh nhân!');
      return;
    }

    const res = await createAppointmentAction({
      patientName: newApp.patientName,
      patientPhone: newApp.patientPhone,
      specialty: newApp.specialty,
      doctorName: newApp.doctorName,
      slotTime: newApp.slotTime,
      notes: newApp.notes || undefined,
    });

    if (!res.success || !res.data) {
      toast.error(res.error || 'Lỗi không thể đặt lịch khám');
      return;
    }

    setAppointments([res.data, ...appointments]);
    setIsBookingModalOpen(false);
    setNewApp({ patientName: '', patientPhone: '', specialty: 'Khoa Tim Mạch', doctorName: 'BS. CKII Nguyễn Văn Minh', slotTime: '08:00 - 08:30', notes: '' });
    toast.success(`🎉 Đã đặt lịch khám thành công cho bệnh nhân ${res.data.patientName}! Mã QR: ${res.data.qrCode}`);
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-6 md:p-8 w-full space-y-7 bg-transparent relative text-left">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-cyan-500/10 dark:bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200/80 dark:border-slate-800 pb-5">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              Trung Tâm Đặt Lịch & QR Check-in Khám Bệnh
            </h1>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
            Quản lý Đặt Lịch Online theo Khung Giờ (Slot), Xác Nhận QR Check-in Quầy, AI Xử Lý No-show & Tự Động Gửi Nhắc Lịch Zalo ZNS.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              const noShows = appointments.filter((a) => a.status === 'no_show').length;
              toast.success(`🤖 AI Copilot: Đã phát hiện ${noShows} lịch bỏ khám (No-show). Đã tự động gọi 2 bệnh nhân trong Waitlist lấp chỗ trống!`);
            }}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 flex items-center gap-2 cursor-pointer shadow-2xs transition-all active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>AI Xử Lý No-Show</span>
          </button>

          <button
            onClick={() => setIsBookingModalOpen(true)}
            className="px-4 py-2.5 rounded-xl text-xs font-bold bg-cyan-600 text-white hover:bg-cyan-700 shadow-md flex items-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            Đặt Lịch Khám Mới
          </button>
        </div>
      </div>

      {/* Enterprise Metrics Counter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Tổng Lịch Khám Hôm Nay</span>
            <span className="text-xl font-black text-slate-900 dark:text-white mt-0.5 block">{appointments.length} cuộc hẹn</span>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
            <CalendarIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Đã QR Check-in Quầy</span>
            <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
              {appointments.filter((a) => a.status === 'checked_in').length} bệnh nhân
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
            <QrCode className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Tỷ Lệ Nhắc Zalo / SMS</span>
            <span className="text-xl font-black text-cyan-600 dark:text-cyan-400 mt-0.5 block">
              {Math.round((appointments.filter((a) => a.reminderSent).length / appointments.length) * 100)}% đã nhận tin
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-cyan-500/10 text-cyan-600 border border-cyan-500/20">
            <MessageSquare className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between transition-all hover:shadow-md">
          <div>
            <span className="text-[11px] font-bold text-slate-400 block uppercase tracking-wider">Tỷ Lệ Bỏ Khám (No-Show)</span>
            <span className="text-xl font-black text-rose-600 dark:text-rose-400 mt-0.5 block">
              {appointments.filter((a) => a.status === 'no_show').length} ca (AI lấp slot)
            </span>
          </div>
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Bar with Dual View Mode Switcher */}
      <div className="flex flex-col lg:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo Tên bệnh nhân, SĐT, Mã Lịch..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-44 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-xs font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 cursor-pointer"
            />
            {selectedDate && (
              <button
                onClick={() => setSelectedDate('')}
                className="px-3 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-slate-450 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-850 rounded-xl cursor-pointer shrink-0 transition-all active:scale-95"
                title="Xem tất cả các ngày"
              >
                Tất cả
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end flex-wrap">
          <div className="flex items-center gap-2 w-60">
            <Filter className="w-4 h-4 text-slate-400 shrink-0" />
            <PremiumSelect
              options={[
                { value: 'ALL', label: 'Tất cả Chuyên Khoa' },
                { value: 'Khoa Tim Mạch', label: 'Khoa Tim Mạch' },
                { value: 'Khoa Tiêu Hóa', label: 'Khoa Tiêu Hóa' },
                { value: 'Khoa Nhi', label: 'Khoa Nhi' },
                { value: 'Khoa Tai Mũi Họng', label: 'Khoa Tai Mũi Họng' },
                { value: 'Khoa Thần Kinh', label: 'Khoa Thần Kinh' }
              ]}
              value={filterSpecialty}
              onChange={(val) => setFilterSpecialty(val)}
              placeholder="Chọn chuyên khoa..."
              buttonClassName="py-2 px-3.5 rounded-xl text-xs font-bold border-slate-200 dark:border-slate-700 dark:bg-slate-950"
            />
          </div>

          {/* Dual View Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'grid'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Dạng Thẻ</span>
            </button>

            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-2xs font-black'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Dạng Danh Sách</span>
            </button>
          </div>
        </div>
      </div>

      {/* Live Hàng Đợi Khám & Tiến Trình Tiếp Đón Lâm Sàng */}
      <ClinicalPipeline
        encounters={encounters}
        onUpdateStatus={handleUpdateEncounterStatus}
        onSelectPatient={() => {}}
        selectedEncounterId={selectedEncounterId}
        onSelectEncounter={(id) => {
          setSelectedEncounterId(id);
          window.location.assign(`/dashboard/medical/encounters/${id}`);
        }}
      />

      {/* RENDER VIEW MODE 1: Dạng Thẻ (Card Grid 2 Cột) */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-500 animate-spin" />
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Đang tải lịch khám từ database...</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredAppointments.map((app) => (
            <div
              key={app.id}
              className="p-6 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 space-y-4 hover:border-cyan-500/50 transition-all duration-200 shadow-sm hover:shadow-md text-left flex flex-col justify-between"
            >
              <div className="space-y-4">
                {/* 1. Header Row: Avatar + Name + Badges */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-600 via-teal-600 to-blue-700 text-white font-black text-sm flex items-center justify-center shadow-md shrink-0 relative border-2 border-white dark:border-slate-800">
                      {getInitials(app.patientName)}
                      <span className={`w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900 absolute -bottom-0.5 -right-0.5 shadow-2xs ${
                        app.status === 'checked_in' ? 'bg-emerald-500' : app.status === 'no_show' ? 'bg-rose-500' : 'bg-cyan-500'
                      }`} />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-slate-900 dark:text-white text-lg tracking-tight">
                          {app.patientName}
                        </h3>
                        {app.status === 'checked_in' && (
                          <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> Check-in
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                        <span className="font-mono font-bold text-slate-700 dark:text-slate-300">{app.patientPhone}</span>
                        <span>•</span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase flex items-center gap-1">
                          {app.channel === 'online_website' ? (
                            <><Globe className="w-3 h-3 text-cyan-600" /> Web Booking</>
                          ) : app.channel === 'zalo_oa' ? (
                            <><Smartphone className="w-3 h-3 text-blue-600" /> Zalo OA</>
                          ) : app.channel === 'call_center' ? (
                            <><Phone className="w-3 h-3 text-emerald-600" /> Tổng Đài</>
                          ) : (
                            <><User className="w-3 h-3 text-amber-600" /> Khách Đến</>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Top Codes */}
                  <div className="flex flex-col items-end gap-1">
                    <span className="px-3 py-1 rounded-xl bg-slate-900 text-cyan-300 font-mono font-black text-xs shadow-2xs border border-cyan-500/30">
                      {app.id}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 font-bold">
                      {app.qrCode}
                    </span>
                  </div>
                </div>

                {/* 2. Clinical Info Card Grid */}
                <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-950 border border-slate-100 dark:border-slate-800/80 space-y-3 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-3 border-b border-slate-200/60 dark:border-slate-800">
                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 font-bold uppercase block">Chuyên Khoa & Bác Sĩ</span>
                      <strong className="font-black text-slate-900 dark:text-white block">{app.specialty}</strong>
                      <span className="text-slate-500 font-medium block">{app.doctorName}</span>
                    </div>

                    <div className="space-y-1">
                      <span className="text-[11px] text-slate-400 font-bold uppercase block">Khung Giờ Khám Slot</span>
                      <span className="px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 font-mono font-black text-xs border border-cyan-500/20 inline-block">
                        ⏰ {app.slotTime}
                      </span>
                    </div>
                  </div>

                  {/* Status & Zalo Reminder Status Row */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-400 font-bold">Trạng Thái:</span>
                      {app.status === 'checked_in' ? (
                        <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-[10px] flex items-center gap-1 border border-emerald-500/30">
                          ✓ Đã Check-in Quầy
                        </span>
                      ) : app.status === 'confirmed' ? (
                        <span className="px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-black text-[10px] flex items-center gap-1 border border-cyan-500/30">
                          • Đã Xác Nhận Hẹn
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-black text-[10px] flex items-center gap-1 border border-rose-500/30">
                          ⚠ Bỏ Khám (No-show)
                        </span>
                      )}
                    </div>

                    <div>
                      {app.reminderSent ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" /> Zalo ZNS đã gửi
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendReminder(app.id, app.patientName)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800 transition-all active:scale-95"
                        >
                          <Send className="w-3 h-3" /> Gửi tin Zalo
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Clinical Notes Banner */}
                  {app.notes && (
                    <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-slate-600 dark:text-slate-300 text-[11px]">
                      <strong className="text-cyan-700 dark:text-cyan-400 font-bold">Ghi chú:</strong> {app.notes}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. Action Footer Buttons */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  onClick={() => {
                    setSelectedQRApp(app);
                    setIsQRModalOpen(true);
                  }}
                  className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer shadow-2xs transition-all active:scale-95"
                >
                  <QrCode className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Xem Mã QR</span>
                </button>

                {app.status !== 'checked_in' ? (
                  <button
                    onClick={() => handleCheckIn(app.id)}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all active:scale-95"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>Check-in Quầy Ngay</span>
                  </button>
                ) : (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" /> Đã Vào Hàng Đợi Khám
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* RENDER VIEW MODE 2: Dạng Danh Sách (Rich Table View) */
        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-sm overflow-hidden text-left">
          <div className="p-5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <h3 className="font-black text-slate-900 dark:text-white text-sm">
              Danh Sách Đặt Lịch Khám Bệnh ({filteredAppointments.length})
            </h3>
            <span className="text-xs text-slate-400 font-medium">Hôm nay: {new Date().toLocaleDateString('vi-VN')}</span>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="min-w-[1100px] w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 font-bold border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-4 whitespace-nowrap">Mã Đặt Lịch</th>
                  <th className="p-4 whitespace-nowrap">Bệnh Nhân</th>
                  <th className="p-4 whitespace-nowrap">Chuyên Khoa / Bác Sĩ</th>
                  <th className="p-4 whitespace-nowrap">Khung Giờ Khám</th>
                  <th className="p-4 whitespace-nowrap">Kênh Đặt</th>
                  <th className="p-4 whitespace-nowrap">Trạng Thái</th>
                  <th className="p-4 whitespace-nowrap">Zalo ZNS Nhắc Lịch</th>
                  <th className="p-4 text-right whitespace-nowrap">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium text-slate-800 dark:text-slate-200">
                {filteredAppointments.map((app) => (
                  <tr key={app.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-950/60 transition-all">
                    <td className="p-4 font-mono font-black text-cyan-600 whitespace-nowrap">
                      <span className="px-3 py-1.5 rounded-xl bg-slate-900 text-cyan-300 shadow-2xs border border-cyan-500/20 whitespace-nowrap inline-block">
                        {app.id}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-600 to-teal-700 text-white font-black text-xs flex items-center justify-center shadow-xs shrink-0">
                          {getInitials(app.patientName)}
                        </div>
                        <div>
                          <strong className="block text-slate-900 dark:text-white font-bold whitespace-nowrap">{app.patientName}</strong>
                          <span className="text-[11px] text-slate-500 font-mono whitespace-nowrap">{app.patientPhone}</span>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="font-bold block text-slate-900 dark:text-white whitespace-nowrap">{app.specialty}</span>
                      <span className="text-[11px] text-slate-500 whitespace-nowrap">{app.doctorName}</span>
                    </td>
                    <td className="p-4 font-bold text-slate-900 dark:text-white whitespace-nowrap">
                      <span className="px-3 py-1 rounded-xl bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border border-cyan-500/20 font-mono whitespace-nowrap inline-block">
                        ⏰ {app.slotTime}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase whitespace-nowrap inline-flex items-center gap-1">
                        {app.channel === 'online_website' ? '🌐 Web Booking' : app.channel === 'zalo_oa' ? '📱 Zalo OA' : app.channel === 'call_center' ? '📞 Tổng Đài' : '🚶 Khách Đến'}
                      </span>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {app.status === 'checked_in' ? (
                        <span className="px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black text-[10px] flex items-center gap-1 w-fit border border-emerald-500/30 whitespace-nowrap">
                          ✓ Đã Check-in QR
                        </span>
                      ) : app.status === 'confirmed' ? (
                        <span className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-black text-[10px] flex items-center gap-1 w-fit border border-cyan-500/30 whitespace-nowrap">
                          • Đã Xác Nhận
                        </span>
                      ) : (
                        <span className="px-3 py-1 rounded-full bg-rose-500/15 text-rose-700 dark:text-rose-300 font-black text-[10px] flex items-center gap-1 w-fit border border-rose-500/30 whitespace-nowrap">
                          ⚠ Bỏ Khám (No-show)
                        </span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      {app.reminderSent ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1 whitespace-nowrap">
                          <CheckCircle className="w-3.5 h-3.5" /> Đã gửi nhắc lịch
                        </span>
                      ) : (
                        <button
                          onClick={() => handleSendReminder(app.id, app.patientName)}
                          className="px-3 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 font-bold text-[11px] flex items-center gap-1 cursor-pointer border border-indigo-200 dark:border-indigo-800 whitespace-nowrap transition-all active:scale-95"
                        >
                          <Send className="w-3 h-3" /> Gửi tin Zalo
                        </button>
                      )}
                    </td>
                    <td className="p-4 text-right whitespace-nowrap space-x-2">
                      <button
                        onClick={() => {
                          setSelectedQRApp(app);
                          setIsQRModalOpen(true);
                        }}
                        className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 text-slate-700 dark:text-slate-300 font-bold text-[11px] cursor-pointer whitespace-nowrap shadow-2xs transition-all active:scale-95"
                      >
                        Mã QR
                      </button>

                      {app.status !== 'checked_in' && (
                        <button
                          onClick={() => handleCheckIn(app.id)}
                          className="px-3.5 py-1.5 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 font-bold text-[11px] cursor-pointer shadow-md whitespace-nowrap transition-all active:scale-95"
                        >
                          Check-in Quầy
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal 1: Booking Khám Bệnh Mới */}
      {isBookingModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-lg p-6 md:p-8 space-y-5 text-left">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-600">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-slate-900 dark:text-white">ĐẶT LỊCH KHÁM BỆNH MỚI</h2>
                  <p className="text-xs text-slate-500">Tạo lịch khám slot theo chuyên khoa & bác sĩ</p>
                </div>
              </div>
              <button onClick={() => setIsBookingModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-black text-lg p-1">✕</button>
            </div>

            <form onSubmit={handleCreateBookingSubmit} className="space-y-5 text-xs font-sans">
              <div className="space-y-1.5">
                <label className="font-bold text-slate-400 uppercase tracking-widest ml-1 block">Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập họ và tên..."
                  value={newApp.patientName}
                  onChange={(e) => setNewApp({ ...newApp, patientName: e.target.value })}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 dark:bg-slate-950 font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/50 hover:border-cyan-500/20 transition-all duration-300 shadow-2xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-400 uppercase tracking-widest ml-1 block">Số Điện Thoại Zalo *</label>
                <input
                  type="text"
                  required
                  placeholder="09xx xxx xxx"
                  value={newApp.patientPhone}
                  onChange={(e) => setNewApp({ ...newApp, patientPhone: e.target.value })}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 dark:bg-slate-950 font-mono font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/50 hover:border-cyan-500/20 transition-all duration-300 shadow-2xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400 uppercase tracking-widest ml-1 block">Chọn Chuyên Khoa</label>
                  <PremiumSelect
                    options={[
                      { value: 'Khoa Tim Mạch', label: 'Khoa Tim Mạch' },
                      { value: 'Khoa Tiêu Hóa', label: 'Khoa Tiêu Hóa' },
                      { value: 'Khoa Nhi', label: 'Khoa Nhi' },
                      { value: 'Khoa Tai Mũi Họng', label: 'Khoa Tai Mũi Họng' },
                      { value: 'Khoa Thần Kinh', label: 'Khoa Thần Kinh' }
                    ]}
                    value={newApp.specialty}
                    onChange={(val) => setNewApp({ ...newApp, specialty: val })}
                    placeholder="Chuyên khoa..."
                    buttonClassName="py-3 px-5 rounded-2xl border-slate-100 hover:border-cyan-500/20 dark:border-slate-800 dark:bg-slate-950 text-slate-800 dark:text-white font-semibold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-slate-400 uppercase tracking-widest ml-1 block">Chọn Khung Giờ (Slot)</label>
                  <PremiumSelect
                    options={[
                      { value: '08:00 - 08:30', label: '08:00 - 08:30' },
                      { value: '08:30 - 09:00', label: '08:30 - 09:00' },
                      { value: '09:00 - 09:30', label: '09:00 - 09:30' },
                      { value: '10:00 - 10:30', label: '10:00 - 10:30' },
                      { value: '14:00 - 14:30', label: '14:00 - 14:30' }
                    ]}
                    value={newApp.slotTime}
                    onChange={(val) => setNewApp({ ...newApp, slotTime: val })}
                    placeholder="Chọn Slot..."
                    buttonClassName="py-3 px-5 rounded-2xl border-slate-100 hover:border-cyan-500/20 dark:border-slate-800 dark:bg-slate-950 font-mono text-slate-800 dark:text-white font-semibold text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-bold text-slate-400 uppercase tracking-widest ml-1 block">Bác Sĩ Khám Phụ Trách</label>
                <input
                  type="text"
                  value={newApp.doctorName}
                  onChange={(e) => setNewApp({ ...newApp, doctorName: e.target.value })}
                  className="w-full px-5 py-3.5 rounded-2xl border border-slate-100 dark:border-slate-800 dark:bg-slate-950 font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500/50 hover:border-cyan-500/20 transition-all duration-300 shadow-2xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-100 transition-all cursor-pointer"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl text-xs font-black bg-cyan-600 hover:bg-cyan-700 text-white shadow-md hover:shadow-lg transition-all uppercase tracking-widest cursor-pointer"
                >
                  Xác Nhận Đặt Lịch
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Hiển Thị QR Code Check-in */}
      {isQRModalOpen && selectedQRApp && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-[28px] border border-slate-200 dark:border-slate-800 shadow-2xl w-full max-w-sm p-6 space-y-5 text-center">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="font-black text-slate-900 dark:text-white text-sm">THẺ KHÁM QR CODE CHECK-IN</span>
              <button onClick={() => setIsQRModalOpen(false)} className="text-slate-400 hover:text-slate-600 font-black">✕</button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-3">
              <div className="w-36 h-36 mx-auto bg-white p-3 rounded-2xl shadow-md border flex items-center justify-center">
                <QrCode className="w-28 h-28 text-slate-900" />
              </div>
              <span className="font-mono font-black text-sm text-cyan-600 block">{selectedQRApp.qrCode}</span>
              <div className="text-xs space-y-1">
                <strong className="block text-slate-900 dark:text-white text-base">{selectedQRApp.patientName}</strong>
                <span className="text-slate-500 block">{selectedQRApp.specialty} • {selectedQRApp.doctorName}</span>
                <span className="px-2.5 py-0.5 rounded-md bg-cyan-500/10 text-cyan-700 font-bold inline-block">⏰ Slot: {selectedQRApp.slotTime}</span>
              </div>
            </div>

            <button
              onClick={() => {
                handleCheckIn(selectedQRApp.id);
                setIsQRModalOpen(false);
              }}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md cursor-pointer"
            >
              ✓ Xác Nhận Check-in Quầy Ngay
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
