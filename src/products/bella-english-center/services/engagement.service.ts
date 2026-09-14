/**
 * E8 - English Center Parent / Student Engagement Service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import type { IPartyRepository, Party } from '@/platform/party';
import type { IEducationStudentContract } from '@/platform/education/contracts/student.contract';
import { EngagementRepository } from '../repositories/engagement.repository';
import {
  CreateEngagementTemplateInput,
  EnglishCenterEngagementMessage,
  EnglishCenterEngagementRecipient,
  EnglishCenterEngagementResponse,
  EnglishCenterEngagementTemplate,
  EngagementContentSnapshot,
  EngagementDeliveryStatus,
  EngagementDispatchRequest,
  EngagementDispatchResult,
  EngagementEnrollmentContext,
  EngagementPartyContext,
  EngagementRecipientSnapshot,
  QueueEngagementMessageInput,
  QueueEngagementMessageResult,
  RecordEngagementResponseInput,
} from '../types/engagement.types';

export interface EngagementRepositoryContract {
  getEnrollmentContext(tenantId: string, englishEnrollmentId: string): Promise<EngagementEnrollmentContext | null>;
  createTemplate(input: {
    tenantId: string;
    branchId?: string | null;
    code: string;
    name: string;
    category: CreateEngagementTemplateInput['category'];
    defaultChannels: CreateEngagementTemplateInput['defaultChannels'];
    titleTemplate: string;
    bodyTemplate: string;
    requiresAcknowledgement: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterEngagementTemplate>;
  getTemplate(tenantId: string, templateId: string): Promise<EnglishCenterEngagementTemplate | null>;
  getMessageByIdempotency(tenantId: string, idempotencyKey: string): Promise<EnglishCenterEngagementMessage | null>;
  createMessage(input: {
    tenantId: string;
    branchId: string;
    templateId?: string | null;
    triggerType: string;
    sourceType: string;
    sourceId: string;
    englishEnrollmentId: string;
    studentPartyId: string;
    contentSnapshot: EngagementContentSnapshot;
    recipientSnapshot: readonly EngagementRecipientSnapshot[];
    acknowledgementStatus: 'not_required' | 'pending';
    idempotencyKey: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterEngagementMessage>;
  createRecipients(input: {
    tenantId: string;
    messageId: string;
    recipients: readonly {
      partyId: string;
      role: 'student' | 'parent' | 'guardian';
      channel: 'in_app' | 'email' | 'sms' | 'zalo_oa' | 'push';
      addressSnapshot?: Record<string, unknown>;
      consentStatus: 'granted' | 'denied' | 'unknown';
      metadata?: Record<string, unknown>;
    }[];
  }): Promise<EnglishCenterEngagementRecipient[]>;
  listMessageRecipients(tenantId: string, messageId: string): Promise<EnglishCenterEngagementRecipient[]>;
  getRecipient(tenantId: string, recipientId: string): Promise<EnglishCenterEngagementRecipient | null>;
  updateRecipientDelivery(input: {
    tenantId: string;
    recipientId: string;
    deliveryStatus: EngagementDeliveryStatus;
    notificationId?: string | null;
    deliveredAt?: string | null;
    failedReason?: string | null;
  }): Promise<EnglishCenterEngagementRecipient>;
  updateMessageDelivery(input: {
    tenantId: string;
    messageId: string;
    status: 'sent' | 'partially_sent' | 'failed';
    deliveryStatus: EngagementDeliveryStatus;
    sentAt?: string | null;
  }): Promise<EnglishCenterEngagementMessage>;
  createResponse(input: {
    tenantId: string;
    messageId: string;
    recipientId: string;
    responseType: 'acknowledgement' | 'decline' | 'reply';
    body?: string | null;
    actorPartyId: string;
    respondedAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterEngagementResponse>;
  updateMessageAcknowledgement(input: {
    tenantId: string;
    messageId: string;
    acknowledgementStatus: 'acknowledged' | 'declined';
  }): Promise<EnglishCenterEngagementMessage>;
}

export interface EngagementNotificationDispatcher {
  sendNotification(request: EngagementDispatchRequest): Promise<EngagementDispatchResult>;
}

export interface EngagementContracts {
  readonly students: IEducationStudentContract;
  readonly parties: Pick<IPartyRepository, 'findById'>;
  readonly notifications?: EngagementNotificationDispatcher;
}

export class EngagementService {
  private readonly repository: EngagementRepositoryContract;
  private readonly contracts: EngagementContracts;

  constructor(
    supabaseOrRepository: SupabaseClient | EngagementRepositoryContract,
    contracts: EngagementContracts
  ) {
    this.repository = this.isRepository(supabaseOrRepository)
      ? supabaseOrRepository
      : new EngagementRepository(supabaseOrRepository);
    this.contracts = contracts;
  }

  async createTemplate(
    tenantId: string,
    input: CreateEngagementTemplateInput
  ): Promise<EnglishCenterEngagementTemplate> {
    if (!tenantId || !input.code || !input.name || !input.titleTemplate || !input.bodyTemplate) {
      throw new Error('INVALID_ENGAGEMENT_TEMPLATE_INPUT');
    }
    if (input.defaultChannels.length === 0) {
      throw new Error('ENGAGEMENT_TEMPLATE_CHANNEL_REQUIRED');
    }

    return this.repository.createTemplate({
      tenantId,
      branchId: input.branchId || null,
      code: input.code,
      name: input.name,
      category: input.category,
      defaultChannels: input.defaultChannels,
      titleTemplate: input.titleTemplate,
      bodyTemplate: input.bodyTemplate,
      requiresAcknowledgement: input.requiresAcknowledgement || false,
      metadata: input.metadata,
    });
  }

  async queueMessage(
    tenantId: string,
    input: QueueEngagementMessageInput
  ): Promise<QueueEngagementMessageResult> {
    if (!tenantId || !input.englishEnrollmentId || !input.studentPartyId || !input.idempotencyKey) {
      throw new Error('INVALID_ENGAGEMENT_MESSAGE_INPUT');
    }
    if (input.recipients.length === 0) {
      throw new Error('ENGAGEMENT_RECIPIENT_REQUIRED');
    }

    const existing = await this.repository.getMessageByIdempotency(tenantId, input.idempotencyKey);
    if (existing) {
      return {
        message: existing,
        recipients: await this.repository.listMessageRecipients(tenantId, existing.id),
      };
    }

    const enrollment = await this.requireEnrollment(tenantId, input.englishEnrollmentId);
    if (input.branchId && input.branchId !== enrollment.branchId) {
      throw new Error('BRANCH_SCOPE_VIOLATION');
    }

    const student = await this.contracts.students.getStudent(tenantId, input.studentPartyId);
    if (!student) {
      throw new Error('STUDENT_NOT_FOUND');
    }

    const template = input.templateId
      ? await this.requireTemplate(tenantId, input.templateId)
      : null;
    if (template && template.branchId && template.branchId !== enrollment.branchId) {
      throw new Error('BRANCH_SCOPE_VIOLATION');
    }

    const recipientSnapshots = await this.resolveRecipients(tenantId, input, student.guardianPartyId);
    const requiresAcknowledgement = input.requiresAcknowledgement ?? template?.requiresAcknowledgement ?? false;

    const message = await this.repository.createMessage({
      tenantId,
      branchId: enrollment.branchId,
      templateId: template?.id || null,
      triggerType: input.triggerType,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      englishEnrollmentId: input.englishEnrollmentId,
      studentPartyId: input.studentPartyId,
      contentSnapshot: input.content,
      recipientSnapshot: recipientSnapshots,
      acknowledgementStatus: requiresAcknowledgement ? 'pending' : 'not_required',
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    });

    const recipients = await this.repository.createRecipients({
      tenantId,
      messageId: message.id,
      recipients: input.recipients.flatMap((recipient) => recipient.channels.map((channel) => ({
        partyId: recipient.partyId,
        role: recipient.role,
        channel,
        addressSnapshot: recipient.addressSnapshot,
        consentStatus: recipient.consentStatus,
        metadata: input.metadata,
      }))),
    });

    if (input.dispatchNow) {
      await this.dispatchMessage(tenantId, message, recipients);
      return {
        message,
        recipients: await this.repository.listMessageRecipients(tenantId, message.id),
      };
    }

    return { message, recipients };
  }

  async dispatchQueuedMessage(
    tenantId: string,
    message: EnglishCenterEngagementMessage
  ): Promise<EnglishCenterEngagementMessage> {
    const recipients = await this.repository.listMessageRecipients(tenantId, message.id);
    return this.dispatchMessage(tenantId, message, recipients);
  }

  async recordResponse(
    tenantId: string,
    input: RecordEngagementResponseInput
  ): Promise<EnglishCenterEngagementResponse> {
    if (!tenantId || !input.recipientId || !input.actorPartyId) {
      throw new Error('INVALID_ENGAGEMENT_RESPONSE_INPUT');
    }

    const recipient = await this.repository.getRecipient(tenantId, input.recipientId);
    if (!recipient) {
      throw new Error('ENGAGEMENT_RECIPIENT_NOT_FOUND');
    }
    if (recipient.partyId !== input.actorPartyId) {
      throw new Error('RECIPIENT_ACTOR_MISMATCH');
    }

    const response = await this.repository.createResponse({
      tenantId,
      messageId: recipient.messageId,
      recipientId: recipient.id,
      responseType: input.responseType,
      body: input.body || null,
      actorPartyId: input.actorPartyId,
      respondedAt: input.respondedAt || new Date().toISOString(),
      metadata: input.metadata,
    });

    if (input.responseType === 'acknowledgement' || input.responseType === 'decline') {
      await this.repository.updateMessageAcknowledgement({
        tenantId,
        messageId: recipient.messageId,
        acknowledgementStatus: input.responseType === 'acknowledgement' ? 'acknowledged' : 'declined',
      });
    }

    return response;
  }

  private async dispatchMessage(
    tenantId: string,
    message: EnglishCenterEngagementMessage,
    recipients: readonly EnglishCenterEngagementRecipient[]
  ): Promise<EnglishCenterEngagementMessage> {
    if (!this.contracts.notifications) {
      throw new Error('NOTIFICATION_DISPATCHER_NOT_CONFIGURED');
    }

    let sent = 0;
    let failed = 0;
    const sentAt = new Date().toISOString();

    for (const recipient of recipients) {
      if (recipient.consentStatus !== 'granted') {
        await this.repository.updateRecipientDelivery({
          tenantId,
          recipientId: recipient.id,
          deliveryStatus: 'skipped',
          failedReason: 'CONSENT_NOT_GRANTED',
        });
        continue;
      }

      const result = await this.contracts.notifications.sendNotification({
        tenantId,
        recipient: {
          userId: recipient.partyId,
          name: String(recipient.addressSnapshot.displayName || ''),
          email: typeof recipient.addressSnapshot.email === 'string' ? recipient.addressSnapshot.email : undefined,
          phone: typeof recipient.addressSnapshot.phone === 'string' ? recipient.addressSnapshot.phone : undefined,
          zaloId: typeof recipient.addressSnapshot.zaloId === 'string' ? recipient.addressSnapshot.zaloId : undefined,
        },
        channels: [recipient.channel],
        type: `ENGLISH_CENTER_${message.triggerType.toUpperCase()}`,
        title: message.contentSnapshot.title,
        message: message.contentSnapshot.body,
        idempotencyKey: `${message.idempotencyKey}:${recipient.id}`,
        metadata: message.metadata,
        resource: { type: message.sourceType, id: message.sourceId },
      });

      if (result.overallStatus === 'sent' || result.overallStatus === 'delivered' || result.overallStatus === 'deduplicated') {
        sent += 1;
        await this.repository.updateRecipientDelivery({
          tenantId,
          recipientId: recipient.id,
          deliveryStatus: 'sent',
          notificationId: result.notificationId,
          deliveredAt: sentAt,
        });
      } else {
        failed += 1;
        await this.repository.updateRecipientDelivery({
          tenantId,
          recipientId: recipient.id,
          deliveryStatus: 'failed',
          notificationId: result.notificationId,
          failedReason: result.overallStatus,
        });
      }
    }

    const deliverable = recipients.filter((recipient) => recipient.consentStatus === 'granted').length;
    const status = sent > 0 && failed === 0
      ? 'sent'
      : sent > 0
      ? 'partially_sent'
      : 'failed';
    const deliveryStatus: EngagementDeliveryStatus = sent === deliverable && deliverable > 0
      ? 'sent'
      : sent > 0
      ? 'sent'
      : 'failed';

    return this.repository.updateMessageDelivery({
      tenantId,
      messageId: message.id,
      status,
      deliveryStatus,
      sentAt,
    });
  }

  private async resolveRecipients(
    tenantId: string,
    input: QueueEngagementMessageInput,
    guardianPartyId?: string
  ): Promise<EngagementRecipientSnapshot[]> {
    const snapshots: EngagementRecipientSnapshot[] = [];

    for (const recipient of input.recipients) {
      if (recipient.consentStatus !== 'granted') {
        throw new Error('CONSENT_NOT_GRANTED');
      }
      if (recipient.channels.length === 0) {
        throw new Error('ENGAGEMENT_RECIPIENT_CHANNEL_REQUIRED');
      }

      const party = await this.requireParty(tenantId, recipient.partyId);
      if (recipient.role === 'student' && recipient.partyId !== input.studentPartyId) {
        throw new Error('STUDENT_RECIPIENT_MISMATCH');
      }
      if ((recipient.role === 'parent' || recipient.role === 'guardian') &&
        !this.isGuardianLinkedToStudent(party, input.studentPartyId, guardianPartyId)) {
        throw new Error('GUARDIAN_SCOPE_VIOLATION');
      }

      snapshots.push({
        partyId: recipient.partyId,
        displayName: party.displayName,
        role: recipient.role,
        channels: recipient.channels,
        consentStatus: recipient.consentStatus,
        addressSnapshot: recipient.addressSnapshot || {},
      });
    }

    return snapshots;
  }

  private isGuardianLinkedToStudent(
    party: EngagementPartyContext,
    studentPartyId: string,
    guardianPartyId?: string
  ): boolean {
    return party.id === guardianPartyId ||
      party.relationships.some((relationship) =>
        relationship.targetPartyId === studentPartyId &&
        (relationship.type === 'parent_of' || relationship.type === 'guardian_of')
      );
  }

  private async requireEnrollment(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EngagementEnrollmentContext> {
    const enrollment = await this.repository.getEnrollmentContext(tenantId, englishEnrollmentId);
    if (!enrollment) {
      throw new Error('ENGLISH_ENROLLMENT_NOT_FOUND');
    }
    return enrollment;
  }

  private async requireTemplate(
    tenantId: string,
    templateId: string
  ): Promise<EnglishCenterEngagementTemplate> {
    const template = await this.repository.getTemplate(tenantId, templateId);
    if (!template) {
      throw new Error('ENGAGEMENT_TEMPLATE_NOT_FOUND');
    }
    if (!template.isActive) {
      throw new Error('ENGAGEMENT_TEMPLATE_INACTIVE');
    }
    return template;
  }

  private async requireParty(tenantId: string, partyId: string): Promise<Party> {
    const party = await this.contracts.parties.findById(tenantId, partyId);
    if (!party) {
      throw new Error('PARTY_NOT_FOUND');
    }
    return party;
  }

  private isRepository(value: SupabaseClient | EngagementRepositoryContract): value is EngagementRepositoryContract {
    return typeof (value as EngagementRepositoryContract).createMessage === 'function';
  }
}
