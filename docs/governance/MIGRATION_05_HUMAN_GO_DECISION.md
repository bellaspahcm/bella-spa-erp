# MIGRATION 05 — HUMAN GO DECISION DOCUMENT

**Amendment:** Amendment 12 v3  
**Migration:** 05-A/B/C Identity Reconciliation  
**Date:** 2026-08-20  
**Status:** 🟡 HOLD (Pending 3 Mandatory Conditions)  

---

## EXECUTIVE SUMMARY

**Automated Verification Status:** ✅ COMPLETE (126/126 checks PASS)  
**Database Mutations to Date:** 0 (verified 4 times)  
**Human GO Decision:** 🟡 **HOLD**  

**Reason for HOLD:**  
126/126 automated verification proves readiness for human review, NOT authorization for execution. Human GO requires explicit confirmation of:
1. Backup created and verified
2. Monitoring plan confirmed
3. Execution scope confirmed

**Migration will NOT execute until all 3 conditions satisfied.**

---

## GOVERNANCE PRINCIPLE

### Verification ≠ Authorization

**Automated Verification (COMPLETE):**
- Package Integrity: 52/52 PASS
- E0 Gate: 33/33 PASS
- Rollback Test: 31/31 PASS
- E1 Gate: 10/10 PASS
- **Total: 126/126 PASS**

**Human Authorization (PENDING):**
- Backup: ❌ NOT CONFIRMED
- Monitoring: ❌ NOT CONFIRMED
- Scope: ❌ NOT CONFIRMED

**Interpretation:**
> 126/126 PASS proves: "Hệ thống đã hoàn tất các lớp xác minh trước triển khai và đủ điều kiện để con người đưa ra quyết định cuối cùng."
> 
> 126/126 PASS does NOT prove: "Migration an toàn tuyệt đối" or "Approved for execution."

---

## 3 MANDATORY CONDITIONS FOR GO

### CONDITION 1: BACKUP VERIFICATION (MANDATORY)

**Requirement:**  
Database backup must be created, verified, and documented BEFORE any migration execution.

**Critical Distinction:**
> **Rollback Test PASS ≠ Backup.**
> 
> - Rollback Test proves: Transaction can rollback in tested failure scenarios
> - Backup provides: Independent full database restoration capability
> 
> Rollback Test operates within transaction boundaries. Backup protects against:
> - Environmental failures (disk, network, server crash)
> - Scenarios outside transaction scope
> - Catastrophic errors requiring full database restoration

**Action Required:**
```bash
# 1. Create timestamped backup
pg_dump $DATABASE_URL > backup_pre_migration_05_$(date +%Y%m%d_%H%M%S).sql

# 2. Verify backup file
ls -lh backup_pre_migration_05_*.sql

# 3. Verify backup contains SQL
head -n 20 backup_pre_migration_05_*.sql
tail -n 20 backup_pre_migration_05_*.sql

# 4. Document backup metadata
# - Filename
# - File size
# - Timestamp
# - Location
# - Restore command
```

**Evidence Required:**
- ✅ Backup filename with timestamp
- ✅ File size > 0 bytes (document exact size)
- ✅ File contains valid SQL (verified header/footer)
- ✅ Backup location documented
- ✅ Restore procedure documented

**Restore Command (for reference):**
```bash
# If rollback needed
psql $DATABASE_URL < backup_pre_migration_05_YYYYMMDD_HHMMSS.sql
```

**Status:** ❌ **NOT CONFIRMED**

---

### CONDITION 2: MONITORING PLAN (MANDATORY)

**Requirement:**  
Explicit monitoring plan with STOP criteria at each gate. NO automatic progression on gate failure.

**Monitoring Checkpoints:**

```
┌─────────────────────────────────────────────────────────┐
│ CONTROLLED EXECUTION FLOW                               │
└─────────────────────────────────────────────────────────┘

START
  ↓
[CHECKPOINT 1] Deploy E1 Gate Function
  ✓ Verify: Function migration_05_e1_gate() created
  ✓ Verify: Function returns TABLE
  ✗ If FAIL: STOP, investigate deployment error
  ↓
[CHECKPOINT 2] Execute 05-A (Classification + Reservation)
  ✓ Monitor: CREATE SCHEMA migration_evidence
  ✓ Monitor: CREATE TABLE canonical_tenant_map
  ✓ Monitor: INSERT 5 classification rows
  ✓ Monitor: P3, P4 collision gates execute
  ✗ If FAIL: Transaction auto-rollback, investigate
  ↓
[CHECKPOINT 3] E2 Gate (Orphan Safety) — EMBEDDED IN 05-A
  ✓ Verify: E2 executes 5-stage verification
  ✓ Verify: E2 status = PASS
  ✗ If E2 FAIL: 
     → STOP IMMEDIATELY
     → DO NOT PROCEED TO 05-B
     → Transaction auto-rollback
     → Investigate E2 failure reason
     → Decision: fix and retry OR abort
  ↓
[CHECKPOINT 4] Execute 05-B (Tenant Creation + Cleanup)
  ✓ Monitor: CREATE 3 canonical tenants in public.tenants
  ✓ Monitor: UPDATE canonical_tenant_map (RESERVATION → COMPLETE)
  ✓ Monitor: ADD FK constraint (canonical_tenant_id → public.tenants.id)
  ✓ Monitor: DELETE 2 orphans from runtime_tenant_registry
  ✗ If FAIL: Transaction auto-rollback, investigate
  ↓
[CHECKPOINT 5] Manual Verification (05-B Results)
  ✓ Verify: SELECT COUNT(*) FROM public.tenants WHERE id IN (3 reserved UUIDs) = 3
  ✓ Verify: SELECT COUNT(*) FROM runtime_tenant_registry WHERE tenant_id IN (2 orphans) = 0
  ✓ Verify: FK constraint exists on canonical_tenant_map.canonical_tenant_id
  ✗ If COUNT MISMATCH:
     → STOP IMMEDIATELY
     → DO NOT PROCEED TO 05-C
     → Investigate data integrity issue
     → Decision: rollback OR fix
  ↓
[CHECKPOINT 6] Execute 05-C (TEXT→UUID Type Migration)
  ✓ Monitor: UPDATE runtime_tenant_registry.tenant_id (TEXT → UUID mapping)
  ✓ Monitor: ALTER COLUMN tenant_id TYPE uuid
  ✓ Monitor: ADD FK constraints (runtime → public.tenants)
  ✓ Monitor: RLS preservation verification
  ✗ If FAIL: Transaction auto-rollback, investigate
  ↓
[CHECKPOINT 7] E3 Gate (Post-05-C Verification)
  ✓ Verify: E3 executes 10 verification checks
  ✓ Verify: E3 status = PASS
  ✗ If E3 FAIL:
     → STOP IMMEDIATELY
     → Investigate E3 failure reason
     → Type migration may be partially complete
     → Review necessity of full rollback
     → Decision: fix OR full database restore
  ↓
[CHECKPOINT 8] Final State Verification
  ✓ Verify: SELECT COUNT(*) FROM runtime_tenant_registry WHERE tenant_id::text LIKE 'test-%' = 0
  ✓ Verify: All FK constraints added
  ✓ Verify: RLS policies preserved
  ✓ Verify: 3 canonical tenants exist
  ✗ If FAIL: Investigate data integrity
  ↓
COMPLETE ✅
```

**Gate Failure Protocol:**

| Gate | Type | Failure Action | Rollback |
|------|------|----------------|----------|
| **E2 (Orphan Safety)** | Automatic | EXCEPTION raised → STOP | Transaction auto-rollback |
| **05-B Manual Verification** | Manual | Human decision → STOP if mismatch | Manual rollback if needed |
| **E3 (Post-05-C)** | Automatic | EXCEPTION raised → STOP | Transaction auto-rollback OR full restore |

**CRITICAL RULE:**
> At ANY checkpoint failure: STOP, investigate, decide. DO NOT proceed blindly.

**Status:** ❌ **NOT CONFIRMED**

---

### CONDITION 3: SCOPE CONFIRMATION (MANDATORY)

**Requirement:**  
Human GO authorizes ONLY migrations 05-A, 05-B, 05-C as documented in Amendment 12 v3. Any deviation requires NEW Human GO decision.

**Authorized Mutations (EXHAUSTIVE LIST):**

#### Migration 05-A: Classification + Reservation
1. `CREATE SCHEMA migration_evidence`
2. `CREATE TABLE migration_evidence.canonical_tenant_map` with columns:
   - `id` (SERIAL PRIMARY KEY)
   - `legacy_fixture_id` (TEXT UNIQUE NOT NULL)
   - `reserved_tenant_id` (UUID, NO FK during reservation)
   - `canonical_tenant_id` (UUID, FK added by 05-B)
   - `classification` (TEXT NOT NULL)
   - `reconciliation_reason` (TEXT)
   - `reconciliation_phase` (TEXT NOT NULL)
   - `created_at` (TIMESTAMPTZ)
   - `deleted_at` (TIMESTAMPTZ)
   - `deleted_by` (TEXT)
   - `deletion_reason` (TEXT)
3. `CREATE UNIQUE INDEX` on `legacy_fixture_id` (partial: WHERE deleted_at IS NULL)
4. `CREATE UNIQUE INDEX` on `reserved_tenant_id` (partial: WHERE deleted_at IS NULL AND reserved_tenant_id IS NOT NULL)
5. `INSERT 5 rows` into `canonical_tenant_map`:
   - 3 TEST_FIXTURE (with reserved UUIDs)
   - 2 TEST_ORPHAN (with NULL reserved UUIDs)
6. Execute P3, P4 collision gates (READ-ONLY verification, NO mutations)

#### Migration 05-B: Tenant Creation + Cleanup
1. Execute P2 gate (verify 05-A COMPLETE)
2. Execute P3 gate (schema compatibility check)
3. Execute P4 gate (collision recheck)
4. `CREATE 3 canonical tenants` in `public.tenants`:
   - UUID: `11111111-0000-4000-8000-000000000001` (test-e2e-tenant-a)
   - UUID: `11111111-0000-4000-8000-000000000002` (test-e2e-tenant-b)
   - UUID: `11111111-0000-4000-8000-000000000003` (test-e2e-tenant-attacker)
5. `UPDATE migration_evidence.canonical_tenant_map`:
   - Set `canonical_tenant_id` = `reserved_tenant_id`
   - Set `reconciliation_phase` = 'COMPLETE'
   - WHERE `classification` = 'TEST_FIXTURE'
6. `CREATE TRIGGER trigger_prevent_canonical_id_change` (immutability enforcement)
7. `ALTER TABLE migration_evidence.canonical_tenant_map ADD CONSTRAINT` FK on `canonical_tenant_id` → `public.tenants.id`
8. Execute E2 gate (5-stage orphan safety verification)
9. `UPDATE migration_evidence.canonical_tenant_map` (populate audit columns):
   - `deleted_at` = NOW()
   - `deleted_by` = CURRENT_USER
   - `deletion_reason` = 'E2 orphan safety gate PASS...'
   - WHERE `classification` = 'TEST_ORPHAN'
10. `DELETE FROM runtime_tenant_registry` WHERE `tenant_id` IN (2 orphans)

#### Migration 05-C: TEXT→UUID Type Migration
1. Execute P-05C gate (verify 05-B COMPLETE)
2. Execute P-05C-MAP gate (verify mapping completeness)
3. For each table with `tenant_id` column (5 tables):
   - `UPDATE` TEXT → UUID via `canonical_tenant_map`
   - `ALTER COLUMN tenant_id TYPE uuid`
   - `ADD FOREIGN KEY` constraint → `public.tenants.id`
   - Verify RLS preservation
4. Execute E3 gate (10-check post-migration verification)

**NOT Authorized:**
- ❌ Any mutations outside 05-A/B/C migration files
- ❌ Manual schema changes via SQL console
- ❌ Additional tenant creation beyond 3 fixtures
- ❌ Deletion beyond 2 orphans (test-quarantine-tenant-a/b)
- ❌ FK constraint modifications beyond documented changes
- ❌ RLS policy creation/modification
- ❌ Index creation beyond partial UNIQUE indexes in 05-A
- ❌ Trigger creation beyond immutability trigger in 05-B
- ❌ Column additions beyond canonical_tenant_map schema

**Scope Boundary:**
> Human GO authorizes ONLY the mutations explicitly documented above. Any deviation, additional mutation, or undocumented change requires NEW Human GO decision.

**Status:** ❌ **NOT CONFIRMED**

---

## RISK ASSESSMENT

### Technical Risk: 🟢 LOW

**Evidence:**
- Package Integrity: 52/52 PASS
- E0 Gate: 33/33 PASS
- Rollback Test: 31/31 PASS
- E1 Gate: 10/10 PASS
- **Total: 126/126 automated checks PASS**

**Interpretation:**  
Code structure, package integrity, artifact completeness, rollback behavior, and runtime preconditions have been verified through 126 automated checks.

### Execution Risk: 🟡 MODERATE

**Evidence:**
- First-time execution of Amendment 12 v3 implementation
- Canonical identity reconciliation is irreversible after 05-C completes
- Rollback proven in test scenarios, not production scenarios

**Interpretation:**  
**126/126 PASS does NOT prove migration will succeed in production.**

**Critical Understanding:**
> Automated verification proves: "System has completed all pre-deployment verification layers and is eligible for human final decision."
> 
> Automated verification does NOT prove: "Migration is absolutely safe" or "Migration will succeed."

### Governance Risk: 🟢 NONE

**Evidence:**
- Design authority established (Amendment 12 v3 APPROVED)
- Multiple review layers passed (Architecture, Security, Data Integrity)
- Verification ≠ Authorization principle maintained
- Human GO required before execution

**Interpretation:**  
Governance model is functioning correctly. No shortcut from automated verification to execution authorization.

---

## GOVERNANCE FLOW (COMPLETE)

```
┌─────────────────────────────────────────────────────────┐
│ AMENDMENT 12 V3 GOVERNANCE FLOW                         │
└─────────────────────────────────────────────────────────┘

Design Authority
  ├── Architecture Review ──────── 🟢 PASS
  ├── Security Review ──────────── 🟢 PASS
  └── Data Integrity Review ────── 🟢 PASS
  └── Approval 3 ──────────────── 🟢 GRANTED
        ↓
Implementation
  ├── Package Integrity #1 ────── 🔴 FAIL (2 gaps detected)
  ├── Corrections ──────────────── 🟢 Verifier enhanced
  └── Package Integrity #2 ────── 🟢 52/52 PASS
        ↓
Artifact/Environment Verification
  └── E0 Gate ──────────────────── 🟢 33/33 PASS
        ├── Artifact Integrity ─── ✅ 15/15
        ├── Dependency Integrity ── ✅ 6/6
        ├── Preconditions ───────── ✅ 4/4
        └── Gate Integrity ──────── ✅ 8/8
        ↓
Behavioral Verification
  └── Rollback Test ────────────── 🟢 31/31 PASS
        ├── Scenario 1 (After E2) ─ ✅ Schema rollback
        ├── Scenario 2 (Audit) ──── ✅ UPDATE reverted
        └── Scenario 3 (DELETE) ─── ✅ Rows restored
        ↓
Runtime Precondition Verification
  └── E1 Gate ──────────────────── 🟢 10/10 PASS
        ├── Fixtures ──────────── ✅ 5/5 present
        ├── RLS ───────────────── ✅ Enabled
        ├── Migration History ──── ✅ Clean
        ├── Orphans ──────────────── ✅ 2/2 detected
        ├── Schema ────────────── ✅ TEXT type
        ├── FK Absence ────────── ✅ No constraints
        ├── Canonical Table ────── ✅ Exists
        ├── Identity Type ──────── ✅ UUID
        └── Privileges ────────── ✅ Sufficient
        ↓
HUMAN GO DECISION ─────────────── 🟡 HOLD ← CURRENT STATE
  ├── Condition 1: Backup ────── ❌ NOT CONFIRMED
  ├── Condition 2: Monitoring ── ❌ NOT CONFIRMED
  └── Condition 3: Scope ──────── ❌ NOT CONFIRMED
        ↓
     (blocked)
        ↓
Execution (when GO)
  ├── 05-A (Classification) ──── ⏸️ Pending Human GO
  ├── E2 Gate (Orphan Safety) ── ⏸️ Embedded in 05-A
  ├── 05-B (Tenant Creation) ─── ⏸️ Pending E2 PASS
  ├── Manual Verification ────── ⏸️ Pending 05-B
  ├── 05-C (Type Migration) ──── ⏸️ Pending verification
  └── E3 Gate (Post-05-C) ────── ⏸️ Embedded in 05-C
```

---

## TRANSITION CRITERIA: HOLD → GO

**To authorize migration execution, ALL 3 conditions must be satisfied:**

### Condition 1: Backup ✅
- [ ] Backup file created with timestamp
- [ ] File size documented (must be > 0 bytes)
- [ ] SQL content verified (header/footer check)
- [ ] Backup location documented
- [ ] Restore command documented and tested (if possible)

### Condition 2: Monitoring ✅
- [ ] Monitoring checkpoints reviewed and understood (8 checkpoints)
- [ ] Gate failure protocol agreed (STOP on E2 FAIL, STOP on 05-B mismatch, STOP on E3 FAIL)
- [ ] Manual verification points confirmed (05-B tenant count, orphan deletion)
- [ ] Controlled execution flow agreed (no blind progression)

### Condition 3: Scope ✅
- [ ] Authorized mutations list reviewed (05-A, 05-B, 05-C exhaustive)
- [ ] NOT authorized mutations understood (no deviations)
- [ ] Scope boundary agreed (any deviation requires NEW Human GO)
- [ ] Execution limited to 05-A/B/C only, confirmed

**When ALL checkboxes ✅:** Decision transitions from HOLD → GO

---

## EXECUTION PROTOCOL (when GO)

**This is NOT "running a migration".**  
**This is "controlled deployment with verification at each stage".**

### Execution Commands

```bash
# MANDATORY: Create backup FIRST
pg_dump $DATABASE_URL > backup_pre_migration_05_$(date +%Y%m%d_%H%M%S).sql

# CHECKPOINT 1: Deploy E1 Gate Function
psql $DATABASE_URL -f supabase/migrations/20260819040000_runtime_migration_e1_gate_schema_safe.sql
# → Verify function created

# CHECKPOINT 2: Execute 05-A (Classification + Reservation)
psql $DATABASE_URL -f supabase/migrations/20260819050000_runtime_migration_05a_classification_reservation.sql
# → Monitor output for P3, P4 gates

# CHECKPOINT 3: Verify E2 Gate (embedded in 05-A)
# → Check output for E2 status
# → If E2 FAIL: STOP, do NOT proceed

# CHECKPOINT 4: Execute 05-B (Tenant Creation + Cleanup)
psql $DATABASE_URL -f supabase/migrations/20260819050002_runtime_migration_05b_canonical_tenant_creation.sql
# → Monitor tenant creation and deletion

# CHECKPOINT 5: Manual Verification (05-B results)
psql $DATABASE_URL -c "SELECT COUNT(*) FROM public.tenants WHERE id IN ('11111111-0000-4000-8000-000000000001'::uuid, '11111111-0000-4000-8000-000000000002'::uuid, '11111111-0000-4000-8000-000000000003'::uuid);"
# → Expected: 3

psql $DATABASE_URL -c "SELECT COUNT(*) FROM runtime_tenant_registry WHERE tenant_id IN ('test-quarantine-tenant-a', 'test-quarantine-tenant-b');"
# → Expected: 0 (deleted)

# → If COUNT MISMATCH: STOP, investigate

# CHECKPOINT 6: Execute 05-C (TEXT→UUID Type Migration)
psql $DATABASE_URL -f supabase/migrations/20260819050003_runtime_migration_05c_text_to_uuid_type_migration.sql
# → Monitor type migration

# CHECKPOINT 7: Verify E3 Gate (embedded in 05-C)
# → Check output for E3 status
# → If E3 FAIL: STOP, investigate

# CHECKPOINT 8: Final State Verification
psql $DATABASE_URL -c "SELECT COUNT(*) FROM runtime_tenant_registry WHERE tenant_id::text LIKE 'test-%';"
# → Expected: 0 (all TEXT IDs converted to UUID)

psql $DATABASE_URL -f supabase/migrations/20260819050004_runtime_migration_e3_post_05c_verification.sql
# → Final E3 verification
```

### Rollback Strategy

**Rollback Decision Points:**

| Point | Trigger | Action |
|-------|---------|--------|
| **After E2 FAIL** | E2 gate returns FAIL | Transaction auto-rollback. Investigate E2 failure. Fix and retry 05-A. |
| **After 05-B mismatch** | Tenant count ≠ 3 OR orphan count ≠ 0 | Manual investigation. Decide: rollback via backup OR fix data. |
| **After E3 FAIL** | E3 gate returns FAIL | Transaction auto-rollback. Type migration may be partial. Restore from backup. |

**Full Rollback (if needed):**
```bash
# Restore from backup
psql $DATABASE_URL < backup_pre_migration_05_YYYYMMDD_HHMMSS.sql

# Verify restoration
node scripts/run-e1-verification.mjs
# → Should show 10/10 PASS, clean state
```

---

## CURRENT STATUS

**Date:** 2026-08-20  
**Time:** Pre-execution  
**Database Mutations:** 0 (verified 4 times: E0, Rollback Test ×3, E1)  
**Automated Verification:** 126/126 PASS  
**Human GO Decision:** 🟡 **HOLD**  

**Conditions Status:**
- Backup: ❌ NOT CONFIRMED
- Monitoring: ❌ NOT CONFIRMED
- Scope: ❌ NOT CONFIRMED

**Migration Execution:** 🔴 **FORBIDDEN** until Human GO

---

## DECISION REQUIRED

To transition from **HOLD** → **GO**, please confirm ALL 3 conditions:

1. **Backup:** Created and verified?
2. **Monitoring:** Plan reviewed and agreed?
3. **Scope:** Limited to 05-A/B/C only, understood?

**Signature Required:**

```
HUMAN GO DECISION

□ HOLD   (conditions not satisfied)
□ GO     (all 3 conditions satisfied, authorize execution)
□ NO-GO  (reject execution, additional review required)

Condition 1 (Backup):      □ Confirmed  □ Not Confirmed
Condition 2 (Monitoring):  □ Confirmed  □ Not Confirmed
Condition 3 (Scope):       □ Confirmed  □ Not Confirmed

Authorized By: ____________________
Date: ____________________
Time: ____________________

Notes:


```

---

## APPENDIX: GOVERNANCE PRINCIPLES APPLIED

### Principle 1: Verification ≠ Authorization
> 126/126 automated checks PASS proves readiness for human review, NOT approval for execution.

### Principle 2: Fail Before Mutation
> Package Integrity #1 detected 2 gaps BEFORE any database mutation. System working correctly.

### Principle 3: Behavioral Proof
> Rollback Test proves transaction semantics are correct. Backup provides independent restoration capability.

### Principle 4: Controlled Execution
> Migration is NOT "run and hope". It is "execute stage by stage, verify each stage, stop on any failure".

### Principle 5: Scope Limitation
> Human GO authorizes ONLY specific mutations documented in 05-A/B/C. Any deviation requires NEW authorization.

---

**Document Status:** ACTIVE  
**Next Review:** After 3 conditions satisfied OR after Human GO decision  
**Governance Stage:** Human GO (HOLD)  
**Database State:** Pristine (0 mutations)
