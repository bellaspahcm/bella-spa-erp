/**
 * BELLA EDUCATION — ASSESSMENT PRODUCT SERVICE
 *
 * Coordinates student grading registers and GPA computations.
 * Consumes the public IEducationAssessmentContract, enforcing manifest validations.
 *
 * @module src/products/bella-education/services/assessment.service
 */

import { IEducationAssessmentContract, EducationAssessmentDTO } from '../../../platform/education/contracts/assessment.contract';
import { bellaEducationManifest } from '../manifest';

export interface RecordScoreDTO {
  tenantId: string;
  enrollmentId: string;
  scoreType: 'quiz' | 'midterm' | 'final' | 'homework';
  grade: number;
  weight: number;
  occurredAt?: string;
}

export class AssessmentProductService {
  constructor(private readonly assessmentContract: IEducationAssessmentContract) {}

  private assertCapability(capabilityId: string) {
    const capabilities = bellaEducationManifest.capabilities || [];
    if (!capabilities.includes(capabilityId)) {
      throw new Error(`MANIFEST_VIOLATION: Capability '${capabilityId}' is not enabled in product manifest.`);
    }
  }

  private assertWorkflow(workflowId: string) {
    const workflows = bellaEducationManifest.workflows || [];
    if (!workflows.includes(workflowId)) {
      throw new Error(`MANIFEST_VIOLATION: Workflow '${workflowId}' is not enabled in product manifest.`);
    }
  }

  /**
   * Records student score grade.
   */
  async recordScore(dto: RecordScoreDTO): Promise<EducationAssessmentDTO> {
    this.assertCapability('grade_reporting_command');
    this.assertWorkflow('student_academic_lifecycle');

    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.enrollmentId) throw new Error('ENROLLMENT_BOUNDARY_VIOLATION: enrollmentId is required');

    const result = await this.assessmentContract.recordScore({
      tenantId: dto.tenantId,
      enrollmentId: dto.enrollmentId,
      scoreType: dto.scoreType,
      grade: dto.grade,
      weight: dto.weight,
      occurredAt: dto.occurredAt
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to record score');
    }

    return result.data;
  }

  /**
   * Calculates GPA for student enrollment.
   */
  async calculateGpa(tenantId: string, studentId: string): Promise<number> {
    this.assertCapability('grade_reporting_command');
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!studentId) throw new Error('STUDENT_BOUNDARY_VIOLATION: studentId is required');

    const result = await this.assessmentContract.calculateGPA({
      tenantId,
      studentId
    });

    if (!result.success || !result.data) {
      throw new Error(result.error || 'Failed to calculate GPA');
    }

    return result.data.gpa;
  }
}
