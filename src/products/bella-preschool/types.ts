/**
 * Bella Preschool — Type Definitions
 *
 * TypeScript interfaces for preschool management domain
 */

// ============================================================================
// Database Types (matching schema)
// ============================================================================

export interface PreschoolStudent {
  id: string;
  tenant_id: string;
  student_code: string;
  first_name: string;
  last_name: string;
  date_of_birth: string; // ISO date string
  gender: 'male' | 'female' | 'other' | null;
  enrollment_date: string;
  status: 'active' | 'withdrawn' | 'graduated';
  photo_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PreschoolStudentGuardian {
  id: string;
  tenant_id: string;
  student_id: string;
  guardian_customer_id: string;
  relationship_type: 'parent' | 'grandparent' | 'guardian' | 'other';
  is_primary_contact: boolean;
  is_authorized_pickup: boolean;
  is_emergency_contact: boolean;
  created_at: string;
  updated_at: string;
}

export interface PreschoolClassroom {
  id: string;
  tenant_id: string;
  classroom_name: string;
  classroom_code: string | null;
  age_group: string | null;
  capacity: number | null;
  lead_teacher_id: string | null;
  assistant_teacher_id: string | null;
  is_active: boolean;
  room_location: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PreschoolEnrollment {
  id: string;
  tenant_id: string;
  student_id: string;
  classroom_id: string;
  enrollment_date: string;
  end_date: string | null;
  status: 'active' | 'transferred' | 'completed' | 'withdrawn';
  created_at: string;
  updated_at: string;
}

export interface PreschoolAttendance {
  id: string;
  tenant_id: string;
  student_id: string;
  attendance_date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  checked_in_by_user_id: string | null;
  checked_out_by_user_id: string | null;
  picked_up_by_guardian_id: string | null;
  status: 'absent' | 'checked_in' | 'checked_out';
  absence_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// Detail Types (with joins)
// ============================================================================

export interface StudentDetail extends PreschoolStudent {
  guardians?: Array<{
    id: string;
    relationship_type: string;
    is_primary_contact: boolean;
    is_authorized_pickup: boolean;
    guardian: {
      id: string;
      name_mother: string;
      phone: string;
    };
  }>;
  current_classroom?: {
    id: string;
    classroom_name: string;
    age_group: string | null;
  };
}

export interface ClassroomDetail extends PreschoolClassroom {
  enrolled_students?: PreschoolStudent[];
  enrollment_count?: number;
  lead_teacher?: {
    id: string;
    full_name: string;
  };
  assistant_teacher?: {
    id: string;
    full_name: string;
  };
}

export interface AttendanceDetail extends PreschoolAttendance {
  student?: {
    id: string;
    student_code: string;
    first_name: string;
    last_name: string;
  };
}

// ============================================================================
// Action Result Pattern (from Platform)
// ============================================================================

export interface ActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Export types for external use
export type {
  PreschoolStudent as Student,
  PreschoolClassroom as Classroom,
  PreschoolAttendance as Attendance,
};

