# Task 4.1 Execution Plan: Extract Customer Order Management Services (REVISED)

**Task ID**: 4.1  
**Wave**: 2 - Core Services  
**Status**: Planning (REVISED - Split into Sub-Tasks)  
**Risk Level**: CRITICAL ⚠️ (Incremental migration to reduce blast radius)

**REVISION REASON**: Original plan was too large (26 files + 21+ imports in one shot). Split into 4 smaller, safer sub-tasks with full verification after each step.

---

## ⚠️ CRITICAL STRATEGY CHANGE

**Original Approach**: Move all 26 files at once → HIGH RISK  
**Revised Approach**: Move incrementally in 4 phases → LOWER RISK

**Benefits**:
- Smaller blast radius per sub-task
- Full verification (build + tests + git diff) after each step
- Easy rollback if any step fails
- Can pause between steps for user review

---

## Sub-Task Breakdown

### Task 4.1A: Foundation Setup (ZERO LOGIC MOVE)
**Duration**: ~5 minutes  
**Risk**: MINIMAL  
**Scope**: 
- Create `src/core/services/order/` directory structure
- Create empty `index.ts` barrel export with placeholder comment
- **NO files moved yet**
- **NO logic touched**

**Actions**:
1. Create directory: `src/core/services/order/`
2. Create file: `src/core/services/order/index.ts` with:
   ```typescript
   /**
    * Core order management services.
    * 
    * Handles the complete order/booking lifecycle including:
    * - Order CRUD operations
    * - Session scheduling and completion
    * - Payment processing
    * - Commission calculations
    * 
    * @module core/services/order
    */
   
   // Placeholder - files will be migrated incrementally
   export {};
   ```
3. Create file: `src/core/services/order/README.md` with module documentation

**Verification**:
- ✅ Directory exists
- ✅ Barrel export exists (empty but valid)
- ✅ `npm run build` succeeds
- ✅ Zero TypeScript errors
- ✅ Git diff shows only new files, no modifications

**Success Criteria**:
- ✅ Directory structure created
- ✅ Build passes
- ✅ Zero impact on existing code

---

### Task 4.1B: Order Query & Lifecycle Files (NO PAYMENT/SESSION LOGIC)
**Duration**: ~15 minutes  
**Risk**: LOW-MEDIUM  
**Scope**: Move **ONLY read-only query files and simple lifecycle orchestration**

**Files to Move** (6 files):
1. `query-actions.ts` - Read-only queries (`getBookings`, `getPackages`, `getDraftBooking`)
2. `lifecycle-actions.ts` - **Barrel file** (re-exports only, no logic)
3. `create-booking-action.ts` - Order creation (orchestration only)
4. `create-booking-helpers.ts` - Order creation helpers
5. `update-booking-action.ts` - Order update (orchestration only)
6. `reuse-package-action.ts` - Package reuse (orchestration only)

**Why These Files First?**:
- `query-actions.ts`: Read-only, lowest risk
- `lifecycle-actions.ts`: Barrel file (no logic, just re-exports)
- `create-booking-action.ts`: Orchestration (delegates to other files)
- Rest: Simple CRUD operations, no complex side effects

**Files NOT Moving** (high-risk logic):
- ❌ Session files (complex side effects)
- ❌ Payment files (financial integrity)
- ❌ Commission files (payroll impact)
- ❌ Session completion engine (triggers multiple side effects)

**Actions**:

**Phase 1: File Move**
1. Move 6 files from `src/modules/booking/actions/` → `src/core/services/order/`
2. Update internal imports in moved files (relative paths)
3. Update `src/core/services/order/index.ts` to re-export from moved files

**Phase 2: Update External Imports**

**Files Importing Query/Lifecycle** (~10 files):
1. `src/lib/bookings-page-client-cache.ts`
   - Change: `from '@/modules/booking/actions/lifecycle-actions'` 
   - To: `from '@/core/services/order'`

2. `src/components/features/BookingModal.tsx`
   - Change imports to `@/core/services/order`

3. `src/components/features/TransactionModal.tsx`
   - Change imports to `@/core/services/order`

4. `src/app/page.tsx` (Landing)
   - Change imports to `@/core/services/order`

5. `src/app/dashboard/sessions/page.tsx`
   - Change imports to `@/core/services/order`

6. `src/app/dashboard/sessions/components/SessionLogsDetailsModal.tsx`
   - Change imports to `@/core/services/order`

7. `src/app/dashboard/customers/[id]/useCustomerDetailController.ts`
   - Change imports to `@/core/services/order`

8. `src/app/dashboard/bookings/hooks/useBookingsPageActions.ts`
   - Change imports to `@/core/services/order`

9. `src/app/book/page.tsx`
   - Change imports to `@/core/services/order`

10. `src/app/book/BookingPageClient.tsx`
    - Change imports to `@/core/services/order`

**Test Files** (~3 files):
11. `src/__tests__/booking-tenant-scope.test.ts`
12. `src/__tests__/booking-package-module-scope.test.ts`
13. `src/__tests__/public-booking-packages.test.ts`

**Verification**:
1. **Build**: `npm run build` - must pass
2. **Tests**: `npm test -- --testPathPattern="(booking|query)"` - must pass
3. **Manual Test**: 
   - Navigate to Dashboard → Bookings
   - Verify bookings list loads
   - Open "Create Booking" modal
   - Verify packages dropdown loads
4. **Git Diff**: 
   - 6 files moved
   - 1 barrel export updated
   - ~13 files modified (import updates only)
   - ZERO logic changes in moved files

**Success Criteria**:
- ✅ 6 files moved successfully
- ✅ Build passes
- ✅ Query tests pass
- ✅ Bookings list loads in UI
- ✅ ZERO logic changes (verified by git diff)

**Rollback**: 
```bash
git reset --hard
git checkout HEAD~1
```

---

### Task 4.1C: Session Lifecycle Files (NO PAYMENT/COMMISSION)
**Duration**: ~15 minutes  
**Risk**: MEDIUM-HIGH  
**Scope**: Move **session scheduling and completion files, but NOT commission/payment logic**

**Files to Move** (11 files):
1. `session-actions.ts` - Session CRUD (orchestration)
2. `session-query-actions.ts` - Session queries
3. `session-mutation-actions.ts` - Session mutations
4. `create-session-log-action.ts` - Create session log
5. `update-session-log-action.ts` - Update session log
6. `update-session-log-helpers.ts` - Session log helpers
7. `reschedule-session-action.ts` - Reschedule logic
8. `complete-session-action.ts` - Session completion orchestration
9. `session-completion-engine.ts` - **CRITICAL**: Completion side effects engine
10. `session-completion-helpers.ts` - Completion helpers
11. `booking-resource-schedule-guard.ts` - Resource validation

**Why These Files Now?**:
- Session logic is core order lifecycle
- Must be in core for future multi-industry support
- But keep payment/commission logic separate for now

**Files STILL NOT Moving** (defer to 4.1D):
- ❌ `payment-actions.ts`
- ❌ `payment-helpers.ts`
- ❌ `commission-actions.ts`
- ❌ `invoice-print-actions.ts`

**Actions**:

**Phase 1: File Move**
1. Move 11 files to `src/core/services/order/`
2. Update internal imports in moved files
3. Update barrel export to include session functions

**Phase 2: Update External Imports**

**Files Importing Session Logic** (~8 files):
1. `src/services/ktv-actions.ts`
   - Change: `from '@/modules/booking/actions/session-completion-engine'`
   - To: `from '@/core/services/order'`

2. `src/app/dashboard/sessions/page.tsx`
   - Add session action imports from `@/core/services/order`

3. `src/app/dashboard/page.tsx`
   - Update session action imports

4. `src/app/dashboard/sessions/components/SessionLogsDetailsModal.tsx`
   - Update session action imports

5. `src/app/dashboard/bookings/hooks/useBookingsPageActions.ts`
   - Update session action imports

6. `src/app/dashboard/bookings/hooks/useBookingsPageData.ts`
   - Update session action imports

**Test Files** (~2 files):
7. `src/__tests__/booking-resource-schedule-guard.test.ts`
8. (Any other session-related tests)

**Verification**:
1. **Build**: `npm run build` - must pass
2. **Tests**: `npm test -- --testPathPattern="(session|schedule)"` - must pass
3. **Manual Test** (CRITICAL):
   - Navigate to Dashboard → Sessions
   - Find a scheduled session
   - Click "Complete Session"
   - ✅ Verify session marked complete
   - ✅ Verify progress counter updated
   - ✅ Verify NO commission calculation errors (should still work via old import paths)
   - Navigate to Dashboard → Sessions → Reschedule
   - ✅ Verify reschedule works
4. **Git Diff**:
   - 11 files moved
   - Barrel export updated
   - ~8 files modified (import updates only)
   - ZERO logic changes in moved files
   - **CRITICAL**: Verify `session-completion-engine.ts` has NO logic changes

**Success Criteria**:
- ✅ 11 files moved successfully
- ✅ Build passes
- ✅ Session tests pass
- ✅ Complete session flow works end-to-end
- ✅ Reschedule session works
- ✅ ZERO logic changes (especially in completion engine)

**Rollback**:
```bash
git reset --hard
git checkout HEAD~2
```

---

### Task 4.1D: Payment, Commission & Supporting Files (HIGHEST RISK)
**Duration**: ~20 minutes  
**Risk**: HIGH ⚠️  
**Scope**: Move remaining payment, commission, and invoice files

**Files to Move** (9 files):
1. `payment-actions.ts` - **CRITICAL**: Payment processing
2. `payment-helpers.ts` - **CRITICAL**: Payment validation and helpers
3. `commission-actions.ts` - **CRITICAL**: Commission calculations
4. `invoice-print-actions.ts` - Invoice generation
5. `accounting-review.ts` - Accounting integration
6. `online-booking-action.ts` - Online booking submission
7. `online-booking-types.ts` - Online booking types
8. `public-booking-packages.ts` - Public package queries
9. `public-booking-tenant.ts` - Public tenant queries

**Why These Last?**:
- Payment logic is financially critical
- Commission affects payroll (high sensitivity)
- Invoice generation must be correct
- Want all other pieces stable before touching these

**Actions**:

**Phase 1: File Move**
1. Move 9 files to `src/core/services/order/`
2. Update internal imports in moved files
3. Update barrel export to include payment/commission functions

**Phase 2: Update External Imports**

**Files Importing Payment Logic** (~6 files):
1. `src/app/dashboard/customers/[id]/useCustomerDetailController.ts`
   - Update payment action imports

2. `src/app/dashboard/bookings/hooks/useBookingsPageActions.ts`
   - Update invoice action imports

3. `src/app/page.tsx` (Landing)
   - Update online booking imports

4. `src/app/book/BookingPageClient.tsx`
   - Update online booking imports

**Test Files** (~4 files):
5. `src/__tests__/manual-payment-idempotency.test.ts`
6. `src/__tests__/payment-business-rule-audit.test.ts`
7. `src/__tests__/online-booking-package-scope.test.ts`
8. `src/__tests__/public-booking-packages.test.ts`

**Verification**:
1. **Build**: `npm run build` - must pass
2. **Tests**: `npm test -- --testPathPattern="payment"` - must pass (payment integrity tests)
3. **Manual Test** (CRITICAL - ALL FLOWS):
   
   **A. Payment Recording**:
   - Navigate to Customer Detail page
   - Record a remaining payment
   - ✅ Verify payment recorded in `revenue` table
   - ✅ Verify balance updated correctly
   
   **B. Commission Calculation**:
   - Complete a session (from 4.1C test)
   - Check database: `SELECT * FROM salary_records WHERE ktv_id = ?`
   - ✅ Verify commission calculated correctly
   - ✅ Verify session count incremented
   
   **C. Invoice Generation**:
   - Navigate to Dashboard → Bookings → Print Invoice
   - ✅ Verify invoice prints correctly
   - ✅ Verify invoice log recorded
   
   **D. Online Booking**:
   - Open `/book` page (public)
   - Submit a test booking
   - ✅ Verify booking created with "pending" status
   - ✅ Verify share token generated
   
4. **Git Diff**:
   - 9 files moved
   - Barrel export updated
   - ~10 files modified (import updates only)
   - ZERO logic changes in moved files
   - **CRITICAL**: Verify payment validation logic unchanged

**Success Criteria**:
- ✅ 9 files moved successfully
- ✅ Build passes
- ✅ Payment tests pass (especially idempotency tests)
- ✅ Payment recording works correctly
- ✅ Commission calculations correct
- ✅ Invoice generation works
- ✅ Online booking works
- ✅ ZERO logic changes

**Rollback**:
```bash
git reset --hard
git checkout HEAD~3
```

---

## Final Verification (After All Sub-Tasks)

### Post-Migration Checklist

**File Structure**:
- ✅ `src/core/services/order/` contains 26 files
- ✅ `src/core/services/order/index.ts` barrel export complete
- ✅ `src/modules/booking/actions/` deleted
- ✅ `src/modules/booking/` deleted (if empty)

**Build & Tests**:
- ✅ `npm run build` succeeds
- ✅ ALL tests pass (full suite)
- ✅ Payment idempotency tests pass
- ✅ Session tests pass
- ✅ Query tests pass

**Manual Testing** (Full End-to-End):
1. ✅ Create new order → Payment → Schedule sessions
2. ✅ Complete session → Verify commission calculated
3. ✅ Record remaining payment → Verify balance updated
4. ✅ Reschedule session → Verify calendar updated
5. ✅ Reuse package → Verify new booking created
6. ✅ Submit online booking → Verify pending order created

**Code Integrity**:
- ✅ ZERO logic changes in all 26 moved files
- ✅ Only import path changes in consumer files
- ✅ No database queries modified
- ✅ No RLS policies changed
- ✅ No payment validation logic changed
- ✅ No commission calculation formulas changed

**Git Diff Summary**:
```
Cumulative changes after all 4 sub-tasks:
- 26 files moved from src/modules/booking/actions/ → src/core/services/order/
- 1 barrel export created and incrementally updated
- ~20 files modified (import path updates only)
- 1 directory deleted (src/modules/booking/)
- ZERO code logic changes
```

---

## Critical Constraints (Apply to ALL Sub-Tasks)

### ❌ PROHIBITED CHANGES (Applies to 4.1A, 4.1B, 4.1C, 4.1D):
- NO changes to business logic
- NO changes to database queries
- NO changes to RLS policies
- NO changes to payment validation rules
- NO changes to commission calculation formulas
- NO changes to inventory deduction logic
- NO changes to revenue recognition rules
- NO changes to session completion side effects
- NO migration to `CoreBookingOrder` type (defer to Wave 4)
- NO integration with `TenantContext` (defer to Wave 4)

### ✅ ALLOWED CHANGES (Only These):
- Move files between directories
- Update import paths (relative → absolute, module paths)
- Update barrel exports
- Add README documentation

---

## Sub-Task Execution Order

**MUST execute in this order** (dependencies):

1. **Task 4.1A**: Foundation → Creates directory structure
2. **Task 4.1B**: Query/Lifecycle → Lowest risk, no side effects
3. **Task 4.1C**: Sessions → Medium risk, has side effects but no payment
4. **Task 4.1D**: Payment/Commission → Highest risk, financially critical

**After EACH sub-task**:
1. Run `npm run build` - MUST pass
2. Run relevant tests - MUST pass
3. Run manual smoke test - MUST pass
4. Generate git diff summary - VERIFY zero logic changes
5. **WAIT for user approval** before proceeding to next sub-task

---

## Rollback Strategy (Per Sub-Task)

Each sub-task has independent rollback:

**If 4.1A fails**: Unlikely (just directory creation)
```bash
git reset --hard
```

**If 4.1B fails** (most likely: import path error):
```bash
git reset --hard
git checkout HEAD~1  # Back to 4.1A checkpoint
```

**If 4.1C fails** (session tests fail):
```bash
git reset --hard
git checkout HEAD~2  # Back to 4.1B checkpoint
```

**If 4.1D fails** (payment tests fail):
```bash
git reset --hard
git checkout HEAD~3  # Back to 4.1C checkpoint
```

**Recovery Time**: < 2 minutes per rollback

---

## Timeline (Cumulative)

### Task 4.1A: Foundation
- **Duration**: 5 minutes
- **Cumulative**: 5 minutes

### Task 4.1B: Query/Lifecycle
- **Duration**: 15 minutes
- **Cumulative**: 20 minutes

### Task 4.1C: Sessions
- **Duration**: 15 minutes
- **Cumulative**: 35 minutes

### Task 4.1D: Payment/Commission
- **Duration**: 20 minutes
- **Cumulative**: 55 minutes

### Final Verification
- **Duration**: 10 minutes
- **Total**: ~65 minutes + user review time between sub-tasks

---

## Success Metrics (Cumulative)

After completing ALL 4 sub-tasks:

**Files**:
- ✅ 26 files moved to `src/core/services/order/`
- ✅ 1 barrel export created
- ✅ ~20 consumer files updated
- ✅ Old directory deleted

**Quality**:
- ✅ Build passes
- ✅ ALL tests pass (full suite)
- ✅ Manual tests pass (6 critical flows)
- ✅ ZERO logic changes (verified)

**Safety**:
- ✅ Incremental migration (4 checkpoints)
- ✅ Easy rollback at any point
- ✅ Full verification after each step

---

## Approval Required (Per Sub-Task)

**Before 4.1A**: User approves starting foundation
**Before 4.1B**: User approves query/lifecycle move (after reviewing 4.1A results)
**Before 4.1C**: User approves session move (after reviewing 4.1B results)
**Before 4.1D**: User approves payment move (after reviewing 4.1C results)

**User can STOP at any checkpoint** if issues detected.

---

## FINAL APPROVAL CHECKLIST (For Starting 4.1A)

Before proceeding with Task 4.1A, user must confirm:

- [ ] I understand the task is split into 4 incremental sub-tasks
- [ ] I approve starting with 4.1A (foundation setup - ZERO risk)
- [ ] I will review results after EACH sub-task before approving next
- [ ] I understand I can STOP at any checkpoint if issues arise
- [ ] I understand rollback is available at every checkpoint
- [ ] I am available for ~65 minutes total (with pauses for review)

**To proceed with 4.1A (foundation only)**:
Type: **"APPROVE 4.1A"** (foundation setup only, no logic move)

**To revise further**:
Type: **"REVISE"** with specific concerns

---

**RECOMMENDATION**: Start with 4.1A (5 minutes, zero risk) to establish foundation, then review before proceeding to 4.1B.
