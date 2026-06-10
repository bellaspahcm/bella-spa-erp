'use server';

import { createClient } from '@/lib/supabase-server';
import { getTenantPresentationFromModules } from '@/lib/business-rules/tenant-module-presentation';
import { resolveTenantBrandIdentity } from '@/lib/business-rules/tenant-modules';
import { getCurrentUser } from '../user-actions';
import { recordAuditLog } from '../audit-actions';
import { pickFirstTenantRow } from './tenant-row';
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
      .eq('tenant_id', tenantId)
      .single();

    if (fetchErr || !customer) {
      return { error: 'Không tìm thấy khách hàng.' };
    }

    // Fetch tenant Zalo Template config
    const { data: tenantRows, error: tenantErr } = await supabase
      .from('tenants')
      .select('name, contact_phone, logo_url, brand_theme, enabled_modules, zalo_template_birthday_id')
      .eq('id', tenantId)
      .limit(1);

    if (tenantErr) {
      return { error: 'Không thể tải cấu hình Zalo sinh nhật: ' + tenantErr.message };
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
    const customerName = customer.name_mother || 'Quý khách';
    const secondaryProfile = customer.name_baby || (tenantBrand.isBeautySpa ? customerLabels.secondaryFallback : 'Bé');
    const rawHotline = typeof tenant?.contact_phone === 'string' ? tenant.contact_phone.trim() : '';
    const displayHotline = rawHotline
      ? rawHotline.replace(/^(\d{4})(\d{3})(\d+)$/, '$1 $2 $3')
      : 'chưa cập nhật';
    const templateId = tenant?.zalo_template_birthday_id || 'ZNS_BIRTHDAY_GIFT_V1';
    const message = tenantBrand.isBeautySpa
      ? `${tenantBrand.displayName} chúc mừng sinh nhật ${customerName}! Nhân dịp đặc biệt này, ${tenantBrand.displayName} thân gửi tặng voucher giảm giá 10% cho liệu trình/dịch vụ tiếp theo: [${voucherCode}]. Hotline liên hệ đặt lịch: ${displayHotline}.`
      : `${tenantBrand.displayName} chúc mừng sinh nhật tròn tuổi mới của bé ${secondaryProfile}! Mẹ ${customerName} ơi, nhân dịp đặc biệt này, ${tenantBrand.displayName} thân gửi tặng gia đình voucher giảm giá 10% gói liệu trình chăm sóc tiếp theo: [${voucherCode}]. Chúc bé luôn hay ăn chóng lớn, khỏe mạnh bình an! Hotline liên hệ đặt lịch: ${displayHotline}.`;

    await incrementSmsCount(tenantId);

    // Attempt real ZNS sending if phone is available
    let isRealSent = false;
    let zaloError = '';

    const phoneVal = customer.phone;
    if (phoneVal) {
      const templateData = {
        customer_name: customerName,
        baby_name: tenantBrand.isBeautySpa ? customerName : secondaryProfile,
        voucher_code: voucherCode,
        discount_percent: '10%',
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
