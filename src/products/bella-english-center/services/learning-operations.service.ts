/**
 * E6 - English Center Attendance & Learning Operations Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import {
  IEducationAttendanceContract,
} from '@/platform/education/contracts/attendance.contract';
import {
  IEducationAssessmentContract,
} from '@/platform/education/contracts/assessment.contract';
import { LearningOperationsRepository } from '../repositories/learning-operations.repository';
import {
  EnglishCenterLearningProgress,
  EnglishCenterSessionAttendance,
  EnrollmentLearningContext,
  MarkSessionAttendanceInput,
  RecordLearningProgressInput,
  SessionAttendanceResult,
  SessionLearningContext,
} from '../types/learning-operations.types';

export interface LearningOperationsRepositoryContract {
  getSessionContext(tenantId: string, sessionId: string): Promise<SessionLearningContext | null>;
  getEnrollmentContext(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnrollmentLearningContext | null>;
  saveAttendanceRecord(input: {
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
  }): Promise<EnglishCenterSessionAttendance>;
  listSessionAttendance(tenantId: string, sessionId: string): Promise<EnglishCenterSessionAttendance[]>;
  listAttendanceByEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnglishCenterSessionAttendance[]>;
  saveLearningProgress(input: {
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
  }): Promise<EnglishCenterLearningProgress>;
  listLearningProgressByEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnglishCenterLearningProgress[]>;
}

export interface LearningOperationsContracts {
  readonly attendance?: IEducationAttendanceContract;
  readonly assessment?: IEducationAssessmentContract;
}

export class LearningOperationsService {
  private readonly repository: LearningOperationsRepositoryContract;
  private readonly contracts: LearningOperationsContracts;

  constructor(
    supabaseOrRepository: SupabaseClient | LearningOperationsRepositoryContract,
    contracts: LearningOperationsContracts = {}
  ) {
    this.repository = this.isRepository(supabaseOrRepository)
      ? supabaseOrRepository
      : new LearningOperationsRepository(supabaseOrRepository);
    this.contracts = contracts;
  }

  async markSessionAttendance(
    tenantId: string,
    input: MarkSessionAttendanceInput
  ): Promise<SessionAttendanceResult> {
    if (!tenantId || !input.sessionId || input.attendance.length === 0) {
      throw new Error('INVALID_ATTENDANCE_INPUT: tenantId, sessionId, and attendance are required');
    }

    const session = await this.requireSession(tenantId, input.sessionId);
    if (session.status === 'cancelled') {
      throw new Error('SESSION_CANCELLED: attendance cannot be recorded for cancelled sessions');
    }

    const recordedAt = input.rollCallTime || new Date().toISOString();
    const records: EnglishCenterSessionAttendance[] = [];

    for (const item of input.attendance) {
      const enrollment = await this.requireEnrollmentForSession(
        tenantId,
        item.englishEnrollmentId,
        session
      );

      const canonical = await this.requireAttendanceContract().recordAttendance({
        tenantId,
        enrollmentId: enrollment.canonicalEnrollmentId,
        status: item.status,
        rollCallTime: recordedAt,
      });

      const record = await this.repository.saveAttendanceRecord({
        tenantId,
        branchId: session.branchId,
        sessionId: session.id,
        englishEnrollmentId: enrollment.id,
        canonicalEnrollmentId: enrollment.canonicalEnrollmentId,
        canonicalAttendanceId: canonical.id,
        status: canonical.status,
        notes: item.notes,
        markedBy: input.markedBy,
        recordedAt: canonical.rollCallTime,
        metadata: item.metadata,
      });
      records.push(record);
    }

    return { session, records };
  }

  async getSessionAttendance(
    tenantId: string,
    sessionId: string
  ): Promise<SessionAttendanceResult> {
    const session = await this.requireSession(tenantId, sessionId);
    const records = await this.repository.listSessionAttendance(tenantId, sessionId);

    return { session, records };
  }

  async getEnrollmentAttendanceHistory(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<{
    enrollment: EnrollmentLearningContext;
    canonicalHistory: readonly {
      readonly id: string;
      readonly tenantId: string;
      readonly enrollmentId: string;
      readonly status: 'present' | 'absent' | 'excused';
      readonly rollCallTime: string;
    }[];
    sessionHistory: readonly EnglishCenterSessionAttendance[];
  }> {
    const enrollment = await this.requireEnrollment(tenantId, englishEnrollmentId);
    const [canonicalHistory, sessionHistory] = await Promise.all([
      this.requireAttendanceContract().getAttendanceHistory(tenantId, enrollment.canonicalEnrollmentId),
      this.repository.listAttendanceByEnrollment(tenantId, englishEnrollmentId),
    ]);

    return { enrollment, canonicalHistory, sessionHistory };
  }

  async recordLearningProgress(
    tenantId: string,
    input: RecordLearningProgressInput
  ): Promise<EnglishCenterLearningProgress> {
    if (!tenantId || !input.englishEnrollmentId || !input.progressLabel) {
      throw new Error('INVALID_PROGRESS_INPUT: tenantId, englishEnrollmentId, and progressLabel are required');
    }

    const enrollment = await this.requireEnrollment(tenantId, input.englishEnrollmentId);
    const session = input.sessionId ? await this.requireSession(tenantId, input.sessionId) : null;
    if (session) {
      this.assertEnrollmentMatchesSession(enrollment, session);
    }

    const recordedAt = input.recordedAt || new Date().toISOString();
    const canonicalScore = input.score
      ? await this.requireAssessmentContract().recordScore({
          tenantId,
          enrollmentId: enrollment.canonicalEnrollmentId,
          scoreType: input.score.scoreType,
          grade: input.score.grade,
          weight: input.score.weight,
          occurredAt: recordedAt,
        })
      : null;

    return this.repository.saveLearningProgress({
      tenantId,
      branchId: session?.branchId || enrollment.branchId,
      sessionId: session?.id || null,
      englishEnrollmentId: enrollment.id,
      canonicalEnrollmentId: enrollment.canonicalEnrollmentId,
      canonicalAssessmentId: canonicalScore?.id || null,
      progressLabel: input.progressLabel,
      skillArea: input.skillArea,
      scoreType: input.score?.scoreType,
      grade: input.score?.grade,
      weight: input.score?.weight,
      notes: input.notes,
      recordedBy: input.recordedBy,
      recordedAt,
      metadata: input.metadata,
    });
  }

  async listLearningProgressByEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<{
    enrollment: EnrollmentLearningContext;
    progress: readonly EnglishCenterLearningProgress[];
  }> {
    const enrollment = await this.requireEnrollment(tenantId, englishEnrollmentId);
    const progress = await this.repository.listLearningProgressByEnrollment(tenantId, englishEnrollmentId);

    return { enrollment, progress };
  }

  private async requireSession(tenantId: string, sessionId: string): Promise<SessionLearningContext> {
    const session = await this.repository.getSessionContext(tenantId, sessionId);
    if (!session) {
      throw new Error('SESSION_NOT_FOUND');
    }
    if (session.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return session;
  }

  private async requireEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EnrollmentLearningContext> {
    const enrollment = await this.repository.getEnrollmentContext(tenantId, englishEnrollmentId);
    if (!enrollment) {
      throw new Error('ENROLLMENT_NOT_FOUND');
    }
    if (enrollment.tenantId !== tenantId) {
      throw new Error('TENANT_SCOPE_VIOLATION');
    }

    return enrollment;
  }

  private async requireEnrollmentForSession(
    tenantId: string,
    englishEnrollmentId: string,
    session: SessionLearningContext
  ): Promise<EnrollmentLearningContext> {
    const enrollment = await this.requireEnrollment(tenantId, englishEnrollmentId);
    this.assertEnrollmentMatchesSession(enrollment, session);

    return enrollment;
  }

  private assertEnrollmentMatchesSession(
    enrollment: EnrollmentLearningContext,
    session: SessionLearningContext
  ): void {
    if (enrollment.branchId !== session.branchId) {
      throw new Error('BRANCH_SCOPE_VIOLATION');
    }
    if (enrollment.classId !== session.classId) {
      throw new Error('CLASS_SCOPE_VIOLATION');
    }
  }

  private requireAttendanceContract(): IEducationAttendanceContract {
    if (!this.contracts.attendance) {
      throw new Error('ATTENDANCE_CONTRACT_REQUIRED');
    }

    return this.contracts.attendance;
  }

  private requireAssessmentContract(): IEducationAssessmentContract {
    if (!this.contracts.assessment) {
      throw new Error('ASSESSMENT_CONTRACT_REQUIRED');
    }

    return this.contracts.assessment;
  }

  private isRepository(
    candidate: SupabaseClient | LearningOperationsRepositoryContract
  ): candidate is LearningOperationsRepositoryContract {
    return 'getSessionContext' in candidate && 'saveAttendanceRecord' in candidate;
  }
}
