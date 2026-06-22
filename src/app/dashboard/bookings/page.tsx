'use client';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getLocalDateString } from '@bella/shared';;
import { formatBookingCustomerLabel, getTenantSpecialtyOptions } from '@/lib/business-rules/tenant-module-presentation';
import { usePageRefresh } from '@/hooks/usePageRefresh';

import VietQRPaymentModal from '@/components/features/VietQRPaymentModal';
import { BookingsPageHeader, type BookingsViewMode } from './components/BookingsPageHeader';
import { BookingsSpecialtyFilter, type KtvSpecialty } from './components/BookingsSpecialtyFilter';
import { BookingsTimelineDateRibbon } from './components/BookingsTimelineDateRibbon';
import { BookingsMonthCalendar } from './components/BookingsMonthCalendar';
import { BookingDayDetailModal, type BookingModalData } from './components/BookingDayDetailModal';
import { BookingThermalInvoicePrint } from './components/BookingThermalInvoicePrint';
import { BookingCreateScheduleModal } from './components/BookingCreateScheduleModal';
import { BookingsPosPanel } from './components/BookingsPosPanel';
import { ReprintReasonModal } from './components/ReprintReasonModal';
import { BookingsTimelineGrid } from './components/BookingsTimelineGrid';
import { BookingsDayTimelineList } from './components/BookingsDayTimelineList';
import { useBookingsPageData } from './hooks/useBookingsPageData';
import { useBookingsPageActions } from './hooks/useBookingsPageActions';
import { buildSessionModalData, getMonthDays, isSameDay } from './utils/bookingsPageUtils';


function BookingsContent() {
  const searchParams = useSearchParams();
  const customerName = searchParams.get('name');
  const surface = searchParams.get('surface') === 'pos' ? 'pos' : 'schedule';

  const [view, setView] = useState<BookingsViewMode>('timeline');
  const [ktvSpecialty, setKtvSpecialty] = useState<KtvSpecialty>('all');
  const [isSpecialtyDropdownOpen, setIsSpecialtyDropdownOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [modalData, setModalData] = useState<BookingModalData | null>(null);
  const [selectedBookingIdForCreate, setSelectedBookingIdForCreate] = useState('');
  const [createDate, setCreateDate] = useState(() => getLocalDateString());
  const [createTimeRange, setCreateTimeRange] = useState({ start: '09:00', end: '11:00' });
  const {
    sessions,
    allBookings,
    isSyncing,
    isTenantModuleLoading,
    tenantModuleError,
    ktvs,
    bookingResources,
    sessionHistory,
    tenantModuleKey,
    fetchSessions,
    fetchAllBookings,
    fetchSessionHistory,
    refreshBookingsPage,
  } = useBookingsPageData(currentMonth);
  const {
    isUpdating,
    showQrModal,
    setShowQrModal,
    qrModalData,
    printInvoiceData,
    setPrintInvoiceData,
    invoicePrintLogs,
    isLoadingInvoicePrintLogs,
    isPrintingInvoice,
    printingSessionLogId,
    reprintRequest,
    closeReprintRequest,
    confirmReprintRequest,
    fetchInvoicePrintLogs,
    handleOpenQrModal,
    handlePrintThermalInvoice,
    handleVoidLatestInvoice,
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

  const handleSoftRefresh = useCallback(async () => {
    await refreshBookingsPage();
    if (modalData?.bookingId) {
      await fetchSessionHistory(modalData.bookingId);
    }
  }, [fetchSessionHistory, modalData, refreshBookingsPage]);

  usePageRefresh(handleSoftRefresh);

  const monthDays = getMonthDays(currentMonth);
  const today = new Date();

  useEffect(() => {
    if (tenantModuleKey && !getTenantSpecialtyOptions(tenantModuleKey).some((option) => option.id === ktvSpecialty)) {
      setKtvSpecialty('all');
    }
  }, [ktvSpecialty, tenantModuleKey]);

  if (!tenantModuleKey) {
    return (
      <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10 relative">
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
          surface={surface}
          onViewChange={setView}
          onCreateClick={() => {
            setCreateDate(getLocalDateString());
            setShowCreateModal(true);
          }}
        />
        <div className="rounded-[2rem] border border-slate-100 bg-white p-10 text-center shadow-sm">
          <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">
            {isTenantModuleLoading
              ? 'Đang tải phân hệ dịch vụ...'
              : tenantModuleError || 'Chưa xác định được phân hệ dịch vụ của chi nhánh.'}
          </p>
        </div>
      </div>
    );
  }

  const resolvedTenantModuleKey = tenantModuleKey;
  const openSessionDetail = (
    session: Parameters<typeof buildSessionModalData>[0],
    overrides: Partial<BookingModalData> = {},
  ) => {
    setModalData(buildSessionModalData(session, overrides, resolvedTenantModuleKey));
    setShowDetailModal(true);
    void fetchSessionHistory(session.booking_id);
    void fetchInvoicePrintLogs(session.booking_id);
  };
  const printSessionInvoice = (session: Parameters<typeof buildSessionModalData>[0]) => {
    const nextModalData = buildSessionModalData(session, {}, resolvedTenantModuleKey);
    setModalData(nextModalData);
    void fetchSessionHistory(session.booking_id);
    void fetchInvoicePrintLogs(session.booking_id);
    void handlePrintThermalInvoice(nextModalData);
  };

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10 relative">
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
        surface={surface}
        onViewChange={setView}
        onCreateClick={() => {
          setCreateDate(getLocalDateString());
          setShowCreateModal(true);
        }}
      />

      {/* Switch Rendering Views */}
      <AnimatePresence>
        {surface === 'pos' ? (
          <motion.div
            key="pos-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
          >
            <BookingsPosPanel
              sessions={sessions}
              selectedDate={selectedDate}
              tenantModuleKey={resolvedTenantModuleKey}
              isSyncing={isSyncing}
              printingSessionLogId={printingSessionLogId}
              isSameDay={isSameDay}
              onSessionSelect={(session) => {
                openSessionDetail(session);
              }}
              onPrintInvoice={printSessionInvoice}
              onQrClick={handleOpenQrModal}
            />
          </motion.div>
        ) : view === 'calendar' ? (
          <motion.div
            key="calendar-view"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -15 }}
            transition={{ duration: 0.25 }}
            className="space-y-6 md:space-y-8"
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
              tenantModuleKey={resolvedTenantModuleKey}
              isSyncing={isSyncing}
              isSameDay={isSameDay}
              onSessionSelect={(session) => {
                openSessionDetail(session);
              }}
              onQrClick={handleOpenQrModal}
              onCareClick={(session) => {
                if (session.status === 'completed') {
                  toast.info('Buổi tập này đã hoàn thành');
                  return;
                }

                openSessionDetail(session, {
                  customer: formatBookingCustomerLabel({
                    moduleKey: resolvedTenantModuleKey,
                    primaryName: session.bookings?.customers?.name_mother,
                    secondaryName: session.bookings?.customers?.name_baby,
                  }),
                  time: session.assigned_time || new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
                  contractDetail: session.notes || '',
                  status: session.status === 'scheduled' ? 'in_progress' : session.status || undefined,
                });
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
              moduleKey={tenantModuleKey}
              onSelectedDateChange={setSelectedDate}
            />

            {tenantModuleKey ? (
              <BookingsSpecialtyFilter
                value={ktvSpecialty}
                moduleKey={tenantModuleKey}
                isOpen={isSpecialtyDropdownOpen}
                onOpenChange={setIsSpecialtyDropdownOpen}
                onValueChange={setKtvSpecialty}
              />
            ) : (
              <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white px-5 py-4 text-xs font-black uppercase tracking-wider text-slate-400 shadow-sm">
                {isTenantModuleLoading ? 'Đang tải nhóm dịch vụ...' : tenantModuleError || 'Chưa xác định được phân hệ dịch vụ'}
              </div>
            )}

            <BookingsTimelineGrid
              sessions={sessions}
              ktvs={ktvs}
              selectedDate={selectedDate}
              ktvSpecialty={ktvSpecialty}
              tenantModuleKey={resolvedTenantModuleKey}
              isSyncing={isSyncing}
              isSameDay={isSameDay}
              onSessionSelect={(session) => {
                openSessionDetail(session);
              }}
              onEmptySlotClick={(hour) => {
                setSelectedBookingIdForCreate('');
                const startHourStr = String(hour).padStart(2, '0') + ':00';
                const endHourStr = String(hour + 2).padStart(2, '0') + ':00';
                setCreateTimeRange({ start: startHourStr, end: endHourStr });
                setCreateDate(getLocalDateString(selectedDate));
                setShowCreateModal(true);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <BookingDayDetailModal
        isOpen={showDetailModal}
        modalData={modalData}
        ktvs={ktvs}
        bookingResources={bookingResources}
        sessionHistory={sessionHistory}
        invoicePrintLogs={invoicePrintLogs}
        isLoadingInvoicePrintLogs={isLoadingInvoicePrintLogs}
        isPrintingInvoice={isPrintingInvoice}
        isUpdating={isUpdating}
        onClose={() => setShowDetailModal(false)}
        onModalDataChange={setModalData}
        onOpenQrModal={handleOpenQrModal}
        onPrintInvoice={handlePrintThermalInvoice}
        onVoidInvoice={handleVoidLatestInvoice}
        onSave={handleUpdatePlan}
      />
      <BookingThermalInvoicePrint
        invoice={printInvoiceData}
        onAfterPrint={() => setPrintInvoiceData(null)}
      />
      <ReprintReasonModal
        isOpen={Boolean(reprintRequest)}
        isSubmitting={isPrintingInvoice}
        onClose={closeReprintRequest}
        onConfirm={confirmReprintRequest}
      />
      <BookingCreateScheduleModal
        isOpen={showCreateModal}
        allBookings={allBookings}
        bookingResources={bookingResources}
        selectedBookingId={selectedBookingIdForCreate}
        defaultDate={createDate}
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
