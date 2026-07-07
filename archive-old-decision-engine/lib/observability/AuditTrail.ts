/**
 * Decision Engine Audit Trail
 * 
 * Records complete audit trail for all decisions made by the Decision Engine.
 * Provides debugging, compliance, explainability, and AI learning data.
 * 
 * Audit records include:
 * - Decision context (inputs)
 * - Matched rules and actions
 * - Provider execution details
 * - Result and reasoning
 * - Performance metrics
 * 
 * @module DecisionEngine/Observability
 */

import type { DecisionContext, DecisionResult } from '../types';

export interface AuditRecord {
  /** Unique decision ID */
  decisionId: string;
  /** Decision type (e.g., 'booking_approval', 'discount_eligibility') */
  decisionType: string;
  /** Timestamp when decision was made */
  timestamp: Date;
  /** Tenant ID */
  tenantId: string;
  /** User ID (if applicable) */
  userId?: string;
  /** Provider used for decision */
  provider: string;
  /** Matched rules (rule IDs and priorities) */
  matchedRules: Array<{
    ruleId: string;
    priority: number;
    condition: string;
    action: unknown;
  }>;
  /** Execution time in milliseconds */
  executionTime: number;
  /** Confidence score (0-1) */
  confidence: number;
  /** Actions taken */
  actions: unknown[];
  /** Reason/explanation for decision */
  reason: string;
  /** Decision context snapshot */
  context: DecisionContext;
  /** Decision result snapshot */
  result: DecisionResult;
  /** Whether decision used cache */
  cacheHit: boolean;
  /** Whether decision failed */
  failed: boolean;
  /** Error message (if failed) */
  error?: string;
  /** Whether fallback was used */
  usedFallback: boolean;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface AuditQuery {
  /** Filter by decision ID */
  decisionId?: string;
  /** Filter by decision type */
  decisionType?: string;
  /** Filter by tenant ID */
  tenantId?: string;
  /** Filter by user ID */
  userId?: string;
  /** Start time for query */
  startTime?: Date;
  /** End time for query */
  endTime?: Date;
  /** Filter by approval status */
  approved?: boolean;
  /** Filter by manual review requirement */
  requiresManualReview?: boolean;
  /** Filter by error status */
  failed?: boolean;
  /** Limit number of results */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * In-memory audit trail storage.
 * 
 * For production, this should be replaced with a persistent storage solution:
 * - PostgreSQL (for structured queries)
 * - Elasticsearch (for full-text search)
 * - S3 + Athena (for cost-effective long-term storage)
 * - MongoDB (for flexible schema)
 * 
 * Current implementation:
 * - Stores last 10,000 audit records in memory
 * - Provides flexible querying
 * - Thread-safe for concurrent access
 */
export class AuditTrail {
  private records: AuditRecord[] = [];
  private readonly maxSize = 10000; // Keep last 10k records in memory

  /**
   * Record a decision audit entry.
   * 
   * @param record - Audit record to store
   * 
   * @example
   * ```ts
   * auditTrail.record({
   *   decisionId: 'dec-123',
   *   decisionType: 'booking_approval',
   *   timestamp: new Date(),
   *   tenantId: 'tenant-123',
   *   userId: 'user-456',
   *   provider: 'RuleProvider',
   *   matchedRules: [
   *     {
   *       ruleId: 'auto-approve-small',
   *       priority: 100,
   *       condition: 'amount < 5000000',
   *       action: { approve: true, requiresDeposit: false },
   *     },
   *   ],
   *   executionTime: 12.5,
   *   confidence: 0.95,
   *   actions: [{ approve: true }],
   *   reason: 'Small booking amount qualified for auto-approval',
   *   context: { ... },
   *   result: { ... },
   *   cacheHit: false,
   *   failed: false,
   *   usedFallback: false,
   * });
   * ```
   */
  record(record: AuditRecord): void {
    this.records.push(record);

    // Keep buffer size under control (circular buffer)
    if (this.records.length > this.maxSize) {
      this.records.shift();
    }
  }

  /**
   * Query audit records.
   * 
   * @param query - Query parameters
   * @returns Filtered audit records
   * 
   * @example
   * ```ts
   * // Find all booking approvals in last hour
   * const recent = auditTrail.query({
   *   decisionType: 'booking_approval',
   *   startTime: new Date(Date.now() - 3600000),
   *   limit: 100,
   * });
   * 
   * // Find all failed decisions
   * const errors = auditTrail.query({
   *   failed: true,
   *   limit: 50,
   * });
   * 
   * // Find decisions requiring manual review
   * const manualReview = auditTrail.query({
   *   requiresManualReview: true,
   *   tenantId: 'tenant-123',
   * });
   * ```
   */
  query(query: AuditQuery = {}): AuditRecord[] {
    let filtered = this.records;

    if (query.decisionId) {
      filtered = filtered.filter(r => r.decisionId === query.decisionId);
    }

    if (query.decisionType) {
      filtered = filtered.filter(r => r.decisionType === query.decisionType);
    }

    if (query.tenantId) {
      filtered = filtered.filter(r => r.tenantId === query.tenantId);
    }

    if (query.userId) {
      filtered = filtered.filter(r => r.userId === query.userId);
    }

    if (query.startTime) {
      filtered = filtered.filter(r => r.timestamp >= query.startTime!);
    }

    if (query.endTime) {
      filtered = filtered.filter(r => r.timestamp <= query.endTime!);
    }

    if (query.approved !== undefined) {
      filtered = filtered.filter(r => r.result.approved === query.approved);
    }

    if (query.requiresManualReview !== undefined) {
      filtered = filtered.filter(r => 
        (r.result.action?.type === 'MANUAL_REVIEW') === query.requiresManualReview
      );
    }

    if (query.failed !== undefined) {
      filtered = filtered.filter(r => r.failed === query.failed);
    }

    // Apply pagination
    if (query.offset) {
      filtered = filtered.slice(query.offset);
    }

    if (query.limit) {
      filtered = filtered.slice(0, query.limit);
    }

    return filtered;
  }

  /**
   * Get a specific audit record by decision ID.
   * 
   * @param decisionId - Decision ID to lookup
   * @returns Audit record or undefined
   * 
   * @example
   * ```ts
   * const record = auditTrail.get('dec-123');
   * if (record) {
   *   console.log(`Decision: ${record.reason}`);
   *   console.log(`Execution Time: ${record.executionTime}ms`);
   *   console.log(`Matched Rules:`, record.matchedRules);
   * }
   * ```
   */
  get(decisionId: string): AuditRecord | undefined {
    return this.records.find(r => r.decisionId === decisionId);
  }

  /**
   * Get total number of audit records stored.
   * 
   * @returns Records count
   */
  count(): number {
    return this.records.length;
  }

  /**
   * Clear all audit records (for testing).
   */
  clear(): void {
    this.records = [];
  }

  /**
   * Export audit records as JSON.
   * 
   * Useful for:
   * - Debugging production issues
   * - Compliance reports
   * - AI training data
   * - Business analytics
   * 
   * @param query - Query parameters
   * @returns JSON string
   * 
   * @example
   * ```ts
   * // Export last 1000 decisions for analysis
   * const json = auditTrail.exportJSON({ limit: 1000 });
   * await fs.writeFile('decisions.json', json);
   * ```
   */
  exportJSON(query: AuditQuery = {}): string {
    const records = this.query(query);
    return JSON.stringify(records, null, 2);
  }

  /**
   * Get statistics about audit trail.
   * 
   * @returns Statistics summary
   * 
   * @example
   * ```ts
   * const stats = auditTrail.getStats();
   * console.log(`Total Records: ${stats.totalRecords}`);
   * console.log(`Oldest Record: ${stats.oldestRecord}`);
   * console.log(`Newest Record: ${stats.newestRecord}`);
   * ```
   */
  getStats(): {
    totalRecords: number;
    oldestRecord: Date | null;
    newestRecord: Date | null;
    decisionTypes: Record<string, number>;
    providers: Record<string, number>;
  } {
    if (this.records.length === 0) {
      return {
        totalRecords: 0,
        oldestRecord: null,
        newestRecord: null,
        decisionTypes: {},
        providers: {},
      };
    }

    const decisionTypes: Record<string, number> = {};
    const providers: Record<string, number> = {};

    this.records.forEach(r => {
      decisionTypes[r.decisionType] = (decisionTypes[r.decisionType] || 0) + 1;
      providers[r.provider] = (providers[r.provider] || 0) + 1;
    });

    return {
      totalRecords: this.records.length,
      oldestRecord: this.records[0].timestamp,
      newestRecord: this.records[this.records.length - 1].timestamp,
      decisionTypes,
      providers,
    };
  }
}

/**
 * Global audit trail singleton.
 * 
 * In production, this should be replaced with a proper storage backend
 * (PostgreSQL, Elasticsearch, S3, etc.)
 */
export const auditTrail = new AuditTrail();
