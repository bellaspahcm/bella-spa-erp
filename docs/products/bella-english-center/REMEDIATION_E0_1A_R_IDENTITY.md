---
remediation_id: E0.1A-R
title: Identity Migration (Person → Party)
owner: platform-core-team
severity: blocking
created: 2026-09-12
status: open
blocks_product: bella-english-center
blocks_phase: E1_implementation
---

# E0.1A-R — IDENTITY MIGRATION (PERSON → PARTY)

> **Blocking:** Bella English Center E1 Implementation

---

## 🎯 PROBLEM STATEMENT

### Current State

**Platform Canonical Identity:** `party_parties` (Party model)
- Healthcare OS uses Party
- Real Estate uses Party
- Logistics OS uses Party

**Education Kernel Legacy:** `persons` table + `students.person_id → persons(id)`
- Person model predates Party consolidation
- Education products (Preschool, English Center) blocked from Party features
- Guardian relationships require Party semantic (not available with Person)

### Gap Discovered By

- **Product:** Bella English Center
- **Phase:** E0.1A Semantic Ownership Matrix
- **Sub-phase:** E0.1A-1 Person/Party Reconciliation
- **Date:** 2026-09-12
- **Evidence:** `E0_1A_1_PERSON_PARTY_RECONCILIATION.md`

### Architecture Decision

**Case B: TWO MODELS COEXIST** (migration required)
- Separate migrations (20260806 Party, 20260810 Person)
- No bridge table found
- `students.person_id → persons(id)` NOT `party_parties`
- `teacher_party_id → party_parties` (inconsistent)

**Verdict:** Person is legacy. Migration to Party required.

---

## 🚫 IMPACT ANALYSIS

### Blocks Bella English Center

**Capabilities Blocked: 1**
- `student` (uses person_id FK, requires Party for Guardian relationships)

**Rules Blocked: 1**
- `CROSS-IDENTITY-ALL` (architecture invariant: all new code must use Party)

**Gates Blocked: 2**
- **Gate 5:** Party Identity Model (FK must reference party_parties, not persons)
- **Gate 11:** Identity Migration Warning (legacy Person code marked for migration)

**Manifest Status:**
```yaml
student:
  owner: education-kernel
  status: blocked
  blocked_by: E0.1A-R
  blocker_reason: Student uses person_id FK, requires Party migration
```

---

## ✅ REMEDIATION PLAN

### Owner

**Platform Core Team**

### Scope

**Migration Target:** Education Kernel Student entity
- Migrate `students` table: `person_id` → `party_id`
- Migrate `persons` data → `party_parties`
- Update Education Kernel contracts to use Party
- Update Student service implementation to use Party
- Run full regression tests (Education + Healthcare + Real Estate)

### Prerequisites

1. ✅ Party model established (Healthcare OS)
2. ✅ Party engine available (`src/platform/party/`)
3. ⏸️ Education Kernel regression test suite GREEN (verify before migration)

---

## 📋 MIGRATION TASKS

### Task 1: Schema Migration

**File:** `supabase/migrations/YYYYMMDD_migrate_student_person_to_party.sql`

```sql
-- Step 1: Add party_id column to students (nullable initially)
ALTER TABLE students
ADD COLUMN party_id UUID;

-- Step 2: Migrate persons → party_parties
INSERT INTO party_parties (id, tenant_id, type, display_name, created_at, updated_at)
SELECT 
  p.id,
  p.tenant_id,
  'individual' AS type,
  COALESCE(p.full_name, p.first_name || ' ' || p.last_name) AS display_name,
  p.created_at,
  p.updated_at
FROM persons p
WHERE NOT EXISTS (SELECT 1 FROM party_parties pp WHERE pp.id = p.id);

-- Step 3: Populate students.party_id from persons.id
UPDATE students s
SET party_id = s.person_id
WHERE s.party_id IS NULL;

-- Step 4: Verify no nulls
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM students WHERE party_id IS NULL) THEN
    RAISE EXCEPTION 'Migration incomplete: students.party_id has NULL values';
  END IF;
END $$;

-- Step 5: Make party_id NOT NULL
ALTER TABLE students
ALTER COLUMN party_id SET NOT NULL;

-- Step 6: Add FK constraint
ALTER TABLE students
ADD CONSTRAINT fk_students_party
FOREIGN KEY (party_id) REFERENCES party_parties(id);

-- Step 7: Create index
CREATE INDEX idx_students_party_id ON students(party_id);

-- Step 8: Drop old person_id column (AFTER verification period)
-- ALTER TABLE students DROP COLUMN person_id;
-- NOTE: Keep person_id temporarily for rollback safety
```

**Verification:**
```sql
-- Verify all students have party_id
SELECT COUNT(*) FROM students WHERE party_id IS NULL;
-- Expected: 0

-- Verify FK integrity
SELECT COUNT(*) 
FROM students s
LEFT JOIN party_parties p ON s.party_id = p.id
WHERE p.id IS NULL;
-- Expected: 0

-- Verify no data loss
SELECT 
  (SELECT COUNT(*) FROM students) AS student_count,
  (SELECT COUNT(DISTINCT party_id) FROM students) AS unique_parties;
-- student_count should equal unique_parties
```

---

### Task 2: Contract Update

**File:** `src/platform/education/contracts/student.contract.ts`

**Before:**
```typescript
export interface IEducationStudentContract {
  registerStudent(params: {
    tenantId: string;
    personId: string;  // ❌ OLD
    // ...
  }): Promise<Student>;
}
```

**After:**
```typescript
export interface IEducationStudentContract {
  registerStudent(params: {
    tenantId: string;
    partyId: string;  // ✅ NEW
    // ...
  }): Promise<Student>;
}
```

**Breaking Change:** YES
- Products calling `registerStudent()` must update parameter name
- Preschool, English Center affected

---

### Task 3: Service Implementation Update

**File:** `src/platform/education/student/student.service.ts`

**Update:**
```typescript
export class StudentService implements IEducationStudentContract {
  async registerStudent(params: {
    tenantId: string;
    partyId: string;  // ✅ Changed from personId
    // ...
  }): Promise<Student> {
    // Validate Party exists
    const party = await this.partyEngine.getParty(params.partyId, params.tenantId);
    if (!party) {
      throw new Error(`Party ${params.partyId} not found`);
    }

    // Insert student with party_id
    const student = await this.db.insert('students', {
      tenant_id: params.tenantId,
      party_id: params.partyId,  // ✅ Changed
      // ...
    });

    return student;
  }

  async getStudent(studentId: string, tenantId: string): Promise<Student> {
    const student = await this.db.query(`
      SELECT s.*, p.*
      FROM students s
      JOIN party_parties p ON s.party_id = p.id  -- ✅ Changed from person_id
      WHERE s.id = $1 AND s.tenant_id = $2
    `, [studentId, tenantId]);

    return student;
  }
}
```

---

### Task 4: Regression Tests Update

**Affected Test Suites:**
- `src/platform/education/student/__tests__/` (all tests)
- `src/products/bella-preschool/__tests__/` (student registration tests)

**Update Pattern:**
```typescript
// Before
const student = await studentContract.registerStudent({
  tenantId,
  personId: testPersonId,  // ❌ OLD
  // ...
});

// After
const student = await studentContract.registerStudent({
  tenantId,
  partyId: testPartyId,  // ✅ NEW
  // ...
});
```

**Run Full Regression:**
```bash
npm run test:education-kernel
npm run test:preschool
npm run test:healthcare  # Verify Party usage still works
npm run test:real-estate  # Verify Party usage still works
```

**Expected:** All tests GREEN

---

### Task 5: Product Updates

**Preschool:**
- Update student registration calls: `personId → partyId`
- Update Guardian creation (now can use Party relationships)
- Run Preschool E2E tests

**English Center:**
- ⏸️ Waiting for E0 completion, no code yet
- Manifest will reference Party-based Student contract

---

### Task 6: Documentation Update

**Files to Update:**
- `docs/architecture/PLATFORM_ARCHITECTURE_REGISTRY.md` (R1: Student entity)
- `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` (if references Person)
- `src/platform/education/README.md` (contract documentation)

**Registry Update:**
```yaml
student:
  owner: education-kernel
  source_of_truth: students
  identity_model: party  # ✅ Changed from person_legacy
  migration_status: complete  # ✅ Changed from migration_required
  migration_date: 2026-09-XX
```

---

## ✅ ACCEPTANCE CRITERIA

### Migration Complete When:

1. ✅ Schema migration applied successfully
2. ✅ `students.party_id` FK to `party_parties(id)` exists
3. ✅ All students have `party_id` populated (0 NULLs)
4. ✅ Contract signature updated (`personId → partyId`)
5. ✅ Service implementation uses Party
6. ✅ Education Kernel tests GREEN (100% pass rate)
7. ✅ Preschool tests GREEN (no regression)
8. ✅ Healthcare tests GREEN (Party still works)
9. ✅ Real Estate tests GREEN (Party still works)
10. ✅ Documentation updated
11. ✅ Registry R1 updated (`identity_model: party`)

---

## 🔓 UNBLOCK ACTIONS

### After Migration Complete:

**Update Bella English Center Manifest:**
```yaml
# bella-english-center.manifest.yaml

student:
  owner: education-kernel
  mode: reuse
  contract: IEducationStudentContract
  direct_db: false
  gates: [0, 1, 2, 5, 11]
  status: ready  # ✅ Changed from blocked
  # blocked_by: E0.1A-R  # ✅ Removed

blocking_gaps:
  # E0.1A-R: removed  # ✅ Gap closed
  E0.1B-R:
    title: Finance AR Contract Missing
    # ... (still open)

gates:
  5:
    name: Party Identity
    enforcement: ci_gate
    applies_to: new_code
    status: ready  # ✅ Changed from blocked
    # blocked_by: E0.1A-R  # ✅ Removed

  11:
    name: Identity Migration Warning
    enforcement: audit
    applies_to: legacy_code
    status: ready  # ✅ Changed from blocked
    # blocked_by: E0.1A-R  # ✅ Removed

rules:
  architecture_invariants:
    rules:
      CROSS-IDENTITY-ALL:
        intent: use_party_not_person
        gate: [5, 11]
        status: ready  # ✅ Changed from blocked
        # blocked_by: E0.1A-R  # ✅ Removed

readiness:
  capabilities_ready: 19  # ✅ +1 (student unblocked)
  capabilities_total: 22
  rules_ready: 39  # ✅ +1 (CROSS-IDENTITY-ALL unblocked)
  rules_total: 44
  gates_ready: 11  # ✅ +2 (Gate 5, 11 unblocked)
  gates_total: 11
```

**Readiness Impact:**
- Capabilities: 18/22 → 19/22 (86.4%)
- Rules: 38/44 → 39/44 (88.6%)
- Gates: 9/11 → 11/11 (100%) ⭐ **All gates ready if E0.1B-R also resolved**

---

## 📊 RISK ASSESSMENT

### High Risk

- **Breaking Change:** Contract signature changes (`personId → partyId`)
- **Data Migration:** persons → party_parties (must be reversible)
- **Regression Risk:** Preschool production data affected

### Mitigation

1. **Run migration in staging first**
2. **Keep person_id column temporarily** (rollback safety)
3. **Phased rollout:**
   - Week 1: Schema migration + dual-write (both person_id and party_id)
   - Week 2: Contract update + Preschool update + tests
   - Week 3: Monitor production, verify no issues
   - Week 4: Drop person_id column
4. **Rollback plan:** Restore person_id FK if critical issues found

---

## 📅 TIMELINE

### Estimated Duration: 2-3 weeks

**Week 1:** Schema migration + data migration + verification
**Week 2:** Contract + Service + Tests update
**Week 3:** Preschool update + Regression + Documentation

### Parallel to E0.5

This remediation can run **parallel** to English Center E0.5 manifest finalization.

---

## 📝 STATUS TRACKING

```text
E0.1A-R IDENTITY MIGRATION

Status:                        🔴 OPEN
Owner:                         Platform Core Team
Estimated Effort:              2-3 weeks
Blocks:                        Bella English Center E1

Tasks:
  Schema Migration             ⏸️ NOT STARTED
  Contract Update              ⏸️ NOT STARTED
  Service Implementation       ⏸️ NOT STARTED
  Regression Tests             ⏸️ NOT STARTED
  Product Updates              ⏸️ NOT STARTED
  Documentation                ⏸️ NOT STARTED

Acceptance Criteria:           0/11 complete

Next Action:                   Platform Core to schedule migration
```

---

**CREATED:** 2026-09-12
**OWNER:** Platform Core Team
**PRIORITY:** High (blocks product implementation)
**TRACKING:** Update this document as tasks complete

