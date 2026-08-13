/**
 * Education OS — Enrollment public contract interface
 */
export interface EducationEnrollmentDTO {
  readonly id: string;
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly status: 'pending' | 'active' | 'completed' | 'cancelled';
  readonly enrolledAt: string;
}

export interface EnrollStudentInput {
  readonly tenantId: string;
  readonly studentPartyId: string;
  readonly courseId: string;
  readonly requestId: string; // for idempotency de-duplication
  readonly overrideJustification?: string; // justification if prerequisites block overridden
}

export interface IEducationEnrollmentContract {
  enrollStudent(input: EnrollStudentInput): Promise<EducationEnrollmentDTO>;
  getEnrollment(tenantId: string, enrollmentId: string): Promise<EducationEnrollmentDTO | null>;
}
