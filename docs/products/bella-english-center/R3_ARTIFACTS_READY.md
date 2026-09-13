---
remediation_id: E0.1A-R3
document: ARTIFACTS_READY
phase: R3 Education Identity Cutover
created: 2026-09-12
status: ready_not_deployed
---

# R3 ARTIFACTS READY — DEPLOYMENT PENDING

> **Status:** 🟡 READY / NOT DEPLOYED  
> **Phase:** R3 Education Identity Cutover  
> **Blocker:** Awaiting deployment decision

---

## ✅ ARTIFACTS PREPARED

### 1. R3 Database Migration

**File:** `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`

**Contents:**
```text
✅ PRE-FLIGHT validation (848 sealed mappings)
✅ R3.1: ADD students.party_id NULLABLE
✅ R3.2: BACKFILL party_id from sealed R1 mapping
✅ R3.3: VERIFY 631/631 students have party_id
✅ R3.4: ADD FK students.party_id → party_parties(id)
✅ R3.5: VERIFY FK integrity (0 orphan refs)
✅ R3.6: VERIFY tenant consistency (0 mismatches)
✅ R3.7: VERIFY party_type = 'person' (100%)
✅ R3.8: CREATE INDEX idx_students_party_id
✅ FINAL SUMMARY with PASS/FAIL verdict
```

**Characteristics:**
- ✅ Idempotent (safe to run multiple times)
- ✅ Explicit pre/post assertions
- ✅ Staged cutover (person_id preserved)
- ✅ Rollback procedure documented
- ✅ Migration history tracked

**Deployment Method:**
- **Option A (Recommended):** Supabase CLI migration
- **Option B:** Dashboard SQL Editor (service role)
- **Option C:** Grant ALTER permission (not recommended)

---

### 2. R3 Application Code Changes

**Document:** `docs/products/bella-english-center/R3_CODE_PATCH.md`

**Files to Modify:**
1. `src/platform/education/student/student.service.ts`
   - Change Person validation → Party validation
   - Add `getStudentsByPartyId()` method
   - Deprecate `getStudentsByPersonId()` method

2. `src/platform/education/student/student.repository.ts`
   - Add `findByPartyId()` method
   - Update `create()` to require `party_id`
   - Ensure dual-column population (party_id + person_id)

3. `src/platform/education/shared-kernel/types.ts`
   - Update `CreateStudentRequest` interface
   - Add `partyId` field, keep `personId` for compatibility

4. `src/platform/education/contracts/student.contract.impl.ts`
   - Fix semantic drift: `partyId` → `party_id` (not `person_id`)
   - Query by `party_id`, return `party_id`
   - Use `getStudentsByPartyId()` instead of `getStudentsByPersonId()`

5. `src/platform/host/party/party.repository.ts` (if not exists)
   - Add `PartyRepository.findById()` method
   - Support party_type validation

**Contract Semantic Fix:**
```typescript
// BEFORE (R2)
personId: input.partyId  // semantic drift

// AFTER (R3)
partyId: input.partyId   // correct semantics
```

---

### 3. R3 Test Plan

**Integration Tests:**
- ✅ Create new student → verify `party_id` populated
- ✅ Query student by `party_id` → verify results
- ✅ Contract `registerStudent()` → verify correct mapping
- ✅ Contract `getStudent()` → verify correct query

**Negative Tests:**
- ✅ Create student with invalid `party_id` → FK violation
- ✅ Create student with non-person party → validation error
- ✅ Verify NO new `persons` rows created (count = 848)
- ✅ Delete student → verify Party NOT deleted

**Regression Tests:**
- ✅ Existing students (631) → verify `party_id` backfilled
- ✅ Legacy `person_id` queries → still work (compatibility)
- ✅ Student CRUD operations → no regressions

---

## 🚫 NOT YET DONE

### Database Deployment

```text
R3.1 students.party_id column         ❌ NOT ADDED
R3.2 Backfill from mapping            ❌ NOT EXECUTED
R3.3 Verification                     ❌ NOT RUN
R3.4 FK constraint                    ❌ NOT ADDED
R3.5–R3.7 Integrity checks            ❌ NOT VERIFIED
R3.8 Index creation                   ❌ NOT CREATED
```

**Impact:** Students table still has NO `party_id` column. New students would fail if code deployed first.

---

### Code Deployment

```text
StudentService uses Party             ❌ NOT DEPLOYED
Contract semantics fixed              ❌ NOT DEPLOYED
Repository methods added              ❌ NOT DEPLOYED
Integration tests written             ❌ NOT WRITTEN
Negative tests written                ❌ NOT WRITTEN
```

**Impact:** Application still validates Person, creates semantic drift, does not populate `party_id`.

---

## 📋 DEPLOYMENT SEQUENCE

### Phase 1: Database Migration (REQUIRED FIRST)

```bash
# Option A: Supabase CLI (Recommended)
supabase db push

# Option B: Dashboard SQL Editor (Service Role)
# 1. Open Supabase Dashboard → SQL Editor
# 2. Paste contents of 20260912000000_r3_education_identity_cutover.sql
# 3. Run as service role
# 4. Verify summary shows ✅ PASS

# Option C: Grant Permission (Not Recommended)
# GRANT ALTER ON TABLE students TO executor_role;
```

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
🎉 R3 DATABASE CUTOVER: ✅ PASS
```

**Verification:**
```sql
SELECT 
  COUNT(*) as total,
  COUNT(person_id) as with_person_id,
  COUNT(party_id) as with_party_id
FROM students;

-- Expected: total=631, with_person_id=631, with_party_id=631
```

---

### Phase 2: Application Code Deployment (AFTER DB PASS)

```bash
# 1. Review code changes in R3_CODE_PATCH.md
# 2. Implement changes in source files
# 3. Run unit tests
# 4. Deploy application code
# 5. Run integration tests
# 6. Run negative tests
# 7. Smoke test production
```

**Verification:**
```typescript
// Create new student
const party = await createParty({ party_type: 'person', ... });
const student = await registerStudent({ partyId: party.id, ... });

// Verify party_id populated
expect(student.party_id).toBe(party.id);

// Verify NO new Person created
const personsCount = await countPersons();
expect(personsCount).toBe(848); // UNCHANGED
```

---

### Phase 3: R3 Evidence Seal

After successful deployment:

1. **Capture final state:**
   ```sql
   SELECT 
     COUNT(*) as total_students,
     COUNT(person_id) as with_person_id,
     COUNT(party_id) as with_party_id,
     COUNT(*) FILTER (WHERE party_id IS NULL) as missing_party_id
   FROM students;
   ```

2. **Run regression tests:**
   - Education student tests (52 tests)
   - Contract tests
   - Integration tests
   - Negative tests

3. **Document evidence:**
   - `R3_COMPLETION_REPORT.md`
   - Test results
   - Performance metrics
   - Rollback procedure (unused)

4. **Authorize R4:**
   ```text
   R3 Education Cutover       ✅ COMPLETE
   R4 Caller Migration        🟢 AUTHORIZED
   ```

---

## 🚨 CRITICAL DECISIONS

### Deployment Order (MUST BE DB FIRST)

```text
❌ WRONG:
  1. Deploy code first
  2. Deploy database
  → Code fails (party_id column doesn't exist)

✅ RIGHT:
  1. Deploy database migration
  2. Verify database PASS
  3. Deploy application code
  4. Verify tests PASS
```

**Reason:** Application code expects `party_id` column to exist. If code deploys first, all student operations fail.

---

### Dual-Column Transition (person_id KEPT)

```text
R3 State:
  students.person_id         ✅ KEPT (legacy)
  students.party_id          ✅ ADDED (authoritative)

R6 State (future):
  students.person_id         ❓ DEPRECATE/REMOVE
  students.party_id          ✅ NOT NULL + authoritative
```

**Reason:** Staged cutover allows rollback. Legacy paths still work during R3–R5. After R6 verification PASS, `person_id` can be removed.

---

### Idempotency (REQUIRED)

All R3 operations must be idempotent:

```sql
-- Idempotent column add
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE ...) THEN
  ALTER TABLE students ADD COLUMN party_id UUID;
END IF;

-- Idempotent backfill
UPDATE students s
SET party_id = m.party_id
WHERE s.party_id IS NULL;  -- Only update if not already set
```

**Reason:** Migration may be interrupted, retried, or run in dev/staging/prod. Must be safe to run multiple times.

---

## 📊 R3 READINESS CHECKLIST

```text
ARTIFACTS:
✅ R3 database migration file created
✅ R3 code patch document created
✅ R3 test plan documented
✅ R3 rollback procedure documented
✅ R3 deployment sequence defined

PREREQUISITES:
✅ R0 Preflight COMPLETE (848 persons, 631 students)
✅ R1 Identity Mapping SEALED (848 mappings)
✅ R2 Party Backfill SEALED (848 parties, 8/8 R2V PASS)
✅ R2V Verification PASS (structural + semantic)

DEPLOYMENT BLOCKERS:
🚫 Database migration NOT deployed
🚫 Application code NOT deployed
🚫 Tests NOT executed
🚫 Evidence NOT sealed

AUTHORIZATION:
🟡 R3 artifacts READY
🚫 R3 deployment PENDING
🚫 R4 NOT authorized (wait R3 PASS)
```

---

## 🎯 NEXT ACTIONS

### Immediate (Unblock R3)

1. **Deploy R3 database migration**
   - Choose deployment method (Supabase CLI recommended)
   - Execute migration
   - Verify PASS (631/631 students have party_id)

2. **Verify database state**
   ```sql
   SELECT * FROM students LIMIT 1;
   -- Should have both person_id AND party_id columns
   ```

3. **Deploy R3 application code**
   - Implement changes from R3_CODE_PATCH.md
   - Run unit tests
   - Deploy to staging
   - Deploy to production

4. **Verify application behavior**
   - Create new student → verify party_id populated
   - Query by party_id → verify results
   - Verify NO new Person rows created

5. **Seal R3 evidence**
   - Document completion
   - Capture metrics
   - Authorize R4

---

### Sequential (After R3 PASS)

6. **Execute R4** — Caller Migration (48 test fixtures)
7. **Execute R5** — Legacy Freeze (5 methods, 6 FK dispositions)
8. **Execute R6** — Full Verification (regression + E2E + negative)
9. **Execute R7** — Evidence Seal (reconcile exact counts)
10. **Close E0.1A-R** — Identity remediation complete

---

**STATUS:** 🟡 R3 ARTIFACTS READY / DEPLOYMENT PENDING

**BLOCKER:** Awaiting deployment decision (DB + Code)

**CRITICAL PATH:** Deploy R3 → Verify → Authorize R4 → R5 → R6 → R7 → Close E0.1A-R
