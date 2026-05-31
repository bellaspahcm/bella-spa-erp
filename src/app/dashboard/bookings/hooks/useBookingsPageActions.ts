'use client';

import { type FormEvent, useState } from 'react';
import { toast } from 'sonner';

import { createClient } from '@/lib/supabase-client';
import { getLocalDateString } from '@/lib/utils';
import { createSessionLog, rescheduleSession, updateSessionLog } from '@/modules/booking/actions/session-actions';
import { getBookingDetailsWithPayment } from '@/modules/booking/actions/lifecycle-actions';

import type { BookingModalData } from '../components/BookingDayDetailModal';

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
      const fullPrice = Number(booking.full_price || 0);
      const discountPercent = Number(booking.discount_percent || 0);
      const discountedPrice = fullPrice * (1 - discountPercent / 100);

      const confirmedRevenue = (booking.revenue || [])
        .filter((payment: RevenuePayment) => payment.status === 'confirmed')
        .reduce((acc: number, payment: RevenuePayment) => acc + Number(payment.amount || 0), 0);

      let debt = discountedPrice - confirmedRevenue;

      if (debt <= 0 && booking.status === 'deposit_pending') {
        debt = Number(booking.deposit_amount || 0);
      }

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

      const supabase = createClient();
      if (modalData.ktvId) {
        const { error } = await supabase
          .from('bookings')
          .update({ assigned_ktv_id: modalData.ktvId })
          .eq('id', modalData.bookingId);

        if (error) {
          throw error;
        }
      }

      const result = await updateSessionLog(modalData.id, {
        assigned_date: modalData.dateString || getLocalDateString(modalData.date),
        assigned_time: modalData.time,
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
    setIsUpdating(true);

    const formData = new FormData(event.currentTarget);

    try {
      const result = await createSessionLog({
        booking_id: formData.get('booking_id'),
        assigned_date: formData.get('date'),
        assigned_time: createTimeRange.start,
        notes: formData.get('notes'),
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
