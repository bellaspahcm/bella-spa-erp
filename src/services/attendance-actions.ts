'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from './audit-actions';
import { getLocalDateString } from '@bella/shared';;
import {
  buildAttendanceTimestamp,
  calculateAttendanceBreakdown,
  calculateCheckInAttendanceStatus,
  getLeaveAttendanceStatus,
  normalizeAttendanceStatus,
} from '@/lib/business-rules/attendance';
import type { Database } from '@/types/database.types';
import type { CurrentUser } from '@/types/domain';

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type AttendanceInsert = Database['public']['Tables']['attendance']['Insert'];
type AttendanceRow = Database['public']['Tables']['attendance']['Row'];
type AttendanceUpdate = Database['public']['Tables']['attendance']['Update'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type CustomerRow = Database['public']['Tables']['customers']['Row'];
type SessionLogUpdate = Database['public']['Tables']['session_logs']['Update'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type StaffLeaveUpdate = Database['public']['Tables']['staff_leaves']['Update'];
type UserRow = Database['public']['Tables']['users']['Row'];

type MonthlyAttendanceKtv = Pick<
  UserRow,
  'id' | 'full_name' | 'base_salary' | 'hire_date' | 'resignation_date' | 'status'
>;

type MonthlyAttendanceLog = Pick<
  AttendanceRow,
  'ktv_id' | 'date' | 'status' | 'checkin_time' | 'checkout_time'
>;

type ConflictBooking = Pick<
  BookingRow,
  'id' | 'booking_number' | 'package_name' | 'customer_id' | 'assigned_ktv_id' | 'preferred_time'
> & {
  customers: Pick<CustomerRow, 'name_mother' | 'phone' | 'address'> | null;
};

type ConflictSession = SessionLogRow & {
  bookings: ConflictBooking | null;
};

type ReassignmentSnapshot = {
  sessionLogId: string;
  payload: SessionLogUpdate;
};

function getErrorMessage(error: unknown, fallback = 'Lá»—i há»‡ thá»‘ng') {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return fallback;
}

function getSessionHour(session: ConflictSession, fallbackTime: string) {
  const time = session.assigned_time || session.bookings?.preferred_time || fallbackTime;
  return parseInt(time.split(':')[0], 10);
}

async function rollbackLeaveApproval(
  supabase: SupabaseClient,
  leaveId: string,
  payload: StaffLeaveUpdate,
) {
  const { error } = await supabase
    .from('staff_leaves')
    .update(payload)
    .eq('id', leaveId);

  return error?.message || '';
}

async function rollbackSessionReassignments(
  supabase: SupabaseClient,
  snapshots: ReassignmentSnapshot[],
) {
  const failures: string[] = [];

  for (const snapshot of [...snapshots].reverse()) {
    const { error } = await supabase
      .from('session_logs')
      .update(snapshot.payload)
      .eq('id', snapshot.sessionLogId);

    if (error) {
      failures.push(`${snapshot.sessionLogId}: ${error.message}`);
    }
  }

  return failures.join('; ');
}

/** Fetch today's local date string in YYYY-MM-DD format (Vietnam Timezone) */
export async function getVNTodayString(): Promise<string> {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
}

/** Get KTV's attendance status for today */
export async function getKTVTodayAttendance(currentUser?: CurrentUser) {
  const supabase = await createClient();
  const user = currentUser || await getCurrentUser();
  if (!user || user.role !== 'ktv') return null;

  const todayStr = await getVNTodayString();

  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch today's KTV attendance: ${error.message}`);
  }
  return data;
}

/** KTV daily Check-in */
export async function ktvCheckIn() {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return { success: false, error: 'Không có quyền truy cập' };

  const tenantId = user.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const todayStr = await getVNTodayString();
  const now = new Date();

  // Determine status (Late if check-in is after 08:30:00 local time)
  const currentHour = now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'Asia/Ho_Chi_Minh' });
  const status = calculateCheckInAttendanceStatus({ localTime: currentHour });

  // Check if already checked in
  const { data: existing, error: existingError } = await supabase
    .from('attendance')
    .select('id')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

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

  const tenantId = user.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  const todayStr = await getVNTodayString();
  const now = new Date();

  const { data: existing, error: fetchErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('ktv_id', user.id)
    .eq('date', todayStr)
    .eq('tenant_id', tenantId)
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
    .eq('tenant_id', tenantId)
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
  
  // Get current user's tenant to ensure proper isolation
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    throw new Error('[getMonthlyAttendanceSummary] Missing tenantId for current user');
  }
  
  const startOfMonth = `${monthStr}-01`;
  const endOfMonth = getLocalDateString(new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 1));

  // 1. Fetch all KTVs (filtered by tenant)
  const { data: ktvs, error: ktvsError } = await supabase
    .from('users')
    .select('id, full_name, base_salary, hire_date, resignation_date, status')
    .eq('role', 'ktv')
    .eq('tenant_id', tenantId); // ✅ FIX: Add tenant filter

  if (ktvsError) {
    throw new Error(`Failed to fetch KTVs for monthly attendance summary: ${ktvsError.message}`);
  }
  if (!ktvs) return [];

  // 2. Fetch all attendance logs this month (filtered by tenant)
  const { data: logs, error: logsError } = await supabase
    .from('attendance')
    .select('*')
    .gte('date', startOfMonth)
    .lt('date', endOfMonth)
    .eq('tenant_id', tenantId); // ✅ FIX: Add tenant filter

  if (logsError) {
    throw new Error(`Failed to fetch monthly attendance logs: ${logsError.message}`);
  }

  const ktvList = (ktvs || []) as MonthlyAttendanceKtv[];
  const logsList = (logs || []) as MonthlyAttendanceLog[];

  return ktvList.map((ktv) => {
    const ktvLogs = logsList.filter((l) => l.ktv_id === ktv.id);
    const attendanceBreakdown = calculateAttendanceBreakdown(ktvLogs);

    return {
      id: ktv.id,
      name: ktv.full_name,
      role: 'ktv',
      baseSalary: ktv.base_salary || 6000000,
      hireDate: ktv.hire_date,
      resignationDate: ktv.resignation_date,
      present: attendanceBreakdown.present,
      late: attendanceBreakdown.late,
      absent: attendanceBreakdown.absent,
      halfDay: attendanceBreakdown.halfDay,
      totalDays: attendanceBreakdown.workDays,
      status: ktv.status,
      logs: ktvLogs.map((l) => ({
        date: l.date,
        status: normalizeAttendanceStatus(l.status),
        checkin_time: l.checkin_time,
        checkout_time: l.checkout_time
      })),
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

  const tenantId = currentUser.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  // Check if existing record
  const { data: existing, error: existingError } = await supabase
    .from('attendance')
    .select('id')
    .eq('ktv_id', payload.ktvId)
    .eq('date', payload.date)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

  const recordData = {
    ktv_id: payload.ktvId,
    date: payload.date,
    status: payload.status,
    checkin_time: buildAttendanceTimestamp(payload.checkinTime),
    checkout_time: buildAttendanceTimestamp(payload.checkoutTime),
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
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') {
    return { success: false, error: 'Không có quyền thực hiện' };
  }

  const tenantId = user.tenant_id;
  if (!tenantId) return { success: false, error: 'Không xác định được chi nhánh của người dùng' };

  // Check if there is already a request for this date
  const { data: existing, error: existingError } = await supabase
    .from('staff_leaves')
    .select('id')
    .eq('user_id', user.id)
    .eq('leave_date', payload.leave_date)
    .maybeSingle();

  if (existingError) {
    return { success: false, error: existingError.message };
  }

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
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.role !== 'ktv') return [];

  const { data, error } = await supabase
    .from('staff_leaves')
    .select('*')
    .eq('user_id', user.id)
    .order('leave_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch KTV leave history: ${error.message}`);
  }
  return data || [];
}

/** Admin Action: Lấy tất cả đơn nghỉ phép đang chờ duyệt */
export async function getPendingLeaveRequests() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') return [];

  const { data, error } = await supabase
    .from('staff_leaves')
    .select(`
      *,
      users!staff_leaves_user_id_fkey (
        id,
        full_name,
        email,
        role
      )
    `)
    .eq('status', 'pending')
    .order('leave_date', { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch pending leave requests: ${error.message}`);
  }
  return data || [];
}

/** Admin Action: Lấy tất cả đơn nghỉ phép đã xử lý (được duyệt hoặc từ chối) theo tháng */
export async function getProcessedLeaveRequests(monthStr?: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role === 'ktv') return [];

  let query = supabase
    .from('staff_leaves')
    .select(`
      *,
      users!staff_leaves_user_id_fkey (
        id,
        full_name,
        email,
        role
      )
    `)
    .in('status', ['approved', 'rejected']);

  if (monthStr) {
    const startOfMonth = `${monthStr}-01`;
    const endOfMonth = getLocalDateString(new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 1));
    query = query.gte('leave_date', startOfMonth).lt('leave_date', endOfMonth);
  }

  const { data, error } = await query.order('leave_date', { ascending: false });

  if (error) {
    throw new Error(`Failed to fetch processed leave requests: ${error.message}`);
  }
  return data || [];
}

/** Admin Action: Lấy tất cả các ca bị trùng/xung đột của KTV trong ngày nghỉ */
export async function getKTVConflictSessions(
  ktvId: string,
  dateStr: string,
  leaveType: 'full_day' | 'morning' | 'afternoon'
) {
  const supabase = await createClient();
  
  // Lấy danh sách các ca chăm sóc được đặt trước của KTV này vào ngày đó
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
    throw new Error(`Failed to fetch KTV conflict sessions: ${error.message}`);
  }

  const sessions = (data || []) as unknown as ConflictSession[];
  
  // Lọc theo ca sáng/chiều nếu loại nghỉ là nửa ngày
  if (leaveType === 'morning') {
    return sessions.filter((s) => getSessionHour(s, '09:00') < 13);
  } else if (leaveType === 'afternoon') {
    return sessions.filter((s) => getSessionHour(s, '14:00') >= 13);
  }

  return sessions;
}

/** Admin Action: Phê duyệt đơn nghỉ phép của KTV và xử lý chuyển ca */
export async function approveLeaveRequest(
  leaveId: string,
  reassignments?: { sessionLogId: string; newKtvId: string }[]
) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || !['admin', 'ktv_lead', 'admin_staff', 'accountant', 'hr'].includes(currentUser.role)) {
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
  const leaveRollbackPayload: StaffLeaveUpdate = {
    status: leave.status,
    approved_by: leave.approved_by ?? null,
  };
  const reassignmentSnapshots: ReassignmentSnapshot[] = [];

  if (reassignments && reassignments.length > 0) {
    for (const r of reassignments) {
      const { data: sessionLog, error: snapshotErr } = await supabase
        .from('session_logs')
        .select('completed_by_ktv_id, notes')
        .eq('id', r.sessionLogId)
        .single();

      if (snapshotErr || !sessionLog) {
        const rollbackError = await rollbackSessionReassignments(supabase, reassignmentSnapshots);
        const rollbackNote = rollbackError ? `; reassignment rollback failed: ${rollbackError}` : '';
        return {
          success: false,
          error: `Không thể đọc ca cần điều chuyển: ${getErrorMessage(snapshotErr)}${rollbackNote}`,
        };
      }

      const reassignmentPayload: SessionLogUpdate = {
        completed_by_ktv_id: r.newKtvId,
        notes: `[🔄 Thay ca] Làm thay cho KTV chính`,
      };

      const { error: reassignErr } = await supabase
        .from('session_logs')
        .update(reassignmentPayload)
        .eq('id', r.sessionLogId);

      if (reassignErr) {
        console.error('Error reassigning session:', r.sessionLogId, reassignErr);
        const rollbackError = await rollbackSessionReassignments(supabase, reassignmentSnapshots);
        const rollbackNote = rollbackError ? `; reassignment rollback failed: ${rollbackError}` : '';
        return {
          success: false,
          error: `Có lỗi xảy ra khi điều chuyển ca làm việc: ${reassignErr.message}${rollbackNote}`,
        };
      }

      reassignmentSnapshots.push({
        sessionLogId: r.sessionLogId,
        payload: {
          completed_by_ktv_id: sessionLog.completed_by_ktv_id ?? null,
          notes: sessionLog.notes ?? null,
        },
      });
    }
  }

  // 3. Cập nhật trạng thái đơn nghỉ thành approved
  const leaveApprovalPayload: StaffLeaveUpdate = {
    status: 'approved',
    approved_by: currentUser.id,
  };
  const { error: updateErr } = await supabase
    .from('staff_leaves')
    .update(leaveApprovalPayload)
    .eq('id', leaveId);

  if (updateErr) {
    const rollbackError = await rollbackSessionReassignments(supabase, reassignmentSnapshots);
    const rollbackNote = rollbackError ? `; reassignment rollback failed: ${rollbackError}` : '';
    return { success: false, error: `${updateErr.message}${rollbackNote}` };
  }

  // 4. Tự động ghi/cập nhật bản ghi chấm công theo loại nghỉ phép
  // - Nghỉ buổi sáng (morning) hoặc buổi chiều (afternoon) → half_day (0.5 ngày công)
  // - Nghỉ cả ngày (full / full_day) → absent (0 ngày công)
  try {
    const leaveAttendanceStatus = getLeaveAttendanceStatus(leave.leave_type);

    const { data: existingAtt, error: existingAttError } = await supabase
      .from('attendance')
      .select('id, status')
      .eq('ktv_id', leave.user_id)
      .eq('date', leave.leave_date)
      .maybeSingle();

    if (existingAttError) throw existingAttError;

    if (existingAtt) {
      // Chỉ ghi đè nếu chưa được chấm (present/late không bị ghi đè)
      if (existingAtt.status === 'absent' || existingAtt.status === 'half_day') {
        const { error: updateErr } = await supabase
          .from('attendance')
          .update({ status: leaveAttendanceStatus } satisfies AttendanceUpdate)
          .eq('id', existingAtt.id);
        if (updateErr) throw updateErr;
      }
    } else {
      // Chưa có bản ghi chấm công → tạo mới
      const { error: insertErr } = await supabase
        .from('attendance')
        .insert({
          ktv_id: leave.user_id,
          date: leave.leave_date,
          status: leaveAttendanceStatus,
          tenant_id: leave.tenant_id,
        } satisfies AttendanceInsert);
      if (insertErr) throw insertErr;
    }
  } catch (attErr: unknown) {
    console.error('[approveLeaveRequest] Error writing attendance record:', attErr);
    const leaveRollbackError = await rollbackLeaveApproval(supabase, leaveId, leaveRollbackPayload);
    const reassignmentRollbackError = await rollbackSessionReassignments(supabase, reassignmentSnapshots);
    const rollbackNote = [
      leaveRollbackError ? `rollback failed: ${leaveRollbackError}` : '',
      reassignmentRollbackError ? `reassignment rollback failed: ${reassignmentRollbackError}` : '',
    ].filter(Boolean).join('; ');
    return {
      success: false,
      error: `Phê duyệt phép thất bại do không thể ghi nhận dữ liệu chấm công: ${getErrorMessage(attErr)}${rollbackNote ? `; ${rollbackNote}` : ''}`,
    };
  }

  await recordAuditLog({
    action: 'UPDATE',
    table_name: 'staff_leaves',
    record_id: leaveId,
    new_data: { status: 'approved', approved_by: currentUser.id }
  });

  revalidatePath('/dashboard/sessions');
  revalidatePath('/ktv/dashboard');
  revalidatePath('/dashboard/salary');
  return { success: true };
}

/** Admin Action: Từ chối đơn nghỉ phép */
export async function rejectLeaveRequest(leaveId: string, rejectReason?: string) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== 'admin' && currentUser.role !== 'ktv_lead' && currentUser.role !== 'admin_staff' && currentUser.role !== 'accountant' && currentUser.role !== 'hr') {
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
