/**
 * Preschool New Student → Enrollment operational integration.
 *
 * Proves the product API creates a canonical Party-backed Student and an
 * edu_enrollments row without creating legacy persons or migration mappings.
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { POST as createPreschoolEnrollment } from '@/app/api/education/enrollments/route';

jest.setTimeout(60000);

describe('Preschool New Student Enrollment Operational Path', () => {
  let supabase: SupabaseClient;

  const tenantId = '33333333-3333-3333-3333-33333333331a';
  const courseId = '33333333-3333-3333-3333-33333333332a';

  beforeAll(async () => {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase credentials for Preschool operational integration test');
    }

    supabase = createClient(supabaseUrl, supabaseServiceKey);
    await cleanupDb();

    await supabase.from('tenants').upsert({
      id: tenantId,
      name: 'Preschool Enrollment Operational Test',
      status: 'active',
    });

    await supabase.from('edu_courses').upsert({
      id: courseId,
      tenant_id: tenantId,
      course_code: 'PRESCHOOL-OP-01',
      title: 'Lớp Mầm Operational',
      status: 'active',
      max_students: 25,
      current_enrollment: 0,
      prerequisite_course_codes: [],
    });
  });

  afterAll(async () => {
    await cleanupDb();
  });

  async function cleanupDb() {
    if (!supabase) return;
    await supabase.from('edu_enrollments').delete().eq('tenant_id', tenantId);
    await supabase.from('edu_preschool_pickup_authorizations').delete().eq('tenant_id', tenantId);
    await supabase.from('students').delete().eq('tenant_id', tenantId);
    await supabase.from('identity_migration_mapping').delete().eq('tenant_id', tenantId);
    await supabase.from('persons').delete().eq('tenant_id', tenantId);
    await supabase.from('party_relationships').delete().eq('tenant_id', tenantId);
    await supabase.from('party_identifiers').delete().eq('tenant_id', tenantId);
    await supabase.from('party_parties').delete().eq('tenant_id', tenantId);
    await supabase.from('edu_courses').delete().eq('tenant_id', tenantId);
    await supabase.from('tenants').delete().eq('id', tenantId);
  }

  function buildRequest(): Request {
    return new Request('http://localhost/api/education/enrollments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId,
        childName: 'Nguyễn Preschool Operational',
        nickname: 'Bé Ops',
        dateOfBirth: '2023-06-15',
        gender: 'Nam',
        guardianName: 'Nguyễn Phụ Huynh',
        guardianPhone: '0909000000',
        medicalNote: 'Không có lưu ý đặc biệt',
        courseId,
      }),
    });
  }

  it('creates Party, Student, edu_enrollment, and reads back canonical party identity', async () => {
    const { count: personsBefore } = await supabase
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    const { count: mappingsBefore } = await supabase
      .from('identity_migration_mapping')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    const response = await createPreschoolEnrollment(buildRequest());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.student.partyId).toEqual(expect.any(String));
    expect(body.student.guardianPartyId).toEqual(expect.any(String));
    expect(body.guardianAuthorization).toEqual(expect.objectContaining({
      guardianPartyId: body.student.guardianPartyId,
      studentPartyId: body.student.partyId,
      displayName: 'Nguyễn Phụ Huynh',
      phone: '0909000000',
      status: 'authorized',
    }));
    expect(body.enrollment.id).toEqual(expect.any(String));

    const { data: party } = await supabase
      .from('party_parties')
      .select('id, tenant_id, party_type, display_name')
      .eq('id', body.student.partyId)
      .eq('tenant_id', tenantId)
      .single();

    expect(party).toEqual(expect.objectContaining({
      id: body.student.partyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: 'Nguyễn Preschool Operational',
    }));

    const { data: student } = await supabase
      .from('students')
      .select('student_id, party_id, person_id, student_code, tenant_id')
      .eq('party_id', body.student.partyId)
      .eq('tenant_id', tenantId)
      .single();

    expect(student).toEqual(expect.objectContaining({
      party_id: body.student.partyId,
      person_id: null,
      student_code: body.student.studentCode,
      tenant_id: tenantId,
    }));

    const { data: enrollment } = await supabase
      .from('edu_enrollments')
      .select('id, tenant_id, student_party_id, course_id, status')
      .eq('id', body.enrollment.id)
      .eq('tenant_id', tenantId)
      .single();

    expect(enrollment).toEqual(expect.objectContaining({
      id: body.enrollment.id,
      tenant_id: tenantId,
      student_party_id: body.student.partyId,
      course_id: courseId,
      status: 'active',
    }));

    const { data: guardianParty } = await supabase
      .from('party_parties')
      .select('id, tenant_id, party_type, display_name')
      .eq('id', body.student.guardianPartyId)
      .eq('tenant_id', tenantId)
      .single();

    expect(guardianParty).toEqual(expect.objectContaining({
      id: body.student.guardianPartyId,
      tenant_id: tenantId,
      party_type: 'person',
      display_name: 'Nguyễn Phụ Huynh',
    }));

    const { data: guardianIdentifier } = await supabase
      .from('party_identifiers')
      .select('tenant_id, party_id, identifier_type, identifier_value')
      .eq('tenant_id', tenantId)
      .eq('party_id', body.student.guardianPartyId)
      .eq('identifier_type', 'preschool_guardian_phone')
      .single();

    expect(guardianIdentifier).toEqual(expect.objectContaining({
      tenant_id: tenantId,
      party_id: body.student.guardianPartyId,
      identifier_type: 'preschool_guardian_phone',
      identifier_value: '0909000000',
    }));

    const { data: relationshipRows } = await supabase
      .from('party_relationships')
      .select('id, tenant_id, source_party_id, target_party_id, relationship_type')
      .eq('tenant_id', tenantId)
      .eq('source_party_id', body.student.guardianPartyId)
      .eq('target_party_id', body.student.partyId)
      .eq('relationship_type', 'guardian_of');

    expect(relationshipRows).toHaveLength(1);

    const { data: authorizationRows } = await supabase
      .from('edu_preschool_pickup_authorizations')
      .select('id, tenant_id, student_party_id, guardian_party_id, status')
      .eq('tenant_id', tenantId)
      .eq('student_party_id', body.student.partyId)
      .eq('guardian_party_id', body.student.guardianPartyId)
      .eq('status', 'authorized');

    expect(authorizationRows).toHaveLength(1);

    const { count: personsAfter } = await supabase
      .from('persons')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    const { count: mappingsAfter } = await supabase
      .from('identity_migration_mapping')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    expect(personsAfter).toBe(personsBefore);
    expect(mappingsAfter).toBe(mappingsBefore);
  });
});
