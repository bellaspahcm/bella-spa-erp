'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { revalidatePath } from 'next/cache';
import { recordAuditLog } from './audit-actions';

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
  if (!tenantId) tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';

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
  const endOfMonth = new Date(new Date(startOfMonth).getFullYear(), new Date(startOfMonth).getMonth() + 1, 1).toISOString().split('T')[0];

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
  if (!tenantId) tenantId = '0e66365b-42b0-420e-acca-f7d7692e125e';

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
