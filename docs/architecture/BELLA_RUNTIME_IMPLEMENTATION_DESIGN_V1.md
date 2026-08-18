# Bella Common Integration Runtime — Implementation Design v1.0
**Version:** 1.0.0  
**Date:** 2026-08-18  
**Status:** 🔒 **FROZEN** (Implementation Gate PASS — 6/6)  
**Gate Approval:** 2026-08-18 (Implementation Gate Review v1)  
**Architecture Version:** v1.1 (FROZEN)  
**Purpose:** Design Runtime implementation (technology, structure, interfaces) — NOT code yet

---

## Document Purpose

**This document specifies:**
- ✅ Technology choices (database, language, libraries)
- ✅ Component structure (modules, layers)
- ✅ Interface contracts (APIs, types)
- ✅ Data models (schemas, tables)
- ✅ Deployment model (services, infrastructure)

**This document does NOT:**
- ❌ Write implementation code
- ❌ Violate Architecture v1.1 boundaries
- ❌ Add features not in Architecture v1.1

**Implementation Design answers:**
> "How to build Runtime per Architecture v1.1?"

**NOT:**
> "What should Runtime do?" (Architecture v1.1 already defines)

---

## Design Constraints (From Architecture v1.1)

**MUST implement (8 CORE Primitives):**
1. ✅ P-002: Financial Intent Validation
2. ✅ P-004: Idempotency (tenant-scoped)
3. ✅ P-005: Transactional Outbox
4. ✅ P-006: Retry / Backoff
5. ✅ P-007: Quarantine / Poison Message Handling
6. ✅ P-008: Tenant Context Enforcement
7. ✅ P-009: Correlation / Trace Context
8. ✅ P-010: Audit / Provenance

**MUST NOT implement:**
- ❌ Revenue recognition logic
- ❌ COGS calculation
- ❌ AR aging
- ❌ Tax calculation
- ❌ GL account selection
- ❌ DR/CR generation
- ❌ Accounting policy engine
- ❌ Business logic

**Boundary (NON-NEGOTIABLE):**
```
Industry OS (business truth)
     ↓
Financial Intent (semantics)
     ↓
★ RUNTIME (reliability/isolation/observability) ★
     ↓
Finance OS (accounting authority)
     ↓
F1-F5
```

---

## Implementation Approach

**Philosophy:**
> Start with proven patterns from Hospital integration, generalize for all industries

**Evidence-based design:**
- Hospital integration operational (H1.1 + H1.2)
- Integration Hub exists (`src/platform/integration-hub/`)
- Outbox pattern proven
- Extract proven primitives, refactor for generality

**NOT greenfield:**
- Leverage existing Hospital integration infrastructure
- Refactor for multi-industry support
- Maintain backward compatibility (Hospital continues working)

---

## Technology Stack

### Language & Runtime

**TypeScript + Node.js**

**Rationale:**
- Existing codebase TypeScript
- Hospital integration already Node.js
- Maintain consistency

---

### Database

**PostgreSQL** (existing: Supabase PostgreSQL)

**Rationale:**
- Bella already uses PostgreSQL (Supabase)
- ACID transactions (required for outbox)
- JSON support (metadata storage)
- Proven at scale

**Schema Strategy:**
- Runtime tables: `runtime_*` prefix
- Separate from Finance (`fin_*`) and Industry schemas (`hc_*`, `st_*`, `rt_*`)

---

### Key Libraries

**Idempotency & Deduplication:**
- Custom implementation (hash-based, tenant-scoped)

**Retry & Backoff:**
- `p-retry` (exponential backoff with jitter)

**Logging & Observability:**
- `pino` (structured logging)
- `opentelemetry` (distributed tracing, correlation propagation)

**Validation:**
- `zod` (schema validation, TypeScript integration)

**Database Client:**
- Existing Supabase client (PostgreSQL)

---

## Component Architecture

### High-Level Components

```
┌────────────────────────────────────────────────┐
│        Industry Adapter                        │
│    (Hospital, Education, Retail, ...)          │
└────────────────────────────────────────────────┘
                     │
                     ↓ publishIntent(intent)
┌────────────────────────────────────────────────┐
│   ★ COMMON INTEGRATION RUNTIME ★               │
│                                                │
│  ┌──────────────────────────────────────────┐ │
│  │  Intent Validation (P-002)               │ │
│  │  - Schema validation                     │ │
│  │  - Required fields                       │ │
│  │  - Prohibited fields (Finance Protection)│ │
│  │  - Tenant validation                     │ │
│  └──────────────────────────────────────────┘ │
│                     │                          │
│                     ↓                          │
│  ┌──────────────────────────────────────────┐ │
│  │  Idempotency Check (P-004)               │ │
│  │  - Compute: HASH(tenant+corr+intent)     │ │
│  │  - Check registry: Already processed?    │ │
│  │  - If duplicate → Skip (return success)  │ │
│  └──────────────────────────────────────────┘ │
│                     │                          │
│                     ↓                          │
│  ┌──────────────────────────────────────────┐ │
│  │  Transactional Outbox Write (P-005)      │ │
│  │  - Write to runtime_outbox                │ │
│  │  - Same transaction as Adapter business   │ │
│  └──────────────────────────────────────────┘ │
│                     │                          │
│                     ↓                          │
│  ┌──────────────────────────────────────────┐ │
│  │  Audit Log Write (P-010)                 │ │
│  │  - Write to runtime_audit_log             │ │
│  │  - Immutable (append-only)                │ │
│  └──────────────────────────────────────────┘ │
│                     │                          │
│                     ↓                          │
│  ┌──────────────────────────────────────────┐ │
│  │  Outbox Worker (P-005, P-006, P-007)     │ │
│  │  - Poll runtime_outbox                    │ │
│  │  - Publish to Finance OS                  │ │
│  │  - Retry with backoff (P-006)            │ │
│  │  - Quarantine poison messages (P-007)    │ │
│  │  - Update outbox status                   │ │
│  └──────────────────────────────────────────┘ │
│                                                │
└────────────────────────────────────────────────┘
                     │
                     ↓ Financial Intent (validated, reliable)
┌────────────────────────────────────────────────┐
│         Finance OS (F1-F5)                     │
└────────────────────────────────────────────────┘
```

---

### Module Structure

```
src/platform/integration-runtime/
├── validation/
│   ├── intent-validator.ts          # P-002: Validation
│   ├── schema.ts                     # Zod schemas
│   └── tenant-validator.ts           # P-008: Tenant validation
│
├── idempotency/
│   ├── idempotency-manager.ts        # P-004: Duplicate detection
│   ├── idempotency-key.ts            # Key computation
│   └── idempotency-registry.ts       # Database interface
│
├── outbox/
│   ├── outbox-writer.ts              # P-005: Write to outbox
│   ├── outbox-worker.ts              # P-005: Poll & publish
│   └── outbox-repository.ts          # Database interface
│
├── retry/
│   ├── retry-manager.ts              # P-006: Retry with backoff
│   └── backoff-strategy.ts           # Exponential backoff + jitter
│
├── quarantine/
│   ├── quarantine-manager.ts         # P-007: Quarantine handling
│   └── quarantine-repository.ts      # Database interface
│
├── observability/
│   ├── correlation-manager.ts        # P-009: Correlation propagation
│   ├── audit-logger.ts               # P-010: Audit trail
│   └── tracer.ts                     # OpenTelemetry integration
│
├── publisher/
│   ├── finance-publisher.ts          # Publish to Finance OS
│   └── publisher-client.ts           # HTTP/gRPC client
│
├── types/
│   ├── financial-intent.types.ts     # Financial Intent contract
│   ├── runtime-config.types.ts       # Configuration
│   └── runtime-errors.types.ts       # Error types
│
└── runtime.ts                         # Main entry point
```

---

## Data Models

### Table: `runtime_outbox`

**Purpose:** Transactional outbox for at-least-once delivery (P-005)

**Schema:**
```sql
CREATE TABLE runtime_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT,
  correlation_id TEXT NOT NULL,
  effective_at TIMESTAMPTZ,
  metadata JSONB,
  policy_reference TEXT,
  
  -- Outbox metadata
  status TEXT NOT NULL,  -- PENDING, PUBLISHED, FAILED, QUARANTINE_PENDING
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  published_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  next_retry_at TIMESTAMPTZ,
  failure_reason TEXT,
  
  -- Indexes
  INDEX idx_outbox_status (status, next_retry_at),
  INDEX idx_outbox_tenant (tenant_id),
  INDEX idx_outbox_correlation (correlation_id)
);
```

**Status values:**
- `PENDING`: Ready to publish
- `PUBLISHED`: Successfully published
- `FAILED`: Max retries exceeded → Quarantine
- `QUARANTINE_PENDING`: Quarantine write failed, retry quarantine later

---

### Table: `runtime_idempotency_registry`

**Purpose:** Track processed intents for duplicate detection (P-004)

**Schema:**
```sql
CREATE TABLE runtime_idempotency_registry (
  idempotency_key TEXT PRIMARY KEY,  -- HASH(tenant_id + correlation_id + intent_type)
  tenant_id TEXT NOT NULL,
  correlation_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outbox_id UUID REFERENCES runtime_outbox(id),
  
  -- Indexes
  INDEX idx_idempotency_tenant (tenant_id),
  INDEX idx_idempotency_correlation (correlation_id)
);
```

**Idempotency Key Computation:**
```typescript
function computeIdempotencyKey(
  tenantId: string,
  correlationId: string,
  intentType: string
): string {
  const input = `${tenantId}:${correlationId}:${intentType}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}
```

---

### Table: `runtime_audit_log`

**Purpose:** Immutable audit trail for provenance (P-010)

**Schema:**
```sql
CREATE TABLE runtime_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tenant_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  amount NUMERIC,
  correlation_id TEXT NOT NULL,
  source TEXT NOT NULL,  -- "Hospital Adapter", "Education Adapter", etc.
  status TEXT NOT NULL,  -- SUCCESS, RETRYING, INVALID, DUPLICATE, QUARANTINED
  delivery_attempts INT,
  failure_reason TEXT,
  quarantined_at TIMESTAMPTZ,
  outbox_id UUID REFERENCES runtime_outbox(id),
  
  -- Indexes
  INDEX idx_audit_tenant (tenant_id, timestamp DESC),
  INDEX idx_audit_correlation (correlation_id),
  INDEX idx_audit_status (status)
);

-- Append-only enforcement (no DELETE/UPDATE permissions for application role)
REVOKE DELETE, UPDATE ON runtime_audit_log FROM application_role;
```

---

### Table: `runtime_quarantine`

**Purpose:** Poison message quarantine (P-007)

**Schema:**
```sql
CREATE TABLE runtime_quarantine (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id TEXT NOT NULL,
  intent_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  amount NUMERIC,
  currency TEXT,
  correlation_id TEXT NOT NULL,
  effective_at TIMESTAMPTZ,
  metadata JSONB,
  policy_reference TEXT,
  
  -- Quarantine metadata
  quarantined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  failure_reason TEXT NOT NULL,
  attempts INT NOT NULL,
  last_error TEXT,
  outbox_id UUID REFERENCES runtime_outbox(id),
  reviewed BOOLEAN DEFAULT FALSE,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  resolution TEXT,  -- REPLAYED, DISCARDED, FIXED
  
  -- Indexes
  INDEX idx_quarantine_tenant (tenant_id),
  INDEX idx_quarantine_reviewed (reviewed),
  INDEX idx_quarantine_correlation (correlation_id)
);
```

---

### Table: `runtime_tenant_registry`

**Purpose:** Valid tenant registry for tenant validation (P-008)

**Schema:**
```sql
CREATE TABLE runtime_tenant_registry (
  tenant_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  industry_type TEXT NOT NULL,  -- HOSPITAL, EDUCATION, RETAIL, etc.
  status TEXT NOT NULL,  -- ACTIVE, SUSPENDED, DELETED
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  INDEX idx_tenant_status (status)
);
```

---

## Interface Contracts

### Financial Intent Type

**TypeScript definition:**
```typescript
// src/platform/integration-runtime/types/financial-intent.types.ts

export type FinancialIntentType =
  | 'REVENUE_RECOGNIZED'
  | 'ACCOUNTS_RECEIVABLE_DUE'
  | 'PAYMENT_RECEIVED'
  | 'TUITION_OBLIGATION_RECOGNIZED'
  | 'SCHOLARSHIP_APPLIED'
  | 'REFUND_DUE'
  | 'COST_OF_GOODS_RECOGNIZED'
  | 'INVENTORY_RESTORED'
  | 'SALES_RETURN_RECOGNIZED'
  | 'ACCOUNTS_PAYABLE_DUE'
  | 'SUPPLIER_PAYMENT_MADE';
  // ... extensible (open enum)

export interface FinancialIntent {
  // Required fields
  intentType: FinancialIntentType;
  tenantId: string;
  entityId: string;
  entityType: string;
  amount: number;
  currency: string;
  correlationId: string;
  
  // Optional fields
  effectiveAt?: Date;
  metadata?: Record<string, unknown>;
  policyReference?: string;
}

// Zod schema for validation
export const FinancialIntentSchema = z.object({
  intentType: z.string(),
  tenantId: z.string().min(1),
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),  // ISO 4217
  correlationId: z.string().min(1),
  effectiveAt: z.date().optional(),
  metadata: z.record(z.unknown()).optional(),
  policyReference: z.string().optional(),
}).strict();  // Reject unknown fields (Finance Protection)

// Prohibited fields validation
const PROHIBITED_FIELDS = [
  'glAccount',
  'debit',
  'credit',
  'journalEntry',
  'chartOfAccountsMapping',
  'revenueRecognitionMethod',
  'cogsCalculationMethod'
];

export function validateNoProhibitedFields(intent: unknown): void {
  if (typeof intent !== 'object' || intent === null) return;
  
  for (const field of PROHIBITED_FIELDS) {
    if (field in intent) {
      throw new ValidationError(
        `Prohibited field '${field}' (Finance Protection violation)`
      );
    }
  }
}
```

---

### Runtime API

**Public interface for Adapters:**

```typescript
// src/platform/integration-runtime/runtime.ts

export interface IntegrationRuntime {
  /**
   * Publish Financial Intent (with transactional outbox)
   * 
   * @param intent - Financial Intent (validated)
   * @param transaction - Database transaction context (from Adapter)
   * @returns Promise<PublishResult>
   */
  publishIntent(
    intent: FinancialIntent,
    transaction: DatabaseTransaction
  ): Promise<PublishResult>;
  
  /**
   * Query audit log
   * 
   * @param query - Audit query (tenant-scoped)
   * @returns Promise<AuditLogEntry[]>
   */
  queryAuditLog(query: AuditQuery): Promise<AuditLogEntry[]>;
  
  /**
   * Query quarantine
   * 
   * @param query - Quarantine query (tenant-scoped)
   * @returns Promise<QuarantinedIntent[]>
   */
  queryQuarantine(query: QuarantineQuery): Promise<QuarantinedIntent[]>;
  
  /**
   * Replay quarantined intent
   * 
   * @param quarantineId - Quarantine record ID
   * @param reviewedBy - Who approved replay
   * @returns Promise<ReplayResult>
   */
  replayQuarantinedIntent(
    quarantineId: string,
    reviewedBy: string
  ): Promise<ReplayResult>;
}

export interface PublishResult {
  status: 'SUCCESS' | 'DUPLICATE' | 'INVALID';
  outboxId?: string;
  idempotencyKey?: string;
  error?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  tenantId: string;
  intentType: string;
  entityId: string;
  correlationId: string;
  status: 'SUCCESS' | 'RETRYING' | 'INVALID' | 'DUPLICATE' | 'QUARANTINED';
  deliveryAttempts?: number;
  failureReason?: string;
}
```

---

## Deployment Model

### Runtime Components

**1. Runtime Library** (synchronous, called by Adapter)
- Intent validation
- Idempotency check
- Outbox write
- Audit log write

**2. Outbox Worker** (asynchronous, background process)
- Poll outbox (WHERE status = 'PENDING' AND next_retry_at <= NOW())
- Publish to Finance OS
- Retry with backoff
- Quarantine poison messages
- Update outbox status

**Deployment:**
- Runtime Library: Embedded in Adapter process (same transaction)
- Outbox Worker: Separate process (cron job, service, or serverless function)

---

### Outbox Worker Design

**Polling Strategy:**
```typescript
// Pseudocode
async function outboxWorkerLoop() {
  while (true) {
    const pendingIntents = await outboxRepository.fetchPending({
      status: ['PENDING', 'QUARANTINE_PENDING'],
      nextRetryBefore: new Date(),
      limit: 100
    });
    
    for (const intent of pendingIntents) {
      try {
        // Publish to Finance OS
        await financePublisher.publish(intent);
        
        // Mark as published
        await outboxRepository.markPublished(intent.id);
        
        // Record in idempotency registry
        await idempotencyRegistry.record(intent);
        
        // Audit log: SUCCESS
        await auditLogger.log(intent, 'SUCCESS');
        
      } catch (error) {
        if (isRetryable(error)) {
          // Retry with backoff
          const nextRetry = computeNextRetry(intent.attempts);
          await outboxRepository.scheduleRetry(intent.id, nextRetry);
          await auditLogger.log(intent, 'RETRYING', error);
          
        } else {
          // Permanent error → Quarantine
          await quarantineManager.quarantine(intent, error);
          await outboxRepository.markQuarantined(intent.id);
          await auditLogger.log(intent, 'QUARANTINED', error);
        }
      }
    }
    
    await sleep(5000);  // Poll every 5 seconds
  }
}
```

---

## Implementation Gate (Before Coding)

**Before writing code, Implementation Design must pass Implementation Gate.**

### Gate Criteria

**IG-1: Boundary Compliance**
> Does implementation design respect Architecture v1.1 boundaries?

**Verify:**
- ✅ No accounting logic (revenue recognition, COGS, GL account selection)
- ✅ No business logic (policy decisions, domain rules)
- ✅ Only reliability/isolation/observability primitives

**IG-2: Finance Protection**
> Does implementation enforce prohibited fields rejection?

**Verify:**
- ✅ Zod schema `.strict()` (reject unknown fields)
- ✅ Explicit prohibited fields check (`glAccount`, `debit`, `credit`)

**IG-3: Tenant Isolation**
> Does implementation enforce tenant-scoped idempotency?

**Verify:**
- ✅ Idempotency key = `HASH(tenantId + correlationId + intentType)`
- ✅ Idempotency registry tenant-scoped

**IG-4: Failure Safety**
> Does implementation prevent intent loss?

**Verify:**
- ✅ Transactional outbox (ACID)
- ✅ Fail-safe quarantine (keep in outbox if quarantine write fails)
- ✅ Durable idempotency registry (persistent DB)

**IG-5: Provenance**
> Does implementation enable end-to-end tracing?

**Verify:**
- ✅ CorrelationId required (validation rejects if missing)
- ✅ Audit log immutable (no DELETE/UPDATE permissions)

**IG-6: Backward Compatibility**
> Does implementation maintain Hospital integration?

**Verify:**
- ✅ Existing Hospital integration continues working
- ✅ Refactor without breaking changes

---

## Next Steps

**After Implementation Design v1:**

```
Implementation Design v1 (THIS DOCUMENT)
    ↓
Implementation Gate Review (verify 6 criteria)
    ↓
If PASS: Implementation
    ↓
Unit Tests
    ↓
Integration Tests
    ↓
Verification (Hospital continues working + new primitives proven)
    ↓
Runtime v1 Freeze
```

**No code until:**
- ✅ Implementation Gate PASS (6/6)

---

## Governance Reminder

**Platform Track:**
```
Runtime Architecture v1.1 → 🔒 FROZEN
Runtime Implementation Design v1 → ✅ DRAFT (this document)
Implementation Gate → 🟡 PENDING
Implementation → 🔴 BLOCKED (until Gate PASS)
```

**Education Track:**
```
Product Definition → 🟡 AWAITING PO (unchanged, independent)
```

**Two tracks remain independent.**

---

## Document Status

**Version:** 1.0.0  
**Status:** DRAFT  
**Architecture Version:** v1.1 (FROZEN)

**Next:** Implementation Gate Review

---

**END OF RUNTIME IMPLEMENTATION DESIGN V1**

**Technology chosen. Components structured. Interfaces defined. Gate criteria established.**

**No code until Implementation Gate PASS.**
