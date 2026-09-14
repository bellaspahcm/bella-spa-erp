/**
 * E2 — English Center Enrollment Service
 * Architecture: Product service consuming Platform Education Enrollment Contract
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EnrollmentContractImpl } from '@/platform/education/contracts/enrollment.contract.impl';
import { IEducationEnrollmentContract } from '@/platform/education/contracts/enrollment.contract';
import { EnglishCenterEnrollmentRepository } from '../repositories/enrollment.repository';
import {
  CreateEnglishEnrollmentInput,
  EnglishCenterEnrollmentView,
  ListEnrollmentsFilter,
  UpdateEnglishEnrollmentInput,
} from '../types/enrollment.types';

export class EnglishCenterEnrollmentService {
  private readonly enrollmentContract: IEducationEnrollmentContract;
  private readonly repository: EnglishCenterEnrollmentRepository;

  constructor(
    private readonly supabase: SupabaseClient,
    enrollmentContract?: IEducationEnrollmentContract
  ) {
    this.enrollmentContract = enrollmentContract ?? new EnrollmentContractImpl();
    this.repository = new EnglishCenterEnrollmentRepository(supabase);
  }

  /**
   * Create English Center enrollment
   * 1. Call Platform Enrollment Contract to create canonical enrollment
   * 2. Create English Center extension with branch/program/class context
   */
  async createEnrollment(
    tenantId: string,
    input: CreateEnglishEnrollmentInput
  ): Promise<EnglishCenterEnrollmentView> {
    // Step 1: Create canonical enrollment via Platform contract
    const requestId = crypto.randomUUID();
    const canonicalEnrollment = await this.enrollmentContract.enrollStudent({
      tenantId,
      studentPartyId: input.studentPartyId,
      courseId: input.courseId,
      requestId,
    });

    // Step 2: Create English Center extension
    const extension = await this.repository.create({
      tenantId,
      canonicalEnrollmentId: canonicalEnrollment.id,
      branchId: input.branchId,
      programId: input.programId,
      classId: input.classId,
      intake: input.intake,
      englishLevelAtEnrollment: input.englishLevelAtEnrollment,
      metadata: input.metadata,
    });

    // Step 3: Combine canonical + extension
    return {
      ...extension,
      enrollmentStatus: canonicalEnrollment.status,
      studentPartyId: canonicalEnrollment.studentPartyId,
      courseId: canonicalEnrollment.courseId,
      enrolledAt: canonicalEnrollment.enrolledAt,
    };
  }

  /**
   * Get English Center enrollment by ID
   */
  async getEnrollment(
    tenantId: string,
    enrollmentId: string
  ): Promise<EnglishCenterEnrollmentView | null> {
    const extension = await this.repository.getById(tenantId, enrollmentId);
    if (!extension) return null;

    const canonicalEnrollment = await this.enrollmentContract.getEnrollment(
      tenantId,
      extension.canonicalEnrollmentId
    );
    if (!canonicalEnrollment) {
      throw new Error('Canonical enrollment not found (data integrity issue)');
    }

    return {
      ...extension,
      enrollmentStatus: canonicalEnrollment.status,
      studentPartyId: canonicalEnrollment.studentPartyId,
      courseId: canonicalEnrollment.courseId,
      enrolledAt: canonicalEnrollment.enrolledAt,
    };
  }

  /**
   * List English Center enrollments with filters
   */
  async listEnrollments(
    tenantId: string,
    filter: ListEnrollmentsFilter
  ): Promise<{ enrollments: EnglishCenterEnrollmentView[]; total: number }> {
    const { enrollments: extensions, total } = await this.repository.list({
      tenantId,
      branchId: filter.branchId,
      limit: filter.limit,
      offset: filter.offset,
    });

    // Fetch canonical enrollments for all extensions
    const canonicalEnrollmentIds = extensions.map((e) => e.canonicalEnrollmentId);
    const canonicalEnrollments = await Promise.all(
      canonicalEnrollmentIds.map((id) => this.enrollmentContract.getEnrollment(tenantId, id))
    );

    // Combine extension + canonical data
    const enrollmentsView: EnglishCenterEnrollmentView[] = extensions.map((extension, index) => {
      const canonical = canonicalEnrollments[index];
      if (!canonical) {
        throw new Error(`Canonical enrollment ${extension.canonicalEnrollmentId} not found`);
      }

      return {
        ...extension,
        enrollmentStatus: canonical.status,
        studentPartyId: canonical.studentPartyId,
        courseId: canonical.courseId,
        enrolledAt: canonical.enrolledAt,
      };
    });

    // Apply status filter if provided
    let filteredEnrollments = enrollmentsView;
    if (filter.status) {
      filteredEnrollments = enrollmentsView.filter((e) => e.enrollmentStatus === filter.status);
    }

    return {
      enrollments: filteredEnrollments,
      total: filter.status ? filteredEnrollments.length : total,
    };
  }

  /**
   * Update English Center enrollment context (class, program, metadata)
   * Note: Enrollment status/lifecycle managed by Platform contract only
   */
  async updateEnrollmentContext(
    tenantId: string,
    enrollmentId: string,
    input: UpdateEnglishEnrollmentInput
  ): Promise<EnglishCenterEnrollmentView> {
    const extension = await this.repository.update(tenantId, enrollmentId, input);

    const canonicalEnrollment = await this.enrollmentContract.getEnrollment(
      tenantId,
      extension.canonicalEnrollmentId
    );
    if (!canonicalEnrollment) {
      throw new Error('Canonical enrollment not found (data integrity issue)');
    }

    return {
      ...extension,
      enrollmentStatus: canonicalEnrollment.status,
      studentPartyId: canonicalEnrollment.studentPartyId,
      courseId: canonicalEnrollment.courseId,
      enrolledAt: canonicalEnrollment.enrolledAt,
    };
  }

  /**
   * Activate enrollment
   * Note: Delegates to Platform Enrollment Contract
   * English Center only reads status, does not manage lifecycle
   */
  async activateEnrollment(
    tenantId: string,
    enrollmentId: string
  ): Promise<EnglishCenterEnrollmentView> {
    const extension = await this.repository.getById(tenantId, enrollmentId);
    if (!extension) {
      throw new Error('English Center enrollment not found');
    }

    // Fetch current canonical enrollment
    const canonicalEnrollment = await this.enrollmentContract.getEnrollment(
      tenantId,
      extension.canonicalEnrollmentId
    );
    if (!canonicalEnrollment) {
      throw new Error('Canonical enrollment not found');
    }

    if (canonicalEnrollment.status === 'active') {
      throw new Error('Enrollment already active');
    }

    // Note: Platform Education Enrollment Contract does not expose activate()
    // Status transitions are event-driven or managed internally by Education Engine
    // For now, return current state (activation would be triggered via event)
    // In production, this would call a Platform contract method like:
    // await this.enrollmentContract.activateEnrollment(tenantId, extension.canonicalEnrollmentId);

    return {
      ...extension,
      enrollmentStatus: canonicalEnrollment.status,
      studentPartyId: canonicalEnrollment.studentPartyId,
      courseId: canonicalEnrollment.courseId,
      enrolledAt: canonicalEnrollment.enrolledAt,
    };
  }
}
