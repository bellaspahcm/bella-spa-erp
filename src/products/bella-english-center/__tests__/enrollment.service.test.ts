import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { EnglishCenterEnrollmentService } from '../services/enrollment.service';
import { CreateEnglishEnrollmentInput, UpdateEnglishEnrollmentInput } from '../types/enrollment.types';
import { IEducationEnrollmentContract } from '@/platform/education/contracts/enrollment.contract';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';
const describeIfSupabase = supabaseUrl && supabaseKey ? describe : describe.skip;

describeIfSupabase('E2 — Enrollment Service', () => {
  let service: EnglishCenterEnrollmentService;
  let testTenantId: string;
  let testBranchId: string;
  let testStudentId: string;
  let testCourseId: string;
  let testProgramId: string;
  let createdEnrollmentIds: string[] = [];
  let canonicalEnrollmentId: string;

  beforeEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: branch } = await supabase
      .from('org_units')
      .select('id, tenant_id')
      .eq('is_active', true)
      .limit(1)
      .single();
    testBranchId = branch?.id || '';
    testTenantId = branch?.tenant_id || '';

    const { data: party } = await supabase.from('party_parties').insert({
      tenant_id: testTenantId,
      party_type: 'person',
      display_name: `Test Student ${Date.now()}`,
    }).select().single();
    testStudentId = party?.id || '';
    testCourseId = crypto.randomUUID();
    canonicalEnrollmentId = crypto.randomUUID();

    await supabase.from('edu_courses').insert({
      id: testCourseId,
      tenant_id: testTenantId,
      course_code: `E2-${Date.now()}`,
      title: 'E2 Test Canonical Course',
      status: 'active',
      max_students: 20,
      current_enrollment: 0,
      prerequisite_course_codes: [],
    });

    await supabase.from('edu_enrollments').insert({
      id: canonicalEnrollmentId,
      tenant_id: testTenantId,
      student_party_id: testStudentId,
      course_id: testCourseId,
      status: 'pending',
      request_id: `REQ-${Date.now()}`,
    });

    const mockEnrollmentContract: IEducationEnrollmentContract = {
      enrollStudent: jest.fn(async (input) => ({
        id: canonicalEnrollmentId,
        tenantId: input.tenantId,
        studentPartyId: input.studentPartyId,
        courseId: input.courseId,
        status: 'pending',
        enrolledAt: new Date().toISOString(),
      })),
      getEnrollment: jest.fn(async (tenantId, enrollmentId) => {
        if (tenantId !== testTenantId) {
          return null;
        }

        return {
          id: enrollmentId,
          tenantId: testTenantId,
          studentPartyId: testStudentId,
          courseId: testCourseId,
          status: 'pending',
          enrolledAt: new Date().toISOString(),
        };
      }),
    };
    service = new EnglishCenterEnrollmentService(supabase, mockEnrollmentContract);

    const { data: program } = await supabase.from('english_center_programs').insert({
      tenant_id: testTenantId,
      name: 'Test Program',
      code: `PROG-${Date.now()}`,
      description: 'Test program for enrollment tests',
      status: 'active',
    }).select().single();
    testProgramId = program?.id || '';
  });

  afterEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Cleanup created enrollments
    if (createdEnrollmentIds.length > 0) {
      await supabase.from('english_center_enrollments').delete().in('id', createdEnrollmentIds);
    }

    // Cleanup test data
    if (testProgramId) await supabase.from('english_center_programs').delete().eq('id', testProgramId);
    if (canonicalEnrollmentId) await supabase.from('edu_enrollments').delete().eq('id', canonicalEnrollmentId);
    if (testCourseId) await supabase.from('edu_courses').delete().eq('id', testCourseId);
    if (testStudentId) await supabase.from('party_parties').delete().eq('id', testStudentId);

    createdEnrollmentIds = [];
  });

  it('1/8 - should create enrollment with valid data', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
      metadata: { source: 'test' },
    };

    const enrollment = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(enrollment.id);

    expect(enrollment).toBeDefined();
    expect(enrollment.id).toBeDefined();
    expect(enrollment.tenantId).toBe(testTenantId);
    expect(enrollment.studentPartyId).toBe(testStudentId);
    expect(enrollment.programId).toBe(testProgramId);
    expect(enrollment.branchId).toBe(testBranchId);
    expect(enrollment.enrollmentStatus).toBe('pending');
  });

  it('2/8 - should retrieve enrollment by id', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const retrieved = await service.getEnrollment(testTenantId, created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.studentPartyId).toBe(testStudentId);
  });

  it('3/8 - should list enrollments with filters', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
    };

    const enrollment = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(enrollment.id);

    const result = await service.listEnrollments(testTenantId, { status: 'pending', limit: 10 });

    expect(result.enrollments).toBeDefined();
    expect(result.enrollments.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
    const found = result.enrollments.find(e => e.id === enrollment.id);
    expect(found).toBeDefined();
  });

  it('4/8 - should update enrollment context', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const updateInput: UpdateEnglishEnrollmentInput = { metadata: { updated: true } };
    const updated = await service.updateEnrollmentContext(testTenantId, created.id, updateInput);

    expect(updated.id).toBe(created.id);
    expect(updated.metadata).toMatchObject({ updated: true });
  });

  it('5/8 - should activate enrollment', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const activated = await service.activateEnrollment(testTenantId, created.id);

    expect(activated.id).toBe(created.id);
    expect(activated.enrollmentStatus).toBeDefined();
  });

  it('6/8 - should enforce tenant isolation', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const fakeTenantId = '00000000-0000-0000-0000-000000000000';
    const retrieved = await service.getEnrollment(fakeTenantId, created.id);

    expect(retrieved).toBeNull();
  });

  it('7/8 - should enforce branch isolation', async () => {
    const input: CreateEnglishEnrollmentInput = {
      studentPartyId: testStudentId,
      courseId: testCourseId,
      programId: testProgramId,
      branchId: testBranchId,
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const result = await service.listEnrollments(testTenantId, { branchId: testBranchId });
    const found = result.enrollments.find(e => e.id === created.id);
    expect(found).toBeDefined();
    expect(found?.branchId).toBe(testBranchId);
  });

  it('8/8 - should handle non-existent enrollment', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const retrieved = await service.getEnrollment(testTenantId, fakeId);

    expect(retrieved).toBeNull();
  });
});
