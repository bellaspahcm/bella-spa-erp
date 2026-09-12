---
remediation_id: E0.1A-R
phase: R0.6_WRITE_PATH_CENSUS
document: R0_6_WRITE_PATH_CENSUS_REPORT
generated: 2026-09-12T07:15:00Z
status: complete
---

# R0.6 WRITE-PATH CENSUS REPORT

> **Generated:** 2026-09-12T07:15:00Z  
> **Method:** Manual grep search + code analysis

---

## 📊 CENSUS SUMMARY

\`\`\`text
Total Write Paths Found:              45+

By Layer:
  Direct Database (Test):             40+ (e2e + integration tests)
  Repository Methods:                 3 (save, update, delete)
  Service Methods:                    2 (createPerson, updatePerson)
  API Routes:                         0 (not found)
  Test Helpers/Fixtures:              40+ (embedded in tests)
  Migration Scripts:                  2
  Seed Scripts:                       0 (no dedicated seed)

By Cutover Action:
  FREEZE (no new writes):             5 (repo + service methods)
  MIGRATE_TO_PARTY (tests):           40+
  NO_ACTION (migrations):             2
\`\`\`

---

## 🔍 R0.6.1 — DIRECT DATABASE WRITES

### Production/Platform

**NONE FOUND** — All Person writes go through Repository layer (✅ Good architecture)

### Migration Scripts

1. **supabase/migrations/20260810000001_create_persons_table.sql**
   - Operation: CREATE TABLE
   - Environment: MIGRATION
   - Layer: DIRECT_DB
   - Status: ACTIVE (already executed)
   - Cutover Action: **NO_ACTION** (table creation, historical)

2. **supabase/migrations/20260810153259_create_persons_table_v2.sql** 
   - Operation: CREATE TABLE (v2)
   - Environment: MIGRATION
   - Layer: DIRECT_DB
   - Status: ACTIVE
   - Cutover Action: **NO_ACTION** (table creation, historical)

---

## 🔍 R0.6.2 — REPOSITORY METHODS

**Source:** `src/platform/host/person/person.repository.ts`

1. **PersonRepository.save()**
   - Line: ~30
   - Operation: CREATE (INSERT INTO persons)
   - Environment: PRODUCTION
   - Layer: REPOSITORY
   - Status: ACTIVE
   - Cutover Action: **FREEZE** (no new Person writes after R3 cutover)
   - Snippet: `.from('persons').insert(insert)`

2. **PersonRepository.update()**
   - Line: ~70
   - Operation: UPDATE
   - Environment: PRODUCTION
   - Layer: REPOSITORY
   - Status: ACTIVE
   - Cutover Action: **FREEZE** (no Person updates after R3 cutover)
   - Snippet: `.from('persons').update(update).eq('id', person.personId)`

3. **PersonRepository.delete()**
   - Line: ~250
   - Operation: UPDATE (soft delete, status = 'inactive')
   - Environment: PRODUCTION
   - Layer: REPOSITORY
   - Status: ACTIVE
   - Cutover Action: **FREEZE** (no Person deletes after R3 cutover)
   - Snippet: `.from('persons').update({ status: 'inactive' })`

---

## 🔍 R0.6.3 — SERVICE METHODS

**Source:** `src/platform/host/person/person.service.ts`

1. **PersonService.createPerson()**
   - Line: ~40
   - Operation: CREATE (orchestrates repository.save)
   - Environment: PRODUCTION
   - Layer: SERVICE
   - Status: ACTIVE
   - Used By: Education Student creation, enrollment tests
   - Cutover Action: **FREEZE** (no new Person writes after R3 cutover)
   - Call Chain: `createPerson() → repository.save() → INSERT`

2. **PersonService.updatePerson()**
   - Line: ~99
   - Operation: UPDATE (orchestrates repository.update)
   - Environment: PRODUCTION
   - Layer: SERVICE
   - Status: ACTIVE
   - Cutover Action: **FREEZE** (no Person updates after R3 cutover)
   - Call Chain: `updatePerson() → repository.update() → UPDATE`

---

## 🔍 R0.6.4 — API ROUTES/HANDLERS

**NONE FOUND** — No dedicated Person API routes detected.

Person creation happens through:
- Education Student Service (indirect)
- Test setup (direct)

---

## 🔍 R0.6.5 — TEST HELPERS/FIXTURES

### E2E Tests (Preschool Product)

1. **e2e/tests/16-preschool-care-workspace-field.spec.ts**
   - Line: 43
   - Operation: UPSERT (`.from("persons").upsert()`)
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

2. **e2e/tests/17-preschool-learning-workspace-field.spec.ts**
   - Line: 33
   - Operation: UPSERT
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

3. **e2e/tests/18-preschool-parent-engagement-field.spec.ts**
   - Line: 33
   - Operation: UPSERT
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

4. **e2e/tests/19-preschool-finance-field.spec.ts**
   - Lines: 39, 47, 60, 66
   - Operation: UPSERT (4 person records: parent, staff, 2 students)
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

5. **e2e/tests/20-preschool-scheduling-field.spec.ts**
   - Lines: 35, 44, 53
   - Operation: UPSERT (3 staff persons)
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

6. **e2e/tests/21-preschool-facilities-field.spec.ts**
   - Line: 35
   - Operation: UPSERT (inspector person)
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

### Integration Tests (Education Product)

7. **tests/products/bella-education/reconciliation/p-axis4-truth-projection.integration.test.ts**
   - Line: 58
   - Operation: INSERT
   - Environment: TEST
   - Cutover Action: **MIGRATE_TO_PARTY**

8. **tests/products/bella-education/parent-engagement/p61-communication-lifecycle.integration.test.ts**
   - Lines: 56, 63, 70, 78, 84
   - Operation: INSERT (5 persons: 2 guardians, 1 teacher, 2 students)
   - Environment: TEST
   - Includes: DELETE cleanup (lines 129, 135)
   - Cutover Action: **MIGRATE_TO_PARTY**

9. **tests/products/bella-education/parent-engagement/p62-cross-domain-projections.integration.test.ts**
   - Lines: 70, 77, 84, 91, 99, 105
   - Operation: INSERT (6 persons: 3 guardians, 1 teacher, 2 students)
   - Environment: TEST
   - Includes: DELETE cleanup (lines 158, 164)
   - Cutover Action: **MIGRATE_TO_PARTY**

10. **tests/products/bella-education/learning-development/p51-observation-evidence.integration.test.ts**
    - Lines: 45, 52, 58, 64
    - Operation: INSERT (4 persons: 1 teacher, 3 students)
    - Environment: TEST
    - Cutover Action: **MIGRATE_TO_PARTY**

11. **tests/products/bella-education/learning-development/p52-progress-next-steps.integration.test.ts**
    - Lines: 52, 59, 65, 71
    - Operation: INSERT (4 persons: 1 teacher, 3 students)
    - Environment: TEST
    - Cutover Action: **MIGRATE_TO_PARTY**

12. **tests/products/bella-education/finance/p72-finance-communication.integration.test.ts**
    - Lines: 76, 77, 108
    - Operation: INSERT (2 + N persons: parent, staff, + dynamic students)
    - Environment: TEST
    - Cutover Action: **MIGRATE_TO_PARTY**

13. **tests/platform/education/__tests__/verification-gates.test.ts**
    - Uses `PersonService.createPerson()` (lines 133, 306)
    - Environment: TEST
    - Cutover Action: **MIGRATE_TO_PARTY**

14. **tests/platform/education/student/__tests__/student.integration.test.ts**
    - Uses `PersonService.createPerson()` (lines 55, 232)
    - Environment: TEST
    - Cutover Action: **MIGRATE_TO_PARTY**

15. **tests/platform/education/enrollment/__tests__/enrollment.integration.test.ts**
    - Uses `PersonService.createPerson()` (line 26)
    - Environment: TEST
    - Cutover Action: **MIGRATE_TO_PARTY**

**Total:** 40+ distinct test locations writing persons

---

## ✅ R0.6 PASS CRITERIA

\`\`\`text
Total write paths found:              45+
Unknown write paths:                  0
Production writers mapped:            5 (PersonRepository x3, PersonService x2)
Test writers mapped:                  40+
Migration writers mapped:             2
Seed writers mapped:                  0

✅ All write paths classified
✅ No unknown write paths
✅ Cutover actions assigned
✅ No API routes (good - writes go through service layer)
\`\`\`

---

## 🚨 CRITICAL CUTOVER ACTIONS

### FREEZE (No New Person Writes After R3 Cutover)

**5 production write methods must be frozen:**

1. `PersonRepository.save()` — src/platform/host/person/person.repository.ts:30
2. `PersonRepository.update()` — src/platform/host/person/person.repository.ts:70
3. `PersonRepository.delete()` — src/platform/host/person/person.repository.ts:250
4. `PersonService.createPerson()` — src/platform/host/person/person.service.ts:40
5. `PersonService.updatePerson()` — src/platform/host/person/person.service.ts:99

**Freeze Strategy:**
- R5: Add runtime guard to throw error on new Person writes
- Or: Deprecate methods, force callers to use Party APIs
- Or: Make methods call Party APIs internally (adapter pattern)

###  MIGRATE_TO_PARTY (Test Fixtures)

**40+ test locations must migrate to Party:**

**E2E Tests (Preschool):**
- 6 test files (preschool-*-field.spec.ts)
- ~15 person upserts total

**Integration Tests (Education):**
- 9 test files (p51, p52, p61, p62, p72, etc.)
- ~25 person inserts total
- Includes DELETE cleanup that must also migrate

**Migration Strategy:**
- Replace `.from("persons").insert/upsert()` → `.from("party_parties").insert()`
- Replace `PersonService.createPerson()` → `PartyService.createParty()`
- Update cleanup: `.from("persons").delete()` → `.from("party_parties").delete()`
- Update party_type: `'person'` (not `'individual'`)

---

## 🔴 BLOCKERS FOR R2

\`\`\`text
R0.6 Write-Path Census                ✅ COMPLETE (45+ paths found, all classified)
R0.7 Contract/Caller Census           🔴 REQUIRED

CANNOT proceed to R2 Party Backfill until R0.7 complete.
\`\`\`

---

## 📋 R0.7 REQUIREMENTS

Must trace:

1. **IEducationStudentContract.registerStudent(partyId)**
   - What ID are callers actually passing?
   - Are they passing person_id or party_id?
   
2. **StudentService.createStudent(request)**
   - Validates: `PersonRepository.findById(request.personId)` ⚠️
   - Must change to: `PartyRepository.findById(request.partyId)`

3. **All callers of PersonService.createPerson()**
   - Must migrate to PartyService.createParty()
   - Or adapt: createPerson() internally creates Party

4. **Test fixtures**
   - Preschool E2E: 6 files
   - Education Integration: 9 files
   - Must update to use party_parties

---

**R0.6 STATUS:** ✅ COMPLETE

**NEXT:** R0.7 Contract/Caller Census
