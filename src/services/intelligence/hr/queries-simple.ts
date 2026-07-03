/**
 * HR Intelligence Queries Module - Simplified Version
 * 
 * Simple implementations that query base tables directly instead of
 * materialized views. Returns basic metrics with minimal computation.
 */

import type { Database } from '@/types/database.types';
import { QueryError } from '../shared/types';
import { getSupabaseAdminUrl, getSupabaseAdminKey } from '@/lib/supabase-admin-env';

/**
 * Create service role client
 */
async function createServiceRoleClient() {
  const url = getSupabaseAdminUrl();
  const serviceKey = getSupabaseAdminKey();

  if (!url || !serviceKey) {
    throw new Error('Missing Supabase service role credentials');
  }

  const { createClient } = await import('@supabase/supabase-js');
  return createClient<Database>(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Get Workforce Analytics - Simplified
 * Returns aggregated workforce metrics
 */
export async function getWorkforceAnalytics(tenantId: string) {
  try {
    const supabase = await createServiceRoleClient();

    // Query users table for basic headcount
    const { data: users, error } = await supabase
      .from('users')
      .select('id, role, created_at, status')
      .eq('tenant_id', tenantId);

    if (error) {
      console.error('[HR Intelligence] Workforce query error:', error);
      throw new QueryError('Failed to query workforce data', error);
    }

    const allUsers = users || [];
    const activeUsers = allUsers.filter(u => u.status === 'active' || !u.status);
    
    // Group by role
    const roleGroups = activeUsers.reduce((acc, user) => {
      const role = user.role || 'unknown';
      acc[role] = (acc[role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Return aggregated metrics
    return {
      totalEmployees: activeUsers.length,
      activeEmployees: activeUsers.length,
      onLeaveToday: 0,
      avgAttendanceRate: 0,
      avgWorkingDaysPerMonth: 0,
      departmentBreakdown: Object.entries(roleGroups).map(([dept, count]) => ({
        department: dept,
        employeeCount: count,
        avgAttendanceRate: 0,
      })),
      contractTypeBreakdown: [],
      turnoverRate: 0,
    };
  } catch (error) {
    console.error('[HR Intelligence] Workforce analytics error:', error);
    throw error;
  }
}

/**
 * Get Attendance Report - Simplified
 * Returns basic attendance metrics
 */
export async function getAttendanceReport(tenantId: string, month?: string) {
  try {
    const supabase = await createServiceRoleClient();
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    // Query attendance table
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('employee_id, date, status, check_in_time')
      .eq('tenant_id', tenantId)
      .gte('date', `${currentMonth}-01`)
      .lt('date', `${currentMonth}-32`) as {
        data: Array<{ employee_id: string; date: string; status: string; check_in_time: string | null }> | null;
        error: unknown;
      };

    if (error || !attendance || attendance.length === 0) {
      console.error('[HR Intelligence] Attendance query error:', error);
      return [];
    }

    // Get user info
    const userIds = [...new Set(attendance.map(a => a.employee_id))];
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, role, phone')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Group attendance by user
    const userAttendance = attendance.reduce((acc, record) => {
      if (!acc[record.employee_id]) {
        acc[record.employee_id] = [];
      }
      acc[record.employee_id].push(record);
      return acc;
    }, {} as Record<string, typeof attendance>);

    // Calculate metrics per user
    return Object.entries(userAttendance).map(([userId, records]) => {
      const user = userMap.get(userId);
      const daysPresent = records.filter(r => r.status === 'present' || r.status === 'late').length;
      const daysAbsent = records.filter(r => r.status === 'absent').length;
      const daysLate = records.filter(r => r.status === 'late').length;
      const totalDays = records.length;

      return {
        tenantId,
        month: currentMonth,
        ktvId: userId,
        ktvName: user?.full_name || 'Unknown',
        ktvRole: user?.role || 'unknown',
        totalDays,
        daysPresent,
        daysAbsent,
        daysLate,
        daysHalfDay: 0,
        workingDays: daysPresent,
        onTimeRatePct: totalDays > 0 ? ((daysPresent - daysLate) / totalDays) * 100 : 0,
        attendanceRatePct: totalDays > 0 ? (daysPresent / totalDays) * 100 : 0,
        avgLateMinutes: null,
        attendancePerformanceScore: totalDays > 0 ? (daysPresent / totalDays) * 100 : 0,
        performanceRank: 0,
        attendanceStatus: 'good' as const,
        computedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('[HR Intelligence] Attendance report error:', error);
    return [];
  }
}

/**
 * Get Payroll Summary - Simplified
 * Returns salary data from salary_records table
 */
export async function getPayrollSummary(tenantId: string, month: string) {
  try {
    const supabase = await createServiceRoleClient();

    // Query salary_records table
    const { data: salaryRecords, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month_year', month);

    if (error || !salaryRecords || salaryRecords.length === 0) {
      console.error('[HR Intelligence] Payroll query error:', error);
      return [];
    }

    // Get user info
    const userIds = salaryRecords.map(s => s.ktv_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Map to output format
    return salaryRecords.map(record => {
      const user = userMap.get(record.ktv_id);
      return {
        tenantId,
        month,
        ktvId: record.ktv_id,
        ktvName: user?.full_name || 'Unknown',
        ktvRole: user?.role || 'unknown',
        baseSalary: record.base_salary || 0,
        sessionBonus: record.session_bonus || 0,
        kpiBonus: record.kpi_bonus || 0,
        ratingBonus: record.rating_bonus || 0,
        servicePercentageBonus: record.service_percentage_bonus || 0,
        violationsDeduction: record.violations_deduction || 0,
        otherAdjustments: 0,
        totalSalary: record.total_salary || 0,
        netSalary: record.total_salary || 0,
        totalSessions: record.total_sessions || 0,
        salaryRank: 0,
        payrollSharePct: 0,
        bonusToBasePct: 0,
        payrollStatus: record.status || 'draft',
        publishedAt: null,
        confirmedAt: null,
        totalKtvs: salaryRecords.length,
        ktvsPaid: 0,
        ktvsDraft: salaryRecords.length,
        totalBaseSalary: 0,
        totalSessionBonus: 0,
        totalKpiBonus: 0,
        totalRatingBonus: 0,
        totalServicePercentageBonus: 0,
        totalViolationsDeduction: 0,
        totalOtherAdjustments: 0,
        totalPayrollCost: 0,
        totalSessionsAllKtvs: 0,
        avgBaseSalary: 0,
        avgTotalSalary: 0,
        avgSessionsPerKtv: 0,
        avgSalaryPerSession: 0,
        computedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('[HR Intelligence] Payroll summary error:', error);
    return [];
  }
}

/**
 * Get Employee Performance - Simplified
 * Returns basic KPI and session counts
 */
export async function getEmployeePerformance(tenantId: string, month?: string) {
  try {
    const supabase = await createServiceRoleClient();
    const currentMonth = month || new Date().toISOString().slice(0, 7);

    // Query KPI records
    const { data: kpiRecords, error: kpiError } = await supabase
      .from('kpi_records')
      .select('employee_id, customer_satisfaction_score, kpi_amount')
      .eq('tenant_id', tenantId)
      .eq('month_year', currentMonth) as {
        data: Array<{ employee_id: string; customer_satisfaction_score: number | null; kpi_amount: number | null }> | null;
        error: unknown;
      };

    if (kpiError || !kpiRecords || kpiRecords.length === 0) {
      console.error('[HR Intelligence] KPI query error:', kpiError);
      return [];
    }

    // Get user info
    const userIds = kpiRecords.map(k => k.employee_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, full_name, role, phone')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Map to output format
    return kpiRecords.map(record => {
      const user = userMap.get(record.employee_id);
      return {
        tenantId,
        month: currentMonth,
        ktvId: record.employee_id,
        ktvName: user?.full_name || 'Unknown',
        ktvRole: user?.role || 'unknown',
        ktvPhone: user?.phone || null,
        isActive: true,
        totalSessionsCompleted: 0,
        totalBookingsServed: 0,
        avgStarRating: 0,
        ratingsCount: 0,
        fiveStarCount: 0,
        fourStarCount: 0,
        belowFourCount: 0,
        kpiScore: record.customer_satisfaction_score || 0,
        kpiAmount: record.kpi_amount || 0,
        customerSatisfactionScore: record.customer_satisfaction_score || 0,
        totalRevenueContributed: 0,
        revenueTransactionCount: 0,
        workingDays: 0,
        onTimeDays: 0,
        absentDays: 0,
        revenuePerSession: 0,
        sessionsPerWorkingDay: 0,
        overallPerformanceScore: record.customer_satisfaction_score || 0,
        performanceRank: 0,
        performanceTier: 'top_50' as const,
        computedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('[HR Intelligence] Employee performance error:', error);
    return [];
  }
}

/**
 * Get Retention Analysis - Placeholder
 */
export async function getRetentionAnalysis(tenantId: string) {
  return {
    tenantId,
    month: new Date().toISOString().slice(0, 7),
    attritionRatePct: 0,
    highRiskEmployees: 0,
    mediumRiskEmployees: 0,
    lowRiskEmployees: 0,
    avgTenureMonths: 0,
    employeesUnder6Months: 0,
    employees6To12Months: 0,
    employees1To2Years: 0,
    employeesOver2Years: 0,
    retentionRatePct: 100,
  };
}

/**
 * Get Productivity Trends - Placeholder
 */
export async function getProductivityTrends(tenantId: string) {
  return [{
    tenantId,
    month: new Date().toISOString().slice(0, 7),
    totalSessions: 0,
    avgSessionsPerEmployee: 0,
    sessionsGrowthPct: 0,
    totalRevenue: 0,
    avgRevenuePerEmployee: 0,
    revenueGrowthPct: 0,
    revenuePerSession: 0,
    sessionsPerWorkingDay: 0,
    utilizationRatePct: 0,
  }];
}

/**
 * Get Recruitment Metrics - Placeholder
 */
export async function getRecruitmentMetrics(tenantId: string) {
  return [{
    tenantId,
    month: new Date().toISOString().slice(0, 7),
    openPositions: 0,
    totalCandidates: 0,
    candidatesInReview: 0,
    candidatesInterviewing: 0,
    candidatesOffered: 0,
    candidatesHired: 0,
    candidatesRejected: 0,
    avgTimeToHireDays: 0,
    offerAcceptanceRatePct: 0,
    interviewToOfferRatePct: 0,
    computedAt: new Date().toISOString(),
  }];
}

/**
 * Get Training Metrics - Placeholder
 */
export async function getTrainingMetrics(tenantId: string) {
  return [{
    tenantId,
    month: new Date().toISOString().slice(0, 7),
    totalTrainingSessions: 0,
    employeesTrained: 0,
    avgSessionsPerEmployee: 0,
    trainingCompletionRatePct: 0,
    skillsDeveloped: 0,
    certificationRatePct: 0,
    trainingCostTotal: 0,
    avgCostPerEmployee: 0,
    computedAt: new Date().toISOString(),
  }];
}


// Export types for service layer
export interface WorkforceAnalytics {
  totalEmployees: number;
  activeEmployees: number;
  onLeaveToday: number;
  avgAttendanceRate: number;
  avgWorkingDaysPerMonth: number;
  departmentBreakdown: Array<{
    department: string;
    employeeCount: number;
    avgAttendanceRate: number;
  }>;
  contractTypeBreakdown: Array<{
    contractType: string;
    employeeCount: number;
  }>;
  turnoverRate: number;
}

export type {
  AttendanceReport,
  PayrollSummary,
  EmployeePerformance,
  RetentionAnalysis,
  ProductivityTrends,
} from './queries';

// Placeholders for types not in main queries
export interface RecruitmentMetrics {
  tenantId: string;
  month: string;
  openPositions: number;
  totalCandidates: number;
  candidatesInReview: number;
  candidatesInterviewing: number;
  candidatesOffered: number;
  candidatesHired: number;
  candidatesRejected: number;
  avgTimeToHireDays: number;
  offerAcceptanceRatePct: number;
  interviewToOfferRatePct: number;
  computedAt: string;
}

export interface TrainingMetrics {
  tenantId: string;
  month: string;
  totalTrainingSessions: number;
  employeesTrained: number;
  avgSessionsPerEmployee: number;
  trainingCompletionRatePct: number;
  skillsDeveloped: number;
  certificationRatePct: number;
  trainingCostTotal: number;
  avgCostPerEmployee: number;
  computedAt: string;
}
