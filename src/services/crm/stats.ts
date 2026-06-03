'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '../user-actions';
import { getLocalDateString } from '@/lib/utils';
import type { CRMStats } from './types';

const EMPTY_CRM_STATS: CRMStats = {
  totalRemindersSent: 0,
  pendingRemindersToday: 0,
  totalBirthdaysToday: 0,
  totalBirthdaysMonth: 0,
};

export async function getCRMStats(): Promise<CRMStats> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    console.warn('[getCRMStats] Missing tenantId for current user');
    return EMPTY_CRM_STATS;
  }
  const todayStr = getLocalDateString(new Date());

  const { count: totalRemindersSent, error: remindersError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('zalo_reminder_sent', true);

  if (remindersError) {
    throw new Error(`[getCRMStats] session_logs sent-reminders count failed: ${remindersError.message}`);
  }

  const { count: pendingRemindersToday, error: pendingError } = await supabase
    .from('session_logs')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'scheduled')
    .eq('assigned_date', todayStr)
    .eq('zalo_reminder_sent', false);

  if (pendingError) {
    throw new Error(`[getCRMStats] session_logs pending-reminders count failed: ${pendingError.message}`);
  }

  const { data: customers, error: birthdaysError } = await supabase
    .from('customers')
    .select('dob_baby')
    .eq('tenant_id', tenantId)
    .not('dob_baby', 'is', null);

  if (birthdaysError) {
    throw new Error(`[getCRMStats] customers birthday query failed: ${birthdaysError.message}`);
  }

  let totalBirthdaysToday = 0;
  let totalBirthdaysMonth = 0;

  if (customers) {
    const now = new Date();
    const currentMonth = now.getMonth() + 1;
    const currentDay = now.getDate();

    customers.forEach((customer) => {
      if (!customer.dob_baby) return;
      const dob = new Date(customer.dob_baby);
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
    totalBirthdaysMonth,
  };
}

export async function getUpcomingSessions() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    console.warn('[getUpcomingSessions] Missing tenantId for current user');
    return [];
  }
  const todayStr = getLocalDateString(new Date());

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = getLocalDateString(tomorrow);

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
    throw new Error(`[getUpcomingSessions] session_logs upcoming query failed: ${error.message}`);
  }

  return data || [];
}
