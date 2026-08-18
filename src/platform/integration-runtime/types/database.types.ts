/**
 * Runtime Database Types
 * 
 * TypeScript types for runtime database tables
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

/**
 * Tenant Registry Record
 * 
 * Maps to: runtime_tenant_registry table
 */
export interface TenantRegistryRecord {
  tenant_id: string;
  tenant_name: string | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
  metadata: Record<string, unknown> | null;
}

/**
 * Idempotency Registry Record
 * 
 * Maps to: runtime_idempotency_registry table
 */
export interface IdempotencyRegistryRecord {
  id: string;
  tenant_id: string;
  idempotency_key: string;
  correlation_id: string;
  intent_type: string;
  outbox_id: string;
  processed_at: Date;
  expires_at: Date;
}

/**
 * Outbox Status
 * 
 * Valid outbox record statuses
 */
export type OutboxStatus = 'PENDING' | 'PROCESSING' | 'PUBLISHED' | 'FAILED' | 'QUARANTINED';

/**
 * Outbox Record
 * 
 * Maps to: runtime_outbox table
 */
export interface OutboxRecord {
  id: string;
  tenant_id: string;
  intent_type: string;
  intent_payload: Record<string, unknown>;  // FinancialIntent as JSON
  correlation_id: string;
  status: OutboxStatus;
  delivery_attempts: number;
  last_attempt_at: Date | null;
  next_retry_at: Date | null;
  last_error: string | null;
  created_at: Date;
  published_at: Date | null;
}

/**
 * Audit Status
 * 
 * Valid audit log statuses
 */
export type AuditStatus = 'SUCCESS' | 'RETRYING' | 'INVALID' | 'DUPLICATE' | 'QUARANTINED';

/**
 * Audit Log Record
 * 
 * Maps to: runtime_audit_log table
 * APPEND-ONLY: Cannot be updated or deleted
 */
export interface AuditLogRecord {
  id: string;
  tenant_id: string;
  intent_type: string;
  entity_id: string;
  entity_type: string;
  amount: number;
  currency: string;
  correlation_id: string;
  source: string;
  status: AuditStatus;
  delivery_attempts: number | null;
  failure_reason: string | null;
  quarantined_at: Date | null;
  timestamp: Date;  // IMMUTABLE
}

/**
 * Quarantine Resolution
 * 
 * Valid quarantine resolution types
 */
export type QuarantineResolution = 'REPLAYED' | 'DISCARDED' | 'FIXED';

/**
 * Quarantine Record
 * 
 * Maps to: runtime_quarantine table
 */
export interface QuarantineRecord {
  id: string;
  tenant_id: string;
  intent_type: string;
  intent_payload: Record<string, unknown>;  // FinancialIntent as JSON
  correlation_id: string;
  failure_reason: string;
  attempts: number;
  last_error: string;
  quarantined_at: Date;
  reviewed: boolean;
  reviewed_at: Date | null;
  reviewed_by: string | null;
  resolution: QuarantineResolution | null;
  outbox_id: string | null;
}

/**
 * Database Insert Types (omit auto-generated fields)
 */

export type TenantRegistryInsert = Omit<TenantRegistryRecord, 'created_at' | 'updated_at'> & {
  created_at?: Date;
  updated_at?: Date;
};

export type IdempotencyRegistryInsert = Omit<IdempotencyRegistryRecord, 'id' | 'processed_at'> & {
  id?: string;
  processed_at?: Date;
};

export type OutboxInsert = Omit<OutboxRecord, 'id' | 'created_at' | 'published_at'> & {
  id?: string;
  created_at?: Date;
  published_at?: Date;
};

export type AuditLogInsert = Omit<AuditLogRecord, 'id' | 'timestamp'> & {
  id?: string;
  timestamp?: Date;
};

export type QuarantineInsert = Omit<QuarantineRecord, 'id' | 'quarantined_at' | 'reviewed' | 'reviewed_at' | 'reviewed_by' | 'resolution'> & {
  id?: string;
  quarantined_at?: Date;
};

/**
 * Database Update Types (only mutable fields)
 */

export type TenantRegistryUpdate = Partial<Pick<TenantRegistryRecord, 'tenant_name' | 'is_active' | 'metadata'>>;

export type OutboxUpdate = Partial<Pick<OutboxRecord, 
  'status' | 
  'delivery_attempts' | 
  'last_attempt_at' | 
  'next_retry_at' | 
  'last_error' | 
  'published_at'
>>;

export type QuarantineUpdate = Partial<Pick<QuarantineRecord,
  'reviewed' |
  'reviewed_at' |
  'reviewed_by' |
  'resolution'
>>;

// NOTE: Audit log has NO update type (append-only)
// NOTE: Idempotency registry has NO update type (immutable after insert)
