---
remediation_id: E0.1A-R3
document: CHECKPOINT
phase: R3 Education Identity Cutover
created: 2026-09-12
status: ready_for_deployment
---

# R3 EDUCATION IDENTITY CUTOVER — DEPLOYMENT CHECKPOINT

> **Phase:** R3 Education Identity Cutover  
> **Status:** 🟢 READY FOR DEPLOYMENT  
> **Critical Path:** DB → Verify → Code → Tests → Reconcile → Seal

---

## ✅ ARTIFACTS COMPLETE

### Database Migration
- **File:** `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`
- **Type:** Idempotent, transactional, 8 verification checks
- **Scope:** ADD students.party_id, backfill 631 rows, FK constraint, index
- **Rollback:** Prepared (DROP CONSTRAINT, DROP INDEX, DROP COLUMN)

### Application Code
- **Changed:** 6 files (types, repository, service, aggregate, contract, tests)
- **New:** 1 file (PartyRepository)
- **Scope:** Party validation, findByPartyId(), semantic drift fix
- **Rollback:** Git revert (database harmless, legacy paths work)

### Tests
- **Integration:** 10 tests (positive + negative)
- **Verification:** Independent script (9 checks)
- **Coverage:** FK integrity, tenant consistency, NO new Person rows

### Documentation
- **Deployment decision:** Supabase Dashboard SQL Editor (service role)
- **Code patch:** 6 files detailed changes
- **Deployment sequence:** 8 steps with blockers
- **Evidence requirements:** Execution log, verification results, metrics

---

## 🎯 DEPLOYMENT SEQUENCE (7 STEPS — STRICT ORDER)

```text
1. Deploy R3 DB migration        🟢 AUTHORIZED (manual execution)
   └─ Method: Dashboard SQL Editor (service role)
   └─ Evidence: Execution log + timestamp + data metrics
   └─ Blocker: Any check FAIL → STOP

2. Independent DB verification   ⏸️  BLOCKED (wait Step 1 PASS)
   └─ Script: r3-verify-database.ts
   └─ Expected: 9/9 checks PASS
   └─ Blocker: < 9/9 → DO NOT deploy code

3. Deploy R3 application code    ⏸️  BLOCKED (wait Step 2 PASS)
   └─ Merge: r3-education-cutover → main
   └─ Deploy: 6 files + 1 new
   └─ Blocker: Deployment fail → Rollback immediately

4. Run integration + negative tests  ⏸️  BLOCKED (wait Step 3 deployed)
   └─ Integration: 10 tests (r3-education-cutover.test.ts)
   └─ Negative: persons count = 848 (unchanged)
   └─ Blocker: Tests fail OR persons > 848 → Critical violation

5. Reconcile migration history   ⏸️  BLOCKED (wait Step 4 PASS)
   └─ Action: INSERT INTO supabase_migrations.schema_migrations
   └─ Verify: supabase migration list shows 20260912000000 in both columns
   └─ Blocker: NOT OPTIONAL — next migration will fail

6. Seal R3 evidence              ⏸️  BLOCKED (wait Step 5 complete)
   └─ Document: R3_COMPLETION_REPORT.md
   └─ Contents: All timestamps, metrics, test results, reconciliation proof

7. Authorize R4                  🚫 BLOCKED (wait Step 6 sealed)
   └─ Update: R4 Caller Migration → 🟢 AUTHORIZED
   └─ Milestone: 4/8 stages complete (R0-R3)
```

---

## 🚨 CRITICAL GOVERNANCE RULES

### Rule 1: Code MUST NOT Deploy Before DB Migration PASS

**Pre-Deployment State:**
- ✅ Local branch contains R3 code changes
- ✅ Production app on pre-R3 code (legacy person_id paths)
- ❌ R3 code changes NOT merged to main/production branch yet

**Reason:** If code deploys first, all student operations fail (party_id column missing).

**Enforcement:** R3 code changes remain on feature branch until DB migration verified PASS.

---

### Rule 2: Independent Verification Required

**Do NOT trust SQL script output alone.**

**Requirement:** Run `r3-verify-database.ts` with 9 explicit checks:
1. students.party_id column exists
2. 631/631 students have party_id
3. 0 students missing party_id
4. 0 orphan party_id references
5. 0 tenant mismatches
6. party_type = person for all students
7. 631/631 students preserve person_id
8. FK constraint exists
9. Index exists

**Blocker:** < 9/9 → DO NOT deploy code.

---

### Rule 3: Migration History Reconciliation NOT OPTIONAL

**Issue:** Manual SQL execution → migration history diverges

**Impact:** Next `supabase db push` attempts to re-apply R3 → duplicate key error

**Resolution (REQUIRED):**
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('20260912000000', 'r3_education_identity_cutover', ARRAY['R3.1-R3.8']);
```

**Verification:**
```bash
supabase migration list | grep 20260912000000
# Both Local and Remote columns must be populated
```

**Governance:** R3 evidence CANNOT be sealed until reconciliation complete.

---

### Rule 4: Negative Tests Required (NO New Person Rows)

**Baseline:** 848 persons (R2 sealed count)

**Test:**
1. Create new student with party_id
2. Query persons count
3. Expected: count = 848 (unchanged)

**Violation:** If count > 848 → CRITICAL FAILURE → Students still creating Person rows → Code regression

---

## 📊 R3 READINESS STATUS

```text
ARTIFACTS:
✅ DB migration SQL prepared
✅ Application code prepared (6 files + 1 new)
✅ Integration tests prepared (10 tests)
✅ Verification script prepared (9 checks)
✅ Deployment sequence documented (8 steps)
✅ Rollback procedures prepared
✅ Evidence requirements defined

PREREQUISITES:
✅ R0 Preflight COMPLETE (848 persons, 631 students)
✅ R1 Identity Mapping SEALED (848 mappings)
✅ R2 Party Backfill SEALED (848 parties, 8/8 R2V PASS)
✅ R2V Verification PASS (structural + semantic)

DEPLOYMENT STATUS:
🟢 R3 DB migration AUTHORIZED (manual execution)
⏸️  R3 code deployment BLOCKED (wait DB PASS)
⏸️  R3 verification BLOCKED (wait DB PASS)
⏸️  R3 evidence seal BLOCKED (wait reconciliation)
🚫 R4 NOT authorized (wait R3 complete)

GIT BRANCH STATUS:
✅ R3 code changes on feature branch (not merged)
✅ Production app on pre-R3 code (stable)
⏸️  Merge to main BLOCKED (wait DB + verification PASS)
```

---

## 📋 EVIDENCE REQUIREMENTS (3 GROUPS)

### After Step 1 (DB Migration)

#### Execution Evidence
- **Timestamp:** YYYY-MM-DD HH:MM:SS UTC
- **Migration Version:** 20260912000000
- **Full Result Log:** Complete output from Dashboard SQL Editor
- **Final Verdict:** `🎉 R3 DATABASE CUTOVER: ✅ PASS` or `❌ FAIL`

#### Data Evidence
```text
students total                    = 631
students with party_id           = 631
students missing party_id        = 0
orphan party_id references       = 0
tenant mismatches                = 0
wrong party_type                 = 0
legacy person_id preserved       = 631
```

#### Governance Evidence
```text
persons count BEFORE migration   = 848 (R2 baseline)
persons count AFTER migration    = 848 (unchanged)
code deployed before DB PASS     = NO
migration history reconciled     = PENDING (Step 5)
```

---

### After Step 2 (Verification)

**Capture:**
- `r3-verify-database.ts` output
- Verification timestamp
- Result: `🎉 R3 DATABASE VERIFICATION: ✅ PASS (9/9)`

---

### After Step 3 (Code Deploy)

**Capture:**
- Git commit hash
- Deployment timestamp
- Deployment platform response (success/fail)
- Health check result

---

### After Step 4 (Integration Tests)

**Capture:**
- Test suite output
- Test timestamp
- Result: `10/10 PASS`

---

### After Step 5 (Negative Tests)

**Capture:**
```sql
SELECT COUNT(*) FROM persons;
-- Timestamp: YYYY-MM-DD HH:MM:SS UTC
-- Result: 848 (unchanged from R2 baseline)
```

---

### After Step 6 (Reconciliation)

**Capture:**
```bash
supabase migration list | grep 20260912000000
# Local: 20260912000000 | Remote: 20260912000000 | Time: 2026-09-12 00:00:00
```

---

### After Step 7 (Evidence Seal)

**Document:** `R3_COMPLETION_REPORT.md`

**Contents:**
- All timestamps from Steps 1-6
- All metrics from verification
- All test results
- Reconciliation proof
- R4 authorization

---

## 🔄 ROLLBACK PROCEDURES

### If Database Migration Fails (During Step 1)

**DO NOT deploy application code.**

**Rollback SQL:**
```sql
DROP CONSTRAINT IF EXISTS students_party_id_fkey;
DROP INDEX IF EXISTS idx_students_party_id;
ALTER TABLE students DROP COLUMN IF EXISTS party_id;
```

**Verify:**
```sql
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'students' AND column_name = 'party_id';
-- Expected: 0 rows (column removed)
```

**Impact:** System returns to pre-R3 state. Legacy person_id paths functional.

---

### If Verification Fails (During Step 2)

**DO NOT deploy application code.**

**Actions:**
1. Capture failed verification output
2. Investigate root cause (data inconsistency? migration incomplete?)
3. Decide: Fix forward OR rollback
4. If rollback: Execute rollback SQL above

---

### If Code Deployment Fails (During Step 3)

**Rollback:**
```bash
git revert <r3-commit-hash>
npm run build
npm run deploy
```

**Impact:** Minimal. Database has party_id column but code doesn't use it. Legacy person_id paths functional.

---

### If Integration Tests Fail (During Step 4)

**Actions:**
1. Capture test failure output
2. Investigate root cause (code bug? data issue?)
3. Decide: Hotfix OR rollback code
4. If rollback code: Execute git revert above
5. Database remains as-is (party_id column harmless)

---

### If Negative Tests Fail (During Step 5)

**CRITICAL FAILURE:** Students creating new Person rows

**Actions:**
1. IMMEDIATELY investigate code regression
2. Check StudentService.createStudent() — Party validation bypassed?
3. Check Contract implementation — Still mapping to person_id?
4. Consider code rollback if cannot hotfix quickly
5. DO NOT proceed to Step 6 until violation resolved

---

## 🎯 SUCCESS CRITERIA

```text
R3 DATABASE MIGRATION:
  students.party_id added            ✅ (631/631 populated)
  FK integrity valid                 ✅ (0 orphans)
  Tenant consistency valid           ✅ (0 mismatches)
  Index created                      ✅
  Migration history reconciled       ✅

R3 APPLICATION CODE:
  StudentService uses Party          ✅
  Contract semantics fixed           ✅
  PartyRepository created            ✅
  Integration tests PASS             ✅ (10/10)
  Negative tests PASS                ✅ (persons = 848)

R3 VERIFICATION:
  Independent checks                 ✅ (9/9)
  NO new Person rows created         ✅
  Legacy person_id preserved         ✅
  Tenant isolation maintained        ✅

R3 EVIDENCE:
  Execution log captured             ✅
  Verification results documented    ✅
  Test results captured              ✅
  Reconciliation proof captured      ✅
  Completion report sealed           ✅

R3 STATUS:                           ✅ COMPLETE
R4 STATUS:                           🟢 AUTHORIZED
```

---

## 📋 FINAL CHECKLIST

**Before Starting Deployment:**
- [ ] R0-R2 evidence sealed and verified
- [ ] R3 DB migration SQL reviewed
- [ ] R3 code changes on feature branch (NOT merged)
- [ ] Production app on pre-R3 code (stable)
- [ ] Supabase Dashboard access confirmed
- [ ] Service role execution mode verified
- [ ] Rollback procedures understood

**After Each Step:**
- [ ] Step 1: DB migration PASS + execution/data/governance evidence captured
- [ ] Step 2: Verification 9/9 PASS + output captured
- [ ] Step 3: Code deployed + commit hash captured
- [ ] Step 4: Integration tests 10/10 PASS + persons count = 848 (unchanged)
- [ ] Step 5: Migration history reconciled + verified
- [ ] Step 6: Evidence sealed in R3_COMPLETION_REPORT.md
- [ ] Step 7: R4 authorized + milestone updated to 4/8

---

**STATUS:** 🟢 READY FOR DEPLOYMENT

**NEXT ACTION:** Execute R3 database migration via Supabase Dashboard SQL Editor (service role)

**EVIDENCE REQUIRED (3 GROUPS):**
1. **Execution:** Timestamp, version, full log
2. **Data:** 631/631 linked, 0 orphans, 0 mismatches, 631 preserved
3. **Governance:** Persons = 848 (unchanged), no code deployed, history pending

**After Step 1:** Report results → I will run verification script (Step 2) → Guide through Steps 3-7

**GOVERNANCE:** E0.1A-R remains OPEN until R3-R7 complete. R3 ≠ PASS until all 7 steps complete. Milestone 4/8 only after Step 7.
