import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { createClient } from '@supabase/supabase-js';
import { TeacherService } from '../services/teacher.service';
import { CreateTeacherInput, UpdateTeacherInput } from '../types/teacher.types';

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

describe('E4 — Teacher Service', () => {
  let service: TeacherService;
  let testTenantId: string;
  let testBranchId: string;
  let testPartyId: string;
  let createdTeacherIds: string[] = [];

  beforeEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    service = new TeacherService(supabase);

    const { data: tenant } = await supabase.from('tenants').select('id').limit(1).single();
    testTenantId = tenant?.id || '';

    const { data: branch } = await supabase.from('org_units').select('id').eq('tenant_id', testTenantId).limit(1).single();
    testBranchId = branch?.id || '';

    const { data: party } = await supabase.from('parties').insert({
      tenant_id: testTenantId,
      party_type: 'person',
      metadata: { test: true, role: 'teacher' },
    }).select().single();
    testPartyId = party?.id || '';
  });

  afterEach(async () => {
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    if (createdTeacherIds.length > 0) {
      await supabase.from('english_center_teachers').delete().in('id', createdTeacherIds);
    }
    if (testPartyId) {
      await supabase.from('parties').delete().eq('id', testPartyId);
    }

    createdTeacherIds = [];
  });

  it('should create teacher with certifications', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
      certifications: [
        { type: 'TESOL', issuer: 'Trinity', year: 2020 },
        { type: 'CELTA', issuer: 'Cambridge', year: 2021 },
      ],
      specializations: ['IELTS', 'Business English'],
      languages: ['English', 'Vietnamese'],
    };

    const teacher = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(teacher.id);

    expect(teacher).toBeDefined();
    expect(teacher.partyId).toBe(testPartyId);
    expect(teacher.employeeCode).toBe(input.employeeCode);
    expect(teacher.certifications).toHaveLength(2);
    expect(teacher.specializations).toContain('IELTS');
    expect(teacher.status).toBe('active');
  });

  it('should retrieve teacher by id', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
    };

    const created = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(created.id);

    const retrieved = await service.getTeacher(testTenantId, created.id);

    expect(retrieved).toBeDefined();
    expect(retrieved?.id).toBe(created.id);
    expect(retrieved?.partyId).toBe(testPartyId);
  });

  it('should list teachers with filters', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
      status: 'active',
    };

    const teacher = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(teacher.id);

    const result = await service.listTeachers(testTenantId, { status: 'active' });

    expect(result.teachers).toBeDefined();
    expect(result.teachers.length).toBeGreaterThan(0);
    const found = result.teachers.find(t => t.id === teacher.id);
    expect(found).toBeDefined();
  });

  it('should update teacher certifications', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
      certifications: [{ type: 'TESOL', year: 2020 }],
    };

    const created = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(created.id);

    const updateInput: UpdateTeacherInput = {
      certifications: [
        { type: 'TESOL', year: 2020 },
        { type: 'DELTA', issuer: 'Cambridge', year: 2023 },
      ],
    };

    const updated = await service.updateTeacher(testTenantId, created.id, updateInput);

    expect(updated.certifications).toHaveLength(2);
    expect(updated.certifications.some(c => c.type === 'DELTA')).toBe(true);
  });

  it('should assign teacher to branch', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
    };

    const teacher = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(teacher.id);

    const assignment = await service.assignBranch(testTenantId, teacher.id, testBranchId, true);

    expect(assignment).toBeDefined();
    expect(assignment.teacherId).toBe(teacher.id);
    expect(assignment.branchId).toBe(testBranchId);
    expect(assignment.isPrimary).toBe(true);
    expect(assignment.status).toBe('active');
  });

  it('should list teacher branch assignments', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
    };

    const teacher = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(teacher.id);

    await service.assignBranch(testTenantId, teacher.id, testBranchId, true);

    const branches = await service.listTeacherBranches(testTenantId, teacher.id);

    expect(branches).toBeDefined();
    expect(branches.length).toBeGreaterThan(0);
    expect(branches[0].branchId).toBe(testBranchId);
    expect(branches[0].isPrimary).toBe(true);
  });

  it('should enforce tenant isolation', async () => {
    const input: CreateTeacherInput = {
      partyId: testPartyId,
      employeeCode: `TEACHER-${Date.now()}`,
    };

    const created = await service.createTeacher(testTenantId, input);
    createdTeacherIds.push(created.id);

    const fakeTenantId = '00000000-0000-0000-0000-000000000000';
    const retrieved = await service.getTeacher(fakeTenantId, created.id);

    expect(retrieved).toBeNull();
  });

  it('should handle non-existent teacher', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const retrieved = await service.getTeacher(testTenantId, fakeId);

    expect(retrieved).toBeNull();
  });
});
