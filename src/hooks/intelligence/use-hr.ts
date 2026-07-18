/**
 * HR Intelligence API Hooks
 * 
 * React Query hooks for consuming HR Intelligence Layer APIs:
 * - Workforce analytics
 * - Attendance insights
 * - Payroll summaries
 * - Employee performance trends
 * 
 * CRITICAL: These hooks use React Query with properly configured staleTime 
 * matching backend TTL to prevent redundant API calls and respect cache-first strategy.
 * 
 * AGENTS.MD COMPLIANCE:
 * - Never use `any` type without proper type guards
 * - Cache-first strategy with appropriate TTL
 * - Tenant isolation at all layers
 * - IntelligenceResponse format for APIs
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Phase 8 Task #4
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UseQueryResult, UseMutationResult } from '@tanstack/react-query'

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Standard Intelligence Layer Response format
 */
interface IntelligenceResponse<T> {
  success: boolean
  data: T | null
  error: string | null
  metadata: {
    computedAt: string
    cached: boolean
    cacheAge?: number
    executionTime?: number
  }
}

/**
 * Workforce Analytics
 */
interface WorkforceAnalytics {
  totalEmployees: number
  activeEmployees: number
  onLeaveToday: number
  avgAttendanceRate: number
  avgKPI: number
  avgWorkingDaysPerMonth: number
  departmentBreakdown: Array<{
    department: string
    employeeCount: number
    avgAttendanceRate: number
  }>
  contractTypeBreakdown: Array<{
    contractType: string
    employeeCount: number
  }>
  turnoverRate: number
}

/**
 * Attendance Insights
 */
interface AttendanceInsights {
  month: string
  year: string
  totalWorkingDays: number
  avgAttendanceRate: number
  totalAbsences: number
  totalLateArrivals: number
  totalEarlyDepartures: number
  topPerformers: Array<{
    employeeId: string
    employeeName: string
    attendanceRate: number
    workingDays: number
  }>
  attendanceTrend: 'improving' | 'stable' | 'declining'
}

interface AttendanceReport {
  tenantId: string
  month: string
  ktvId: string
  ktvName: string
  ktvRole: string
  totalDays: number
  daysPresent: number
  daysAbsent: number
  daysLate: number
  daysHalfDay: number
  workingDays: number
  onTimeRatePct: number
  attendanceRatePct: number
  avgLateMinutes: number | null
  attendancePerformanceScore: number
  performanceRank: number
  attendanceStatus: 'excellent' | 'good' | 'fair' | 'poor'
  computedAt: string
}

/**
 * Payroll Summary
 */
interface PayrollSummary {
  month: string
  year: string
  totalGrossSalary: number
  totalNetSalary: number
  totalDeductions: number
  totalBonuses: number
  totalKPIBonus: number
  totalSessionBonus: number
  totalRatingBonus: number
  totalViolationsDeduction: number
  employeeCount: number
  avgSalaryPerEmployee: number
  payrollByDepartment: Array<{
    department: string
    totalSalary: number
    employeeCount: number
    avgSalary: number
  }>
}

/**
 * Employee Performance Trends
 */
interface EmployeePerformanceTrends {
  employeeId: string
  employeeName: string
  department: string
  performanceHistory: Array<{
    month: string
    year: string
    attendanceRate: number
    kpiScore: number
    totalSessions: number
    avgRating: number
    salaryTotal: number
  }>
  overallTrend: 'improving' | 'stable' | 'declining'
  strengths: string[]
  areasForImprovement: string[]
}

// ============================================================================
// QUERY KEYS (for cache management)
// ============================================================================

export const hrKeys = {
  all: ['intelligence', 'hr'] as const,
  workforceAnalytics: () => 
    [...hrKeys.all, 'workforce-analytics'] as const,
  attendanceInsights: (month: string, year: string) => 
    [...hrKeys.all, 'attendance-insights', month, year] as const,
  payrollSummary: (month: string, year: string) => 
    [...hrKeys.all, 'payroll-summary', month, year] as const,
  employeePerformance: (employeeId: string) => 
    [...hrKeys.all, 'employee-performance', employeeId] as const,
}

// ============================================================================
// API CLIENT FUNCTIONS
// ============================================================================

async function fetchWorkforceAnalytics(): Promise<IntelligenceResponse<WorkforceAnalytics>> {
  const response = await fetch('/api/intelligence/hr/workforce-analytics', {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  })

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchAttendanceInsights(
  month: string,
  year: string
): Promise<IntelligenceResponse<AttendanceInsights>> {
  const startDate = `${year}-${month}-01`;
  const lastDay = new Date(parseInt(year, 10), parseInt(month, 10), 0).getDate();
  const endDate = `${year}-${month}-${String(lastDay).padStart(2, '0')}`;

  const response = await fetch(
    `/api/intelligence/hr/attendance-report?period=custom&startDate=${startDate}&endDate=${endDate}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  const json = await response.json();
  const reports: AttendanceReport[] = json.data || [];

  // Compute insights from raw reports array
  const totalWorkingDays = reports.length > 0 ? Math.max(...reports.map(r => r.totalDays)) : 0;
  const avgAttendanceRate = reports.length > 0 
    ? reports.reduce((sum, r) => sum + r.attendanceRatePct, 0) / reports.length 
    : 0;
  const totalAbsences = reports.reduce((sum, r) => sum + r.daysAbsent, 0);
  const totalLateArrivals = reports.reduce((sum, r) => sum + r.daysLate, 0);
  const totalEarlyDepartures = reports.reduce((sum, r) => sum + (r.daysHalfDay || 0), 0);

  const topPerformers = [...reports]
    .sort((a, b) => b.attendanceRatePct - a.attendanceRatePct)
    .map(r => ({
      employeeId: r.ktvId,
      employeeName: r.ktvName,
      attendanceRate: r.attendanceRatePct,
      workingDays: r.workingDays,
    }));

  const insights: AttendanceInsights = {
    month,
    year,
    totalWorkingDays,
    avgAttendanceRate,
    totalAbsences,
    totalLateArrivals,
    totalEarlyDepartures,
    topPerformers,
    attendanceTrend: 'stable',
  };

  return {
    success: json.success,
    data: insights,
    error: json.error || null,
    metadata: json.metadata,
  };
}

async function fetchPayrollSummary(
  month: string,
  year: string
): Promise<IntelligenceResponse<PayrollSummary>> {
  const response = await fetch(
    `/api/intelligence/hr/payroll-summary?period=current_month`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

async function fetchEmployeePerformance(
  employeeId: string
): Promise<IntelligenceResponse<EmployeePerformanceTrends>> {
  const response = await fetch(
    `/api/intelligence/hr/employee-performance?employeeId=${employeeId}`,
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }
  )

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
    throw new Error(errorData.error || `API Error: ${response.status}`)
  }

  return response.json()
}

// ============================================================================
// REACT QUERY HOOKS
// ============================================================================

/**
 * Hook: Workforce Analytics
 * 
 * Fetches aggregated workforce analytics (headcount, attendance, turnover).
 * 
 * Cache Strategy:
 * - staleTime: 12 hours (workforce data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param options - React Query options
 */
export function useWorkforceAnalytics(
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<WorkforceAnalytics>, Error> {
  return useQuery({
    queryKey: hrKeys.workforceAnalytics(),
    queryFn: fetchWorkforceAnalytics,
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Attendance Insights
 * 
 * Fetches attendance insights for a specific month (attendance rate, absences, trends).
 * 
 * Cache Strategy:
 * - staleTime: 6 hours (attendance data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param month - Month string (e.g., '01', '12')
 * @param year - Year string (e.g., '2026')
 * @param options - React Query options
 */
export function useAttendanceInsights(
  month: string,
  year: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<AttendanceInsights>, Error> {
  return useQuery({
    queryKey: hrKeys.attendanceInsights(month, year),
    queryFn: () => fetchAttendanceInsights(month, year),
    staleTime: 6 * 60 * 60 * 1000, // 6 hours
    gcTime: 12 * 60 * 60 * 1000, // 12 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Payroll Summary
 * 
 * Fetches payroll summary for a specific month (total salaries, bonuses, deductions).
 * 
 * Cache Strategy:
 * - staleTime: 12 hours (payroll data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param month - Month string (e.g., '01', '12')
 * @param year - Year string (e.g., '2026')
 * @param options - React Query options
 */
export function usePayrollSummary(
  month: string,
  year: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<PayrollSummary>, Error> {
  return useQuery({
    queryKey: hrKeys.payrollSummary(month, year),
    queryFn: () => fetchPayrollSummary(month, year),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Employee Performance Trends
 * 
 * Fetches performance history and trends for a specific employee.
 * 
 * Cache Strategy:
 * - staleTime: 12 hours (performance data updates daily)
 * - Matches backend TTL in cache-config.ts
 * 
 * @param employeeId - Employee UUID
 * @param options - React Query options
 */
export function useEmployeePerformance(
  employeeId: string,
  options?: {
    enabled?: boolean
    refetchOnMount?: boolean
    refetchOnWindowFocus?: boolean
  }
): UseQueryResult<IntelligenceResponse<EmployeePerformanceTrends>, Error> {
  return useQuery({
    queryKey: hrKeys.employeePerformance(employeeId),
    queryFn: () => fetchEmployeePerformance(employeeId),
    staleTime: 12 * 60 * 60 * 1000, // 12 hours
    gcTime: 24 * 60 * 60 * 1000, // 24 hours
    refetchOnMount: options?.refetchOnMount ?? false,
    refetchOnWindowFocus: options?.refetchOnWindowFocus ?? false,
    enabled: options?.enabled ?? true,
  })
}

/**
 * Hook: Fetch All HR Data in Parallel
 * 
 * Convenience hook to fetch all HR intelligence data at once.
 * Uses React Query's parallel query execution for optimal performance.
 * 
 * @param params - Parameters for all queries
 */
export function useAllHRData(params: {
  month: string
  year: string
  employeeId?: string
}) {
  const workforceAnalytics = useWorkforceAnalytics()
  const attendanceInsights = useAttendanceInsights(params.month, params.year)
  const payrollSummary = usePayrollSummary(params.month, params.year)
  const employeePerformance = useEmployeePerformance(params.employeeId || '', {
    enabled: !!params.employeeId,
  })

  return {
    workforceAnalytics,
    attendanceInsights,
    payrollSummary,
    employeePerformance,
    isLoading: 
      workforceAnalytics.isLoading || 
      attendanceInsights.isLoading || 
      payrollSummary.isLoading || 
      (params.employeeId ? employeePerformance.isLoading : false),
    isError: 
      workforceAnalytics.isError || 
      attendanceInsights.isError || 
      payrollSummary.isError || 
      (params.employeeId ? employeePerformance.isError : false),
    errors: {
      workforceAnalytics: workforceAnalytics.error,
      attendanceInsights: attendanceInsights.error,
      payrollSummary: payrollSummary.error,
      employeePerformance: employeePerformance.error,
    },
  }
}

/**
 * Hook: Refresh HR Data Cache
 * 
 * Mutation to manually trigger cache invalidation and refetch for HR data.
 * Useful for "Refresh" buttons in dashboards.
 * 
 * Usage:
 * ```tsx
 * const { mutate: refresh, isPending } = useRefreshHRData()
 * <button onClick={() => refresh('all')} disabled={isPending}>
 *   Làm mới
 * </button>
 * ```
 */
export function useRefreshHRData(): UseMutationResult<
  void,
  Error,
  'all' | 'workforce-analytics' | 'attendance-insights' | 'payroll-summary' | 'employee-performance',
  unknown
> {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (
      target: 'all' | 'workforce-analytics' | 'attendance-insights' | 'payroll-summary' | 'employee-performance'
    ) => {
      if (target === 'all') {
        await queryClient.invalidateQueries({ queryKey: hrKeys.all })
      } else {
        await queryClient.invalidateQueries({ 
          queryKey: [...hrKeys.all, target] 
        })
      }
    },
    onSuccess: () => {
      // Optional: Show toast notification
      console.log('[HR Intelligence] Cache invalidated, refetching...')
    },
  })
}

/**
 * Hook: Check HR Cache Status
 * 
 * Utility hook to check if HR data is cached and fresh.
 * Useful for showing cache indicators in UI.
 * 
 * @returns Cache status for all HR queries
 */
export function useHRCacheStatus() {
  const queryClient = useQueryClient()

  const getQueryCacheStatus = (queryKey: readonly unknown[]) => {
    const queryState = queryClient.getQueryState(queryKey)
    return {
      isCached: !!queryState,
      isFresh: queryState ? Date.now() - queryState.dataUpdatedAt < 12 * 60 * 60 * 1000 : false,
      lastUpdated: queryState?.dataUpdatedAt,
    }
  }

  return {
    workforceAnalytics: () => 
      getQueryCacheStatus(hrKeys.workforceAnalytics()),
    attendanceInsights: (month: string, year: string) => 
      getQueryCacheStatus(hrKeys.attendanceInsights(month, year)),
    payrollSummary: (month: string, year: string) => 
      getQueryCacheStatus(hrKeys.payrollSummary(month, year)),
    employeePerformance: (employeeId: string) => 
      getQueryCacheStatus(hrKeys.employeePerformance(employeeId)),
  }
}
