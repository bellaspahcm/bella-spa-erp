# Migration Reproducibility Status - Bella Land

**Date:** 2026-09-11  
**Severity:** 🟡 MEDIUM (Deployment Risk)  
**Status:** ⚠️  PARTIALLY VERIFIED (Docker unavailable)

---

## 🎯 Goal

**Verify clean environment can build canonical schema from migrations:**
```text
Goal: Fresh DB + Migration history → Canonical schema

Test Method:
1. Reset local DB (clean slate)
2. Apply all migrations
3. Inspect final schema
4. Compare with deployed schema
5. Verify invariants exist

Expected: Schema matches, no migration failures
```

---

## ⚠️  Test Execution Blocked

### Environment Constraint

**Docker not available:**
```text
Command: npx supabase db reset
Error: failed to connect to docker API

Cannot run local Supabase instance without Docker
Cannot execute full reproducibility test
```

**Alternative approach taken:**
```text
✅ Inspect migration files (exist, order, content)
✅ Verify critical migrations created
✅ Document live schema state
⏸️  Full clean-build verification: DEFERRED
```

---

## ✅ Migration Files Verified

### Critical Migrations Created

**1. Schema Reconciliation:**
```text
File: 20260911000000_reconcile_reservations_schema.sql
Status: ✅ EXISTS
Purpose: Forward migration for Phase 2B patches

Patches included:
- Status enum conversion (reservation_status)
- ADD deposit_amount
- ADD notes  
- user_id NULLABLE
- customer_id NOT NULL
- expires_at NULLABLE
- FK fix (customer_id → re_customers)
- Timestamp columns (reserved_at, deposited_at, etc.)
- metadata column
```

**2. Concurrency Protection:**
```text
File: 20260911010000_add_reservation_concurrency_protection.sql
Status: ✅ EXISTS
Purpose: Prevent double-booking (unique index)

Index: idx_one_active_reservation_per_apartment
Type: PARTIAL UNIQUE INDEX
Columns: (product_id, tenant_id)
WHERE: status IN ('pending_deposit', 'deposited')

Evidence: scripts/bella-land/test-reservation-concurrency.ts (PASS)
```

---

## 🔍 Live Schema State

### re_reservations Columns (Deployed)

**Core fields:**
```text
✅ id                UUID
✅ tenant_id         UUID (NOT NULL)
✅ customer_id       UUID (NOT NULL) ← Phase 2B patch
✅ product_id        UUID (NOT NULL)
✅ user_id           UUID (NULLABLE) ← Phase 2B patch
✅ status            reservation_status (NOT NULL) ← Phase 2B patch
✅ expires_at        TIMESTAMPTZ (NULLABLE) ← Phase 2B patch
```

**Added fields (Phase 2B documented):**
```text
✅ deposit_amount    NUMERIC(15,2) (NULLABLE)
✅ notes             TEXT (NULLABLE)
```

**Added fields (NOT documented in Phase 2B):**
```text
❓ metadata          JSONB (NULLABLE)
❓ reserved_at       TIMESTAMPTZ (NULLABLE)
❓ deposited_at      TIMESTAMPTZ (NULLABLE)
❓ converted_at      TIMESTAMPTZ (NULLABLE)
❓ cancelled_at      TIMESTAMPTZ (NULLABLE)
```

**Audit fields:**
```text
✅ created_at        TIMESTAMPTZ
✅ updated_at        TIMESTAMPTZ
✅ created_by        UUID (NULLABLE)
✅ updated_by        UUID (NULLABLE)
✅ deleted_at        TIMESTAMPTZ (NULLABLE)
```

### Finding: Additional Columns Exist

**Observation:**
Live DB has `metadata`, `reserved_at`, `deposited_at`, `converted_at`, `cancelled_at` that were NOT documented in Phase 2B CLI patches.

**Possible causes:**
1. Migration `20260911000000` was applied to live DB before Phase 2B documentation
2. Additional manual patches applied but not documented
3. Earlier migration already created these columns

**Impact:**
```text
✅ NO BLOCKER: Extra columns are ADDITIVE (don't break existing code)
⚠️  DOCUMENTATION GAP: Phase 2B patches incomplete
📋 VERIFY: Are these columns used by service?
```

---

## 📋 Migration File Audit

### Migration Order

**Last 10 migrations:**
```text
20260909000057_p62_projection_bridges.sql
20260909000058_p71_preschool_finance.sql
20260909000059_p73_finance_rls_grant.sql
20260909000060_p8_staff_scheduling_schema.sql
20260909000061_p82_nullable_exception_notice_id.sql
20260909000062_p9_facilities_asset_schema.sql
20260909000063_p92_nullable_exception_guardian_id.sql
20260909000064_p93_facilities_rls_grant.sql
20260911000000_reconcile_reservations_schema.sql ← Reservations
20260911010000_add_reservation_concurrency_protection.sql ← Concurrency
```

**Status:** ✅ Migration files exist in correct order

---

### Migration Content Verification

**20260911000000 (Reconciliation):**
```sql
✅ CREATE TYPE reservation_status (with verification)
✅ Status column conversion (re_reservation_status → reservation_status)
✅ ADD deposit_amount
✅ ADD notes
✅ ADD metadata
✅ ADD reserved_at, deposited_at, converted_at, cancelled_at
✅ user_id DROP NOT NULL
✅ customer_id SET NOT NULL
✅ expires_at DROP NOT NULL
✅ FK fix (customer_id → re_customers)
✅ Verification block (checks enum, columns)
```

**20260911010000 (Concurrency):**
```sql
✅ CREATE UNIQUE INDEX idx_one_active_reservation_per_apartment
✅ Partial index WHERE status IN ('pending_deposit', 'deposited')
✅ Documentation (rationale, examples)
```

**Status:** ✅ Migration content matches requirements

---

## 🔒 Invariant Coverage

### Critical Invariants in Migrations

**1. Enum Correctness:**
```sql
Status: reservation_status enum
Values: pending_deposit, deposited, converted_to_contract, cancelled

Migration: ✅ CREATE TYPE with verification
Evidence: Field semantics test PASS (status = pending_deposit persisted)
```

**2. Data Integrity:**
```sql
customer_id: NOT NULL
deposit_amount: EXISTS (DEFAULT 0)
notes: EXISTS

Migration: ✅ ALTER COLUMN customer_id SET NOT NULL
Evidence: Field semantics test PASS (customer_id NOT NULL enforced)
```

**3. Concurrency Protection:**
```sql
Index: idx_one_active_reservation_per_apartment
Type: UNIQUE (product_id, tenant_id) WHERE status IN (...)

Migration: ✅ CREATE UNIQUE INDEX
Evidence: Concurrency test PASS (2nd reservation blocked)
```

**Status:** ✅ All critical invariants covered in migrations

---

## 🎯 Reproducibility Assessment

### What Was Verified ✅

**Migration files exist:**
- Schema reconciliation migration created
- Concurrency protection migration created
- Files in correct chronological order

**Migration content correct:**
- All 7 Phase 2B patches included
- Enum conversion with mapping
- Concurrency index with partial WHERE clause
- Verification blocks included

**Invariants covered:**
- reservation_status enum creation
- customer_id NOT NULL constraint
- deposit_amount, notes columns
- Concurrency unique index

**Live schema matches:**
- All expected columns exist
- Enum type correct
- Constraints enforced (verified via runtime tests)
- Concurrency index exists (verified via test)

### What Was NOT Verified ⏸️

**Clean-build reproducibility:**
```text
❌ NOT TESTED: Fresh DB + migrations → canonical schema
Reason: Docker unavailable (Windows environment)
Risk: Migration chain may fail on clean environment

Recommendation: Verify on staging/CI with Docker
```

**Migration idempotency:**
```text
❌ NOT TESTED: Re-running migrations (IF NOT EXISTS safety)
Reason: Cannot reset local DB
Risk: Migrations may fail if applied twice

Observation: Migrations use IF NOT EXISTS (defensive)
```

**Migration ordering:**
```text
⚠️  PARTIAL: Files in correct order (timestamp-based)
❌ NOT TESTED: Dependencies between migrations
Reason: Cannot apply incrementally

Recommendation: Test on clean environment
```

**Extra columns usage:**
```text
❓ metadata, reserved_at, deposited_at, converted_at, cancelled_at
Live DB has these columns (NOT in Phase 2B docs)

Questions:
- Are these used by service code?
- When were they added?
- Should they be in canonical contract?

Recommendation: Audit service code for usage
```

---

## 🚦 RC Status

### Current State

```text
Migration Files
├─ Reconciliation   ✅ EXISTS (20260911000000)
├─ Concurrency      ✅ EXISTS (20260911010000)
├─ Content correct  ✅ VERIFIED (manual inspection)
└─ Order correct    ✅ VERIFIED (timestamp sequence)

Live Schema
├─ Enum correct     ✅ VERIFIED (runtime test)
├─ Constraints      ✅ VERIFIED (runtime test)
├─ Columns exist    ✅ VERIFIED (SQL query)
└─ Index exists     ✅ VERIFIED (concurrency test)

Clean Build
└─ Reproducibility  ⏸️  NOT TESTED (Docker unavailable)
```

### Risk Assessment

**🟢 LOW RISK:**
- Migration files exist and content matches requirements
- Live schema has all expected columns and constraints
- Runtime tests verify invariants working
- Defensive SQL (IF NOT EXISTS, idempotent)

**🟡 MEDIUM RISK:**
- Cannot verify clean-build reproducibility
- Extra columns in live DB not documented
- Migration chain not tested end-to-end

**🔴 HIGH RISK (NOT PRESENT):**
- No missing critical migrations
- No known migration failures
- No schema drift in critical fields

### Recommendation

```text
FOR RC:
🟡 ACCEPTED RISK - Migrations exist, content verified, runtime working
                   BUT clean-build reproducibility NOT PROVEN

KNOWN DEPLOYMENT DEBT:
- Clean-build migration reproducibility not yet verified
- Extra columns (metadata, *_at) exist but not fully documented
- Live state not 100% traceable from phase logs

POST-RC:
🔴 REQUIRED - Verify clean-build on staging with Docker
📋 AUDIT - Document extra columns (metadata, *_at timestamps)
🔍 TEST - Full migration chain on fresh environment
🔍 TRACE - Reconcile live schema with migration history
```

---

## 📊 Summary

```text
MIGRATION REPRODUCIBILITY

Migration Files:
✅ Reconciliation migration exists (20260911000000)
✅ Concurrency migration exists (20260911010000)
✅ Content matches Phase 2B patches
✅ Chronological order correct

Live Schema:
✅ All expected columns exist
✅ Enum type correct (reservation_status)
✅ Constraints enforced (customer_id NOT NULL)
✅ Concurrency index exists

Clean Build:
⏸️  NOT TESTED (Docker unavailable)
⚠️  VERIFICATION DEFERRED to staging/CI

Status: ⚠️  PARTIALLY VERIFIED
RC Assessment: 🟡 ACCEPTED RISK (not fully reproducible, but artifacts exist)
```

---

## 📋 Post-RC Actions

### Required (High Priority)

1. **Clean-build verification:**
   - Setup Docker environment (staging/CI)
   - Run: `npx supabase db reset`
   - Verify: No migration failures
   - Inspect: Final schema matches canonical

2. **Migration idempotency test:**
   - Apply migrations twice
   - Verify: No failures, schema unchanged
   - Confirm: IF NOT EXISTS clauses working

3. **Extra columns audit:**
   - Search codebase for: `metadata`, `reserved_at`, `deposited_at`, `converted_at`, `cancelled_at`
   - Document: Which are used vs unused
   - Decide: Keep vs cleanup

### Recommended (Medium Priority)

4. **Migration ordering test:**
   - Apply migrations incrementally
   - Verify: Each migration succeeds independently
   - Check: Dependencies resolved correctly

5. **Rollback testing:**
   - Create down migrations if needed
   - Test: Rollback to previous versions
   - Verify: Data preserved

### Optional (Low Priority)

6. **Migration performance:**
   - Test on production-sized dataset
   - Measure: Downtime during deployment
   - Optimize: If needed

---

## 🏭 Factory Incident Evidence

### Pattern Identified

**Migration file ≠ Deployed schema:**

```text
❌ INSUFFICIENT:
Create migration file
→ assume deployed

✅ REQUIRED:
Create migration file
→ apply to environment
→ verify schema matches
→ test invariants runtime
```

**Verification gap:**
```text
Migration content correct (file exists)
≠ Migration applied correctly (schema matches)
≠ Migration reproducible (clean build works)
```

**Evidence trail gap:**
```text
Phase 2B: CLI patches documented
Live DB: Extra columns exist (metadata, *_at)

Gap: Patches applied but not documented
OR: Earlier migration applied but not tracked
```

### Candidate Factory Rule

> "Schema migrations MUST be verified on clean environment before RC. Migration files existing ≠ reproducibility proven."

**Enforcement:**
1. Pre-RC gate: Require clean-build test (CI/Docker)
2. Evidence: Migration log + schema inspection + test results
3. Fallback: Manual verification + post-RC cleanup if blocked

**This incident provides evidence for:**
- Migration reproducibility verification methodology
- Clean-build testing requirement
- Documentation completeness (track ALL schema changes)

**Recommendation:** Track as post-RC Factory governance evidence (NOT gate immediately)

---

## ✅ Verification Checklist

Migration reproducibility (partial):

- [x] Migration files exist
- [x] Reconciliation migration content verified
- [x] Concurrency migration content verified
- [x] Migration order correct (timestamps)
- [x] Live schema inspected
- [x] Critical columns exist
- [x] Enum type correct
- [x] Concurrency index exists
- [ ] Clean-build test executed (BLOCKED: Docker unavailable)
- [ ] Migration chain tested end-to-end
- [ ] Extra columns documented

**Current:** 8/11 complete

**Status:** ⚠️  PARTIALLY VERIFIED (acceptable for RC with post-RC follow-up)

---

**Verification Quality:** ⚠️  Partial (file inspection + runtime validation, no clean-build)

**Deployment Risk:** 🟡 MEDIUM (migrations exist, but clean-build not proven)

**RC Assessment:** 🟡 ACCEPTED RISK (deployment path has artifacts, but reproducibility not proven)
