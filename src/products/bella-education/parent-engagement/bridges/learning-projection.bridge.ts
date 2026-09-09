// ============================================================================
// BELLA PRESCHOOL OS: P6.2 LEARNING PROJECTION BRIDGE
// File: src/products/bella-education/parent-engagement/bridges/learning-projection.bridge.ts
// ============================================================================

import { SupabaseClient } from '@supabase/supabase-js';
import { CommunicationDeliveryService } from '../services/communication-delivery.service';
import { CommunicationNotice, CommunicationDelivery, P6_ERROR_CODES } from '../domain/communication.types';

export interface IProjectPublishedPortfolioDto {
  tenantId: string;
  studentId: string;
  guardianPartyIds: string[];
  portfolioVersionId: string;
  periodLabel: string;
  publisherId: string;
}

export class LearningProjectionBridge {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly deliveryService: CommunicationDeliveryService
  ) {}

  async projectPublishedPortfolio(dto: IProjectPublishedPortfolioDto): Promise<{
    isDuplicate: boolean;
    notice: CommunicationNotice;
    deliveries: CommunicationDelivery[];
  }> {
    // 1. Publication Safety Check: Fetch portfolio version from P5
    const { data: ver, error: vErr } = await this.supabase
      .from('edu_dev_portfolio_versions')
      .select('*')
      .eq('id', dto.portfolioVersionId)
      .eq('tenant_id', dto.tenantId)
      .maybeSingle();

    if (vErr || !ver) {
      throw new Error(`PORTFOLIO_VERSION_NOT_FOUND: Version ${dto.portfolioVersionId} not found.`);
    }

    // Publication Safety Guard: Must be PUBLISHED
    if (ver.status !== 'PUBLISHED') {
      throw new Error(
        `${P6_ERROR_CODES.PORTFOLIO_NOT_PUBLISHED}: Cannot project non-published portfolio version (status: ${ver.status}). Only PUBLISHED versions can be projected to parents.`
      );
    }

    // 2. Idempotency Check
    const { data: existingNotice } = await this.supabase
      .from('edu_comm_notices')
      .select('*')
      .eq('tenant_id', dto.tenantId)
      .eq('source_domain', 'P5_LEARNING')
      .eq('source_entity_type', 'PORTFOLIO')
      .eq('source_entity_id', dto.portfolioVersionId)
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

    // 3. Create thread and notice
    const primaryGuardian = dto.guardianPartyIds[0];
    const thread = await this.deliveryService.createThread({
      tenantId: dto.tenantId,
      studentId: dto.studentId,
      guardianPartyId: primaryGuardian,
      threadType: 'PORTFOLIO',
      title: `Hồ sơ phát triển: ${dto.periodLabel}`,
      createdBy: dto.publisherId,
    });

    // Policy mapping: Published Portfolio -> NOTICE_ONLY
    const res = await this.deliveryService.createNotice({
      tenantId: dto.tenantId,
      threadId: thread.id,
      sourceDomain: 'P5_LEARNING',
      sourceEntityType: 'PORTFOLIO',
      sourceEntityId: dto.portfolioVersionId,
      publicationSnapshotRef: `PORTFOLIO_VER_${ver.version_number}`,
      noticeCategory: 'INFO',
      priority: 'NORMAL',
      requirementType: 'NOTICE_ONLY',
      title: `Hồ sơ phát triển của bé - ${dto.periodLabel}`,
      bodyText: `Kính gửi phụ huynh, nhà trường đã tổng hợp và xuất bản Hồ sơ phát triển giai đoạn ${dto.periodLabel}. Kính mời phụ huynh xem chi tiết.`,
      metadata: {
        portfolioVersionId: dto.portfolioVersionId,
        versionNumber: ver.version_number,
        periodLabel: dto.periodLabel,
      },
      createdBy: dto.publisherId,
      recipientPartyIds: dto.guardianPartyIds,
    });

    return {
      isDuplicate: false,
      notice: res.notice,
      deliveries: res.deliveries,
    };
  }
}
