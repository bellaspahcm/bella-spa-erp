/**
 * E6 - English Center Learning Operations Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  EnglishCenterLearningProgress,
  EnglishCenterSessionAttendance,
  LearningProgressRow,
  SessionAttendanceRow,
} from '../types/learning-operations.types';
import { EnrollmentLearningContext, SessionLearningContext } from '../types/learning-operations.types';
import { EnglishCenterEnrollmentRow } from '../types/enrollment.types';
import { ClassSessionRow } from '../types/timetable.types';

export class LearningOperationsRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getSessionContext(
    tenantId: string,
    sessionId: string
  ): Promise<SessionLearningContext | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_class_sessions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', sessionId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapSessionRow(row as ClassSessionRow);
  }

  async getEnrollmentContext(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnrollmentLearningContext | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', englishEnrollmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapEnrollmentRow(row as EnglishCenterEnrollmentRow);
  }

  async saveAttendanceRecord(input: {
    tenantId: string;
    branchId: string;
    sessionId: string;
    englishEnrollmentId: string;
    canonicalEnrollmentId: string;
    canonicalAttendanceId: string;
    status: 'present' | 'absent' | 'excused';
    notes?: string | null;
    markedBy?: string | null;
    recordedAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterSessionAttendance> {
    const { data: row, error } = await this.supabase
      .from('english_center_session_attendance')
      .upsert({
        tenant_id: input.tenantId,
        branch_id: input.branchId,
        session_id: input.sessionId,
        english_enrollment_id: input.englishEnrollmentId,
        canonical_enrollment_id: input.canonicalEnrollmentId,
        canonical_attendance_id: input.canonicalAttendanceId,
        status: input.status,
        notes: input.notes || null,
        marked_by: input.markedBy || null,
        recorded_at: input.recordedAt,
        metadata: input.metadata || {},
      }, { onConflict: 'tenant_id,session_id,english_enrollment_id' })
      .select()
      .single();

    if (error) throw error;
    return this.mapAttendanceRow(row as SessionAttendanceRow);
  }

  async listSessionAttendance(
    tenantId: string,
    sessionId: string
  ): Promise<EnglishCenterSessionAttendance[]> {
    const { data: rows, error } = await this.supabase
      .from('english_center_session_attendance')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('session_id', sessionId)
      .order('recorded_at', { ascending: true });

    if (error) throw error;
    return (rows || []).map((row) => this.mapAttendanceRow(row as SessionAttendanceRow));
  }

  async listAttendanceByEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnglishCenterSessionAttendance[]> {
    const { data: rows, error } = await this.supabase
      .from('english_center_session_attendance')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('english_enrollment_id', englishEnrollmentId)
      .order('recorded_at', { ascending: false });

    if (error) throw error;
    return (rows || []).map((row) => this.mapAttendanceRow(row as SessionAttendanceRow));
  }

  async saveLearningProgress(input: {
    tenantId: string;
    branchId: string;
    sessionId?: string | null;
    englishEnrollmentId: string;
    canonicalEnrollmentId: string;
    canonicalAssessmentId?: string | null;
    progressLabel: 'needs_support' | 'on_track' | 'strong' | 'excellent';
    skillArea?: 'listening' | 'speaking' | 'reading' | 'writing' | 'grammar' | 'vocabulary' | 'overall';
    scoreType?: 'quiz' | 'midterm' | 'final' | 'homework';
    grade?: number;
    weight?: number;
    notes?: string | null;
    recordedBy?: string | null;
    recordedAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterLearningProgress> {
    const { data: row, error } = await this.supabase
      .from('english_center_learning_progress')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId,
        session_id: input.sessionId || null,
        english_enrollment_id: input.englishEnrollmentId,
        canonical_enrollment_id: input.canonicalEnrollmentId,
        canonical_assessment_id: input.canonicalAssessmentId || null,
        progress_label: input.progressLabel,
        skill_area: input.skillArea || null,
        score_type: input.scoreType || null,
        grade: input.grade ?? null,
        weight: input.weight ?? null,
        notes: input.notes || null,
        recorded_by: input.recordedBy || null,
        recorded_at: input.recordedAt,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapProgressRow(row as LearningProgressRow);
  }

  async listLearningProgressByEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnglishCenterLearningProgress[]> {
    const { data: rows, error } = await this.supabase
      .from('english_center_learning_progress')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('english_enrollment_id', englishEnrollmentId)
      .order('recorded_at', { ascending: false });

    if (error) throw error;
    return (rows || []).map((row) => this.mapProgressRow(row as LearningProgressRow));
  }

  private mapSessionRow(row: ClassSessionRow): SessionLearningContext {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      classId: row.class_id,
      teacherId: row.teacher_id,
      roomId: row.room_id,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      status: row.status,
      topic: row.topic,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapEnrollmentRow(row: EnglishCenterEnrollmentRow): EnrollmentLearningContext {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      canonicalEnrollmentId: row.canonical_enrollment_id,
      branchId: row.branch_id,
      programId: row.program_id,
      classId: row.class_id,
      intake: row.intake,
      englishLevelAtEnrollment: row.english_level_at_enrollment,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAttendanceRow(row: SessionAttendanceRow): EnglishCenterSessionAttendance {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      sessionId: row.session_id,
      englishEnrollmentId: row.english_enrollment_id,
      canonicalEnrollmentId: row.canonical_enrollment_id,
      canonicalAttendanceId: row.canonical_attendance_id,
      status: row.status,
      notes: row.notes,
      markedBy: row.marked_by,
      recordedAt: row.recorded_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapProgressRow(row: LearningProgressRow): EnglishCenterLearningProgress {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      sessionId: row.session_id,
      englishEnrollmentId: row.english_enrollment_id,
      canonicalEnrollmentId: row.canonical_enrollment_id,
      canonicalAssessmentId: row.canonical_assessment_id,
      progressLabel: row.progress_label,
      skillArea: row.skill_area,
      scoreType: row.score_type,
      grade: row.grade,
      weight: row.weight,
      notes: row.notes,
      recordedBy: row.recorded_by,
      recordedAt: row.recorded_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
