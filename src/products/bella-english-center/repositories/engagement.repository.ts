/**
 * E8 - English Center Engagement Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { EnglishCenterEnrollmentRow } from '../types/enrollment.types';
import {
  EnglishCenterEngagementMessage,
  EnglishCenterEngagementRecipient,
  EnglishCenterEngagementResponse,
  EnglishCenterEngagementTemplate,
  EngagementChannel,
  EngagementConsentStatus,
  EngagementContentSnapshot,
  EngagementDeliveryStatus,
  EngagementEnrollmentContext,
  EngagementMessageRow,
  EngagementRecipientRole,
  EngagementRecipientSnapshot,
  EngagementRecipientRow,
  EngagementResponseRow,
  EngagementTemplateCategory,
  EngagementTemplateRow,
} from '../types/engagement.types';

export class EngagementRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getEnrollmentContext(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<EngagementEnrollmentContext | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', englishEnrollmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapEnrollmentRow(row as EnglishCenterEnrollmentRow);
  }

  async createTemplate(input: {
    tenantId: string;
    branchId?: string | null;
    code: string;
    name: string;
    category: EngagementTemplateCategory;
    defaultChannels: readonly EngagementChannel[];
    titleTemplate: string;
    bodyTemplate: string;
    requiresAcknowledgement: boolean;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterEngagementTemplate> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_templates')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId || null,
        code: input.code,
        name: input.name,
        category: input.category,
        default_channels: [...input.defaultChannels],
        title_template: input.titleTemplate,
        body_template: input.bodyTemplate,
        requires_acknowledgement: input.requiresAcknowledgement,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapTemplateRow(row as EngagementTemplateRow);
  }

  async getTemplate(tenantId: string, templateId: string): Promise<EnglishCenterEngagementTemplate | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_templates')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', templateId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapTemplateRow(row as EngagementTemplateRow);
  }

  async getMessageByIdempotency(
    tenantId: string,
    idempotencyKey: string
  ): Promise<EnglishCenterEngagementMessage | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_messages')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapMessageRow(row as EngagementMessageRow);
  }

  async createMessage(input: {
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
  }): Promise<EnglishCenterEngagementMessage> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_messages')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId,
        template_id: input.templateId || null,
        trigger_type: input.triggerType,
        source_type: input.sourceType,
        source_id: input.sourceId,
        english_enrollment_id: input.englishEnrollmentId,
        student_party_id: input.studentPartyId,
        content_snapshot: input.contentSnapshot,
        recipient_snapshot: [...input.recipientSnapshot],
        acknowledgement_status: input.acknowledgementStatus,
        idempotency_key: input.idempotencyKey,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapMessageRow(row as EngagementMessageRow);
  }

  async createRecipients(input: {
    tenantId: string;
    messageId: string;
    recipients: readonly {
      partyId: string;
      role: EngagementRecipientRole;
      channel: EngagementChannel;
      addressSnapshot?: Record<string, unknown>;
      consentStatus: EngagementConsentStatus;
      metadata?: Record<string, unknown>;
    }[];
  }): Promise<EnglishCenterEngagementRecipient[]> {
    const { data: rows, error } = await this.supabase
      .from('english_center_engagement_recipients')
      .insert(input.recipients.map((recipient) => ({
        tenant_id: input.tenantId,
        message_id: input.messageId,
        party_id: recipient.partyId,
        role: recipient.role,
        channel: recipient.channel,
        address_snapshot: recipient.addressSnapshot || {},
        consent_status: recipient.consentStatus,
        metadata: recipient.metadata || {},
      })))
      .select();

    if (error) throw error;
    return (rows || []).map((row) => this.mapRecipientRow(row as EngagementRecipientRow));
  }

  async listMessageRecipients(
    tenantId: string,
    messageId: string
  ): Promise<EnglishCenterEngagementRecipient[]> {
    const { data: rows, error } = await this.supabase
      .from('english_center_engagement_recipients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('message_id', messageId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return (rows || []).map((row) => this.mapRecipientRow(row as EngagementRecipientRow));
  }

  async getRecipient(
    tenantId: string,
    recipientId: string
  ): Promise<EnglishCenterEngagementRecipient | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_recipients')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', recipientId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapRecipientRow(row as EngagementRecipientRow);
  }

  async updateRecipientDelivery(input: {
    tenantId: string;
    recipientId: string;
    deliveryStatus: EngagementDeliveryStatus;
    notificationId?: string | null;
    deliveredAt?: string | null;
    failedReason?: string | null;
  }): Promise<EnglishCenterEngagementRecipient> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_recipients')
      .update({
        delivery_status: input.deliveryStatus,
        notification_id: input.notificationId || null,
        delivered_at: input.deliveredAt || null,
        failed_reason: input.failedReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.recipientId)
      .select()
      .single();

    if (error) throw error;
    return this.mapRecipientRow(row as EngagementRecipientRow);
  }

  async updateMessageDelivery(input: {
    tenantId: string;
    messageId: string;
    status: 'sent' | 'partially_sent' | 'failed';
    deliveryStatus: EngagementDeliveryStatus;
    sentAt?: string | null;
  }): Promise<EnglishCenterEngagementMessage> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_messages')
      .update({
        status: input.status,
        delivery_status: input.deliveryStatus,
        sent_at: input.sentAt || null,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.messageId)
      .select()
      .single();

    if (error) throw error;
    return this.mapMessageRow(row as EngagementMessageRow);
  }

  async createResponse(input: {
    tenantId: string;
    messageId: string;
    recipientId: string;
    responseType: 'acknowledgement' | 'decline' | 'reply';
    body?: string | null;
    actorPartyId: string;
    respondedAt: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterEngagementResponse> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_responses')
      .insert({
        tenant_id: input.tenantId,
        message_id: input.messageId,
        recipient_id: input.recipientId,
        response_type: input.responseType,
        body: input.body || null,
        actor_party_id: input.actorPartyId,
        responded_at: input.respondedAt,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapResponseRow(row as EngagementResponseRow);
  }

  async updateMessageAcknowledgement(input: {
    tenantId: string;
    messageId: string;
    acknowledgementStatus: 'acknowledged' | 'declined';
  }): Promise<EnglishCenterEngagementMessage> {
    const { data: row, error } = await this.supabase
      .from('english_center_engagement_messages')
      .update({
        acknowledgement_status: input.acknowledgementStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.messageId)
      .select()
      .single();

    if (error) throw error;
    return this.mapMessageRow(row as EngagementMessageRow);
  }

  private mapEnrollmentRow(row: EnglishCenterEnrollmentRow): EngagementEnrollmentContext {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      canonicalEnrollmentId: row.canonical_enrollment_id,
      branchId: row.branch_id,
      programId: row.program_id,
      classId: row.class_id,
      intake: row.intake,
      englishLevelAtEnrollment: row.english_level_at_enrollment,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapTemplateRow(row: EngagementTemplateRow): EnglishCenterEngagementTemplate {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      code: row.code,
      name: row.name,
      category: row.category,
      defaultChannels: row.default_channels,
      titleTemplate: row.title_template,
      bodyTemplate: row.body_template,
      requiresAcknowledgement: row.requires_acknowledgement,
      isActive: row.is_active,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapMessageRow(row: EngagementMessageRow): EnglishCenterEngagementMessage {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      templateId: row.template_id,
      triggerType: row.trigger_type,
      sourceType: row.source_type,
      sourceId: row.source_id,
      englishEnrollmentId: row.english_enrollment_id,
      studentPartyId: row.student_party_id,
      contentSnapshot: row.content_snapshot,
      recipientSnapshot: row.recipient_snapshot,
      status: row.status,
      deliveryStatus: row.delivery_status,
      acknowledgementStatus: row.acknowledgement_status,
      idempotencyKey: row.idempotency_key,
      sentAt: row.sent_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapRecipientRow(row: EngagementRecipientRow): EnglishCenterEngagementRecipient {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      messageId: row.message_id,
      partyId: row.party_id,
      role: row.role,
      channel: row.channel,
      addressSnapshot: row.address_snapshot,
      consentStatus: row.consent_status,
      deliveryStatus: row.delivery_status,
      notificationId: row.notification_id,
      deliveredAt: row.delivered_at,
      failedReason: row.failed_reason,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapResponseRow(row: EngagementResponseRow): EnglishCenterEngagementResponse {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      messageId: row.message_id,
      recipientId: row.recipient_id,
      responseType: row.response_type,
      body: row.body,
      actorPartyId: row.actor_party_id,
      respondedAt: row.responded_at,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}
