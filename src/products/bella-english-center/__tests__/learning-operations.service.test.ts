import { describe, expect, it, jest } from '@jest/globals';
import { IEducationAssessmentContract } from '@/platform/education/contracts/assessment.contract';
import { IEducationAttendanceContract } from '@/platform/education/contracts/attendance.contract';
import {
  LearningOperationsRepositoryContract,
  LearningOperationsService,
} from '../services/learning-operations.service';
import {
  EnglishCenterLearningProgress,
  EnglishCenterSessionAttendance,
  EnrollmentLearningContext,
  SessionLearningContext,
} from '../types/learning-operations.types';

const session: SessionLearningContext = {
  id: 'session-a',
  tenantId: 'tenant-a',
  branchId: 'branch-a',
  classId: 'class-a',
  teacherId: 'teacher-a',
  roomId: 'room-a',
  startsAt: '2026-09-15T09:00:00.000Z',
  endsAt: '2026-09-15T10:30:00.000Z',
  status: 'scheduled',
  topic: 'Speaking',
  metadata: {},
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
};

const enrollment: EnrollmentLearningContext = {
  id: 'english-enrollment-a',
  tenantId: 'tenant-a',
  canonicalEnrollmentId: 'canonical-enrollment-a',
  branchId: 'branch-a',
  programId: 'program-a',
  classId: 'class-a',
  intake: '2026-Q3',
  englishLevelAtEnrollment: 'A2',
  metadata: {},
  createdAt: '2026-09-14T00:00:00.000Z',
  updatedAt: '2026-09-14T00:00:00.000Z',
};

function makeAttendanceRecord(overrides: Partial<EnglishCenterSessionAttendance> = {}): EnglishCenterSessionAttendance {
  return {
    id: 'attendance-map-a',
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    sessionId: 'session-a',
    englishEnrollmentId: 'english-enrollment-a',
    canonicalEnrollmentId: 'canonical-enrollment-a',
    canonicalAttendanceId: 'canonical-attendance-a',
    status: 'present',
    notes: null,
    markedBy: null,
    recordedAt: '2026-09-15T09:05:00.000Z',
    metadata: {},
    createdAt: '2026-09-15T09:05:00.000Z',
    updatedAt: '2026-09-15T09:05:00.000Z',
    ...overrides,
  };
}

function makeProgress(overrides: Partial<EnglishCenterLearningProgress> = {}): EnglishCenterLearningProgress {
  return {
    id: 'progress-a',
    tenantId: 'tenant-a',
    branchId: 'branch-a',
    sessionId: 'session-a',
    englishEnrollmentId: 'english-enrollment-a',
    canonicalEnrollmentId: 'canonical-enrollment-a',
    canonicalAssessmentId: null,
    progressLabel: 'on_track',
    skillArea: 'speaking',
    scoreType: null,
    grade: null,
    weight: null,
    notes: 'Good pronunciation',
    recordedBy: 'teacher-a',
    recordedAt: '2026-09-15T10:00:00.000Z',
    metadata: {},
    createdAt: '2026-09-15T10:00:00.000Z',
    updatedAt: '2026-09-15T10:00:00.000Z',
    ...overrides,
  };
}

function makeRepository(
  overrides: Partial<LearningOperationsRepositoryContract> = {}
): LearningOperationsRepositoryContract {
  return {
    async getSessionContext() {
      return session;
    },
    async getEnrollmentContext() {
      return enrollment;
    },
    async saveAttendanceRecord(input) {
      return makeAttendanceRecord({
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId,
        englishEnrollmentId: input.englishEnrollmentId,
        canonicalEnrollmentId: input.canonicalEnrollmentId,
        canonicalAttendanceId: input.canonicalAttendanceId,
        status: input.status,
        notes: input.notes || null,
        markedBy: input.markedBy || null,
        recordedAt: input.recordedAt,
        metadata: input.metadata || {},
      });
    },
    async listSessionAttendance() {
      return [makeAttendanceRecord()];
    },
    async listAttendanceByEnrollment() {
      return [makeAttendanceRecord()];
    },
    async saveLearningProgress(input) {
      return makeProgress({
        tenantId: input.tenantId,
        branchId: input.branchId,
        sessionId: input.sessionId || null,
        englishEnrollmentId: input.englishEnrollmentId,
        canonicalEnrollmentId: input.canonicalEnrollmentId,
        canonicalAssessmentId: input.canonicalAssessmentId || null,
        progressLabel: input.progressLabel,
        skillArea: input.skillArea || null,
        scoreType: input.scoreType || null,
        grade: input.grade ?? null,
        weight: input.weight ?? null,
        notes: input.notes || null,
        recordedBy: input.recordedBy || null,
        recordedAt: input.recordedAt,
        metadata: input.metadata || {},
      });
    },
    async listLearningProgressByEnrollment() {
      return [makeProgress()];
    },
    ...overrides,
  };
}

function makeAttendanceContract(): IEducationAttendanceContract {
  return {
    recordAttendance: jest.fn(async (input) => ({
      id: 'canonical-attendance-a',
      tenantId: input.tenantId,
      enrollmentId: input.enrollmentId,
      status: input.status,
      rollCallTime: input.rollCallTime || '2026-09-15T09:05:00.000Z',
    })),
    getAttendanceHistory: jest.fn(async (tenantId, enrollmentId) => [{
      id: 'canonical-attendance-a',
      tenantId,
      enrollmentId,
      status: 'present',
      rollCallTime: '2026-09-15T09:05:00.000Z',
    }]),
  };
}

function makeAssessmentContract(): IEducationAssessmentContract {
  return {
    recordScore: jest.fn(async (input) => ({
      id: 'canonical-assessment-a',
      tenantId: input.tenantId,
      enrollmentId: input.enrollmentId,
      scoreType: input.scoreType,
      grade: input.grade,
      weight: input.weight,
      occurredAt: input.occurredAt || '2026-09-15T10:00:00.000Z',
    })),
    getScores: jest.fn(async () => []),
    calculateGpa: jest.fn(async () => 0),
  };
}

describe('E6 - LearningOperationsService', () => {
  it('records session attendance through the Education Attendance contract', async () => {
    const attendanceContract = makeAttendanceContract();
    const service = new LearningOperationsService(makeRepository(), {
      attendance: attendanceContract,
      assessment: makeAssessmentContract(),
    });

    const result = await service.markSessionAttendance('tenant-a', {
      sessionId: 'session-a',
      rollCallTime: '2026-09-15T09:05:00.000Z',
      markedBy: 'teacher-a',
      attendance: [{
        englishEnrollmentId: 'english-enrollment-a',
        status: 'present',
        notes: 'On time',
      }],
    });

    expect(result.records).toHaveLength(1);
    expect(result.records[0].canonicalAttendanceId).toBe('canonical-attendance-a');
    expect(attendanceContract.recordAttendance).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      enrollmentId: 'canonical-enrollment-a',
      status: 'present',
      rollCallTime: '2026-09-15T09:05:00.000Z',
    });
  });

  it('blocks attendance for enrollment from another branch', async () => {
    const service = new LearningOperationsService(makeRepository({
      async getEnrollmentContext() {
        return { ...enrollment, branchId: 'branch-b' };
      },
    }), {
      attendance: makeAttendanceContract(),
      assessment: makeAssessmentContract(),
    });

    await expect(service.markSessionAttendance('tenant-a', {
      sessionId: 'session-a',
      attendance: [{ englishEnrollmentId: 'english-enrollment-a', status: 'present' }],
    })).rejects.toThrow('BRANCH_SCOPE_VIOLATION');
  });

  it('blocks attendance for enrollment from another class', async () => {
    const service = new LearningOperationsService(makeRepository({
      async getEnrollmentContext() {
        return { ...enrollment, classId: 'class-b' };
      },
    }), {
      attendance: makeAttendanceContract(),
      assessment: makeAssessmentContract(),
    });

    await expect(service.markSessionAttendance('tenant-a', {
      sessionId: 'session-a',
      attendance: [{ englishEnrollmentId: 'english-enrollment-a', status: 'present' }],
    })).rejects.toThrow('CLASS_SCOPE_VIOLATION');
  });

  it('blocks attendance for cancelled sessions', async () => {
    const service = new LearningOperationsService(makeRepository({
      async getSessionContext() {
        return { ...session, status: 'cancelled' };
      },
    }), {
      attendance: makeAttendanceContract(),
      assessment: makeAssessmentContract(),
    });

    await expect(service.markSessionAttendance('tenant-a', {
      sessionId: 'session-a',
      attendance: [{ englishEnrollmentId: 'english-enrollment-a', status: 'absent' }],
    })).rejects.toThrow('SESSION_CANCELLED');
  });

  it('returns canonical and session attendance history by enrollment', async () => {
    const service = new LearningOperationsService(makeRepository(), {
      attendance: makeAttendanceContract(),
      assessment: makeAssessmentContract(),
    });

    const history = await service.getEnrollmentAttendanceHistory('tenant-a', 'english-enrollment-a');

    expect(history.enrollment.id).toBe('english-enrollment-a');
    expect(history.canonicalHistory).toHaveLength(1);
    expect(history.sessionHistory).toHaveLength(1);
  });

  it('records learning progress without creating a score when grade is omitted', async () => {
    const assessmentContract = makeAssessmentContract();
    const service = new LearningOperationsService(makeRepository(), {
      attendance: makeAttendanceContract(),
      assessment: assessmentContract,
    });

    const progress = await service.recordLearningProgress('tenant-a', {
      englishEnrollmentId: 'english-enrollment-a',
      sessionId: 'session-a',
      progressLabel: 'on_track',
      skillArea: 'speaking',
      notes: 'Good pronunciation',
      recordedBy: 'teacher-a',
    });

    expect(progress.progressLabel).toBe('on_track');
    expect(progress.canonicalAssessmentId).toBeNull();
    expect(assessmentContract.recordScore).not.toHaveBeenCalled();
  });

  it('records scored progress through the Education Assessment contract', async () => {
    const assessmentContract = makeAssessmentContract();
    const service = new LearningOperationsService(makeRepository(), {
      attendance: makeAttendanceContract(),
      assessment: assessmentContract,
    });

    const progress = await service.recordLearningProgress('tenant-a', {
      englishEnrollmentId: 'english-enrollment-a',
      sessionId: 'session-a',
      progressLabel: 'strong',
      skillArea: 'overall',
      score: {
        scoreType: 'quiz',
        grade: 87,
        weight: 0.2,
      },
    });

    expect(progress.canonicalAssessmentId).toBe('canonical-assessment-a');
    expect(assessmentContract.recordScore).toHaveBeenCalledWith({
      tenantId: 'tenant-a',
      enrollmentId: 'canonical-enrollment-a',
      scoreType: 'quiz',
      grade: 87,
      weight: 0.2,
      occurredAt: expect.any(String),
    });
  });
});
