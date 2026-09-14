import type { IPartyRepository, Party } from '@/platform/party';
import type { IEducationStudentContract } from '@/platform/education/contracts/student.contract';
import {
  EngagementNotificationDispatcher,
  EngagementRepositoryContract,
  EngagementService,
} from '../services/engagement.service';
import {
  EnglishCenterEngagementMessage,
  EnglishCenterEngagementRecipient,
  EnglishCenterEngagementTemplate,
  EngagementEnrollmentContext,
} from '../types/engagement.types';

const TENANT_ID = 'tenant-a';
const BRANCH_ID = 'branch-a';
const STUDENT_PARTY_ID = 'student-a';
const GUARDIAN_PARTY_ID = 'guardian-a';

function makeEnrollment(overrides: Partial<EngagementEnrollmentContext> = {}): EngagementEnrollmentContext {
  return {
    id: 'english-enrollment-a',
    tenantId: TENANT_ID,
    canonicalEnrollmentId: 'canonical-enrollment-a',
    branchId: BRANCH_ID,
    programId: 'program-a',
    classId: 'class-a',
    intake: '2026-09',
    englishLevelAtEnrollment: 'A2',
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeTemplate(overrides: Partial<EnglishCenterEngagementTemplate> = {}): EnglishCenterEngagementTemplate {
  return {
    id: 'template-a',
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    code: 'ATTENDANCE_ABSENCE',
    name: 'Attendance absence',
    category: 'attendance',
    defaultChannels: ['in_app'],
    titleTemplate: 'Absence notice',
    bodyTemplate: 'Student absent today',
    requiresAcknowledgement: true,
    isActive: true,
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeMessage(overrides: Partial<EnglishCenterEngagementMessage> = {}): EnglishCenterEngagementMessage {
  return {
    id: 'message-a',
    tenantId: TENANT_ID,
    branchId: BRANCH_ID,
    templateId: 'template-a',
    triggerType: 'attendance',
    sourceType: 'english_center_session_attendance',
    sourceId: 'attendance-a',
    englishEnrollmentId: 'english-enrollment-a',
    studentPartyId: STUDENT_PARTY_ID,
    contentSnapshot: {
      title: 'Absence notice',
      body: 'Student absent today',
    },
    recipientSnapshot: [{
      partyId: GUARDIAN_PARTY_ID,
      displayName: 'Guardian A',
      role: 'guardian',
      channels: ['in_app'],
      consentStatus: 'granted',
      addressSnapshot: { displayName: 'Guardian A' },
    }],
    status: 'queued',
    deliveryStatus: 'pending',
    acknowledgementStatus: 'pending',
    idempotencyKey: 'engagement-msg-a',
    sentAt: null,
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeRecipient(overrides: Partial<EnglishCenterEngagementRecipient> = {}): EnglishCenterEngagementRecipient {
  return {
    id: 'recipient-a',
    tenantId: TENANT_ID,
    messageId: 'message-a',
    partyId: GUARDIAN_PARTY_ID,
    role: 'guardian',
    channel: 'in_app',
    addressSnapshot: { displayName: 'Guardian A' },
    consentStatus: 'granted',
    deliveryStatus: 'pending',
    notificationId: null,
    deliveredAt: null,
    failedReason: null,
    metadata: {},
    createdAt: '2026-09-14T00:00:00.000Z',
    updatedAt: '2026-09-14T00:00:00.000Z',
    ...overrides,
  };
}

function makeParty(overrides: Partial<Party> = {}): Party {
  return {
    id: GUARDIAN_PARTY_ID,
    tenantId: TENANT_ID,
    partyType: 'person',
    displayName: 'Guardian A',
    identifiers: [],
    roles: [],
    relationships: [{
      targetPartyId: STUDENT_PARTY_ID,
      type: 'guardian_of',
    }],
    version: 1,
    createdAt: new Date('2026-09-14T00:00:00.000Z'),
    updatedAt: new Date('2026-09-14T00:00:00.000Z'),
    ...overrides,
  };
}

function makeRepository(overrides: Partial<EngagementRepositoryContract> = {}): EngagementRepositoryContract {
  const message = makeMessage();
  const recipient = makeRecipient();

  return {
    async getEnrollmentContext() {
      return makeEnrollment();
    },
    async createTemplate(input) {
      return makeTemplate({
        branchId: input.branchId || null,
        code: input.code,
        name: input.name,
        category: input.category,
        defaultChannels: input.defaultChannels,
        titleTemplate: input.titleTemplate,
        bodyTemplate: input.bodyTemplate,
        requiresAcknowledgement: input.requiresAcknowledgement,
        metadata: input.metadata || {},
      });
    },
    async getTemplate() {
      return makeTemplate();
    },
    async getMessageByIdempotency() {
      return null;
    },
    async createMessage(input) {
      return makeMessage({
        branchId: input.branchId,
        templateId: input.templateId || null,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        englishEnrollmentId: input.englishEnrollmentId,
        studentPartyId: input.studentPartyId,
        contentSnapshot: {
          title: String(input.contentSnapshot.title),
          body: String(input.contentSnapshot.body),
          variables: input.contentSnapshot.variables as Record<string, unknown> | undefined,
        },
        recipientSnapshot: input.recipientSnapshot.map((snapshot) => ({
          partyId: String(snapshot.partyId),
          displayName: String(snapshot.displayName),
          role: snapshot.role as 'student' | 'parent' | 'guardian',
          channels: snapshot.channels as ('in_app' | 'email' | 'sms' | 'zalo_oa' | 'push')[],
          consentStatus: snapshot.consentStatus as 'granted' | 'denied' | 'unknown',
          addressSnapshot: snapshot.addressSnapshot as Record<string, unknown> | undefined,
        })),
        acknowledgementStatus: input.acknowledgementStatus,
        idempotencyKey: input.idempotencyKey,
      });
    },
    async createRecipients() {
      return [recipient];
    },
    async listMessageRecipients() {
      return [recipient];
    },
    async getRecipient() {
      return recipient;
    },
    async updateRecipientDelivery(input) {
      return makeRecipient({
        id: input.recipientId,
        deliveryStatus: input.deliveryStatus,
        notificationId: input.notificationId || null,
        deliveredAt: input.deliveredAt || null,
        failedReason: input.failedReason || null,
      });
    },
    async updateMessageDelivery(input) {
      return makeMessage({
        id: input.messageId,
        status: input.status,
        deliveryStatus: input.deliveryStatus,
        sentAt: input.sentAt || null,
      });
    },
    async createResponse(input) {
      return {
        id: 'response-a',
        tenantId: input.tenantId,
        messageId: input.messageId,
        recipientId: input.recipientId,
        responseType: input.responseType,
        body: input.body || null,
        actorPartyId: input.actorPartyId,
        respondedAt: input.respondedAt,
        metadata: input.metadata || {},
        createdAt: '2026-09-14T00:00:00.000Z',
      };
    },
    async updateMessageAcknowledgement(input) {
      return makeMessage({
        id: input.messageId,
        acknowledgementStatus: input.acknowledgementStatus,
      });
    },
    ...overrides,
  };
}

function makeStudentContract(): IEducationStudentContract {
  return {
    async registerStudent(input) {
      return {
        partyId: input.partyId,
        tenantId: input.tenantId,
        studentCode: input.studentCode,
        academicStatus: 'active',
        guardianPartyId: input.guardianPartyId,
      };
    },
    async getStudent() {
      return {
        partyId: STUDENT_PARTY_ID,
        tenantId: TENANT_ID,
        studentCode: 'STU-A',
        academicStatus: 'active',
        guardianPartyId: GUARDIAN_PARTY_ID,
      };
    },
  };
}

function makePartyRepository(party: Party | null = makeParty()): Pick<IPartyRepository, 'findById'> {
  return {
    async findById() {
      return party;
    },
  };
}

function makeDispatcher(): EngagementNotificationDispatcher {
  return {
    sendNotification: jest.fn(async () => ({
      notificationId: 'notif-a',
      overallStatus: 'sent',
    })),
  };
}

function makeQueueInput() {
  return {
    templateId: 'template-a',
    triggerType: 'attendance' as const,
    sourceType: 'english_center_session_attendance',
    sourceId: 'attendance-a',
    englishEnrollmentId: 'english-enrollment-a',
    studentPartyId: STUDENT_PARTY_ID,
    content: {
      title: 'Absence notice',
      body: 'Student absent today',
    },
    recipients: [{
      partyId: GUARDIAN_PARTY_ID,
      role: 'guardian' as const,
      channels: ['in_app' as const],
      consentStatus: 'granted' as const,
      addressSnapshot: { displayName: 'Guardian A' },
    }],
    requiresAcknowledgement: true,
    idempotencyKey: 'engagement-msg-a',
  };
}

describe('E8 - Engagement Service', () => {
  it('queues consent-aware guardian messages with immutable snapshots', async () => {
    const service = new EngagementService(makeRepository(), {
      students: makeStudentContract(),
      parties: makePartyRepository(),
    });

    const result = await service.queueMessage(TENANT_ID, makeQueueInput());

    expect(result.message.branchId).toBe(BRANCH_ID);
    expect(result.message.acknowledgementStatus).toBe('pending');
    expect(result.message.recipientSnapshot[0].partyId).toBe(GUARDIAN_PARTY_ID);
    expect(result.recipients).toHaveLength(1);
  });

  it('rejects branch mismatch before queueing', async () => {
    const service = new EngagementService(makeRepository(), {
      students: makeStudentContract(),
      parties: makePartyRepository(),
    });

    await expect(service.queueMessage(TENANT_ID, {
      ...makeQueueInput(),
      branchId: 'branch-b',
    })).rejects.toThrow('BRANCH_SCOPE_VIOLATION');
  });

  it('rejects guardians not linked to the student', async () => {
    const service = new EngagementService(makeRepository(), {
      students: makeStudentContract(),
      parties: makePartyRepository(makeParty({ id: 'unlinked-guardian', relationships: [] })),
    });

    await expect(service.queueMessage(TENANT_ID, {
      ...makeQueueInput(),
      recipients: [{
        ...makeQueueInput().recipients[0],
        partyId: 'unlinked-guardian',
      }],
    })).rejects.toThrow('GUARDIAN_SCOPE_VIOLATION');
  });

  it('rejects recipients without consent', async () => {
    const service = new EngagementService(makeRepository(), {
      students: makeStudentContract(),
      parties: makePartyRepository(),
    });

    await expect(service.queueMessage(TENANT_ID, {
      ...makeQueueInput(),
      recipients: [{
        ...makeQueueInput().recipients[0],
        consentStatus: 'denied',
      }],
    })).rejects.toThrow('CONSENT_NOT_GRANTED');
  });

  it('replays idempotent queue requests without duplicate inserts', async () => {
    const createMessage = jest.fn(async () => makeMessage());
    const createRecipients = jest.fn(async () => [makeRecipient()]);
    const service = new EngagementService(makeRepository({
      async getMessageByIdempotency() {
        return makeMessage();
      },
      createMessage,
      createRecipients,
    }), {
      students: makeStudentContract(),
      parties: makePartyRepository(),
    });

    const result = await service.queueMessage(TENANT_ID, makeQueueInput());

    expect(result.message.id).toBe('message-a');
    expect(createMessage).not.toHaveBeenCalled();
    expect(createRecipients).not.toHaveBeenCalled();
  });

  it('dispatches queued messages through the injected notification port', async () => {
    const dispatcher = makeDispatcher();
    const updateRecipientDelivery = jest.fn(async () => makeRecipient({ deliveryStatus: 'sent' }));
    const updateMessageDelivery = jest.fn(async () => makeMessage({ status: 'sent', deliveryStatus: 'sent' }));
    const service = new EngagementService(makeRepository({
      updateRecipientDelivery,
      updateMessageDelivery,
    }), {
      students: makeStudentContract(),
      parties: makePartyRepository(),
      notifications: dispatcher,
    });

    const result = await service.queueMessage(TENANT_ID, {
      ...makeQueueInput(),
      dispatchNow: true,
    });

    expect(dispatcher.sendNotification).toHaveBeenCalledTimes(1);
    expect(updateRecipientDelivery).toHaveBeenCalledWith(expect.objectContaining({
      deliveryStatus: 'sent',
      notificationId: 'notif-a',
    }));
    expect(result.recipients[0].id).toBe('recipient-a');
  });

  it('records acknowledgement responses only for the matching recipient party', async () => {
    const updateMessageAcknowledgement = jest.fn(async () => makeMessage({ acknowledgementStatus: 'acknowledged' }));
    const service = new EngagementService(makeRepository({
      updateMessageAcknowledgement,
    }), {
      students: makeStudentContract(),
      parties: makePartyRepository(),
    });

    const response = await service.recordResponse(TENANT_ID, {
      recipientId: 'recipient-a',
      responseType: 'acknowledgement',
      actorPartyId: GUARDIAN_PARTY_ID,
      respondedAt: '2026-09-14T12:00:00.000Z',
    });

    expect(response.responseType).toBe('acknowledgement');
    expect(updateMessageAcknowledgement).toHaveBeenCalledWith({
      tenantId: TENANT_ID,
      messageId: 'message-a',
      acknowledgementStatus: 'acknowledged',
    });
  });
});
