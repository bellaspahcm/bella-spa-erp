---
remediation_id: E0.1A-R
phase: R0.7_CONTRACT_CALLER_CENSUS
document: R0_7_CALLER_CENSUS_REPORT
generated: 2026-09-12T07:30:00Z
status: complete
---

# R0.7 CONTRACT/CALLER CENSUS REPORT

> **Generated:** 2026-09-12T07:30:00Z  
> **Method:** Code search + manual analysis

---

## 🚨 SEMANTIC MISMATCH CONFIRMED

### Contract vs Implementation

**Contract Definition:** `src/platform/education/contracts/student.contract.ts`

```typescript
export interface RegisterStudentInput {
  readonly tenantId: string;
  readonly partyId: string; // ← Says "partyId"
  readonly studentCode: string;
  readonly guardianPartyId?: string;
}

interface IEducationStudentContract {
  registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO>;
}
```

**Implementation:** `src/platform/education/contracts/student.contract.impl.ts:6`

```typescript
public async registerStudent(input: RegisterStudentInput): Promise<EducationStudentDTO> {
  const student = await StudentService.createStudent({
    tenantId: input.tenantId,
    personId: input.partyId, // ⚠️ Maps partyId → personId
    studentCode: input.studentCode,
    // ...
  });
}
```

**MISMATCH CONFIRMED:**
- Contract parameter name: `partyId`
- Implementation maps to: `personId`
- Database FK: `students.person_id → persons.id`

**ROOT CAUSE:** Contract naming suggests Platform Party, but implementation uses Platform Person.

---

## 📊 CALLER CENSUS SUMMARY

\`\`\`text
Total Callers Found:                  7

By Method:
  studentContract.registerStudent():  1 (test)
  StudentService.createStudent():     6 (tests)

By Environment:
  Production:                         0
  Test:                               7

By ID Source:
  PASSES_PERSON_ID:                   7
  PASSES_PARTY_ID:                    0
  DERIVES_ID:                         0
  UNKNOWN:                            0
\`\`\`

---

## 🔍 PRODUCTION CALLERS

**NONE FOUND** ✅

No production code in Preschool or other products calls `registerStudent()` or `StudentService.createStudent()` directly.

**Implication:**
- Migration will NOT break production code
- Only test fixtures need migration
- Clean cutover possible

---

## 🔍 TEST CALLERS

### 1. Platform Education — Verification Gates Test

**File:** `src/platform/education/__tests__/verification-gates.test.ts:145`

**Code:**
```typescript
const personRes = await personService.createPerson({
  tenantId: TENANT_A,
  firstName: 'Alice',
  // ...
});

const studentDto = await studentContract.registerStudent({
  tenantId: TENANT_A,
  partyId: personRes.data!.personId, // ← PASSES_PERSON_ID
  studentCode: 'TEST-001',
});
```

- **ID_SOURCE:** `PASSES_PERSON_ID`
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE` (change to createParty, pass party.id)

---

### 2. Platform Education — Verification Gates Test (Line 316)

**File:** `src/platform/education/__tests__/verification-gates.test.ts:316`

**Code:**
```typescript
const person = await personService.createPerson({
  tenantId: TENANT_A,
  firstName: 'Charlie',
  // ...
});

const student = await StudentService.createStudent({
  tenantId: TENANT_A,
  personId: person.data!.personId, // ← PASSES_PERSON_ID
  studentCode: 'TEST-002',
  // ...
});
```

- **ID_SOURCE:** `PASSES_PERSON_ID`
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE`

---

### 3. Student Integration Test — Happy Path

**File:** `src/platform/education/student/__tests__/student.integration.test.ts:103`

**Code:**
```typescript
const personResult = await personService.createPerson({
  tenantId,
  firstName: 'John',
  // ...
});

const request: CreateStudentRequest = {
  tenantId,
  personId: personResult.data.personId, // ← PASSES_PERSON_ID
  studentCode: 'EDU-2024-001',
  // ...
};

const student = await StudentService.createStudent(request);
```

- **ID_SOURCE:** `PASSES_PERSON_ID`
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE`

---

### 4. Student Integration Test — Validation Tests

**File:** `src/platform/education/student/__tests__/student.integration.test.ts:124`

**Code:**
```typescript
await expect(StudentService.createStudent({
  tenantId,
  personId: '00000000-0000-0000-0000-999999999999', // ← Hardcoded person ID
  studentCode: 'EDU-TEST',
  // ...
})).rejects.toThrow('Person with ID ... does not exist');
```

- **ID_SOURCE:** `PASSES_PERSON_ID` (hardcoded for validation test)
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE` (expect Party validation error instead)

---

### 5. Student Integration Test — Duplicate Check

**File:** `src/platform/education/student/__tests__/student.integration.test.ts:141`

**Code:**
```typescript
await expect(StudentService.createStudent({
  tenantId,
  personId: existingPersonId, // ← Uses existing person
  studentCode: 'EDU-2024-001', // Duplicate code
  // ...
})).rejects.toThrow('Student code ... already exists');
```

- **ID_SOURCE:** `PASSES_PERSON_ID`
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE`

---

### 6. Student Integration Test — Update Academic Progress

**File:** `src/platform/education/student/__tests__/student.integration.test.ts:245`

**Code:**
```typescript
const person2Result = await personService.createPerson({
  tenantId,
  firstName: 'Jane',
  // ...
});

const student2 = await StudentService.createStudent({
  tenantId,
  personId: person2Result.data.personId, // ← PASSES_PERSON_ID
  studentCode: 'EDU-2024-002',
  // ...
});
```

- **ID_SOURCE:** `PASSES_PERSON_ID`
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE`

---

### 7. Enrollment Integration Test

**File:** `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts:46`

**Code:**
```typescript
const personResult = await personService.createPerson({
  tenantId,
  firstName: 'Jane',
  // ...
});

const student = await StudentService.createStudent({
  tenantId,
  personId: personResult.data.personId, // ← PASSES_PERSON_ID
  studentCode: 'TEST-STUDENT-001',
  // ...
});
```

- **ID_SOURCE:** `PASSES_PERSON_ID`
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE`

---

### 8. Enrollment Integration Test — Graduated Student

**File:** `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts:144`

**Code:**
```typescript
const tempStudent = await StudentService.createStudent({
  tenantId,
  personId, // ← Reuses existing personId
  studentCode: 'TEMP-STUDENT',
  // ...
});
```

- **ID_SOURCE:** `PASSES_PERSON_ID` (derived from setup)
- **Environment:** TEST
- **Module:** Platform Education
- **Cutover Action:** `MIGRATE_FIXTURE`

---

## ✅ R0.7 PASS CRITERIA

\`\`\`text
Total callers:                        7
Unknown callers:                      0 ✅
Production callers mapped:            0/0 (100%) ✅
Test callers mapped:                  7/7 (100%) ✅
Semantic mismatches:                  1 (contract partyId vs impl personId) ✅
Cutover actions assigned:             7/7 (100%) ✅

Every registerStudent() call identified
Every StudentService.createStudent() call identified
Every ID source classified
Every cutover action assigned
\`\`\`

---

## 🚨 CRITICAL FINDINGS

### 1. NO PRODUCTION CALLERS ✅

**Good News:**
- No Preschool production code calls student registration
- No English Center code exists yet
- Clean cutover: only test fixtures affected

**Implication:**
- R3 Kernel + Contract cutover will NOT break production
- Only test fixtures require migration

---

### 2. ALL CALLERS PASS PERSON_ID ⚠️

**Finding:**
- 7/7 callers (100%) pass `personId`
- 0/7 callers pass `partyId`

**Root Cause:**
- Tests follow existing pattern: create Person → create Student
- No tests use Party yet (Party identity not fully adopted)

**Cutover Impact:**
- All 7 test locations must migrate:
  - Replace `PersonService.createPerson()` → `PartyService.createParty()`
  - Replace `personId` → `partyId`
  - Update expectations (validation errors mention Party, not Person)

---

### 3. SEMANTIC MISMATCH (Contract vs Implementation)

**Contract says:** `partyId: string`  
**Implementation uses:** `personId: input.partyId`

**This is INTENTIONAL adapter pattern**, but creates confusion:
- Callers think they're passing "Party ID"
- Implementation treats it as "Person ID"
- Database stores `person_id`

**R3 Cutover Must Fix:**
1. Change DB: `students.person_id` → `students.party_id`
2. Change Implementation: `personId: input.partyId` → `partyId: input.partyId`
3. Change StudentService: validate Party, not Person
4. Keep Contract: NO CHANGE (contract is already correct)

---

## 📋 CUTOVER ACTIONS

### TEST FIXTURES (7 locations)

**Must migrate all 7 test locations:**

1. `src/platform/education/__tests__/verification-gates.test.ts:145` — Migrate to Party
2. `src/platform/education/__tests__/verification-gates.test.ts:316` — Migrate to Party
3. `src/platform/education/student/__tests__/student.integration.test.ts:103` — Migrate to Party
4. `src/platform/education/student/__tests__/student.integration.test.ts:124` — Update validation (expect Party error)
5. `src/platform/education/student/__tests__/student.integration.test.ts:141` — Migrate to Party
6. `src/platform/education/student/__tests__/student.integration.test.ts:245` — Migrate to Party
7. `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts:46` — Migrate to Party
8. `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts:144` — Migrate to Party

**Migration Pattern:**

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
  // ...
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
  // ...
});
```

---

## 🔴 BLOCKERS FOR R2

\`\`\`text
R0.1 Person Census                ✅ COMPLETE
R0.2 Party Census                 ✅ COMPLETE
R0.3 Collision Detection          ✅ PASS
R0.4 Duplicate Detection          ✅ PASS
R0.5 FK Census                    ✅ COMPLETE
R0.6 Write-Path Census            ✅ COMPLETE (45+ paths)
R0.7 Contract/Caller Census       ✅ COMPLETE (7 callers)

R1 Identity Mapping               ✅ SEALED (848 mappings)

ALL BLOCKERS CLEARED ✅
R2 PARTY BACKFILL AUTHORIZED
\`\`\`

---

## 📋 NEXT STEPS

### 1. FREEZE CUTOVER PLAN

Create comprehensive cutover plan covering:
- R2: Party backfill (848 persons → 848 parties)
- R3: Kernel + Contract atomic cutover
  - students.person_id → party_id
  - StudentService validation
  - IEducationStudentContract implementation
- R4: Caller migration (7 test fixtures)
- R5: Freeze legacy Person writes (5 methods)
- R6: Verification
- R7: Evidence seal

### 2. EXECUTE R2 PARTY BACKFILL

Once cutover plan frozen:
```sql
-- R2: Backfill party_parties from persons (using R1 mapping)
INSERT INTO party_parties (id, tenant_id, party_type, display_name, ...)
SELECT 
  party_id,
  tenant_id,
  'person',
  first_name || ' ' || last_name,
  ...
FROM identity_migration_mapping m
JOIN persons p ON m.person_id = p.id
WHERE m.status = 'planned';
```

---

**R0.7 STATUS:** ✅ COMPLETE

**R0 PREFLIGHT STATUS:** ✅ COMPLETE (R0.1–R0.7)

**NEXT:** FREEZE CUTOVER PLAN → AUTHORIZE R2
