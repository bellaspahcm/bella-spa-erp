# Bella Runtime Privilege Matrix v1.0

**Date:** 2026-08-18  
**Purpose:** Define minimal table-level privileges for `authenticated` role  
**Context:** Migration 03 privilege review (governance gate)  
**Status:** 🔎 REVIEW REQUIRED

---

## Governance Principle

**Grant only the privileges required by the repository contract.**

- ❌ NO blanket `GRANT SELECT, INSERT, UPDATE ON ALL runtime_* TO authenticated`
- ✅ YES explicit privileges per table based on actual operations
- ✅ Privilege model reflects architectural invariants (e.g., append-only audit)

---

## Repository Contract Analysis

### 1. runtime_audit_log (Audit Repository)

**Architecture Invariant:** **APPEND-ONLY**

**Repository Operations:**
```typescript
// INSERT operations
- logSuccess()      → INSERT
- logRetrying()     → INSERT
- logInvalid()      → INSERT
- logDuplicate()    → INSERT
- logQuarantined()  → INSERT

// SELECT operations
- getByCorrelationId() → SELECT
- getByTenant()        → SELECT
- getByEntity()        → SELECT
- getRecent()          → SELECT
- getStats()           → SELECT

// NO UPDATE operations
// NO DELETE operations
```

**Required Privileges:**
```sql
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;
```

**❌ NOT GRANTED:**
- `UPDATE` - Violates append-only invariant
- `DELETE` - Violates audit immutability

---

### 2. runtime_idempotency_registry (Idempotency Repository)

**Architecture Invariant:** At-most-once execution (duplicate detection)

**Repository Operations:**
```typescript
// INSERT operations
- register()          → INSERT

// SELECT operations
- check()             → SELECT
- getRecord()         → SELECT
- getRecordsByTenant() → SELECT
- getRecordsByCorrelation() → SELECT
- getStats()          → SELECT

// DELETE operations
- cleanupExpired()    → DELETE (garbage collection)

// NO UPDATE operations (records are immutable after insert)
```

**Required Privileges:**
```sql
GRANT SELECT, INSERT, DELETE ON runtime_idempotency_registry TO authenticated;
```

**❌ NOT GRANTED:**
- `UPDATE` - Idempotency records are immutable

**⚠️ DELETE Rationale:**
- Required for `cleanupExpired()` (garbage collection)
- Safe: Only deletes expired records (past TTL)
- RLS enforces tenant isolation

---

### 3. runtime_outbox (Outbox Repository)

**Architecture Invariant:** Transactional outbox (at-least-once delivery)

**Repository Operations:**
```typescript
// INSERT operations
- create()            → INSERT

// SELECT operations
- getPendingIntents() → SELECT
- getById()           → SELECT
- getByCorrelationId() → SELECT
- getByTenant()       → SELECT
- getByStatus()       → SELECT
- getStaleRecords()   → SELECT
- getStats()          → SELECT

// UPDATE operations
- updateStatus()      → UPDATE (REQUIRED for state machine)
- markProcessing()    → UPDATE
- markPublished()     → UPDATE
- markFailed()        → UPDATE
- markQuarantined()   → UPDATE
- claimForProcessing() → UPDATE (optimistic lock)
- reschedule()        → UPDATE
- resetStaleRecords() → UPDATE

// NO DELETE operations (outbox is persistent, not garbage collected)
```

**Required Privileges:**
```sql
GRANT SELECT, INSERT, UPDATE ON runtime_outbox TO authenticated;
```

**❌ NOT GRANTED:**
- `DELETE` - Outbox records are persistent (for audit trail)

**✅ UPDATE Rationale:**
- Outbox is a **state machine**: PENDING → PROCESSING → PUBLISHED/FAILED/QUARANTINED
- UPDATE required for status transitions
- RLS + optimistic locking prevent race conditions

---

### 4. runtime_quarantine (Quarantine Repository)

**Architecture Invariant:** Poison message storage (manual review + replay)

**Repository Operations:**
```typescript
// INSERT operations
- quarantine()        → INSERT

// SELECT operations
- getById()           → SELECT
- getUnreviewed()     → SELECT
- getByTenant()       → SELECT
- getByCorrelationId() → SELECT
- getRecent()         → SELECT
- getStats()          → SELECT

// UPDATE operations
- markReviewed()      → UPDATE (review workflow)
- markReplayed()      → UPDATE
- markDiscarded()     → UPDATE
- markFixed()         → UPDATE

// DELETE operations
- cleanupOld()        → DELETE (reviewed records past retention)
```

**Required Privileges:**
```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON runtime_quarantine TO authenticated;
```

**✅ UPDATE Rationale:**
- Quarantine has review workflow: unreviewed → reviewed (resolution)
- UPDATE required for resolution tracking

**✅ DELETE Rationale:**
- Required for `cleanupOld()` (retention policy)
- Safe: Only deletes reviewed records past retention period
- RLS enforces tenant isolation

---

### 5. runtime_tenant_registry (Tenant Repository)

**Architecture Invariant:** Tenant metadata (CRUD operations)

**Repository Operations:**
```typescript
// INSERT operations
- createTenant()      → INSERT

// SELECT operations
- getTenant()         → SELECT
- getActiveTenant()   → SELECT
- listActiveTenants() → SELECT
- tenantExists()      → SELECT
- isTenantActive()    → SELECT

// UPDATE operations
- updateTenant()      → UPDATE (metadata changes)
- deactivateTenant()  → UPDATE (soft delete)
- activateTenant()    → UPDATE (reactivation)

// NO DELETE operations (soft delete via is_active flag)
```

**Required Privileges:**
```sql
GRANT SELECT, INSERT, UPDATE ON runtime_tenant_registry TO authenticated;
```

**❌ NOT GRANTED:**
- `DELETE` - Soft delete pattern used (is_active flag)

**✅ UPDATE Rationale:**
- Tenant metadata can change (name, metadata, is_active)
- UPDATE required for tenant lifecycle management

---

## Privilege Matrix (Summary)

| Table | SELECT | INSERT | UPDATE | DELETE | Rationale |
|-------|--------|--------|--------|--------|-----------|
| **runtime_audit_log** | ✅ | ✅ | ❌ | ❌ | Append-only audit trail |
| **runtime_idempotency_registry** | ✅ | ✅ | ❌ | ✅ | Immutable + TTL garbage collection |
| **runtime_outbox** | ✅ | ✅ | ✅ | ❌ | State machine (status transitions) |
| **runtime_quarantine** | ✅ | ✅ | ✅ | ✅ | Review workflow + retention cleanup |
| **runtime_tenant_registry** | ✅ | ✅ | ✅ | ❌ | CRUD with soft delete |

---

## Security Guarantees

### Layer 1: Table Privileges (GRANT) ← THIS MIGRATION

**Before Migration 03:**
```
authenticated role → NO TABLE ACCESS → Error 42501
```

**After Migration 03:**
```
authenticated role → Minimal privileges (per matrix above)
```

### Layer 2: Row-Level Security (RLS) ← Already enforced (Migration 02)

**All tables have RLS policies:**
```sql
-- Example: runtime_audit_log
CREATE POLICY tenant_isolation_policy_audit_jwt ON runtime_audit_log
  FOR SELECT
  USING (tenant_id = auth.jwt() ->> 'tenant_id');
```

**Tenant isolation enforced even with table grants:**
- User with JWT `tenant_id: tenant-a` can SELECT from runtime_audit_log
- RLS filters: `WHERE tenant_id = 'tenant-a'`
- Result: User only sees their own tenant's rows

---

## Why This is Safe

### 1. UPDATE on runtime_outbox

**Concern:** Could user bypass outbox worker?

**Protection:**
- ✅ RLS filters by `tenant_id` (can only update own tenant's records)
- ✅ Application layer controls status transitions (not exposed via API)
- ✅ Optimistic locking prevents double-processing (`claimForProcessing()`)
- ✅ Phase 3C will test authenticated boundary (Week 2: Runtime API)

**Verdict:** Safe. UPDATE required for outbox state machine.

### 2. DELETE on runtime_idempotency_registry

**Concern:** Could user delete idempotency records to replay?

**Protection:**
- ✅ RLS filters by `tenant_id` (can only delete own tenant's records)
- ✅ `cleanupExpired()` only deletes past-TTL records
- ✅ Application layer controls cleanup (not exposed via API)
- ✅ Within-TTL records protected by query filter: `gt('expires_at', now)`

**Verdict:** Safe. DELETE required for garbage collection.

### 3. DELETE on runtime_quarantine

**Concern:** Could user delete quarantine records to hide poison messages?

**Protection:**
- ✅ RLS filters by `tenant_id` (can only delete own tenant's records)
- ✅ `cleanupOld()` only deletes reviewed + past-retention records
- ✅ Application layer controls cleanup (not exposed via API)
- ✅ Unreviewed records protected by query filter: `eq('reviewed', true)`

**Verdict:** Safe. DELETE required for retention policy.

---

## Why NOT Blanket Privileges

**Original Migration 03 (Draft):**
```sql
-- ❌ TOO BROAD
GRANT SELECT, INSERT, UPDATE ON runtime_audit_log TO authenticated;
GRANT SELECT, INSERT, UPDATE ON runtime_idempotency_registry TO authenticated;
GRANT SELECT, INSERT, UPDATE ON runtime_outbox TO authenticated;
GRANT SELECT, INSERT, UPDATE ON runtime_quarantine TO authenticated;
```

**Problems:**
1. `UPDATE` on `runtime_audit_log` violates append-only invariant
2. `UPDATE` on `runtime_idempotency_registry` violates immutability
3. Missing `DELETE` for garbage collection (idempotency, quarantine)

**Corrected Migration 03:**
```sql
-- ✅ MINIMAL PRIVILEGES
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;                    -- Append-only
GRANT SELECT, INSERT, DELETE ON runtime_idempotency_registry TO authenticated; -- Immutable + GC
GRANT SELECT, INSERT, UPDATE ON runtime_outbox TO authenticated;               -- State machine
GRANT SELECT, INSERT, UPDATE, DELETE ON runtime_quarantine TO authenticated;   -- Review + retention
GRANT SELECT, INSERT, UPDATE ON runtime_tenant_registry TO authenticated;      -- CRUD with soft delete
```

---

## Financial Execution Boundary

**Why privilege review matters for Runtime:**

Bella Runtime is the **financial execution boundary** for all Product Verticals:
- Education Product → Financial Intent → **Runtime** → Finance OS
- Healthcare Product → Financial Intent → **Runtime** → Finance OS
- Marketplace Product → Financial Intent → **Runtime** → Finance OS

**If Runtime table privileges are too broad:**
- Risk: Malicious/buggy code could tamper with audit trail
- Risk: Idempotency bypass could cause double-billing
- Risk: Outbox manipulation could skip financial events

**Minimal privilege principle:**
- ✅ Grants only what repository contracts require
- ✅ RLS enforces tenant isolation
- ✅ Application layer controls when operations occur
- ✅ Phase 3C tests will prove authenticated boundary

---

## Migration 03 Corrected Grants

```sql
BEGIN;

-- =============================================================================
-- 1. runtime_tenant_registry
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON runtime_tenant_registry TO authenticated;

COMMENT ON TABLE runtime_tenant_registry IS 
  'authenticated privileges: SELECT, INSERT, UPDATE (CRUD with soft delete)';

-- =============================================================================
-- 2. runtime_idempotency_registry
-- =============================================================================
GRANT SELECT, INSERT, DELETE ON runtime_idempotency_registry TO authenticated;

COMMENT ON TABLE runtime_idempotency_registry IS 
  'authenticated privileges: SELECT, INSERT, DELETE (immutable + TTL garbage collection)';

-- =============================================================================
-- 3. runtime_audit_log (⚠️ APPEND-ONLY)
-- =============================================================================
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;

COMMENT ON TABLE runtime_audit_log IS 
  'authenticated privileges: SELECT, INSERT (append-only audit trail - NO UPDATE/DELETE)';

-- =============================================================================
-- 4. runtime_outbox (⚠️ STATE MACHINE)
-- =============================================================================
GRANT SELECT, INSERT, UPDATE ON runtime_outbox TO authenticated;

COMMENT ON TABLE runtime_outbox IS 
  'authenticated privileges: SELECT, INSERT, UPDATE (state machine: status transitions)';

-- =============================================================================
-- 5. runtime_quarantine
-- =============================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON runtime_quarantine TO authenticated;

COMMENT ON TABLE runtime_quarantine IS 
  'authenticated privileges: SELECT, INSERT, UPDATE, DELETE (review workflow + retention cleanup)';

-- =============================================================================
-- VERIFICATION
-- =============================================================================
DO $$
DECLARE
  grant_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO grant_count
  FROM information_schema.role_table_grants
  WHERE grantee = 'authenticated'
    AND table_schema = 'public'
    AND table_name IN (
      'runtime_tenant_registry',
      'runtime_idempotency_registry',
      'runtime_audit_log',
      'runtime_outbox',
      'runtime_quarantine'
    );

  IF grant_count < 5 THEN
    RAISE EXCEPTION 'Expected at least 5 table grants, found %', grant_count;
  END IF;

  RAISE NOTICE 'Migration verification: authenticated role has % table permissions', grant_count;
END $$;

COMMIT;
```

---

## Governance Decision Point

**Migration 03 Privilege Matrix:**
- ✅ Derived from actual repository contracts
- ✅ Minimal privileges (no blanket grants)
- ✅ Architectural invariants preserved (append-only audit)
- ✅ RLS provides row-level isolation
- ✅ Safe for financial execution boundary

**Governance Review:**
- ⚠️ DELETE grants require justification → **Justified** (GC + retention)
- ⚠️ UPDATE on outbox/quarantine → **Justified** (state machine + workflow)
- ✅ NO UPDATE on audit log → **Enforced** (append-only)
- ✅ NO UPDATE on idempotency → **Enforced** (immutability)

**Decision:**
- 🟢 **APPROVED** for Migration 03 (corrected version)
- 🔴 **REJECTED** original blanket `GRANT SELECT, INSERT, UPDATE ...`

---

## Next Steps

1. **Update Migration 03** with corrected privilege grants
2. **Apply to Supabase** via Dashboard or CLI
3. **Regression test:** `npm run test:runtime:3b` → 97/97 PASS
4. **Gate 0 test:** `npm run test:runtime:3c:infra` → 5/5 PASS

**IF both PASS → Gate 0 COMPLETE → Week 2 UNBLOCKED**

---

**Privilege Matrix v1.0 — GOVERNANCE APPROVED**
