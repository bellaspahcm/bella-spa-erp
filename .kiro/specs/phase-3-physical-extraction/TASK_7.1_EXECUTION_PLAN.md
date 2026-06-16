# Task 7.1 Execution Plan: Extract Accounting Services to Core

## Overview

**Task**: Move `src/services/accounting/` → `src/core/services/accounting/`  
**Priority**: CRITICAL (HIGH impact - breaks 3 order service dependencies)  
**Risk Level**: MEDIUM (accounting is complex but well-isolated)  
**Estimated Time**: 30-45 minutes

---

## Pre-Migration Analysis

### Current State

**Accounting Services Location**: `src/services/accounting/` (13 files)

**Files**:
1. `business-health.ts` - Business health metrics
2. `client.ts` - Accounting client utilities
3. `coa.ts` - Chart of Accounts
4. `health.ts` - Health checks
5. `journals.ts` - Journal entries
6. `ledger-rules.ts` - Ledger rules
7. `mode.ts` - Accounting mode (cash vs accrual)
8. `period-guards.ts` - Period validation ⚠️ **USED BY ORDER**
9. `periods.ts` - Accounting periods
10. `reports.ts` - Financial reports
11. `template-rules.ts` - Template rules ⚠️ **USED BY ORDER**
12. `templates.ts` - Accounting templates
13. `types.ts` - Accounting types

### Dependency Analysis

**Order Services → Accounting** (3 files):
```typescript
// session-completion-helpers.ts
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { 
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus 
} from '@/services/accounting/template-rules';

// payment-helpers.ts
import { 
  buildRevenueAccountingMetadata,
  inferBusinessEventType 
} from '@/services/accounting/template-rules';

// create-booking-helpers.ts
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { 
  buildRevenueAccountingMetadata,
  inferBusinessEventType 
} from '@/services/accounting/template-rules';

// accounting-review.ts (re-export)
export { resolveAccountingReviewStatus } from '@/services/accounting/template-rules';
```

**Critical Functions**:
- `assertOpenAccountingPeriod()` - Used in 2 order files
- `buildRevenueAccountingMetadata()` - Used in 3 order files
- `inferBusinessEventType()` - Used in 3 order files
- `resolveAccountingReviewStatus()` - Used in 2 files (1 direct, 1 re-export)

---

## Migration Strategy

### Single-Phase Approach ✅ (Recommended)

**Why Single-Phase**:
- Accounting services are well-isolated (no circular dependencies found)
- Only 13 files to move
- Only 3 order service consumers to update
- All accounting files can be moved together safely

**Steps**:
1. Move all 13 files from `src/services/accounting/` → `src/core/services/accounting/`
2. Update barrel export `src/core/services/accounting/index.ts`
3. Update 3 order service imports
4. Update any other imports (API routes, components)
5. Verify build & tests

---

## Execution Steps

### Step 1: Move Accounting Files

**Source**: `src/services/accounting/*.ts` (13 files)  
**Destination**: `src/core/services/accounting/`

**Files to move**:
```
src/services/accounting/business-health.ts     → src/core/services/accounting/business-health.ts
src/services/accounting/client.ts             → src/core/services/accounting/client.ts
src/services/accounting/coa.ts                → src/core/services/accounting/coa.ts
src/services/accounting/health.ts             → src/core/services/accounting/health.ts
src/services/accounting/journals.ts           → src/core/services/accounting/journals.ts
src/services/accounting/ledger-rules.ts       → src/core/services/accounting/ledger-rules.ts
src/services/accounting/mode.ts               → src/core/services/accounting/mode.ts
src/services/accounting/period-guards.ts      → src/core/services/accounting/period-guards.ts
src/services/accounting/periods.ts            → src/core/services/accounting/periods.ts
src/services/accounting/reports.ts            → src/core/services/accounting/reports.ts
src/services/accounting/template-rules.ts     → src/core/services/accounting/template-rules.ts
src/services/accounting/templates.ts          → src/core/services/accounting/templates.ts
src/services/accounting/types.ts              → src/core/services/accounting/types.ts
```

**Action**: Use `smart_relocate` for each file to auto-update imports

---

### Step 2: Create Barrel Export

**File**: `src/core/services/accounting/index.ts`

**Content**:
```typescript
// Core Accounting Services
// Re-export all accounting functionality for easy imports

// Period Management
export * from './periods';
export * from './period-guards';

// Templates & Rules
export * from './templates';
export * from './template-rules';
export * from './ledger-rules';

// Chart of Accounts
export * from './coa';

// Journals & Entries
export * from './journals';

// Reports
export * from './reports';

// Health & Monitoring
export * from './health';
export * from './business-health';

// Accounting Mode
export * from './mode';

// Client Utilities
export * from './client';

// Types
export * from './types';
```

---

### Step 3: Update Order Service Imports

**Files to update** (3 files):

1. **`src/core/services/order/session-completion-helpers.ts`**:
```typescript
// BEFORE
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { 
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus 
} from '@/services/accounting/template-rules';

// AFTER
import { assertOpenAccountingPeriod } from '@/core/services/accounting/period-guards';
import { 
  buildRevenueAccountingMetadata,
  inferBusinessEventType,
  resolveAccountingReviewStatus 
} from '@/core/services/accounting/template-rules';
```

2. **`src/core/services/order/payment-helpers.ts`**:
```typescript
// BEFORE
import { buildRevenueAccountingMetadata, inferBusinessEventType } from '@/services/accounting/template-rules';

// AFTER
import { buildRevenueAccountingMetadata, inferBusinessEventType } from '@/core/services/accounting/template-rules';
```

3. **`src/core/services/order/create-booking-helpers.ts`**:
```typescript
// BEFORE
import { assertOpenAccountingPeriod } from '@/services/accounting/period-guards';
import { buildRevenueAccountingMetadata, inferBusinessEventType } from '@/services/accounting/template-rules';

// AFTER
import { assertOpenAccountingPeriod } from '@/core/services/accounting/period-guards';
import { buildRevenueAccountingMetadata, inferBusinessEventType } from '@/core/services/accounting/template-rules';
```

4. **`src/core/services/order/accounting-review.ts`** (re-export):
```typescript
// BEFORE
export { resolveAccountingReviewStatus } from '@/services/accounting/template-rules';

// AFTER
export { resolveAccountingReviewStatus } from '@/core/services/accounting/template-rules';
```

---

### Step 4: Find & Update All Other Imports

**Search Pattern**: `from '@/services/accounting`

**Expected consumers**:
- API routes (`src/app/api/**/route.ts`)
- Finance services (`src/services/finance/*`)
- Accounting actions (`src/services/accounting-actions.ts`, `src/services/accounting-engine.ts`)
- Components (if any)

**Action**: Use grep to find all, then update systematically

---

### Step 5: Verification

**Build Check**:
```bash
npm run build
```
Expected: ✅ PASS (zero TypeScript errors)

**Test Check**:
```bash
npm test -- --testMatch="**/*accounting*.test.ts"
npm test -- --testMatch="**/*order*.test.ts"
npm test -- --testMatch="**/*payment*.test.ts"
npm test -- --testMatch="**/*session*.test.ts"
```
Expected: ✅ ALL PASS

**Git Diff Summary**:
- Files moved: 13 accounting files
- Imports updated: ~10-20 files (order services + other consumers)
- Logic changes: ZERO

---

## Risk Assessment

### Low Risk ✅
- Accounting services are well-isolated
- No circular dependencies detected
- Clear consumer list (order services + finance services)

### Medium Risk ⚠️
- Accounting logic is complex (journals, ledger, COA)
- Many internal cross-references between accounting files
- Finance services may also use accounting

### Mitigation
- Use `smart_relocate` to auto-update internal imports
- Run full test suite after migration
- Check for broken imports with `tsc --noEmit`

---

## Constraints (CRITICAL)

From `AGENTS.md`:

1. **ZERO logic changes** ✅
   - Only move files and update imports
   - No refactoring of accounting business logic
   - No changes to function signatures

2. **ZERO database changes** ✅
   - No schema changes
   - No RLS policy changes
   - No index changes

3. **All tests must pass** ✅
   - Accounting tests
   - Order tests (depend on accounting)
   - Session tests (depend on order → accounting)
   - Payment tests (depend on order → accounting)

---

## Success Criteria

✅ All 13 accounting files moved to `src/core/services/accounting/`  
✅ Barrel export created at `src/core/services/accounting/index.ts`  
✅ All order service imports updated (4 files)  
✅ All other consumer imports updated  
✅ `npm run build` passes with ZERO errors  
✅ All accounting tests pass  
✅ All order/session/payment tests pass (51/52 tests from previous run)  
✅ Git diff shows ONLY file moves and import updates  
✅ ZERO logic changes confirmed

---

## Rollback Plan

If migration fails:
1. Revert git changes: `git checkout -- .`
2. Restore original files from backup
3. Re-run tests to confirm stability
4. Report issues to user

---

## Estimated Timeline

- **Step 1** (Move files): 5 minutes
- **Step 2** (Barrel export): 2 minutes
- **Step 3** (Update order imports): 5 minutes
- **Step 4** (Find & update other imports): 10 minutes
- **Step 5** (Verification): 15 minutes
- **Total**: 37 minutes

---

## Next Steps After 7.1

After successful completion:
- **Dependency Health**: 95%+ clean (3/6 problematic dependencies resolved)
- **Next Task**: Task 7.2 (Update accounting tests - if needed)
- **Then**: Continue Wave 2 (Task 6.1 Notification, Task 8.1 Finance, etc.)

---

## USER APPROVAL REQUIRED

**User, please review this execution plan.**

**Questions**:
1. ✅ Approve single-phase migration (move all 13 files at once)?
2. ✅ Approve updating order service imports?
3. ✅ Approve running full test suite after migration?
4. ⚠️ Any specific accounting business logic constraints I should know?

**Type "APPROVE 7.1" to proceed with execution.**
