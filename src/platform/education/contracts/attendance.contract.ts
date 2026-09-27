/**
 * Education OS — Attendance public contract interface
 */
export type EducationAttendanceStatus = 'present' | 'absent' | 'excused';

export interface EducationAttendanceDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly status: EducationAttendanceStatus;
  readonly rollCallTime: string;
}

export interface RecordAttendanceInput {
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly status: EducationAttendanceStatus;
  readonly rollCallTime?: string;
}

export interface SetDailyAttendanceInput extends RecordAttendanceInput {}

export interface EducationDailyAttendanceStateDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly schoolDay: string;
  readonly status: EducationAttendanceStatus;
  readonly eventId?: string;
  readonly rollCallTime?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface GetCourseDailyAttendanceInput {
  readonly tenantId: string;
  readonly courseId: string;
  readonly schoolDay: string;
}

export interface CourseDailyAttendanceRosterItem {
  readonly enrollmentId: string;
  readonly studentId: string;
  readonly studentPartyId: string;
  readonly studentCode: string | null;
  readonly name: string;
  readonly gender: string | null;
  readonly dob: string | null;
  readonly enrollmentStatus: string;
  readonly attendance: EducationDailyAttendanceStateDTO | null;
}

export interface IEducationAttendanceContract {
  recordAttendance(input: RecordAttendanceInput): Promise<EducationAttendanceDTO>;
  getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]>;
  setDailyAttendance(input: SetDailyAttendanceInput): Promise<EducationDailyAttendanceStateDTO>;
  getCourseDailyAttendance(input: GetCourseDailyAttendanceInput): Promise<readonly CourseDailyAttendanceRosterItem[]>;
}
