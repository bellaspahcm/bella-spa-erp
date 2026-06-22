# Week 2 Module 5: Permissions Migration - CTO Review Required

**Date**: 2026-06-19  
**Status**: ⚠️ AWAITING CTO APPROVAL  
**Risk Level**: 🔴 7/10 (HIGHEST RISK IN WEEK 2)  
**Module**: permissions (authorization logic)

---

## Executive Summary

Module 5 (permissions) has been migrated using the **re-export strategy** to maintain backward compatibility while enabling mobile code sharing. All automated tests pass, but **CTO approval is required before commit** due to the critical nature of authorization logic.

---

## What Was Changed

### 1. Re-exported Shared Functions from @bella/shared

**File**: `src/lib/business-rules/permissions.ts`

**Before** (inline definitions):
```typescript
export type RolePermissions = Record<string, boolean>;

const ADMIN_ROLES = new Set(['admin', 'super_admin']);

export const SIDEBAR_MODULE_BY_LABEL: Record<string, string> = {
  Dashboard: 'dashboard',
  'AI Copilot': 'ai_copilot',
  // ... 19 modules total
};

export function isAdminRole(role: string | null | undefined) {
  return ADMIN_ROLES.has(normalizeRole(role));
}

export function isSidebarItemAllowed(...) { /* implementation */ }
```

**After** (re-exports from @bella/shared):
```typescript
// Re-export shared permission helpers from @bella/shared
export type { RolePermissions } from '@bella/shared';
export {
  isAdminRole,
  SIDEBAR_MODULE_BY_LABEL,
  resolveSidebarModuleId,
  isSidebarItemAllowed,
} from '@bella/shared';

// Web-specific permission functions below
const AI_COPILOT_ROLES = new Set(['admin', 'super_admin', 'accountant']);

function normalizeRole(role: string | null | undefined) {
  return role?.trim().toLowerCase() || '';
}

export function canUseAiCopilotRole(...) { /* web-only */ }
export function canAccessAiCopilot(...) { /* web-only */ }
export function isManualPermittedByRole(...) { /* web-only */ }
```

**Removed lines**: 127 lines (duplicate definitions)  
**Added lines**: 9 lines (re-export statements)

---

### 2. Updated Test to Use Runtime Check

**File**: `src/__tests__/meta-ads-ui.test.ts`

**Before** (source code string check):
```typescript
const permissionsSource = read('src/lib/business-rules/permissions.ts');
expect(permissionsSource).toContain("'Meta Ads': 'marketing_ads'");
```

**After** (runtime export check):
```typescript
const { SIDEBAR_MODULE_BY_LABEL } = require('../lib/business-rules/permissions');
expect(SIDEBAR_MODULE_BY_LABEL['Meta Ads']).toBe('marketing_ads');
```

**Rationale**: After re-export, SIDEBAR_MODULE_BY_LABEL is no longer visible in source code text, but the export is still correct. Runtime check is more robust.

---

## Impact Analysis

### ✅ What STILL Works (Backward Compatible)

1. **All existing imports continue to work**:
   ```typescript
   import { isAdminRole, SIDEBAR_MODULE_BY_LABEL } from '@/lib/business-rules/permissions';
   // ✅ Still works - re-exported from @bella/shared
   ```

2. **All permission checks function identically**:
   - Admin role detection: ✅ `isAdminRole('admin')` → `true`
   - Sidebar filtering: ✅ `isSidebarItemAllowed({ role: 'ktv', label: 'Tài chính' })` → `false`
   - Module mapping: ✅ `SIDEBAR_MODULE_BY_LABEL['Meta Ads']` → `'marketing_ads'`

3. **Web-specific functions unchanged**:
   - `canUseAiCopilotRole()` - AI Copilot access control
   - `canAccessAiCopilot()` - Tenant-scoped AI access
   - `isManualPermittedByRole()` - User manual permissions

### ✅ What CHANGED (Improved)

1. **Code deduplication**: Removed 127 lines of duplicate permission definitions
2. **Single source of truth**: `@bella/shared` is now the canonical source for shared permissions
3. **Mobile app enabled**: Mobile can now import permissions from `@bella/shared`

### ⚠️ Critical Areas to Review

1. **Authorization Logic**:
   - Admin detection (affects all admin-only features)
   - Sidebar visibility (affects navigation for Admin/Manager/Staff/KTV)
   - Module access control (affects feature access by role)

2. **Role-Based Access Control (RBAC)**:
   - 4 roles affected: Admin, Manager, Staff, KTV
   - 19 sidebar modules with role-based visibility rules
   - Default denied modules per role (ktv: 11 modules, ktv_lead: 13 modules, etc.)

3. **Security Boundaries**:
   - RLS enforcement (not modified, but depends on role detection)
   - Tenant isolation (not modified, but depends on role detection)
   - Permission matrix (not modified, but depends on sidebar filtering)

---

## Verification Results

### ✅ Build
```
✓ Compiled successfully in 12.0s
✓ TypeScript check PASS
```

### ✅ Critical Test Suite
```
Test Suites: 17 passed, 17 total
Tests:       181 passed, 181 total
```

**Passing tests include**:
- `auth-guards.test.ts` - Role-based route protection ✓
- `tenant-actions.test.ts` - Tenant isolation ✓
- `meta-ads-ui.test.ts` - Permissions export verification ✓

### ⚠️ Manual Smoke Test Required

According to investigation document, Module 5 requires **extended smoke test** for all 4 roles:

#### Admin Role Checklist
- [ ] Sees all sidebar modules
- [ ] Can access Settings page
- [ ] Can access Finance/Accounting pages
- [ ] Can access System Monitor
- [ ] Can edit/delete all records
- [ ] Can approve salary/expenses

#### Manager Role Checklist
- [ ] Sees branch-scoped sidebar modules
- [ ] Cannot access HQ dashboard
- [ ] Can approve within branch
- [ ] Sidebar correctly filtered

#### Staff Role Checklist
- [ ] Cannot edit salary records
- [ ] Cannot delete bookings
- [ ] Limited sidebar modules visible
- [ ] Correct permission boundaries

#### KTV Role Checklist
- [ ] Only sees own schedule/salary
- [ ] Cannot access admin features
- [ ] Sidebar shows KTV modules only
- [ ] Finance/Settings hidden

### ⚠️ RLS Enforcement Check Required

- [ ] Query returns only authorized rows (admin sees all, staff sees branch, ktv sees own)
- [ ] Cross-tenant isolation intact
- [ ] Permission denials logged in audit table

---

## Risk Assessment

### Risk Level: 7/10 (HIGHEST)

**Why this is the highest risk module**:

1. **Authorization impact**: Bugs in permission logic can expose unauthorized data
2. **Security boundary**: Incorrect role detection could bypass RLS
3. **Cross-cutting concern**: Permissions affect every feature (booking, salary, finance, etc.)
4. **4 roles × 19 modules**: Large permission matrix = high surface area for bugs

### Mitigation Factors (Why Risk is Acceptable)

1. **Backward compatible**: Re-export strategy preserves all existing behavior
2. **No logic changes**: Functions are imported, not rewritten
3. **Test coverage**: All existing permission tests pass
4. **Rollback ready**: < 2 minutes to revert to `mobile-week2-types-migrated` tag

---

## Rollback Procedure

If CTO identifies issues during review:

### Option 1: Immediate Rollback (< 2 minutes)
```bash
git checkout mobile-week2-types-migrated
npm ci
npm run build
npm run test:critical
```

### Option 2: Revert Commit (if already committed)
```bash
git revert HEAD
git push origin main
npm ci
npm run build
npm run test:critical
```

---

## CTO Review Questions

1. **Authorization Correctness**: Are you comfortable with re-exporting core permission functions from `@bella/shared`?

2. **Security Boundaries**: Do you want additional verification of RLS enforcement after this change?

3. **Manual Testing**: Should we perform extended smoke test with all 4 roles before committing?

4. **Code Review**: Should we review the diff of `src/lib/business-rules/permissions.ts` line-by-line?

5. **Production Deployment**: Should this be deployed separately from other Week 2 changes?

---

## Recommendation

**AI Agent Recommendation**: ✅ **APPROVE WITH MANUAL VERIFICATION**

**Rationale**:
1. Strategy is conservative (re-export, not move)
2. All automated tests pass
3. No logic changes to permission functions
4. Rollback is fast and safe

**Condition**:
- Require manual smoke test with at least 2 roles (Admin + KTV) before production deployment
- Consider deploying during low-traffic window
- Monitor audit logs for permission denials after deployment

---

## Next Steps (Pending CTO Approval)

If **APPROVED**:
1. Commit changes with detailed message
2. Tag: `mobile-week2-permissions-migrated`
3. Push to origin/main
4. Mark Module 5 complete
5. Week 2 migration COMPLETE (5/5 modules)

If **REJECTED** or **NEEDS CHANGES**:
1. Revert changes
2. Address CTO feedback
3. Re-submit for review

---

## Sign-Off

**AI Agent**: Kiro (completed migration, awaiting approval)  
**Date**: 2026-06-19  
**CTO Approval**: _______________ Date: _______  

**CTO Decision**:
- [ ] APPROVED - Proceed with commit
- [ ] APPROVED WITH CONDITIONS - Manual test required first
- [ ] REJECTED - Revert and use different approach
- [ ] NEEDS CHANGES - Address feedback below

**CTO Feedback** (if any):

```


```

---

## Appendix: Files Modified

1. `src/lib/business-rules/permissions.ts` (re-exports added, 118 lines net reduction)
2. `src/__tests__/meta-ads-ui.test.ts` (test updated to use runtime check)

**Total impact**: 2 files, 120 lines changed
