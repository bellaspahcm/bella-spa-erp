'use client';

import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { calculateBookingPaymentState } from '@/lib/business-rules/payment';
import { getLocalDateString } from '@/lib/utils';
import { createSessionLog, rescheduleSession, updateSessionLog } from '@/modules/booking/actions/session-actions';
import { getBookingDetailsWithPayment, updateBooking } from '@/modules/booking/actions/lifecycle-actions';

import type { BookingModalData } from '../components/BookingDayDetailModal';

type TenantBankInfo = {
  qr_bank_code?: string | null;
  qr_account_number?: string | null;
  qr_account_name?: string | null;
  name?: string;
};

type RevenuePayment = {
  status?: string | null;
  amount?: number | string | null;
};

type TimeRange = {
  start: string;
  end: string;
};

type UseBookingsPageActionsArgs = {
  modalData: BookingModalData | null;
  createTimeRange: TimeRange;
  fetchSessions: () => Promise<void>;
  fetchAllBookings: () => Promise<void>;
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

  const handleOpenQrModal = async (bookingId: string) => {
    try {
      const result = await getBookingDetailsWithPayment(bookingId);
      if (result.error || !result.data) {
        toast.error('Không thể lấy thông tin thanh toán: ' + (result.error || 'Không có dữ liệu'));
        return;
      }

      const booking = result.data;
      const paymentState = calculateBookingPaymentState({
        fullPrice: booking.full_price,
        discountPercent: booking.discount_percent,
        depositAmount: booking.deposit_amount,
        bookingStatus: booking.status,
        revenues: booking.revenue as RevenuePayment[] | null,
      });
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
        await fetchAllBookings();
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
    handleOpenQrModal,
    handleUpdatePlan,
    handleCreateScheduleSubmit,
  };
}
