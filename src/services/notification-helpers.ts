import { createClient } from '@/lib/supabase-server';

export async function createSystemNotification(params: {
  userId: string;
  title: string;
  message: string;
  tenantId: string;
  type?: string;
}) {
  try {
    const supabase = await createClient();
    const id = `notif_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const now = new Date().toISOString();
    
    const { error } = await supabase
      .from('Notification')
      .insert({
        id,
        userId: params.userId,
        title: params.title,
        message: params.message,
        tenantId: params.tenantId,
        type: params.type || 'system',
        isRead: false,
        createdAt: now,
        updatedAt: now
      });

    if (error) {
      console.error('[createSystemNotification] Error inserting notification:', error);
    }
  } catch (err) {
    console.error('[createSystemNotification] Exception:', err);
  }
}

export async function checkAndGenerateKtvAlertNotifications(userId: string, tenantId: string) {
  try {
    const supabase = await createClient();
    
    // 1. Check forgotten day check-out (attendance)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const lastWeekStr = sevenDaysAgo.toISOString().slice(0, 10);
    const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });
    
    // Check if current time in VN is >= 21:00 (2 hours after official Spa closing time 19:00)
    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const currentHourVN = nowVN.getHours();

    let query = supabase
      .from('attendance')
      .select('date, checkin_time, checkout_time')
      .eq('ktv_id', userId)
      .gte('date', lastWeekStr)
      .is('checkout_time', null);

    if (currentHourVN >= 21) {
      // Include today (date <= todayStr)
      query = query.lte('date', todayStr);
    } else {
      // Only up to yesterday (date < todayStr)
      query = query.lt('date', todayStr);
    }

    const { data: attendanceLogs } = await query;

    if (attendanceLogs && attendanceLogs.length > 0) {
      for (const log of attendanceLogs) {
        const notifId = `checkout_alert_${userId}_${log.date}`;
        // Check if notification already exists to prevent duplicate inserts
        const { data: existingNotif } = await supabase
          .from('Notification')
          .select('id')
          .eq('id', notifId)
          .maybeSingle();

        if (!existingNotif) {
          const dateFormatted = log.date.split('-').reverse().join('/');
          await supabase.from('Notification').insert({
            id: notifId,
            userId,
            title: 'Quên check-out ngày làm ⏰',
            message: `Hệ thống ghi nhận bạn đã quên check-out ngày làm việc ${dateFormatted}. Vui lòng báo Admin cập nhật bổ sung.`,
            tenantId,
            type: 'alert',
            isRead: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }
    }

    // 2. Check forgotten session check-out (in-progress sessions left hanging)
    const { data: activeSessions } = await supabase
      .from('session_logs')
      .select(`
        id, 
        session_number, 
        start_time, 
        assigned_date,
        bookings (
          package_name, 
          customers (
            name_mother
          )
        )
      `)
      .eq('completed_by_ktv_id', userId)
      .eq('status', 'in_progress');

    if (activeSessions && activeSessions.length > 0) {
      const now = new Date();
      for (const session of activeSessions) {
        if (!session.start_time) continue;
        const startTime = new Date(session.start_time);
        const hoursPassed = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

        // If session is running for more than 4 hours (unusually long, likely forgot to complete)
        if (hoursPassed > 4) {
          const notifId = `session_timeout_${userId}_${session.id}`;
          const { data: existingNotif } = await supabase
            .from('Notification')
            .select('id')
            .eq('id', notifId)
            .maybeSingle();

          if (!existingNotif) {
            const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
            const customerName = (booking as Record<string, unknown> & { customers?: { name_mother?: string } })?.customers?.name_mother || 'Khách hàng';
            const packageName = booking?.package_name || 'Dịch vụ';
            const startTimeFormatted = startTime.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) + ' ' + startTime.toLocaleDateString('vi-VN');

            await supabase.from('Notification').insert({
              id: notifId,
              userId,
              title: 'Ca làm việc bị treo ⚠️',
              message: `Ca số ${session.session_number} gói ${packageName} cho khách ${customerName} bắt đầu lúc ${startTimeFormatted} chưa được hoàn thành. Vui lòng bấm kết thúc ca.`,
              tenantId,
              type: 'alert',
              isRead: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            });
          }
        }
      }
    }
  } catch (err) {
    console.error('[checkAndGenerateKtvAlertNotifications] Exception:', err);
  }
}

export async function checkAndGenerateAdminAlertNotifications(tenantId: string) {
  try {
    const supabase = await createClient();

    // 1. Get current date in Vietnam (YYYY-MM-DD)
    const nowVN = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Ho_Chi_Minh' }));
    const todayStr = nowVN.toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' });

    // 2. Fetch scheduled sessions of today for this tenant
    const { data: scheduledSessions } = await supabase
      .from('session_logs')
      .select(`
        id,
        session_number,
        assigned_date,
        assigned_time,
        completed_by_ktv_id,
        bookings (
          assigned_ktv_id,
          package_name,
          customers (
            name_mother
          )
        )
      `)
      .eq('tenant_id', tenantId)
      .eq('status', 'scheduled')
      .eq('assigned_date', todayStr);

    if (scheduledSessions && scheduledSessions.length > 0) {
      // Fetch all Admin/Accountant users of this tenant to notify
      const { data: adminUsers } = await supabase
        .from('users')
        .select('id')
        .eq('tenant_id', tenantId)
        .in('role', ['admin', 'super_admin', 'admin_staff', 'accountant', 'hq_staff']);

      if (!adminUsers || adminUsers.length === 0) return;

      for (const session of scheduledSessions) {
        if (!session.assigned_time) continue;

        // Parse assigned_time (HH:MM) to compare with nowVN
        const [hourStr, minStr] = session.assigned_time.split(':');
        const scheduledTime = new Date(nowVN);
        scheduledTime.setHours(Number(hourStr), Number(minStr), 0, 0);

        const diffMinutes = (nowVN.getTime() - scheduledTime.getTime()) / (1000 * 60);

        // If current time is > 15 minutes after scheduled starting time
        if (diffMinutes > 15) {
          // Fetch KTV name
          const targetKtvId = session.completed_by_ktv_id || (session.bookings as Record<string, unknown> & { assigned_ktv_id?: string })?.assigned_ktv_id;
          let ktvName = 'Chưa phân công KTV';

          if (targetKtvId) {
            const { data: ktvUser } = await supabase
              .from('users')
              .select('full_name')
              .eq('id', targetKtvId)
              .maybeSingle();
            
            if (ktvUser?.full_name) {
              ktvName = ktvUser.full_name;
            }
          }

          const booking = Array.isArray(session.bookings) ? session.bookings[0] : session.bookings;
          const customerName = (booking as Record<string, unknown> & { customers?: { name_mother?: string } })?.customers?.name_mother || 'Khách hàng';
          const packageName = (booking as Record<string, unknown> & { package_name?: string })?.package_name || 'Dịch vụ';

          for (const admin of adminUsers) {
            const notifId = `session_no_checkin_${session.id}_${admin.id}`;

            // Check if notification already exists to avoid duplicate insertions
            const { data: existingNotif } = await supabase
              .from('Notification')
              .select('id')
              .eq('id', notifId)
              .maybeSingle();

            if (!existingNotif) {
              await supabase.from('Notification').insert({
                id: notifId,
                userId: admin.id,
                title: 'Trễ check-in ca làm 🚨',
                message: `KTV ${ktvName} chưa check-in ca số ${session.session_number} gói ${packageName} của khách ${customerName} (Lịch hẹn lúc ${session.assigned_time} hôm nay). Trễ hơn 15 phút.`,
                tenantId,
                type: 'alert',
                isRead: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[checkAndGenerateAdminAlertNotifications] Exception:', err);
  }
}
