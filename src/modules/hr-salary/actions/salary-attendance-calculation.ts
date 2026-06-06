import {
  STANDARD_SALARY_WORK_DAYS,
  calculateAttendanceWorkDays,
  calculateProRataBaseSalaryFromActualDays,
} from '@/lib/business-rules/attendance';

type SalaryConfigLike = {
  bonus_5_star: number;
  bonus_4_5_star: number;
  bonus_4_star: number;
};

type PackageMultiplierLike = {
  name: string | null;
  session_multiplier: number | null;
};

type SessionPackageLike = {
  name?: string | null;
  session_multiplier?: number | null;
};

type SessionBookingLike = {
  package_name?: string | null;
  ktv_commission?: number | null;
  packages?: SessionPackageLike | SessionPackageLike[] | null;
};

type SessionLike = {
  bookings?: SessionBookingLike | null;
};

export const DEFAULT_KTV_SESSION_COMMISSION = 150000;
export {
  STANDARD_SALARY_WORK_DAYS,
  calculateAttendanceWorkDays,
  calculateProRataBaseSalaryFromActualDays,
};

export function buildPackageMultiplierMap(packages: PackageMultiplierLike[]) {
  const map = new Map<string, number>();

  packages.forEach((pkg) => {
    if (!pkg.name) return;
    const multiplier = Number(pkg.session_multiplier ?? 1);
    map.set(pkg.name, Number.isFinite(multiplier) && multiplier > 0 ? multiplier : 1);
  });

  return map;
}

export function getSessionPackageMultiplier(session: SessionLike, packageMultiplierMap: Map<string, number>) {
  const booking = session.bookings;
  const packageRows = booking?.packages;
  const packageRow = Array.isArray(packageRows) ? packageRows[0] : packageRows;
  const directMultiplier = Number(packageRow?.session_multiplier);

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
    (total, session) => total + Number(session.bookings?.ktv_commission ?? DEFAULT_KTV_SESSION_COMMISSION),
    0,
  );
}

export function calculateRatingBonus(
  weightedSessions: number,
  averageRating: number | null,
  salaryConfig: SalaryConfigLike,
) {
  if (averageRating === null) return 0;
  if (averageRating === 5.0) return weightedSessions * salaryConfig.bonus_5_star;
  if (averageRating >= 4.5) return weightedSessions * salaryConfig.bonus_4_5_star;
  if (averageRating >= 4.0) return weightedSessions * salaryConfig.bonus_4_star;
  return 0;
}
