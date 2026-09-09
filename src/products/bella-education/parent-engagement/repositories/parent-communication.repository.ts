// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT REPOSITORY
// File: src/products/bella-education/parent-engagement/repositories/parent-communication.repository.ts
// ============================================================================

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  CommunicationThread,
  CommunicationNotice,
  CommunicationDelivery,
  DeliveryAttempt,
  CommunicationAcknowledgement,
  ConsentResponse,
  CommunicationResponse,
  CommunicationException,
  SentSnapshot,
  P6_ERROR_CODES,
} from '../domain/communication.types';

export class ParentCommunicationRepository {
  private readonly supabase: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    if (supabase) {
      this.supabase = supabase;
    } else {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
      this.supabase = createClient(url, key);
    }
  }

  // 1. Guardian Authorization Validation
  async validateGuardianAuthorization(
    tenantId: string,
    studentId: string,
    guardianPartyId: string
  ): Promise<boolean> {
    // Check students table for canonical guardian link in metadata or student_guardians table
    const { data: student, error } = await this.supabase
      .from('students')
      .select('student_id, tenant_id, metadata')
      .eq('student_id', studentId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error || !student) {
      return false;
    }

    // Direct match check on metadata->>guardian_party_id or metadata->>guardian_party_ids array
    const metaGuardianId = (student.metadata as Record<string, unknown> | null)?.guardian_party_id;
    const metaGuardianIds = (student.metadata as Record<string, unknown> | null)?.guardian_party_ids as string[] | undefined;

    if (metaGuardianId === guardianPartyId || (metaGuardianIds && metaGuardianIds.includes(guardianPartyId))) {
      return true;
    }

    // Check student_guardians table if present
    const { data: rel } = await this.supabase
      .from('student_guardians')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .eq('guardian_party_id', guardianPartyId)
      .maybeSingle();

    return !!rel;
  }

  // 2. Thread Repository Methods
  async createThread(data: Omit<CommunicationThread, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationThread> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_threads')
      .insert({
        tenant_id: data.tenant_id,
        student_id: data.student_id,
        guardian_party_id: data.guardian_party_id,
        thread_type: data.thread_type,
        title: data.title,
        status: data.status ?? 'ACTIVE',
        last_activity_at: data.last_activity_at ?? new Date().toISOString(),
        created_by: data.created_by,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_THREAD_FAILED: ${error?.message || 'Failed to create thread'}`);
    }
    return res as CommunicationThread;
  }

  async getThreadById(tenantId: string, threadId: string): Promise<CommunicationThread | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_threads')
      .select('*')
      .eq('id', threadId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_THREAD_FAILED: ${error.message}`);
    }
    return data as CommunicationThread | null;
  }

  // 3. Notice Repository Methods
  async createNotice(data: Omit<CommunicationNotice, 'id' | 'created_at'>): Promise<CommunicationNotice> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_notices')
      .insert({
        tenant_id: data.tenant_id,
        thread_id: data.thread_id,
        source_domain: data.source_domain,
        source_entity_type: data.source_entity_type,
        source_entity_id: data.source_entity_id,
        source_version: data.source_version ?? '1',
        projection_type: data.projection_type ?? 'PARENT_PUBLICATION',
        publication_snapshot_ref: data.publication_snapshot_ref ?? null,
        notice_category: data.notice_category,
        priority: data.priority,
        requirement_type: data.requirement_type,
        title: data.title,
        body_text: data.body_text,
        metadata: data.metadata ?? {},
        due_at: data.due_at ?? null,
        is_archived: data.is_archived ?? false,
        created_by: data.created_by,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_NOTICE_FAILED: ${error?.message || 'Failed to create notice'}`);
    }
    return res as CommunicationNotice;
  }

  async getNoticeById(tenantId: string, noticeId: string): Promise<CommunicationNotice | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_notices')
      .select('*')
      .eq('id', noticeId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_NOTICE_FAILED: ${error.message}`);
    }
    return data as CommunicationNotice | null;
  }

  // 4. Delivery Records & Attempts
  async createDelivery(data: Omit<CommunicationDelivery, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationDelivery> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_deliveries')
      .insert({
        tenant_id: data.tenant_id,
        notice_id: data.notice_id,
        recipient_party_id: data.recipient_party_id,
        channel: data.channel,
        status: data.status,
        sent_at: data.sent_at ?? null,
        delivered_at: data.delivered_at ?? null,
        read_at: data.read_at ?? null,
        attempt_count: data.attempt_count ?? 0,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_DELIVERY_FAILED: ${error?.message || 'Failed to create delivery record'}`);
    }
    return res as CommunicationDelivery;
  }

  async updateDelivery(
    tenantId: string,
    deliveryId: string,
    updates: Partial<CommunicationDelivery>
  ): Promise<CommunicationDelivery> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_deliveries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', deliveryId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`UPDATE_DELIVERY_FAILED: ${error?.message || 'Failed to update delivery'}`);
    }
    return res as CommunicationDelivery;
  }

  async getDelivery(tenantId: string, deliveryId: string): Promise<CommunicationDelivery | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_deliveries')
      .select('*')
      .eq('id', deliveryId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_DELIVERY_FAILED: ${error.message}`);
    }
    return data as CommunicationDelivery | null;
  }

  async getDeliveryByNoticeAndRecipient(
    tenantId: string,
    noticeId: string,
    recipientPartyId: string
  ): Promise<CommunicationDelivery | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_deliveries')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('recipient_party_id', recipientPartyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_DELIVERY_FAILED: ${error.message}`);
    }
    return data as CommunicationDelivery | null;
  }

  async addDeliveryAttempt(data: Omit<DeliveryAttempt, 'id' | 'attempted_at'>): Promise<DeliveryAttempt> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_delivery_attempts')
      .insert({
        tenant_id: data.tenant_id,
        delivery_id: data.delivery_id,
        notice_id: data.notice_id,
        attempt_number: data.attempt_number,
        channel: data.channel,
        status: data.status,
        error_code: data.error_code ?? null,
        error_details: data.error_details ?? null,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`ADD_DELIVERY_ATTEMPT_FAILED: ${error?.message || 'Failed to add delivery attempt'}`);
    }
    return res as DeliveryAttempt;
  }

  async getDeliveryAttempts(tenantId: string, deliveryId: string): Promise<DeliveryAttempt[]> {
    const { data, error } = await this.supabase
      .from('edu_comm_delivery_attempts')
      .select('*')
      .eq('delivery_id', deliveryId)
      .eq('tenant_id', tenantId)
      .order('attempt_number', { ascending: true });

    if (error) {
      throw new Error(`FETCH_ATTEMPTS_FAILED: ${error.message}`);
    }
    return (data || []) as DeliveryAttempt[];
  }

  // 5. Acknowledgements
  async createAcknowledgement(data: Omit<CommunicationAcknowledgement, 'id' | 'created_at'>): Promise<CommunicationAcknowledgement> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_acknowledgements')
      .insert({
        tenant_id: data.tenant_id,
        notice_id: data.notice_id,
        guardian_party_id: data.guardian_party_id,
        acknowledgement_type: data.acknowledgement_type ?? 'ACKNOWLEDGED',
        status: data.status ?? 'ACKNOWLEDGED',
        acknowledged_at: data.acknowledged_at ?? new Date().toISOString(),
        signature_note: data.signature_note ?? null,
        ip_hash: data.ip_hash ?? null,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_ACK_FAILED: ${error?.message || 'Failed to create acknowledgement'}`);
    }
    return res as CommunicationAcknowledgement;
  }

  async getAcknowledgement(tenantId: string, noticeId: string, guardianPartyId: string): Promise<CommunicationAcknowledgement | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_acknowledgements')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('guardian_party_id', guardianPartyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_ACK_FAILED: ${error.message}`);
    }
    return data as CommunicationAcknowledgement | null;
  }

  // 6. Consent Responses
  async createConsentResponse(data: Omit<ConsentResponse, 'id' | 'created_at'>): Promise<ConsentResponse> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_consent_responses')
      .insert({
        tenant_id: data.tenant_id,
        notice_id: data.notice_id,
        guardian_party_id: data.guardian_party_id,
        consent_scope: data.consent_scope,
        decision: data.decision,
        decision_at: data.decision_at ?? new Date().toISOString(),
        valid_from: data.valid_from ?? null,
        valid_until: data.valid_until ?? null,
        conditions: data.conditions ?? null,
        revoked_at: data.revoked_at ?? null,
        revoked_by: data.revoked_by ?? null,
        revocation_reason: data.revocation_reason ?? null,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_CONSENT_RESPONSE_FAILED: ${error?.message || 'Failed to create consent response'}`);
    }
    return res as ConsentResponse;
  }

  async getConsentResponse(tenantId: string, noticeId: string, guardianPartyId: string): Promise<ConsentResponse | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_consent_responses')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('guardian_party_id', guardianPartyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_CONSENT_RESPONSE_FAILED: ${error.message}`);
    }
    return data as ConsentResponse | null;
  }

  async updateConsentResponse(
    tenantId: string,
    consentId: string,
    updates: Partial<ConsentResponse>
  ): Promise<ConsentResponse> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_consent_responses')
      .update(updates)
      .eq('id', consentId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`UPDATE_CONSENT_RESPONSE_FAILED: ${error?.message || 'Failed to update consent response'}`);
    }
    return res as ConsentResponse;
  }

  // 7. Parent Responses
  async createResponse(data: Omit<CommunicationResponse, 'id' | 'created_at'>): Promise<CommunicationResponse> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_responses')
      .insert({
        tenant_id: data.tenant_id,
        thread_id: data.thread_id,
        notice_id: data.notice_id ?? null,
        sender_party_id: data.sender_party_id,
        sender_role: data.sender_role,
        response_text: data.response_text,
        attachments: data.attachments ?? [],
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_RESPONSE_FAILED: ${error?.message || 'Failed to create parent response'}`);
    }
    return res as CommunicationResponse;
  }

  async getResponsesByThread(tenantId: string, threadId: string): Promise<CommunicationResponse[]> {
    const { data, error } = await this.supabase
      .from('edu_comm_responses')
      .select('*')
      .eq('thread_id', threadId)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`FETCH_RESPONSES_FAILED: ${error.message}`);
    }
    return (data || []) as CommunicationResponse[];
  }

  // 8. Communication Exceptions
  async createException(data: Omit<CommunicationException, 'id' | 'created_at' | 'updated_at'>): Promise<CommunicationException> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_exceptions')
      .insert({
        tenant_id: data.tenant_id,
        notice_id: data.notice_id ?? null,
        student_id: data.student_id,
        guardian_party_id: data.guardian_party_id,
        exception_type: data.exception_type,
        severity: data.severity,
        assigned_role: data.assigned_role,
        status: data.status ?? 'OPEN',
        resolved_by: data.resolved_by ?? null,
        resolved_at: data.resolved_at ?? null,
        resolution_notes: data.resolution_notes ?? null,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_EXCEPTION_FAILED: ${error?.message || 'Failed to create exception'}`);
    }
    return res as CommunicationException;
  }

  async updateException(
    tenantId: string,
    exceptionId: string,
    updates: Partial<CommunicationException>
  ): Promise<CommunicationException> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_exceptions')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', exceptionId)
      .eq('tenant_id', tenantId)
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`UPDATE_EXCEPTION_FAILED: ${error?.message || 'Failed to update exception'}`);
    }
    return res as CommunicationException;
  }

  async getExceptionsByTenant(tenantId: string, status?: string): Promise<CommunicationException[]> {
    let query = this.supabase
      .from('edu_comm_exceptions')
      .select('*')
      .eq('tenant_id', tenantId);

    if (status) {
      query = query.eq('status', status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`FETCH_EXCEPTIONS_FAILED: ${error.message}`);
    }
    return (data || []) as CommunicationException[];
  }

  // 9. Immutable Sent Snapshots
  async createSentSnapshot(data: Omit<SentSnapshot, 'id' | 'dispatched_at'>): Promise<SentSnapshot> {
    const { data: res, error } = await this.supabase
      .from('edu_comm_sent_snapshots')
      .insert({
        tenant_id: data.tenant_id,
        notice_id: data.notice_id,
        recipient_party_id: data.recipient_party_id,
        delivery_id: data.delivery_id,
        channel: data.channel,
        payload_snapshot: data.payload_snapshot,
        payload_hash: data.payload_hash,
      })
      .select('*')
      .single();

    if (error || !res) {
      throw new Error(`CREATE_SENT_SNAPSHOT_FAILED: ${error?.message || 'Failed to create sent snapshot'}`);
    }
    return res as SentSnapshot;
  }

  async getSentSnapshot(tenantId: string, noticeId: string, recipientPartyId: string): Promise<SentSnapshot | null> {
    const { data, error } = await this.supabase
      .from('edu_comm_sent_snapshots')
      .select('*')
      .eq('notice_id', noticeId)
      .eq('recipient_party_id', recipientPartyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (error) {
      throw new Error(`FETCH_SENT_SNAPSHOT_FAILED: ${error.message}`);
    }
    return data as SentSnapshot | null;
  }
}
