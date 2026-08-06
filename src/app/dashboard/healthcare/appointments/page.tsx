'use client';

import React, { useState } from 'react';
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
  Phone
} from 'lucide-react';
import { toast } from 'sonner';

interface Appointment {
  id: string;
  patientName: string;
  patientPhone: string;
  specialty: string;
  doctorName: string;
  date: string;
  slotTime: string;
  status: 'confirmed' | 'checked_in' | 'no_show' | 'cancelled' | 'completed';
  channel: 'online_website' | 'zalo_oa' | 'call_center' | 'walk_in';
  qrCode: string;
  reminderSent: boolean;
  notes?: string;
}

export default function AppointmentCenterPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: 'APP-8801',
      patientName: 'Trần Minh Hoàng',
      patientPhone: '0908 123 456',
      specialty: 'Khoa Tim Mạch',
      doctorName: 'BS. CKII Nguyễn Văn Minh',
      date: '2026-08-07',
      slotTime: '08:30 - 09:00',
      status: 'confirmed',
      channel: 'online_website',
      qrCode: 'QR-APP-8801',
      reminderSent: true,
      notes: 'Bệnh nhân tái khám huyết áp định kỳ. Cần đo điện tâm đồ ECG trước khi vào gặp bác sĩ.',
    },
    {
      id: 'APP-8802',
      patientName: 'Lê Thị Mai',
      patientPhone: '0912 345 678',
      specialty: 'Khoa Tiêu Hóa',
      doctorName: 'BS. CKI Trần Đức Hùng',
      date: '2026-08-07',
      slotTime: '09:00 - 09:30',
      status: 'checked_in',
      channel: 'zalo_oa',
      qrCode: 'QR-APP-8802',
      reminderSent: true,
      notes: 'Đau tức thượng vị sau ăn 2 tuần. Đã nhịn ăn sáng sẵn sàng siêu âm ổ bụng.',
    },
    {
      id: 'APP-8803',
      patientName: 'Nguyễn Văn Hùng',
      patientPhone: '0988 999 888',
      specialty: 'Khoa Nhi',
      doctorName: 'ThS. BS Lê Thị Mai',
      date: '2026-08-07',
      slotTime: '10:00 - 10:30',
      status: 'no_show',
      channel: 'call_center',
      qrCode: 'QR-APP-8803',
      reminderSent: true,
      notes: 'Khám ho sốt ban đêm. Quá hạn 20 phút không phản hồi Zalo.',
    },
    {
      id: 'APP-8804',
      patientName: 'Phạm Thị Hoa',
      patientPhone: '0933 111 222',
      specialty: 'Khoa Tai Mũi Họng',
      doctorName: 'BS. Vũ Thị Dung',
      date: '2026-08-07',
      slotTime: '14:00 - 14:30',
      status: 'confirmed',
      channel: 'online_website',
      qrCode: 'QR-APP-8804',
      reminderSent: false,
      notes: 'Viêm họng hạt tái phát kèm sưng hạch góc hàm.',
    },
    {
      id: 'APP-8805',
      patientName: 'Hoàng Đức Nam',
      patientPhone: '0977 444 555',
      specialty: 'Khoa Thần Kinh',
      doctorName: 'BS. CKII Nguyễn Văn Minh',
      date: '2026-08-07',
      slotTime: '15:30 - 16:00',
      status: 'confirmed',
      channel: 'walk_in',
      qrCode: 'QR-APP-8805',
      reminderSent: true,
      notes: 'Chóng mặt tư thế kịch phát lành tính. Đặt khám trực tiếp tại quầy.',
    },
  ]);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterSpecialty, setFilterSpecialty] = useState('ALL');
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
  const handleCheckIn = (id: string) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === id ? { ...app, status: 'checked_in' } : app))
    );
    toast.success('📱 Đã xác nhận Check-in QR thành công! Đã tự động đẩy bệnh nhân vào Hàng Đợi Khám.');
  };

  // Handle Send Reminder
  const handleSendReminder = (id: string, name: string) => {
    setAppointments((prev) =>
      prev.map((app) => (app.id === id ? { ...app, reminderSent: true } : app))
    );
    toast.success(`📩 Đã gửi tin nhắn Zalo ZNS & SMS nhắc lịch khám đến bệnh nhân ${name}!`);
  };

  // Handle Create Booking
  const handleCreateBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApp.patientName || !newApp.patientPhone) {
      toast.error('Vui lòng điền tên và số điện thoại bệnh nhân!');
      return;
    }

    const created: Appointment = {
      id: `APP-${Math.floor(8800 + Math.random() * 200)}`,
      patientName: newApp.patientName,
      patientPhone: newApp.patientPhone,
      specialty: newApp.specialty,
      doctorName: newApp.doctorName,
      date: new Date().toISOString().split('T')[0],
      slotTime: newApp.slotTime,
      status: 'confirmed',
      channel: 'online_website',
      qrCode: `QR-APP-${Math.floor(1000 + Math.random() * 9000)}`,
      reminderSent: true,
      notes: newApp.notes,
    };

    setAppointments([created, ...appointments]);
    setIsBookingModalOpen(false);
    setNewApp({ patientName: '', patientPhone: '', specialty: 'Khoa Tim Mạch', doctorName: 'BS. CKII Nguyễn Văn Minh', slotTime: '08:00 - 08:30', notes: '' });
    toast.success(`🎉 Đã đặt lịch khám thành công cho bệnh nhân ${created.patientName}! Mã QR: ${created.qrCode}`);
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

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Tên bệnh nhân, SĐT, Mã Lịch..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterSpecialty}
            onChange={(e) => setFilterSpecialty(e.target.value)}
            className="px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer"
          >
            <option value="ALL">Tất cả Chuyên Khoa</option>
            <option value="Khoa Tim Mạch">Khoa Tim Mạch</option>
            <option value="Khoa Tiêu Hóa">Khoa Tiêu Hóa</option>
            <option value="Khoa Nhi">Khoa Nhi</option>
            <option value="Khoa Tai Mũi Họng">Khoa Tai Mũi Họng</option>
            <option value="Khoa Thần Kinh">Khoa Thần Kinh</option>
          </select>
        </div>
      </div>

      {/* Appointments Master Card Grid */}
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

            <form onSubmit={handleCreateBookingSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Tên Bệnh Nhân *</label>
                <input
                  type="text"
                  required
                  placeholder="Nhập họ và tên..."
                  value={newApp.patientName}
                  onChange={(e) => setNewApp({ ...newApp, patientName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Số Điện Thoại Zalo *</label>
                <input
                  type="text"
                  required
                  placeholder="09xx xxx xxx"
                  value={newApp.patientPhone}
                  onChange={(e) => setNewApp({ ...newApp, patientPhone: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-mono text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Chọn Chuyên Khoa</label>
                  <select
                    value={newApp.specialty}
                    onChange={(e) => setNewApp({ ...newApp, specialty: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white"
                  >
                    <option value="Khoa Tim Mạch">Khoa Tim Mạch</option>
                    <option value="Khoa Tiêu Hóa">Khoa Tiêu Hóa</option>
                    <option value="Khoa Nhi">Khoa Nhi</option>
                    <option value="Khoa Tai Mũi Họng">Khoa Tai Mũi Họng</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Chọn Khung Giờ (Slot)</label>
                  <select
                    value={newApp.slotTime}
                    onChange={(e) => setNewApp({ ...newApp, slotTime: e.target.value })}
                    className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 font-bold text-slate-900 dark:text-white font-mono"
                  >
                    <option value="08:00 - 08:30">08:00 - 08:30</option>
                    <option value="08:30 - 09:00">08:30 - 09:00</option>
                    <option value="09:00 - 09:30">09:00 - 09:30</option>
                    <option value="10:00 - 10:30">10:00 - 10:30</option>
                    <option value="14:00 - 14:30">14:00 - 14:30</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 dark:text-slate-300 block mb-1">Bác Sĩ Khám Phụ Trách</label>
                <input
                  type="text"
                  value={newApp.doctorName}
                  onChange={(e) => setNewApp({ ...newApp, doctorName: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 dark:bg-slate-950 text-slate-900 dark:text-white font-medium"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-500 hover:bg-slate-100"
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl text-xs font-black bg-cyan-600 text-white hover:bg-cyan-700 shadow-md cursor-pointer"
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
