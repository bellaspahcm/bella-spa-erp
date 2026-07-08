'use server';

import { getLocalDateString } from '@bella/shared';;
import { Database } from '@/types/database.types';
import { TenantSalaryConfig } from '@/types/domain';
import type { SupabaseClient } from '@supabase/supabase-js';
import { calcProRataBaseSalary } from './base-salary-actions';
import {
  buildPackageMultiplierMap,
  calculateLiveAttendanceSalaryComponents,
  calculateRatingBonus,
  calculateSessionCommissionBonus,
  calculateWeightedSessionCount,
} from './salary-attendance-calculation';
import {
  assertSalaryRecalculationLifecycle,
  calculateSalaryTotal,
  hasSalaryFinancialRecalculationOverrides,
  isDraftSalaryRecord,
} from '@/lib/business-rules/salary';
import {
  calculateServiceCommission,
  calculateProductSalesCommission,
  calculatePositionBonus,
  calculateSeniorityBonus,
  aggregateManualAdjustments,
  type CommissionConfig,
} from '@/lib/business-rules/commission';

// Phase 1: Provider Integration (Comparison Mode)
// Import configuration-driven providers for parallel calculation
import { KPIProvider } from '@/services/providers/kpi-provider';
import { AttendanceProvider } from '@/services/providers/attendance-provider';
import { RatingProvider } from '@/services/providers/rating-provider';
import { CommissionProvider } from '@/services/providers/commission-provider';

// Initialize provider instances
const kpiProvider = new KPIProvider();
const attendanceProvider = new AttendanceProvider();
const ratingProvider = new RatingProvider();
const commissionProvider = new CommissionProvider();

// Phase 2: Feature Flag to conditionally use provider results
// When true: Use provider calculations instead of old hardcoded logic
// When false: Continue comparison mode (providers log only)
const USE_CONFIG_PROVIDERS = process.env.USE_CONFIG_PROVIDERS === 'true';

interface KtvUserDataAdmin {
  id: string;
  full_name: string | null;
  base_salary: number | null;
  resignation_date: string | null;
  tenant_id?: string | null;
}

interface AttendanceLogAdmin {
  id: string;
  ktv_id: string;
  date: string;
  status: 'present' | 'late' | 'absent' | 'half_day';
}

interface SessionLogAdmin {
  id: string;
  rating: number | null;
  bookings: { ktv_commission: number | null; package_name: string | null } | null;
  session_reviews: { rating: number | null; status: string | null }[];
}

interface PackageMultiplierRow {
  name: string | null;
  session_multiplier: number | null;
}

interface KpiBonusRow {
  bonus_amount: number | null;
}

export interface SalaryRecordDbAdmin {
  id: string;
  ktv_id: string;
  month_year: string;
  base_salary: number | null;
  session_bonus: number | null;
  rating_bonus: number | null;
  kpi_bonus: number | null;
  violations_deduction: number | null;
  service_percentage_bonus: number | null;
  total_sessions: number | null;
  total_salary: number | null;
  status: string | null;
  is_locked?: boolean | null;
  published_at?: string | null;
  notes?: string | null;
  tenant_id: string;
  users?: { full_name: string | null } | null;
  // Advanced commission system columns (Beauty Spa)
  service_commission?: number | null;
  product_sales_commission?: number | null;
  position_bonus?: number | null;
  seniority_bonus?: number | null;
  manual_adjustments?: number | null;
}

export interface SalaryRecalculationOverrides {
  base_salary?: number;
  kpi_bonus?: number;
  violations_deduction?: number;
  service_percentage_bonus?: number;
  status?: string;
  total_sessions?: number;
}

/**
 * Recalculates and saves a KTV salary record with full business logic enforcement.
 * 
 * This is the **central salary calculation engine** for the Bella Spa ERP system.
 * It handles pro-rata base salary calculations, package-based session multipliers,
 * KPI bonuses, rating bonuses, attendance deductions, and status-based recalculation rules.
 * 
 * @param supabase - Authenticated Supabase client with database access
 * @param ktvId - Unique identifier of the KTV employee
 * @param monthYear - Salary period in YYYY-MM-01 format (e.g., "2026-06-01")
 * @param tenantId - Tenant identifier for multi-tenancy isolation
 * @param overrides - Optional manual adjustments from admin (base salary, KPI, deductions, status, etc.)
 * 
 * @returns Promise resolving to success status and calculated total salary
 * 
 * @throws {Error} If database queries fail (KTV not found, tenant config missing, etc.)
 * @throws {Error} If salary record is locked or finalized (via {@link assertSalaryRecalculationLifecycle})
 * 
 * @remarks
 * **Business Logic Rules:**
 * - **Draft Records**: Recalculates all components dynamically from live attendance and session data
 * - **Non-Draft Records**: Preserves saved values unless explicit overrides are provided
 * - **Pro-Rata Salary**: Automatically calculates `(base_salary / 26) * actualDays` for partial months
 * - **Session Multipliers**: Uses package coefficients (Basic: 1.0, Happy: 1.5, VIP: 2.0) from {@link BUSINESS_RULES}
 * - **KPI Bonus Sync**: Fetches from `kpi_records` table to maintain consistency with leaderboard
 * - **Attendance Deductions**: Auto-calculates penalties for late/absent days using tenant salary config
 * - **Resignation Handling**: Caps base salary at resignation date for departing KTVs
 * 
 * **Status Lifecycle:**
 * - `draft` → Dynamic recalculation on every call
 * - `pending_approval` → Preserves saved values, only updates if overrides provided
 * - `published` → Locked for KTV confirmation
 * - `confirmed` → Locked for admin finalization
 * - `finalized` → Fully locked, expense entry created
 * 
 * **Critical for Financial Integrity:**
 * This function must be called whenever:
 * - Admin adjusts salary configuration (base salary, KPI, deductions)
 * - New sessions are completed and need to be reflected in salary
 * - Attendance logs are submitted/modified
 * - Admin publishes salary for KTV confirmation
 * - Salary status transitions occur
 * 
 * @example
 * ```typescript
 * // Admin publishes salary for KTV confirmation
 * const result = await recalculateAndSaveSalaryRecordEngine(
 *   supabase,
 *   'ktv-uuid',
 *   '2026-06-01',
 *   'tenant-uuid',
 *   { status: 'published' }
 * );
 * console.log(`Published salary: ${result.totalSalary.toLocaleString('vi-VN')}đ`);
 * ```
 * 
 * @example
 * ```typescript
 * // Admin manually adjusts KTV salary components
 * await recalculateAndSaveSalaryRecordEngine(
 *   supabase,
 *   'ktv-uuid',
 *   '2026-06-01',
 *   'tenant-uuid',
 *   {
 *     base_salary: 7000000,
 *     kpi_bonus: 500000,
 *     violations_deduction: 100000,
 *     status: 'pending_approval'
 *   }
 * );
 * ```
 * 
 * @see {@link BUSINESS_RULES} for salary calculation constants
 * @see {@link SalaryError} for salary-specific error handling
 */
export async function recalculateAndSaveSalaryRecordEngine(
  supabase: SupabaseClient<Database>,
  ktvId: string,
  monthYear: string,
  tenantId: string,
  overrides?: SalaryRecalculationOverrides
) {
  const { data: ktvData, error: ktvError } = await supabase
    .from('users')
    .select('id, full_name, base_salary, resignation_date')
    .eq('id', ktvId)
    .eq('tenant_id', tenantId)
    .single();

  if (ktvError) throw ktvError;
  const ktv = ktvData as KtvUserDataAdmin | null;

  // Try to get commission-related fields (position_tier, hire_date) if they exist
  // These are added by migrations but may not be present yet
  let positionTier: 'junior' | 'senior' | 'lead' = 'junior';
  let hireDate: string | null = null;
  
  try {
    const { data: commissionData } = await supabase
      .from('users')
      .select('position_tier, hire_date')
      .eq('id', ktvId)
      .single();
    
    if (commissionData) {
      positionTier = ((commissionData as any).position_tier || 'junior') as 'junior' | 'senior' | 'lead';
      hireDate = (commissionData as any).hire_date || null;
    }
  } catch (err) {
    // Columns don't exist yet, use defaults
    console.log('Commission fields not yet available in database, using defaults');
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('salary_config')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  const stored = (tenantData?.salary_config as unknown as Partial<TenantSalaryConfig>) || {};
  const salaryConfig: TenantSalaryConfig = {
    bonus_5_star: stored.bonus_5_star ?? 50000,
    bonus_4_5_star: stored.bonus_4_5_star ?? 30000,
    bonus_4_star: stored.bonus_4_star ?? 10000,
    kpi_target_sessions: stored.kpi_target_sessions ?? 30,
    kpi_bonus_amount: stored.kpi_bonus_amount ?? 1000000,
    penalty_late_per_day: stored.penalty_late_per_day ?? 50000,
    penalty_absent_per_day: stored.penalty_absent_per_day ?? 200000,
  };

  // Commission config for Beauty Spa (Task 28-32: Advanced Commission System)
  // Try to get commission_config if column exists
  let commissionConfig: CommissionConfig = {};
  try {
    const { data: commissionData } = await supabase
      .from('tenants')
      .select('commission_config')
      .eq('id', tenantId)
      .maybeSingle();
    
    if (commissionData) {
      commissionConfig = (commissionData as any).commission_config || {};
    }
  } catch (err) {
    // Column doesn't exist yet, use defaults
    console.log('Commission config not yet available in database, using defaults');
  }

  const serviceCommissionDefault = commissionConfig.service_commission_default || { type: 'fixed' as const, value: 150000 };
  const productCommissionDefault = commissionConfig.product_sales_commission_default || { type: 'percentage' as const, value: 10 };
  const positionMultipliers = commissionConfig.position_multipliers || { junior: 1.0, senior: 1.2, lead: 1.5 };
  const seniorityBonusRates = commissionConfig.seniority_bonus_rates || {
    '0_to_1_year': 0.00,
    '1_to_3_years': 0.05,
    '3_to_5_years': 0.10,
    '5_plus_years': 0.15,
  };

  const startOfMonthStr = monthYear;
  const endOfMonthStr = getLocalDateString(new Date(new Date(monthYear).getFullYear(), new Date(monthYear).getMonth() + 1, 1));

  const { data: attendanceList, error: attError } = await supabase
    .from('attendance')
    .select('status, date')
    .eq('ktv_id', ktvId)
    .eq('tenant_id', tenantId)
    .gte('date', startOfMonthStr)
    .lt('date', endOfMonthStr);

  if (attError) throw attError;
  const attendanceListTyped = (attendanceList || []) as unknown as AttendanceLogAdmin[];

  const { data: sessions, error: sessionsError } = await supabase
    .from('session_logs')
    .select('id, rating, bookings(ktv_commission, package_name), session_reviews(rating, status)')
    .eq('completed_by_ktv_id', ktvId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonthStr)
    .lt('completed_date', endOfMonthStr);

  if (sessionsError) throw sessionsError;
  const sessionsTyped = (sessions || []) as unknown as SessionLogAdmin[];

  const { data: packagesData, error: packagesError } = await supabase
    .from('packages')
    .select('name, session_multiplier')
    .eq('tenant_id', tenantId);

  if (packagesError) throw packagesError;
  const packagesList = (packagesData || []) as PackageMultiplierRow[];

  const packageMultiplierMap = buildPackageMultiplierMap(packagesList);
  const liveSessionsCount = calculateWeightedSessionCount(sessionsTyped, packageMultiplierMap);
  const liveSessionBonus = calculateSessionCommissionBonus(sessionsTyped);

  // Phase 1: Provider Integration - Commission Provider (Comparison Mode)
  // Phase 2: Feature Flag - Use provider result when USE_CONFIG_PROVIDERS=true
  let providerCommissionAmount: number | null = null;
  let commissionProviderResult: any = null;
  try {
    // Prepare session data for commission calculation
    const sessionsWithRevenue = sessionsTyped.map(session => ({
      id: session.id,
      service_type: session.bookings?.package_name || 'unknown',
      revenue: session.bookings?.ktv_commission || 0,
      commission: session.bookings?.ktv_commission || 0,
    }));

    const commissionContext = {
      sessions: sessionsWithRevenue,
      sessionsCount: liveSessionsCount,
      totalRevenue: sessionsWithRevenue.reduce((sum, s) => sum + s.revenue, 0),
      tenantId,
      userId: ktvId,
      period: monthYear,
      metadata: {
        avgRating,
        attendanceDays: attendanceListTyped.length,
      }
    };
    
    commissionProviderResult = await commissionProvider.evaluate(commissionContext);
    providerCommissionAmount = commissionProviderResult.amount;
    
    // Log comparison or active usage
    if (USE_CONFIG_PROVIDERS) {
      console.log('[PHASE_2_ACTIVE] Commission - Using Provider Result:', {
        ktvId,
        month: monthYear,
        provider_commission: commissionProviderResult.amount,
        old_logic_would_be: liveSessionBonus,
        strategy: commissionProviderResult.metadata?.strategy,
        sessions: liveSessionsCount,
        total_revenue: commissionContext.totalRevenue,
      });
    } else {
      console.log('[PROVIDER_INTEGRATION] Commission Comparison:', {
        ktvId,
        month: monthYear,
        old_logic: liveSessionBonus,
        new_provider: commissionProviderResult.amount,
        strategy: commissionProviderResult.metadata?.strategy,
        diff: commissionProviderResult.amount - liveSessionBonus,
        diff_percent: liveSessionBonus > 0 ? ((commissionProviderResult.amount - liveSessionBonus) / liveSessionBonus * 100).toFixed(2) + '%' : 'N/A',
        sessions: liveSessionsCount,
        total_revenue: commissionContext.totalRevenue,
      });
    }
  } catch (error) {
    console.error('[PROVIDER_INTEGRATION] Commission Provider failed (non-blocking):', error);
  }

  const { data: leaderboardData, error: leaderboardError } = await supabase.rpc(
    'get_ktv_leaderboard',
    { p_tenant_id: tenantId, p_month: monthYear }
  );
  if (leaderboardError) throw leaderboardError;

  const leaderboard = (leaderboardData || []) as unknown as {
    ktv_id: string;
    average_rating: number | null;
    late_days: number | null;
    absent_days: number | null;
  }[];
  const ktvRow = leaderboard.find((row) => row.ktv_id === ktvId);
  const avgRating: number | null = ktvRow?.average_rating ?? null;
  const lateDays = ktvRow?.late_days ?? 0;
  const absentDays = ktvRow?.absent_days ?? 0;
  const liveAttendanceComponents = calculateLiveAttendanceSalaryComponents({
    attendanceLogs: attendanceListTyped,
    rawBaseSalary: ktv?.base_salary ?? 6000000,
    lateDays,
    absentDays,
    penaltyLatePerDay: salaryConfig.penalty_late_per_day,
    penaltyAbsentPerDay: salaryConfig.penalty_absent_per_day,
  });
  const {
    attendancePenalty,
    deductions: autoAttendancePenalty,
  } = liveAttendanceComponents;

  // Phase 1: Provider Integration - Attendance Provider (Comparison Mode)
  // Phase 2: Feature Flag - Use provider result when USE_CONFIG_PROVIDERS=true
  let providerAttendanceAmount: number | null = null;
  let attendanceProviderResult: any = null;
  try {
    const attendanceContext = {
      lateDays,
      absentDays,
      tenantId,
      userId: ktvId,
      period: monthYear,
      metadata: {
        totalWorkingDays: attendanceListTyped.length,
      }
    };
    
    attendanceProviderResult = await attendanceProvider.evaluate(attendanceContext);
    providerAttendanceAmount = attendanceProviderResult.amount;
    
    // Provider returns negative amount for deductions
    const providerDeduction = Math.abs(attendanceProviderResult.amount);
    
    // Log comparison or active usage
    if (USE_CONFIG_PROVIDERS) {
      console.log('[PHASE_2_ACTIVE] Attendance - Using Provider Result:', {
        ktvId,
        month: monthYear,
        provider_deduction: providerDeduction,
        old_logic_would_be: autoAttendancePenalty,
        strategy: attendanceProviderResult.metadata?.strategy,
        late_days: lateDays,
        absent_days: absentDays,
      });
    } else {
      console.log('[PROVIDER_INTEGRATION] Attendance Comparison:', {
        ktvId,
        month: monthYear,
        old_logic: autoAttendancePenalty,
        new_provider: providerDeduction,
        strategy: attendanceProviderResult.metadata?.strategy,
        diff: providerDeduction - autoAttendancePenalty,
        diff_percent: autoAttendancePenalty > 0 ? ((providerDeduction - autoAttendancePenalty) / autoAttendancePenalty * 100).toFixed(2) + '%' : 'N/A',
        late_days: lateDays,
        absent_days: absentDays,
      });
    }
  } catch (error) {
    console.error('[PROVIDER_INTEGRATION] Attendance Provider failed (non-blocking):', error);
  }

  const { data: kpiRecords, error: kpiError } = await supabase
    .from('kpi_records')
    .select('bonus_amount')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId);

  if (kpiError) throw kpiError;
  const kpiRecordsTyped = (kpiRecords || []) as KpiBonusRow[];
  const dbKpiBonus = kpiRecordsTyped.reduce((acc, k) => acc + Number(k.bonus_amount || 0), 0);

  // Phase 1: Provider Integration - KPI Provider (Comparison Mode)
  // Phase 2: Feature Flag - Use provider result when USE_CONFIG_PROVIDERS=true
  // Call provider alongside existing logic to verify correctness
  let providerKpiAmount: number | null = null;
  let kpiProviderResult: any = null;
  try {
    const kpiContext = {
      metric: 'sessions' as const,
      value: liveSessionsCount,
      tenantId,
      userId: ktvId,
      period: monthYear,
      metadata: {
        avgRating,
        attendanceDays: attendanceListTyped.length,
      }
    };
    
    kpiProviderResult = await kpiProvider.evaluate(kpiContext);
    providerKpiAmount = kpiProviderResult.amount;
    
    // Log comparison or active usage
    if (USE_CONFIG_PROVIDERS) {
      console.log('[PHASE_2_ACTIVE] KPI - Using Provider Result:', {
        ktvId,
        month: monthYear,
        provider_bonus: kpiProviderResult.amount,
        old_logic_would_be: dbKpiBonus,
        strategy: kpiProviderResult.metadata?.strategy,
        sessions: liveSessionsCount,
      });
    } else {
      console.log('[PROVIDER_INTEGRATION] KPI Comparison:', {
        ktvId,
        month: monthYear,
        old_logic: dbKpiBonus,
        new_provider: kpiProviderResult.amount,
        strategy: kpiProviderResult.metadata?.strategy,
        diff: kpiProviderResult.amount - dbKpiBonus,
        diff_percent: dbKpiBonus > 0 ? ((kpiProviderResult.amount - dbKpiBonus) / dbKpiBonus * 100).toFixed(2) + '%' : 'N/A',
        sessions: liveSessionsCount,
      });
    }
  } catch (error) {
    console.error('[PROVIDER_INTEGRATION] KPI Provider failed (non-blocking):', error);
    // Non-blocking: old logic continues
  }

  // Query commission data (Task 28-32: Advanced Commission System)
  // Service commission from booking_service_items
  const { data: serviceItems, error: serviceItemsError } = await (supabase as any)
    .from('booking_service_items')
    .select('calculated_commission')
    .eq('ktv_id', ktvId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('completed_date', startOfMonthStr)
    .lt('completed_date', endOfMonthStr);

  if (serviceItemsError) console.error('Error querying service items:', serviceItemsError);
  const serviceItemsTyped = (serviceItems || []) as { calculated_commission: number | null }[];
  const liveServiceCommission = serviceItemsTyped.reduce((sum, item) => sum + Number(item.calculated_commission || 0), 0);

  // Product sales commission from product_sales
  const { data: productSales, error: productSalesError } = await (supabase as any)
    .from('product_sales')
    .select('calculated_commission')
    .eq('ktv_id', ktvId)
    .eq('tenant_id', tenantId)
    .eq('status', 'completed')
    .gte('sale_date', startOfMonthStr)
    .lt('sale_date', endOfMonthStr);

  if (productSalesError) console.error('Error querying product sales:', productSalesError);
  const productSalesTyped = (productSales || []) as { calculated_commission: number | null }[];
  const liveProductCommission = productSalesTyped.reduce((sum, sale) => sum + Number(sale.calculated_commission || 0), 0);

  // Manual adjustments from salary_adjustments
  const { data: manualAdjustments, error: adjustmentsError } = await (supabase as any)
    .from('salary_adjustments')
    .select('adjustment_type, amount, status')
    .eq('ktv_id', ktvId)
    .eq('tenant_id', tenantId)
    .eq('month_year', monthYear);

  if (adjustmentsError) console.error('Error querying manual adjustments:', adjustmentsError);
  const adjustmentsTyped = (manualAdjustments || []) as Array<{
    adjustment_type: 'bonus' | 'deduction';
    amount: number;
    status: string;
  }>;
  const liveManualAdjustments = aggregateManualAdjustments({ adjustments: adjustmentsTyped });

  const { data: existingData, error: existingError } = await supabase
    .from('salary_records')
    .select('*')
    .eq('ktv_id', ktvId)
    .eq('month_year', monthYear)
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (existingError) throw existingError;
  const existing = existingData as SalaryRecordDbAdmin | null;
  assertSalaryRecalculationLifecycle(existing);

  const rawBaseSalary = ktv?.base_salary ?? 6000000;
  let proRataNote = '';

  const isDraft = isDraftSalaryRecord(existing);
  const hasFinancialOverrides = hasSalaryFinancialRecalculationOverrides(overrides);
  const shouldUseStoredSessionComponents = Boolean(existing && !isDraft && overrides?.total_sessions === undefined);
  const shouldUseStoredTotalSalary = Boolean(existing && !isDraft && !hasFinancialOverrides);

  const sessionsCount = overrides?.total_sessions !== undefined
    ? overrides.total_sessions
    : (shouldUseStoredSessionComponents && existing?.total_sessions !== null && existing?.total_sessions !== undefined
        ? Number(existing.total_sessions)
        : liveSessionsCount);

  // Phase 2: Use Commission Provider result if flag is ON and provider succeeded
  let finalSessionBonus: number;
  if (shouldUseStoredSessionComponents && existing?.session_bonus !== null && existing?.session_bonus !== undefined) {
    // Use stored value for non-draft records
    finalSessionBonus = Number(existing.session_bonus);
  } else if (USE_CONFIG_PROVIDERS && providerCommissionAmount !== null && commissionProviderResult) {
    // Use provider result if flag is ON
    finalSessionBonus = providerCommissionAmount;
  } else {
    // Fallback to old hardcoded logic
    finalSessionBonus = liveSessionBonus;
  }

  const sessionBonus = finalSessionBonus;

  const oldLogicRatingBonus = calculateRatingBonus(sessionsCount, avgRating, salaryConfig);

  const ratingBonus =
    shouldUseStoredSessionComponents && existing?.rating_bonus !== null && existing?.rating_bonus !== undefined
      ? Number(existing.rating_bonus)
      : oldLogicRatingBonus;

  // Phase 1: Provider Integration - Rating Provider (Comparison Mode)
  // Phase 2: Feature Flag - Use provider result when USE_CONFIG_PROVIDERS=true
  let providerRatingAmount: number | null = null;
  let ratingProviderResult: any = null;
  try {
    const ratingContext = {
      avgRating: avgRating || 0,
      sessionsCount,
      tenantId,
      userId: ktvId,
      period: monthYear,
      metadata: {}
    };
    
    ratingProviderResult = await ratingProvider.evaluate(ratingContext);
    providerRatingAmount = ratingProviderResult.amount;
    
    // Log comparison or active usage
    if (USE_CONFIG_PROVIDERS) {
      console.log('[PHASE_2_ACTIVE] Rating - Using Provider Result:', {
        ktvId,
        month: monthYear,
        provider_bonus: ratingProviderResult.amount,
        old_logic_would_be: oldLogicRatingBonus,
        strategy: ratingProviderResult.metadata?.strategy,
        avg_rating: avgRating,
        sessions: sessionsCount,
      });
    } else {
      console.log('[PROVIDER_INTEGRATION] Rating Comparison:', {
        ktvId,
        month: monthYear,
        old_logic: oldLogicRatingBonus,
        new_provider: ratingProviderResult.amount,
        strategy: ratingProviderResult.metadata?.strategy,
        diff: ratingProviderResult.amount - oldLogicRatingBonus,
        diff_percent: oldLogicRatingBonus > 0 ? ((ratingProviderResult.amount - oldLogicRatingBonus) / oldLogicRatingBonus * 100).toFixed(2) + '%' : 'N/A',
        avg_rating: avgRating,
        sessions: sessionsCount,
      });
    }
  } catch (error) {
    console.error('[PROVIDER_INTEGRATION] Rating Provider failed (non-blocking):', error);
  }

  let finalBaseSalary: number;
  if (overrides?.base_salary !== undefined) {
    finalBaseSalary = overrides.base_salary;
  } else if (existing && !isDraft && existing.base_salary !== null && existing.base_salary !== undefined) {
    finalBaseSalary = Number(existing.base_salary);
    if (existing.notes) proRataNote = existing.notes;
  } else {
    finalBaseSalary = liveAttendanceComponents.baseSalary;
    proRataNote = liveAttendanceComponents.proRataNote;
  }

  let deductions: number;
  if (overrides?.violations_deduction !== undefined) {
    deductions = overrides.violations_deduction;
  } else if (existing && !isDraft && existing.violations_deduction !== null && existing.violations_deduction !== undefined) {
    // ONLY use saved deductions for non-draft records
    deductions = Number(existing.violations_deduction);
    if (existing.notes && !proRataNote) proRataNote = existing.notes;
  } else {
    // For draft records OR records without saved deductions, always recalculate from live data
    // Phase 2: Use provider result if flag is ON and provider succeeded
    if (USE_CONFIG_PROVIDERS && providerAttendanceAmount !== null && attendanceProviderResult) {
      deductions = Math.abs(providerAttendanceAmount); // Provider returns negative, we need positive for deduction
    } else {
      deductions = autoAttendancePenalty;
    }
  }

  if (overrides?.violations_deduction === undefined && isDraft && liveAttendanceComponents.hasAutoPenalty) {
    proRataNote += `⚠️ Tự động trừ ${autoAttendancePenalty.toLocaleString('vi-VN')}đ (trễ ${lateDays} ngày × ${attendancePenalty.penaltyLatePerDay.toLocaleString('vi-VN')}đ + vắng ${absentDays} ngày × ${attendancePenalty.penaltyAbsentPerDay.toLocaleString('vi-VN')}đ). `;
  }

  const advances = overrides?.service_percentage_bonus !== undefined
    ? overrides.service_percentage_bonus
    : (existing?.service_percentage_bonus ?? 0);

  const finalKpiBonus = overrides?.kpi_bonus !== undefined
    ? overrides.kpi_bonus
    : (existing && !isDraft && existing.kpi_bonus !== null && existing.kpi_bonus !== undefined 
        ? Number(existing.kpi_bonus) 
        : (USE_CONFIG_PROVIDERS && providerKpiAmount !== null && kpiProviderResult 
            ? providerKpiAmount 
            : dbKpiBonus));

  // Calculate commission components (Task 28-32)
  const finalServiceCommission =
    existing && !isDraft && existing.service_commission !== null && existing.service_commission !== undefined
      ? Number(existing.service_commission)
      : liveServiceCommission;

  const finalProductCommission =
    existing && !isDraft && existing.product_sales_commission !== null && existing.product_sales_commission !== undefined
      ? Number(existing.product_sales_commission)
      : liveProductCommission;

  // Position bonus: applied on service commission
  const finalPositionBonus =
    existing && !isDraft && existing.position_bonus !== null && existing.position_bonus !== undefined
      ? Number(existing.position_bonus)
      : calculatePositionBonus({
          baseCommission: finalServiceCommission,
          positionTier,
          multipliers: positionMultipliers,
        });

  // Seniority bonus: applied on base salary
  const finalSeniorityBonus =
    existing && !isDraft && existing.seniority_bonus !== null && existing.seniority_bonus !== undefined
      ? Number(existing.seniority_bonus)
      : calculateSeniorityBonus({
          baseSalary: finalBaseSalary,
          hireDate,
          bonusRates: seniorityBonusRates,
        });

  // Manual adjustments: net amount (can be negative)
  const finalManualAdjustments =
    existing && !isDraft && existing.manual_adjustments !== null && existing.manual_adjustments !== undefined
      ? Number(existing.manual_adjustments)
      : liveManualAdjustments;

  if (ktv?.resignation_date) {
    const resignDate = new Date(ktv.resignation_date);
    const monthDate = new Date(monthYear);
    const now = new Date();
    if (resignDate.getFullYear() === now.getFullYear() && resignDate.getMonth() === now.getMonth()) {
      const resignCap = await calcProRataBaseSalary(rawBaseSalary, resignDate, monthDate);
      if (finalBaseSalary > resignCap) {
        finalBaseSalary = resignCap;
      }
      proRataNote += `⚠️ KTV nghỉ việc từ ngày ${resignDate.toLocaleDateString('vi-VN')}`;
    }
  }

  // Phase 2: Final override - Use provider results if flag is ON and no stored/override value
  let finalRatingBonus = ratingBonus;
  if (USE_CONFIG_PROVIDERS && providerRatingAmount !== null && ratingProviderResult) {
    // Only override if we're recalculating (not using stored value)
    if (!shouldUseStoredSessionComponents || existing?.rating_bonus === null || existing?.rating_bonus === undefined) {
      finalRatingBonus = providerRatingAmount;
    }
  }

  const calculatedTotalSalary = calculateSalaryTotal({
    baseSalary: finalBaseSalary,
    sessionBonus,
    ratingBonus: finalRatingBonus,
    kpiBonus: finalKpiBonus,
    deductions,
    advances,
    // Advanced commission components (Task 28-32)
    serviceCommission: finalServiceCommission,
    productSalesCommission: finalProductCommission,
    positionBonus: finalPositionBonus,
    seniorityBonus: finalSeniorityBonus,
    manualAdjustments: finalManualAdjustments,
  });
  const totalSalary =
    shouldUseStoredTotalSalary && existing?.total_salary !== null && existing?.total_salary !== undefined
      ? Number(existing.total_salary)
      : calculatedTotalSalary;
  const status = overrides?.status || existing?.status || 'draft';

  const payload: Database['public']['Tables']['salary_records']['Insert'] = {
    ktv_id: ktvId,
    month_year: monthYear,
    base_salary: finalBaseSalary,
    session_bonus: sessionBonus,
    rating_bonus: finalRatingBonus,
    kpi_bonus: finalKpiBonus,
    violations_deduction: deductions,
    service_percentage_bonus: advances,
    total_sessions: sessionsCount,
    total_salary: totalSalary,
    status,
    published_at: overrides?.status === 'published' ? new Date().toISOString() : (existing?.published_at || null),
    notes: proRataNote || null,
    tenant_id: tenantId,
    // Advanced commission components (Task 28-32)
    service_commission: finalServiceCommission,
    product_sales_commission: finalProductCommission,
    position_bonus: finalPositionBonus,
    seniority_bonus: finalSeniorityBonus,
    manual_adjustments: finalManualAdjustments,
  } as any; // Cast to any because new columns not yet in generated types

  let result;
  if (existing) {
    result = await supabase
      .from('salary_records')
      .update(payload as Database['public']['Tables']['salary_records']['Update'])
      .eq('id', existing.id);
  } else {
    result = await supabase
      .from('salary_records')
      .insert(payload);
  }

  if (result.error) throw result.error;

  return { success: true, totalSalary };
}
