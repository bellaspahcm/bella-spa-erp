# Investigation: Mobile Week 2 - Import Migration Strategy

**Created**: 2026-06-19  
**Status**: PLANNING (Week 1 Complete, Week 2 Not Started)  
**Risk Level**: 7/10 (HIGHEST risk in Phase 1)  
**Stakeholder Approval**: REQUIRED BEFORE EXECUTION

---

## Executive Summary

Week 2 will migrate web app imports from `src/` to `@bella/shared` to enable true code sharing between web and mobile apps. This is the **HIGHEST RISK** activity in Mobile Phase 1 because it touches production code that serves Beauty Spa and Bella ERP customers.

**Key Principle**: **PER-MODULE MIGRATION ONLY**. Never replace all imports at once.

---

## Import Inventory Analysis

Based on codebase analysis (2026-06-19):

| Module | Import Count | Risk Level | Migration Priority |
|--------|-------------|------------|-------------------|
| `validators` | 0* | 2/10 | **#1 (First)** |
| `constants` | 8 | 2/10 | **#2** |
| `utils` | 124 | 3/10 | **#3** |
| `types` | 190 | 5/10 | **#4** |
| `permissions` | 0* | 7/10 | **#5 (Last)** |

\* Not currently imported separately, but exported from `@bella/shared`. Will be verified during migration.

**Total imports to migrate**: ~322 import statements across entire codebase

---

## Migration Order & Rationale

### Why This Order?

1. **validators** → Fewest dependencies, easy to verify (form inputs)
2. **constants** → Static values, no logic, low risk
3. **utils** → Most imports but pure functions, predictable behavior
4. **types** → Many imports but TypeScript will catch errors at compile time
5. **permissions** → HIGHEST RISK - affects authorization, admin/manager/staff/KTV logic

---

## Per-Module Migration Process

### Standard Process (validators, constants, utils)

For each module:

```bash
# Step 1: Find all imports
grep -r "from '@/lib/MODULE'" src/ --include="*.ts" --include="*.tsx"

# Step 2: Replace imports (ONE MODULE AT A TIME)
# Example: validators
find src -type f \( -name "*.ts" -o -name "*.tsx" \) -exec sed -i "s|from '@/lib/validators'|from '@bella/shared'|g" {} +

# Step 3: Verify TypeScript
npm run typecheck

# Step 4: Build
npm run build

# Step 5: Run critical tests
npm run test:critical

# Step 6: MANUAL SMOKE TEST (MANDATORY)
# - Login ✓
# - Dashboard ✓
# - Create Booking ✓
# - Complete Session ✓
# - Beauty Spa Module ✓

# Step 7: Commit
git add -A
git commit -m "refactor(shared): migrate MODULE imports to @bella/shared

- Replaced N imports from @/lib/MODULE → @bella/shared
- Verified: typecheck ✓ build ✓ test:critical ✓ smoke-test ✓
- Risk: X/10
- Zero production impact (functions unchanged)

Migration: Week 2 Step Y of 5"

# Step 8: Tag checkpoint
git tag mobile-week2-MODULE-migrated
git push origin main --tags
```

---

### High-Risk Process (types, permissions)

For `types` and `permissions` modules, ADD these extra steps:

```bash
# After Step 5 (test:critical), add:

# Step 5b: Run FULL test suite
npm test

# Step 5c: Run integration tests
npm run test:integration

# Step 5d: EXTENDED smoke test
# - Admin dashboard ✓
# - Manager dashboard ✓
# - Staff dashboard ✓
# - KTV dashboard ✓
# - Permissions check (canEdit, canDelete, canApprove) ✓
# - RLS enforcement ✓

# Step 5e: CTO/Lead review BEFORE commit
# (Show diff, wait for approval)
```

---

## Per-Module Risk Assessment

### 1. validators (Risk: 2/10) - FIRST

**What it contains**:
- `validateEmail`, `validatePassword`, `validateVnPhone`
- Form validation logic

**Why low risk**:
- Pure functions, no side effects
- Only affects form UX (validation messages)
- Easy to test manually (login form)

**Smoke test checklist**:
- [ ] Login form validates email
- [ ] Login form validates password
- [ ] Registration validates phone number

**Estimated time**: 30 minutes

---

### 2. constants (Risk: 2/10) - SECOND

**What it contains**:
- `BUSINESS_RULES` (session multipliers, tax rates)
- Static configuration values

**Why low risk**:
- No logic, just values
- TypeScript will catch any missing constants

**Smoke test checklist**:
- [ ] Package session multipliers work correctly
- [ ] Booking calculations use correct rates

**Estimated time**: 30 minutes

---

### 3. utils (Risk: 3/10) - THIRD

**What it contains**:
- `formatCurrency`, `parseMoneyInput`
- `getLocalDateString`, `sanitizeTime`
- `resolvePackageName`
- 124 imports (MOST IMPORTS)

**Why moderate risk**:
- Many imports (124) = more surface area
- But pure functions = predictable
- Display logic only (no database writes)

**Smoke test checklist**:
- [ ] Currency displays correctly (9,499,500đ)
- [ ] Date formats correct (2026-06-19)
- [ ] Package names resolve correctly
- [ ] Money input parsing works (type "9tr5" → 9,500,000)

**Estimated time**: 1 hour

---

### 4. types (Risk: 5/10) - FOURTH

**What it contains**:
- `CurrentUser`, `AuthState`
- `TenantInfo`, `BookingSummary`, `StaffRecord`
- 190 imports (MOST IMPORTS)

**Why moderate-high risk**:
- 190 imports = largest migration
- TypeScript will catch compile errors
- But type changes can cause runtime issues if cast incorrectly

**Smoke test checklist**:
- [ ] User profile loads correctly
- [ ] Booking data displays correctly
- [ ] Staff records render without errors
- [ ] Tenant info accessible
- [ ] Auth state transitions work (login → authenticated)

**Extra verification**:
- [ ] Run FULL test suite (not just critical)
- [ ] Check browser console for type warnings

**Estimated time**: 2 hours

---

### 5. permissions (Risk: 7/10) - LAST (HIGHEST RISK)

**What it contains**:
- `isAdminRole`
- `SIDEBAR_MODULE_BY_LABEL`
- `resolveSidebarModuleId`
- `isSidebarItemAllowed`

**Why HIGHEST risk**:
- Affects authorization logic
- Admin/Manager/Staff/KTV access control
- `canEdit`, `canDelete`, `canApprove` checks
- Sidebar visibility rules

**MANDATORY requirements**:
1. ✅ Full test suite MUST pass
2. ✅ CTO/Lead review BEFORE commit
3. ✅ Extended smoke test (all 4 roles)
4. ✅ Permission matrix verification

**Smoke test checklist (EXTENDED)**:
- [ ] **Admin role**:
  - [ ] Sees all modules
  - [ ] Can edit/delete all records
  - [ ] Can approve salary/expenses
- [ ] **Manager role**:
  - [ ] Sees branch-scoped data
  - [ ] Cannot access HQ dashboard
  - [ ] Can approve within branch
- [ ] **Staff role**:
  - [ ] Cannot edit salary records
  - [ ] Cannot delete bookings
  - [ ] Limited sidebar modules
- [ ] **KTV role**:
  - [ ] Only sees own schedule/salary
  - [ ] Cannot access admin features
  - [ ] Sidebar shows KTV modules only

**Extra verification**:
- [ ] Test RLS enforcement (query returns correct rows)
- [ ] Test cross-tenant isolation
- [ ] Check audit logs for permission denials

**Estimated time**: 3 hours + review time

---

## Exit Criteria (STRICT)

Each module is ONLY considered complete when ALL of these pass:

```
✅ TypeScript typecheck PASS
✅ Build (npm run build) PASS
✅ Critical tests (npm run test:critical) PASS
✅ Manual smoke test PASS (checklist complete)
✅ Commit created with detailed message
✅ Git tag created (mobile-week2-MODULE-migrated)
✅ Tags pushed to origin
```

For high-risk modules (`types`, `permissions`), ADD:

```
✅ Full test suite PASS
✅ Integration tests PASS
✅ Extended smoke test PASS
✅ CTO/Lead review APPROVED (for permissions only)
```

---

## Rollback Strategy

If ANY module migration causes issues:

### Immediate Rollback (< 2 minutes)

```bash
# Option 1: Revert to previous tag
git checkout mobile-week2-PREVIOUS_MODULE-migrated

# Option 2: Revert last commit
git revert HEAD
git push origin main
```

### Rollback Verification

After rollback:

```bash
npm ci
npm run build
npm run test:critical
# Manual smoke test (login, dashboard, booking)
```

---

## What NOT To Do (FORBIDDEN)

### ❌ NEVER do this:

```bash
# ❌ FORBIDDEN: Mass replace all imports at once
find src -type f -name "*.ts" -exec sed -i "s|from '@/lib/|from '@bella/shared/|g" {} +
```

**Why forbidden**: One command = 322 imports changed = impossible to debug if something breaks.

### ❌ NEVER skip verification steps

Even if build passes, ALWAYS run smoke test. Build success does NOT guarantee runtime correctness.

### ❌ NEVER migrate multiple modules in one commit

```bash
# ❌ FORBIDDEN: Multiple modules in one commit
git commit -m "migrate utils, types, permissions to @bella/shared"
```

**Why forbidden**: If rollback needed, we lose all progress instead of just one module.

---

## Success Metrics

Week 2 migration is successful when:

1. ✅ All 5 modules migrated
2. ✅ All 5 checkpoints tagged
3. ✅ `src/lib/` is empty (or minimal)
4. ✅ Web app imports from `@bella/shared` only
5. ✅ Mobile app imports from `@bella/shared` only
6. ✅ Zero production incidents
7. ✅ Test suite still passes (17 suites, 181 tests)

---

## Timeline Estimate

| Module | Estimated Time | Risk | Priority |
|--------|---------------|------|----------|
| validators | 30 min | 2/10 | #1 |
| constants | 30 min | 2/10 | #2 |
| utils | 1 hour | 3/10 | #3 |
| types | 2 hours | 5/10 | #4 |
| permissions | 3 hours + review | 7/10 | #5 |

**Total**: ~7 hours (spread across 2-3 days for safety)

**Recommended schedule**:
- Day 1: validators + constants (1 hour)
- Day 2: utils (1 hour)
- Day 3: types (2 hours)
- Day 4: permissions (3 hours + review)

---

## Pre-Week-2 Checklist

Before starting ANY migration:

- [ ] Read this document completely
- [ ] Review `docs/adr/ADR-002-why-conservative-approach.md`
- [ ] Ensure `mobile-week1-complete` tag exists
- [ ] Verify web app is in production-stable state
- [ ] Communicate timeline to stakeholders
- [ ] Schedule CTO review for Day 4 (permissions migration)
- [ ] Backup database (if applicable)
- [ ] Clear schedule (7 hours of focused work)

---

## Stakeholder Sign-Off

**Required approvals BEFORE starting Week 2**:

- [ ] CTO: Approved migration strategy
- [ ] Tech Lead: Reviewed risk assessment
- [ ] Team: Understands rollback procedure

**Signature block**:

```
CTO: _________________ Date: _______
Tech Lead: ____________ Date: _______
Agent: Kiro AI         Date: 2026-06-19
```

---

## Related Documents

- `docs/adr/ADR-002-why-conservative-approach.md` - Migration strategy rationale
- `docs/implementation-artifacts/spec-mobile-week1-foundation.md` - Week 1 spec
- `docs/implementation-artifacts/investigation-mobile-app-week-1-safety.md` - Week 1 safety analysis
- `docs/mobile-app/phase-1-week-2-import-migration-plan.md` - Original plan (if exists)

---

## Conclusion

Week 2 migration is the **SINGLE HIGHEST RISK** activity in Mobile Phase 1. The key to success is:

1. **Discipline**: Follow per-module process strictly
2. **Verification**: Never skip smoke tests
3. **Checkpoints**: Tag after every module
4. **Communication**: Get review for permissions

If we maintain the same discipline as Week 1 (checkpoint-based, test-driven, rollback-ready), the risk of production impact is **very low** despite the 7/10 risk rating.

**Status**: ✅ READY TO REVIEW (waiting for stakeholder sign-off before Week 2 execution)
