/**
 * BELLA EDUCATION — ATTENDANCE PRODUCT SERVICE
 *
 * Coordinates class attendance checkpoints and roll-calls.
 * Consumes the public IEducationAttendanceContract, enforcing manifest validations.
 *
 * @module src/products/bella-education/services/attendance.service
 */

import { IEducationAttendanceContract, EducationAttendanceDTO } from '../../../platform/education/contracts/attendance.contract';
import { bellaEducationManifest } from '../manifest';

export interface MarkAttendanceDTO {
  tenantId: string;
  enrollmentId: string;
  status: 'present' | 'absent' | 'excused';
  rollCallTime?: string;
}

export class AttendanceProductService {
  constructor(private readonly attendanceContract: IEducationAttendanceContract) {}

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
   * Records student attendance check-in.
   */
  async recordAttendance(dto: MarkAttendanceDTO): Promise<EducationAttendanceDTO> {
    this.assertCapability('attendance_checkpoint_command');
    this.assertWorkflow('student_academic_lifecycle');

    if (!dto.tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!dto.enrollmentId) throw new Error('ENROLLMENT_BOUNDARY_VIOLATION: enrollmentId is required');

    return this.attendanceContract.recordAttendance({
      tenantId: dto.tenantId,
      enrollmentId: dto.enrollmentId,
      status: dto.status,
      rollCallTime: dto.rollCallTime
    });
  }

  /**
   * Retrieves attendance history for enrollment.
   */
  async getAttendanceHistory(tenantId: string, enrollmentId: string): Promise<readonly EducationAttendanceDTO[]> {
    this.assertCapability('attendance_checkpoint_command');
    if (!tenantId) throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    if (!enrollmentId) throw new Error('ENROLLMENT_BOUNDARY_VIOLATION: enrollmentId is required');

    return this.attendanceContract.getAttendanceHistory(tenantId, enrollmentId);
  }
}
