'use server';

import { createClient } from '@/lib/supabase-server';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from './user-actions';
import { resolvePackageName } from '@/lib/utils';

/**
 * Lấy các buổi trị liệu đang thực hiện của KTV hiện tại
 */
export async function getKTVActiveSessions() {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return [];

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

  if (error) {
    console.error('Error fetching active sessions:', error);
    return [];
  }

  return (data || [])
    .filter((s: any) => {
      if (!s.bookings) return true;
      const bookingTotal = s.bookings.total_sessions || 0;
      const isBookingCompleted = s.bookings.status === 'completed';
      return s.session_number <= bookingTotal && !isBookingCompleted;
    })
    .map((s: any) => ({
      ...s,
      bookings: s.bookings ? {
        ...s.bookings,
        package_name: resolvePackageName(s.bookings)
      } : null
    }));
}

/**
 * Lấy các buổi trị liệu được phân công hôm nay
 */
export async function getKTVUpcomingSessions() {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return [];

  // Get current date in Vietnam timezone (YYYY-MM-DD)
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

  // Fetch all sessions for bookings assigned to this KTV
  const { data, error } = await supabase
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
    .eq('bookings.assigned_ktv_id', user.id)
    .order('booking_id', { ascending: true })
    .order('session_number', { ascending: true });

  if (error) {
    console.error('Error fetching upcoming sessions:', error);
    return [];
  }

  if (!data || data.length === 0) return [];

  // Group sessions by booking - strictly keeping only matching KTV sessions
  const sessionsByBooking: Record<string, any[]> = {};
  data.forEach((s: any) => {
    if (!s.booking_id || !s.bookings || s.bookings.assigned_ktv_id !== user.id) return;
    if (!sessionsByBooking[s.booking_id]) sessionsByBooking[s.booking_id] = [];
    sessionsByBooking[s.booking_id].push(s);
  });

  const processedSessionsList: any[] = [];

  for (const [bookingId, bookingSessions] of Object.entries(sessionsByBooking)) {
    // Sort by session number
    bookingSessions.sort((a, b) => a.session_number - b.session_number);

    let lastKnownDate: string | null = null;
    let lastKnownSessionNum = 0;

    for (const s of bookingSessions) {
      let finalDate = s.assigned_date;

      if (!finalDate) {
        if (lastKnownDate) {
          const [y, m, d] = lastKnownDate.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - lastKnownSessionNum));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else if (s.bookings?.start_date) {
          const [y, m, d] = s.bookings.start_date.split('-').map(Number);
          const date = new Date(y, m - 1, d);
          date.setDate(date.getDate() + (s.session_number - 1));
          finalDate = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        }
      }

      if (finalDate) {
        lastKnownDate = finalDate;
        lastKnownSessionNum = s.session_number;
      }

      // We only care about scheduled sessions for the upcoming list
      const bookingTotal = s.bookings?.total_sessions || 0;
      const isBookingCompleted = s.bookings?.status === 'completed';

      if (s.status === 'scheduled' && finalDate === today && s.session_number <= bookingTotal && !isBookingCompleted) {
        processedSessionsList.push({
          ...s,
          assigned_date: finalDate,
          assigned_time: s.assigned_time || s.bookings?.preferred_time || '09:00 - 11:00',
          bookings: s.bookings ? {
            ...s.bookings,
            package_name: resolvePackageName(s.bookings)
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

  return processedSessionsList;
}

/**
 * Bắt đầu một buổi trị liệu (Check-in)
 */
export async function startSession(sessionId: string) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') throw new Error('Unauthorized');

  // 1. Lấy thông tin session để tìm booking_id
  const { data: session } = await supabase
    .from('session_logs')
    .select('booking_id, session_number, bookings(total_sessions, completed_sessions, status)')
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  // Guard: check that the booking is not completed and the session number is within the booking's total_sessions
  const booking = session.bookings as any;
  if (booking) {
    if (booking.status === 'completed' || (booking.completed_sessions || 0) >= (booking.total_sessions || 0)) {
      throw new Error('Liệu trình này đã hoàn thành toàn bộ số buổi. Không thể bắt đầu buổi mới.');
    }
    if (session.session_number > (booking.total_sessions || 0)) {
      throw new Error('Buổi này vượt quá tổng số buổi của liệu trình.');
    }
  }

  // 2. Cập nhật session log
  const { error } = await supabase
    .from('session_logs')
    .update({
      status: 'in_progress',
      start_time: new Date().toISOString(),
      completed_by_ktv_id: user.id
    })
    .eq('id', sessionId);

  if (error) {
    console.error('Error starting session:', error);
    throw new Error('Không thể bắt đầu buổi trị liệu');
  }

  // 3. Cập nhật booking: set is_in_care = true và status = in_progress
  await supabase
    .from('bookings')
    .update({ 
      is_in_care: true,
      status: 'in_progress'
    })
    .eq('id', session.booking_id);

  revalidatePath('/ktv/dashboard');
  return { success: true };
}

/**
 * Hoàn thành một buổi trị liệu (Check-out)
 */
export async function completeKTVSession(sessionId: string, notes: string = '', ktvCheckoutNote: string = '') {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') throw new Error('Unauthorized');

  // 1. Lấy thông tin session để tìm booking_id, start_time và package_id
  const { data: session } = await supabase
    .from('session_logs')
    .select(`
      booking_id, 
      start_time,
      bookings (
        package_id,
        packages (
          duration
        )
      )
    `)
    .eq('id', sessionId)
    .single();

  if (!session) throw new Error('Session not found');

  // Tính toán thời lượng quy định và thực tế
  let standardDuration = 60; // Mặc định là 60 phút
  const durationStr = (session as any)?.bookings?.packages?.duration;
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
  const { error: sessionError } = await supabase
    .from('session_logs')
    .update({
      status: 'completed',
      end_time: endTime.toISOString(),
      completed_date: endTime.toISOString(),
      notes: notes,
      standard_duration: standardDuration,
      actual_duration: actualDuration,
      time_deviation: timeDeviation,
      duration_warning_type: durationWarningType,
      ktv_checkout_note: ktvCheckoutNote
    })
    .eq('id', sessionId);

  if (sessionError) throw new Error('Failed to complete session');

  // 2.5 Tự động trừ kho vật tư tiêu hao nếu có định mức
  const packageId = (session as any)?.bookings?.package_id;
  if (packageId) {
    try {
      const { autoConsumeForSession } = await import('./inventory-actions');
      await autoConsumeForSession(packageId, sessionId);
      console.log(`[completeKTVSession] Successfully auto-consumed materials for package ${packageId} and session ${sessionId}`);
    } catch (consumeErr) {
      console.error('[completeKTVSession] Error in autoConsumeForSession:', consumeErr);
    }
  }

  // 3. Re-calculate actual completed sessions to avoid race conditions
  const { count, error: countError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('booking_id', session.booking_id)
    .eq('status', 'completed');

  if (countError) {
    console.error('Error counting completed sessions:', countError);
  }

  const { data: booking } = await supabase
    .from('bookings')
    .select('total_sessions')
    .eq('id', session.booking_id)
    .single();

  if (booking) {
    const actualCompletedCount = count || 0;
    const isFinished = actualCompletedCount >= (booking.total_sessions || 0);
    const { error: bookingError } = await supabase
      .from('bookings')
      .update({ 
        status: isFinished ? 'completed' : 'in_progress',
        is_in_care: !isFinished,
        updated_at: new Date().toISOString()
      })
      .eq('id', session.booking_id);

    if (bookingError) {
      console.error('Error updating booking status:', bookingError);
    }

    if (isFinished) {
      // Clean up any remaining scheduled logs that exceed the total sessions
      await supabase
        .from('session_logs')
        .delete()
        .eq('booking_id', session.booking_id)
        .gt('session_number', booking.total_sessions)
        .eq('status', 'scheduled');
    }
  }

  revalidatePath('/ktv/dashboard');
  revalidatePath('/dashboard/bookings');
  return { success: true };
}

/**
 * Lấy thu nhập hoa hồng của KTV trong tháng
 */
export async function getKTVEarnings(month: string) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { total: 0, sessions: 0 };

  const startOfMonth = `${month}-01`;
  const nextMonth = new Date(new Date(startOfMonth).setMonth(new Date(startOfMonth).getMonth() + 1)).toISOString().split('T')[0];

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

  if (error) return { total: 0, sessions: 0 };

  const total = data.reduce((acc: number, s: any) => acc + (Number(s.bookings?.ktv_commission) || 0), 0);
  
  return {
    total,
    sessions: data.length
  };
}

export async function getKTVLeaderboard(month: string) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  const tenantId = user?.tenant_id;
  if (!tenantId) return [];

  const { data, error } = await supabase.rpc('get_ktv_leaderboard', {
    p_tenant_id: tenantId,
    p_month: `${month}-01`
  });

  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }

  return data || [];
}

/**
 * Lấy danh sách thông báo của KTV hiện tại (Đã lọc bỏ thông tin đánh giá/sao để bảo mật)
 */
export async function getKTVNotifications() {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user) return [];

  // Truy vấn từ DB: Loại bỏ trực tiếp các thông báo có type là 'review' để bảo mật
  const { data, error } = await supabase
    .from('Notification')
    .select('*')
    .eq('userId', user.id)
    .neq('type', 'review')
    .order('createdAt', { ascending: false });

  if (error) {
    console.error('Error fetching KTV notifications:', error);
    return [];
  }

  if (!data) return [];

  // Lọc thêm một lớp tại Application logic để phòng ngừa các thông báo chứa từ khoá nhạy cảm liên quan đến đánh giá sao
  const secureNotifications = data.filter((notif: any) => {
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
  const supabase = (await createClient()) as any;
  const { error } = await supabase
    .from('Notification')
    .update({ isRead: true } as any)
    .eq('id', id);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Không thể cập nhật thông báo');
  }

  return { success: true };
}

