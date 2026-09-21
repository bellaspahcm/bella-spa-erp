import { IEducationEnrollmentContract, EnrollStudentInput, EducationEnrollmentDTO } from './enrollment.contract';
import { EducationEngineService, OverrideRequest } from '../education-engine.service';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';
import { createClient } from '@/lib/supabase-server';
import { eventBus } from '@/platform/host/event-bus';
import { EventBusPort, DomainEventEnvelope } from '@/platform/core/events/types';

/**
 * Adapter: EventBusService → EventBusPort
 * Maps Platform Host EventBusService to Core EventBusPort abstraction
 */
class EventBusServiceAdapter implements EventBusPort {
  async publish<T = unknown>(event: DomainEventEnvelope<T>): Promise<void> {
    await eventBus.publish({
      eventType: event.eventType,
      eventVersion: event.eventVersion,
      tenantId: event.tenantId,
      aggregateId: event.aggregateId,
      aggregateType: event.aggregateType,
      payload: event.payload,
      userId: event.userId,
      correlationId: event.correlationId,
      causationId: event.causationId,
    });
  }

  subscribe<T = unknown>(eventType: string, handler: (event: DomainEventEnvelope<T>) => Promise<void> | void): () => void {
    return eventBus.subscribe(eventType, handler);
  }

  clear(): void {
    // EventBusService doesn't expose clear, no-op for now
  }
}

export class EnrollmentContractImpl implements IEducationEnrollmentContract {
  public async enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO> {
    const supabase = createClient();
    const repository = new SupabaseEducationRepository(supabase);
    const eventBusAdapter = new EventBusServiceAdapter();
    const service = new EducationEngineService(repository, eventBusAdapter);

    let overrideRequest: OverrideRequest | undefined = (input as EnrollStudentInput & {overrideRequest?: unknown}).overrideRequest as OverrideRequest | undefined;
    if (!overrideRequest && input.overrideJustification) {
      try {
        overrideRequest = JSON.parse(input.overrideJustification);
      } catch {
        // Ignore parsing errors
      }
    }

    const result = await service.enrollStudent({
      tenantId: input.tenantId,
      studentPartyId: input.studentPartyId,
      courseId: input.courseId,
      requestId: input.requestId,
      overrideRequest,
    });

    if (!result.success || !result.enrollment) {
      throw new Error(result.error || 'Enrollment failed');
    }

    return {
      id: result.enrollment.id,
      tenantId: result.enrollment.tenantId,
      studentPartyId: result.enrollment.studentPartyId,
      courseId: result.enrollment.courseId,
      status: result.enrollment.status as 'pending' | 'active' | 'completed' | 'cancelled',
      enrolledAt: result.enrollment.enrolledAt,
    };
  }

  public async getEnrollment(tenantId: string, enrollmentId: string): Promise<EducationEnrollmentDTO | null> {
    const supabase = createClient();
    const repository = new SupabaseEducationRepository(supabase);
    const enrollment = await repository.findEnrollmentById(enrollmentId, tenantId);
    if (!enrollment) {
      return null;
    }

    return {
      id: enrollment.id,
      tenantId: enrollment.tenantId,
      studentPartyId: enrollment.studentPartyId,
      courseId: enrollment.courseId,
      status: enrollment.status as 'pending' | 'active' | 'completed' | 'cancelled',
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }
}
