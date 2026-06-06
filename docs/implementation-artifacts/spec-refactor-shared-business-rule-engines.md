# Refactor Shared Business Rule Engines

status: done

## Intent
- Problem: Payment, booking revenue recognition, accounting classification, attendance penalties, and inventory movements still have duplicated formulas in UI hooks, server actions, and service helpers. This creates drift risks such as a portal QR asking for a deposit that has already been confirmed.
- Approach: Add small pure rule modules for the highest-risk formulas, then adapt existing actions/helpers to call those rules while keeping public function names stable.

## Scope
- In:
  - Shared payment/booking/revenue calculations for final price, confirmed paid amount, remaining debt, deposit due, and session revenue split.
  - Shared accounting ledger classification wrappers for payment method and inventory movement reasons.
  - Shared attendance workday/penalty helpers.
  - Shared inventory movement helpers for restock, consumption, rollback reason constants, and low-stock state.
  - Focused Jest tests for pure rules and existing action adapters.
- Out:
  - Database schema redesign.
  - Rewriting the existing accounting posting service.
  - Changing UI layout.
  - Deploying or pushing unless requested after verification.

## Risk
- Data: High. These rules affect customer debt, payment validation, revenue recognition, payroll penalties, and inventory balances.
- Tenant/security: Keep existing tenant filters. Do not weaken RLS assumptions or service action authorization.
- Side effects: Existing server actions that write revenue, inventory logs, accounting outbox, salary recalculations, or booking progress must still fail explicitly and roll back where existing code already does.

## Files
- `src/lib/business-rules/payment.ts` - customer payment and revenue-recognition formulas.
- `src/lib/business-rules/attendance.ts` - workdays and penalty formulas.
- `src/lib/business-rules/inventory.ts` - stock movement formulas and reason constants.
- `src/services/accounting/ledger-rules.ts` - accounting event classification and required-field rules.
- Existing adapters under `src/app/portal`, `src/modules/booking/actions`, `src/services/accounting`, and `src/services/inventory-actions.ts`.

## Verification
- `npm.cmd test -- src/__tests__/business-rule-engines.test.ts src/__tests__/portal-payment-utils.test.ts src/__tests__/accounting-template-rules.test.ts src/__tests__/session-completion-accounting.test.ts src/__tests__/inventory-actions.test.ts --runInBand` pass, 5 suites / 47 tests.
- `npm.cmd test -- src/__tests__/transaction-safety.test.ts src/__tests__/e2e-negative-pipeline.test.ts src/__tests__/e2e-pipeline.test.ts src/__tests__/cross-module-integrity.test.ts --runInBand` pass, 4 suites / 24 tests.
- `npm.cmd run lint` pass.
- `npm.cmd run build` pass.

## Handoff
- commit: not committed
- pushed: no
- deferred:
  - A later slice can move more UI displays to the payment state object once the server-side rules are locked.
