'use client';

import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { getLocalDateString } from '@/lib/utils';
import {
  getInvoicePrintLogsForBooking,
  recordInvoicePrintLog,
  voidLatestInvoicePrintLog,
  type BookingInvoicePrintLog,
} from '@/modules/booking/actions/invoice-print-actions';
import { createSessionLog, rescheduleSession, updateSessionLog } from '@/modules/booking/actions/session-actions';
import { getBookingDetailsWithPayment, updateBooking } from '@/modules/booking/actions/lifecycle-actions';

import type { BookingModalData } from '../components/BookingDayDetailModal';
import type { BookingThermalInvoiceData } from '../components/BookingThermalInvoicePrint';

type TenantBankInfo = {
  qr_bank_code?: string | null;
  qr_account_number?: string | null;
  qr_account_name?: string | null;
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
    } catch (err) {
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
    } catch (err) {
      console.error('Error opening QR Modal:', err);
      toast.error('Có lỗi xảy ra khi tải dữ liệu thanh toán');
    }
  };

  const handlePrintThermalInvoice = async () => {
    if (!modalData) return;

    try {
      const { booking, paymentState } = await buildPaymentSnapshot(modalData.bookingId);
      const hasActiveInvoice = invoicePrintLogs.some((log) => !log.voided_at);
      let reprintReason: string | null = null;

      if (hasActiveInvoice) {
        const reason = window.prompt('Bill này đã có bản in hiệu lực. Nhập lý do in lại:');
        if (!reason) return;

        reprintReason = reason.trim();
        if (reprintReason.length < 5) {
          toast.error('Vui lòng nhập lý do in lại rõ ràng hơn.');
          return;
        }
      }

      const tenantInfo = booking.tenants || null;
      const bankCode = tenantInfo?.qr_bank_code || '';
      const accountNumber = tenantInfo?.qr_account_number || '';
      const accountName = tenantInfo?.qr_account_name || '';
      const bookingNumber = booking.booking_number || modalData.contractId || modalData.bookingId.slice(0, 8);
      const transferMemo = `BELLA ${bookingNumber}`.replace(/\s+/g, ' ').trim();
      const qrUrl = bankCode && accountNumber && paymentState.remainingDebt > 0
        ? `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${paymentState.remainingDebt}&addInfo=${encodeURIComponent(transferMemo)}&accountName=${encodeURIComponent(accountName)}`
        : null;
      const originalAmount = Number(booking.full_price || 0);
      const discountAmount = Math.max(0, originalAmount - paymentState.priceAfterDiscount);
      const invoiceNumber = `INV-${bookingNumber}`;

      const logResult = await recordInvoicePrintLog({
        bookingId: modalData.bookingId,
        sessionLogId: modalData.id,
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
        brandName: tenantInfo?.name || 'Bella Spa',
        customerName: modalData.customer || 'Khách hàng',
        bookingNumber,
        packageName: modalData.package || booking.package_name || 'Gói dịch vụ',
        ktvName: modalData.ktv || null,
        sessionLabel: modalData.sessionNumber ? `Buổi ${modalData.sessionNumber}` : modalData.sessionCount || null,
        originalAmount,
        discountAmount,
        paidAmount: paymentState.totalPaid,
        amountDue: paymentState.remainingDebt,
        paymentMethod: paymentState.remainingDebt > 0 ? 'VietQR' : 'Khác',
        qrUrl,
        transferMemo,
        isReprint: (logResult.data?.print_count || 1) > 1,
      });

      await fetchInvoicePrintLogs(modalData.bookingId);
      toast.success('Đã chuẩn bị hóa đơn K80. Hộp thoại in sẽ mở ngay.');
    } catch (err) {
      console.error('Error preparing thermal invoice:', err);
      toast.error('Không thể chuẩn bị hóa đơn in.');
    }
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
    } catch (err) {
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

      const result = await createSessionLog({
        booking_id: bookingId,
        assigned_date: typeof date === 'string' ? date : null,
        assigned_time: createTimeRange.start,
        booking_resource_id: typeof bookingResourceId === 'string' && bookingResourceId ? bookingResourceId : null,
        notes: typeof notes === 'string' ? notes : null,
        status: 'scheduled',
      });

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success('Đã tạo lịch hẹn mới thành công!');
        await fetchSessions();
        closeCreateModal();
      }
    } catch {
      toast.error('Có lỗi xảy ra');
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
    fetchInvoicePrintLogs,
    handleOpenQrModal,
    handlePrintThermalInvoice,
    handleVoidLatestInvoice,
    handleUpdatePlan,
    handleCreateScheduleSubmit,
  };
}
