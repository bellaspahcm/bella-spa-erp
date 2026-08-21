# AMENDMENT 12 V3 — CRITICAL CORRECTIONS SUMMARY

**Status:** v2 REJECTED by Architecture Review  
**Date:** 2026-08-19  
**Action:** Apply 3 MANDATORY corrections before Approval 3 consideration  

---

## ARCHITECTURE REVIEW RESULT

```
╔══════════════════════════════════════════════════════════════╗
║ AMENDMENT 12 v2 ARCHITECTURE REVIEW                         ║
╠══════════════════════════════════════════════════════════════╣
║ Result: 🔴 HOLD — NOT READY FOR APPROVAL 3                  ║
║                                                              ║
║ NEW BLOCKERS FOUND: 4                                        ║
║ - Blocker 1: FK circular dependency (CRITICAL)               ║
║ - Blocker 2: PostgreSQL DDL syntax error (CRITICAL)          ║
║ - Blocker 3: Metadata assumptions in security gates (HIGH)   ║
║ - Issue 4: Status column assumption (MEDIUM)                 ║
║                                                              ║
║ MANDATORY CORRECTIONS: 3                                     ║
║ 1. Separate reserved_tenant_id from canonical_tenant_id      ║
║ 2. Fix PostgreSQL partial unique constraint syntax           ║
║ 3. Eliminate ALL schema assumptions (including P4/E1)        ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 🔴 BLOCKER 1: FK Circular Dependency NOT Solved

### Problem in v2

```sql
canonical_tenant_id UUID REFERENCES public.tenants(id)
```

**Phase 1 (05-A):** Reserve UUID `11111111-0000-4000-8000-000000000001`  
**Problem:** PostgreSQL FK constraint requires tenant with that UUID to EXIST  
**Result:** `INSERT ... violates foreign key constraint`

**v2 did NOT solve circular dependency, only moved it from application logic to database FK dependency.**

### Mandatory Correction 1: Separate Reservation from Canonical Identity

```sql
CREATE TABLE migration_evidence.canonical_tenant_map (
  legacy_fixture_id TEXT PRIMARY KEY,
  
  -- Phase 1: Reserved (NO FK)
  reserved_tenant_id UUID,
  
  -- Phase 2: Canonical (WITH FK, added by 05-B)
  canonical_tenant_id UUID,
  
  reconciliation_phase TEXT CHECK (reconciliation_phase IN ('RESERVATION', 'COMPLETE')),
  ...
);

-- FK added by 05-B AFTER tenants created
-- NOT during table creation
```

**Flow:**
```
05-A: INSERT reserved_tenant_id (NO FK required)
  ↓
05-B: CREATE public.tenants(id = reserved_tenant_id)
  ↓
05-B: UPDATE canonical_tenant_id = reserved_tenant_id
  ↓
05-B: ALTER TABLE ADD CONSTRAINT FK
```

---

## 🔴 BLOCKER 2: PostgreSQL DDL Syntax Error

### Problem in v2

```sql
CONSTRAINT unique_canonical_mapping 
  UNIQUE (canonical_tenant_id) 
  WHERE canonical_tenant_id IS NOT NULL  -- ❌ INVALID in CREATE TABLE
```

**PostgreSQL does NOT support `WHERE` clause in table-level UNIQUE constraint.**

### Mandatory Correction 2: Use Partial Unique INDEX

```sql
-- Remove from CREATE TABLE constraint section

-- Add AFTER table creation
CREATE UNIQUE INDEX uq_canonical_map_canonical_uuid
  ON migration_evidence.canonical_tenant_map(canonical_tenant_id)
  WHERE canonical_tenant_id IS NOT NULL;  -- ✅ VALID in CREATE INDEX
```

---

## 🔴 BLOCKER 3: Metadata Assumptions in Security Gates

### Problem in v2

**Fix 3 claimed:** "No assumptions about metadata"

**But P4 collision gate has:**
```sql
COALESCE(metadata->>'test_infrastructure', 'false')::BOOLEAN  -- ❌ Assumes metadata EXISTS
```

**And E1.3 has:**
```sql
WHERE metadata->>'test_infrastructure' = 'true'  -- ❌ Assumes metadata EXISTS
```

**Contradiction:** Cannot claim "no assumptions" while security gates assume metadata column exists.

### Mandatory Correction 3: Schema-Safe Security Gates

```sql
-- P4 Collision Gate (SCHEMA-SAFE)
DO $$
DECLARE
  v_has_metadata BOOLEAN;
  v_collision_record RECORD;
BEGIN
  -- Introspect schema FIRST
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'tenants' 
      AND column_name = 'metadata'
      AND data_type = 'jsonb'
  ) INTO v_has_metadata;
  
  -- Conditional collision analysis
  IF v_has_metadata THEN
    -- Full analysis with metadata
    FOR v_collision_record IN
      SELECT 
        id,
        name,
        (metadata->>'test_infrastructure')::BOOLEAN AS is_test_infra
      FROM public.tenants
      WHERE id IN (...reserved UUIDs...)
    LOOP
      -- Analyze collision with metadata context
    END LOOP;
  ELSE
    -- Degraded analysis WITHOUT metadata
    FOR v_collision_record IN
      SELECT 
        id,
        name,
        NULL::BOOLEAN AS is_test_infra  -- Unknown
      FROM public.tenants
      WHERE id IN (...reserved UUIDs...)
    LOOP
      -- Treat collision as UNKNOWN classification → STOP
      RAISE EXCEPTION 'UUID collision detected. Cannot determine if test infrastructure (metadata column unavailable). HUMAN REVIEW REQUIRED.';
    END LOOP;
  END IF;
END $$;
```

**Key Principle:**
```
Creation logic: CAN gracefully degrade
Security gates: CANNOT gracefully degrade → STOP on unknown
```

---

## 🟠 ISSUE 4: Status Column Still Assumed

### Problem in v2

**Fallback branch:**
```sql
INSERT INTO public.tenants (id, name, status, created_at)  -- ❌ Still assumes status exists
```

**If `status` column does not exist, fallback will also fail.**

### Correction: Truly Dynamic INSERT

```sql
-- Build INSERT statement based on actual schema
DECLARE
  v_has_metadata BOOLEAN;
  v_has_status BOOLEAN;
  v_has_created_at BOOLEAN;
  v_insert_sql TEXT;
BEGIN
  -- Introspect ALL optional columns
  SELECT EXISTS(...) INTO v_has_metadata FROM information_schema.columns ...;
  SELECT EXISTS(...) INTO v_has_status FROM information_schema.columns ...;
  SELECT EXISTS(...) INTO v_has_created_at FROM information_schema.columns ...;
  
  -- Build INSERT dynamically
  v_insert_sql := 'INSERT INTO public.tenants (id, name';
  
  IF v_has_status THEN
    v_insert_sql := v_insert_sql || ', status';
  END IF;
  
  IF v_has_metadata THEN
    v_insert_sql := v_insert_sql || ', metadata';
  END IF;
  
  IF v_has_created_at THEN
    v_insert_sql := v_insert_sql || ', created_at';
  END IF;
  
  v_insert_sql := v_insert_sql || ') VALUES ($1, $2';
  
  -- Build VALUES clause matching columns
  -- Execute with EXECUTE ... USING
END;
```

**OR simpler:** Define MINIMUM required columns explicitly:
```
REQUIRED: id, name (only these assumed)
OPTIONAL: status, metadata, created_at (all introspected)
```

---

## 🟠 ISSUE 5: P4/05-B Race Condition

### Problem

```
Time T1: P4 checks UUID available → PASS
Time T2: Another transaction inserts same UUID
Time T3: 05-B attempts INSERT → PK violation
```

**P4 is NOT a guarantee.**

### Mitigation

1. **Transaction Isolation:** 05-A and 05-B should run in same transaction OR with advisory locks
2. **PK Collision Handling:** 05-B should treat PK violation as STOP + HUMAN REVIEW, NOT auto-recovery
3. **Idempotency Check:** Before 05-B INSERT, verify UUID still available

```sql
-- 05-B: Final collision check before INSERT
DO $$
BEGIN
  IF EXISTS(SELECT 1 FROM public.tenants WHERE id IN (...reserved UUIDs...)) THEN
    RAISE EXCEPTION 'UUID collision detected at 05-B execution time. Reserved UUIDs occupied between P4 and 05-B. STOP.';
  END IF;
  
  -- Proceed with INSERT
  INSERT INTO public.tenants ...;
  
  -- Handle PK violation as STOP
EXCEPTION
  WHEN unique_violation THEN
    RAISE EXCEPTION 'PK collision during 05-B INSERT. Reserved UUID already occupied. HUMAN REVIEW REQUIRED.';
END $$;
```

---

## 🟠 ISSUE 6: Orphan Deletion Safety Gate Missing

### Problem

```sql
DELETE FROM runtime_tenant_registry
WHERE tenant_id IN (
  SELECT legacy_fixture_id 
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_ORPHAN'
);
```

**Deletes based ONLY on classification. No verification that:**
- Fixtures belong to known test set
- No unexpected FK references exist
- Row count matches expectations

### Required: E2 Orphan Deletion Verification Gate

```sql
-- E2: Before DELETE, verify safety invariants
DO $$
DECLARE
  v_expected_orphan_count INT := 2;  -- test-quarantine-tenant-a/b
  v_actual_orphan_count INT;
  v_orphan_fixture TEXT;
BEGIN
  -- Verify orphan count matches expectation
  SELECT COUNT(*) INTO v_actual_orphan_count
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_ORPHAN';
  
  IF v_actual_orphan_count != v_expected_orphan_count THEN
    RAISE EXCEPTION 'E2 ORPHAN COUNT MISMATCH: Expected %, found %. STOP before DELETE.',
      v_expected_orphan_count, v_actual_orphan_count;
  END IF;
  
  -- Verify each orphan is in known test set
  FOR v_orphan_fixture IN
    SELECT legacy_fixture_id 
    FROM migration_evidence.canonical_tenant_map
    WHERE classification = 'TEST_ORPHAN'
  LOOP
    IF v_orphan_fixture NOT IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b') THEN
      RAISE EXCEPTION 'E2 UNKNOWN ORPHAN: % not in known test fixture set. STOP.',
        v_orphan_fixture;
    END IF;
  END LOOP;
  
  -- Verify no unexpected FK references exist
  -- (Check runtime child tables, etc.)
  
  RAISE NOTICE 'E2 ORPHAN SAFETY CHECK: PASS';
END $$;

-- ONLY AFTER E2 PASS: Execute DELETE
DELETE FROM runtime_tenant_registry
WHERE tenant_id IN (
  SELECT legacy_fixture_id 
  FROM migration_evidence.canonical_tenant_map
  WHERE classification = 'TEST_ORPHAN'
);
```

---

## ✅ APPROVED ASPECTS OF V2 (Keep These)

1. **UUID-authoritative identity** 🟢 PASS
2. **Slug removal** 🟢 PASS
3. **Explicit mapping concept** 🟢 PASS
4. **Approval 2 governance wording** 🟢 PASS
5. **Collision philosophy (STOP + human decision)** 🟢 PASS

---

## REQUIRED v3 STRUCTURE

```
migration_evidence.canonical_tenant_map:
  ├── reserved_tenant_id UUID (NO FK during 05-A)
  ├── canonical_tenant_id UUID (FK added by 05-B)
  ├── reconciliation_phase (RESERVATION | COMPLETE)
  └── CHECK constraints enforce phase invariants

05-A:
  ├── Reserve UUIDs (reserved_tenant_id)
  ├── P4: Schema-safe collision check
  └── NO FK required

05-B:
  ├── P3: Schema introspection (ALL columns)
  ├── CREATE tenants (reserved_tenant_id)
  ├── UPDATE canonical_tenant_id = reserved_tenant_id
  ├── ADD FK constraint
  └── E2: Orphan deletion safety gate

05-C:
  └── Use canonical_tenant_id from completed mapping
```

---

## GOVERNANCE DECISION

**🔴 APPROVAL 3: DENIED**

**Reason:** 4 new critical logic errors in v2

**Required Before Resubmission:**
1. ✅ Apply Mandatory Correction 1 (reserved vs canonical separation)
2. ✅ Apply Mandatory Correction 2 (PostgreSQL DDL syntax fix)
3. ✅ Apply Mandatory Correction 3 (eliminate ALL schema assumptions)
4. ✅ Address Issue 4 (dynamic INSERT or explicit required columns)
5. ✅ Address Issue 5 (race condition mitigation)
6. ✅ Address Issue 6 (E2 orphan deletion safety gate)

**Database Status:** 🟢 SAFE — 0 mutations, integrity preserved

**Next Step:** Create Amendment 12 v3 with all 6 corrections, then Architecture Review again

---

**END OF V3 CORRECTIONS SUMMARY**
