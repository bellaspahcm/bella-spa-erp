/**
 * Education OS — Capacity Concurrency Adversarial Integration Test
 * 
 * Verifies Check 2:
 * - Adversarial concurrent execution on full course (25/25 + 2 concurrent requests)
 * - Atomic single-slot race (24/25 + 2 concurrent requests -> 1 succeeds, 1 fails)
 * - Database check constraint supremacy (current_enrollment <= max_students)
 * 
 * @module platform/education/__tests__/capacity-concurrency.integration.test
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { MemoryEventBusAdapter } from '../../core/events';
import { Course } from '../domain/course.entity';
import { EducationEngineService } from '../education-engine.service';
import { SupabaseEducationRepository } from '../repositories/supabase-education.repository';
import crypto from 'crypto';

jest.setTimeout(60000);

describe('Education OS — Capacity Concurrency Invariant Bounded Check', () => {
  let supabase: SupabaseClient<Record<string, unknown>>;
  let eventBus: MemoryEventBusAdapter;
  let repository: SupabaseEducationRepository;
  let service: EducationEngineService;

  const TEST_TENANT = '99999999-9999-9999-9999-99999999999c';

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Missing Supabase credentials for integration tests');
    }

    supabase = createClient(supabaseUrl, supabaseKey);
    eventBus = new MemoryEventBusAdapter();
    repository = new SupabaseEducationRepository(supabase);
    service = new EducationEngineService(repository, eventBus);

    await cleanupDb();

    await supabase.from('tenants').upsert([
      { id: TEST_TENANT, name: 'Capacity Concurrency School', status: 'active' },
    ]);
  });

  afterAll(async () => {
    await cleanupDb();
  });

  async function cleanupDb() {
    await supabase.from('edu_enrollments').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('enrollments').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('edu_courses').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('courses').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('students').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('persons').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('party_parties').delete().eq('tenant_id', TEST_TENANT);
    await supabase.from('tenants').delete().eq('id', TEST_TENANT);
  }

  async function seedStudent(studentCode: string, name: string): Promise<string> {
    const personId = crypto.randomUUID();

    const { error: err1 } = await supabase.from('party_parties').insert({
      id: personId,
      tenant_id: TEST_TENANT,
      party_type: 'person',
      display_name: name,
    });
    if (err1) throw new Error(`seedStudent party_parties failed: ${err1.message}`);

    const { error: err2 } = await supabase.from('persons').insert({
      id: personId,
      tenant_id: TEST_TENANT,
      first_name: name.split(' ')[0],
      last_name: name.split(' ')[1] || 'Student',
      date_of_birth: '2020-01-01',
      gender: 'female',
    });
    if (err2) throw new Error(`seedStudent persons failed: ${err2.message}`);

    const studentId = crypto.randomUUID();
    const { error: err3 } = await supabase.from('students').insert({
      student_id: studentId,
      tenant_id: TEST_TENANT,
      person_id: personId,
      student_code: studentCode,
      academic_status: 'enrolled',
      enrollment_type: 'full_time',
      program_id: 'prog-preschool',
      enrollment_date: '2026-01-01',
    });
    if (err3) throw new Error(`seedStudent students failed: ${err3.message}`);

    return personId;
  }

  async function seedCourse(courseCode: string, title: string, maxStudents: number, currentEnrollment: number): Promise<Course> {
    const courseId = crypto.randomUUID();

    const course = Course.reconstitute({
      id: courseId,
      tenantId: TEST_TENANT,
      courseCode,
      title,
      status: 'active',
      maxStudents,
      currentEnrollment,
      prerequisiteCourseCodes: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await repository.saveCourse(course);

    const { error } = await supabase.from('courses').insert({
      course_id: courseId,
      tenant_id: TEST_TENANT,
      course_code: courseCode,
      course_name: title,
      credits: 3,
      status: 'active',
    });
    if (error) throw new Error(`seedCourse courses failed: ${error.message}`);

    return course;
  }

  it('should enforce 25/25 full course concurrency: 2 concurrent requests on full course MUST BOTH FAIL without over-subscribing', async () => {
    // 1. Seed course with max_students = 25, current_enrollment = 25
    const course = await seedCourse('CAP-25-FULL', 'Lớp Mầm A (Full 25/25)', 25, 25);

    // 2. Seed 2 new students
    const studentA = await seedStudent('STU-26', 'Student Twenty-Six');
    const studentB = await seedStudent('STU-27', 'Student Twenty-Seven');

    // 3. Fire 2 concurrent enrollment calls at the exact same millisecond
    const reqA = service.enrollStudent({
      tenantId: TEST_TENANT,
      studentPartyId: studentA,
      courseId: course.id,
      requestId: crypto.randomUUID(),
    });

    const reqB = service.enrollStudent({
      tenantId: TEST_TENANT,
      studentPartyId: studentB,
      courseId: course.id,
      requestId: crypto.randomUUID(),
    });

    const results = await Promise.allSettled([reqA, reqB]);

    // 4. Verify BOTH requests were rejected with capacity error
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
    const fulfilled = results.filter(r => r.status === 'fulfilled');

    expect(fulfilled).toHaveLength(0);
    expect(rejected).toHaveLength(2);

    rejected.forEach(err => {
      expect(err.reason.message).toContain('Course capacity exceeded');
    });

    // 5. Verify database current_enrollment remains strictly 25
    const dbCourse = await repository.findCourseById(course.id, TEST_TENANT);
    expect(dbCourse?.currentEnrollment).toBe(25);
  });

  it('should enforce 24/25 single-slot concurrency: 2 concurrent requests on 24/25 course -> EXACTLY 1 succeeds, EXACTLY 1 fails', async () => {
    // 1. Seed course with max_students = 25, current_enrollment = 24
    const course = await seedCourse('CAP-25-RACE', 'Lớp Chồi B (24/25)', 25, 24);

    // 2. Seed 2 new candidate students for the 25th slot
    const candidateX = await seedStudent('STU-SLOT-X', 'Candidate X');
    const candidateY = await seedStudent('STU-SLOT-Y', 'Candidate Y');

    // 3. Fire 2 concurrent requests at the exact same millisecond
    const pX = service.enrollStudent({
      tenantId: TEST_TENANT,
      studentPartyId: candidateX,
      courseId: course.id,
      requestId: crypto.randomUUID(),
    });

    const pY = service.enrollStudent({
      tenantId: TEST_TENANT,
      studentPartyId: candidateY,
      courseId: course.id,
      requestId: crypto.randomUUID(),
    });

    const results = await Promise.allSettled([pX, pY]);

    const fulfilled = results.filter(r => r.status === 'fulfilled') as PromiseFulfilledResult<any>[];
    const rejected = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);

    expect(fulfilled[0].value.success).toBe(true);
    expect(rejected[0].reason.message).toContain('Course capacity exceeded');

    // 4. Verify database state: current_enrollment is EXACTLY 25
    const dbCourse = await repository.findCourseById(course.id, TEST_TENANT);
    expect(dbCourse?.currentEnrollment).toBe(25);
  });

  it('should prove database check constraint supremacy (chk_edu_courses_capacity blocks direct SQL update exceeding max_students)', async () => {
    const course = await seedCourse('CAP-SQL-GUARD', 'Lớp Lá C (Direct SQL Guard)', 25, 25);

    // Attempt direct raw SQL update attempting to bypass application layer
    const { error } = await supabase
      .from('edu_courses')
      .update({ current_enrollment: 26 })
      .eq('id', course.id)
      .eq('tenant_id', TEST_TENANT);

    expect(error).toBeDefined();
    expect(error?.message).toContain('chk_edu_courses_capacity');
  });
});
