import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { EnrollmentService } from '../services/enrollment.service';
import { CreateEnrollmentInput, UpdateEnrollmentInput } from '../types/enrollment.types';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

describe('E2 — Enrollment Service', () => {
  let service: EnrollmentService;
  let testTenantId: string;
  let testBranchId: string;
  let testStudentId: string;
  let testProgramId: string;
  let createdEnrollmentIds: string[] = [];

  beforeEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    service = new EnrollmentService(supabase);

    // Setup test data
    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    testTenantId = tenant?.id || '';

    const { data: branch } = await supabase.from('org_units').select('id').eq('tenant_id', testTenantId).limit(1).single();
    testBranchId = branch?.id || '';

    // Create test student (party)
    const { data: party } = await supabase.from('parties').insert({
      tenant_id: testTenantId,
      party_type: 'person',
      metadata: { test: true },
    }).select().single();
    testStudentId = party?.id || '';

    // Create test program
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
    if (testStudentId) await supabase.from('parties').delete().eq('id', testStudentId);

    createdEnrollmentIds = [];
  });

  it('1/8 - should create enrollment with valid data', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
      metadata: { source: 'test' },
    };

    const enrollment = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(enrollment.id);

    expect(enrollment).toBeDefined();
    expect(enrollment.id).toBeDefined();
    expect(enrollment.tenantId).toBe(testTenantId);
    expect(enrollment.studentId).toBe(testStudentId);
    expect(enrollment.programId).toBe(testProgramId);
    expect(enrollment.branchId).toBe(testBranchId);
    expect(enrollment.status).toBe('pending');
  });

  it('2/8 - should retrieve enrollment by id', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const retrieved = await service.getEnrollment(testTenantId, created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.studentId).toBe(testStudentId);
  });

  it('3/8 - should list enrollments with filters', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
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

  it('4/8 - should update enrollment status', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const updateInput: UpdateEnrollmentInput = { status: 'active' };
    const updated = await service.updateEnrollment(testTenantId, created.id, updateInput);

    expect(updated.status).toBe('active');
    expect(updated.id).toBe(created.id);
  });

  it('5/8 - should finalize enrollment', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const finalized = await service.finalizeEnrollment(testTenantId, created.id);

    expect(finalized.status).toBe('active');
    expect(finalized.enrollmentDate).toBeDefined();
  });

  it('6/8 - should enforce tenant isolation', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
    };

    const created = await service.createEnrollment(testTenantId, input);
    createdEnrollmentIds.push(created.id);

    const fakeTenantId = '00000000-0000-0000-0000-000000000000';
    const retrieved = await service.getEnrollment(fakeTenantId, created.id);

    expect(retrieved).toBeNull();
  });

  it('7/8 - should enforce branch isolation', async () => {
    const input: CreateEnrollmentInput = {
      studentId: testStudentId,
      programId: testProgramId,
      branchId: testBranchId,
      startDate: new Date().toISOString(),
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
