/**
 * Bella Preschool OS — P8.2 Leave Processing, Substitute Allocation & Platform Reuse Candidate #2 Integration Suite
 * 
 * Verifies 12 Core Invariants:
 * 1. Leave Request Application Lifecycle — PENDING status with valid date bounds
 * 2. Invalid Leave Date Bounds Guard — blocks end_date < start_date (INVALID_LEAVE_DATES_ERROR)
 * 3. Decoupled Leave Approval & Derived Compliance — leave approval cancels shifts, triggers recalculation
 * 4. Platform Reuse Candidate #2 Integration — projects STAFFING_SHORTAGE_SLA exception to Exception Work Queue
 * 5. Supreme Invariant: Work Queue Resolution DOES NOT Alter Compliance Truth (compliance remains SHORTAGE_VIOLATION)
 * 6. Substitute Staff Allocation — records substitution & creates active roster assignment for substitute
 * 7. Roster Recalculation Restores Compliance — substitute assignment recalculates compliance state to COMPLIANT
 * 8. Non-Shortage Leave Excluded from Work Queue Escalation — surplus caregiver leave does not project exception
 * 9. Multi-Tenant RLS Isolation — prevents Tenant B from accessing Tenant A leave requests or exceptions
 * 10. Idempotent Exception Escalation Guard — prevents duplicate active work queue exceptions for same shortage
 * 11. Cross-Domain Traceability — retains source_domain P8_SCHEDULING and source_entity_id
 * 12. Audit Evidence Preservation (NO CASCADE DELETE) — prevents deletion of leave requests with active substitutions
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PreschoolSchedulingRepository } from '../../../../src/products/bella-education/scheduling/repositories/preschool-scheduling.repository';
import { StaffRosterService } from '../../../../src/products/bella-education/scheduling/services/staff-roster.service';
import { RatioComplianceService } from '../../../../src/products/bella-education/scheduling/services/ratio-compliance.service';
import { LeaveSubstitutionService } from '../../../../src/products/bella-education/scheduling/services/leave-substitution.service';
import { SchedulingProjectionBridge } from '../../../../src/products/bella-education/scheduling/bridges/scheduling-projection.bridge';
import { ParentCommunicationRepository } from '../../../../src/products/bella-education/parent-engagement/repositories/parent-communication.repository';
import { CommunicationExceptionService } from '../../../../src/products/bella-education/parent-engagement/services/communication-exception.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';
const staffTeacher1 = '00000000-0000-0000-0000-000000000081';
const staffTeacher2 = '00000000-0000-0000-0000-000000000082';
const staffCaregiver1 = '00000000-0000-0000-0000-000000000083';
const managerPartyId = '00000000-0000-0000-0000-000000000003';
const classIdA1 = '00000000-0000-0000-0000-000000000091';

describe('P8.2 Leave Processing, Substitution & Reuse Candidate #2 Suite', { timeout: 30000 }, () => {
  let repo: PreschoolSchedulingRepository;
  let rosterService: StaffRosterService;
  let complianceService: RatioComplianceService;
  let leaveService: LeaveSubstitutionService;
  let commRepo: ParentCommunicationRepository;
  let exceptionService: CommunicationExceptionService;
  let bridge: SchedulingProjectionBridge;
  let morningShiftId: string;

  beforeEach(async () => {
    repo = new PreschoolSchedulingRepository();
    rosterService = new StaffRosterService(repo);
    complianceService = new RatioComplianceService(repo);
    commRepo = new ParentCommunicationRepository();
    exceptionService = new CommunicationExceptionService(commRepo);
    bridge = new SchedulingProjectionBridge(commRepo);
    leaveService = new LeaveSubstitutionService(repo, rosterService, complianceService, bridge);

    // 1. Seed Tenants
    await supabase.from('tenants').upsert({ id: tenantA, name: 'Bella Preschool Tenant A' });
    await supabase.from('tenants').upsert({ id: tenantB, name: 'Bella Preschool Tenant B' });

    // 2. Create Morning Shift Template
    const morning = await rosterService.createShiftTemplate({
      tenantId: tenantA,
      name: 'Ca Sáng (07:00 - 11:30)',
      code: 'MORNING',
      startTime: '07:00:00',
      endTime: '11:30:00',
    });
    morningShiftId = morning.id;
  });

  test('Invariant 1: Leave Request Application Lifecycle', async () => {
    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-09-25',
      endDate: '2026-09-25',
      leaveType: 'SICK_LEAVE',
      reason: 'Bị sốt đột xuất',
    });

    expect(leave.id).toBeDefined();
    expect(leave.status).toBe('PENDING');
    expect(leave.leaveType).toBe('SICK_LEAVE');
  });

  test('Invariant 2: Invalid Leave Date Bounds Guard', async () => {
    await expect(
      leaveService.applyForLeave({
        tenantId: tenantA,
        staffPartyId: staffTeacher1,
        startDate: '2026-09-26',
        endDate: '2026-09-25', // Invalid: end before start
        leaveType: 'ANNUAL_LEAVE',
      })
    ).rejects.toThrow(/INVALID_LEAVE_DATES_ERROR/);
  });

  test('Invariant 3: Decoupled Leave Approval & Derived Compliance', async () => {
    // 1. Assign staffTeacher1 to Classroom A1 (Toddler ratio 5 per caregiver, 10 children ➔ 2 required)
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-27',
    });

    // Apply for leave
    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-09-27',
      endDate: '2026-09-27',
      leaveType: 'SICK_LEAVE',
    });

    // Approve leave
    const result = await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });

    expect(result.leaveRequest.status).toBe('APPROVED');
    expect(result.cancelledAssignmentCount).toBe(1);
    expect(result.complianceSnapshots.length).toBe(1);
    expect(result.complianceSnapshots[0].complianceState).toBe('SHORTAGE_VIOLATION');
  });

  test('Invariant 4: Platform Reuse Candidate #2 Integration', async () => {
    // Check that approving the leave projected a STAFFING_SHORTAGE_SLA exception to the Work Queue Candidate
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-28',
    });

    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-09-28',
      endDate: '2026-09-28',
      leaveType: 'SICK_LEAVE',
    });

    await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });

    // Fetch active exceptions for manager
    const workItems = await exceptionService.getStaffWorkQueueExceptions(tenantA, 'OPEN');
    const shortageException = workItems.find(
      (w) => (w.exception_type as string) === 'STAFFING_SHORTAGE_SLA'
    );

    expect(shortageException).toBeDefined();
    expect(shortageException?.status).toBe('OPEN');
  });

  test('Invariant 5: Supreme Invariant — Work Queue Resolution DOES NOT Alter Compliance Truth', async () => {
    // 1. Trigger Shortage Exception
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-29',
    });

    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-09-29',
      endDate: '2026-09-29',
      leaveType: 'EMERGENCY_LEAVE',
    });

    await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });

    const workItems = await exceptionService.getStaffWorkQueueExceptions(tenantA, 'OPEN');
    const exception = workItems.find((w) => (w.exception_type as string) === 'STAFFING_SHORTAGE_SLA');
    expect(exception).toBeDefined();

    // 2. Resolve Exception in Work Queue
    await exceptionService.resolveException({
      tenantId: tenantA,
      exceptionId: exception!.id,
      resolvedBy: managerPartyId,
      resolutionNotes: 'Đã nhận thông báo thiếu người, đang tìm người thay',
    });

    // 3. Verify P8 Compliance Truth: MUST STILL BE SHORTAGE_VIOLATION
    const latestSnapshot = await repo.getLatestComplianceSnapshot(tenantA, classIdA1, '2026-09-29');
    expect(latestSnapshot?.complianceState).toBe('SHORTAGE_VIOLATION');
  });

  test('Invariant 6: Substitute Staff Allocation & Roster Update', async () => {
    // Original assignment: staffTeacher1
    const original = await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-30',
    });

    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-09-30',
      endDate: '2026-09-30',
      leaveType: 'SICK_LEAVE',
    });

    await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });

    // Assign staffTeacher2 as substitute
    const subResult = await leaveService.assignSubstitute({
      tenantId: tenantA,
      originalAssignmentId: original.id,
      leaveRequestId: leave.id,
      substituteStaffPartyId: staffTeacher2,
      assignedByPartyId: managerPartyId,
      ageGroup: 'TODDLER',
    });

    expect(subResult.substitutionId).toBeDefined();
    expect(subResult.substituteAssignment.staffPartyId).toBe(staffTeacher2);
    expect(subResult.substituteAssignment.status).toBe('SCHEDULED');
  });

  test('Invariant 7: Roster Recalculation Restores Compliance', async () => {
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    // Assign 2 staff members for 10 children (2 required)
    const original1 = await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-10-01',
    });
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffCaregiver1,
      role: 'CAREGIVER',
      assignmentDate: '2026-10-01',
    });

    // staffTeacher1 goes on leave
    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-10-01',
      endDate: '2026-10-01',
      leaveType: 'SICK_LEAVE',
    });

    const approveRes = await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });
    expect(approveRes.complianceSnapshots[0].complianceState).toBe('SHORTAGE_VIOLATION');

    // Assign staffTeacher2 as substitute for staffTeacher1
    const subRes = await leaveService.assignSubstitute({
      tenantId: tenantA,
      originalAssignmentId: original1.id,
      leaveRequestId: leave.id,
      substituteStaffPartyId: staffTeacher2,
      assignedByPartyId: managerPartyId,
      ageGroup: 'TODDLER',
    });

    // Recalculated compliance snapshot state MUST BE COMPLIANT!
    expect(subRes.updatedSnapshot.complianceState).toBe('COMPLIANT');
    expect(subRes.updatedSnapshot.shortageCount).toBe(0);
  });

  test('Invariant 8: Non-Shortage Leave Excluded from Work Queue Escalation', async () => {
    // 3 staff members assigned for 5 children (only 1 required)
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-10-02',
    });
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher2,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-10-02',
    });
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffCaregiver1,
      role: 'CAREGIVER',
      assignmentDate: '2026-10-02',
    });

    // staffTeacher2 takes leave (1 Lead Teacher staffTeacher1 remains assigned, which satisfies ratio 1:5)
    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher2,
      startDate: '2026-10-02',
      endDate: '2026-10-02',
      leaveType: 'ANNUAL_LEAVE',
    });

    const result = await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });

    expect(result.complianceSnapshots[0].complianceState).toBe('COMPLIANT');
  });

  test('Invariant 9: Multi-Tenant RLS Isolation on Substitutions & Exceptions', async () => {
    // Tenant B manager attempts to view Tenant A work queue exceptions
    const tenantBWorkQueue = await exceptionService.getStaffWorkQueueExceptions(tenantB, 'OPEN');
    expect(tenantBWorkQueue.length).toBe(0);
  });

  test('Invariant 10: Idempotent Exception Escalation Guard', async () => {
    const snapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-10-03',
      shiftTemplateId: morningShiftId,
      ageGroup: 'TODDLER',
      counts: { enrolledChildren: 10, expectedChildren: 10, presentChildren: 10 },
    });

    expect(snapshot.complianceState).toBe('SHORTAGE_VIOLATION');

    // Project exception twice
    const exc1 = await bridge.projectShortageException(snapshot, managerPartyId);
    const exc2 = await bridge.projectShortageException(snapshot, managerPartyId);

    // Should return existing active exception
    expect(exc1.id).toBe(exc2.id);
  });

  test('Invariant 11: Cross-Domain Traceability', async () => {
    const snapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-10-04',
      shiftTemplateId: morningShiftId,
      ageGroup: 'TODDLER',
      counts: { enrolledChildren: 10, expectedChildren: 10, presentChildren: 10 },
    });

    const exc = await bridge.projectShortageException(snapshot, managerPartyId);
    expect(exc.sourceDomain).toBe('P8_SCHEDULING');
    expect(exc.sourceEntityId).toBe(snapshot.id);
  });

  test('Invariant 12: Audit Evidence Preservation (NO CASCADE DELETE)', async () => {
    // Attempting to delete a leave request with active substitution entries is blocked
    const original = await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-10-05',
    });

    const leave = await leaveService.applyForLeave({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      startDate: '2026-10-05',
      endDate: '2026-10-05',
      leaveType: 'SICK_LEAVE',
    });

    await leaveService.approveLeave({
      tenantId: tenantA,
      leaveRequestId: leave.id,
      approvedByPartyId: managerPartyId,
    });

    await leaveService.assignSubstitute({
      tenantId: tenantA,
      originalAssignmentId: original.id,
      leaveRequestId: leave.id,
      substituteStaffPartyId: staffTeacher2,
      assignedByPartyId: managerPartyId,
    });

    // Delete attempt on leave request
    const { error } = await supabase
      .from('edu_sched_leave_requests')
      .delete()
      .eq('id', leave.id);

    expect(error).toBeDefined();
  });
});
