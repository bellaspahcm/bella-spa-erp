/**
 * E8 - English Center Parent / Student Engagement Types
 */

import type { Party } from '@/platform/party';
import type { EducationStudentDTO } from '@/platform/education/contracts/student.contract';
import type { EnglishCenterEnrollment } from './enrollment.types';

export type EngagementTemplateCategory = 'attendance' | 'progress' | 'tuition' | 'general';
export type EngagementChannel = 'in_app' | 'email' | 'sms' | 'zalo_oa' | 'push';
export type EngagementTriggerType = 'attendance' | 'progress' | 'tuition' | 'manual';
export type EngagementRecipientRole = 'student' | 'parent' | 'guardian';
export type EngagementConsentStatus = 'granted' | 'denied' | 'unknown';
export type EngagementMessageStatus = 'queued' | 'sending' | 'sent' | 'partially_sent' | 'failed' | 'cancelled';
export type EngagementDeliveryStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped';
export type EngagementAcknowledgementStatus = 'not_required' | 'pending' | 'acknowledged' | 'declined';
export type EngagementResponseType = 'acknowledgement' | 'decline' | 'reply';

export interface EngagementEnrollmentContext extends EnglishCenterEnrollment {}
export interface EngagementStudentContext extends EducationStudentDTO {}
export interface EngagementPartyContext extends Party {}

export interface EngagementContentSnapshot {
  readonly title: string;
  readonly body: string;
  readonly variables?: Record<string, unknown>;
}

export interface EngagementRecipientSnapshot {
  readonly partyId: string;
  readonly displayName: string;
  readonly role: EngagementRecipientRole;
  readonly channels: readonly EngagementChannel[];
  readonly consentStatus: EngagementConsentStatus;
  readonly addressSnapshot?: Record<string, unknown>;
}

export interface CreateEngagementTemplateInput {
  readonly branchId?: string | null;
  readonly code: string;
  readonly name: string;
  readonly category: EngagementTemplateCategory;
  readonly defaultChannels: readonly EngagementChannel[];
  readonly titleTemplate: string;
  readonly bodyTemplate: string;
  readonly requiresAcknowledgement?: boolean;
  readonly metadata?: Record<string, unknown>;
}

export interface QueueEngagementMessageRecipientInput {
  readonly partyId: string;
  readonly role: EngagementRecipientRole;
  readonly channels: readonly EngagementChannel[];
  readonly consentStatus: EngagementConsentStatus;
  readonly addressSnapshot?: Record<string, unknown>;
}

export interface QueueEngagementMessageInput {
  readonly templateId?: string | null;
  readonly triggerType: EngagementTriggerType;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly englishEnrollmentId: string;
  readonly studentPartyId: string;
  readonly branchId?: string | null;
  readonly content: EngagementContentSnapshot;
  readonly recipients: readonly QueueEngagementMessageRecipientInput[];
  readonly requiresAcknowledgement?: boolean;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
  readonly dispatchNow?: boolean;
}

export interface RecordEngagementResponseInput {
  readonly recipientId: string;
  readonly responseType: EngagementResponseType;
  readonly body?: string | null;
  readonly actorPartyId: string;
  readonly respondedAt?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface EnglishCenterEngagementTemplate {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string | null;
  readonly code: string;
  readonly name: string;
  readonly category: EngagementTemplateCategory;
  readonly defaultChannels: readonly EngagementChannel[];
  readonly titleTemplate: string;
  readonly bodyTemplate: string;
  readonly requiresAcknowledgement: boolean;
  readonly isActive: boolean;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterEngagementMessage {
  readonly id: string;
  readonly tenantId: string;
  readonly branchId: string;
  readonly templateId: string | null;
  readonly triggerType: EngagementTriggerType;
  readonly sourceType: string;
  readonly sourceId: string;
  readonly englishEnrollmentId: string;
  readonly studentPartyId: string;
  readonly contentSnapshot: EngagementContentSnapshot;
  readonly recipientSnapshot: readonly EngagementRecipientSnapshot[];
  readonly status: EngagementMessageStatus;
  readonly deliveryStatus: EngagementDeliveryStatus;
  readonly acknowledgementStatus: EngagementAcknowledgementStatus;
  readonly idempotencyKey: string;
  readonly sentAt: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterEngagementRecipient {
  readonly id: string;
  readonly tenantId: string;
  readonly messageId: string;
  readonly partyId: string;
  readonly role: EngagementRecipientRole;
  readonly channel: EngagementChannel;
  readonly addressSnapshot: Record<string, unknown>;
  readonly consentStatus: EngagementConsentStatus;
  readonly deliveryStatus: EngagementDeliveryStatus;
  readonly notificationId: string | null;
  readonly deliveredAt: string | null;
  readonly failedReason: string | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface EnglishCenterEngagementResponse {
  readonly id: string;
  readonly tenantId: string;
  readonly messageId: string;
  readonly recipientId: string;
  readonly responseType: EngagementResponseType;
  readonly body: string | null;
  readonly actorPartyId: string;
  readonly respondedAt: string;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface QueueEngagementMessageResult {
  readonly message: EnglishCenterEngagementMessage;
  readonly recipients: readonly EnglishCenterEngagementRecipient[];
}

export interface EngagementDispatchRequest {
  readonly tenantId: string;
  readonly recipient: {
    readonly userId: string;
    readonly name?: string;
    readonly email?: string;
    readonly phone?: string;
    readonly zaloId?: string;
  };
  readonly channels: readonly EngagementChannel[];
  readonly type: string;
  readonly title: string;
  readonly message: string;
  readonly idempotencyKey: string;
  readonly metadata?: Record<string, unknown>;
  readonly resource?: { readonly type: string; readonly id: string; readonly label?: string };
}

export interface EngagementDispatchResult {
  readonly notificationId: string;
  readonly overallStatus: EngagementDeliveryStatus | 'deduplicated';
}

export interface EngagementTemplateRow {
  id: string;
  tenant_id: string;
  branch_id: string | null;
  code: string;
  name: string;
  category: EngagementTemplateCategory;
  default_channels: EngagementChannel[];
  title_template: string;
  body_template: string;
  requires_acknowledgement: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EngagementMessageRow {
  id: string;
  tenant_id: string;
  branch_id: string;
  template_id: string | null;
  trigger_type: EngagementTriggerType;
  source_type: string;
  source_id: string;
  english_enrollment_id: string;
  student_party_id: string;
  content_snapshot: EngagementContentSnapshot;
  recipient_snapshot: EngagementRecipientSnapshot[];
  status: EngagementMessageStatus;
  delivery_status: EngagementDeliveryStatus;
  acknowledgement_status: EngagementAcknowledgementStatus;
  idempotency_key: string;
  sent_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EngagementRecipientRow {
  id: string;
  tenant_id: string;
  message_id: string;
  party_id: string;
  role: EngagementRecipientRole;
  channel: EngagementChannel;
  address_snapshot: Record<string, unknown>;
  consent_status: EngagementConsentStatus;
  delivery_status: EngagementDeliveryStatus;
  notification_id: string | null;
  delivered_at: string | null;
  failed_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface EngagementResponseRow {
  id: string;
  tenant_id: string;
  message_id: string;
  recipient_id: string;
  response_type: EngagementResponseType;
  body: string | null;
  actor_party_id: string;
  responded_at: string;
  metadata: Record<string, unknown>;
  created_at: string;
}
