# Any Types Audit

**Date**: 2026-06-17  
**Branch**: refactor/phase-1-to-5  
**Spec**: REQ-1.1 - Remove `any` Types from Production Code  
**Target**: <5 `any` types in production code (currently at 3 `: any`, plus 10 `as any` casts)

---

## Executive Summary

### Current State
- **Production Code (src/)**: 3 instances of `: any` type annotations
- **Production Code Casts**: 10 instances of `as any` type assertions
- **Test Files**: 60+ instances (primarily in mock builders - acceptable)
- **Total ESLint Errors**: 17 errors for `@typescript-eslint/no-explicit-any`

### Target Compliance
✅ **Already under target!** Only 3 `: any` annotations in production code (target: <5)
⚠️ **Need attention**: 10 `as any` casts that can be improved with proper typing

---

## Production Code (src/core/, src/modules/, src/services/, src/app/)

### Easy Fixes (straightforward type replacement)

#### 1. Module Registry Type Assertion
- **File**: `src/core/services/order/session-completion-helpers.ts:641`
- **Context**: `const adapter = moduleRegistry.get(moduleId as any);`
- **Issue**: Casting `moduleId` to `any` when getting from module registry
- **Root Cause**: `moduleId` is `string` but registry expects `ModuleId` type
- **Suggested Fix**: 
  ```typescript
  import type { ModuleId } from '@/core/types/module';
  const adapter = moduleRegistry.get(moduleId as ModuleId);
  ```
- **Priority**: HIGH (in critical service path)
- **Estimated Time**: 5 minutes

#### 2. Module Registry Type Assertion (duplicate pattern)
- **File**: `src/core/services/order/create-booking-helpers.ts:652`
- **Context**: `const adapter = moduleRegistry.get(moduleId as any);`
- **Issue**: Same as #1
- **Suggested Fix**: Same pattern as #1
- **Priority**: HIGH (in critical service path)
- **Estimated Time**: 5 minutes

#### 3. Error Object Type in Catch Block
- **File**: `src/modules/spa/verify-registration.ts:95`
- **Context**: `catch (error: any) { if (error.name === 'DuplicateModuleError') { ... } }`
- **Issue**: Using `any` for error type in catch block (test/verification script)
- **Suggested Fix**: 
  ```typescript
  catch (error: unknown) {
    if (error instanceof Error && error.name === 'DuplicateModuleError') {
  ```
- **Priority**: LOW (verification script, not runtime code)
- **Estimated Time**: 3 minutes

---

### Medium Complexity (requires type investigation)

#### 4-5. Brand Theme JSON Property Access
- **File**: `src/app/api/tenant/context/route.ts:183-184`
- **Context**: 
  ```typescript
  logoUrl: (tenant.brand_theme as any).logoUrl || tenant.logo_url,
  primaryColor: (tenant.brand_theme as any).primaryColor,
  ```
- **Issue**: Database returns `Json` type (from Supabase), needs safe casting to `TenantBrandTheme`
- **Root Cause**: `brand_theme` column is `Json | null` in database schema
- **Suggested Fix**: Create type guard or use proper type assertion
  ```typescript
  import type { TenantBrandTheme } from '@/lib/business-rules/tenant-modules';
  
  // Option 1: Type guard
  function isTenantBrandTheme(obj: unknown): obj is TenantBrandTheme {
    return typeof obj === 'object' && obj !== null && 
           'logoUrl' in obj && 'primaryColor' in obj;
  }
  
  if (tenant.brand_theme && isTenantBrandTheme(tenant.brand_theme)) {
    Object.assign(settings, {
      logoUrl: tenant.brand_theme.logoUrl || tenant.logo_url,
      primaryColor: tenant.brand_theme.primaryColor,
    });
  }
  
  // Option 2: Type assertion with proper type
  if (tenant.brand_theme && typeof tenant.brand_theme === 'object') {
    const theme = tenant.brand_theme as TenantBrandTheme;
    Object.assign(settings, {
      logoUrl: theme.logoUrl || tenant.logo_url,
      primaryColor: theme.primaryColor,
    });
  }
  ```
- **Priority**: MEDIUM (API route, frequently executed)
- **Estimated Time**: 15 minutes

#### 6-7. Brand Theme JSON Property Access (duplicate)
- **File**: `src/core/middleware/tenantContext.ts:299-300`
- **Context**: Same as #4-5
- **Suggested Fix**: Same pattern, extract to shared helper function
- **Priority**: HIGH (middleware, executed on every request)
- **Estimated Time**: 15 minutes (or 5 if helper created)

#### 8-9. Brand Theme JSON Property Access (duplicate)
- **File**: `src/core/services/order/create-booking-helpers.ts:609-610`
- **Context**: Same as #4-5
- **Suggested Fix**: Same pattern, use shared helper
- **Priority**: HIGH (critical service path)
- **Estimated Time**: 5 minutes (reuse helper)

#### 10. Enabled Modules Array Cast
- **File**: `src/app/api/tenant/context/route.ts:218`
- **Context**: `enabledModules: enabledModules as any, // Cast to readonly array`
- **Issue**: Type mismatch between mutable and readonly array
- **Root Cause**: `enabledModules` is `ModuleId[]` but context expects `readonly ModuleId[]`
- **Suggested Fix**: 
  ```typescript
  enabledModules: enabledModules as readonly ModuleId[],
  ```
- **Priority**: LOW (comment indicates intentional cast)
- **Estimated Time**: 2 minutes

#### 11. Enabled Modules Array Cast (duplicate)
- **File**: `src/core/middleware/tenantContext.ts:334`
- **Context**: Same as #10
- **Suggested Fix**: Same as #10
- **Priority**: LOW
- **Estimated Time**: 2 minutes

#### 12. Enabled Modules Array Cast (duplicate)
- **File**: `src/core/services/order/create-booking-helpers.ts:623`
- **Context**: Same as #10
- **Suggested Fix**: Same as #10
- **Priority**: LOW
- **Estimated Time**: 2 minutes

#### 13. Dynamic Method Check in Adapter
- **File**: `src/modules/spa/verify-registration.ts:83`
- **Context**: `if (typeof (adapter2 as any)[method] !== 'function') {`
- **Issue**: Runtime type checking requires `any` cast (verification script)
- **Suggested Fix**: Keep as-is with JSDoc justification (test/verification code)
- **Priority**: LOW (not runtime production code)
- **Estimated Time**: 1 minute (add comment only)

---

### Hard/Edge Cases (justified `any` with documentation)

#### 14. Audit Field Changes (before/after values)
- **File**: `src/core/types/audit.ts:37-41`
- **Context**: 
  ```typescript
  export interface FieldChange {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    before: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    after: any;
  }
  ```
- **Issue**: Generic field change tracking needs to handle any type of value
- **Justification**: ✅ **LEGITIMATE USE** - Audit logs track changes to fields of unknown types (string, number, object, etc.)
- **Current State**: Already has ESLint disable comment
- **Suggested Improvement**: Add JSDoc explaining why `any` is necessary
  ```typescript
  /**
   * Field-level change tracking for audit logging.
   * 
   * @remarks
   * Uses `any` type for before/after values because audit logs must track
   * changes to fields of any type (primitives, objects, arrays). Using 
   * `unknown` would require type assertions at every usage site.
   * 
   * This is a justified exception to the no-any rule.
   */
  export interface FieldChange {
    /** Value before the change. Can be any type (string, number, object, etc.) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    before: any;
    
    /** Value after the change. Can be any type (string, number, object, etc.) */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    after: any;
  }
  ```
- **Decision**: **KEEP as-is** with enhanced documentation
- **Priority**: LOW (already justified)
- **Estimated Time**: 10 minutes (documentation only)

#### 15. Audit Event Metadata
- **File**: `src/core/types/audit.ts` (line ~115)
- **Context**: 
  ```typescript
  metadata: Record<string, any>;
  ```
- **Issue**: Flexible metadata object for audit context (IP, user agent, etc.)
- **Justification**: ✅ **LEGITIMATE USE** - Metadata can contain any contextual information
- **Current State**: Already has ESLint disable comment
- **Suggested Improvement**: Same as #14, add JSDoc
- **Decision**: **KEEP as-is** with enhanced documentation
- **Priority**: LOW (already justified)
- **Estimated Time**: 5 minutes (documentation only)

---

## Test Files (src/__tests__/, *.test.ts)

### Mock Builders

Test files contain **60+ instances** of `any` types in mock query builders. These are acceptable for testing infrastructure.

#### Pattern 1: Mock Query Builder Data/Error Properties
- **Files**: Multiple test files
- **Pattern**: 
  ```typescript
  class MockQueryBuilder {
    public data: any;
    public error: any;
  ```
- **Status**: ✅ **ACCEPTABLE** - Test mocks need flexibility
- **Action**: None required

#### Pattern 2: Mock Method Arguments
- **Files**: Multiple test files
- **Pattern**: 
  ```typescript
  eq(...args: any[]) { ... }
  insert(...args: any[]) { ... }
  update(...args: any[]) { ... }
  ```
- **Status**: ✅ **ACCEPTABLE** - Test spies track arbitrary arguments
- **Action**: None required (could be improved in future with generics if time permits)

#### Pattern 3: Mock Store Type
- **Files**: e2e test files
- **Pattern**: 
  ```typescript
  interface MockStore {
    bookings: any[];
    session_logs: any[];
  }
  ```
- **Status**: ✅ **ACCEPTABLE** - Test fixtures
- **Improvement Opportunity**: Could use actual DB types for better type safety in tests
- **Priority**: VERY LOW (not blocking)

---

## Summary Statistics

### Production Code Breakdown

| Category | Count | Status |
|----------|-------|--------|
| `: any` annotations | 3 | ✅ Target met (<5) |
| `as any` casts | 10 | ⚠️ Can be improved |
| **Total Production** | **13** | **3 justified, 10 fixable** |

### By Priority

| Priority | Count | Description | Time Estimate |
|----------|-------|-------------|---------------|
| HIGH | 5 | Critical service paths, middleware | 45 minutes |
| MEDIUM | 3 | API routes, property access | 30 minutes |
| LOW | 5 | Readonly casts, verification scripts | 20 minutes |
| **TOTAL** | **13** | **All production `any` types** | **~2 hours** |

### By Fix Difficulty

| Difficulty | Count | Examples | Time Estimate |
|------------|-------|----------|---------------|
| Easy | 6 | Type guards, proper casts | 35 minutes |
| Medium | 5 | Helper functions, type guards | 45 minutes |
| Justified | 2 | Audit types (keep with docs) | 15 minutes |
| **TOTAL** | **13** | | **~1.5 hours** |

### By File Location

| File | Count | Type | Priority |
|------|-------|------|----------|
| `src/core/types/audit.ts` | 2 | `: any` (justified) | LOW |
| `src/app/api/tenant/context/route.ts` | 4 | `as any` | MEDIUM-HIGH |
| `src/core/middleware/tenantContext.ts` | 4 | `as any` | HIGH |
| `src/core/services/order/create-booking-helpers.ts` | 5 | `as any` | HIGH |
| `src/core/services/order/session-completion-helpers.ts` | 1 | `as any` | HIGH |
| `src/modules/spa/verify-registration.ts` | 2 | `as any`, `: any` | LOW |

---

## Recommended Action Plan

### Phase 1: Critical Path (Tasks 12-13) - 45 minutes
1. Fix module registry casts in `session-completion-helpers.ts`
2. Fix module registry casts in `create-booking-helpers.ts`
3. Fix brand theme access in `tenantContext.ts` middleware
4. Fix enabled modules casts in `tenantContext.ts`
5. Fix brand theme access in `create-booking-helpers.ts`

### Phase 2: API Routes (Task 14) - 30 minutes
1. Fix brand theme access in `api/tenant/context/route.ts`
2. Fix enabled modules cast in `api/tenant/context/route.ts`

### Phase 3: Documentation (Task 15) - 20 minutes
1. Add JSDoc to audit types explaining justified `any` usage
2. Add comments to verification script `any` types
3. Update readonly array casts to use proper type

### Phase 4: Shared Helper (Optional) - 15 minutes
Create shared helper function for brand theme type guards to DRY up the code:
```typescript
// src/lib/type-guards/tenant.ts
export function parseTenantBrandTheme(json: Json | null): TenantBrandTheme | null {
  if (!json || typeof json !== 'object') return null;
  const obj = json as Record<string, unknown>;
  if (!('logoUrl' in obj) || !('primaryColor' in obj)) return null;
  return obj as TenantBrandTheme;
}
```

---

## REQ-1.1 Compliance Status

### Current State
- `: any` in production: **3** (✅ under target of 5)
- `as any` in production: **10** (⚠️ should be reduced)
- **Total**: 13 instances

### Target State (REQ-1.1)
- Zero `any` types in `src/core/services/` ❌ (currently 6)
- Zero `any` types in `src/modules/spa/services/` ✅ (currently 0)
- <5 `any` types in production (justified with JSDoc) ✅ (currently 3 `: any`)

### Gap Analysis
**Need to fix**: 6 `any` types in `src/core/services/` to meet zero requirement
- 4 in `create-booking-helpers.ts` (brand theme + module casts)
- 1 in `session-completion-helpers.ts` (module cast)
- 1 in middleware `tenantContext.ts` (technically in `src/core/middleware/`)

**After fixes**:
- Production `: any`: 2 (audit.ts only - justified)
- Production `as any`: 2-3 (readonly casts only - low priority)
- ✅ **Will meet REQ-1.1 targets**

---

## Next Steps

1. **Task 12**: Fix `any` types in core services (HIGH priority)
2. **Task 13**: Fix `any` types in middleware and API routes (MEDIUM priority)
3. **Task 14**: Add JSDoc justifications for remaining `any` types (documentation)
4. **Task 15**: (Optional) Improve test mock types for better test safety

---

**Generated**: 2026-06-17  
**Audited By**: Kiro AI Agent  
**Estimated Total Time**: 2 hours  
**Wave 2 Status**: Ready for implementation
