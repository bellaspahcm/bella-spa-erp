'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getLocalDateString } from '@/lib/utils';

import VietQRPaymentModal from '@/components/features/VietQRPaymentModal';
import { BookingsPageHeader, type BookingsViewMode } from './components/BookingsPageHeader';
import { BookingsSpecialtyFilter, type KtvSpecialty } from './components/BookingsSpecialtyFilter';
import { BookingsTimelineDateRibbon } from './components/BookingsTimelineDateRibbon';
import { BookingsMonthCalendar } from './components/BookingsMonthCalendar';
import { BookingDayDetailModal, type BookingModalData } from './components/BookingDayDetailModal';
import { BookingCreateScheduleModal } from './components/BookingCreateScheduleModal';
import { BookingsTimelineGrid, type TimelineSession } from './components/BookingsTimelineGrid';
import { BookingsDayTimelineList } from './components/BookingsDayTimelineList';
import { useBookingsPageData } from './hooks/useBookingsPageData';
import { useBookingsPageActions } from './hooks/useBookingsPageActions';


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
  const [createTimeRange, setCreateTimeRange] = useState({ start: '09:00', end: '11:00' });
  const {
    sessions,
    allBookings,
    isSyncing,
    ktvs,
    sessionHistory,
    fetchSessions,
    fetchAllBookings,
    fetchSessionHistory,
  } = useBookingsPageData();
  const {
    isUpdating,
    showQrModal,
    setShowQrModal,
    qrModalData,
    handleOpenQrModal,
    handleUpdatePlan,
    handleCreateScheduleSubmit,
  } = useBookingsPageActions({
    modalData,
    createTimeRange,
    fetchSessions,
    fetchAllBookings,
    closeDetailModal: () => setShowDetailModal(false),
    closeCreateModal: () => setShowCreateModal(false),
  });

  useEffect(() => {
    if (customerName) {
      toast.info(`Đang mở biểu mẫu đặt lịch cho khách hàng: ${customerName}`);
    }
  }, [customerName]);

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

            <BookingsDayTimelineList
              sessions={sessions}
              selectedDate={selectedDate}
              isSyncing={isSyncing}
              isSameDay={isSameDay}
              onSessionSelect={(session) => {
                setModalData(buildSessionModalData(session));
                setShowDetailModal(true);
                void fetchSessionHistory(session.booking_id);
              }}
              onQrClick={handleOpenQrModal}
              onCareClick={(session) => {
                if (session.status === 'completed') {
                  toast.info('Buổi tập này đã hoàn thành');
                  return;
                }

                setModalData(buildSessionModalData(session, {
                  customer: session.bookings?.customers?.name_mother || 'Khách hàng',
                  time: session.assigned_time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  contractDetail: session.notes || '',
                  status: session.status === 'scheduled' ? 'in_progress' : session.status || undefined,
                }));
                setShowDetailModal(true);
                void fetchSessionHistory(session.booking_id);
              }}
            />
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
                void fetchSessionHistory(session.booking_id);
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
