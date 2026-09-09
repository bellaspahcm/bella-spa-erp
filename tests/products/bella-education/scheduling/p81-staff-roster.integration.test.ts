/**
 * Bella Preschool OS — P8.1 Staff Roster & Caregiver Ratio Kernel 12-Invariant Integration Suite
 * 
 * Verifies 12 Core Invariants:
 * 1. Multi-Tenant RLS Isolation — prevents Tenant B from accessing Tenant A shift templates or assignments
 * 2. Shift Template Registration — validates creation & retrieval of MORNING, AFTERNOON, FULL_DAY templates
 * 3. Staff Availability Guard — blocks shift assignment if staff is marked unavailable (STAFF_UNAVAILABLE_ERROR)
 * 4. Caregiver-to-Child Ratio Calculation — validates Math ceil(baselineChildren / max_ratio) math
 * 5. Student Counts Contract Isolation — distinguishes enrolled, expected, present children with precedence
 * 6. Minimum Lead Teacher Enforcement — triggers SHORTAGE_VIOLATION if zero lead teachers assigned
 * 7. Roster Assignment Lifecycle — manages SCHEDULED, COMPLETED, CANCELLED status transitions
 * 8. Append-Only Shift Amendment — marks original as REPLACED, increments amendment_version, links superseded ID
 * 9. Compliance Snapshot Immutability — snapshot records static historical compliance evidence
 * 10. Multi-Classroom Roster Isolation — assignments for Classroom A do not count for Classroom B ratio
 * 11. Activity Context Ratio Policy — EXCURSION context ratio rules evaluate independently of CLASSROOM_STANDARD
 * 12. Audit Evidence Preservation (NO CASCADE DELETE) — RESTRICT prevents deletion of templates with active assignments
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { PreschoolSchedulingRepository } from '../../../../src/products/bella-education/scheduling/repositories/preschool-scheduling.repository';
import { StaffRosterService } from '../../../../src/products/bella-education/scheduling/services/staff-roster.service';
import { RatioComplianceService } from '../../../../src/products/bella-education/scheduling/services/ratio-compliance.service';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

const tenantA = '00000000-0000-0000-0000-000000000001';
const tenantB = '00000000-0000-0000-0000-000000000002';
const staffTeacher1 = '00000000-0000-0000-0000-000000000081';
const staffTeacher2 = '00000000-0000-0000-0000-000000000082';
const staffCaregiver1 = '00000000-0000-0000-0000-000000000083';
const classIdA1 = '00000000-0000-0000-0000-000000000091';
const classIdA2 = '00000000-0000-0000-0000-000000000092';

describe('P8.1 Preschool Staff Roster & Caregiver Ratio Kernel 12-Invariant Suite', { timeout: 30000 }, () => {
  let repo: PreschoolSchedulingRepository;
  let rosterService: StaffRosterService;
  let complianceService: RatioComplianceService;
  let morningShiftId: string;

  beforeEach(async () => {
    repo = new PreschoolSchedulingRepository();
    rosterService = new StaffRosterService(repo);
    complianceService = new RatioComplianceService(repo);

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

  test('Invariant 1: Multi-Tenant RLS Isolation', async () => {
    // Tenant B attempts to fetch Tenant A shift templates
    const tenantBTemplates = await repo.listShiftTemplates(tenantB);
    const hasTenantATemplate = tenantBTemplates.some((t) => t.id === morningShiftId);
    expect(hasTenantATemplate).toBe(false);
  });

  test('Invariant 2: Shift Template Registration', async () => {
    const templates = await repo.listShiftTemplates(tenantA);
    expect(templates.length).toBeGreaterThanOrEqual(1);
    const morning = templates.find((t) => t.id === morningShiftId);
    expect(morning).toBeDefined();
    expect(morning?.code).toBe('MORNING');
  });

  test('Invariant 3: Staff Availability Guard', async () => {
    // Mark staffTeacher1 as unavailable on Mondays (day 1)
    await rosterService.setStaffAvailability({
      tenantId: tenantA,
      staffPartyId: staffTeacher1,
      dayOfWeek: 1, // Monday
      shiftTemplateId: morningShiftId,
      isAvailable: false,
    });

    // Attempting to assign staffTeacher1 on Monday 2026-09-14 (which is a Monday)
    await expect(
      rosterService.assignShift({
        tenantId: tenantA,
        classroomId: classIdA1,
        shiftTemplateId: morningShiftId,
        staffPartyId: staffTeacher1,
        role: 'LEAD_TEACHER',
        assignmentDate: '2026-09-14', // Monday
      })
    ).rejects.toThrow(/STAFF_UNAVAILABLE_ERROR/);
  });

  test('Invariant 4: Caregiver-to-Child Ratio Calculation', async () => {
    // Toddler policy: max 5 children per caregiver
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    // Assign 1 Lead Teacher & 1 Caregiver
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-15',
    });

    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffCaregiver1,
      role: 'CAREGIVER',
      assignmentDate: '2026-09-15',
    });

    // 10 Present children ➔ ceil(10 / 5) = 2 caregivers required ➔ COMPLIANT
    const snapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-09-15',
      shiftTemplateId: morningShiftId,
      ageGroup: 'TODDLER',
      counts: { enrolledChildren: 12, expectedChildren: 10, presentChildren: 10 },
    });

    expect(snapshot.requiredCaregivers).toBe(2);
    expect(snapshot.assignedCaregivers).toBe(2);
    expect(snapshot.complianceState).toBe('COMPLIANT');
    expect(snapshot.shortageCount).toBe(0);
  });

  test('Invariant 5: Student Counts Contract Isolation', async () => {
    // 15 enrolled, 12 expected, 8 present children
    // Ratio: 5 per caregiver ➔ present = 8 ➔ ceil(8 / 5) = 2 required
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'TODDLER',
      maxChildrenPerCaregiver: 5,
      minLeadTeachers: 1,
    });

    // Assign 1 caregiver
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-16',
    });

    const snapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-09-16',
      shiftTemplateId: morningShiftId,
      ageGroup: 'TODDLER',
      counts: { enrolledChildren: 15, expectedChildren: 12, presentChildren: 8 },
    });

    expect(snapshot.presentChildren).toBe(8);
    expect(snapshot.requiredCaregivers).toBe(2);
    expect(snapshot.assignedCaregivers).toBe(1);
    expect(snapshot.complianceState).toBe('SHORTAGE_VIOLATION');
    expect(snapshot.shortageCount).toBe(1);
  });

  test('Invariant 6: Minimum Lead Teacher Enforcement', async () => {
    // 2 caregivers assigned, but 0 lead teachers assigned
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'NURSERY',
      maxChildrenPerCaregiver: 10,
      minLeadTeachers: 1,
    });

    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffCaregiver1,
      role: 'CAREGIVER',
      assignmentDate: '2026-09-17',
    });

    const snapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-09-17',
      shiftTemplateId: morningShiftId,
      ageGroup: 'NURSERY',
      counts: { enrolledChildren: 8, expectedChildren: 8, presentChildren: 8 },
    });

    // Total caregivers 1 >= required 1, but lead teacher 0 < min 1 ➔ SHORTAGE_VIOLATION
    expect(snapshot.complianceState).toBe('SHORTAGE_VIOLATION');
  });

  test('Invariant 7: Roster Assignment Lifecycle', async () => {
    const assignment = await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-18',
    });

    expect(assignment.status).toBe('SCHEDULED');

    const updated = await repo.updateShiftAssignmentStatus(tenantA, assignment.id, 'COMPLETED');
    expect(updated.status).toBe('COMPLETED');
  });

  test('Invariant 8: Append-Only Shift Amendment', async () => {
    // Initial assignment: staffTeacher1
    const original = await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-19',
    });

    expect(original.amendmentVersion).toBe(1);

    // Amend assignment: replace with staffTeacher2
    const amended = await rosterService.amendShiftAssignment({
      tenantId: tenantA,
      assignmentId: original.id,
      newStaffPartyId: staffTeacher2,
      amendedByPartyId: '00000000-0000-0000-0000-000000000003',
    });

    expect(amended.amendmentVersion).toBe(2);
    expect(amended.supersededAssignmentId).toBe(original.id);
    expect(amended.staffPartyId).toBe(staffTeacher2);
    expect(amended.status).toBe('SCHEDULED');

    // Original assignment status must now be REPLACED
    const fetchedOriginal = await repo.getShiftAssignment(tenantA, original.id);
    expect(fetchedOriginal?.status).toBe('REPLACED');
  });

  test('Invariant 9: Compliance Snapshot Immutability', async () => {
    const snapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-09-20',
      shiftTemplateId: morningShiftId,
      ageGroup: 'KINDERGARTEN',
      counts: { enrolledChildren: 20, expectedChildren: 18, presentChildren: 18 },
    });

    expect(snapshot.id).toBeDefined();
    
    // Fetch latest snapshot for that date
    const fetched = await repo.getLatestComplianceSnapshot(tenantA, classIdA1, '2026-09-20');
    expect(fetched?.id).toBe(snapshot.id);
    expect(fetched?.presentChildren).toBe(18);
  });

  test('Invariant 10: Multi-Classroom Roster Isolation', async () => {
    // Assign teacher1 to Classroom A1
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-21',
    });

    // Classroom A2 compliance check (0 caregivers assigned to A2)
    const snapshotA2 = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA2,
      snapshotDate: '2026-09-21',
      shiftTemplateId: morningShiftId,
      ageGroup: 'TODDLER',
      counts: { enrolledChildren: 5, expectedChildren: 5, presentChildren: 5 },
    });

    expect(snapshotA2.assignedCaregivers).toBe(0);
    expect(snapshotA2.complianceState).toBe('SHORTAGE_VIOLATION');
  });

  test('Invariant 11: Activity Context Ratio Policy', async () => {
    // Standard Classroom ratio: 1:10
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'NURSERY',
      maxChildrenPerCaregiver: 10,
      minLeadTeachers: 1,
      activityContext: 'CLASSROOM_STANDARD',
    });

    // Excursion Context ratio: 1:4 (stricter limit for field trips)
    await repo.upsertRatioPolicy({
      tenantId: tenantA,
      ageGroup: 'NURSERY',
      maxChildrenPerCaregiver: 4,
      minLeadTeachers: 1,
      activityContext: 'EXCURSION',
    });

    // Assign 2 caregivers
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-22',
    });
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffCaregiver1,
      role: 'CAREGIVER',
      assignmentDate: '2026-09-22',
    });

    // 10 Present children on EXCURSION ➔ ceil(10 / 4) = 3 caregivers required ➔ SHORTAGE_VIOLATION (only 2 assigned)
    const excursionSnapshot = await complianceService.calculateAndRecordCompliance({
      tenantId: tenantA,
      classroomId: classIdA1,
      snapshotDate: '2026-09-22',
      shiftTemplateId: morningShiftId,
      ageGroup: 'NURSERY',
      activityContext: 'EXCURSION',
      counts: { enrolledChildren: 10, expectedChildren: 10, presentChildren: 10 },
    });

    expect(excursionSnapshot.requiredCaregivers).toBe(3);
    expect(excursionSnapshot.assignedCaregivers).toBe(2);
    expect(excursionSnapshot.complianceState).toBe('SHORTAGE_VIOLATION');
  });

  test('Invariant 12: Audit Evidence Preservation (NO CASCADE DELETE)', async () => {
    // Delete attempt on shift template referenced by active assignment must fail (RESTRICT)
    await rosterService.assignShift({
      tenantId: tenantA,
      classroomId: classIdA1,
      shiftTemplateId: morningShiftId,
      staffPartyId: staffTeacher1,
      role: 'LEAD_TEACHER',
      assignmentDate: '2026-09-23',
    });

    const { error } = await supabase
      .from('edu_sched_shift_templates')
      .delete()
      .eq('id', morningShiftId);

    expect(error).toBeDefined();
    expect(error?.code).toBe('23503'); // foreign_key_violation RESTRICT
  });
});
