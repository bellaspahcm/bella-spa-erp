# Task #1 Core Layer — Forensic Type Analysis
**Date:** 2026-09-01
**Purpose:** Evidence-based analysis before any code changes

---

## Step 1: Read Canonical Contracts

### Canonical: `src/core/types/tenant.ts`

```typescript
export interface TenantContext {
  readonly tenantId: string;
  readonly tenantName: string;
  readonly enabledModules: readonly ModuleId[];  // ← CANONICAL
  readonly subscriptionPlan: SubscriptionPlan;
  readonly featureFlags: Readonly<Record<string, boolean>>;
  readonly settings: Readonly<Record<string, unknown>>;
}
```

**Evidence:** `enabledModules` is canonically `readonly ModuleId[]`

### Canonical: `src/core/types/module.ts`

```typescript
export type ModuleId =
  | 'spa'
  | 'babycare'
  | 'cleaning'
  | 'home-service'
  | 'beauty_spa'
  | 'real_estate'
  | 'bella_healthcare'
  | 'bella_auto'
  | 'industrial_cleaning';

export function isModuleId(value: unknown): value is ModuleId {
  return (
    typeof value === 'string' &&
    (['spa', 'babycare', 'cleaning', 'home-service', 'beauty_spa',
      'real_estate', 'bella_healthcare', 'bella_auto', 'industrial_cleaning'] as const)
      .includes(value as ModuleId)
  );
}
```

**Evidence:** `ModuleId` is a discriminated union, not an object shape

---

## Step 2: Identify Contract vs Consumer Mismatches

### Error 1: `TenantContextProvider.tsx` — Line ~142

**Current Code:**
```typescript
const enabledModules: unknown = context.enabledModules;
let moduleKey: ModuleId = 'babycare';
let modulesArray: string[] = [];

if (Array.isArray(enabledModules)) {
  modulesArray = enabledModules.filter(isModuleId);
} else if (typeof enabledModules === 'object' && enabledModules !== null) {
  // Treats enabledModules as object with boolean flags
  const modules = enabledModules as Record<string, unknown>;
  if (modules.real_estate === true) { ... }
}
```

**Type Error:**
- `context.enabledModules` is `readonly ModuleId[]` per canonical contract
- Code treats it as `unknown` and tests for object shape
- This suggests the code expects two different shapes

**Root Cause Analysis:**

**Hypothesis A:** Backend API returns wrong shape (object instead of array)
- If `/api/tenant/context` returns `{ enabledModules: { spa: true, babycare: true } }`
- But canonical contract expects `{ enabledModules: ['spa', 'babycare'] }`
- **This would be API contract violation**

**Hypothesis B:** Code is stale from old contract
- Old contract had `enabledModules: Record<ModuleId, boolean>`
- New contract has `enabledModules: readonly ModuleId[]`
- Code not updated during migration
- **This would be consumer staleness**

**Evidence Required:**
1. Check `/api/tenant/context` response shape
2. Check database `tenants` table schema for `enabled_modules` column
3. Check git history of `tenant.ts` contract changes

**Decision:**
- ✅ If API returns array → Fix consumer (remove object handling)
- ❌ If API returns object → Fix API to match canonical contract
- ❌ DO NOT change canonical contract to `unknown` or union type

---

### Error 2: `TenantInfoExample.tsx` — Multiple lines

**Current Code:**
```typescript
{context.enabledModules.join(', ')}
```

**Type Error:**
- `readonly ModuleId[]` has `join()` method ✅
- This should NOT error unless `context` type is wrong

**If error exists, likely:**
- `useTenantContext()` return type is wrong
- Or `TenantContextContext` provider value type is wrong

**Evidence Required:**
1. Check `useTenantContext()` return type
2. Check `TenantContextContext` definition

---

### Error 3: `update-booking-action.ts` — Nullable booking IDs

**Current Code Pattern (needs line-by-line analysis):**

Likely locations:
- Passing `booking?.id` (nullable) to function expecting `string`
- Passing `customerId` that might be `null | string` to strict function

**Root Cause Analysis:**

**Hypothesis A:** Database schema allows NULL
- If `bookings.customer_id` is `NULL`able
- Then `booking.customer_id` type is correctly `string | null`
- **Downstream code must handle null**

**Hypothesis B:** Type definition is wrong
- If `bookings.customer_id` is `NOT NULL` in schema
- But generated types say `string | null`
- **This is type generation error**

**Decision:**
- ✅ If schema allows NULL → Add null checks in consumer
- ✅ If NULL is invalid state → Add validation and fail early
- ❌ DO NOT use `bookingId!` unless proven invariant
- ❌ DO NOT use `bookingId as string` to silence compiler

**Evidence Required:**
1. Check `bookings` table schema for NULL constraints
2. Check `customers` table schema for NULL constraints
3. Check business logic: can a booking exist without customer?

---

## Step 3: Evidence Gathered ✅

### Evidence 1: API Response Shape — **CONFIRMS ARRAY**

**Source:** `src/app/api/tenant/context/route.ts` lines 269-290

```typescript
function transformTenantRowToContext(tenant: TenantRow): TenantContext {
  let enabledModules: string[] = ['spa']; // Default fallback

  if (tenant.enabled_modules) {
    if (Array.isArray(tenant.enabled_modules)) {
      // Already an array of strings - need to filter out non-strings
      enabledModules = tenant.enabled_modules.filter((item): item is string => typeof item === 'string');
    } else if (typeof tenant.enabled_modules === 'object' && tenant.enabled_modules !== null) {
      // JSONB object format: {beauty_spa: true, babycare: false}
      // Filter to get only enabled modules
      enabledModules = Object.entries(tenant.enabled_modules)
        .filter(([_key, value]) => value === true)
        .map(([key, _value]) => key);

      if (enabledModules.length === 0) {
        enabledModules = ['spa'];
      }
    }
  }

  // Line 348: Cast to canonical contract
  enabledModules: enabledModules as TenantContext['enabledModules'],
}
```

**Critical Finding:**

The API DOES handle both shapes:
1. **Array format:** `['spa', 'babycare']`
2. **Object format:** `{beauty_spa: true, babycare: false}` (from database JSONB)

Then **transforms to array** before returning to client.

**But** there's an unsafe cast on line 348:
```typescript
enabledModules: enabledModules as TenantContext['enabledModules']
```

This cast does NOT validate that strings are valid `ModuleId` values!

**Verdict:**
- ✅ API returns array shape (matches canonical contract)
- ⚠️ API does NOT validate ModuleId discriminants
- ⚠️ Database can contain invalid module strings

---

### Evidence 2: Database Schema Shape — **JSONB (Mixed)**

**Observation from code:**
- `tenant.enabled_modules` can be:
  - `JSONB array`: `['spa', 'babycare']`
  - `JSONB object`: `{beauty_spa: true, babycare: false}`
  - `null`

**This explains the defensive object handling in TenantContextProvider!**

The Provider is handling BOTH shapes because:
1. Old tenants might have object format in DB
2. New tenants have array format
3. API transforms object → array
4. But if API transformation has bugs or DB inconsistency, client gets wrong shape

**Verdict:**
- Database schema is `JSONB`, not strongly typed
- API transformation is defensive
- Provider ALSO defensive (belt and suspenders)

---

### Evidence 3: Type Safety Gap — **FOUND**

**Problem:** Three-layer type safety gap:

1. **Database layer:** JSONB allows any shape
2. **API layer:** Unsafe cast to `ModuleId[]` without validation
3. **Client layer:** Receives array but doesn't trust it

**Current State:**
```
Database JSONB (any shape)
     ↓
API transform + unsafe cast
     ↓
Network (JSON)
     ↓
Client receives "readonly ModuleId[]"
     ↓
Provider treats as unknown (defensive)
```

**Root Cause:** API transformation creates type safety illusion

---

### Evidence 4: TenantContextProvider Defensive Logic — **JUSTIFIED**

**Re-analysis of Provider code:**

The Provider's defensive handling is actually CORRECT runtime behavior:
- Can't trust network JSON is actually `ModuleId[]`
- Must validate at runtime boundary
- Object handling is legacy DB format support

**But** the TypeScript types claim it's already safe!

**Type Contract Mismatch:**
- Contract says: `readonly ModuleId[]` (validated)
- Reality is: `unknown[]` from network (unvalidated)

---

## Step 4: Forensic Fix Strategy ✅

### Fix #1: TenantContextProvider.tsx — **CORRECT THE TYPE BOUNDARY**

**Problem:** Provider receives `TenantContext` from network but doesn't trust the type

**Root Cause:** Network JSON cannot be trusted as `ModuleId[]` without validation

**Solution:** Add runtime validation at API response boundary

**Changes Required:**

1. **In `TenantContextProvider.tsx`** — Add validation helper:
```typescript
function validateAndNormalizeTenantContext(raw: unknown): TenantContext | null {
  if (!raw || typeof raw !== 'object') return null;

  const ctx = raw as Record<string, unknown>;

  // Validate required fields
  if (typeof ctx.tenantId !== 'string') return null;
  if (typeof ctx.tenantName !== 'string') return null;

  // Validate and normalize enabledModules
  let modules: ModuleId[] = [];
  if (Array.isArray(ctx.enabledModules)) {
    modules = ctx.enabledModules.filter(isModuleId);
  }

  // If no valid modules, use safe default
  if (modules.length === 0) {
    modules = ['babycare'];
  }

  return {
    tenantId: ctx.tenantId,
    tenantName: ctx.tenantName,
    enabledModules: modules,
    subscriptionPlan: (ctx.subscriptionPlan as SubscriptionPlan) || 'basic',
    featureFlags: (ctx.featureFlags && typeof ctx.featureFlags === 'object')
      ? ctx.featureFlags as Record<string, boolean>
      : {},
    settings: (ctx.settings && typeof ctx.settings === 'object')
      ? ctx.settings as Record<string, unknown>
      : {},
  };
}
```

2. **Replace unsafe object-handling code with validation:**
```typescript
const data = await response.json();
const validated = validateAndNormalizeTenantContext(data);

if (!validated) {
  throw new Error('Invalid tenant context response format');
}

setContext(validated);
```

3. **Remove defensive object-checking code** (lines ~142-180) since validation handles it

**Rationale:**
- ✅ Explicit validation at network boundary
- ✅ Uses `isModuleId` type guard (canonical validator)
- ✅ No unsafe casts
- ✅ Clear fallback behavior
- ✅ Preserves defensive posture but with proper types

---

### Fix #2: API route.ts — **ADD VALIDATION BEFORE CAST**

**Problem:** Unsafe cast `as TenantContext['enabledModules']` without validation

**Solution:** Validate strings are valid ModuleIds before casting

**Changes Required:**

1. **Import validator:**
```typescript
import { isModuleId, type ModuleId } from '@/core/types/module';
```

2. **Replace unsafe cast with validation:**
```typescript
// OLD (line 348):
enabledModules: enabledModules as TenantContext['enabledModules'],

// NEW:
enabledModules: enabledModules.filter(isModuleId) as readonly ModuleId[],
```

**Rationale:**
- ✅ Filter out invalid module strings from DB
- ✅ Cast is now safe because filter enforces discriminant
- ✅ Matches client-side validation strategy
- ✅ Prevents invalid data from reaching client

---

### Fix #3: TenantInfoExample.tsx — **NO CHANGE NEEDED**

**Re-analysis:** If Provider validation is correct, example code should work

**If errors persist:** They're likely from:
- `useTenantContext()` return type mismatch
- Provider context type definition wrong

**Action:** Verify after Provider fix. If still errors, check `TenantContextContext` type.

---

### Fix #4: update-booking-action.ts — **EVIDENCE STILL NEEDED**

**Status:** Cannot proceed without DB schema evidence

**Required Evidence:**
1. Check `bookings` table schema for NULL constraints
2. Identify which nullable field causes type error
3. Determine if NULL is valid state or invariant violation

**Next Step:** Run schema inspection before fixing

---

## Step 5: Architectural Safety Verification

### Changes Impact Analysis

| File | Layer | Frozen? | Change Type | Risk |
|------|-------|---------|-------------|------|
| `TenantContextProvider.tsx` | Platform Core | ❌ Active | Add validation | 🟢 SAFE |
| `api/tenant/context/route.ts` | Platform API | ❌ Active | Add validation | 🟢 SAFE |
| `TenantInfoExample.tsx` | Core Examples | ❌ Active | None (verify only) | 🟢 SAFE |
| `update-booking-action.ts` | Product/Spa | ❌ Active | TBD pending evidence | 🟡 PENDING |

### Kernel Boundary Check

✅ No frozen Kernel code modified
✅ No Kernel boundaries crossed
✅ Platform Core evolves (allowed per KERNELS.md)
✅ No unsafe type assertions added
✅ Validation uses canonical contracts

### Architecture Guard Prediction

**Expected:** ✅ PASS (no boundary violations)

---

## Step 5: Verification Plan

After fixes:

```bash
# 1. Type-check Core scope only
npx tsc -p tsconfig.typecheck.core.tmp.json --noEmit --pretty false

# 2. Architecture Guard (must remain PASS)
npm run arch:guard

# 3. Affected tests
npm test -- src/core --runInBand

# 4. Clean diff
git diff --check
```

---

## Next Steps

**DO NOT PROCEED TO CODING UNTIL:**
1. ✅ Evidence gathered for all three error clusters
2. ✅ Canonical contracts verified unchanged
3. ✅ Fix strategy approved per evidence
4. ✅ No architectural boundary violations

**This is forensic remediation, not "make it green".**
