/**
 * Bella Education V1 — P3.2 Classroom Management Field E2E Integration Test
 * 
 * Verifies Field E2E Closure Requirements:
 * 1. Real Auth + DB Persistence & Read-back
 * 2. Create Class Workflow with Public Contract & DB Persistence
 * 3. Critical Negative Path: HTTP 409 Conflict Rejection for duplicate Lead Teacher assignment
 * 4. Classroom 360° Workspace Data Aggregation
 * 5. Teacher Reassignment & Termination Workflow
 * 6. Tenant Isolation Gate (Tenant A cannot see Tenant B classrooms)
 * 
 * @module products/bella-education/__tests__/p32-classroom-field-e2e.integration.test
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GET as getCourses, POST as createCourse } from '@/app/api/education/courses/route';
import { GET as getCourseDetail } from '@/app/api/education/courses/[id]/route';
import { POST as assignTeacher, DELETE as terminateTeacher } from '@/app/api/education/courses/[id]/teachers/route';
import crypto from 'crypto';

jest.setTimeout(60000);

describe('BELLA EDUCATION V1 — P3.2 CLASSROOM FIELD E2E INTEGRATION', () => {
  let supabase: SupabaseClient;

  const TENANT_A = '11111111-1111-1111-1111-11111111111a';
  const TENANT_B = '22222222-2222-2222-2222-22222222222b';

  let teacherParty1: string;
  let teacherParty2: string;
  let createdCourseId: string;
  let secondaryCourseId: string;

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for field E2E test');
    }

    supabase = createClient(supabaseUrl, supabaseKey);

    await cleanupDb();

    // 1. Seed Tenant A and Tenant B
    await supabase.from('tenants').upsert([
      { id: TENANT_A, name: 'Field E2E Preschool A', status: 'active' },
      { id: TENANT_B, name: 'Field E2E Preschool B', status: 'active' },
    ]);

    // 2. Seed Teachers for Tenant A
    teacherParty1 = crypto.randomUUID();
    teacherParty2 = crypto.randomUUID();

    for (const [id, name] of [
      [teacherParty1, 'Cô Nguyễn Hoàng Yến'],
      [teacherParty2, 'Cô Phan Thu Cúc'],
    ] as const) {
      await supabase.from('party_parties').insert({
        id,
        tenant_id: TENANT_A,
        party_type: 'person',
        display_name: name,
      });

      await supabase.from('persons').insert({
        id,
        tenant_id: TENANT_A,
        first_name: name.split(' ')[2] || 'Yến',
        last_name: name.split(' ')[0] || 'Cô',
        date_of_birth: '1992-03-20',
        gender: 'female',
      });
    }
  });

  afterAll(async () => {
    await cleanupDb();
  });

  async function cleanupDb() {
    await supabase.from('teacher_assignments').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('edu_enrollments').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('enrollments').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('edu_courses').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('courses').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('students').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('persons').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('party_parties').delete().in('tenant_id', [TENANT_A, TENANT_B]);
    await supabase.from('tenants').delete().in('id', [TENANT_A, TENANT_B]);
  }

  it('Step 1: Create Class Workflow — should create classroom with lead teacher and write to PostgreSQL courses & teacher_assignments', async () => {
    const req = new Request('http://localhost/api/education/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: TENANT_A,
        courseCode: 'E2E-MAM-01',
        courseName: 'Lớp Mầm E2E — Họa Mi',
        description: 'Khối Mầm (3 tuổi)',
        maxStudents: 25,
        room: 'Phòng 105 • Tầng 1',
        teacherPartyId: teacherParty1,
        academicYear: '2025-2026',
      }),
    });

    const res = await createCourse(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.course).toBeDefined();
    expect(data.course.course_code).toBe('E2E-MAM-01');

    createdCourseId = data.course.course_id;

    // Verify DB Persistence in courses table
    const { data: dbCourse } = await supabase
      .from('courses')
      .select('*')
      .eq('course_id', createdCourseId)
      .single();

    expect(dbCourse).not.toBeNull();
    expect(dbCourse?.course_name).toBe('Lớp Mầm E2E — Họa Mi');

    // Verify DB Persistence in teacher_assignments table
    const { data: dbAssign } = await supabase
      .from('teacher_assignments')
      .select('*')
      .eq('course_id', createdCourseId)
      .eq('tenant_id', TENANT_A)
      .single();

    expect(dbAssign).not.toBeNull();
    expect(dbAssign?.teacher_party_id).toBe(teacherParty1);
    expect(dbAssign?.role).toBe('lead_teacher');
    expect(dbAssign?.status).toBe('active');
  });

  it('Step 2: Critical Negative Path — attempting to assign same Lead Teacher to 2nd classroom in same academic year returns HTTP 409 Conflict', async () => {
    // 1. Create 2nd class without lead teacher first
    const createReq = new Request('http://localhost/api/education/courses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: TENANT_A,
        courseCode: 'E2E-CHOI-02',
        courseName: 'Lớp Chồi E2E — Thỏ Ngọc',
        description: 'Khối Chồi (4 tuổi)',
        maxStudents: 25,
        room: 'Phòng 204 • Tầng 2',
        academicYear: '2025-2026',
      }),
    });

    const createRes = await createCourse(createReq);
    const createData = await createRes.json();
    expect(createRes.status).toBe(200);

    const class2Id = createData.course.course_id;
    secondaryCourseId = class2Id;

    // 2. Try assigning teacherParty1 (who is ALREADY lead teacher for E2E-MAM-01) to class2Id
    const assignReq = new Request(`http://localhost/api/education/courses/${class2Id}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: TENANT_A,
        teacherPartyId: teacherParty1,
        role: 'lead_teacher',
        academicYear: '2025-2026',
      }),
    });

    const assignParams = Promise.resolve({ id: class2Id });
    const assignRes = await assignTeacher(assignReq, { params: assignParams });
    const assignData = await assignRes.json();

    // MUST return HTTP 409 Conflict and NOT fake success!
    expect(assignRes.status).toBe(409);
    expect(assignData.success).toBe(false);
    expect(assignData.error).toContain('Xung đột: Lớp học đã có Giáo viên chủ nhiệm');
  });

  it('Step 3: Classroom 360° Workspace — GET course detail returns canonical roster and classroom metadata', async () => {
    const studentPartyId = crypto.randomUUID();
    const studentId = crypto.randomUUID();
    const excludedCourseStudentPartyId = crypto.randomUUID();
    const excludedTenantStudentPartyId = crypto.randomUUID();

    await supabase.from('party_parties').insert([
      {
        id: studentPartyId,
        tenant_id: TENANT_A,
        party_type: 'person',
        display_name: 'Bé Roster Canonical',
        dob: '2022-05-12',
        gender: 'female',
      },
      {
        id: excludedCourseStudentPartyId,
        tenant_id: TENANT_A,
        party_type: 'person',
        display_name: 'Bé Khác Lớp',
        dob: '2022-07-22',
        gender: 'male',
      },
      {
        id: excludedTenantStudentPartyId,
        tenant_id: TENANT_B,
        party_type: 'person',
        display_name: 'Bé Khác Tenant',
        dob: '2022-09-09',
        gender: 'female',
      },
    ]);

    await supabase.from('students').insert([
      {
        student_id: studentId,
        tenant_id: TENANT_A,
        party_id: studentPartyId,
        person_id: null,
        student_code: 'ROSTER-CANON-01',
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'primary',
        enrollment_date: '2026-09-26',
      },
      {
        student_id: crypto.randomUUID(),
        tenant_id: TENANT_A,
        party_id: excludedCourseStudentPartyId,
        person_id: null,
        student_code: 'ROSTER-OTHER-COURSE',
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'primary',
        enrollment_date: '2026-09-26',
      },
      {
        student_id: crypto.randomUUID(),
        tenant_id: TENANT_B,
        party_id: excludedTenantStudentPartyId,
        person_id: null,
        student_code: 'ROSTER-OTHER-TENANT',
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'primary',
        enrollment_date: '2026-09-26',
      },
    ]);

    await supabase.from('edu_enrollments').insert([
      {
        id: crypto.randomUUID(),
        tenant_id: TENANT_A,
        student_party_id: studentPartyId,
        course_id: createdCourseId,
        status: 'active',
        request_id: crypto.randomUUID(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: TENANT_A,
        student_party_id: excludedCourseStudentPartyId,
        course_id: secondaryCourseId,
        status: 'active',
        request_id: crypto.randomUUID(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: TENANT_B,
        student_party_id: excludedTenantStudentPartyId,
        course_id: createdCourseId,
        status: 'active',
        request_id: crypto.randomUUID(),
      },
      {
        id: crypto.randomUUID(),
        tenant_id: TENANT_A,
        student_party_id: studentPartyId,
        course_id: secondaryCourseId,
        status: 'cancelled',
        request_id: crypto.randomUUID(),
      },
    ]);

    const detailReq = new Request(`http://localhost/api/education/courses/${createdCourseId}?tenantId=${TENANT_A}`);
    const detailParams = Promise.resolve({ id: createdCourseId });

    const detailRes = await getCourseDetail(detailReq, { params: detailParams });
    const detailData = await detailRes.json();

    expect(detailRes.status).toBe(200);
    expect(detailData.success).toBe(true);
    expect(detailData.classroom).toBeDefined();
    expect(detailData.classroom.id).toBe(createdCourseId);
    expect(detailData.classroom.code).toBe('E2E-MAM-01');
    expect(detailData.classroom.teachers).toHaveLength(1);
    expect(detailData.classroom.teachers[0].name).toBe('Cô Nguyễn Hoàng Yến');
    expect(detailData.classroom.teachers[0].role).toBe('lead_teacher');
    expect(detailData.classroom.currentStudents).toBe(1);

    const roster = detailData.classroom.roster;
    expect(roster).toHaveLength(1);
    expect(roster[0]).toEqual(expect.objectContaining({
      studentId,
      studentPartyId,
      studentCode: 'ROSTER-CANON-01',
      name: 'Bé Roster Canonical',
      gender: 'female',
      status: 'Có mặt',
    }));
    expect(roster[0].name).not.toBe('Học sinh');
    expect(roster.some((student: { studentCode: string }) => student.studentCode === 'ROSTER-OTHER-COURSE')).toBe(false);
    expect(roster.some((student: { studentCode: string }) => student.studentCode === 'ROSTER-OTHER-TENANT')).toBe(false);

    const { count: legacyEnrollmentCount } = await supabase
      .from('enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_A)
      .eq('student_id', studentId);
    expect(legacyEnrollmentCount).toBe(0);

    const { count: personsCount } = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', TENANT_A)
      .eq('id', studentPartyId);
    expect(personsCount).toBe(0);

    const overviewReq = new Request(`http://localhost/api/education/courses?tenantId=${TENANT_A}`);
    const overviewRes = await getCourses(overviewReq);
    const overviewData = await overviewRes.json();
    const classroomOverview = overviewData.classrooms.find((item: { id: string }) => item.id === createdCourseId);
    expect(classroomOverview.students).toBe(1);
  });

  it('Step 4: Teacher Reassignment & Termination — terminate previous lead teacher, then assign new lead teacher', async () => {
    // 1. Fetch active assignment ID
    const { data: dbAssign } = await supabase
      .from('teacher_assignments')
      .select('assignment_id')
      .eq('course_id', createdCourseId)
      .eq('tenant_id', TENANT_A)
      .single();

    expect(dbAssign).not.toBeNull();
    const assignmentId = dbAssign?.assignment_id as string;

    // 2. Terminate Teacher 1
    const termReq = new Request(`http://localhost/api/education/courses/${createdCourseId}/teachers?tenantId=${TENANT_A}&assignmentId=${assignmentId}`, {
      method: 'DELETE',
    });
    const termParams = Promise.resolve({ id: createdCourseId });

    const termRes = await terminateTeacher(termReq, { params: termParams });
    const termData = await termRes.json();

    expect(termRes.status).toBe(200);
    expect(termData.success).toBe(true);
    expect(termData.terminated.status).toBe('terminated');

    // 3. Assign Teacher 2 as new Lead Teacher
    const newAssignReq = new Request(`http://localhost/api/education/courses/${createdCourseId}/teachers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: TENANT_A,
        teacherPartyId: teacherParty2,
        role: 'lead_teacher',
        academicYear: '2025-2026',
      }),
    });

    const newAssignParams = Promise.resolve({ id: createdCourseId });
    const newAssignRes = await assignTeacher(newAssignReq, { params: newAssignParams });
    const newAssignData = await newAssignRes.json();

    expect(newAssignRes.status).toBe(200);
    expect(newAssignData.success).toBe(true);
    expect(newAssignData.assignment.teacherPartyId).toBe(teacherParty2);
    expect(newAssignData.assignment.role).toBe('lead_teacher');
  });

  it('Step 5: Tenant Isolation Gate — Tenant B querying classrooms receives ZERO classes of Tenant A', async () => {
    const reqA = new Request(`http://localhost/api/education/courses?tenantId=${TENANT_A}`);
    const resA = await getCourses(reqA);
    const dataA = await resA.json();

    expect(dataA.success).toBe(true);
    expect(dataA.classrooms.length).toBeGreaterThanOrEqual(2);

    const reqB = new Request(`http://localhost/api/education/courses?tenantId=${TENANT_B}`);
    const resB = await getCourses(reqB);
    const dataB = await resB.json();

    expect(dataB.success).toBe(true);
    expect(dataB.classrooms).toHaveLength(0); // Tenant B sees ZERO Tenant A classes!
  });
});
