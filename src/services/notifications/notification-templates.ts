/**
 * Notification Templates
 * 
 * Message templates for all notification types.
 * Supports variable interpolation using {{variableName}} syntax.
 * 
 * @module services/notifications/notification-templates
 */

import type { NotificationType, NotificationChannel } from '@/types/waitlist';
import type { NotificationTemplate, NotificationTemplateData } from './types';

/**
 * Template interpolation
 * Replace {{variableName}} with actual values from data
 */
export function interpolateTemplate(
  template: string,
  data: NotificationTemplateData
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    const value = data[key];
    if (value === undefined || value === null) {
      console.warn(`Template variable "${key}" not found in data`);
      return '';
    }
    return String(value);
  });
}

/**
 * All notification templates
 */
export const NOTIFICATION_TEMPLATES: Record<NotificationType, Record<NotificationChannel, NotificationTemplate>> = {
  // Slot Available - Customer is notified that a slot matching their preferences is free
  slot_available: {
    sms: {
      id: 'slot_available_sms',
      type: 'slot_available',
      channel: 'sms',
      body: 'Bella Spa: Có chỗ trống cho {{serviceName}} vào {{date}} lúc {{time}}. Vui lòng xác nhận trong 30 phút. Liên hệ: {{contactPhone}}',
      variables: ['serviceName', 'date', 'time', 'contactPhone'],
    },
    email: {
      id: 'slot_available_email',
      type: 'slot_available',
      channel: 'email',
      subject: 'Bella Spa - Có chỗ trống cho {{serviceName}}',
      body: `Chào {{customerName}},

Chúng tôi có tin vui! Có chỗ trống cho dịch vụ {{serviceName}} vào:
📅 Ngày: {{date}}
🕐 Giờ: {{time}}

Vui lòng xác nhận trong vòng 30 phút để giữ chỗ.

Liên hệ: {{contactPhone}}

Trân trọng,
Bella Spa`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ec4899;">Bella Spa</h2>
          <p>Chào <strong>{{customerName}}</strong>,</p>
          <p>Chúng tôi có tin vui! Có chỗ trống cho dịch vụ <strong>{{serviceName}}</strong> vào:</p>
          <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #ec4899; margin: 20px 0;">
            <p style="margin: 5px 0;">📅 <strong>Ngày:</strong> {{date}}</p>
            <p style="margin: 5px 0;">🕐 <strong>Giờ:</strong> {{time}}</p>
          </div>
          <p>Vui lòng xác nhận trong vòng <strong>30 phút</strong> để giữ chỗ.</p>
          <p>Liên hệ: <a href="tel:{{contactPhone}}">{{contactPhone}}</a></p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Trân trọng,<br>Bella Spa</p>
        </div>
      `,
      variables: ['customerName', 'serviceName', 'date', 'time', 'contactPhone'],
    },
    zalo: {
      id: 'slot_available_zalo',
      type: 'slot_available',
      channel: 'zalo',
      body: '🌸 Bella Spa: Có chỗ trống cho {{serviceName}} vào {{date}} lúc {{time}}. Xác nhận ngay để giữ chỗ!',
      variables: ['serviceName', 'date', 'time'],
    },
    push: {
      id: 'slot_available_push',
      type: 'slot_available',
      channel: 'push',
      subject: 'Có chỗ trống - {{serviceName}}',
      body: 'Có chỗ trống vào {{date}} lúc {{time}}. Xác nhận ngay!',
      variables: ['serviceName', 'date', 'time'],
    },
  },

  // Position Updated - Customer moved up in queue
  position_updated: {
    sms: {
      id: 'position_updated_sms',
      type: 'position_updated',
      channel: 'sms',
      body: 'Bella Spa: Bạn đã lên vị trí #{{position}} trong hàng chờ {{serviceName}}. Thời gian chờ dự kiến: {{estimatedWait}} phút.',
      variables: ['position', 'serviceName', 'estimatedWait'],
    },
    email: {
      id: 'position_updated_email',
      type: 'position_updated',
      channel: 'email',
      subject: 'Bella Spa - Cập nhật vị trí hàng chờ',
      body: `Chào {{customerName}},

Tin tốt! Bạn đã lên vị trí #{{position}} trong hàng chờ dịch vụ {{serviceName}}.

⏱️ Thời gian chờ dự kiến: {{estimatedWait}} phút

Chúng tôi sẽ thông báo ngay khi có chỗ trống.

Trân trọng,
Bella Spa`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ec4899;">Bella Spa</h2>
          <p>Chào <strong>{{customerName}}</strong>,</p>
          <p>Tin tốt! Bạn đã lên vị trí <strong style="color: #ec4899; font-size: 24px;">#{{position}}</strong> trong hàng chờ dịch vụ {{serviceName}}.</p>
          <div style="background: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 0;">⏱️ Thời gian chờ dự kiến: <strong>{{estimatedWait}} phút</strong></p>
          </div>
          <p>Chúng tôi sẽ thông báo ngay khi có chỗ trống.</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Trân trọng,<br>Bella Spa</p>
        </div>
      `,
      variables: ['customerName', 'position', 'serviceName', 'estimatedWait'],
    },
    zalo: {
      id: 'position_updated_zalo',
      type: 'position_updated',
      channel: 'zalo',
      body: '🎉 Bella Spa: Bạn đã lên vị trí #{{position}}! Thời gian chờ dự kiến: {{estimatedWait}} phút.',
      variables: ['position', 'estimatedWait'],
    },
    push: {
      id: 'position_updated_push',
      type: 'position_updated',
      channel: 'push',
      subject: 'Lên vị trí #{{position}}',
      body: 'Bạn đã lên vị trí #{{position}} trong hàng chờ.',
      variables: ['position'],
    },
  },

  // Expiring Soon - Entry will expire in 2 hours
  expiring_soon: {
    sms: {
      id: 'expiring_soon_sms',
      type: 'expiring_soon',
      channel: 'sms',
      body: 'Bella Spa: Lịch hẹn {{serviceName}} của bạn sẽ hết hạn sau 2 giờ. Vui lòng xác nhận hoặc liên hệ {{contactPhone}}.',
      variables: ['serviceName', 'contactPhone'],
    },
    email: {
      id: 'expiring_soon_email',
      type: 'expiring_soon',
      channel: 'email',
      subject: 'Bella Spa - Lịch hẹn sắp hết hạn',
      body: `Chào {{customerName}},

Lịch hẹn dịch vụ {{serviceName}} của bạn sẽ hết hạn sau 2 giờ.

Nếu bạn vẫn muốn giữ chỗ, vui lòng xác nhận hoặc liên hệ: {{contactPhone}}

Trân trọng,
Bella Spa`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ec4899;">Bella Spa</h2>
          <p>Chào <strong>{{customerName}}</strong>,</p>
          <div style="background: #fffbeb; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0;">
            <p style="margin: 0;">⚠️ Lịch hẹn dịch vụ <strong>{{serviceName}}</strong> của bạn sẽ <strong>hết hạn sau 2 giờ</strong>.</p>
          </div>
          <p>Nếu bạn vẫn muốn giữ chỗ, vui lòng xác nhận hoặc liên hệ: <a href="tel:{{contactPhone}}">{{contactPhone}}</a></p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Trân trọng,<br>Bella Spa</p>
        </div>
      `,
      variables: ['customerName', 'serviceName', 'contactPhone'],
    },
    zalo: {
      id: 'expiring_soon_zalo',
      type: 'expiring_soon',
      channel: 'zalo',
      body: '⚠️ Bella Spa: Lịch hẹn {{serviceName}} sắp hết hạn. Xác nhận ngay!',
      variables: ['serviceName'],
    },
    push: {
      id: 'expiring_soon_push',
      type: 'expiring_soon',
      channel: 'push',
      subject: 'Lịch hẹn sắp hết hạn',
      body: 'Lịch hẹn {{serviceName}} sẽ hết hạn sau 2 giờ.',
      variables: ['serviceName'],
    },
  },

  // Expired - Entry has expired
  expired: {
    sms: {
      id: 'expired_sms',
      type: 'expired',
      channel: 'sms',
      body: 'Bella Spa: Lịch hẹn {{serviceName}} đã hết hạn. Vui lòng liên hệ {{contactPhone}} để đặt lại.',
      variables: ['serviceName', 'contactPhone'],
    },
    email: {
      id: 'expired_email',
      type: 'expired',
      channel: 'email',
      subject: 'Bella Spa - Lịch hẹn đã hết hạn',
      body: `Chào {{customerName}},

Rất tiếc, lịch hẹn dịch vụ {{serviceName}} của bạn đã hết hạn.

Nếu bạn vẫn muốn sử dụng dịch vụ, vui lòng liên hệ để đặt lại: {{contactPhone}}

Chúng tôi hy vọng được phục vụ bạn sớm nhất!

Trân trọng,
Bella Spa`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ec4899;">Bella Spa</h2>
          <p>Chào <strong>{{customerName}}</strong>,</p>
          <div style="background: #fef2f2; padding: 15px; border-left: 4px solid #ef4444; margin: 20px 0;">
            <p style="margin: 0;">Rất tiếc, lịch hẹn dịch vụ <strong>{{serviceName}}</strong> của bạn đã hết hạn.</p>
          </div>
          <p>Nếu bạn vẫn muốn sử dụng dịch vụ, vui lòng liên hệ để đặt lại:</p>
          <p><a href="tel:{{contactPhone}}" style="color: #ec4899; font-weight: bold;">{{contactPhone}}</a></p>
          <p>Chúng tôi hy vọng được phục vụ bạn sớm nhất!</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Trân trọng,<br>Bella Spa</p>
        </div>
      `,
      variables: ['customerName', 'serviceName', 'contactPhone'],
    },
    zalo: {
      id: 'expired_zalo',
      type: 'expired',
      channel: 'zalo',
      body: '😔 Bella Spa: Lịch hẹn {{serviceName}} đã hết hạn. Liên hệ để đặt lại!',
      variables: ['serviceName'],
    },
    push: {
      id: 'expired_push',
      type: 'expired',
      channel: 'push',
      subject: 'Lịch hẹn đã hết hạn',
      body: 'Lịch hẹn {{serviceName}} đã hết hạn.',
      variables: ['serviceName'],
    },
  },

  // Reserved - Slot is reserved for customer
  reserved: {
    sms: {
      id: 'reserved_sms',
      type: 'reserved',
      channel: 'sms',
      body: 'Bella Spa: Chỗ của bạn đã được giữ cho {{serviceName}} vào {{date}} lúc {{time}}. Hẹn gặp bạn!',
      variables: ['serviceName', 'date', 'time'],
    },
    email: {
      id: 'reserved_email',
      type: 'reserved',
      channel: 'email',
      subject: 'Bella Spa - Xác nhận giữ chỗ thành công',
      body: `Chào {{customerName}},

Chỗ của bạn đã được giữ thành công!

📦 Dịch vụ: {{serviceName}}
📅 Ngày: {{date}}
🕐 Giờ: {{time}}

Chúng tôi rất mong được phục vụ bạn!

Trân trọng,
Bella Spa`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ec4899;">Bella Spa</h2>
          <p>Chào <strong>{{customerName}}</strong>,</p>
          <p>Chỗ của bạn đã được giữ thành công!</p>
          <div style="background: #ecfdf5; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 5px 0;">📦 <strong>Dịch vụ:</strong> {{serviceName}}</p>
            <p style="margin: 5px 0;">📅 <strong>Ngày:</strong> {{date}}</p>
            <p style="margin: 5px 0;">🕐 <strong>Giờ:</strong> {{time}}</p>
          </div>
          <p>Chúng tôi rất mong được phục vụ bạn!</p>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
          <p style="color: #6b7280; font-size: 12px;">Trân trọng,<br>Bella Spa</p>
        </div>
      `,
      variables: ['customerName', 'serviceName', 'date', 'time'],
    },
    zalo: {
      id: 'reserved_zalo',
      type: 'reserved',
      channel: 'zalo',
      body: '✅ Bella Spa: Đã giữ chỗ {{serviceName}} vào {{date}} lúc {{time}}. Hẹn gặp bạn!',
      variables: ['serviceName', 'date', 'time'],
    },
    push: {
      id: 'reserved_push',
      type: 'reserved',
      channel: 'push',
      subject: 'Giữ chỗ thành công',
      body: 'Đã giữ chỗ {{serviceName}} vào {{date}} lúc {{time}}.',
      variables: ['serviceName', 'date', 'time'],
    },
  },
};

/**
 * Get template for specific notification type and channel
 */
export function getTemplate(
  type: NotificationType,
  channel: NotificationChannel
): NotificationTemplate | null {
  return NOTIFICATION_TEMPLATES[type]?.[channel] || null;
}

/**
 * Build notification message from template
 */
export function buildMessage(
  type: NotificationType,
  channel: NotificationChannel,
  data: NotificationTemplateData
): { subject?: string; body: string; htmlBody?: string } | null {
  const template = getTemplate(type, channel);
  
  if (!template) {
    console.error(`Template not found for type="${type}" channel="${channel}"`);
    return null;
  }

  // Validate required variables
  const missingVars = template.variables.filter((v) => data[v] === undefined);
  if (missingVars.length > 0) {
    console.warn(`Missing template variables: ${missingVars.join(', ')}`);
  }

  return {
    subject: template.subject ? interpolateTemplate(template.subject, data) : undefined,
    body: interpolateTemplate(template.body, data),
    htmlBody: template.htmlBody ? interpolateTemplate(template.htmlBody, data) : undefined,
  };
}
