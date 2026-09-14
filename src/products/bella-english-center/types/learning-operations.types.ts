/**
 * E6 - English Center Attendance & Learning Operations Types
 */

import { EnglishCenterClassSession } from './timetable.types';
import { EnglishCenterEnrollment } from './enrollment.types';

export type EnglishCenterAttendanceStatus = 'present' | 'absent' | 'excused';
export type EnglishCenterProgressLabel = 'needs_support' | 'on_track' | 'strong' | 'excellent';
export type EnglishCenterSkillArea =
  | 'listening'
  | 'speaking'
  | 'reading'
  | 'writing'
  | 'grammar'
  | 'vocabulary'
  | 'overall';
export type EnglishCenterScoreType = 'quiz' | 'midterm' | 'final' | 'homework';

export interface SessionLearningContext extends EnglishCenterClassSession {}

export interface EnrollmentLearningContext extends EnglishCenterEnrollment {}

export interface MarkSessionAttendanceItem {
  readonly englishEnrollmentId: string;
  readonly status: EnglishCenterAttendanceStatus;
  readonly notes?: string | null;
  readonly metadata?: Record<string, unknown>;
}

export interface MarkSessionAttendanceInput {
  readonly sessionId: string;
  readonly rollCallTime?: string;
  readonly markedBy?: string | null;
  readonly attendance: readonly MarkSessionAttendanceItem[];
}

export interface EnglishCenterSessionAttendance {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly sessionId: string;
  readonly englishEnrollmentId: string;
  readonly canonicalEnrollmentId: string;
  readonly canonicalAttendanceId: string;
  readonly status: EnglishCenterAttendanceStatus;
  readonly notes: string | null;
  readonly markedBy: string | null;
  readonly recordedAt: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionAttendanceResult {
  readonly session: SessionLearningContext;
  readonly records: readonly EnglishCenterSessionAttendance[];
}

export interface RecordLearningProgressInput {
  readonly englishEnrollmentId: string;
  readonly sessionId?: string;
  readonly progressLabel: EnglishCenterProgressLabel;
  readonly skillArea?: EnglishCenterSkillArea;
  readonly notes?: string | null;
  readonly recordedBy?: string | null;
  readonly recordedAt?: string;
  readonly score?: {
    readonly scoreType: EnglishCenterScoreType;
    readonly grade: number;
    readonly weight: number;
  };
  readonly metadata?: Record<string, unknown>;
}

export interface EnglishCenterLearningProgress {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly sessionId: string | null;
  readonly englishEnrollmentId: string;
  readonly canonicalEnrollmentId: string;
  readonly canonicalAssessmentId: string | null;
  readonly progressLabel: EnglishCenterProgressLabel;
  readonly skillArea: EnglishCenterSkillArea | null;
  readonly scoreType: EnglishCenterScoreType | null;
  readonly grade: number | null;
  readonly weight: number | null;
  readonly notes: string | null;
  readonly recordedBy: string | null;
  readonly recordedAt: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SessionAttendanceRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  session_id: string;
  english_enrollment_id: string;
  canonical_enrollment_id: string;
  canonical_attendance_id: string;
  status: EnglishCenterAttendanceStatus;
  notes: string | null;
  marked_by: string | null;
  recorded_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LearningProgressRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  session_id: string | null;
  english_enrollment_id: string;
  canonical_enrollment_id: string;
  canonical_assessment_id: string | null;
  progress_label: EnglishCenterProgressLabel;
  skill_area: EnglishCenterSkillArea | null;
  score_type: EnglishCenterScoreType | null;
  grade: number | null;
  weight: number | null;
  notes: string | null;
  recorded_by: string | null;
  recorded_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}
