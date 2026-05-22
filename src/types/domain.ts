export interface KtvSalaryRecord {
  id: string;
  name: string;
  sessions: number;
  isConfirmed: boolean;
  avgRating: number;
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
  [packageName: string]: any; // Dành cho các gói dịch vụ động và các trường khác
}

export interface KtvSessionMatrix {
  ktvs: KtvSessionMatrixRecord[];
  packageNames: string[];
}

export interface TenantSalaryConfig {
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
  kpi_target_sessions: number;
  kpi_bonus_amount: number;
}

export interface TenantGeneralSettings {
  name: string;
  phone: string;
  email: string;
  address: string;
  qr_bank_code: string;
  qr_account_number: string;
  qr_account_name: string;
  salary_config: TenantSalaryConfig;
}

export interface CurrentUser {
  id: string;
  email: string;
  full_name?: string | null;
  role: string;
  avatar_url?: string | null;
  tenant_id: string | null;
  isSuspended?: boolean;
}

export interface StaffRecord {
  id: string;
  full_name: string;
  email: string;
  role: string;
  status: string;
  sessions_count?: number;
  avg_rating?: string | number;
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
}


