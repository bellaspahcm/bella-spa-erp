/**
 * Attendance Aggregate
 * 
 * Business rules for Attendance entity
 * 
 * Pattern: Inherited from Course aggregate
 */

import {
  Attendance,
  AttendanceStatus,
  CreateAttendanceRequest,
  UpdateAttendanceRequest,
  AttendanceSummary,
} from '../shared-kernel/attendance-types';

// ============================================================================
// Attendance Aggregate Functions
// ============================================================================

/**
 * Record attendance
 */
export function recordAttendance(request: CreateAttendanceRequest): Attendance {
  // Validation
  if (!request.studentId || request.studentId.trim().length === 0) {
    throw new Error('Student ID is required');
  }
  
  if (!request.courseId || request.courseId.trim().length === 0) {
    throw new Error('Course ID is required');
  }
  
  if (!request.sessionDate) {
    throw new Error('Session date is required');
  }
  
  // Validate session date is not in future (unless it's pre-marking)
  const sessionDate = new Date(request.sessionDate);
  const now = new Date();
  if (sessionDate > now && request.status !== 'pending') {
    throw new Error('Cannot mark attendance for future sessions');
  }
  
  // Validate late minutes
  if (request.minutesLate !== undefined && request.minutesLate < 0) {
    throw new Error('Late minutes cannot be negative');
  }
  
  // Auto-set minutesLate if status is 'late' and not provided
  if (request.status === 'late' && request.minutesLate === undefined) {
    request.minutesLate = 0;
  }
  
  // Validate check-in/check-out times
  if (request.checkInTime && request.checkOutTime) {
    const checkIn = new Date(request.checkInTime);
    const checkOut = new Date(request.checkOutTime);
    if (checkOut <= checkIn) {
      throw new Error('Check-out time must be after check-in time');
    }
  }
  
  const now_iso = new Date().toISOString();
  
  return {
    attendanceId: '', // Will be set by database
    tenantId: request.tenantId,
    studentId: request.studentId,
    courseId: request.courseId,
    enrollmentId: request.enrollmentId,
    sessionDate: request.sessionDate,
    sessionNumber: request.sessionNumber,
    sessionType: request.sessionType,
    sessionDuration: request.sessionDuration,
    status: request.status,
    checkInTime: request.checkInTime,
    checkOutTime: request.checkOutTime,
    minutesLate: request.minutesLate,
    notes: request.notes,
    createdAt: now_iso,
    updatedAt: now_iso,
    createdBy: request.createdBy,
  };
}

/**
 * Update attendance
 */
export function updateAttendance(
  existing: Attendance,
  request: UpdateAttendanceRequest
): Attendance {
  // Tenant isolation check
  if (existing.tenantId !== request.tenantId) {
    throw new Error('Cannot update attendance from different tenant');
  }
  
  // Validate late minutes
  if (request.minutesLate !== undefined && request.minutesLate < 0) {
    throw new Error('Late minutes cannot be negative');
  }
  
  // Validate check-in/check-out times
  const checkInTime = request.checkInTime ?? existing.checkInTime;
  const checkOutTime = request.checkOutTime ?? existing.checkOutTime;
  
  if (checkInTime && checkOutTime) {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    if (checkOut <= checkIn) {
      throw new Error('Check-out time must be after check-in time');
    }
  }
  
  return {
    ...existing,
    status: request.status ?? existing.status,
    checkInTime: request.checkInTime ?? existing.checkInTime,
    checkOutTime: request.checkOutTime ?? existing.checkOutTime,
    minutesLate: request.minutesLate ?? existing.minutesLate,
    notes: request.notes ?? existing.notes,
    excuseReason: request.excuseReason ?? existing.excuseReason,
    excuseDocumentUrl: request.excuseDocumentUrl ?? existing.excuseDocumentUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: request.updatedBy,
  };
}

/**
 * Mark as present
 */
export function markPresent(attendance: Attendance, userId: string, checkInTime?: string): Attendance {
  if (attendance.status === 'present') {
    throw new Error('Attendance already marked as present');
  }
  
  return {
    ...attendance,
    status: 'present',
    checkInTime: checkInTime ?? new Date().toISOString(),
    minutesLate: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Mark as absent
 */
export function markAbsent(attendance: Attendance, userId: string, notes?: string): Attendance {
  if (attendance.status === 'absent') {
    throw new Error('Attendance already marked as absent');
  }
  
  return {
    ...attendance,
    status: 'absent',
    notes: notes ?? attendance.notes,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Mark as late
 */
export function markLate(
  attendance: Attendance,
  userId: string,
  minutesLate: number,
  checkInTime?: string
): Attendance {
  if (minutesLate < 0) {
    throw new Error('Late minutes cannot be negative');
  }
  
  if (attendance.status === 'late' && attendance.minutesLate === minutesLate) {
    throw new Error('Attendance already marked as late with same minutes');
  }
  
  return {
    ...attendance,
    status: 'late',
    minutesLate,
    checkInTime: checkInTime ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Mark as excused (with reason)
 */
export function markExcused(
  attendance: Attendance,
  userId: string,
  excuseReason: string,
  excuseDocumentUrl?: string
): Attendance {
  if (!excuseReason || excuseReason.trim().length === 0) {
    throw new Error('Excuse reason is required');
  }
  
  return {
    ...attendance,
    status: 'excused',
    excuseReason: excuseReason.trim(),
    excuseDocumentUrl,
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Verify attendance (by instructor/admin)
 */
export function verifyAttendance(attendance: Attendance, userId: string): Attendance {
  if (attendance.verifiedBy) {
    throw new Error('Attendance already verified');
  }
  
  if (attendance.status === 'pending') {
    throw new Error('Cannot verify pending attendance');
  }
  
  return {
    ...attendance,
    verifiedBy: userId,
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    updatedBy: userId,
  };
}

/**
 * Calculate attendance summary for a student in a course
 */
export function calculateAttendanceSummary(
  studentId: string,
  courseId: string,
  attendances: Attendance[]
): AttendanceSummary {
  const relevantAttendances = attendances.filter(
    a => a.studentId === studentId && a.courseId === courseId && a.status !== 'pending'
  );
  
  const totalSessions = relevantAttendances.length;
  const presentCount = relevantAttendances.filter(a => a.status === 'present').length;
  const absentCount = relevantAttendances.filter(a => a.status === 'absent').length;
  const lateCount = relevantAttendances.filter(a => a.status === 'late').length;
  const excusedCount = relevantAttendances.filter(a => a.status === 'excused').length;
  
  // Calculate attendance rate: (present + late + excused) / total
  const attendedCount = presentCount + lateCount + excusedCount;
  const attendanceRate = totalSessions > 0 ? (attendedCount / totalSessions) * 100 : 0;
  
  return {
    studentId,
    courseId,
    totalSessions,
    presentCount,
    absentCount,
    lateCount,
    excusedCount,
    attendanceRate: Math.round(attendanceRate * 100) / 100, // Round to 2 decimal places
  };
}

/**
 * Check if student meets minimum attendance requirement
 */
export function meetsAttendanceRequirement(
  summary: AttendanceSummary,
  minimumPercentage: number
): boolean {
  if (minimumPercentage < 0 || minimumPercentage > 100) {
    throw new Error('Minimum percentage must be between 0 and 100');
  }
  
  return summary.attendanceRate >= minimumPercentage;
}

/**
 * Check if attendance can be modified
 */
export function canModifyAttendance(attendance: Attendance): boolean {
  // Cannot modify if already verified
  if (attendance.verifiedBy) {
    return false;
  }
  
  // Cannot modify attendance for sessions older than 7 days (business rule)
  const sessionDate = new Date(attendance.sessionDate);
  const now = new Date();
  const daysSince = (now.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24);
  
  return daysSince <= 7;
}
