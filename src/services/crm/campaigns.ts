'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '../user-actions';
import { recordAuditLog } from '../audit-actions';
import { sendZaloZNS } from './zalo-messaging';

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
      throw new Error(`Failed to fetch birthday customers: ${error.message}`);
    }

    const now = new Date();
    const currentMonth = now.getMonth() + 1; // 1-12
    const currentDay = now.getDate();

    // Map birthdays details
    return (customers || []).map((c) => {
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
    }).filter((c) => c.daysUntil !== -999).sort((a, b) => a.daysUntil - b.daysUntil);

  } catch (error) {
    console.error('Error in getBirthdayCustomers:', error);
    throw error instanceof Error
      ? error
      : new Error('Failed to fetch birthday customers');
  }
}

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
  } catch {
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
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('zalo_template_birthday_id')
      .eq('id', tenantId)
      .single();

    if (tenantErr) {
      return { error: 'Không thể tải cấu hình Zalo sinh nhật: ' + tenantErr.message };
    }

    const templateId = tenant?.zalo_template_birthday_id || 'ZNS_BIRTHDAY_GIFT_V1';

    await incrementSmsCount(tenantId);

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
      return { error: 'Không thể lưu nhật ký thông báo sinh nhật: ' + notifErr.message };
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

    return { success: true, message: logMessage };
  } catch (error: unknown) {
    console.error('Error sending birthday greeting:', error);
    return { error: error instanceof Error ? error.message : 'Lỗi hệ thống khi gửi lời chúc.' };
  }
}
