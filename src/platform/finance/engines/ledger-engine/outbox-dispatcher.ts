/**
 * Finance OS Kernel — F1 Ledger Outbox Dispatcher
 *
 * Implements the Transactional Outbox Pattern for Finance OS.
 * Reads PENDING outbox events from `finance_outbox_events`,
 * publishes them to the Host Event Bus, and marks them DISPATCHED.
 *
 * Architecture Compliance:
 * - Law F-8: Event dispatched ONLY after DB COMMIT (outbox ensures this).
 * - Law F-14: ZERO `any` usage.
 * - Idempotent: at-least-once delivery with deduplication via status field.
 *
 * @module platform/finance/engines/ledger-engine/outbox-dispatcher
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import type { EventType } from '@/platform/host/event-bus/types';

/** Strongly typed shape of a parsed outbox event payload */
interface FinanceOutboxPayload {
  eventType: string;
  tenantId: string;
  aggregateId: string;
  aggregateType: string;
  eventVersion?: string;
  userId?: string;
  correlationId?: string;
  data: Record<string, unknown>;
}

/** Raw outbox row shape from DB (typed strictly, no `any`) */
interface OutboxRow {
  id: string;
  tenant_id: string;
  event_type: string;
  payload: string;
  status: 'PENDING' | 'DISPATCHED' | 'FAILED';
  retry_count: number;
  error?: string | null;
  created_at: string;
}

const MAX_DISPATCH_BATCH = 50;

export class OutboxDispatcher {
  constructor(private readonly supabase: SupabaseClient<Database>) {}

  /**
   * Dispatches all PENDING outbox events for a given tenant to the host Event Bus.
   * Returns count of successfully dispatched events.
   *
   * Safe to call multiple times — idempotent due to status check on PENDING rows.
   */
  public async dispatchPendingEvents(tenantId: string): Promise<number> {
    // 1. Fetch PENDING events for this tenant (bounded by MAX_DISPATCH_BATCH)
    const { data: rows, error: fetchErr } = await this.supabase
      .from('finance_outbox_events' as unknown as 'tenants')
      .select('id, tenant_id, event_type, payload, status, retry_count, error, created_at')
      .eq('tenant_id' as unknown as 'id', tenantId)
      .eq('status' as unknown as 'id', 'PENDING')
      .order('created_at' as unknown as 'id', { ascending: true })
      .limit(MAX_DISPATCH_BATCH);

    if (fetchErr) {
      console.error('[OutboxDispatcher] Failed to fetch outbox events:', fetchErr.message);
      return 0;
    }

    if (!rows || rows.length === 0) {
      return 0;
    }

    const outboxRows = rows as OutboxRow[];
    let dispatchedCount = 0;

    for (const row of outboxRows) {
      try {
        // 2. Parse the payload from JSON string
        const parsed = this.parsePayload(row.payload);

        // 3. Publish to host Event Bus
        await eventBus.publish({
          eventType: (parsed.eventType || row.event_type) as EventType,
          eventVersion: parsed.eventVersion || 'v1',
          tenantId: parsed.tenantId || row.tenant_id,
          aggregateId: parsed.aggregateId,
          aggregateType: parsed.aggregateType,
          payload: parsed.data,
          userId: parsed.userId,
          correlationId: parsed.correlationId
        });

        // 4. Mark as DISPATCHED
        await this.supabase
          .from('finance_outbox_events' as unknown as 'tenants')
          .update({ status: 'DISPATCHED' })
          .eq('id' as unknown as 'id', row.id)
          .eq('tenant_id' as unknown as 'id', row.tenant_id);

        dispatchedCount++;
      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        console.error(`[OutboxDispatcher] Failed to dispatch event ${row.id}:`, errMsg);

        // 5. Mark as FAILED and increment retry count
        await this.supabase
          .from('finance_outbox_events' as unknown as 'tenants')
          .update({
            status: 'FAILED',
            retry_count: row.retry_count + 1,
            error: errMsg
          })
          .eq('id' as unknown as 'id', row.id)
          .eq('tenant_id' as unknown as 'id', row.tenant_id);
      }
    }

    return dispatchedCount;
  }

  /**
   * Retries all FAILED events up to maxRetries for a given tenant.
   * Resets status to PENDING so next dispatchPendingEvents() call picks them up.
   */
  public async requeueFailedEvents(tenantId: string, maxRetries: number = 3): Promise<number> {
    const { data: rows, error } = await this.supabase
      .from('finance_outbox_events' as unknown as 'tenants')
      .select('id, retry_count')
      .eq('tenant_id' as unknown as 'id', tenantId)
      .eq('status' as unknown as 'id', 'FAILED')
      .lte('retry_count' as unknown as 'id', maxRetries);

    if (error || !rows || rows.length === 0) {
      return 0;
    }

    const typedRows = rows as Array<{ id: string; retry_count: number }>;
    const ids = typedRows.map((r) => r.id);

    await this.supabase
      .from('finance_outbox_events' as unknown as 'tenants')
      .update({ status: 'PENDING' })
      .in('id' as unknown as 'id', ids)
      .eq('tenant_id' as unknown as 'id', tenantId);

    return ids.length;
  }

  /**
   * Parses the raw JSON payload string into a typed FinanceOutboxPayload.
   * Throws if parsing fails or required fields are missing.
   */
  private parsePayload(payloadStr: string): FinanceOutboxPayload {
    const raw: unknown = JSON.parse(payloadStr);

    if (typeof raw !== 'object' || raw === null) {
      throw new Error('OUTBOX_INVALID_PAYLOAD: payload must be a JSON object');
    }

    const obj = raw as Record<string, unknown>;

    if (typeof obj.aggregateId !== 'string' || typeof obj.aggregateType !== 'string') {
      throw new Error('OUTBOX_INVALID_PAYLOAD: missing required fields aggregateId or aggregateType');
    }

    return {
      eventType: typeof obj.eventType === 'string' ? obj.eventType : '',
      tenantId: typeof obj.tenantId === 'string' ? obj.tenantId : '',
      aggregateId: obj.aggregateId,
      aggregateType: obj.aggregateType,
      eventVersion: typeof obj.eventVersion === 'string' ? obj.eventVersion : undefined,
      userId: typeof obj.userId === 'string' ? obj.userId : undefined,
      correlationId: typeof obj.correlationId === 'string' ? obj.correlationId : undefined,
      data: typeof obj.data === 'object' && obj.data !== null
        ? (obj.data as Record<string, unknown>)
        : {}
    };
  }
}
