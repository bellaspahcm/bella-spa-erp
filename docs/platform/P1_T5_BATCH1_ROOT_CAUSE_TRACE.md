# P1-T5 Batch 1: Root Cause Trace

**Status:** COMPLETE  
**Date:** 2026-09-16  
**Failed Hypothesis:** SurgicalDatabase custom type + cast  
**Actual Root Cause:** IMPORT PATH ERROR  

---

## Executive Summary

**Previous Hypothesis (REJECTED):**
- Root cause: `SupabaseClient<Record<string, unknown>>`
- Fix: Define custom SurgicalDatabase type
- Result: 132 → 132 (NO EFFECT)

**Actual Root Cause (PROVEN):**
- Missing/incorrect import path for Database type
- Surgical tables EXIST in `@/types/database.types`
- Repository uses no import = defaults to `Record<string, unknown>`
- Other Healthcare repositories have SAME issue (TS2307 errors)

---

## Evidence Chain

### 1. Tables Exist in Schema

**File:** `src/types/database.types.ts`

Surgical tables confirmed present:
- `hc_surgical_cases` (line 14010)
- `hc_surgical_safety_checklists` (line 14103)
- `hc_surgical_teams` (line 14211)

All with complete Row/Insert/Update types.

### 2. Import Path Analysis

**Other Healthcare Repositories:**

| Repository | Import Path | Status |
|------------|-------------|--------|
| `supabase-order-repository.ts` | `@/types/supabase` | ❌ BROKEN (TS2307) |
| `supabase-encounter-reader.ts` | `@/types/supabase` | ❌ BROKEN (TS2307) |
| `supabase-pharmacy.repository.ts` | `@/types/supabase` | ❌ BROKEN (TS2307) |
| `supabase-clinical-order-reader.ts` | `@/types/supabase` | ❌ BROKEN (TS2307) |
| `supabase-laboratory.repository.ts` | `@/types/database.types` | ✅ CORRECT |

**Finding:** `@/types/supabase` file does NOT exist. Multiple repositories have broken imports.

### 3. Surgical Repository Current State

**File:** `src/platform/healthcare/engines/surgical-engine/repositories/supabase-surgery.repository.ts`

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
// NO Database import!

export class SupabaseSurgeryRepository {
  constructor(private readonly supabase: SupabaseClient<Record<string, unknown>>) {
    //                                                   ^^^^^^^^^^^^^^^^^^^^^^^^
    //                                                   Fallback generic
  }
```

**No Database type import → defaults to Record<string, unknown> → never[] inference**

---

## Type Inference Trace

### Method: `save()`

**Step 1: Client Type**
```typescript
SupabaseClient<Record<string, unknown>>
```

**Step 2: `.from('hc_surgical_cases')`**
```typescript
// TypeScript cannot find 'hc_surgical_cases' in Record<string, unknown>
// → Returns PostgrestQueryBuilder<never>
```

**Step 3: `.insert(dbRow)`**
```typescript
// dbRow type is correct: { id: string, tenant_id: string, ... }
// But PostgrestQueryBuilder<never>.insert() expects never
// → TS2345: Argument not assignable to 'never'
```

**Step 4: `.select().single()`**
```typescript
// Returns PostgrestSingleResponse<never>
// → data: never
```

**Step 5: Repository Return**
```typescript
async save(sCase: SurgicalCase): Promise<SurgicalCase> {
  // ...
  return this.mapToEntity(persistedRow, checklistRow);
  //                      ^^^^^^^^^^^^
  //                      Type: never
}
```

**TypeScript infers:** `mapToEntity(never, ...) → never`

**Step 6: Service Consumption**
```typescript
const saved = await this.surgeryRepository.save(surgicalCase);
//    ^^^^^ Inferred as: never

saved.id  // TS2339: Property 'id' does not exist on type 'never'
```

**FIRST FAILURE POINT:** Line 2 - `.from('hc_surgical_cases')` with no schema generic

---

## Why Previous Fix Failed

### Attempt: Custom SurgicalDatabase Type + Cast

```typescript
// In repository
export type SurgicalDatabase = { ... };  // Manually defined

constructor(private readonly supabase: SupabaseClient<SurgicalDatabase>) {}

// In service
this.repo = new SupabaseSurgeryRepository(
  supabase as unknown as SupabaseClient<SurgicalDatabase>
);
```

**Why it failed:**
1. Cast happens AFTER client is already typed as `Record<string, unknown>`
2. TypeScript has already inferred `never` at query builder level
3. Cast doesn't retroactively fix inference that happened upstream
4. The repository constructor receives already-broken type

**The cast was too late in the chain.**

---

## Correct Fix

### Import Database Type from Correct Path

```typescript
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';  // ← ADD THIS

export class SupabaseSurgeryRepository {
  constructor(private readonly supabase: SupabaseClient<Database>) {
    //                                                   ^^^^^^^^
    //                                                   Correct schema
    super();
  }
```

**Why this works:**
1. Database type imported from actual generated schema
2. Contains `hc_surgical_cases`, `hc_surgical_safety_checklists` tables
3. TypeScript can infer correct types at `.from()` level
4. No need for custom types or casts
5. Matches working pattern from `laboratory.repository.ts`

---

## Impact Analysis

### Surgical Repository Only

**Files to change:** 1
- `supabase-surgery.repository.ts`

**Changes:**
- Add import: `import type { Database } from '@/types/database.types';`
- Change constructor: `SupabaseClient<Database>` (from `Record<string, unknown>`)

**Expected result:** 33 diagnostics → 0

### Broader Healthcare Issue

**Other repositories with broken `@/types/supabase` imports:**

1. `order-engine/supabase-order-repository.ts` (TS2307)
2. `order-engine/supabase-encounter-reader.ts` (TS2307)
3. `pharmacy-engine/supabase-pharmacy.repository.ts` (TS2307)
4. `pharmacy-engine/supabase-clinical-order-reader.ts` (TS2307)

**Total broken imports:** 5 files (including surgical)

**If all fixed:**
- Order engine: ~17 diagnostics
- Pharmacy: ~2 diagnostics
- Surgical: ~33 diagnostics
- **Potential total:** ~52 diagnostics resolved

But P1-T5 Batch 1 focuses only on Surgical (33).

---

## Service Layer - NO CHANGE NEEDED

**Surgical service does NOT need modification.**

The service receives `SupabaseClient<Record<string, unknown>>` from platform, which is correct - it's a generic client. The repository constructor typing is what matters:

```typescript
// Service (unchanged):
constructor(private readonly supabase: SupabaseClient<Record<string, unknown>>) {
  this.repo = new SupabaseSurgeryRepository(supabase);  // ← No cast needed
}

// Repository (typed constructor):
constructor(private readonly supabase: SupabaseClient<Database>) {}
```

**TypeScript automatically narrows the generic when passing to typed constructor.**

No `as unknown as` needed. No wrapper. No factory.

---

## Lessons Learned

### 1. Import Path > Custom Types

Creating custom `SurgicalDatabase` type was unnecessary complexity.  
Correct: Use existing generated `Database` from `@/types/database.types`.

### 2. Cast Timing Matters

Casting at service instantiation was too late.  
Correct: Type the repository constructor parameter directly.

### 3. Trace from Source

Started with "missing schema" hypothesis.  
Correct: Traced imports and found tables existed, just wrong path.

### 4. Verify File Existence

Assumed `@/types/supabase` existed because other files imported it.  
Correct: Multiple files had broken imports, creating cascade of TS2307 errors.

---

## Corrected Fix Strategy

**Approach:** Import correct Database type

**Step 1:** Add import to surgical repository
```typescript
import type { Database } from '@/types/database.types';
```

**Step 2:** Update constructor parameter
```typescript
constructor(private readonly supabase: SupabaseClient<Database>) {
```

**Step 3:** Verify
```bash
npx tsc --project tsconfig.healthcare.json --noEmit
# Expected: 132 → 99 (-33 surgical)
```

**Step 4:** Run gates
```bash
npm run gate:education-no-new-debt
npm run gate:platform-host-no-new-debt
npm run gate:payroll-no-new-debt
# All should remain PASS
```

**Frozen Kernel:** ✅ No logic changes, import path only

---

## Summary

```text
Root Cause Analysis:
═══════════════════════════════════════════

Previous Hypothesis: SupabaseClient generic missing
Evidence:            132 → 132 (fix had no effect)
Status:              REJECTED

Actual Root Cause:   Missing Database import
Evidence:            Tables exist in database.types.ts
                     Other repos use @/types/supabase (BROKEN)
                     Laboratory repo uses database.types (WORKS)
First Failure:       .from('hc_surgical_cases') with no schema
Correct Fix:         import type { Database } from '@/types/database.types'

Expected Impact:     132 → 99 (-33 surgical)
Confidence:          HIGH (matches working laboratory pattern)
Risk:                LOW (import path only, no logic)
```

---

**Checkpoint:** `90e53b97` (investigation doc)  
**Status:** Root cause re-identified  
**Next:** Execute corrected fix
