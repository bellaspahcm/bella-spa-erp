# IDENTITY REMEDIATION STATUS

**Product:** Bella English Center (E1)  
**Remediation Track:** E0.1A-R (Identity Architecture)  
**Last Updated:** 2026-09-12 10:17 UTC

---

## 📊 MILESTONE PROGRESS

```text
E0.1A-R IDENTITY REMEDIATION
═══════════════════════════════════════════════════════════════

R0  Preflight Validation           ✅ COMPLETE
R1  Identity Mapping                🔒 SEALED
R2  Party Backfill                  🔒 SEALED
R3  Education Student Cutover       🔒 SEALED
R4  Caller Migration                🟢 AUTHORIZED
R5  Legacy Person Freeze            ⏸️  BLOCKED (wait R4)
R6  Full Regression & E2E           ⏸️  BLOCKED (wait R5)
R7  Evidence Seal                   ⏸️  BLOCKED (wait R6)

═══════════════════════════════════════════════════════════════
Progress: 4/8 milestones complete
Next:     R4 Caller Reconciliation Census → Migration
═══════════════════════════════════════════════════════════════
```

---

## ✅ COMPLETED MILESTONES

### R0: Preflight Validation

**Sealed:** 2026-09-10  
**Evidence:** Business invariants documented, Gate 0 architecture validated

**Key Outputs:**
- `E0_4_BUSINESS_INVARIANTS.md` (9 invariants)
- `E0_1A_IDENTITY_ARCHITECTURE_DESIGN.md`
- Scope: 631 students, 1 FK table (students.person_id)

### R1: Identity Mapping

**Sealed:** 2026-09-10  
**Evidence:** `R1_IDENTITY_MAPPING_REPORT.md`

**Key Results:**
- 631 students mapped to Person
- 631 unique Person IDs
- 0 orphan students
- 0 Person-less students
- Mapping proven 1:1 (Person ↔ Student)

### R2: Party Backfill

**Sealed:** 2026-09-11  
**Evidence:** `R2_COMPLETION_REPORT.md`

**Key Results:**
- 631 Party entities created
- 848 total persons (631 students + 217 non-students)
- Backfill SQL: `20260912000000_r2_party_backfill.sql`
- Verification: `r2-verify-database.ts` (12/12 PASS)

### R3: Education Student Cutover

**Sealed:** 2026-09-12 10:17 UTC  
**Evidence:** `R3_COMPLETION_REPORT.md`

**Key Results:**
- 631/631 students linked to Party (`students.party_id`)
- StudentService uses Party validation
- 11/11 runtime behavioral tests PASS
- Migration: `20260912000000_r3_education_student_party_cutover.sql`
- Test suite: `tests/remediation/r3-integration.test.ts`
- Build successful, zero new Person rows created

**Architecture Note:**
- `RegisterStudentInput.personId` marked as **temporary compatibility bridge**
- Legacy FK `students.person_id` still enforced (removed in R5)

---

## 🟢 CURRENT MILESTONE: R4 CALLER MIGRATION

**Status:** AUTHORIZED (2026-09-12 10:17 UTC)  
**Plan:** `R4_CALLER_MIGRATION_PLAN.md`

**Objective:** Migrate all Student callers from Person-based APIs to Party-based APIs

**Scope:**
- 8 known caller services
- Exact count of test fixtures (reconcile from "40+")
- Zero usage of deprecated `getStudentsByPersonId()`

**Success Criteria:**
```text
✅ All 8 callers use Party-based Student APIs
✅ PASSES_PERSON_ID = 0 (active callers)
✅ PASSES_PARTY_ID = 8/8
✅ Test fixture count = exact (not "40+")
✅ Build + all tests PASS
```

**Deliverables:**
- `R4_DISCOVERY_REPORT.md` (exact inventory)
- 8 caller services migrated
- `R4_COMPLETION_REPORT.md` (evidence)

**Blocked By:** None (R3 sealed)  
**Blocks:** R5

---

## ⏸️ PENDING MILESTONES

### R5: Legacy Person Freeze

**Dependencies:** R4 complete

**Scope:**
- Freeze 5 legacy Person writer methods
- Classify 6 remaining FK tables (keep vs migrate)
- Mark `personId` parameter @deprecated
- Prove new Student flow works without Person writes
- Document exact legacy surface area

**Deliverables:**
- `R5_LEGACY_FREEZE_REPORT.md`
- Person writer freeze enforcement (tests/guards)
- FK table disposition plan

### R6: Full Regression & E2E

**Dependencies:** R5 complete

**Scope:**
- Run full integration test suite
- E2E student enrollment flows
- Cross-domain contract verification
- Performance regression baseline
- Gate 3 validation (no data corruption)

**Deliverables:**
- `R6_REGRESSION_REPORT.md`
- E2E test results
- Performance baseline

### R7: Evidence Seal

**Dependencies:** R6 complete

**Scope:**
- Final evidence compilation
- Architecture compliance verification
- Seal identity remediation track
- Authorize Finance remediation (if needed)

**Deliverables:**
- `R7_EVIDENCE_SEAL.md`
- Architecture compliance certificate
- E1 readiness gate authorization

---

## 🎯 CRITICAL PATH TO E1

```text
R4 Caller Migration
    ↓
R5 Legacy Freeze
    ↓
R6 Full Regression
    ↓
R7 Evidence Seal
    ↓
Finance Remediation (if needed)
    ↓
E1 Readiness Gate
    ↓
E1 Feature Development AUTHORIZED
```

**Current Blocker:** None (R4 authorized)

---

## 📈 METRICS DASHBOARD

### Identity Remediation

```text
Students migrated:       631/631 (100%)
Party entities created:  631/631 (100%)
Runtime tests passing:   11/11 (100%)
Caller services ready:   0/8 (0%) — R4 in progress
Legacy Person writes:    5 methods (freeze in R5)
Remaining FK tables:     6 tables (classify in R5)
```

### Database State

```text
students.party_id populated:     631/631
students.person_id preserved:    631/631 (legacy)
persons total:                   848 (unchanged since R2)
party_parties total:             631+ (Education domain)
```

### Test Coverage

```text
R3 integration tests:    11/11 PASS
R3 DB verification:      9/9 PASS
R2 DB verification:      12/12 PASS
Build status:            ✅ PASS
```

---

## 🚨 GOVERNANCE NOTES

### Temporary Compatibility Bridge

**Location:** `src/platform/education/contracts/student.contract.ts`

```typescript
export interface RegisterStudentInput {
  readonly partyId: string;        // CANONICAL identity
  readonly personId?: string;      // ⚠️ TEMPORARY (until R5)
  readonly studentCode: string;
}
```

**Status:** ⚠️ **NOT TARGET ARCHITECTURE**

**Rationale:**
- DB FK `students.person_id` still enforced
- Product Verticals must NOT create new Persons
- R4 uses existing Person IDs from Party backfill
- R5 will freeze Person writes and mark @deprecated

**Target (post-R5):**
```typescript
export interface RegisterStudentInput {
  readonly partyId: string;        // ONLY identity needed
  readonly studentCode: string;
}
```

### Zero False-Green Policy

**All milestones must have:**
1. ✅ Runtime behavioral tests (not just "build successful")
2. ✅ Independent DB verification (not just code inspection)
3. ✅ Exact counts (not "~40 fixtures")
4. ✅ Evidence-based seal (not assumption-based)

**R3 Compliance:**
- 11/11 runtime tests PASS ✅
- 9/9 independent DB checks PASS ✅
- Persons count verified = 848 ✅
- Migration history reconciled ✅

---

## 📋 NEXT ACTIONS

**Immediate (R4):**

1. Run caller discovery:
   ```bash
   grep -r "StudentService" src/ --include="*.ts" | grep -v "test.ts"
   ```

2. Reconcile test fixture count (replace "40+"):
   ```bash
   find tests/ -name "*.test.ts" -exec grep -l "createStudent" {} \; | wc -l
   ```

3. Create `R4_DISCOVERY_REPORT.md` with exact inventory

4. Migrate 8 caller services (Person → Party APIs)

5. Update test fixtures

6. Run full test suite + build verification

7. Seal R4 with `R4_COMPLETION_REPORT.md`

**After R4:**
- Start R5 (Legacy Freeze)
- Document exact legacy surface area
- Prove new Student flows work without Person writes

---

**Document Owner:** Identity Remediation Track  
**Review Cadence:** After each milestone seal  
**Next Review:** After R4 complete

