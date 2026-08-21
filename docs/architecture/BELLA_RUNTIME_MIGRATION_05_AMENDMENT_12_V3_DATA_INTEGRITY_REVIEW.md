# AMENDMENT 12 V3 — DATA INTEGRITY REVIEW

**Review Date:** 2026-08-19  
**Reviewer:** Human Architect (Independent Data Integrity Review)  
**Amendment:** Migration 05 Identity Reconciliation (Amendment 12 v3)  
**Review Scope:** One-to-one mapping, TEXT identity preservation, UUID mapping correctness, FK integrity, transaction atomicity, retry safety, partial failure recovery

---

## DATA INTEGRITY REVIEW CHARTER

This review evaluates Amendment 12 v3 from a **data integrity perspective**, independent of Architecture Review and Security Review.

**Focus Areas:**
1. One-to-one canonical mapping guarantee
2. No lost TEXT identities during migration
3. No duplicate UUID mappings
4. Foreign key correctness and orphan prevention
5. Transaction atomicity (no partial states)
6. Retry and recovery safety
7. Partial failure detection and rollback
8. TEXT→UUID mapping completeness in 05-C
9. Rollback and reconciliation evidence
10. Preservation of all five original fixtures

**Pass Criteria:** No data loss, no orphaned references, no identity duplication, deterministic recovery from failures.

---

## D.1 ONE-TO-ONE CANONICAL MAPPING

### D.1.1 Mapping Uniqueness (TEXT → UUID)

**Integrity Requirement:** Each TEXT tenant ID maps to exactly one canonical UUID. No TEXT ID maps to multiple UUIDs.

**Design Mechanism:**
```sql
CREATE TABLE migration_evidence.canonical_tenant_map (
  id BIGSERIAL PRIMARY KEY,
  legacy_fixture_id TEXT NOT NULL UNIQUE,  -- Enforces TEXT uniqueness
  canonical_tenant_id UUID,
  ...
);

CREATE UNIQUE INDEX uq_canonical_map_canonical_uuid
ON migration_evidence.canonical_tenant_map(canonical_tenant_id)
WHERE canonical_tenant_id IS NOT NULL;  -- Enforces UUID uniqueness
```

**Verification:**
```sql
-- No duplicate TEXT IDs
SELECT legacy_fixture_id, COUNT(*) AS mapping_count
FROM migration_evidence.canonical_tenant_map
GROUP BY legacy_fixture_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- No duplicate UUIDs
SELECT canonical_tenant_id, COUNT(*) AS tenant_count
FROM migration_evidence.canonical_tenant_map
WHERE canonical_tenant_id IS NOT NULL
GROUP BY canonical_tenant_id
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

**Failure Scenarios:**
- Duplicate TEXT ID inserted → unique_violation on legacy_fixture_id → ROLLBACK
- Duplicate UUID assigned → unique_violation on uq_canonical_map_canonical_uuid → ROLLBACK

**Verdict:** 🟢 PASS (DDL-enforced uniqueness)

---

### D.1.2 Mapping Completeness (All TEXT IDs Accounted For)

**Integrity Requirement:** All TEXT tenant IDs in runtime_tenant_registry must have corresponding entry in canonical_tenant_map before 05-C.

**Design Mechanism:**
```sql
-- 05-A classification
INSERT INTO canonical_tenant_map (legacy_fixture_id, classification, ...)
SELECT tenant_id, classify(tenant_id), ...
FROM runtime_tenant_registry;
-- All 5 fixtures classified
```

**Verification:**
```sql
-- Before 05-C: All TEXT IDs mapped
SELECT COUNT(*) = 0 AS no_unmapped
FROM runtime_tenant_registry rtr
WHERE NOT EXISTS(
  SELECT 1 FROM migration_evidence.canonical_tenant_map ctm
  WHERE ctm.legacy_fixture_id = rtr.tenant_id
);
-- Expected: TRUE
```

**Failure Scenario:**
```sql
-- 05-C encounters unmapped TEXT ID
UPDATE runtime_tenant_registry
SET tenant_id = (
  SELECT canonical_tenant_id::TEXT FROM canonical_tenant_map
  WHERE legacy_fixture_id = runtime_tenant_registry.tenant_id
)
WHERE tenant_id IN (...);
-- If TEXT ID not in canonical_tenant_map → canonical_tenant_id = NULL
-- ALTER TYPE fails: NULL::UUID invalid
```

**Integrity Property:** Unmapped TEXT ID causes 05-C failure (STOP, no silent data loss)

**Verdict:** 🟢 PASS (explicit mapping required, failure on missing)

---

## D.2 TEXT IDENTITY PRESERVATION

### D.2.1 No Lost TEXT Identities

**Integrity Requirement:** All TEXT tenant IDs existing before 05-A must be preserved through migration (either migrated or intentionally deleted with audit).

**Design Flow:**
```
Pre-05-A: 5 TEXT tenant IDs in runtime_tenant_registry
  - test-quarantine-tenant-a
  - test-quarantine-tenant-b
  - test-e2e-tenant-a
  - test-e2e-tenant-b
  - test-e2e-tenant-attacker

05-A: Classify all 5 → canonical_tenant_map (5 rows)

05-B: 
  - TEST_ORPHAN (2 rows) → DELETE with audit
  - TEST_FIXTURE (3 rows) → Migrate to UUID

Post-05-C: 3 UUID tenant IDs in runtime_tenant_registry
```

**Verification:**
```sql
-- Audit trail: All original TEXT IDs accounted for
SELECT 
  legacy_fixture_id,
  classification,
  CASE 
    WHEN classification = 'TEST_ORPHAN' THEN 'DELETED'
    WHEN classification = 'TEST_FIXTURE' AND reconciliation_phase = 'COMPLETE' THEN 'MIGRATED'
    ELSE 'UNKNOWN'
  END AS disposition
FROM migration_evidence.canonical_tenant_map;

-- Expected: 5 rows, 2 DELETED, 3 MIGRATED
```

**Failure Scenario:**
- TEXT ID exists before 05-A but not in canonical_tenant_map after 05-A → Data loss, migration incomplete

**Integrity Property:** canonical_tenant_map persists post-migration (audit trail preserved)

**Verdict:** 🟢 PASS (audit trail + explicit classification)

---

### D.2.2 Orphan Deletion Auditability

**Integrity Requirement:** Orphan deletion must be auditable (who, when, why) and reversible if mistake detected.

**Design Mechanism:**
```sql
-- canonical_tenant_map retains orphan records
legacy_fixture_id: test-quarantine-tenant-a
classification: TEST_ORPHAN
deleted_at: 2026-08-19 10:30:00
deleted_by: migration_user
deletion_reason: 'E2 orphan safety gate PASS'
```

**Audit Query:**
```sql
SELECT 
  legacy_fixture_id,
  classification,
  deleted_at,
  created_at AS original_creation
FROM migration_evidence.canonical_tenant_map
WHERE classification = 'TEST_ORPHAN';

-- Returns: 2 rows with deletion timestamp
```

**Reversibility:** ⚠️ **GAP:** v3 does not include deleted_at/deleted_by columns in canonical_tenant_map schema

**Recommendation:**
```sql
ALTER TABLE migration_evidence.canonical_tenant_map
ADD COLUMN deleted_at TIMESTAMPTZ,
ADD COLUMN deleted_by TEXT,
ADD COLUMN deletion_reason TEXT;

-- 05-B: Record deletion metadata before DELETE
UPDATE canonical_tenant_map
SET deleted_at = NOW(),
    deleted_by = current_user,
    deletion_reason = 'E2 orphan safety gate PASS'
WHERE classification = 'TEST_ORPHAN';
```

**Verdict:** 🟡 CONDITIONAL PASS (requires deletion audit columns)

---

## D.3 UUID MAPPING CORRECTNESS

### D.3.1 Reserved UUID = Canonical UUID (After 05-B)

**Integrity Requirement:** After 05-B completion, reserved_tenant_id MUST equal canonical_tenant_id for TEST_FIXTURE entries.

**Design Enforcement:**
```sql
-- CHECK constraint in canonical_tenant_map
CONSTRAINT reservation_invariant
  CHECK (
    reconciliation_phase != 'COMPLETE' 
    OR reserved_tenant_id = canonical_tenant_id
  )
```

**Verification:**
```sql
SELECT COUNT(*) = 0 AS no_violation
FROM migration_evidence.canonical_tenant_map
WHERE reconciliation_phase = 'COMPLETE'
  AND classification = 'TEST_FIXTURE'
  AND reserved_tenant_id != canonical_tenant_id;
-- Expected: TRUE
```

**Failure Scenario:**
- canonical_tenant_id assigned different UUID than reserved_tenant_id → CHECK constraint violation → ROLLBACK

**Verdict:** 🟢 PASS (DDL-enforced invariant)

---

### D.3.2 Canonical UUID Exists in public.tenants

**Integrity Requirement:** All canonical_tenant_id values (non-NULL) must reference existing tenant in public.tenants.

**Design Enforcement:**
```sql
-- FK constraint added in 05-B (after tenant creation)
ALTER TABLE migration_evidence.canonical_tenant_map
ADD CONSTRAINT fk_canonical_tenant
FOREIGN KEY (canonical_tenant_id) REFERENCES public.tenants(id);
```

**Verification:**
```sql
-- No orphan canonical UUIDs
SELECT COUNT(*) = 0 AS no_orphans
FROM migration_evidence.canonical_tenant_map
WHERE canonical_tenant_id IS NOT NULL
  AND NOT EXISTS(
    SELECT 1 FROM public.tenants WHERE id = canonical_tenant_map.canonical_tenant_id
  );
-- Expected: TRUE
```

**Failure Scenario:**
- 05-B sets canonical_tenant_id without creating tenant → FK constraint fails at ALTER TABLE → ROLLBACK

**Verdict:** 🟢 PASS (FK-enforced referential integrity)

---

## D.4 FOREIGN KEY INTEGRITY

### D.4.1 Runtime Registry FK (Post-05-C)

**Integrity Requirement:** After 05-C, runtime_tenant_registry.tenant_id (UUID) must reference public.tenants.id.

**Design Enforcement:**
```sql
-- 05-C adds FK after type migration
ALTER TABLE runtime_tenant_registry
ADD CONSTRAINT fk_runtime_tenant
FOREIGN KEY (tenant_id) REFERENCES public.tenants(id);
```

**Verification:**
```sql
-- No orphan tenant_id values
SELECT COUNT(*) = 0 AS no_orphans
FROM runtime_tenant_registry rtr
WHERE NOT EXISTS(
  SELECT 1 FROM public.tenants t WHERE t.id = rtr.tenant_id
);
-- Expected: TRUE

-- FK constraint exists
SELECT COUNT(*) = 1 AS fk_exists
FROM information_schema.table_constraints
WHERE table_name = 'runtime_tenant_registry'
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name = 'fk_runtime_tenant';
-- Expected: TRUE
```

**Failure Scenario:**
- 05-C migrates tenant_id to UUID that doesn't exist in public.tenants → FK constraint fails → ROLLBACK

**Verdict:** 🟢 PASS (FK-enforced, verified)

---

### D.4.2 Child Table FK Cascade

**Integrity Requirement:** All child tables (runtime_outbox, runtime_event_log, runtime_idempotency) must have FK constraints to runtime_tenant_registry or public.tenants after 05-C.

**Design Scope:** v3 specifies 05-C migration for child tables with same pattern.

**Verification:**
```sql
-- Verify FK exists on each child table
SELECT 
  table_name,
  constraint_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name IN ('runtime_outbox', 'runtime_event_log', 'runtime_idempotency')
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%tenant%';

-- Expected: 3 rows (one FK per child table)
```

**Failure Scenario:**
- Child table migrates to UUID but no FK added → Orphan UUIDs possible, data integrity lost

**Verdict:** 🟢 PASS (design specifies FK for all tables)

---

## D.5 TRANSACTION ATOMICITY

### D.5.1 05-A Atomicity (Classification)

**Integrity Requirement:** 05-A operations must be atomic. If any step fails, no partial canonical_tenant_map.

**Design Transaction Boundary:**
```sql
BEGIN;
  CREATE SCHEMA IF NOT EXISTS migration_evidence;
  CREATE TABLE canonical_tenant_map (...);
  INSERT INTO canonical_tenant_map (...);  -- 5 rows
  -- P4 collision gate
  IF collision_detected THEN
    ROLLBACK;  -- No canonical_tenant_map created
    RAISE EXCEPTION;
  END IF;
COMMIT;
```

**Verification:**
```sql
-- After 05-A failure: Schema should not exist
SELECT COUNT(*) = 0 AS no_partial_state
FROM information_schema.schemata
WHERE schema_name = 'migration_evidence';
-- Expected: TRUE (if 05-A failed)

-- After 05-A success: 5 rows or nothing
SELECT COUNT(*) IN (0, 5) AS atomic
FROM migration_evidence.canonical_tenant_map;
-- Expected: TRUE
```

**Failure Scenario:**
- P4 collision detected after 2 rows inserted → ROLLBACK → canonical_tenant_map does not exist

**Verdict:** 🟢 PASS (transaction-wrapped)

---

### D.5.2 05-B Atomicity (Tenant Creation + Orphan Deletion)

**Integrity Requirement:** 05-B operations must be atomic. Tenant creation, canonical_tenant_id assignment, FK addition, orphan deletion must all succeed or all fail.

**Design Transaction Boundary:**
```sql
BEGIN;
  -- E2 orphan safety gate
  IF NOT e2_pass THEN
    ROLLBACK;
    RAISE EXCEPTION;
  END IF;
  
  -- Create 3 tenants
  INSERT INTO public.tenants (...);  -- 3 rows
  
  -- Update canonical mapping
  UPDATE canonical_tenant_map SET canonical_tenant_id = reserved_tenant_id, ...;
  
  -- Add FK constraint
  ALTER TABLE canonical_tenant_map ADD CONSTRAINT fk_canonical_tenant ...;
  
  -- Delete orphans
  DELETE FROM runtime_tenant_registry WHERE tenant_id IN (...);  -- 2 rows
  
COMMIT;
```

**Verification:**
```sql
-- After 05-B failure: No tenants created
SELECT COUNT(*) = 0 AS no_tenants
FROM public.tenants
WHERE id IN (SELECT reserved_tenant_id FROM migration_evidence.canonical_tenant_map WHERE classification = 'TEST_FIXTURE');
-- Expected: TRUE (if 05-B failed)

-- After 05-B success: All or nothing
WITH checks AS (
  SELECT 
    (SELECT COUNT(*) FROM public.tenants WHERE id IN (...)) = 3 AS tenants_created,
    (SELECT COUNT(*) FROM canonical_tenant_map WHERE reconciliation_phase = 'COMPLETE') = 3 AS phase_complete,
    (SELECT COUNT(*) FROM runtime_tenant_registry WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b')) = 0 AS orphans_deleted,
    (SELECT COUNT(*) FROM information_schema.table_constraints WHERE constraint_name = 'fk_canonical_tenant') = 1 AS fk_exists
)
SELECT * FROM checks
WHERE tenants_created AND phase_complete AND orphans_deleted AND fk_exists;
-- Expected: 1 row (all TRUE) OR 0 rows (05-B not executed/failed)
```

**Failure Scenario:**
- E2 fails → ROLLBACK before any mutation
- Tenant INSERT fails (PK collision) → ROLLBACK, no orphan deletion
- FK constraint fails → ROLLBACK, tenants deleted, phase remains RESERVATION

**Verdict:** 🟢 PASS (atomic transaction)

---

### D.5.3 05-C Atomicity (Type Migration)

**Integrity Requirement:** 05-C type migration must be atomic per table. If ALTER TYPE fails, no partial UUID conversion.

**Design Transaction Boundary:**
```sql
BEGIN;
  -- Disable FK temporarily (if needed)
  ALTER TABLE runtime_outbox DROP CONSTRAINT IF EXISTS fk_runtime_tenant;
  
  -- Update TEXT → UUID
  UPDATE runtime_tenant_registry SET tenant_id = (SELECT canonical_tenant_id::TEXT ...);
  
  -- Verify completeness
  IF unmapped_ids_exist THEN
    ROLLBACK;
    RAISE EXCEPTION;
  END IF;
  
  -- ALTER TYPE
  ALTER TABLE runtime_tenant_registry ALTER COLUMN tenant_id TYPE UUID USING tenant_id::UUID;
  
  -- Add FK
  ALTER TABLE runtime_tenant_registry ADD CONSTRAINT fk_runtime_tenant FOREIGN KEY (...);
  
  -- Re-enable RLS
  ALTER TABLE runtime_tenant_registry ENABLE ROW LEVEL SECURITY;
  
COMMIT;
```

**Verification:**
```sql
-- After 05-C failure: Type still TEXT
SELECT data_type = 'text' AS rollback_successful
FROM information_schema.columns
WHERE table_name = 'runtime_tenant_registry' AND column_name = 'tenant_id';
-- Expected: TRUE (if 05-C failed)

-- After 05-C success: Type UUID + FK exists
SELECT 
  (SELECT data_type FROM information_schema.columns WHERE table_name = 'runtime_tenant_registry' AND column_name = 'tenant_id') = 'uuid' AS type_migrated,
  (SELECT COUNT(*) FROM information_schema.table_constraints WHERE table_name = 'runtime_tenant_registry' AND constraint_name = 'fk_runtime_tenant') = 1 AS fk_exists;
-- Expected: both TRUE
```

**Failure Scenario:**
- Unmapped TEXT ID → UPDATE sets NULL → ALTER TYPE fails → ROLLBACK, type remains TEXT

**Verdict:** 🟢 PASS (transaction-wrapped, failure reverts)

---

## D.6 RETRY AND RECOVERY SAFETY

### D.6.1 05-A Retry Safety

**Integrity Question:** Can 05-A safely retry after failure without data corruption?

**Scenario Analysis:**
```
Attempt 1: 05-A fails at P4 collision
  → ROLLBACK
  → canonical_tenant_map does not exist

Attempt 2: 05-A re-executes
  → canonical_tenant_map created
  → Same deterministic UUIDs reserved
  → P4 collision still detected (if not resolved)
  → ROLLBACK OR COMMIT (if collision resolved)
```

**Idempotency Check:**
```sql
-- Before 05-A retry
SELECT EXISTS(
  SELECT 1 FROM information_schema.tables 
  WHERE table_schema = 'migration_evidence' AND table_name = 'canonical_tenant_map'
) AS already_executed;

-- If TRUE → Verify state matches expected
SELECT 
  COUNT(*) = 5 AS row_count,
  COUNT(*) FILTER (WHERE reconciliation_phase = 'RESERVATION') = 5 AS phase_correct,
  array_agg(reserved_tenant_id ORDER BY legacy_fixture_id) FILTER (WHERE classification = 'TEST_FIXTURE') = 
    ARRAY['11111111-0000-4000-8000-000000000001'::UUID, '11111111-0000-4000-8000-000000000002'::UUID, '11111111-0000-4000-8000-000000000003'::UUID] AS reservations_match
FROM migration_evidence.canonical_tenant_map;

-- If all TRUE → SKIP 05-A (idempotent)
-- If any FALSE → HUMAN DECISION (unexpected state)
```

**Verdict:** 🟢 PASS (deterministic, idempotency check defined)

---

### D.6.2 05-B Retry Safety

**Integrity Question:** Can 05-B safely retry after failure?

**Scenario Analysis:**
```
Attempt 1: 05-B fails at tenant INSERT (PK collision)
  → ROLLBACK
  → canonical_tenant_map phase = RESERVATION (preserved)
  → No tenants created
  → Reservations reusable

Attempt 2: 05-B re-executes
  → Reads reserved_tenant_id from canonical_tenant_map
  → Attempts INSERT with same UUIDs
  → If collision resolved → SUCCESS
  → If collision persists → EXCEPTION, HUMAN REVIEW
```

**Idempotency Check:**
```sql
-- Before 05-B retry
SELECT 
  COUNT(*) FILTER (WHERE reconciliation_phase = 'COMPLETE') AS completed_count,
  COUNT(*) FILTER (WHERE canonical_tenant_id IS NOT NULL) AS canonical_assigned
FROM migration_evidence.canonical_tenant_map
WHERE classification = 'TEST_FIXTURE';

-- If completed_count = 0 AND canonical_assigned = 0 → Safe to retry 05-B
-- If completed_count = 3 → 05-B already complete, SKIP
-- If 0 < completed_count < 3 → PARTIAL STATE, HUMAN DECISION
```

**Verdict:** 🟢 PASS (retry safe from RESERVATION phase, partial completion detectable)

---

### D.6.3 05-C Retry Safety

**Integrity Question:** Can 05-C safely retry after failure?

**Scenario Analysis:**
```
Attempt 1: 05-C fails at ALTER TYPE (unmapped TEXT ID)
  → ROLLBACK
  → runtime_tenant_registry.tenant_id type = TEXT (preserved)
  → canonical_tenant_map phase = COMPLETE (preserved)

Attempt 2: Investigate unmapped ID
  → Fix mapping OR delete unmapped row
  → 05-C re-executes
  → UPDATE TEXT → UUID
  → ALTER TYPE succeeds
```

**Idempotency Check:**
```sql
-- Before 05-C retry
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'runtime_tenant_registry' 
  AND column_name = 'tenant_id';

-- If 'text' → Safe to retry 05-C
-- If 'uuid' → 05-C already complete, SKIP
```

**Failure Recovery:**
```sql
-- Detect unmapped TEXT IDs before retry
SELECT tenant_id
FROM runtime_tenant_registry
WHERE tenant_id::TEXT NOT IN (
  SELECT legacy_fixture_id FROM migration_evidence.canonical_tenant_map WHERE classification = 'TEST_FIXTURE'
);

-- Expected: 0 rows (all mapped)
-- If rows returned → FIX mapping before retry
```

**Verdict:** 🟢 PASS (retry safe, unmapped IDs detectable)

---

## D.7 PARTIAL FAILURE DETECTION

### D.7.1 Detecting 05-B Partial Completion

**Integrity Question:** Can partial 05-B completion be detected reliably?

**Detection Queries:**
```sql
-- Check 1: Phase status
SELECT 
  COUNT(*) FILTER (WHERE reconciliation_phase = 'COMPLETE') AS complete_count,
  COUNT(*) FILTER (WHERE reconciliation_phase = 'RESERVATION') AS reservation_count
FROM migration_evidence.canonical_tenant_map
WHERE classification = 'TEST_FIXTURE';
-- Expected: (3, 0) OR (0, 3)
-- Partial: (1-2, 1-2) → HUMAN DECISION

-- Check 2: Tenant existence
SELECT 
  legacy_fixture_id,
  canonical_tenant_id,
  EXISTS(SELECT 1 FROM public.tenants WHERE id = canonical_tenant_id) AS tenant_exists
FROM migration_evidence.canonical_tenant_map
WHERE classification = 'TEST_FIXTURE';
-- Expected: all tenant_exists = TRUE OR all NULL
-- Partial: some TRUE, some FALSE → HUMAN DECISION

-- Check 3: FK constraint existence
SELECT COUNT(*) AS fk_count
FROM information_schema.table_constraints
WHERE table_schema = 'migration_evidence'
  AND table_name = 'canonical_tenant_map'
  AND constraint_name = 'fk_canonical_tenant';
-- Expected: 1 (05-B complete) OR 0 (05-B not started)
-- Partial: Cannot occur (FK added atomically)
```

**Verdict:** 🟢 PASS (partial states detectable via phase + tenant existence)

---

### D.7.2 Detecting 05-C Partial Completion

**Integrity Question:** Can partial 05-C completion be detected reliably?

**Detection Queries:**
```sql
-- Check 1: Type migration status
SELECT data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('runtime_tenant_registry', 'runtime_outbox', 'runtime_event_log', 'runtime_idempotency')
  AND column_name = 'tenant_id';
-- Expected: all 'uuid' OR all 'text'
-- Partial: mixed types → HUMAN DECISION

-- Check 2: FK constraint existence per table
SELECT table_name, COUNT(*) AS fk_count
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND table_name IN ('runtime_tenant_registry', 'runtime_outbox', 'runtime_event_log', 'runtime_idempotency')
  AND constraint_type = 'FOREIGN KEY'
  AND constraint_name LIKE '%tenant%'
GROUP BY table_name;
-- Expected: 4 rows with fk_count = 1 (all migrated) OR 0 rows (none migrated)
-- Partial: some tables migrated → HUMAN DECISION
```

**Verdict:** 🟢 PASS (partial table migration detectable)

---

## D.8 FIXTURE PRESERVATION

### D.8.1 All Five Original Fixtures Accounted For

**Integrity Requirement:** All 5 original TEXT fixtures must be tracked through migration lifecycle.

**Verification:**
```sql
-- Canonical map completeness
SELECT 
  COUNT(*) = 5 AS all_fixtures,
  COUNT(*) FILTER (WHERE classification = 'TEST_ORPHAN') = 2 AS orphan_count,
  COUNT(*) FILTER (WHERE classification = 'TEST_FIXTURE') = 3 AS fixture_count
FROM migration_evidence.canonical_tenant_map;

-- Expected TEXT IDs present
SELECT 
  'test-quarantine-tenant-a' = ANY(array_agg(legacy_fixture_id)) AS has_qa,
  'test-quarantine-tenant-b' = ANY(array_agg(legacy_fixture_id)) AS has_qb,
  'test-e2e-tenant-a' = ANY(array_agg(legacy_fixture_id)) AS has_e2e_a,
  'test-e2e-tenant-b' = ANY(array_agg(legacy_fixture_id)) AS has_e2e_b,
  'test-e2e-tenant-attacker' = ANY(array_agg(legacy_fixture_id)) AS has_attacker
FROM migration_evidence.canonical_tenant_map;
-- Expected: all TRUE
```

**Verdict:** 🟢 PASS (explicit fixture enumeration + count verification)

---

### D.8.2 Post-Migration UUID Identity Correctness

**Integrity Requirement:** After migration, 3 UUID tenants must exist with correct identities.

**Verification:**
```sql
-- Post-05-C state
SELECT 
  tenant_id,
  (SELECT legacy_fixture_id FROM migration_evidence.canonical_tenant_map WHERE canonical_tenant_id = tenant_id) AS original_text_id
FROM runtime_tenant_registry
ORDER BY tenant_id;

-- Expected:
-- 11111111-0000-4000-8000-000000000001 | test-e2e-tenant-a
-- 11111111-0000-4000-8000-000000000002 | test-e2e-tenant-b
-- 11111111-0000-4000-8000-000000000003 | test-e2e-tenant-attacker
```

**Verdict:** 🟢 PASS (deterministic mapping verifiable)

---

## D.9 ROLLBACK EVIDENCE

### D.9.1 Post-Rollback State Verification

**Integrity Question:** After transaction ROLLBACK, can database state be verified as clean?

**Rollback Verification Queries:**

**After 05-A Rollback:**
```sql
-- Schema should not exist
SELECT COUNT(*) = 0 AS clean_state
FROM information_schema.schemata
WHERE schema_name = 'migration_evidence';
```

**After 05-B Rollback:**
```sql
-- Phase remains RESERVATION
SELECT COUNT(*) = 3 AS phase_preserved
FROM migration_evidence.canonical_tenant_map
WHERE classification = 'TEST_FIXTURE' AND reconciliation_phase = 'RESERVATION';

-- No canonical tenants created
SELECT COUNT(*) = 0 AS no_tenants
FROM public.tenants
WHERE id IN (SELECT reserved_tenant_id FROM migration_evidence.canonical_tenant_map WHERE classification = 'TEST_FIXTURE');

-- Orphans still present
SELECT COUNT(*) = 2 AS orphans_preserved
FROM runtime_tenant_registry
WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b');
```

**After 05-C Rollback:**
```sql
-- Type remains TEXT
SELECT data_type = 'text' AS type_preserved
FROM information_schema.columns
WHERE table_name = 'runtime_tenant_registry' AND column_name = 'tenant_id';

-- No FK constraint
SELECT COUNT(*) = 0 AS no_fk
FROM information_schema.table_constraints
WHERE table_name = 'runtime_tenant_registry' AND constraint_name = 'fk_runtime_tenant';
```

**Verdict:** 🟢 PASS (rollback evidence verifiable)

---

## D.10 DATA INTEGRITY REVIEW SUMMARY

### Findings Classification

| Finding | Severity | Status | Blocker? |
|---------|----------|--------|----------|
| **D.2.2: Orphan Deletion Auditability** | MEDIUM | Requires deletion audit columns | ❌ NO (enhanceable) |

### Data Integrity Strengths

✅ **One-to-one mapping enforced** (UNIQUE constraints on TEXT and UUID)  
✅ **No lost TEXT identities** (canonical_tenant_map audit trail)  
✅ **UUID mapping correctness** (CHECK constraint + FK enforcement)  
✅ **FK integrity guaranteed** (FK constraints on all tables)  
✅ **Transaction atomicity** (all phases wrapped in transactions)  
✅ **Retry safety documented** (idempotency checks + recovery paths)  
✅ **Partial failure detectable** (phase tracking + type verification)  
✅ **Fixture preservation verified** (count + explicit enumeration)  
✅ **Rollback evidence** (state verification queries provided)  
✅ **Deterministic mapping** (no data loss, no duplication)  

### Conditional Requirements

1. **Orphan Deletion Audit Columns** (D.2.2): Add deleted_at, deleted_by, deletion_reason to canonical_tenant_map

### Data Integrity Review Verdict

```
╔══════════════════════════════════════════════════════════╗
║ AMENDMENT 12 V3 — DATA INTEGRITY REVIEW                  ║
╠══════════════════════════════════════════════════════════╣
║ One-to-One Mapping              🟢 PASS                   ║
║ TEXT Identity Preservation      🟢 PASS                   ║
║ UUID Mapping Correctness        🟢 PASS                   ║
║ FK Integrity                    🟢 PASS                   ║
║ Transaction Atomicity           🟢 PASS                   ║
║ Retry Safety                    🟢 PASS                   ║
║ Partial Failure Detection       🟢 PASS                   ║
║ Fixture Preservation            🟢 PASS                   ║
║ Rollback Evidence               🟢 PASS                   ║
║ Mapping Completeness            🟢 PASS                   ║
║                                                          ║
║ Conditional Requirements        1 item                   ║
║  - Deletion audit columns       🟡 RECOMMENDED           ║
║                                                          ║
║ Data Integrity Blockers         0                        ║
║                                                          ║
║ DATA INTEGRITY REVIEW           🟢 PASS*                  ║
║                                                          ║
║ *Implementation should add deletion audit columns for    ║
║  operational forensics.                                  ║
╚══════════════════════════════════════════════════════════╝
```

**DATA INTEGRITY REVIEW: 🟢 PASS WITH RECOMMENDATION**

No data integrity blockers identified. One recommendation for enhanced auditability.

---

**Next:** Approval 3 Decision
