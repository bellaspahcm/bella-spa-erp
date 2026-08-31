'use client';

import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import { getLocalDateString } from '@bella/shared';;
import {
  getInvoicePrintLogsForBooking,
  recordInvoicePrintLog,
  voidLatestInvoicePrintLog,
  type BookingInvoicePrintLog,
} from '@/core/services/order/invoice-print-actions';
import { createSessionLog, rescheduleSession, updateSessionLog } from '@/core/services/order';
import { getBookingDetailsWithPayment, updateBooking } from '@/core/services/order';
import { checkBookingConflicts } from '@/services/decision-actions/booking-decisions';

import type { BookingModalData } from '../components/BookingDayDetailModal';
import type { BookingThermalInvoiceData } from '../components/BookingThermalInvoicePrint';
import { withCreateScheduleConflictTimeout } from '../utils/createScheduleDecisionTimeout';

type TenantBankInfo = {
  qr_bank_code?: string | null;
  qr_account_number?: string | null;
  qr_account_name?: string | null;
  logo_url?: string | null;
  brand_theme?: unknown;
  enabled_modules?: unknown;
  name?: string;
};

type RevenuePayment = {
  status?: string | null;
  amount?: number | string | null;
  revenue_type?: string | null;
};

type TimeRange = {
  start: string;
  end: string;
};

type UseBookingsPageActionsArgs = {
  modalData: BookingModalData | null;
  createTimeRange: TimeRange;
  fetchSessions: () => Promise<void>;
  fetchAllBookings: (options?: { force?: boolean }) => Promise<void>;
  closeDetailModal: () => void;
  closeCreateModal: () => void;
};

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

async function timeCreateScheduleStep<T>(label: string, operation: () => Promise<T>): Promise<T> {
  const startedAt = nowMs();
  try {
    return await operation();
  } finally {
    const durationMs = Math.round(nowMs() - startedAt);
    console.info(`[CreateSchedule] ${label} completed in ${durationMs}ms`);
  }
}

export function useBookingsPageActions({
  modalData,
  createTimeRange,
  fetchSessions,
  fetchAllBookings,
  closeDetailModal,
  closeCreateModal,
}: UseBookingsPageActionsArgs) {
  const [isUpdating, setIsUpdating] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrModalData, setQrModalData] = useState<{
    bookingNumber: string;
    amount: number;
    tenantInfo: TenantBankInfo | null;
  } | null>(null);
  const [printInvoiceData, setPrintInvoiceData] = useState<BookingThermalInvoiceData | null>(null);
  const [invoicePrintLogs, setInvoicePrintLogs] = useState<BookingInvoicePrintLog[]>([]);
  const [isLoadingInvoicePrintLogs, setIsLoadingInvoicePrintLogs] = useState(false);
  const [isPrintingInvoice, setIsPrintingInvoice] = useState(false);
  const [printingSessionLogId, setPrintingSessionLogId] = useState<string | null>(null);
  const [reprintRequest, setReprintRequest] = useState<BookingModalData | null>(null);

  const buildPaymentSnapshot = async (bookingId: string) => {
    const result = await getBookingDetailsWithPayment(bookingId);
    if (result.error || !result.data) {
      throw new Error(result.error || 'Không có dữ liệu');
    }

    const booking = result.data;
    const paymentState = calculateBookingPaymentState({
      fullPrice: booking.full_price,
      discountPercent: booking.discount_percent,
      depositAmount: booking.deposit_amount,
      bookingStatus: booking.status,
      revenues: booking.revenue as RevenuePayment[] | null,
    });

    return { booking, paymentState };
  };

  const fetchInvoicePrintLogs = async (bookingId: string) => {
    setIsLoadingInvoicePrintLogs(true);
    try {
      const result = await getInvoicePrintLogsForBooking(bookingId);
      if (!result.success) {
        setInvoicePrintLogs([]);
        toast.error('Không thể tải lịch sử in bill: ' + (result.error || 'Lỗi không xác định'));
        return;
      }

      setInvoicePrintLogs(result.data);
    } catch (err: unknown) {
      console.error('Error fetching invoice print logs:', err);
      setInvoicePrintLogs([]);
      toast.error('Không thể tải lịch sử in bill.');
    } finally {
      setIsLoadingInvoicePrintLogs(false);
    }
  };

  const handleOpenQrModal = async (bookingId: string) => {
    try {
      const { booking, paymentState } = await buildPaymentSnapshot(bookingId);
      const debt = paymentState.remainingDebt;

      if (debt <= 0) {
        toast.success('Lịch hẹn này đã hoàn tất thanh toán (không còn dư nợ).');
        return;
      }

      setQrModalData({
        bookingNumber: booking.booking_number,
        amount: debt,
        tenantInfo: booking.tenants || null,
      });
      setShowQrModal(true);
    } catch (err: unknown) {
      console.error('Error opening QR Modal:', err);
      toast.error('Có lỗi xảy ra khi tải dữ liệu thanh toán');
    }
  };

  const handlePrintThermalInvoice = async (targetModalData = modalData, approvedReprintReason?: string | null) => {
    if (!targetModalData) return;
    if (isPrintingInvoice) return;

    setIsPrintingInvoice(true);
    setPrintingSessionLogId(targetModalData.id);
    try {
      const { booking, paymentState } = await buildPaymentSnapshot(targetModalData.bookingId);
      const logsResult = await getInvoicePrintLogsForBooking(targetModalData.bookingId);
      if (!logsResult.success) {
        setInvoicePrintLogs([]);
        toast.error('Không thể tải lịch sử in bill: ' + (logsResult.error || 'Lỗi không xác định'));
        return;
      }

      setInvoicePrintLogs(logsResult.data);
      const hasActiveInvoice = logsResult.data.some((log) => !log.voided_at);
      let reprintReason: string | null = null;

      if (hasActiveInvoice) {
        reprintReason = approvedReprintReason?.trim() || null;
        if (!reprintReason) {
          setReprintRequest(targetModalData);
          return;
        }
        if (reprintReason.length < 5) {
          toast.error('Vui lòng nhập lý do in lại rõ ràng hơn.');
          return;
        }
      }

      const tenantInfo = booking.tenants || null;
      const bankCode = tenantInfo?.qr_bank_code || '';
      const accountNumber = tenantInfo?.qr_account_number || '';
      const accountName = tenantInfo?.qr_account_name || '';
      const bookingNumber = booking.booking_number || targetModalData.contractId || targetModalData.bookingId.slice(0, 8);
      const transferMemo = `BELLA ${bookingNumber}`.replace(/\s+/g, ' ').trim();
      const qrUrl = bankCode && accountNumber && paymentState.remainingDebt > 0
        ? `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${paymentState.remainingDebt}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountName)}`
        : null;
      const originalAmount = Number(booking.full_price || 0);
      const discountAmount = Math.max(0, originalAmount - paymentState.priceAfterDiscount);
      const invoiceNumber = `INV-${bookingNumber}`;
      const tenantBrand = resolveTenantBrandIdentity({
        enabledModules: tenantInfo?.enabled_modules,
        brandTheme: tenantInfo?.brand_theme,
        logoUrl: tenantInfo?.logo_url,
        tenantName: tenantInfo?.name,
        surface: 'invoice',
      });

      const logResult = await recordInvoicePrintLog({
        bookingId: targetModalData.bookingId,
        sessionLogId: targetModalData.id,
        invoiceNumber,
        amountDue: paymentState.remainingDebt,
        transferMemo,
        reason: reprintReason,
      });

      if (!logResult.success) {
        toast.error('Không thể ghi lịch sử in hóa đơn: ' + (logResult.error || 'Lỗi không xác định'));
        return;
      }

      setPrintInvoiceData({
        invoiceNumber,
        printedAt: new Intl.DateTimeFormat('vi-VN', {
          dateStyle: 'short',
          timeStyle: 'medium',
        }).format(new Date()),
        brandName: tenantBrand.displayName,
        logoUrl: tenantBrand.logoUrl,
        customerName: targetModalData.customer || 'Khách hàng',
        bookingNumber,
        packageName: targetModalData.package || booking.package_name || 'Gói dịch vụ',
        ktvName: targetModalData.ktv || null,
        sessionLabel: targetModalData.sessionNumber ? `Buổi ${targetModalData.sessionNumber}` : targetModalData.sessionCount || null,
        originalAmount,
        discountAmount,
        paidAmount: paymentState.totalPaid,
        amountDue: paymentState.remainingDebt,
        paymentMethod: paymentState.remainingDebt > 0 ? 'VietQR' : 'Khác',
        qrUrl,
        transferMemo,
        isReprint: (logResult.data?.print_count || 1) > 1,
      });

      await fetchInvoicePrintLogs(targetModalData.bookingId);
      toast.success('Đã chuẩn bị hóa đơn K80. Hộp thoại in sẽ mở ngay.');
    } catch (err: unknown) {
      console.error('Error preparing thermal invoice:', err);
      toast.error('Không thể chuẩn bị hóa đơn in.');
    } finally {
      setIsPrintingInvoice(false);
      setPrintingSessionLogId(null);
    }
  };

  const closeReprintRequest = () => {
    setReprintRequest(null);
    setIsPrintingInvoice(false);
    setPrintingSessionLogId(null);
  };

  const confirmReprintRequest = async (reason: string) => {
    if (!reprintRequest) return;
    const target = reprintRequest;
    setReprintRequest(null);
    setIsPrintingInvoice(false);
    setPrintingSessionLogId(null);
    await handlePrintThermalInvoice(target, reason);
  };

  const handleVoidLatestInvoice = async () => {
    if (!modalData) return;

    const reason = window.prompt('Nhập lý do hủy bill đã in để sửa thông tin/in lại:');
    if (!reason) return;

    try {
      const { paymentState } = await buildPaymentSnapshot(modalData.bookingId);
      if (paymentState.remainingDebt <= 0) {
        toast.error('Booking đã thanh toán xong, không thể rollback bill từ màn hình này.');
        return;
      }

      const result = await voidLatestInvoicePrintLog({
        bookingId: modalData.bookingId,
        reason,
      });

      if (!result.success) {
        toast.error('Không thể hủy bill đã in: ' + (result.error || 'Lỗi không xác định'));
        return;
      }

      await fetchInvoicePrintLogs(modalData.bookingId);
      toast.success('Đã hủy bill đã in. Bạn có thể sửa thông tin rồi in bill mới.');
    } catch (err: unknown) {
      console.error('Error voiding invoice print log:', err);
      toast.error('Không thể hủy bill đã in.');
    }
  };

  const handleUpdatePlan = async () => {
    if (isUpdating) return;
    if (!modalData) return;

    setIsUpdating(true);
    try {
      const newDateString = modalData.dateString;
      const isDateChanged = Boolean(newDateString && newDateString !== modalData.originalDateString);

      // Check for booking conflicts using Decision Engine
      const conflictCheck = await checkBookingConflicts({
        bookingId: modalData.bookingId,
        ktvId: modalData.ktvId || null,
        bookingResourceId: modalData.bookingResourceId || null,
        assignedDate: modalData.dateString || getLocalDateString(modalData.date),
        assignedTime: modalData.time || '09:00',
        durationMinutes: 90, // Resolved dynamically inside the action
      });

      // Handle conflict check result
      if (conflictCheck.decision === 'REJECT') {
        toast.error(conflictCheck.message || 'Không thể cập nhật lịch hẹn do xung đột');
        if (conflictCheck.context?.conflicts && Array.isArray(conflictCheck.context.conflicts)) {
          const conflicts = conflictCheck.context.conflicts as Array<{
            type: string;
            time: string;
            customer?: string;
            room?: string;
          }>;
          conflicts.forEach((conflict) => {
            if (conflict.type === 'ktv_double_booking') {
              toast.error(`⚠️ KTV đã có lịch lúc ${conflict.time} với khách ${conflict.customer}`);
            } else if (conflict.type === 'room_double_booking') {
              toast.error(`⚠️ Phòng ${conflict.room} đã có lịch lúc ${conflict.time}`);
            }
          });
        }
        setIsUpdating(false);
        return; // Block update
      }

      if (conflictCheck.decision === 'APPROVE_WITH_WARNING') {
        toast.warning(conflictCheck.message || 'Cảnh báo: Vượt quá số ca khuyến nghị');
      }

      if (newDateString && isDateChanged && modalData.status === 'scheduled') {
        const rescheduleResult = await rescheduleSession(modalData.id, newDateString);
        if (rescheduleResult.error) {
          toast.error('Lỗi khi dời lịch: ' + rescheduleResult.error);
          setIsUpdating(false);
          return;
        }
      }

      if ((modalData.ktvId || null) !== (modalData.originalKtvId || null)) {
        const updateResult = await updateBooking(modalData.bookingId, { assigned_ktv_id: modalData.ktvId || null });
        if (updateResult.error) {
          throw new Error(updateResult.error);
        }
      }

      const result = await updateSessionLog(modalData.id, {
        assigned_date: modalData.dateString || getLocalDateString(modalData.date),
        assigned_time: modalData.time,
        booking_resource_id: modalData.bookingResourceId || null,
        notes: modalData.contractDetail,
        status: modalData.status,
      });

      if (result.error) {
        toast.error('Lỗi: ' + result.error);
      } else {
        toast.success(isDateChanged ? 'Đã dời lịch và cập nhật thành công!' : 'Đã cập nhật tiến độ và kế hoạch thành công!');
        await fetchSessions();
        await fetchAllBookings({ force: true });
        closeDetailModal();
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
    if (isUpdating) return;

    setIsUpdating(true);

    const formData = new FormData(event.currentTarget);

    try {
      const bookingId = formData.get('booking_id');
      const date = formData.get('date');
      const notes = formData.get('notes');
      const bookingResourceId = formData.get('booking_resource_id');

      if (typeof bookingId !== 'string' || !bookingId) {
        toast.error('Thiếu thông tin booking để tạo lịch hẹn.');
        return;
      }

      // Fetch booking data to get assigned KTV
      const bookingResult = await timeCreateScheduleStep(
        'getBookingDetailsWithPayment',
        () => getBookingDetailsWithPayment(bookingId),
      );
      if (bookingResult.error || !bookingResult.data) {
        toast.error('Không thể tải thông tin booking: ' + (bookingResult.error || 'Lỗi không xác định'));
        return;
      }

      const booking = bookingResult.data;
      const assignedKtvId = booking.assigned_ktv_id || null;

      // Check for booking conflicts using Decision Engine
      const conflictCheck = await timeCreateScheduleStep(
        'checkBookingConflicts',
        () => withCreateScheduleConflictTimeout(() =>
          checkBookingConflicts({
            bookingId,
            ktvId: assignedKtvId,
            bookingResourceId: typeof bookingResourceId === 'string' && bookingResourceId ? bookingResourceId : null,
            assignedDate: typeof date === 'string' ? date : null,
            assignedTime: createTimeRange.start,
            durationMinutes: 90, // Default duration, TODO: get from package
          })
        ),
      );

      // Handle conflict check result
      if (conflictCheck.decision === 'REJECT') {
        toast.error(conflictCheck.message || 'Không thể tạo lịch hẹn do xung đột');
        if (conflictCheck.context?.conflicts && Array.isArray(conflictCheck.context.conflicts)) {
          const conflicts = conflictCheck.context.conflicts as Array<{
            type: string;
            time: string;
            customer?: string;
            room?: string;
          }>;
          conflicts.forEach((conflict) => {
            if (conflict.type === 'ktv_double_booking') {
              toast.error(`⚠️ KTV đã có lịch lúc ${conflict.time} với khách ${conflict.customer}`);
            } else if (conflict.type === 'room_double_booking') {
              toast.error(`⚠️ Phòng ${conflict.room} đã có lịch lúc ${conflict.time}`);
            }
          });
        }
        return; // Block creation
      }

      if (conflictCheck.decision === 'APPROVE_WITH_WARNING') {
        toast.warning(conflictCheck.message || 'Cảnh báo: Vượt quá số ca khuyến nghị');
        // Continue to creation (soft warning)
      }

      // Proceed with session creation
      const result = await timeCreateScheduleStep(
        'createSessionLog',
        () => createSessionLog({
          booking_id: bookingId,
          assigned_date: typeof date === 'string' ? date : null,
          assigned_time: createTimeRange.start,
          booking_resource_id: typeof bookingResourceId === 'string' && bookingResourceId ? bookingResourceId : null,
          notes: typeof notes === 'string' ? notes : null,
          status: 'scheduled',
        }),
      );

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Đã tạo lịch hẹn mới thành công!');
        await fetchSessions();
        closeCreateModal();
      }
    } catch (err: unknown) {
      console.error('Error creating schedule:', err);
      toast.error('Có lỗi xảy ra khi tạo lịch hẹn');
    } finally {
      setIsUpdating(false);
    }
  };

  return {
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
  };
}
