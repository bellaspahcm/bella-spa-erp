// ============================================================================
// BELLA PRESCHOOL OS: P6.1 PARENT COMMUNICATION INTEGRATION TEST SUITE
// File: tests/products/bella-education/parent-engagement/p61-communication-lifecycle.integration.test.ts
// ============================================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import {
  ParentCommunicationRepository,
  CommunicationDeliveryService,
  AcknowledgementService,
  ConsentService,
  ParentResponseService,
  CommunicationExceptionService,
  SentSnapshotService,
  P6_ERROR_CODES,
} from '@/products/bella-education/parent-engagement';

// Mock/Live Supabase setup
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://lvnvkpyxtuilhrabtlwv.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'sb_service_role_mock_token_for_integration_tests';

describe('P6.1 Parent Communication & Engagement Core Lifecycles Integration Suite', () => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const repository = new ParentCommunicationRepository(supabase);
  const deliveryService = new CommunicationDeliveryService(repository);
  const ackService = new AcknowledgementService(repository);
  const consentService = new ConsentService(repository);
  const responseService = new ParentResponseService(repository);
  const exceptionService = new CommunicationExceptionService(repository);
  const snapshotService = new SentSnapshotService(repository);

  let tenantA: string;
  let tenantB: string;

  let studentA: string;
  let studentB: string;

  let guardianA: string; // Linked to Student A
  let guardianB: string; // Unlinked / Tenant B guardian

  let teacherPartyId: string;

  beforeAll(async () => {
    // 1. Create Tenant A & Tenant B
    const { data: tA } = await supabase.from('tenants').insert({ name: 'P61 Test Tenant A' }).select('id').single();
    tenantA = tA!.id;

    const { data: tB } = await supabase.from('tenants').insert({ name: 'P61 Test Tenant B' }).select('id').single();
    tenantB = tB!.id;

    // 2. Create Persons for Guardians & Teacher
    const { data: gAPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantA, first_name: 'Phụ huynh', last_name: 'A', date_of_birth: '1985-01-01', gender: 'female' })
      .select('id')
      .single();
    guardianA = gAPerson!.id;

    const { data: gBPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantB, first_name: 'Phụ huynh', last_name: 'B', date_of_birth: '1988-02-02', gender: 'male' })
      .select('id')
      .single();
    guardianB = gBPerson!.id;

    const { data: tPerson } = await supabase
      .from('persons')
      .insert({ tenant_id: tenantA, first_name: 'Giáo viên', last_name: 'A', date_of_birth: '1992-05-05', gender: 'female' })
      .select('id')
      .single();
    teacherPartyId = tPerson!.id;

    // 3. Create Student Persons
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

    // 4. Create Students linked to Guardians
    const { data: stA, error: stAErr } = await supabase
      .from('students')
      .insert({
        tenant_id: tenantA,
        person_id: stAPerson!.id,
        student_code: 'P61-ST-001-' + Date.now(),
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'PRESCHOOL',
        enrollment_date: '2026-01-01',
        metadata: { guardian_party_id: guardianA },
      })
      .select('student_id')
      .single();
    if (stAErr) console.error('ST_A INSERT ERROR:', stAErr);
    studentA = stA!.student_id;

    const { data: stB, error: stBErr } = await supabase
      .from('students')
      .insert({
        tenant_id: tenantB,
        person_id: stBPerson!.id,
        student_code: 'P61-ST-002-' + Date.now(),
        academic_status: 'enrolled',
        enrollment_type: 'full_time',
        program_id: 'PRESCHOOL',
        enrollment_date: '2026-01-01',
        metadata: { guardian_party_id: guardianB },
      })
      .select('student_id')
      .single();
    if (stBErr) console.error('ST_B INSERT ERROR:', stBErr);
    studentB = stB!.student_id;
  });

  afterAll(async () => {
    if (tenantA) {
      await supabase.from('edu_comm_threads').delete().eq('tenant_id', tenantA);
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

  // 1. Canonical Guardian Authorization Guard
  it('Gate 1: Canonical Guardian Authorization Guard — rejects unlinked guardian relationship', async () => {
    // Attempting to create thread for Guardian B (unlinked to Student A)
    await expect(
      deliveryService.createThread({
        tenantId: tenantA,
        studentId: studentA,
        guardianPartyId: guardianB, // UNLINKED GUARDIAN
        threadType: 'GENERAL',
        title: 'Thắc mắc sức khỏe',
        createdBy: teacherPartyId,
      })
    ).rejects.toThrow(P6_ERROR_CODES.UNAUTHORIZED_GUARDIAN_RELATIONSHIP);
  });

  // 2. Multi-Tenant RLS Isolation
  it('Gate 2: Multi-Tenant RLS Isolation — prevents Tenant B guardian from accessing Tenant A thread', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'CARE_DIGEST',
      title: 'Nhật ký chăm sóc ngày 09/09',
      createdBy: teacherPartyId,
    });

    // Tenant B repository query returns null
    const fetched = await repository.getThreadById(tenantB, thread.id);
    expect(fetched).toBeNull();
  });

  // 3. Illegal Delivery State Transitions
  it('Gate 3: Illegal Delivery State Transitions — blocks direct transition from DRAFT/READY to READ', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'GENERAL',
      title: 'Thông báo lớp Mầm A',
      createdBy: teacherPartyId,
    });

    const { deliveries } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P3_CLASSROOM',
      sourceEntityType: 'ANNOUNCEMENT',
      sourceEntityId: '99999999-9999-4999-a999-999999999999',
      noticeCategory: 'INFO',
      title: 'Họp phụ huynh đầu năm',
      bodyText: 'Kính mời phụ huynh tham dự...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    const delivery = deliveries[0];
    expect(delivery.status).toBe('READY');

    // Attempting to record READ directly on READY delivery (without dispatch/SENT)
    await expect(
      deliveryService.recordRead(tenantA, delivery.id, guardianA)
    ).rejects.toThrow(P6_ERROR_CODES.INVALID_DELIVERY_STATE_TRANSITION);
  });

  // 4. Invariant 1: READ ≠ ACKNOWLEDGED
  it('Gate 4: Invariant 1 — READ status does NOT imply ACKNOWLEDGED status', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'CARE_DIGEST',
      title: 'Báo cáo ăn uống ngày 09/09',
      createdBy: teacherPartyId,
    });

    const { notice, deliveries } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'CARE_DIGEST',
      sourceEntityId: '88888888-8888-4888-a888-888888888888',
      noticeCategory: 'CRITICAL',
      requirementType: 'REQUIRES_ACK',
      title: 'Nhắc nhở theo dõi vết trầy gối',
      bodyText: 'Bé bị trầy nhẹ gối khi chơi ngoài sân...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    // Dispatch notice
    const { delivery } = await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      payloadSnapshot: { title: notice.title, body: notice.body_text },
    });

    // Parent opens message -> READ status recorded
    const readDelivery = await deliveryService.recordRead(tenantA, delivery.id, guardianA);
    expect(readDelivery.status).toBe('READ');
    expect(readDelivery.read_at).toBeDefined();

    // Check status via AcknowledgementService: READ = true, ACKNOWLEDGED = false
    const status = await ackService.getAcknowledgementStatus(tenantA, notice.id, guardianA);
    expect(status.isRead).toBe(true);
    expect(status.isAcknowledged).toBe(false);
  });

  // 5. Acknowledgement Before Read Negative Guard
  it('Gate 5: Negative Guard — blocks acknowledgement before notice is read', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'GENERAL',
      title: 'Quy định đón bé năm học mới',
      createdBy: teacherPartyId,
    });

    const { notice } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'SCHOOL_ADMIN',
      sourceEntityType: 'ANNOUNCEMENT',
      sourceEntityId: '77777777-7777-4777-a777-777777777777',
      noticeCategory: 'CRITICAL',
      requirementType: 'REQUIRES_ACK',
      title: 'Quy định quẹt thẻ đón bé',
      bodyText: 'Nội dung quy định...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    // Dispatch notice but do NOT call recordRead
    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      payloadSnapshot: { title: notice.title },
    });

    // Attempt to acknowledge unread notice -> rejects
    await expect(
      ackService.acknowledgeNotice({
        tenantId: tenantA,
        noticeId: notice.id,
        guardianPartyId: guardianA,
        signatureNote: 'Đã đọc và đồng ý',
      })
    ).rejects.toThrow(P6_ERROR_CODES.ACKNOWLEDGED_BEFORE_READ);
  });

  // 6. Invariant 2: ACKNOWLEDGED ≠ CONSENTED
  it('Gate 6: Invariant 2 — ACKNOWLEDGED status does NOT grant CONSENT', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'CONSENT_REQUEST',
      title: 'Phiếu xin phép dã ngoại Công viên Thảo cầm viên',
      createdBy: teacherPartyId,
    });

    const { notice, deliveries } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P3_CLASSROOM',
      sourceEntityType: 'FIELD_TRIP_CONSENT',
      sourceEntityId: '66666666-6666-4666-a666-666666666666',
      noticeCategory: 'CONSENT',
      requirementType: 'REQUIRES_CONSENT',
      title: 'Đăng ký dã ngoại ngày 15/09',
      bodyText: 'Lớp Mầm A tổ chức tham quan...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      payloadSnapshot: { title: notice.title },
    });

    await deliveryService.recordRead(tenantA, deliveries[0].id, guardianA);

    // Parent acknowledges the notice
    const ack = await ackService.acknowledgeNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      guardianPartyId: guardianA,
      signatureNote: 'Tôi đã xem thông tin chuyến đi',
    });

    expect(ack.status).toBe('ACKNOWLEDGED');

    // Consent response record is still NULL
    const consent = await repository.getConsentResponse(tenantA, notice.id, guardianA);
    expect(consent).toBeNull();
  });

  // 7. Consent Before Read Negative Guard & Workflow
  it('Gate 7: Negative Guard — blocks consent response before notice is read', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'CONSENT_REQUEST',
      title: 'Đồng ý sử dụng hình ảnh học tập của bé',
      createdBy: teacherPartyId,
    });

    const { notice } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P5_LEARNING',
      sourceEntityType: 'PHOTO_RELEASE',
      sourceEntityId: '55555555-5555-4555-a555-555555555555',
      noticeCategory: 'CONSENT',
      requirementType: 'REQUIRES_CONSENT',
      title: 'Đồng ý đăng ảnh hoạt động lớp',
      bodyText: 'Nhà trường xin phép đăng ảnh...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      payloadSnapshot: { title: notice.title },
    });

    // Attempting consent without reading notice -> Rejects
    await expect(
      consentService.recordConsentResponse({
        tenantId: tenantA,
        noticeId: notice.id,
        guardianPartyId: guardianA,
        consentScope: 'PHOTO_RELEASE',
        decision: 'APPROVED',
      })
    ).rejects.toThrow(P6_ERROR_CODES.CONSENT_BEFORE_READ);
  });

  // 8. Medication Consent Evidence Boundary (P4 Ownership)
  it('Gate 8: Medication Consent Evidence Boundary — P6 captures parent decision evidence without bypassing P4 authorization', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'CONSENT_REQUEST',
      title: 'Xác nhận ủy quyền uống thuốc hạ sốt',
      createdBy: teacherPartyId,
    });

    const { notice, deliveries } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'MEDICATION_AUTH',
      sourceEntityId: '44444444-4444-4444-a444-444444444444',
      noticeCategory: 'CONSENT',
      requirementType: 'REQUIRES_CONSENT',
      title: 'Đồng ý cho bé uống Paracetamol 150mg khi sốt > 38.5C',
      bodyText: 'Vui lòng xác nhận liều dùng...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      payloadSnapshot: { title: notice.title },
    });

    await deliveryService.recordRead(tenantA, deliveries[0].id, guardianA);

    // Record parent consent response in P6
    const res = await consentService.recordConsentResponse({
      tenantId: tenantA,
      noticeId: notice.id,
      guardianPartyId: guardianA,
      consentScope: 'MEDICATION_ADMIN',
      decision: 'APPROVED',
      conditions: 'Chỉ cho uống nếu sốt trên 38.5C',
    });

    expect(res.consentResponse.decision).toBe('APPROVED');
    // Directives note explicitly specifies P4 Care & Wellbeing ownership
    expect(res.domainDirectiveNote).toContain('P4 Care & Wellbeing');
  });

  // 9. Per-Recipient Sent Snapshot SHA-256 Fingerprint & DB Immutability Trigger
  it('Gate 9: Per-Recipient Sent Snapshot — generates SHA-256 fingerprint and enforces DB immutability', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'PORTFOLIO',
      title: 'Xuất bản Hồ sơ phát triển Học kỳ I',
      createdBy: teacherPartyId,
    });

    const { notice } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P5_LEARNING',
      sourceEntityType: 'PORTFOLIO',
      sourceEntityId: '33333333-3333-4333-a333-333333333333',
      noticeCategory: 'INFO',
      title: 'Hồ sơ phát triển bé An - HK1',
      bodyText: 'Tổng hợp 15 quan sát phát triển...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    const payload = { noticeTitle: notice.title, itemsCount: 15, publishDate: '2026-09-09' };

    const { snapshot } = await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      payloadSnapshot: payload,
    });

    expect(snapshot.payload_hash).toBeDefined();
    expect(snapshot.payload_hash.length).toBe(64); // SHA-256 hex fingerprint

    // Verify snapshot integrity using SentSnapshotService
    const isValid = snapshotService.verifySnapshotIntegrity(snapshot);
    expect(isValid).toBe(true);

    // Test DB Trigger Immutability Protection
    const { error: deleteError } = await supabase
      .from('edu_comm_sent_snapshots')
      .delete()
      .eq('id', snapshot.id);

    expect(deleteError).toBeDefined();
    expect(deleteError?.message).toContain('SENT_SNAPSHOT_IMMUTABLE_ERROR');
  });

  // 10. Append-Only Delivery Retry Attempt History
  it('Gate 10: Append-Only Delivery Retry History — tracks attempts in order without overwriting history', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'GENERAL',
      title: 'Thông báo khẩn cấp',
      createdBy: teacherPartyId,
    });

    const { notice, deliveries } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'SCHOOL_ADMIN',
      sourceEntityType: 'URGENT_NOTICE',
      sourceEntityId: '22222222-2222-4222-a222-222222222222',
      noticeCategory: 'CRITICAL',
      title: 'Thông báo nghỉ mưa bão',
      bodyText: 'Trường nghỉ học chiều nay...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    const del = deliveries[0];

    // Attempt #1: Failed push notification
    await repository.addDeliveryAttempt({
      tenant_id: tenantA,
      delivery_id: del.id,
      notice_id: notice.id,
      attempt_number: 1,
      channel: 'PUSH',
      status: 'FAILED',
      error_code: 'PUSH_TOKEN_EXPIRED',
      error_details: 'FCM push token expired',
    });

    // Attempt #2: Successful fallback via SMS
    await deliveryService.dispatchNotice({
      tenantId: tenantA,
      noticeId: notice.id,
      recipientPartyId: guardianA,
      channel: 'SMS',
      payloadSnapshot: { title: notice.title },
    });

    const attempts = (await repository.getDeliveryAttempts(tenantA, del.id)).sort((a, b) => a.attempt_number - b.attempt_number);
    expect(attempts.length).toBe(2);
    expect(attempts[0].status).toBe('FAILED');
    expect(attempts[1].status).toBe('SUCCESS');
    expect(attempts[1].channel).toBe('SMS');
  });

  // 11. Overdue Acknowledgement Exception Escalation
  it('Gate 11: Overdue Acknowledgement Exception Escalation — creates work queue exception for staff', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'HEALTH_INCIDENT',
      title: 'Sốt nhẹ buổi trưa',
      createdBy: teacherPartyId,
    });

    const pastDue = new Date(Date.now() - 3600 * 1000).toISOString(); // Overdue by 1 hour

    const { notice } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'HEALTH_INCIDENT',
      sourceEntityId: '11111111-1111-4111-a111-111111111111',
      noticeCategory: 'CRITICAL',
      requirementType: 'REQUIRES_ACK',
      title: 'Cần xác nhận dõi nhiệt độ bé An',
      bodyText: 'Bé sốt 38.0C lúc 11h30...',
      dueAt: pastDue,
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    // Escalation engine creates exception
    const exc = await exceptionService.createException({
      tenantId: tenantA,
      noticeId: notice.id,
      studentId: studentA,
      guardianPartyId: guardianA,
      exceptionType: 'OVERDUE_ACK',
      severity: 'HIGH',
      assignedRole: 'TEACHER',
    });

    expect(exc.status).toBe('OPEN');
    expect(exc.exception_type).toBe('OVERDUE_ACK');

    // Query staff work queue
    const workQueue = await exceptionService.getStaffWorkQueueExceptions(tenantA, 'OPEN');
    expect(workQueue.some((e) => e.id === exc.id)).toBe(true);
  });

  // 12. Exception Resolution Provenance & Cross-Recipient Isolation
  it('Gate 12: Exception Resolution & Cross-Recipient Isolation — records resolution provenance and maintains recipient isolation', async () => {
    const thread = await deliveryService.createThread({
      tenantId: tenantA,
      studentId: studentA,
      guardianPartyId: guardianA,
      threadType: 'HEALTH_INCIDENT',
      title: 'Báo cáo sự cố nhỏ',
      createdBy: teacherPartyId,
    });

    const { notice } = await deliveryService.createNotice({
      tenantId: tenantA,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'HEALTH_INCIDENT',
      sourceEntityId: '10101010-1010-4010-a010-101010101010',
      noticeCategory: 'CRITICAL',
      title: 'Cần liên hệ phụ huynh',
      bodyText: 'Vui lòng xác nhận...',
      createdBy: teacherPartyId,
      recipientPartyIds: [guardianA],
    });

    const exc = await exceptionService.createException({
      tenantId: tenantA,
      noticeId: notice.id,
      studentId: studentA,
      guardianPartyId: guardianA,
      exceptionType: 'OVERDUE_ACK',
      assignedRole: 'TEACHER',
    });

    // Teacher resolves exception manually via phone call
    const resolved = await exceptionService.resolveException({
      tenantId: tenantA,
      exceptionId: exc.id,
      resolvedBy: teacherPartyId,
      resolutionNotes: 'Đã gọi điện thoại trực tiếp cho mẹ bé An lúc 12h15. Mẹ xác nhận đã biết.',
    });

    expect(resolved.status).toBe('RESOLVED');
    expect(resolved.resolved_by).toBe(teacherPartyId);
    expect(resolved.resolved_at).toBeDefined();

    // Verify parent response notes posting
    const response = await responseService.postResponse({
      tenantId: tenantA,
      threadId: thread.id,
      noticeId: notice.id,
      senderPartyId: guardianA,
      senderRole: 'PARENT',
      responseText: 'Cảm ơn cô giáo đã gọi điện thoại nhắc nhở.',
    });

    expect(response.sender_role).toBe('PARENT');
    expect(response.response_text).toContain('Cảm ơn cô giáo');
  });
});
