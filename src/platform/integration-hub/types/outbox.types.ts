// H1.2 Outbox Types
// Constitution: v1.3 FROZEN
// Purpose: Type definitions for H1.2 operational resilience

export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PROCESSED' | 'FAILED' | 'QUARANTINED';

export type FailureClassification = 'TRANSIENT' | 'PERMANENT' | 'POISON' | 'UNKNOWN';

export interface OutboxEvent {
  event_id: string;
  tenant_id: string;
  event_type: string;
  payload: Record<string, any>;
  status: OutboxStatus;
  
  // H1.1 fields
  created_at: Date;
  updated_at: Date;
  claimed_by: string | null;
  claimed_at: Date | null;
  lease_expires_at: Date | null;
  processed_at: Date | null;
  
  // H1.2 extensions (O1-O10)
  retry_count: number;
  next_retry_at: Date | null;
  max_retry: number;
  failure_classification: FailureClassification | null;
  last_error: string | null;
  last_attempt_at: Date | null;
  first_attempt_at: Date | null;
  quarantine_reason: string | null;
  quarantined_at: Date | null;
  poison_crash_count: number;
  replayed_at: Date | null;
  replayed_by: string | null;
  idempotency_key: string | null;
  transaction_id: string | null;
}

export interface FinanceApiResponse {
  status: 'SUCCESS' | 'ALREADY_PROCESSED' | 'ERROR';
  transaction_id?: string;
  error?: string;
  http_status?: number;
}

export interface ReplayResult {
  success: boolean;
  event_id?: string;
  reason?: string;
}

export interface BulkReplayResult {
  affected_count: number;
  event_ids: string[];
}

export interface OutboxHealth {
  pending_count: number;
  processing_count: number;
  failed_count: number;
  quarantined_count: number;
  processed_count_24h: number;
  avg_retry_count: number;
  oldest_pending_age_seconds: number | null;
  stuck_processing_count: number;
  last_success: Date | null;
  last_failure: Date | null;
}

export interface QuarantinedEvent {
  event_id: string;
  tenant_id: string;
  event_type: string;
  status: OutboxStatus;
  quarantine_reason: string | null;
  failure_classification: FailureClassification | null;
  retry_count: number;
  last_error: string | null;
  first_attempt_at: Date | null;
  last_attempt_at: Date | null;
  quarantined_at: Date | null;
  created_at: Date;
  payload: Record<string, any>;
}

export interface Discrepancy {
  event_id: string;
  outbox_status: OutboxStatus;
  tenant_id: string;
  idempotency_key: string | null;
  journal_id: string | null;
  journal_status: string | null;
  discrepancy_type: 'MISSING_JOURNAL' | 'ORPHANED_JOURNAL' | 'TENANT_MISMATCH' | 'DUPLICATE_JOURNAL' | 'CONSISTENT';
}

export interface ReconciliationReport {
  tenant_id: string;
  generated_at: Date;
  total_discrepancies: number;
  discrepancies_by_type: {
    missing_journal: number;
    orphaned_journal: number;
    tenant_mismatch: number;
    duplicate_journal: number;
  };
  discrepancies: Discrepancy[];
  resolution_guidance: Record<string, string>;
}
