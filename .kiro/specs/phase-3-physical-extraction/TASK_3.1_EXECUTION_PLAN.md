# Task 3.1 Execution Plan: Extract Authentication Services

**Task ID**: 3.1  
**Wave**: 2 - Core Services  
**Status**: Planning  
**Risk Level**: HIGH (Auth is critical, must preserve all behavior)

---

## Objective

Extract authentication guard services to `src/core/services/auth/` while preserving 100% of existing behavior, RLS policies, session handling, and permission rules.

**What We're Doing**:
- Moving auth files to core directory
- Updating import paths
- Adding TenantContext signatures where beneficial (optional, not required)

**What We're NOT Doing** (Critical Constraints):
- ❌ NO changes to auth business logic
- ❌ NO changes to permission rules
- ❌ NO changes to RLS behavior
- ❌ NO changes to session handling
- ❌ NO changes to login/logout flows
- ❌ NO changes to role validation logic

---

## Current State Analysis

### Existing Auth Files

**Primary Auth Service**:
- `src/services/auth-guards.ts` - Main authentication guard functions

**Dependencies**:
- Imports `getCurrentUser` from `@/services/user-actions`
- Uses `CurrentUser` type from `@/types/domain`

**Public API** (Must remain unchanged):
```typescript
// Exported functions (must preserve exact signatures)
export function normalizeAuthRole(role: string | null | undefined): string
export function isRoleAllowed(role: string | null | undefined, allowedRoles?: readonly string[]): boolean
export async function getAuthorizedTenantUser(options?: { allowedRoles?: readonly string[]; errorMessage?: string }): Promise<AuthorizedTenantUserResult>

// Exported types (must preserve)
export type AuthorizedTenantUserResult = ...
```

### Current Consumers

**Direct Imports** (2 files):
1. `src/services/marketing/meta-ads.ts`
2. `src/modules/hr-salary/actions/admin-salary-actions.ts`

**Test Files** (4 files):
1. `src/__tests__/auth-guards.test.ts` - Main unit tests
2. `src/__tests__/booking-resource-actions.test.ts` - Mocks auth-guards
3. `src/__tests__/package-actions.test.ts` - Mocks auth-guards
4. `src/__tests__/training-actions.test.ts` - Mocks auth-guards

### Test Coverage

**Existing Tests in `auth-guards.test.ts`**:
- ✅ Role normalization (`normalizeAuthRole`)
- ✅ Role validation (`isRoleAllowed`)
- ✅ UNAUTHENTICATED result when user/tenant missing
- ✅ FORBIDDEN result when role not allowed
- ✅ Authorized result with tenant-scoped user and normalized role

**Total**: 4 test scenarios covering all public functions

---

## Execution Plan

### Phase 1: File Move (No Code Changes)

**Actions**:
1. Create `src/core/services/auth/` directory
2. Move `src/services/auth-guards.ts` → `src/core/services/auth/guards.ts`
3. Create `src/core/services/auth/index.ts` barrel export

**New Structure**:
```
src/core/services/auth/
├── guards.ts          # Moved from src/services/auth-guards.ts (NO CODE CHANGES)
└── index.ts           # Barrel export (re-exports everything from guards.ts)
```

**Rationale for Rename**:
- `auth-guards.ts` → `guards.ts`: More modular naming (inside auth/ directory)
- Barrel export maintains clean import paths

### Phase 2: Update Import Paths (Consumers)

**Files to Update** (2 production files):
1. `src/services/marketing/meta-ads.ts`
   - Change: `@/services/auth-guards` → `@/core/services/auth`
   
2. `src/modules/hr-salary/actions/admin-salary-actions.ts`
   - Change: `@/services/auth-guards` → `@/core/services/auth`

**Files to Update** (4 test files):
1. `src/__tests__/auth-guards.test.ts`
   - Change: `../services/auth-guards` → `@/core/services/auth`
   
2. `src/__tests__/booking-resource-actions.test.ts`
   - Change mock: `@/services/auth-guards` → `@/core/services/auth`
   
3. `src/__tests__/package-actions.test.ts`
   - Change mock: `../services/auth-guards` → `@/core/services/auth`
   
4. `src/__tests__/training-actions.test.ts`
   - Change mock: `@/services/auth-guards` → `@/core/services/auth`

**Total**: 6 files to update (2 production + 4 test)

### Phase 3: TenantContext Integration (Optional Enhancement)

**Decision**: **SKIP FOR NOW**

**Rationale**:
- Current auth functions work perfectly without TenantContext
- `getAuthorizedTenantUser` already returns `tenantId` in result
- Adding TenantContext would require:
  - Changing function signatures (risky)
  - Updating all 6 consumer files (more risk)
  - Testing new signatures (more work)
- **Wave 2 Goal**: Extract to core, not refactor behavior

**Future Enhancement** (Wave 4+):
- Consider adding `withTenantContext` wrapper middleware
- Add TenantContext-aware helper functions
- But keep current functions unchanged for backward compatibility

---

## Verification Steps

### 1. Build Verification

**Command**: `npm run build`

**Expected**: 
- ✅ TypeScript compilation succeeds
- ✅ Zero type errors
- ✅ All imports resolve correctly

### 2. Test Verification

**Command**: `npm test -- --testPathPattern="auth-guards"`

**Expected**:
- ✅ All 4 auth-guards tests pass
- ✅ Test: Role normalization works
- ✅ Test: Role validation works
- ✅ Test: UNAUTHENTICATED result correct
- ✅ Test: FORBIDDEN result correct
- ✅ Test: Authorized result correct

**Additional Tests**:
- Run tests that mock auth-guards (booking-resource, package, training)
- Verify mocks still work with new import path

### 3. Manual Verification

**Scenarios**:
1. ✅ Admin can access admin routes
2. ✅ KTV cannot access admin routes (403 Forbidden)
3. ✅ Unauthenticated user cannot access protected routes (401)
4. ✅ Tenant isolation: User can only access their tenant's data

### 4. Diff Summary Report

**Expected Changes**:
- **Files Moved**: 1 file (`auth-guards.ts` → `auth/guards.ts`)
- **Files Created**: 1 file (`auth/index.ts` barrel export)
- **Files Modified**: 6 files (import path updates only)
- **Lines Changed**: ~12 lines (6 import statements × 2 lines each)
- **Code Logic Changes**: 0 (zero)
- **Behavior Changes**: 0 (zero)

---

## Risk Assessment

### High-Risk Areas

**1. Import Path Updates**
- **Risk**: Typo in import path breaks production
- **Mitigation**: TypeScript will catch at compile time
- **Verification**: `npm run build` must pass

**2. Test Mock Updates**
- **Risk**: Mock path wrong, tests fail
- **Mitigation**: Run tests immediately after change
- **Verification**: All auth-related tests must pass

**3. Barrel Export**
- **Risk**: Missing exports break consumers
- **Mitigation**: Export everything from guards.ts
- **Verification**: No TypeScript errors in consumers

### Low-Risk Areas

**1. Auth Logic**
- **Risk**: NONE (no changes)
- **Reason**: We're not touching the logic at all

**2. Session Handling**
- **Risk**: NONE (no changes)
- **Reason**: Auth functions still use same `getCurrentUser`

**3. RLS Policies**
- **Risk**: NONE (no changes)
- **Reason**: Database policies unchanged

---

## Rollback Plan

If any issues detected:

1. **Immediate Rollback**:
   ```bash
   git checkout HEAD -- src/core/services/auth/
   git checkout HEAD -- src/services/auth-guards.ts
   git checkout HEAD -- [modified consumer files]
   ```

2. **Verification**:
   - Run `npm run build`
   - Run `npm test`
   - Confirm all tests pass

3. **Re-analysis**:
   - Review what went wrong
   - Update execution plan
   - Try again with fixes

---

## Success Criteria

Task 3.1 is COMPLETE when:

- ✅ `src/core/services/auth/guards.ts` exists with moved code
- ✅ `src/core/services/auth/index.ts` barrel export exists
- ✅ `src/services/auth-guards.ts` deleted (old location)
- ✅ All 6 consumer files use new import path `@/core/services/auth`
- ✅ `npm run build` succeeds with zero errors
- ✅ All auth-guards tests pass (4/4)
- ✅ All tests that mock auth-guards still pass
- ✅ Zero code logic changes (verified by git diff)
- ✅ Zero behavior changes (verified by tests)

**After Success**:
- Present detailed report to user
- Wait for user approval
- Only then proceed to Task 3.2 (if applicable) or Task 4.1

---

## Detailed File Changes

### File 1: `src/core/services/auth/guards.ts` (MOVED, NO CHANGES)

**Action**: Move from `src/services/auth-guards.ts`

**Changes**: NONE - Exact copy of original file

```typescript
// File contents remain 100% identical to original
// Only location changes: src/services/auth-guards.ts → src/core/services/auth/guards.ts
```

### File 2: `src/core/services/auth/index.ts` (NEW)

**Action**: Create barrel export

```typescript
/**
 * Core authentication services.
 * 
 * @module core/services/auth
 */

export {
  normalizeAuthRole,
  isRoleAllowed,
  getAuthorizedTenantUser,
  type AuthorizedTenantUserResult,
} from './guards';
```

### File 3-8: Import Path Updates (6 files)

**Pattern**:
```typescript
// BEFORE
import { ... } from '@/services/auth-guards';

// AFTER
import { ... } from '@/core/services/auth';
```

**Files**:
1. `src/services/marketing/meta-ads.ts` - Line 8
2. `src/modules/hr-salary/actions/admin-salary-actions.ts` - Line 5
3. `src/__tests__/auth-guards.test.ts` - Line 11
4. `src/__tests__/booking-resource-actions.test.ts` - Line 14
5. `src/__tests__/package-actions.test.ts` - Line 27
6. `src/__tests__/training-actions.test.ts` - Line 9

---

## Execution Timeline

**Estimated Duration**: 10-15 minutes

1. **File Move** (2 min): Create directory, move file, create barrel
2. **Import Updates** (5 min): Update 6 import statements
3. **Build Verification** (1 min): `npm run build`
4. **Test Verification** (2 min): `npm test -- auth-guards`
5. **Report Generation** (3 min): Git diff summary, test results
6. **User Review**: Wait for approval

**Total**: ~15 minutes + user review time

---

## Post-Execution Report Template

```markdown
# Task 3.1 Execution Report

## Summary
- ✅ Auth services extracted to src/core/services/auth/
- ✅ All imports updated to new path
- ✅ Zero code logic changes
- ✅ Zero behavior changes

## Files Changed

### Moved
- `src/services/auth-guards.ts` → `src/core/services/auth/guards.ts`

### Created
- `src/core/services/auth/index.ts` (barrel export)

### Modified (Import Updates Only)
1. `src/services/marketing/meta-ads.ts`
2. `src/modules/hr-salary/actions/admin-salary-actions.ts`
3. `src/__tests__/auth-guards.test.ts`
4. `src/__tests__/booking-resource-actions.test.ts`
5. `src/__tests__/package-actions.test.ts`
6. `src/__tests__/training-actions.test.ts`

## Build Result
```
✅ npm run build
[build output]
```

## Test Results
```
✅ npm test -- auth-guards
[test output showing 4/4 tests passing]
```

## Git Diff Summary
```
 src/core/services/auth/guards.ts              | [copied from src/services/auth-guards.ts]
 src/core/services/auth/index.ts               | 11 +++++++++++
 src/services/auth-guards.ts                   | [deleted]
 src/services/marketing/meta-ads.ts            | 2 +-
 src/modules/hr-salary/actions/admin-salary... | 2 +-
 src/__tests__/auth-guards.test.ts             | 2 +-
 src/__tests__/booking-resource-actions.test.ts| 2 +-
 src/__tests__/package-actions.test.ts         | 2 +-
 src/__tests__/training-actions.test.ts        | 2 +-
 8 files changed, XX insertions(+), XX deletions(-)
```

## Code Logic Changes
- ✅ ZERO logic changes (verified by reviewing guards.ts diff)

## Behavior Changes
- ✅ ZERO behavior changes (verified by tests passing)

## Ready for Next Task
- ✅ Task 3.1 complete, awaiting user approval
- ⏳ Task 3.2 or 4.1 ready to begin after approval
```

---

**Execution Plan Status**: ✅ READY FOR EXECUTION  
**Approval Required**: YES (from user)  
**Proceed**: AWAITING USER CONFIRMATION
