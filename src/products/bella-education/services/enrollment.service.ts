/**
 * BELLA EDUCATION — ENROLLMENT PRODUCT SERVICE
 *
 * Coordinates student course enrollment registrations.
 * Consumes the public IEducationEnrollmentContract and IAccountingContract,
 * enforcing tenant isolation and manifest validation.
 *
 * @module src/products/bella-education/services/enrollment.service
 */

import { IEducationEnrollmentContract, EducationEnrollmentDTO } from '../../../platform/education/contracts/enrollment.contract';
import { IAccountingContract } from '../../../platform/accounting/contracts/accounting.contract';
import { bellaEducationManifest } from '../manifest';

export interface EnrollStudentDTO {
  tenantId: string;
  studentPartyId: string;
  courseId: string;
  requestId: string;
  overrideJustification?: string;
  tuitionFeeAmount?: number; // Optional fee to post to Ledger
}

export class EnrollmentProductService {
  constructor(
    private readonly enrollmentContract: IEducationEnrollmentContract,
    private readonly accountingContract: IAccountingContract
  ) {}

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
   * Enrolls a student in a course and posts tuition fee ledger entries upon success.
   */
  async enrollStudent(dto: EnrollStudentDTO): Promise<EducationEnrollmentDTO> {
    this.assertCapability('student_enrollment_command');
    this.assertWorkflow('student_academic_lifecycle');

    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.studentPartyId) throw new Error('STUDENT_BOUNDARY_VIOLATION: studentPartyId is required');
    if (!dto.courseId) throw new Error('COURSE_BOUNDARY_VIOLATION: courseId is required');

    // 1. Perform student enrollment via public contract
    const enrollment = await this.enrollmentContract.enrollStudent({
      tenantId: dto.tenantId,
      studentPartyId: dto.studentPartyId,
      courseId: dto.courseId,
      requestId: dto.requestId,
      overrideJustification: dto.overrideJustification
    });

    // 2. Post enrollment tuition fees to Ledger if specified
    if (dto.tuitionFeeAmount && dto.tuitionFeeAmount > 0) {
      const ledgerResult = await this.accountingContract.postJournalEntry({
        tenantId: dto.tenantId,
        description: `Thu học phí môn học cho đăng ký ID ${enrollment.id}`,
        referenceType: 'enrollment',
        referenceId: enrollment.id,
        lines: [
          { accountCode: '1111', debitAmount: dto.tuitionFeeAmount, creditAmount: 0 },
          { accountCode: '5111', debitAmount: 0, creditAmount: dto.tuitionFeeAmount }
        ]
      });

      if (!ledgerResult.success) {
        throw new Error(`LEDGER_POSTING_FAILED: Failed to record tuition payment: ${ledgerResult.error}`);
      }
    }

    return enrollment;
  }
}
