import type { Json } from './database.types';
import type { TenantBrandTheme, TenantEnabledModules } from '@/lib/business-rules/tenant-modules';

// Re-export shared types from @bella/shared for backward compatibility
export type { CurrentUser, AuthState, TenantInfo, BookingSummary, StaffRecord } from '@bella/shared';

export interface KtvSalaryRecord {
  id: string;
  name: string;
  sessions: number;
  isConfirmed: boolean;
  avgRating: number | null;
  baseSalary: number;
  sessionBonus: number;
  ratingBonus: number;
  kpiBonus: number;
  deductions: number;
  advances: number;
  totalSalary: number;
  status: 'finalized' | 'approved' | 'confirmed' | 'disputed' | 'published' | 'pending' | 'pending_approval' | 'draft' | string;
  hireDate?: string | null;
  resignationDate?: string | null;
  disputeReason?: string | null;
  /** Actual attendance-based work days for pro-rata base salary calculation */
  actualDays?: number;
  ktvStatus?: string;
}

export interface KtvAttendanceLog {
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
  checkin_time: string | null;
  checkout_time: string | null;
}

export interface KtvAttendanceSummary {
  id: string;
  name: string;
  role: string;
  totalDays: number;
  present: number;
  late: number;
  absent: number;
  halfDay: number;
  baseSalary?: number;
  logs?: KtvAttendanceLog[];
}

export interface KtvSessionMatrixRecord {
  id: string;
  name: string;
  isConfirmed?: boolean;
  [packageName: string]: string | number | boolean | null | undefined; // Dành cho các gói dịch vụ động và các trường khác
}

export interface KtvSessionMatrix {
  ktvs: KtvSessionMatrixRecord[];
  packageNames: string[];
}

export interface TenantSalaryConfig {
  [key: string]: Json | undefined;
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
  kpi_target_sessions: number;
  kpi_bonus_amount: number;
  // Auto-deduction from attendance (per-day amounts).
  // Late_days và absent_days pull từ get_ktv_leaderboard RPC.
  penalty_late_per_day?: number;     // mặc định 50.000đ
  penalty_absent_per_day?: number;   // mặc định 200.000đ
  auto_consume_inventory?: boolean;
}

export interface TenantGeneralSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  logo_url?: string;
  enabled_modules?: TenantEnabledModules;
  brand_theme?: TenantBrandTheme;
  qr_bank_code: string;
  qr_account_number: string;
  qr_account_name: string;
  salary_config: TenantSalaryConfig;
}

export interface HqDashboardStats {
  totalSpas: number;
  activeSpas: number;
  suspendedSpas: number;
  totalRevenue: number;
  totalSessions: number;
  zaloSmsUsed: number;
  spaGrowthData: { month: string; spas: number }[];
}

export interface HqTenantRecord {
  id: string;
  name: string;
  slug?: string | null;
  status: string | null;
  logo_url?: string | null;
  created_at: string | null;
  updated_at: string | null;
  address?: string | null;
  contact_phone?: string | null;
  email?: string | null;
  staffCount: number;
  customerCount: number;
  revenueSum: number;
  royalty_type?: 'fixed' | 'percentage' | null;
  royalty_rate?: number | null;
  royalty_fixed_amount?: number | null;
  internal_clearing_rate?: number | null;
  subscription_tier?: string | null;
  subscription_expires_at?: string | null;
  parent_tenant_id?: string | null;
  franchise_agreement_date?: string | null;
  enabled_modules?: TenantEnabledModules | Json | null;
}

export interface HqAuditLogRecord {
  id: string;
  created_at: string;
  changed_by_id: string | null;
  user_name: string;
  action: 'INSERT' | 'UPDATE' | 'DELETE' | string;
  table_name: string;
  record_id: string;
  old_data: Json | null;
  new_data: Json | null;
  tenant_id: string;
  tenant_name?: string;
}

export interface HqAuditLogFilters {
  tenantId?: string;
  userId?: string;
  action?: 'INSERT' | 'UPDATE' | 'DELETE' | '';
  tableName?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
  page?: number;
}

export interface HqPackageTemplate {
  id: string;
  name: string;
  description?: string | null;
  price: number;
  duration?: string | null;
  total_sessions: number;
  details?: string[] | null;
  ktv_commission?: number | null;
  offer?: string | null;
  status?: string | null;
  is_hq_template: boolean;
  template_id?: string | null;
  price_cap?: number | null;
  price_floor?: number | null;
  allowed_franchise_override: boolean;
  created_at?: string;
  updated_at?: string;
}
