// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT RESPONSE SERVICE
// File: src/products/bella-education/parent-engagement/services/parent-response.service.ts
// ============================================================================

import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { CommunicationResponse } from '../domain/communication.types';

export interface IPostResponseDto {
  tenantId: string;
  threadId: string;
  noticeId?: string;
  senderPartyId: string;
  senderRole: 'PARENT' | 'TEACHER' | 'SCHOOL_STAFF';
  responseText: string;
  attachments?: Array<{ name: string; url: string; mime_type: string }>;
}

export class ParentResponseService {
  constructor(private readonly repository: ParentCommunicationRepository) {}

  async postResponse(dto: IPostResponseDto): Promise<CommunicationResponse> {
    const thread = await this.repository.getThreadById(dto.tenantId, dto.threadId);
    if (!thread) {
      throw new Error(`THREAD_NOT_FOUND: Thread ${dto.threadId} not found in tenant ${dto.tenantId}.`);
    }

    if (dto.senderRole === 'PARENT') {
      const isAuthorized = await this.repository.validateGuardianAuthorization(
        dto.tenantId,
        thread.student_id,
        dto.senderPartyId
      );

      if (!isAuthorized) {
        throw new Error(`UNAUTHORIZED_SENDER_ERROR: Parent ${dto.senderPartyId} is not authorized for thread ${dto.threadId}.`);
      }
    }

    return await this.repository.createResponse({
      tenant_id: dto.tenantId,
      thread_id: dto.threadId,
      notice_id: dto.noticeId,
      sender_party_id: dto.senderPartyId,
      sender_role: dto.senderRole,
      response_text: dto.responseText,
      attachments: dto.attachments ?? [],
    });
  }

  async getThreadResponses(tenantId: string, threadId: string): Promise<CommunicationResponse[]> {
    return await this.repository.getResponsesByThread(tenantId, threadId);
  }
}
