/**
 * @fileoverview Timeline Engine — Platform Event Store
 *
 * The Timeline Engine is an append-only, immutable Event Store that records
 * every meaningful interaction of a Party across their entire lifecycle.
 *
 * Key properties:
 * - Append-only (no UPDATE or DELETE at the database level)
 * - Full Event Store spec: sequence_number, event_hash, causation_id
 * - Correlation ID: groups all events of a business flow
 * - Causation ID: points to the specific event that triggered this one
 * - AI-optimized: compact JSONB format for efficient LLM context retrieval
 *
 * Event categories:
 * - 'business': Core business state changes (Encounter started, Invoice paid)
 * - 'audit': Security & compliance (Data accessed, Permission changed)
 * - 'ai': AI-generated insights (SOAP generated, Risk assessed)
 * - 'system': Infrastructure events (Sync failed, DLQ alert)
 *
 * @module platform/timeline
 */

import crypto, { createHash } from 'crypto';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type TimelineEventCategory = 'business' | 'audit' | 'ai' | 'system';

export interface TimelineEvent {
  readonly id: string;
  readonly tenantId: string;
  readonly vertical: string;
  /** The primary Party involved (Patient ID, Buyer ID...) */
  readonly primaryPartyId: string;
  /** Optional: the journey this event belongs to */
  readonly journeyId?: string;
  /** Groups all events of a single business flow (e.g. entire Implant journey) */
  readonly correlationId: string;
  /** Points to the event that directly caused this event (causal chain) */
  readonly causationId?: string;
  readonly eventCategory: TimelineEventCategory;
  /** Namespaced event type: e.g. 'healthcare.encounter.started.v1' */
  readonly eventType: string;
  readonly eventVersion: string;
  readonly schemaVersion: string;
  /** The entity this event is about (e.g. an Encounter ID, Invoice ID) */
  readonly aggregateId: string;
  readonly aggregateType: string;
  /** Auto-incrementing per (aggregate_type, aggregate_id). Enables replay. */
  readonly sequenceNumber: number;
  /** SHA-256 hash of (prev_hash + event payload) for integrity chain */
  readonly eventHash: string;
  /** Human-readable summary for UI and AI */
  readonly summary: string;
  /** Optional AI-generated insight for this event */
  readonly aiInsight?: string;
  readonly eventData: Record<string, unknown>;
  readonly recordedBy?: string;
  readonly occurredAt: Date;
}

export interface AppendEventInput {
  readonly tenantId: string;
  readonly vertical: string;
  readonly primaryPartyId: string;
  readonly journeyId?: string;
  readonly correlationId: string;
  readonly causationId?: string;
  readonly eventCategory: TimelineEventCategory;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly summary: string;
  readonly eventData: Record<string, unknown>;
  readonly recordedBy?: string;
  readonly occurredAt?: Date;
}

export interface TimelineFilter {
  readonly primaryPartyId?: string;
  readonly journeyId?: string;
  readonly correlationId?: string;
  readonly aggregateType?: string;
  readonly aggregateId?: string;
  readonly eventCategory?: TimelineEventCategory;
  readonly eventType?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly limit?: number;
  readonly offset?: number;
}

export interface ReplayResult {
  readonly events: TimelineEvent[];
  readonly integrityValid: boolean;
  readonly brokenAt?: number; // sequence_number where hash chain breaks
}

// ═══════════════════════════════════════════════════════════════════════════
// HASH UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Computes SHA-256 event hash chaining on previous hash.
 * Enables immutability verification of the event chain.
 */
export function computeEventHash(previousHash: string, eventData: Record<string, unknown>): string {
  const content = previousHash + JSON.stringify(eventData);
  return createHash('sha256').update(content).digest('hex');
}

/** Genesis hash for the first event in a sequence */
export const GENESIS_HASH = '0'.repeat(64);

// ═══════════════════════════════════════════════════════════════════════════
// TIMELINE ENGINE
// ═══════════════════════════════════════════════════════════════════════════

export interface ITimelineRepository {
  append(input: AppendEventInput, sequenceNumber: number, eventHash: string): Promise<TimelineEvent>;
  getLastSequenceAndHash(tenantId: string, aggregateType: string, aggregateId: string): Promise<{ sequenceNumber: number; eventHash: string } | null>;
  query(tenantId: string, filter: TimelineFilter): Promise<TimelineEvent[]>;
  getForReplay(tenantId: string, aggregateType: string, aggregateId: string): Promise<TimelineEvent[]>;
  updateAiInsight(tenantId: string, eventId: string, insight: string): Promise<void>;
}

/**
 * TimelineEngine — Platform Event Store.
 *
 * All domain events, AI insights, and audit records flow through here.
 * Supports causal chain tracking and event replay for AI reasoning.
 *
 * @example
 * await timelineEngine.append({
 *   tenantId: '...',
 *   vertical: 'healthcare',
 *   primaryPartyId: patientId,
 *   correlationId: journeyCorrelationId,
 *   causationId: bookingEventId,
 *   eventCategory: 'business',
 *   eventType: 'healthcare.encounter.started.v1',
 *   aggregateId: encounterId,
 *   aggregateType: 'encounter',
 *   summary: 'Bệnh nhân Nguyễn Văn A bắt đầu khám - BS Trần Minh',
 *   eventData: { encounterId, doctorId, chiefComplaint },
 * });
 */
class TimelineEngine {
  private repository: ITimelineRepository | null = null;

  setRepository(repo: ITimelineRepository): void {
    this.repository = repo;
  }

  private get repo(): ITimelineRepository {
    if (!this.repository) {
      throw new Error('[TimelineEngine] Repository not initialized. Call setRepository() first via CompositionEngine.');
    }
    return this.repository;
  }

  /** Append a new immutable event to the timeline */
  async append(input: AppendEventInput): Promise<TimelineEvent> {
    // Get current sequence + previous hash for this aggregate
    const last = await this.repo.getLastSequenceAndHash(
      input.tenantId,
      input.aggregateType,
      input.aggregateId
    );

    const sequenceNumber = last ? last.sequenceNumber + 1 : 1;
    const previousHash = last ? last.eventHash : GENESIS_HASH;
    const eventHash = computeEventHash(previousHash, input.eventData);

    return this.repo.append(input, sequenceNumber, eventHash);
  }

  /** Query timeline events with rich filtering */
  async query(tenantId: string, filter: TimelineFilter): Promise<TimelineEvent[]> {
    return this.repo.query(tenantId, filter);
  }

  /** Get all events for a Party (chronological, for AI context) */
  async getPartyTimeline(tenantId: string, partyId: string, limit = 100): Promise<TimelineEvent[]> {
    return this.repo.query(tenantId, { primaryPartyId: partyId, limit });
  }

  /** Get all events within a correlation chain (full flow trace) */
  async getCorrelationChain(tenantId: string, correlationId: string): Promise<TimelineEvent[]> {
    return this.repo.query(tenantId, { correlationId });
  }

  /**
   * Replay events for an aggregate and verify hash chain integrity.
   * Returns whether all event hashes are consistent.
   */
  async replay(tenantId: string, aggregateType: string, aggregateId: string): Promise<ReplayResult> {
    const events = await this.repo.getForReplay(tenantId, aggregateType, aggregateId);

    let expectedHash = GENESIS_HASH;
    let integrityValid = true;
    let brokenAt: number | undefined;

    for (const event of events) {
      const computed = computeEventHash(expectedHash, event.eventData);
      if (computed !== event.eventHash) {
        integrityValid = false;
        brokenAt = event.sequenceNumber;
        break;
      }
      expectedHash = event.eventHash;
    }

    return { events, integrityValid, brokenAt };
  }

  /** AI enriches a timeline event with post-hoc insight */
  async enrichWithAiInsight(tenantId: string, eventId: string, insight: string): Promise<void> {
    return this.repo.updateAiInsight(tenantId, eventId, insight);
  }
}

export const timelineEngine = new TimelineEngine();
