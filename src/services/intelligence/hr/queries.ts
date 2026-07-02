/**
 * HR Intelligence Queries Module
 * 
 * Query builders for HR Intelligence metrics:
 * - Workforce Analytics (headcount, turnover, tenure, role distribution)
 * - Attendance Reports (attendance rates, absences, on-time metrics)
 * - Payroll Summary (salary breakdown, bonuses, deductions, rankings)
 * - Employee Performance (KPI scores, ratings, productivity, revenue contribution)
 * - Recruitment Metrics (hiring pipeline, time-to-hire)
 * - Training Metrics (training completion, skill development)
 * - Retention Analysis (attrition risk, tenure distribution)
 * - Productivity Trends (sessions per employee, revenue per employee)
 * 
 * Architecture:
 * - Read-only operations (no mutations)
 * - Query materialized views for performance
 * - Tenant isolation (tenant_id filter on all queries)
 * - Date range filtering (month/quarter/year)
 * - TypeScript types for all return values
 * 
 * Data Sources:
 * - mv_workforce_analytics (materialized view)
 * - mv_attendance_summary (materialized view)
 * - mv_payroll_summary (materialized view)
 * - mv_employee_performance (materialized view)
 */

import { createClient } from '@/lib/supabase-server';
import type { Database } from '@/types/database.types';
import type { DateRange, TimePeriod } from '../shared/types';
import { QueryError } from '../shared/types';
import { parseDateRange, formatDate } from '../shared/helpers';

// ─── Type Definitions ───────────────────────────────────────────────────────

/**
 * Workforce Analytics Metrics
 */
export interface WorkforceAnalytics {
  tenantId: string;
  month: string;
  role: string;
  
  // Headcount metrics
  newHires: number;
  terminations: number;
  currentHeadcount: number;
  totalEverHired: number;
  
  // Turnover metrics
  turnoverRatePct: number;
  
  // Tenure metrics
  avgTenureMonths: number;
  
  // Distribution metrics
  roleDistributionPct: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Attendance Report Metrics
 */
export interface AttendanceReport {
  tenantId: string;
  month: string;
  ktvId: string;
  ktvName: string;
  ktvRole: string;
  
  // Attendance counts
  totalDays: number;
  daysPresent: number;
  daysAbsent: number;
  daysLate: number;
  daysHalfDay: number;
  workingDays: number;
  
  // Rates
  onTimeRatePct: number;
  attendanceRatePct: number;
  avgLateMinutes: number | null;
  
  // Performance metrics
  attendancePerformanceScore: number;
  performanceRank: number;
  attendanceStatus: 'excellent' | 'good' | 'fair' | 'poor';
  
  // Metadata
  computedAt: string;
}

/**
 * Payroll Summary Metrics
 */
export interface PayrollSummary {
  tenantId: string;
  month: string;
  ktvId: string;
  ktvName: string;
  ktvRole: string;
  
  // Salary components
  baseSalary: number;
  sessionBonus: number;
  kpiBonus: number;
  ratingBonus: number;
  servicePercentageBonus: number;
  violationsDeduction: number;
  otherAdjustments: number;
  totalSalary: number;
  netSalary: number;
  
  // Session metrics
  totalSessions: number;
  
  // Derived metrics
  salaryRank: number;
  payrollSharePct: number;
  bonusToBasePct: number;
  
  // Status
  payrollStatus: string;
  publishedAt: string | null;
  confirmedAt: string | null;
  
  // Aggregates
  totalKtvs: number;
  ktvsPaid: number;
  ktvsDraft: number;
  totalBaseSalary: number;
  totalSessionBonus: number;
  totalKpiBonus: number;
  totalRatingBonus: number;
  totalServicePercentageBonus: number;
  totalViolationsDeduction: number;
  totalOtherAdjustments: number;
  totalPayrollCost: number;
  totalSessionsAllKtvs: number;
  avgBaseSalary: number;
  avgTotalSalary: number;
  avgSessionsPerKtv: number;
  avgSalaryPerSession: number;
  
  // Metadata
  computedAt: string;
}

/**
 * Employee Performance Metrics
 */
export interface EmployeePerformance {
  tenantId: string;
  month: string;
  ktvId: string;
  ktvName: string;
  ktvRole: string;
  ktvPhone: string | null;
  isActive: boolean;
  
  // Session metrics
  totalSessionsCompleted: number;
  totalBookingsServed: number;
  
  // Rating metrics
  avgStarRating: number;
  ratingsCount: number;
  fiveStarCount: number;
  fourStarCount: number;
  belowFourCount: number;
  
  // KPI metrics
  kpiScore: number;
  kpiAmount: number;
  customerSatisfactionScore: number;
  
  // Revenue metrics
  totalRevenueContributed: number;
  revenueTransactionCount: number;
  
  // Attendance metrics
  workingDays: number;
  onTimeDays: number;
  absentDays: number;
  
  // Productivity metrics
  revenuePerSession: number;
  sessionsPerWorkingDay: number;
  
  // Performance metrics
  overallPerformanceScore: number;
  performanceRank: number;
  performanceTier: 'top_10' | 'top_25' | 'top_50' | 'below_50';
  
  // Metadata
  computedAt: string;
}

/**
 * Retention Analysis
 */
export interface RetentionAnalysis {
  tenantId: string;
  month: string;
  
  // Attrition metrics
  attritionRatePct: number;
  highRiskEmployees: number;
  mediumRiskEmployees: number;
  lowRiskEmployees: number;
  
  // Tenure distribution
  avgTenureMonths: number;
  employeesUnder6Months: number;
  employees6To12Months: number;
  employees1To2Years: number;
  employeesOver2Years: number;
  
  // Retention rate
  retentionRatePct: number;
}

/**
 * Productivity Trends
 */
export interface ProductivityTrends {
  tenantId: string;
  month: string;
  
  // Session productivity
  totalSessions: number;
  avgSessionsPerEmployee: number;
  sessionsGrowthPct: number;
  
  // Revenue productivity
  totalRevenue: number;
  avgRevenuePerEmployee: number;
  revenueGrowthPct: number;
  
  // Efficiency metrics
  revenuePerSession: number;
  sessionsPerWorkingDay: number;
  utilizationRatePct: number;
}

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Convert snake_case database fields to camelCase TypeScript
 * Generic version for type-safe conversions without 'any' or 'unknown'
 */
function snakeToCamel<T = Record<string, unknown>>(obj: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

/**
 * Parse date range string to Date objects
 */
function parseMonthRange(range: string): { startDate: Date; endDate: Date } {
  const [year, month] = range.split('-').map(Number);
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0); // Last day of month
  return { startDate, endDate };
}

// ─── Query Builders ─────────────────────────────────────────────────────────

/**
 * Get Workforce Analytics
 * Returns headcount trends, turnover rates, tenure, and role distribution
 * 
 * @param tenantId - Tenant UUID
 * @param dateRange - Date range (YYYY-MM format) or period (current_month, last_quarter, etc.)
 * @returns Array of WorkforceAnalytics records
 */
export async function getWorkforceAnalytics(
  tenantId: string,
  dateRange?: DateRange | TimePeriod
): Promise<WorkforceAnalytics[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('mv_workforce_analytics' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  // Apply date range filter if provided
  if (dateRange) {
    if (typeof dateRange === 'string') {
      // Period filter (e.g., 'current_month', 'last_quarter')
      const range = parseDateRange(dateRange);
      query = query
        .gte('month', formatDate(range.startDate))
        .lte('month', formatDate(range.endDate));
    } else {
      // Explicit date range
      query = query
        .gte('month', typeof dateRange.startDate === 'string' ? dateRange.startDate : formatDate(dateRange.startDate))
        .lte('month', typeof dateRange.endDate === 'string' ? dateRange.endDate : formatDate(dateRange.endDate));
    }
  }
  
  const { data, error } = await query.order('month', { ascending: false });
  
  if (error) {
    throw new QueryError(`Failed to fetch workforce analytics: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<WorkforceAnalytics>(row));
}

/**
 * Get Attendance Report
 * Returns attendance rates, absences, and on-time metrics by KTV
 * 
 * @param tenantId - Tenant UUID
 * @param dateRange - Date range (YYYY-MM format) or period
 * @param ktvId - Optional KTV ID filter
 * @returns Array of AttendanceReport records
 */
export async function getAttendanceReport(
  tenantId: string,
  dateRange?: DateRange | TimePeriod,
  ktvId?: string
): Promise<AttendanceReport[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('mv_attendance_summary' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  // Apply KTV filter if provided
  if (ktvId) {
    query = query.eq('ktv_id', ktvId);
  }
  
  // Apply date range filter if provided
  if (dateRange) {
    if (typeof dateRange === 'string') {
      const range = parseDateRange(dateRange);
      query = query
        .gte('month', formatDate(range.startDate))
        .lte('month', formatDate(range.endDate));
    } else {
      query = query
        .gte('month', dateRange.startDate)
        .lte('month', dateRange.endDate);
    }
  }
  
  const { data, error } = await query.order('month', { ascending: false }).order('performance_rank', { ascending: true });
  
  if (error) {
    throw new QueryError(`Failed to fetch attendance report: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<AttendanceReport>(row));
}

/**
 * Get Payroll Summary
 * Returns salary breakdown, bonuses, deductions, and rankings
 * 
 * @param tenantId - Tenant UUID
 * @param month - Month in YYYY-MM format
 * @param ktvId - Optional KTV ID filter
 * @returns Array of PayrollSummary records
 */
export async function getPayrollSummary(
  tenantId: string,
  month: string,
  ktvId?: string
): Promise<PayrollSummary[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('mv_payroll_summary' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('month', month);
  
  // Apply KTV filter if provided
  if (ktvId) {
    query = query.eq('ktv_id', ktvId);
  }
  
  const { data, error } = await query.order('salary_rank', { ascending: true });
  
  if (error) {
    throw new QueryError(`Failed to fetch payroll summary: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<PayrollSummary>(row));
}

/**
 * Get Employee Performance
 * Returns KPI scores, ratings, productivity, and revenue contribution
 * 
 * @param tenantId - Tenant UUID
 * @param dateRange - Date range (YYYY-MM format) or period
 * @param ktvId - Optional KTV ID filter
 * @param limit - Optional limit for top performers (default: 10)
 * @returns Array of EmployeePerformance records
 */
export async function getEmployeePerformance(
  tenantId: string,
  dateRange?: DateRange | TimePeriod,
  ktvId?: string,
  limit?: number
): Promise<EmployeePerformance[]> {
  const supabase = await createClient();
  
  let query = supabase
    .from('mv_employee_performance' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  // Apply KTV filter if provided
  if (ktvId) {
    query = query.eq('ktv_id', ktvId);
  }
  
  // Apply date range filter if provided
  if (dateRange) {
    if (typeof dateRange === 'string') {
      const range = parseDateRange(dateRange);
      query = query
        .gte('month', formatDate(range.startDate))
        .lte('month', formatDate(range.endDate));
    } else {
      query = query
        .gte('month', dateRange.startDate)
        .lte('month', dateRange.endDate);
    }
  }
  
  // Apply limit if provided
  if (limit) {
    query = query.limit(limit);
  }
  
  const { data, error } = await query.order('month', { ascending: false }).order('performance_rank', { ascending: true });
  
  if (error) {
    throw new QueryError(`Failed to fetch employee performance: ${error.message}`, error);
  }
  
  // After error check, data is guaranteed to be array. Cast through unknown is necessary
  // because materialized view is not in generated types (using 'as any' in .from())
  return ((data ?? []) as unknown as Record<string, unknown>[]).map((row) => snakeToCamel<EmployeePerformance>(row));
}

/**
 * Get Retention Analysis
 * Returns attrition risk and tenure distribution
 * 
 * @param tenantId - Tenant UUID
 * @param dateRange - Date range or period
 * @returns RetentionAnalysis record
 */
export async function getRetentionAnalysis(
  tenantId: string,
  dateRange?: DateRange | TimePeriod
): Promise<RetentionAnalysis | null> {
  const supabase = await createClient();
  
  // Query workforce analytics for retention calculations
  let query = supabase
    .from('mv_workforce_analytics' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  if (dateRange) {
    if (typeof dateRange === 'string') {
      const range = parseDateRange(dateRange);
      query = query
        .gte('month', formatDate(range.startDate))
        .lte('month', formatDate(range.endDate));
    } else {
      query = query
        .gte('month', dateRange.startDate)
        .lte('month', dateRange.endDate);
    }
  }
  
  const { data, error } = await query.order('month', { ascending: false });
  
  if (error) {
    throw new QueryError(`Failed to fetch retention analysis: ${error.message}`, error);
  }
  
  if (!data || data.length === 0) {
    return null;
  }
  
  // Cast data to proper type after error check and null check
  const rows = data as unknown as Record<string, any>[];
  
  // Aggregate retention metrics
  const totalHeadcount = rows.reduce((sum, row) => sum + (row.current_headcount || 0), 0);
  const totalTerminations = rows.reduce((sum, row) => sum + (row.terminations || 0), 0);
  const avgTenure = rows.reduce((sum, row) => sum + (row.avg_tenure_months || 0), 0) / rows.length;
  
  return {
    tenantId,
    month: rows[0].month,
    attritionRatePct: totalHeadcount > 0 ? (totalTerminations / totalHeadcount) * 100 : 0,
    highRiskEmployees: 0, // TODO: Implement risk scoring
    mediumRiskEmployees: 0,
    lowRiskEmployees: totalHeadcount,
    avgTenureMonths: avgTenure,
    employeesUnder6Months: 0, // TODO: Calculate from tenure distribution
    employees6To12Months: 0,
    employees1To2Years: 0,
    employeesOver2Years: 0,
    retentionRatePct: totalHeadcount > 0 ? ((totalHeadcount - totalTerminations) / totalHeadcount) * 100 : 0,
  };
}

/**
 * Get Productivity Trends
 * Returns sessions per employee, revenue per employee, and efficiency metrics
 * 
 * @param tenantId - Tenant UUID
 * @param dateRange - Date range or period
 * @returns Array of ProductivityTrends records
 */
export async function getProductivityTrends(
  tenantId: string,
  dateRange?: DateRange | TimePeriod
): Promise<ProductivityTrends[]> {
  const supabase = await createClient();
  
  // Query employee performance for productivity aggregations
  let query = supabase
    .from('mv_employee_performance' as any) // Materialized view not in generated types yet
    .select('*')
    .eq('tenant_id', tenantId);
  
  if (dateRange) {
    if (typeof dateRange === 'string') {
      const range = parseDateRange(dateRange);
      query = query
        .gte('month', formatDate(range.startDate))
        .lte('month', formatDate(range.endDate));
    } else {
      query = query
        .gte('month', dateRange.startDate)
        .lte('month', dateRange.endDate);
    }
  }
  
  const { data, error } = await query.order('month', { ascending: false });
  
  if (error) {
    throw new QueryError(`Failed to fetch productivity trends: ${error.message}`, error);
  }
  
  if (!data || data.length === 0) {
    return [];
  }
  
  // Cast data to proper type after error check and null check
  const rows = data as unknown as Record<string, any>[];
  
  // Group by month and aggregate
  const monthlyData = rows.reduce((acc, row) => {
    const month = row.month as string;
    if (!acc[month]) {
      acc[month] = {
        totalSessions: 0,
        totalRevenue: 0,
        employeeCount: 0,
        totalWorkingDays: 0,
      };
    }
    acc[month].totalSessions += row.total_sessions_completed || 0;
    acc[month].totalRevenue += row.total_revenue_contributed || 0;
    acc[month].employeeCount += 1;
    acc[month].totalWorkingDays += row.working_days || 0;
    return acc;
  }, {} as Record<string, { totalSessions: number; totalRevenue: number; employeeCount: number; totalWorkingDays: number }>);
  
  // Convert to ProductivityTrends array
  return Object.entries(monthlyData).map(([month, metrics]) => ({
    tenantId,
    month,
    totalSessions: metrics.totalSessions,
    avgSessionsPerEmployee: metrics.employeeCount > 0 ? metrics.totalSessions / metrics.employeeCount : 0,
    sessionsGrowthPct: 0, // TODO: Calculate month-over-month growth
    totalRevenue: metrics.totalRevenue,
    avgRevenuePerEmployee: metrics.employeeCount > 0 ? metrics.totalRevenue / metrics.employeeCount : 0,
    revenueGrowthPct: 0, // TODO: Calculate month-over-month growth
    revenuePerSession: metrics.totalSessions > 0 ? metrics.totalRevenue / metrics.totalSessions : 0,
    sessionsPerWorkingDay: metrics.totalWorkingDays > 0 ? metrics.totalSessions / metrics.totalWorkingDays : 0,
    utilizationRatePct: 0, // TODO: Calculate capacity utilization
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Re-export Training & Recruitment Metrics
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Training Metrics (from dedicated module)
 * 
 * Note: Training metrics are calculated from session_logs as proxy for
 * on-the-job training until formal training_courses tables are added.
 */
export type { TrainingMetrics } from './training-metrics';
export { getTrainingMetrics } from './training-metrics';

/**
 * Recruitment Metrics (from dedicated module)
 * 
 * Calculates recruitment pipeline metrics from recruitment tables:
 * - recruitment_positions
 * - recruitment_candidates
 * - recruitment_pipelines
 * - recruitment_interviews
 */
export type { RecruitmentMetrics } from './recruitment-metrics';
export { getRecruitmentMetrics } from './recruitment-metrics';
