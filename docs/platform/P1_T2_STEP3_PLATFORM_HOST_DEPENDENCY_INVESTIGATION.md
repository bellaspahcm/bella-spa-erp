# P1-T2 STEP 3 — PLATFORM HOST DEPENDENCY INVESTIGATION

**Checkpoint:** `fe879542`  
**Date:** 2026-09-16  
**Investigator:** AI Coding Agent  
**Status:** ✅ **INVESTIGATION COMPLETE**

---

## **Investigation Scope**

**Target:** Platform Host files appearing in Education scope  
**Diagnostics:**  
- `src/platform/host/rule-engine/rule-engine.service.ts`: 7 diagnostics
- `src/platform/host/person/person.repository.ts`: 5 diagnostics  
**Total:** 12 diagnostics (6.8% of Education baseline 177)

**Question:** Are these legitimate Platform dependencies or unintended pollution?

---

## **Evidence Chain**

### **1. Exclusion Check - Platform Host IS Excluded**

**File:** `tsconfig.education.json`

```json
{
  "exclude": [
    "src/platform/host",  // ← Platform Host explicitly excluded
    "src/platform/healthcare",
    "src/platform/logistics",
    "src/services"
  ]
}
```

**Verdict:** Platform Host is excluded, yet being compiled → **Education must import from it**.

---

### **2. Direct Import Check - POSITIVE** ✅

**Education legitimately imports from Platform Host:**

```typescript
// src/platform/education/student/student.service.ts
import { PersonRepository } from '@/platform/host/person/person.repository';

// src/platform/education/student/__tests__/student.integration.test.ts
import { PersonService } from '@/platform/host/person/person.service';
import { PersonRepository } from '@/platform/host/person/person.repository';

// src/platform/education/enrollment/__tests__/enrollment.integration.test.ts
import { PersonService } from '@/platform/host/person/person.service';

// src/platform/education/contracts/enrollment.contract.impl.ts
import { eventBus } from '@/platform/host/event-bus';

// src/platform/education/__tests__/verification-gates.test.ts
import { PersonService } from '@/platform/host/person/person.service';
```

**Finding:** Education **LEGITIMATELY depends** on:
- `PersonService` - person management
- `PersonRepository` - person persistence ✅ (has 5 diagnostics)
- `eventBus` - domain events

---

### **3. Platform Core Scope Check**

**Question:** Is Platform Host part of Platform Core (which has 0 diagnostics)?

**File:** `tsconfig.platform-core.json`

```json
{
  "include": [
    "src/platform/core/**/*.ts",  // Only platform/core
    "src/platform/core/**/*.tsx"
  ]
}
```

**Verdict:** Platform Host (`src/platform/host/**`) is **NOT included** in Platform Core scope.

**Implication:** Platform Host is **NOT verified to be type-clean**. It's excluded from Core scope, so Core = 0 doesn't guarantee Host = 0.

---

## **Diagnostic Analysis**

### **person.repository.ts (5 diagnostics)**

**Errors observed in Education context:**

```
Line 44:  Type 'Record<string, unknown> | null' not assignable to 'Json | undefined'
Line 81:  Type 'Record<string, unknown> | null' not assignable to 'Json | undefined'
Line 262: Conversion of type 'Json' to 'PersonIdentifier[]' may be a mistake
Line 263: Conversion of type 'Json' to 'PersonContact[]' may be a mistake
Line 264: Conversion of type 'Json' to 'PersonAddress[]' may be a mistake
```

**Code pattern:**

```typescript
const insert: PersonInsert = {
  identifiers: person.identifiers as unknown as Database['public']['Tables']['persons']['Insert']['identifiers'],
  contacts: person.contacts as unknown as Database['public']['Tables']['persons']['Insert']['contacts'],
  addresses: person.addresses as unknown as Database['public']['Tables']['persons']['Insert']['addresses'],
  // ...
};
```

**Root cause:** Type assertions between domain types (`Person['identifiers']`) and database types (`Json | undefined`).

**Type context issue:**
- Domain: `PersonIdentifier[]`, `PersonContact[]`, `PersonAddress[]`
- Database: `Json | undefined` (from Supabase-generated types)
- Assertion: Unsafe type casting using `as unknown as`

---

### **rule-engine.service.ts (7 diagnostics)**

**Errors observed in Education context:**

```
Line 161: Argument of type 'string | number' not assignable to parameter of type 'never'
Line 162: Argument of type 'string | number' not assignable to parameter of type 'never'
Line 194: Type 'Record<string, unknown>' not assignable to type 'Json | undefined'
Line 198: Type 'Record<string, unknown>' not assignable to type 'Json | undefined'
Line 287: Type 'Record<string, unknown>' not assignable to type 'Json | undefined'
Line 450: Type 'Record<string, unknown>' not assignable to type 'Json | undefined'
Line 454: Type 'Record<string, unknown>' not assignable to type 'Json | undefined'
```

**Similar pattern:** Type mismatches with `Json` type and unsafe type assertions.

---

## **Classification**

### **Ownership: SHARED PLATFORM DEPENDENCY**

**Evidence:**
1. ✅ Education **legitimately uses** Platform Host services (Person, EventBus)
2. ✅ Platform Host provides **cross-cutting platform capabilities**
3. ✅ Import is **architectural intent**, not pollution
4. ❌ Platform Host is **NOT verified type-clean** (not in Core scope)

**Classification:** **LEGITIMATE CROSS-PLATFORM DEPENDENCY WITH TYPE DEBT**

**Not pollution because:**
- Education intentionally imports Platform Host
- PersonRepository is used by StudentService (legitimate)
- EventBus is used by EnrollmentContract (legitimate)
- No unintended transitive inclusion

**Has type debt because:**
- Platform Host itself contains type assertion issues
- Database type mappings use unsafe `as unknown as` casts
- Type mismatches between domain and database types

---

## **Root Cause Analysis**

### **Architectural Context**

**Platform Host role:**
- Provides shared platform services (Person, EventBus, RuleEngine)
- Used by multiple OS layers (Education, Healthcare, Beauty, etc.)
- Manages cross-cutting concerns

**Why 12 diagnostics appear in Education but Core = 0:**

Platform Host (`src/platform/host/**`) is:
- ✅ **Used by Education** (legitimate dependency)
- ❌ **NOT included in Platform Core scope** (`tsconfig.platform-core.json`)
- ❌ **NOT separately type-checked** (no `tsconfig.platform-host.json`)
- ⚠️ **Type debt is hidden** until a dependent scope compiles it

**This is DIFFERENT from Cluster E (Healthcare pollution):**

| Aspect | Cluster E | Platform Host |
|--------|-----------|---------------|
| Ownership | Healthcare | Platform (shared) |
| Education usage | None (pollution) | Legitimate (dependency) |
| Import intent | Unintended | Intentional |
| Fix approach | Remove dependency | Fix Platform Host types |

---

## **Type Context Problem**

### **Why These Errors Appear in Education Context**

**The `Json` type issue:**

```typescript
// From database.types.ts
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// Platform Host tries to assign:
person.identifiers as unknown as Json | undefined

// But person.identifiers is:
PersonIdentifier[]  // Custom domain type

// TypeScript sees:
// - PersonIdentifier[] (domain)
// - Json | undefined (database)
// - No safe conversion path
```

**Why `as unknown as` is unsafe:**

This pattern bypasses TypeScript's type safety:
```typescript
value as unknown as TargetType
```

It forces TypeScript to accept the cast, but:
- Loses type information
- Can cause runtime errors
- Appears as diagnostic when stricter checks enabled

---

## **Impact Assessment**

### **Current State**

```
Education scoped baseline          177
├─ Payroll (foreign-owned)          49  (27.7%)
├─ Repository layer                 48  (27.1%)
├─ Platform Host (shared debt)      12  (6.8%)  ← THIS INVESTIGATION
└─ Education core (preliminary)     68  (38.4%)
```

**Platform Host breakdown:**
- person.repository.ts: 5 (unsafe type assertions)
- rule-engine.service.ts: 7 (Json type mismatches)

---

## **Recommendations**

### **Immediate Classification**

**DO NOT count as Education-owned debt.**  
**DO NOT attempt to fix in Education hardening.**

These 12 diagnostics:
- **Appear in Education scope** (Education imports Platform Host)
- **Owned by Platform Host** (shared platform layer)
- **Should be fixed in Platform Host hardening** (separate effort)
- **Affect multiple OS layers** (Education, Healthcare, Beauty, etc.)

---

### **Proper Fix Approach**

**Option 1: Create Platform Host scope** (recommended)

```json
// tsconfig.platform-host.json
{
  "include": ["src/platform/host/**/*.ts"],
  "exclude": [/* other OS layers */]
}
```

Run Platform Host census separately, fix types, lock at 0.

**Option 2: Include in Platform Core scope**

Expand `tsconfig.platform-core.json` to include `platform/host/**`, fix diagnostics there.

**Option 3: Fix inline during Education hardening**

Since Education must import Platform Host anyway, fix Platform Host types as part of Education cleanup (increases scope).

---

### **Type Safety Improvements**

**Replace unsafe assertions:**

```typescript
// BEFORE (unsafe)
identifiers: person.identifiers as unknown as Database['public']['Tables']['persons']['Insert']['identifiers']

// AFTER (type-safe)
identifiers: this.mapIdentifiersToJson(person.identifiers)

private mapIdentifiersToJson(identifiers: PersonIdentifier[]): Json {
  return identifiers as unknown as Json; // Still needs cast, but isolated
}
```

Or better - align database schema with domain types:

```typescript
// Generate database types that match domain
type PersonInsert = {
  identifiers: PersonIdentifier[]; // Not Json
  contacts: PersonContact[];
  addresses: PersonAddress[];
}
```

---

## **Comparison: Payroll vs Platform Host**

| Aspect | Payroll (49) | Platform Host (12) |
|--------|--------------|---------------------|
| **Education usage** | None | Legitimate (PersonService, EventBus) |
| **Ownership** | Legacy Services | Platform (shared) |
| **Import intent** | Unintended | Intentional |
| **Pollution type** | Transitive artifact | Not pollution |
| **Classification** | Foreign-owned debt | Shared platform debt |
| **Fix location** | Legacy Services scope | Platform Host scope |
| **Action** | DEFER | DEFER or FIX INLINE |

---

## **Decision Framework**

### **Can Education hardening fix Platform Host?**

**Pros:**
- Education already compiling Platform Host
- Fixes benefit all OS layers
- Reduces Education reported count

**Cons:**
- Expands Education hardening scope
- Platform Host is shared, should be separate effort
- May introduce regressions in other OS layers

**Recommendation:** **DEFER to Platform Host hardening**

**Rationale:**
1. Platform Host is **architectural layer**, not Education component
2. Fixes should be **verified across all consumers** (Education, Healthcare, Beauty, etc.)
3. Education hardening should focus on **Education-owned code**
4. Platform debt should be **tracked and fixed separately**

---

## **Revised Education Baseline Breakdown**

```
Education scoped compiler          177  (compiler-verified)

Ownership classification:
├─ Platform Host (shared debt)      12  (6.8%)   → DEFER to Platform hardening
├─ Payroll/Legacy (foreign debt)    49  (27.7%)  → DEFER to Legacy Services
├─ Repository layer                 48  (27.1%)  → INVESTIGATE NEXT
└─ Education core (preliminary)     68  (38.4%)  → Pending classification
```

**Next investigation:** `supabase-education.repository.ts` (48 diagnostics, 27.1%)

After repository investigation, true **Education-owned baseline** will be clear.

---

## **Status**

**Investigation:** ✅ **COMPLETE**  
**Classification:** ✅ **LEGITIMATE SHARED PLATFORM DEPENDENCY**  
**Ownership:** Platform Host (shared layer)  
**Pollution:** ❌ **NO** (intentional dependency)  
**Type debt:** ✅ **YES** (unsafe type assertions)  
**Fix responsibility:** Platform Host hardening (not Education)

**Evidence confidence:** 🟢 **HIGH**

- Direct imports verified (StudentService, EnrollmentContract use Platform Host)
- Legitimate architectural dependency confirmed
- Platform Host not in Core scope (explains why Core = 0 but Host has diagnostics)
- Type assertion patterns identified
- Shared ownership confirmed (affects multiple OS layers)

---

## **Key Insight**

**Platform Host type debt is "borrowed" by Education:**

Education imports Platform Host → TypeScript compiles Platform Host → Platform Host diagnostics appear in Education output.

This is **NOT pollution** (Education needs these services), but **shared debt** (Platform Host has type issues).

**Analogy:** If you use a library with type warnings, those warnings appear in your build, but the library maintainer should fix them, not you.

---

## **Next Steps**

**Immediate:**
1. ✅ Complete this investigation
2. Document Platform Host as shared debt
3. Move to repository layer investigation (48 diagnostics)

**After Education hardening:**
1. Create Platform Host scope census
2. Fix 12 Platform Host diagnostics
3. Lock Platform Host at 0
4. Re-verify Education (should drop from 177 → 165)

**Decision:**
Platform Host diagnostics **remain in Education 177 baseline** but classified as **shared platform debt**, not Education-owned.

---

**Resume checkpoint:** `fe879542`  
**Next investigation:** `supabase-education.repository.ts` (48 diagnostics)
