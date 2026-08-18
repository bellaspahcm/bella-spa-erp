# Bella Runtime Gate 0 — Privilege Review

**Date:** 2026-08-18  
**Status:** ✅ GOVERNANCE APPROVED  
**Migration:** 20260818000003_runtime_authenticated_grants.sql (CORRECTED)  
**Review Document:** BELLA_RUNTIME_PRIVILEGE_MATRIX_V1.md

---

## Governance Gate

**Before applying Migration 03, privilege grants were reviewed against:**
1. Actual repository contracts (not assumed operations)
2. Architectural invariants (append-only audit, immutability)
3. Minimal privilege principle (no blanket grants)
4. Financial execution boundary security

---

## Review Findings

### ❌ Original Migration 03 (Draft)

**Problems identified:**
```sql
-- ❌ Missing UPDATE for runtime_tenant_registry (CRUD requires it)
GRANT SELECT ON runtime_tenant_registry TO authenticated;

-- ❌ Unnecessary UPDATE for runtime_idempotency_registry (immutable records)
GRANT SELECT, INSERT, UPDATE ON runtime_idempotency_registry TO authenticated;

-- ✅ Correct (append-only)
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;

-- ✅ Correct (state machine)
GRANT SELECT, INSERT, UPDATE ON runtime_outbox TO authenticated;

-- ❌ Missing DELETE for runtime_quarantine (retention cleanup)
GRANT SELECT, INSERT, UPDATE ON runtime_quarantine TO authenticated;
```

**Governance decision:** ❌ REJECTED — Insufficient privilege analysis

---

## ✅ Corrected Migration 03

**Privilege matrix derived from repository contracts:**

| Table | Privileges | Justification |
|-------|------------|---------------|
| runtime_audit_log | SELECT, INSERT | **Append-only** audit trail (no UPDATE/DELETE) |
| runtime_idempotency_registry | SELECT, INSERT, DELETE | Immutable records + TTL garbage collection |
| runtime_outbox | SELECT, INSERT, UPDATE | State machine (PENDING → PROCESSING → PUBLISHED) |
| runtime_quarantine | SELECT, INSERT, UPDATE, DELETE | Review workflow + retention cleanup |
| runtime_tenant_registry | SELECT, INSERT, UPDATE | CRUD with soft delete (is_active flag) |

**Key corrections:**
1. ✅ Added UPDATE to `runtime_tenant_registry` (required for `updateTenant()`, `deactivateTenant()`)
2. ✅ Removed UPDATE from `runtime_idempotency_registry` (records immutable after insert)
3. ✅ Added DELETE to `runtime_idempotency_registry` (required for `cleanupExpired()`)
4. ✅ Added DELETE to `runtime_quarantine` (required for `cleanupOld()`)
5. ✅ Preserved NO UPDATE on `runtime_audit_log` (append-only invariant)

---

## Security Review

### UPDATE on runtime_outbox

**Question:** Could authenticated user bypass outbox worker?

**Analysis:**
- Repository contract requires UPDATE for status transitions (state machine)
- RLS enforces `tenant_id` filtering (can only update own tenant)
- Optimistic locking prevents double-processing (`claimForProcessing()`)
- Application layer controls when updates occur (not directly exposed)

**Verdict:** ✅ SAFE — UPDATE required for outbox pattern

### DELETE on runtime_idempotency_registry

**Question:** Could authenticated user delete idempotency records to replay intents?

**Analysis:**
- Repository contract requires DELETE for `cleanupExpired()` (garbage collection)
- DELETE only targets expired records: `lt('expires_at', now)`
- RLS enforces `tenant_id` filtering (can only delete own tenant)
- Within-TTL records protected by application logic

**Verdict:** ✅ SAFE — DELETE required for TTL enforcement

### DELETE on runtime_quarantine

**Question:** Could authenticated user delete poison messages to hide failures?

**Analysis:**
- Repository contract requires DELETE for `cleanupOld()` (retention policy)
- DELETE only targets reviewed + past-retention records
- RLS enforces `tenant_id` filtering
- Unreviewed records protected by query filter: `eq('reviewed', true)`

**Verdict:** ✅ SAFE — DELETE required for retention management

### NO UPDATE on runtime_audit_log

**Question:** Why not grant UPDATE for audit log?

**Analysis:**
- Architecture invariant: Audit log is **append-only**
- No repository method performs UPDATE on audit_log
- UPDATE would violate immutability guarantee
- Enforced at both privilege level (no GRANT) and RLS level (no policy)

**Verdict:** ✅ ENFORCED — NO UPDATE preserves audit integrity

---

## Financial Execution Boundary

**Why this matters:**

Bella Runtime is the financial execution boundary:
```
Product Vertical → Financial Intent → Runtime → Finance OS
```

**If privilege grants are too broad:**
- ❌ Audit tampering: Could hide financial events
- ❌ Idempotency bypass: Could cause double-billing
- ❌ Outbox manipulation: Could skip payment processing

**With minimal privileges:**
- ✅ Audit immutable: No UPDATE/DELETE on runtime_audit_log
- ✅ Idempotency enforced: No UPDATE on idempotency_registry
- ✅ State machine controlled: UPDATE on outbox limited by application layer
- ✅ Tenant isolation: RLS filters all operations by tenant_id

---

## Privilege Derivation Process

**Step 1:** Read all repository implementations
```
audit-repository.ts
idempotency-repository.ts
outbox-repository.ts
quarantine-repository.ts
tenant-repository.ts
```

**Step 2:** Map every database operation
```typescript
// Example: AuditRepository
logSuccess()    → INSERT
getByTenant()   → SELECT
// NO UPDATE methods
// NO DELETE methods
```

**Step 3:** Derive minimal privileges
```sql
-- Audit: Only INSERT + SELECT needed
GRANT SELECT, INSERT ON runtime_audit_log TO authenticated;
```

**Step 4:** Validate against invariants
```
✅ Append-only audit → NO UPDATE/DELETE
✅ Immutable idempotency → NO UPDATE
✅ State machine outbox → UPDATE required
```

---

## Governance Decision

**Migration 03 (Corrected Version):**
- ✅ Derived from actual repository contracts
- ✅ Minimal privileges (no blanket grants)
- ✅ Architectural invariants enforced
- ✅ Security analysis complete
- ✅ Financial boundary protected

**Status:** 🟢 **APPROVED FOR APPLICATION**

---

## Next Steps

1. **Apply Migration 03** (corrected version) to Supabase
2. **Regression test:** `npm run test:runtime:3b` → Expected: 97/97 PASS
3. **Gate 0 test:** `npm run test:runtime:3c:infra` → Expected: 5/5 PASS
4. **Governance decision:**
   - IF both PASS → 🔓 Gate 0 COMPLETE → Week 2 UNBLOCKED
   - ELSE → Document evidence, diagnose root cause

---

## Files Created

1. ✅ `docs/testing/BELLA_RUNTIME_PRIVILEGE_MATRIX_V1.md` (Analysis)
2. ✅ `supabase/migrations/20260818000003_runtime_authenticated_grants.sql` (Corrected)
3. ✅ `docs/testing/BELLA_RUNTIME_MIGRATION_03_APPLY.md` (Updated)
4. ✅ `docs/testing/BELLA_RUNTIME_GATE_0_PRIVILEGE_REVIEW.md` (This document)

---

**Privilege Review: COMPLETE**  
**Governance: APPROVED**  
**Migration 03: READY FOR APPLICATION**
