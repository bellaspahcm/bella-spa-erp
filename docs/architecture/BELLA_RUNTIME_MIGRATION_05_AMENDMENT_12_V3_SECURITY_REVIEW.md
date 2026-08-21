# AMENDMENT 12 V3 — SECURITY REVIEW

**Review Date:** 2026-08-19  
**Reviewer:** Human Architect (Independent Security Review)  
**Amendment:** Migration 05 Identity Reconciliation (Amendment 12 v3)  
**Review Scope:** Tenant isolation, UUID collision attack surface, metadata trust boundary, privilege model, race conditions, identity substitution

---

## SECURITY REVIEW CHARTER

This review evaluates Amendment 12 v3 from a **security perspective**, independent of Architecture Review and Data Integrity Review.

**Focus Areas:**
1. Tenant isolation preservation during TEXT→UUID migration
2. UUID collision attack surface (deliberate vs accidental)
3. Metadata trust boundary (SECURITY DEFINER context)
4. RLS policy preservation across type migration
5. Privilege escalation opportunities during migration
6. Concurrent execution and race-condition security implications
7. Orphan deletion authorization model
8. Identity substitution attack vectors
9. Security behavior under UNKNOWN schema state

**Pass Criteria:** No exploitable vulnerabilities introduced by migration design. Security-sensitive operations have explicit STOP on UNKNOWN state.

---

## S.1 TENANT ISOLATION PRESERVATION

### S.1.1 RLS Policy Continuity

**Threat Model:** Migration temporarily disables RLS or breaks tenant isolation, allowing cross-tenant data access.

**Design Analysis:**
```sql
-- Pre-migration (05-A/05-B)
runtime_tenant_registry: RLS enabled, tenant_id = TEXT
Policy: tenant_id = get_auth_tenant_id()::TEXT

-- During 05-C
ALTER COLUMN tenant_id TYPE UUID
-- RLS potentially disabled during DDL

-- Post-migration
runtime_tenant_registry: RLS re-enabled, tenant_id = UUID
Policy: tenant_id = get_auth_tenant_id()
```

**Attack Vector:**
1. Attacker session active during 05-C
2. RLS disabled during ALTER TABLE
3. Query executes without tenant filter
4. Cross-tenant data leak

**Mitigation in v3:**
- ✅ Migration executes in maintenance window (no active sessions)
- ✅ Post-05-C verification: `SELECT relrowsecurity FROM pg_class WHERE relname = 'runtime_tenant_registry'` → TRUE
- ✅ RLS re-enable is explicit step (not assumed)

**Residual Risk:** LOW (requires maintenance window enforcement)

**Verdict:** 🟢 PASS (with maintenance window requirement)

---

### S.1.2 UUID Determinism and Tenant Identity Stability

**Threat Model:** Non-deterministic UUID generation allows identity substitution across migration retries.

**Design Analysis:**
```sql
-- v3 uses deterministic UUIDs
test-e2e-tenant-a → 11111111-0000-4000-8000-000000000001 (FIXED)
test-e2e-tenant-b → 11111111-0000-4000-8000-000000000002 (FIXED)
test-e2e-tenant-attacker → 11111111-0000-4000-8000-000000000003 (FIXED)
```

**Attack Vector:**
1. Attacker observes 05-A reservation
2. 05-A rolls back due to failure
3. 05-A re-executes with different UUIDs
4. Attacker can no longer correlate TEXT → UUID mapping

**Mitigation in v3:**
- ✅ Deterministic UUID generation (hardcoded mapping)
- ✅ Reservation persists in `canonical_tenant_map` (authoritative)
- ✅ No random UUID fallback

**Residual Risk:** NONE (deterministic by design)

**Verdict:** 🟢 PASS

---

## S.2 UUID COLLISION ATTACK SURFACE

### S.2.1 Deliberate UUID Occupation (Pre-emption Attack)

**Threat Model:** Attacker creates tenant with reserved UUID before 05-B executes, causing migration failure or identity substitution.

**Attack Scenario:**
```sql
-- Attacker discovers reserved UUIDs (e.g., via leaked migration docs)
-- Before 05-B executes:
INSERT INTO public.tenants (id, name, ...) 
VALUES ('11111111-0000-4000-8000-000000000001', 'attacker-tenant', ...);

-- 05-B executes
INSERT INTO public.tenants (id, name, ...) 
VALUES ('11111111-0000-4000-8000-000000000001', 'test-e2e-tenant-a', ...);
-- Result: PK violation → ROLLBACK

-- Migration fails, but attacker now occupies identity
```

**Mitigation in v3:**
- ✅ P4 collision gate detects occupation
- ✅ PK violation in 05-B triggers EXCEPTION with investigation
- ✅ No ON CONFLICT DO NOTHING (collision is NOT silent)
- ✅ HUMAN REVIEW required (no auto-reassignment)

**Attack Success Condition:** Migration STOPS, attacker identity logged, human investigation required

**Verdict:** 🟢 PASS (attack detected, not exploited)

---

### S.2.2 Metadata-Based Collision Camouflage

**Threat Model:** Attacker creates tenant with reserved UUID + matching metadata to bypass P4 detection.

**Attack Scenario:**
```sql
-- Attacker creates tenant mimicking expected fixture
INSERT INTO public.tenants (id, name, metadata)
VALUES (
  '11111111-0000-4000-8000-000000000001',
  'test-e2e-tenant-a',
  '{"provisioned_by": "migration", "fixture_type": "TEST"}'::jsonb
);

-- P4 executes metadata check
SELECT metadata->>'fixture_type' FROM public.tenants WHERE id = '11111111...001';
-- Returns 'TEST' → P4 might classify as "expected" collision
```

**Mitigation in v3:**
- ✅ P4 UNKNOWN state on metadata absence (does NOT trust present metadata as authoritative)
- ⚠️ **GAP:** If metadata exists and matches expected pattern, P4 classification logic unclear

**Required Clarification:**
```sql
-- P4 must distinguish:
TENANT_DOES_NOT_EXIST → safe to reserve
TENANT_EXISTS + METADATA_MISSING → UNKNOWN → STOP
TENANT_EXISTS + METADATA_PRESENT → ??? 
  ├── Created by previous 05-B (legitimate) → allow completion
  └── Created by attacker (malicious) → STOP
```

**Recommendation:** P4 should verify `created_at` timestamp + `provisioned_by` source, not just fixture_type. If tenant exists but was NOT created by this migration session, treat as collision.

**Verdict:** 🟡 CONDITIONAL PASS (requires P4 metadata validation spec)

---

## S.3 METADATA TRUST BOUNDARY

### S.3.1 SECURITY DEFINER Context During Metadata Introspection

**Threat Model:** Migration runs with elevated privileges. Metadata queries could be exploited if attacker controls schema.

**Attack Scenario:**
```sql
-- Attacker (with schema modification privilege) creates malicious view
CREATE VIEW information_schema.columns AS 
SELECT 'uuid' AS data_type, 'tenant_id' AS column_name, ...
WHERE current_user = 'migration_user';

-- P3/E1 executes metadata introspection
SELECT data_type FROM information_schema.columns WHERE ...;
-- Returns attacker-controlled data
```

**Mitigation in v3:**
- ✅ information_schema is system catalog (not user-modifiable)
- ✅ No dynamic SQL from user input
- ⚠️ **ASSUMPTION:** Migration runs as superuser or with sufficient privilege to read pg_catalog

**Residual Risk:** LOW (requires schema-level privilege escalation)

**Verdict:** 🟢 PASS (information_schema is trusted boundary)

---

### S.3.2 Metadata Type Confusion

**Threat Model:** Attacker modifies metadata column to incompatible type, causing security gate bypass.

**Attack Scenario:**
```sql
-- Before migration
ALTER TABLE public.tenants ALTER COLUMN metadata TYPE TEXT;

-- P3 schema check
SELECT data_type FROM information_schema.columns WHERE column_name = 'metadata';
-- Returns 'text' instead of 'jsonb'

-- P4 collision gate executes
SELECT metadata->>'fixture_type' FROM public.tenants WHERE ...;
-- Syntax error (TEXT does not support ->> operator)
-- Exception handler might silently treat as "no metadata" → UNKNOWN
```

**Mitigation in v3:**
- ✅ P3 explicitly checks `data_type = 'jsonb'`
- ✅ Wrong type → EXCEPTION → STOP
- ✅ No silent degradation

**Verdict:** 🟢 PASS (type validation explicit)

---

## S.4 PRIVILEGE MODEL

### S.4.1 Migration Privilege Requirements

**Threat Model:** Migration requires excessive privileges, increasing blast radius of compromise.

**Required Privileges (v3 design):**
```sql
-- Schema creation
CREATE SCHEMA migration_evidence;  -- requires CREATE privilege

-- Table operations
CREATE TABLE canonical_tenant_map;  -- requires CREATE privilege
ALTER TABLE canonical_tenant_map ADD CONSTRAINT;  -- requires ALTER privilege

-- Data operations
INSERT INTO public.tenants;  -- requires INSERT privilege
UPDATE canonical_tenant_map;  -- requires UPDATE privilege
DELETE FROM runtime_tenant_registry;  -- requires DELETE privilege

-- Type migration
ALTER TABLE runtime_tenant_registry ALTER COLUMN;  -- requires ALTER privilege
ALTER TABLE runtime_tenant_registry ADD CONSTRAINT;  -- requires ALTER + REFERENCES privilege

-- RLS operations
ALTER TABLE runtime_tenant_registry ENABLE ROW LEVEL SECURITY;  -- requires superuser or BYPASSRLS
```

**Privilege Escalation Surface:**
- ⚠️ **CONCERN:** Migration likely requires superuser or elevated role
- ⚠️ **CONCERN:** If migration script compromised, attacker has full table access

**Mitigation:**
- ✅ Migration executes in maintenance window (no concurrent user sessions)
- ✅ Migration script version-controlled and reviewed
- ⚠️ **GAP:** No dedicated migration role with minimal privileges

**Recommendation:** Define migration role with exact privileges (not superuser). Example:
```sql
CREATE ROLE bella_migration_05;
GRANT CREATE ON SCHEMA public TO bella_migration_05;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenants TO bella_migration_05;
GRANT ALL ON SCHEMA migration_evidence TO bella_migration_05;
-- etc.
```

**Verdict:** 🟡 CONDITIONAL PASS (requires privilege minimization spec)

---

### S.4.2 Post-Migration Privilege Cleanup

**Threat Model:** Migration role persists with elevated privileges after completion.

**Design Analysis:**
- ❌ **GAP:** v3 does not specify post-migration privilege revocation

**Recommendation:**
```sql
-- After Post-05-C PASS
REVOKE ALL ON migration_evidence.canonical_tenant_map FROM bella_migration_05;
-- Or: DROP ROLE bella_migration_05;
```

**Verdict:** 🟡 ADVISORY (not blocker, but best practice)

---

## S.5 RACE CONDITIONS AND CONCURRENT EXECUTION

### S.5.1 Concurrent Migration Execution

**Threat Model:** Two migration sessions execute simultaneously, causing identity collision or data corruption.

**Attack Scenario:**
```sql
-- Session A and Session B both execute 05-A
-- Both reserve same UUIDs (deterministic)
-- Session A: 05-B INSERT tenant '11111111...001'
-- Session B: 05-B INSERT tenant '11111111...001'
-- Result: PK violation in one session
```

**Mitigation in v3:**
- ✅ Advisory lock mentioned (`pg_advisory_xact_lock`)
- ✅ PK violation triggers EXCEPTION with investigation
- ⚠️ **GAP:** Advisory lock acquisition strategy not fully specified

**Required Specification:**
```sql
-- 05-A should acquire lock at start
SELECT pg_advisory_xact_lock(hashtext('BELLA_MIGRATION_05'));

-- Lock released at transaction end (automatic)
```

**Verdict:** 🟡 CONDITIONAL PASS (requires explicit lock acquisition in 05-A/05-B)

---

### S.5.2 Race Between P4 Check and 05-B INSERT

**Threat Model:** UUID becomes occupied between P4 PASS and 05-B execution (TOCTOU vulnerability).

**Time-of-Check to Time-of-Use Gap:**
```
T1: P4 checks UUID available → PASS
T2: External process creates tenant with same UUID
T3: 05-B INSERT fails with PK violation
```

**Mitigation in v3:**
- ✅ P4 and 05-B in same transaction (05-A transaction scope)
- ✅ PK constraint is ultimate enforcement
- ✅ Exception handler logs collision details

**Security Impact:** Migration STOPS (safe failure), no identity substitution

**Verdict:** 🟢 PASS (TOCTOU mitigated by transaction + PK enforcement)

---

## S.6 ORPHAN DELETION AUTHORIZATION

### S.6.1 Orphan Misclassification Attack

**Threat Model:** Attacker manipulates classification logic to cause production tenant deletion.

**Attack Scenario:**
```sql
-- Attacker creates tenant within test window
INSERT INTO runtime_tenant_registry (tenant_id, created_at)
VALUES ('production-tenant-x', NOW());  -- Looks like test fixture

-- E2-D: Test window check
SELECT created_at BETWEEN '2026-08-18' AND '2026-08-19' FROM runtime_tenant_registry WHERE tenant_id = 'production-tenant-x';
-- Returns TRUE → classified as TEST_ORPHAN

-- 05-B: Orphan deletion
DELETE FROM runtime_tenant_registry WHERE tenant_id IN (SELECT ... WHERE classification = 'TEST_ORPHAN');
-- Production tenant deleted
```

**Mitigation in v3:**
- ✅ E2-A: Expected count = 2 (fixed)
- ✅ E2-B: Known set check (only quarantine-tenant-a/b)
- ✅ E2-C: FK reference check
- ✅ E2-D: Temporal validation (test window)

**Security Properties:**
- If orphan count != 2 → STOP
- If orphan ID not in known set → STOP
- Multi-stage verification prevents misclassification

**Verdict:** 🟢 PASS (E2 gate is defense-in-depth)

---

### S.6.2 Authorization for Deletion Operation

**Threat Model:** Migration deletes tenant data without proper authorization model.

**Design Analysis:**
- ✅ Deletion targets TEST_ORPHAN only (not production)
- ✅ E2 gate validates deletion safety
- ⚠️ **ASSUMPTION:** Migration executor has authorization to delete test fixtures

**Recommendation:** Explicit authorization check before E2:
```sql
-- Verify current role has deletion authority
IF current_user NOT IN ('migration_admin', 'dba') THEN
  RAISE EXCEPTION 'Insufficient privilege for orphan deletion';
END IF;
```

**Verdict:** 🟡 ADVISORY (role-based deletion control)

---

## S.7 IDENTITY SUBSTITUTION ATTACK VECTORS

### S.7.1 Mapping Table Tampering

**Threat Model:** Attacker modifies `canonical_tenant_map` to redirect TEXT identity to attacker-controlled UUID.

**Attack Scenario:**
```sql
-- Before 05-C
UPDATE migration_evidence.canonical_tenant_map
SET canonical_tenant_id = 'attacker-uuid'
WHERE legacy_fixture_id = 'test-e2e-tenant-a';

-- 05-C executes
UPDATE runtime_tenant_registry
SET tenant_id = (SELECT canonical_tenant_id::TEXT FROM canonical_tenant_map WHERE legacy_fixture_id = 'test-e2e-tenant-a');
-- tenant_id now points to attacker tenant
```

**Mitigation in v3:**
- ✅ FK constraint from canonical_tenant_id to public.tenants(id)
  - If attacker UUID does not exist in public.tenants → FK violation → EXCEPTION
- ✅ Phase = COMPLETE check
  - If canonical_tenant_id changed after COMPLETE → audit trail exists
- ⚠️ **GAP:** No immutability enforcement on canonical_tenant_id after phase = COMPLETE

**Recommendation:** Add trigger or CHECK constraint:
```sql
CREATE TRIGGER prevent_canonical_id_change
BEFORE UPDATE OF canonical_tenant_id ON migration_evidence.canonical_tenant_map
FOR EACH ROW
WHEN (OLD.reconciliation_phase = 'COMPLETE' AND OLD.canonical_tenant_id IS DISTINCT FROM NEW.canonical_tenant_id)
EXECUTE FUNCTION raise_exception('Cannot modify canonical_tenant_id after COMPLETE phase');
```

**Verdict:** 🟡 CONDITIONAL PASS (requires immutability enforcement)

---

### S.7.2 TEXT ID Confusion During 05-C

**Threat Model:** Attacker creates TEXT ID matching expected fixture name, causing 05-C to migrate wrong entity.

**Attack Scenario:**
```sql
-- Before 05-A classification
INSERT INTO runtime_tenant_registry (tenant_id, created_at)
VALUES ('test-e2e-tenant-a', NOW());  -- Attacker-created fixture with same name

-- 05-A classification
-- Discovers 2 rows with tenant_id = 'test-e2e-tenant-a' (original + attacker)
-- Mapping becomes ambiguous
```

**Mitigation in v3:**
- ✅ Fixture count verification in E1/E2
- ✅ UNIQUE constraint on legacy_fixture_id in canonical_tenant_map
  - Duplicate TEXT ID → unique_violation → EXCEPTION
- ✅ No fuzzy matching (explicit mapping only)

**Verdict:** 🟢 PASS (duplicate TEXT ID detected via UNIQUE constraint)

---

## S.8 SECURITY BEHAVIOR UNDER UNKNOWN STATE

### S.8.1 Missing Metadata Column

**Threat Model:** Metadata column missing, security gate cannot classify collision.

**Design Behavior (v3):**
```sql
-- P4 collision gate
SELECT column_name FROM information_schema.columns WHERE column_name = 'metadata';
-- Returns 0 rows

-- P4 classification logic
IF metadata_column_exists THEN
  classify_tenant()
ELSE
  RAISE WARNING 'Metadata column missing';
  classification := 'UNKNOWN';
  RAISE EXCEPTION 'Cannot verify collision safety';
END IF;
```

**Security Property:** UNKNOWN → STOP (no degradation)

**Verdict:** 🟢 PASS (explicit STOP on UNKNOWN)

---

### S.8.2 Unsupported Metadata Type

**Threat Model:** Metadata column exists but has unsupported type (e.g., TEXT instead of JSONB).

**Design Behavior (v3):**
```sql
-- P3 schema validation
SELECT data_type FROM information_schema.columns WHERE column_name = 'metadata';
-- Returns 'text'

IF data_type != 'jsonb' THEN
  RAISE EXCEPTION 'Metadata column type unsupported: %', data_type;
END IF;
```

**Security Property:** Wrong type → EXCEPTION → STOP

**Verdict:** 🟢 PASS (type validation explicit)

---

## S.9 SECURITY REVIEW SUMMARY

### Findings Classification

| Finding | Severity | Status | Blocker? |
|---------|----------|--------|----------|
| **S.2.2: Metadata-Based Collision Camouflage** | MEDIUM | Requires P4 metadata validation spec | ❌ NO (mitigatable) |
| **S.4.1: Excessive Migration Privileges** | MEDIUM | Requires privilege minimization spec | ❌ NO (operational) |
| **S.4.2: Post-Migration Privilege Cleanup** | LOW | Advisory (best practice) | ❌ NO |
| **S.5.1: Advisory Lock Specification** | MEDIUM | Requires explicit lock in 05-A | ❌ NO (already mentioned) |
| **S.6.2: Deletion Authorization Model** | LOW | Advisory (role check) | ❌ NO |
| **S.7.1: Mapping Immutability** | MEDIUM | Requires trigger/constraint | ❌ NO (mitigatable) |

### Security Strengths

✅ **Tenant isolation preserved** (RLS continuity verified)  
✅ **UUID collision detected** (no silent failure)  
✅ **UNKNOWN state → STOP** (no security degradation)  
✅ **Deterministic mapping** (no identity substitution)  
✅ **E2 defense-in-depth** (orphan deletion multi-stage)  
✅ **Transaction atomicity** (TOCTOU mitigated)  
✅ **FK enforcement** (orphan UUID prevention)  
✅ **No fuzzy matching** (explicit mapping only)  

### Conditional Requirements

1. **P4 Metadata Validation Spec** (S.2.2): P4 must verify `created_at` + `provisioned_by` to distinguish legitimate vs attacker-created collision
2. **Advisory Lock Acquisition** (S.5.1): 05-A must explicitly acquire `pg_advisory_xact_lock(hashtext('BELLA_MIGRATION_05'))`
3. **Mapping Immutability** (S.7.1): Add trigger to prevent canonical_tenant_id modification after COMPLETE phase

### Security Review Verdict

```
╔══════════════════════════════════════════════════════════╗
║ AMENDMENT 12 V3 — SECURITY REVIEW                        ║
╠══════════════════════════════════════════════════════════╣
║ Tenant Isolation               🟢 PASS                    ║
║ UUID Determinism                🟢 PASS                    ║
║ Collision Detection             🟢 PASS                    ║
║ Metadata Trust Boundary         🟢 PASS                    ║
║ UNKNOWN State Behavior          🟢 PASS                    ║
║ TOCTOU Mitigation               🟢 PASS                    ║
║ Orphan Deletion Safety          🟢 PASS                    ║
║ Identity Substitution Defense   🟢 PASS                    ║
║                                                          ║
║ Conditional Requirements        3 items                  ║
║  - P4 metadata validation       🟡 SPEC REQUIRED         ║
║  - Advisory lock explicit       🟡 SPEC REQUIRED         ║
║  - Mapping immutability         🟡 RECOMMENDED           ║
║                                                          ║
║ Security Blockers               0                        ║
║                                                          ║
║ SECURITY REVIEW                 🟢 PASS*                  ║
║                                                          ║
║ *Implementation must address conditional requirements    ║
║  before execution.                                       ║
╚══════════════════════════════════════════════════════════╝
```

**SECURITY REVIEW: 🟢 PASS WITH CONDITIONS**

No security blockers identified. Three conditional requirements must be addressed in implementation (not design revision).

---

**Next:** Data Integrity Review
