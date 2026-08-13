/**
 * Education OS — Attendance public contract interface
 */
export interface EducationAttendanceDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly status: 'present' | 'absent' | 'excused';
  readonly rollCallTime: string;
}

export interface RecordAttendanceInput {
  readonly tenantId: string;
  readonly enrollmentId: string;
  readonly status: 'present' | 'absent' | 'excused';
  readonly rollCallTime?: string;
}

export interface IEducationAttendanceContract {
  recordAttendance(input: RecordAttendanceInput): Promise<EducationAttendanceDTO>;
  getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]>;
}
