'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './user-actions';
import { getKTVTodayAttendance } from './attendance-actions';
import type { CurrentUser } from '@/types/domain';
import { resolvePackageName, getLocalDateString } from '@bella/shared';;
import type { Database } from '@/types/database.types';
import { processSessionCompletion } from '@/core/services/order/session-completion-engine';
import { getTenantSettings } from './tenant-actions';
import { getDefaultTenantModuleKey } from '@/lib/business-rules/tenant-modules';
import { getKtvSalaryForConfirmation } from '@/modules/hr-salary/actions/base-salary-actions';

type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update'];

interface SessionLogWithBooking {
  id: string;
  booking_id: string | null;
  session_number: number;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  completed_by_ktv_id: string | null;
  notes: string | null;
  tenant_id: string | null;
  bookings: {
    id: string;
    booking_number: string | null;
    package_name: string | null;
    customer_id: string | null;
    total_sessions: number | null;
    completed_sessions: number | null;
    status?: string | null;
    packages: {
      name: string;
      duration: number | null;
    } | null;
    customers: {
      name_mother: string | null;
      name_baby: string | null;
      phone: string | null;
      address: string | null;
    } | null;
  } | null;
}

interface InnerBooking {
  id: string;
  booking_number: string | null;
  package_name: string | null;
  start_date: string | null;
  total_sessions: number | null;
  completed_sessions: number | null;
  preferred_time: string | null;
  customer_id: string | null;
  assigned_ktv_id: string | null;
  status?: string | null;
  package_id?: string | null;
  packages: {
    name: string;
  } | null;
  customers: {
    name_mother: string | null;
    name_baby: string | null;
    phone: string | null;
    address: string | null;
  } | null;
}

interface SessionLogWithInnerBooking {
  id: string;
  booking_id: string;
  session_number: number;
  status: string | null;
  start_time: string | null;
  end_time: string | null;
  completed_by_ktv_id: string | null;
  notes: string | null;
  tenant_id: string | null;
  assigned_date?: string | null;
  assigned_time?: string | null;
  bookings: InnerBooking | InnerBooking[] | null;
}

interface ProcessedSession extends Omit<SessionLogWithInnerBooking, 'bookings'> {
  assigned_date: string;
  assigned_time: string;
  is_reassigned: boolean;
  bookings: (Omit<InnerBooking, 'packages'> & { package_name: string }) | null;
}

function getErrorMessage(error: unknown, fallback = 'Loi he thong') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

interface SessionLogCommission {
  id: string;
  bookings: {
    ktv_commission: number | null;
  } | null;
}

interface NotificationRow {
  id: string;
  userId: string;
  title: string | null;
  message: string | null;
  type: string | null;
  createdAt: string | null;
  isRead?: boolean | null;
}

/**
 * Lấy các buổi chăm sóc đang thực hiện của KTV hiện tại
 */
export async function getKTVActiveSessions(currentUser?: CurrentUser) {
  const perfStart = Date.now();
  const supabase = await createClient();
  
  const userStart = Date.now();
  const user = currentUser || await getCurrentUser();
  console.log(`[getKTVActiveSessions] getCurrentUser took ${Date.now() - userStart}ms`);
  
  if (!user || user.role !== 'ktv') return [];

  const queryStart = Date.now();
  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings (
        id,
        booking_number,
        package_name,
        customer_id,
        total_sessions,
        completed_sessions,
        packages (
          name,
          duration
        ),
        customers (
          name_mother,
          name_baby,
          phone,
          address
        )
      )
    `)
    .eq('completed_by_ktv_id', user.id)
    .eq('status', 'in_progress')
    .order('start_time', { ascending: false });
  console.log(`[getKTVActiveSessions] DB query took ${Date.now() - queryStart}ms`);

  if (error) {
    throw new Error(`Failed to fetch KTV active sessions: ${error.message}`);
  }

  const processingStart = Date.now();
  const result = (data as unknown as SessionLogWithBooking[] || [])
    .filter((s) => {
      if (!s.bookings) return true;
      const bookingTotal = s.bookings.total_sessions || 0;
      const isBookingCompleted = s.bookings.status === 'completed';
      return s.session_number <= bookingTotal && !isBookingCompleted;
    })
    .map((s) => ({
      ...s,
      bookings: s.bookings ? {
        ...s.bookings,
        package_name: resolvePackageName(s.bookings)
      } : null
    }));
  console.log(`[getKTVActiveSessions] Processing took ${Date.now() - processingStart}ms`);
  console.log(`[getKTVActiveSessions] TOTAL TIME: ${Date.now() - perfStart}ms`);
  
  return result;
}

/**
 * Lấy các buổi chăm sóc được phân công hôm nay
 */
export async function getKTVUpcomingSessions(currentUser?: CurrentUser) {
  const perfStart = Date.now();
  const supabase = await createClient();
  
  const userStart = Date.now();
  const user = currentUser || await getCurrentUser();
  console.log(`[getKTVUpcomingSessions] getCurrentUser took ${Date.now() - userStart}ms`);
  
  if (!user || user.role !== 'ktv') return [];

  // Get current date in Vietnam timezone (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  // 1. Fetch sessions originally assigned to this KTV
  const query1Start = Date.now();
  const { data: originalData, error: originalError } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
        id,
        booking_number,
        package_name,
        start_date,
        total_sessions,
        completed_sessions,
        preferred_time,
        customer_id,
        assigned_ktv_id,
        packages (
          name
        ),
        customers (
          name_mother,
          name_baby,
          phone,
          address
        )
      )
    `)
    .eq('bookings.assigned_ktv_id', user.id);
  console.log(`[getKTVUpcomingSessions] Original sessions query took ${Date.now() - query1Start}ms`);

  // 2. Fetch sessions explicitly reassigned to this KTV
  const query2Start = Date.now();
  const { data: reassignedData, error: reassignedError } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
        id,
        booking_number,
        package_name,
        start_date,
        total_sessions,
        completed_sessions,
        preferred_time,
        customer_id,
        assigned_ktv_id,
        packages (
          name
        ),
        customers (
          name_mother,
          name_baby,
          phone,
          address
        )
      )
    `)
    .eq('completed_by_ktv_id', user.id)
    .eq('status', 'scheduled');
  console.log(`[getKTVUpcomingSessions] Reassigned sessions query took ${Date.now() - query2Start}ms`);

  if (originalError) {
    throw new Error(`Failed to fetch originally assigned KTV sessions: ${originalError.message}`);
  }

  if (reassignedError) {
    throw new Error(`Failed to fetch reassigned KTV sessions: ${reassignedError.message}`);
  }

  const mergeStart = Date.now();
  // Merge the two arrays and deduplicate by session log ID
  const mergedMap = new Map<string, SessionLogWithInnerBooking>();
  if (originalData) (originalData as unknown as SessionLogWithInnerBooking[]).forEach((s) => mergedMap.set(s.id, s));
  if (reassignedData) (reassignedData as unknown as SessionLogWithInnerBooking[]).forEach((s) => mergedMap.set(s.id, s));
  const sessions = Array.from(mergedMap.values());
  const bookingIds = [...new Set(sessions?.map((s) => s.booking_id) || [])];
  console.log(`[getKTVUpcomingSessions] Merge & dedup took ${Date.now() - mergeStart}ms`);

  if (bookingIds.length === 0) {
    console.log(`[getKTVUpcomingSessions] TOTAL TIME: ${Date.now() - perfStart}ms (no bookings)`);
    return [];
  }

  const query3Start = Date.now();
  const { data: allSessionsForBookings, error: allSessionsError } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
        id,
        booking_number,
        package_name,
        status,
        completed_sessions,
        total_sessions,
        assigned_ktv_id,
        package_id,
        start_date,
        preferred_time,
        packages (
          name
        ),
        customers (
          name_mother,
          name_baby,
          phone,
          address
        )
      )
    `)
    .in('booking_id', bookingIds)
    .order('session_number', { ascending: true });
  console.log(`[getKTVUpcomingSessions] All sessions for bookings query took ${Date.now() - query3Start}ms`);

  if (allSessionsError) {
    throw new Error(`Failed to fetch all sessions for KTV bookings: ${allSessionsError.message}`);
  }

  const processingStart = Date.now();
  const sessionsByBooking: Record<string, SessionLogWithInnerBooking[]> = {};
  const typedSessions = allSessionsForBookings as unknown as SessionLogWithInnerBooking[];
  typedSessions?.forEach((s) => {
    const booking = Array.isArray(s.bookings) ? s.bookings[0] : s.bookings;
    if (!booking) return;

    // KTV can see sessions where they are the primary assigned_ktv_id OR they are specifically assigned as completed_by_ktv_id
    if (booking.assigned_ktv_id !== user.id && s.completed_by_ktv_id !== user.id) return;
    
    // If they are primary KTV, but someone else completed it, they don't see it
    if (booking.assigned_ktv_id === user.id && s.completed_by_ktv_id && s.completed_by_ktv_id !== user.id) return;

    if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
    s.bookings = booking;
    sessionsByBooking[s.booking_id].push(s);
  });

  const processedSessionsList: ProcessedSession[] = [];

  for (const [, bookingSessions] of Object.entries(sessionsByBooking)) {
    // Sort by session number
    bookingSessions.sort((a, b) => a.session_number - b.session_number);

    let lastKnownDate: string | null = null;
    let lastKnownSessionNum = 0;

    for (const s of bookingSessions) {
      const booking = (Array.isArray(s.bookings) ? s.bookings[0] : s.bookings) as InnerBooking | null;
      let finalDate = s.assigned_date;

      if (!finalDate) {
        if (lastKnownDate) {
          const parts: number[] = lastKnownDate.split('-').map(Number);
          const yVal: number = parts[0];
          const mVal: number = parts[1];
          const dVal: number = parts[2];
          const calcDate: Date = new Date(yVal, mVal - 1, dVal);
          calcDate.setDate(calcDate.getDate() + (s.session_number - lastKnownSessionNum));
          finalDate = `${calcDate.getFullYear()}-${String(calcDate.getMonth() + 1).padStart(2, '0')}-${String(calcDate.getDate()).padStart(2, '0')}`;
        } else if (booking?.start_date) {
          const parts: number[] = booking.start_date.split('-').map(Number);
          const yVal: number = parts[0];
          const mVal: number = parts[1];
          const dVal: number = parts[2];
          const calcDate: Date = new Date(yVal, mVal - 1, dVal);
          calcDate.setDate(calcDate.getDate() + (s.session_number - 1));
          finalDate = `${calcDate.getFullYear()}-${String(calcDate.getMonth() + 1).padStart(2, '0')}-${String(calcDate.getDate()).padStart(2, '0')}`;
        }
      }

      if (finalDate) {
        lastKnownDate = finalDate;
        lastKnownSessionNum = s.session_number;
      }

      // We only care about scheduled sessions for the upcoming list
      const bookingTotal = booking?.total_sessions || 0;
      const isBookingCompleted = booking?.status === 'completed';

      if (s.status === 'scheduled' && finalDate === today && s.session_number <= bookingTotal && !isBookingCompleted) {
        processedSessionsList.push({
          ...s,
          assigned_date: finalDate,
          assigned_time: s.assigned_time || booking?.preferred_time || '09:00 - 11:00',
          is_reassigned: booking?.assigned_ktv_id !== user.id,
          bookings: booking ? {
            ...booking,
            package_name: resolvePackageName(booking)
          } : null
        });
      }
    }
  }

  // Sort by assigned_time
  processedSessionsList.sort((a, b) => {
    const timeA = a.assigned_time || '';
    const timeB = b.assigned_time || '';
    return timeA.localeCompare(timeB);
  });
  console.log(`[getKTVUpcomingSessions] Processing took ${Date.now() - processingStart}ms`);
  console.log(`[getKTVUpcomingSessions] TOTAL TIME: ${Date.now() - perfStart}ms`);

  return processedSessionsList;
}

/**
 * Bắt đầu một buổi chăm sóc (Check-in)
 */
export async function startSession(sessionId: string, lat?: number, lon?: number) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Unauthorized' };

  // 1. Lấy thông tin session để tìm booking_id và tọa độ của khách hàng
  const { data: session, error: sessionFetchError } = await supabase
    .from('session_logs')
    .select('booking_id, session_number, status, start_time, completed_by_ktv_id, checkin_lat, checkin_lon, bookings(customer_id, total_sessions, completed_sessions, status, is_in_care, customers(latitude, longitude))')
    .eq('id', sessionId)
    .single();

  if (sessionFetchError) return { success: false, error: sessionFetchError.message };
  if (!session) return { success: false, error: 'Session not found' };

  // Guard: check that the booking is not completed and the session number is within the booking's total_sessions
  const bookingData = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
  const booking = bookingData as { customer_id: string; status?: string; is_in_care?: boolean | null; completed_sessions?: number; total_sessions?: number; customers?: { latitude: number | null; longitude: number | null } | { latitude: number | null; longitude: number | null }[] } | null;
  if (booking) {
    if (booking.status === 'completed' || (booking.completed_sessions || 0) >= (booking.total_sessions || 0)) {
      return { success: false, error: 'Liệu trình này đã hoàn thành toàn bộ số buổi. Không thể bắt đầu buổi mới.' };
    }
    if (session.session_number > (booking.total_sessions || 0)) {
      return { success: false, error: 'Buổi này vượt quá tổng số buổi của liệu trình.' };
    }
  }

  // 2. Cập nhật session log
  const updatePayload = {
    status: 'in_progress' as const,
    start_time: new Date().toISOString(),
    completed_by_ktv_id: user.id
  };

  const { error } = await supabase
    .from('session_logs')
    .update(updatePayload)
    .eq('id', sessionId);

  if (error) {
    return { success: false, error: 'Khong the bat dau buoi cham soc: ' + error.message };
  }

  const rollbackStartedSession = async (reason: string) => {
    const { error: rollbackError } = await supabase
      .from('session_logs')
      .update({
        status: session.status,
        start_time: session.start_time,
        completed_by_ktv_id: session.completed_by_ktv_id,
        checkin_lat: session.checkin_lat,
        checkin_lon: session.checkin_lon
      })
      .eq('id', sessionId);

    if (rollbackError) {
      return {
        success: false,
        error: `${reason}; failed to roll back session start: ${rollbackError.message}`
      };
    }

    return { success: false, error: reason };
  };

  // 3. Cập nhật booking: set is_in_care = true và status = in_progress
  const { error: bookingUpdateError } = await supabase
    .from('bookings')
    .update({ 
      is_in_care: true,
      status: 'in_progress'
    })
    .eq('id', session.booking_id);

  if (bookingUpdateError) {
    return rollbackStartedSession(`Failed to update booking after session start: ${bookingUpdateError.message}`);
  }

  const warnings: string[] = [];

  if (lat !== undefined && lon !== undefined) {
    const { error: sessionGpsError } = await supabase
      .from('session_logs')
      .update({ checkin_lat: lat, checkin_lon: lon })
      .eq('id', sessionId);

    if (sessionGpsError) {
      warnings.push(`check-in GPS was not saved: ${sessionGpsError.message}`);
    }
  }

  // 4. Nếu KTV check-in có tọa độ GPS và khách hàng chưa có tọa độ chuẩn trong DB -> tự động gán làm tọa độ chuẩn
  if (lat !== undefined && lon !== undefined && booking?.customer_id) {
    const customer = Array.isArray(booking.customers) ? booking.customers[0] : booking.customers;
    if (!customer || customer.latitude === null || customer.longitude === null) {
      const { error: customerGpsError } = await supabase
        .from('customers')
        .update({
          latitude: lat,
          longitude: lon
        })
        .eq('id', booking.customer_id);
      
      if (customerGpsError) {
        warnings.push(`customer GPS coordinates were not saved: ${customerGpsError.message}`);
      } else {
        console.log(`[startSession] Automatically assigned coordinates (${lat}, ${lon}) for customer ${booking.customer_id} based on first KTV check-in.`);
      }
    }
  }

  revalidatePath('/ktv/dashboard');
  if (warnings.length > 0) {
    return { success: true, warning: `Session started, but ${warnings.join('; ')}` };
  }
  return { success: true };
}

/**
 * Hoàn thành một buổi chăm sóc (Check-out)
 */
export async function completeKTVSession(sessionId: string, notes: string = '', ktvCheckoutNote: string = '', lat?: number, lon?: number) {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Unauthorized' };

  // 1. Lấy thông tin session để tìm booking_id, start_time và package_id
  const { data: session, error: sessionFetchError } = await supabase
    .from('session_logs')
    .select(`
      booking_id,
      session_number,
      tenant_id,
      start_time,
      status,
      end_time,
      completed_date,
      completed_by_ktv_id,
      notes,
      standard_duration,
      actual_duration,
      time_deviation,
      duration_warning_type,
      ktv_checkout_note,
      checkout_lat,
      checkout_lon,
      bookings (
        package_id,
        status,
        packages (
          duration
        )
      )
    `)
    .eq('id', sessionId)
    .single();

  if (sessionFetchError) return { success: false, error: sessionFetchError.message };
  if (!session) return { success: false, error: 'Session not found' };
  if (!session.booking_id) return { success: false, error: 'Session is missing booking reference' };
  if (session.status === 'completed') return { success: false, error: 'Session already completed' };

  const bookingsData = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
  if (bookingsData?.status === 'cancelled') {
    return { success: false, error: 'Khong the hoan thanh buoi cham soc cho booking da huy.' };
  }

  // Tính toán thời lượng quy định và thực tế
  let standardDuration = 60; // Mặc định là 60 phút
  const durationStr = bookingsData?.packages?.duration;
  if (durationStr) {
    const match = durationStr.match(/(\d+)/);
    if (match) {
      standardDuration = parseInt(match[1], 10);
    }
  }

  const startTime = session.start_time ? new Date(session.start_time) : null;
  const endTime = new Date();
  let actualDuration = 0;
  let timeDeviation = 0;
  let durationWarningType = 'normal';

  if (startTime) {
    const diffMs = endTime.getTime() - startTime.getTime();
    actualDuration = Math.round(diffMs / 60000); // Đổi từ ms sang phút
    timeDeviation = actualDuration - standardDuration;
    
    if (timeDeviation < 0) {
      // Làm thiếu giờ
      if (Math.abs(timeDeviation) > 5) {
        durationWarningType = 'under_time';
      }
    } else if (timeDeviation > 0) {
      // Làm lố giờ
      durationWarningType = 'over_time';
    }
  }

  // 2. Cập nhật session log
  const completedDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(endTime);

  const sessionUpdatePayload: SessionLogUpdate = {
    status: 'completed',
    end_time: endTime.toISOString(),
    completed_date: completedDate,
    completed_by_ktv_id: user.id,
    notes: notes,
    standard_duration: standardDuration,
    actual_duration: actualDuration,
    time_deviation: timeDeviation,
    duration_warning_type: durationWarningType,
    ktv_checkout_note: ktvCheckoutNote
  };

  const { error: sessionError } = await supabase
    .from('session_logs')
    .update(sessionUpdatePayload)
    .eq('id', sessionId);

  if (sessionError) return { success: false, error: 'Failed to complete session: ' + sessionError.message };

  const checkoutWarnings: string[] = [];
  const tenantId = user.tenant_id || session.tenant_id;
  const completionResult = await processSessionCompletion(
    supabase,
    sessionId,
    session.booking_id,
    tenantId,
    user.id,
    completedDate,
    bookingsData?.package_id,
    session,
    user
  );

  if (completionResult.error) {
    const rollbackFailures: string[] = [];
    const { error: rollbackError } = await supabase
      .from('session_logs')
      .update({
        status: session.status,
        end_time: session.end_time,
        completed_date: session.completed_date,
        completed_by_ktv_id: session.completed_by_ktv_id,
        notes: session.notes,
        standard_duration: session.standard_duration,
        actual_duration: session.actual_duration,
        time_deviation: session.time_deviation,
        duration_warning_type: session.duration_warning_type,
        ktv_checkout_note: session.ktv_checkout_note,
        checkout_lat: session.checkout_lat,
        checkout_lon: session.checkout_lon
      })
      .eq('id', sessionId);

    if (rollbackError) {
      rollbackFailures.push(`failed to roll back completed session: ${rollbackError.message}`);
    }

    if (tenantId) {
      try {
        const { recalculateAndSaveSalaryRecord } = await import('@/modules/hr-salary/actions/admin-salary-actions');
        const monthYear = `${completedDate.substring(0, 7)}-01`;
        await recalculateAndSaveSalaryRecord(supabase, user.id, monthYear, tenantId);
      } catch (salaryRollbackError) {
        rollbackFailures.push(`rollback salary failed: ${getErrorMessage(salaryRollbackError)}`);
      }
    }

    return {
      success: false,
      error: rollbackFailures.length > 0 ? `${completionResult.error}; ${rollbackFailures.join('; ')}` : completionResult.error,
    };
  }

  if (lat !== undefined && lon !== undefined) {
    const { error: checkoutGpsError } = await supabase
      .from('session_logs')
      .update({ checkout_lat: lat, checkout_lon: lon })
      .eq('id', sessionId);

    if (checkoutGpsError) {
      checkoutWarnings.push(`checkout GPS was not saved: ${checkoutGpsError.message}`);
    }
  }

  revalidatePath('/ktv/dashboard');
  revalidatePath('/dashboard/bookings');
  if (checkoutWarnings.length > 0) {
    return { success: true, warning: `Session completed, but ${checkoutWarnings.join('; ')}` };
  }
  return { success: true };
}

/**
 * Lấy thu nhập hoa hồng của KTV trong tháng
 */
export async function getKTVEarnings(month: string, currentUser?: CurrentUser) {
  const supabase = await createClient();
  const user = currentUser || await getCurrentUser();
  if (!user || user.role !== 'ktv') return { total: 0, sessions: 0 };

  const startOfMonth = `${month}-01`;
  const nextMonth = getLocalDateString(new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)));

  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      id,
      bookings (
        ktv_commission
      )
    `)
    .eq('completed_by_ktv_id', user.id)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonth)
    .lt('completed_date', nextMonth);

  if (error) {
    throw new Error(`Failed to fetch KTV earnings: ${error.message}`);
  }

  const total = (data as unknown as SessionLogCommission[] || []).reduce((acc: number, s) => acc + (Number(s.bookings?.ktv_commission) || 0), 0);
  
  return {
    total,
    sessions: data.length
  };
}

export async function getKTVLeaderboard(month: string, currentUser?: CurrentUser) {
  const supabase = await createClient();
  const user = currentUser || await getCurrentUser();
  const tenantId = user?.tenant_id;
  if (!tenantId) return [];

  const { data, error } = await supabase.rpc('get_ktv_leaderboard', {
    p_tenant_id: tenantId,
    p_month: `${month}-01`
  });

  if (error) {
    throw new Error(`get_ktv_leaderboard failed: ${error.message}`);
  }

  return data || [];
}

/**
 * Lấy danh sách thông báo của KTV hiện tại (Đã lọc bỏ thông tin đánh giá/sao để bảo mật)
 */
export async function getKTVNotifications(currentUser?: CurrentUser) {
  const supabase = await createClient();
  const user = currentUser || await getCurrentUser();
  if (!user) return [];

  // Truy vấn từ DB: Loại bỏ trực tiếp các thông báo có type là 'review' để bảo mật
  const { data, error } = await supabase
    .from('Notification')
    .select('*')
    .eq('userId', user.id)
    .neq('type', 'review')
    .order('createdAt', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch KTV notifications: ${error.message}`);
  }

  if (!data) return [];

  // Lọc thêm một lớp tại Application logic để phòng ngừa các thông báo chứa từ khoá nhạy cảm liên quan đến đánh giá sao
  const secureNotifications = (data as unknown as NotificationRow[]).filter((notif) => {
    const titleLower = (notif.title || '').toLowerCase();
    const messageLower = (notif.message || '').toLowerCase();
    const isReview = titleLower.includes('đánh giá') || 
                     titleLower.includes('review') || 
                     titleLower.includes('sao') ||
                     messageLower.includes('đánh giá') ||
                     messageLower.includes('sao');
    return !isReview;
  });

  return secureNotifications;
}

/**
 * Đánh dấu một thông báo là đã đọc
 */
export async function markNotificationAsRead(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('Notification')
    .update({ isRead: true })
    .eq('id', id);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Không thể cập nhật thông báo');
  }

  return { success: true };
}

/**
 * Batches all dashboard calls into one request to drastically improve KTV UX
 */
export async function getKTVDashboardData(monthStr: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') {
    return null;
  }

  const [
    active,
    upcoming,
    attendance,
    earnings,
    notifications,
    leaderboard
  ] = await Promise.all([
    getKTVActiveSessions(user),
    getKTVUpcomingSessions(user),
    getKTVTodayAttendance(user),
    getKTVEarnings(monthStr, user),
    getKTVNotifications(user),
    getKTVLeaderboard(monthStr, user),
  ]);

  return {
    active,
    upcoming,
    attendance,
    earnings,
    notifications,
    leaderboard
  };
}

export async function getKTVEarningsPageData(selectedMonth: string) {
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') {
    return {
      user: null,
      earnings: { total: 0, sessions: 0 },
      sessions: [],
      leaderboardData: null,
      salaryData: null,
      tenantModuleKey: null,
    };
  }

  const tenantSettings = await getTenantSettings();
  const tenantModuleKey = getDefaultTenantModuleKey(tenantSettings?.enabled_modules);

  const startOfMonth = `${selectedMonth}-01`;
  const nextMonth = getLocalDateString(new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)));

  const [
    earnings,
    sessionsResult,
    leaderboard,
    salaryData
  ] = await Promise.all([
    getKTVEarnings(selectedMonth, user),
    createClient().then(supabase => supabase
      .from('session_logs')
      .select(`id, completed_date, session_number, completed_by_ktv_id, bookings(package_name, ktv_commission, assigned_ktv_id, customers(name_mother))`)
      .eq('completed_by_ktv_id', user.id)
      .eq('status', 'completed')
      .gte('completed_date', startOfMonth)
      .lt('completed_date', nextMonth)
      .order('completed_date', { ascending: false })
    ),
    getKTVLeaderboard(selectedMonth, user),
    getKtvSalaryForConfirmation(`${selectedMonth}-01`, user),
  ]);

  if (sessionsResult.error) {
    throw new Error(`Failed to fetch sessions: ${sessionsResult.error.message}`);
  }

  const myStats = leaderboard.find((k: any) => k.ktv_id === user.id) || null;

  return {
    user,
    earnings,
    sessions: sessionsResult.data || [],
    leaderboardData: myStats,
    salaryData,
    tenantModuleKey,
  };
}

