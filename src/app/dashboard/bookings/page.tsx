'use client';

import { type FormEvent, useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  LayoutGrid,
  Loader2,
  QrCode,
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
import { getUsers } from '@/services/user-actions';
import { BookingsPageHeader, type BookingsViewMode } from './components/BookingsPageHeader';
import { BookingsSpecialtyFilter, type KtvSpecialty } from './components/BookingsSpecialtyFilter';
import { BookingsTimelineDateRibbon } from './components/BookingsTimelineDateRibbon';
import { BookingsMonthCalendar } from './components/BookingsMonthCalendar';
import { BookingDayDetailModal, type BookingModalData, type KtvOption, type SessionHistoryItem } from './components/BookingDayDetailModal';
import { BookingCreateScheduleModal, type BookingOption } from './components/BookingCreateScheduleModal';
import { BookingsTimelineGrid, type TimelineSession } from './components/BookingsTimelineGrid';

type TenantBankInfo = {
  qr_bank_code?: string;
  qr_account_number?: string;
  qr_account_name?: string;
  name?: string;
};

type RevenuePayment = {
  status?: string | null;
  amount?: number | string | null;
};


function BookingsContent() {
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name');

  const [view, setView] = useState<BookingsViewMode>('timeline');
  const [ktvSpecialty, setKtvSpecialty] = useState<KtvSpecialty>('all');
  const [isSpecialtyDropdownOpen, setIsSpecialtyDropdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalData, setModalData] = useState<BookingModalData | null>(null);
  const [selectedBookingIdForCreate, setSelectedBookingIdForCreate] = useState('');
  const [sessions, setSessions] = useState<TimelineSession[]>([]);
  const [allBookings, setAllBookings] = useState<BookingOption[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [ktvs, setKtvs] = useState<KtvOption[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [sessionHistory, setSessionHistory] = useState<SessionHistoryItem[]>([]);
  const [createTimeRange, setCreateTimeRange] = useState({ start: '09:00', end: '11:00' });

  // VietQR Payment States
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalData, setQrModalData] = useState<{ bookingNumber: string; amount: number; tenantInfo: TenantBankInfo | null } | null>(null);

  const handleOpenQrModal = async (bookingId: string) => {
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
        .filter((payment: RevenuePayment) => payment.status === 'confirmed')
        .reduce((acc: number, payment: RevenuePayment) => acc + Number(payment.amount || 0), 0);
        
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
    setKtvs(data.filter((user: KtvOption & { role?: string | null }) => user.role?.toLowerCase() === 'ktv'));
  };

  useEffect(() => {
    const initializeBookingsPage = async () => {
      await Promise.all([fetchSessions(), fetchAllBookings(), fetchKtvs()]);
    };

    void initializeBookingsPage();

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

  const buildSessionModalData = (session: TimelineSession, overrides: Partial<BookingModalData> = {}) => ({
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
    ktvId: session.bookings?.assigned_ktv_id || undefined,
    location: session.bookings?.customers?.address || 'Tại Spa',
    sessionCount: `${session.bookings?.completed_sessions || 0}/${session.bookings?.total_sessions || 15} buổi`,
    completedSessions: session.bookings?.completed_sessions || 0,
    totalSessions: session.bookings?.total_sessions || 15,
    originalStatus: session.status || undefined,
    originalDateString: session.assigned_date,
    status: session.status || undefined,
    sessionNumber: session.session_number || 1,
    ...overrides,
  });

  const handleUpdatePlan = async () => {
    if (!modalData) return;

    setIsUpdating(true);
    try {
      // 0. Check for Reschedule (Date Shift)
      // Only shift if it's scheduled and the date has actually changed
      const newDateString = modalData.dateString;
      const isDateChanged = Boolean(newDateString && newDateString !== modalData.originalDateString);
      
      if (newDateString && isDateChanged && modalData.status === 'scheduled') {
        const rescheduleResult = await rescheduleSession(modalData.id, newDateString);
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
    } catch {
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
              {isSyncing && sessions.length === 0 ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="w-10 h-10 text-slate-200 animate-spin" />
                </div>
              ) : sessions.filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate)).length > 0 ? (
                sessions
                  .filter(s => isSameDay(new Date(s.assigned_date || 0), selectedDate))
                  .sort((a, b) => new Date(b.assigned_date).getTime() - new Date(a.assigned_date).getTime())
                  .map((session, idx) => (
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
                                  status: session.status === 'scheduled' ? 'in_progress' : session.status || undefined,
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

            <BookingsTimelineGrid
              sessions={sessions}
              ktvs={ktvs}
              selectedDate={selectedDate}
              ktvSpecialty={ktvSpecialty}
              isSyncing={isSyncing}
              isSameDay={isSameDay}
              onSessionSelect={(session) => {
                setModalData(buildSessionModalData(session));
                setShowDetailModal(true);
                if (window.fetchSessionHistory) window.fetchSessionHistory(session.booking_id);
              }}
              onEmptySlotClick={(hour) => {
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
            />
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
