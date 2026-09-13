# R5.1B TEST CALLER CLASSIFICATION

**Date:** 2026-09-12  
**Total Callers:** 3 (all using PersonService.createPerson)  
**Classification:** Education Test Fixtures

---

## 📋 CLASSIFICATION RESULTS

### Caller #1: enrollment.integration.test.ts

**File:** `src/platform/education/enrollment/__tests__/enrollment.integration.test.ts`

**Usage:**
```typescript
const personResult = await personService.createPerson({
  tenantId,
  firstName: 'Jane',
  lastName: 'Smith',
  dateOfBirth: '2001-05-20',
  // ...
});
```

**Classification:** 🟡 EDUCATION FIXTURE (not Person component test)

**Purpose:** Create test Person as fixture for Enrollment integration tests

**Recommendation:** Migrate to Party in R6 (when Education test suite migrated)

---

### Caller #2: student.integration.test.ts

**File:** `src/platform/education/student/__tests__/student.integration.test.ts`

**Usage:**
```typescript
const supabase = await createClient();
personService = new PersonService(supabase);
personRepository = new PersonRepository(supabase);
// Later: personService.createPerson(...)
```

**Classification:** 🟡 EDUCATION FIXTURE (not Person component test)

**Purpose:** Create test Person as fixture for Student integration tests

**Recommendation:** Migrate to Party in R6 (when Education test suite migrated)

---

### Caller #3: verification-gates.test.ts

**File:** `src/platform/education/__tests__/verification-gates.test.ts`

**Usage:**
```typescript
import { PersonService } from '@/platform/host/person/person.service';
// Later: personService.createPerson(...) for test fixtures
```

**Classification:** 🟡 EDUCATION FIXTURE (not Person component test)

**Purpose:** Create test Person as fixture for Education OS 11 Gates verification

**Recommendation:** Migrate to Party in R6 (when Education test suite migrated)

---

## 🎯 CLASSIFICATION SUMMARY

```text
Legacy Person component tests:   0
Education/Product fixtures:     3 ✅
Migration/remediation scripts:   0
Unknown:                        0

Classification complete:        3/3 ✅
```

**Finding:** All 3 callers are Education test fixtures, NOT Person component tests.

---

## 🚦 R5.1B ENFORCEMENT DECISION

### ALLOWED TEMPORARILY (with migration path)

**Rationale:**
1. These are test fixtures for Education integration tests
2. Migrating them requires broader Education test suite migration (R6 scope)
3. Zero production code affected (tests only)
4. Clear migration path exists (use Party-based fixtures)

**Policy:**
```text
BLOCK:   New Education production code → Person writes ❌
ALLOW:   Existing Education test fixtures → Person writes (temporary) ⚠️
MIGRATE: R6 Education test suite → Party-based fixtures
```

**Guard Implementation:**

```typescript
// Scoped guard: Block production, allow tests temporarily
class PersonWriteGuard {
  static validate(callerPath: string): void {
    // Block new production code
    if (this.isProductionCode(callerPath) && this.isEducationDomain(callerPath)) {
      throw new ArchitectureViolation(
        `Person write prohibited in Education production code. ` +
        `Use Party canonical identity. See: E0.1A-R (R5 freeze)`
      );
    }
    
    // Allow legacy test fixtures (temporary)
    if (this.isTestCode(callerPath)) {
      console.warn(
        `[LEGACY TEST FIXTURE] ${callerPath} uses Person writes. ` +
        `Migration to Party planned for R6.`
      );
      return; // Allow but warn
    }
  }
  
  private static isProductionCode(path: string): boolean {
    return !path.includes('__tests__') && 
           !path.includes('.test.') &&
           !path.includes('/tests/');
  }
  
  private static isEducationDomain(path: string): boolean {
    return path.includes('/education/') || 
           path.includes('/products/bella-education');
  }
  
  private static isTestCode(path: string): boolean {
    return path.includes('__tests__') || 
           path.includes('.test.') ||
           path.includes('/tests/');
  }
}
```

---

## ✅ R5.1B-2 EXIT CRITERIA

```text
Test callers identified:        3/3 ✅
Classification complete:        3/3 ✅
  - Legacy Person tests:        0
  - Education fixtures:         3
  - Migration scripts:          0
  - Unknown:                    0

Enforcement decision:           ✅ ALLOW TEMPORARILY
Migration path defined:         ✅ R6 Education test migration
Guard scope defined:            ✅ Block production, allow tests
```

**Status:** R5.1B-2 COMPLETE ✅

---

## 📝 MIGRATION PATH (R6)

**R6 Task:** Migrate Education test fixtures to Party

```typescript
// BEFORE (R5 - temporary)
const personResult = await personService.createPerson({
  tenantId,
  firstName: 'Test',
  lastName: 'Student',
  // ...
});
const person = personResult.data;

const student = await StudentService.createStudent({
  personId: person.id,
  studentCode: 'TEST-001',
  // ...
});

// AFTER (R6 - target)
const party = await PartyRepository.create({
  tenantId,
  partyType: 'person',
  displayName: 'Test Student',
  // ...
});

const student = await StudentService.createStudent({
  partyId: party.id,
  personId: existingPersonId, // From backfill, optional
  studentCode: 'TEST-001',
  // ...
});
```

---

**Classification Date:** 2026-09-12  
**Callers Classified:** 3/3  
**Next:** R5.1B-3 Scoped Guard Implementation
