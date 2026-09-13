# R6 FULL EDUCATION VERTICAL VERIFICATION — CHARTER

**Date:** 2026-09-12  
**Status:** 🟢 AUTHORIZED  
**Phase:** R6 (post-R5 sealed)

---

## 🎯 R6 MISSION

**Mission:** Prove Education vertical (including Preschool) has zero regression after R0-R5 identity remediation + close 2 critical verification obligations left from R5.

**Core Principle:** R6 **DOES NOT OPEN NEW ARCHITECTURE**. If tests fail, remediation only; no E0 re-opening.

---

## ⚠️ CRITICAL: 2 VERIFICATION OBLIGATIONS FROM R5

### Obligation #1: Close 3 Education Test Fixtures (TEMPORARY ALLOW)

**Context:** R5.1 classified 3 test callers as "allowed temporarily" with R6 migration path:

```text
1. enrollment.integration.test.ts   → Person fixture
2. student.integration.test.ts      → Person fixture
3. verification-gates.test.ts       → Person fixture
```

**Current State:**
- Production Person writes: 0 ✅
- Test Person writes: 3 (temporary)
- Guard policy: ALLOW tests temporarily

**R6 Obligation:**

```text
MUST migrate 3 test fixtures from Person → Party

enrollment.integration.test.ts
student.integration.test.ts
verification-gates.test.ts

Person fixture → Party fixture

BEFORE migration:
  personService.createPerson() in test setup

AFTER migration:
  partyRepository.create() in test setup
```

**Exit Criteria After R6:**

```text
Education production Person writes = 0 ✅
Education test Person writes       = 0 ✅ (R6 target)
Approved legacy exceptions         = explicit / bounded
Unknown                            = 0
```

**Why Critical:** Production is clean, but factory enforcement cannot be considered complete if test setup still creates `Person`. Guard currently allows tests; R6 must eliminate this temporary exception.

---

### Obligation #2: Reconcile 3 P41 FK Tables (Preschool = Education OS)

**Context:** R5.2 census found 3 Preschool tables with FK → `persons(id)`:

```text
p41_medication_authorizations (authorized_by_guardian_id, revoked_by)
p41_medication_logs           (actor_id)
p41_safety_incident_logs      (actor_id)
```

**R5.2 Classification:** "OUT OF SCOPE (Preschool vertical)"

**⚠️ CORRECTION REQUIRED:**

**Preschool is WITHIN Education OS scope**, not separate vertical. P41 = Product within Education OS (Bella Preschool).

**Wording Error:**
> "Preschool: 3 P41 tables — out of Education scope"

Should be:
> "Preschool: 3 P41 tables — Education OS product, disposition required before R7 seal"

**R6 Obligation:**

```text
Verify 3 P41 FK tables:

1. Confirm FK constraint exact:
   REFERENCES public.persons(id)?
   
2. If YES → classify disposition:
   - MIGRATE_TO_PARTY (canonical)
   - LEGACY_READ_ONLY (approved exception)
   - TEMPORARY_EXCEPTION (bounded + tracked)
   
3. If NO (FK to other identity) → document source:
   - Exact table/column FK points to
   - Why not in Education identity scope
```

**Why Critical:** Cannot declare "Education completely decoupled" if 3 tables still FK to `persons(id)` and remain unclassified. If they truly FK `persons`, they are part of Education identity reconciliation (Preschool = Education OS product).

**Verification Method:**

```sql
-- Query exact FK constraints for 3 tables
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name IN (
    'p41_medication_authorizations',
    'p41_medication_logs',
    'p41_safety_incident_logs'
  );
```

Or inspect migration file directly:

```bash
cat supabase/migrations/20260909000051_p41_safety_critical.sql
```

**Exit Evidence Required:**

```text
P41 FK tables verified:             3/3
FK target confirmed:                persons(id) OR other
Disposition assigned:               3/3 (if persons FK)
Unknown Preschool dependencies:     0
Education identity scope:           EXACT (no ambiguity)
```

---

## 📋 R6 EXECUTION SEQUENCE (5 LAYERS)

### R6.1: Full Education Regression

**Scope:** Run complete Education test suite

```bash
npm run test -- src/platform/education/**/*.test.ts
```

**Tests:**
- Student service (CRUD + Party integration)
- Course service
- Enrollment service
- Attendance service
- Assessment service

**Exit Criteria:**
```text
All Education unit tests:       PASS
No regressions:                 ✅
Known failures:                 0
```

---

### R6.2: Preschool Critical Regression/E2E

**Scope:** Preschool product (P41) regression tests (if exist)

```bash
npm run test -- src/products/bella-preschool/**/*.test.ts
# OR
npm run test -- **/*p41*.test.ts
```

**Why:** Preschool is Education OS product. Must verify no regression from R0-R5 changes.

**Exit Criteria:**
```text
Preschool tests:                PASS (or document: none exist yet)
P41 E2E workflows:              PASS (if exist)
Known Preschool failures:       0
```

---

### R6.3: Identity Negative Suite

**Scope:** Prove no new Person debt creation

**Tests:**
1. **Party-based Student creation:** PASS
2. **Invalid Party ID:** BLOCK (FK constraint)
3. **Cross-tenant Party:** BLOCK (tenant isolation)
4. **New Person creation from Education code:** 0 (guard blocks)

**Method:**

Create negative test suite:

```typescript
// tests/platform/education/identity-negative.test.ts

describe('Education Identity Negative Tests (R6)', () => {
  test('Student creation with valid Party succeeds', async () => {
    const party = await createParty(); // Party fixture
    const student = await studentContract.registerStudent({
      partyId: party.id,
      // ...
    });
    expect(student).toBeDefined();
  });

  test('Student creation with invalid Party fails', async () => {
    await expect(
      studentContract.registerStudent({
        partyId: 'invalid-uuid',
        // ...
      })
    ).rejects.toThrow(/FK constraint/);
  });

  test('Cross-tenant Party isolation enforced', async () => {
    const partyTenantA = await createParty({ tenantId: TENANT_A });
    await expect(
      studentContract.registerStudent({
        tenantId: TENANT_B,
        partyId: partyTenantA.id, // Wrong tenant
        // ...
      })
    ).rejects.toThrow(/tenant isolation/);
  });

  test('Education code cannot create Person (guard blocks)', async () => {
    // This is already proved by R5.1 guard tests
    // Verify guard still active
    const productionPath = 'src/platform/education/student/student.service.ts';
    expect(() => PersonWriteGuard.validate(productionPath, 'create'))
      .toThrow(ArchitectureViolation);
  });
});
```

**Exit Criteria:**
```text
Party-valid Student creation:   PASS
Invalid Party FK:               BLOCKED ✅
Cross-tenant Party:             BLOCKED ✅
Person guard enforcement:       ACTIVE ✅
New Person creation:            0 ✅
```

---

### R6.4: 11 Verification Gates

**Scope:** Run Education OS 11 Automated Verification Gates

```bash
npm run test -- src/platform/education/__tests__/verification-gates.test.ts
```

**Gates (from Education OS Constitution):**
- Gate 0: Tenant Isolation (P0 boundary)
- Gate 1-10: Domain boundaries, Event-after-persistence, etc.
- Gate 11: No `any` types

**Exit Criteria:**
```text
11 Verification Gates:          11/11 PASS ✅
Constitution compliance:        ✅
Known violations:               0
```

---

### R6.5: Legacy Exception Reconciliation

**Scope:** Close 3 temporary Education test fixtures (Obligation #1)

**Method:**

1. **Migrate enrollment.integration.test.ts:**
   - Replace `personService.createPerson()` → `partyRepository.create()`
   - Update test setup to use Party fixtures
   - Verify test still PASS

2. **Migrate student.integration.test.ts:**
   - Same pattern: Person fixture → Party fixture
   - Verify test still PASS

3. **Migrate verification-gates.test.ts:**
   - Same pattern
   - Verify 11/11 gates still PASS

4. **Re-run guard adversarial tests:**
   ```bash
   npm run test -- tests/platform/architecture/person-write-guard.test.ts
   ```
   - BLOCK tests: Still PASS (4/4)
   - ALLOW tests: Still PASS (7/7) — but Education test paths now should NOT be called

5. **Final census:**
   ```bash
   grep -r "personService\.createPerson\|PersonService\.createPerson" \
     --include="*.ts" \
     --exclude-dir="node_modules"
   ```
   - Result: 0 Education callers (production + tests)
   - Legacy Host platform: Allowed (explicit)

**Exit Criteria:**
```text
Education test fixtures migrated:   3/3 ✅
Test Person writes:                 0 ✅
Tests still PASS:                   ✅
Guard adversarial:                  11/11 PASS ✅
Unknown Person dependencies:        0 ✅
```

---

## ✅ R6 OVERALL EXIT CRITERIA

```text
R6.1 Education regression:          PASS ✅
R6.2 Preschool regression:          PASS ✅ (or documented: none exist)
R6.3 Identity negative suite:       PASS ✅
R6.4 Verification Gates:            11/11 PASS ✅
R6.5 Legacy exceptions closed:      3/3 ✅

Obligation #1 (3 test fixtures):    ✅ CLOSED
Obligation #2 (3 P41 FK tables):    ✅ RECONCILED

Education production Person writes: 0 ✅
Education test Person writes:       0 ✅
P41 FK disposition:                 EXPLICIT ✅
Unknown dependencies:               0 ✅
Build:                              PASS ✅

R6 Status:                          🔒 SEALED → Authorize R7
```

---

## 🚫 R6 CONSTRAINTS

**R6 DOES NOT:**
- Open new architecture design (no E0 re-opening)
- Modify Kernel (H1-H12 frozen)
- Create new Person writes (frozen by R5.1 guard)
- Change identity reconciliation scope (locked by R0-R5)

**R6 ONLY:**
- Runs tests (verification)
- Remediates test failures (if any)
- Migrates 3 test fixtures (Obligation #1)
- Reconciles 3 P41 FK tables (Obligation #2)
- Documents evidence

**If architectural gap discovered:** BLOCK + escalate (do not proceed R7).

---

## 📊 CANONICAL STATE BEFORE R6

```text
R0 ✅ Baseline Assessment (7 sub-phases)
R1 🔒 Party Infrastructure (848 mappings immutable)
R2 🔒 Backfill + FK Migration (631 students)
R3 🔒 Contract Migration (11/11 tests PASS)
R4 🔒 Caller Migration (2/2 targets, 4/4 E2E)
R5 🔒 Legacy Person Freeze (6 writers, 11/11 guard tests)
R6 🟢 AUTHORIZED ← START HERE
R7 ⏸️  WAIT R6
R8 ⏸️  WAIT R7

Progress: 6/8 milestones (75%)
```

---

## 📊 CANONICAL STATE AFTER R6 (TARGET)

```text
Education regression:           GREEN ✅
Preschool regression:           GREEN ✅
Critical E2E:                   GREEN ✅

Party-based Student creation:   PASS ✅
Invalid Party:                  BLOCK ✅
Cross-tenant Party:             BLOCK ✅
New Person creation:            0 ✅

Person guard BLOCK tests:       PASS ✅
Party-valid ALLOW tests:        PASS ✅

Education Person test fixtures: 0 ✅
P41 FK disposition:             EXPLICIT (3/3) ✅
Unknown Person dependencies:    0 ✅

R6 Status:                      🔒 SEALED
R7 Status:                      🟢 AUTHORIZED
```

---

## 🔐 R6 AUTHORIZATION

**Authorized By:** R5 sealed (2026-09-12)  
**Start Date:** 2026-09-12  
**Critical Obligations:** 2 (from R5)

**Proceed:** R6 execution (5-layer sequence)

---

**R6 Charter locked. Proceed R6.1 Full Education Regression.**
