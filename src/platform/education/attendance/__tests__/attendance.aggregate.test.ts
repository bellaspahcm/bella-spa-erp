/**
 * Attendance Aggregate Unit Tests
 * 
 * Pattern: Inherited from Course unit tests
 */

import {
  recordAttendance,
  updateAttendance,
  markPresent,
  markAbsent,
  markLate,
  markExcused,
  verifyAttendance,
  calculateAttendanceSummary,
  meetsAttendanceRequirement,
  canModifyAttendance,
} from '../attendance.aggregate';
import type { Attendance, CreateAttendanceRequest, UpdateAttendanceRequest } from '../../shared-kernel/attendance-types';

const TEST_TENANT_UUID = '00000000-0000-0000-0000-000000000088';
const TEST_USER_UUID = '00000000-0000-0000-0000-000000000001';
const TEST_STUDENT_UUID = '00000000-0000-0000-0000-000000000002';
const TEST_COURSE_UUID = '00000000-0000-0000-0000-000000000003';

describe('Attendance Aggregate', () => {
  describe('recordAttendance', () => {
    it('should record present attendance', () => {
      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        checkInTime: '2024-09-01T09:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const attendance = recordAttendance(request);

      expect(attendance.tenantId).toBe(TEST_TENANT_UUID);
      expect(attendance.studentId).toBe(TEST_STUDENT_UUID);
      expect(attendance.courseId).toBe(TEST_COURSE_UUID);
      expect(attendance.status).toBe('present');
    });

    it('should reject empty student ID', () => {
      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: '',
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        createdBy: TEST_USER_UUID,
      };

      expect(() => recordAttendance(request)).toThrow('Student ID is required');
    });

    it('should reject empty course ID', () => {
      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: '',
        sessionDate: '2024-09-01',
        status: 'present',
        createdBy: TEST_USER_UUID,
      };

      expect(() => recordAttendance(request)).toThrow('Course ID is required');
    });

    it('should reject attendance for future sessions', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: futureDate.toISOString().split('T')[0],
        status: 'present',
        createdBy: TEST_USER_UUID,
      };

      expect(() => recordAttendance(request)).toThrow('Cannot mark attendance for future sessions');
    });

    it('should allow pending attendance for future sessions', () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 1);

      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: futureDate.toISOString().split('T')[0],
        status: 'pending',
        createdBy: TEST_USER_UUID,
      };

      const attendance = recordAttendance(request);
      expect(attendance.status).toBe('pending');
    });

    it('should auto-set minutesLate to 0 for late status if not provided', () => {
      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'late',
        createdBy: TEST_USER_UUID,
      };

      const attendance = recordAttendance(request);
      expect(attendance.minutesLate).toBe(0);
    });

    it('should reject negative late minutes', () => {
      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'late',
        minutesLate: -5,
        createdBy: TEST_USER_UUID,
      };

      expect(() => recordAttendance(request)).toThrow('Late minutes cannot be negative');
    });

    it('should reject check-out before check-in', () => {
      const request: CreateAttendanceRequest = {
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        checkInTime: '2024-09-01T10:00:00Z',
        checkOutTime: '2024-09-01T09:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => recordAttendance(request)).toThrow('Check-out time must be after check-in time');
    });
  });

  describe('updateAttendance', () => {
    const existingAttendance: Attendance = {
      attendanceId: 'att-1',
      tenantId: TEST_TENANT_UUID,
      studentId: TEST_STUDENT_UUID,
      courseId: TEST_COURSE_UUID,
      sessionDate: '2024-09-01',
      status: 'present',
      createdAt: '2024-09-01T00:00:00Z',
      updatedAt: '2024-09-01T00:00:00Z',
      createdBy: TEST_USER_UUID,
    };

    it('should update attendance status', () => {
      const request: UpdateAttendanceRequest = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        status: 'late',
        minutesLate: 10,
        updatedBy: TEST_USER_UUID,
      };

      const updated = updateAttendance(existingAttendance, request);

      expect(updated.status).toBe('late');
      expect(updated.minutesLate).toBe(10);
    });

    it('should reject update from different tenant', () => {
      const request: UpdateAttendanceRequest = {
        attendanceId: 'att-1',
        tenantId: '99999999-9999-9999-9999-999999999999',
        status: 'absent',
        updatedBy: TEST_USER_UUID,
      };

      expect(() => updateAttendance(existingAttendance, request)).toThrow('Cannot update attendance from different tenant');
    });
  });

  describe('markPresent', () => {
    it('should mark attendance as present', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'pending',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const marked = markPresent(attendance, TEST_USER_UUID);

      expect(marked.status).toBe('present');
      expect(marked.checkInTime).toBeDefined();
      expect(marked.minutesLate).toBe(0);
    });

    it('should reject marking already-present attendance', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => markPresent(attendance, TEST_USER_UUID)).toThrow('Attendance already marked as present');
    });
  });

  describe('markAbsent', () => {
    it('should mark attendance as absent', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'pending',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const marked = markAbsent(attendance, TEST_USER_UUID, 'No show');

      expect(marked.status).toBe('absent');
      expect(marked.notes).toBe('No show');
    });
  });

  describe('markLate', () => {
    it('should mark attendance as late', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'pending',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const marked = markLate(attendance, TEST_USER_UUID, 15);

      expect(marked.status).toBe('late');
      expect(marked.minutesLate).toBe(15);
    });

    it('should reject negative late minutes', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'pending',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => markLate(attendance, TEST_USER_UUID, -5)).toThrow('Late minutes cannot be negative');
    });
  });

  describe('markExcused', () => {
    it('should mark attendance as excused with reason', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'absent',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const marked = markExcused(attendance, TEST_USER_UUID, 'Medical leave', 'https://example.com/doc.pdf');

      expect(marked.status).toBe('excused');
      expect(marked.excuseReason).toBe('Medical leave');
      expect(marked.excuseDocumentUrl).toBe('https://example.com/doc.pdf');
    });

    it('should reject empty excuse reason', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'absent',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => markExcused(attendance, TEST_USER_UUID, '')).toThrow('Excuse reason is required');
    });
  });

  describe('verifyAttendance', () => {
    it('should verify attendance', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      const verified = verifyAttendance(attendance, TEST_USER_UUID);

      expect(verified.verifiedBy).toBe(TEST_USER_UUID);
      expect(verified.verifiedAt).toBeDefined();
    });

    it('should reject verifying already-verified attendance', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        verifiedBy: TEST_USER_UUID,
        verifiedAt: '2024-09-01T10:00:00Z',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => verifyAttendance(attendance, TEST_USER_UUID)).toThrow('Attendance already verified');
    });

    it('should reject verifying pending attendance', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'pending',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(() => verifyAttendance(attendance, TEST_USER_UUID)).toThrow('Cannot verify pending attendance');
    });
  });

  describe('calculateAttendanceSummary', () => {
    it('should calculate attendance summary correctly', () => {
      const attendances: Attendance[] = [
        {
          attendanceId: '1',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-01',
          status: 'present',
          createdAt: '2024-09-01T00:00:00Z',
          updatedAt: '2024-09-01T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
        {
          attendanceId: '2',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-02',
          status: 'present',
          createdAt: '2024-09-02T00:00:00Z',
          updatedAt: '2024-09-02T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
        {
          attendanceId: '3',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-03',
          status: 'absent',
          createdAt: '2024-09-03T00:00:00Z',
          updatedAt: '2024-09-03T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
        {
          attendanceId: '4',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-04',
          status: 'late',
          createdAt: '2024-09-04T00:00:00Z',
          updatedAt: '2024-09-04T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
        {
          attendanceId: '5',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-05',
          status: 'excused',
          createdAt: '2024-09-05T00:00:00Z',
          updatedAt: '2024-09-05T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
      ];

      const summary = calculateAttendanceSummary(TEST_STUDENT_UUID, TEST_COURSE_UUID, attendances);

      expect(summary.totalSessions).toBe(5);
      expect(summary.presentCount).toBe(2);
      expect(summary.absentCount).toBe(1);
      expect(summary.lateCount).toBe(1);
      expect(summary.excusedCount).toBe(1);
      expect(summary.attendanceRate).toBe(80); // (2+1+1)/5 * 100
    });

    it('should exclude pending attendances from summary', () => {
      const attendances: Attendance[] = [
        {
          attendanceId: '1',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-01',
          status: 'present',
          createdAt: '2024-09-01T00:00:00Z',
          updatedAt: '2024-09-01T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
        {
          attendanceId: '2',
          tenantId: TEST_TENANT_UUID,
          studentId: TEST_STUDENT_UUID,
          courseId: TEST_COURSE_UUID,
          sessionDate: '2024-09-02',
          status: 'pending',
          createdAt: '2024-09-02T00:00:00Z',
          updatedAt: '2024-09-02T00:00:00Z',
          createdBy: TEST_USER_UUID,
        },
      ];

      const summary = calculateAttendanceSummary(TEST_STUDENT_UUID, TEST_COURSE_UUID, attendances);

      expect(summary.totalSessions).toBe(1);
      expect(summary.attendanceRate).toBe(100);
    });
  });

  describe('meetsAttendanceRequirement', () => {
    it('should return true if attendance rate meets requirement', () => {
      const summary = {
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        totalSessions: 10,
        presentCount: 8,
        absentCount: 2,
        lateCount: 0,
        excusedCount: 0,
        attendanceRate: 80,
      };

      expect(meetsAttendanceRequirement(summary, 75)).toBe(true);
    });

    it('should return false if attendance rate does not meet requirement', () => {
      const summary = {
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        totalSessions: 10,
        presentCount: 6,
        absentCount: 4,
        lateCount: 0,
        excusedCount: 0,
        attendanceRate: 60,
      };

      expect(meetsAttendanceRequirement(summary, 75)).toBe(false);
    });
  });

  describe('canModifyAttendance', () => {
    it('should return false if attendance is verified', () => {
      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: '2024-09-01',
        status: 'present',
        verifiedBy: TEST_USER_UUID,
        verifiedAt: '2024-09-01T10:00:00Z',
        createdAt: '2024-09-01T00:00:00Z',
        updatedAt: '2024-09-01T00:00:00Z',
        createdBy: TEST_USER_UUID,
      };

      expect(canModifyAttendance(attendance)).toBe(false);
    });

    it('should return false if attendance is older than 7 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);

      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: oldDate.toISOString().split('T')[0],
        status: 'present',
        createdAt: oldDate.toISOString(),
        updatedAt: oldDate.toISOString(),
        createdBy: TEST_USER_UUID,
      };

      expect(canModifyAttendance(attendance)).toBe(false);
    });

    it('should return true if attendance is recent and unverified', () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 2);

      const attendance: Attendance = {
        attendanceId: 'att-1',
        tenantId: TEST_TENANT_UUID,
        studentId: TEST_STUDENT_UUID,
        courseId: TEST_COURSE_UUID,
        sessionDate: recentDate.toISOString().split('T')[0],
        status: 'present',
        createdAt: recentDate.toISOString(),
        updatedAt: recentDate.toISOString(),
        createdBy: TEST_USER_UUID,
      };

      expect(canModifyAttendance(attendance)).toBe(true);
    });
  });
});
