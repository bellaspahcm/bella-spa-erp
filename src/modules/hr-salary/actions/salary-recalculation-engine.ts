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

// Phase 3: Unified Payroll Provider (Task 5 - Decision Engine)
// Replaces individual providers with unified calculation engine
import { getPayrollProviderAdapter } from '@/adapters/payroll-provider-adapter';
const USE_PAYROLL_PROVIDER = process.env.FEATURE_PAYROLL_PROVIDER === 'true';

import { getCommissionProviderAdapter } from '@/adapters/commission-provider-adapter';
import type { SalaryRecordComponents } from '@/adapters/payroll-provider-adapter';
import type { CommissionRecordComponents, CommissionCalculationContext } from '@/adapters/commission-provider-adapter';
import type { SalaryCalculationContext } from '@/adapters/payroll-provider-adapter';
import type { PayrollDecisionContext, SessionData } from '@/lib/decision-engine/types/decision-context';
import type { CommissionConfig as ProviderCommissionConfig } from '@/lib/decision-engine/providers/commission';

type CombinedCommissionConfig = CommissionConfig & Partial<ProviderCommissionConfig>;

const USE_COMMISSION_PROVIDER = process.env.FEATURE_COMMISSION_PROVIDER === 'true';

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
      const cd = commissionData as unknown as { position_tier?: string; hire_date?: string | null };
      positionTier = ((cd.position_tier || 'junior') as 'junior' | 'senior' | 'lead');
      hireDate = cd.hire_date || null;
    }
  } catch (_err) {
    // Columns don't exist yet, use defaults
    console.log('Commission fields not yet available in database, using defaults');
  }

  const { data: tenantData, error: tenantError } = await supabase
    .from('tenants')
    .select('enabled_modules, salary_config')
    .eq('id', tenantId)
    .maybeSingle();

  if (tenantError) throw tenantError;
  const { getDefaultTenantModuleKey } = await import('@/lib/business-rules/tenant-modules');
  const moduleKey = getDefaultTenantModuleKey(tenantData?.enabled_modules);
  const isRealEstate = moduleKey === 'real_estate';
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
  let commissionConfig: CombinedCommissionConfig = {};
  try {
    const { data: commissionData } = await supabase
      .from('tenants')
      .select('commission_config')
      .eq('id', tenantId)
      .maybeSingle();
    
    if (commissionData) {
      const cd = commissionData as unknown as { commission_config?: CommissionConfig };
      commissionConfig = cd.commission_config || {};
    }
  } catch (_err) {
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

  // Hoist leaderboard query here so avgRating is available for provider contexts below
  const { data: leaderboardDataEarly, error: leaderboardEarlyError } = await supabase.rpc(
    'get_ktv_leaderboard',
    { p_tenant_id: tenantId, p_month: monthYear }
  );
  if (leaderboardEarlyError) throw leaderboardEarlyError;

  const leaderboardEarly = (leaderboardDataEarly || []) as unknown as {
    ktv_id: string;
    average_rating: number | null;
    late_days: number | null;
    absent_days: number | null;
  }[];
  const ktvRowEarly = leaderboardEarly.find((row) => row.ktv_id === ktvId);
  const avgRating: number | null = ktvRowEarly?.average_rating ?? null;
  const lateDays = ktvRowEarly?.late_days ?? 0;
  const absentDays = ktvRowEarly?.absent_days ?? 0;

  const commonContext: PayrollDecisionContext = {
    tenantId,
    userId: ktvId,
    timestamp: new Date().toISOString(),
    monthYear,
    employee: {
      id: ktvId,
      fullName: ktv?.full_name ?? 'KTV',
      baseSalary: ktv?.base_salary ?? 6000000,
      positionTier: positionTier,
      hireDate: hireDate,
      resignationDate: ktv?.resignation_date || null,
    },
  };

  // Phase 1: Provider Integration - Commission Provider (Comparison Mode)
  // Phase 2: Feature Flag - Use provider result when USE_CONFIG_PROVIDERS=true
  let providerCommissionAmount: number | null = null;
  let commissionProviderResult: { amount: number; metadata?: { strategy?: string } } | null = null;
  try {
    // Prepare session data for commission calculation
    const sessionsWithRevenue = sessionsTyped.map(session => ({
      id: session.id,
      packageName: session.bookings?.package_name || null,
      rating: session.rating,
      commission: session.bookings?.ktv_commission || 0,
    }));

    // Construct rating breakdown
    const fiveStars = sessionsTyped.filter(s => s.rating === 5).length;
    const fourHalfStars = sessionsTyped.filter(s => s.rating === 4.5).length;
    const fourStars = sessionsTyped.filter(s => s.rating === 4).length;
    const belowFour = sessionsTyped.filter(s => s.rating && s.rating < 4).length;

    const totalRevenue = sessionsWithRevenue.reduce((sum, s) => sum + s.commission, 0);

    const commissionContext: PayrollDecisionContext = {
      ...commonContext,
      sessions: {
        count: sessionsTyped.length,
        weightedCount: liveSessionsCount,
        avgRating,
        ratingBreakdown: {
          fiveStars,
          fourHalfStars,
          fourStars,
          belowFour,
        },
        logs: sessionsWithRevenue,
        // Extra properties read by CommissionProvider at runtime
        totalRevenue,
        byServiceType: sessionsTyped.reduce((acc, s) => {
          const name = s.bookings?.package_name || 'unknown';
          acc[name] = (acc[name] || 0) + 1;
          return acc;
        }, {} as Record<string, number>),
      } as unknown as SessionData,
      metadata: {
        attendanceDays: attendanceListTyped.length,
      },
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
        total_revenue: totalRevenue,
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
        total_revenue: totalRevenue,
      });
    }
  } catch (error) {
    console.error('[PROVIDER_INTEGRATION] Commission Provider failed:', error);
    if (USE_CONFIG_PROVIDERS) {
      throw error;
    }
  }

  // leaderboard + avgRating already computed above (hoisted for provider contexts)
  // Reassign to keep the rest of the function unchanged
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
  let attendanceProviderResult: { amount: number; metadata?: { strategy?: string } } | null = null;
  try {
    const attendanceContext: PayrollDecisionContext = {
      ...commonContext,
      attendance: {
        totalDays: attendanceListTyped.length,
        presentDays: attendanceListTyped.filter(a => a.status === 'present').length,
        lateDays,
        absentDays,
        halfDays: attendanceListTyped.filter(a => a.status === 'half_day').length,
      },
      metadata: {
        totalWorkingDays: attendanceListTyped.length,
      },
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
    console.error('[PROVIDER_INTEGRATION] Attendance Provider failed:', error);
    if (USE_CONFIG_PROVIDERS) {
      throw error;
    }
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
  let kpiProviderResult: { amount: number; metadata?: { strategy?: string } } | null = null;
  try {
    const kpiContext: PayrollDecisionContext = {
      ...commonContext,
      sessions: {
        count: liveSessionsCount,
        weightedCount: liveSessionsCount,
        avgRating,
      },
      metadata: {
        avgRating,
        attendanceDays: attendanceListTyped.length,
      },
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
    console.error('[PROVIDER_INTEGRATION] KPI Provider failed:', error);
    if (USE_CONFIG_PROVIDERS) {
      throw error;
    }
  }

  // Query commission data (Task 28-32: Advanced Commission System)
  // Service commission from booking_service_items
  // Cast to base SupabaseClient (no schema generic) for tables not in generated types
  const rawClient = supabase as unknown as SupabaseClient;
  const { data: serviceItems, error: serviceItemsError } = await rawClient
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
  const { data: productSales, error: productSalesError } = await rawClient
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
  const { data: manualAdjustments, error: adjustmentsError } = await rawClient
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

  // ================================================================
  // Phase 3: Unified Payroll Provider Integration (Decision Engine)
  // ================================================================
  let payrollProviderResult: SalaryRecordComponents | null = null;
  if (USE_PAYROLL_PROVIDER) {
    try {
      const adapter = getPayrollProviderAdapter();
      
      // Transform current data to PayrollDecisionInput format
      const payrollContext: SalaryCalculationContext = {
        tenantId,
        employeeId: ktvId,
        monthYear,
        sessions: sessionsTyped.map(s => ({
          id: s.id,
          status: 'completed' as const,
          rating: s.rating,
          total_amount: s.bookings?.ktv_commission || 0,
          package_name: s.bookings?.package_name,
        })),
        attendance: attendanceListTyped.map(a => ({
          id: `${ktvId}-${a.date}`,
          ktv_id: ktvId,
          date: a.date,
          status: a.status,
          tenant_id: tenantId,
        })),
        employee: {
          id: ktv?.id || ktvId,
          base_salary: ktv?.base_salary || 6000000,
          position: positionTier,
          hired_date: hireDate,
          tenant_id: tenantId,
        },
        config: {
          kpi: {
            enabled: true,
            strategy: 'threshold',
            config: {
              target: salaryConfig.kpi_target_sessions,
              bonus: salaryConfig.kpi_bonus_amount,
            },
          },
          attendance: {
            enabled: true,
            strategy: 'combined',
            config: {
              latePenalty: salaryConfig.penalty_late_per_day,
              absentPenalty: salaryConfig.penalty_absent_per_day,
            },
          },
          rating: {
            enabled: true,
            strategy: 'threshold',
            config: {
              minRating: 4.5,
              bonus: salaryConfig.bonus_4_5_star,
            },
          },
          commission: {
            enabled: true,
            strategy: 'fixed',
            config: {
              rate: 120000, // Default session commission rate
            },
          },
        },
      };

      // Calculate via unified provider
      payrollProviderResult = await adapter.calculateSalaryComponents(payrollContext);

      console.log('[PAYROLL_PROVIDER] Unified calculation complete:', {
        ktvId,
        month: monthYear,
        kpi_bonus: payrollProviderResult.kpi_bonus,
        violations_deduction: payrollProviderResult.violations_deduction,
        rating_bonus: payrollProviderResult.rating_bonus,
        session_bonus: payrollProviderResult.session_bonus,
        total_bonuses: payrollProviderResult.total_bonuses,
        total_deductions: payrollProviderResult.total_deductions,
        net_adjustment: payrollProviderResult.net_adjustment,
        execution_time: payrollProviderResult.calculation_metadata.executionTime,
      });
    } catch (error) {
      console.error('[PAYROLL_PROVIDER] Unified provider failed:', error);
      throw error;
    }
  }

  const sessionsCount = overrides?.total_sessions !== undefined
    ? overrides.total_sessions
    : (shouldUseStoredSessionComponents && existing?.total_sessions !== null && existing?.total_sessions !== undefined
        ? Number(existing.total_sessions)
        : liveSessionsCount);

  // Phase 2: Use Commission Provider result if flag is ON and provider succeeded
  // Phase 3: Use Unified Payroll Provider if FEATURE_PAYROLL_PROVIDER=true
  let finalSessionBonus: number;
  if (shouldUseStoredSessionComponents && existing?.session_bonus !== null && existing?.session_bonus !== undefined) {
    // Use stored value for non-draft records
    finalSessionBonus = Number(existing.session_bonus);
  } else if (USE_PAYROLL_PROVIDER && payrollProviderResult) {
    // Phase 3: Use unified provider result
    finalSessionBonus = payrollProviderResult.session_bonus;
  } else if (USE_CONFIG_PROVIDERS && providerCommissionAmount !== null && commissionProviderResult) {
    // Phase 2: Use individual provider result if flag is ON
    finalSessionBonus = providerCommissionAmount;
  } else {
    // Fallback to old hardcoded logic
    finalSessionBonus = liveSessionBonus;
  }

  const sessionBonus = finalSessionBonus;

  const oldLogicRatingBonus = calculateRatingBonus(sessionsCount, avgRating, salaryConfig);

  // Phase 3: Use Unified Payroll Provider for rating if enabled
  const ratingBonus =
    shouldUseStoredSessionComponents && existing?.rating_bonus !== null && existing?.rating_bonus !== undefined
      ? Number(existing.rating_bonus)
      : (USE_PAYROLL_PROVIDER && payrollProviderResult
          ? payrollProviderResult.rating_bonus
          : oldLogicRatingBonus);

  // Phase 1: Provider Integration - Rating Provider (Comparison Mode)
  // Phase 2: Feature Flag - Use provider result when USE_CONFIG_PROVIDERS=true
  let providerRatingAmount: number | null = null;
  let ratingProviderResult: { amount: number; metadata?: { strategy?: string } } | null = null;
  try {
    const ratingContext: PayrollDecisionContext = {
      ...commonContext,
      sessions: {
        count: sessionsCount,
        avgRating: avgRating || 0,
      },
      metadata: {},
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
    // Phase 3: Use Unified Payroll Provider if enabled
    // Phase 2: Use individual provider result if flag is ON and provider succeeded
    if (USE_PAYROLL_PROVIDER && payrollProviderResult) {
      deductions = payrollProviderResult.total_deductions; // Payroll Provider returns positive deduction amount
    } else if (USE_CONFIG_PROVIDERS && providerAttendanceAmount !== null && attendanceProviderResult) {
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
        : (USE_PAYROLL_PROVIDER && payrollProviderResult
            ? payrollProviderResult.kpi_bonus
            : (USE_CONFIG_PROVIDERS && providerKpiAmount !== null && kpiProviderResult 
                ? providerKpiAmount 
                : dbKpiBonus)));

  // Calculate commission components (Task 28-32)
  // Phase 4: Commission Provider Integration (Task 6 - Decision Engine)
  let commissionAdapterResult: CommissionRecordComponents | null = null;
  if (USE_COMMISSION_PROVIDER) {
    try {
      const adapter = getCommissionProviderAdapter();
      
      // Query full service items and product sales for Decision Engine
      const { data: fullServiceItems } = await rawClient
        .from('booking_service_items')
        .select('id, ktv_id, subtotal, calculated_commission, override_commission_type, override_commission_value, status, completed_date')
        .eq('ktv_id', ktvId)
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('completed_date', startOfMonthStr)
        .lt('completed_date', endOfMonthStr);

      const { data: fullProductSales } = await rawClient
        .from('product_sales')
        .select('id, ktv_id, sales_amount, calculated_commission, override_commission_type, override_commission_value, status, sale_date, product_sku')
        .eq('ktv_id', ktvId)
        .eq('tenant_id', tenantId)
        .eq('status', 'completed')
        .gte('sale_date', startOfMonthStr)
        .lt('sale_date', endOfMonthStr);

      interface RawProductSale {
        id: string;
        ktv_id: string;
        sales_amount: number;
        calculated_commission: number;
        override_commission_type: string | null;
        override_commission_value: number | null;
        status: string;
        sale_date: string;
        product_sku: string | null;
      }

      const productDetailsMap = new Map<string, { project_id: string }>();
      if (isRealEstate) {
        const { data: products } = await rawClient
          .from('real_estate_products')
          .select('id, project_id')
          .eq('tenant_id', tenantId);
        if (products) {
          products.forEach(p => {
            productDetailsMap.set(p.id, { project_id: p.project_id });
          });
        }
      }

      const projectCommissions = ((commissionConfig as Record<string, unknown>).real_estate_project_commissions || {}) as Record<string, { type: 'fixed' | 'percentage'; value: number }>;
      const productCommissions = ((commissionConfig as Record<string, unknown>).real_estate_product_commissions || {}) as Record<string, { type: 'fixed' | 'percentage'; value: number }>;

      const mappedProductSales = ((fullProductSales || []) as unknown as RawProductSale[]).map(sale => {
        const productSku = sale.product_sku || '';
        const productInfo = productDetailsMap.get(productSku);
        const projectId = productInfo?.project_id || '';
        const productComm = productCommissions[productSku];
        const projectComm = projectCommissions[projectId];

        return {
          id: sale.id,
          ktv_id: sale.ktv_id,
          sales_amount: sale.sales_amount || 0,
          calculated_commission: sale.calculated_commission,
          override_commission_type: sale.override_commission_type as 'fixed' | 'percentage' | null,
          override_commission_value: sale.override_commission_value,
          product_commission_type: (productComm?.type || null) as 'fixed' | 'percentage' | null,
          product_commission_value: productComm?.value || null,
          project_commission_type: (projectComm?.type || null) as 'fixed' | 'percentage' | null,
          project_commission_value: projectComm?.value || null,
          status: sale.status,
          sale_date: sale.sale_date,
        };
      });

      // Transform to CommissionCalculationContext
      const commissionContext = {
        tenantId,
        employeeId: ktvId,
        monthYear,
        serviceItems: fullServiceItems || [],
        productSales: mappedProductSales,
        sessions: sessionsTyped.map(s => ({
          id: s.id,
          rating: s.rating,
          status: 'completed',
          package_multiplier: packageMultiplierMap.get(s.bookings?.package_name || '') || 1.0,
        })),
        employee: {
          id: ktvId,
          position_tier: positionTier,
          text_position: positionTier,
          hire_date: hireDate,
          tenant_id: tenantId,
        },
        manualAdjustments: adjustmentsTyped,
        config: {
          commissionStrategy: serviceCommissionDefault.type,
          serviceCommissionFixed: serviceCommissionDefault.type === 'fixed' ? serviceCommissionDefault.value : undefined,
          serviceCommissionRate: serviceCommissionDefault.type === 'percentage' ? serviceCommissionDefault.value : undefined,
          productCommissionFixed: productCommissionDefault.type === 'fixed' ? productCommissionDefault.value : undefined,
          productCommissionRate: productCommissionDefault.type === 'percentage' ? productCommissionDefault.value : undefined,
          positionMultipliers,
          seniorityBonusRates,
          // Volume and performance tiers (optional, use defaults if not configured)
          enableVolumeTiers: commissionConfig.enableVolumeTiers ?? true,
          volumeTierThresholds: commissionConfig.volumeTierThresholds,
          volumeTierMultipliers: commissionConfig.volumeTierMultipliers,
          enablePerformanceMultipliers: commissionConfig.enablePerformanceMultipliers ?? true,
          performanceTierThresholds: commissionConfig.performanceTierThresholds,
          performanceTierMultipliers: commissionConfig.performanceTierMultipliers,
          // Gates (disabled by default)
          enableMinSessionsGate: commissionConfig.enableMinSessionsGate ?? false,
          minSessionsForCommission: commissionConfig.minSessionsForCommission,
          enableQualityGate: commissionConfig.enableQualityGate ?? false,
          minRatingForCommission: commissionConfig.minRatingForCommission,
        },
      } as unknown as CommissionCalculationContext;

      // Calculate via unified commission provider
      commissionAdapterResult = await adapter.calculateCommission(commissionContext);

      console.log('[COMMISSION_PROVIDER] Unified calculation complete:', {
        ktvId,
        month: monthYear,
        service_commission: commissionAdapterResult.serviceCommission,
        product_sales_commission: commissionAdapterResult.productSalesCommission,
        position_bonus: commissionAdapterResult.positionBonus,
        seniority_bonus: commissionAdapterResult.seniorityBonus,
        manual_adjustments: commissionAdapterResult.manualAdjustments,
        total_commission: commissionAdapterResult.totalCommission,
        volume_tier: commissionAdapterResult.calculation_metadata.volumeTier,
        performance_tier: commissionAdapterResult.calculation_metadata.performanceTier,
        execution_time: commissionAdapterResult.calculation_metadata.executionTime,
      });
    } catch (error) {
      console.error('[COMMISSION_PROVIDER] Unified provider failed:', error);
      throw error;
    }
  }

  const finalServiceCommission =
    existing && !isDraft && existing.service_commission !== null && existing.service_commission !== undefined
      ? Number(existing.service_commission)
      : (USE_COMMISSION_PROVIDER && commissionAdapterResult
          ? commissionAdapterResult.serviceCommission
          : liveServiceCommission);

  const finalProductCommission =
    existing && !isDraft && existing.product_sales_commission !== null && existing.product_sales_commission !== undefined
      ? Number(existing.product_sales_commission)
      : (USE_COMMISSION_PROVIDER && commissionAdapterResult
          ? commissionAdapterResult.productSalesCommission
          : liveProductCommission);

  // Position bonus: applied on service commission
  const finalPositionBonus =
    existing && !isDraft && existing.position_bonus !== null && existing.position_bonus !== undefined
      ? Number(existing.position_bonus)
      : (USE_COMMISSION_PROVIDER && commissionAdapterResult
          ? commissionAdapterResult.positionBonus
          : calculatePositionBonus({
              baseCommission: finalServiceCommission,
              positionTier,
              multipliers: positionMultipliers,
            }));

  // Seniority bonus: applied on base salary
  const finalSeniorityBonus =
    existing && !isDraft && existing.seniority_bonus !== null && existing.seniority_bonus !== undefined
      ? Number(existing.seniority_bonus)
      : (USE_COMMISSION_PROVIDER && commissionAdapterResult
          ? commissionAdapterResult.seniorityBonus
          : calculateSeniorityBonus({
              baseSalary: finalBaseSalary,
              hireDate,
              bonusRates: seniorityBonusRates,
            }));

  // Manual adjustments: net amount (can be negative)
  const finalManualAdjustments =
    existing && !isDraft && existing.manual_adjustments !== null && existing.manual_adjustments !== undefined
      ? Number(existing.manual_adjustments)
      : (USE_COMMISSION_PROVIDER && commissionAdapterResult
          ? commissionAdapterResult.manualAdjustments
          : liveManualAdjustments);

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


  let calculatedTotalSalary: number;
  let finalSessionBonusValue = sessionBonus;
  let finalRatingBonusValue = finalRatingBonus;
  let finalKpiBonusValue = finalKpiBonus;
  let finalServiceCommissionValue = finalServiceCommission;
  let finalPositionBonusValue = finalPositionBonus;
  let finalSeniorityBonusValue = finalSeniorityBonus;
  let finalSessionsCountValue = sessionsCount;

  if (isRealEstate) {
    // Under Real Estate: Salary = Base Salary + Property Sales Commission + Manual Adjustments - Deductions - Advances
    calculatedTotalSalary = calculateSalaryTotal({
      baseSalary: finalBaseSalary,
      sessionBonus: 0,
      ratingBonus: 0,
      kpiBonus: 0,
      deductions: overrides?.violations_deduction !== undefined ? overrides.violations_deduction : (existing?.violations_deduction ?? 0),
      advances: overrides?.service_percentage_bonus !== undefined ? overrides.service_percentage_bonus : (existing?.service_percentage_bonus ?? 0),
      serviceCommission: 0,
      productSalesCommission: finalProductCommission,
      positionBonus: 0,
      seniorityBonus: 0,
      manualAdjustments: finalManualAdjustments,
    });
    finalSessionBonusValue = 0;
    finalRatingBonusValue = 0;
    finalKpiBonusValue = 0;
    finalServiceCommissionValue = 0;
    finalPositionBonusValue = 0;
    finalSeniorityBonusValue = 0;
    finalSessionsCountValue = 0;
  } else {
    calculatedTotalSalary = calculateSalaryTotal({
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
  }

  const totalSalary =
    shouldUseStoredTotalSalary && existing?.total_salary !== null && existing?.total_salary !== undefined
      ? Number(existing.total_salary)
      : calculatedTotalSalary;
  const status = overrides?.status || existing?.status || 'draft';

  const payload: Database['public']['Tables']['salary_records']['Insert'] = {
    ktv_id: ktvId,
    month_year: monthYear,
    base_salary: finalBaseSalary,
    session_bonus: finalSessionBonusValue,
    rating_bonus: finalRatingBonusValue,
    kpi_bonus: finalKpiBonusValue,
    violations_deduction: isRealEstate
      ? (overrides?.violations_deduction !== undefined ? overrides.violations_deduction : (existing?.violations_deduction ?? 0))
      : deductions,
    service_percentage_bonus: isRealEstate
      ? (overrides?.service_percentage_bonus !== undefined ? overrides.service_percentage_bonus : (existing?.service_percentage_bonus ?? 0))
      : advances,
    total_sessions: finalSessionsCountValue,
    total_salary: totalSalary,
    status,
    published_at: overrides?.status === 'published' ? new Date().toISOString() : (existing?.published_at || null),
    notes: proRataNote || null,
    tenant_id: tenantId,
    // Advanced commission components (Task 28-32)
    service_commission: finalServiceCommissionValue,
    product_sales_commission: finalProductCommission,
    position_bonus: finalPositionBonusValue,
    seniority_bonus: finalSeniorityBonusValue,
    manual_adjustments: finalManualAdjustments,
  } satisfies Database['public']['Tables']['salary_records']['Update'];

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
