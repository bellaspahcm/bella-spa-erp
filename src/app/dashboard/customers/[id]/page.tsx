'use client';

import { PaymentReceiptTemplate } from '@/components/common/PaymentReceiptTemplate';
import { ChevronLeft } from 'lucide-react';
import nextDynamic from 'next/dynamic';
import { ActiveBookingPanel } from './components/ActiveBookingPanel';
import { BookingSelectorPanel } from './components/BookingSelectorPanel';
import { BookingPaymentModal, EditBookingModal, EditCustomerModal } from './components/CustomerDetailModals';
import { CustomerProfilePanel } from './components/CustomerProfilePanel';
import { CustomerStatsPanel } from './components/CustomerStatsPanel';
import { PaymentHistoryPanel } from './components/PaymentHistoryPanel';
import { SessionHistoryPanel } from './components/SessionHistoryPanel';
import { useCustomerDetailController } from './useCustomerDetailController';

// Lazy-load: only opens on user action, keeps customer detail page light.
// Aliased to nextDynamic to avoid colliding with `export const dynamic` segment config below.
const BookingModal = nextDynamic(
  () => import('@/components/features/BookingModal').then((module) => ({ default: module.BookingModal })),
  { ssr: false }
);

export const dynamic = 'force-dynamic';

export default function CustomerDetailPage() {
  const {
    activeBooking,
    activeDepositAmount,
    activeNetPrice,
    customer,
    editBookingData,
    editData,
    handleBack,
    handleBookingSuccess,
    handleExportContract,
    handleExportQuotation,
    handleOpenBookingSessions,
    handleOpenEditBooking,
    handleOpenEditCustomer,
    handleOpenSessions,
    handleOpenZalo,
    handlePayRemaining,
    handleRecordPayment,
    handleReuseActivePackage,
    handleSaveBooking,
    handleSharePortal,
    handleUpdateCustomer,
    handleUpdateKTV,
    isBookingModalOpen,
    isCompleted,
    isDepositOnly,
    isEditBookingModalOpen,
    isEditModalOpen,
    isExportingQuotation,
    isPaymentModalOpen,
    isRecordingPayment,
    isReusing,
    isSavingBooking,
    isUpdatingCustomer,
    isUpdatingKTV,
    ktvs,
    loading,
    nextSession,
    paymentData,
    paymentFile,
    quotationRef,
    receiptData,
    setActiveBooking,
    setEditBookingData,
    setEditData,
    setIsBookingModalOpen,
    setIsEditBookingModalOpen,
    setIsEditModalOpen,
    setIsPaymentModalOpen,
    setPaymentData,
    setPaymentFile,
    sortedSessions,
    tenantModuleKey,
    userRole,
  } = useCustomerDetailController();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background/30">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-rose-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-background/30">
        <h2 className="text-xl font-bold text-slate-800 mb-4">Không tìm thấy khách hàng</h2>
        <button onClick={handleBack} className="text-rose-500 font-bold hover:underline">
          Quay lại danh sách
        </button>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-background/30 p-3 sm:p-6 md:p-10">
      <button onClick={handleBack} className="mb-6 flex items-center gap-2 font-bold text-slate-500 hover:text-primary group md:mb-8">
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-sm border border-slate-100 group-hover:bg-primary group-hover:text-white transition-all">
          <ChevronLeft className="w-5 h-5" />
        </div>
        Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3 xl:gap-8">
        <CustomerProfilePanel
          customer={customer}
          tenantModuleKey={tenantModuleKey}
          userRole={userRole}
          onEditCustomer={handleOpenEditCustomer}
          onOpenBooking={() => setIsBookingModalOpen(true)}
        />

        <div className="space-y-6 xl:col-span-2 xl:space-y-8">
          <CustomerStatsPanel
            activeBooking={activeBooking}
            activeDepositAmount={activeDepositAmount}
            activeNetPrice={activeNetPrice}
            userRole={userRole}
            loyaltyPoints={customer.loyalty_points}
          />

          <BookingSelectorPanel
            bookings={customer.allBookings || []}
            activeBooking={activeBooking}
            onSelectBooking={setActiveBooking}
            tenantModuleKey={tenantModuleKey}
          />

          <ActiveBookingPanel
            activeBooking={activeBooking}
            ktvs={ktvs}
            tenantModuleKey={tenantModuleKey}
            userRole={userRole}
            isDepositOnly={isDepositOnly}
            activeDepositAmount={activeDepositAmount}
            activeNetPrice={activeNetPrice}
            isExportingQuotation={isExportingQuotation}
            isUpdatingKtv={isUpdatingKTV}
            onOpenBooking={() => setIsBookingModalOpen(true)}
            onPayRemaining={handlePayRemaining}
            onOpenZalo={handleOpenZalo}
            onSharePortal={handleSharePortal}
            onExportQuotation={handleExportQuotation}
            onExportContract={handleExportContract}
            onEditBooking={handleOpenEditBooking}
            onUpdateKtv={handleUpdateKTV}
            onOpenBookingSessions={handleOpenBookingSessions}
          />

          <SessionHistoryPanel
            activeBooking={activeBooking}
            sortedSessions={sortedSessions}
            nextSession={nextSession}
            isCompleted={isCompleted}
            isReusing={isReusing}
            onOpenSessions={handleOpenSessions}
            onOpenBookingSessions={handleOpenBookingSessions}
            onReusePackage={handleReuseActivePackage}
            tenantModuleKey={tenantModuleKey}
          />

          <PaymentHistoryPanel activeBooking={activeBooking} userRole={userRole} />
        </div>
      </div>

      <BookingModal
        isOpen={isBookingModalOpen}
        onClose={() => setIsBookingModalOpen(false)}
        onSuccess={handleBookingSuccess}
        preselectedCustomer={customer}
      />

      <EditCustomerModal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onConfirm={handleUpdateCustomer}
        isSubmitting={isUpdatingCustomer}
        data={editData}
        setData={setEditData}
        tenantModuleKey={tenantModuleKey}
      />

      <BookingPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        onConfirm={handleRecordPayment}
        isSubmitting={isRecordingPayment}
        data={paymentData}
        setData={setPaymentData}
        file={paymentFile}
        setFile={setPaymentFile}
        customerName={customer.name_mother}
      />

      <EditBookingModal
        isOpen={isEditBookingModalOpen}
        onClose={() => setIsEditBookingModalOpen(false)}
        onConfirm={handleSaveBooking}
        isSubmitting={isSavingBooking}
        data={editBookingData}
        setData={setEditBookingData}
      />

      {activeBooking && receiptData && (
        <div style={{ position: 'absolute', left: '-9999px', top: '-9999px', pointerEvents: 'none' }}>
          <PaymentReceiptTemplate ref={quotationRef} data={receiptData} />
        </div>
      )}
    </div>
  );
}
