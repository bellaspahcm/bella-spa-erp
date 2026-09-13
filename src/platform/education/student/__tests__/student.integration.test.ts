/**
 * Student Integration Tests
 * 
 * Tests:
 * - Party FK validation (Student requires existing Party)
 * - Tenant isolation (Student cannot access other tenant's data)
 * - CRUD operations with real database
 * - Business rules enforcement
 */

import { StudentService } from '../student.service';
import { CreateStudentRequest } from '../../shared-kernel/types';
import { createClient } from '@/lib/supabase-server';

describe('Student Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000088';
  const differentTenantId = '00000000-0000-0000-0000-000000000089';
  const systemUserId = '00000000-0000-0000-0000-000000000001'; // System user UUID (not 'test-system' string)
  let partyId: string;
  let studentId: string;
  let supabase: ReturnType<typeof createClient>;

  beforeAll(async () => {
    supabase = await createClient();

    // Ensure test tenants exist in DB
    const { error: tenant1Error } = await supabase
      .from('tenants')
      .upsert({
        id: tenantId,
        name: 'Education Test Tenant 1',
        status: 'active',
      });
    if (tenant1Error) {
      throw new Error(`Failed to create test tenant 1: ${tenant1Error.message}`);
    }

    const { error: tenant2Error } = await supabase
      .from('tenants')
      .upsert({
        id: differentTenantId,
        name: 'Education Test Tenant 2',
        status: 'active',
      });
    if (tenant2Error) {
      throw new Error(`Failed to create test tenant 2: ${tenant2Error.message}`);
    }
    
    // R6.5: Create Party fixture (migrated from Person)
    const { data: party, error: partyError } = await supabase
      .from('party_parties')
      .insert({
        tenant_id: tenantId,
        party_type: 'person',
        display_name: 'John Doe',
        created_by: systemUserId,
      })
      .select()
      .single();
    
    if (partyError || !party) {
      throw new Error(`Party creation failed: ${partyError?.message}`);
    }
    
    // R6.5: Create minimal Person record for FK compatibility
    const { data: person, error: personError } = await supabase
      .from('persons')
      .insert({
        id: party.id,
        tenant_id: tenantId,
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2000-01-15',
        gender: 'male',
        created_by: systemUserId,
      })
      .select()
      .single();
    
    if (personError || !person) {
      throw new Error(`Person FK compatibility record creation failed: ${personError?.message}`);
    }
    
    partyId = party.id;
  });

  afterAll(async () => {
    // Cleanup test data
    const supabase = await createClient();
    
    // Delete students first (FK constraint)
    await supabase.from('students').delete().in('tenant_id', [tenantId, differentTenantId]);
    
    // Delete persons
    await supabase.from('persons').delete().in('tenant_id', [tenantId, differentTenantId]);

    // Delete tenants
    await supabase.from('tenants').delete().in('id', [tenantId, differentTenantId]);
  });

  describe('Person FK Validation', () => {
    it('should create student with valid Party', async () => {
      const request: CreateStudentRequest = {
        tenantId,
        partyId,
        personId: partyId, // Legacy compatibility
        studentCode: 'EDU-2024-001',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'program-cs-2024',
        enrollmentDate: '2024-09-01',
        expectedGraduationDate: '2028-06-30',
        currentLevel: 'Year 1',
        createdBy: systemUserId,
      };

      const student = await StudentService.createStudent(request);
      studentId = student.studentId;

      expect(student).toBeDefined();
      expect(student.partyId).toBe(partyId);
      expect(student.studentCode).toBe('EDU-2024-001');
      expect(student.academicStatus).toBe('enrolled');
    });

    it('should reject student creation if Party does not exist', async () => {
      const request: CreateStudentRequest = {
        tenantId,
        partyId: '00000000-0000-0000-0000-999999999999', // Valid UUID that doesn't exist
        personId: '00000000-0000-0000-0000-999999999999', // Legacy compatibility
        studentCode: 'EDU-2024-002',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'program-cs-2024',
        enrollmentDate: '2024-09-01',
        createdBy: systemUserId,
      };

      await expect(StudentService.createStudent(request)).rejects.toThrow(
        'Party with ID 00000000-0000-0000-0000-999999999999 does not exist'
      );
    });

    it('should reject duplicate student code in same tenant', async () => {
      const request: CreateStudentRequest = {
        tenantId,
        partyId,
        personId: partyId, // Legacy compatibility
        studentCode: 'EDU-2024-001', // Same code as first test
        academicStatus: 'enrolled',
        enrollmentType: 'part_time',
        programId: 'program-math-2024',
        enrollmentDate: '2024-09-01',
        createdBy: systemUserId,
      };

      await expect(StudentService.createStudent(request)).rejects.toThrow(
        'Student code EDU-2024-001 already exists'
      );
    });
  });

  describe('Tenant Isolation', () => {
    it('should not find student from different tenant', async () => {
      const student = await StudentService.getStudentById(studentId, differentTenantId);
      expect(student).toBeNull();
    });

    it('should find student only in same tenant', async () => {
      const student = await StudentService.getStudentById(studentId, tenantId);
      expect(student).toBeDefined();
      expect(student?.studentId).toBe(studentId);
      expect(student?.tenantId).toBe(tenantId);
    });
  });

  describe('CRUD Operations', () => {
    it('should get student by ID', async () => {
      const student = await StudentService.getStudentById(studentId, tenantId);
      expect(student).toBeDefined();
      expect(student?.studentCode).toBe('EDU-2024-001');
    });

    it('should get student by student code', async () => {
      const student = await StudentService.getStudentByCode('EDU-2024-001', tenantId);
      expect(student).toBeDefined();
      expect(student?.studentId).toBe(studentId);
    });

    it('should get students by party ID', async () => {
      const students = await StudentService.getStudentsByPartyId(partyId, tenantId);
      expect(students.length).toBeGreaterThan(0);
      expect(students[0].partyId).toBe(partyId);
    });

    it('should update student', async () => {
      const updatedStudent = await StudentService.updateStudent({
        studentId,
        tenantId,
        academicStatus: 'on_leave',
        currentLevel: 'Year 2',
        gpa: 3.5,
        totalCredits: 30,
        updatedBy: systemUserId,
      });

      expect(updatedStudent.academicStatus).toBe('on_leave');
      expect(updatedStudent.currentLevel).toBe('Year 2');
      expect(updatedStudent.gpa).toBe(3.5);
      expect(updatedStudent.totalCredits).toBe(30);
    });

    it('should not allow updating different tenant', async () => {
      await expect(
        StudentService.updateStudent({
          studentId,
          tenantId: differentTenantId,
          academicStatus: 'graduated',
        })
      ).rejects.toThrow('Student');
    });
  });

  describe('Business Rules', () => {
    it('should graduate student', async () => {
      // First reinstate from leave
      await StudentService.reinstateStudent(studentId, tenantId, systemUserId);

      const graduatedStudent = await StudentService.graduateStudent(
        studentId,
        tenantId,
        '2028-06-30',
        systemUserId
      );

      expect(graduatedStudent.academicStatus).toBe('graduated');
      expect(graduatedStudent.actualGraduationDate).toBe('2028-06-30');
    });

    it('should not allow putting graduated student on leave', async () => {
      await expect(
        StudentService.putStudentOnLeave(studentId, tenantId, systemUserId)
      ).rejects.toThrow('Cannot put graduated student on leave');
    });

    it('should update academic progress', async () => {
      // Create new student for this test
      const { data: party2, error: party2Error } = await supabase
        .from('party_parties')
        .insert({
          tenant_id: tenantId,
          party_type: 'person',
          display_name: 'Jane Smith',
          created_by: systemUserId,
        })
        .select()
        .single();

      if (party2Error || !party2) {
        throw new Error(`Party creation failed: ${party2Error?.message}`);
      }

      // R6.5: Create minimal Person record for FK compatibility
      const { data: person2, error: person2Error } = await supabase
        .from('persons')
        .insert({
          id: party2.id,
          tenant_id: tenantId,
          first_name: 'Jane',
          last_name: 'Smith',
          date_of_birth: '2001-05-20',
          gender: 'female',
          created_by: systemUserId,
        })
        .select()
        .single();

      if (person2Error || !person2) {
        throw new Error(`Person FK compatibility record creation failed: ${person2Error?.message}`);
      }

      const student2 = await StudentService.createStudent({
        tenantId,
        partyId: party2.id,
        personId: party2.id, // Legacy compatibility
        studentCode: 'EDU-2024-003',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'program-cs-2024',
        enrollmentDate: '2024-09-01',
        createdBy: systemUserId,
      });

      const updated = await StudentService.updateAcademicProgress(
        student2.studentId,
        tenantId,
        3.8,
        45,
        systemUserId
      );

      expect(updated.gpa).toBe(3.8);
      expect(updated.totalCredits).toBe(45);
    });
  });

  describe('Query Operations', () => {
    it('should count students by status', async () => {
      const enrolledCount = await StudentService.countStudents(tenantId, 'enrolled');
      expect(enrolledCount).toBeGreaterThanOrEqual(1);

      const graduatedCount = await StudentService.countStudents(tenantId, 'graduated');
      expect(graduatedCount).toBeGreaterThanOrEqual(1);
    });

    it('should check if student code exists', async () => {
      const exists = await StudentService.studentCodeExists('EDU-2024-001', tenantId);
      expect(exists).toBe(true);

      const notExists = await StudentService.studentCodeExists('EDU-2099-999', tenantId);
      expect(notExists).toBe(false);
    });

    it('should get students by program', async () => {
      const students = await StudentService.getStudentsByProgram('program-cs-2024', tenantId);
      expect(students.length).toBeGreaterThan(0);
      expect(students[0].programId).toBe('program-cs-2024');
    });
  });
});
