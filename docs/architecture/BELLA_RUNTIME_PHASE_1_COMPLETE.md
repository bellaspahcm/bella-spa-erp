# Bella Runtime — Phase 1 Foundation COMPLETE

**Date:** 2026-08-18  
**Phase:** Phase 1 — Foundation  
**Status:** ✅ COMPLETE

---

## Phase 1 Objective

Create core contracts and primitive types:
- Financial Intent (boundary object)
- Validation contracts
- Tenant context
- Correlation context
- Idempotency key derivation
- Error/failure model

---

## Modules Created

### 1. Types (`src/platform/integration-runtime/types/`)

#### `financial-intent.types.ts`
**Purpose:** Core Financial Intent contract (Industry OS → Finance OS)

**Key features:**
- `FinancialIntent` interface (boundary object)
- `FinancialIntentType` (extensible enum)
- `PROHIBITED_FIELDS` constant (Finance Protection)
- `FinancialIntentSchema` (Zod strict mode)
- `validateNoProhibitedFields()` (runtime enforcement)
- `ValidationError` class
- `PublishResult`, `AuditLogEntry`, `QuarantinedIntent` interfaces

**Critical enforcement:**
```typescript
export const PROHIBITED_FIELDS = [
  'glAccount',
  'debit',
  'credit',
  'journalEntry',
  'chartOfAccountsMapping',
  'revenueRecognitionMethod',
  'cogsCalculationMethod',
  'postingRules',
  'ledgerEntry',
  'accountingTreatment',
] as const;
```

**Boundary protection:**
- Financial Intent = SEMANTIC (business event → financial consequence)
- Financial Intent ≠ ACCOUNTING TREATMENT (GL account, DR/CR)
- Finance OS interprets intent, NOT Runtime

---

#### `runtime-config.types.ts`
**Purpose:** Runtime configuration and context types

**Key types:**
- `RuntimeConfig` (retry, outbox, idempotency, quarantine, observability)
- `RetryConfig` (exponential backoff with jitter)
- `OutboxConfig` (polling, batch size, timeouts)
- `IdempotencyConfig` (TTL, hash algorithm)
- `QuarantineConfig` (retention, alerts)
- `ObservabilityConfig` (tracing, audit retention)
- `TenantContext` (tenant identification)
- `CorrelationContext` (distributed tracing)
- `IdempotencyKeyComponents` (key derivation inputs)
- `DEFAULT_RUNTIME_CONFIG` (production-safe defaults)

---

#### `runtime-errors.types.ts`
**Purpose:** Structured error model for failure handling

**Key types:**
- `RuntimeErrorCode` enum (categorized error codes)
- `RuntimeError` base class (code, retryable, context, timestamp)
- `ValidationError` (NOT retryable)
- `FinanceProtectionError` (NOT retryable, architectural violation)
- `TenantIsolationError` (NOT retryable, security violation)
- `IdempotencyError` (NOT retryable, expected behavior)
- `OutboxError` (retryable)
- `FinanceServiceError` (retryable)
- `QuarantineError` (NOT retryable, requires intervention)
- `isRetryableError()` function
- `mapErrorToCode()` function
- `buildErrorContext()` function

**Retryable vs Non-retryable:**
- Validation errors → NOT retryable (client error)
- Finance Protection errors → NOT retryable (architectural violation)
- Tenant isolation errors → NOT retryable (security violation)
- Idempotency errors → NOT retryable (expected, not a failure)
- Database errors → Retryable
- Network errors → Retryable
- Poison messages → NOT retryable (requires manual intervention)

---

### 2. Validation (`src/platform/integration-runtime/validation/`)

#### `intent-validator.ts`
**Purpose:** Runtime validation enforcement (NOT just TypeScript compile-time)

**Key features:**
- `IntentValidator` class
- `validate()` method (throws if invalid)
- Step-by-step validation:
  1. Type check
  2. Finance Protection (prohibited fields)
  3. Schema validation (Zod strict mode)
  4. Tenant validation
  5. Correlation ID validation
  6. Amount validation
  7. Currency validation (ISO 4217)
- `validateNoProhibitedFields()` (RUNTIME enforcement)
- `validateBatch()` (bulk validation)

**Critical:** This is RUNTIME enforcement, not just TypeScript types.

---

#### `tenant-validator.ts`
**Purpose:** Tenant isolation enforcement

**Key features:**
- `TenantValidator` class
- `validateTenant()` (throws if invalid/inactive)
- `validateTenantScope()` (prevent cross-tenant access)
- `registerTenant()` (add tenant to registry)
- `isTenantValid()` (non-throwing check)
- `listActiveTenants()` (query tenants)
- `deactivateTenant()` (soft delete)

**Tenant isolation:**
- Tenant A CANNOT access resources of Tenant B
- Tenant scope validated on every operation
- Cross-tenant access throws `TenantIsolationError`

---

### 3. Idempotency (`src/platform/integration-runtime/idempotency/`)

#### `idempotency-key.ts`
**Purpose:** Tenant-scoped idempotency key derivation

**Formula:** `HASH(tenantId || correlationId || intentType)`

**Key features:**
- `deriveIdempotencyKey()` function (SHA-256 by default)
- `createIdempotencyKey()` (key + metadata)
- `verifyIdempotencyKey()` (verify derivation)
- `IdempotencyKeyMetadata` interface

**Critical design:**
- Tenant-scoped (Tenant A cannot replay Tenant B's intents)
- Deterministic (same input → same key)
- Collision-resistant (SHA-256)

**Architecture Decision:** Runtime Architecture Gate v2, Gap 1 fix

---

#### `idempotency-registry.ts`
**Purpose:** In-memory idempotency key tracking (production: database)

**Key features:**
- `IdempotencyRegistry` class
- `check()` (check if duplicate)
- `register()` (register processed intent)
- `checkAndRegister()` (atomic operation)
- `getRecord()` (retrieve record)
- `getRecordsByTenant()` (query by tenant)
- `cleanup()` (garbage collection for expired records)
- `getStats()` (monitoring metrics)

**TTL:** 24 hours default (intentional replay allowed after expiry)

---

#### `idempotency-manager.ts`
**Purpose:** High-level idempotency orchestration

**Key features:**
- `IdempotencyManager` class
- `checkIntent()` (check if duplicate)
- `registerIntent()` (register processed intent)
- `checkAndRegister()` (atomic, throws if duplicate)
- `getIntentStatus()` (non-throwing status check)
- `listProcessedIntents()` (query by tenant)

**Orchestration:**
- Coordinates key derivation + registry checks
- Provides high-level API for duplicate detection
- Throws `IdempotencyError` if duplicate detected

---

## Architectural Compliance

### ✅ Finance Protection (Prohibited Fields)

**Enforcement:**
```typescript
export const PROHIBITED_FIELDS = [
  'glAccount',
  'debit',
  'credit',
  'journalEntry',
  'chartOfAccountsMapping',
  'revenueRecognitionMethod',
  'cogsCalculationMethod',
  'postingRules',
  'ledgerEntry',
  'accountingTreatment',
] as const;
```

**Runtime validation:**
```typescript
function validateNoProhibitedFields(intent: unknown): void {
  for (const field of PROHIBITED_FIELDS) {
    if (field in intent) {
      throw new FinanceProtectionError(field, ...);
    }
  }
}
```

**Result:** Runtime REJECTS intents with accounting authority fields.

---

### ✅ Tenant Isolation

**Idempotency key formula:**
```typescript
HASH(tenantId || correlationId || intentType)
```

**Result:** Tenant A's idempotency key ≠ Tenant B's idempotency key (even with same correlationId + intentType).

**Cross-tenant access prevention:**
```typescript
validateTenantScope(requestTenantId, resourceTenantId);
// Throws if requestTenantId !== resourceTenantId
```

---

### ✅ Boundary Object (Financial Intent)

**Design:**
- Financial Intent = boundary between Industry OS and Finance OS
- Financial Intent = SEMANTIC (describes financial consequence)
- Financial Intent ≠ ACCOUNTING TREATMENT (no GL account, DR/CR)

**Strict mode:**
```typescript
export const FinancialIntentSchema = z.object({
  intentType: z.string().min(1),
  tenantId: z.string().min(1),
  // ... other fields
}).strict();  // ✅ Reject unknown fields
```

**Result:** Cannot "nhét thêm accounting fields" later.

---

### ✅ Error Model (Retryable vs Non-retryable)

**Classification:**
- Validation errors → NOT retryable (fix intent)
- Database errors → Retryable (transient failure)
- Network errors → Retryable (transient failure)
- Finance Protection errors → NOT retryable (architectural violation)
- Idempotency errors → NOT retryable (expected, not a failure)

**Result:** Clear failure handling strategy.

---

## File Structure

```
src/platform/integration-runtime/
├── types/
│   ├── financial-intent.types.ts  ✅
│   ├── runtime-config.types.ts    ✅
│   ├── runtime-errors.types.ts    ✅
│   └── index.ts                   ✅
├── validation/
│   ├── intent-validator.ts        ✅
│   ├── tenant-validator.ts        ✅
│   └── index.ts                   ✅
├── idempotency/
│   ├── idempotency-key.ts         ✅
│   ├── idempotency-registry.ts    ✅
│   ├── idempotency-manager.ts     ✅
│   └── index.ts                   ✅
└── index.ts                       ✅
```

**Total:** 13 files created

---

## Next Steps

### Phase 2 — Database (Pending)

**Objective:** Create database schema and repositories

**Tasks:**
1. Create Supabase migration for 5 tables:
   - `runtime_outbox`
   - `runtime_idempotency_registry`
   - `runtime_audit_log`
   - `runtime_quarantine`
   - `runtime_tenant_registry`

2. Implement repositories:
   - `outbox-repository.ts`
   - `audit-repository.ts`
   - `quarantine-repository.ts`
   - `tenant-repository.ts`

3. Test tenant isolation:
   - Tenant A CANNOT read/write/replay Tenant B's state

---

## Verification Checklist

**Phase 1 Foundation:**
- ✅ Financial Intent type (boundary object)
- ✅ Prohibited fields constant (Finance Protection)
- ✅ Zod schema (strict mode)
- ✅ Runtime validation (not just TypeScript)
- ✅ Tenant context types
- ✅ Correlation context types
- ✅ Idempotency key derivation (tenant-scoped)
- ✅ Idempotency registry
- ✅ Error model (retryable vs non-retryable)
- ✅ Clean exports (index files)

**Architecture compliance:**
- ✅ Financial Intent = boundary object (not "thoải mái")
- ✅ Prohibited fields enforced (runtime, not compile-time)
- ✅ Tenant isolation (idempotency key scoped)
- ✅ Error classification (retryable vs permanent)

---

## Critical Principles Maintained

1. **Runtime ≠ Accounting Authority**
   - Financial Intent does NOT contain GL account, DR/CR, journal entry
   - Finance OS interprets intent and applies accounting rules

2. **Financial Intent = Boundary Object**
   - Strict schema (rejects unknown fields)
   - Prohibited fields enforced at runtime
   - Cannot "nhét thêm accounting fields"

3. **Tenant Isolation**
   - Idempotency key tenant-scoped
   - Cross-tenant access prevented
   - Validation enforced

4. **Failure Safety**
   - Clear error classification (retryable vs non-retryable)
   - Conservative retry logic (unknown errors → retry)
   - Idempotency errors NOT failures (expected behavior)

---

## Status Summary

**Phase 1:** ✅ **COMPLETE**

**Governance:**
- Constitution v1.0 🔒
- Template v1.0 🔒
- Runtime Architecture v1.1 🔒
- Implementation Design v1.0 🔒
- Implementation Gate: 6/6 PASS

**Implementation progress:**
- Phase 1 Foundation: ✅ COMPLETE
- Phase 2 Database: ⏳ PENDING
- Phase 3 Enforcement: ⏳ PENDING
- Phase 4 Reliability: ⏳ PENDING
- Phase 5 Observability: ⏳ PENDING

**Education track:** 🟡 AWAITING PO (independent)

---

**Phase 1 complete. Ready to proceed to Phase 2 — Database.**

**No architecture changes. No bypass. Following frozen design.**
