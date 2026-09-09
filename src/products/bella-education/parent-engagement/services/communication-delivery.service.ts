// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT COMMUNICATION DELIVERY SERVICE
// File: src/products/bella-education/parent-engagement/services/communication-delivery.service.ts
// ============================================================================

import crypto from 'crypto';
import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { canonicalJsonString } from './sent-snapshot.service';
import {
  CommunicationThread,
  CommunicationNotice,
  CommunicationDelivery,
  DeliveryAttempt,
  SentSnapshot,
  ThreadType,
  NoticeCategory,
  NoticePriority,
  RequirementType,
  DeliveryChannel,
  P6_ERROR_CODES,
} from '../domain/communication.types';

export interface ICreateThreadDto {
  tenantId: string;
  studentId: string;
  guardianPartyId: string;
  threadType: ThreadType;
  title: string;
  createdBy: string;
}

export interface ICreateNoticeDto {
  tenantId: string;
  threadId: string;
  sourceDomain: string;
  sourceEntityType: string;
  sourceEntityId: string;
  publicationSnapshotRef?: string;
  noticeCategory: NoticeCategory;
  priority?: NoticePriority;
  requirementType?: RequirementType;
  title: string;
  bodyText: string;
  metadata?: Record<string, unknown>;
  dueAt?: string;
  createdBy: string;
  recipientPartyIds: string[];
  channel?: DeliveryChannel;
}

export interface IDispatchNoticeDto {
  tenantId: string;
  noticeId: string;
  recipientPartyId: string;
  channel?: DeliveryChannel;
  payloadSnapshot: Record<string, unknown>;
}

export class CommunicationDeliveryService {
  constructor(private readonly repository: ParentCommunicationRepository) {}

  // 1. Create Communication Thread with Guardian Authorization Guard
  async createThread(dto: ICreateThreadDto): Promise<CommunicationThread> {
    const isAuthorized = await this.repository.validateGuardianAuthorization(
      dto.tenantId,
      dto.studentId,
      dto.guardianPartyId
    );

    if (!isAuthorized) {
      throw new Error(
        `${P6_ERROR_CODES.UNAUTHORIZED_GUARDIAN_RELATIONSHIP}: Guardian ${dto.guardianPartyId} is not authorized for student ${dto.studentId} in tenant ${dto.tenantId}.`
      );
    }

    return await this.repository.createThread({
      tenant_id: dto.tenantId,
      student_id: dto.studentId,
      guardian_party_id: dto.guardianPartyId,
      thread_type: dto.threadType,
      title: dto.title,
      status: 'ACTIVE',
      last_activity_at: new Date().toISOString(),
      created_by: dto.createdBy,
    });
  }

  // 2. Create Notice Projection & Initialize Delivery Records
  async createNotice(dto: ICreateNoticeDto): Promise<{
    notice: CommunicationNotice;
    deliveries: CommunicationDelivery[];
  }> {
    const thread = await this.repository.getThreadById(dto.tenantId, dto.threadId);
    if (!thread) {
      throw new Error(`THREAD_NOT_FOUND: Thread ${dto.threadId} not found in tenant ${dto.tenantId}.`);
    }

    const notice = await this.repository.createNotice({
      tenant_id: dto.tenantId,
      thread_id: dto.threadId,
      source_domain: dto.sourceDomain,
      source_entity_type: dto.sourceEntityType,
      source_entity_id: dto.sourceEntityId,
      publication_snapshot_ref: dto.publicationSnapshotRef,
      notice_category: dto.noticeCategory,
      priority: dto.priority ?? 'NORMAL',
      requirement_type: dto.requirementType ?? 'NOTICE_ONLY',
      title: dto.title,
      body_text: dto.bodyText,
      metadata: dto.metadata ?? {},
      due_at: dto.dueAt,
      is_archived: false,
      created_by: dto.createdBy,
    });

    const deliveries: CommunicationDelivery[] = [];
    const channel = dto.channel ?? 'IN_APP';

    for (const recipientId of dto.recipientPartyIds) {
      // Validate guardian relationship for recipient
      const isAuthorized = await this.repository.validateGuardianAuthorization(
        dto.tenantId,
        thread.student_id,
        recipientId
      );

      if (!isAuthorized) {
        throw new Error(
          `${P6_ERROR_CODES.UNAUTHORIZED_GUARDIAN_RELATIONSHIP}: Recipient ${recipientId} is not authorized for student ${thread.student_id}.`
        );
      }

      const del = await this.repository.createDelivery({
        tenant_id: dto.tenantId,
        notice_id: notice.id,
        recipient_party_id: recipientId,
        channel,
        status: 'READY',
        attempt_count: 0,
      });
      deliveries.push(del);
    }

    return { notice, deliveries };
  }

  // 3. Dispatch Notice Payload & Record Append-Only Delivery Attempt & Immutable Per-Recipient Snapshot
  async dispatchNotice(dto: IDispatchNoticeDto): Promise<{
    delivery: CommunicationDelivery;
    attempt: DeliveryAttempt;
    snapshot: SentSnapshot;
  }> {
    const delivery = await this.repository.getDeliveryByNoticeAndRecipient(
      dto.tenantId,
      dto.noticeId,
      dto.recipientPartyId
    );

    if (!delivery) {
      throw new Error(`DELIVERY_NOT_FOUND: No delivery record for notice ${dto.noticeId} and recipient ${dto.recipientPartyId}.`);
    }

    const channel = dto.channel ?? delivery.channel;
    const attemptNumber = delivery.attempt_count + 1;
    const nowIso = new Date().toISOString();

    // Add append-only attempt record
    const attempt = await this.repository.addDeliveryAttempt({
      tenant_id: dto.tenantId,
      delivery_id: delivery.id,
      notice_id: dto.noticeId,
      attempt_number: attemptNumber,
      channel,
      status: 'SUCCESS',
    });

    // Update aggregate delivery status
    const updatedDelivery = await this.repository.updateDelivery(dto.tenantId, delivery.id, {
      status: 'DELIVERED',
      sent_at: delivery.sent_at ?? nowIso,
      delivered_at: nowIso,
      attempt_count: attemptNumber,
    });

    // Generate SHA-256 Fingerprint for Per-Recipient Sent Snapshot
    const snapshotJsonString = canonicalJsonString(dto.payloadSnapshot);
    const payloadHash = crypto.createHash('sha256').update(snapshotJsonString).digest('hex');

    const snapshot = await this.repository.createSentSnapshot({
      tenant_id: dto.tenantId,
      notice_id: dto.noticeId,
      recipient_party_id: dto.recipientPartyId,
      delivery_id: delivery.id,
      channel,
      payload_snapshot: dto.payloadSnapshot,
      payload_hash: payloadHash,
    });

    return {
      delivery: updatedDelivery,
      attempt,
      snapshot,
    };
  }

  // 4. Record Read Event with State Transition Validation
  async recordRead(tenantId: string, deliveryId: string, recipientPartyId: string): Promise<CommunicationDelivery> {
    const delivery = await this.repository.getDelivery(tenantId, deliveryId);
    if (!delivery) {
      throw new Error(`DELIVERY_NOT_FOUND: Delivery ${deliveryId} not found.`);
    }

    if (delivery.recipient_party_id !== recipientPartyId) {
      throw new Error(`${P6_ERROR_CODES.UNAUTHORIZED_GUARDIAN_RELATIONSHIP}: Recipient mismatch.`);
    }

    // Invariant State Machine Check: Must be SENT or DELIVERED to move to READ
    if (delivery.status === 'DRAFT' || delivery.status === 'READY') {
      throw new Error(
        `${P6_ERROR_CODES.INVALID_DELIVERY_STATE_TRANSITION}: Cannot transition directly from ${delivery.status} to READ.`
      );
    }

    // If already read, return as is
    if (delivery.status === 'READ') {
      return delivery;
    }

    const nowIso = new Date().toISOString();
    return await this.repository.updateDelivery(tenantId, deliveryId, {
      status: 'READ',
      read_at: nowIso,
    });
  }
}
