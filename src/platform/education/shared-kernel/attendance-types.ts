/**
 * Attendance Domain Types
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types (strict typing)
 * 
 * Pattern: Inherited from Student/Enrollment/Course
 */

// ============================================================================
// Core Enums
// ============================================================================

export type AttendanceStatus =
  | 'present'       // Student attended
  | 'absent'        // Student did not attend
  | 'late'          // Student arrived late
  | 'excused'       // Absent with valid excuse
  | 'pending';      // Not yet recorded

export type SessionType =
  | 'lecture'
  | 'lab'
  | 'tutorial'
  | 'exam'
  | 'workshop'
  | 'seminar';

// ============================================================================
// Attendance Domain Types
// ============================================================================

/**
 * Attendance - represents student attendance at a course session
 */
export interface Attendance {
  // Primary key
  attendanceId: string;
  
  // Tenant isolation
  tenantId: string;
  
  // Foreign keys
  studentId: string;    // References students table
  courseId: string;     // References courses table
  enrollmentId?: string; // Optional reference to enrollment
  
  // Session details
  sessionDate: string;  // ISO 8601 date
  sessionNumber?: number; // Session sequence (1, 2, 3...)
  sessionType?: SessionType;
  sessionDuration?: number; // Minutes
  
  // Attendance tracking
  status: AttendanceStatus;
  checkInTime?: string;  // ISO 8601 timestamp
  checkOutTime?: string; // ISO 8601 timestamp
  minutesLate?: number;  // For late arrivals
  
  // Notes and excuses
  notes?: string;
  excuseReason?: string;
  excuseDocumentUrl?: string;
  
  // Verification
  verifiedBy?: string;   // User UUID who verified
  verifiedAt?: string;   // ISO 8601 timestamp
  
  // Metadata
  metadata?: Record<string, unknown>;
  
  // Audit fields
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy?: string;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Create Attendance Request
 */
export interface CreateAttendanceRequest {
  tenantId: string;
  studentId: string;
  courseId: string;
  enrollmentId?: string;
  sessionDate: string;
  sessionNumber?: number;
  sessionType?: SessionType;
  sessionDuration?: number;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  minutesLate?: number;
  notes?: string;
  createdBy: string;
}

/**
 * Update Attendance Request
 */
export interface UpdateAttendanceRequest {
  attendanceId: string;
  tenantId: string;
  status?: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  minutesLate?: number;
  notes?: string;
  excuseReason?: string;
  excuseDocumentUrl?: string;
  updatedBy: string;
}

/**
 * Mark Attendance Request (bulk operation)
 */
export interface MarkAttendanceRequest {
  tenantId: string;
  courseId: string;
  sessionDate: string;
  sessionNumber?: number;
  studentAttendance: Array<{
    studentId: string;
    status: AttendanceStatus;
    checkInTime?: string;
    minutesLate?: number;
    notes?: string;
  }>;
  createdBy: string;
}

/**
 * Attendance Query Filters
 */
export interface AttendanceFilters {
  tenantId: string;
  studentId?: string;
  courseId?: string;
  enrollmentId?: string;
  status?: AttendanceStatus;
  sessionDateFrom?: string;
  sessionDateTo?: string;
  sessionType?: SessionType;
}

// ============================================================================
// Attendance Result Types
// ============================================================================

export interface AttendanceResult {
  success: boolean;
  attendance?: Attendance;
  error?: string;
}

export interface AttendanceListResult {
  success: boolean;
  attendances: Attendance[];
  total: number;
  error?: string;
}

/**
 * Attendance Summary (for reports)
 */
export interface AttendanceSummary {
  studentId: string;
  courseId: string;
  totalSessions: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  excusedCount: number;
  attendanceRate: number; // Percentage (0-100)
}
