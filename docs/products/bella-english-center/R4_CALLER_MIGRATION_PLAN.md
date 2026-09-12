# R4: CALLER MIGRATION PLAN

**Status:** 🟢 AUTHORIZED (R3 sealed 2026-09-12 10:17 UTC)  
**Objective:** Migrate all Student callers from Person-based APIs to Party-based APIs  
**Scope:** 8 known caller services + exact count of test fixtures

---

## 📊 MIGRATION INVENTORY

### Services to Migrate (8)

```text
1. PartyService          (if calls StudentService)
2. GuardianService       (links guardians → students)
3. EnrollmentService     (student enrollment flows)
4. AttendanceService     (student attendance tracking)
5. GradeService          (student academic records)
6. CareService           (student care/health records)
7. CommunicationService  (parent/student messaging)
8. FinanceService        (student billing/tuition)
```

**Discovery Task:** Verify exact caller list via:
```bash
grep -r "StudentService\." src/ --include="*.ts" | grep -v "student.service.ts" | cut -d: -f1 | sort -u
grep -r "getStudentsByPersonId" src/ --include="*.ts" | cut -d: -f1 | sort -u
```

### Test Fixtures to Reconcile

**Current estimate:** 40+ fixtures  
**R4 Task:** Reconcile to **exact count** before R7 seal

**Discovery Task:**
```bash
grep -r "person_id.*student" tests/ --include="*.test.ts" | wc -l
grep -r "createStudent" tests/ --include="*.test.ts" | wc -l
```

**Target inventory format:**
```text
Integration tests:     X fixtures
Unit tests:           X fixtures
E2E tests:            X fixtures
Setup/teardown:       X fixtures
───────────────────────────────
TOTAL:                X fixtures (exact)
```

---

## 🎯 R4 SUCCESS CRITERIA

### Caller Reconciliation (Exact Count)

```text
✅ Production callers identified:     X (exact)
✅ Test callers identified:           X (exact)
✅ Test fixtures identified:          X (exact)
✅ Helper functions identified:       X (exact)
✅ Total migration targets:           X (exact, not "~8" or "40+")
✅ Unknown/untracked callers:         0
```

### Code Migration

```text
✅ All identified callers use Party-based Student APIs
✅ Zero references to getStudentsByPersonId() (deprecated method)
✅ All new Student flows use partyId (canonical identity)
✅ Callers do NOT create new Person identities
✅ Callers use existing Person IDs from Party backfill
✅ Build successful (no TypeScript errors)
```

### Test Verification

```text
✅ All active test fixtures use Party-based setup
✅ All integration tests PASS
✅ All unit tests PASS
✅ No new Person identities created during test runs
```

### Metrics (Exit Criteria)

```text
Known production callers     = exact (not estimate)
Known test callers          = exact
Known fixtures/helpers      = exact
Total migration targets     = exact

Migrated to Party APIs      = 100% of targets
Remaining Person API usage  = 0 (in active caller logic)
Unknown callers             = 0
Deprecated API usage        = 0

Build status                = PASS
Targeted tests              = PASS
New Person identities       = 0 (during migration)
```

**Note:** `personId` parameter in contracts remains valid (compatibility bridge until R5). R4 removes **caller ownership of Person identity**, not the bridge itself.

---

## 🔒 ARCHITECTURE NOTES

### Temporary Compatibility Bridge

**Current State (R3):**
```typescript
// src/platform/education/contracts/student.contract.ts
export interface RegisterStudentInput {
  readonly partyId: string;        // CANONICAL identity
  readonly personId?: string;      // LEGACY FK (temporary until R4)
  readonly studentCode: string;
  // ...
}
```

**Status:** ⚠️ **TEMPORARY BRIDGE ONLY**

**Rationale:**
- `students.person_id` FK still enforced at DB level (until R5)
- Product Vertical callers should NOT create new Persons
- R4 migration uses existing Person IDs from backfill
- R5 will freeze legacy Person writes

**Target Architecture (post-R5):**
```typescript
// Future state (R5+)
export interface RegisterStudentInput {
  readonly partyId: string;        // CANONICAL (only identity needed)
  readonly studentCode: string;
  // personId removed — no longer required
}
```

**Deprecation Path:**
```text
R4: Migrate callers to use existing Person IDs from Party backfill
R5: Freeze Person writes, mark personId parameter @deprecated
R6: Verify new Student flows work without Person dependency
R7: Document personId removal plan for next major version
```

---

## 📝 EXECUTION STEPS

### Step 1: Caller Reconciliation (Exact Census)

**NOT "Discovery" — census only, no architecture exploration.**

**Output:** `R4_CALLER_CENSUS.md` + populated `R4_RECONCILIATION_TABLE.md`

```bash
# 1. Find all production Student callers
grep -r "StudentService\." src/ --include="*.ts" \
  | grep -v "student.service.ts" \
  | grep -v "\.test\.ts" \
  | cut -d: -f1 | sort -u > r4-production-callers.txt

# 2. Count test callers
grep -r "StudentService\." tests/ --include="*.test.ts" \
  | cut -d: -f1 | sort -u | wc -l

# 3. Find Person-based queries (deprecated)
grep -r "getStudentsByPersonId" src/ tests/ --include="*.ts"

# 4. Count test fixtures with Student setup
grep -r "createStudent\|student.*fixture" tests/ --include="*.ts" | wc -l

# 5. Find helper functions
grep -r "function.*[Ss]tudent" src/ tests/ --include="*.ts" | grep -v "StudentService"
```

**Reconciliation Table Format:** See `R4_RECONCILIATION_TABLE_TEMPLATE.md`

**Required for each target:**
```text
1. Clear identity source (R3) — what canonical identity before?
2. Clear Party source — what Party approach replaces it?
3. Defined migration action — specific code change
4. Runtime evidence — test proving correctness
5. Final status — TODO → IN PROGRESS → DONE
```

**Census Output Format:**
```text
Production callers:     X services (exact list)
Test callers:          X test files
Test fixtures:         X fixtures
Helper functions:      X helpers
───────────────────────────────────────
TOTAL TARGETS:         X (exact, not estimate)
```

**Accountability Rule:** Every target tracked 1:1. No "lost" callers discovered in R5.

### Step 2: Service Migration

For each caller service:

1. **Replace deprecated APIs:**
   ```typescript
   // BEFORE (R3)
   const students = await StudentService.getStudentsByPersonId(personId, tenantId);
   
   // AFTER (R4)
   const students = await StudentService.getStudentsByPartyId(partyId, tenantId);
   ```

2. **Update Student creation:**
   ```typescript
   // R4: Use existing Person ID from Party backfill
   const student = await StudentService.createStudent({
     partyId: party.id,           // From Party entity
     personId: party.person_id,   // LEGACY FK (temporary)
     // ...
   });
   ```

3. **Mark legacy usage:**
   ```typescript
   // LEGACY: personId required until R5 (students.person_id FK)
   personId: existingPersonId,
   ```

### Step 3: Test Fixture Migration

1. Update test setup to use Party-based fixtures
2. Mark legacy Person fixtures for R5 cleanup
3. Verify all tests PASS

### Step 4: Verification

```bash
# Run full test suite
npm run test

# Verify no deprecated API usage in active caller logic
grep -r "getStudentsByPersonId" src/ --include="*.ts" \
  | grep -v "student.repository.ts" \
  | grep -v "LEGACY:"

# Verify no new Person creation in callers
grep -r "createPerson\|PersonService\.create" src/ --include="*.ts" \
  | grep -v "student.service.ts"

# Build check
npm run build
```

**Exit Criteria Check:**
```text
✅ All identified callers migrated
✅ Zero deprecated API usage (except internal StudentService)
✅ Zero new Person creation in caller code
✅ All tests PASS
✅ Build PASS
```

### Step 5: Documentation

**Create:** `R4_COMPLETION_REPORT.md`

**Required Evidence:**
- Exact caller count (production + test)
- Exact fixture count
- Migration completion metrics
- Test results (all PASS)
- Build verification

**Note:** Document `personId` as **compatibility bridge** (not deprecated yet — R5 task)

---

## 🚫 OUT OF SCOPE (R5 Tasks)

**DO NOT attempt in R4:**

1. ❌ Remove `students.person_id` FK constraint (DB migration, R5 task)
2. ❌ Freeze Person write methods (5 legacy writers, R5 task)
3. ❌ Deprecate/remove `personId` parameter (compatibility bridge until R5)
4. ❌ Migrate remaining 6 FK tables (requires separate analysis, R5+)
5. ❌ Architecture discovery for new domains (E0 locked)
6. ❌ Create new Person identities (callers use backfilled IDs only)

**R4 Focus:** Census existing callers → migrate to Party APIs → verify. **No exploration, no expansion.**

---

## 📦 DELIVERABLES

```text
✅ R4_CALLER_CENSUS.md              (exact inventory, not estimates)
✅ R4_RECONCILIATION_TABLE.md       (every target tracked 1:1)
✅ X production callers migrated     (Party-based APIs)
✅ X test callers migrated           (Party-based fixtures)
✅ X fixtures updated                (exact count documented)
✅ R4_COMPLETION_REPORT.md          (evidence + quantitative exit criteria)
✅ Zero deprecated API usage         (in active caller logic)
✅ Zero new Person creation          (callers use backfilled IDs)
✅ Reconciliation verified           (Initial = Migrated, Remaining = 0)
```

**Reconciliation Accountability:**
- Every row in table resolved (no TODO left)
- Initial targets = Migrated count (1:1 match)
- Runtime evidence captured per target
- No "lost" callers discovered later

**Note:** `personId` compatibility bridge remains valid until R5 (not removed in R4).

---

## ⏭️ NEXT: R5 LEGACY FREEZE

**After R4 complete:**

```text
R5 Scope:
- Freeze 5 legacy Person writer methods
- Classify 6 remaining FK tables (keep vs migrate)
- Mark personId parameter @deprecated
- Prove new Student flow works without Person writes
- Document exact legacy surface area for R6 verification
```

**Critical Path:**
```text
R4 (callers) → R5 (freeze) → R6 (E2E regression) → R7 (seal)
                                                      ↓
                                            Finance remediation
                                                      ↓
                                            E1 Readiness Gate
```

---

**R4 Authorization:** 🟢 AUTHORIZED  
**Blocked By:** None (R3 sealed)  
**Blocks:** R5 Legacy Freeze
