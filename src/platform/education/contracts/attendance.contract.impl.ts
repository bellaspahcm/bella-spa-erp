import { IEducationAttendanceContract, RecordAttendanceInput, EducationAttendanceDTO } from './attendance.contract';
import { AttendanceService } from '../attendance/attendance.service';
import { EnrollmentService } from '../enrollment/enrollment.service';

export class AttendanceContractImpl implements IEducationAttendanceContract {
  public async recordAttendance(input: RecordAttendanceInput): Promise<EducationAttendanceDTO> {
    // 1. Resolve enrollment details
    const enrollment = await EnrollmentService.getEnrollmentById(input.enrollmentId, input.tenantId);
    if (!enrollment) {
      throw new Error(`Enrollment ${input.enrollmentId} not found`);
    }

    // 2. Record attendance
    const result = await AttendanceService.recordAttendance({
      tenantId: input.tenantId,
      studentId: enrollment.studentId,
      courseId: enrollment.courseId,
      sessionDate: input.rollCallTime ? input.rollCallTime.split('T')[0] : new Date().toISOString().split('T')[0],
      status: input.status,
      createdBy: '00000000-0000-0000-0000-000000000001',
    });

    if (!result.success || !result.attendance) {
      throw new Error(result.error || 'Failed to record attendance');
    }

    return {
      id: result.attendance.attendanceId,
      tenantId: result.attendance.tenantId,
      enrollmentId: enrollment.enrollmentId,
      status: result.attendance.status === 'late' ? 'present' : (result.attendance.status as 'present' | 'absent' | 'excused'),
      rollCallTime: result.attendance.sessionDate,
    };
  }

  public async getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]> {
    const result = await AttendanceService.queryAttendances({
      tenantId,
      enrollmentId,
    });

    if (!result.success) {
      return [];
    }

    return result.attendances.map(att => ({
      id: att.attendanceId,
      tenantId: att.tenantId,
      enrollmentId: enrollmentId,
      status: att.status === 'late' ? 'present' : (att.status as 'present' | 'absent' | 'excused'),
      rollCallTime: att.sessionDate,
    }));
  }
}
