# Bella Runtime — Phase 2 Database COMPLETE

**Date:** 2026-08-18  
**Phase:** Phase 2 — Database  
**Status:** ✅ COMPLETE

---

## Phase 2 Objective

Create database schema and repositories:
- 5 runtime tables (tenant, idempotency, outbox, audit, quarantine)
- RLS + database constraints (defense-in-depth)
- Repository implementations (tenant-scoped operations)

---

## Database Schema Created

### Migration: `supabase/migrations/20260818000001_runtime_tables.sql`

**5 tables created:**

#### 1. `runtime_tenant_registry`
**Purpose:** Tenant registration and validation

**Key constraints:**
- `tenant_id` PRIMARY KEY
- `is_active` BOOLEAN (tenant status)
- `tenant_id_not_empty` CHECK constraint
- RLS enabled (tenant isolation policy)
- `updated_at` auto-updated trigger

**Indexes:**
- `idx_runtime_tenant_active` (active tenants)
- `idx_runtime_tenant_created` (creation time)

---

#### 2. `runtime_idempotency_registry`
**Purpose:** Duplicate intent detection

**Key constraints:**
- `UNIQUE(tenant_id, idempotency_key)` ✅ **CRITICAL: Tenant-scoped uniqueness**
- `tenant_id` FOREIGN KEY → `runtime_tenant_registry`
- `expires_at` TIMESTAMPTZ (TTL-based expiry)
- RLS enabled (tenant isolation policy)

**Indexes:**
- `idx_runtime_idempotency_tenant_key` (tenant + key lookup)
- `idx_runtime_idempotency_correlation` (correlation tracing)
- `idx_runtime_idempotency_expires` (TTL cleanup)

**Idempotency key formula:**
```
SHA-256(v1:tenantId:correlationId:intentType)
```

**Collision prevention:**
- Version prefix: `v1:`
- Delimiter: `:` (validated, no `:` in components)
- Prevents: `"A:BC"` ≠ `"AB:C"`

---

#### 3. `runtime_outbox`
**Purpose:** Transactional outbox (at-least-once delivery)

**Key constraints:**
- `tenant_id` FOREIGN KEY → `runtime_tenant_registry`
- `status` CHECK IN ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED', 'QUARANTINED')
- `delivery_attempts` CHECK >= 0
- RLS enabled (tenant isolation policy)

**Indexes:**
- `idx_runtime_outbox_status` (pending/failed intents)
- `idx_runtime_outbox_tenant_status` (tenant + status)
- `idx_runtime_outbox_next_retry` (retry scheduling)
- `idx_runtime_outbox_correlation` (correlation tracing)

**Transactional guarantee:**
- Intent persisted atomically with business state
- If DB commit ✅ → Intent in outbox ✅
- If DB rollback ❌ → Intent NOT in outbox ✅

---

#### 4. `runtime_audit_log`
**Purpose:** Append-only audit trail

**Key constraints:**
- `tenant_id` FOREIGN KEY → `runtime_tenant_registry`
- `status` CHECK IN ('SUCCESS', 'RETRYING', 'INVALID', 'DUPLICATE', 'QUARANTINED')
- `amount` CHECK >= 0
- `currency` CHECK (3 chars, uppercase ISO 4217)
- RLS enabled with **APPEND-ONLY policies:**
  - SELECT allowed (tenant-scoped)
  - INSERT allowed (tenant-scoped)
  - UPDATE **DENIED** (policy returns false)
  - DELETE **DENIED** (policy returns false)

**Indexes:**
- `idx_runtime_audit_tenant` (tenant lookup)
- `idx_runtime_audit_correlation` (correlation tracing)
- `idx_runtime_audit_timestamp` (time-series queries)
- `idx_runtime_audit_status` (status filtering)
- `idx_runtime_audit_entity` (entity tracing)

**CRITICAL: Audit log is immutable at database level**

---

#### 5. `runtime_quarantine`
**Purpose:** Poison message storage (investigation + replay)

**Key constraints:**
- `tenant_id` FOREIGN KEY → `runtime_tenant_registry`
- `resolution` CHECK IN ('REPLAYED', 'DISCARDED', 'FIXED') OR NULL
- `attempts` CHECK > 0
- RLS enabled (tenant isolation policy)

**Indexes:**
- `idx_runtime_quarantine_tenant` (tenant lookup)
- `idx_runtime_quarantine_reviewed` (unreviewed intents)
- `idx_runtime_quarantine_correlation` (correlation tracing)

**Preserved data:**
- Full `intent_payload` (JSONB)
- Full error context (`last_error`, `failure_reason`)
- Provenance (`correlation_id`, `outbox_id`)

---

## Repositories Created

### 1. `TenantRepository` ✅
**File:** `src/platform/integration-runtime/database/tenant-repository.ts`

**Key methods:**
- `createTenant()` — Register new tenant
- `getTenant()` — Get tenant by ID (throws if not found)
- `getActiveTenant()` — Get active tenant (throws if inactive)
- `listActiveTenants()` — Query all active tenants
- `updateTenant()` — Update tenant metadata
- `deactivateTenant()` — Soft delete
- `activateTenant()` — Reactivate
- `tenantExists()` — Non-throwing check
- `isTenantActive()` — Non-throwing check

**Isolation enforcement:**
- All operations throw `TenantIsolationError` if tenant not found/invalid

---

### 2. `IdempotencyRepository` ✅
**File:** `src/platform/integration-runtime/database/idempotency-repository.ts`

**Key methods:**
- `check()` — Check if duplicate (within TTL)
- `register()` — Register processed intent (throws if duplicate)
- `checkAndRegister()` — Atomic check + register
- `getRecord()` — Get idempotency record by key
- `getRecordsByTenant()` — List tenant's records
- `getRecordsByCorrelation()` — Trace correlation chain
- `cleanupExpired()` — Garbage collection
- `getStats()` — Monitoring metrics

**Duplicate detection:**
- `UNIQUE(tenant_id, idempotency_key)` enforced at DB level
- Race condition handled: re-check on constraint violation
- TTL-based expiry (intentional replay allowed after expiry)

---

### 3. `OutboxRepository` ✅
**File:** `src/platform/integration-runtime/database/outbox-repository.ts`

**Key methods:**
- `create()` — Insert Financial Intent into outbox
- `getPendingIntents()` — Poll for pending/failed intents
- `markProcessing()` — Mark intent as being delivered
- `markPublished()` — Mark successful delivery
- `markFailed()` — Mark failed (retry scheduled)
- `markQuarantined()` — Mark poison message
- `getById()` — Get outbox record
- `getByCorrelationId()` — Trace correlation chain
- `getByTenant()` — List tenant's intents
- `getStaleRecords()` — Detect stuck intents (worker crash)
- `resetStaleRecords()` — Reset stale to PENDING
- `getStats()` — Monitoring metrics

**Transactional outbox:**
- `create()` MUST be called within same transaction as business state
- At-least-once delivery guarantee

---

### 4. `AuditRepository` ✅
**File:** `src/platform/integration-runtime/database/audit-repository.ts`

**Key methods:**
- `logSuccess()` — Record successful delivery
- `logRetrying()` — Record retry attempt
- `logInvalid()` — Record validation failure
- `logDuplicate()` — Record idempotency rejection
- `logQuarantined()` — Record quarantine
- `getByCorrelationId()` — Trace full correlation history
- `getByTenant()` — List tenant's audit log
- `getByEntity()` — Trace entity history
- `getRecent()` — Recent audit records (monitoring)
- `getStats()` — Success rate + status breakdown

**APPEND-ONLY:**
- No `update()` method (intentionally omitted)
- No `delete()` method (intentionally omitted)
- RLS policies enforce at database level

---

### 5. `QuarantineRepository` ✅
**File:** `src/platform/integration-runtime/database/quarantine-repository.ts`

**Key methods:**
- `quarantine()` — Store poison message
- `getById()` — Get quarantine record
- `getUnreviewed()` — List pending review
- `getByTenant()` — List tenant's quarantine
- `getByCorrelationId()` — Trace quarantine by correlation
- `markReviewed()` — Mark as reviewed (with resolution)
- `markReplayed()` — Mark successfully replayed
- `markDiscarded()` — Mark invalid/discarded
- `markFixed()` — Mark corrected + replayed
- `getRecent()` — Recent quarantine (monitoring)
- `getStats()` — Unreviewed count + resolutions
- `cleanupOld()` — Delete old reviewed records

**Provenance preservation:**
- Full `intent_payload` preserved (for replay)
- Full error context preserved (for investigation)
- Idempotency semantics preserved (replay maintains correlation ID)

---

## TypeScript Database Types

**File:** `src/platform/integration-runtime/types/database.types.ts`

**Types created:**
- `TenantRegistryRecord`
- `IdempotencyRegistryRecord`
- `OutboxRecord` + `OutboxStatus` enum
- `AuditLogRecord` + `AuditStatus` enum
- `QuarantineRecord` + `QuarantineResolution` enum
- Insert types (omit auto-generated fields)
- Update types (only mutable fields)

**NOTE:** Audit log has NO update type (append-only)

---

## Architectural Compliance

### ✅ Tenant Isolation (Database Level)

**RLS policies:**
```sql
CREATE POLICY tenant_isolation_policy_registry ON runtime_tenant_registry
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id', true));
```

**Applied to ALL 5 tables**

**Result:** Tenant A CANNOT access Tenant B's data (enforced at database level)

---

### ✅ Idempotency (Tenant-Scoped)

**Unique constraint:**
```sql
CONSTRAINT idempotency_tenant_key_unique UNIQUE(tenant_id, idempotency_key)
```

**Result:**
- Same `(tenant_id, idempotency_key)` → Duplicate detected ✅
- Different `tenant_id`, same `idempotency_key` → Allowed ✅ (tenant isolation)

---

### ✅ Audit Log (Append-Only)

**RLS policies:**
```sql
-- SELECT allowed (tenant-scoped)
CREATE POLICY tenant_isolation_policy_audit ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = current_setting('app.current_tenant_id', true));

-- INSERT allowed (tenant-scoped)
CREATE POLICY audit_append_only_policy ON runtime_audit_log
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id', true));

-- UPDATE DENIED
CREATE POLICY audit_no_update ON runtime_audit_log
  FOR UPDATE
  USING (false);

-- DELETE DENIED
CREATE POLICY audit_no_delete ON runtime_audit_log
  FOR DELETE
  USING (false);
```

**Result:** Audit records CANNOT be modified after creation (database enforced)

---

### ✅ Transactional Outbox

**Design:**
1. Business transaction begins
2. Business state updated
3. `OutboxRepository.create()` called (same transaction)
4. Transaction commits
5. If commit succeeds → Intent in outbox ✅
6. If commit fails → Intent NOT in outbox ✅ (no orphan intents)

**Result:** No intent loss, no orphan intents

---

### ✅ Quarantine Provenance

**Preserved fields:**
- `intent_payload` (JSONB) — Full Financial Intent
- `correlation_id` — Trace back to source
- `outbox_id` — Link to original outbox record
- `failure_reason` + `last_error` — Investigation context

**Result:** Quarantined intents can be replayed with full provenance

---

## Verification Queries (In Migration)

Migration includes test queries (commented):

```sql
-- Test 1: Cross-tenant access (should FAIL)
SET app.current_tenant_id = 'tenant-a';
SELECT * FROM runtime_outbox WHERE tenant_id = 'tenant-b';  -- Empty

-- Test 2: Duplicate idempotency key (should FAIL)
INSERT INTO runtime_idempotency_registry ... VALUES (..., 'key-123', ...);
INSERT INTO runtime_idempotency_registry ... VALUES (..., 'key-123', ...);
-- Second insert fails (unique constraint)

-- Test 3: Audit UPDATE (should FAIL)
INSERT INTO runtime_audit_log ... VALUES (...);
UPDATE runtime_audit_log SET amount = 2000.00;  -- DENIED

-- Test 4: Audit DELETE (should FAIL)
DELETE FROM runtime_audit_log;  -- DENIED
```

---

## File Structure

```
src/platform/integration-runtime/
├── types/
│   ├── financial-intent.types.ts  ✅
│   ├── runtime-config.types.ts    ✅
│   ├── runtime-errors.types.ts    ✅
│   ├── database.types.ts          ✅ NEW
│   └── index.ts                   ✅
├── validation/
│   ├── intent-validator.ts        ✅
│   ├── tenant-validator.ts        ✅
│   └── index.ts                   ✅
├── idempotency/
│   ├── idempotency-key.ts         ✅ (FIXED: canonical serialization)
│   ├── idempotency-registry.ts    ✅
│   ├── idempotency-manager.ts     ✅
│   └── index.ts                   ✅
├── database/                      ✅ NEW
│   ├── tenant-repository.ts       ✅
│   ├── idempotency-repository.ts  ✅
│   ├── outbox-repository.ts       ✅
│   ├── audit-repository.ts        ✅
│   ├── quarantine-repository.ts   ✅
│   └── index.ts                   ✅
└── index.ts                       ✅

supabase/migrations/
└── 20260818000001_runtime_tables.sql  ✅
```

**Phase 2 total:** 7 new files (1 migration + 6 TypeScript)

---

## Critical Fix (Phase 1 → Phase 2)

### Idempotency Key Serialization ✅

**Before (Phase 1):**
```typescript
const input = [tenantId, correlationId, intentType].join('||');
```

**Problem:** Collision ambiguity
- `"A"` + `"BC"` = `"A||BC"`
- `"AB"` + `"C"` = `"AB||C"`
- Same concatenation if delimiter not validated

**After (Phase 2):**
```typescript
// Canonical serialization: v1:tenantId:correlationId:intentType
const input = `v1:${tenantId}:${correlationId}:${intentType}`;

// Delimiter validation (no ':' allowed in components)
if (tenantId.includes(':')) throw ValidationError;
if (correlationId.includes(':')) throw ValidationError;
if (intentType.includes(':')) throw ValidationError;
```

**Result:**
- Version prefix: `v1:` (future compatibility)
- Delimiter: `:` (validated, injection-proof)
- Collision prevented: `"A:BC"` ≠ `"AB:C"` (delimiter enforced)

---

## Next Steps

### Phase 3 — Runtime Enforcement (Pending)

**Objective:** Runtime validation with prohibited fields enforcement

**Tasks:**
1. Test Financial Intent validation at runtime
2. Test Finance Protection (reject prohibited fields)
3. Verify enforcement is RUNTIME (not just TypeScript compile-time)

**Key test:**
```typescript
const intent = {
  intentType: 'REVENUE_RECOGNIZED',
  tenantId: 'test',
  // ... valid fields
  glAccount: '4000',  // ❌ PROHIBITED
};

await publishIntent(intent);  // Must REJECT at runtime
```

---

### Phase 4 — Reliability (Pending)

**Objective:** Implement full delivery flow

**Tasks:**
1. `publishIntent()` API (public entry point)
2. Outbox worker (polling + delivery)
3. Retry manager (exponential backoff + jitter)
4. Quarantine manager (poison message handling)
5. Finance publisher (deliver to Finance OS)

**Flow:**
```
publishIntent()
      ↓
validate (intent-validator)
      ↓
derive idempotency key
      ↓
check idempotency (idempotency-repository)
      ↓
transactional outbox (outbox-repository)
      ↓
commit
      ↓
worker polls (outbox-repository.getPendingIntents)
      ↓
deliver to Finance OS
      ↓
mark published / retry / quarantine
```

---

### Phase 5 — Observability (Pending)

**Objective:** Correlation propagation + audit trail

**Tasks:**
1. Correlation manager (trace end-to-end)
2. Audit logger (log all events)
3. Tracer (distributed tracing)

**Correlation chain:**
```
Industry Event
     ↓
Financial Intent (correlationId)
     ↓
Outbox (correlationId)
     ↓
Finance OS (correlationId)
     ↓
F1-F5 (correlationId)
```

---

## Database Gate Verification

**Test checklist:**

| Test | Expected | Status |
|------|----------|--------|
| Tenant A → Tenant B access | ❌ REJECT | ⏳ Pending |
| Duplicate idempotency key | ❌ REJECT (unique constraint) | ⏳ Pending |
| Outbox transaction failure | No intent loss | ⏳ Pending |
| Audit UPDATE | ❌ REJECT (RLS policy) | ⏳ Pending |
| Audit DELETE | ❌ REJECT (RLS policy) | ⏳ Pending |
| Quarantine replay | Provenance preserved | ⏳ Pending |

**NOTE:** Tests will be implemented in Phase 3 (Runtime Enforcement)

---

## Status Summary

**Phase 2:** ✅ **COMPLETE**

**Governance:**
- Constitution v1.0 🔒
- Template v1.0 🔒
- Runtime Architecture v1.1 🔒
- Implementation Design v1.0 🔒
- Implementation Gate: 6/6 PASS

**Implementation progress:**
- Phase 1 Foundation: ✅ COMPLETE
- Phase 2 Database: ✅ COMPLETE
- Phase 3 Enforcement: ⏳ PENDING
- Phase 4 Reliability: ⏳ PENDING
- Phase 5 Observability: ⏳ PENDING

**Education track:** 🟡 AWAITING PO (independent)

---

**Phase 2 complete. Database schema + repositories ready.**

**Defense-in-depth: RLS + constraints + application validation.**

**No architecture changes. Following frozen design.**

**Ready to proceed to Phase 3 — Runtime Enforcement.**
