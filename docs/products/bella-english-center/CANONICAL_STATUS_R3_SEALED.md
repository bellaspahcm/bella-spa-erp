# CANONICAL STATUS: R3 SEALED

**Date:** 2026-09-12 10:17 UTC  
**Status:** R3 🔒 SEALED | R4 🟢 AUTHORIZED  
**Progress:** 4/8 milestones (50%)

---

## 📊 IDENTITY REMEDIATION TRACK

```text
═══════════════════════════════════════════════════════════════
BELLA ENGLISH CENTER — IDENTITY REMEDIATION (E0.1A-R)
═══════════════════════════════════════════════════════════════

R0  Preflight Validation            ✅ COMPLETE
R1  Identity Mapping                🔒 SEALED
R2  Party Backfill                  🔒 SEALED
R3  Education Student Cutover       🔒 SEALED (2026-09-12)
R4  Caller Reconciliation/Migration 🟢 AUTHORIZED
R5  Legacy Person Freeze            ⏸️  BLOCKED (wait R4)
R6  Full Verification & E2E         ⏸️  BLOCKED (wait R5)
R7  Evidence + Enforcement Seal     ⏸️  BLOCKED (wait R6)

═══════════════════════════════════════════════════════════════
Progress: 4/8 milestones complete
Next:     R4 Caller Reconciliation Census → Migration
═══════════════════════════════════════════════════════════════
```

---

## ✅ R3 SEALED EVIDENCE

### Database Migration

```text
Students migrated:       631/631 (100%)
Party entities linked:   631/631 (100%)
Orphan students:        0
Invalid FK:             0
Tenant mismatches:      0
Persons unchanged:      848 (baseline maintained)
New Person rows:        0
```

### Code Deployment

```text
Files modified:         6
New repositories:       1 (PartyRepository)
Build status:          ✅ PASS
TypeScript errors:     0
```

### Runtime Behavioral Tests

```text
Integration tests:     11/11 PASS
DB verification:       9/9 PASS
Execution time:        ~2.5s
Test file:            tests/remediation/r3-integration.test.ts
```

### Migration History

```text
Migration file:        20260912000000_r3_education_student_party_cutover.sql
Applied locally:       ✅ YES
Applied remotely:      ✅ YES
Status:               RECONCILED
```

---

## 🟢 R4 AUTHORIZED SCOPE

### IN SCOPE: Caller Migration

```text
✅ Census existing callers (exact count, not estimate)
✅ Migrate production callers to Party-based APIs
✅ Migrate test callers/fixtures to Party-based setup
✅ Remove deprecated API usage (getStudentsByPersonId)
✅ Verify callers don't create new Person identities
```

### OUT OF SCOPE: Infrastructure

```text
❌ Remove students.person_id FK constraint (R5 task)
❌ Freeze Person write methods (R5 task)
❌ Deprecate/remove personId parameter (R5 task)
❌ Migrate 6 remaining FK tables (R5+ analysis)
❌ Architecture discovery (E0 locked)
```

### Success Criteria

```text
Initial targets     = N (exact from census)
Migrated            = N (1:1 match)
Remaining           = 0
Unknown             = 0
New Person created  = 0
Build               = PASS
Targeted tests      = PASS
```

---

## 🔑 KEY ARCHITECTURAL DECISIONS

### Compatibility Bridge (Temporary)

**Location:** `src/platform/education/contracts/student.contract.ts`

```typescript
export interface RegisterStudentInput {
  readonly partyId: string;        // CANONICAL identity
  readonly personId?: string;      // ⚠️ TEMPORARY (until R5)
  readonly studentCode: string;
}
```

**Status:** Valid until R5 (not removed in R4)

**Rationale:**
- DB FK `students.person_id` still enforced
- Product Verticals use existing Person IDs from backfill
- R5 will freeze Person writes and mark @deprecated

### R4 Changes vs R5 Changes

```text
R4 CHANGES:     Active caller behavior (Person → Party)
R4 PRESERVES:   Infrastructure (FK constraints, bridge parameter)

R5 CHANGES:     Infrastructure (freeze writes, deprecate bridge)
R5 PRESERVES:   Migrated caller code (from R4)
```

**No overlap.** Clear boundary between milestones.

---

## 🏛️ PLATFORM ENFORCEMENT PRINCIPLE

### Intent (Documented)

**Identity remediation intended as one-time platform remediation.**

New Person-based debt **must be automatically prevented** by Platform.

Equivalent remediation **should not recur** unless enforcement fails.

### Proof (R7 Requirement)

**R7 must deliver working enforcement chain:**

```text
Party Architecture
    ↓
Automated Guard (code)
    ↓
Adversarial Test (proof)
    ↓
BLOCK legacy Person pattern
ALLOW valid Party pattern
    ↓
Evidence Seal (verified)
    ↓
Bella Platform/Factory Integration
```

**Documents describe intent. Code/Gates prove enforcement.**

See: `docs/architecture/R7_ENFORCEMENT_CHAIN_SPEC.md`

---

## 📚 CANONICAL DOCUMENTS

### R3 Evidence

- `R3_COMPLETION_REPORT.md` — Full completion evidence
- `CHECKPOINT_R3_SEALED.md` — State snapshot + R4 boundaries
- `tests/remediation/r3-integration.test.ts` — 11 behavioral tests

### R4 Planning

- `R4_CALLER_MIGRATION_PLAN.md` — Execution plan
- `R4_RECONCILIATION_TABLE_TEMPLATE.md` — 1:1 accountability
- `R3_TO_R4_HANDOFF.md` — Clear handoff with artifacts

### Architecture Principles

- `REMEDIATION_VS_ENFORCEMENT.md` — Platform principle
- `R7_ENFORCEMENT_CHAIN_SPEC.md` — R7 proof requirements
- `E0_1A_IDENTITY_ARCHITECTURE_DESIGN.md` — Party design

### Status Tracking

- `IDENTITY_REMEDIATION_STATUS.md` — Living tracker
- `SESSION_SUMMARY_R3_COMPLETE.md` — Session achievements
- `CANONICAL_STATUS_R3_SEALED.md` — This document

---

## 🎯 CRITICAL PATH

```text
R4 Caller Reconciliation Census
    ↓
R4 Migration (1:1 accountability)
    ↓
R4 Seal (evidence + reconciliation complete)
    ↓
R5 Legacy Person Freeze
    ↓
R6 Full E2E Regression
    ↓
R7 Identity Evidence Seal + Platform Enforcement
    ↓
Finance Remediation (if needed)
    ↓
E1 Readiness Gate
    ↓
E1 Feature Development AUTHORIZED
```

**Current Position:** R4 entry (R3 sealed, zero blockers)

---

## 📋 R4 IMMEDIATE ACTIONS

### Step 1: Census (Exact Count)

```bash
# Production callers
grep -r "StudentService\." src/ --include="*.ts" \
  | grep -v "student.service.ts" | grep -v "\.test\.ts" \
  | cut -d: -f1 | sort -u

# Test callers
grep -r "StudentService\." tests/ --include="*.test.ts" | wc -l

# Deprecated API
grep -r "getStudentsByPersonId" src/ tests/ --include="*.ts"

# Fixtures
grep -r "createStudent\|student.*fixture" tests/ --include="*.ts" | wc -l
```

**Output:** `R4_CALLER_CENSUS.md` with exact numbers

### Step 2: Reconciliation Table

**Populate:** `R4_RECONCILIATION_TABLE.md`

**For each target:**
1. Identity source (R3) — How did it use Person?
2. Party source — How should it use Party?
3. Migration action — Specific code change
4. Runtime evidence — Test proving correctness
5. Status — TODO → IN PROGRESS → DONE

**Accountability:** Every row resolved before R4 seal

---

## 🔒 GOVERNANCE LOCKS

### Zero False-Green Policy

**All milestones require:**
- ✅ Runtime behavioral tests (not just "build successful")
- ✅ Independent verification (not just code inspection)
- ✅ Exact counts (not estimates like "~40")
- ✅ Evidence-based seal (not assumption-based)

### Boundary Discipline

**R4 scope:**
- Census existing code → no architecture discovery
- Exact inventory → no estimates or approximations
- Migrate callers → do NOT expand to R5 tasks
- Verify behavior → do NOT assume based on types

### Platform Enforcement Mandate

**R7 deliverables:**
- ✅ Working Guard (code + integration)
- ✅ Adversarial tests (6+ tests proving enforcement)
- ✅ Build integration (automated prevention)
- ✅ Evidence documentation (ADR + guide + results)

**R7 cannot seal without proof.** Documents describe intent. Code proves enforcement.

---

## 📊 METRICS DASHBOARD

### Database State

```text
students.party_id populated:     631/631
students.person_id preserved:    631/631 (legacy)
persons total:                   848
party_parties total:             631+ (Education)
New Person rows (R3):           0
```

### Test Coverage

```text
R3 integration tests:    11/11 PASS
R3 DB verification:      9/9 PASS
R2 DB verification:      12/12 PASS
Build status:            ✅ PASS
```

### Remediation Progress

```text
Milestones complete:     4/8 (50%)
Students migrated:       631/631 (100%)
Callers migrated:        0/N (R4 in progress)
Legacy writes frozen:    0/5 (R5 pending)
```

---

## ⚠️ KNOWN TECHNICAL DEBT

### Compatibility Bridges (Temporary until R5)

1. **`RegisterStudentInput.personId`** (contract parameter)
   - Status: Valid until R5
   - Removal: R5 deprecation + R6 verification

2. **`students.person_id` FK** (database constraint)
   - Status: Active (enforced)
   - Removal: R5 migration + validation

3. **Person write methods** (5 legacy writers)
   - Status: Active (not frozen)
   - Freeze: R5 task

### For R5+ Classification

4. **6 remaining FK tables** referencing `persons`
   - Status: Not analyzed
   - Classification: R5 task (keep vs migrate)

---

## 🚀 SUCCESS DEFINITION

**R3 succeeded because:**
```text
✅ 631 students linked to Party
✅ 11/11 runtime behavioral tests PASS
✅ Zero new Person rows created
✅ Build successful
✅ Migration history reconciled
✅ Evidence documented
```

**R4 will succeed when:**
```text
✅ All callers use Party-based APIs
✅ Zero callers treat Person as canonical
✅ Initial targets = Migrated (1:1 match)
✅ Zero new Person identities created
✅ All targeted tests PASS
✅ Build PASS
✅ Evidence documented with exact counts
```

**R7 will succeed when:**
```text
✅ Guard blocks Person-based products (tested)
✅ Factory uses Party by default (tested)
✅ Enforcement automated (zero human memory)
✅ Adversarial tests prove prevention
✅ Platform integration complete
```

---

**Canonical Status Version:** 1.0  
**Last Updated:** 2026-09-12 10:17 UTC  
**Next Review:** After R4 seal  
**Living Document:** Updates after each milestone
