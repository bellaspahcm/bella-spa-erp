---
remediation_id: E0.1A-R3
document: CODE_READY
phase: R3 Education Identity Cutover
created: 2026-09-12
status: code_ready_not_deployed
---

# R3 APPLICATION CODE READY — DEPLOYMENT PENDING

> **Status:** 🟡 CODE READY / NOT DEPLOYED  
> **Phase:** R3 Education Identity Cutover  
> **Prerequisite:** R3 database migration MUST be deployed first

---

## ✅ CODE CHANGES COMPLETE

### 1. Domain Types Updated

**File:** `src/platform/education/shared-kernel/types.ts`

**Changes:**
```typescript
// Student interface
partyId?: string;     // R3 NEW: canonical identity
personId: string;     // LEGACY: compatibility

// CreateStudentRequest
partyId?: string;     // NEW: canonical Party identity
personId: string;     // LEGACY: compatibility

// StudentsTableRow
party_id: string | null;  // R3 NEW

// StudentsTableInsert
party_id?: string | null;  // R3 NEW
```

---

### 2. StudentRepository Updated

**File:** `src/platform/education/student/student.repository.ts`

**Changes:**
- ✅ `create()` — Requires `party_id`, maps to database column
- ✅ `findByPartyId()` — NEW method (canonical query)
- ✅ `findByPersonId()` — Deprecated, marked legacy
- ✅ `mapRowToDomain()` — Maps `party_id` from database
- ✅ FK error handling for both `party_id` and `person_id`

**Key Logic:**
```typescript
if (!student.partyId) {
  throw new Error('party_id is required for new students (R3 requirement)');
}

const row: StudentsTableInsert = {
  party_id: student.partyId,     // R3 NEW
  person_id: student.personId,   // LEGACY
  ...
};
```

---

### 3. StudentService Updated

**File:** `src/platform/education/student/student.service.ts`

**Changes:**
- ✅ Import `PartyRepository` (NEW)
- ✅ `createStudent()` — Validates Party (canonical), falls back to Person (legacy)
- ✅ `getStudentsByPartyId()` — NEW method
- ✅ `getStudentsByPersonId()` — Deprecated

**Key Logic:**
```typescript
// R3: Validate Party if partyId provided
if (request.partyId) {
  const partyRepo = new PartyRepository(supabase);
  const validation = await partyRepo.validatePartyType(request.partyId, request.tenantId, 'person');
  
  if (!validation.valid) {
    throw new Error(validation.error);
  }
}
```

---

### 4. StudentAggregate Updated

**File:** `src/platform/education/student/student.aggregate.ts`

**Changes:**
- ✅ `create()` — Accepts `partyId`, validates either `partyId` or `personId`
- ✅ Validation: "Either Party ID or Person ID is required"
- ✅ Assigns both `partyId` and `personId` to Student domain model

**Key Logic:**
```typescript
if (!request.partyId?.trim() && !request.personId?.trim()) {
  throw new Error('Either Party ID or Person ID is required');
}

const student: Student = {
  partyId: request.partyId,     // R3 NEW
  personId: request.personId,   // LEGACY
  ...
};
```

---

### 5. PartyRepository Created

**File:** `src/platform/host/party/party.repository.ts`

**Methods:**
- ✅ `findById(partyId, tenantId)` — Fetch party by ID
- ✅ `findByType(partyType, tenantId)` — Fetch parties by type
- ✅ `validatePartyType(partyId, tenantId, expectedType)` — Validate party exists, type, active

**Key Logic:**
```typescript
async validatePartyType(
  partyId: string,
  tenantId: string,
  expectedType: 'person' | 'organization' | 'system'
): Promise<{ valid: boolean; party?: Party; error?: string }> {
  const party = await this.findById(partyId, tenantId);
  
  if (!party) return { valid: false, error: 'Party does not exist' };
  if (party.party_type !== expectedType) return { valid: false, error: 'Party is not a person' };
  if (!party.is_active) return { valid: false, error: 'Party is not active' };
  
  return { valid: true, party };
}
```

---

### 6. Contract Implementation Fixed

**File:** `src/platform/education/contracts/student.contract.impl.ts`

**Semantic Drift FIXED:**

**BEFORE (R2):**
```typescript
personId: input.partyId,  // WRONG: semantic drift
partyId: student.personId // WRONG: returns person_id
getStudentsByPersonId()   // WRONG: queries person_id
```

**AFTER (R3):**
```typescript
partyId: input.partyId,       // CORRECT: maps to party_id field
partyId: student.partyId!,    // CORRECT: returns party_id
getStudentsByPartyId()        // CORRECT: queries party_id
```

**Impact:** Contract semantics now match implementation. `partyId` input → `party_id` column, `partyId` output → `party_id` value.

---

## ✅ TESTS PREPARED

### Integration Tests

**File:** `tests/remediation/r3-education-cutover.test.ts`

**Coverage:**
- ✅ Create student with valid Party
- ✅ Populate `party_id` for new students
- ✅ Query student by `party_id`
- ✅ Reject invalid `party_id`
- ✅ Reject non-person party
- ✅ NO new Person rows created (baseline = 848)
- ✅ FK integrity valid
- ✅ Tenant consistency valid
- ✅ `party_type = person` for all students

**Key Test:**
```typescript
it('should NOT create new Person when creating student', async () => {
  const beforeCount = await countPersons();
  
  await StudentService.createStudent({ partyId: testPartyId, ... });
  
  const afterCount = await countPersons();
  
  expect(afterCount).toBe(beforeCount);  // UNCHANGED
  expect(afterCount).toBe(848);          // R2 baseline
});
```

---

### Database Verification Script

**File:** `scripts/remediation/r3-verify-database.ts`

**Purpose:** Independent verification AFTER manual database migration

**Checks:**
1. ✅ `students.party_id` column exists
2. ✅ 631/631 students have `party_id` populated
3. ✅ 0 students missing `party_id`
4. ✅ 0 orphan `party_id` references (FK integrity)
5. ✅ 0 tenant mismatches (student vs party)
6. ✅ `party_type = person` for all students
7. ✅ 631/631 students preserve `person_id` (compatibility)
8. ✅ FK constraint `students_party_id_fkey` exists
9. ✅ Index `idx_students_party_id` exists

**Usage:**
```bash
npm run tsx scripts/remediation/r3-verify-database.ts
```

**Expected Output:**
```text
🎉 R3 DATABASE VERIFICATION: ✅ PASS (9/9)

Next Steps:
  1. Deploy R3 application code changes
  2. Run integration tests
  3. Run negative tests
  4. Seal R3 evidence
  5. Authorize R4
```

---

## 🚨 DEPLOYMENT SEQUENCE (STRICT ORDER)

### ⚠️ CRITICAL: Code changes MUST NOT deploy before DB migration PASS

**Pre-Deployment State:**
- Local branch: Contains R3 code changes (6 files + 1 new)
- Production: MUST remain on pre-R3 code until DB migration verified
- Git: R3 code changes NOT merged to main/production branch yet

---

### Step 1: Deploy Database (MANUAL — AUTHORIZED)

**Method:** Supabase Dashboard SQL Editor (service role)

1. Open Supabase Dashboard → SQL Editor
2. Set execution mode to "Service Role" (top right)
3. Paste entire contents of `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`
4. Run migration
5. **Capture execution log** (copy all output)

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

**Evidence Required:**
- Execution log (full output)
- Timestamp of execution
- Screenshot of PASS verdict (optional)

**BLOCKER:** If any check FAILS, STOP. Do NOT proceed to Step 2. Investigate failure, consider rollback.

---

### Step 2: Independent Database Verification (REQUIRED)

```bash
npm run tsx scripts/remediation/r3-verify-database.ts
```

**Purpose:** Do NOT trust SQL script output alone. Run independent verification with explicit checks.

**Expected Output:**
```text
✅ students.party_id column exists
✅ Total students: 631 (expected: 631)
✅ Students with party_id: 631 (expected: 631)
✅ Students missing party_id: 0 (expected: 0)
✅ Orphan party_id references: 0 (expected: 0)
✅ Tenant consistency: 0 mismatches (expected: 0)
✅ party_type = person: all (expected: all)
✅ Students with person_id (compatibility): 631 (expected: 631)
✅ FK constraint students_party_id_fkey exists
✅ Index idx_students_party_id exists

🎉 R3 DATABASE VERIFICATION: ✅ PASS (9/9)
```

**BLOCKER:** If verification FAILS (< 9/9), STOP. Do NOT deploy code. Investigate database state.

---

### Step 3: Deploy Application Code (AFTER DB PASS)

**Pre-Deployment Checklist:**
- ✅ R3 DB migration PASS
- ✅ r3-verify-database.ts PASS (9/9)
- ✅ Code changes on local branch (NOT merged to main yet)
- ✅ Production app still on pre-R3 code

**Deployment:**
```bash
# Merge R3 code changes to deployment branch
git checkout main
git merge r3-education-cutover

# Build
npm run build

# Deploy (method depends on platform)
npm run deploy

# Verify deployment
curl https://your-app.com/health
```

**Files Deployed:**
- `src/platform/education/shared-kernel/types.ts`
- `src/platform/education/student/student.repository.ts`
- `src/platform/education/student/student.service.ts`
- `src/platform/education/student/student.aggregate.ts`
- `src/platform/education/contracts/student.contract.impl.ts`
- `src/platform/host/party/party.repository.ts` (NEW)

**BLOCKER:** If deployment fails, rollback immediately (`git revert`). Database remains functional on legacy `person_id` paths.

---

### Step 4: Run Integration Tests (AFTER Code Deploy)

```bash
npm run test tests/remediation/r3-education-cutover.test.ts
```

**Expected:**
- 10/10 tests PASS
- NO new Person rows created (count = 848)
- Students queryable by `party_id`
- FK integrity valid
- Contract semantics correct

**BLOCKER:** If tests FAIL, investigate immediately. May need code hotfix or rollback.

---

### Step 5: Run Negative Tests (Manual Verification)

**1. Verify persons count unchanged:**
```sql
SELECT COUNT(*) FROM persons;
-- Expected: 848 (R2 baseline, unchanged)
```

**2. Create new student and verify party_id:**
```typescript
const party = await createParty({ party_type: 'person', tenant_id: 'test', display_name: 'R3 Test' });
const student = await studentContract.registerStudent({ 
  tenantId: 'test', 
  partyId: party.id, 
  studentCode: 'EDU-2026-TEST' 
});

console.log(student.partyId);  // Should equal party.id
```

**3. Verify NO new Person created:**
```sql
SELECT COUNT(*) FROM persons;
-- Expected: still 848 (unchanged)
```

**4. Verify Contract DTO semantics:**
```typescript
const dto = await studentContract.getStudent('test', party.id);
console.log(dto.partyId === party.id);  // Should be true (not persons.id)
```

---

### Step 6: Reconcile Migration History (REQUIRED)

**Execute via Dashboard:**
```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260912000000',
  'r3_education_identity_cutover',
  ARRAY['R3.1 ADD students.party_id', 'R3.2 BACKFILL', 'R3.3-R3.8 VERIFY']
);
```

**Verify:**
```bash
supabase migration list | grep 20260912000000

# Expected: Both Local and Remote columns populated
#   20260912000000   | 20260912000000   | 2026-09-12 00:00:00
```

**CRITICAL:** This is NOT optional. Next migration will fail if history not reconciled.

---

### Step 7: Seal R3 Evidence (AFTER All Pass)

Create `docs/products/bella-english-center/R3_COMPLETION_REPORT.md`:

```text
R3 EDUCATION IDENTITY CUTOVER — COMPLETION REPORT

EXECUTION TIMESTAMP: YYYY-MM-DD HH:MM:SS UTC

R3 DATABASE MIGRATION:
  students.party_id added            ✅ (timestamp)
  631/631 students backfilled        ✅
  FK integrity valid                 ✅ (0 orphans)
  Tenant consistency valid           ✅ (0 mismatches)
  Execution time: XX seconds

R3 DATABASE VERIFICATION:
  Independent checks                 ✅ (9/9 PASS)
  persons count preserved            ✅ (848, unchanged)

R3 APPLICATION CODE:
  Files deployed                     ✅ (6 updated + 1 new)
  Deployment timestamp               YYYY-MM-DD HH:MM:SS UTC

R3 INTEGRATION TESTS:
  Test suite                         ✅ (10/10 PASS)
  NO new Person rows created         ✅ (count = 848)
  Contract semantics correct         ✅

R3 MIGRATION HISTORY:
  Reconciliation                     ✅ (record inserted)
  supabase migration list            ✅ (verified)

R3 STATUS:                           ✅ COMPLETE
R4 STATUS:                           🟢 AUTHORIZED

Next: Execute R4 Caller Migration (8 callers, 40+ test fixtures)
```

---

### Step 8: Authorize R4

Update status:
```text
R3 Education Cutover               ✅ COMPLETE
R4 Caller Migration                🟢 AUTHORIZED
```

Only after R3 evidence sealed and migration history reconciled.

---

## 🔄 ROLLBACK PROCEDURE

### If Code Deployment Fails

```bash
# Revert application code
git revert <commit-hash>

# Redeploy
npm run deploy

# Database stays as-is (party_id column harmless)
# Legacy person_id paths still work
```

**Impact:** Minimal. Database has `party_id` column but code doesn't use it. System functions normally on legacy `person_id` paths.

---

### If Database Migration Fails

**DO NOT deploy application code.**

**Rollback SQL:**
```sql
DROP CONSTRAINT students_party_id_fkey;
DROP INDEX idx_students_party_id;
ALTER TABLE students DROP COLUMN party_id;
```

**Verify rollback:**
```sql
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'students' AND column_name = 'party_id';
-- Expected: 0 rows
```

---

## 📊 R3 READINESS STATUS

```text
R3 DATABASE MIGRATION:
  SQL file prepared                  ✅
  Idempotent                         ✅
  Rollback procedure documented      ✅
  Deployment method selected         ✅
  NOT DEPLOYED                       ❌

R3 APPLICATION CODE:
  Types updated                      ✅
  Repository updated                 ✅
  Service updated                    ✅
  Aggregate updated                  ✅
  Contract fixed                     ✅
  PartyRepository created            ✅
  NOT DEPLOYED                       ❌

R3 TESTS:
  Integration tests prepared         ✅
  Negative tests prepared            ✅
  Verification script prepared       ✅
  NOT EXECUTED                       ❌

R3 OVERALL:
  Artifacts ready                    ✅
  Deployment pending                 🟡
  R4 NOT authorized                  ❌
```

---

## 🎯 SUCCESS CRITERIA

```text
R3 DATABASE:
  631/631 students have party_id     ⏸️
  FK integrity valid                 ⏸️
  Tenant consistency valid           ⏸️

R3 CODE:
  StudentService uses Party          ⏸️
  Contract semantics fixed           ⏸️
  New students populate party_id     ⏸️
  NO new Person rows created         ⏸️

R3 TESTS:
  Integration tests PASS             ⏸️
  Negative tests PASS                ⏸️
  Regression tests PASS              ⏸️

R3 EVIDENCE:
  Deployment log captured            ⏸️
  Verification results documented    ⏸️
  Completion report sealed           ⏸️
```

---

## 📋 MIGRATION HISTORY RECONCILIATION (REQUIRED)

### Post-R3 Action — NOT OPTIONAL

After manual SQL execution via Dashboard, migration history WILL diverge:

**Issue:**
- Local: `supabase/migrations/20260912000000_r3_education_identity_cutover.sql`
- Remote: NOT tracked in `supabase_migrations.schema_migrations` (manual execution)

**Impact:** Next `supabase db push` will attempt to re-apply R3 migration → duplicate key error / migration failure

**Resolution (REQUIRED before next migration):**

**Step 1: Record Migration in History Table**
```sql
-- Execute via Dashboard after R3 migration succeeds
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES (
  '20260912000000',
  'r3_education_identity_cutover',
  ARRAY['R3.1 ADD students.party_id', 'R3.2 BACKFILL', 'R3.3-R3.8 VERIFY']
);
```

**Step 2: Verify Reconciliation**
```bash
supabase migration list

# Expected: 20260912000000 shows in BOTH Local and Remote columns
#   Local            | Remote           | Time (UTC)
#  ------------------|------------------|-----------------------
#   20260912000000   | 20260912000000   | 2026-09-12 00:00:00
```

**Step 3: Test Next Migration**
```bash
# Create dummy migration to verify push works
supabase migration new test_post_r3

# Try push (should not attempt to re-apply R3)
supabase db push

# If successful, delete test migration
```

**Governance:** R3 evidence CANNOT be sealed until migration history reconciled. R4 authorization blocked until reconciliation complete.

**Critical Path Update:**
```text
5. Deploy R3 code                    ⏸️
6. Run tests                         ⏸️
7. Reconcile migration history       ⏸️ REQUIRED (not optional)
8. Seal R3 evidence                  🚫 BLOCKED (wait reconciliation)
9. Authorize R4                      🚫 BLOCKED
```

---

**STATUS:** 🟡 CODE READY / NOT DEPLOYED

**BLOCKER:** Awaiting R3 database migration execution

**NEXT:** Execute R3 DB migration → Verify → Deploy code → Run tests → Seal evidence → Authorize R4
