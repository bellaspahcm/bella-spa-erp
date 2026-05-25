'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  MapPin, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  ChevronLeft,
  ChevronRight,
  LayoutGrid,
  List,
  X,
  FileText,
  Users,
  Package,
  CalendarDays,
  History,
  Briefcase,
  Loader2,
  RefreshCw,
  MessageSquare,
  TrendingUp,
  XCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';
import { getLocalDateString } from '@/lib/utils';

declare global {
  interface Window {
    fetchSessionHistory?: (bookingId: string) => Promise<void>;
  }
}

import { getCalendarSessions, updateSessionLog, createSessionLog, completeSession, rescheduleSession } from '@/modules/booking/actions/session-actions';
import { getBookings, getBookingDetailsWithPayment } from '@/modules/booking/actions/lifecycle-actions';
import VietQRPaymentModal from '@/components/features/VietQRPaymentModal';
import { QrCode } from 'lucide-react';
import { getUsers } from '@/services/user-actions';




function BookingsContent() {
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name');

  const [view, setView] = useState<'calendar' | 'timeline'>('timeline');
  const [ktvSpecialty, setKtvSpecialty] = useState<'all' | 'facial' | 'nails' | 'body'>('all');
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalData, setModalData] = useState<any>(null);
  const [selectedBookingIdForCreate, setSelectedBookingIdForCreate] = useState('');
  const [sessions, setSessions] = useState<any[]>([]);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ktvs, setKtvs] = useState<any[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [createTimeRange, setCreateTimeRange] = useState({ start: '09:00', end: '11:00' });

  // VietQR Payment States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ bookingNumber: string; amount: number; tenantInfo: any } | null>(null);
  const [isFetchingQrData, setIsFetchingQrData] = useState(false);

  const handleOpenQrModal = async (bookingId: string) => {
    setIsFetchingQrData(true);
    try {
      const result = await getBookingDetailsWithPayment(bookingId);
      if (result.error || !result.data) {
        toast.error("Không thể lấy thông tin thanh toán: " + (result.error || "Không có dữ liệu"));
        return;
      }
      
      const booking = result.data;
      const fullPrice = Number(booking.full_price || 0);
      const discountPercent = Number(booking.discount_percent || 0);
      const discountedPrice = fullPrice * (1 - discountPercent / 100);
      
      // Calculate confirmed revenue
      const confirmedRevenue = (booking.revenue || [])
        .filter((r: any) => r.status === 'confirmed')
        .reduce((acc: number, r: any) => acc + Number(r.amount || 0), 0);
        
      let debt = discountedPrice - confirmedRevenue;
      
      // If debt is 0 or less, and status is deposit_pending, QR amount should be deposit_amount
      if (debt <= 0 && booking.status === 'deposit_pending') {
        debt = Number(booking.deposit_amount || 0);
      }
      
      if (debt <= 0) {
        toast.success("Lịch hẹn này đã hoàn tất thanh toán (không còn dư nợ).");
        return;
      }

      setQrModalData({
        bookingNumber: booking.booking_number,
        amount: debt,
        tenantInfo: booking.tenants || null
      });
      setShowQrModal(true);
    } catch (err) {
      console.error("Error opening QR Modal:", err);
      toast.error("Có lỗi xảy ra khi tải dữ liệu thanh toán");
    } finally {
      setIsFetchingQrData(false);
    }
  };

  useEffect(() => {
    if (customerName) {
      toast.info(`Đang mở biểu mẫu đặt lịch cho khách hàng: ${customerName}`);
    }
  }, [customerName]);

  const fetchAllBookings = async () => {
    const data = await getBookings();
    setAllBookings(data);
  };

  const fetchSessions = async () => {
    setIsSyncing(true);
    try {
      const data = await getCalendarSessions();
      setSessions(data);
    } catch (error) {
      console.error('Error fetching sessions:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    fetchSessions();
    fetchAllBookings();
    fetchKtvs();

    const fetchSessionHistory = async (bookingId: string) => {
      const supabase = createClient() as any;
      const { data } = await supabase
        .from('session_logs')
        .select('*')
        .eq('booking_id', bookingId)
        .order('session_number', { ascending: false });
      setSessionHistory(data || []);
    };
    window.fetchSessionHistory = fetchSessionHistory;

    // REALTIME SUBSCRIPTION
    const supabase = createClient() as any;
    const channel = supabase
      .channel('bookings-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_logs' }, () => {
        fetchSessions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
        fetchAllBookings();
        fetchSessions();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchKtvs = async () => {
    const data = await getUsers();
    setKtvs(data.filter((u: any) => u.role?.toLowerCase() === 'ktv'));
  };

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    
    // First day of month
    const firstDay = new Date(year, month, 1);
    // Last day of month
    const lastDay = new Date(year, month + 1, 0);
    
    // Start from the beginning of the week containing the first day
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDate.getDay());
    
    // End at the end of the week containing the last day
    const endDate = new Date(lastDay);
    endDate.setDate(endDate.getDate() + (6 - endDate.getDay()));
    
    const days = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const monthDays = getMonthDays(currentMonth);
  const today = new Date();
  
  const formatDateHeader = (date: Date) => {
    return new Intl.DateTimeFormat('vi-VN', { 
      month: 'long', 
      year: 'numeric' 
    }).format(date);
  };

  const isSameDay = (d1: Date | string, d2: Date | string) => {
    const getLocalDateString = (d: Date | string) => {
      if (typeof d === 'string') return d.split('T')[0];
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    return getLocalDateString(d1) === getLocalDateString(d2);
  };

  const isSameMonth = (d1: Date, d2: Date) => {
    return d1.getMonth() === d2.getMonth() && d1.getFullYear() === d2.getFullYear();
  };

  const handleDayDoubleClick = (date: Date) => {
    const daySessions = sessions.filter(s => s.assigned_date && isSameDay(new Date(s.assigned_date), date));
    
    if (daySessions.length > 0) {
      const s = daySessions[0];
      const detail = {
        id: s.id,
        date,
        customer: `Mẹ: ${s.bookings?.customers?.name_mother || 'Khách hàng'}${s.bookings?.customers?.name_baby ? ` - Bé: ${s.bookings?.customers?.name_baby}` : ''}`,
        package: s.bookings?.packages?.name || s.bookings?.package_name || 'Gói liệu trình',
        time: s.assigned_time || '09:00 - 11:00',
        ktv: s.bookings?.assigned_ktv?.full_name || 'Chưa phân công',
        status: s.status,
        location: s.bookings?.customers?.address || 'Tại Spa',
        sessionCount: `${s.bookings?.completed_sessions || 0}/${s.bookings?.total_sessions || 15} buổi`,
        completedSessions: s.bookings?.completed_sessions || 0,
        totalSessions: s.bookings?.total_sessions || 15,
        contractId: s.bookings?.booking_number || 'N/A',
        contractDetail: s.notes || 'Không có ghi chú',
        bookingId: s.booking_id,
        ktvId: s.bookings?.assigned_ktv_id,
        originalStatus: s.status,
        originalDateString: s.assigned_date,
        sessionNumber: s.session_number || 1
      };
      setModalData(detail);
      setShowDetailModal(true);
    } else {
      toast.info(`Không có lịch hẹn vào ngày ${date.toLocaleDateString('vi-VN')}`);
    }
  };

  const handleUpdatePlan = async () => {
    setIsUpdating(true);
    try {
      // 0. Check for Reschedule (Date Shift)
      // Only shift if it's scheduled and the date has actually changed
      const isDateChanged = modalData.dateString && modalData.dateString !== modalData.originalDateString;
      
      if (isDateChanged && modalData.status === 'scheduled') {
        const rescheduleResult = await rescheduleSession(modalData.id, modalData.dateString);
        if (rescheduleResult.error) {
          toast.error('Lỗi khi dời lịch: ' + rescheduleResult.error);
          setIsUpdating(false);
          return;
        }
        // If we rescheduled, we still might want to update notes/time/ktv below,
        // but the date is already handled.
      }

      // 1. Status transitions are now handled directly by updateSessionLog to avoid race conditions

      // 2. Update Booking KTV if changed
      const supabase = createClient() as any;
      if (modalData.ktvId) {
        await supabase
          .from('bookings')
          .update({ assigned_ktv_id: modalData.ktvId })
          .eq('id', modalData.bookingId);
      }

      // 3. Update the rest of the fields (date, time, notes, and status if not handled above)
      // If we rescheduled above, we don't need to update the date here again, but it's safe to do so.
      const result = await updateSessionLog(modalData.id, {
        assigned_date: modalData.dateString || getLocalDateString(modalData.date),
        assigned_time: modalData.time,
        notes: modalData.contractDetail,
        status: modalData.status
      });

      if (result.error) {
        toast.error('Lỗi: ' + result.error);
      } else {
        toast.success(isDateChanged ? 'Đã dời lịch và cập nhật thành công!' : 'Đã cập nhật tiến độ và kế hoạch thành công!');
        fetchSessions();
        fetchAllBookings();
        setShowDetailModal(false);
      }
    } catch (error) {
      console.error('Update failed:', error);
      toast.error('Có lỗi xảy ra khi lưu dữ liệu');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-slate-50/30 overflow-auto relative">
      {/* Non-intrusive loading bar */}
      <AnimatePresence>
        {isSyncing && (
          <motion.div 
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-rose-400 to-primary origin-left z-50"
            transition={{ duration: 0.5 }}
          />
        )}
      </AnimatePresence>
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Lịch hẹn</h1>
          <p className="text-slate-500 font-medium mt-1">Điều phối và theo dõi lịch chăm sóc</p>
        </div>
      <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
        {/* View Switcher segment */}
        <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shadow-inner w-full sm:w-auto justify-center sm:justify-start">
          <button
            onClick={() => setView('timeline')}
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
            onClick={() => setView('calendar')}
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
            onClick={() => setShowCreateModal(true)}
            className="flex-grow sm:flex-initial flex items-center justify-center gap-2 bg-primary hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 active:scale-95 text-xs whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            <span>Đặt lịch mới</span>
          </button>
        </div>
      </div>
    </div>

      {/* Switch Rendering Views */}
      <AnimatePresence mode="wait">
        {view === 'calendar' ? (
          <motion.div
            key="calendar-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-8"
          >
            {/* Month Calendar Box */}
            <div className="luxury-card-white p-8 rounded-[40px] overflow-hidden relative">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-6">
                  <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                    <button 
                      type="button"
                      onClick={() => {
                        const prev = new Date(currentMonth);
                        prev.setMonth(prev.getMonth() - 1);
                        setCurrentMonth(prev);
                      }}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                    >
                      <ChevronLeft className="w-5 h-5 text-slate-600" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const next = new Date(currentMonth);
                        next.setMonth(next.getMonth() + 1);
                        setCurrentMonth(next);
                      }}
                      className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                    >
                      <ChevronRight className="w-5 h-5 text-slate-600" />
                    </button>
                  </div>
                  <h2 className="text-2xl font-black text-slate-900 capitalize tracking-tight">
                    {formatDateHeader(currentMonth)}
                  </h2>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setCurrentMonth(new Date());
                      setSelectedDate(new Date());
                    }}
                    className="text-sm font-bold text-slate-600 bg-slate-50 border border-slate-100 px-5 py-2.5 rounded-2xl hover:bg-slate-100 transition-all active:scale-95"
                  >
                    Hôm nay
                  </button>
                </div>
              </div>

              {/* Days Header */}
              <div className="grid grid-cols-7 mb-4">
                {['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'].map((day) => (
                  <div key={day} className="text-center">
                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{day}</span>
                  </div>
                ))}
              </div>

              {/* Grid Box */}
              <div className="grid grid-cols-7 gap-px bg-slate-100 border border-slate-100 rounded-3xl overflow-hidden relative">
                {isSyncing && sessions.length === 0 && (
                  <div className="absolute inset-0 bg-white/50 backdrop-blur-[2px] z-20 flex items-center justify-center">
                    <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                  </div>
                )}
                {monthDays.map((date, i) => {
                  const isToday = isSameDay(date, today);
                  const isSelected = isSameDay(date, selectedDate);
                  const isCurrentMonth = isSameMonth(date, currentMonth);
                  
                  const daySessions = sessions.filter(s => s.assigned_date && isSameDay(new Date(s.assigned_date), date));
                  
                  return (
                    <div 
                      key={i} 
                      onClick={() => {
                        setSelectedDate(date);
                        // Smooth scroll to timeline
                        setTimeout(() => {
                          document.getElementById('bookings-timeline')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }, 100);
                      }}
                      className={`min-h-[100px] p-3 bg-white transition-all cursor-pointer group hover:bg-slate-50/80 relative select-none ${
                        !isCurrentMonth ? 'opacity-40' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className={`flex items-center justify-center w-8 h-8 text-sm font-bold rounded-xl transition-all ${
                          isSelected 
                            ? 'bg-rose-50 text-white shadow-lg shadow-rose-200' 
                            : isToday 
                              ? 'bg-rose-50 text-rose-500 border border-rose-100' 
                              : 'text-slate-600 group-hover:text-slate-900'
                        }`}>
                          {date.getDate()}
                        </span>
                        {isToday && (
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        )}
                      </div>
                      
                      {/* Event Indicator */}
                      {daySessions.length > 0 && (
                        <div className="flex flex-col gap-1">
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-400" style={{ width: '100%' }} />
                          </div>
                          <span className="text-[9px] font-bold text-slate-400 truncate">
                            {daySessions.length} Lịch hẹn
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bookings Timeline Day List */}
            <div id="bookings-timeline" className="space-y-4 scroll-mt-8">
              {isLoading && sessions.length === 0 ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
                </div>
              ) : sessions.filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate)).length > 0 ? (
                sessions
                  .filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate))
                  .sort((a, b) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime())
                  .map((session: any, idx: number) => (
                    <motion.div 
                      key={session.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="relative pl-8 group"
                    >
                      {/* Timeline Line */}
                      <div className="absolute left-[11px] top-0 bottom-0 w-[2px] bg-slate-100 group-last:bottom-1/2"></div>
                      {/* Timeline Dot */}
                      <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full border-4 border-white shadow-md z-10 ${
                        session.status === 'completed' ? 'bg-emerald-500' : 
                        session.status === 'in_progress' ? 'bg-blue-500' : 
                        session.status === 'scheduled' ? 'bg-amber-500' : 'bg-slate-300'
                      }`}></div>

                      <div 
                        onClick={() => {
                          const detail = {
                            id: session.id,
                            date: new Date(session.assigned_date),
                            dateString: session.assigned_date,
                            customer: `Mẹ: ${session.bookings?.customers?.name_mother || 'Khách hàng'}${session.bookings?.customers?.name_baby ? ` - Bé: ${session.bookings?.customers?.name_baby}` : ''}`,
                            package: session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình',
                            time: session.assigned_time || '09:00 - 11:00',
                            contractId: session.bookings?.booking_number || 'N/A',
                            contractDetail: session.notes || 'Không có ghi chú',
                            bookingId: session.booking_id,
                            ktvId: session.bookings?.assigned_ktv_id,
                            location: session.bookings?.customers?.address || 'Tại Spa',
                            sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 15} buổi`,
                            completedSessions: session.bookings?.completed_sessions || 0,
                            totalSessions: session.bookings?.total_sessions || 15,
                            originalStatus: session.status,
                            originalDateString: session.assigned_date,
                            status: session.status,
                            sessionNumber: session.session_number || 1
                          };
                          setModalData(detail);
                          setShowDetailModal(true);
                          if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                        }}
                        className="luxury-card-white p-6 rounded-3xl transition-all flex flex-col md:flex-row md:items-center gap-6 cursor-pointer hover:shadow-xl hover:border-primary/20"
                      >
                        <div className="flex-1">
                          <div className="flex items-center gap-4 mb-3">
                            <div className="flex items-center gap-1.5 text-slate-900 font-black">
                              <Clock className="w-4 h-4 text-rose-500" />
                              {session.assigned_time || '09:00 - 11:00'}
                            </div>
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                              session.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 
                              session.status === 'scheduled' ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-600'
                            }`}>
                              {session.status === 'completed' ? 'Hoàn thành' : 
                               session.status === 'scheduled' ? 'Sắp tới' : 'Khác'}
                            </span>
                          </div>
                          
                          <h3 className="text-xl font-extrabold text-slate-900 mb-2">
                            Mẹ: {session.bookings?.customers?.name_mother}
                            {session.bookings?.customers?.name_baby && (
                              <span className="text-rose-400 ml-2 font-medium"> - Bé: {session.bookings?.customers?.name_baby}</span>
                            )}
                          </h3>
                          <p className="text-slate-500 font-bold text-sm flex items-center gap-2">
                            <LayoutGrid className="w-4 h-4 text-slate-300" />
                            {session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình'}
                          </p>
                        </div>

                        <div className="flex flex-col md:items-end gap-3 md:border-l md:pl-8 border-slate-100">
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-[10px] font-black text-slate-400 uppercase">Kỹ thuật viên</p>
                              <p className="font-bold text-slate-900">{session.bookings?.assigned_ktv?.full_name || 'Chưa phân công'}</p>
                            </div>
                            <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-600 font-bold">
                              {session.bookings?.assigned_ktv?.full_name?.[0] || 'K'}
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenQrModal(session.booking_id);
                              }}
                              className="p-2 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-500 hover:text-rose-600 transition-colors flex items-center justify-center border border-rose-100/50 active:scale-95"
                              title="Thanh toán VietQR"
                            >
                              <QrCode className="w-4 h-4" />
                            </button>
                            <button 
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const detail = {
                                  id: session.id,
                                  date: new Date(session.assigned_date),
                                  dateString: session.assigned_date,
                                  customer: `Mẹ: ${session.bookings?.customers?.name_mother || 'Khách hàng'}${session.bookings?.customers?.name_baby ? ` - Bé: ${session.bookings?.customers?.name_baby}` : ''}`,
                                  package: session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình',
                                  time: session.assigned_time || '09:00 - 11:00',
                                  contractId: session.bookings?.booking_number || 'N/A',
                                  contractDetail: session.notes || 'Không có ghi chú',
                                  bookingId: session.booking_id,
                                  ktvId: session.bookings?.assigned_ktv_id,
                                  location: session.bookings?.customers?.address || 'Tại Spa',
                                  sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 15} buổi`,
                                  originalStatus: session.status,
                                  sessionNumber: session.session_number || 1,
                                  totalSessions: session.bookings?.total_sessions || 15
                                };
                                setModalData(detail);
                                setShowDetailModal(true);
                                if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                              }}
                              className="px-4 py-2 bg-slate-50 hover:bg-slate-100 rounded-xl font-bold text-xs text-slate-600 transition-colors"
                            >
                              Dời lịch
                            </button>
                            <button 
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (session.status === 'completed') {
                                  toast.info('Buổi tập này đã hoàn thành');
                                  return;
                                }
                                
                                // Prefill modal for check-in
                                const detail = {
                                  id: session.id,
                                  date: new Date(session.assigned_date),
                                  dateString: session.assigned_date,
                                  customer: session.bookings?.customers?.name_mother || 'Khách hàng',
                                  package: session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình',
                                  time: session.assigned_time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                                  contractId: session.bookings?.booking_number || 'N/A',
                                  contractDetail: session.notes || '',
                                  bookingId: session.booking_id,
                                  ktvId: session.bookings?.assigned_ktv_id,
                                  location: session.bookings?.customers?.address || 'Tại Spa',
                                  sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 15} buổi`,
                                  completedSessions: session.bookings?.completed_sessions || 0,
                                  totalSessions: session.bookings?.total_sessions || 15,
                                  status: session.status === 'scheduled' ? 'in_progress' : session.status,
                                  originalStatus: session.status,
                                  sessionNumber: session.session_number || 1
                                };
                                setModalData(detail);
                                setShowDetailModal(true);
                                if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                              }}
                              className="px-4 py-2 bg-primary hover:bg-rose-600 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1 shadow-lg shadow-rose-100"
                            >
                              Chăm sóc
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
              ) : (
                <div className="bg-white/50 border border-dashed border-slate-200 rounded-[32px] p-12 text-center">
                  <CalendarIcon className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                  <p className="text-slate-400 font-bold">Không có lịch hẹn nào cho ngày này</p>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          /* Daily KTV Timeline view */
          <motion.div
            key="timeline-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6"
          >
            {/* Daily date Ribbon selector */}
            {(() => {
              const getDaysOfWeek = (d: Date) => {
                const current = new Date(d);
                const day = current.getDay();
                const diff = current.getDate() - day + (day === 0 ? -6 : 1);
                const monday = new Date(current.setDate(diff));
                const days = [];
                for (let i = 0; i < 7; i++) {
                  const nextDay = new Date(monday);
                  nextDay.setDate(monday.getDate() + i);
                  days.push(nextDay);
                }
                return days;
              };
              
              const weekDays = getDaysOfWeek(selectedDate);
              
              return (
                <div className="luxury-card-white p-6 rounded-[32px] mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 select-none">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
                      <button 
                        type="button"
                        onClick={() => {
                          const prev = new Date(selectedDate);
                          prev.setDate(prev.getDate() - 1);
                          setSelectedDate(prev);
                        }}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                      >
                        <ChevronLeft className="w-5 h-5 text-slate-600" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          const next = new Date(selectedDate);
                          next.setDate(next.getDate() + 1);
                          setSelectedDate(next);
                        }}
                        className="p-2 hover:bg-white hover:shadow-sm rounded-xl transition-all"
                      >
                        <ChevronRight className="w-5 h-5 text-slate-600" />
                      </button>
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-slate-900 capitalize tracking-tight">
                        {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(selectedDate)}
                      </h2>
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest">
                        Bella Spa Coordinator
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                    {weekDays.map((date, idx) => {
                      const isSelected = isSameDay(date, selectedDate);
                      const isToday = isSameDay(date, today);
                      const daysName = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
                      const dayLabel = daysName[date.getDay()];
                      
                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setSelectedDate(date)}
                          className={`flex flex-col items-center justify-center w-12 h-14 rounded-2xl transition-all shrink-0 select-none ${
                            isSelected
                              ? 'bg-gradient-to-br from-rose-500 to-rose-400 text-white shadow-md shadow-rose-200 scale-105'
                              : isToday
                                ? 'bg-rose-50 text-rose-500 border border-rose-100'
                                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span className="text-[9px] font-black uppercase tracking-widest">{dayLabel}</span>
                          <span className="text-sm font-extrabold mt-0.5">{date.getDate()}</span>
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDate(new Date());
                      }}
                      className="text-xs font-black text-slate-500 bg-slate-100 hover:bg-slate-200 px-4 py-3 rounded-2xl transition-all ml-2 shrink-0 active:scale-95"
                    >
                      Hôm nay
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Specialty Filters tabs & arrow navigation */}
            {(() => {
              const specialties = [
                { id: 'all', label: 'Tất cả KTV', icon: <Users className="w-4 h-4" /> },
                { id: 'facial', label: 'Chăm sóc Da mặt', icon: <Briefcase className="w-4 h-4 text-rose-400" /> },
                { id: 'nails', label: 'Nails & Mi', icon: <Briefcase className="w-4 h-4 text-purple-400" /> },
                { id: 'body', label: 'Massage & Body', icon: <Briefcase className="w-4 h-4 text-indigo-400" /> }
              ];

              return (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 select-none">
                  <div className="flex items-center gap-2 bg-slate-100/80 p-1 rounded-2xl border border-slate-200/50 w-fit">
                    {specialties.map((spec) => {
                      const isActive = ktvSpecialty === spec.id;
                      return (
                        <button
                          key={spec.id}
                          type="button"
                          onClick={() => setKtvSpecialty(spec.id as any)}
                          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs transition-all ${
                            isActive
                              ? 'bg-white text-slate-900 shadow-sm shadow-slate-100'
                              : 'text-slate-500 hover:text-slate-700'
                          }`}
                        >
                          {spec.icon}
                          <span>{spec.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      type="button"
                      onClick={() => {
                        const body = document.getElementById('timeline-body');
                        if (body) body.scrollBy({ left: -240, behavior: 'smooth' });
                      }}
                      className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-slate-500 hover:text-slate-800"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button 
                      type="button"
                      onClick={() => {
                        const body = document.getElementById('timeline-body');
                        if (body) body.scrollBy({ left: 240, behavior: 'smooth' });
                      }}
                      className="p-2.5 bg-white border border-slate-200/60 rounded-xl hover:bg-slate-50 transition-all shadow-sm active:scale-95 text-slate-500 hover:text-slate-800"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Daily Timeline Grid Container */}
            {(() => {
              const getKtvSpecialty = (ktvName: string) => {
                const name = ktvName.toLowerCase();
                if (name.includes('hoa') || name.includes('hà') || name.includes('ha')) return 'facial';
                if (name.includes('tuyết') || name.includes('tuyet') || name.includes('thanh')) return 'nails';
                if (name.includes('mai')) return 'body';
                return 'facial';
              };

              const filteredKtvs = ktvs.filter(ktv => {
                if (ktvSpecialty === 'all') return true;
                return getKtvSpecialty(ktv.full_name) === ktvSpecialty;
              });

              const columns = [
                { id: null, full_name: 'Chưa phân công', role: 'ktv', isUnassigned: true },
                ...filteredKtvs
              ];

              const hours = Array.from({ length: 12 }, (_, i) => 9 + i); // 9:00 to 20:00

              return (
                <div className="relative border border-slate-200/60 rounded-[40px] bg-white shadow-xl shadow-slate-100/50 overflow-hidden flex flex-col">
                  {/* Syncing Loading Overlay */}
                  {isSyncing && (
                    <div className="absolute inset-0 bg-white/40 backdrop-blur-[1px] z-40 flex items-center justify-center pointer-events-none">
                      <Loader2 className="w-10 h-10 text-rose-500 animate-spin" />
                    </div>
                  )}

                  {/* Header Row */}
                  <div className="flex bg-slate-50/50 border-b border-slate-100 sticky top-0 z-20">
                    <div className="w-20 md:w-24 border-r border-slate-100 flex-shrink-0 bg-slate-50 sticky left-0 z-30 flex items-center justify-center text-[10px] font-black uppercase text-slate-400 tracking-wider select-none">
                      Giờ
                    </div>
                    
                    <div 
                      ref={timelineScrollRef}
                      className="flex flex-1 overflow-x-auto select-none no-scrollbar"
                      onScroll={(e) => {
                        const body = document.getElementById('timeline-body');
                        if (body) body.scrollLeft = e.currentTarget.scrollLeft;
                      }}
                    >
                      {columns.map((col) => (
                        <div 
                          key={col.id || 'unassigned'}
                          className="min-w-[200px] md:min-w-[240px] flex-1 py-4 px-6 text-center border-r border-slate-100 flex-shrink-0 flex flex-col items-center justify-center gap-1.5"
                        >
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm select-none ${
                            col.isUnassigned 
                              ? 'bg-rose-50 text-rose-500 border-2 border-rose-100 border-dashed animate-pulse' 
                              : 'bg-gradient-to-tr from-rose-400 to-rose-300 text-white shadow-inner'
                          }`}>
                            {col.isUnassigned ? '?' : col.full_name[0]}
                          </div>
                          <div>
                            <h3 className="font-extrabold text-slate-800 text-sm tracking-tight">{col.full_name}</h3>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-tight">
                              {col.isUnassigned 
                                ? `${sessions.filter(s => isSameDay(new Date(s.assigned_date), selectedDate) && !s.bookings?.assigned_ktv_id).length} ca`
                                : `${sessions.filter(s => isSameDay(new Date(s.assigned_date), selectedDate) && s.bookings?.assigned_ktv_id === col.id).length} ca`
                              }
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Body Content */}
                  <div 
                    id="timeline-body"
                    className="flex-1 overflow-x-auto no-scrollbar max-h-[640px]"
                    onScroll={(e) => {
                      const header = timelineScrollRef.current;
                      if (header) header.scrollLeft = e.currentTarget.scrollLeft;
                    }}
                  >
                    <div className="flex relative">
                      {/* Left sticky Hour Column */}
                      <div className="w-20 md:w-24 border-r border-slate-100 flex-shrink-0 bg-white sticky left-0 z-10 flex flex-col select-none shadow-[4px_0_12px_rgba(0,0,0,0.015)]">
                        {hours.map((hour) => (
                          <div 
                            key={hour} 
                            className="h-24 border-b border-slate-100/60 flex items-center justify-center"
                          >
                            <span className="text-xs font-black text-slate-400 tracking-wider bg-slate-50 px-2.5 py-1 rounded-xl">
                              {String(hour).padStart(2, '0')}:00
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Columns with hour slots */}
                      <div className="flex flex-1">
                        {columns.map((col) => {
                          return (
                            <div 
                              key={col.id || 'unassigned'}
                              className="min-w-[200px] md:min-w-[240px] flex-1 flex-shrink-0 border-r border-slate-100 relative bg-slate-50/20"
                            >
                              {hours.map((hour) => {
                                const getSessionHourBlock = (timeStr: string) => {
                                  if (!timeStr) return 9;
                                  const match = timeStr.match(/^(\d{2}):(\d{2})/);
                                  return match ? parseInt(match[1], 10) : 9;
                                };

                                const cellSessions = sessions.filter(session => {
                                  const isKtvMatch = col.isUnassigned 
                                    ? !session.bookings?.assigned_ktv_id 
                                    : (session.bookings?.assigned_ktv_id === col.id);
                                  return isKtvMatch && 
                                         isSameDay(new Date(session.assigned_date), selectedDate) && 
                                         getSessionHourBlock(session.assigned_time) === hour;
                                });

                                return (
                                  <div 
                                    key={hour}
                                    className="h-24 border-b border-slate-100/60 p-2.5 relative flex flex-col justify-start gap-2 group/cell transition-colors hover:bg-slate-50/40"
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
                                              onClick={() => {
                                                const detail = {
                                                  id: session.id,
                                                  date: new Date(session.assigned_date),
                                                  dateString: session.assigned_date,
                                                  customer: `Mẹ: ${session.bookings?.customers?.name_mother || 'Khách hàng'}${session.bookings?.customers?.name_baby ? ` - Bé: ${session.bookings?.customers?.name_baby}` : ''}`,
                                                  package: session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình',
                                                  time: session.assigned_time || '09:00 - 11:00',
                                                  contractId: session.bookings?.booking_number || 'N/A',
                                                  contractDetail: session.notes || 'Không có ghi chú',
                                                  bookingId: session.booking_id,
                                                  ktvId: session.bookings?.assigned_ktv_id,
                                                  location: session.bookings?.customers?.address || 'Tại Spa',
                                                  sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 15} buổi`,
                                                  completedSessions: session.bookings?.completed_sessions || 0,
                                                  totalSessions: session.bookings?.total_sessions || 15,
                                                  originalStatus: session.status,
                                                  originalDateString: session.assigned_date,
                                                  status: session.status,
                                                  sessionNumber: session.session_number || 1
                                                };
                                                setModalData(detail);
                                                setShowDetailModal(true);
                                                if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                                              }}
                                              className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md hover:scale-[1.01] active:scale-[0.99] select-none text-left ${
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
                                                <span className={`text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                                                  isCompleted 
                                                    ? 'bg-emerald-100 text-emerald-700' 
                                                    : isInProgress 
                                                      ? 'bg-sky-100 text-sky-700' 
                                                      : isScheduled 
                                                        ? 'bg-rose-100 text-rose-700' 
                                                        : 'bg-slate-100 text-slate-700'
                                                }`}>
                                                  {isCompleted ? 'Xong' : isInProgress ? 'Chạy' : 'Sắp'}
                                                </span>
                                                <span className="text-[10px] font-black text-slate-400 flex items-center gap-0.5 shrink-0">
                                                  <Clock className="w-2.5 h-2.5 text-rose-400" />
                                                  {session.assigned_time || '09:00'}
                                                </span>
                                              </div>
                                              <h4 className="font-extrabold text-slate-800 text-xs truncate">
                                                Mẹ {session.bookings?.customers?.name_mother || 'Khách hàng'}
                                              </h4>
                                              {session.bookings?.customers?.name_baby && (
                                                <p className="text-[9px] font-bold text-rose-400 truncate">
                                                  Bé: {session.bookings?.customers?.name_baby}
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
                                        onClick={() => {
                                          setSelectedBookingIdForCreate('');
                                          const startHourStr = String(hour).padStart(2, '0') + ':00';
                                          const endHourStr = String(hour + 2).padStart(2, '0') + ':00';
                                          setCreateTimeRange({ start: startHourStr, end: endHourStr });
                                          setShowCreateModal(true);
                                          
                                          setTimeout(() => {
                                            const dateInput = document.querySelector('input[name="date"]') as HTMLInputElement;
                                            if (dateInput) dateInput.value = getLocalDateString(selectedDate);
                                          }, 100);
                                        }}
                                        className="absolute inset-0 rounded-xl m-1 flex items-center justify-center border border-dashed border-transparent hover:border-slate-200 hover:bg-white/70 cursor-pointer group transition-all duration-200 z-0"
                                      >
                                        <Plus className="w-4 h-4 text-rose-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Day Detail Modal */}
      <AnimatePresence>
        {showDetailModal && modalData && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDetailModal(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[40px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 max-h-[90vh] overflow-y-auto">
                {/* Modal Header */}
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h3 className="text-2xl font-black text-slate-900">Chi tiết lịch hẹn</h3>
                    <p className="text-rose-500 font-bold mt-1">
                      {new Intl.DateTimeFormat('vi-VN', { dateStyle: 'full' }).format(modalData.date)}
                    </p>
                  </div>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                  >
                    <X className="w-6 h-6 text-slate-400" />
                  </button>
                </div>

                {/* Modal Content - Bento Style */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Customer & KTV */}
                  <div className="col-span-2 md:col-span-1 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 text-slate-400">
                      <Users className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Nhân sự & Khách hàng</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Khách hàng</p>
                        <p className="font-bold text-slate-900">{modalData.customer}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-2 ml-1">Kỹ thuật viên</p>
                        <PremiumSelect 
                          value={modalData.ktvId || ''}
                          options={[
                            { value: '', label: 'Chưa phân công' },
                            ...ktvs.map(k => ({ value: k.id, label: k.full_name }))
                          ]}
                          onChange={(value) => {
                            const ktvName = ktvs.find(k => k.id === value)?.full_name || 'Chưa phân công';
                            setModalData({...modalData, ktvId: value, ktv: ktvName});
                          }}
                          placeholder="Chọn kỹ thuật viên..."
                        />
                      </div>
                    </div>
                  </div>

                  {/* Time & Location */}
                  <div className="col-span-2 md:col-span-1 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 text-slate-400">
                      <Clock className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Thời gian & Địa điểm</span>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <p className="text-xs text-slate-400 font-bold mb-1">Ngày (Dời lịch)</p>
                          <input 
                            type="date" 
                            value={modalData.dateString || ''}
                            onChange={(e) => setModalData({...modalData, dateString: e.target.value})}
                            className="w-full bg-white border-none rounded-xl px-2 py-2 font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none text-xs"
                          />
                        </div>
                        <div>
                          <p className="text-xs text-slate-400 font-bold mb-1">Giờ chăm sóc</p>
                          <input 
                            type="time" 
                            value={modalData.time || ''}
                            onChange={(e) => setModalData({...modalData, time: e.target.value})}
                            className="w-full bg-white border-none rounded-xl px-2 py-2 font-bold text-slate-900 shadow-sm focus:ring-2 focus:ring-primary/20 transition-all outline-none text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400 font-bold mb-1">Địa chỉ</p>
                        <p className="font-bold text-slate-900 text-sm leading-relaxed">{modalData.location}</p>
                      </div>
                    </div>
                  </div>

                  {/* Package & Progress */}
                  <div className="col-span-2 md:col-span-1 bg-rose-50/50 p-6 rounded-[32px] border border-rose-100">
                    <div className="flex items-center gap-3 mb-4 text-rose-400">
                      <Package className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest">Gói dịch vụ</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-rose-400 font-bold mb-1">Liệu trình</p>
                        <p className="font-bold text-slate-900">{modalData.package} (Buổi {modalData.sessionNumber})</p>
                      </div>
                      <div>
                        <p className="text-xs text-rose-400 font-bold mb-1">Số lượng buổi</p>
                        <div className="flex items-center gap-3">
                          <p className="font-bold text-slate-900">{modalData.completedSessions}/{modalData.totalSessions} buổi</p>
                          <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-rose-500 transition-all duration-500" 
                              style={{ width: `${Math.min(100, ((modalData.completedSessions || 0) / (modalData.totalSessions || 15)) * 100)}%` }} 
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Status Selection */}
                  <div className="col-span-2 md:col-span-1 bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                    <div className="flex items-center gap-3 mb-4 text-slate-500">
                      <FileText className="w-5 h-5" />
                      <span className="text-xs font-black uppercase tracking-widest text-slate-400">Trạng thái hiện tại</span>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <p className="text-xs text-slate-500 font-bold mb-2">Cập nhật trạng thái</p>
                        <PremiumSelect 
                          value={modalData.status}
                          options={[
                            { value: 'scheduled', label: 'Sắp tới', icon: <Clock className="w-4 h-4" /> },
                            { value: 'in_progress', label: 'Đang thực hiện', icon: <TrendingUp className="w-4 h-4" /> },
                            { value: 'completed', label: 'Hoàn thành', icon: <CheckCircle2 className="w-4 h-4" /> },
                            { value: 'cancelled', label: 'Đã hủy', icon: <XCircle className="w-4 h-4" /> }
                          ]}
                          onChange={(value) => setModalData({...modalData, status: value})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Session History & Notes */}
                  <div className="col-span-2 space-y-6">
                    <div className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                      <div className="flex items-center gap-3 mb-4 text-slate-400">
                        <History className="w-5 h-5" />
                        <span className="text-xs font-black uppercase tracking-widest">Lịch sử buổi tập trước</span>
                      </div>
                      <div className="space-y-3 max-h-[150px] overflow-auto pr-2 custom-scrollbar">
                        {sessionHistory.filter(s => s.status === 'completed' && s.id !== modalData.id).length > 0 ? (
                          sessionHistory
                            .filter(s => s.status === 'completed' && s.id !== modalData.id)
                            .map((s) => (
                              <div key={s.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-[10px] font-black text-primary uppercase tracking-tighter">Buổi {s.session_number}</span>
                                  <span className="text-[10px] font-bold text-slate-400">{new Date(s.completed_date || s.assigned_date).toLocaleDateString('vi-VN')}</span>
                                </div>
                                <p className="text-xs text-slate-600 font-bold italic leading-relaxed">"{s.notes || 'Không có ghi chú'}"</p>
                              </div>
                            ))
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest italic">Chưa có lịch sử hoàn thành</p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="bg-white p-8 rounded-[40px] border-2 border-primary/10 shadow-2xl shadow-primary/5">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3 text-primary">
                          <MessageSquare className="w-5 h-5" />
                          <span className="text-xs font-black uppercase tracking-widest">Nội dung chăm sóc hôm nay</span>
                        </div>
                        {modalData.status === 'in_progress' && (
                          <span className="bg-blue-100 text-blue-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">Đang thực hiện</span>
                        )}
                      </div>
                      <textarea 
                        className="w-full h-32 p-5 bg-slate-50 rounded-[24px] border-none focus:ring-2 focus:ring-primary/20 outline-none font-bold text-slate-700 placeholder:text-slate-300 resize-none transition-all text-sm shadow-inner"
                        placeholder="Mẹ và bé hôm nay thế nào? Ghi chú các kỹ thuật đã thực hiện để lần sau nắm thông tin..."
                        value={modalData.contractDetail}
                        onChange={(e) => setModalData({...modalData, contractDetail: e.target.value})}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex gap-3">
                  <button 
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenQrModal(modalData.bookingId);
                    }}
                    className="flex-1 bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 border border-rose-100/50 py-4 rounded-2xl font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Thanh toán VietQR</span>
                  </button>
                  <button 
                    onClick={handleUpdatePlan}
                    disabled={isUpdating}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-200 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Lưu thay đổi'}
                  </button>
                  <button 
                    onClick={() => setShowDetailModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Create New Schedule Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowCreateModal(false)}
              className="absolute inset-0 bg-[#1A0A0E]/70 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[40px] shadow-2xl overflow-hidden p-8"
            >
              <div className="flex items-center justify-between mb-8">
                <h3 className="text-2xl font-black text-slate-900">Tạo lịch chăm sóc mới</h3>
                <button 
                  onClick={() => setShowCreateModal(false)}
                  className="p-3 hover:bg-slate-100 rounded-2xl transition-colors"
                >
                  <X className="w-6 h-6 text-slate-400" />
                </button>
              </div>

              <form className="space-y-6" onSubmit={async (e) => {
                e.preventDefault();
                setIsUpdating(true);
                const formData = new FormData(e.currentTarget);
                try {
                  const result = await createSessionLog({
                    booking_id: formData.get('booking_id'),
                    assigned_date: formData.get('date'),
                    assigned_time: createTimeRange.start, // Valid HH:MM for DB; display range is cosmetic
                    notes: formData.get('notes'),
                    status: 'scheduled'
                  });

                  if (result.error) {
                    toast.error(result.error);
                  } else {
                    toast.success('Đã tạo lịch hẹn mới thành công!');
                    fetchSessions();
                    setShowCreateModal(false);
                  }
                } catch (error) {
                  toast.error('Có lỗi xảy ra');
                } finally {
                  setIsUpdating(false);
                }
              }}>
                <div className="space-y-4">
                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Chọn Hợp đồng / Khách hàng</label>
                    <input type="hidden" name="booking_id" value={selectedBookingIdForCreate} />
                    <PremiumSelect 
                      value={selectedBookingIdForCreate}
                      options={allBookings.map(b => ({
                        value: b.id,
                        label: `${b.customers?.name_mother} - ${b.packages?.name || b.package_name || 'Gói liệu trình'}`
                      }))}
                      onChange={(val) => setSelectedBookingIdForCreate(val)}
                      placeholder="Chọn hợp đồng..."
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ngày thực hiện</label>
                      <input name="date" type="date" defaultValue={getLocalDateString()} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Giờ bắt đầu</label>
                      <input 
                        type="time" 
                        value={createTimeRange.start}
                        onChange={(e) => setCreateTimeRange(p => ({ ...p, start: e.target.value }))}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" 
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Giờ kết thúc</label>
                      <input 
                        type="time" 
                        value={createTimeRange.end}
                        onChange={(e) => setCreateTimeRange(p => ({ ...p, end: e.target.value }))}
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ghi chú</label>
                    <textarea name="notes" placeholder="Nhập yêu cầu đặc biệt..." className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1 h-24 resize-none" />
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <button 
                    type="submit"
                    disabled={isUpdating}
                    className="flex-1 bg-primary text-white py-4 rounded-2xl font-bold hover:bg-rose-600 transition-all active:scale-95 shadow-lg shadow-rose-200 disabled:opacity-50"
                  >
                    {isUpdating ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Xác nhận lịch hẹn'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-slate-100 text-slate-600 py-4 rounded-2xl font-bold hover:bg-slate-200 transition-all active:scale-95"
                  >
                    Hủy bỏ
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* VietQR Payment Modal */}
      {qrModalData && (
        <VietQRPaymentModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          bookingNumber={qrModalData.bookingNumber}
          amount={qrModalData.amount}
          tenantInfo={qrModalData.tenantInfo}
        />
      )}
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <BookingsContent />
    </Suspense>
  );
}
