# R5.3 COMPATIBILITY BRIDGE DEPRECATION — COMPLETION REPORT

**Date:** 2026-09-12  
**Status:** ✅ COMPLETE  
**Mission:** Deprecate legacy Person FK parameters (compatibility bridges only, non-canonical)

---

## 📊 EXECUTIVE SUMMARY

```text
Compatibility parameters deprecated:  3/3 ✅
  - RegisterStudentInput.personId     ✅
  - CreateStudentRequest.personId     ✅
  - Student.personId                  ✅

Build:                                PASS ✅

R5.3                                  ✅ COMPLETE
```

**Achievement:** Legacy `personId` parameters marked `@deprecated` across Education contracts and types. Production code signaled to use `partyId` (canonical identity).

---

## 🎯 DEPRECATION TARGETS

### Target #1: `RegisterStudentInput.personId`

**File:** `src/platform/education/contracts/student.contract.ts`

**BEFORE:**
```typescript
export interface RegisterStudentInput {
  readonly tenantId: string;
  readonly partyId: string;
  readonly personId?: string; // LEGACY FK (required until R4)
  readonly studentCode: string;
  readonly guardianPartyId?: string;
}
```

**AFTER:**
```typescript
export interface RegisterStudentInput {
  readonly tenantId: string;
  readonly partyId: string; // references generic Party profile identity
  
  /**
   * @deprecated Legacy Person FK compatibility. Production code should NOT provide this.
   * Required only during R3-R4 migration (backfill). After R4 complete (2026-09-12),
   * this parameter is ignored. Removal planned: R6+.
   * See: E0.1A-R Identity Remediation (R5.3 compatibility bridge deprecation)
   */
  readonly personId?: string;
  
  readonly studentCode: string;
  readonly guardianPartyId?: string;
}
```

**Status:** ✅ DEPRECATED

---

### Target #2: `CreateStudentRequest.personId`

**File:** `src/platform/education/shared-kernel/types.ts`

**BEFORE:**
```typescript
export interface CreateStudentRequest {
  tenantId: string;
  partyId?: string;         // NEW: Canonical Party identity (post-R3)
  personId: string;         // LEGACY: Compatibility during R3-R5
  // ...
}
```

**AFTER:**
```typescript
export interface CreateStudentRequest {
  tenantId: string;
  partyId?: string;         // NEW: Canonical Party identity (post-R3)
  
  /**
   * @deprecated Legacy Person FK compatibility. Production code should use partyId instead.
   * Backfilled automatically for legacy data. Removal planned: R6+.
   * See: E0.1A-R Identity Remediation (R5.3)
   */
  personId: string;
  
  studentCode: string;
  // ...
}
```

**Status:** ✅ DEPRECATED

---

### Target #3: `Student.personId`

**File:** `src/platform/education/shared-kernel/types.ts`

**BEFORE:**
```typescript
export interface Student {
  // ...
  partyId?: string; // Foreign key to party_parties table
  personId: string; // Foreign key to persons table
  // ...
}
```

**AFTER:**
```typescript
export interface Student {
  // ...
  partyId?: string; // Foreign key to party_parties table (canonical)
  
  /**
   * Person reference (LEGACY backfill — non-canonical)
   * @deprecated Use partyId for canonical identity. This field retained for legacy data backfill only.
   * Production code should NOT rely on this field. Removal planned: R6+.
   * See: E0.1A-R Identity Remediation (R5.3)
   */
  personId: string; // Foreign key to persons table (legacy)
  // ...
}
```

**Status:** ✅ DEPRECATED

---

## 📋 DATABASE COMPATIBILITY

### `students.person_id` Column Status

**Current State:**
```sql
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS person_id UUID;

ALTER TABLE public.students
  ADD CONSTRAINT students_person_fk
  FOREIGN KEY (person_id)
  REFERENCES public.persons(id)
  ON DELETE CASCADE;
```

**Disposition:** RETAINED (legacy backfill, non-canonical)

**Rationale:**
- R3: 631 students migrated, `person_id` backfilled from Party → Person mapping
- Column exists for legacy data compatibility
- Production code uses `party_id` (canonical)
- No new Person records created (R5.1 enforcement)

**Migration Path (R7):**
- Option A: Keep `person_id` permanently (audit trail)
- Option B: Remove after verification complete + Party canonical proven

**Current Decision:** RETAIN (R7 decision pending)

---

## ✅ EXIT CRITERIA

```text
Compatibility parameters identified:  3
Deprecated:                          3/3 ✅
@deprecated markers added:           3/3 ✅
Build:                               PASS ✅
TypeScript errors:                   0 ✅
```

---

## 📁 FILES MODIFIED

### Source Code
- `src/platform/education/contracts/student.contract.ts` — Deprecated `RegisterStudentInput.personId`
- `src/platform/education/shared-kernel/types.ts` — Deprecated `CreateStudentRequest.personId`, `Student.personId`

### Documentation
- `docs/products/bella-english-center/R5_3_COMPLETION_REPORT.md` (NEW)

---

## 🎯 CANONICAL STATE AFTER R5.3

```text
Education canonical identity:       Party ✅
Student.partyId:                    Canonical FK ✅
Student.personId:                   @deprecated (legacy backfill) ⚠️
RegisterStudentInput.personId:      @deprecated (ignored) ⚠️
CreateStudentRequest.personId:      @deprecated (backfill only) ⚠️

New Person records:                 BLOCKED (R5.1 guard) ❌
Production code:                    Uses Party ✅
Legacy test fixtures:               Allowed temporarily (R6 migration)
```

---

## 🚦 R5 OVERALL STATUS

```text
R5.1 Legacy Person Writer Freeze    🔒 SEALED
R5.2 FK Disposition Census          ✅ COMPLETE
R5.3 Compatibility Bridge Deprec.   ✅ COMPLETE

R5 OVERALL                          🔒 SEALED
```

---

## 📊 R5 FINAL METRICS

```text
Phase:                          R5 Legacy Person Infrastructure Freeze
Writer methods frozen:          6/6
Production Person writers:      0
Education FK tables:            1 (students — migrated)
Preschool FK tables:            3 (out of scope)
Compatibility bridges:          3 (deprecated)
Guard tests:                    11/11 PASS
Build:                          PASS
Duration:                       1 session (after R4)
```

---

## 🔐 R5 AUTHORIZATION

**R5 Status:** 🔒 SEALED

**Evidence:**
- R5.1: Person write methods deprecated + guarded (11/11 adversarial tests PASS)
- R5.2: FK census from actual schema (1 Education table, already migrated)
- R5.3: Compatibility bridges deprecated (3/3 parameters)

**Sealed By:** BELLA AI Coding Agent  
**Date:** 2026-09-12  

**Proceed:** R6 Full Education Vertical Verification

---

**R5 Complete. Legacy Person infrastructure frozen. Education canonical identity = Party. New Person debt creation BLOCKED.**
