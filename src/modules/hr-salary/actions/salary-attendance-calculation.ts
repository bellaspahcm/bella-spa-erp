type AttendanceLike = {
  status: string | null;
};

export const STANDARD_SALARY_WORK_DAYS = 26;

export function calculateAttendanceWorkDays(attendanceList: AttendanceLike[]) {
  return attendanceList.reduce((total, attendance) => {
    if (attendance.status === 'present' || attendance.status === 'late') {
      return total + 1;
    }

    if (attendance.status === 'half_day') {
      return total + 0.5;
    }

    return total;
  }, 0);
}

export function calculateProRataBaseSalaryFromActualDays(baseSalary: number, actualDays: number) {
  return Math.round((baseSalary / STANDARD_SALARY_WORK_DAYS) * actualDays);
}
