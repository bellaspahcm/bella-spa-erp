'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from './audit-actions';
import { getLocalDateString } from '@/lib/utils';

/** Fetch today's local date string in YYYY-MM-DD format (Vietnam Timezone) */
export async function getVNTodayString(): Promise<string> {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Get KTV's attendance status for today */
export async function getKTVTodayAttendance() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return null;

  const todayStr = await getVNTodayString();

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (error) {
    console.error('Error fetching today attendance:', error);
    return null;
  }
  return data;
}

/** KTV daily Check-in */
export async function ktvCheckIn() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Không có quyền truy cập' };

  let tenantId = user.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const todayStr = await getVNTodayString();
  const now = new Date();

  // Determine status (Late if check-in is after 08:30:00 local time)
  const currentHour = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
  const isLate = currentHour > '08:30:00';
  const status = isLate ? 'late' : 'present';

  // Check if already checked in
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Bạn đã check-in ngày hôm nay rồi!' };
  }

  const { data, error } = await supabase
    .from('attendance')
    .insert({
      ktv_id: user.id,
      date: todayStr,
      checkin_time: now.toISOString(),
      status,
      tenant_id: tenantId,
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'attendance',
    record_id: data.id,
    new_data: { ktv_id: user.id, date: todayStr, checkin_time: now.toISOString(), status }
  });

  revalidatePath('/ktv/dashboard');
  return { success: true, data };
}

/** KTV daily Check-out */
export async function ktvCheckOut() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Không có quyền truy cập' };

  const todayStr = await getVNTodayString();
  const now = new Date();

  const { data: existing, error: fetchErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (fetchErr || !existing) {
    return { success: false, error: 'Bạn cần check-in trước khi check-out!' };
  }

  if (existing.checkout_time) {
    return { success: false, error: 'Bạn đã check-out ngày hôm nay rồi!' };
  }

  const { data, error } = await supabase
    .from('attendance')
    .update({
      checkout_time: now.toISOString(),
    })
    .eq('id', existing.id)
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'attendance',
    record_id: data.id,
    new_data: { checkout_time: now.toISOString() }
  });

  revalidatePath('/ktv/dashboard');
  return { success: true, data };
}

/** Admin Action: Get all KTVs with their attendance count for a given month */
export async function getMonthlyAttendanceSummary(monthStr: string) {
  const supabase = await createClient();
  const startOfMonth = `${monthStr}-01`;
  const endOfMonth = getLocalDateString(new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 1));

  // 1. Fetch all KTVs
  const { data: ktvs } = await supabase
    .from('users')
    .select('id, full_name, base_salary, hire_date, resignation_date, status')
    .eq('role', 'ktv');

  if (!ktvs) return [];

  // 2. Fetch all attendance logs this month
  const { data: logs } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', startOfMonth)
    .lt('date', endOfMonth);

  const logsList = logs || [];

  return ktvs.map((ktv: any) => {
    const ktvLogs = logsList.filter((l: any) => l.ktv_id === ktv.id);
    
    let presentCount = 0;
    let lateCount = 0;
    let absentCount = 0;
    let halfDayCount = 0;

    ktvLogs.forEach((l: any) => {
      if (l.status === 'present') presentCount++;
      else if (l.status === 'late') lateCount++;
      else if (l.status === 'absent') absentCount++;
      else if (l.status === 'half_day') halfDayCount++;
    });

    const totalDaysWorked = presentCount + lateCount + (halfDayCount * 0.5);

    return {
      id: ktv.id,
      name: ktv.full_name,
      baseSalary: ktv.base_salary || 6000000,
      hireDate: ktv.hire_date,
      resignationDate: ktv.resignation_date,
      present: presentCount,
      late: lateCount,
      absent: absentCount,
      halfDay: halfDayCount,
      totalDays: totalDaysWorked,
      status: ktv.status,
      logs: ktvLogs,
    };
  });
}

/** Admin Action: Override or create an attendance log */
export async function adminOverrideAttendance(payload: {
  ktvId: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
  checkinTime?: string;
  checkoutTime?: string;
}) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  let tenantId = currentUser.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  // Check if existing record
  const { data: existing } = await supabase
    .from('attendance')
    .select('id')
    .eq('ktv_id', payload.ktvId)
    .eq('date', payload.date)
    .maybeSingle();

  const recordData = {
    ktv_id: payload.ktvId,
    date: payload.date,
    status: payload.status,
    checkin_time: payload.checkinTime ? new Date(payload.checkinTime.includes('+') || payload.checkinTime.includes('Z') ? payload.checkinTime : `${payload.checkinTime}+07:00`).toISOString() : null,
    checkout_time: payload.checkoutTime ? new Date(payload.checkoutTime.includes('+') || payload.checkoutTime.includes('Z') ? payload.checkoutTime : `${payload.checkoutTime}+07:00`).toISOString() : null,
    tenant_id: tenantId,
  };

  let result;
  if (existing) {
    result = await supabase
      .from('attendance')
      .update(recordData)
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    result = await supabase
      .from('attendance')
      .insert(recordData)
      .select()
      .single();
  }

  if (result.error) return { success: false, error: result.error.message };

  await recordAuditLog({
    action: existing ? 'UPDATE' : 'INSERT',
    table_name: 'attendance',
    record_id: result.data.id,
    new_data: recordData,
  });

  revalidatePath('/dashboard/salary');
  return { success: true, data: result.data };
}

/** Admin Action: Update HR parameters on user profile */
export async function adminUpdateKtvHrProfile(
  ktvId: string,
  payload: {
    base_salary: number;
    hire_date: string | null;
    resignation_date: string | null;
    status: string;
  }
) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  const { error } = await supabase
    .from('users')
    .update({
      base_salary: payload.base_salary,
      hire_date: payload.hire_date || null,
      resignation_date: payload.resignation_date || null,
      status: payload.status,
    })
    .eq('id', ktvId);

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'users',
    record_id: ktvId,
    new_data: payload,
  });

  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** KTV Action: Đăng ký nghỉ phép */
export async function submitKTVLeaveRequest(payload: {
  leave_date: string;
  leave_type: 'full_day' | 'morning' | 'afternoon';
  reason?: string;
}) {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  let tenantId = user.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  // Check if there is already a request for this date
  const { data: existing } = await supabase
    .from('staff_leaves')
    .select('id')
    .eq('user_id', user.id)
    .eq('leave_date', payload.leave_date)
    .maybeSingle();

  if (existing) {
    return { success: false, error: 'Bạn đã đăng ký nghỉ phép ngày hôm nay rồi!' };
  }

  const { data, error } = await supabase
    .from('staff_leaves')
    .insert({
      user_id: user.id,
      leave_date: payload.leave_date,
      leave_type: payload.leave_type,
      reason: payload.reason || '',
      status: 'pending',
      tenant_id: tenantId
    })
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'INSERT',
    table_name: 'staff_leaves',
    record_id: data.id,
    new_data: { user_id: user.id, leave_date: payload.leave_date, leave_type: payload.leave_type }
  });

  revalidatePath('/ktv/dashboard');
  return { success: true, data };
}

/** KTV Action: Lấy lịch sử nghỉ phép */
export async function getKTVLeaveHistory() {
  const supabase = (await createClient()) as any;
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return [];

  const { data, error } = await supabase
    .from('staff_leaves')
    .select('*')
    .eq('user_id', user.id)
    .order('leave_date', { ascending: false });

  if (error) {
    console.error('Error fetching leave history:', error);
    return [];
  }
  return data || [];
}

/** Admin Action: Lấy tất cả đơn nghỉ phép đang chờ duyệt */
export async function getPendingLeaveRequests() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') return [];

  const { data, error } = await supabase
    .from('staff_leaves')
    .select(`
      *,
      users!staff_leaves_user_id_fkey (
        id,
        full_name,
        role
      )
    `)
    .eq('status', 'pending')
    .order('leave_date', { ascending: true });

  if (error) {
    console.error('Error fetching pending leave requests:', error);
    return [];
  }
  return data || [];
}

/** Admin Action: Lấy tất cả các ca bị trùng/xung đột của KTV trong ngày nghỉ */
export async function getKTVConflictSessions(
  ktvId: string,
  dateStr: string,
  leaveType: 'full_day' | 'morning' | 'afternoon'
) {
  const supabase = (await createClient()) as any;
  
  // Lấy danh sách các ca trị liệu được đặt trước của KTV này vào ngày đó
  const { data, error } = await supabase
    .from('session_logs')
    .select(`
      *,
      bookings!inner (
        id,
        booking_number,
        package_name,
        customer_id,
        assigned_ktv_id,
        preferred_time,
        customers (
          name_mother,
          phone,
          address
        )
      )
    `)
    .eq('bookings.assigned_ktv_id', ktvId)
    .eq('status', 'scheduled')
    .eq('assigned_date', dateStr);

  if (error) {
    console.error('Error querying conflict sessions:', error);
    return [];
  }

  const sessions = data || [];
  
  // Lọc theo ca sáng/chiều nếu loại nghỉ là nửa ngày
  if (leaveType === 'morning') {
    return sessions.filter((s: any) => {
      const time = s.assigned_time || s.bookings?.preferred_time || '09:00';
      const hour = parseInt(time.split(':')[0], 10);
      return hour < 13;
    });
  } else if (leaveType === 'afternoon') {
    return sessions.filter((s: any) => {
      const time = s.assigned_time || s.bookings?.preferred_time || '14:00';
      const hour = parseInt(time.split(':')[0], 10);
      return hour >= 13;
    });
  }

  return sessions;
}

/** Admin Action: Phê duyệt đơn nghỉ phép của KTV và xử lý chuyển ca */
export async function approveLeaveRequest(
  leaveId: string,
  reassignments?: { sessionLogId: string; newKtvId: string }[]
) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin' && currentUser.role !== 'ktv_lead' && currentUser.role !== 'admin_staff' && currentUser.role !== 'accountant') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  // 1. Lấy thông tin đơn nghỉ phép
  const { data: leave, error: fetchErr } = await supabase
    .from('staff_leaves')
    .select('*')
    .eq('id', leaveId)
    .single();

  if (fetchErr || !leave) {
    return { success: false, error: 'Đơn nghỉ phép không tồn tại' };
  }

  // 2. Thực hiện điều chuyển ca nếu có cấu hình
  if (reassignments && reassignments.length > 0) {
    for (const r of reassignments) {
      const { error: reassignErr } = await supabase
        .from('session_logs')
        .update({
          completed_by_ktv_id: r.newKtvId,
          notes: `[🔄 Thay ca] Làm thay cho KTV chính`
        })
        .eq('id', r.sessionLogId);

      if (reassignErr) {
        console.error('Error reassigning session:', r.sessionLogId, reassignErr);
        return { success: false, error: 'Có lỗi xảy ra khi điều chuyển ca làm việc' };
      }
    }
  }

  // 3. Cập nhật trạng thái đơn nghỉ thành approved
  const { error: updateErr } = await supabase
    .from('staff_leaves')
    .update({
      status: 'approved',
      approved_by: currentUser.id
    })
    .eq('id', leaveId);

  if (updateErr) return { success: false, error: updateErr.message };

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'staff_leaves',
    record_id: leaveId,
    new_data: { status: 'approved', approved_by: currentUser.id }
  });

  revalidatePath('/dashboard/sessions');
  revalidatePath('/ktv/dashboard');
  return { success: true };
}

/** Admin Action: Từ chối đơn nghỉ phép */
export async function rejectLeaveRequest(leaveId: string, rejectReason?: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin' && currentUser.role !== 'ktv_lead' && currentUser.role !== 'admin_staff' && currentUser.role !== 'accountant') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  const { error } = await supabase
    .from('staff_leaves')
    .update({
      status: 'rejected',
      approved_by: currentUser.id,
      rejection_reason: rejectReason || null
    })
    .eq('id', leaveId);

  if (error) return { success: false, error: error.message };

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'staff_leaves',
    record_id: leaveId,
    new_data: { status: 'rejected', approved_by: currentUser.id, rejection_reason: rejectReason }
  });

  revalidatePath('/dashboard/sessions');
  revalidatePath('/ktv/dashboard');
  return { success: true };
}

