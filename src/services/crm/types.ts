// Shared CRM domain types. Plain module (no 'use server').

export interface CRMStats {
  totalRemindersSent: number;
  pendingRemindersToday: number;
  totalBirthdaysToday: number;
  totalBirthdaysMonth: number;
}

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
