import type { CRMStats, ZaloConfig } from '@/services/crm-actions';

export type CrmTabId = 'overview' | 'reminders' | 'marketing' | 'logs';

export interface UpcomingCrmSession {
  id: string;
  assigned_time?: string | null;
  assigned_date?: string | null;
  address?: string | null;
  zalo_reminder_sent?: boolean | null;
  bookings?: {
    booking_number?: string | null;
    customers?: {
      name_mother?: string | null;
      name_baby?: string | null;
      phone?: string | null;
    } | null;
    assigned_ktv?: {
      full_name?: string | null;
    } | null;
  } | null;
}
export interface BirthdayCustomer {
  id: string;
  name_mother?: string | null;
  name_baby?: string | null;
  phone?: string | null;
  dobFormatted: string;
  ageYears: number;
  isToday: boolean;
  daysUntil: number;
}

export interface ZnsLog {
  id: string;
  createdAt: string;
  type: string;
  title: string;
  message: string;
}

export interface VoucherCampaign {
  code: string;
  discount: number;
  target: string;
  status: string;
  usage: number;
}

export type NewVoucherCampaign = Omit<VoucherCampaign, 'usage'>;

export type CrmStatsSnapshot = CRMStats;
export type CrmZaloConfig = ZaloConfig;
