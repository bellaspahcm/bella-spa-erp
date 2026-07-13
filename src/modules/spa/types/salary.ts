/**
 * Spa Salary Types
 * 
 * KTV salary calculation and management types specific to the spa module.
 */

import type { Database } from '@/types/database.types';
import type { Json } from '@/types/database.types';
import type { KtvSalaryConfirmationSession } from './session';
import type { AttendanceLike } from '@/lib/business-rules/attendance';

// Database row types
export type SalaryRecordRow = Database['public']['Tables']['salary_records']['Row'];
export type SalaryRecordInsert = Database['public']['Tables']['salary_records']['Insert'];
export type SalaryRecordUpdate = Database['public']['Tables']['salary_records']['Update'];

// KTV salary record types
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
  kpiTargetSessions?: number;
}

// Salary configuration types
export type SalaryConfigLike = {
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
  kpi_target_sessions: number;
  kpi_bonus_amount: number;
};

export interface TenantSalaryConfig {
  [key: string]: Json | undefined;
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
  kpi_target_sessions: number;
  kpi_bonus_amount: number;
  // Auto-deduction from attendance (per-day amounts)
  penalty_late_per_day?: number;     // Default 50,000đ
  penalty_absent_per_day?: number;   // Default 200,000đ
  auto_consume_inventory?: boolean;
}

// Salary total calculation types
export type SalaryTotalInput = {
  baseSalary: number | string | null | undefined;
  sessionBonus?: number | string | null;
  ratingBonus?: number | string | null;
  kpiBonus?: number | string | null;
  deductions?: number | string | null;
  advances?: number | string | null;
};

// Salary record financial types
export type SalaryRecordFinancialLike = {
  is_locked?: boolean | null;
  status?: string | null;
  total_sessions?: number | string | null;
  session_bonus?: number | string | null;
  rating_bonus?: number | string | null;
  base_salary?: number | string | null;
  kpi_bonus?: number | string | null;
  violations_deduction?: number | string | null;
  service_percentage_bonus?: number | string | null;
  total_salary?: number | string | null;
} | null | undefined;

// Salary recalculation types
export type SalaryRecalculationLifecycleOverrides = {
  base_salary?: unknown;
  kpi_bonus?: unknown;
  violations_deduction?: unknown;
  service_percentage_bonus?: unknown;
  total_sessions?: unknown;
  status?: string | null;
} | null | undefined;

export type SalaryDisplayComponentsInput = {
  record?: SalaryRecordFinancialLike;
  liveSessionsCount: number | string | null | undefined;
  liveSessionBonus: number | string | null | undefined;
  liveRatingBonus: number | string | null | undefined;
  liveBaseSalary: number | string | null | undefined;
  liveKpiBonus: number | string | null | undefined;
  liveDeductions: number | string | null | undefined;
  liveAdvances?: number | string | null;
};

// Salary reconciliation types
export type SalaryReconciliationStatus = 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'NO_LEGACY';

export type SalaryReconciliationThresholds = {
  MATCH_ABS_VND: number;
  MATCH_PERCENT: number;
  MAJOR_DIFF_PERCENT: number;
};

export type SalaryReconciliationStateInput = {
  status?: string | null;
  legacyStatus?: string | null;
  hasLegacyRecord?: boolean | null;
};

export type SalaryReconciliationStatusInput = SalaryReconciliationStateInput & {
  legacyTotal?: number | string | null;
  aiTotal?: number | string | null;
  diffAmount?: number | string | null;
  diffPercent?: number | string | null;
  thresholds: SalaryReconciliationThresholds;
};

// Salary reconciliation report types
export interface SalaryReconRow {
  ktv_id: string;
  ktv_name: string;
  legacy_total: number | null;
  ai_total: number;
  diff_amount: number;
  diff_percent: number | null;
  status: SalaryReconciliationStatus;
  salary_status: string;
}

export interface SalaryReconSummary {
  rows: SalaryReconRow[];
  totalKtv: number;
  matchCount: number;
  minorDiffCount: number;
  majorDiffCount: number;
  noLegacyCount: number;
}

export interface SalaryReconciliationRow {
  ktv_id: string;
  ktv_name: string;
  legacy_total: number | null;
  ai_total: number;
  diff_amount: number;
  diff_percent: number | null;
  status: SalaryReconciliationStatus;
}

// Salary detail types
export type KtvSalaryDetailRow = {
  ktv_id: string;
  ktv_name: string;
  base_salary: number;
  session_bonus: number;
  rating_bonus: number;
  kpi_bonus: number;
  violations_deduction: number;
  service_percentage_bonus: number;
  total_salary: number;
  total_sessions: number;
  avg_rating: number | null;
  status: string;
};

// Salary recalculation engine types
export interface SalaryRecordDbAdmin {
  id: string;
  ktv_id: string;
  tenant_id: string;
  month_year: string;
  base_salary: number;
  session_bonus: number;
  rating_bonus: number;
  kpi_bonus: number;
  violations_deduction: number;
  service_percentage_bonus: number;
  total_salary: number;
  total_sessions: number;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface SalaryRecalculationOverrides {
  base_salary?: number;
  kpi_bonus?: number;
  violations_deduction?: number;
  service_percentage_bonus?: number;
}

// Salary confirmation types
export type KtvSalaryConfirmation = {
  record: SalaryRecordRow | null;
  sessions: KtvSalaryConfirmationSession[];
  attendanceLogs: AttendanceLike[];
  kpiBonus?: number | null;
};

// Salary export types
export type SalaryExportSnapshot = {
  ktvId: string;
  baseSalary: number;
  sessionBonus: number;
  ratingBonus: number;
  kpiBonus: number;
  deductions: number;
  advances: number;
  totalSalary: number;
  sessions: number;
  avgRating: number | null;
};

// Database row types for related tables
export interface SalaryRecordDBRow {
  id: string;
  ktv_id: string;
  month_year: string;
  base_salary: number;
  session_bonus: number;
  rating_bonus: number;
  kpi_bonus: number;
  violations_deduction: number;
  service_percentage_bonus: number;
  total_salary: number;
  total_sessions: number;
  status: string;
}
