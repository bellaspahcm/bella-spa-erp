import { IEducationEnrollmentContract, EnrollStudentInput, EducationEnrollmentDTO } from './enrollment.contract';
import { EducationEngineService } from '../education-engine.service';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';
import { createClient } from '@/lib/supabase-server';
import { eventBus } from '@/platform/host/event-bus';

export class EnrollmentContractImpl implements IEducationEnrollmentContract {
  public async enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO> {
    const supabase = createClient();
    const repository = new SupabaseEducationRepository(supabase);
    // Note: The eventBus conforms to EventBusPort - type assertion safe here
    const service = new EducationEngineService(repository, eventBus);

    let overrideRequest = (input as EnrollStudentInput & {overrideRequest?: unknown}).overrideRequest;
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
      status: result.enrollment.status,
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
      status: enrollment.status,
      enrolledAt: enrollment.enrolledAt.toISOString(),
    };
  }
}
