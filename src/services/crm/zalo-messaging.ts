'use server';

import { createClient } from '@/lib/supabase-server';
import { getTenantPresentationFromModules } from '@/lib/business-rules/tenant-module-presentation';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import { getCurrentUser } from '../user-actions';
import { getLocalDateString } from '@/lib/utils';
import { recordAuditLog } from '../audit-actions';
import { pickFirstTenantRow } from './tenant-row';
import { getOrRefreshZaloToken } from './zalo-config';

export async function sendZaloZNS(
  tenantId: string,
  phone: string,
  templateId: string,
  templateData: Record<string, unknown>
): Promise<{ success: boolean; data?: unknown; error?: string }> {
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
  } catch (err: unknown) {
    console.error(`Exception in sendZaloZNS for tenant ${tenantId}:`, err);
    return { success: false, error: err instanceof Error ? err.message : 'Lỗi kết nối API Zalo ZNS' };
  }
}

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
  } catch {
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
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !session) {
      return { error: 'Không tìm thấy thông tin buổi chăm sóc: ' + (fetchErr?.message || '') };
    }

    const customer = session.bookings?.customers;
    if (!customer) {
      return { error: 'Không tìm thấy thông tin khách hàng.' };
    }

    const customerName = customer.name_mother || 'Khách hàng';
    const timeStr = session.assigned_time ? session.assigned_time.substring(0, 5) : '08:00';
    const dateStr = session.assigned_date;

    // Fetch tenant Zalo Template config
    const { data: tenantRows, error: tenantErr } = await supabase
      .from('tenants')
      .select('name, contact_phone, logo_url, brand_theme, enabled_modules, zalo_template_reminder_id')
      .eq('id', tenantId)
      .limit(1);

    if (tenantErr) {
      return { error: 'Không thể tải cấu hình Zalo nhắc lịch: ' + tenantErr.message };
    }

    const tenant = pickFirstTenantRow(tenantRows);
    const tenantBrand = resolveTenantBrandIdentity({
      enabledModules: tenant?.enabled_modules,
      brandTheme: tenant?.brand_theme,
      logoUrl: tenant?.logo_url,
      tenantName: tenant?.name,
      surface: 'app',
    });
    const customerLabels = getTenantPresentationFromModules(tenant?.enabled_modules);
    const packageName = session.bookings?.package_name || 'dịch vụ đã đặt';
    const secondaryProfile = customer.name_baby
      ? `${customerLabels.secondaryPrefix} ${customer.name_baby}`
      : customerLabels.secondaryFallback;
    const reminderTarget = tenantBrand.isBeautySpa ? packageName : secondaryProfile;
    const fallbackAddress = tenantBrand.isBeautySpa ? 'Theo lịch hẹn' : 'Tại nhà';
    const ktvName = session.bookings?.assigned_ktv?.full_name || `KTV ${tenantBrand.displayName}`;
    const rawHotline = typeof tenant?.contact_phone === 'string' ? tenant.contact_phone.trim() : '';
    const displayHotline = rawHotline
      ? rawHotline.replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3')
      : 'chưa cập nhật';
    const templateId = tenant?.zalo_template_reminder_id || 'ZNS_REMINDER_V2';

    // Business standard message text for logs / simulated fallback
    const appointmentText = tenantBrand.isBeautySpa
      ? `lịch hẹn ${packageName}`
      : `lịch hẹn chăm sóc tại nhà cho ${secondaryProfile}`;
    const message = `Kính gửi chị ${customerName}, ${tenantBrand.displayName} xin nhắc ${appointmentText} vào lúc ${timeStr} hôm nay (${dateStr}). KTV phụ trách: ${ktvName}. Địa chỉ: ${session.address || fallbackAddress}. Hotline hỗ trợ: ${displayHotline}.`;

    // Attempt real ZNS sending if phone is available
    let isRealSent = false;
    let zaloError = '';

    await incrementSmsCount(tenantId);

    const phoneVal = customer.phone;
    if (phoneVal) {
      const templateData = {
        customer_name: customerName,
        baby_name: reminderTarget,
        appointment_time: `${timeStr} ngày ${dateStr}`,
        ktv_name: ktvName,
        address: session.address || fallbackAddress,
        hotline: displayHotline
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
      .eq('id', sessionLogId)
      .eq('tenant_id', tenantId);

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
      return { error: 'Không thể lưu nhật ký thông báo Zalo: ' + notifErr.message };
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

    return { success: true, message: logMessage };
  } catch (error: unknown) {
    console.error('Error triggering Zalo reminder:', error);
    return { error: error instanceof Error ? error.message : 'Lỗi hệ thống khi gửi Zalo reminder.' };
  }
}

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
      } catch {
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
        
        tenantIds = (activeTenants || []).map((t) => t.id);
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
    let skippedCount = 0;
    const messagesSent: string[] = [];
    const errors: string[] = [];
    const quotaSkipped: string[] = [];
    const { checkSubscriptionLimit } = await import('@/lib/subscription');

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

      const now = new Date();
      const currentVNMinutes = now.getUTCHours() * 60 + now.getUTCMinutes() + 420; // 420 mins offset for GMT+7
      const dayMinutes = currentVNMinutes % 1440;
      const dueSessions = sessions.filter((session) => {
        if (!session.assigned_time) return false;

        const parts = session.assigned_time.split(':');
        const sessionMinutes = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        const diff = sessionMinutes - dayMinutes;
        return diff >= -30 && diff <= 150;
      });

      if (dueSessions.length === 0) {
        continue;
      }

      const smsLimit = await checkSubscriptionLimit(tenantId, 'sms');
      const isFiniteQuota = smsLimit.max < 999999;
      let remainingQuota = isFiniteQuota ? Math.max(smsLimit.max - smsLimit.current, 0) : Number.POSITIVE_INFINITY;

      if (smsLimit.isBlocked || remainingQuota <= 0) {
        skippedCount += dueSessions.length;
        quotaSkipped.push(`Tenant ${tenantId}: bỏ qua ${dueSessions.length} lịch do hết hạn ngạch Zalo/SMS.`);
        continue;
      }

      for (const session of dueSessions) {
        if (remainingQuota <= 0) {
          skippedCount++;
          quotaSkipped.push(`Session ${session.id}: bỏ qua do hết hạn ngạch Zalo/SMS trong batch.`);
          continue;
        }

        if (isFiniteQuota) {
          remainingQuota--;
        }

        const result = await triggerZaloReminder(session.id, tenantId);
        if (result.success && result.message) {
          totalCount++;
          messagesSent.push(result.message);
        } else if (result.error) {
          errors.push(`Session ${session.id}: ${result.error}`);
        }
      }
    }

    return {
      count: totalCount,
      skipped: skippedCount,
      messages: messagesSent,
      errors: errors.length > 0 ? errors : undefined,
      quotaSkipped: quotaSkipped.length > 0 ? quotaSkipped : undefined,
      info: `Đã quét và tự động gửi ${totalCount} thông báo nhắc hẹn qua Zalo${skippedCount > 0 ? `; bỏ qua ${skippedCount} lịch do hạn ngạch.` : '.'}`
    };
  } catch (err: unknown) {
    console.error('Error in triggerBatchReminders:', err);
    return { error: err instanceof Error ? err.message : 'Lỗi hệ thống khi chạy quét lịch hẹn.' };
  }
}
