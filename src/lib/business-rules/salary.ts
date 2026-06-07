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

export const DEFAULT_KTV_SESSION_COMMISSION = 150000;

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
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
