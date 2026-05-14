'use client';

import { useState, useEffect, Suspense } from 'react';
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
  MessageSquare
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import PremiumExportButton from '@/components/ui/PremiumExportButton';
import { PremiumSelect } from '@/components/ui/PremiumSelect';

declare global {
  interface Window {
    fetchSessionHistory?: (bookingId: string) => Promise<void>;
  }
}

import { getCalendarSessions, updateSessionLog, getBookings, createSessionLog, completeSession, rescheduleSession } from '@/services/booking-actions';
import { getUsers } from '@/services/user-actions';
import { MOCK_BOOKINGS } from '@/constants/mock-data';
import { MOCK_SERVICES } from '@/constants/mock-data';

const mockBookings = MOCK_BOOKINGS.map(b => ({
  id: b.id,
  customer: b.customers?.name_mother || 'Khách hàng',
  package: b.package_name,
  time: '09:00 - 11:00', // Mock time
  ktv: 'Kỹ thuật viên',
  status: b.status === 'in_progress' ? 'in_progress' : b.status === 'booked' ? 'scheduled' : 'completed',
  location: 'Số 123, Đường ABC, Quận 1, TP.HCM',
  sessionCount: '10/12 buổi',
  contractId: 'HD-2024-001',
  contractDetail: 'Gói chăm sóc Mẹ & Bé chuyên sâu - 12 buổi'
}));

function BookingsContent() {
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name');

  const [view, setView] = useState<'list' | 'calendar'>('list');
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
    setKtvs(data.filter((u: any) => u.role === 'ktv'));
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
        package: s.bookings?.package_name || 'Gói liệu trình',
        time: s.assigned_time || '09:00 - 11:00',
        ktv: s.bookings?.assigned_ktv?.full_name || 'Chưa phân công',
        status: s.status,
        location: s.bookings?.customers?.address || 'Tại Spa',
        sessionCount: `${s.bookings?.completed_sessions || 0}/${s.bookings?.total_sessions || 21} buổi`,
        contractId: s.bookings?.booking_number || 'N/A',
        contractDetail: s.notes || 'Không có ghi chú',
        bookingId: s.booking_id,
        ktvId: s.bookings?.assigned_ktv_id,
        originalStatus: s.status,
        originalDateString: s.assigned_date,
        sessionNumber: s.session_number || 1,
        totalSessions: s.bookings?.total_sessions || 21
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

      // 1. If status changed to completed, use the specialized completeSession action
      if (modalData.status === 'completed' && modalData.originalStatus !== 'completed') {
        const result = await completeSession(modalData.id, modalData.bookingId);
        if (result.error) {
          toast.error('Lỗi khi cập nhật tiến độ: ' + result.error);
          setIsUpdating(false);
          return;
        }
      }

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
        assigned_date: modalData.dateString || modalData.date.toISOString().split('T')[0],
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
        <div className="flex items-center gap-3">
          <PremiumExportButton />
          <div className="bg-white p-1 rounded-2xl border border-slate-200 flex">
            <button 
              onClick={() => setView('list')}
              className={`p-2 rounded-xl transition-all ${view === 'list' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <List className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setView('calendar')}
              className={`p-2 rounded-xl transition-all ${view === 'calendar' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-rose-600 text-white px-6 py-3 rounded-2xl font-bold transition-all shadow-lg shadow-rose-200 active:scale-95"
          >
            <Plus className="w-5 h-5" />
            <span>Tạo lịch mới</span>
          </button>
        </div>
      </div>

      {/* Date Selector (Google Calendar Style Box) */}
      <div className="luxury-card-white p-8 rounded-[40px] mb-8 overflow-hidden relative">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-6">
            <div className="flex items-center bg-slate-50 rounded-2xl p-1 border border-slate-100">
              <button 
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
                      ? 'bg-rose-500 text-white shadow-lg shadow-rose-200' 
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

      {/* Bookings Timeline */}
      <div id="bookings-timeline" className="space-y-4 scroll-mt-8">
        {isLoading && sessions.length === 0 ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
          </div>
        ) : sessions.filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate)).length > 0 ? (
          sessions
            .filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate))
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
                  session.status === 'completed' ? 'bg-emerald-500' : session.status === 'scheduled' ? 'bg-amber-500' : 'bg-slate-300'
                }`}></div>

                  <div 
                    onClick={() => {
                      const detail = {
                        id: session.id,
                        date: new Date(session.assigned_date),
                        dateString: session.assigned_date,
                        customer: `Mẹ: ${session.bookings?.customers?.name_mother || 'Khách hàng'}${session.bookings?.customers?.name_baby ? ` - Bé: ${session.bookings?.customers?.name_baby}` : ''}`,
                        package: session.bookings?.customers?.package_name || session.bookings?.package_name || 'Gói liệu trình',
                        time: session.assigned_time || '09:00 - 11:00',
                        contractId: session.bookings?.booking_number || 'N/A',
                        contractDetail: session.notes || 'Không có ghi chú',
                        bookingId: session.booking_id,
                        ktvId: session.bookings?.assigned_ktv_id,
                        location: session.bookings?.customers?.address || 'Tại Spa',
                        sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 21} buổi`,
                        sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 21} buổi`,
                        originalStatus: session.status,
                        originalDateString: session.assigned_date,
                        status: session.status,
                        sessionNumber: session.session_number || 1,
                        totalSessions: session.bookings?.total_sessions || 21
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
                      {session.bookings?.customers?.package_name || session.bookings?.package_name || 'Gói liệu trình'}
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
                        onClick={(e) => {
                          e.stopPropagation();
                          const detail = {
                            id: session.id,
                            date: new Date(session.assigned_date),
                            dateString: session.assigned_date,
                            customer: `Mẹ: ${session.bookings?.customers?.name_mother || 'Khách hàng'}${session.bookings?.customers?.name_baby ? ` - Bé: ${session.bookings?.customers?.name_baby}` : ''}`,
                            package: session.bookings?.customers?.package_name || session.bookings?.package_name || 'Gói liệu trình',
                            time: session.assigned_time || '09:00 - 11:00',
                            contractId: session.bookings?.booking_number || 'N/A',
                            contractDetail: session.notes || 'Không có ghi chú',
                            bookingId: session.booking_id,
                            ktvId: session.bookings?.assigned_ktv_id,
                            location: session.bookings?.customers?.address || 'Tại Spa',
                            sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 21} buổi`,
                            originalStatus: session.status,
                            sessionNumber: session.session_number || 1,
                            totalSessions: session.bookings?.total_sessions || 21
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
                            package: session.bookings?.customers?.package_name || session.bookings?.package_name || 'Gói liệu trình',
                            time: session.assigned_time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                            contractId: session.bookings?.booking_number || 'N/A',
                            contractDetail: session.notes || '',
                            bookingId: session.booking_id,
                            ktvId: session.bookings?.assigned_ktv_id,
                            location: session.bookings?.customers?.address || 'Tại Spa',
                            sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 21} buổi`,
                            status: 'completed', // Auto-set to completed for check-in
                            originalStatus: session.status,
                            sessionNumber: session.session_number || 1,
                            totalSessions: session.bookings?.total_sessions || 21
                          };
                          setModalData(detail);
                          setShowDetailModal(true);
                          if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                        }}
                        className="px-4 py-2 bg-primary hover:bg-rose-600 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1 shadow-lg shadow-rose-100"
                      >
                        Check-in
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
                            type="text" 
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
                          <p className="font-bold text-slate-900">{modalData.sessionCount}</p>
                          <div className="h-2 flex-1 bg-slate-200 rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500" style={{ width: '83%' }} />
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
                            { value: 'completed', label: 'Đã xong', icon: <CheckCircle2 className="w-4 h-4" /> },
                            { value: 'canceled', label: 'Đã hủy', icon: <X className="w-4 h-4" /> }
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
                        {modalData.status === 'completed' && (
                          <span className="bg-emerald-100 text-emerald-600 text-[10px] font-black px-2 py-1 rounded-lg uppercase tracking-wider animate-pulse">Đang check-in</span>
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
                    assigned_time: formData.get('time'),
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
                        label: `${b.customers?.name_mother} - ${b.booking_number}`
                      }))}
                      onChange={(val) => setSelectedBookingIdForCreate(val)}
                      placeholder="Chọn hợp đồng..."
                      className="mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Ngày thực hiện</label>
                      <input name="date" type="date" defaultValue={new Date().toISOString().split('T')[0]} className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Giờ thực hiện</label>
                      <input name="time" type="text" placeholder="09:00 - 11:00" className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 font-bold text-slate-900 focus:ring-2 focus:ring-primary/20 transition-all outline-none mt-1" />
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
