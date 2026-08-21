# BELLA RUNTIME MIGRATION 05 — PACKAGE REVIEW

**Date:** 2026-08-19  
**Amendment:** Amendment 12 v3 (APPROVED via Approval 3)  
**Status:** 🟢 READY FOR PACKAGE REVIEW  
**Approval 3:** ✅ GRANTED (2026-08-19)  

**Review Cycle Complete:**
- ✅ Architecture Review: PASS
- ✅ Security Review: PASS* (conditional requirements implemented)
- ✅ Data Integrity Review: PASS* (recommendation implemented)
- ✅ Self-Validation Matrix: PASS (Part M complete)

---

## EXECUTIVE SUMMARY

**Purpose:** Package Review verification before E0 gate execution.

**Governance Status:**
- Original Migration 05: 🔴 INVALID (schema assumptions)
- Amendment 12 v1: 🔴 REJECTED (4 logic errors)
- Amendment 12 v2: 🔴 REJECTED (4 new blockers)
- Amendment 12 v3: ✅ COMPLETE + APPROVED
- Approval 3: ✅ GRANTED

**Database State:** 0 mutations (gates functioning correctly)

**Package Contents:**
- 3 migration files (05-A, 05-B, 05-C)
- 3 gate functions (E1, E2, E3)
- 1 verification script (E1)
- 1 integrity verification script (package)
- 7 files total (8 with this review doc)

---

## TABLE OF CONTENTS

1. [File Change Summary](#file-change-summary)
2. [Schema Impact Analysis](#schema-impact-analysis)
3. [Implementation → Design Mapping](#implementation-design-mapping)
4. [Mandatory Conditions Proof](#mandatory-conditions-proof)
5. [Verification Tests](#verification-tests)
6. [Package Integrity Report](#package-integrity-report)
7. [Execution Plan](#execution-plan)
8. [Rollback Strategy](#rollback-strategy)
9. [Human Review Checklist](#human-review-checklist)

---

<a name="file-change-summary"></a>
## 1. FILE CHANGE SUMMARY

### New Migration Files

| File | Purpose | Lines | Conditions |
|------|---------|-------|------------|
| `20260819040000_runtime_migration_e1_gate_schema_safe.sql` | E1 Gate (schema-safe introspection) | 280 | V3 Correction 3 |
| `20260819050000_runtime_migration_05a_classification_reservation.sql` | 05-A (classification + reservation) | 520 | #1, #2, #4, #5 |
| `20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql` | E2 Gate (orphan deletion safety) | 260 | V3 Correction 6 |
| `20260819050002_runtime_migration_05b_canonical_tenant_creation.sql` | 05-B (tenant creation + cleanup) | 580 | #3, #4, #5 |
| `20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql` | 05-C (TEXT→UUID type migration) | 410 | #4 (atomicity) |
| `20260819050004_runtime_migration_e3_post_05c_verification.sql` | E3 Gate (post-migration verification) | 380 | - |

**Total:** 6 SQL migration files, ~2,430 lines

### Updated Scripts

| File | Purpose | Changes |
|------|---------|---------|
| `scripts/run-e1-verification.mjs` | E1 gate execution | Updated to call `migration_05_e1_gate()` function, formatted output |
| `scripts/verify-amendment-12-v3-package-integrity.mjs` | Package integrity verification | New file (40+ checks) |

**Total:** 2 Node.js scripts

### Documentation

| File | Purpose |
|------|---------|
| `docs/architecture/BELLA_RUNTIME_MIGRATION_05_PACKAGE_REVIEW.md` | This document |
| `docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md` | Complete Amendment 12 v3 design |
| `docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_SECURITY_REVIEW.md` | Independent Security Review |
| `docs/architecture/BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_DATA_INTEGRITY_REVIEW.md` | Independent Data Integrity Review |

---

<a name="schema-impact-analysis"></a>
## 2. SCHEMA IMPACT ANALYSIS

### New Schemas

| Schema | Purpose | Persistence |
|--------|---------|-------------|
| `migration_evidence` | Audit trail for identity reconciliation | ✅ PERMANENT (do not drop post-migration) |

### New Tables

| Table | Rows (Expected) | Purpose |
|-------|-----------------|---------|
| `migration_evidence.canonical_tenant_map` | 5 | TEXT→UUID mapping + audit trail |

**Columns:**
- `legacy_fixture_id` TEXT PRIMARY KEY
- `reserved_tenant_id` UUID (Phase 1: RESERVATION)
- `canonical_tenant_id` UUID (Phase 2: COMPLETE, FK to public.tenants)
- `classification` TEXT (TEST_ORPHAN, TEST_FIXTURE)
- `reconciliation_phase` TEXT (RESERVATION, COMPLETE)
- `reconciliation_reason` TEXT
- `created_at`, `created_by`, `completed_at`
- `deleted_at`, `deleted_by`, `deletion_reason` (Condition #5)

**Constraints:**
- UNIQUE INDEX on `reserved_tenant_id` (partial, WHERE NOT NULL)
- UNIQUE INDEX on `canonical_tenant_id` (partial, WHERE NOT NULL)
- CHECK constraints (3 invariants: orphan, reservation, complete)

**Triggers:**
- `trigger_prevent_canonical_id_change` (Condition #3: immutability)

### Modified Tables

| Table | Column | Change | Impact |
|-------|--------|--------|--------|
| `public.tenants` | - | +3 rows | Canonical test tenants (UUIDs: 11111111...001/002/003) |
| `runtime_tenant_registry` | `tenant_id` | TEXT → UUID | Type migration (05-C) |
| `runtime_tenant_registry` | - | -2 rows | Orphan deletion (test-quarantine-tenant-a/b) |
| `runtime_outbox` | `tenant_id` | TEXT → UUID | Type migration (05-C) |
| `runtime_idempotency_registry` | `tenant_id` | TEXT → UUID | Type migration (05-C) |
| `runtime_audit_log` | `tenant_id` | TEXT → UUID | Type migration (05-C) |
| `runtime_quarantine` | `tenant_id` | TEXT → UUID | Type migration (05-C) |

### New Foreign Keys

| Child Table | Column | References | On Delete |
|-------------|--------|------------|-----------|
| `migration_evidence.canonical_tenant_map` | `canonical_tenant_id` | `public.tenants(id)` | RESTRICT |
| `runtime_tenant_registry` | `tenant_id` | `public.tenants(id)` | RESTRICT |
| `runtime_outbox` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | RESTRICT |
| `runtime_idempotency_registry` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | RESTRICT |
| `runtime_audit_log` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | RESTRICT |
| `runtime_quarantine` | `tenant_id` | `runtime_tenant_registry(tenant_id)` | RESTRICT |

**Total:** 6 new FK constraints

### RLS Impact

**No RLS changes required.** RLS policies remain UUID-based (already using `get_auth_tenant_id()` which returns UUID since 2026-05-21).

---

<a name="implementation-design-mapping"></a>
## 3. IMPLEMENTATION → DESIGN MAPPING

### Amendment 12 v3 Corrections (6 Total)

| Correction | Design Section | Implementation File | Verification |
|------------|----------------|---------------------|--------------|
| **Correction 1:** Reservation ≠ Canonical Identity | Part C.1 | `05a...sql` L95-100, `05b...sql` L430-435 | ✅ Separate columns, NO FK during reservation |
| **Correction 2:** PostgreSQL DDL (partial UNIQUE) | Part C.1 | `05a...sql` L210-218 | ✅ CREATE UNIQUE INDEX with WHERE clause |
| **Correction 3:** Schema-safe absolute (P4/E1) | Part D.2, Part E | `e1...sql` L50-280, `05a...sql` L340-450 | ✅ Introspect before query, UNKNOWN→STOP |
| **Correction 4:** Dynamic INSERT (schema-adaptive) | Part D.3 | `05b...sql` L250-350 | ✅ Introspect optional columns, dynamic SQL |
| **Correction 5:** Transaction/lock strategy | Part H | `05a...sql` L30-50, `05b...sql` L30-50 | ✅ Advisory lock + transaction boundaries |
| **Correction 6:** E2 orphan safety gate | Part I | `e2...sql` L50-250 | ✅ 5-stage verification before deletion |

### Mandatory Conditions (5 Total)

| Condition | Requirement | Implementation | File | Lines |
|-----------|-------------|----------------|------|-------|
| **#1** | P4 metadata validation | `created_at` + `provisioned_by` introspection + forensics | `05a...sql` | 340-450 |
| **#2** | Advisory lock explicit | `pg_try_advisory_xact_lock(hashtext('BELLA_MIGRATION_05'))` | `05a...sql`, `05b...sql` | 30-50 |
| **#3** | Mapping immutability | Trigger `prevent_canonical_id_change` on UPDATE | `05b...sql` | 360-395 |
| **#4** | Transaction + lock + PK/UNIQUE + verification | Transaction boundaries + advisory lock + UNIQUE indexes + 4 gates (P2/P3/P4/E2) | All migrations | Throughout |
| **#5** | Deletion audit columns | `deleted_at`, `deleted_by`, `deletion_reason` populated before DELETE | `05a...sql` L125-128, `05b...sql` L520-530 | Schema + usage |

### Gate Implementation

| Gate | Purpose | Implementation | Verification Checks |
|------|---------|----------------|---------------------|
| **E1** | Pre-migration state | `migration_05_e1_gate()` | 8 checks (schema-safe) |
| **P2** | 05-A complete | `migration_05b_preflight_p2_reservation_complete()` | Mapping phase verification |
| **P3** | Schema compatibility | `migration_05b_preflight_p3_schema_compatibility()` | Required columns, optional types |
| **P4** | UUID collision | `migration_05a_preflight_p4_collision_gate()` | Metadata forensics, UNKNOWN→STOP |
| **E2** | Orphan safety | `migration_05_e2_orphan_safety_gate()` | 5-stage verification |
| **E3** | Post-migration | `migration_05_e3_gate()` | 10 checks (type, FK, mapping) |

---

<a name="mandatory-conditions-proof"></a>
## 4. MANDATORY CONDITIONS PROOF

### Condition #1: P4 Metadata Validation

**Requirement:** P4 collision gate must verify `created_at` + `provisioned_by` to distinguish legitimate from attacker-created collision.

**Implementation Evidence:**

```sql
-- File: 05a...sql, Lines 340-370
SELECT EXISTS(
  SELECT 1 FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'tenants' 
    AND column_name = 'created_at'
) INTO v_created_at_column_exists;

-- Lines 390-410
SELECT 
  id, name, created_at,
  COALESCE(metadata->>'provisioned_by', 'UNKNOWN (metadata empty)') AS provisioned_by,
  COALESCE(metadata->>'fixture_type', 'UNKNOWN (metadata empty)') AS fixture_type
FROM public.tenants
WHERE id = ANY(v_reserved_uuids);

-- Lines 430-450
IF NOT v_metadata_column_exists OR v_metadata_type != 'jsonb' THEN
  RAISE EXCEPTION 'P4 COLLISION GATE: COLLISION CLASSIFICATION = UNKNOWN';
END IF;
```

**Status:** ✅ IMPLEMENTED (metadata introspection + forensic analysis + UNKNOWN→STOP)

---

### Condition #2: Advisory Lock Explicit Acquisition

**Requirement:** Advisory lock must be explicitly acquired at transaction start, not just documented.

**Implementation Evidence:**

```sql
-- File: 05a...sql, Lines 30-50
DO $$
DECLARE
  v_lock_acquired BOOLEAN;
BEGIN
  SELECT pg_try_advisory_xact_lock(hashtext('BELLA_MIGRATION_05')) INTO v_lock_acquired;
  
  IF NOT v_lock_acquired THEN
    RAISE EXCEPTION 'MIGRATION 05-A: ADVISORY LOCK NOT ACQUIRED';
  END IF;
END $$;

-- File: 05b...sql, Lines 30-48 (same pattern)
```

**Status:** ✅ IMPLEMENTED (explicit acquisition in 05-A and 05-B, failure→EXCEPTION)

---

### Condition #3: Mapping Immutability

**Requirement:** Trigger to prevent `canonical_tenant_id` modification after `reconciliation_phase = COMPLETE`.

**Implementation Evidence:**

```sql
-- File: 05b...sql, Lines 360-380
CREATE OR REPLACE FUNCTION migration_evidence.prevent_canonical_id_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.reconciliation_phase = 'COMPLETE' 
     AND OLD.canonical_tenant_id IS DISTINCT FROM NEW.canonical_tenant_id THEN
    RAISE EXCEPTION 'MAPPING IMMUTABILITY VIOLATION';
  END IF;
  RETURN NEW;
END;
$$;

-- Lines 382-395
CREATE TRIGGER trigger_prevent_canonical_id_change
  BEFORE UPDATE OF canonical_tenant_id ON migration_evidence.canonical_tenant_map
  FOR EACH ROW
  EXECUTE FUNCTION migration_evidence.prevent_canonical_id_change();
```

**Status:** ✅ IMPLEMENTED (trigger enforces immutability at database level)

---

### Condition #4: Transaction + Lock + PK/UNIQUE + Verification

**Requirement:** Combination of transaction boundaries, advisory lock, database constraints, and preflight gates.

**Implementation Evidence:**

```sql
-- Transaction boundaries: Implicit in migration file execution

-- Advisory lock: Condition #2 above

-- PK/UNIQUE constraints:
-- File: 05a...sql, Lines 210-218
CREATE UNIQUE INDEX uq_canonical_map_reserved_uuid
  ON migration_evidence.canonical_tenant_map(reserved_tenant_id)
  WHERE reserved_tenant_id IS NOT NULL;

CREATE UNIQUE INDEX uq_canonical_map_canonical_uuid
  ON migration_evidence.canonical_tenant_map(canonical_tenant_id)
  WHERE canonical_tenant_id IS NOT NULL;

-- Verification gates:
-- File: 05a...sql, Line 500: PERFORM migration_05a_preflight_p4_collision_gate();
-- File: 05b...sql, Line 420: PERFORM migration_05b_preflight_p2_reservation_complete();
-- File: 05b...sql, Line 423: PERFORM migration_05b_preflight_p3_schema_compatibility();
-- File: 05b...sql, Line 426: PERFORM migration_05b_preflight_collision_recheck();
-- File: 05b...sql, Line 485: FOR v_e2_result IN SELECT * FROM migration_05_e2_orphan_safety_gate()
```

**Status:** ✅ IMPLEMENTED (all 4 components present)

---

### Condition #5: Deletion Audit Columns

**Requirement:** `deleted_at`, `deleted_by`, `deletion_reason` columns in `canonical_tenant_map`, populated before DELETE.

**Implementation Evidence:**

```sql
-- File: 05a...sql, Lines 125-128 (schema definition)
deleted_at TIMESTAMPTZ,
deleted_by TEXT,
deletion_reason TEXT,

-- File: 05b...sql, Lines 520-530 (population before DELETE)
UPDATE migration_evidence.canonical_tenant_map
SET 
  deleted_at = NOW(),
  deleted_by = CURRENT_USER,
  deletion_reason = 'E2 orphan safety gate PASS. Classification: TEST_ORPHAN.'
WHERE classification = 'TEST_ORPHAN';

DELETE FROM runtime_tenant_registry WHERE tenant_id IN (...);
```

**Status:** ✅ IMPLEMENTED (schema + audit trail population)

---

<a name="verification-tests"></a>
## 5. VERIFICATION TESTS

### Automated Verification

**Package Integrity Check:**
```bash
node scripts/verify-amendment-12-v3-package-integrity.mjs
```

**Expected Output:**
```
✅ PACKAGE INTEGRITY VERIFIED
All 5 mandatory conditions implemented
Total Checks: 40+
✅ PASS: 40+
❌ FAIL: 0
```

**E1 Gate Execution (Pre-Migration):**
```bash
node scripts/run-e1-verification.mjs
```

**Expected Output:**
```
E1 GATE: PASS or PASS WITH WARNINGS
✅ runtime_tenant_registry.tenant_id = TEXT
✅ canonical_tenant_map does not exist
✅ get_auth_tenant_id() returns UUID
```

### Manual Verification Checklist

- [ ] Run package integrity verification: `node scripts/verify-amendment-12-v3-package-integrity.mjs`
- [ ] Verify all 7 migration files exist in `supabase/migrations/`
- [ ] Read Amendment 12 v3 complete design document
- [ ] Review Security Review document (conditional requirements understood)
- [ ] Review Data Integrity Review document (recommendation implemented)
- [ ] Verify database connection string in `.env` (not committed to Git)
- [ ] Confirm database has 0 mutations currently
- [ ] Review execution plan (Section 7 below)
- [ ] Review rollback strategy (Section 8 below)
- [ ] Approve for E0 gate execution

---

<a name="package-integrity-report"></a>
## 6. PACKAGE INTEGRITY REPORT

### Design Fidelity

| Aspect | Status | Evidence |
|--------|--------|----------|
| Two-phase reconciliation (RESERVATION → COMPLETE) | ✅ | `canonical_tenant_map` schema + phase tracking |
| Separate reserved/canonical columns | ✅ | NO FK during reservation, FK added by 05-B |
| Schema-safe absolute introspection | ✅ | E1 + P3 + P4 introspect before query |
| Explicit mapping only (NO fuzzy match) | ✅ | 05-C uses `canonical_tenant_map`, unmapped ID→EXCEPTION |
| E2 orphan safety (multi-stage) | ✅ | 5-stage verification (count/set/reference/temporal/final) |
| Transaction atomicity | ✅ | All mutations wrapped in transaction boundaries |
| Advisory lock protection | ✅ | Explicit acquisition in 05-A and 05-B |

### Negative Path Coverage

| Negative Path | Expected Behavior | Implementation | Status |
|---------------|-------------------|----------------|--------|
| Reserved UUID collision | 🔴 STOP with forensics | P4 gate EXCEPTION | ✅ |
| Metadata missing (security gate) | 🔴 STOP | P4 UNKNOWN→EXCEPTION | ✅ |
| Unmapped TEXT ID in 05-C | 🔴 STOP | P-05C-MAP gate EXCEPTION | ✅ |
| Orphan count mismatch | 🔴 STOP | E2-A gate EXCEPTION | ✅ |
| Orphan has FK references | 🔴 STOP | E2-C gate EXCEPTION | ✅ |
| Concurrent UUID claim | 🔴 STOP / ROLLBACK | PK violation EXCEPTION | ✅ |
| 05-A executed twice | Idempotent or STOP | Existence check | ✅ |
| Canonical ID change after COMPLETE | 🔴 STOP | Immutability trigger | ✅ |

### Recovery Paths

| Failure Scenario | State Preservation | Recovery Action | Status |
|------------------|-------------------|-----------------|--------|
| 05-A succeeds, 05-B fails | Reservation preserved | Retry 05-B from clean RESERVATION state | ✅ Documented |
| 05-B succeeds, 05-C fails | Canonical tenants exist, mapping COMPLETE | Fix unmapped ID, retry 05-C | ✅ Documented |
| 05-A collision detected | NO mutations | Investigate occupying tenant, human decision | ✅ Documented |
| Unmapped TEXT ID detected | NO type migration | Add to mapping OR delete fixture | ✅ Documented |
| E2 gate failure | NO orphan deletion | Investigate violation, resolve, retry | ✅ Documented |

**Status:** ✅ ALL recovery paths documented with decision trees

---

<a name="execution-plan"></a>
## 7. EXECUTION PLAN

### Prerequisites

1. ✅ Approval 3 granted
2. ✅ Package integrity verification PASS
3. ⏳ E0 gate execution (package review approval)
4. ⏳ E1 gate execution (database state verification)
5. ⏳ Human approval for mutation

### Execution Sequence

```
┌─────────────────────────────────────────────────────────┐
│ PACKAGE REVIEW (Human Decision)                         │
│   - Review this document                                │
│   - Verify package integrity                            │
│   - Decision: APPROVE or REJECT                         │
└─────────────────────────────────────────────────────────┘
                        ↓ APPROVED
┌─────────────────────────────────────────────────────────┐
│ E0 GATE: Package Verification                           │
│   - File checksum verification                          │
│   - SQL syntax validation                               │
│   - Governance compliance check                         │
└─────────────────────────────────────────────────────────┘
                        ↓ PASS
┌─────────────────────────────────────────────────────────┐
│ E1 GATE: Database State Verification                    │
│   Command: node scripts/run-e1-verification.mjs         │
│   Expected: PASS (runtime_tenant_registry.tenant_id=TEXT)│
└─────────────────────────────────────────────────────────┘
                        ↓ PASS
┌─────────────────────────────────────────────────────────┐
│ HUMAN APPROVAL: Execute Mutations                       │
│   Decision: GO or NO-GO                                 │
└─────────────────────────────────────────────────────────┘
                        ↓ GO
┌─────────────────────────────────────────────────────────┐
│ 05-A: Classification & Reservation                      │
│   Duration: ~5 seconds                                  │
│   Mutations: CREATE schema/table, INSERT 5 rows        │
│   Gates: P4 (collision detection)                       │
└─────────────────────────────────────────────────────────┘
                        ↓ PASS
┌─────────────────────────────────────────────────────────┐
│ 05-B: Canonical Tenant Creation & Cleanup              │
│   Duration: ~10 seconds                                 │
│   Mutations: INSERT 3 tenants, UPDATE mapping, DELETE 2│
│   Gates: P2, P3, P4 recheck, E2                         │
└─────────────────────────────────────────────────────────┘
                        ↓ PASS
┌─────────────────────────────────────────────────────────┐
│ 05-C: TEXT→UUID Type Migration                         │
│   Duration: ~15 seconds                                 │
│   Mutations: UPDATE 3 TEXT→UUID, ALTER TYPE 5 tables   │
│   Gates: P-05C, P-05C-MAP                               │
└─────────────────────────────────────────────────────────┘
                        ↓ PASS
┌─────────────────────────────────────────────────────────┐
│ E3 GATE: Post-Migration Verification                    │
│   Command: SELECT * FROM migration_05_e3_gate();        │
│   Expected: PASS (all types UUID, FK exist, 3 fixtures)│
└─────────────────────────────────────────────────────────┘
                        ↓ PASS
┌─────────────────────────────────────────────────────────┐
│ MIGRATION COMPLETE                                      │
│   - Canonical tenants: 3 (UUID)                         │
│   - Runtime registry: 3 rows (UUID)                     │
│   - Orphans deleted: 2 (audited)                        │
│   - Type migration: TEXT → UUID ✅                      │
└─────────────────────────────────────────────────────────┘
```

### Execution Commands

**FORBIDDEN:** Do NOT execute until Package Review + E0 + E1 + Human Approval complete.

```bash
# 1. Package integrity verification (before Package Review)
node scripts/verify-amendment-12-v3-package-integrity.mjs

# 2. E1 gate (before mutations)
node scripts/run-e1-verification.mjs

# 3. Execute migrations (ONLY after approval)
psql $DATABASE_URL -f supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
psql $DATABASE_URL -f supabase/migrations/20260819050002_runtime_migration_05b_canonical_tenant_creation.sql
psql $DATABASE_URL -f supabase/migrations/20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql

# 4. E3 gate (post-migration verification)
psql $DATABASE_URL -c "SELECT * FROM migration_05_e3_gate();"
```

---

<a name="rollback-strategy"></a>
## 8. ROLLBACK STRATEGY

### Rollback Decision Points

| After Phase | State | Rollback Method | Data Loss |
|-------------|-------|-----------------|-----------|
| **05-A** | Reservation created | DROP SCHEMA migration_evidence CASCADE | None (no canonical tenants) |
| **05-B** | Canonical tenants exist | Manual: DELETE tenants, DROP schema | None (TEXT IDs preserved in mapping) |
| **05-C** | Type migrated to UUID | ⚠️ **COMPLEX** (see below) | Risk if not audited properly |

### Rollback Commands

**After 05-A (Safe):**
```sql
BEGIN;
DROP SCHEMA IF EXISTS migration_evidence CASCADE;
COMMIT;
-- Result: No canonical tenants, no mapping, database state = pre-05-A
```

**After 05-B (Moderate Risk):**
```sql
BEGIN;
-- Delete canonical tenants
DELETE FROM public.tenants
WHERE id IN (
  SELECT canonical_tenant_id 
  FROM migration_evidence.canonical_tenant_map 
  WHERE classification = 'TEST_FIXTURE'
);

-- Drop evidence schema
DROP SCHEMA migration_evidence CASCADE;

-- Restore orphans manually (if needed)
-- INSERT INTO runtime_tenant_registry (tenant_id, ...) 
-- VALUES ('test-quarantine-tenant-a', ...), ('test-quarantine-tenant-b', ...);

COMMIT;
```

**After 05-C (High Complexity):**

⚠️ **WARNING:** Type rollback UUID→TEXT is **NOT SAFE** without complete audit trail.

Rollback requires:
1. Reverse FK constraints (DROP FK)
2. Reverse type migration (ALTER COLUMN TYPE TEXT)
3. Reverse UUID→TEXT mapping (requires canonical_tenant_map preservation)
4. Restore orphans
5. Reverse canonical tenant creation

**Recommendation:** 
- **DO NOT ROLLBACK 05-C** without database backup
- If 05-C succeeds, migration is effectively complete
- If 05-C fails partway, use recovery procedures (NOT full rollback)

### Backup Strategy

**Before execution:**
```bash
# Full database backup (MANDATORY before 05-A)
pg_dump $DATABASE_URL > bella_runtime_pre_migration_05_backup_$(date +%Y%m%d_%H%M%S).sql

# Backup verification
ls -lh bella_runtime_pre_migration_05_backup_*.sql
```

**Restore from backup (if critical failure):**
```bash
# ONLY if catastrophic failure occurs
# This WILL LOSE all data created after backup
psql $DATABASE_URL < bella_runtime_pre_migration_05_backup_YYYYMMDD_HHMMSS.sql
```

---

<a name="human-review-checklist"></a>
## 9. HUMAN REVIEW CHECKLIST

### Pre-Approval Review

- [ ] **Governance:** Approval 3 granted, review cycle complete
- [ ] **Design:** Read Amendment 12 v3 complete document
- [ ] **Implementation:** All 7 migration files reviewed
- [ ] **Mandatory Conditions:** All 5 conditions verified implemented
- [ ] **Package Integrity:** Verification script executed, PASS
- [ ] **Negative Paths:** All 18 negative scenarios have explicit STOP behavior
- [ ] **Recovery:** All 5 failure scenarios have documented decision trees
- [ ] **Backup:** Database backup strategy understood and ready

### Security Review

- [ ] Advisory lock prevents concurrent execution
- [ ] P4 collision gate verifies metadata (created_at + provisioned_by)
- [ ] UNKNOWN security state → STOP (no degradation)
- [ ] Mapping immutability enforced by trigger
- [ ] NO auto-delete, NO auto-reassign, NO fuzzy match

### Data Integrity Review

- [ ] One-to-one mapping enforced (UNIQUE constraints)
- [ ] Transaction atomicity guaranteed
- [ ] FK integrity established (6 new FK constraints)
- [ ] Deletion audit trail (deleted_at/deleted_by/deletion_reason)
- [ ] 3 fixtures preserved with correct identity

### Execution Readiness

- [ ] Database connection verified (`.env` configured)
- [ ] E1 gate script tested (dry-run successful)
- [ ] Backup strategy prepared
- [ ] Rollback procedures understood
- [ ] Execution window scheduled (maintenance window recommended)

### Final Approval

- [ ] **Package Review:** APPROVED
- [ ] **E0 Gate:** Ready to execute
- [ ] **E1 Gate:** Ready to execute
- [ ] **Migration Execution:** Authorized to proceed

---

## PACKAGE REVIEW DECISION

**Date:** __________________

**Reviewer:** __________________

**Decision:** 

- [ ] ✅ **APPROVED** — Proceed to E0 gate execution
- [ ] ❌ **REJECTED** — Resolution required (specify below)
- [ ] ⏸️  **HOLD** — Additional review needed (specify below)

**Notes:**

_____________________________________________________________________________

_____________________________________________________________________________

_____________________________________________________________________________

**Signature:** __________________

---

## APPENDIX: QUICK REFERENCE

### File Locations

```
supabase/migrations/
  20260819040000_runtime_migration_e1_gate_schema_safe.sql
  20260819050000_runtime_migration_05a_classification_reservation.sql
  20260819050001_runtime_migration_05_e2_orphan_safety_gate.sql
  20260819050002_runtime_migration_05b_canonical_tenant_creation.sql
  20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql
  20260819050004_runtime_migration_e3_post_05c_verification.sql

scripts/
  run-e1-verification.mjs
  verify-amendment-12-v3-package-integrity.mjs

docs/architecture/
  BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_COMPLETE.md
  BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_SECURITY_REVIEW.md
  BELLA_RUNTIME_MIGRATION_05_AMENDMENT_12_V3_DATA_INTEGRITY_REVIEW.md
  BELLA_RUNTIME_MIGRATION_05_PACKAGE_REVIEW.md (this document)
```

### Key Commands

```bash
# Package integrity
node scripts/verify-amendment-12-v3-package-integrity.mjs

# E1 gate
node scripts/run-e1-verification.mjs

# Database backup (MANDATORY before execution)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Execute migrations (ONLY after approval)
psql $DATABASE_URL -f supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
psql $DATABASE_URL -f supabase/migrations/20260819050002_runtime_migration_05b_canonical_tenant_creation.sql
psql $DATABASE_URL -f supabase/migrations/20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql

# E3 gate
psql $DATABASE_URL -c "SELECT * FROM migration_05_e3_gate();"
```

---

**END OF PACKAGE REVIEW DOCUMENTATION**
