import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { findMissingRequiredFields, inferBusinessEventType } from '@/services/accounting/template-rules';
import type { Database } from '@/types/database.types';
import { FINANCE_CONSTANTS } from '@/constants/finance';

function resolveAccountingReviewStatus(
  businessEventType: ReturnType<typeof inferBusinessEventType>,
  payload: Record<string, unknown>
) {
  if (!businessEventType) return 'NEEDS_REVIEW';
  return findMissingRequiredFields(businessEventType, payload).length > 0
    ? 'NEEDS_REVIEW'
    : 'UNREVIEWED';
}

/**
 * Logic dùng chung để chốt ca làm việc, xử lý trừ kho, tính lương KTV và rollback toàn diện khi lỗi
 */
export async function processSessionCompletion(
  supabase: any,
  sessionId: string,
  bookingId: string,
  tenantId: any,
  ktvId: any,
  today: string,
  packageId: any,
  existingLog: any,
  currentUser: any
) {
  try {
    await assertOpenAccountingPeriod(supabase, {
      tenantId,
      date: today,
      context: 'Complete booking session',
    });
  } catch (periodErr) {
    return {
      error: periodErr instanceof Error
        ? periodErr.message
        : 'Accounting period is closed or unavailable',
    };
  }

  // 1. Tự động trừ kho vật tư tiêu hao nếu có định mức
  let isInventoryConsumed = false;
  if (packageId) {
    const { autoConsumeForSession } = await import('@/services/inventory-actions');
    const consumeResult = await autoConsumeForSession(packageId, sessionId);
    
    // Chặn đứng (halt) quy trình nếu kho không đủ nguyên liệu
    if (consumeResult && consumeResult.success === false) {
      return { error: consumeResult.error || 'Kho không đủ nguyên liệu để thực hiện ca dịch vụ này.' };
    }
    isInventoryConsumed = consumeResult && consumeResult.success && !consumeResult.bypassed;
  }

  // 2. Đếm lại số buổi hoàn thành thực tế
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', bookingId)
    .eq('status', 'completed');

  if (countError) {
    if (isInventoryConsumed) {
      const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
      await rollbackInventoryConsumption(sessionId);
    }
    return { error: 'Lỗi đếm số buổi đã hoàn thành: ' + countError.message };
  }

  const { data: currentBooking } = await supabase
    .from('bookings')
    .select('total_sessions, completed_sessions, status, package_name, ktv_commission, assigned_ktv_id, tenant_id, full_price, discount_percent')
    .eq('id', bookingId)
    .single();

  const bUpdates: Database['public']['Tables']['bookings']['Update'] = {
    completed_sessions: count || 0,
    last_updated_date: today,
    updated_at: new Date().toISOString()
  };

  if (count && count > 0 && (currentBooking?.status === 'deposit_pending' || currentBooking?.status === 'booked' || currentBooking?.status === 'deposit')) {
    bUpdates.status = 'in_progress';
  }

  if (currentBooking?.total_sessions && count && count >= currentBooking.total_sessions) {
    bUpdates.status = 'completed';
  }

  const { error: bookingUpdateErr } = await supabase.from('bookings').update(bUpdates).eq('id', bookingId);
  if (bookingUpdateErr) {
    console.error('Error updating booking progress:', bookingUpdateErr);
    if (isInventoryConsumed) {
      const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
      await rollbackInventoryConsumption(sessionId);
    }
    return { error: 'Lỗi cập nhật tiến trình booking: ' + bookingUpdateErr.message };
  }

  // 3. Ghi nhận doanh thu dịch vụ lẻ
  let isRevenueCreated = false;
  let createdRevenueId: string | null = null;
  if (currentBooking?.package_name?.toLowerCase().includes('lẻ')) {
    const businessEventType = inferBusinessEventType({
      sourceTable: 'revenue',
      revenueType: 'package_payment',
    });
    const accountingPayload = {
      amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
      payment_method: 'bank_transfer',
      booking_id: bookingId,
      reason: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
    };

    const { data: createdRevenue, error: revErr } = await supabase.from('revenue').insert([{
      booking_id: bookingId,
      amount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
      revenue_type: 'package_payment',
      payment_method: 'bank_transfer',
      received_date: today,
      status: 'confirmed',
      notes: `Tự động: Thu phí dịch vụ lẻ - ${currentBooking.package_name}`,
      tenant_id: tenantId,
      business_event_type: businessEventType,
      accounting_review_status: resolveAccountingReviewStatus(businessEventType, accountingPayload),
      accounting_metadata: accountingPayload
    }]).select('id').single();

    if (revErr) {
      console.error('Error auto-creating revenue:', revErr);
      // Rollback booking
      await supabase.from('bookings').update({
        completed_sessions: currentBooking?.completed_sessions || 0,
        status: currentBooking?.status || 'booked'
      }).eq('id', bookingId);
      if (isInventoryConsumed) {
        const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
        await rollbackInventoryConsumption(sessionId);
      }
      return { error: 'Không thể ghi nhận doanh thu tự động cho gói lẻ: ' + revErr.message };
    }
    isRevenueCreated = true;
    createdRevenueId = createdRevenue?.id || null;

    if (createdRevenueId) {
      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      const outboxEnqueued = await enqueueWithAutoClient(
        supabase,
        {
          tenantId,
          eventType: 'PACKAGE_SALE',
          referenceType: 'REVENUE',
          referenceId: createdRevenueId,
          payload: {
            totalAmount: FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE,
            vatRate: 0,
            description: accountingPayload.reason,
            branchId: tenantId,
          },
        },
        '[processSessionCompletion:single-session-revenue]'
      );

      if (!outboxEnqueued) {
        await supabase
          .from('revenue')
          .delete()
          .eq('id', createdRevenueId);

        await supabase.from('bookings').update({
          completed_sessions: currentBooking?.completed_sessions || 0,
          status: currentBooking?.status || 'booked'
        }).eq('id', bookingId);

        if (isInventoryConsumed) {
          const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
          await rollbackInventoryConsumption(sessionId);
        }

        return { error: 'Không thể ghi nhận hàng đợi kế toán cho doanh thu gói lẻ. Đã hoàn tác ca làm.' };
      }
    }
  }

  // 4. Cộng lương KTV vào salary_records
  if (ktvId && tenantId) {
    const monthYear = `${today.substring(0, 7)}-01`;
    let salaryError = null;

    try {
      const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
      await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId);
    } catch (e: any) {
      salaryError = e;
    }

    if (salaryError) {
      console.error('[processSessionCompletion] Error updating salary record, rolling back...:', salaryError);
      
      // Rollback revenue nếu có tạo
      if (isRevenueCreated) {
        await supabase
          .from('revenue')
          .delete()
          .eq('booking_id', bookingId)
          .eq('amount', FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE)
          .eq('notes', `Tự động: Thu phí dịch vụ lẻ - ${currentBooking?.package_name}`);
      }

      // Rollback booking
      await supabase.from('bookings').update({
        completed_sessions: currentBooking?.completed_sessions || 0,
        status: currentBooking?.status || 'booked'
      }).eq('id', bookingId);

      // Rollback kho
      if (isInventoryConsumed) {
        const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
        await rollbackInventoryConsumption(sessionId);
      }

      return { error: 'Không thể ghi nhận lương cho KTV. Đã hoàn tác ca làm: ' + salaryError.message };
    }
  }

  // 5. Tạo placeholder review cho khách hàng
  try {
    if (currentBooking?.assigned_ktv_id) {
      const { data: existingReview } = await supabase
        .from('session_reviews')
        .select('id')
        .eq('session_log_id', sessionId)
        .maybeSingle();

      if (!existingReview) {
        await supabase
          .from('session_reviews')
          .insert([{
            session_log_id: sessionId,
            reviewer_id: currentBooking.assigned_ktv_id, // Gán tạm thời reviewer chính làm placeholder
            ktv_id: ktvId,
            rating: 5,
            note: 'Chờ khách hàng đánh giá',
            status: 'pending_review',
            tenant_id: tenantId
          }]);
      }
    }
  } catch (reviewErr) {
    console.warn('Failed to auto-create review placeholder:', reviewErr);
  }

  // 6. Ghi nhận vào hàng đợi Accounting Outbox cho sự kiện SESSION_DONE
  if (sessionId && tenantId) {
    try {
      const fullPrice = Number(currentBooking?.full_price || 0);
      const discountPercent = Number(currentBooking?.discount_percent || 0);
      const targetPrice = fullPrice * (1 - discountPercent / 100);
      const totalSessions = Number(currentBooking?.total_sessions || 1);
      const earnedRevenueAmount = totalSessions > 0 ? targetPrice / totalSessions : 0;
      const commission = Number(currentBooking?.ktv_commission) || 0;

      const { enqueueWithAutoClient } = await import('@/lib/accounting-outbox');
      await enqueueWithAutoClient(
        supabase,
        {
          tenantId,
          eventType: 'SESSION_DONE',
          referenceType: 'SESSION_LOG',
          referenceId: sessionId,
          payload: {
            earnedRevenueAmount,
            commissionAmount: commission,
            ktvId: ktvId || currentBooking?.assigned_ktv_id || null,
            branchId: tenantId,
            description: `Hoàn thành buổi ${existingLog?.session_number || '--'}/${totalSessions} - ${currentBooking?.package_name || 'Gói dịch vụ'}`,
          },
        },
        '[processSessionCompletion]'
      );
    } catch (outboxError: any) {
      console.error('[processSessionCompletion] Error enqueuing accounting outbox event, rolling back...', outboxError);
      
      // Rollback KTV salary record
      if (ktvId && tenantId) {
        const monthYear = `${today.substring(0, 7)}-01`;
        try {
          const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
          await recalculateAndSaveSalaryRecord(supabase, ktvId, monthYear, tenantId);
        } catch (e) {
          console.error('[processSessionCompletion] Error rolling back KTV salary record:', e);
        }
      }

      // Rollback revenue nếu có tạo
      if (isRevenueCreated) {
        await supabase
          .from('revenue')
          .delete()
          .eq('booking_id', bookingId)
          .eq('amount', FINANCE_CONSTANTS.SINGLE_SESSION_REVENUE)
          .eq('notes', `Tự động: Thu phí dịch vụ lẻ - ${currentBooking?.package_name}`);
      }

      // Rollback booking
      await supabase.from('bookings').update({
        completed_sessions: currentBooking?.completed_sessions || 0,
        status: currentBooking?.status || 'booked'
      }).eq('id', bookingId);

      // Rollback kho
      if (isInventoryConsumed) {
        const { rollbackInventoryConsumption } = await import('@/services/inventory-actions');
        await rollbackInventoryConsumption(sessionId);
      }

      return { error: 'Không thể ghi nhận hàng đợi kế toán. Đã hoàn tác ca làm: ' + outboxError.message };
    }
  }

  return { success: true };
}