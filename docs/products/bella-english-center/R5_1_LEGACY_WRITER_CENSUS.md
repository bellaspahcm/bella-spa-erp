# R5.1 LEGACY WRITER CENSUS

**Date:** 2026-09-12  
**Scope:** Person writer methods (freeze new Education usage)  
**Status:** 🔒 CENSUS FROZEN

---

## 📊 WRITER METHOD INVENTORY

### PersonRepository (Internal)

```text
1. save(person: Person): Promise<Person>
   - Location: src/platform/host/person/person.repository.ts:28
   - Type: Internal (called by PersonService)
   - Production callers: 0
   
2. update(person: Person): Promise<Person>
   - Location: src/platform/host/person/person.repository.ts:67
   - Type: Internal (called by PersonService)
   - Production callers: 0
   
3. delete(personId: string, tenantId: string): Promise<void>
   - Location: src/platform/host/person/person.repository.ts:219
   - Type: Internal (called by PersonService)
   - Production callers: 0
```

### PersonService (Public API)

```text
4. createPerson(request: CreatePersonRequest): Promise<PersonResponse<Person>>
   - Location: src/platform/host/person/person.service.ts:40
   - Type: Public API
   - Production callers: 0 ✅
   - Test callers: 3
   
5. updatePerson(request: UpdatePersonRequest): Promise<PersonResponse<Person>>
   - Location: src/platform/host/person/person.service.ts:99
   - Type: Public API
   - Production callers: 0 ✅
   - Test callers: 0
   
6. deletePerson(personId: string, tenantId: string): Promise<PersonResponse<void>>
   - Location: src/platform/host/person/person.service.ts:353
   - Type: Public API
   - Production callers: 0 ✅
   - Test callers: 0
```

**Total:** 6 methods (3 internal Repository, 3 public Service)

---

## 📋 CALLER CENSUS

### Production Callers (Education Domain)

```text
PersonService.createPerson:     0 ✅
PersonService.updatePerson:     0 ✅
PersonService.deletePerson:     0 ✅

PersonRepository.save:          0 (internal only)
PersonRepository.update:        0 (internal only)
PersonRepository.delete:        0 (internal only)
```

**Result:** Zero production callers in Education domain ✅

### Test Callers

```text
PersonService.createPerson:     3 files
  - src/platform/education/enrollment/__tests__/enrollment.integration.test.ts
  - src/platform/education/student/__tests__/student.integration.test.ts
  - src/platform/education/__tests__/verification-gates.test.ts

PersonService.updatePerson:     0
PersonService.deletePerson:     0
```

**Test Classification:**
- All 3 are integration tests (NOT production code)
- Used for test fixture setup (creating test Persons)
- Do NOT represent production Person write dependencies

---

## 🎯 R5.1 CLASSIFICATION

### UNUSED (Production)

```text
✅ PersonService.updatePerson    → No production callers
✅ PersonService.deletePerson    → No production callers
```

**Action:** Mark @deprecated, add warning

### TEST_ONLY

```text
⚠️ PersonService.createPerson    → 3 test files only
```

**Action:** Allow for test fixtures, block new Education production usage

### INTERNAL

```text
🔧 PersonRepository methods      → Internal to PersonService
```

**Action:** No direct access enforcement needed (not exported)

---

## 🚫 R5.1 FREEZE PLAN

### Phase 1: Mark Deprecated

**PersonService methods:**

```typescript
// src/platform/host/person/person.service.ts

/**
 * @deprecated Legacy Person identity. New code should use Party (canonical identity).
 * Education domain: Use PartyRepository instead.
 * Existing usage: Test fixtures only (as of R5.1 freeze).
 * Removal planned: After R6 verification + R7 enforcement.
 */
async createPerson(request: CreatePersonRequest): Promise<PersonResponse<Person>> {
  // Log deprecation warning
  console.warn(
    '[DEPRECATED] PersonService.createPerson() - ' +
    'New code should use Party canonical identity. ' +
    'See: E0.1A-R Identity Remediation (R5 frozen 2026-09-12)'
  );
  
  // Existing implementation...
}

/**
 * @deprecated Legacy Person identity. No active production usage.
 * Removal planned: R6+ after verification.
 */
async updatePerson(...) { /* ... */ }

/**
 * @deprecated Legacy Person identity. No active production usage.
 * Removal planned: R6+ after verification.
 */
async deletePerson(...) { /* ... */ }
```

### Phase 2: Architecture Guard (Optional)

**If strict enforcement needed:**

```typescript
// Platform-level guard (future R7 enforcement)
class PersonWriteGuard {
  static validateCaller(callerModule: string): void {
    const prohibitedModules = [
      '/education/',      // Education must use Party
      '/products/bella-', // New products must use Party
    ];
    
    if (prohibitedModules.some(m => callerModule.includes(m))) {
      throw new ArchitectureViolation(
        `Person write prohibited in ${callerModule}. Use Party canonical identity.`
      );
    }
  }
}
```

**Note:** Guard implementation deferred to R7 (enforcement layer). R5 focuses on deprecation marking.

---

## ✅ R5.1 EXIT CRITERIA

```text
Writer methods inventoried:           6/6 ✅
Production callers (Education):       0 ✅
Test-only callers:                   3 (isolated)
Unknown callers:                     0 ✅

New Education → Person writes:        0 ✅
Deprecated markers added:            ___ (TODO: apply)
Build:                               ___ (verify after marking)
Tests:                               ___ (should still PASS)
```

**Freeze Status:**

```text
Education production:   ✅ ZERO Person writes
Test fixtures:         ⚠️ 3 files (allowed, not migrated)
Unknown usage:         ✅ ZERO
```

---

## 📝 FREEZE ACTIONS (Next Steps)

### Action 1: Add @deprecated markers
- [ ] PersonService.createPerson
- [ ] PersonService.updatePerson
- [ ] PersonService.deletePerson
- [ ] Add deprecation warnings to console

### Action 2: Verify build
- [ ] npm run build → PASS

### Action 3: Verify tests
- [ ] Test files using createPerson → still PASS
- [ ] No new test failures from deprecation warnings

### Action 4: Document freeze
- [ ] Update R5_1_LEGACY_WRITER_CENSUS.md (this file)
- [ ] Mark R5.1 complete

---

## 🚫 OUT OF SCOPE (R5.2/R5.3 Tasks)

**DO NOT do in R5.1:**
- ❌ Remove PersonService methods (still used by tests)
- ❌ Remove students.person_id FK (R5.3)
- ❌ Classify 6 remaining FK tables (R5.2)
- ❌ Remove compatibility bridge (R5.3)
- ❌ Block test fixture usage (tests allowed to use Person)

**R5.1 scope:** Freeze new Production writes only. Tests can continue using Person for fixtures.

---

**Census Date:** 2026-09-12  
**Writer Methods:** 6 (3 Repository internal, 3 Service public)  
**Production Callers:** 0 ✅  
**Next:** Apply deprecation markers → R5.2 FK Disposition
