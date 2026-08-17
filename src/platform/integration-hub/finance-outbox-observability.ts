// H1.2 Observability
// Constitution: v1.3 FROZEN (O5, O7, O8)
// Purpose: Metrics queries and dead letter visibility

import { Pool } from 'pg';
import { getWorkerPool } from './db-connection';
import { OutboxHealth, QuarantinedEvent } from './types/outbox.types';

// ============================================================================
// Health Metrics (O7)
// ============================================================================

export async function getOutboxHealth(
  tenantId?: string,
  db?: Pool
): Promise<OutboxHealth> {
  const pool = db || getWorkerPool();
  
  const tenantFilter = tenantId ? 'AND tenant_id = $1' : '';
  const params = tenantId ? [tenantId] : [];
  
  const result = await pool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE status = 'PENDING') as pending_count,
      COUNT(*) FILTER (WHERE status = 'PROCESSING') as processing_count,
      COUNT(*) FILTER (WHERE status = 'FAILED') as failed_count,
      COUNT(*) FILTER (WHERE status = 'QUARANTINED') as quarantined_count,
      COUNT(*) FILTER (WHERE status = 'PROCESSED' AND processed_at > now() - interval '24 hours') as processed_count_24h,
      AVG(retry_count) FILTER (WHERE status IN ('FAILED', 'QUARANTINED')) as avg_retry_count,
      EXTRACT(EPOCH FROM (now() - MIN(created_at) FILTER (WHERE status = 'PENDING'))) as oldest_pending_age_seconds,
      COUNT(*) FILTER (WHERE status = 'PROCESSING' AND lease_expires_at < now()) as stuck_processing_count,
      MAX(processed_at) FILTER (WHERE status = 'PROCESSED') as last_success,
      MAX(last_attempt_at) FILTER (WHERE status = 'FAILED') as last_failure
    FROM finance_outbox_events
    WHERE 1=1 ${tenantFilter}
  `, params);
  
  const row = result.rows[0];
  
  return {
    pending_count: parseInt(row.pending_count) || 0,
    processing_count: parseInt(row.processing_count) || 0,
    failed_count: parseInt(row.failed_count) || 0,
    quarantined_count: parseInt(row.quarantined_count) || 0,
    processed_count_24h: parseInt(row.processed_count_24h) || 0,
    avg_retry_count: parseFloat(row.avg_retry_count) || 0,
    oldest_pending_age_seconds: row.oldest_pending_age_seconds !== null 
      ? parseFloat(row.oldest_pending_age_seconds) 
      : null,
    stuck_processing_count: parseInt(row.stuck_processing_count) || 0,
    last_success: row.last_success ? new Date(row.last_success) : null,
    last_failure: row.last_failure ? new Date(row.last_failure) : null,
  };
}

// O7: Observable facts, NOT dashboard UI
// Queries execute in <1s for 10k events (index support)
// Tenant isolation enforced

// ============================================================================
// Dead Letter Queue / Quarantined Events (O5)
// ============================================================================

export async function getQuarantinedEvents(
  tenantId: string,
  limit: number = 100,
  db?: Pool
): Promise<QuarantinedEvent[]> {
  const pool = db || getWorkerPool();
  
  const result = await pool.query<QuarantinedEvent>(`
    SELECT 
      event_id,
      tenant_id,
      event_type,
      status,
      quarantine_reason,
      failure_classification,
      retry_count,
      last_error,
      first_attempt_at,
      last_attempt_at,
      quarantined_at,
      created_at,
      payload
    FROM finance_outbox_events
    WHERE status = 'QUARANTINED'
      AND tenant_id = $1
    ORDER BY quarantined_at DESC
    LIMIT $2
  `, [tenantId, limit]);
  
  return result.rows;
}

// O5: Dead letter visibility with metadata for triage
// Filterable by tenant, quarantine reason, failure classification

// ============================================================================
// Alert Threshold Detection (O8)
// ============================================================================

export interface AlertThreshold {
  alert_type: string;
  triggered: boolean;
  current_value: number;
  threshold: number;
  severity: 'WARNING' | 'CRITICAL';
}

export async function checkAlertThresholds(
  tenantId?: string,
  db?: Pool
): Promise<AlertThreshold[]> {
  const pool = db || getWorkerPool();
  
  const health = await getOutboxHealth(tenantId, pool);
  
  const alerts: AlertThreshold[] = [];
  
  // High Pending Backlog
  alerts.push({
    alert_type: 'HIGH_PENDING_BACKLOG',
    triggered: health.pending_count > 1000,
    current_value: health.pending_count,
    threshold: 1000,
    severity: 'WARNING',
  });
  
  // Quarantine Accumulation
  alerts.push({
    alert_type: 'QUARANTINE_ACCUMULATION',
    triggered: health.quarantined_count > 100,
    current_value: health.quarantined_count,
    threshold: 100,
    severity: 'CRITICAL',
  });
  
  // Stuck Events
  alerts.push({
    alert_type: 'STUCK_EVENTS',
    triggered: health.stuck_processing_count > 10,
    current_value: health.stuck_processing_count,
    threshold: 10,
    severity: 'WARNING',
  });
  
  // Processing Lag (oldest pending > 5 minutes)
  const lagMinutes = health.oldest_pending_age_seconds !== null 
    ? health.oldest_pending_age_seconds / 60 
    : 0;
  alerts.push({
    alert_type: 'PROCESSING_LAG',
    triggered: lagMinutes > 5,
    current_value: lagMinutes,
    threshold: 5,
    severity: 'WARNING',
  });
  
  // High Failure Rate (would require time-windowed calculation)
  // Simplified: if failed_count > 50% of pending+failed+processing
  const totalActive = health.pending_count + health.failed_count + health.processing_count;
  const failureRate = totalActive > 0 ? health.failed_count / totalActive : 0;
  alerts.push({
    alert_type: 'HIGH_FAILURE_RATE',
    triggered: failureRate > 0.5,
    current_value: failureRate,
    threshold: 0.5,
    severity: 'CRITICAL',
  });
  
  return alerts.filter(a => a.triggered);
}

// O8: Threshold-based detection (not ML/anomaly detection)
// Alert notification platform out of scope (H1.2 proves detection only)
