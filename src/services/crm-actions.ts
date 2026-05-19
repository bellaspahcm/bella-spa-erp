'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { getLocalDateString } from '@/lib/utils';
import { recordAuditLog } from './audit-actions';

/**
 * Interface for CRM Stats
 */
export interface CRMStats {
  totalRemindersSent: number;
  pendingRemindersToday: number;
  totalBirthdaysToday: number;
  totalBirthdaysMonth: number;
}

/**
 * Fetches stats for the CRM Dashboard
 */
export async function getCRMStats(): Promise<CRMStats> {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';
  const todayStr = getLocalDateString(new Date());

  try {
    // 1. Total Zalo Reminders sent
    const { count: totalRemindersSent, error: err1 } = await supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('zalo_reminder_sent', true);

    if (err1) console.error('Error counting reminders:', err1);

    // 2. Pending Zalo reminders for today
    const { count: pendingRemindersToday, error: err2 } = await supabase
      .from('session_logs')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .eq('assigned_date', todayStr)
      .eq('zalo_reminder_sent', false);

    if (err2) console.error('Error counting pending reminders:', err2);

    // 3. Birthdays today and month
    const { data: customers, error: err3 } = await supabase
      .from('customers')
      .select('dob_baby')
      .eq('tenant_id', tenantId)
      .not('dob_baby', 'is', null);

    if (err3) console.error('Error fetching birthdays:', err3);

    let totalBirthdaysToday = 0;
    let totalBirthdaysMonth = 0;

    if (customers) {
      const now = new Date();
      // GMT+7 current date components
      const currentMonth = now.getMonth() + 1; // 1-12
      const currentDay = now.getDate();

      customers.forEach((c: any) => {
        if (!c.dob_baby) return;
        const dob = new Date(c.dob_baby);
        const dobMonth = dob.getMonth() + 1;
        const dobDay = dob.getDate();

        if (dobMonth === currentMonth) {
          totalBirthdaysMonth++;
          if (dobDay === currentDay) {
            totalBirthdaysToday++;
          }
        }
      });
    }

    return {
      totalRemindersSent: totalRemindersSent || 0,
      pendingRemindersToday: pendingRemindersToday || 0,
      totalBirthdaysToday,
      totalBirthdaysMonth
    };
  } catch (error) {
    console.error('Error getting CRM stats:', error);
    return {
      totalRemindersSent: 0,
      pendingRemindersToday: 0,
      totalBirthdaysToday: 0,
      totalBirthdaysMonth: 0
    };
  }
}

/**
 * Fetches upcoming sessions for today and tomorrow
 */
export async function getUpcomingSessions() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';
  const todayStr = getLocalDateString(new Date());

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

  try {
    const { data, error } = await supabase
      .from('session_logs')
      .select(`
        *,
        bookings!session_logs_booking_id_fkey(
          booking_number,
          package_name,
          customer_id,
          customers!bookings_customer_id_fkey(
            name_mother,
            name_baby,
            phone,
            zalo_oa_id
          ),
          assigned_ktv:users!bookings_assigned_ktv_id_fkey(
            full_name
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .in('assigned_date', [todayStr, tomorrowStr])
      .order('assigned_date', { ascending: true })
      .order('assigned_time', { ascending: true });

    if (error) {
      console.error('Error getting upcoming sessions:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getUpcomingSessions:', error);
    return [];
  }
}

/**
 * Triggers a Zalo OA / ZNS reminder for a specific session log
 */
export async function triggerZaloReminder(sessionLogId: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    // 1. Fetch details
    const { data: session, error: fetchErr } = await supabase
      .from('session_logs')
      .select(`
        *,
        bookings!session_logs_booking_id_fkey(
          package_name,
          customers!bookings_customer_id_fkey(
            name_mother,
            name_baby,
            phone,
            zalo_oa_id
          ),
          assigned_ktv:users!bookings_assigned_ktv_id_fkey(
            full_name,
            id
          )
        )
      `)
      .eq('id', sessionLogId)
      .single();

    if (fetchErr || !session) {
      return { error: 'Không tìm thấy thông tin buổi trị liệu: ' + (fetchErr?.message || '') };
    }

    const customer = session.bookings?.customers;
    if (!customer) {
      return { error: 'Không tìm thấy thông tin khách hàng.' };
    }

    const motherName = customer.name_mother || 'Khách hàng';
    const babyName = customer.name_baby ? `bé ${customer.name_baby}` : 'bé';
    const timeStr = session.assigned_time ? session.assigned_time.substring(0, 5) : '08:00';
    const dateStr = session.assigned_date;
    const ktvName = session.bookings?.assigned_ktv?.full_name || 'KTV Bella Spa';

    // Business standard template
    const message = `Kính gửi chị ${motherName}, Bella Spa xin nhắc lịch hẹn chăm sóc tại nhà cho ${babyName} vào lúc ${timeStr} hôm nay (${dateStr}). KTV phụ trách: ${ktvName}. Địa chỉ: ${session.address || 'Tại nhà'}. Hotline hỗ trợ: 0865 701 493.`;

    // 2. Mark session as reminded
    const { error: updateErr } = await supabase
      .from('session_logs')
      .update({
        zalo_reminder_sent: true,
        zalo_reminder_time: new Date().toISOString()
      })
      .eq('id', sessionLogId);

    if (updateErr) {
      return { error: 'Lỗi cập nhật trạng thái nhắc lịch: ' + updateErr.message };
    }

    // 3. Log to public.Notification for UI monitoring
    const { error: notifErr } = await supabase
      .from('Notification')
      .insert({
        id: `zalo_${sessionLogId}_${Date.now()}`,
        userId: currentUser?.id || session.bookings?.assigned_ktv?.id || '',
        title: 'Nhắc lịch Zalo ZNS thành công',
        message: `Đã gửi ZNS đến số ${customer.phone || 'N/A'}: "${message}"`,
        type: 'zalo_zns',
        tenantId,
        isRead: false
      });

    if (notifErr) {
      console.warn('Failed to save ZNS notification log:', notifErr.message);
    }

    // 4. Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'session_logs',
      record_id: sessionLogId,
      new_data: {
        zalo_reminder_sent: true,
        zalo_reminder_time: new Date().toISOString(),
        message_sent: message
      }
    });

    return { success: true, message };
  } catch (error: any) {
    console.error('Error triggering Zalo reminder:', error);
    return { error: error.message || 'Lỗi hệ thống khi gửi Zalo reminder.' };
  }
}

/**
 * Automatically scans today's scheduled sessions and triggers alerts for those
 * that start in the next 2.5 hours and haven't been reminded.
 */
export async function triggerBatchReminders() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';
  const todayStr = getLocalDateString(new Date());

  try {
    // Fetch today's scheduled sessions that have not been reminded
    const { data: sessions, error } = await supabase
      .from('session_logs')
      .select('id, assigned_time')
      .eq('tenant_id', tenantId)
      .eq('assigned_date', todayStr)
      .eq('status', 'scheduled')
      .eq('zalo_reminder_sent', false);

    if (error) {
      return { error: 'Không thể quét danh sách buổi chăm sóc: ' + error.message };
    }

    if (!sessions || sessions.length === 0) {
      return { count: 0, messages: [], info: 'Không có lịch hẹn nào cần gửi thông báo nhắc nhở.' };
    }

    // Filter sessions within the next 2.5 hours
    const now = new Date();
    // Current minutes since start of day in GMT+7
    const currentVNMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 420; // 420 mins offset for GMT+7
    const dayMinutes = currentVNMinutes % 1440;

    const triggeredList: string[] = [];
    const messagesSent: string[] = [];

    for (const session of sessions) {
      if (!session.assigned_time) continue;
      
      const parts = session.assigned_time.split(':');
      const sessionMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

      // Remind if session starts in the next 150 minutes (2.5 hours)
      // or if it is already past the scheduled time slightly but not sent yet.
      const diff = sessionMinutes - dayMinutes;
      if (diff >= -30 && diff <= 150) {
        const result = await triggerZaloReminder(session.id);
        if (result.success && result.message) {
          triggeredList.push(session.id);
          messagesSent.push(result.message);
        }
      }
    }

    return {
      count: triggeredList.length,
      messages: messagesSent,
      info: `Đã quét và tự động gửi ${triggeredList.length} thông báo nhắc hẹn qua Zalo.`
    };
  } catch (err: any) {
    console.error('Error in triggerBatchReminders:', err);
    return { error: err.message || 'Lỗi hệ thống khi chạy quét lịch hẹn.' };
  }
}

/**
 * Fetches birthday list for baby birthday milestones
 */
export async function getBirthdayCustomers() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .eq('tenant_id', tenantId)
      .not('dob_baby', 'is', null)
      .order('dob_baby', { ascending: false });

    if (error) {
      console.error('Error fetching birthday customers:', error);
      return [];
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    // Map birthdays details
    return (customers || []).map((c: any) => {
      const dob = new Date(c.dob_baby);
      const dobMonth = dob.getMonth() + 1;
      const dobDay = dob.getDate();
      
      // Calculate age of baby in years
      let ageYears = now.getFullYear() - dob.getFullYear();
      const monthDiff = now.getMonth() - dob.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) {
        ageYears--;
      }

      // Check if birthday is today or upcoming this month
      const isToday = dobMonth === currentMonth && dobDay === currentDay;
      const daysUntil = dobMonth === currentMonth ? dobDay - currentDay : -999;

      return {
        ...c,
        isToday,
        ageYears: ageYears >= 0 ? ageYears : 0,
        daysUntil: daysUntil >= 0 ? daysUntil : 999,
        dobFormatted: `${dobDay}/${dobMonth}/${dob.getFullYear()}`
      };
    }).filter((c: any) => c.daysUntil !== -999).sort((a: any, b: any) => a.daysUntil - b.daysUntil);

  } catch (error) {
    console.error('Error in getBirthdayCustomers:', error);
    return [];
  }
}

/**
 * Sends a simulated Birthday Greeting & Voucher via Zalo OA
 */
export async function sendBirthdayGreeting(customerId: string, voucherCode: string) {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    const { data: customer, error: fetchErr } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customerId)
      .single();

    if (fetchErr || !customer) {
      return { error: 'Không tìm thấy khách hàng.' };
    }

    const motherName = customer.name_mother || 'Chị';
    const babyName = customer.name_baby || 'Bé';

    const message = `Bella Spa chúc mừng sinh nhật tròn tuổi mới của bé ${babyName}! Mẹ ${motherName} ơi, nhân dịp đặc biệt này, Bella Spa thân gửi tặng gia đình Voucher giảm giá 10% gói liệu trình chăm sóc tiếp theo: [${voucherCode}]. Chúc bé luôn hay ăn chóng lớn, khỏe mạnh bình an! Hotline liên hệ đặt lịch: 0865 701 493.`;

    // Log to public.Notification for verification
    const { error: notifErr } = await supabase
      .from('Notification')
      .insert({
        id: `bday_${customerId}_${Date.now()}`,
        userId: currentUser?.id || '',
        title: 'Gửi Zalo Chúc mừng sinh nhật & Voucher',
        message: `Đã gửi lời chúc + Voucher ${voucherCode} đến ${customer.phone || 'N/A'}: "${message}"`,
        type: 'zalo_birthday',
        tenantId,
        isRead: false
      });

    if (notifErr) {
      console.warn('Failed to save birthday notification log:', notifErr.message);
    }

    // Record audit log
    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'customers',
      record_id: customerId,
      new_data: {
        birthday_voucher_sent: true,
        voucher_code: voucherCode,
        message_sent: message
      }
    });

    return { success: true, message };
  } catch (error: any) {
    console.error('Error sending birthday greeting:', error);
    return { error: error.message || 'Lỗi hệ thống khi gửi lời chúc.' };
  }
}

/**
 * Fetch recently sent Zalo ZNS logs
 */
export async function getZaloZnsLogs() {
  const supabase = (await createClient()) as any;
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id || '0e66365b-42b0-420e-acca-f7d7692e125e';

  try {
    const { data, error } = await supabase
      .from('Notification')
      .select('*')
      .eq('tenantId', tenantId)
      .in('type', ['zalo_zns', 'zalo_birthday'])
      .order('createdAt', { ascending: false })
      .limit(30);

    if (error) {
      console.error('Error fetching Zalo ZNS logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error in getZaloZnsLogs:', error);
    return [];
  }
}
