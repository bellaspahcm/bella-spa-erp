export type AttendanceLike = {
  status?: string | null;
};

export type AttendanceStatusValue = 'present' | 'late' | 'absent' | 'half_day';
export type StaffLeaveType = 'full_day' | 'morning' | 'afternoon';

export type AttendancePenaltyConfig = {
  lateDays?: number | string | null;
  absentDays?: number | string | null;
  penaltyLatePerDay?: number | string | null;
  penaltyAbsentPerDay?: number | string | null;
};

export const STANDARD_SALARY_WORK_DAYS = 26;
export const DEFAULT_PENALTY_LATE_PER_DAY = 50000;
export const DEFAULT_PENALTY_ABSENT_PER_DAY = 200000;
export const DEFAULT_LATE_CHECKIN_CUTOFF = '08:30:00';

export const ATTENDANCE_STATUSES: Record<Uppercase<AttendanceStatusValue>, AttendanceStatusValue> = {
  PRESENT: 'present',
  LATE: 'late',
  ABSENT: 'absent',
  HALF_DAY: 'half_day',
};

function asFiniteNumber(value: number | string | null | undefined, fallback = 0) {
  const numeric = Number(value ?? fallback);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeAttendanceStatus(status: string | null | undefined): AttendanceStatusValue {
  const normalized = String(status ?? '').trim().toLowerCase();
  if (
    normalized === ATTENDANCE_STATUSES.PRESENT ||
    normalized === ATTENDANCE_STATUSES.LATE ||
    normalized === ATTENDANCE_STATUSES.ABSENT ||
    normalized === ATTENDANCE_STATUSES.HALF_DAY
  ) {
    return normalized;
  }
  return ATTENDANCE_STATUSES.PRESENT;
}

export function calculateCheckInAttendanceStatus(input: {
  localTime: string;
  lateCutoff?: string;
}): AttendanceStatusValue {
  const localTime = String(input.localTime || '').trim();
  const lateCutoff = String(input.lateCutoff || DEFAULT_LATE_CHECKIN_CUTOFF).trim();
  return localTime > lateCutoff ? ATTENDANCE_STATUSES.LATE : ATTENDANCE_STATUSES.PRESENT;
}

export function getLeaveAttendanceStatus(leaveType: StaffLeaveType | string | null | undefined): AttendanceStatusValue {
  const normalized = String(leaveType ?? '').trim().toLowerCase();
  return normalized === 'full_day' ? ATTENDANCE_STATUSES.ABSENT : ATTENDANCE_STATUSES.HALF_DAY;
}

export function buildAttendanceTimestamp(input: string | null | undefined) {
  if (!input) return null;
  const withTimezone = input.includes('+') || input.includes('Z') ? input : `${input}+07:00`;
  return new Date(withTimezone).toISOString();
}

export function calculateAttendanceBreakdown(attendanceList: AttendanceLike[]) {
  return attendanceList.reduce(
    (summary, attendance) => {
      const status = normalizeAttendanceStatus(attendance.status);
      if (status === ATTENDANCE_STATUSES.PRESENT) {
        summary.present += 1;
        summary.workDays += 1;
      } else if (status === ATTENDANCE_STATUSES.LATE) {
        summary.late += 1;
        summary.workDays += 1;
      } else if (status === ATTENDANCE_STATUSES.HALF_DAY) {
        summary.halfDay += 1;
        summary.workDays += 0.5;
      } else if (status === ATTENDANCE_STATUSES.ABSENT) {
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
