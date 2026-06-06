export type AttendanceLike = {
  status?: string | null;
};

export type AttendancePenaltyConfig = {
  lateDays?: number | string | null;
  absentDays?: number | string | null;
  penaltyLatePerDay?: number | string | null;
  penaltyAbsentPerDay?: number | string | null;
};

export const STANDARD_SALARY_WORK_DAYS = 26;
export const DEFAULT_PENALTY_LATE_PER_DAY = 50000;
export const DEFAULT_PENALTY_ABSENT_PER_DAY = 200000;

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function normalizeAttendanceStatus(status: string | null | undefined) {
  return String(status ?? '').trim().toLowerCase();
}

export function calculateAttendanceBreakdown(attendanceList: AttendanceLike[]) {
  return attendanceList.reduce(
    (summary, attendance) => {
      const status = normalizeAttendanceStatus(attendance.status);
      if (status === 'present') {
        summary.present += 1;
        summary.workDays += 1;
      } else if (status === 'late') {
        summary.late += 1;
        summary.workDays += 1;
      } else if (status === 'half_day') {
        summary.halfDay += 1;
        summary.workDays += 0.5;
      } else if (status === 'absent') {
        summary.absent += 1;
      }
      return summary;
    },
    { present: 0, late: 0, absent: 0, halfDay: 0, workDays: 0 },
  );
}

export function calculateAttendanceWorkDays(attendanceList: AttendanceLike[]) {
  return calculateAttendanceBreakdown(attendanceList).workDays;
}

export function calculateProRataBaseSalaryFromActualDays(baseSalary: number, actualDays: number) {
  return Math.round((baseSalary / STANDARD_SALARY_WORK_DAYS) * actualDays);
}

export function calculateAttendancePenalty(input: AttendancePenaltyConfig) {
  const lateDays = Math.max(0, asFiniteNumber(input.lateDays));
  const absentDays = Math.max(0, asFiniteNumber(input.absentDays));
  const penaltyLatePerDay = Math.max(
    0,
    asFiniteNumber(input.penaltyLatePerDay, DEFAULT_PENALTY_LATE_PER_DAY),
  );
  const penaltyAbsentPerDay = Math.max(
    0,
    asFiniteNumber(input.penaltyAbsentPerDay, DEFAULT_PENALTY_ABSENT_PER_DAY),
  );

  return {
    lateDays,
    absentDays,
    penaltyLatePerDay,
    penaltyAbsentPerDay,
    totalPenalty: (lateDays * penaltyLatePerDay) + (absentDays * penaltyAbsentPerDay),
  };
}
