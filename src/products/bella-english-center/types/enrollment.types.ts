/**
 * E2 — English Center Enrollment Types
 * Architecture: Product extension consuming Platform Education Enrollment Contract
 */

import { EducationEnrollmentDTO } from '@/platform/education/contracts/enrollment.contract';

/**
 * English Center enrollment extension data
 */
export interface EnglishCenterEnrollment {
  readonly id: string;
  readonly tenantId: string;
  readonly canonicalEnrollmentId: string;
  readonly branchId: string;
  readonly programId: string | null;
  readonly classId: string | null;
  readonly intake: string | null;
  readonly englishLevelAtEnrollment: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/**
 * Combined view: canonical enrollment + English Center extension
 */
export interface EnglishCenterEnrollmentView extends EnglishCenterEnrollment {
  readonly enrollmentStatus: 'pending' | 'active' | 'completed' | 'cancelled';
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly enrolledAt: string;
}

/**
 * Create English Center enrollment input
 */
export interface CreateEnglishEnrollmentInput {
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly branchId: string;
  readonly programId?: string;
  readonly classId?: string;
  readonly intake?: string;
  readonly englishLevelAtEnrollment?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * Update English Center enrollment context
 */
export interface UpdateEnglishEnrollmentInput {
  readonly classId?: string;
  readonly programId?: string;
  readonly metadata?: Record<string, unknown>;
}

/**
 * List enrollments filter
 */
export interface ListEnrollmentsFilter {
  readonly branchId?: string;
  readonly status?: 'pending' | 'active' | 'completed' | 'cancelled';
  readonly limit?: number;
  readonly offset?: number;
}

/**
 * Database row type (from Supabase)
 */
export interface EnglishCenterEnrollmentRow {
  id: string;
  tenant_id: string;
  canonical_enrollment_id: string;
  branch_id: string;
  program_id: string | null;
  class_id: string | null;
  intake: string | null;
  english_level_at_enrollment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
