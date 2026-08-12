/**
 * Education OS — Engine Service Layer
 * 
 * Coordinates Education OS business workflows using Common Core primitives.
 * Strictly enforces Event-After-Persistence and Generalized Idempotency.
 * 
 * @module platform/education/education-engine.service
 */

import { EventBusPort } from '../core/events';
import { IdempotentExecutionHandler } from '../core/idempotency';
import { Enrollment } from './domain/enrollment.entity';
import { IEducationRepository } from './repositories/education-repository.interface';

export interface EnrollStudentInput {
  tenantId: string;
  studentPartyId: string;
  courseId: string;
  requestId: string;
  userId?: string;
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
  private readonly idempotencyHandler = new IdempotentExecutionHandler();

  constructor(
    private readonly repository: IEducationRepository,
    private readonly eventBus: EventBusPort
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

    // 3. Generalized Idempotency Key Execution
    const idempotencyKey = {
      tenantId: input.tenantId,
      operation: 'ENROLL_STUDENT',
      businessKey: input.requestId,
    };

    const { data: enrollment, isDuplicate } = await this.idempotencyHandler.execute(
      idempotencyKey,
      async () => {
        // Check if student is already enrolled in course
        const existing = await this.repository.findEnrollmentByStudentAndCourse(
          input.studentPartyId,
          input.courseId,
          input.tenantId
        );
        if (existing) {
          return existing;
        }

        const newEnrollment = Enrollment.create({
          tenantId: input.tenantId,
          studentPartyId: input.studentPartyId,
          courseId: input.courseId,
          status: 'pending',
        });

        // Persist to Database FIRST (Event-After-Persistence rule)
        await this.repository.saveEnrollment(newEnrollment);

        // Publish event AFTER database persistence success
        await this.eventBus.publish({
          eventId: crypto.randomUUID(),
          eventType: 'edu.enrollment.created.v1',
          eventVersion: 'v1',
          tenantId: newEnrollment.tenantId,
          aggregateId: newEnrollment.id,
          aggregateType: 'enrollment',
          occurredAt: newEnrollment.createdAt.toISOString(),
          payload: {
            enrollmentId: newEnrollment.id,
            studentPartyId: newEnrollment.studentPartyId,
            courseId: newEnrollment.courseId,
            status: newEnrollment.status,
          },
          userId: input.userId,
        });

        return newEnrollment;
      }
    );

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
