// ============================================================================
// BELLA PRESCHOOL OS: P6.2 CLASSROOM PROJECTION BRIDGE
// File: src/products/bella-education/parent-engagement/bridges/classroom-projection.bridge.ts
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { CommunicationDeliveryService } from '../services/communication-delivery.service';
import { CommunicationNotice, CommunicationDelivery } from '../domain/communication.types';

export interface IProjectClassroomAnnouncementDto {
  tenantId: string;
  studentId: string;
  guardianPartyIds: string[];
  announcementId: string;
  title: string;
  bodyText: string;
  createdBy: string;
}

export class ClassroomProjectionBridge {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly deliveryService: CommunicationDeliveryService
  ) {}

  async projectAnnouncement(dto: IProjectClassroomAnnouncementDto): Promise<{
    isDuplicate: boolean;
    notice: CommunicationNotice;
    deliveries: CommunicationDelivery[];
  }> {
    // Idempotency check
    const { data: existingNotice } = await this.supabase
      .from('edu_comm_notices')
      .select('*')
      .eq('tenant_id', dto.tenantId)
      .eq('source_domain', 'P3_CLASSROOM')
      .eq('source_entity_type', 'ANNOUNCEMENT')
      .eq('source_entity_id', dto.announcementId)
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
      threadType: 'GENERAL',
      title: dto.title,
      createdBy: dto.createdBy,
    });

    // Policy mapping: Classroom Announcement -> NOTICE_ONLY
    const res = await this.deliveryService.createNotice({
      tenantId: dto.tenantId,
      threadId: thread.id,
      sourceDomain: 'P3_CLASSROOM',
      sourceEntityType: 'ANNOUNCEMENT',
      sourceEntityId: dto.announcementId,
      noticeCategory: 'INFO',
      priority: 'NORMAL',
      requirementType: 'NOTICE_ONLY',
      title: dto.title,
      bodyText: dto.bodyText,
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
