// ============================================================================
// BELLA PRESCHOOL OS: P6.2 CARE PROJECTION BRIDGE
// File: src/products/bella-education/parent-engagement/bridges/care-projection.bridge.ts
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { CommunicationDeliveryService } from '../services/communication-delivery.service';
import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { CommunicationNotice, CommunicationDelivery, P6_ERROR_CODES } from '../domain/communication.types';

export interface IProjectHealthIncidentDto {
  tenantId: string;
  studentId: string;
  guardianPartyIds: string[];
  incidentId: string;
  incidentTitle: string;
  incidentDetails: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  createdBy: string;
  dueAt?: string;
}

export interface IProjectMedicationRequestDto {
  tenantId: string;
  studentId: string;
  guardianPartyIds: string[];
  medicationRequestId: string;
  medicationName: string;
  dosage: string;
  administrationTime: string;
  instructions: string;
  createdBy: string;
  dueAt?: string;
}

export class CareProjectionBridge {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly deliveryService: CommunicationDeliveryService,
    private readonly repository: ParentCommunicationRepository
  ) {}

  // 1. Project Health Incident (Mapped to REQUIRES_ACK)
  async projectHealthIncident(dto: IProjectHealthIncidentDto): Promise<{
    isDuplicate: boolean;
    notice: CommunicationNotice;
    deliveries: CommunicationDelivery[];
  }> {
    // Idempotency check
    const { data: existingNotice } = await this.supabase
      .from('edu_comm_notices')
      .select('*')
      .eq('tenant_id', dto.tenantId)
      .eq('source_domain', 'P4_CARE')
      .eq('source_entity_type', 'HEALTH_INCIDENT')
      .eq('source_entity_id', dto.incidentId)
      .eq('is_archived', false)
      .maybeSingle();

    if (existingNotice) {
      const { data: deliveries } = await this.supabase
        .from('edu_comm_deliveries')
        .select('*')
        .eq('notice_id', existingNotice.id)
        .eq('tenant_id', dto.tenantId);

      return {
        isDuplicate: true,
        notice: existingNotice as CommunicationNotice,
        deliveries: (deliveries || []) as CommunicationDelivery[],
      };
    }

    // Verify student belongs to tenant
    const { data: student } = await this.supabase
      .from('students')
      .select('student_id, tenant_id')
      .eq('student_id', dto.studentId)
      .eq('tenant_id', dto.tenantId)
      .maybeSingle();

    if (!student) {
      throw new Error(`${P6_ERROR_CODES.TENANT_MISMATCH}: Student ${dto.studentId} does not belong to tenant ${dto.tenantId}.`);
    }

    // Create thread using first authorized guardian
    const primaryGuardian = dto.guardianPartyIds[0];
    const thread = await this.deliveryService.createThread({
      tenantId: dto.tenantId,
      studentId: dto.studentId,
      guardianPartyId: primaryGuardian,
      threadType: 'HEALTH_INCIDENT',
      title: `Báo cáo sự cố sức khỏe: ${dto.incidentTitle}`,
      createdBy: dto.createdBy,
    });

    // Policy mapping: Health Incident -> REQUIRES_ACK
    const res = await this.deliveryService.createNotice({
      tenantId: dto.tenantId,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'HEALTH_INCIDENT',
      sourceEntityId: dto.incidentId,
      noticeCategory: 'CRITICAL',
      priority: dto.severity === 'CRITICAL' ? 'URGENT' : 'HIGH',
      requirementType: 'REQUIRES_ACK',
      title: `Sự cố sức khỏe: ${dto.incidentTitle}`,
      bodyText: dto.incidentDetails,
      metadata: { severity: dto.severity },
      dueAt: dto.dueAt,
      createdBy: dto.createdBy,
      recipientPartyIds: dto.guardianPartyIds,
    });

    return {
      isDuplicate: false,
      notice: res.notice,
      deliveries: res.deliveries,
    };
  }

  // 2. Project Medication Authorization Request (Mapped to REQUIRES_CONSENT)
  async projectMedicationRequest(dto: IProjectMedicationRequestDto): Promise<{
    isDuplicate: boolean;
    notice: CommunicationNotice;
    deliveries: CommunicationDelivery[];
  }> {
    // Idempotency check
    const { data: existingNotice } = await this.supabase
      .from('edu_comm_notices')
      .select('*')
      .eq('tenant_id', dto.tenantId)
      .eq('source_domain', 'P4_CARE')
      .eq('source_entity_type', 'MEDICATION_AUTH')
      .eq('source_entity_id', dto.medicationRequestId)
      .eq('is_archived', false)
      .maybeSingle();

    if (existingNotice) {
      const { data: deliveries } = await this.supabase
        .from('edu_comm_deliveries')
        .select('*')
        .eq('notice_id', existingNotice.id)
        .eq('tenant_id', dto.tenantId);

      return {
        isDuplicate: true,
        notice: existingNotice as CommunicationNotice,
        deliveries: (deliveries || []) as CommunicationDelivery[],
      };
    }

    const primaryGuardian = dto.guardianPartyIds[0];
    const thread = await this.deliveryService.createThread({
      tenantId: dto.tenantId,
      studentId: dto.studentId,
      guardianPartyId: primaryGuardian,
      threadType: 'CONSENT_REQUEST',
      title: `Yêu cầu xác nhận ủy quyền thuốc: ${dto.medicationName}`,
      createdBy: dto.createdBy,
    });

    // Policy mapping: Medication Request -> REQUIRES_CONSENT
    const res = await this.deliveryService.createNotice({
      tenantId: dto.tenantId,
      threadId: thread.id,
      sourceDomain: 'P4_CARE',
      sourceEntityType: 'MEDICATION_AUTH',
      sourceEntityId: dto.medicationRequestId,
      noticeCategory: 'CONSENT',
      priority: 'HIGH',
      requirementType: 'REQUIRES_CONSENT',
      title: `Ủy quyền cho bé uống thuốc ${dto.medicationName}`,
      bodyText: `Liều dùng: ${dto.dosage}. Thời gian: ${dto.administrationTime}. Hướng dẫn: ${dto.instructions}`,
      metadata: {
        medicationName: dto.medicationName,
        dosage: dto.dosage,
        administrationTime: dto.administrationTime,
      },
      dueAt: dto.dueAt,
      createdBy: dto.createdBy,
      recipientPartyIds: dto.guardianPartyIds,
    });

    return {
      isDuplicate: false,
      notice: res.notice,
      deliveries: res.deliveries,
    };
  }
}
