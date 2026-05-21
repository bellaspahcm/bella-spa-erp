'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from './user-actions';
import { getLocalDateString } from '@/lib/utils';
import { recordAuditLog } from './audit-actions';
import { encrypt, decrypt } from '@/lib/crypto';

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

/**
 * Triggers a Zalo OA / ZNS reminder for a specific session log
 */
export interface ZaloConfig {
  zalo_app_id: string | null;
  zalo_secret_key: string | null;
  zalo_oa_id: string | null;
  zalo_access_token: string | null;
  zalo_refresh_token: string | null;
  zalo_token_expires_at: string | null;
  zalo_template_reminder_id: string | null;
  zalo_template_birthday_id: string | null;
  zalo_auto_scan: boolean;
}

/**
 * Fetches Zalo configuration for the current tenant
 */
export async function getZaloConfig(): Promise<ZaloConfig> {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  
  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID is required');
  }

  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('zalo_app_id, zalo_secret_key, zalo_oa_id, zalo_access_token, zalo_refresh_token, zalo_token_expires_at, zalo_template_reminder_id, zalo_template_birthday_id, zalo_auto_scan')
      .eq('id', tenantId)
      .single();

    if (error) {
      console.error('Error fetching Zalo config:', error);
      return {
        zalo_app_id: '',
        zalo_secret_key: '',
        zalo_oa_id: '',
        zalo_access_token: '',
        zalo_refresh_token: '',
        zalo_token_expires_at: '',
        zalo_template_reminder_id: '',
        zalo_template_birthday_id: '',
        zalo_auto_scan: true
      };
    }

    return {
      zalo_app_id: data.zalo_app_id || '',
      zalo_secret_key: decrypt(data.zalo_secret_key || ''),
      zalo_oa_id: data.zalo_oa_id || '',
      zalo_access_token: decrypt(data.zalo_access_token || ''),
      zalo_refresh_token: decrypt(data.zalo_refresh_token || ''),
      zalo_token_expires_at: data.zalo_token_expires_at || '',
      zalo_template_reminder_id: data.zalo_template_reminder_id || '',
      zalo_template_birthday_id: data.zalo_template_birthday_id || '',
      zalo_auto_scan: data.zalo_auto_scan !== false
    };
  } catch (error) {
    console.error('Error in getZaloConfig:', error);
    return {
      zalo_app_id: '',
      zalo_secret_key: '',
      zalo_oa_id: '',
      zalo_access_token: '',
      zalo_refresh_token: '',
      zalo_token_expires_at: '',
      zalo_template_reminder_id: '',
      zalo_template_birthday_id: '',
      zalo_auto_scan: true
    };
  }
}

/**
 * Saves Zalo configuration  */
export async function saveZaloConfig(config: Partial<ZaloConfig>) {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    throw new Error('Unauthorized: Tenant ID is required');
  }

  try {
    // Encrypt sensitive credential fields before saving to DB
    const encryptedConfig = { ...config };
    if (config.zalo_secret_key) {
      encryptedConfig.zalo_secret_key = encrypt(config.zalo_secret_key);
    }
    if (config.zalo_access_token) {
      encryptedConfig.zalo_access_token = encrypt(config.zalo_access_token);
    }
    if (config.zalo_refresh_token) {
      encryptedConfig.zalo_refresh_token = encrypt(config.zalo_refresh_token);
    }

    const { error } = await supabase
      .from('tenants')
      .update(encryptedConfig)
      .eq('id', tenantId);

    if (error) {
      console.error('Error saving Zalo config:', error);
      return { error: 'Lỗi lưu cấu hình: ' + error.message };
    }

    // Mask sensitive keys in audit log
    const auditConfig = { ...config };
    if (auditConfig.zalo_secret_key) auditConfig.zalo_secret_key = '••••••••';
    if (auditConfig.zalo_access_token) auditConfig.zalo_access_token = '••••••••';
    if (auditConfig.zalo_refresh_token) auditConfig.zalo_refresh_token = '••••••••';

    await recordAuditLog({
      action: 'UPDATE',
      table_name: 'tenants',
      record_id: tenantId,
      new_data: auditConfig
    });

    return { success: true };
  } catch (error: any) {
    console.error('Error in saveZaloConfig:', error);
    return { error: error.message || 'Lỗi hệ thống khi lưu cấu hình.' };
  }
}

/**
 * Retrieves the current Zalo access token.
 * Refreshes it automatically if it is expired (or close to expiring).
 * Falls back to null if Zalo is not fully configured (so the calling code can drop back to Sandbox mode).
 */
export async function getOrRefreshZaloToken(tenantId: string): Promise<string | null> {
  const supabase = await createClient();
  
  try {
    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('zalo_app_id, zalo_secret_key, zalo_access_token, zalo_refresh_token, zalo_token_expires_at')
      .eq('id', tenantId)
      .single();

    if (error || !tenant) {
      console.error('Error fetching tenant for Zalo token:', error);
      return null;
    }

    const { zalo_app_id, zalo_secret_key, zalo_access_token, zalo_refresh_token, zalo_token_expires_at } = tenant;

    // Decrypt fields
    const decryptedSecretKey = decrypt(zalo_secret_key || '');
    const decryptedAccessToken = decrypt(zalo_access_token || '');
    const decryptedRefreshToken = decrypt(zalo_refresh_token || '');

    // Check if configuration is missing or using mock values
    if (!zalo_app_id || !decryptedSecretKey || !decryptedAccessToken || !decryptedRefreshToken) {
      return null;
    }
    if (decryptedSecretKey.includes('••') || decryptedAccessToken.includes('••') || decryptedRefreshToken.includes('••') ||
        decryptedSecretKey === '' || decryptedAccessToken === '' || decryptedRefreshToken === '') {
      return null;
    }

    // Check if the current token is still valid (with a 5-minute buffer)
    const now = new Date();
    const bufferTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 mins in the future
    if (zalo_token_expires_at) {
      const expiresAt = new Date(zalo_token_expires_at);
      if (expiresAt > bufferTime) {
        return decryptedAccessToken;
      }
    }

    // Access token has expired or is about to expire, refresh it!
    console.log(`Zalo access token expired for tenant ${tenantId}. Refreshing...`);
    
    const response = await fetch('https://oauth.zaloapp.com/v4/oa/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'secret_key': decryptedSecretKey
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: decryptedRefreshToken,
        app_id: zalo_app_id
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Failed to refresh Zalo token for tenant ${tenantId}. Status: ${response.status}. Error:`, errText);
      return null;
    }

    const result = await response.json();
    if (!result || !result.access_token) {
      console.error(`Invalid response from Zalo OAuth for tenant ${tenantId}:`, result);
      return null;
    }

    const newAccessToken = result.access_token;
    const newRefreshToken = result.refresh_token || decryptedRefreshToken; // Keep old refresh token if not returned
    const expiresIn = parseInt(result.expires_in) || 86400; // default 24h if missing
    const newExpiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    // Save the new tokens to the DB
    const { error: saveError } = await supabase
      .from('tenants')
      .update({
        zalo_access_token: encrypt(newAccessToken),
        zalo_refresh_token: encrypt(newRefreshToken),
        zalo_token_expires_at: newExpiresAt
      })
      .eq('id', tenantId);

    if (saveError) {
      console.error(`Error saving refreshed Zalo tokens to DB for tenant ${tenantId}:`, saveError);
    } else {
      console.log(`Successfully refreshed Zalo access token for tenant ${tenantId}. Expires at: ${newExpiresAt}`);
    }

    return newAccessToken;
  } catch (err) {
    console.error(`Exception in getOrRefreshZaloToken for tenant ${tenantId}:`, err);
    return null;
  }
}

/**
 * Sends a real Zalo ZNS (template) message if access token is available.
 * Cleans phone number to Vietnamese international format: "84XXXXXXXXX".
 */
export async function sendZaloZNS(
  tenantId: string,
  phone: string,
  templateId: string,
  templateData: Record<string, any>
): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    // 1. Get or refresh Zalo token
    const token = await getOrRefreshZaloToken(tenantId);
    if (!token) {
      return { success: false, error: 'Cấu hình Zalo chưa đầy đủ hoặc không hợp lệ.' };
    }

    // 2. Format phone number to 84xxxxxxxxx
    let cleanedPhone = phone.replace(/\D/g, ''); // Remove non-digits
    if (cleanedPhone.startsWith('0')) {
      cleanedPhone = '84' + cleanedPhone.substring(1);
    } else if (!cleanedPhone.startsWith('84') && cleanedPhone.length > 0) {
      cleanedPhone = '84' + cleanedPhone;
    }

    if (cleanedPhone.length < 11 || cleanedPhone.length > 13) {
      return { success: false, error: `Số điện thoại không hợp lệ để gửi ZNS: ${phone}` };
    }

    // 3. Make real API request
    console.log(`Sending Zalo ZNS template message to ${cleanedPhone} using template ${templateId}...`);
    const response = await fetch('https://business.openapi.zalo.me/message/template', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': token
      },
      body: JSON.stringify({
        phone: cleanedPhone,
        template_id: templateId,
        template_data: templateData
      })
    });

    const result = await response.json();
    if (!response.ok || (result && result.error !== 0)) {
      const errMsg = result ? `${result.message} (Code: ${result.error})` : `HTTP ${response.status}`;
      console.error(`Zalo ZNS send failed for phone ${cleanedPhone}:`, errMsg);
      return { success: false, error: `API Zalo báo lỗi: ${errMsg}`, data: result };
    }

    console.log(`Zalo ZNS successfully sent to ${cleanedPhone}. Message ID:`, result?.data?.message_id);
    return { success: true, data: result };
  } catch (err: any) {
    console.error(`Exception in sendZaloZNS for tenant ${tenantId}:`, err);
    return { success: false, error: err.message || 'Lỗi kết nối API Zalo ZNS' };
  }
}

/**
 * Triggers a Zalo OA / ZNS reminder for a specific session log
 */
export async function triggerZaloReminder(sessionLogId: string, tenantIdOverride?: string) {
  const supabase = await createClient();
  
  let tenantId = tenantIdOverride;
  let currentUserId = '';
  
  try {
    const currentUser = await getCurrentUser();
    currentUserId = currentUser?.id || '';
    if (!tenantId) {
      tenantId = currentUser?.tenant_id || undefined;
    }
  } catch (e) {
    // Suppress error if no active session (e.g. Cron job)
  }

  if (!tenantId) {
    return { error: 'Không thể xác định chi nhánh (Tenant ID is required).' };
  }

  const { checkSubscriptionLimit, incrementSmsCount } = await import('@/lib/subscription');
  const smsLimit = await checkSubscriptionLimit(tenantId, 'sms');
  if (smsLimit.isBlocked) {
    return { error: 'Vượt quá hạn mức gửi tin nhắn Zalo ZNS của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.' };
  }

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
      return { error: 'Không tìm thấy thông tin buổi chăm sóc: ' + (fetchErr?.message || '') };
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

    // Fetch tenant Zalo Template config
    const { data: tenant } = await supabase
      .from('tenants')
      .select('zalo_template_reminder_id')
      .eq('id', tenantId)
      .single();

    const templateId = tenant?.zalo_template_reminder_id || 'ZNS_REMINDER_V2';

    // Business standard message text for logs / simulated fallback
    const message = `Kính gửi chị ${motherName}, Bella Spa xin nhắc lịch hẹn chăm sóc tại nhà cho ${babyName} vào lúc ${timeStr} hôm nay (${dateStr}). KTV phụ trách: ${ktvName}. Địa chỉ: ${session.address || 'Tại nhà'}. Hotline hỗ trợ: 0865 701 493.`;

    // Attempt real ZNS sending if phone is available
    let isRealSent = false;
    let zaloError = '';

    const phoneVal = customer.phone;
    if (phoneVal) {
      const templateData = {
        customer_name: motherName,
        baby_name: babyName,
        appointment_time: `${timeStr} ngày ${dateStr}`,
        ktv_name: ktvName,
        address: session.address || 'Tại nhà',
        hotline: '0865 701 493'
      };

      const znsRes = await sendZaloZNS(tenantId as string, phoneVal as string, templateId, templateData);
      if (znsRes.success) {
        isRealSent = true;
      } else {
        zaloError = znsRes.error || '';
      }
    } else {
      zaloError = 'Khách hàng không có số điện thoại';
    }

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

    const logMessage = isRealSent
      ? `Đã gửi ZNS [Hệ thống Thực] đến số ${customer.phone || 'N/A'}: "${message}"`
      : `[Mô phỏng] Đã gửi ZNS đến số ${customer.phone || 'N/A'} (Lý do Sandbox: ${zaloError}): "${message}"`;

    // 3. Log to public.Notification for UI monitoring
    const { error: notifErr } = await supabase
      .from('Notification')
      .insert({
        id: `zalo_${sessionLogId}_${Date.now()}`,
        userId: currentUserId || session.bookings?.assigned_ktv?.id || '',
        title: isRealSent ? 'Nhắc lịch Zalo ZNS thành công' : 'Nhắc lịch Zalo (Mô phỏng Sandbox)',
        message: logMessage,
        type: 'zalo_zns',
        tenantId,
        isRead: false,
        updatedAt: new Date().toISOString()
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
        message_sent: message,
        real_zalo_sent: isRealSent,
        zalo_error: zaloError || null
      }
    });

    // 5. Increment SMS Count
    await incrementSmsCount(tenantId);

    return { success: true, message: logMessage };
  } catch (error: any) {
    console.error('Error triggering Zalo reminder:', error);
    return { error: error.message || 'Lỗi hệ thống khi gửi Zalo reminder.' };
  }
}

/**
 * Automatically scans today's scheduled sessions for a tenant (or all active tenants)
 * and triggers alerts for those that start in the next 2.5 hours and haven't been reminded.
 */
export async function triggerBatchReminders(specificTenantId?: string) {
  const supabase = await createClient();
  let tenantIds: string[] = [];

  try {
    if (specificTenantId) {
      tenantIds = [specificTenantId];
    } else {
      try {
        const currentUser = await getCurrentUser();
        if (currentUser?.tenant_id) {
          tenantIds = [currentUser.tenant_id];
        }
      } catch (e) {
        // Suppress session check error in cron environment
      }

      if (tenantIds.length === 0) {
        // Cron job scenario: fetch all active tenants
        const { data: activeTenants, error: tenantErr } = await supabase
          .from('tenants')
          .select('id')
          .eq('status', 'active');
        
        if (tenantErr) {
          console.error('Error fetching active tenants for cron:', tenantErr);
          return { error: 'Không thể lấy danh sách chi nhánh: ' + tenantErr.message };
        }
        
        tenantIds = (activeTenants || []).map((t: any) => t.id);
      }
    }

    if (tenantIds.length === 0) {
      return {
        count: 0,
        messages: [],
        info: 'Không tìm thấy chi nhánh hoạt động nào để quét lịch.'
      };
    }

    const todayStr = getLocalDateString(new Date());
    let totalCount = 0;
    const messagesSent: string[] = [];
    const errors: string[] = [];

    for (const tenantId of tenantIds) {
      // Fetch today's scheduled sessions for this tenant that have not been reminded
      const { data: sessions, error } = await supabase
        .from('session_logs')
        .select('id, assigned_time')
        .eq('tenant_id', tenantId)
        .eq('assigned_date', todayStr)
        .eq('status', 'scheduled')
        .eq('zalo_reminder_sent', false);

      if (error) {
        console.error(`Error scanning sessions for tenant ${tenantId}:`, error);
        errors.push(`Tenant ${tenantId}: ${error.message}`);
        continue;
      }

      if (!sessions || sessions.length === 0) {
        continue;
      }

      // Filter sessions within the next 2.5 hours
      const now = new Date();
      // Current minutes since start of day in GMT+7
      const currentVNMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 420; // 420 mins offset for GMT+7
      const dayMinutes = currentVNMinutes % 1440;

      for (const session of sessions) {
        if (!session.assigned_time) continue;
        
        const parts = session.assigned_time.split(':');
        const sessionMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);

        // Remind if session starts in the next 150 minutes (2.5 hours)
        // or if it is already past the scheduled time slightly but not sent yet.
        const diff = sessionMinutes - dayMinutes;
        if (diff >= -30 && diff <= 150) {
          const result = await triggerZaloReminder(session.id, tenantId);
          if (result.success && result.message) {
            totalCount++;
            messagesSent.push(result.message);
          } else if (result.error) {
            errors.push(`Session ${session.id}: ${result.error}`);
          }
        }
      }
    }

    return {
      count: totalCount,
      messages: messagesSent,
      errors: errors.length > 0 ? errors : undefined,
      info: `Đã quét và tự động gửi ${totalCount} thông báo nhắc hẹn qua Zalo.`
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
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    console.warn('[getBirthdayCustomers] Không tìm thấy tenantId cho người dùng hiện tại');
    return [];
  }

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
 * Sends a simulated/real Birthday Greeting & Voucher via Zalo OA
 */
export async function sendBirthdayGreeting(customerId: string, voucherCode: string, tenantIdOverride?: string) {
  const supabase = await createClient();
  
  let tenantId = tenantIdOverride;
  let currentUserId = '';

  try {
    const currentUser = await getCurrentUser();
    currentUserId = currentUser?.id || '';
    if (!tenantId) {
      tenantId = currentUser?.tenant_id || undefined;
    }
  } catch (e) {
    // Suppress
  }

  if (!tenantId) {
    return { error: 'Không xác định được chi nhánh (Tenant ID is required).' };
  }

  const { checkSubscriptionLimit, incrementSmsCount } = await import('@/lib/subscription');
  const smsLimit = await checkSubscriptionLimit(tenantId, 'sms');
  if (smsLimit.isBlocked) {
    return { error: 'Vượt quá hạn mức gửi tin nhắn Zalo ZNS của gói dịch vụ hiện tại. Vui lòng nâng cấp gói cước.' };
  }

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

    // Fetch tenant Zalo Template config
    const { data: tenant } = await supabase
      .from('tenants')
      .select('zalo_template_birthday_id')
      .eq('id', tenantId)
      .single();

    const templateId = tenant?.zalo_template_birthday_id || 'ZNS_BIRTHDAY_GIFT_V1';

    // Attempt real ZNS sending if phone is available
    let isRealSent = false;
    let zaloError = '';

    const phoneVal = customer.phone;
    if (phoneVal) {
      const templateData = {
        customer_name: motherName,
        baby_name: babyName,
        voucher_code: voucherCode,
        discount_percent: '10%',
        hotline: '0865 701 493'
      };

      const znsRes = await sendZaloZNS(tenantId as string, phoneVal as string, templateId, templateData);
      if (znsRes.success) {
        isRealSent = true;
      } else {
        zaloError = znsRes.error || '';
      }
    } else {
      zaloError = 'Khách hàng không có số điện thoại';
    }

    const logMessage = isRealSent
      ? `Đã gửi tin nhắn quà tặng sinh nhật [Hệ thống Thực] đến số ${customer.phone || 'N/A'}: "${message}"`
      : `[Mô phỏng] Đã gửi tin nhắn quà tặng sinh nhật đến số ${customer.phone || 'N/A'} (Lý do Sandbox: ${zaloError}): "${message}"`;

    // Log to public.Notification for verification
    const { error: notifErr } = await supabase
      .from('Notification')
      .insert({
        id: `bday_${customerId}_${Date.now()}`,
        userId: currentUserId || '',
        title: isRealSent ? 'Gửi Zalo Chúc mừng sinh nhật & Voucher thành công' : 'Gửi Zalo Chúc mừng sinh nhật (Mô phỏng Sandbox)',
        message: logMessage,
        type: 'zalo_birthday',
        tenantId,
        isRead: false,
        updatedAt: new Date().toISOString()
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
        message_sent: message,
        real_zalo_sent: isRealSent,
        zalo_error: zaloError || null
      }
    });

    // Increment the SMS allotment count
    await incrementSmsCount(tenantId);

    return { success: true, message: logMessage };
  } catch (error: any) {
    console.error('Error sending birthday greeting:', error);
    return { error: error.message || 'Lỗi hệ thống khi gửi lời chúc.' };
  }
}

/**
 * Fetch recently sent Zalo ZNS logs
 */
export async function getZaloZnsLogs() {
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;

  if (!tenantId) {
    console.warn('[getZaloZnsLogs] Không tìm thấy tenantId cho người dùng hiện tại');
    return [];
  }

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
