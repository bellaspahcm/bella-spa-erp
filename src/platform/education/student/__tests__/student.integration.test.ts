/**
 * Student Integration Tests
 * 
 * Tests:
 * - R3 identity validation (new Student requires a Party, not a legacy Person mapping)
 * - Tenant isolation (Student cannot access other tenant's data)
 * - CRUD operations with real database
 * - Business rules enforcement
 */

import { StudentService } from '../student.service';
import { PersonService } from '@/platform/host/person/person.service';
import { CreateStudentRequest } from '../../shared-kernel/types';
import { createClient } from '@/lib/supabase-server';

describe('Student Integration Tests', () => {
  const tenantId = '00000000-0000-0000-0000-000000000088';
  const differentTenantId = '00000000-0000-0000-0000-000000000089';
  const systemUserId = '00000000-0000-0000-0000-000000000001'; // System user UUID (not 'test-system' string)
  let personId: string;
  let partyId: string;
  let legacyPartyId: string;
  let studentId: string;
  let personService: PersonService;

  beforeAll(async () => {
    const supabase = await createClient();
    personService = new PersonService(supabase);

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
    
    // Create test Person (required for FK)
    const personResult = await personService.createPerson({
      tenantId,
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '2000-01-15',
      gender: 'male',
      contacts: [
        { type: 'email', value: 'john.doe@university.edu', isPrimary: true },
        { type: 'phone', value: '0901234567', isPrimary: false },
      ],
      createdBy: systemUserId,
    });
    
    if (!personResult.success || !personResult.data) {
      throw new Error(`Failed to create test person: ${personResult.error?.message}`);
    }
    personId = personResult.data.personId;

    partyId = '00000000-0000-0000-0000-000000000188';
    const { error: partyError } = await supabase
      .from('party_parties')
      .upsert({
        id: partyId,
        tenant_id: tenantId,
        party_type: 'person',
        display_name: 'John Doe',
      });
    if (partyError) {
      throw new Error(`Failed to create test Party: ${partyError.message}`);
    }

    legacyPartyId = '00000000-0000-0000-0000-000000000190';
    const { error: legacyPartyError } = await supabase
      .from('party_parties')
      .upsert({
        id: legacyPartyId,
        tenant_id: tenantId,
        party_type: 'person',
        display_name: 'Legacy Student',
      });
    if (legacyPartyError) {
      throw new Error(`Failed to create legacy test Party: ${legacyPartyError.message}`);
    }

  });

  afterAll(async () => {
    // Cleanup test data
    const supabase = await createClient();
    
    // Delete students first (FK constraint)
    await supabase.from('students').delete().in('tenant_id', [tenantId, differentTenantId]);

    // Delete Party fixtures before their referenced identities.
    await supabase.from('party_parties').delete().in('tenant_id', [tenantId, differentTenantId]);

    // Delete persons
    await supabase.from('persons').delete().in('tenant_id', [tenantId, differentTenantId]);

    // Delete tenants
    await supabase.from('tenants').delete().in('id', [tenantId, differentTenantId]);
  });

  describe('R3 Student Identity', () => {
    it('should persist and read back new canonical Party student without transitional Person mapping', async () => {
      const request: CreateStudentRequest = {
        tenantId,
        partyId,
        studentCode: 'EDU-2024-001',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'program-cs-2024',
        enrollmentDate: '2024-09-01',
        expectedGraduationDate: '2028-06-30',
        currentLevel: 'Year 1',
        createdBy: systemUserId,
      };

      const supabase = await createClient();
      const { count: personsBefore, error: personsBeforeError } = await supabase
        .from('persons')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (personsBeforeError) {
        throw new Error(`Failed to count persons before Student create: ${personsBeforeError.message}`);
      }

      const student = await StudentService.createStudent(request);
      studentId = student.studentId;

      expect(student).toBeDefined();
      expect(student.partyId).toBe(partyId);
      expect(student.personId).toBeNull();
      expect(student.studentCode).toBe('EDU-2024-001');
      expect(student.academicStatus).toBe('enrolled');

      const { data: persistedStudent, error: readBackError } = await supabase
        .from('students')
        .select('party_id, person_id')
        .eq('student_id', studentId)
        .eq('tenant_id', tenantId)
        .single();
      if (readBackError) {
        throw new Error(`Failed to read back R3 Student identity: ${readBackError.message}`);
      }
      expect(persistedStudent?.party_id).toBe(partyId);
      expect(persistedStudent?.person_id).toBeNull();

      const { count: personsAfter, error: personsAfterError } = await supabase
        .from('persons')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId);
      if (personsAfterError) {
        throw new Error(`Failed to count persons after Student create: ${personsAfterError.message}`);
      }
      expect(personsAfter).toBe(personsBefore);
    });

    it('should read back created student through canonical partyId', async () => {
      const students = await StudentService.getStudentsByPartyId(partyId, tenantId);
      expect(students.length).toBeGreaterThan(0);
      expect(students[0].partyId).toBe(partyId);
      expect(students[0].personId).toBeNull();
    });

    it('should reject student creation if Party does not exist', async () => {
      const request: CreateStudentRequest = {
        tenantId,
        partyId: '00000000-0000-0000-0000-999999999999',
        personId: '00000000-0000-0000-0000-999999999999', // Legacy UUID remains accepted when supplied
        studentCode: 'EDU-2024-002',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'program-cs-2024',
        enrollmentDate: '2024-09-01',
        createdBy: systemUserId,
      };

      await expect(StudentService.createStudent(request)).rejects.toThrow(
        'Person Party with ID 00000000-0000-0000-0000-999999999999 does not exist'
      );
    });

    it('should reject duplicate student code in same tenant', async () => {
      const request: CreateStudentRequest = {
        tenantId,
        partyId,
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

    it('should preserve legacy lookup by person ID', async () => {
      const legacyStudent = await StudentService.createStudent({
        tenantId,
        partyId: legacyPartyId,
        personId,
        studentCode: 'EDU-2024-004',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'program-cs-2024',
        enrollmentDate: '2024-09-01',
        createdBy: systemUserId,
      });

      const students = await StudentService.getStudentsByPersonId(personId, tenantId);
      expect(students.length).toBeGreaterThan(0);
      expect(students.some((student) => student.studentId === legacyStudent.studentId)).toBe(true);
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
      const person2Result = await personService.createPerson({
        tenantId,
        firstName: 'Jane',
        lastName: 'Smith',
        dateOfBirth: '2001-05-20',
        gender: 'female',
        createdBy: systemUserId,
      });

      if (!person2Result.success || !person2Result.data) {
        throw new Error('Failed to create test person');
      }

      const party2Id = '00000000-0000-0000-0000-000000000189';
      const supabase = await createClient();
      const { error: party2Error } = await supabase
        .from('party_parties')
        .upsert({
          id: party2Id,
          tenant_id: tenantId,
          party_type: 'person',
          display_name: 'Jane Smith',
        });
      if (party2Error) {
        throw new Error(`Failed to create second test Party: ${party2Error.message}`);
      }

      const student2 = await StudentService.createStudent({
        tenantId,
        partyId: party2Id,
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
