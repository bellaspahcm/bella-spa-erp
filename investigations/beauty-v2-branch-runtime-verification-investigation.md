# Beauty V2 Branch Runtime Verification Investigation

## Hand-off Brief

Status: Concluded. Scope stayed limited to Booking, Inventory, Payroll, and Commission branch-runtime correctness after `BEAUTY_V2_TENANT_CHAIN = PROVEN`. Chain MVP was not reopened; the only product-code hardening was to route explicit KTV attendance branch authorization through the canonical `user_org_unit_access` resolver.

## Case Info

- Date: 2026-10-06
- Worktree: `C:\Users\DELL\.codex\worktrees\beauty-v2-chain-audit\BELLA SPA ERP`
- Stronghold: `src/services/beauty-branch-context.ts` now resolves writer branch context from `user_org_unit_access`, and `src/__tests__/beauty-v2-tenant-chain-runtime-real-db.test.ts` proves Chain -> Runtime -> Attendance Branch A allowed / Branch B denied on real Supabase.
- Target modules: Booking, Inventory, Payroll, Commission

## Problem Statement

Determine whether Beauty V2 branch runtime correctness is proven across Booking, Inventory, Payroll, and Commission. Distinguish fixture-level `branch_id` evidence from runtime evidence that derives or validates branch access through canonical `user_org_unit_access`.

## Evidence Inventory

| Area | Evidence | Status |
|---|---|---|
| Chain MVP | Real DB E2E passed for Company -> Branch A/B -> Staff -> Access -> Runtime -> Attendance write/read-back | Confirmed |
| Booking | `createBookingServiceItems` and `createServiceItem` resolve/validate branch through `resolveSingleStaffBranchContext`; Real DB proof read back `booking_service_items.branch_id = Branch A` and denied Branch B before write | Confirmed |
| Inventory | `createProductSale` resolves/validates branch through `resolveSingleStaffBranchContext`; Real DB proof read back `product_sales.branch_id = Branch A` and denied Branch B before write | Confirmed |
| Payroll | `ktvCheckIn(branchId)` now uses canonical resolver for explicit KTV branch access; Real DB proof wrote attendance at Branch A, denied Branch B before write, and read back `salary_records.branch_id = Branch A` | Confirmed |
| Commission | Salary recalculation reads `booking_service_items` and `product_sales` branch sources, rejects Branch B expected payroll branch, and preserves the Branch A salary record | Confirmed |

## Hypotheses

1. Booking branch runtime may be proven for `booking_service_items`, but not necessarily all booking mutations.
   - Status: Confirmed for MVP operational path.
   - Resolution: Booking service-item commission writer derives Branch A from canonical runtime access and Branch B explicit service-item write is denied before insert.
2. Inventory branch runtime may be represented by `product_sales`, not general inventory stock movement.
   - Status: Confirmed for product-sales inventory/commission path.
   - Resolution: Product sale writer derives/validates branch through canonical access; Branch B mutation is denied before write.
3. Payroll branch runtime may be downstream-proven via attendance branch -> salary record, but caller/runtime context must be rechecked after canonical resolver change.
   - Status: Confirmed.
   - Resolution: Explicit attendance branch access no longer uses direct `org_relationships`; it delegates to `resolveSingleStaffBranchContext` and Real DB read-back proves salary Branch A.
4. Commission branch runtime may be proven only if source rows derive/validate branch before write and salary rejects mismatch.
   - Status: Confirmed.
   - Resolution: Real DB proof writes service/product commission sources at Branch A, rejects Branch B expected payroll branch with `ATTENDANCE_BRANCH_MISMATCH`, and confirms no Branch B mutation.

## Backlog

- Done: mapped writers and existing tests for Booking, Inventory, Payroll, Commission.
- Done: ran focused unit tests first.
- Done: added and ran minimal Real DB E2E proof against `.env.e2e`.
- Done: applied smallest code fix for the confirmed attendance explicit-branch resolver gap.
- Done: produced final matrix.

## Confirmed Findings

1. `src/services/attendance-actions.ts` had a real runtime-source gap for explicit KTV branch operations: omitted branch resolution already used `resolveSingleStaffBranchContext`, but explicit branch resolution still queried `people_directory` and `org_relationships` directly. This was fixed by delegating explicit non-admin KTV branch access to the same canonical resolver.
2. Booking service-item and product-sale writers already used `resolveSingleStaffBranchContext`; no Platform kernel or Beauty chain schema change was required.
3. The old Real DB commission/payroll tests contained useful source-branch evidence, but some of that evidence was fixture-level. The new operational Real DB test proves the current canonical runtime path.
4. `booking_service_items` rejects direct authenticated KTV inserts by RLS. The Real DB proof therefore uses a server-writer harness for allowed writes after canonical runtime access is proven, and an authenticated runtime path for Branch B deny-before-write.

## Verification

- Focused unit regression:
  `npm test -- src/__tests__/attendance-actions.test.ts src/__tests__/booking-service-items-branch-writer.test.ts src/__tests__/product-sales-branch-writer.test.ts src/__tests__/complete-session-action.test.ts src/__tests__/salary-recalculation-lifecycle.test.ts src/__tests__/beauty-runtime-branch-actions.test.ts --runInBand`
  Result: PASS, 6 suites / 45 tests.
- Real DB E2E:
  `npm test -- src/__tests__/beauty-v2-branch-runtime-operational-real-db.test.ts --runInBand` with `.env.e2e`
  Result: PASS, 1 suite / 1 test.

## Final Matrix

| Module | Runtime Branch | Real DB | Read-back | Cross-Branch Deny | Final |
|---|---|---|---|---|---|
| Booking | PASS | PASS | PASS | PASS | PROVEN |
| Inventory | PASS | PASS | PASS | PASS | PROVEN |
| Payroll | PASS | PASS | PASS | PASS | PROVEN |
| Commission | PASS | PASS | PASS | PASS | PROVEN |

Overall: `BEAUTY_V2_BRANCH_RUNTIME = PROVEN_FOR_BOOKING_INVENTORY_PAYROLL_COMMISSION`.
