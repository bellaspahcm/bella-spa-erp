/**
 * Education Attendance Contract
 * 
 * Contract definition for Attendance operations in Education Platform.
 * Defines API endpoints, events, and schemas for attendance tracking.
 * 
 * @module platform/education/contracts/attendance
 */

// ============================================================================
// DTOs
// ============================================================================

export interface EducationAttendanceDTO {
  id: string;
  tenantId: string;
  enrollmentId: string;
  sessionDate: string;
  status: 'present' | 'absent' | 'late' | 'excused';
  notes?: string;
  recordedAt: string;
  recordedBy: string;
}

// ============================================================================
// Contract Interface
// ============================================================================

export interface IEducationAttendanceContract {
  /**
   * Record attendance for a session
   */
  recordAttendance(request: {
    tenantId: string;
    enrollmentId: string;
    sessionDate: string;
    status: 'present' | 'absent' | 'late' | 'excused';
    notes?: string;
  }): Promise<{ success: boolean; data?: EducationAttendanceDTO; error?: string }>;

  /**
   * Get attendance records for an enrollment
   */
  getAttendance(request: {
    tenantId: string;
    enrollmentId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data?: EducationAttendanceDTO[]; error?: string }>;

  /**
   * Calculate attendance rate
   */
  calculateAttendanceRate(request: {
    tenantId: string;
    enrollmentId: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{ success: boolean; data?: { rate: number }; error?: string }>;
}
