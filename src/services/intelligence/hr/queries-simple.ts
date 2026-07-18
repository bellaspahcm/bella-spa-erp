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

    // Query attendance to calculate actual workforce average attendance rate
    const currentMonthStr = new Date().toISOString().slice(0, 7);
    const [yearStr, monthStr] = currentMonthStr.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const startDate = `${currentMonthStr}-01`;
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    const { data: attendanceData, error: attendanceError } = await supabase
      .from('attendance')
      .select('status')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lt('date', endDate);

    if (attendanceError) {
      console.error('[HR Intelligence] Attendance query in workforce error:', attendanceError);
      throw new QueryError('Failed to query attendance for workforce analytics', attendanceError);
    }

    let avgAttendanceRate = 0;
    if (attendanceData && attendanceData.length > 0) {
      const presentOrLate = attendanceData.filter(a => a.status === 'present' || a.status === 'late').length;
      avgAttendanceRate = (presentOrLate / attendanceData.length) * 100;
    }

    // Query KPI records to calculate average KPI score (achievement rate)
    const { data: kpiData, error: kpiError } = await supabase
      .from('kpi_records')
      .select('kpi_achievement_rate')
      .eq('tenant_id', tenantId)
      .eq('month_year', startDate);

    let avgKPI = 0;
    if (!kpiError && kpiData && kpiData.length > 0) {
      const totalKpi = kpiData.reduce((sum, k) => sum + (Number(k.kpi_achievement_rate) || 0), 0);
      avgKPI = totalKpi / kpiData.length;
    }

    // Return aggregated metrics
    return {
      totalEmployees: activeUsers.length,
      activeEmployees: activeUsers.length,
      onLeaveToday: 0,
      avgAttendanceRate,
      avgKPI,
      avgWorkingDaysPerMonth: 0,
      departmentBreakdown: Object.entries(roleGroups).map(([dept, count]) => ({
        department: dept,
        employeeCount: count,
        avgAttendanceRate,
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

    // Build safe date range for PostgreSQL
    const [yearStr, monthStr] = currentMonth.split('-');
    const year = parseInt(yearStr, 10);
    const monthNum = parseInt(monthStr, 10);
    const startDate = `${currentMonth}-01`;
    const nextMonth = monthNum === 12 ? 1 : monthNum + 1;
    const nextYear = monthNum === 12 ? year + 1 : year;
    const endDate = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;

    // Query attendance table using correct schema columns
    const { data: attendance, error } = await supabase
      .from('attendance')
      .select('ktv_id, date, status, checkin_time')
      .eq('tenant_id', tenantId)
      .gte('date', startDate)
      .lt('date', endDate) as {
        data: Array<{ ktv_id: string; date: string; status: string; checkin_time: string | null }> | null;
        error: any;
      };

    if (error) {
      console.error('[HR Intelligence] Attendance query error:', error);
      throw new QueryError(`Failed to fetch attendance report: ${error.message}`, error);
    }

    if (!attendance || attendance.length === 0) {
      return [];
    }

    // Get user info
    const userIds = [...new Set(attendance.map(a => a.ktv_id))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, role, phone')
      .in('id', userIds);

    if (usersError) {
      throw new QueryError(`Failed to fetch user data for attendance: ${usersError.message}`, usersError);
    }

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Group attendance by user
    const userAttendance = attendance.reduce((acc, record) => {
      if (!acc[record.ktv_id]) {
        acc[record.ktv_id] = [];
      }
      acc[record.ktv_id].push(record);
      return acc;
    }, {} as Record<string, Array<{ ktv_id: string; date: string; status: string; checkin_time: string | null }>>);

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
    throw error;
  }
}

/**
 * Get Payroll Summary - Simplified
 * Returns salary data from salary_records table
 */
export async function getPayrollSummary(tenantId: string, month: string) {
  try {
    const supabase = await createServiceRoleClient();
    const formattedMonth = month.includes('-') && month.split('-').length === 2 ? `${month}-01` : month;

    // Query salary_records table
    const { data: salaryRecords, error } = await supabase
      .from('salary_records')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('month_year', formattedMonth);

    if (error) {
      console.error('[HR Intelligence] Payroll query error:', error);
      throw new QueryError(`Failed to fetch payroll summary: ${error.message}`, error);
    }

    if (!salaryRecords || salaryRecords.length === 0) {
      return [];
    }

    // Get user info
    const userIds = salaryRecords.map(s => s.ktv_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, role')
      .in('id', userIds);

    if (usersError) {
      throw new QueryError(`Failed to fetch user data for payroll: ${usersError.message}`, usersError);
    }

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
    const formattedMonth = currentMonth.includes('-') && currentMonth.split('-').length === 2 ? `${currentMonth}-01` : currentMonth;

    // Query KPI records using correct schema columns
    const { data: kpiRecords, error: kpiError } = await supabase
      .from('kpi_records')
      .select('ktv_id, customer_satisfaction, bonus_amount')
      .eq('tenant_id', tenantId)
      .eq('month_year', formattedMonth) as {
        data: Array<{ ktv_id: string; customer_satisfaction: number | null; bonus_amount: number | null }> | null;
        error: any;
      };

    if (kpiError) {
      console.error('[HR Intelligence] KPI query error:', kpiError);
      throw new QueryError(`Failed to fetch employee performance: ${kpiError.message}`, kpiError);
    }

    if (!kpiRecords || kpiRecords.length === 0) {
      return [];
    }

    // Get user info
    const userIds = kpiRecords.map(k => k.ktv_id);
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, full_name, role, phone')
      .in('id', userIds);

    if (usersError) {
      throw new QueryError(`Failed to fetch user data for performance: ${usersError.message}`, usersError);
    }

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Map to output format
    return kpiRecords.map(record => {
      const user = userMap.get(record.ktv_id);
      const score = record.customer_satisfaction ? parseFloat(record.customer_satisfaction.toString()) : 0;
      const bonus = record.bonus_amount ? parseFloat(record.bonus_amount.toString()) : 0;
      return {
        tenantId,
        month: currentMonth,
        ktvId: record.ktv_id,
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
        kpiScore: score,
        kpiAmount: bonus,
        customerSatisfactionScore: score,
        totalRevenueContributed: 0,
        revenueTransactionCount: 0,
        workingDays: 0,
        onTimeDays: 0,
        absentDays: 0,
        revenuePerSession: 0,
        sessionsPerWorkingDay: 0,
        overallPerformanceScore: score,
        performanceRank: 0,
        performanceTier: 'top_50' as const,
        computedAt: new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error('[HR Intelligence] Employee performance error:', error);
    throw error;
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
  avgKPI: number;
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
