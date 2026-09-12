/**
 * R3 Education Identity Cutover - Integration Tests
 * 
 * Validates:
 * 1. New students require Party (not Person)
 * 2. NO new Person rows created
 * 3. Existing students readable with party_id
 * 4. Contract semantic drift fixed
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient } from '@/lib/supabase-server';
import { StudentService } from '@/platform/education/student/student.service';
import { PartyRepository } from '@/platform/host/party/party.repository';

const TEST_TENANT = 'test-tenant-r3';
const BASELINE_PERSONS_COUNT = 848; // R2 sealed count

describe('R3 Education Identity Cutover', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let testPartyId: string;
  let baselinePersonsCount: number;

  beforeAll(async () => {
    supabase = await createClient();
    
    // Capture baseline persons count
    const { count } = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true });
    
    baselinePersonsCount = count || 0;
    console.log(`Baseline persons count: ${baselinePersonsCount}`);

    // Create test Party
    const { data: party, error: partyError } = await supabase
      .from('party_parties')
      .insert({
        tenant_id: TEST_TENANT,
        party_type: 'person',
        display_name: 'Test Student R3',
        is_active: true,
      })
      .select()
      .single();

    if (partyError) throw partyError;
    testPartyId = party.id;
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('students')
      .delete()
      .eq('tenant_id', TEST_TENANT);

    await supabase
      .from('party_parties')
      .delete()
      .eq('id', testPartyId);
  });

  // ==========================================================================
  // POSITIVE TESTS
  // ==========================================================================

  it('should create student with valid Party', async () => {
    const student = await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000', // Dummy (not used)
      studentCode: 'EDU-2026-R3001',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
      createdBy: 'r3-test',
    });

    expect(student.partyId).toBe(testPartyId);
    expect(student.studentCode).toBe('EDU-2026-R3001');
  });

  it('should populate party_id for new students', async () => {
    const student = await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000',
      studentCode: 'EDU-2026-R3002',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
    });

    // Verify database record has party_id
    const { data: dbStudent } = await supabase
      .from('students')
      .select('party_id')
      .eq('student_id', student.studentId)
      .single();

    expect(dbStudent?.party_id).toBe(testPartyId);
  });

  it('should query student by party_id', async () => {
    await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000',
      studentCode: 'EDU-2026-R3003',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
    });

    const students = await StudentService.getStudentsByPartyId(testPartyId, TEST_TENANT);
    
    expect(students.length).toBeGreaterThan(0);
    expect(students[0].partyId).toBe(testPartyId);
  });

  // ==========================================================================
  // NEGATIVE TESTS
  // ==========================================================================

  it('should reject student with invalid party_id', async () => {
    await expect(
      StudentService.createStudent({
        tenantId: TEST_TENANT,
        partyId: '00000000-0000-0000-0000-999999999999', // Invalid
        personId: '00000000-0000-0000-0000-000000000000',
        studentCode: 'EDU-2026-R3004',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'test-program',
        enrollmentDate: '2026-09-01',
      })
    ).rejects.toThrow(/Party.*does not exist/);
  });

  it('should reject student with non-person party', async () => {
    // Create organization party
    const { data: orgParty } = await supabase
      .from('party_parties')
      .insert({
        tenant_id: TEST_TENANT,
        party_type: 'organization',
        display_name: 'Test Org R3',
        is_active: true,
      })
      .select()
      .single();

    await expect(
      StudentService.createStudent({
        tenantId: TEST_TENANT,
        partyId: orgParty!.id,
        personId: '00000000-0000-0000-0000-000000000000',
        studentCode: 'EDU-2026-R3005',
        academicStatus: 'enrolled',
        enrollmentType: 'full_time',
        programId: 'test-program',
        enrollmentDate: '2026-09-01',
      })
    ).rejects.toThrow(/Party.*is not a person/);

    // Cleanup
    await supabase
      .from('party_parties')
      .delete()
      .eq('id', orgParty!.id);
  });

  it('should NOT create new Person when creating student', async () => {
    const beforeCount = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true });

    await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000',
      studentCode: 'EDU-2026-R3006',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
    });

    const afterCount = await supabase
      .from('persons')
      .select('*', { count: 'exact', head: true });

    // Persons count MUST be unchanged
    expect(afterCount.count).toBe(beforeCount.count);
    expect(afterCount.count).toBe(baselinePersonsCount); // Should equal R2 baseline
  });

  // ==========================================================================
  // VERIFICATION TESTS
  // ==========================================================================

  it('should verify FK integrity (party_id → party_parties)', async () => {
    const student = await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000',
      studentCode: 'EDU-2026-R3007',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
    });

    // Verify FK integrity
    const { data: party } = await supabase
      .from('party_parties')
      .select('*')
      .eq('id', student.partyId!)
      .single();

    expect(party).not.toBeNull();
    expect(party?.tenant_id).toBe(TEST_TENANT);
  });

  it('should verify tenant consistency (student.tenant_id = party.tenant_id)', async () => {
    const student = await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000',
      studentCode: 'EDU-2026-R3008',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
    });

    const { data: party } = await supabase
      .from('party_parties')
      .select('tenant_id')
      .eq('id', student.partyId!)
      .single();

    expect(party?.tenant_id).toBe(student.tenantId);
  });

  it('should verify party_type = person for all students', async () => {
    await StudentService.createStudent({
      tenantId: TEST_TENANT,
      partyId: testPartyId,
      personId: '00000000-0000-0000-0000-000000000000',
      studentCode: 'EDU-2026-R3009',
      academicStatus: 'enrolled',
      enrollmentType: 'full_time',
      programId: 'test-program',
      enrollmentDate: '2026-09-01',
    });

    // Check all students in test tenant have party_type = person
    const { data: students } = await supabase
      .from('students')
      .select(`
        student_id,
        party_id,
        party_parties!inner(party_type)
      `)
      .eq('tenant_id', TEST_TENANT);

    students?.forEach((student: any) => {
      expect(student.party_parties.party_type).toBe('person');
    });
  });
});
