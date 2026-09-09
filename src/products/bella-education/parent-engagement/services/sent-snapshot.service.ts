// ============================================================================
// BELLA PRESCHOOL OS: P6 PARENT ENGAGEMENT SENT SNAPSHOT SERVICE
// File: src/products/bella-education/parent-engagement/services/sent-snapshot.service.ts
// ============================================================================

import crypto from 'crypto';
import { ParentCommunicationRepository } from '../repositories/parent-communication.repository';
import { SentSnapshot, DeliveryChannel } from '../domain/communication.types';

/**
 * Deterministic JSON stringifier sorting keys recursively
 * Guarantees hash stability before DB insertion and after DB JSONB retrieval
 */
export function canonicalJsonString(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(canonicalJsonString).join(',') + ']';
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort();
  const entries = keys.map((k) => `${JSON.stringify(k)}:${canonicalJsonString((obj as Record<string, unknown>)[k])}`);
  return '{' + entries.join(',') + '}';
}

export interface ICreateSnapshotDto {
  tenantId: string;
  noticeId: string;
  recipientPartyId: string;
  deliveryId: string;
  channel: DeliveryChannel;
  payloadSnapshot: Record<string, unknown>;
}

export class SentSnapshotService {
  constructor(private readonly repository: ParentCommunicationRepository) {}

  async createSnapshot(dto: ICreateSnapshotDto): Promise<SentSnapshot> {
    const payloadString = canonicalJsonString(dto.payloadSnapshot);
    const payloadHash = crypto.createHash('sha256').update(payloadString).digest('hex');

    return await this.repository.createSentSnapshot({
      tenant_id: dto.tenantId,
      notice_id: dto.noticeId,
      recipient_party_id: dto.recipientPartyId,
      delivery_id: dto.deliveryId,
      channel: dto.channel,
      payload_snapshot: dto.payloadSnapshot,
      payload_hash: payloadHash,
    });
  }

  async getSnapshot(
    tenantId: string,
    noticeId: string,
    recipientPartyId: string
  ): Promise<SentSnapshot | null> {
    return await this.repository.getSentSnapshot(tenantId, noticeId, recipientPartyId);
  }

  verifySnapshotIntegrity(snapshot: SentSnapshot): boolean {
    const payloadString = canonicalJsonString(snapshot.payload_snapshot);
    const computedHash = crypto.createHash('sha256').update(payloadString).digest('hex');
    return computedHash === snapshot.payload_hash;
  }
}
