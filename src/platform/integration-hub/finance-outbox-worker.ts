// H1.2 Finance Outbox Worker
// Constitution: v1.3 FROZEN
// Purpose: Process outbox events with retry, quarantine, and lease management (O1-O4)

import { Pool } from 'pg';
import { getWorkerPool } from './db-connection';
import {
  OutboxEvent,
  FinanceApiResponse,
  FailureClassification,
} from './types/outbox.types';

// ============================================================================
// Configuration
// ============================================================================

const WORKER_ID = process.env.WORKER_ID || `worker-${process.pid}`;
const LEASE_DURATION_SECONDS = 60;
const BASE_RETRY_INTERVAL_MS = 1000; // 1 second

// ============================================================================
// Atomic Claim (A1, A2)
// ============================================================================

export async function claimEvent(db?: Pool): Promise<OutboxEvent | null> {
  const pool = db || getWorkerPool();
  
  const result = await pool.query<OutboxEvent>(`
    UPDATE finance_outbox_events
    SET 
      status = 'PROCESSING',
      claimed_by = $1,
      claimed_at = now(),
      lease_expires_at = now() + interval '${LEASE_DURATION_SECONDS} seconds'
    WHERE event_id = (
      SELECT event_id
      FROM finance_outbox_events
      WHERE status IN ('PENDING', 'FAILED')
        AND (next_retry_at IS NULL OR next_retry_at <= now())
        AND (lease_expires_at IS NULL OR lease_expires_at < now())
        AND claimed_by IS NULL
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `, [WORKER_ID]);
  
  if (result.rowCount === 0) {
    return null; // No events to process
  }
  
  if (result.rowCount !== 1) {
    throw new Error(`Atomic claim violation: expected 1 row, got ${result.rowCount}`);
  }
  
  return result.rows[0];
}

// ============================================================================
// Process Event
// ============================================================================

export async function processEvent(
  event: OutboxEvent,
  financeApiClient: FinanceApiClient,
  db?: Pool
): Promise<void> {
  const pool = db || getWorkerPool();
  
  try {
    // Set first_attempt_at if not set
    if (!event.first_attempt_at) {
      await pool.query(`
        UPDATE finance_outbox_events
        SET first_attempt_at = now()
        WHERE event_id = $1 AND first_attempt_at IS NULL
      `, [event.event_id]);
    }
    
    // POST to Finance API (H1.1 boundary)
    const response = await financeApiClient.post('/transactions', {
      idempotency_key: event.idempotency_key,
      tenant_id: event.tenant_id,
      event_type: event.event_type,
      payload: event.payload,
    });
    
    if (response.status === 'ALREADY_PROCESSED') {
      // H1.1 idempotency hit (reuse proven mechanism)
      await markProcessed(event.event_id, response.transaction_id!, pool);
      return;
    }
    
    if (response.status === 'SUCCESS') {
      await markProcessed(event.event_id, response.transaction_id!, pool);
      return;
    }
    
    // Failure — classify and handle
    await handleFailure(event, response, pool);
    
  } catch (error) {
    // Worker crash or network error
    // Lease will expire → Event returns to PENDING (A2 recovery)
    console.error(`Worker crash during event processing: ${event.event_id}`, error);
    throw error; // Let worker crash, lease recovery handles it
  }
}

// ============================================================================
// Mark Processed
// ============================================================================

async function markProcessed(
  eventId: string,
  transactionId: string,
  db: Pool
): Promise<void> {
  await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'PROCESSED',
      processed_at = now(),
      transaction_id = $2
    WHERE event_id = $1
      AND status = 'PROCESSING'
  `, [eventId, transactionId]);
}

// ============================================================================
// Handle Failure (O1, O2, C1)
// ============================================================================

async function handleFailure(
  event: OutboxEvent,
  response: FinanceApiResponse,
  db: Pool
): Promise<void> {
  // O2: Classify failure
  const classification = classifyFailure(response);
  
  if (classification === 'PERMANENT') {
    // Quarantine immediately (no retry)
    await quarantineEvent(
      event.event_id,
      'PERMANENT_FAILURE',
      response.error || 'Permanent failure detected',
      classification,
      db,
      event.retry_count
    );
    return;
  }
  
  // TRANSIENT or UNKNOWN → Retry with backoff
  const newRetryCount = event.retry_count + 1;
  
  if (newRetryCount >= event.max_retry) {
    // Max retry exceeded → Quarantine
    await quarantineEvent(
      event.event_id,
      'MAX_RETRY_EXCEEDED',
      response.error || 'Max retry limit reached',
      classification,
      db,
      newRetryCount
    );
    return;
  }
  
  // C1: Increment retry_count in THIS transaction (after Finance failure response)
  const nextRetryAt = calculateNextRetry(newRetryCount);
  
  await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'FAILED',
      retry_count = $2,
      next_retry_at = $3,
      last_error = $4,
      last_attempt_at = now(),
      failure_classification = $5
    WHERE event_id = $1
      AND status = 'PROCESSING'
  `, [
    event.event_id,
    newRetryCount,
    nextRetryAt,
    response.error || 'Unknown error',
    classification,
  ]);
}

// ============================================================================
// Calculate Next Retry (O1 — Exponential Backoff)
// ============================================================================

function calculateNextRetry(retryCount: number): Date {
  const backoffMs = Math.pow(2, retryCount) * BASE_RETRY_INTERVAL_MS;
  return new Date(Date.now() + backoffMs);
}

// Retry intervals: 1s, 2s, 4s, 8s, 16s, 32s, 64s, 128s, 256s, 512s

// ============================================================================
// Classify Failure (O2)
// ============================================================================

function classifyFailure(response: FinanceApiResponse): FailureClassification {
  const status = response.http_status;
  
  if (!status) {
    return 'UNKNOWN'; // No HTTP status (network error, timeout, etc.)
  }
  
  // PERMANENT: Bad request, unprocessable entity
  if (status === 400 || status === 422) {
    return 'PERMANENT';
  }
  
  // TRANSIENT: Service unavailable, timeout, internal error
  if (status === 503 || status === 504 || status === 500) {
    return 'TRANSIENT';
  }
  
  // UNKNOWN: Novel error codes (safe default: retry with backoff)
  return 'UNKNOWN';
}

// Note: POISON classification requires crash tracking infrastructure (out of H1.2 scope)
// Manual quarantine for poison events until automatic detection available

// ============================================================================
// Quarantine Event (O3, O5)
// ============================================================================

async function quarantineEvent(
  eventId: string,
  reason: string,
  error: string,
  classification: FailureClassification,
  db: Pool,
  retryCount: number
): Promise<void> {
  await db.query(`
    UPDATE finance_outbox_events
    SET 
      status = 'QUARANTINED',
      quarantine_reason = $2,
      quarantined_at = now(),
      last_error = $3,
      failure_classification = $4,
      retry_count = $5
    WHERE event_id = $1
      AND status IN ('PROCESSING', 'FAILED')
  `, [eventId, reason, error, classification, retryCount]);
}

// ============================================================================
// Finance API Client Interface
// ============================================================================

export interface FinanceApiClient {
  post(endpoint: string, payload: any): Promise<FinanceApiResponse>;
}

// Actual Finance API client implementation should be injected
// This interface allows testing with mock client

// ============================================================================
// Worker Class Wrapper (for CLI/Test usage)
// ============================================================================

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

export interface FinanceOutboxWorkerConfig {
  financeOsEndpoint: string;
  workerId: string;
  batchSize: number;
  pollIntervalMs: number;
  verbose: boolean;
}

export class FinanceOutboxWorker {
  private client: SupabaseClient<Database>;
  private config: FinanceOutboxWorkerConfig;
  private running: boolean = false;

  constructor(client: SupabaseClient<Database>, config: FinanceOutboxWorkerConfig) {
    this.client = client;
    this.config = config;
  }

  async start(): Promise<void> {
    this.running = true;
    if (this.config.verbose) {
      console.log(`Worker ${this.config.workerId} started`);
    }
    // Worker loop implementation would go here
    // For now, this is a minimal export to satisfy type checking
    throw new Error('Worker implementation incomplete - use function exports directly');
  }

  async stop(): Promise<void> {
    this.running = false;
  }
}
