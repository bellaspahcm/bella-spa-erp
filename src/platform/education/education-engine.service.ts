/**
 * Education OS — Engine Service Layer
 * 
 * Coordinates Education OS business workflows using Common Core primitives.
 * Strictly enforces Event-After-Persistence and Generalized Idempotency.
 * 
 * @module platform/education/education-engine.service
 */

import { EventBusPort } from '../core/events';
import { Enrollment } from './domain/enrollment.entity';
import { IEducationRepository } from './repositories/education-repository.interface';
import { IEducationRuleGovernancePort } from './ports/rule-governance.port';
import crypto from 'crypto';

export interface OverrideRequest {
  readonly actorId: string;
  readonly reason: string;
  readonly ruleVersion: string;
  readonly timestamp: string;
  readonly targetStudent: string;
  readonly targetCourse: string;
  readonly authorization: string;
  readonly auditEvidence: string;
}

export interface EnrollStudentInput {
  tenantId: string;
  studentPartyId: string;
  courseId: string;
  requestId: string;
  userId?: string;
  overrideRequest?: OverrideRequest;
}

export interface EnrollStudentResult {
  success: boolean;
  enrollment?: {
    id: string;
    tenantId: string;
    studentPartyId: string;
    courseId: string;
    status: string;
    enrolledAt: string;
  };
  isDuplicate?: boolean;
  eventPublished?: boolean;
  error?: string;
}

export class EducationEngineService {
  constructor(
    private readonly repository: IEducationRepository,
    private readonly eventBus: EventBusPort,
    private readonly ruleGovernancePort?: IEducationRuleGovernancePort
  ) {}

  public async enrollStudent(input: EnrollStudentInput): Promise<EnrollStudentResult> {
    if (!input.tenantId) throw new Error('tenantId is required');
    if (!input.studentPartyId) throw new Error('studentPartyId is required');
    if (!input.courseId) throw new Error('courseId is required');
    if (!input.requestId) throw new Error('requestId is required for idempotency');

    // 1. Verify Student Role & Tenant Match
    const studentCheck = await this.repository.verifyStudentRole(input.studentPartyId, input.tenantId);
    if (!studentCheck.isValid) {
      throw new Error(`Student validation failed: ${studentCheck.reason}`);
    }

    // 2. Verify Course Exists & Active in Tenant
    const course = await this.repository.findCourseById(input.courseId, input.tenantId);
    if (!course) {
      throw new Error(`Course ${input.courseId} not found in tenant ${input.tenantId}`);
    }
    if (course.status !== 'active') {
      throw new Error(`Course ${input.courseId} is in status ${course.status}, expected active`);
    }

    // 2.5 Prerequisite Eligibility & Governed Override (Decoupled Port)
    if (course.prerequisiteCourseCodes && course.prerequisiteCourseCodes.length > 0) {
      let port = this.ruleGovernancePort;
      if (!port) {
        // Dynamic import to avoid compile-time dependency from Kernel -> Host
        const { EducationRuleGovernanceAdapter } = await import('../host/rule-governance/education-rule-governance.adapter');
        port = new EducationRuleGovernanceAdapter();
      }

      const activeRule = await port.getActiveGradingRule(input.tenantId);
      const studentScores = await this.repository.getStudentScores(input.studentPartyId, input.tenantId);

      const missingPrerequisites: string[] = [];
      for (const reqCode of course.prerequisiteCourseCodes) {
        const prereqCourse = await this.repository.findCourseByCode(reqCode, input.tenantId);
        if (!prereqCourse) {
          missingPrerequisites.push(reqCode);
          continue;
        }

        const studentScore = studentScores.find(s => s.courseId === prereqCourse.id);
        const hasPassed = studentScore !== undefined && studentScore.score >= activeRule.passingThreshold;
        if (!hasPassed) {
          missingPrerequisites.push(reqCode);
        }
      }

      if (missingPrerequisites.length > 0) {
        if (!input.overrideRequest) {
          throw new Error(`Prerequisite check failed. Missing prerequisite courses: ${missingPrerequisites.join(', ')}`);
        }

        // Validate OverrideRequest Schema
        const ov = input.overrideRequest;
        if (
          !ov.actorId ||
          !ov.reason ||
          !ov.ruleVersion ||
          !ov.timestamp ||
          !ov.targetStudent ||
          !ov.targetCourse ||
          !ov.authorization ||
          !ov.auditEvidence
        ) {
          throw new Error('OverrideRequest validation failed: Missing required fields');
        }

        // Validate OverrideRequest payload targets
        if (ov.targetStudent !== input.studentPartyId) {
          throw new Error('OverrideRequest validation failed: targetStudent mismatch');
        }
        if (ov.targetCourse !== input.courseId) {
          throw new Error('OverrideRequest validation failed: targetCourse mismatch');
        }
        if (ov.ruleVersion !== activeRule.ruleVersion) {
          throw new Error('OverrideRequest validation failed: ruleVersion mismatch');
        }
      }
    }

    // 3. Stored Procedure Transaction (Row lock + Idempotency checks)
    const enrollmentId = crypto.randomUUID();
    const txResult = await this.repository.executeEnrollStudentTransaction({
      tenantId: input.tenantId,
      studentPartyId: input.studentPartyId,
      courseId: input.courseId,
      enrollmentId,
      requestId: input.requestId,
    });

    const isDuplicate = txResult.isDuplicate;
    const finalEnrollmentId = txResult.enrollmentId;

    const enrollment = await this.repository.findEnrollmentById(finalEnrollmentId, input.tenantId);
    if (!enrollment) {
      throw new Error(`Failed to load enrollment ${finalEnrollmentId}`);
    }

    // 4. Event-After-Persistence event publication
    if (!isDuplicate) {
      await this.eventBus.publish({
        eventId: crypto.randomUUID(),
        eventType: 'edu.enrollment.created.v1',
        eventVersion: 'v1',
        tenantId: enrollment.tenantId,
        aggregateId: enrollment.id,
        aggregateType: 'enrollment',
        occurredAt: enrollment.createdAt.toISOString(),
        payload: {
          enrollmentId: enrollment.id,
          studentPartyId: enrollment.studentPartyId,
          courseId: enrollment.courseId,
          status: enrollment.status,
        },
        userId: input.userId,
      });
    }

    return {
      success: true,
      isDuplicate,
      eventPublished: !isDuplicate,
      enrollment: {
        id: enrollment.id,
        tenantId: enrollment.tenantId,
        studentPartyId: enrollment.studentPartyId,
        courseId: enrollment.courseId,
        status: enrollment.status,
        enrolledAt: enrollment.enrolledAt.toISOString(),
      },
    };
  }
}
