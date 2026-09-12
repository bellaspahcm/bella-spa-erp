---
remediation_id: E0.1A-R
document: CUTOVER_PLAN_V1_0
status: frozen
frozen_date: 2026-09-12
blast_radius: platform_wide
version: 1.0
---

# E0.1A-R — IDENTITY CUTOVER PLAN v1.0

> **Status:** 🔒 FROZEN  
> **Frozen Date:** 2026-09-12  
> **Blast Radius:** Platform-wide (Education, HR, Real Estate)

---

## 🔒 PLAN STATUS

```text
R0 PREFLIGHT                      ✅ COMPLETE (R0.1–R0.7)
R1 IDENTITY MAPPING               🔒 SEALED (848 mappings, immutable)

CUTOVER PLAN v1.0                 🔒 FROZEN

R2 Party Backfill                 🔒 SEALED (631 students, 11/11 tests PASS)
R3 Education Cutover              🔒 SEALED (Contracts migrated, 11/11 tests PASS)
R4 Caller Migration               🔒 SEALED (2/2 targets migrated, 4/4 E2E PASS)
R5 Legacy Freeze                  🔒 SEALED (6 writers frozen, 11/11 guard tests PASS)
R6 Verification                   🔒 SEALED (11/11 gates PASS, 0 regressions)
R7 Governance Seal                🔒 SEALED (Guard active, CI integrated)
R8 Continuous Monitoring          ⏸️  WAIT (production deployment)

E0.1A-R Identity Remediation      🔒 COMPLETE (Student domain)

English Center E1                 ⏸️  BLOCKED (E0.1B-R + E1 Readiness Gate)
```

---

## ⚠️ CRITICAL CORRECTIONS FROM ORIGINAL PLAN

### 1. R3 NOT ATOMIC (DB + Code Deployment)

**Original Plan (WRONG):**
```text
R3 Kernel + Contract Cutover (ATOMIC)
  - ALTER TABLE students
  - StudentService code change
  - Contract code change
  - Deploy all at once
```

**Corrected Plan (RIGHT):**
```text
R3 uses compatibility-safe cutover sequence
  - Cannot achieve true atomicity across DB + code deployment
  - Must avoid broken intermediate states
  - Staged cutover with verification gates
```

### 2. R0.5 Found 7 Tables with person_id FK (Not Just students)

**Original Plan (INCOMPLETE):**
```text
R3: Migrate students.person_id → party_id
```

**Corrected Plan (COMPLETE):**
```text
Must classify ALL 7 tables:
  1. students (Education) — MIGRATE_TO_PARTY
  2. hr_departments — CLASSIFY_REQUIRED
  3. hr_employee_profiles — CLASSIFY_REQUIRED
  4. re_commission_ledger — CLASSIFY_REQUIRED
  5. re_project_checkins — CLASSIFY_REQUIRED
  6. re_sales_kpi_targets — CLASSIFY_REQUIRED
  7. re_tasks — CLASSIFY_REQUIRED

Cannot proceed to R7 seal without classifying ALL 7 FKs.
```

### 3. Write Path Count NOT Exact

**Original Plan (APPROXIMATE):**
```text
R0.6: 45+ write paths
```

**Corrected Plan (REQUIRES RECONCILIATION):**
```text
Must reconcile to exact count before R7 seal:
  - Direct DB: X
  - Repository: 3
  - Service: 2
  - Test: X
  - Total: EXACT (not 45+)
```

---

## 📋 CUTOVER SEQUENCE

```text
E0.1A-R — IDENTITY CUTOVER PLAN v1.0
════════════════════════════════════════

R0  Preflight                       🔒 COMPLETE
R1  Identity Mapping                🔒 SEALED

             ↓

R2  Party Backfill (AUTHORIZED)
    ├─ Read ONLY from sealed R1 mapping
    ├─ 848 planned mappings
    ├─ Idempotent execution
    ├─ Transactional DB operation
    ├─ Preserve person records
    └─ NO FK cutover yet

             ↓ verify

R2V Backfill Verification (GATE)
    ├─ mapping → Party 848/848
    ├─ tenant consistency
    ├─ identity field reconciliation
    ├─ duplicate/collision = 0
    └─ rollback evidence

             ↓ ONLY IF R2V PASS

R3  Education Cutover
    ├─ students Party linkage (compatibility-safe)
    ├─ StudentService → Party validation
    ├─ Contract semantic correction
    └─ deployment coordination

             ↓

R4  Caller / Fixture Cutover
    ├─ 8 known Student callers
    ├─ 40+ E2E/integration fixtures
    └─ Person creation dependencies

             ↓

R5  Legacy Write Control
    ├─ block new Education → Person writes
    ├─ PersonRepository/Service disposition
    └─ remaining 6-FK census + disposition

             ↓

R6  Verification
    ├─ DB/FK integrity
    ├─ mapping integrity
    ├─ contract tests
    ├─ Education regression (52 tests)
    ├─ Preschool E2E (6 tests)
    └─ negative identity tests

             ↓

R7  Evidence Seal
    ├─ migration evidence immutable
    ├─ baseline metrics captured
    ├─ rollback procedure documented
    └─ exact write path count reconciled
```

---

## 🔵 R2 — PARTY BACKFILL (AUTHORIZED)

### Scope

**BACKFILL ONLY — NO FK CUTOVER**

```sql
-- R2: Create party_parties from persons using R1 mapping
INSERT INTO party_parties (
  id,
  tenant_id,
  party_type,
  display_name,
  dob,
  gender,
  created_at,
  updated_at
)
SELECT 
  m.party_id,              -- From R1 sealed mapping
  p.tenant_id,
  'person',                -- Fixed: party_type = 'person'
  p.first_name || ' ' || p.last_name AS display_name,
  p.date_of_birth AS dob,
  p.gender,
  p.created_at,
  p.updated_at
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
WHERE m.status = 'planned'
  AND m.sealed_at IS NOT NULL
ON CONFLICT (id) DO NOTHING;  -- Idempotent
```

### Input

- **R1 sealed mapping:** 848 rows
- **persons table:** 848 rows
- **Strategy:** 848 CREATE_NEW_PARTY

### Output

- **party_parties:** 848 new rows (party_type = 'person')
- **persons:** UNCHANGED (preserved for rollback)
- **students.person_id:** UNCHANGED (no FK cutover yet)

### Idempotency

```sql
-- First run: 848 created
-- Second run: 0 created (ON CONFLICT DO NOTHING)
-- Result: PASS (848 total)
```

### Transaction Safety

```sql
BEGIN;
  -- Insert parties
  -- Update mapping status
  -- Verify counts
COMMIT;
```

### Post-Execution

**Update R1 mapping status:**
```sql
UPDATE identity_migration_mapping
SET 
  status = 'party_created',
  party_created_at = NOW()
WHERE status = 'planned';
```

---

## ✅ R2V — BACKFILL VERIFICATION (GATE)

**R2V must PASS before R3 authorized.**

### Verification Queries

```sql
-- 1. Mapping coverage
SELECT 
  COUNT(*) FILTER (WHERE status = 'party_created') AS migrated,
  COUNT(*) FILTER (WHERE status != 'party_created') AS pending
FROM identity_migration_mapping;
-- Expected: migrated=848, pending=0

-- 2. Party existence
SELECT COUNT(*) AS missing_parties
FROM identity_migration_mapping m
LEFT JOIN party_parties pp ON m.party_id = pp.id
WHERE pp.id IS NULL;
-- Expected: 0

-- 3. Party type validation
SELECT COUNT(*) AS wrong_type
FROM identity_migration_mapping m
JOIN party_parties pp ON m.party_id = pp.id
WHERE pp.party_type != 'person';
-- Expected: 0

-- 4. Tenant consistency
SELECT COUNT(*) AS tenant_mismatch
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE p.tenant_id != pp.tenant_id;
-- Expected: 0

-- 5. UUID collision (should still be 0)
SELECT COUNT(*) AS collisions
FROM persons p
INNER JOIN party_parties pp ON p.id = pp.id;
-- Expected: 0 (person.id != party.id because mapping created unique party_id)

-- 6. Display name conversion
SELECT COUNT(*) AS missing_display_name
FROM identity_migration_mapping m
JOIN party_parties pp ON m.party_id = pp.id
WHERE pp.display_name IS NULL OR pp.display_name = '';
-- Expected: 0

-- 7. DOB preservation
SELECT COUNT(*) AS dob_mismatch
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE p.date_of_birth != pp.dob;
-- Expected: 0

-- 8. Gender preservation
SELECT COUNT(*) AS gender_mismatch
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
JOIN party_parties pp ON m.party_id = pp.id
WHERE p.gender != pp.gender;
-- Expected: 0
```

### R2V PASS Criteria

```text
Migrated mappings:                    848
Pending mappings:                     0
Missing parties:                      0
Wrong party_type:                     0
Tenant mismatches:                    0
UUID collisions:                      0
Missing display_name:                 0
DOB mismatches:                       0
Gender mismatches:                    0

✅ ALL CHECKS PASS → R3 AUTHORIZED
❌ ANY CHECK FAIL → ROLLBACK R2, FIX, RETRY
```

### Rollback Procedure (If R2V Fails)

```sql
BEGIN;
  -- Revert mapping status
  UPDATE identity_migration_mapping
  SET status = 'planned', party_created_at = NULL
  WHERE status = 'party_created';
  
  -- Delete created parties
  DELETE FROM party_parties pp
  WHERE pp.id IN (
    SELECT party_id FROM identity_migration_mapping
  );
COMMIT;
```

---

## ⏸️ R3 — EDUCATION CUTOVER (WAIT R2V PASS)

**NOT AUTHORIZED until R2V passes.**

### Scope

**Compatibility-Safe Cutover (NOT Atomic DB + Code)**

Cannot achieve true atomicity across DB migration + code deployment. Must use staged cutover.

### Strategy: Dual-Column Transition (if needed)

**Option A: Single Cutover (Simple, requires coordinated deployment)**

```sql
-- Add party_id column
ALTER TABLE students ADD COLUMN party_id UUID REFERENCES party_parties(id);

-- Backfill party_id from mapping
UPDATE students s
SET party_id = m.party_id
FROM identity_migration_mapping m
WHERE s.person_id = m.person_id;

-- Verify
SELECT COUNT(*) FROM students WHERE party_id IS NULL;
-- Expected: 0

-- Make party_id NOT NULL
ALTER TABLE students ALTER COLUMN party_id SET NOT NULL;

-- Deploy StudentService changes (validate Party, not Person)
-- Deploy Contract implementation fix

-- After verification passes:
-- (Optional) Drop person_id column later
```

**Option B: Dual-Column Compatibility (Complex, safer for phased deployment)**

```sql
-- Phase 1: Add party_id
ALTER TABLE students ADD COLUMN party_id UUID REFERENCES party_parties(id);
UPDATE students SET party_id = ... (from mapping);

-- Phase 2: Application reads both, writes party_id
-- Deploy StudentService v2 (dual-read)

-- Phase 3: Verify party_id authoritative
-- Run for N days

-- Phase 4: Make party_id authoritative
ALTER TABLE students ALTER COLUMN party_id SET NOT NULL;

-- Phase 5: Deprecate person_id
-- (later cleanup)
```

**DECISION:** Choose Option A (simple cutover) because R0.7 confirmed 0 production callers.

### StudentService Changes

**Before:**
```typescript
// Validates Person
const person = await personRepo.findById(request.personId, request.tenantId);
if (!person) {
  throw new Error('Person does not exist');
}
```

**After:**
```typescript
// Validates Party
const party = await partyRepo.findById(request.partyId, request.tenantId);
if (!party || party.partyType !== 'person') {
  throw new Error('Party does not exist or is not a person');
}
```

### Contract Implementation Fix

**Before:**
```typescript
const student = await StudentService.createStudent({
  tenantId: input.tenantId,
  personId: input.partyId, // ⚠️ Semantic mismatch
  // ...
});
```

**After:**
```typescript
const student = await StudentService.createStudent({
  tenantId: input.tenantId,
  partyId: input.partyId, // ✅ Correct
  // ...
});
```

### Deployment Coordination

```text
1. DB Migration (students.party_id)
2. Application Deployment (StudentService + Contract)
3. Verification Gate (R3V)
4. If R3V PASS → proceed R4
5. If R3V FAIL → rollback + fix
```

---

## ⏸️ R4 — CALLER / FIXTURE CUTOVER (WAIT R3 PASS)

### Scope

- **8 Student contract/service callers** (from R0.7)
- **40+ E2E/integration test fixtures** (from R0.6)

### Migration Pattern

```typescript
// BEFORE (Person)
const person = await personService.createPerson({
  tenantId,
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '2000-01-01',
  gender: 'male',
});

const student = await StudentService.createStudent({
  tenantId,
  personId: person.data.personId, // ❌ OLD
  studentCode: 'EDU-001',
});

// AFTER (Party)
const party = await partyService.createParty({
  tenantId,
  partyType: 'person',
  displayName: 'John Doe',
  dob: '2000-01-01',
  gender: 'male',
});

const student = await StudentService.createStudent({
  tenantId,
  partyId: party.data.partyId, // ✅ NEW
  studentCode: 'EDU-001',
});
```

### Test Locations (from R0.7)

1. `src/platform/education/__tests__/verification-gates.test.ts:145`
2. `src/platform/education/__tests__/verification-gates.test.ts:316`
3. `src/platform/education/student/__tests__/student.integration.test.ts:103`
4. `src/platform/education/student/__tests__/student.integration.test.ts:124`
5. `src/platform/education/student/__tests__/student.integration.test.ts:141`
6. `src/platform/education/student/__tests__/student.integration.test.ts:245`
7. `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts:46`
8. `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts:144`

Plus 40+ E2E/integration fixtures from R0.6.

---

## ⏸️ R5 — LEGACY WRITE CONTROL (WAIT R4 PASS)

### Scope

**Block new Education → Person writes**

### 5 Methods to Freeze (from R0.6)

1. `PersonRepository.save()` — src/platform/host/person/person.repository.ts:30
2. `PersonRepository.update()` — src/platform/host/person/person.repository.ts:70
3. `PersonRepository.delete()` — src/platform/host/person/person.repository.ts:250
4. `PersonService.createPerson()` — src/platform/host/person/person.service.ts:40
5. `PersonService.updatePerson()` — src/platform/host/person/person.service.ts:99

### Freeze Strategy Options

**Option A: Runtime Guard (Immediate)**
```typescript
export class PersonService {
  async createPerson(request: CreatePersonRequest): Promise<PersonResponse> {
    throw new Error('DEPRECATED: Use PartyService.createParty() instead. Person writes frozen after identity migration.');
  }
}
```

**Option B: Deprecation Warning (Graceful)**
```typescript
export class PersonService {
  @deprecated('Use PartyService.createParty()')
  async createPerson(request: CreatePersonRequest): Promise<PersonResponse> {
    console.warn('DEPRECATED: PersonService.createPerson() - use PartyService.createParty()');
    // Still works but logs warning
    return this.repository.save(...);
  }
}
```

**Option C: Adapter Pattern (Compatibility)**
```typescript
export class PersonService {
  async createPerson(request: CreatePersonRequest): Promise<PersonResponse> {
    // Internally creates Party, maintains Person interface
    const party = await partyService.createParty({
      partyType: 'person',
      displayName: `${request.firstName} ${request.lastName}`,
      ...
    });
    
    // Return PersonResponse shape for compatibility
    return { personId: party.id, ... };
  }
}
```

**DECISION:** TBD based on actual usage patterns after R4.

### Remaining 6 FK Census

**From R0.5, 7 tables have person_id FK:**

1. ✅ students (Education) — MIGRATE_TO_PARTY (R3)
2. ❓ hr_departments — CLASSIFY_REQUIRED
3. ❓ hr_employee_profiles — CLASSIFY_REQUIRED
4. ❓ re_commission_ledger — CLASSIFY_REQUIRED
5. ❓ re_project_checkins — CLASSIFY_REQUIRED
6. ❓ re_sales_kpi_targets — CLASSIFY_REQUIRED
7. ❓ re_tasks — CLASSIFY_REQUIRED

**Must classify each:**
- `MIGRATE_TO_PARTY` — migrate FK to party_id
- `LEGACY_KEEP_PERSON` — keep person_id (justify why)
- `REMOVE_DEPRECATE` — feature deprecated, safe to remove

**CANNOT proceed to R7 seal without classifying ALL 6 remaining FKs.**

---

## ⏸️ R6 — VERIFICATION (WAIT R5 PASS)

### Verification Scope

```text
1. DB/FK Integrity
2. Mapping Integrity
3. Contract Tests
4. Education Regression (52 tests)
5. Preschool E2E (6 tests)
6. Negative Identity Tests (NEW)
```

### 1. DB/FK Integrity

```sql
-- students.party_id references party_parties
SELECT COUNT(*) AS orphan_students
FROM students s
LEFT JOIN party_parties pp ON s.party_id = pp.id
WHERE pp.id IS NULL;
-- Expected: 0

-- All parties are person type
SELECT COUNT(*) AS wrong_type
FROM students s
JOIN party_parties pp ON s.party_id = pp.id
WHERE pp.party_type != 'person';
-- Expected: 0
```

### 2. Mapping Integrity

```sql
-- All mappings reached 'verified' status
SELECT COUNT(*) AS unverified
FROM identity_migration_mapping
WHERE status != 'verified';
-- Expected: 0

-- No students point to unmapped persons
SELECT COUNT(*) AS unmapped_students
FROM students s
WHERE s.party_id NOT IN (SELECT party_id FROM identity_migration_mapping);
-- Expected: 0
```

### 3. Contract Tests

```bash
npm run test -- src/platform/education/contracts/
```

Expected: PASS (contract tests verify Party semantics)

### 4. Education Regression (52 tests)

```bash
npm run education:verify
```

Expected: 52/52 PASS

### 5. Preschool E2E (6 tests)

```bash
npm run e2e -- e2e/tests/*preschool*.spec.ts
```

Expected: 6/6 PASS

### 6. Negative Identity Tests (NEW)

**Critical: Verify NEW students use Party, not Person**

```typescript
describe('Identity Migration — Negative Tests', () => {
  it('should create new student with Party (not Person)', async () => {
    // 1. Create Party
    const party = await partyService.createParty({
      tenantId,
      partyType: 'person',
      displayName: 'New Student',
      dob: '2020-01-01',
      gender: 'male',
    });
    
    // 2. Create Student with Party
    const student = await StudentService.createStudent({
      tenantId,
      partyId: party.id, // ✅ Uses Party
      studentCode: 'NEW-001',
    });
    
    // 3. Verify NO new Person was created
    const personCount = await db.from('persons').count();
    expect(personCount).toBe(848); // Still original 848, no new persons
    
    // 4. Verify student references Party
    expect(student.partyId).toBe(party.id);
  });
  
  it('should reject student creation with invalid Party', async () => {
    await expect(
      StudentService.createStudent({
        tenantId,
        partyId: '00000000-0000-0000-0000-999999999999', // Doesn't exist
        studentCode: 'INVALID-001',
      })
    ).rejects.toThrow('Party does not exist');
  });
  
  it('should reject student creation with organization Party', async () => {
    const org = await partyService.createParty({
      tenantId,
      partyType: 'organization', // ❌ Not a person
      displayName: 'Some Org',
    });
    
    await expect(
      StudentService.createStudent({
        tenantId,
        partyId: org.id,
        studentCode: 'ORG-001',
      })
    ).rejects.toThrow('Party is not a person');
  });
});
```

---

## ⏸️ R7 — EVIDENCE SEAL (WAIT R6 PASS)

### Seal Criteria

```text
✅ R2 Party backfill verified (848/848)
✅ R3 Education cutover complete
✅ R4 Caller migration complete (8 + 40+ fixtures)
✅ R5 Legacy writes controlled
✅ R6 Verification PASS (all tests green)
✅ R6 Negative tests PASS (no new Person writes)
✅ 6 remaining FKs classified
✅ Write path count reconciled (exact, not 45+)
```

### Evidence Documents

1. **R0 Census Report** (SEALED)
2. **R0.6 Write-Path Census** (SEALED with exact count)
3. **R0.7 Caller Census** (SEALED)
4. **R1 Mapping Evidence** (SEALED, 848 rows, CSV backup)
5. **R2 Backfill Evidence** (party_parties created, mapping updated)
6. **R2V Verification Results** (all checks PASS)
7. **R3 Deployment Log** (DB migration + code deployment timestamps)
8. **R4 Test Migration Results** (all tests updated + green)
9. **R6 Verification Results** (52 Education + 6 Preschool E2E PASS)
10. **R6 Negative Test Results** (no new Person writes confirmed)
11. **Rollback Procedure** (tested + documented)
12. **Baseline Metrics** (pre/post comparison)

### Baseline Metrics

**BEFORE (Pre-Migration):**
```text
persons:                              848
party_parties (person type):          (unknown, likely 0)
students.person_id (not null):        631
students.party_id:                    (column does not exist)

New student creation:                 PersonService.createPerson() → students.person_id
```

**AFTER (Post-Migration):**
```text
persons:                              848 (preserved)
party_parties (person type):          848 (new)
students.person_id:                   (deprecated/removed)
students.party_id (not null):         631

New student creation:                 PartyService.createParty() → students.party_id
```

### Rollback Procedure

**If critical failure detected after R3:**

```sql
BEGIN;
  -- 1. Revert students FK
  ALTER TABLE students DROP COLUMN party_id;
  
  -- 2. Revert mapping status
  UPDATE identity_migration_mapping SET status = 'planned';
  
  -- 3. (Optional) Remove created parties
  DELETE FROM party_parties WHERE id IN (SELECT party_id FROM identity_migration_mapping);
  
  -- 4. Revert application code
  -- (git revert + redeploy)
COMMIT;
```

---

## 🔴 BLOCKERS & DEPENDENCIES

### Current Blockers

```text
R3 Education Cutover              ⏸️  BLOCKED by R2V
R4 Caller Migration               ⏸️  BLOCKED by R3
R5 Legacy Freeze                  ⏸️  BLOCKED by R4
R6 Verification                   ⏸️  BLOCKED by R5
R7 Evidence Seal                  ⏸️  BLOCKED by R6

English Center E1                 🚫 BLOCKED by E0.1A-R + E0.1B-R
```

### Unresolved Items

1. **6 Remaining FKs Classification** (HR, RE modules)
   - Cannot seal R7 without classification
   - Must classify as: MIGRATE_TO_PARTY | LEGACY_KEEP_PERSON | REMOVE_DEPRECATE

2. **Write Path Exact Count** (currently 45+)
   - Must reconcile to exact count before R7 seal
   - Affects evidence completeness

3. **R5 Freeze Strategy** (runtime guard vs adapter vs deprecation)
   - Decision pending based on R4 results

---

## ✅ AUTHORIZATION STATUS

```text
R2 Party Backfill                 🟢 AUTHORIZED
R3 Education Cutover              ⏸️  WAIT R2V PASS
R4 Caller Migration               ⏸️  WAIT R3 PASS
R5 Legacy Freeze                  ⏸️  WAIT R4 PASS
R6 Verification                   ⏸️  WAIT R5 PASS
R7 Evidence Seal                  ⏸️  WAIT R6 PASS

English Center E1                 🚫 STILL BLOCKED
```

---

**CUTOVER PLAN v1.0:** 🔒 FROZEN

**NEXT:** Execute R2 Party Backfill

**REVISION REQUIRED IF:**
- New Person FKs discovered
- Production callers found
- Deployment model changes
- Critical architecture conflicts
