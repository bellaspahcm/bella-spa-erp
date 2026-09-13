# R4 CALLER RECONCILIATION TABLE

**Purpose:** Track every migration target with 1:1 accountability  
**Status:** Template (populate during R4 census)

---

## 📋 RECONCILIATION PRINCIPLES

### Success Metric

```text
Initial targets     = N (exact count from census)
Migrated            = N (1:1 match)
Remaining           = 0
Unknown             = 0
New Person created  = 0
Build               = PASS
Targeted tests      = PASS
```

### What Counts as "Target"

**IN SCOPE:**
- ✅ Production caller methods using Student APIs
- ✅ Test caller methods using Student setup
- ✅ Test fixtures creating Student data
- ✅ Helper functions wrapping Student operations

**OUT OF SCOPE:**
- ❌ Compatibility bridge (`RegisterStudentInput.personId` field)
- ❌ Migration evidence files (R0-R3 reports)
- ❌ Legacy schema fields (students.person_id column)
- ❌ Internal StudentService/Repository logic

### What "Migration" Means

**NOT:** Remove every `personId` occurrence  
**YES:** Remove **active caller treating Person as canonical identity**

**Example (IN SCOPE):**
```typescript
// BEFORE R4 (treats Person as canonical)
const students = await getStudentsByPersonId(personId);

// AFTER R4 (treats Party as canonical)
const students = await getStudentsByPartyId(partyId);
```

**Example (OUT OF SCOPE):**
```typescript
// Compatibility bridge - VALID until R5
export interface RegisterStudentInput {
  readonly partyId: string;      // canonical
  readonly personId?: string;    // bridge (R5 removes)
}
```

---

## 📊 RECONCILIATION TABLE

### Production Callers

| File/Method | Identity Source (R3) | Target Party Source | Migration Action | Runtime Evidence | Status |
|-------------|---------------------|---------------------|------------------|------------------|--------|
| `PartyService.linkStudent()` | `person_id` param | `party.id` lookup | Replace param | Test: linkage creates correct FK | 🔲 TODO |
| `GuardianService.getChildren()` | `Person.id` → Student | `Party.id` → Student | Update query | Test: returns correct students | 🔲 TODO |
| ... | ... | ... | ... | ... | ... |

### Test Callers

| Test File | Identity Source (R3) | Target Party Source | Migration Action | Runtime Evidence | Status |
|-----------|---------------------|---------------------|------------------|------------------|--------|
| `student.service.test.ts` | `createPerson()` fixture | `createParty()` fixture | Replace setup | Test suite PASS | 🔲 TODO |
| `enrollment.test.ts` | `mockPersonId` | `mockPartyId` | Update mocks | Integration PASS | 🔲 TODO |
| ... | ... | ... | ... | ... | ... |

### Test Fixtures

| Fixture/Helper | Identity Source (R3) | Target Party Source | Migration Action | Runtime Evidence | Status |
|----------------|---------------------|---------------------|------------------|------------------|--------|
| `createTestStudent()` | Person factory | Party factory | Update factory | Used in X tests, all PASS | 🔲 TODO |
| `studentFixtures.ts` | hardcoded person_id | Party backfill ID | Use real Party | Fixtures create valid data | 🔲 TODO |
| ... | ... | ... | ... | ... | ... |

---

## 📈 CENSUS SUMMARY (Populate After Step 1)

```text
PRODUCTION CALLERS
Services:           ___ (exact count)
Methods:            ___ (exact count)

TEST CALLERS
Test files:         ___ (exact count)
Test methods:       ___ (exact count)

FIXTURES/HELPERS
Fixture functions:  ___ (exact count)
Helper utilities:   ___ (exact count)

═══════════════════════════════════════
TOTAL TARGETS:      ___ (exact, not estimate)
═══════════════════════════════════════
```

---

## ✅ MIGRATION VERIFICATION (After Step 2-4)

```text
Initial targets:         ___ (from census)
Migrated:               ___ (must equal targets)
Remaining:              ___ (must = 0)
Unknown/untracked:      ___ (must = 0)

New Person created:     ___ (must = 0)
Build status:           [ ] PASS
Targeted tests:         [ ] PASS (list specific test files)

Deprecated API usage:   ___ occurrences in active logic (must = 0)
```

---

## 🚫 NON-GOALS (Do NOT reconcile)

These are **OUT OF SCOPE** for R4:

```text
❌ Compatibility bridge occurrences (valid until R5)
❌ Migration evidence files (historical documentation)
❌ Legacy DB columns (students.person_id removed in R5)
❌ Internal StudentService/Repository (already uses Party)
❌ Commented-out code or TODOs referencing Person
```

**Rationale:** R4 changes **caller behavior**, not infrastructure removal.

---

## 📝 COMPLETION CHECKLIST

### Before Migration

- [ ] Census complete (all counts exact)
- [ ] Reconciliation table populated (every target tracked)
- [ ] Total targets documented (no estimates)
- [ ] Migration actions defined (every row)

### During Migration

- [ ] Each target migrated 1:1 (update table status)
- [ ] Runtime evidence captured (test results per target)
- [ ] No new Person identities created (verified per caller)
- [ ] Build remains green (after each batch)

### After Migration

- [ ] Initial targets = Migrated count
- [ ] Remaining = 0
- [ ] Unknown = 0
- [ ] All targeted tests PASS
- [ ] Build PASS
- [ ] Deprecated API usage = 0 (in active caller logic)

### Evidence Seal

- [ ] Reconciliation table complete (all rows ✅)
- [ ] Census summary updated (final counts)
- [ ] Migration verification complete (all checks ✅)
- [ ] R4_COMPLETION_REPORT.md created
- [ ] R5 authorized

---

## 🎯 ACCOUNTABILITY RULE

**Every row in reconciliation table must have:**

1. **Clear identity source (R3)** — what canonical identity did caller use before?
2. **Clear Party source** — what Party-based approach replaces it?
3. **Defined migration action** — specific code change required
4. **Runtime evidence** — test result proving behavior correct
5. **Final status** — 🔲 TODO → 🔄 IN PROGRESS → ✅ DONE

**No row left unresolved.** If discovered during migration:
- Add to table immediately
- Update total targets count
- Execute migration before R4 seal

**No "lost" callers.** No "oops, we missed one" in R5.

---

**Template Version:** 1.0  
**Last Updated:** 2026-09-12  
**Usage:** Populate during R4 Step 1 (Census)
