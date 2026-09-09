// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT CONSENT RESPONSE SERVICE
// File: src/products/bella-education/parent-engagement/services/consent.service.ts
// ============================================================================

import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import {
  ConsentResponse,
  ConsentDecision,
  ConsentScope,
  P6_ERROR_CODES,
} from '../domain/communication.types';

export interface IRecordConsentResponseDto {
  tenantId: string;
  noticeId: string;
  guardianPartyId: string;
  consentScope: ConsentScope;
  decision: ConsentDecision; // APPROVED, DECLINED
  validFrom?: string;
  validUntil?: string;
  conditions?: string;
}

export class ConsentService {
  constructor(private readonly repository: ParentCommunicationRepository) {}

  async recordConsentResponse(dto: IRecordConsentResponseDto): Promise<{
    consentResponse: ConsentResponse;
    domainDirectiveNote: string;
  }> {
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

    // Invariant Guard: READ before CONSENT
    if (delivery.status !== 'READ' && !delivery.read_at) {
      throw new Error(
        `${P6_ERROR_CODES.CONSENT_BEFORE_READ}: Cannot record consent response for notice ${dto.noticeId} before it has been read by guardian ${dto.guardianPartyId}.`
      );
    }

    // Check existing consent response
    const existingConsent = await this.repository.getConsentResponse(
      dto.tenantId,
      dto.noticeId,
      dto.guardianPartyId
    );

    let consentResponse: ConsentResponse;
    const nowIso = new Date().toISOString();

    if (existingConsent) {
      consentResponse = await this.repository.updateConsentResponse(dto.tenantId, existingConsent.id, {
        decision: dto.decision,
        decision_at: nowIso,
        conditions: dto.conditions ?? existingConsent.conditions,
      });
    } else {
      consentResponse = await this.repository.createConsentResponse({
        tenant_id: dto.tenantId,
        notice_id: dto.noticeId,
        guardian_party_id: dto.guardianPartyId,
        consent_scope: dto.consentScope,
        decision: dto.decision,
        decision_at: nowIso,
        valid_from: dto.validFrom ?? nowIso,
        valid_until: dto.validUntil,
        conditions: dto.conditions,
      });
    }

    // Enforcement of Correction 1: P6 consent is evidence ONLY, NOT canonical domain authorization
    let domainDirectiveNote = 'Consent response recorded as communication evidence.';

    if (dto.consentScope === 'MEDICATION_ADMIN') {
      domainDirectiveNote =
        'Parent medication consent response captured as communication evidence. Canonical medication administration authorization must be validated and executed by P4 Care & Wellbeing service.';
    }

    return {
      consentResponse,
      domainDirectiveNote,
    };
  }

  async revokeConsent(
    tenantId: string,
    consentId: string,
    revokedBy: string,
    revocationReason: string
  ): Promise<ConsentResponse> {
    const nowIso = new Date().toISOString();
    return await this.repository.updateConsentResponse(tenantId, consentId, {
      decision: 'REVOKED',
      revoked_at: nowIso,
      revoked_by: revokedBy,
      revocation_reason: revocationReason,
    });
  }
}
