/**
 * Education OS — Teacher Assignment Canonical Path Integration Test
 * 
 * Verifies Check 1:
 * - Canonical persistence on teacher_assignments table
 * - Hard invariant enforcement: Max 1 active lead teacher per classroom/course per academic year
 * - Co-teacher co-existence
 * - Termination and reassignment lifecycle
 * - Zero shadow persistence in courses.metadata
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TeacherAssignmentContractImpl } from '../contracts/teacher-assignment.contract.impl';
import crypto from 'crypto';

jest.setTimeout(60000);

describe('Education OS — Teacher Assignment Bounded Check', () => {
  let supabase: SupabaseClient<Record<string, unknown>>;
  let contract: TeacherAssignmentContractImpl;

  const TEST_TENANT = '88888888-8888-8888-8888-88888888888b';
  let courseId: string;
  let teacherPartyA: string;
  let teacherPartyB: string;
  let teacherPartyC: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for integration tests');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    contract = new TeacherAssignmentContractImpl(supabase);

    await cleanupDb();

    // 1. Seed tenant
    await supabase.from('tenants').upsert([
      { id: TEST_TENANT, name: 'Teacher Assignment Testing School', status: 'active' },
    ]);

    // 2. Seed course
    courseId = crypto.randomUUID();
    const { error: courseErr } = await supabase.from('courses').insert({
      course_id: courseId,
      tenant_id: TEST_TENANT,
      course_code: 'CLASS-KINDERGARTEN-01',
      course_name: 'Lớp Mầm Chồi 1 - Niên học 2025-2026',
      credits: 3,
      status: 'active',
    });
    if (courseErr) throw new Error(`Failed to seed course: ${courseErr.message}`);

    // 3. Seed teacher parties in party_parties + persons
    teacherPartyA = crypto.randomUUID();
    teacherPartyB = crypto.randomUUID();
    teacherPartyC = crypto.randomUUID();

    for (const [id, name] of [
      [teacherPartyA, 'Cô Nguyễn Thị Hoa'],
      [teacherPartyB, 'Cô Trần Thi Mai'],
      [teacherPartyC, 'Thầy Lê Văn An'],
    ] as const) {
      const { error: pErr } = await supabase.from('party_parties').insert({
        id,
        tenant_id: TEST_TENANT,
        party_type: 'person',
        display_name: name,
      });
      if (pErr) throw new Error(`Failed to seed party ${name}: ${pErr.message}`);

      const { error: perErr } = await supabase.from('persons').insert({
        id,
        tenant_id: TEST_TENANT,
        first_name: name.split(' ')[1] || 'Cô',
        last_name: name.split(' ')[2] || 'Teacher',
        date_of_birth: '1990-05-15',
        gender: 'female',
      });
      if (perErr) throw new Error(`Failed to seed person ${name}: ${perErr.message}`);
    }
  });

  afterAll(async () => {
    await cleanupDb();
  });

  async function cleanupDb() {
    await supabase.from('teacher_assignments').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('courses').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('persons').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('party_parties').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('tenants').delete().eq('id', TEST_TENANT);
  }

  it('should assign primary lead teacher to course for Academic Year 2025-2026', async () => {
    const assignment = await contract.assignTeacher({
      tenantId: TEST_TENANT,
      courseId,
      teacherPartyId: teacherPartyA,
      role: 'lead_teacher',
      academicYear: '2025-2026',
    });

    expect(assignment.assignmentId).toBeDefined();
    expect(assignment.tenantId).toBe(TEST_TENANT);
    expect(assignment.courseId).toBe(courseId);
    expect(assignment.teacherPartyId).toBe(teacherPartyA);
    expect(assignment.role).toBe('lead_teacher');
    expect(assignment.academicYear).toBe('2025-2026');
    expect(assignment.status).toBe('active');

    // Verify row in database table teacher_assignments
    const { data: row } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('assignment_id', assignment.assignmentId)
      .single();

    expect(row).toBeDefined();
    expect(row.teacher_party_id).toBe(teacherPartyA);
    expect(row.role).toBe('lead_teacher');
  });

  it('should enforce hard invariant: attempting to assign second lead teacher for same course and academic year throws TEACHER_ASSIGNMENT_CONFLICT', async () => {
    await expect(
      contract.assignTeacher({
        tenantId: TEST_TENANT,
        courseId,
        teacherPartyId: teacherPartyB,
        role: 'lead_teacher',
        academicYear: '2025-2026',
      })
    ).rejects.toThrow('TEACHER_ASSIGNMENT_CONFLICT');
  });

  it('should allow assigning co-teacher alongside active lead teacher for same course & academic year', async () => {
    const coTeacherAssign = await contract.assignTeacher({
      tenantId: TEST_TENANT,
      courseId,
      teacherPartyId: teacherPartyC,
      role: 'co_teacher',
      academicYear: '2025-2026',
    });

    expect(coTeacherAssign.assignmentId).toBeDefined();
    expect(coTeacherAssign.role).toBe('co_teacher');
    expect(coTeacherAssign.status).toBe('active');

    // Query active roster for classroom
    const activeTeachers = await contract.getCourseTeachers(TEST_TENANT, courseId, '2025-2026');
    expect(activeTeachers).toHaveLength(2);

    const roles = activeTeachers.map(t => t.role);
    expect(roles).toContain('lead_teacher');
    expect(roles).toContain('co_teacher');
  });

  it('should allow assigning new lead teacher after terminating previous lead teacher', async () => {
    const roster = await contract.getCourseTeachers(TEST_TENANT, courseId, '2025-2026');
    const activeLead = roster.find(t => t.role === 'lead_teacher');
    expect(activeLead).toBeDefined();

    // Terminate Teacher A's lead assignment
    const terminated = await contract.terminateAssignment({
      tenantId: TEST_TENANT,
      assignmentId: activeLead!.assignmentId,
    });
    expect(terminated.status).toBe('terminated');
    expect(terminated.effectiveEndDate).toBeDefined();

    // Now assigning Teacher B as lead teacher for 2025-2026 must succeed
    const newLead = await contract.assignTeacher({
      tenantId: TEST_TENANT,
      courseId,
      teacherPartyId: teacherPartyB,
      role: 'lead_teacher',
      academicYear: '2025-2026',
    });

    expect(newLead.assignmentId).toBeDefined();
    expect(newLead.teacherPartyId).toBe(teacherPartyB);
    expect(newLead.role).toBe('lead_teacher');
    expect(newLead.status).toBe('active');
  });

  it('should verify ZERO shadow persistence in courses.metadata', async () => {
    const { data: courseRow } = await supabase
      .from('courses')
      .select('metadata')
      .eq('course_id', courseId)
      .single();

    // Verify metadata does NOT contain any teacher_assignments shadow data
    expect(courseRow?.metadata).toBeNull();
  });
});
