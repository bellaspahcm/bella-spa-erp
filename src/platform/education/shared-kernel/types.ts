/**
 * Education Platform - Shared Kernel Types
 * 
 * Constitution Compliance:
 * - Law 11: No `any` types (strict typing)
 * - Law 1: Student references Person aggregate root
 */

// ============================================================================
// Core Enums
// ============================================================================

export type AcademicStatus = 
  | 'enrolled'      // Currently enrolled
  | 'on_leave'      // Temporarily suspended
  | 'graduated'     // Completed program
  | 'dropped_out'   // Withdrew from program
  | 'expelled';     // Administratively removed

export type EnrollmentType = 
  | 'full_time'
  | 'part_time'
  | 'online'
  | 'hybrid';

// ============================================================================
// Student Domain Types
// ============================================================================

/**
 * Student - represents academic role of a Person
 * References Person for identity (name, DOB, contacts)
 * 
 * R3 CUTOVER: Added party_id (canonical identity)
 * R5.3: personId marked @deprecated (legacy backfill, non-canonical)
 */
export interface Student {
  // Primary key
  studentId: string;
  
  // Tenant isolation
  tenantId: string;
  
  // Party reference (canonical identity) — R3 NEW
  partyId?: string; // Foreign key to party_parties table
  
  /**
   * Person reference (LEGACY backfill — non-canonical)
   * @deprecated Use partyId for canonical identity. This field retained for legacy data backfill only.
   * Production code should NOT rely on this field. Removal planned: R6+.
   * See: E0.1A-R Identity Remediation (R5.3)
   */
  personId: string; // Foreign key to persons table (legacy)
  
  // Student-specific fields
  studentCode: string;      // Unique identifier (e.g., "EDU-2024-001")
  academicStatus: AcademicStatus;
  enrollmentType: EnrollmentType;
  programId: string;        // Which program they're enrolled in
  
  // Academic dates
  enrollmentDate: string;   // ISO 8601 date
  expectedGraduationDate?: string;
  actualGraduationDate?: string;
  
  // Academic info
  currentLevel?: string;    // Year level, grade, semester
  gpa?: number;
  totalCredits?: number;
  
  // Emergency contact (student-specific, separate from Person contacts)
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  
  // Metadata (extensions)
  metadata?: Record<string, unknown>;
  
  // Audit fields
  createdAt: string;        // ISO 8601 timestamp
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Create Student Request
 * R3 CUTOVER: Added partyId (canonical), kept personId (legacy compatibility)
 * R5.3: personId marked @deprecated (compatibility bridge only)
 */
export interface CreateStudentRequest {
  tenantId: string;
  partyId?: string;         // NEW: Canonical Party identity (post-R3)
  
  /**
   * @deprecated Legacy Person FK compatibility. Production code should use partyId instead.
   * Backfilled automatically for legacy data. Removal planned: R6+.
   * See: E0.1A-R Identity Remediation (R5.3)
   */
  personId: string;
  
  studentCode: string;
  academicStatus: AcademicStatus;
  enrollmentType: EnrollmentType;
  programId: string;
  enrollmentDate: string;
  expectedGraduationDate?: string;
  currentLevel?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

/**
 * Update Student Request
 */
export interface UpdateStudentRequest {
  studentId: string;
  tenantId: string;
  academicStatus?: AcademicStatus;
  enrollmentType?: EnrollmentType;
  programId?: string;
  currentLevel?: string;
  gpa?: number;
  totalCredits?: number;
  expectedGraduationDate?: string;
  actualGraduationDate?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelationship?: string;
  metadata?: Record<string, unknown>;
  updatedBy?: string;
}

/**
 * Student with Person data (joined view)
 */
export interface StudentWithPerson extends Student {
  person: {
    firstName: string;
    lastName: string;
    middleName?: string;
    dateOfBirth: string;
    gender: string;
    contacts: Array<{
      type: string;
      value: string;
      isPrimary?: boolean;
    }>;
  };
}

// ============================================================================
// Database Schema Types (Supabase auto-generated format)
// ============================================================================

export interface StudentsTableRow {
  student_id: string;
  tenant_id: string;
  party_id: string | null;  // R3 NEW: canonical identity
  person_id: string;
  student_code: string;
  academic_status: AcademicStatus;
  enrollment_type: EnrollmentType;
  program_id: string;
  enrollment_date: string;
  expected_graduation_date: string | null;
  actual_graduation_date: string | null;
  current_level: string | null;
  gpa: number | null;
  total_credits: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  emergency_contact_relationship: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface StudentsTableInsert {
  student_id?: string;
  tenant_id: string;
  party_id?: string | null; // R3 NEW: canonical identity
  person_id: string;
  student_code: string;
  academic_status: AcademicStatus;
  enrollment_type: EnrollmentType;
  program_id: string;
  enrollment_date: string;
  expected_graduation_date?: string | null;
  actual_graduation_date?: string | null;
  current_level?: string | null;
  gpa?: number | null;
  total_credits?: number | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  metadata?: Record<string, unknown> | null;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
  updated_by?: string | null;
}

export interface StudentsTableUpdate {
  academic_status?: AcademicStatus;
  enrollment_type?: EnrollmentType;
  program_id?: string;
  current_level?: string | null;
  gpa?: number | null;
  total_credits?: number | null;
  expected_graduation_date?: string | null;
  actual_graduation_date?: string | null;
  emergency_contact_name?: string | null;
  emergency_contact_phone?: string | null;
  emergency_contact_relationship?: string | null;
  metadata?: Record<string, unknown> | null;
  updated_at?: string;
  updated_by?: string | null;
}
