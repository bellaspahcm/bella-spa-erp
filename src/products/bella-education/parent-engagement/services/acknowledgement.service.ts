// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT ACKNOWLEDGEMENT SERVICE
// File: src/products/bella-education/parent-engagement/services/acknowledgement.service.ts
// ============================================================================

import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { CommunicationAcknowledgement, P6_ERROR_CODES } from '../domain/communication.types';

export interface IAcknowledgeNoticeDto {
  tenantId: string;
  noticeId: string;
  guardianPartyId: string;
  signatureNote?: string;
  ipHash?: string;
}

export class AcknowledgementService {
  constructor(private readonly repository: ParentCommunicationRepository) {}

  async acknowledgeNotice(dto: IAcknowledgeNoticeDto): Promise<CommunicationAcknowledgement> {
    const notice = await this.repository.getNoticeById(dto.tenantId, dto.noticeId);
    if (!notice) {
      throw new Error(`NOTICE_NOT_FOUND: Notice ${dto.noticeId} not found in tenant ${dto.tenantId}.`);
    }

    // Fetch delivery record for the guardian
    const delivery = await this.repository.getDeliveryByNoticeAndRecipient(
      dto.tenantId,
      dto.noticeId,
      dto.guardianPartyId
    );

    if (!delivery) {
      throw new Error(`DELIVERY_NOT_FOUND: No delivery record for notice ${dto.noticeId} and guardian ${dto.guardianPartyId}.`);
    }

    // Invariant Guard: READ != ACKNOWLEDGED
    // Parent must have read the notice first before acknowledging
    if (delivery.status !== 'READ' && !delivery.read_at) {
      throw new Error(
        `${P6_ERROR_CODES.ACKNOWLEDGED_BEFORE_READ}: Cannot acknowledge notice ${dto.noticeId} before it has been read by guardian ${dto.guardianPartyId}.`
      );
    }

    // Check if already acknowledged
    const existingAck = await this.repository.getAcknowledgement(
      dto.tenantId,
      dto.noticeId,
      dto.guardianPartyId
    );
    if (existingAck) {
      return existingAck;
    }

    return await this.repository.createAcknowledgement({
      tenant_id: dto.tenantId,
      notice_id: dto.noticeId,
      guardian_party_id: dto.guardianPartyId,
      acknowledgement_type: 'ACKNOWLEDGED',
      status: 'ACKNOWLEDGED',
      acknowledged_at: new Date().toISOString(),
      signature_note: dto.signatureNote,
      ip_hash: dto.ipHash,
    });
  }

  async getAcknowledgementStatus(
    tenantId: string,
    noticeId: string,
    guardianPartyId: string
  ): Promise<{
    isRead: boolean;
    isAcknowledged: boolean;
    acknowledgement?: CommunicationAcknowledgement;
  }> {
    const delivery = await this.repository.getDeliveryByNoticeAndRecipient(
      tenantId,
      noticeId,
      guardianPartyId
    );
    const ack = await this.repository.getAcknowledgement(tenantId, noticeId, guardianPartyId);

    return {
      isRead: !!(delivery && (delivery.status === 'READ' || delivery.read_at)),
      isAcknowledged: !!ack,
      acknowledgement: ack ?? undefined,
    };
  }
}
