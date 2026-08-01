'use server';

import { createClient } from '@/lib/supabase-server';
import { getCurrentUser } from '@/services/user-actions';
import { createDevelopmentBypassClient } from '@/lib/supabase-dev-bypass-server';
import { resolvePackageName, getLocalDateString } from '@bella/shared';;
import { calcProRataBaseSalary } from './base-salary-actions';
import {
  buildPackageMultiplierMap,
  calculateLiveAttendanceSalaryComponents,
  calculateRatingBonus,
  calculateSessionCommissionBonus,
  calculateWeightedSessionCount,
  getSessionPackageMultiplier,
} from './salary-attendance-calculation';
import { buildSalaryDisplayComponents } from '@/lib/business-rules/salary';
import {
  calculatePositionBonus,
  calculateSeniorityBonus,
  aggregateManualAdjustments,
  type CommissionConfig,
} from '@/lib/business-rules/commission';
import { KtvSalaryRecord, KtvSessionMatrix, KtvSessionMatrixRecord, TenantSalaryConfig } from '@/types/domain';

// Interfaces for Database Records
interface KtvUserData {
  id: string;
  full_name: string | null;
  role: string | null;
  base_salary: number | null;
  hire_date: string | null;
  resignation_date: string | null;
  status: string | null;
  position_tier?: 'junior' | 'senior' | 'lead' | null;
}

interface SalaryRecordDb {
  id: string;
  ktv_id: string;
  month_year: string;
  total_sessions: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  base_salary: number | null;
  kpi_bonus: number | null;
  violations_deduction: number | null;
  service_percentage_bonus: number | null;
  total_salary: number | null;
  status: string | null;
  service_commission?: number | null;
  product_sales_commission?: number | null;
  position_bonus?: number | null;
  seniority_bonus?: number | null;
  manual_adjustments?: number | null;
}

interface SessionReviewDb {
  rating: number | null;
  status: string | null;
}

interface BookingDb {
  ktv_commission: number | null;
  package_name: string | null;
}

interface SessionLogDb {
  id: string;
  completed_by_ktv_id: string | null;
  status: string | null;
  is_confirmed: boolean | null;
  rating: number | null;
  bookings: BookingDb | null;
  session_reviews: SessionReviewDb[];
}

interface AttendanceLogDb {
  id: string;
  ktv_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
}

interface PackageNameDb {
  name: string | null;
  session_multiplier: number | null;
}

interface KpiRecordDb {
  ktv_id: string;
  bonus_amount: number | null;
}

interface MatrixBookingDb {
  id: string;
  package_name: string | null;
  full_price: number | null;
  packages: { name: string | null; session_multiplier: number | null } | null;
}

interface MatrixSessionLogDb {
  id: string;
  completed_by_ktv_id: string | null;
  status: string | null;
  is_confirmed: boolean | null;
  bookings: MatrixBookingDb | null;
}

interface MatrixKtvUser {
  id: string;
  full_name: string | null;
  resignation_date: string | null;
}

/**
 * Fetches comprehensive salary data for all KTVs in the current tenant.
 * 
 * This is the **primary salary data provider** for the admin salary dashboard and KTV mobile app.
 * Calculates real-time salary breakdowns including base salary, session bonuses, rating bonuses,
 * KPI bonuses, and attendance deductions for all KTV employees.
 * 
 * **Authorization**:
 * - Admin users: See all KTVs in the tenant
 * - KTV users: See only their own salary data
 * 
 * @returns Promise resolving to array of {@link KtvSalaryRecord} objects with full salary breakdown
 * 
 * @throws {Error} If tenant context missing or database queries fail
 * 
 * @remarks
 * **Data Sources & Business Logic:**
 * - Tenant salary config from `tenants.salary_config` (bonus thresholds, penalty rates)
 * - KTV base salaries from `users` table
 * - Salary records from `salary_records` table (saved state)
 * - Live session data from `session_logs` with package multipliers
 * - Composite ratings from `get_ktv_leaderboard` RPC (60% customer + 40% discipline)
 * - Attendance data from `attendance` table (late/absent penalties)
 * - KPI bonuses from `kpi_records` table (synced with leaderboard)
 * 
 * **Calculation Rules:**
 * - **Draft Records**: Dynamically recalculated from live data on every query
 * - **Non-Draft Records**: Uses saved values from `salary_records` table
 * - **Pro-Rata Salary**: Automatically applied for KTVs with `resignation_date` in current month
 * - **Session Multipliers**: Package coefficients applied (Basic: 1.0, Happy: 1.5, VIP: 2.0)
 * - **Rating Bonuses**: Based on composite rating thresholds (5★: 50k, 4.5★: 30k, 4★: 10k per session)
 * - **Attendance Penalties**: Auto-calculated using tenant config (late: 50k/day, absent: 200k/day)
 * 
 * **Performance Considerations:**
 * - Marked with `'use server'` - runs on server only
 * - Multiple database queries executed sequentially
 * - Large tenants (50+ KTVs) may take 1-2 seconds
 * - Consider caching for high-traffic dashboards
 * 
 * **Status Filtering:**
 * - Includes all salary statuses: draft, pending_approval, published, confirmed, finalized
 * - `isConfirmed` flag set to true only for 'confirmed' and 'finalized' statuses
 * 
 * @example
 * ```typescript
 * // Fetch all salary data for admin dashboard
 * const salaries = await getSalaryData();
 * 
 * salaries.forEach(ktv => {
 *   console.log(`${ktv.name}: ${ktv.totalSalary.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Base: ${ktv.baseSalary.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Sessions: ${ktv.sessions} ca`);
 *   console.log(`  Bonus: ${ktv.sessionBonus.toLocaleString('vi-VN')}đ`);
 *   console.log(`  Status: ${ktv.status}`);
 * });
 * ```
 * 
 * @see {@link getKtvSessionMatrix} for session distribution by package type
 * @see {@link BUSINESS_RULES.PAYROLL} for calculation constants
 */
export async function getSalaryData(): Promise<KtvSalaryRecord[]> {
  try {
    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const supabase = await createDevelopmentBypassClient();
    const currentUser = await getCurrentUser();
    const tenantId = currentUser?.tenant_id;
    if (!tenantId) {
      throw new Error('[getSalaryData] Missing tenantId for current user');
    }

    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('salary_config, commission_config, enabled_modules')
      .eq('id', tenantId)
      .single();
    if (tenantError) {
      throw new Error(`[getSalaryData] tenants query failed: ${tenantError.message}`);
    }
    const stored = (tenantData?.salary_config as unknown as Partial<TenantSalaryConfig>) || {};
    const salaryConfig: TenantSalaryConfig = {
      bonus_5_star:          stored.bonus_5_star          ?? 50000,
      bonus_4_5_star:        stored.bonus_4_5_star        ?? 30000,
      bonus_4_star:          stored.bonus_4_star          ?? 10000,
      kpi_target_sessions:   stored.kpi_target_sessions   ?? 30,
      kpi_bonus_amount:      stored.kpi_bonus_amount      ?? 1000000,
      penalty_late_per_day:  stored.penalty_late_per_day  ?? 50000,
      penalty_absent_per_day: stored.penalty_absent_per_day ?? 200000,
    };

    const commissionConfig = (tenantData?.commission_config as unknown as Partial<CommissionConfig>) || {};
    const positionMultipliers = commissionConfig.position_multipliers || { junior: 1.0, senior: 1.2, lead: 1.5 };
    const seniorityBonusRates = commissionConfig.seniority_bonus_rates || {
      '0_to_1_year': 0.00,
      '1_to_3_years': 0.05,
      '3_to_5_years': 0.10,
      '5_plus_years': 0.15,
    };

    const { data: kpiConfigData } = await supabase
      .from('tenant_payroll_config')
      .select('config, enabled')
      .eq('provider_key', 'kpi')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    let dynamicKpiTargetSessions = salaryConfig.kpi_target_sessions;
    if (kpiConfigData?.enabled && kpiConfigData.config) {
      const config = kpiConfigData.config as { target?: number };
      if (typeof config.target === 'number') {
        dynamicKpiTargetSessions = config.target;
      }
    }

    const { getDefaultTenantModuleKey } = await import('@/lib/business-rules/tenant-modules');
    const moduleKey = getDefaultTenantModuleKey(tenantData?.enabled_modules);

    let rawKtvs: KtvUserData[] = [];
    if (moduleKey === 'real_estate') {
      const { data: hrSummary, error: hrError } = await (supabase as any).rpc(
        'get_hr_employee_summary',
        { p_tenant_id: tenantId, p_status: 'active' }
      );
      if (hrError) {
        throw new Error(`[getSalaryData] get_hr_employee_summary failed: ${hrError.message}`);
      }
      
      const hrSummaryMapped: KtvUserData[] = (hrSummary || []).map((row: any) => ({
        id: row.person_id,
        full_name: row.display_name,
        role: 'ktv',
        base_salary: row.base_salary ? Number(row.base_salary) : 6000000,
        hire_date: row.hire_date,
        resignation_date: null,
        status: 'active',
        position_tier: (row.position_title?.toLowerCase().includes('lead') || row.position_title?.toLowerCase().includes('trưởng phòng')
          ? 'lead'
          : row.position_title?.toLowerCase().includes('senior') || row.position_title?.toLowerCase().includes('cao cấp')
            ? 'senior'
            : 'junior') as 'lead' | 'senior' | 'junior'
      }));

      if (currentUser?.role?.toLowerCase() === 'ktv') {
        rawKtvs = hrSummaryMapped.filter((ktv: KtvUserData) => ktv.id === currentUser.id);
      } else {
        rawKtvs = hrSummaryMapped;
      }
    } else {
      const ktvQuery = supabase
        .from('users')
        .select('id, full_name, role, base_salary, hire_date, resignation_date, status, position_tier')
        .eq('role', 'ktv')
        .eq('tenant_id', tenantId);

      // If current user is KTV, they can only see their own data
      if (currentUser?.role?.toLowerCase() === 'ktv') {
        ktvQuery.eq('id', currentUser.id);
      }

      const { data: ktvs, error: ktvsError } = await ktvQuery;
      if (ktvsError) {
        throw new Error(`[getSalaryData] users query failed: ${ktvsError.message}`);
      }
      rawKtvs = (ktvs || []) as KtvUserData[];
    }

    const startOfMonthStr = currentMonthYear;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    const { data: salaryRecordsData, error: salaryRecordsError } = await supabase
      .from('salary_records')
      .select('*')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);
    if (salaryRecordsError) {
      throw new Error(`[getSalaryData] salary_records query failed: ${salaryRecordsError.message}`);
    }
    
    const salaryRecords = (salaryRecordsData || []) as SalaryRecordDb[];

    // Filter out users who resigned before the start of the current month
    // but keep them if a salary record has already been saved for this month (history/audit)
    const realKtvs = rawKtvs.filter((ktv) => {
      const hasRecord = salaryRecords.some((r) => r.ktv_id === ktv.id);
      if (hasRecord) return true;

      if (ktv.resignation_date) {
        const resignDate = new Date(ktv.resignation_date);
        const monthDate = new Date(currentMonthYear);
        return resignDate >= monthDate;
      }
      return true;
    });

    // Fetch completed sessions with booking details + rating fallback
    const { data: sessionsData, error: sessionsError } = await supabase
      .from('session_logs')
      .select('id, completed_by_ktv_id, status, is_confirmed, rating, bookings(ktv_commission, package_name), session_reviews(rating, status)')
      .eq('status', 'completed')
      .gte('completed_date', startOfMonthStr)
      .lt('completed_date', endOfMonthStr)
      .eq('tenant_id', tenantId);
    if (sessionsError) {
      throw new Error(`[getSalaryData] session_logs query failed: ${sessionsError.message}`);
    }

    const sessions = (sessionsData || []) as unknown as SessionLogDb[];

    // Fetch blended composite ratings (60% customer + 40% discipline) via RPC.
    // Single source of truth — same data the leaderboard and dashboard cards use.
    // KTVs with no activity yet have average_rating = null → no quality bonus.
    const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
      'get_ktv_leaderboard',
      { p_tenant_id: tenantId, p_month: currentMonthYear }
    );
    if (leaderboardError) {
      console.error('[getSalaryData] get_ktv_leaderboard failed:', leaderboardError);
      throw new Error(`get_ktv_leaderboard failed: ${leaderboardError.message}`);
    }
    const leaderboard = (leaderboardData || []) as unknown as {
      ktv_id: string;
      average_rating: number | null;
      late_days: number | null;
      absent_days: number | null;
      total_kpi_bonus: number | null;
    }[];
    const leaderboardByKtv = new Map<string, typeof leaderboard[number]>(
      leaderboard.map((row) => [row.ktv_id, row])
    );

    // Fetch all attendance logs this month
    const { data: attendanceLogs, error: attendanceError } = await supabase
      .from('attendance')
      .select('*')
      .gte('date', startOfMonthStr)
      .lt('date', endOfMonthStr)
      .eq('tenant_id', tenantId);
    if (attendanceError) {
      throw new Error(`[getSalaryData] attendance query failed: ${attendanceError.message}`);
    }

    const attendanceLogsTyped = (attendanceLogs || []) as unknown as AttendanceLogDb[];

    // Fetch packages for multiplier mapping
    const { data: packagesData, error: packagesError } = await supabase
      .from('packages')
      .select('name, session_multiplier')
      .eq('tenant_id', tenantId);

    if (packagesError) {
      throw new Error(`[getSalaryData] packages query failed: ${packagesError.message}`);
    }
    const packagesList = packagesData || [];
    const packageMultiplierMap = buildPackageMultiplierMap(packagesList);

    const { data: kpiRecordsData, error: kpiRecordsError } = await supabase
      .from('kpi_records')
      .select('ktv_id, bonus_amount')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);
    if (kpiRecordsError) {
      throw new Error(`[getSalaryData] kpi_records query failed: ${kpiRecordsError.message}`);
    }

    const kpiBonusByKtv = new Map<string, number>();
    ((kpiRecordsData || []) as KpiRecordDb[]).forEach((record) => {
      kpiBonusByKtv.set(record.ktv_id, (kpiBonusByKtv.get(record.ktv_id) ?? 0) + Number(record.bonus_amount || 0));
    });

    // Fetch product sales commission for all KTVs this month
    // Include both 'completed' and 'pending' to match SalaryDetailModal filter
    const { data: productSalesData, error: productSalesError } = await supabase
      .from('product_sales')
      .select('ktv_id, calculated_commission')
      .in('status', ['completed', 'pending'])
      .gte('sale_date', startOfMonthStr)
      .lt('sale_date', endOfMonthStr)
      .eq('tenant_id', tenantId);
    
    if (productSalesError) {
      console.error('[getSalaryData] product_sales query failed:', productSalesError);
      // Non-blocking: continue with 0 commission
    }

    const productSalesCommissionByKtv = new Map<string, number>();
    ((productSalesData || []) as { ktv_id: string; calculated_commission: number }[]).forEach((sale) => {
      const current = productSalesCommissionByKtv.get(sale.ktv_id) ?? 0;
      productSalesCommissionByKtv.set(sale.ktv_id, current + Number(sale.calculated_commission || 0));
    });

    // Fetch booking service items commission for all KTVs this month
    const { data: serviceItemsData, error: serviceItemsError } = await supabase
      .from('booking_service_items')
      .select('ktv_id, calculated_commission')
      .eq('status', 'completed')
      .gte('completed_date', startOfMonthStr)
      .lt('completed_date', endOfMonthStr)
      .eq('tenant_id', tenantId);

    if (serviceItemsError) {
      console.error('[getSalaryData] booking_service_items query failed:', serviceItemsError);
    }
    const serviceItemsCommissionByKtv = new Map<string, number>();
    ((serviceItemsData || []) as { ktv_id: string; calculated_commission: number | null }[]).forEach((item) => {
      const current = serviceItemsCommissionByKtv.get(item.ktv_id) ?? 0;
      serviceItemsCommissionByKtv.set(item.ktv_id, current + Number(item.calculated_commission || 0));
    });

    // Fetch manual adjustments for all KTVs this month
    const { data: adjustmentsData, error: adjustmentsError } = await supabase
      .from('salary_adjustments')
      .select('ktv_id, adjustment_type, amount, status')
      .eq('status', 'approved')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);

    if (adjustmentsError) {
      console.error('[getSalaryData] salary_adjustments query failed:', adjustmentsError);
    }
    const manualAdjustmentsByKtv = new Map<string, Array<{ adjustment_type: 'bonus' | 'deduction'; amount: number; status: string }>>();
    ((adjustmentsData || []) as Array<{ ktv_id: string; adjustment_type: 'bonus' | 'deduction'; amount: number; status: string } >).forEach((adj) => {
      const list = manualAdjustmentsByKtv.get(adj.ktv_id) ?? [];
      list.push(adj);
      manualAdjustmentsByKtv.set(adj.ktv_id, list);
    });

    const ktvSalaries = await Promise.all(realKtvs.map(async (ktv) => {
        const record = salaryRecords.find((r) => r.ktv_id === ktv.id);
        
        const ktvCompletedSessions = sessions.filter((s) => s.completed_by_ktv_id === ktv.id);
        const liveSessionsCount = calculateWeightedSessionCount(ktvCompletedSessions, packageMultiplierMap);
        
        // Blended composite rating + attendance breakdown from RPC.
        const ktvLb = leaderboardByKtv.get(ktv.id);
        const avgRating: number | null = ktvLb?.average_rating ?? null;
        const lateDays   = ktvLb?.late_days   ?? 0;
        const absentDays = ktvLb?.absent_days ?? 0;

        const ktvAttendance = attendanceLogsTyped.filter((a) => a.ktv_id === ktv.id);
        const rawBaseSalary = ktv.base_salary ?? 6000000;
        const liveAttendanceComponents = calculateLiveAttendanceSalaryComponents({
          attendanceLogs: ktvAttendance,
          rawBaseSalary,
          lateDays,
          absentDays,
          penaltyLatePerDay: salaryConfig.penalty_late_per_day,
          penaltyAbsentPerDay: salaryConfig.penalty_absent_per_day,
        });
        const actualDays = liveAttendanceComponents.actualDays;
        const autoAttendancePenalty = liveAttendanceComponents.deductions;
        let liveBaseSalary = liveAttendanceComponents.baseSalary;

        const liveRatingBonus = calculateRatingBonus(liveSessionsCount, avgRating, salaryConfig);
        const liveSessionBonus = calculateSessionCommissionBonus(ktvCompletedSessions);

        // Cap live draft base salary by resignation date if active.
        // Non-draft saved records are preserved by buildSalaryDisplayComponents.
        if (ktv.resignation_date) {
          const resignDate = new Date(ktv.resignation_date);
          const monthDate = new Date(currentMonthYear);
          if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
            const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
            if (liveBaseSalary > resignCap) {
              liveBaseSalary = resignCap;
            }
          }
        }

        const liveServiceCommission = serviceItemsCommissionByKtv.get(ktv.id) ?? 0;
        const liveManualAdjustments = aggregateManualAdjustments({
          adjustments: manualAdjustmentsByKtv.get(ktv.id) ?? [],
        });
        const positionTier = (ktv.position_tier || 'junior') as 'junior' | 'senior' | 'lead';
        const livePositionBonus = calculatePositionBonus({
          baseCommission: liveServiceCommission,
          positionTier,
          multipliers: positionMultipliers,
        });
        const liveSeniorityBonus = calculateSeniorityBonus({
          baseSalary: liveBaseSalary,
          hireDate: ktv.hire_date,
          bonusRates: seniorityBonusRates,
        });

        const salaryDisplay = buildSalaryDisplayComponents({
          record,
          liveSessionsCount,
          liveSessionBonus,
          liveRatingBonus,
          liveBaseSalary,
          liveKpiBonus: kpiBonusByKtv.get(ktv.id) ?? 0,
          liveDeductions: autoAttendancePenalty,
          liveAdvances: 0,
          // Advanced commission components (Task 28-32)
          liveServiceCommission,
          liveProductSalesCommission: productSalesCommissionByKtv.get(ktv.id) ?? 0,
          livePositionBonus,
          liveSeniorityBonus,
          liveManualAdjustments,
        });

        return {
          id: ktv.id,
          name: ktv.full_name || '',
          sessions: salaryDisplay.sessions,
          isConfirmed: salaryDisplay.status === 'confirmed' || salaryDisplay.status === 'finalized',
          avgRating,
          baseSalary: salaryDisplay.baseSalary,
          sessionBonus: salaryDisplay.sessionBonus,
          ratingBonus: salaryDisplay.ratingBonus,
          kpiBonus: salaryDisplay.kpiBonus,
          deductions: salaryDisplay.deductions,
          advances: salaryDisplay.advances,
          totalSalary: salaryDisplay.totalSalary,
          status: salaryDisplay.status,
          hireDate: ktv.hire_date,
          resignationDate: ktv.resignation_date,
          ktvStatus: ktv.status || 'active',
          actualDays,
          kpiTargetSessions: dynamicKpiTargetSessions,
          // Advanced commission components (Task 28-32)
          serviceCommission: salaryDisplay.serviceCommission,
          productSalesCommission: salaryDisplay.productSalesCommission,
          positionBonus: salaryDisplay.positionBonus,
          seniorityBonus: salaryDisplay.seniorityBonus,
          manualAdjustments: salaryDisplay.manualAdjustments,
        };
    }));

    return ktvSalaries;
  } catch (error) {
    console.error('Error in getSalaryData:', error);
    throw error instanceof Error ? error : new Error('getSalaryData failed');
  }
}

/**
 * Fetches KTV session distribution matrix grouped by package type.
 * 
 * Provides a tabular view of how many sessions each KTV completed for each package type
 * (Basic, Happy, VIP, etc.) in the current month. Used for the session matrix dashboard widget.
 * 
 * **Authorization**:
 * - Admin users: See all KTVs in the tenant
 * - KTV users: See only their own session data
 * 
 * @returns Promise resolving to {@link KtvSessionMatrix} with package columns and KTV rows
 * 
 * @throws {Error} If tenant context missing or database queries fail
 * 
 * @remarks
 * **Data Structure:**
 * ```typescript
 * {
 *   packageNames: ['Combo Mẹ & Bé Tiết Kiệm', 'Combo VIP', 'Dịch vụ lẻ'],
 *   ktvs: [
 *     {
 *       id: 'ktv-1',
 *       name: 'Nguyễn Văn A',
 *       isConfirmed: false,
 *       'Combo Mẹ & Bé Tiết Kiệm': 15.0,
 *       'Combo VIP': 8.0,
 *       'Dịch vụ lẻ': 2.0
 *     }
 *   ]
 * }
 * ```
 * 
 * **Session Counting Rules:**
 * - Uses package multipliers (Basic: 1.0, Happy: 1.5, VIP: 2.0)
 * - Weighted session counts shown (e.g., 10 VIP sessions = 20.0 displayed)
 * - Only 'completed' sessions included (excludes pending, cancelled)
 * - Confirmed status from `salary_records.status` ('pending_approval' or 'approved')
 * 
 * **Package Column Logic:**
 * - Dynamically discovered from completed sessions in current month
 * - Includes all packages defined in `packages` table (even with 0 sessions)
 * - Always includes 'Dịch vụ lẻ' (single-service sessions without package)
 * - Columns sorted alphabetically for consistency
 * 
 * **Zero-Session Handling:**
 * - KTVs with no sessions show 0 for all package columns
 * - Empty matrix (no sessions for any KTV) shows all 0s
 * - Prevents "no data" errors in dashboard UI
 * 
 * **Performance:**
 * - Uses `unstable_noStore()` from Next.js to disable caching
 * - Always fetches fresh data (important for real-time dashboards)
 * - Multiple database joins (sessions → bookings → packages)
 * 
 * @example
 * ```typescript
 * // Fetch session matrix for dashboard widget
 * const matrix = await getKtvSessionMatrix();
 * 
 * console.log('Package Types:', matrix.packageNames);
 * matrix.ktvs.forEach(ktv => {
 *   console.log(`${ktv.name}:`);
 *   matrix.packageNames.forEach(pkg => {
 *     console.log(`  ${pkg}: ${ktv[pkg]} sessions`);
 *   });
 * });
 * ```
 * 
 * @see {@link getSalaryData} for full salary breakdown including totals
 * @see {@link calculateWeightedSessionCount} for session multiplier logic
 */
export async function getKtvSessionMatrix(): Promise<KtvSessionMatrix> {
  const { unstable_noStore: noStore } = await import('next/cache');
  noStore();
  
  const supabase = await createClient();
  const currentUser = await getCurrentUser();
  const tenantId = currentUser?.tenant_id;
  if (!tenantId) {
    throw new Error('getKtvSessionMatrix missing tenantId for current user');
  }
  
  try {
    // 1. Fetch all KTVs
    const { data: tenantData, error: tenantError } = await supabase
      .from('tenants')
      .select('enabled_modules')
      .eq('id', tenantId)
      .single();
    if (tenantError) {
      throw new Error(`getKtvSessionMatrix tenants query failed: ${tenantError.message}`);
    }

    const { getDefaultTenantModuleKey } = await import('@/lib/business-rules/tenant-modules');
    const moduleKey = getDefaultTenantModuleKey(tenantData?.enabled_modules);

    let rawKtvs: MatrixKtvUser[] = [];
    if (moduleKey === 'real_estate') {
      const { data: hrSummary, error: hrError } = await (supabase as any).rpc(
        'get_hr_employee_summary',
        { p_tenant_id: tenantId, p_status: 'active' }
      );
      if (hrError) {
        throw new Error(`getKtvSessionMatrix get_hr_employee_summary failed: ${hrError.message}`);
      }
      
      const hrSummaryMapped = (hrSummary || []).map((row: any) => ({
        id: row.person_id,
        full_name: row.display_name,
        resignation_date: null
      }));

      if (currentUser?.role?.toLowerCase() === 'ktv') {
        rawKtvs = hrSummaryMapped.filter((ktv: any) => ktv.id === currentUser.id);
      } else {
        rawKtvs = hrSummaryMapped;
      }
    } else {
      const ktvQuery = supabase
        .from('users')
        .select('id, full_name, resignation_date')
        .eq('role', 'ktv')
        .eq('tenant_id', tenantId);

      if (currentUser?.role?.toLowerCase() === 'ktv') {
        ktvQuery.eq('id', currentUser.id);
      }

      const { data: ktvs, error: ktvsError } = await ktvQuery;
      if (ktvsError) {
        throw new Error(`getKtvSessionMatrix users query failed: ${ktvsError.message}`);
      }

      rawKtvs = (ktvs || []) as MatrixKtvUser[];
    }

    const now = new Date();
    const currentMonthYear = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    const endOfMonthStr = getLocalDateString(new Date(now.getFullYear(), now.getMonth() + 1, 1));

    // 2. Fetch salary records for confirmation status
    const { data: salaryRecordsData, error: salaryRecordsError } = await supabase
      .from('salary_records')
      .select('ktv_id, total_sessions, status')
      .eq('month_year', currentMonthYear)
      .eq('tenant_id', tenantId);
    if (salaryRecordsError) {
      throw new Error(`getKtvSessionMatrix salary_records query failed: ${salaryRecordsError.message}`);
    }

    const salaryRecords = (salaryRecordsData || []) as SalaryRecordDb[];

    // Filter out users who resigned before the start of the current month
    // but keep them if a salary record has already been saved for this month (history/audit)
    const realKtvs = rawKtvs.filter((ktv) => {
      const hasRecord = salaryRecords.some((r) => r.ktv_id === ktv.id);
      if (hasRecord) return true;

      if (ktv.resignation_date) {
        const resignDate = new Date(ktv.resignation_date);
        const monthDate = new Date(currentMonthYear);
        return resignDate >= monthDate;
      }
      return true;
    });

    // 3. Fetch completed sessions with booking details
    const { data: sessions, error: sessionsError } = await supabase
      .from('session_logs')
      .select(`
        id, 
        completed_by_ktv_id, 
        status, 
        is_confirmed,
        bookings (
          id,
          package_name,
          full_price,
          packages (
            name,
            session_multiplier
          )
        )
      `)
      .eq('status', 'completed')
      .gte('completed_date', currentMonthYear)
      .lt('completed_date', endOfMonthStr)
      .eq('tenant_id', tenantId);

    if (sessionsError) {
      throw new Error(`getKtvSessionMatrix session_logs query failed: ${sessionsError.message}`);
    }

    const sessionsTyped = (sessions || []) as unknown as MatrixSessionLogDb[];

    // 4. Group sessions by KTV and package
    const matrix: Record<string, Record<string, number>> = {};
    
    // Fetch all available packages from the database to ensure all columns are shown
    const { data: allPackages, error: packagesError } = await supabase
      .from('packages')
      .select('name, session_multiplier')
      .eq('tenant_id', tenantId);
    if (packagesError) {
      throw new Error(`getKtvSessionMatrix packages query failed: ${packagesError.message}`);
    }
    const packagesTyped = (allPackages || []) as PackageNameDb[];
    const packageMultiplierMap = buildPackageMultiplierMap(packagesTyped);
    
    // Build list of package names from sessions AND available packages
    const dynamicPackageNames = new Set<string>();
    
    // Add all existing packages to the columns list
    if (packagesTyped) {
      packagesTyped.forEach((pkg) => {
        if (pkg.name) dynamicPackageNames.add(pkg.name);
      });
    }

    if (sessionsTyped) {
      sessionsTyped.forEach((s) => {
        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        dynamicPackageNames.add(pkgName);
      });
    }
    const packageNames = Array.from(dynamicPackageNames);
    if (!packageNames.includes('Dịch vụ lẻ')) packageNames.push('Dịch vụ lẻ');
    
    if (sessionsTyped && sessionsTyped.length > 0) {
      sessionsTyped.forEach((s) => {
        const ktvId = s.completed_by_ktv_id;
        if (!ktvId) return;

        const pkgName = s.bookings ? resolvePackageName(s.bookings) : 'Dịch vụ lẻ';
        
        if (!matrix[ktvId]) matrix[ktvId] = {};
        matrix[ktvId][pkgName] = (matrix[ktvId][pkgName] || 0) + getSessionPackageMultiplier(s, packageMultiplierMap);
      });
    }

    const hasAnyRealData = sessionsTyped && sessionsTyped.length > 0;
    
    const rows = realKtvs.map((ktv) => {
      const row: KtvSessionMatrixRecord = { id: ktv.id, name: ktv.full_name || '', isConfirmed: false };
      
      const salaryRecord = salaryRecords.find((r) => r.ktv_id === ktv.id);
      // Confirmed if status is pending_approval, approved, confirmed, or finalized
      row.isConfirmed = !!(salaryRecord && 
                        (salaryRecord.status === 'pending_approval' || 
                         salaryRecord.status === 'approved' || 
                         salaryRecord.status === 'confirmed' || 
                         salaryRecord.status === 'finalized'));
      
      packageNames.forEach((pkg: string) => {
        if (hasAnyRealData && matrix[ktv.id]) {
          row[pkg] = matrix[ktv.id][pkg] || 0;
        } else {
          row[pkg] = 0;
        }
      });
      return row;
    });

    return { 
      packageNames, 
      ktvs: rows
    };
  } catch (error) {
    console.error('Critical error in getKtvSessionMatrix:', error);
    throw error instanceof Error ? error : new Error('getKtvSessionMatrix failed');
  }
}
