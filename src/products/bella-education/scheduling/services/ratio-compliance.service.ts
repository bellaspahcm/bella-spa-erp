/**
 * Bella Preschool OS — Ratio Compliance Service
 * 
 * Calculates caregiver-to-child staffing compliance based on student count contracts
 * (enrolled, expected, present) and registered ratio policies.
 */

import { PreschoolSchedulingRepository } from '../repositories/preschool-scheduling.repository';
import {
  ComplianceCalculationInput,
  RatioComplianceSnapshot,
  ComplianceState,
  AgeGroup,
} from '../domain/scheduling.types';

export class RatioComplianceService {
  constructor(private repo: PreschoolSchedulingRepository) {}

  async calculateAndRecordCompliance(
    input: ComplianceCalculationInput & { ageGroup: AgeGroup }
  ): Promise<RatioComplianceSnapshot> {
    const activityContext = input.activityContext || 'CLASSROOM_STANDARD';

    // 1. Fetch Ratio Policy for age group & context
    let policy = await this.repo.getRatioPolicy(input.tenantId, input.ageGroup, activityContext);
    
    // Fallback default policy if none explicitly registered
    if (!policy) {
      const defaultMax = input.ageGroup === 'TODDLER' ? 5 : input.ageGroup === 'NURSERY' ? 10 : 15;
      policy = await this.repo.upsertRatioPolicy({
        tenantId: input.tenantId,
        ageGroup: input.ageGroup,
        maxChildrenPerCaregiver: defaultMax,
        minLeadTeachers: 1,
        activityContext,
      });
    }

    // 2. Fetch Active Roster Assignments for classroom, date, shift
    const assignments = await this.repo.listShiftAssignments(input.tenantId, {
      classroomId: input.classroomId,
      assignmentDate: input.snapshotDate,
    });

    const activeForShift = assignments.filter(
      (a) =>
        a.shiftTemplateId === input.shiftTemplateId &&
        (a.status === 'SCHEDULED' || a.status === 'COMPLETED')
    );

    const assignedCaregivers = activeForShift.length;
    const assignedLeadTeachers = activeForShift.filter((a) => a.role === 'LEAD_TEACHER').length;

    // 3. Determine Student Baseline Count via Contract Isolation Rules
    // Rule: Prioritize present_children if attendance captured (> 0), else expected_children, else enrolled_children
    const baselineChildren =
      input.counts.presentChildren > 0
        ? input.counts.presentChildren
        : input.counts.expectedChildren > 0
        ? input.counts.expectedChildren
        : input.counts.enrolledChildren;

    // 4. Calculate Required Caregivers: ceil(baselineChildren / maxChildrenPerCaregiver)
    const requiredCaregivers = baselineChildren > 0
      ? Math.ceil(baselineChildren / policy.maxChildrenPerCaregiver)
      : 0;

    // 5. Evaluate Compliance State
    const hasEnoughCaregivers = assignedCaregivers >= requiredCaregivers;
    const hasLeadTeacher = assignedLeadTeachers >= policy.minLeadTeachers;

    const complianceState: ComplianceState =
      hasEnoughCaregivers && hasLeadTeacher ? 'COMPLIANT' : 'SHORTAGE_VIOLATION';

    const shortageCount = hasEnoughCaregivers ? 0 : Math.max(1, requiredCaregivers - assignedCaregivers);

    // 6. Record Snapshot Evidence
    return this.repo.createComplianceSnapshot({
      tenantId: input.tenantId,
      classroomId: input.classroomId,
      snapshotDate: input.snapshotDate,
      shiftTemplateId: input.shiftTemplateId,
      enrolledChildren: input.counts.enrolledChildren,
      expectedChildren: input.counts.expectedChildren,
      presentChildren: input.counts.presentChildren,
      assignedCaregivers,
      requiredCaregivers,
      complianceState,
      shortageCount,
    });
  }
}
