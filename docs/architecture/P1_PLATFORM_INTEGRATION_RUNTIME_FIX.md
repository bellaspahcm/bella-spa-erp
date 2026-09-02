# Platform: Integration-Runtime Type Fixes

**Date:** 2026-09-02  
**Status:** ✅ COMPLETE  
**Errors Fixed:** 36 → 0

## Summary

Fixed Integration-Runtime unit following systematic group-by-pattern approach. All 36 errors eliminated through 4 targeted fix groups, no batch casting, no `any` workarounds.

**Verification:** 2.5s PASS

## Fix Groups

### Group 1: ErrorContext Boundary (27 errors → 0)

**Root Cause:** `ErrorContext` interface missing index signature, incompatible with `Record<string, unknown>` parameter type in error constructors.

**Pattern:** All RuntimeError subclasses accept `context?: Record<string, unknown>`, but `buildErrorContext()` returns structured `ErrorContext`.

**Solution:** Added index signature to `ErrorContext` interface to allow compatibility while maintaining type safety:

```typescript
export interface ErrorContext {
  tenantId?: string;
  correlationId?: string;
  intentType?: string;
  entityId?: string;
  attempts?: number;
  timestamp: Date;
  stack?: string;
  additionalContext?: Record<string, unknown>;
  [key: string]: unknown; // Allow additional properties for compatibility
}
```

**Rationale:** 
- ErrorContext IS semantically a record with known keys + potential additional keys
- Index signature allows passing to functions expecting `Record<string, unknown>`
- Type safety preserved for known properties
- Better than casting at 15+ call sites

**Files Modified:**
- `src/platform/integration-runtime/types/runtime-errors.types.ts` (line 290)

**Errors eliminated:** 27 (all ErrorContext → Record mismatch errors across idempotency-repository, tenant-repository, idempotency-key, idempotency-manager, intent-validator, tenant-validator)

---

### Group 2: Nullability (5 errors → 0)

**Pattern:** Type mismatches between `null` and `undefined`, Supabase `PostgrestError | null` vs expected `Error | undefined`.

#### Fix 2a: outbox-repository published_at

**Error:** `Type 'null' is not assignable to type 'Date | undefined'`

**Root Cause:** `OutboxInsert` redefines `published_at` as optional `Date` (from base type `Date | null`)

**Solution:**
```typescript
const record: OutboxInsert = {
  // ...
  last_attempt_at: null,  // Kept as null (base type is Date | null)
  next_retry_at: null,    // Kept as null
  last_error: null,       // Kept as null
  published_at: undefined, // Changed to undefined (redefined as Date?)
};
```

**Files Modified:**
- `src/platform/integration-runtime/database/outbox-repository.ts` (line 49)

#### Fix 2b: quarantine-repository error handling

**Error:** `'error' is possibly 'null'`

**Solution:** Added null-safe access with fallback:
```typescript
throw new Error(`Failed to mark reviewed: ${error?.message || 'Unknown error'}`);
```

**Files Modified:**
- `src/platform/integration-runtime/database/quarantine-repository.ts` (line 173)

#### Fix 2c: tenant-repository PostgrestError handling

**Error:** `Argument of type 'PostgrestError | null' is not assignable to parameter of type 'Error | undefined'`

**Pattern:** 3 instances where Supabase error (could be null) passed to `buildErrorContext` expecting `Error | undefined`

**Solution:** Convert null to undefined: `error || undefined`

**Files Modified:**
- `src/platform/integration-runtime/database/tenant-repository.ts` (lines 67, 93, 141)

---

### Group 3: Zod Validation (2 errors → 0)

#### Fix 3a: ZodError API change

**Error:** `Property 'errors' does not exist on type 'ZodError<...>'`

**Root Cause:** Zod API changed - error object has `.issues` not `.errors`

**Solution:**
```typescript
const errors = parseResult.error?.issues || [];  // Was: .errors
```

**Files Modified:**
- `src/platform/integration-runtime/validation/intent-validator.ts` (line 68)

#### Fix 3b: Implicit any + path type

**Error:** Parameter `e` implicitly has `any` type, and ZodIssue path is `PropertyKey[]` (includes symbol)

**Solution:** Remove explicit type annotation, use `.map(String)` for path elements:
```typescript
const errorMessages = errors.map((e) => {
  const path = e.path.length > 0 ? e.path.map(String).join('.') : '';
  const message = e.message || 'Validation failed';
  return path ? `${path}: ${message}` : message;
});
```

**Files Modified:**
- `src/platform/integration-runtime/validation/intent-validator.ts` (line 71)

---

### Group 4: Zod Schema + Barrel Export (2 errors → 0)

#### Fix 4a: Zod API - .strict()

**Error:** `Expected 0 arguments, but got 1`

**Root Cause:** Zod v4 `.strict()` takes no arguments (was expecting message in earlier version)

**Solution:**
```typescript
}).strict();  // No message parameter
```

**Files Modified:**
- `src/platform/integration-runtime/types/financial-intent.types.ts` (line 122)

#### Fix 4b: Zod API - z.record()

**Error:** `Expected 2-3 arguments, but got 1`

**Root Cause:** Zod v4 `z.record()` requires explicit keyType and valueType

**Solution:**
```typescript
metadata: z.record(z.string(), z.unknown()).optional(),  // Was: z.record(z.unknown())
```

**Files Modified:**
- `src/platform/integration-runtime/types/financial-intent.types.ts` (line 120)

#### Fix 4c: Duplicate ValidationError export

**Error:** `Module './financial-intent.types' has already exported a member named 'ValidationError'`

**Root Cause:** Two `ValidationError` classes:
- `runtime-errors.types.ts:85` - canonical, extends RuntimeError, takes (message, context)
- `financial-intent.types.ts:151` - duplicate, extends Error, takes (message only)

**All usage sites** use 2-argument signature → canonical version is correct.

**Solution:**
1. Import canonical `ValidationError` from `runtime-errors.types`
2. Remove duplicate class definition
3. Fix single usage site to provide context parameter:

```typescript
import { ValidationError } from './runtime-errors.types';

// ...

throw new ValidationError(
  `Prohibited field '${field}' detected...`,
  { field, intent }  // Added context parameter
);
```

**Files Modified:**
- `src/platform/integration-runtime/types/financial-intent.types.ts` (import, removed class, fixed throw)

---

## Verification

```bash
npx tsc --noEmit --project tsconfig.platform-integration-runtime.json
Duration: 2.5s | Exit 0
✅ INTEGRATION-RUNTIME GREEN
```

## Platform Inventory Status Update

After Integration-Runtime fix:

| Status | Count | Change |
|--------|-------|--------|
| ✅ PASS | **37** | +1 (Integration-Runtime) |
| ❌ FAIL | **3** | -1 (Real-Estate, Education remain) |
| 🟠 HOTSPOT | 3 | No change (Host, Healthcare, Logistics) |

### Remaining FAIL Units
1. **Real-Estate** — 9 errors (schema drift: property names, enum values, missing table)
2. **Education** — 100 errors (large schema drift, Json types, DTO mismatches, Supabase version)

## Methodology Notes

**Why this worked:**
- Grouped errors by pattern, not by file
- Fixed root cause (ErrorContext boundary) eliminated 75% of errors (27/36)
- Each fix targeted the actual contract mismatch
- No type erasure (`any`, broad casts)
- Preserved type safety while fixing compatibility

**Pattern comparison:**
- **ErrorContext:** 1 interface change → 27 errors fixed
- **Nullability:** 5 targeted fixes at call sites (no shared abstraction to fix)
- **Zod/Barrel:** 4 API/import fixes (library version changes)

**Commit readiness:**
- ✅ Type-check PASS
- ✅ No `any` bypass
- ✅ No architecture violations
- ✅ Minimal, causal fixes
- ✅ All fixes preserve semantic correctness

## Next Steps

Per user directive:
1. ✅ Integration-Runtime fixed (36 → 0)
2. ⏭️ **Real-Estate** (9 errors - schema alignment)
3. ⏭️ **Education** (100 errors - assess scope/defer decision)
4. ⏭️ Test Modules (bella-healthcare if not HOTSPOT)
5. ⏭️ Bella Auto (7 FAIL + 5 HOTSPOT from previous checkpoint)
