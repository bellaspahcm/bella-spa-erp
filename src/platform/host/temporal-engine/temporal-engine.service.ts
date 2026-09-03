/**
 * Temporal Engine Service — D2: Temporal Intelligence Engine
 * Platform-Level: src/platform/host/temporal-engine/
 *
 * Constitution: Law 3 (Platform Host), Law 5 (Event-First), Law 11 (Zero any)
 *
 * Architecture: Event-Driven Capture — NOT trigger-based on domain tables.
 *
 * Domain Mutation → Domain Event → captureSnapshot() → platform_temporal_snapshots
 *
 * Answers: "What did the system know at time T?"
 * Does NOT answer: "Restore DB to time T"
 *   → That requires RollbackEngine (D1) + explicit compensating actions.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database, Json } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent } from '@/platform/host/event-bus/types';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type ChangeType = 'INSERT' | 'UPDATE' | 'DELETE' | 'SOFT_DELETE';

export interface SnapshotParams {
  entityType: string;                        // e.g. 'hc_clinical_order', 'platform_business_rule'
  entityId: string;
  snapshotData: Record<string, unknown>;     // full entity state
  changeType: ChangeType;
  changeSummary?: string;
  changedFields?: string[];                  // for UPDATE: which fields changed
  capturedBy?: string;                       // user/system actor UUID
  sourceEventId?: string;                    // Domain Event that triggered this
  sourceEventType?: string;
  correlationId?: string;
  causationId?: string;
  transactionId?: string;                    // D1 linkage
  metadata?: Record<string, unknown>;
}

export interface TemporalSnapshot {
  id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  snapshotData: Record<string, unknown>;
  snapshotVersion: number;
  changeType: ChangeType;
  changeSummary?: string;
  changedFields?: string[];
  capturedAt: string;
  capturedBy?: string;
  sourceEventId?: string;
  sourceEventType?: string;
  correlationId?: string;
  transactionId?: string;
}

export interface GetHistoryOptions {
  fromDate?: string;   // ISO timestamp — start of range
  toDate?: string;     // ISO timestamp — end of range
  changeTypes?: ChangeType[];
  limit?: number;
}

export interface SnapshotDiff {
  snapshotId1: string;
  snapshotId2: string;
  version1: number;
  version2: number;
  capturedAt1: string;
  capturedAt2: string;
  changes: Record<string, { before: unknown; after: unknown }>;
  addedFields: string[];
  removedFields: string[];
}

// ─────────────────────────────────────────────────────────────────
// TemporalEngineService
// ─────────────────────────────────────────────────────────────────
export class TemporalEngineService {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly tenantId: string
  ) {}

  // ────────────────────────────────────────────────
  // 1. captureSnapshot — record entity state at this point in time
  //    Called by Domain Event handlers, never by DB triggers.
  // ────────────────────────────────────────────────
  async captureSnapshot(params: SnapshotParams): Promise<TemporalSnapshot> {
    const { data, error } = await this.supabase
      .from('platform_temporal_snapshots')
      .insert({
        tenant_id: this.tenantId,
        entity_type: params.entityType,
        entity_id: params.entityId,
        snapshot_data: params.snapshotData as Json,
        change_type: params.changeType,
        change_summary: params.changeSummary ?? null,
        changed_fields: params.changedFields ? { fields: params.changedFields } : null,
        captured_by: params.capturedBy ?? null,
        source_event_id: params.sourceEventId ?? null,
        source_event_type: params.sourceEventType ?? null,
        correlation_id: params.correlationId ?? null,
        causation_id: params.causationId ?? null,
        transaction_id: params.transactionId ?? null,
        metadata: (params.metadata ?? {}) as Json,
      })
      .select()
      .single();

    if (error) throw new Error(`captureSnapshot failed: ${error.message}`);
    if (!data) throw new Error('captureSnapshot: no data returned');

    await this.publishEvent(data.id, params.entityType, params.entityId, data.snapshot_version, params.changeType);

    return this.mapSnapshot(data);
  }

  // ────────────────────────────────────────────────
  // 2. getHistory — full chronological history for an entity
  // ────────────────────────────────────────────────
  async getHistory(
    entityType: string,
    entityId: string,
    options: GetHistoryOptions = {}
  ): Promise<TemporalSnapshot[]> {
    let query = this.supabase
      .from('platform_temporal_snapshots')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('snapshot_version', { ascending: true });

    if (options.fromDate) {
      query = query.gte('captured_at', options.fromDate);
    }
    if (options.toDate) {
      query = query.lte('captured_at', options.toDate);
    }
    if (options.changeTypes && options.changeTypes.length > 0) {
      query = query.in('change_type', options.changeTypes);
    }
    if (options.limit) {
      query = query.limit(options.limit);
    }

    const { data, error } = await query;
    if (error) throw new Error(`getHistory failed: ${error.message}`);
    return (data ?? []).map(row => this.mapSnapshot(row));
  }

  // ────────────────────────────────────────────────
  // 3. getAtPointInTime — "What did system know about entity X at timestamp T?"
  //    Returns the most recent snapshot AT OR BEFORE the given timestamp.
  // ────────────────────────────────────────────────
  async getAtPointInTime(
    entityType: string,
    entityId: string,
    timestamp: string               // ISO 8601
  ): Promise<TemporalSnapshot | null> {
    const { data, error } = await this.supabase
      .from('platform_temporal_snapshots')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .lte('captured_at', timestamp)
      .order('snapshot_version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`getAtPointInTime failed: ${error.message}`);
    if (!data) return null;
    return this.mapSnapshot(data);
  }

  // ────────────────────────────────────────────────
  // 4. diffSnapshots — compare two versions of the same entity
  //    Surfaces exactly what changed between snapshot A and snapshot B.
  // ────────────────────────────────────────────────
  async diffSnapshots(snapshotId1: string, snapshotId2: string): Promise<SnapshotDiff> {
    const { data: snapshots, error } = await this.supabase
      .from('platform_temporal_snapshots')
      .select('id, snapshot_data, snapshot_version, captured_at, entity_type, entity_id')
      .in('id', [snapshotId1, snapshotId2])
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`diffSnapshots fetch failed: ${error.message}`);
    if (!snapshots || snapshots.length !== 2) {
      throw new Error(`diffSnapshots: expected 2 snapshots, found ${snapshots?.length ?? 0}`);
    }

    // Sort by version so s1 is older
    const [s1, s2] = snapshots.sort((a, b) => a.snapshot_version - b.snapshot_version) as [
      typeof snapshots[0], typeof snapshots[0]
    ];

    if (s1.entity_type !== s2.entity_type || s1.entity_id !== s2.entity_id) {
      throw new Error('diffSnapshots: cannot diff snapshots from different entities');
    }

    const data1 = (s1.snapshot_data ?? {}) as Record<string, unknown>;
    const data2 = (s2.snapshot_data ?? {}) as Record<string, unknown>;

    const allKeys = new Set([...Object.keys(data1), ...Object.keys(data2)]);
    const changes: Record<string, { before: unknown; after: unknown }> = {};
    const addedFields: string[] = [];
    const removedFields: string[] = [];

    for (const key of allKeys) {
      const inV1 = Object.prototype.hasOwnProperty.call(data1, key);
      const inV2 = Object.prototype.hasOwnProperty.call(data2, key);

      if (!inV1 && inV2) {
        addedFields.push(key);
        changes[key] = { before: undefined, after: data2[key] };
      } else if (inV1 && !inV2) {
        removedFields.push(key);
        changes[key] = { before: data1[key], after: undefined };
      } else if (JSON.stringify(data1[key]) !== JSON.stringify(data2[key])) {
        changes[key] = { before: data1[key], after: data2[key] };
      }
    }

    return {
      snapshotId1: s1.id,
      snapshotId2: s2.id,
      version1: s1.snapshot_version,
      version2: s2.snapshot_version,
      capturedAt1: s1.captured_at,
      capturedAt2: s2.captured_at,
      changes,
      addedFields,
      removedFields,
    };
  }

  // ────────────────────────────────────────────────
  // 5. getLatestSnapshot — convenience: current known state
  // ────────────────────────────────────────────────
  async getLatestSnapshot(
    entityType: string,
    entityId: string
  ): Promise<TemporalSnapshot | null> {
    const { data, error } = await this.supabase
      .from('platform_temporal_snapshots')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('snapshot_version', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw new Error(`getLatestSnapshot failed: ${error.message}`);
    if (!data) return null;
    return this.mapSnapshot(data);
  }

  // ────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────

  private async publishEvent(
    snapshotId: string,
    entityType: string,
    entityId: string,
    version: number,
    changeType: ChangeType
  ): Promise<void> {
    const event: DomainEvent<Record<string, unknown>> = {
      eventId: crypto.randomUUID(),
      eventType: 'platform.temporal.snapshot.captured.v1',
      eventVersion: '1.0.0',
      tenantId: this.tenantId,
      aggregateId: snapshotId,
      aggregateType: 'platform_temporal_snapshot',
      payload: { entityType, entityId, version, changeType },
      occurredAt: new Date().toISOString(),
    };
    await eventBus.publish(event);
  }

  private mapSnapshot(
    data: Database['public']['Tables']['platform_temporal_snapshots']['Row']
  ): TemporalSnapshot {
    const changedFieldsRaw = data.changed_fields as { fields?: string[] } | null;
    return {
      id: data.id,
      tenantId: data.tenant_id,
      entityType: data.entity_type,
      entityId: data.entity_id,
      snapshotData: (data.snapshot_data ?? {}) as Record<string, unknown>,
      snapshotVersion: data.snapshot_version,
      changeType: data.change_type as ChangeType,
      changeSummary: data.change_summary ?? undefined,
      changedFields: changedFieldsRaw?.fields ?? undefined,
      capturedAt: data.captured_at,
      capturedBy: data.captured_by ?? undefined,
      sourceEventId: data.source_event_id ?? undefined,
      sourceEventType: data.source_event_type ?? undefined,
      correlationId: data.correlation_id ?? undefined,
      transactionId: data.transaction_id ?? undefined,
    };
  }
}
