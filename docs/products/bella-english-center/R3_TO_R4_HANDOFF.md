# R3 → R4 HANDOFF

**Handoff Date:** 2026-09-12 10:17 UTC  
**From:** R3 Education Identity Cutover (SEALED)  
**To:** R4 Caller Reconciliation & Migration (AUTHORIZED)

---

## ✅ R3 COMPLETION STATUS

```text
Database:               ✅ 631/631 students linked to Party
Code:                   ✅ 6 files + PartyRepository
Runtime Tests:          ✅ 11/11 behavioral PASS
DB Verification:        ✅ 9/9 independent checks PASS
Migration History:      ✅ RECONCILED
Build:                  ✅ PASS
New Person Rows:        ✅ 0

Status:                 🔒 SEALED
Evidence:               R3_COMPLETION_REPORT.md
```

---

## 🎯 R4 SCOPE (Clear Boundaries)

### IN SCOPE: Caller Migration

**What R4 changes:** Active callers understand/use Party (not Person)

**Targets:**
- ✅ Production caller services
- ✅ Test caller methods
- ✅ Test fixtures
- ✅ Helper functions wrapping Student operations

**Success Metric:**
```text
Initial targets     = N (exact count from census)
Migrated            = N (1:1 match)
Remaining           = 0
Unknown             = 0
New Person created  = 0
Build               = PASS
Targeted tests      = PASS
```

### OUT OF SCOPE: Infrastructure Removal

**What R4 does NOT change:**

- ❌ `students.person_id` FK constraint (removed in R5)
- ❌ `RegisterStudentInput.personId` parameter (deprecated in R5)
- ❌ Person write methods (frozen in R5)
- ❌ 6 remaining FK tables (classified in R5)
- ❌ Architecture discovery (E0 locked)

**Key Distinction:**
```text
R4 = Remove caller ownership of Person identity
R5 = Remove legacy Person infrastructure
```

---

## 📋 R4 EXECUTION SEQUENCE

### Step 1: Census (Exact Count)

**NOT "Discovery"** — census existing callers only, no architecture exploration.

**Commands:**
```bash
# Production callers
grep -r "StudentService\." src/ --include="*.ts" | grep -v "student.service.ts" | grep -v "\.test\.ts"

# Test callers
grep -r "StudentService\." tests/ --include="*.test.ts" | wc -l

# Deprecated API usage
grep -r "getStudentsByPersonId" src/ tests/ --include="*.ts"

# Test fixtures
grep -r "createStudent\|student.*fixture" tests/ --include="*.ts" | wc -l
```

**Deliverables:**
- `R4_CALLER_CENSUS.md` (exact counts, not estimates)
- `R4_RECONCILIATION_TABLE.md` (every target tracked)

**Format:**
```text
Production callers:     X (exact)
Test callers:          X (exact)
Test fixtures:         X (exact)
Helper functions:      X (exact)
───────────────────────────────
TOTAL TARGETS:         X (exact)
```

### Step 2: Migration (1:1 Accountability)

**For each target in reconciliation table:**

1. Identify identity source (R3): How did it use Person?
2. Define Party source: How should it use Party?
3. Execute migration action: Specific code change
4. Capture runtime evidence: Test proving correctness
5. Update status: TODO → IN PROGRESS → DONE

**Example:**
```typescript
// BEFORE (R3)
const students = await getStudentsByPersonId(personId, tenantId);

// AFTER (R4)
const students = await getStudentsByPartyId(partyId, tenantId);
```

**Rule:** Callers use existing Person IDs from Party backfill (R2). Do NOT create new Persons.

### Step 3: Verification

```bash
# All tests PASS
npm run test

# No deprecated API usage (in active logic)
grep -r "getStudentsByPersonId" src/ --include="*.ts" | grep -v "student.repository.ts"

# No new Person creation (in callers)
grep -r "createPerson\|PersonService\.create" src/ --include="*.ts" | grep -v "student.service.ts"

# Build check
npm run build
```

### Step 4: Reconciliation Check

**Verify:**
```text
✅ Initial targets = Migrated count
✅ Remaining = 0
✅ Unknown = 0
✅ All reconciliation table rows = DONE
✅ Runtime evidence captured per target
✅ All targeted tests PASS
✅ Build PASS
```

### Step 5: Evidence Seal

**Create:** `R4_COMPLETION_REPORT.md`

**Required:**
- Exact caller counts
- Reconciliation table (all rows complete)
- Migration metrics (Initial = Migrated)
- Test results (all PASS)
- Build verification

---

## 🚫 R4 ANTI-PATTERNS

### DON'T: Remove Every `personId` Occurrence

❌ **Wrong Goal:** "Find/replace all personId → delete"

**Why wrong:**
- `personId` is valid compatibility bridge until R5
- Migration evidence files contain `personId` (historical)
- Legacy schema has `person_id` column (removed in R5)

✅ **Right Goal:** "Remove active caller treating Person as canonical"

### DON'T: Expand Scope to R5 Tasks

❌ **Wrong Approach:** "While we're here, let's freeze Person writes too"

**Why wrong:**
- R5 has different success criteria
- Changes risk invalidating R4 evidence
- Scope creep delays R4 seal

✅ **Right Approach:** "Migrate callers only. R5 handles infrastructure."

### DON'T: Use Estimates

❌ **Wrong Metric:** "Migrated ~40 fixtures"

**Why wrong:**
- Can't verify completion (remaining unknown)
- "Lost" callers discovered in R5
- False-green seal risk

✅ **Right Metric:** "Migrated 42/42 fixtures (remaining = 0)"

---

## 📊 R4 EXIT CRITERIA (Quantitative)

```text
CENSUS COMPLETE
Known production callers     = X (exact)
Known test callers          = X (exact)
Known fixtures/helpers      = X (exact)
Total migration targets     = X (exact, not estimate)

MIGRATION COMPLETE
Migrated to Party APIs      = X (must equal total targets)
Remaining Person API usage  = 0 (in active caller logic)
Unknown callers             = 0
Deprecated API usage        = 0

VERIFICATION COMPLETE
Build status                = PASS
Targeted tests              = PASS (list specific test files)
New Person identities       = 0
Reconciliation table        = All rows DONE
```

**Seal Condition:** All metrics achieved. No exceptions.

---

## 🔑 KEY HANDOFF ARTIFACTS

### From R3 (Available)

1. ✅ **`R3_COMPLETION_REPORT.md`**
   - 631 students migrated
   - 11/11 runtime tests PASS
   - PartyRepository created

2. ✅ **`CHECKPOINT_R3_SEALED.md`**
   - Canonical state snapshot
   - R4 boundaries defined

3. ✅ **`tests/remediation/r3-integration.test.ts`**
   - Runtime behavioral tests (reference for R4 test updates)

4. ✅ **`RegisterStudentInput.personId` (temporary bridge)**
   - Valid until R5
   - Callers use existing Person IDs from backfill

### For R4 (Create)

1. 🔲 **`R4_CALLER_CENSUS.md`**
   - Exact caller inventory
   - Total targets count

2. 🔲 **`R4_RECONCILIATION_TABLE.md`**
   - Every target tracked 1:1
   - Migration actions defined
   - Runtime evidence per row

3. 🔲 **`R4_COMPLETION_REPORT.md`**
   - Migration metrics
   - Reconciliation verification
   - Evidence seal

---

## 🎯 R4 SUCCESS DEFINITION

**R4 succeeds when:**

```text
1. Every active caller uses Party-based Student APIs
2. Zero callers treat Person as canonical identity
3. All migration targets reconciled 1:1 (Initial = Migrated)
4. No new Person identities created during migration
5. All targeted tests PASS
6. Build PASS
7. Evidence documented with exact counts
```

**R4 fails if:**

```text
❌ "Lost" callers discovered in R5
❌ Estimates used instead of exact counts
❌ Reconciliation table incomplete (rows TODO)
❌ New Person identities created
❌ Tests fail
❌ Build fails
```

---

## 📚 REFERENCE DOCUMENTS

**R3 Evidence:**
- `R3_COMPLETION_REPORT.md`
- `CHECKPOINT_R3_SEALED.md`
- `tests/remediation/r3-integration.test.ts`

**R4 Planning:**
- `R4_CALLER_MIGRATION_PLAN.md`
- `R4_RECONCILIATION_TABLE_TEMPLATE.md`

**Architecture Principles:**
- `REMEDIATION_VS_ENFORCEMENT.md`
- `E0_4_BUSINESS_INVARIANTS.md`

**Status Tracking:**
- `IDENTITY_REMEDIATION_STATUS.md`

---

## ⏭️ NEXT: R5 LEGACY FREEZE

**After R4 seals:**

```text
R5 Scope:
- Freeze 5 legacy Person writer methods
- Classify 6 remaining FK tables (keep vs migrate)
- Mark personId parameter @deprecated
- Prove new Student flows work without Person writes
- Document exact legacy surface area
```

**R5 does what R4 cannot:** Remove infrastructure, not just change callers.

---

**Handoff Complete:** R3 → R4  
**R4 Status:** AUTHORIZED  
**R4 Start:** When census begins  
**R4 Success:** When exit criteria met
