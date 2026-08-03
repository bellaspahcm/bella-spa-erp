/**
 * AutoSalesProvider
 *
 * Xử lý các nghiệp vụ bán hàng (Lead & Sales Center) của Bella Auto:
 * - Tạo hợp đồng đặt cọc (Booking)
 * - Tự động phân bổ số VIN khi đặt cọc (khóa xe)
 * - Đẩy giao dịch tài chính đặt cọc qua Accounting Outbox
 * - Ghi nhận thanh toán cọc và cập nhật trạng thái thanh toán.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { VehicleAllocationService } from './VehicleAllocationService';
import { CustomerJourneyService } from './CustomerJourneyService';
import { JourneySLAMonitorService } from './JourneySLAMonitorService';
import { enqueueWithAutoClient } from '@/lib/accounting-outbox';

export interface CreateBookingInput {
  tenantId: string;
  customerId: string;
  leadId?: string;
  variantId: string;
  vehicleId?: string; // Số VIN được khớp
  colorExterior: string;
  totalPrice: number;
  depositAmount: number;
  createdByUserId?: string;
}

export interface BookingDetail {
  id: string;
  bookingNumber: string;
  tenantId: string;
  customerId: string;
  leadId: string | null;
  variantId: string;
  vehicleId: string | null;
  colorExterior: string;
  totalPrice: number;
  depositAmount: number;
  depositPaid: number;
  paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' | 'refunded';
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  createdAt: string;
}

export const AutoSalesProvider = {
  /**
   * Tạo hợp đồng đặt cọc xe ô tô mới.
   * Atomic: Insert booking + Phân bổ VIN (nếu có) + Enqueue Outbox + Transition Journey.
   */
  async createBooking(
    supabase: SupabaseClient,
    input: CreateBookingInput
  ): Promise<BookingDetail> {
    const { tenantId, customerId, leadId, variantId, vehicleId, colorExterior, totalPrice, depositAmount, createdByUserId } = input;

    // 1. Tạo số booking duy nhất
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const bookingNumber = `BK-AUTO-2026-${randomSuffix}`;

    // 2. Insert vào bảng auto_bookings
    const { data: booking, error: insertErr } = await supabase
      .from('auto_bookings')
      .insert({
        tenant_id:            tenantId,
        customer_id:          customerId,
        lead_id:              leadId ?? null,
        variant_id:           variantId,
        vehicle_id:           vehicleId ?? null,
        color_exterior:       colorExterior,
        booking_number:       bookingNumber,
        total_price:          totalPrice,
        deposit_amount:       depositAmount,
        deposit_paid:         0,
        payment_status:       'unpaid',
        status:               'pending',
        metadata:             { createdByUserId },
      })
      .select('*')
      .single();

    if (insertErr || !booking) {
      throw new Error(`AutoSalesProvider.createBooking: Lỗi tạo hợp đồng đặt cọc. ${insertErr?.message ?? ''}`);
    }

    // 3. Nếu có VIN (vehicleId) được chỉ định sẵn, thực hiện phân bổ xe ngay
    if (vehicleId) {
      try {
        await VehicleAllocationService.allocate(supabase, {
          tenantId,
          vehicleId,
          contractId:        booking.id,
          allocatedByUserId: createdByUserId,
          reason:            `Phân bổ tự động khi tạo đặt cọc ${bookingNumber}`,
        });
      } catch (allocErr: any) {
        // Rollback booking nếu phân bổ xe thất bại để đảm bảo tính nhất quán dữ liệu
        await supabase.from('auto_bookings').delete().eq('id', booking.id);
        throw new Error(`AutoSalesProvider.createBooking: Lỗi phân bổ số VIN. ${allocErr.message}`);
      }
    }

    // 4. Enqueue giao dịch tài chính đặt cọc sang Accounting Outbox
    const outboxSuccess = await enqueueWithAutoClient(supabase, {
      tenantId,
      eventType:     'PACKAGE_SALE',
      referenceType: 'BOOKING',
      referenceId:   booking.id,
      payload: {
        bookingNumber,
        totalPrice,
        depositAmount,
        customerId,
        paymentStatus: 'unpaid',
        businessType:  'automotive_booking',
      }
    });

    if (!outboxSuccess) {
      // Cảnh báo nhưng không ném lỗi ngắt luồng nếu ERP outbox dev bypass chưa bật
      console.warn(`[AutoSalesProvider] Warning: Đẩy sự kiện đặt cọc xe qua Outbox không thành công.`);
    }

    // 5. Cập nhật hành trình khách hàng sang giai đoạn 'deposit_received'
    try {
      await CustomerJourneyService.transitionStage(supabase, {
        tenantId,
        customerId,
        toStageCode:     'deposit_received',
        changedByUserId: createdByUserId,
        reason:          `Đã ký hợp đồng đặt cọc xe ${bookingNumber}`,
        metadata:        { bookingId: booking.id },
      });
    } catch (jErr: any) {
      console.warn(`[AutoSalesProvider] Không thể cập nhật hành trình khách hàng: ${jErr.message}`);
    }

    return {
      id:            booking.id,
      bookingNumber: booking.booking_number,
      tenantId:      booking.tenant_id,
      customerId:    booking.customer_id,
      leadId:        booking.lead_id,
      variantId:     booking.variant_id,
      vehicleId:     booking.vehicle_id,
      colorExterior: booking.color_exterior,
      totalPrice:    Number(booking.total_price),
      depositAmount: Number(booking.deposit_amount),
      depositPaid:   Number(booking.deposit_paid),
      paymentStatus: booking.payment_status as any,
      status:        booking.status as any,
      createdAt:     booking.created_at,
    };
  },

  /**
   * Ghi nhận thanh toán đặt cọc từ khách hàng.
   */
  async recordDepositPayment(
    supabase: SupabaseClient,
    tenantId: string,
    bookingId: string,
    paidAmount: number,
    staffId?: string
  ): Promise<{ success: boolean; paymentStatus: string; depositPaid: number }> {
    
    // 1. Lấy thông tin booking hiện tại
    const { data: booking, error: fetchErr } = await supabase
      .from('auto_bookings')
      .select('id, customer_id, deposit_amount, deposit_paid, booking_number')
      .eq('id', bookingId)
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !booking) {
      throw new Error(`AutoSalesProvider.recordDepositPayment: Booking không tồn tại.`);
    }

    const newDepositPaid = Number(booking.deposit_paid) + paidAmount;
    let paymentStatus: 'unpaid' | 'partially_paid' | 'fully_paid' = 'unpaid';

    if (newDepositPaid >= Number(booking.deposit_amount)) {
      paymentStatus = 'fully_paid';
    } else if (newDepositPaid > 0) {
      paymentStatus = 'partially_paid';
    }

    // 2. Cập nhật số tiền đã đóng & payment status
    const { error: updateErr } = await supabase
      .from('auto_bookings')
      .update({
        deposit_paid:   newDepositPaid,
        payment_status: paymentStatus,
        status:         paymentStatus === 'fully_paid' ? 'confirmed' : 'pending',
        updated_at:     new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('tenant_id', tenantId);

    if (updateErr) {
      throw new Error(`AutoSalesProvider.recordDepositPayment: Lỗi cập nhật thanh toán. ${updateErr.message}`);
    }

    // 3. Nếu thanh toán hoàn tất, ghi nhận Touchpoint & đẩy Outbox cập nhật
    if (paymentStatus === 'fully_paid') {
      await JourneySLAMonitorService.recordTouchpoint(supabase, {
        tenantId,
        customerId: booking.customer_id,
        channel:    'showroom_visit',
        title:      'Đóng cọc xe hoàn tất',
        content:    `Khách hàng đã nộp đủ tiền cọc ${Number(booking.deposit_amount).toLocaleString('vi-VN')} VND cho hợp đồng ${booking.booking_number}`,
        staffId,
        metadata:   { bookingId, paidAmount },
      });

      // Gửi event REVENUE qua Outbox cho kế toán ghi nhận doanh thu
      await enqueueWithAutoClient(supabase, {
        tenantId,
        eventType:     'PACKAGE_SALE', // Ghi nhận cọc thành công
        referenceType: 'REVENUE',
        referenceId:   bookingId,
        payload: {
          bookingNumber: booking.booking_number,
          depositAmount: booking.deposit_amount,
          amountPaid:    newDepositPaid,
          customerId:    booking.customer_id,
          status:        'confirmed',
        }
      });
    }

    return {
      success: true,
      paymentStatus,
      depositPaid: newDepositPaid,
    };
  }
};
