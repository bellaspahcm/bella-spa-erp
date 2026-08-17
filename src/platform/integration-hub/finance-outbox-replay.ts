// H1.2 Replay & Bulk Operations
// Constitution: v1.3 FROZEN (O6, O9, A4, C2)
// Purpose: Manual replay and bulk recovery with concurrency safety

import { Pool } from 'pg';
import { getWorkerPool } from './db-connection';
import { ReplayResult, BulkReplayResult } from './types/outbox.types';

// ============================================================================
// Manual Replay (O6, A4)
// ============================================================================

export async function replayEvent(
  eventId: string,
  operatorId: string,
  db?: Pool
): Promise<ReplayResult> {
  const pool = db || getWorkerPool();
  
  // A4: Replay concurrency guard
  const result = await pool.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      retry_count = 0,
      next_retry_at = NULL,
      replayed_at = now(),
      replayed_by = $2,
      claimed_by = NULL,
      lease_expires_at = NULL,
      failure_classification = NULL,
      last_error = NULL
    WHERE event_id = $1
      AND status = 'QUARANTINED'
      AND (claimed_by IS NULL OR lease_expires_at < now())
    RETURNING event_id
  `, [eventId, operatorId]);
  
  if (result.rowCount === 0) {
    return {
      success: false,
      reason: 'Event not QUARANTINED or currently being processed',
    };
  }
  
  return {
    success: true,
    event_id: eventId,
  };
}

// A4 Concurrency Safety:
// - WHERE status = 'QUARANTINED' — Cannot replay PROCESSED/PROCESSING
// - AND (claimed_by IS NULL OR lease_expires_at < now()) — Not currently processing
// - Only 1 replay succeeds per event (affected_rows check implicit)

// ============================================================================
// Bulk Replay (O9, C2)
// ============================================================================

export async function replayBulk(
  quarantineReason: string,
  tenantId: string,
  operatorId: string,
  limit: number = 100,
  db?: Pool
): Promise<BulkReplayResult> {
  const pool = db || getWorkerPool();
  
  // Bounded batch size (O9)
  const clampedLimit = Math.min(limit, 100);
  
  const result = await pool.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      retry_count = 0,
      next_retry_at = NULL,
      replayed_at = now(),
      replayed_by = $4,
      claimed_by = NULL,
      lease_expires_at = NULL,
      failure_classification = NULL,
      last_error = NULL
    WHERE event_id IN (
      SELECT event_id
      FROM finance_outbox_events
      WHERE status = 'QUARANTINED'
        AND quarantine_reason = $1
        AND tenant_id = $2
        AND (claimed_by IS NULL OR lease_expires_at < now())
      LIMIT $3
      FOR UPDATE SKIP LOCKED
    )
    RETURNING event_id
  `, [quarantineReason, tenantId, clampedLimit, operatorId]);
  
  return {
    affected_count: result.rowCount || 0,
    event_ids: result.rows.map((r: any) => r.event_id),
  };
}

// C2 Clarification:
// Not all replayed events will reach PROCESSED
// - TRANSIENT failures may succeed after replay
// - PERMANENT failures will remain QUARANTINED (valid outcome)
// - POISON events will remain QUARANTINED after poison threshold (valid outcome)
// Acceptance: All events processed through pipeline, not stuck (not all PROCESSED)

// ============================================================================
// Replay by Event IDs (Alternative)
// ============================================================================

export async function replayEventsByIds(
  eventIds: string[],
  operatorId: string,
  db?: Pool
): Promise<BulkReplayResult> {
  const pool = db || getWorkerPool();
  
  if (eventIds.length === 0) {
    return { affected_count: 0, event_ids: [] };
  }
  
  // Hard cap at 100 events
  const clampedEventIds = eventIds.slice(0, 100);
  
  const result = await pool.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PENDING',
      retry_count = 0,
      next_retry_at = NULL,
      replayed_at = now(),
      replayed_by = $2,
      claimed_by = NULL,
      lease_expires_at = NULL,
      failure_classification = NULL,
      last_error = NULL
    WHERE event_id = ANY($1::text[])
      AND status = 'QUARANTINED'
      AND (claimed_by IS NULL OR lease_expires_at < now())
    RETURNING event_id
  `, [clampedEventIds, operatorId]);
  
  return {
    affected_count: result.rowCount || 0,
    event_ids: result.rows.map((r: any) => r.event_id),
  };
}
