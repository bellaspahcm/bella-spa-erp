/**
 * Assessment Types
 * Education Platform - Assessment Capability
 */

import type { Database } from '@/types/supabase';

// ============================================================================
// Database Types (from Supabase schema)
// ============================================================================

export type AssessmentsTableRow = Database['public']['Tables']['assessments']['Row'];
export type AssessmentsTableInsert = Database['public']['Tables']['assessments']['Insert'];
export type AssessmentsTableUpdate = Database['public']['Tables']['assessments']['Update'];

// ============================================================================
// Assessment Status
// ============================================================================

export type AssessmentStatus = 'draft' | 'published' | 'graded' | 'archived';

// ============================================================================
// Assessment Type
// ============================================================================

export type AssessmentType = 'exam' | 'quiz' | 'assignment' | 'project' | 'presentation';

// ============================================================================
// Domain Model
// ============================================================================

export interface Assessment {
  assessmentId: string;
  tenantId: string;
  courseId: string;
  assessmentCode: string;
  title: string;
  description: string | null;
  type: AssessmentType;
  maxScore: number;
  passingScore: number;
  weight: number; // Weight in final grade calculation (0-100)
  dueDate: Date | null;
  status: AssessmentStatus;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}

// ============================================================================
// Assessment Result (Student's score on Assessment)
// ============================================================================

export interface AssessmentResult {
  resultId: string;
  tenantId: string;
  assessmentId: string;
  studentId: string;
  score: number | null;
  grade: string | null; // Letter grade: A, B, C, D, F
  submittedAt: Date | null;
  gradedAt: Date | null;
  feedback: string | null;
  status: 'pending' | 'submitted' | 'graded';
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// Creation DTOs
// ============================================================================

export interface CreateAssessmentDTO {
  tenantId: string;
  courseId: string;
  assessmentCode: string;
  title: string;
  description?: string;
  type: AssessmentType;
  maxScore: number;
  passingScore: number;
  weight: number;
  dueDate?: Date;
  createdBy: string;
}

export interface CreateAssessmentResultDTO {
  tenantId: string;
  assessmentId: string;
  studentId: string;
  createdBy: string;
}

// ============================================================================
// Update DTOs
// ============================================================================

export interface UpdateAssessmentDTO {
  title?: string;
  description?: string;
  type?: AssessmentType;
  maxScore?: number;
  passingScore?: number;
  weight?: number;
  dueDate?: Date | null;
  status?: AssessmentStatus;
}

export interface GradeAssessmentResultDTO {
  score: number;
  grade: string;
  feedback?: string;
  gradedBy: string;
}

// ============================================================================
// Query Filters
// ============================================================================

export interface AssessmentFilters {
  tenantId: string;
  courseId?: string;
  type?: AssessmentType;
  status?: AssessmentStatus;
}

export interface AssessmentResultFilters {
  tenantId: string;
  assessmentId?: string;
  studentId?: string;
  status?: 'pending' | 'submitted' | 'graded';
}
