/**
 * Bella Preschool OS — Leave & Substitution Service
 * 
 * Processes staff leave applications, calculates roster coverage impacts,
 * projects shortage exceptions, and manages substitute staff allocations.
 */

import { PreschoolSchedulingRepository } from '../repositories/preschool-scheduling.repository';
import { StaffRosterService } from './staff-roster.service';
import { RatioComplianceService } from './ratio-compliance.service';
import { SchedulingProjectionBridge } from '../bridges/scheduling-projection.bridge';
import {
  LeaveType,
  LeaveStatus,
  RatioComplianceSnapshot,
  AgeGroup,
  CaregiverRole,
} from '../domain/scheduling.types';

export class LeaveSubstitutionService {
  private bridge: SchedulingProjectionBridge;

  constructor(
    private repo: PreschoolSchedulingRepository,
    private rosterService: StaffRosterService,
    private complianceService: RatioComplianceService,
    bridge?: SchedulingProjectionBridge
  ) {
    this.bridge = bridge || new SchedulingProjectionBridge();
  }

  async applyForLeave(input: {
    tenantId: string;
    staffPartyId: string;
    startDate: string;
    endDate: string;
    leaveType: LeaveType;
    reason?: string;
  }) {
    if (new Date(input.endDate) < new Date(input.startDate)) {
      throw new Error('INVALID_LEAVE_DATES_ERROR: End date cannot be before start date');
    }

    const leave = await this.repo.createLeaveRequest(input);

    return {
      id: leave.id,
      tenantId: leave.tenant_id,
      staffPartyId: leave.staff_party_id,
      startDate: leave.start_date,
      endDate: leave.end_date,
      leaveType: leave.leave_type as LeaveType,
      reason: leave.reason,
      status: leave.status as LeaveStatus,
      createdAt: leave.created_at,
    };
  }

  async approveLeave(input: {
    tenantId: string;
    leaveRequestId: string;
    approvedByPartyId: string;
    classroomAgeGroupMap?: Record<string, AgeGroup>; // Map classroomId -> AgeGroup
  }) {
    // 1. Update Leave Request Status
    const leave = await this.repo.approveLeaveRequest(input);

    // 2. Fetch all shift assignments for this staff during the leave period
    const assignments = await this.repo.listScheduledAssignmentsForStaffLeave({
      tenantId: input.tenantId,
      staffPartyId: leave.staff_party_id,
      startDate: leave.start_date,
      endDate: leave.end_date,
    });

    const affectedSnapshots: RatioComplianceSnapshot[] = [];

    if (assignments && assignments.length > 0) {
      // 3. Mark affected assignments as CANCELLED
      for (const assign of assignments) {
        await this.repo.updateShiftAssignmentStatus(input.tenantId, assign.id, 'CANCELLED');

        const ageGroup = (input.classroomAgeGroupMap && input.classroomAgeGroupMap[assign.classroomId]) || 'TODDLER';

        // 4. Recalculate Coverage for the classroom and date
        const snapshot = await this.complianceService.calculateAndRecordCompliance({
          tenantId: input.tenantId,
          classroomId: assign.classroomId,
          snapshotDate: assign.assignmentDate,
          shiftTemplateId: assign.shiftTemplateId,
          ageGroup,
          counts: { enrolledChildren: 10, expectedChildren: 10, presentChildren: 10 },
        });

        affectedSnapshots.push(snapshot);

        // 5. If recalculation shows SHORTAGE_VIOLATION, project exception to Work Queue
        if (snapshot.complianceState === 'SHORTAGE_VIOLATION') {
          await this.bridge.projectShortageException(snapshot, input.approvedByPartyId);
        }
      }
    }

    return {
      leaveRequest: {
        id: leave.id,
        tenantId: leave.tenant_id,
        staffPartyId: leave.staff_party_id,
        startDate: leave.start_date,
        endDate: leave.end_date,
        leaveType: leave.leave_type,
        status: leave.status,
      },
      cancelledAssignmentCount: assignments ? assignments.length : 0,
      complianceSnapshots: affectedSnapshots,
    };
  }

  async assignSubstitute(input: {
    tenantId: string;
    originalAssignmentId: string;
    leaveRequestId?: string;
    substituteStaffPartyId: string;
    assignedByPartyId: string;
    ageGroup?: AgeGroup;
  }) {
    // 1. Fetch original assignment
    const original = await this.repo.getShiftAssignment(input.tenantId, input.originalAssignmentId);
    if (!original) throw new Error('ORIGINAL_ASSIGNMENT_NOT_FOUND');

    // 2. Record substitution record
    const sub = await this.repo.createSubstitution(input);

    // 3. Assign substitute staff member to the shift
    const substituteAssignment = await this.rosterService.assignShift({
      tenantId: input.tenantId,
      classroomId: original.classroomId,
      shiftTemplateId: original.shiftTemplateId,
      staffPartyId: input.substituteStaffPartyId,
      role: original.role,
      assignmentDate: original.assignmentDate,
    });

    // 4. Recalculate ratio compliance
    const updatedSnapshot = await this.complianceService.calculateAndRecordCompliance({
      tenantId: input.tenantId,
      classroomId: original.classroomId,
      snapshotDate: original.assignmentDate,
      shiftTemplateId: original.shiftTemplateId,
      ageGroup: input.ageGroup || 'TODDLER',
      counts: { enrolledChildren: 10, expectedChildren: 10, presentChildren: 10 },
    });

    return {
      substitutionId: sub.id,
      substituteAssignment,
      updatedSnapshot,
    };
  }
}
