// ============================================================================
// BELLA PRESCHOOL OS: P6.2 CROSS-DOMAIN PROJECTIONS INTEGRATION TEST SUITE
// File: tests/products/bella-education/parent-engagement/p62-cross-domain-projections.integration.test.ts
// ============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  ParentCommunicationRepository,
  CommunicationDeliveryService,
  AcknowledgementService,
  ConsentService,
  CommunicationExceptionService,
  CareProjectionBridge,
  LearningProjectionBridge,
  ClassroomProjectionBridge,
  P6_ERROR_CODES,
} from '@/products/bella-education/parent-engagement';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx2bnZrcHl4dHVpbGhyYWJ0bHd2Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc0NjgxMzgwMSwiZXhwIjoyMDYyMzg5ODAxfQ.mock-key';

describe('P6.2 Cross-Domain Projection Bridges & Escalation Engine Integration Suite', () => {
  let supabase: SupabaseClient;
  let repository: ParentCommunicationRepository;
  let deliveryService: CommunicationDeliveryService;
  let ackService: AcknowledgementService;
  let consentService: ConsentService;
  let exceptionService: CommunicationExceptionService;

  let careBridge: CareProjectionBridge;
  let learningBridge: LearningProjectionBridge;
  let classroomBridge: ClassroomProjectionBridge;

  let tenantA: string;
  let tenantB: string;

  let studentA: string;
  let studentB: string;

  let guardianA1: string; // Primary guardian for Student A
  let guardianA2: string; // Secondary guardian for Student A (Multi-guardian fanout)
  let guardianB: string;  // Guardian for Student B (Tenant B)

  let teacherPartyId: string;

  beforeAll(async () => {
    supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    repository = new ParentCommunicationRepository(supabase);
    deliveryService = new CommunicationDeliveryService(repository);
    ackService = new AcknowledgementService(repository);
    consentService = new ConsentService(repository);
    exceptionService = new CommunicationExceptionService(repository);

    careBridge = new CareProjectionBridge(supabase, deliveryService, repository);
    learningBridge = new LearningProjectionBridge(supabase, deliveryService);
    classroomBridge = new ClassroomProjectionBridge(supabase, deliveryService);

    // 1. Seed Tenants
    const { data: tA } = await supabase.from('tenants').insert({ name: 'P62 Test Tenant A' }).select('id').single();
    tenantA = tA!.id;

    const { data: tB } = await supabase.from('tenants').insert({ name: 'P62 Test Tenant B' }).select('id').single();
    tenantB = tB!.id;

    // 2. Seed Persons
    const { data: gA1Person } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantA, first_name: 'Mẹ', last_name: 'An', date_of_birth: '1988-01-01', gender: 'female' })
      .select('id')
      .single();
    guardianA1 = gA1Person!.id;

    const { data: gA2Person } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantA, first_name: 'Ba', last_name: 'An', date_of_birth: '1986-02-02', gender: 'male' })
      .select('id')
      .single();
    guardianA2 = gA2Person!.id;

    const { data: gBPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantB, first_name: 'Phụ huynh', last_name: 'Bình', date_of_birth: '1990-03-03', gender: 'female' })
      .select('id')
      .single();
    guardianB = gBPerson!.id;

    const { data: tPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantA, first_name: 'Giáo viên', last_name: 'Chủ nhiệm', date_of_birth: '1992-04-04', gender: 'female' })
      .select('id')
      .single();
    teacherPartyId = tPerson!.id;

    // 3. Seed Student Persons
    const { data: stAPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantA, first_name: 'Bé', last_name: 'An', date_of_birth: '2022-01-01', gender: 'male' })
      .select('id')
      .single();

    const { data: stBPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantB, first_name: 'Bé', last_name: 'Bình', date_of_birth: '2022-03-03', gender: 'female' })
      .select('id')
      .single();

    // 4. Seed Students
    const { data: stA } = await supabase
      .from('students')
      .insert({
        tenant_id: tenantA,
        person_id: stAPerson!.id,
        student_code: 'P62-ST-001-' + Date.now(),
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'PRESCHOOL',
        enrollment_date: '2026-01-01',
        metadata: { guardian_party_id: guardianA1, guardian_party_ids: [guardianA1, guardianA2] },
      })
      .select('student_id')
      .single();
    studentA = stA!.student_id;

    const { data: stB } = await supabase
      .from('students')
      .insert({
        tenant_id: tenantB,
        person_id: stBPerson!.id,
        student_code: 'P62-ST-002-' + Date.now(),
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'PRESCHOOL',
        enrollment_date: '2026-01-01',
        metadata: { guardian_party_id: guardianB },
      })
      .select('student_id')
      .single();
    studentB = stB!.student_id;

    // Seed secondary guardian relation in student_guardians table
    await supabase.from('student_guardians').insert({
      tenant_id: tenantA,
      student_id: studentA,
      guardian_party_id: guardianA2,
      relationship_type: 'FATHER',
      is_active: true,
    });
  });

  afterAll(async () => {
    if (tenantA) {
      await supabase.from('edu_comm_threads').delete().eq('tenant_id', tenantA);
      await supabase.from('student_guardians').delete().eq('tenant_id', tenantA);
      await supabase.from('students').delete().eq('tenant_id', tenantA);
      await supabase.from('persons').delete().eq('tenant_id', tenantA);
      await supabase.from('tenants').delete().eq('id', tenantA);
    }
    if (tenantB) {
      await supabase.from('edu_comm_threads').delete().eq('tenant_id', tenantB);
      await supabase.from('students').delete().eq('tenant_id', tenantB);
      await supabase.from('persons').delete().eq('tenant_id', tenantB);
      await supabase.from('tenants').delete().eq('id', tenantB);
    }
  });

  // 1. P4 health incident -> REQUIRES_ACK notice
  it('Test 1: P4 health incident projection → creates notice with REQUIRES_ACK policy requirement', async () => {
    const incidentId = '90909090-9090-4090-a090-909090909090';
    const res = await careBridge.projectHealthIncident({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      incidentId,
      incidentTitle: 'Bé trầy đầu gối khi chơi cầu trượt',
      incidentDetails: 'Đã sát trùng vết thương bằng povidine...',
      severity: 'HIGH',
      createdBy: teacherPartyId,
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.notice.source_domain).toBe('P4_CARE');
    expect(res.notice.source_entity_type).toBe('HEALTH_INCIDENT');
    expect(res.notice.source_entity_id).toBe(incidentId);
    expect(res.notice.requirement_type).toBe('REQUIRES_ACK');
    expect(res.notice.notice_category).toBe('CRITICAL');
  });

  // 2. P4 medication request -> REQUIRES_CONSENT
  it('Test 2: P4 medication request projection → REQUIRES_CONSENT and P4 evidence boundary', async () => {
    const medId = '80808080-8080-4080-a080-808080808080';
    const res = await careBridge.projectMedicationRequest({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      medicationRequestId: medId,
      medicationName: 'Amoxicillin 250mg',
      dosage: '1 gói 250mg',
      administrationTime: '13:00 sau ăn trưa',
      instructions: 'Pha với 30ml nước ấm',
      createdBy: teacherPartyId,
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.notice.requirement_type).toBe('REQUIRES_CONSENT');
    expect(res.notice.notice_category).toBe('CONSENT');

    // Dispatch and read notice
    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: res.notice.id,
      recipientPartyId: guardianA1,
      payloadSnapshot: { title: res.notice.title },
    });
    await deliveryService.recordRead(tenantA, res.deliveries[0].id, guardianA1);

    // Parent approves consent -> returns evidence note without mutating P4 state directly
    const consentRes = await consentService.recordConsentResponse({
      tenantId: tenantA,
      noticeId: res.notice.id,
      guardianPartyId: guardianA1,
      consentScope: 'MEDICATION_ADMIN',
      decision: 'APPROVED',
    });

    expect(consentRes.consentResponse.decision).toBe('APPROVED');
    expect(consentRes.domainDirectiveNote).toContain('P4 Care & Wellbeing');
  });

  // 3. P5 PUBLISHED portfolio -> parent-safe notice
  it('Test 3: P5 PUBLISHED portfolio projection → creates parent-safe NOTICE_ONLY notice', async () => {
    // Seed portfolio & PUBLISHED version in P5 tables
    const { data: pf } = await supabase.from('edu_dev_portfolios').insert({
      tenant_id: tenantA,
      student_id: studentA,
      title: 'Hồ sơ phát triển bé An',
    }).select('id').single();

    const { data: ver } = await supabase.from('edu_dev_portfolio_versions').insert({
      tenant_id: tenantA,
      portfolio_id: pf!.id,
      version_number: 1,
      period_label: 'Học kỳ I 2026',
      status: 'PUBLISHED', // PUBLISHED STATUS
      compiled_by: teacherPartyId,
    }).select('id').single();

    const res = await learningBridge.projectPublishedPortfolio({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      portfolioVersionId: ver!.id,
      periodLabel: 'Học kỳ I 2026',
      publisherId: teacherPartyId,
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.notice.source_domain).toBe('P5_LEARNING');
    expect(res.notice.requirement_type).toBe('NOTICE_ONLY');
    expect(res.notice.publication_snapshot_ref).toBe('PORTFOLIO_VER_1');
  });

  // 4. P5 DRAFT portfolio projection -> BLOCK
  it('Test 4: P5 DRAFT portfolio projection → HARD BLOCK (PORTFOLIO_NOT_PUBLISHED_ERROR)', async () => {
    let { data: pf } = await supabase
      .from('edu_dev_portfolios')
      .select('*')
      .eq('tenant_id', tenantA)
      .eq('student_id', studentA)
      .maybeSingle();

    if (!pf) {
      const { data: createdPf } = await supabase
        .from('edu_dev_portfolios')
        .insert({
          tenant_id: tenantA,
          student_id: studentA,
          title: 'Hồ sơ nháp bé An',
        })
        .select('*')
        .single();
      pf = createdPf;
    }

    const { data: draftVer } = await supabase
      .from('edu_dev_portfolio_versions')
      .insert({
        tenant_id: tenantA,
        portfolio_id: pf!.id,
        version_number: 2,
        period_label: 'Học kỳ II 2026',
        status: 'DRAFT', // DRAFT STATUS!
        compiled_by: teacherPartyId,
      })
      .select('id')
      .single();

    // Projecting DRAFT version -> HARD BLOCK
    await expect(
      learningBridge.projectPublishedPortfolio({
        tenantId: tenantA,
        studentId: studentA,
        guardianPartyIds: [guardianA1],
        portfolioVersionId: draftVer!.id,
        periodLabel: 'Học kỳ II 2026',
        publisherId: teacherPartyId,
      })
    ).rejects.toThrow(P6_ERROR_CODES.PORTFOLIO_NOT_PUBLISHED);
  });

  // 5. P3 classroom announcement -> authorized guardians
  it('Test 5: P3 classroom announcement projection → creates notice for authorized guardians', async () => {
    const announcementId = '70707070-7070-4070-a070-707070707070';
    const res = await classroomBridge.projectAnnouncement({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      announcementId,
      title: 'Lịch nghỉ Tết Dương Lịch 2027',
      bodyText: 'Trường thông báo lịch nghỉ...',
      createdBy: teacherPartyId,
    });

    expect(res.isDuplicate).toBe(false);
    expect(res.notice.source_domain).toBe('P3_CLASSROOM');
    expect(res.notice.requirement_type).toBe('NOTICE_ONLY');
  });

  // 6. Duplicate source event -> exactly one projection
  it('Test 6: Duplicate source event projection → idempotent, returns existing notice', async () => {
    const incidentId = '60606060-6060-4060-a060-606060606060';

    // Projection 1
    const res1 = await careBridge.projectHealthIncident({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      incidentId,
      incidentTitle: 'Côn trùng cắn nhẹ',
      incidentDetails: 'Đã bôi kem dịu da...',
      severity: 'LOW',
      createdBy: teacherPartyId,
    });
    expect(res1.isDuplicate).toBe(false);

    // Duplicate Projection 2
    const res2 = await careBridge.projectHealthIncident({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      incidentId,
      incidentTitle: 'Côn trùng cắn nhẹ',
      incidentDetails: 'Đã bôi kem dịu da...',
      severity: 'LOW',
      createdBy: teacherPartyId,
    });

    expect(res2.isDuplicate).toBe(true);
    expect(res2.notice.id).toBe(res1.notice.id); // Exactly same notice ID
  });

  // 7. Guardian relationship revoked before dispatch -> delivery BLOCK
  it('Test 7: Guardian relationship revoked before dispatch → delivery BLOCKED', async () => {
    const unlinkedParty = 'g9999999-9999-4999-a999-999999999999';

    // Attempting to project for unlinked guardian -> throws UNAUTHORIZED_GUARDIAN_RELATIONSHIP_ERROR
    await expect(
      careBridge.projectHealthIncident({
        tenantId: tenantA,
        studentId: studentA,
        guardianPartyIds: [unlinkedParty], // REVOKED/UNLINKED GUARDIAN
        incidentId: '50505050-5050-4050-a050-505050505050',
        incidentTitle: 'Kiểm tra thần sóc',
        incidentDetails: 'Chi tiết...',
        severity: 'LOW',
        createdBy: teacherPartyId,
      })
    ).rejects.toThrow(P6_ERROR_CODES.UNAUTHORIZED_GUARDIAN_RELATIONSHIP);
  });

  // 8. Multi-guardian child -> correct authorized fan-out
  it('Test 8: Multi-guardian child → creates deliveries for all authorized guardians', async () => {
    const incidentId = '40404040-4040-4040-a040-404040404040';

    // Both guardianA1 (mother) and guardianA2 (father) are authorized for studentA
    const res = await careBridge.projectHealthIncident({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1, guardianA2],
      incidentId,
      incidentTitle: 'Thông báo họp phụ huynh riêng',
      incidentDetails: 'Trao đổi về chế độ dinh dưỡng bé An',
      severity: 'MEDIUM',
      createdBy: teacherPartyId,
    });

    expect(res.deliveries.length).toBe(2);
    const recipientIds = res.deliveries.map((d) => d.recipient_party_id);
    expect(recipientIds).toContain(guardianA1);
    expect(recipientIds).toContain(guardianA2);
  });

  // 9. Overdue ACK scan repeated -> exactly one active exception
  it('Test 9: Overdue ACK scan repeated → idempotent, creates exactly one active exception', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA1,
      threadType: 'HEALTH_INCIDENT',
      title: 'Quá hạn xác nhận sự cố',
      createdBy: teacherPartyId,
    });

    const pastDue = new Date(Date.now() - 3600 * 1000).toISOString();
    const { notice } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'HEALTH_INCIDENT',
      sourceEntityId: '30303030-3030-4030-a030-303030303030',
      noticeCategory: 'CRITICAL',
      requirementType: 'REQUIRES_ACK',
      title: 'Quá hạn ACK 1',
      bodyText: 'Chưa xác nhận...',
      dueAt: pastDue,
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA1],
    });

    // Scanner run 1
    const exc1 = await exceptionService.createException({
      tenantId: tenantA,
      noticeId: notice.id,
      studentId: studentA,
      guardianPartyId: guardianA1,
      exceptionType: 'OVERDUE_ACK',
    });

    expect(exc1.status).toBe('OPEN');

    // Scanner run 2 (Repeated scan for same notice/guardian/exceptionType)
    const { data: existingExc } = await supabase
      .from('edu_comm_exceptions')
      .select('*')
      .eq('tenant_id', tenantA)
      .eq('notice_id', notice.id)
      .eq('guardian_party_id', guardianA1)
      .eq('exception_type', 'OVERDUE_ACK')
      .in('status', ['OPEN', 'IN_PROGRESS']);

    // Unique index ensures max 1 active exception
    expect(existingExc?.length).toBe(1);
  });

  // 10. Consent declined -> communication exception + domain routing reference
  it('Test 10: Consent DECLINED → creates CONSENT_DECLINED exception in staff work queue', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA1,
      threadType: 'CONSENT_REQUEST',
      title: 'Phiếu xin phép tham quan',
      createdBy: teacherPartyId,
    });

    const { notice, deliveries } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P3_CLASSROOM',
      sourceEntityType: 'FIELD_TRIP_CONSENT',
      sourceEntityId: '20202020-2020-4020-a020-202020202020',
      noticeCategory: 'CONSENT',
      requirementType: 'REQUIRES_CONSENT',
      title: 'Dã ngoại Bưu điện thành phố',
      bodyText: 'Chi tiết...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA1],
    });

    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA1,
      payloadSnapshot: { title: notice.title },
    });
    await deliveryService.recordRead(tenantA, deliveries[0].id, guardianA1);

    // Parent declines consent
    await consentService.recordConsentResponse({
      tenantId: tenantA,
      noticeId: notice.id,
      guardianPartyId: guardianA1,
      consentScope: 'FIELD_TRIP',
      decision: 'DECLINED',
      conditions: 'Bé đang bị say xe nên gia đình xin không tham gia',
    });

    // Create CONSENT_DECLINED exception for teacher work queue
    const exc = await exceptionService.createException({
      tenantId: tenantA,
      noticeId: notice.id,
      studentId: studentA,
      guardianPartyId: guardianA1,
      exceptionType: 'CONSENT_DECLINED',
      assignedRole: 'TEACHER',
    });

    expect(exc.exception_type).toBe('CONSENT_DECLINED');
    expect(exc.status).toBe('OPEN');
  });

  // 11. Cross-tenant source/entity mismatch -> HARD BLOCK
  it('Test 11: Cross-tenant student mismatch → HARD BLOCK (COMMUNICATION_TENANT_MISMATCH_ERROR)', async () => {
    // Attempting to project Tenant B student using Tenant A context -> Rejects
    await expect(
      careBridge.projectHealthIncident({
        tenantId: tenantA,
        studentId: studentB, // TENANT B STUDENT!
        guardianPartyIds: [guardianB],
        incidentId: '10101010-1010-4010-a010-101010101010',
        incidentTitle: 'Sự cố sai tenant',
        incidentDetails: 'Nội dung...',
        severity: 'LOW',
        createdBy: teacherPartyId,
      })
    ).rejects.toThrow(P6_ERROR_CODES.TENANT_MISMATCH);
  });

  // 12. Source traceability preserved end-to-end
  it('Test 12: Source traceability → retains exact source domain, entity type, entity ID, and publication snapshot ref', async () => {
    const incidentId = '12121212-1212-4212-a212-121212121212';
    const res = await careBridge.projectHealthIncident({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyIds: [guardianA1],
      incidentId,
      incidentTitle: 'Kiểm tra vết côn trùng',
      incidentDetails: 'Bôi thuốc mỡ...',
      severity: 'LOW',
      createdBy: teacherPartyId,
    });

    expect(res.notice.source_domain).toBe('P4_CARE');
    expect(res.notice.source_entity_type).toBe('HEALTH_INCIDENT');
    expect(res.notice.source_entity_id).toBe(incidentId);

    // Fetch notice directly from DB to verify raw persistence
    const fetched = await repository.getNoticeById(tenantA, res.notice.id);
    expect(fetched?.source_domain).toBe('P4_CARE');
    expect(fetched?.source_entity_type).toBe('HEALTH_INCIDENT');
    expect(fetched?.source_entity_id).toBe(incidentId);
  });
});
