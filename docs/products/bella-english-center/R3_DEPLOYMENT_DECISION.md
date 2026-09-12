---
remediation_id: E0.1A-R3
document: DEPLOYMENT_DECISION
created: 2026-09-12
status: deployment_path_selected
---

# R3 DEPLOYMENT DECISION

## 🚨 BLOCKER ANALYSIS

### Supabase CLI Push Status

**Attempted:** `supabase db push --include-all`

**Result:** Migration history conflict

```text
Local migrations found: 35+ files not in remote
Remote migrations found: Some already applied but not in history table
Duplicate key violations on schema_migrations table
```

**Impact:** Cannot use `supabase db push` without:
1. Applying 35+ unrelated migrations first
2. Resolving migration history inconsistencies
3. Risk of cascade failures

---

## ✅ RECOMMENDED DEPLOYMENT PATH

### **Option B: Supabase Dashboard SQL Editor (Service Role)**

**Advantages:**
- ✅ Direct execution (no migration history conflicts)
- ✅ Can execute as service role (has ALTER TABLE permission)
- ✅ Immediate feedback (see PASS/FAIL in output)
- ✅ Single migration (R3 only, no cascade)
- ✅ Manual audit trail (can save execution log)

**Disadvantages:**
- ⚠️ Manual step (requires Dashboard access)
- ⚠️ Not tracked in supabase_migrations.schema_migrations automatically
- ⚠️ Must manually insert migration record after

**Procedure:**

1. **Open Supabase Dashboard**
   - Navigate to SQL Editor
   - Select "New Query"
   - Set execution mode to "Service Role" (top right)

2. **Paste R3 Migration SQL**
   - Copy entire contents of `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`
   - Paste into SQL Editor

3. **Execute Migration**
   - Click "Run" button
   - Monitor output for verification checks

4. **Verify Success**
   Expected output:
   ```text
   ✅ PRE-FLIGHT: 848 sealed mappings, 631 students with person_id
   ✅ R3.1: Added students.party_id column
   ✅ R3.3: PASS — 631/631 students have party_id
   ✅ R3.4: Added FK students.party_id → party_parties(id)
   ✅ R3.5: PASS — 0 orphan party_id references
   ✅ R3.6: PASS — 0 tenant mismatches
   ✅ R3.7: PASS — All students linked to party_type=person
   ✅ R3.8: Created index idx_students_party_id
   🎉 R3 DATABASE CUTOVER: ✅ PASS
   ```

5. **Manual Migration Record** (optional, for history tracking)
   ```sql
   INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
   VALUES (
     '20260912000000',
     'r3_education_identity_cutover',
     ARRAY['R3.1 ADD students.party_id', 'R3.2 BACKFILL', 'R3.3-R3.8 VERIFY']
   );
   ```

6. **Export Evidence**
   - Save execution log
   - Capture final verification query results
   - Document in `R3_DEPLOYMENT_LOG.md`

---

## ❌ REJECTED OPTIONS

### Option A: Supabase CLI Push

**Why Rejected:**
- Requires resolving 35+ migration history conflicts first
- Risk of unintended cascade migrations
- Cannot guarantee R3-only deployment
- May apply unreviewed migrations to production

**Verdict:** Too risky for production deployment

---

### Option C: Grant ALTER Permission to DATABASE_EXECUTOR_URL

**Why Rejected:**
- Poor security practice (over-permissioned service account)
- No migration history tracking
- Would need to grant/revoke manually
- Not repeatable for other environments

**Verdict:** Security governance violation

---

## 📋 SELECTED DEPLOYMENT PATH

**Method:** Dashboard SQL Editor (Service Role)

**Rationale:**
1. **Isolated execution** — R3 only, no cascade
2. **Service role has permission** — Can ALTER TABLE
3. **Immediate verification** — See PASS/FAIL in output
4. **Audit trail** — Can save execution log
5. **Rollback possible** — Have rollback SQL prepared

**Trade-off Accepted:**
- Manual step (not fully automated)
- Migration history tracking manual (can fix post-deploy)

---

## 🎯 DEPLOYMENT CHECKLIST

### Pre-Deployment

```text
✅ R0 Preflight COMPLETE (848 persons, 631 students)
✅ R1 Identity Mapping SEALED (848 mappings)
✅ R2 Party Backfill SEALED (848 parties, 8/8 R2V PASS)
✅ R3 migration SQL prepared (20260912000000_r3_education_identity_cutover.sql)
✅ Rollback SQL prepared (if needed)
✅ Dashboard access confirmed
✅ Service role execution mode verified
```

### Deployment Execution

```text
⏸️ Open Supabase Dashboard → SQL Editor
⏸️ Set execution mode to "Service Role"
⏸️ Paste R3 migration SQL
⏸️ Execute migration
⏸️ Monitor output for PASS/FAIL
⏸️ Capture execution log
⏸️ Verify final state
```

### Post-Deployment Verification

```sql
-- Verify students.party_id column exists and populated
SELECT 
  COUNT(*) as total,
  COUNT(person_id) as with_person_id,
  COUNT(party_id) as with_party_id,
  COUNT(*) FILTER (WHERE party_id IS NULL) as missing_party_id
FROM students;

-- Expected: total=631, with_person_id=631, with_party_id=631, missing_party_id=0

-- Verify FK constraint exists
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'students' AND constraint_name = 'students_party_id_fkey';

-- Expected: 1 row (FOREIGN KEY)

-- Verify index exists
SELECT indexname
FROM pg_indexes
WHERE tablename = 'students' AND indexname = 'idx_students_party_id';

-- Expected: 1 row

-- Verify tenant consistency
SELECT COUNT(*) as tenant_mismatch
FROM students s
JOIN party_parties pp ON s.party_id = pp.id
WHERE s.tenant_id != pp.tenant_id;

-- Expected: 0
```

### Evidence Capture

```text
⏸️ Export execution log from Dashboard
⏸️ Save verification query results
⏸️ Document deployment timestamp
⏸️ Capture final state snapshot
⏸️ Create R3_DEPLOYMENT_LOG.md
```

---

## 🔄 ROLLBACK PROCEDURE

If R3 deployment fails or needs rollback:

```sql
-- Drop FK constraint
ALTER TABLE students DROP CONSTRAINT IF EXISTS students_party_id_fkey;

-- Drop index
DROP INDEX IF EXISTS idx_students_party_id;

-- Drop column
ALTER TABLE students DROP COLUMN IF EXISTS party_id;

-- Verify rollback
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'party_id';
-- Expected: 0 rows (column removed)
```

**Rollback Evidence:**
- Document rollback reason
- Capture state before/after rollback
- Report to architecture team
- Investigate root cause before retry

---

## 📊 SUCCESS CRITERIA

```text
R3 DATABASE MIGRATION:
  students.party_id added             ✅
  631/631 students backfilled         ✅
  FK integrity valid                  ✅
  Tenant consistency valid            ✅
  Index created                       ✅
  Execution log captured              ✅

R3 VERIFICATION:
  Missing party_id = 0                ✅
  Orphan party_refs = 0               ✅
  Tenant mismatch = 0                 ✅
  Wrong party_type = 0                ✅

R3 EVIDENCE:
  Deployment log saved                ✅
  Verification queries documented     ✅
  Final state snapshot captured       ✅
```

---

## 🎯 NEXT STEPS AFTER R3 PASS

1. **Deploy R3 Application Code**
   - Implement changes from `R3_CODE_PATCH.md`
   - Update StudentService, Repository, Contract
   - Deploy to production

2. **Run Integration Tests**
   - Create new student → verify party_id populated
   - Query by party_id → verify results
   - Verify NO new Person rows created

3. **Seal R3 Evidence**
   - Create `R3_COMPLETION_REPORT.md`
   - Document metrics (execution time, row counts)
   - Capture regression test results

4. **Authorize R4**
   ```text
   R3 Education Cutover       ✅ COMPLETE
   R4 Caller Migration        🟢 AUTHORIZED
   ```

---

**STATUS:** 🟡 DEPLOYMENT PATH SELECTED

**METHOD:** Supabase Dashboard SQL Editor (Service Role)

**BLOCKER:** Awaiting manual execution via Dashboard

**NEXT:** Execute R3 migration via Dashboard → Verify → Deploy code → Authorize R4
