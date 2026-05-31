'use client';

import { type FormEvent, useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  LayoutGrid,
  Plus,
  Loader2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase-client';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/utils';

declare global {
  interface Window {
    fetchSessionHistory?: (bookingId: string) => Promise<void>;
  }
}

import { getCalendarSessions, updateSessionLog, createSessionLog, rescheduleSession } from '@/modules/booking/actions/session-actions';
import { getBookings, getBookingDetailsWithPayment } from '@/modules/booking/actions/lifecycle-actions';
import VietQRPaymentModal from '@/components/features/VietQRPaymentModal';
import { QrCode } from 'lucide-react';
import { getUsers } from '@/services/user-actions';
import { BookingsPageHeader, type BookingsViewMode } from './components/BookingsPageHeader';
import { BookingsSpecialtyFilter, type KtvSpecialty } from './components/BookingsSpecialtyFilter';
import { BookingsTimelineDateRibbon } from './components/BookingsTimelineDateRibbon';
import { BookingsMonthCalendar } from './components/BookingsMonthCalendar';
import { BookingDayDetailModal } from './components/BookingDayDetailModal';
import { BookingCreateScheduleModal } from './components/BookingCreateScheduleModal';




function BookingsContent() {
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name');

  const [view, setView] = useState<BookingsViewMode>('timeline');
  const [ktvSpecialty, setKtvSpecialty] = useState<KtvSpecialty>('all');
  const [isSpecialtyDropdownOpen, setIsSpecialtyDropdownOpen] = useState(false);
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
    try {
      const data = await getBookings();
      setAllBookings(data);
    } catch (error) {
      console.error('Error fetching bookings:', error);
      setAllBookings([]);
      toast.error('Khong the tai danh sach booking');
    }
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

  const fetchKtvs = async () => {
    const data = await getUsers();
    setKtvs(data.filter((u: any) => u.role?.toLowerCase() === 'ktv'));
  };

  useEffect(() => {
    fetchSessions();
    fetchAllBookings();
    fetchKtvs();

    const fetchSessionHistory = async (bookingId: string) => {
      const supabase = createClient();
      const { data } = await supabase
        .from('session_logs')
        .select('*')
        .eq('booking_id', bookingId)
        .order('session_number', { ascending: false });
      setSessionHistory(data || []);
    };
    window.fetchSessionHistory = fetchSessionHistory;

    // REALTIME SUBSCRIPTION
    const supabase = createClient();
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
    const current = new Date(startDate);
    
    while (current <= endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  };

  const monthDays = getMonthDays(currentMonth);
  const today = new Date();
  
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

  const buildSessionModalData = (session: any, overrides: Record<string, unknown> = {}) => ({
    id: session.id,
    date: new Date(session.assigned_date),
    dateString: session.assigned_date,
    customer: `Mẹ: ${session.bookings?.customers?.name_mother || 'Khách hàng'}${session.bookings?.customers?.name_baby ? ` - Bé: ${session.bookings?.customers?.name_baby}` : ''}`,
    package: session.bookings?.packages?.name || session.bookings?.package_name || 'Gói liệu trình',
    time: session.assigned_time || '09:00 - 11:00',
    ktv: session.bookings?.assigned_ktv?.full_name || 'Chưa phân công',
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
    sessionNumber: session.session_number || 1,
    ...overrides,
  });

  const handleDayDoubleClick = (date: Date) => {
    const daySessions = sessions.filter(s => s.assigned_date && isSameDay(new Date(s.assigned_date), date));
    
    if (daySessions.length > 0) {
      const s = daySessions[0];
      setModalData(buildSessionModalData(s, { date }));
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
      const supabase = createClient();
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

  const handleCreateScheduleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUpdating(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await createSessionLog({
        booking_id: formData.get('booking_id'),
        assigned_date: formData.get('date'),
        assigned_time: createTimeRange.start,
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
  };

  return (
    <div className="flex-1 p-6 md:p-10 bg-background/30 overflow-auto relative">
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
      <BookingsPageHeader
        view={view}
        onViewChange={setView}
        onCreateClick={() => setShowCreateModal(true)}
      />

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
            <BookingsMonthCalendar
              currentMonth={currentMonth}
              monthDays={monthDays}
              selectedDate={selectedDate}
              today={today}
              sessions={sessions}
              isSyncing={isSyncing}
              onCurrentMonthChange={setCurrentMonth}
              onSelectedDateChange={setSelectedDate}
            />

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
                          setModalData(buildSessionModalData(session));
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
                                setModalData(buildSessionModalData(session));
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
                                setModalData(buildSessionModalData(session, {
                                  customer: session.bookings?.customers?.name_mother || 'Khách hàng',
                                  time: session.assigned_time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                                  contractDetail: session.notes || '',
                                  status: session.status === 'scheduled' ? 'in_progress' : session.status,
                                }));
                                setShowDetailModal(true);
                                if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                              }}
                              className="px-4 py-2 bg-primary hover:bg-rose-600 text-white rounded-xl font-bold text-xs transition-colors disabled:opacity-50 flex items-center gap-1 shadow-lg shadow-rose-100 dark:shadow-none"
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
            <BookingsTimelineDateRibbon
              selectedDate={selectedDate}
              today={today}
              onSelectedDateChange={setSelectedDate}
            />

            <BookingsSpecialtyFilter
              value={ktvSpecialty}
              isOpen={isSpecialtyDropdownOpen}
              onOpenChange={setIsSpecialtyDropdownOpen}
              onValueChange={setKtvSpecialty}
            />

            {/* Daily Timeline Grid Container */}
            {(() => {
              const getSessionCategory = (session: any) => {
                const nameLower = (
                  session.bookings?.packages?.name || 
                  session.bookings?.package_name || 
                  ''
                ).toLowerCase();
                
                if (nameLower.includes('combo') || nameLower.includes('home-care') || nameLower.includes('signature')) {
                  return 'combo';
                }
                if (nameLower.includes('bé') || nameLower.includes('tắm') || nameLower.includes('hydrotherapy') || nameLower.includes('con yêu')) {
                  return 'baby';
                }
                if (nameLower.includes('bầu') || nameLower.includes('thai')) {
                  return 'pregnancy';
                }
                if (nameLower.includes('sữa') || nameLower.includes('thông') || nameLower.includes('kích')) {
                  return 'lactation';
                }
                return 'combo';
              };

              const getKtvSpecialty = (ktv: any) => {
                // 1. Dynamic check: check if this KTV has a session on the selected date
                const ktvSessions = sessions.filter(s => {
                  const activeKtvId = s.completed_by_ktv_id || s.bookings?.assigned_ktv_id;
                  return activeKtvId === ktv.id && isSameDay(new Date(s.assigned_date), selectedDate);
                });
                
                if (ktvSessions.length > 0) {
                  return getSessionCategory(ktvSessions[0]);
                }
                
                // 2. Fallback to name-based mapping
                const name = (ktv.full_name || '').toLowerCase();
                if (name.includes('hoa') || name.includes('hà') || name.includes('ha')) return 'combo';
                if (name.includes('tuyết') || name.includes('tuyet') || name.includes('thanh') || name.includes('bella')) return 'baby';
                if (name.includes('mai')) return 'pregnancy';
                return 'lactation';
              };

              const filteredKtvs = ktvs.filter(ktv => {
                if (ktvSpecialty === 'all') return true;
                return getKtvSpecialty(ktv) === ktvSpecialty;
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
                                ? `${sessions.filter(s => isSameDay(new Date(s.assigned_date), selectedDate) && !(s.completed_by_ktv_id || s.bookings?.assigned_ktv_id)).length} ca`
                                : `${sessions.filter(s => isSameDay(new Date(s.assigned_date), selectedDate) && (s.completed_by_ktv_id || s.bookings?.assigned_ktv_id) === col.id).length} ca`
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
                            className="h-[116px] border-b border-slate-100/60 flex items-center justify-center"
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
                                  const activeKtvId = session.completed_by_ktv_id || session.bookings?.assigned_ktv_id;
                                  const isKtvMatch = col.isUnassigned 
                                    ? !activeKtvId 
                                    : (activeKtvId === col.id);
                                  return isKtvMatch && 
                                         isSameDay(new Date(session.assigned_date), selectedDate) && 
                                         getSessionHourBlock(session.assigned_time) === hour;
                                });

                                return (
                                  <div
                                    key={hour}
                                    className="h-[116px] border-b border-slate-100/60 p-2.5 relative flex flex-col justify-start gap-2 group/cell transition-colors hover:bg-slate-50/40"
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
                                                setModalData(buildSessionModalData(session));
                                                setShowDetailModal(true);
                                                if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
                                              }}
                                              className={`p-3 rounded-2xl border transition-all cursor-pointer hover:shadow-md select-none text-left ${
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

      <BookingDayDetailModal
        isOpen={showDetailModal}
        modalData={modalData}
        ktvs={ktvs}
        sessionHistory={sessionHistory}
        isUpdating={isUpdating}
        onClose={() => setShowDetailModal(false)}
        onModalDataChange={setModalData}
        onOpenQrModal={handleOpenQrModal}
        onSave={handleUpdatePlan}
      />
      <BookingCreateScheduleModal
        isOpen={showCreateModal}
        allBookings={allBookings}
        selectedBookingId={selectedBookingIdForCreate}
        createTimeRange={createTimeRange}
        isUpdating={isUpdating}
        onClose={() => setShowCreateModal(false)}
        onSelectedBookingChange={setSelectedBookingIdForCreate}
        onCreateTimeRangeChange={setCreateTimeRange}
        onSubmit={handleCreateScheduleSubmit}
      />
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
