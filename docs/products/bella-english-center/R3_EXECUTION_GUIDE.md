---
remediation_id: E0.1A-R3
document: EXECUTION_GUIDE
phase: R3 Database Migration
created: 2026-09-12
status: ready_for_execution
---

# R3 DATABASE MIGRATION — EXECUTION GUIDE

> **Step 1 of 7** — Manual execution via Supabase Dashboard  
> **Prerequisite:** Service role access to Supabase Dashboard  
> **Duration:** ~2-5 minutes (estimated)

---

## 🎯 OBJECTIVE

Deploy R3 database migration to add `students.party_id` column, backfill 631 students from sealed R1 mapping, and establish FK integrity.

**Scope:**
- ADD `students.party_id` column (nullable)
- BACKFILL 631 students with `party_id` from `identity_migration_mapping`
- ADD FK constraint `students_party_id_fkey` → `party_parties(id)`
- CREATE index `idx_students_party_id`
- VERIFY 8 checks (pre-flight, backfill, FK, tenant, party_type)

**NOT in scope:**
- NO application code changes (Step 3)
- NO contract updates (Step 3)
- NO test execution (Step 4)
- NO `person_id` removal (deferred to R6)

---

## 📋 PRE-EXECUTION CHECKLIST

**Environment:**
- [ ] Supabase Dashboard access confirmed
- [ ] Service role execution mode available
- [ ] Database connection stable
- [ ] No active deployments in progress

**Prerequisites Verified:**
- [ ] R0 Preflight COMPLETE (848 persons, 631 students)
- [ ] R1 Identity Mapping SEALED (848 mappings)
- [ ] R2 Party Backfill SEALED (848 parties, 8/8 R2V PASS)
- [ ] identity_migration_mapping table contains 848 rows
- [ ] All 848 mappings have status='party_created' and sealed_at NOT NULL

**Artifacts Ready:**
- [ ] Migration SQL file: `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`
- [ ] Verification script: `scripts/remediation/r3-verify-database.ts`
- [ ] Rollback SQL prepared (if needed)

**Code NOT Deployed:**
- [ ] R3 application code changes on feature branch (NOT merged to main)
- [ ] Production app still on pre-R3 code (uses person_id)
- [ ] NO R3 code deployed to production

---

## 🚀 EXECUTION STEPS

### Step 1.1: Open Supabase Dashboard

1. Navigate to Supabase Dashboard
2. Select your project
3. Click **SQL Editor** in left sidebar

### Step 1.2: Create New Query

1. Click **New Query** button
2. Name query: `R3 Education Identity Cutover`

### Step 1.3: Set Execution Mode

⚠️ **CRITICAL:** Must execute as service role

1. Look for execution mode selector (top right of editor)
2. Select **Service Role** (NOT authenticated user)
3. Verify: Mode shows "Service Role" or equivalent

**Why:** DATABASE_EXECUTOR_URL lacks ALTER TABLE permission. Service role has full permissions.

### Step 1.4: Paste Migration SQL

1. Open local file: `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`
2. Copy **entire contents** (Ctrl+A, Ctrl+C)
3. Paste into Dashboard SQL Editor (Ctrl+V)
4. **DO NOT** modify SQL
5. **DO NOT** run partial sections

### Step 1.5: Execute Migration

1. Click **Run** button (or Ctrl+Enter)
2. **Wait for completion** (do not interrupt)
3. Migration will output progress messages

**Expected Duration:** 2-5 minutes

**Expected Output:**
```text
✅ PRE-FLIGHT: 848 sealed mappings, 631 students with person_id
✅ R3.1: Added students.party_id column
✅ R3.3: PASS — 631/631 students have party_id
✅ R3.4: Added FK students.party_id → party_parties(id)
✅ R3.5: PASS — 0 orphan party_id references
✅ R3.6: PASS — 0 tenant mismatches
✅ R3.7: PASS — All students linked to party_type=person
✅ R3.8: Created index idx_students_party_id

═══════════════════════════════════════════════════════════════
R3 EDUCATION IDENTITY CUTOVER — DATABASE MIGRATION COMPLETE
═══════════════════════════════════════════════════════════════
Total Students:           631
With person_id (legacy):  631
With party_id (new):      631
Missing party_id:         0
Orphan Party refs:        0
Tenant mismatches:        0
Wrong party_type:         0
═══════════════════════════════════════════════════════════════
🎉 R3 DATABASE CUTOVER: ✅ PASS

Next Steps:
  1. Deploy R3 application code changes
  2. Update StudentService to validate Party
  3. Fix Contract implementation (partyId semantics)
  4. Run integration tests
  5. Run negative tests (no new Person creation)
  6. Verify R3.5–R3.7 pass
  7. Authorize R4 (Caller Migration)
═══════════════════════════════════════════════════════════════
```

### Step 1.6: Capture Evidence

**Immediately after execution completes:**

1. **Copy full output** (Ctrl+A in results pane, Ctrl+C)
2. **Save to file:** `evidence/R3_DB_MIGRATION_LOG_<timestamp>.txt`
3. **Note timestamp:** Record exact UTC time of execution
4. **Screenshot (optional):** Capture final PASS verdict

**Evidence Required (3 Groups):**

**Execution:**
- Timestamp: `YYYY-MM-DD HH:MM:SS UTC`
- Migration version: `20260912000000`
- Full result log (complete output)

**Data:**
- Total students: `631`
- With party_id: `631`
- Missing party_id: `0`
- Orphan refs: `0`
- Tenant mismatches: `0`
- Wrong party_type: `0`
- Legacy person_id preserved: `631`

**Governance:**
- Persons count before: `848` (R2 baseline)
- Persons count after: `848` (unchanged)
- Code deployed before DB: `NO`
- Migration history reconciled: `PENDING (Step 5)`

---

## ❌ FAILURE SCENARIOS

### Scenario 1: Pre-Flight Check Fails

**Error:**
```text
R3 PRE-FLIGHT FAIL: Expected 848 sealed mappings, found XXX
```

**Cause:** R1 mapping not sealed OR R2 backfill incomplete

**Action:**
1. STOP immediately (do not proceed)
2. Verify R1 status: `SELECT COUNT(*) FROM identity_migration_mapping WHERE status='party_created' AND sealed_at IS NOT NULL`
3. Verify R2 status: `SELECT COUNT(*) FROM party_parties WHERE party_type='person'`
4. If counts incorrect, report to architecture team
5. DO NOT retry migration until root cause resolved

---

### Scenario 2: Column Add Fails

**Error:**
```text
ERROR: permission denied for table students
```

**Cause:** Execution mode NOT set to service role

**Action:**
1. STOP migration
2. Verify execution mode is "Service Role" (not authenticated user)
3. Retry migration with correct role

---

### Scenario 3: FK Violation During Backfill

**Error:**
```text
ERROR: insert or update on table "students" violates foreign key constraint "students_party_id_fkey"
```

**Cause:** party_id in mapping doesn't exist in party_parties

**Action:**
1. STOP migration
2. Query orphan mappings:
   ```sql
   SELECT m.person_id, m.party_id
   FROM identity_migration_mapping m
   LEFT JOIN party_parties pp ON m.party_id = pp.id
   WHERE m.status = 'party_created' AND pp.id IS NULL;
   ```
3. Report to architecture team (R2 integrity violation)
4. DO NOT proceed until resolved

---

### Scenario 4: Verification Check Fails

**Error:**
```text
R3.X FAIL: <check description>
```

**Action:**
1. STOP and capture error output
2. Review which check failed (R3.3, R3.5, R3.6, or R3.7)
3. Query database to inspect actual state
4. Decide: Fix forward OR rollback
5. If rollback, execute rollback SQL (see below)

---

### Scenario 5: Timeout or Connection Lost

**Error:**
```text
Connection timeout / Query interrupted
```

**Action:**
1. DO NOT retry blindly
2. Check database state:
   ```sql
   SELECT column_name FROM information_schema.columns 
   WHERE table_name = 'students' AND column_name = 'party_id';
   ```
3. If column exists:
   - Migration may have partially completed
   - Check which step failed
   - May need manual cleanup before retry
4. If column doesn't exist:
   - Migration did not start
   - Safe to retry from beginning

---

## 🔄 ROLLBACK PROCEDURE

**Only execute if migration fails and cannot fix forward.**

### Rollback SQL

```sql
-- Step 1: Drop FK constraint (if exists)
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_party_id_fkey;

-- Step 2: Drop index (if exists)
DROP INDEX IF EXISTS idx_students_party_id;

-- Step 3: Drop column (if exists)
ALTER TABLE students DROP COLUMN IF EXISTS party_id;

-- Step 4: Verify rollback
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'party_id';
-- Expected: 0 rows (column removed)

-- Step 5: Verify students table intact
SELECT COUNT(*) FROM students;
-- Expected: 631 (no data loss)

-- Step 6: Verify person_id unchanged
SELECT COUNT(*) FROM students WHERE person_id IS NOT NULL;
-- Expected: 631 (all preserved)
```

### Post-Rollback Actions

1. **Document failure:**
   - Create `R3_ROLLBACK_REPORT_<timestamp>.md`
   - Capture error message, root cause, rollback timestamp
2. **Investigate root cause:**
   - Review error logs
   - Check data integrity
   - Verify prerequisites (R0-R2)
3. **Report to architecture team:**
   - Blocker for R3-R7
   - May require architecture fix
4. **DO NOT retry migration** until root cause resolved

---

## ✅ SUCCESS CRITERIA

**Migration considered successful only if ALL criteria met:**

```text
Pre-Flight:
✅ 848 sealed mappings found
✅ 631 students with person_id

R3.1 Column Add:
✅ students.party_id column created
✅ Column nullable (not NOT NULL yet)

R3.2 Backfill:
✅ 631 students updated
✅ All party_id populated from mapping

R3.3 Verification:
✅ 631/631 students have party_id
✅ 0 students missing party_id

R3.4 FK Constraint:
✅ FK constraint students_party_id_fkey created
✅ ON DELETE RESTRICT

R3.5 FK Integrity:
✅ 0 orphan party_id references
✅ All party_id exist in party_parties

R3.6 Tenant Consistency:
✅ 0 tenant mismatches
✅ student.tenant_id = party.tenant_id for all

R3.7 Party Type:
✅ All students linked to party_type='person'
✅ 0 students linked to organization/system parties

R3.8 Index:
✅ Index idx_students_party_id created
✅ Performance optimization for party_id queries

Final Verdict:
✅ Output shows: 🎉 R3 DATABASE CUTOVER: ✅ PASS
```

**If ANY criterion fails:** Migration = FAIL → Stop, investigate, rollback if needed

---

## 📊 POST-EXECUTION VERIFICATION QUERIES

**Run these queries manually to verify migration success:**

### Query 1: Column Existence
```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'party_id';
```
**Expected:** 1 row, data_type='uuid', is_nullable='YES'

---

### Query 2: Student Linkage
```sql
SELECT 
  COUNT(*) as total,
  COUNT(person_id) as with_person_id,
  COUNT(party_id) as with_party_id,
  COUNT(*) FILTER (WHERE party_id IS NULL) as missing_party_id
FROM students;
```
**Expected:** total=631, with_person_id=631, with_party_id=631, missing_party_id=0

---

### Query 3: FK Integrity
```sql
SELECT COUNT(*) as orphan_refs
FROM students s
LEFT JOIN party_parties pp ON s.party_id = pp.id
WHERE s.party_id IS NOT NULL AND pp.id IS NULL;
```
**Expected:** orphan_refs=0

---

### Query 4: Tenant Consistency
```sql
SELECT COUNT(*) as tenant_mismatch
FROM students s
JOIN party_parties pp ON s.party_id = pp.id
WHERE s.tenant_id != pp.tenant_id;
```
**Expected:** tenant_mismatch=0

---

### Query 5: Party Type
```sql
SELECT COUNT(*) as wrong_type
FROM students s
JOIN party_parties pp ON s.party_id = pp.id
WHERE pp.party_type != 'person';
```
**Expected:** wrong_type=0

---

### Query 6: Persons Unchanged
```sql
SELECT COUNT(*) FROM persons;
```
**Expected:** 848 (unchanged from R2 baseline)

---

## 📋 NEXT STEPS AFTER SUCCESS

**After migration shows ✅ PASS:**

1. **Save evidence** (execution log + timestamp)
2. **Report to AI assistant:**
   - Provide 3 evidence groups (execution, data, governance)
   - AI will run Step 2 verification script
3. **Wait for verification PASS** before touching code
4. **DO NOT deploy application code** until Step 2 complete
5. **DO NOT merge R3 branch** until Step 2 complete

**Step 2 will be:** Run `npm run tsx scripts/remediation/r3-verify-database.ts` (AI-executed)

---

## 🚨 CRITICAL REMINDERS

1. **Execution mode = Service Role** (not authenticated user)
2. **Paste entire SQL file** (do not run partial sections)
3. **Wait for completion** (do not interrupt)
4. **Capture full output** immediately after execution
5. **DO NOT deploy code** before Step 2 verification
6. **DO NOT retry** if migration fails (investigate first)
7. **Use rollback SQL** only if cannot fix forward

---

**STATUS:** 🟢 READY FOR EXECUTION

**EXECUTOR:** Human (manual via Dashboard)

**ESTIMATED TIME:** 2-5 minutes

**NEXT AFTER SUCCESS:** AI executes Step 2 (r3-verify-database.ts)
