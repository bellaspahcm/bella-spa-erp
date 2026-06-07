import {
  calculateAttendancePenalty,
  calculateAttendanceWorkDays,
  calculateProRataBaseSalaryFromActualDays,
  type AttendanceLike,
} from '@/lib/business-rules/attendance';

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
};

export const DEFAULT_KTV_SESSION_COMMISSION = 150000;
export const DRAFT_SALARY_STATUS = 'draft';
export const FINALIZED_SALARY_STATUS = 'finalized';

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

function normalizeStatusText(value: string | null | undefined) {
  return String(value ?? '').trim().toUpperCase();
}

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
    proRataNote: `Cong thuc te: ${actualDays}/26 ngay. `,
  };
}

export function buildPackageMultiplierMap(packages: PackageMultiplierLike[]) {
  const map = new Map<string, number>();

  packages.forEach((pkg) => {
    if (!pkg.name) return;
    const multiplier = asFiniteNumber(pkg.session_multiplier, 1);
    map.set(pkg.name, multiplier > 0 ? multiplier : 1);
  });

  return map;
}

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

export function calculateWeightedSessionCount(sessions: SessionLike[], packageMultiplierMap: Map<string, number>) {
  return sessions.reduce((total, session) => total + getSessionPackageMultiplier(session, packageMultiplierMap), 0);
}

export function calculateSessionCommissionBonus(sessions: SessionLike[]) {
  return sessions.reduce(
    (total, session) => total + asFiniteNumber(session.bookings?.ktv_commission, DEFAULT_KTV_SESSION_COMMISSION),
    0,
  );
}

export function calculateRatingBonus(
  weightedSessions: number,
  averageRating: number | null,
  salaryConfig: SalaryConfigLike,
) {
  return weightedSessions * calculateRatingBonusPerSession(averageRating, salaryConfig);
}

export function calculateRatingBonusPerSession(
  averageRating: number | null,
  salaryConfig: SalaryConfigLike,
) {
  if (averageRating === null) return 0;
  if (averageRating === 5.0) return salaryConfig.bonus_5_star;
  if (averageRating >= 4.5) return salaryConfig.bonus_4_5_star;
  if (averageRating >= 4.0) return salaryConfig.bonus_4_star;
  return 0;
}

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

export function calculateSalaryTotal(input: SalaryTotalInput) {
  return Math.max(
    0,
    asFiniteNumber(input.baseSalary) +
      asFiniteNumber(input.sessionBonus) +
      asFiniteNumber(input.ratingBonus) +
      asFiniteNumber(input.kpiBonus) -
      asFiniteNumber(input.deductions) -
      asFiniteNumber(input.advances),
  );
}

export function isDraftSalaryRecord(record: SalaryRecordFinancialLike) {
  return !record || record.status === DRAFT_SALARY_STATUS;
}

export function shouldUseSavedSalaryFinancials(record: SalaryRecordFinancialLike) {
  return Boolean(record && !isDraftSalaryRecord(record));
}

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

function selectSavedOrLive(
  shouldUseSaved: boolean,
  savedValue: number | string | null | undefined,
  liveValue: number | string | null | undefined,
) {
  return shouldUseSaved && savedValue !== null && savedValue !== undefined
    ? asFiniteNumber(savedValue)
    : asFiniteNumber(liveValue);
}

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
  const calculatedTotalSalary = calculateSalaryTotal({
    baseSalary,
    sessionBonus,
    ratingBonus,
    kpiBonus,
    deductions,
    advances,
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
    calculatedTotalSalary,
    totalSalary,
  };
}

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
