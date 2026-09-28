import { createClient, SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import { EnrollmentContractImpl } from '../contracts/enrollment.contract.impl';
import { AttendanceContractImpl } from '../contracts/attendance.contract.impl';
import { StudentService } from '../student/student.service';
import type { Database } from '@/types/database.types';

describe('Education Attendance Contract — canonical real DB chain', () => {
  let supabase: SupabaseClient<Database>;

  const tenantA = crypto.randomUUID();
  const tenantB = crypto.randomUUID();
  const studentPartyId = crypto.randomUUID();
  const courseId = crypto.randomUUID();
  const requestId = `attendance-contract-${crypto.randomUUID()}`;

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for Education Attendance real DB integration test');
    }

    supabase = createClient<Database>(supabaseUrl, supabaseKey);

    await supabase.from('tenants').insert([
      { id: tenantA, name: 'Attendance Contract Tenant A', status: 'active' },
      { id: tenantB, name: 'Attendance Contract Tenant B', status: 'active' },
    ]);

    await supabase.from('party_parties').insert({
      id: studentPartyId,
      tenant_id: tenantA,
      party_type: 'person',
      display_name: 'Attendance Contract Student',
    });

    await supabase.from('edu_courses').insert({
      id: courseId,
      tenant_id: tenantA,
      course_code: `ATT-${Date.now()}`,
      title: 'Attendance Contract Course',
      status: 'active',
      max_students: 20,
      current_enrollment: 0,
    });
  });

  async function createCanonicalStudent(partyId: string, studentCode: string) {
    const student = await StudentService.createStudent(
      {
        tenantId: tenantA,
        partyId,
        personId: null,
        studentCode,
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'preschool',
        enrollmentDate: '2026-09-26',
      },
      supabase
    );

    expect(student.partyId).toBe(partyId);
    expect(student.personId ?? null).toBeNull();

    return student;
  }

  afterAll(async () => {
    await supabase.from('edu_attendance_daily_state').delete().in('tenant_id', [tenantA, tenantB]);
    await supabase.from('edu_attendance').delete().in('tenant_id', [tenantA, tenantB]);
    await supabase.from('edu_enrollments').delete().in('tenant_id', [tenantA, tenantB]);
    await supabase.from('students').delete().in('tenant_id', [tenantA, tenantB]);
    await supabase.from('edu_courses').delete().in('tenant_id', [tenantA, tenantB]);
    await supabase.from('party_parties').delete().in('tenant_id', [tenantA, tenantB]);
    await supabase.from('tenants').delete().in('id', [tenantA, tenantB]);
  });

  it('persists attendance against the exact canonical edu_enrollments.id', async () => {
    const enrollment = await new EnrollmentContractImpl().enrollStudent({
      tenantId: tenantA,
      studentPartyId,
      courseId,
      requestId,
    });

    const rollCallTime = '2026-09-26T08:15:00.000Z';
    const attendance = await new AttendanceContractImpl().recordAttendance({
      tenantId: tenantA,
      enrollmentId: enrollment.id,
      status: 'present',
      rollCallTime,
    });

    expect(attendance.tenantId).toBe(tenantA);
    expect(attendance.enrollmentId).toBe(enrollment.id);
    expect(attendance.status).toBe('present');
    expect(new Date(attendance.rollCallTime).toISOString()).toBe(rollCallTime);

    const { data: persisted, error } = await supabase
      .from('edu_attendance')
      .select('id, tenant_id, enrollment_id, status, roll_call_time')
      .eq('id', attendance.id)
      .eq('tenant_id', tenantA)
      .single();

    expect(error).toBeNull();
    expect(persisted).toEqual({
      id: attendance.id,
      tenant_id: tenantA,
      enrollment_id: enrollment.id,
      status: 'present',
      roll_call_time: attendance.rollCallTime,
    });
  });

  it('rejects cross-tenant attendance against another tenant enrollment', async () => {
    const isolationCourseId = crypto.randomUUID();
    await supabase.from('edu_courses').insert({
      id: isolationCourseId,
      tenant_id: tenantA,
      course_code: `ISO-${Date.now()}`,
      title: 'Attendance Tenant Isolation Course',
      status: 'active',
      max_students: 20,
      current_enrollment: 0,
    });

    const enrollment = await new EnrollmentContractImpl().enrollStudent({
      tenantId: tenantA,
      studentPartyId,
      courseId: isolationCourseId,
      requestId: `${requestId}-tenant-isolation`,
    });

    await expect(
      new AttendanceContractImpl().recordAttendance({
        tenantId: tenantB,
        enrollmentId: enrollment.id,
        status: 'present',
        rollCallTime: '2026-09-26T09:00:00.000Z',
      })
    ).rejects.toThrow(`Enrollment ${enrollment.id} not found`);

    const { data: rejectedRows, error } = await supabase
      .from('edu_attendance')
      .select('id')
      .eq('tenant_id', tenantB)
      .eq('enrollment_id', enrollment.id);

    expect(error).toBeNull();
    expect(rejectedRows).toHaveLength(0);
  });

  it('upserts one daily state while preserving additive attendance events', async () => {
    const dailyPartyId = crypto.randomUUID();
    const dailyCourseId = crypto.randomUUID();
    const dailyRequestId = `${requestId}-daily-state`;

    await supabase.from('party_parties').insert({
      id: dailyPartyId,
      tenant_id: tenantA,
      party_type: 'person',
      display_name: 'Daily Attendance Student',
    });

    await createCanonicalStudent(dailyPartyId, `EDU-2026-${Date.now()}`);

    await supabase.from('edu_courses').insert({
      id: dailyCourseId,
      tenant_id: tenantA,
      course_code: `DAILY-${Date.now()}`,
      title: 'Daily Attendance State Course',
      status: 'active',
      max_students: 20,
      current_enrollment: 0,
    });

    const enrollment = await new EnrollmentContractImpl().enrollStudent({
      tenantId: tenantA,
      studentPartyId: dailyPartyId,
      courseId: dailyCourseId,
      requestId: dailyRequestId,
    });

    const contract = new AttendanceContractImpl();
    const first = await contract.setDailyAttendance({
      tenantId: tenantA,
      enrollmentId: enrollment.id,
      status: 'present',
      rollCallTime: '2026-09-26T01:15:00.000Z',
    });
    const correction = await contract.setDailyAttendance({
      tenantId: tenantA,
      enrollmentId: enrollment.id,
      status: 'excused',
      rollCallTime: '2026-09-26T02:15:00.000Z',
    });

    expect(first.status).toBe('present');
    expect(correction.status).toBe('excused');
    expect(correction.enrollmentId).toBe(enrollment.id);
    expect(correction.schoolDay).toBe('2026-09-26');

    const { data: events, error: eventError } = await supabase
      .from('edu_attendance')
      .select('id, status')
      .eq('tenant_id', tenantA)
      .eq('enrollment_id', enrollment.id);

    expect(eventError).toBeNull();
    expect(events).toHaveLength(2);

    const { data: state, error: stateError } = await supabase
      .from('edu_attendance_daily_state')
      .select('tenant_id, enrollment_id, school_day, status')
      .eq('tenant_id', tenantA)
      .eq('enrollment_id', enrollment.id)
      .eq('school_day', '2026-09-26')
      .single();

    expect(stateError).toBeNull();
    expect(state).toEqual({
      tenant_id: tenantA,
      enrollment_id: enrollment.id,
      school_day: '2026-09-26',
      status: 'excused',
    });
  });

  it('loads daily course roster through party identity without requiring person_id', async () => {
    const rosterPartyId = crypto.randomUUID();
    const rosterCourseId = crypto.randomUUID();
    const rosterRequestId = `${requestId}-roster-state`;
    const studentCode = `EDU-2026-${Date.now()}`;

    await supabase.from('party_parties').insert({
      id: rosterPartyId,
      tenant_id: tenantA,
      party_type: 'person',
      display_name: 'Roster Attendance Student',
      gender: 'female',
      dob: '2021-03-04',
    });

    await createCanonicalStudent(rosterPartyId, studentCode);

    await supabase.from('edu_courses').insert({
      id: rosterCourseId,
      tenant_id: tenantA,
      course_code: `ROSTER-${Date.now()}`,
      title: 'Attendance Roster Course',
      status: 'active',
      max_students: 20,
      current_enrollment: 0,
    });

    const enrollment = await new EnrollmentContractImpl().enrollStudent({
      tenantId: tenantA,
      studentPartyId: rosterPartyId,
      courseId: rosterCourseId,
      requestId: rosterRequestId,
    });

    const contract = new AttendanceContractImpl();
    let roster = await contract.getCourseDailyAttendance({
      tenantId: tenantA,
      courseId: rosterCourseId,
      schoolDay: '2026-09-26',
    });

    expect(roster).toHaveLength(1);
    expect(roster[0]).toMatchObject({
      enrollmentId: enrollment.id,
      studentPartyId: rosterPartyId,
      studentCode,
      name: 'Roster Attendance Student',
      gender: 'female',
      dob: '2021-03-04',
      attendance: null,
    });

    await contract.setDailyAttendance({
      tenantId: tenantA,
      enrollmentId: enrollment.id,
      status: 'present',
      rollCallTime: '2026-09-26T01:30:00.000Z',
    });

    roster = await contract.getCourseDailyAttendance({
      tenantId: tenantA,
      courseId: rosterCourseId,
      schoolDay: '2026-09-26',
    });

    expect(roster[0].attendance?.status).toBe('present');
  });
});
