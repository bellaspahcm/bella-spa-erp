import {
  calculateAttendancePenalty,
  calculateAttendanceWorkDays,
  calculateProRataBaseSalaryFromActualDays,
  type AttendanceLike,
} from '@/lib/business-rules/attendance';
import { BUSINESS_RULES } from '@bella/shared';

export type SalaryConfigLike = {
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
  kpi_target_sessions: number;
  kpi_bonus_amount: number;
};

export type PackageMultiplierLike = {
  name: string | null;
  session_multiplier: number | string | null;
};

export type SessionPackageLike = {
  name?: string | null;
  session_multiplier?: number | string | null;
};

export type SessionBookingLike = {
  package_name?: string | null;
  ktv_commission?: number | string | null;
  packages?: SessionPackageLike | SessionPackageLike[] | null;
};

export type SessionLike = {
  bookings?: SessionBookingLike | null;
};

export type SalaryTotalInput = {
  baseSalary: number | string | null | undefined;
  sessionBonus?: number | string | null;
  ratingBonus?: number | string | null;
  kpiBonus?: number | string | null;
  deductions?: number | string | null;
  advances?: number | string | null;
  // Advanced commission system components (Beauty Spa)
  serviceCommission?: number | string | null;
  productSalesCommission?: number | string | null;
  positionBonus?: number | string | null;
  seniorityBonus?: number | string | null;
  manualAdjustments?: number | string | null;
};

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
  // Advanced commission components (Task 28-32)
  liveServiceCommission?: number | string | null;
  liveProductSalesCommission?: number | string | null;
  livePositionBonus?: number | string | null;
  liveSeniorityBonus?: number | string | null;
  liveManualAdjustments?: number | string | null;
};

/**
 * Default KTV session commission amount in VND.
 * Used as fallback when booking commission is not specified.
 * 
 * @constant {number}
 * @default 150000
 */
export const DEFAULT_KTV_SESSION_COMMISSION = 150000;

/**
 * Salary record status indicating draft state.
 * Draft records are recalculated dynamically on every view/update.
 * 
 * @constant {string}
 * @default "draft"
 */
export const DRAFT_SALARY_STATUS = 'draft';

/**
 * Salary record status indicating finalized state.
 * Finalized records are locked and cannot be recalculated.
 * 
 * @constant {string}
 * @default "finalized"
 */
export const FINALIZED_SALARY_STATUS = 'finalized';

/**
 * Converts a value to a finite number with fallback.
 * 
 * @param value - Value to convert (number, string, null, or undefined)
 * @param fallback - Fallback value if conversion fails (default: 0)
 * @returns Finite number or fallback
 * 
 * @example
 * ```typescript
 * asFiniteNumber('1000') // 1000
 * asFiniteNumber(null, 100) // 100
 * asFiniteNumber('invalid', 50) // 50
 * asFiniteNumber(NaN) // 0
 * ```
 */
function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

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

/**
 * Normalizes status text to uppercase for comparison.
 * 
 * @param value - Status string to normalize
 * @returns Uppercase trimmed status string
 * 
 * @example
 * ```typescript
 * normalizeStatusText('draft') // 'DRAFT'
 * normalizeStatusText(null) // ''
 * normalizeStatusText('  match  ') // 'MATCH'
 * ```
 */
function normalizeStatusText(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

/**
 * Checks if a salary record has a legacy (manual accountant) entry for reconciliation.
 * 
 * Used to determine if salary reconciliation comparison should be performed.
 * Returns `false` if the record is marked as NO_LEGACY, PENDING_LEGACY, or has no legacy data.
 * 
 * @param input - Salary reconciliation state with status and legacy status
 * @returns `true` if legacy record exists, `false` otherwise
 * 
 * @example
 * ```typescript
 * hasSalaryLegacyReconciliationRecord({ status: 'NO_LEGACY' }) // false
 * hasSalaryLegacyReconciliationRecord({ hasLegacyRecord: false }) // false
 * hasSalaryLegacyReconciliationRecord({ status: 'MATCH' }) // true
 * ```
 */
export function hasSalaryLegacyReconciliationRecord(input: SalaryReconciliationStateInput) {
  const status = normalizeStatusText(input.status);
  const legacyStatus = normalizeStatusText(input.legacyStatus);

  if (
    input.hasLegacyRecord === false ||
    status === 'NO_LEGACY' ||
    status === 'PENDING_LEGACY' ||
    legacyStatus === 'MISSING' ||
    legacyStatus === 'NONE'
  ) {
    return false;
  }

  return input.hasLegacyRecord ?? true;
}

/**
 * Calculates the percentage difference between legacy (manual) and AI-computed salary totals.
 * 
 * Used in salary reconciliation reports to identify discrepancies between accountant
 * calculations and automated system calculations.
 * 
 * @param input - Object containing legacy total, AI total, and legacy record status
 * @param input.legacyTotal - Manual accountant-calculated salary total
 * @param input.aiTotal - AI/system-calculated salary total
 * @param input.hasLegacyRecord - Whether a legacy record exists for comparison
 * @returns Difference percentage (0-100), or `null` if no comparison possible
 * 
 * @remarks
 * - Returns `null` if no legacy record exists
 * - Returns `null` if AI total is <= 0 and difference is non-zero
 * - Rounds to 2 decimal places (e.g., 12.34%)
 * 
 * @example
 * ```typescript
 * calculateSalaryReconciliationDiffPercent({
 *   legacyTotal: 10000000,
 *   aiTotal: 10500000,
 *   hasLegacyRecord: true
 * }) // 4.76 (4.76% difference)
 * 
 * calculateSalaryReconciliationDiffPercent({
 *   legacyTotal: 10000000,
 *   aiTotal: 10000000,
 *   hasLegacyRecord: true
 * }) // 0 (exact match)
 * 
 * calculateSalaryReconciliationDiffPercent({
 *   legacyTotal: 10000000,
 *   aiTotal: 0,
 *   hasLegacyRecord: true
 * }) // null (invalid AI total)
 * ```
 */
export function calculateSalaryReconciliationDiffPercent(input: {
  legacyTotal?: number | string | null;
  aiTotal?: number | string | null;
  hasLegacyRecord: boolean;
}) {
  if (!input.hasLegacyRecord) return null;

  const legacyTotal = asFiniteNumber(input.legacyTotal);
  const aiTotal = asFiniteNumber(input.aiTotal);
  const diff = Math.abs(aiTotal - legacyTotal);

  if (aiTotal <= 0) return diff === 0 ? 0 : null;
  return Math.round((diff / aiTotal) * 10000) / 100;
}

/**
 * Resolves the salary reconciliation status based on difference thresholds.
 * 
 * Categorizes salary discrepancies between legacy (manual) and AI calculations
 * into four statuses: MATCH, MINOR_DIFF, MAJOR_DIFF, or NO_LEGACY.
 * 
 * @param input - Reconciliation status input with totals, differences, and thresholds
 * @param input.status - Current reconciliation status (if already computed)
 * @param input.legacyStatus - Legacy record status
 * @param input.hasLegacyRecord - Whether legacy record exists
 * @param input.legacyTotal - Manual accountant-calculated total
 * @param input.aiTotal - AI/system-calculated total
 * @param input.diffAmount - Absolute difference in VND (optional, will be calculated if not provided)
 * @param input.diffPercent - Difference percentage (optional, will be calculated if not provided)
 * @param input.thresholds - Threshold configuration for status determination
 * @returns Reconciliation status: 'MATCH' | 'MINOR_DIFF' | 'MAJOR_DIFF' | 'NO_LEGACY'
 * 
 * @remarks
 * **Status Logic:**
 * - `NO_LEGACY`: No legacy record exists for comparison
 * - `MATCH`: Difference < MATCH_ABS_VND or difference% < MATCH_PERCENT
 * - `MINOR_DIFF`: Difference% < MAJOR_DIFF_PERCENT
 * - `MAJOR_DIFF`: Difference% >= MAJOR_DIFF_PERCENT
 * 
 * **Typical Thresholds:**
 * ```typescript
 * {
 *   MATCH_ABS_VND: 1000,      // ±1,000 VND tolerance
 *   MATCH_PERCENT: 0.1,       // ±0.1% tolerance
 *   MAJOR_DIFF_PERCENT: 5.0   // 5% major discrepancy threshold
 * }
 * ```
 * 
 * @example
 * ```typescript
 * // Exact match case
 * resolveSalaryReconciliationStatus({
 *   legacyTotal: 10000000,
 *   aiTotal: 10000000,
 *   thresholds: { MATCH_ABS_VND: 1000, MATCH_PERCENT: 0.1, MAJOR_DIFF_PERCENT: 5.0 }
 * }) // 'MATCH'
 * 
 * // Minor difference case (within 5% threshold)
 * resolveSalaryReconciliationStatus({
 *   legacyTotal: 10000000,
 *   aiTotal: 10200000,
 *   thresholds: { MATCH_ABS_VND: 1000, MATCH_PERCENT: 0.1, MAJOR_DIFF_PERCENT: 5.0 }
 * }) // 'MINOR_DIFF' (2% difference)
 * 
 * // Major difference case (exceeds 5% threshold)
 * resolveSalaryReconciliationStatus({
 *   legacyTotal: 10000000,
 *   aiTotal: 11000000,
 *   thresholds: { MATCH_ABS_VND: 1000, MATCH_PERCENT: 0.1, MAJOR_DIFF_PERCENT: 5.0 }
 * }) // 'MAJOR_DIFF' (10% difference)
 * 
 * // No legacy record case
 * resolveSalaryReconciliationStatus({
 *   hasLegacyRecord: false,
 *   aiTotal: 10000000,
 *   thresholds: { MATCH_ABS_VND: 1000, MATCH_PERCENT: 0.1, MAJOR_DIFF_PERCENT: 5.0 }
 * }) // 'NO_LEGACY'
 * ```
 */
export function resolveSalaryReconciliationStatus(input: SalaryReconciliationStatusInput): SalaryReconciliationStatus {
  const hasLegacyRecord = hasSalaryLegacyReconciliationRecord(input);
  if (!hasLegacyRecord) return 'NO_LEGACY';

  const status = normalizeStatusText(input.status);
  const hasComparableTotals = input.legacyTotal !== undefined ||
    input.aiTotal !== undefined ||
    input.diffAmount !== undefined ||
    input.diffPercent !== undefined;
  if (!hasComparableTotals && (status === 'MATCH' || status === 'MINOR_DIFF' || status === 'MAJOR_DIFF')) {
    return status;
  }

  const legacyTotal = asFiniteNumber(input.legacyTotal);
  const aiTotal = asFiniteNumber(input.aiTotal);
  const diffAmount = input.diffAmount !== null && input.diffAmount !== undefined
    ? Math.abs(asFiniteNumber(input.diffAmount))
    : Math.abs(aiTotal - legacyTotal);
  const diffPercent = input.diffPercent !== null && input.diffPercent !== undefined
    ? asFiniteNumber(input.diffPercent)
    : calculateSalaryReconciliationDiffPercent({ legacyTotal, aiTotal, hasLegacyRecord });

  if (
    diffAmount < input.thresholds.MATCH_ABS_VND ||
    (diffPercent !== null && diffPercent < input.thresholds.MATCH_PERCENT)
  ) {
    return 'MATCH';
  }

  if (diffPercent !== null && diffPercent < input.thresholds.MAJOR_DIFF_PERCENT) {
    return 'MINOR_DIFF';
  }

  return 'MAJOR_DIFF';
}

/**
 * Calculates live attendance-based salary components (base salary and deductions).
 * 
 * This function computes the pro-rata base salary based on actual working days
 * and calculates automatic attendance penalties for late/absent days.
 * 
 * @param input - Attendance calculation input
 * @param input.attendanceLogs - Array of attendance records for the period
 * @param input.rawBaseSalary - Employee's full monthly base salary (before pro-rating)
 * @param input.lateDays - Number of late days (optional)
 * @param input.absentDays - Number of absent days (optional)
 * @param input.penaltyLatePerDay - Penalty amount per late day in VND (optional)
 * @param input.penaltyAbsentPerDay - Penalty amount per absent day in VND (optional)
 * @returns Object containing calculated salary components and metadata
 * 
 * @remarks
 * **Calculation Logic:**
 * 1. **Actual Working Days**: Counts attendance records with status !== 'absent'
 * 2. **Pro-Rata Base Salary**: `(rawBaseSalary / 26) * actualDays`
 * 3. **Attendance Penalties**: `(lateDays × penaltyLatePerDay) + (absentDays × penaltyAbsentPerDay)`
 * 
 * **Return Object:**
 * - `actualDays`: Number of working days (excludes absences)
 * - `baseSalary`: Pro-rated base salary
 * - `attendancePenalty`: Detailed penalty breakdown
 * - `deductions`: Total penalty amount
 * - `hasAutoPenalty`: Whether automatic penalties were applied
 * - `proRataNote`: Human-readable note explaining calculation (e.g., "Cong thuc te: 24/26 ngay.")
 * 
 * @example
 * ```typescript
 * const result = calculateLiveAttendanceSalaryComponents({
 *   attendanceLogs: [
 *     { status: 'present' },
 *     { status: 'late' },
 *     { status: 'absent' }
 *   ],
 *   rawBaseSalary: 6000000,
 *   lateDays: 1,
 *   absentDays: 1,
 *   penaltyLatePerDay: 50000,
 *   penaltyAbsentPerDay: 200000
 * });
 * // result.actualDays === 2 (excludes 1 absent day)
 * // result.baseSalary === Math.round((6000000 / 26) * 2)
 * // result.deductions === 250000 (50000 + 200000)
 * ```
 * 
 * @see {@link BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH} for standard working days constant
 * @see {@link calculateProRataBaseSalaryFromActualDays} for pro-rata calculation details
 */
export function calculateLiveAttendanceSalaryComponents(input: {
  attendanceLogs: AttendanceLike[];
  rawBaseSalary: number;
  lateDays?: number | string | null;
  absentDays?: number | string | null;
  penaltyLatePerDay?: number | string | null;
  penaltyAbsentPerDay?: number | string | null;
}) {
  const actualDays = calculateAttendanceWorkDays(input.attendanceLogs);
  const baseSalary = calculateProRataBaseSalaryFromActualDays(input.rawBaseSalary, actualDays);
  const attendancePenalty = calculateAttendancePenalty({
    lateDays: input.lateDays,
    absentDays: input.absentDays,
    penaltyLatePerDay: input.penaltyLatePerDay,
    penaltyAbsentPerDay: input.penaltyAbsentPerDay,
  });

  return {
    actualDays,
    baseSalary,
    attendancePenalty,
    deductions: attendancePenalty.totalPenalty,
    hasAutoPenalty: attendancePenalty.lateDays > 0 || attendancePenalty.absentDays > 0,
    proRataNote: `Cong thuc te: ${actualDays}/${BUSINESS_RULES.PAYROLL.WORKING_DAYS_PER_MONTH} ngay. `,
  };
}

/**
 * Builds a package name to session multiplier mapping.
 * 
 * Creates a Map for fast lookup of session multipliers by package name.
 * Used to calculate weighted session counts based on package tiers.
 * 
 * @param packages - Array of package objects with name and multiplier
 * @returns Map of package name to multiplier (default: 1.0 for invalid/missing multipliers)
 * 
 * @remarks
 * **Package Multipliers (Bella Spa):**
 * - Basic packages: 1.0x (e.g., "Combo Mẹ & Bé Tiết Kiệm")
 * - Happy packages: 1.5x (e.g., "Combo Mẹ & Bé Hạnh Phúc")
 * - VIP packages: 2.0x (e.g., "Combo Mẹ & Bé VIP Toàn Diện")
 * 
 * **Fallback Logic:**
 * - If multiplier is `null`, `undefined`, or <= 0, defaults to `1.0`
 * - If package name is `null` or empty, package is skipped
 * 
 * @example
 * ```typescript
 * const packages = [
 *   { name: 'Basic Massage', session_multiplier: 1.0 },
 *   { name: 'VIP Package', session_multiplier: 2.0 },
 *   { name: 'Invalid', session_multiplier: null }
 * ];
 * const map = buildPackageMultiplierMap(packages);
 * map.get('Basic Massage') // 1.0
 * map.get('VIP Package') // 2.0
 * map.get('Invalid') // 1.0 (fallback)
 * map.get('Unknown') // undefined
 * ```
 * 
 * @see {@link BUSINESS_RULES.SESSIONS.MULTIPLIERS} for standard package multipliers
 * @see {@link calculateWeightedSessionCount} for usage in session count calculation
 */
export function buildPackageMultiplierMap(packages: PackageMultiplierLike[]) {
  const map = new Map<string, number>();

  packages.forEach((pkg) => {
    if (!pkg.name) return;
    const multiplier = asFiniteNumber(pkg.session_multiplier, 1);
    map.set(pkg.name, multiplier > 0 ? multiplier : 1);
  });

  return map;
}

/**
 * Gets the session multiplier for a specific session based on its package.
 * 
 * Resolves the session multiplier by checking the session's booking package details
 * and falling back to the package multiplier map lookup.
 * 
 * @param session - Session object with booking details
 * @param packageMultiplierMap - Pre-built map of package names to multipliers
 * @returns Session multiplier (default: 1.0 if not found)
 * 
 * @remarks
 * **Resolution Priority:**
 * 1. Direct multiplier from `session.bookings.packages[0].session_multiplier`
 * 2. Multiplier from `packageMultiplierMap` using package name
 * 3. Default fallback: `1.0`
 * 
 * **Package Name Resolution:**
 * - First checks `session.bookings.packages[0].name`
 * - Falls back to `session.bookings.package_name`
 * - If both are missing, defaults to empty string (multiplier = 1.0)
 * 
 * @example
 * ```typescript
 * const map = new Map([
 *   ['VIP Package', 2.0],
 *   ['Basic Package', 1.0]
 * ]);
 * 
 * const session = {
 *   bookings: {
 *     package_name: 'VIP Package',
 *     packages: [{ name: 'VIP Package', session_multiplier: 2.0 }]
 *   }
 * };
 * 
 * getSessionPackageMultiplier(session, map) // 2.0
 * ```
 * 
 * @see {@link buildPackageMultiplierMap} for creating the multiplier map
 * @see {@link calculateWeightedSessionCount} for usage in session aggregation
 */
export function getSessionPackageMultiplier(session: SessionLike, packageMultiplierMap: Map<string, number>) {
  const booking = session.bookings;
  const packageRows = booking?.packages;
  const packageRow = Array.isArray(packageRows) ? packageRows[0] : packageRows;
  const directMultiplier = asFiniteNumber(packageRow?.session_multiplier, Number.NaN);

  if (Number.isFinite(directMultiplier) && directMultiplier > 0) {
    return directMultiplier;
  }

  const packageName = packageRow?.name || booking?.package_name || '';
  return packageMultiplierMap.get(packageName) ?? 1;
}

/**
 * Calculates the total weighted session count for a KTV.
 * 
 * Sums all session multipliers to get the "quy đổi" (converted) session count.
 * This is used for KPI targets, rating bonuses, and commission calculations.
 * 
 * @param sessions - Array of completed sessions
 * @param packageMultiplierMap - Pre-built map of package names to multipliers
 * @returns Total weighted session count (can be decimal, e.g., 14.5)
 * 
 * @remarks
 * **Weighted Calculation:**
 * - Each session contributes its package multiplier to the total
 * - Basic package (1.0x): 1 session = 1.0 count
 * - Happy package (1.5x): 1 session = 1.5 count
 * - VIP package (2.0x): 1 session = 2.0 count
 * 
 * **Example Calculation:**
 * - 10 Basic sessions (1.0x): 10.0
 * - 3 Happy sessions (1.5x): 4.5
 * - 2 VIP sessions (2.0x): 4.0
 * - **Total**: 18.5 sessions (quy đổi)
 * 
 * **Database Storage:**
 * The result is stored in `salary_records.total_sessions` as `NUMERIC(5,2)` 
 * to preserve decimal precision.
 * 
 * @example
 * ```typescript
 * const sessions = [
 *   { bookings: { package_name: 'Basic' } },
 *   { bookings: { package_name: 'VIP' } },
 *   { bookings: { package_name: 'Basic' } }
 * ];
 * const map = new Map([['Basic', 1.0], ['VIP', 2.0]]);
 * 
 * calculateWeightedSessionCount(sessions, map) // 4.0 (1.0 + 2.0 + 1.0)
 * ```
 * 
 * @see {@link getSessionPackageMultiplier} for per-session multiplier resolution
 * @see {@link BUSINESS_RULES.SESSIONS.MULTIPLIERS} for multiplier constants
 */
export function calculateWeightedSessionCount(sessions: SessionLike[], packageMultiplierMap: Map<string, number>) {
  return sessions.reduce((total, session) => total + getSessionPackageMultiplier(session, packageMultiplierMap), 0);
}

/**
 * Calculates the total session commission bonus for a KTV.
 * 
 * Sums all per-session commissions from completed bookings.
 * Uses {@link DEFAULT_KTV_SESSION_COMMISSION} as fallback if commission is not specified.
 * 
 * @param sessions - Array of completed sessions with booking details
 * @returns Total session commission bonus in VND
 * 
 * @remarks
 * **Commission Sources:**
 * - Primary: `session.bookings.ktv_commission` (custom per-booking commission)
 * - Fallback: {@link DEFAULT_KTV_SESSION_COMMISSION} (150,000 VND)
 * 
 * **Business Logic:**
 * - Each completed session contributes its commission to the total
 * - Commission can vary by package tier or booking type
 * - If a session has no commission specified, uses the default constant
 * 
 * @example
 * ```typescript
 * const sessions = [
 *   { bookings: { ktv_commission: 200000 } },
 *   { bookings: { ktv_commission: 150000 } },
 *   { bookings: { ktv_commission: null } } // Uses default 150000
 * ];
 * 
 * calculateSessionCommissionBonus(sessions) // 500000 (200k + 150k + 150k)
 * ```
 * 
 * @see {@link DEFAULT_KTV_SESSION_COMMISSION} for default commission constant
 * @see {@link SalaryRecordDbAdmin.session_bonus} for where this value is stored
 */
export function calculateSessionCommissionBonus(sessions: SessionLike[]) {
  return sessions.reduce(
    (total, session) => total + asFiniteNumber(session.bookings?.ktv_commission, DEFAULT_KTV_SESSION_COMMISSION),
    0,
  );
}

/**
 * Calculates the total rating bonus for a KTV based on weighted sessions and average rating.
 * 
 * Multiplies the weighted session count by the per-session rating bonus tier.
 * 
 * @param weightedSessions - Total weighted session count (from {@link calculateWeightedSessionCount})
 * @param averageRating - KTV's average rating (0-5.0), or `null` if no ratings
 * @param salaryConfig - Tenant salary configuration with bonus tiers
 * @returns Total rating bonus in VND
 * 
 * @remarks
 * **Bonus Tiers (Typical Bella Spa Config):**
 * - 5.0 stars: 50,000 VND per session
 * - 4.5-4.9 stars: 30,000 VND per session
 * - 4.0-4.4 stars: 10,000 VND per session
 * - Below 4.0: 0 VND
 * 
 * **Calculation Formula:**
 * ```typescript
 * ratingBonus = weightedSessions × bonusPerSession(averageRating)
 * ```
 * 
 * **Example Calculation:**
 * - 15.5 weighted sessions × 30,000 VND (4.5-star bonus) = 465,000 VND
 * 
 * @example
 * ```typescript
 * const config = {
 *   bonus_5_star: 50000,
 *   bonus_4_5_star: 30000,
 *   bonus_4_star: 10000
 * };
 * 
 * calculateRatingBonus(10, 5.0, config) // 500000 (10 × 50k)
 * calculateRatingBonus(15.5, 4.7, config) // 465000 (15.5 × 30k)
 * calculateRatingBonus(20, null, config) // 0 (no rating)
 * ```
 * 
 * @see {@link calculateRatingBonusPerSession} for per-session bonus calculation
 * @see {@link BUSINESS_RULES.SESSIONS.MIN_RATING_FOR_BONUS} for minimum rating threshold
 */
export function calculateRatingBonus(
  weightedSessions: number,
  averageRating: number | null,
  salaryConfig: SalaryConfigLike,
) {
  return weightedSessions * calculateRatingBonusPerSession(averageRating, salaryConfig);
}

/**
 * Calculates the rating bonus amount per session based on average rating tier.
 * 
 * Returns the bonus tier amount from salary configuration based on the KTV's average rating.
 * 
 * @param averageRating - KTV's average rating (0-5.0), or `null` if no ratings
 * @param salaryConfig - Tenant salary configuration with bonus tier amounts
 * @returns Bonus amount per session in VND (0 if no rating or below threshold)
 * 
 * @remarks
 * **Rating Thresholds:**
 * - Exactly 5.0 → `bonus_5_star` (50,000 VND)
 * - >= {@link BUSINESS_RULES.SESSIONS.MIN_RATING_FOR_BONUS} (4.5) → `bonus_4_5_star` (30,000 VND)
 * - >= 4.0 → `bonus_4_star` (10,000 VND)
 * - < 4.0 or `null` → 0 VND
 * 
 * **Strict 5-Star Check:**
 * The function uses exact equality (`===`) for 5.0 stars to prevent floating-point
 * issues and ensure only perfect ratings get the top tier bonus.
 * 
 * @example
 * ```typescript
 * const config = {
 *   bonus_5_star: 50000,
 *   bonus_4_5_star: 30000,
 *   bonus_4_star: 10000
 * };
 * 
 * calculateRatingBonusPerSession(5.0, config) // 50000
 * calculateRatingBonusPerSession(4.7, config) // 30000
 * calculateRatingBonusPerSession(4.2, config) // 10000
 * calculateRatingBonusPerSession(3.9, config) // 0
 * calculateRatingBonusPerSession(null, config) // 0
 * ```
 * 
 * @see {@link calculateRatingBonus} for total rating bonus calculation
 * @see {@link BUSINESS_RULES.SESSIONS.MIN_RATING_FOR_BONUS} for minimum bonus threshold
 */
export function calculateRatingBonusPerSession(
  averageRating: number | null,
  salaryConfig: SalaryConfigLike,
) {
  if (averageRating === null) return 0;
  if (averageRating === 5.0) return salaryConfig.bonus_5_star;
  if (averageRating >= BUSINESS_RULES.SESSIONS.MIN_RATING_FOR_BONUS) return salaryConfig.bonus_4_5_star;
  if (averageRating >= 4.0) return salaryConfig.bonus_4_star;
  return 0;
}

/**
 * Calculates KPI bonus based on session count target achievement.
 * 
 * Awards the configured KPI bonus if the KTV meets or exceeds the target session count.
 * 
 * @param input - KPI calculation input
 * @param input.sessionsCount - Total weighted session count for the period
 * @param input.salaryConfig - Tenant salary configuration with KPI settings
 * @param input.existingKpiBonus - Existing KPI bonus (if already calculated), takes precedence
 * @returns KPI bonus amount in VND (0 if target not met)
 * 
 * @remarks
 * **KPI Logic:**
 * - If `existingKpiBonus` is provided, returns it immediately (preserves manual adjustments)
 * - If `sessionsCount >= kpi_target_sessions`, awards full `kpi_bonus_amount`
 * - Otherwise, returns 0
 * 
 * **Typical Configuration (Bella Spa):**
 * - Target: 30 sessions per month
 * - Bonus: 1,000,000 VND
 * 
 * **Important Notes:**
 * - Uses weighted session count (quy đổi), not raw session count
 * - KPI bonus from `kpi_records` table takes precedence over calculation
 * - This function does NOT create `kpi_records` entries (done separately by leaderboard sync)
 * 
 * @example
 * ```typescript
 * const config = {
 *   kpi_target_sessions: 30,
 *   kpi_bonus_amount: 1000000
 * };
 * 
 * calculateKpiBonus({ sessionsCount: 35, salaryConfig: config }) // 1000000 (target met)
 * calculateKpiBonus({ sessionsCount: 28, salaryConfig: config }) // 0 (target not met)
 * calculateKpiBonus({ sessionsCount: 20, salaryConfig: config, existingKpiBonus: 500000 }) // 500000 (manual override)
 * ```
 * 
 * @see {@link calculateWeightedSessionCount} for session count calculation
 * @see {@link recalculateAndSaveSalaryRecordEngine} for KPI sync from `kpi_records`
 */
export function calculateKpiBonus(input: {
  sessionsCount: number;
  salaryConfig: SalaryConfigLike;
  existingKpiBonus?: number;
}) {
  if (input.existingKpiBonus !== undefined) return input.existingKpiBonus;
  const target = asFiniteNumber(input.salaryConfig.kpi_target_sessions, 0);
  const amount = asFiniteNumber(input.salaryConfig.kpi_bonus_amount, 0);
  return input.sessionsCount >= target ? amount : 0;
}

/**
 * Calculates the final total salary after all bonuses and deductions.
 * 
 * This is the **final salary calculation formula** used across the entire system.
 * All salary displays, reports, and financial entries MUST use this function.
 * 
 * @param input - Salary components
 * @param input.baseSalary - Pro-rated base salary (after attendance calculation)
 * @param input.sessionBonus - Total session commission bonus
 * @param input.ratingBonus - Total rating bonus
 * @param input.kpiBonus - KPI achievement bonus
 * @param input.deductions - Total deductions (attendance penalties, disciplinary fines)
 * @param input.advances - Advance payments or service percentage adjustments
 * @returns Total salary in VND (minimum: 0, never negative)
 * 
 * @remarks
 * **Extended Formula (with Advanced Commission System):**
 * ```typescript
 * totalSalary = baseSalary 
 *             + sessionBonus + ratingBonus + kpiBonus 
 *             + serviceCommission + productSalesCommission 
 *             + positionBonus + seniorityBonus 
 *             + manualAdjustments 
 *             - deductions - advances
 * totalSalary = Math.max(0, totalSalary) // Never negative
 * ```
 * 
 * **Component Details:**
 * - `baseSalary`: Pro-rated from `(base_salary / 26) * actualDays`
 * - `sessionBonus`: Sum of all session commissions (legacy Baby Care)
 * - `ratingBonus`: Weighted sessions × rating tier bonus
 * - `kpiBonus`: Fixed amount if target met
 * - `serviceCommission`: Beauty Spa service-level commissions (new)
 * - `productSalesCommission`: Beauty Spa product sales commissions (new)
 * - `positionBonus`: Position tier multiplier bonus (new)
 * - `seniorityBonus`: Years of service bonus (new)
 * - `manualAdjustments`: Net admin bonuses/deductions (new, can be negative)
 * - `deductions`: Late penalties + absent penalties + disciplinary fines
 * - `advances`: Pre-paid amounts to be subtracted
 * 
 * **Critical Business Rule:**
 * - **NEVER** omit any component from this calculation
 * - All financial reports, reconciliation, and P&L MUST use this formula
 * - The result is stored in `salary_records.total_salary`
 * 
 * @example
 * ```typescript
 * // Legacy Baby Care formula (backward compatible)
 * const totalSalary = calculateSalaryTotal({
 *   baseSalary: 6000000,
 *   sessionBonus: 1500000,
 *   ratingBonus: 450000,
 *   kpiBonus: 1000000,
 *   deductions: 200000,
 *   advances: 0
 * });
 * // totalSalary === 8750000 VND
 * // (6M + 1.5M + 450k + 1M - 200k - 0)
 * ```
 * 
 * @example
 * ```typescript
 * // Extended Beauty Spa formula with commission components
 * const totalSalary = calculateSalaryTotal({
 *   baseSalary: 6000000,
 *   sessionBonus: 0, // Beauty Spa uses serviceCommission instead
 *   ratingBonus: 0,
 *   kpiBonus: 1000000,
 *   serviceCommission: 2000000,
 *   productSalesCommission: 500000,
 *   positionBonus: 400000,
 *   seniorityBonus: 600000,
 *   manualAdjustments: 300000,
 *   deductions: 200000,
 *   advances: 0
 * });
 * // totalSalary === 10600000 VND
 * // (6M + 0 + 0 + 1M + 2M + 500k + 400k + 600k + 300k - 200k - 0)
 * ```
 * 
 * @example
 * ```typescript
 * // Edge case: Large deductions prevent negative salary
 * const totalSalary = calculateSalaryTotal({
 *   baseSalary: 1000000,
 *   sessionBonus: 0,
 *   ratingBonus: 0,
 *   kpiBonus: 0,
 *   deductions: 2000000,
 *   advances: 0
 * });
 * // totalSalary === 0 (not -1000000)
 * ```
 * 
 * @see {@link recalculateAndSaveSalaryRecordEngine} for usage in salary recalculation
 * @see {@link buildSalaryDisplayComponents} for usage in UI displays
 */
export function calculateSalaryTotal(input: SalaryTotalInput) {
  return Math.max(
    0,
    asFiniteNumber(input.baseSalary) +
      asFiniteNumber(input.sessionBonus) +
      asFiniteNumber(input.ratingBonus) +
      asFiniteNumber(input.kpiBonus) +
      asFiniteNumber(input.serviceCommission) +
      asFiniteNumber(input.productSalesCommission) +
      asFiniteNumber(input.positionBonus) +
      asFiniteNumber(input.seniorityBonus) +
      asFiniteNumber(input.manualAdjustments) -
      asFiniteNumber(input.deductions) -
      asFiniteNumber(input.advances),
  );
}

/**
 * Checks if a salary record is in draft status.
 * 
 * Draft records are recalculated dynamically on every view/update.
 * Non-draft records preserve their saved values unless explicit overrides are provided.
 * 
 * @param record - Salary record object (can be null/undefined)
 * @returns `true` if record is draft or doesn't exist, `false` otherwise
 * 
 * @remarks
 * **Draft Status Rules:**
 * - Returns `true` if record is `null` or `undefined` (no record exists yet)
 * - Returns `true` if `record.status === 'draft'`
 * - Returns `false` for all other statuses ('pending_approval', 'published', 'confirmed', 'finalized')
 * 
 * **Usage:**
 * This function is used to determine whether to recalculate salary components
 * dynamically or use saved values from the database.
 * 
 * @example
 * ```typescript
 * isDraftSalaryRecord(null) // true (no record)
 * isDraftSalaryRecord({ status: 'draft' }) // true
 * isDraftSalaryRecord({ status: 'pending_approval' }) // false
 * isDraftSalaryRecord({ status: 'published' }) // false
 * ```
 * 
 * @see {@link shouldUseSavedSalaryFinancials} for inverse logic
 * @see {@link DRAFT_SALARY_STATUS} for draft status constant
 */
export function isDraftSalaryRecord(record: SalaryRecordFinancialLike) {
  return !record || record.status === DRAFT_SALARY_STATUS;
}

/**
 * Checks if saved salary financial values should be used instead of recalculating.
 * 
 * Returns `true` if the salary record exists and is NOT in draft status.
 * This is the inverse of {@link isDraftSalaryRecord}.
 * 
 * @param record - Salary record object (can be null/undefined)
 * @returns `true` if saved values should be used, `false` if recalculation is needed
 * 
 * @remarks
 * **Saved Financials Logic:**
 * - `true`: Record exists and status is NOT 'draft' → Use saved values
 * - `false`: Record is null/undefined OR status is 'draft' → Recalculate dynamically
 * 
 * **Critical for Status Lifecycle:**
 * Once a salary record moves beyond draft status, its financial values are preserved
 * unless explicit overrides are provided. This prevents unwanted recalculations after
 * admin approval or KTV confirmation.
 * 
 * @example
 * ```typescript
 * shouldUseSavedSalaryFinancials(null) // false (no record, must calculate)
 * shouldUseSavedSalaryFinancials({ status: 'draft' }) // false (draft, recalculate)
 * shouldUseSavedSalaryFinancials({ status: 'pending_approval' }) // true (use saved)
 * shouldUseSavedSalaryFinancials({ status: 'published' }) // true (use saved)
 * ```
 * 
 * @see {@link isDraftSalaryRecord} for draft status check
 * @see {@link buildSalaryDisplayComponents} for usage in UI displays
 */
export function shouldUseSavedSalaryFinancials(record: SalaryRecordFinancialLike) {
  return Boolean(record && !isDraftSalaryRecord(record));
}

/**
 * Checks if salary recalculation overrides include financial components.
 * 
 * Returns `true` if overrides modify any salary financial values (base, KPI, deductions, etc.).
 * 
 * @param overrides - Salary recalculation overrides object (can be null/undefined)
 * @returns `true` if financial overrides are present, `false` otherwise
 * 
 * @remarks
 * **Financial Override Fields:**
 * - `base_salary`: Manual base salary adjustment
 * - `kpi_bonus`: Manual KPI bonus override
 * - `violations_deduction`: Manual deduction adjustment
 * - `service_percentage_bonus`: Manual advance/service percentage
 * - `total_sessions`: Manual session count override
 * 
 * **Usage:**
 * This function is used to determine whether saved financial values should be
 * recalculated even if the record is NOT in draft status. Financial overrides
 * from admins force recalculation regardless of status.
 * 
 * **Non-Financial Overrides:**
 * The `status` field is NOT considered a financial override. Status changes
 * alone do not trigger recalculation.
 * 
 * @example
 * ```typescript
 * hasSalaryFinancialRecalculationOverrides(null) // false
 * hasSalaryFinancialRecalculationOverrides({}) // false
 * hasSalaryFinancialRecalculationOverrides({ status: 'published' }) // false
 * hasSalaryFinancialRecalculationOverrides({ base_salary: 7000000 }) // true
 * hasSalaryFinancialRecalculationOverrides({ kpi_bonus: 500000 }) // true
 * hasSalaryFinancialRecalculationOverrides({ total_sessions: 20 }) // true
 * ```
 * 
 * @see {@link recalculateAndSaveSalaryRecordEngine} for usage in recalculation logic
 * @see {@link SalaryRecalculationOverrides} for override type definition
 */
export function hasSalaryFinancialRecalculationOverrides(
  overrides: SalaryRecalculationLifecycleOverrides,
) {
  return Boolean(
    overrides &&
      (
        overrides.base_salary !== undefined ||
        overrides.kpi_bonus !== undefined ||
        overrides.violations_deduction !== undefined ||
        overrides.service_percentage_bonus !== undefined ||
        overrides.total_sessions !== undefined
      ),
  );
}

/**
 * Asserts that a salary record can be recalculated (lifecycle validation).
 * 
 * Throws an error if the record is locked or finalized, preventing unwanted recalculation.
 * 
 * @param record - Salary record object (can be null/undefined)
 * @throws {Error} If record is locked (`is_locked === true`)
 * @throws {Error} If record status is 'finalized'
 * 
 * @remarks
 * **Lifecycle Protection Rules:**
 * 1. **Locked Records**: Manually locked by admin, no modifications allowed
 * 2. **Finalized Records**: Expense entry created, salary paid, fully locked
 * 
 * **Safe Statuses (No Throw):**
 * - `null` / `undefined`: No record exists, safe to create
 * - `'draft'`: Draft records can always be recalculated
 * - `'pending_approval'`: Can be recalculated with overrides
 * - `'published'`: Can be recalculated with overrides
 * - `'confirmed'`: Can be recalculated with overrides (rare, but allowed)
 * 
 * **Critical for Data Integrity:**
 * - Prevents accidental modification of finalized salaries after payment
 * - Prevents modification of locked records during month-end close
 * - Enforces immutability of financial records after accounting entry
 * 
 * @example
 * ```typescript
 * // Safe cases (no throw)
 * assertSalaryRecalculationLifecycle(null) // OK
 * assertSalaryRecalculationLifecycle({ status: 'draft' }) // OK
 * assertSalaryRecalculationLifecycle({ status: 'pending_approval' }) // OK
 * 
 * // Unsafe cases (throws error)
 * assertSalaryRecalculationLifecycle({ is_locked: true }) // throws
 * assertSalaryRecalculationLifecycle({ status: 'finalized' }) // throws
 * ```
 * 
 * @see {@link recalculateAndSaveSalaryRecordEngine} for usage at recalculation entry point
 * @see {@link FINALIZED_SALARY_STATUS} for finalized status constant
 */
export function assertSalaryRecalculationLifecycle(
  record: SalaryRecordFinancialLike,
) {
  if (!record) return;

  if (record.is_locked) {
    throw new Error('Cannot recalculate locked salary record');
  }

  if (String(record.status ?? '').toLowerCase() === FINALIZED_SALARY_STATUS) {
    throw new Error('Cannot recalculate finalized salary record');
  }
}

/**
 * Selects saved or live value based on status lifecycle rules.
 * 
 * Internal helper for {@link buildSalaryDisplayComponents} to choose between
 * saved database values and live recalculated values.
 * 
 * @param shouldUseSaved - Whether to use saved values (from {@link shouldUseSavedSalaryFinancials})
 * @param savedValue - Value stored in database
 * @param liveValue - Dynamically calculated value
 * @returns Saved value if `shouldUseSaved` is true and savedValue exists, otherwise live value
 * 
 * @example
 * ```typescript
 * selectSavedOrLive(true, 6000000, 5800000) // 6000000 (saved)
 * selectSavedOrLive(false, 6000000, 5800000) // 5800000 (live)
 * selectSavedOrLive(true, null, 5800000) // 5800000 (saved is null)
 * selectSavedOrLive(true, undefined, 5800000) // 5800000 (saved is undefined)
 * ```
 */
function selectSavedOrLive(
  shouldUseSaved: boolean,
  savedValue: number | string | null | undefined,
  liveValue: number | string | null | undefined,
) {
  return shouldUseSaved && savedValue !== null && savedValue !== undefined
    ? asFiniteNumber(savedValue)
    : asFiniteNumber(liveValue);
}

/**
 * Builds salary display components with correct draft vs. saved value logic.
 * 
 * This function is the **primary UI display logic** for all salary-related pages.
 * It handles the complex business logic of when to show saved vs. recalculated values.
 * 
 * @param input - Display components input with record and live calculated values
 * @param input.record - Existing salary record from database (can be null/undefined)
 * @param input.liveSessionsCount - Dynamically calculated weighted session count
 * @param input.liveSessionBonus - Dynamically calculated session commission total
 * @param input.liveRatingBonus - Dynamically calculated rating bonus
 * @param input.liveBaseSalary - Dynamically calculated pro-rata base salary
 * @param input.liveKpiBonus - Dynamically calculated KPI bonus
 * @param input.liveDeductions - Dynamically calculated attendance deductions
 * @param input.liveAdvances - Dynamically calculated advances (optional)
 * @returns Object with resolved salary components and metadata
 * 
 * @remarks
 * **Draft vs. Saved Logic:**
 * - **Draft Records**: Always use live calculated values (dynamic recalculation)
 * - **Non-Draft Records**: Use saved database values (preserve approved/published data)
 * 
 * **Return Object Fields:**
 * - `status`: Current salary record status
 * - `isDraft`: Whether record is in draft state
 * - `useSavedFinancials`: Whether saved values are being used
 * - `sessions`: Resolved session count (saved or live)
 * - `sessionBonus`: Resolved session bonus (saved or live)
 * - `ratingBonus`: Resolved rating bonus (saved or live)
 * - `baseSalary`: Resolved base salary (saved or live)
 * - `kpiBonus`: Resolved KPI bonus (saved or live)
 * - `deductions`: Resolved deductions (saved or live)
 * - `advances`: Resolved advances (always from record if exists)
 * - `calculatedTotalSalary`: Total calculated from resolved components
 * - `totalSalary`: Final displayed total (saved or calculated)
 * 
 * **Critical UI Rules:**
 * - **Display layer MUST match backend calculation layer** 
 * - **Never write separate display logic that differs from recalculation engine**
 * - Both frontend and backend MUST use the same `isDraft` logic
 * 
 * @example
 * ```typescript
 * // Draft record: Shows live calculated values
 * const display = buildSalaryDisplayComponents({
 *   record: { status: 'draft', base_salary: 6000000 },
 *   liveSessionsCount: 15.5,
 *   liveSessionBonus: 1500000,
 *   liveRatingBonus: 450000,
 *   liveBaseSalary: 5800000, // Pro-rated (24/26 days)
 *   liveKpiBonus: 1000000,
 *   liveDeductions: 200000
 * });
 * // display.baseSalary === 5800000 (uses live, not saved 6000000)
 * // display.isDraft === true
 * ```
 * 
 * @example
 * ```typescript
 * // Published record: Shows saved values
 * const display = buildSalaryDisplayComponents({
 *   record: { 
 *     status: 'published', 
 *     base_salary: 6000000,
 *     total_salary: 8500000
 *   },
 *   liveSessionsCount: 16,
 *   liveSessionBonus: 1600000,
 *   liveRatingBonus: 480000,
 *   liveBaseSalary: 6000000,
 *   liveKpiBonus: 1000000,
 *   liveDeductions: 200000
 * });
 * // display.baseSalary === 6000000 (uses saved)
 * // display.totalSalary === 8500000 (uses saved)
 * // display.isDraft === false
 * ```
 * 
 * @see {@link shouldUseSavedSalaryFinancials} for saved value logic
 * @see {@link calculateSalaryTotal} for total calculation
 * @see {@link isDraftSalaryRecord} for draft status check
 */
export function buildSalaryDisplayComponents(input: SalaryDisplayComponentsInput) {
  const record = input.record;
  const status = record?.status || DRAFT_SALARY_STATUS;
  const useSavedFinancials = shouldUseSavedSalaryFinancials(record);
  const sessions = selectSavedOrLive(useSavedFinancials, record?.total_sessions, input.liveSessionsCount);
  const sessionBonus = selectSavedOrLive(useSavedFinancials, record?.session_bonus, input.liveSessionBonus);
  const ratingBonus = selectSavedOrLive(useSavedFinancials, record?.rating_bonus, input.liveRatingBonus);
  const baseSalary = selectSavedOrLive(useSavedFinancials, record?.base_salary, input.liveBaseSalary);
  const kpiBonus = selectSavedOrLive(useSavedFinancials, record?.kpi_bonus, input.liveKpiBonus);
  const deductions = selectSavedOrLive(useSavedFinancials, record?.violations_deduction, input.liveDeductions);
  const advances = record?.service_percentage_bonus !== null && record?.service_percentage_bonus !== undefined
    ? asFiniteNumber(record.service_percentage_bonus)
    : asFiniteNumber(input.liveAdvances);
  
  // Advanced commission components (Task 28-32)
  const serviceCommission = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.service_commission,
    input.liveServiceCommission
  );
  const productSalesCommission = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.product_sales_commission,
    input.liveProductSalesCommission
  );
  const positionBonus = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.position_bonus,
    input.livePositionBonus
  );
  const seniorityBonus = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.seniority_bonus,
    input.liveSeniorityBonus
  );
  const manualAdjustments = selectSavedOrLive(
    useSavedFinancials,
    (record as any)?.manual_adjustments,
    input.liveManualAdjustments
  );
  
  const calculatedTotalSalary = calculateSalaryTotal({
    baseSalary,
    sessionBonus,
    ratingBonus,
    kpiBonus,
    deductions,
    advances,
    serviceCommission,
    productSalesCommission,
    positionBonus,
    seniorityBonus,
    manualAdjustments,
  });
  const totalSalary = useSavedFinancials && record?.total_salary !== null && record?.total_salary !== undefined
    ? asFiniteNumber(record.total_salary)
    : calculatedTotalSalary;

  return {
    status,
    isDraft: !useSavedFinancials,
    useSavedFinancials,
    sessions,
    sessionBonus,
    ratingBonus,
    baseSalary,
    kpiBonus,
    deductions,
    advances,
    serviceCommission,
    productSalesCommission,
    positionBonus,
    seniorityBonus,
    manualAdjustments,
    calculatedTotalSalary,
    totalSalary,
  };
}

/**
 * Calculates complete salary details for a KTV (legacy helper function).
 * 
 * **⚠️ DEPRECATED**: This function exists for backward compatibility with older code.
 * New code should use {@link recalculateAndSaveSalaryRecordEngine} and {@link buildSalaryDisplayComponents}.
 * 
 * @param sessionsCount - Total weighted session count
 * @param avgRating - Average customer rating (0-5.0)
 * @param salaryConfig - Tenant salary configuration
 * @param rawBaseSalary - Full monthly base salary (before pro-rating)
 * @param deductions - Manual deductions (default: 0)
 * @param advances - Advance payments (default: 0)
 * @param sessionBonus - Session commission bonus (default: 0)
 * @param existingKpiBonus - Existing KPI bonus override (optional)
 * @returns Object with calculated bonus per session, rating bonus, KPI bonus, and total salary
 * 
 * @remarks
 * **Limitations:**
 * - Does NOT handle pro-rata calculations (assumes full month)
 * - Does NOT handle attendance penalties
 * - Does NOT handle status lifecycle logic
 * - Does NOT sync with database
 * 
 * **Use Cases:**
 * - Quick salary estimates in UI
 * - Preview calculations before saving
 * - Backward compatibility with old code
 * 
 * **Migration Path:**
 * Replace calls to this function with:
 * 1. {@link recalculateAndSaveSalaryRecordEngine} for backend calculations
 * 2. {@link buildSalaryDisplayComponents} for UI displays
 * 
 * @example
 * ```typescript
 * const config = {
 *   bonus_5_star: 50000,
 *   bonus_4_5_star: 30000,
 *   bonus_4_star: 10000,
 *   kpi_target_sessions: 30,
 *   kpi_bonus_amount: 1000000
 * };
 * 
 * const details = calculateSalaryDetails(
 *   35,        // 35 weighted sessions
 *   4.7,       // 4.7-star avg rating
 *   config,
 *   6000000,   // 6M base salary
 *   200000,    // 200k deductions
 *   0,         // No advances
 *   1500000    // 1.5M session bonus
 * );
 * // details.bonusPerSession === 30000 (4.5-star tier)
 * // details.ratingBonus === 1050000 (35 × 30k)
 * // details.kpiBonus === 1000000 (target met)
 * // details.totalSalary === 8350000 (6M + 1.5M + 1.05M + 1M - 200k - 0)
 * ```
 * 
 * @deprecated Use {@link recalculateAndSaveSalaryRecordEngine} or {@link buildSalaryDisplayComponents} instead
 * @see {@link recalculateAndSaveSalaryRecordEngine} for full salary recalculation
 * @see {@link buildSalaryDisplayComponents} for UI display logic
 */
export function calculateSalaryDetails(
  sessionsCount: number,
  avgRating: number | null,
  salaryConfig: SalaryConfigLike,
  rawBaseSalary: number,
  deductions = 0,
  advances = 0,
  sessionBonus = 0,
  existingKpiBonus?: number,
) {
  const bonusPerSession = calculateRatingBonusPerSession(avgRating, salaryConfig);
  const ratingBonus = sessionsCount * bonusPerSession;
  const kpiBonus = calculateKpiBonus({ sessionsCount, salaryConfig, existingKpiBonus });
  const totalSalary = calculateSalaryTotal({
    baseSalary: rawBaseSalary,
    sessionBonus,
    ratingBonus,
    kpiBonus,
    deductions,
    advances,
  });

  return {
    bonusPerSession,
    ratingBonus,
    kpiBonus,
    totalSalary,
  };
}
