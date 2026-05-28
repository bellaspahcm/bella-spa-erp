'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '../user-actions';
import { getLocalDateString } from '@/lib/utils';
import type { CRMStats } from './types';

export async function getCRMStats(): Promise<CRMStats> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    console.warn('[getCRMStats] Không tìm thấy tenantId cho người dùng hiện tại');
    return {
      totalRemindersSent: 0,
      pendingRemindersToday: 0,
      totalBirthdaysToday: 0,
      totalBirthdaysMonth: 0
    };
  }
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

      customers.forEach((c) => {
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

export async function getUpcomingSessions() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    console.warn('[getUpcomingSessions] Không tìm thấy tenantId cho người dùng hiện tại');
    return [];
  }
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
