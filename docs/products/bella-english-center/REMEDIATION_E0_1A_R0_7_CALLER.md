---
remediation_id: E0.1A-R
phase: R0.7_CONTRACT_CALLER_CENSUS
status: in_progress
created: 2026-09-12
blast_radius: platform_wide
---

# E0.1A-R0.7 — CONTRACT/CALLER CENSUS

> **Purpose:** Trace semantic caller chain to determine if callers pass person_id or party_id.
> 
> **Critical Question:** Are Student registration callers passing `persons.id` or `party_parties.id`?

---

## 📋 R0.7 SCOPE

```text
R0.7.1  Trace IEducationStudentContract call chain
R0.7.2  Identify all registerStudent() callers
R0.7.3  Classify ID source (person vs party)
R0.7.4  Census Preschool integration callers
R0.7.5  Census test/fixture callers
R0.7.6  Assign cutover actions
```

---

## 🎯 CRITICAL QUESTION

> **Every caller of Student registration: are they passing `persons.id` or `party_parties.id`?**

### Call Chain to Trace

```text
IEducationStudentContract
   ↓
registerStudent(partyId: UUID)  ← Contract signature says "partyId"
   ↓
StudentService.createStudent(request)
   ↓
PersonRepository.findById(request.personId)  ⚠️ Implementation uses personId
   ↓
students.person_id FK
```

**SEMANTIC MISMATCH DETECTED:**
- Contract parameter: `partyId`
- Implementation validates: `personId`
- Database FK: `person_id`

---

## 📊 CLASSIFICATION SCHEMA

Each caller must be classified:

| Attribute | Values |
|-----------|--------|
| **CALLER** | File path + function |
| **CALL_SITE** | Line number |
| **ID_SOURCE** | PASSES_PERSON_ID \| PASSES_PARTY_ID \| DERIVES_ID \| UNKNOWN |
| **ENVIRONMENT** | PRODUCTION \| TEST |
| **MODULE** | Preschool \| Education \| Platform |
| **CUTOVER_ACTION** | UPDATE_TO_PARTY_ID \| MIGRATE_FIXTURE \| REMOVE \| NO_CHANGE |

---

## 🔍 R0.7.1 — TRACE CONTRACT CALL CHAIN

### Contract Definition

**Expected Location:** `src/platform/education/contracts/IEducationStudentContract.ts`

Must verify:
```typescript
interface IEducationStudentContract {
  registerStudent(
    tenantId: UUID,
    partyId: UUID,      // ← Contract says "partyId"
    programId: UUID,
    // ...
  ): Promise<StudentResponse>;
}
```

### Implementation

**Expected:** `StudentService.createStudent()` or adapter

Must trace:
- Does implementation accept `partyId` or `personId`?
- Does it validate `PersonRepository.findById(personId)`? ⚠️
- Does it insert `students.person_id`?

---

## 🔍 R0.7.2 — IDENTIFY ALL CALLERS

### Search Patterns

```bash
# Direct registerStudent calls
grep -r "registerStudent" src/ e2e/ tests/

# Student creation wrappers
grep -r "createStudent\|enrollStudent" src/ e2e/ tests/

# StudentService calls
grep -r "StudentService" src/ e2e/ tests/
```

### Expected Caller Categories

1. **Preschool Production Code**
   - Server actions
   - UI components
   - Business logic

2. **Education Kernel**
   - Internal services
   - Domain logic

3. **Test Fixtures**
   - E2E tests (Preschool)
   - Integration tests (Education)
   - Helper functions

---

## 🔍 R0.7.3 — CLASSIFY ID SOURCE

For each caller, determine:

### PASSES_PERSON_ID

```typescript
// Example: Caller creates Person first, passes person.id
const person = await PersonService.createPerson({ ... });
await registerStudent(tenantId, person.id, programId); // ← person.id
```

**Classification:** `PASSES_PERSON_ID`  
**Cutover Action:** `UPDATE_TO_PARTY_ID` (must change to party.id)

### PASSES_PARTY_ID

```typescript
// Example: Caller creates Party first, passes party.id
const party = await PartyService.createParty({ ... });
await registerStudent(tenantId, party.id, programId); // ← party.id
```

**Classification:** `PASSES_PARTY_ID`  
**Cutover Action:** `NO_CHANGE` (already correct)

### DERIVES_ID

```typescript
// Example: Caller derives ID from existing entity
const guardian = await getGuardian(guardianId);
await registerStudent(tenantId, guardian.personId, programId); // ← derived
```

**Classification:** `DERIVES_ID`  
**Cutover Action:** `UPDATE_DERIVATION` (must derive party.id instead)

### UNKNOWN

```typescript
// Example: ID source unclear
await registerStudent(tenantId, someId, programId); // ← where does someId come from?
```

**Classification:** `UNKNOWN`  
**Cutover Action:** `INVESTIGATE` (trace source before cutover)

---

## 🔍 R0.7.4 — PRESCHOOL INTEGRATION CENSUS

### Scope

All Preschool code that calls Education Student registration:

- `src/products/bella-education/` (Preschool product)
- Server actions
- UI components
- Business logic
- Enrollment flows

### Questions

1. Where does Preschool create students?
2. Does it call PersonService.createPerson() first?
3. Does it pass person.id or party.id?
4. How many call sites?

---

## 🔍 R0.7.5 — TEST/FIXTURE CENSUS

### E2E Tests (Preschool)

From R0.6, we know these tests create persons:
- e2e/tests/16-preschool-care-workspace-field.spec.ts
- e2e/tests/17-preschool-learning-workspace-field.spec.ts
- e2e/tests/18-preschool-parent-engagement-field.spec.ts
- e2e/tests/19-preschool-finance-field.spec.ts
- e2e/tests/20-preschool-scheduling-field.spec.ts
- e2e/tests/21-preschool-facilities-field.spec.ts

**Must verify:**
- Do they call registerStudent()?
- Do they pass person.id?
- Must migrate to party.id

### Integration Tests (Education)

From R0.6:
- tests/products/bella-education/**/*.integration.test.ts
- tests/platform/education/**/*.test.ts

**Must verify:**
- Which tests call StudentService.createStudent()?
- What ID do they pass?

---

## 📊 R0.7.6 — CENSUS RESULTS TEMPLATE

```text
═══════════════════════════════════════════════════════════════
R0.7 CONTRACT/CALLER CENSUS RESULTS
═══════════════════════════════════════════════════════════════

SEMANTIC MISMATCH
--------------------------------------------------------------------
Contract Parameter:               partyId
Implementation Validates:         personId ⚠️
Database FK:                      person_id

MISMATCH: Contract says "party" but implementation uses "person"

CALLER CLASSIFICATION
--------------------------------------------------------------------
Total Callers:                    XX
Production Callers:               XX
Test Callers:                     XX

By ID Source:
  PASSES_PERSON_ID:               XX
  PASSES_PARTY_ID:                XX
  DERIVES_ID:                     XX
  UNKNOWN:                        XX

PRODUCTION CALLERS
--------------------------------------------------------------------
1. src/products/bella-education/actions/createStudentAction.ts:45
   ID_SOURCE: PASSES_PERSON_ID
   SNIPPET: const person = await createPerson(...); registerStudent(person.id)
   CUTOVER_ACTION: UPDATE_TO_PARTY_ID

2. ...

TEST CALLERS
--------------------------------------------------------------------
1. e2e/tests/19-preschool-finance-field.spec.ts:XX
   ID_SOURCE: PASSES_PERSON_ID
   SNIPPET: await supabase.from("persons").upsert(...); registerStudent(personId)
   CUTOVER_ACTION: MIGRATE_FIXTURE

2. ...

═══════════════════════════════════════════════════════════════
SUMMARY
═══════════════════════════════════════════════════════════════

Unknown callers:                  0
Production callers mapped:        100%
Test callers mapped:              100%
Semantic mismatches:              1 (contract vs implementation)
Cutover actions assigned:         100%

✅ R0.7 PASS CRITERIA MET
```

---

## ✅ R0.7 PASS CRITERIA

```text
Unknown callers                   = 0
Production callers mapped         = 100%
Test callers mapped               = 100%
Semantic mismatches counted       = exact (contract partyId vs impl personId)
Cutover action assigned           = 100%

Every registerStudent() call identified
Every ID source classified
Every cutover action assigned
```

---

## 🔴 BLOCKERS FOR R2

```text
R0.6 Write-Path Census            ✅ COMPLETE
R0.7 Contract/Caller Census       ▶ IN PROGRESS

CANNOT proceed to R2 until R0.7 complete.
```

---

## 📋 AFTER R0.7 COMPLETE

Once R0.7 passes:

```text
R0 PREFLIGHT                      ✅ COMPLETE (R0.1–R0.7)
R1 IDENTITY MAPPING               ✅ SEALED

NEXT: FREEZE CUTOVER PLAN
  ↓
R2 PARTY BACKFILL AUTHORIZED
```

---

**STATUS:** R0.7 specification complete, execution starting.

**NEXT:** Search and classify all registerStudent() callers.
