# Architecture Change Request (ACR)

**ACR ID:** ACR-2026-002  
**Date Submitted:** 2026-09-25  
**Submitted By:** AI Agent (Bella Haircut Go-Live / Core Payment Correction)  
**Status:** UNDER_REVIEW  

---

## Summary

Correct a proven Bella Core Order/Payment idempotency ordering defect discovered by Haircut real database E2E. The Core action must resolve an existing tenant-scoped manual payment idempotency key before validating remaining debt, so legitimate retries return the existing payment result instead of failing after the booking is already fully paid.

---

## Affected Layer(s)

- [ ] E7.1 Domain Kernel
- [ ] E7.2 Operational Kernel
- [ ] E7.3 Rules & Traceability
- [x] Other: Bella Platform Core / Order Payment Service

---

## Affected Artifacts

Approved Core file scope:

```
src/core/services/order/payment-actions.ts
src/core/services/order/payment-helpers.ts
```

Evidence and regression artifacts:

```
src/__tests__/payment-actions-idempotency-order.test.ts
src/__tests__/manual-payment-idempotency.test.ts
src/__tests__/haircut-go-live-real-flow.test.ts
docs/architecture/ARCHITECTURE_GATE_RESULT_HAIRCUT_GO_LIVE.md
```

---

## Reason for Change

### Business Context

Bella Haircut Go-Live requires the core operational transaction flow to survive normal retry behavior. A retry after a successful payment must not create duplicate revenue, duplicate outbox work, or a false payment failure.

This is not Haircut-specific. Products using the shared Core order/payment contract, including Beauty/Spa flows that call `recordRemainingPayment`, should receive the same canonical retry semantics.

### Technical Context

The canonical contract is:

```text
recordRemainingPayment
  -> record_remaining_payment_atomic
  -> tenant-scoped manual_payment_idempotency_key
```

The database/RPC contract already supports tenant-scoped manual payment idempotency and returns the existing revenue on duplicate/raced keys. The application action previously performed remaining-debt validation before resolving an existing idempotency record. After the first successful payment, a retry could therefore be rejected because the booking was already fully paid, before the canonical idempotency behavior could apply.

### Priority

- [ ] P0 - Critical (production outage, data loss, security)
- [x] P1 - High (core payment retry can falsely fail after successful write)
- [ ] P2 - Medium (minor issue, workaround available)
- [ ] P3 - Low (enhancement, nice-to-have)

---

## Proposed Changes

### Implementation Plan

1. In `recordRemainingPayment`, fetch the tenant-scoped booking snapshot as before.
2. Resolve an existing manual payment by `manual_payment_idempotency_key` and tenant/booking scope before amount validation.
3. If an existing payment is found, return it as idempotent and revalidate the same UI paths.
4. If no existing payment is found, preserve the existing amount validation, accounting period check, RPC execution, and revalidation behavior.

### API Impact

Will this change the public API?

- [ ] Yes - Breaking change
- [ ] Yes - Additive change (backward compatible)
- [x] No - Internal implementation only

The action signature, RPC signature, schema, and returned success/error shape remain unchanged. The corrected behavior aligns the application action with the existing RPC idempotency contract.

---

## Impact Analysis

### Blast Radius

- **Direct consumers:** `recordRemainingPayment` consumers via `src/core/services/order`, including customer detail remaining-payment flow and existing order lifecycle tests.
- **Indirect consumers:** Beauty/Spa/Nail/Haircut products that use the shared customer/booking payment surface.
- **Test impact:** Adds a focused Core action-ordering regression; reuses existing manual payment idempotency, transaction, E2E, and Haircut real DB E2E tests.

### Migration Path

No migration. Existing callers continue using the same action and RPC contract.

### Risk Assessment

**Low Risk:**
- Internal ordering correction.
- No schema/RPC/API change.
- Tenant and booking scope are preserved in the idempotency lookup.
- New overpayments remain rejected when no existing idempotent payment exists.

**Medium Risk:**
- Shared Core behavior affects all products using `recordRemainingPayment`; regression verification is required.

**Risk Level:** LOW-MEDIUM

---

## Alternatives Considered

### Alternative 1: Product-specific Haircut workaround

**Pros:**
- Avoids Core Freeze gate.

**Cons:**
- Leaves the shared Core invariant defective for Bella Spa, Nail, and other consumers.
- Creates divergent product behavior around payment retry.

**Why not chosen:** The root cause is in Core ordering, not Haircut.

### Alternative 2: Move implementation outside Core

**Pros:**
- Could bypass the current Core Freeze CI check.

**Cons:**
- Violates ownership evidence.
- Creates a non-canonical payment path.
- Weakens Core Freeze governance by moving code to satisfy CI.

**Why not chosen:** Explicitly prohibited by Bella Engineering Rules and the PR decision.

### Alternative 3: Change schema/RPC

**Pros:**
- Could centralize even more logic in the database.

**Cons:**
- No evidence schema/RPC is defective.
- Current RPC already supports the canonical idempotency behavior.

**Why not chosen:** The proven defect is in the application action ordering.

### Alternative 4: Do Nothing

**Impact of not making this change:**

A legitimate retry after successful payment can fail falsely, weakening operational reliability and making real payment state ambiguous to the user even though the database has exactly one valid payment.

---

## Testing Strategy

### Regression Testing

- [x] Existing payment idempotency tests pass.
- [x] New Core action-ordering regression added.
- [x] Real DB Haircut E2E proves first payment, idempotent retry, exactly one revenue effect, session/booking read-back, and tenant isolation.
- [ ] PR CI Core Freeze gate requires ARB handling before merge.

### Test Plan

1. First payment succeeds.
2. Identical retry resolves idempotently.
3. Exactly one payment/revenue effect is observed.
4. Invalid new overpayment remains rejected.
5. Tenant-scoped idempotency lookup is used.
6. Existing accounting/outbox behavior is not duplicated beyond the canonical RPC/idempotent path.
7. Affected consumer tests continue to pass.

---

## Documentation Updates

- [ ] API documentation
- [x] Architecture documentation
- [ ] Product documentation
- [ ] Migration guides
- [x] ADR/ACR evidence

---

## Timeline

**Estimated Duration:** 1 review cycle

**Milestones:**
- Evidence and minimal Core fix: complete in PR #153.
- ACR documentation: this file.
- ARB/Core Freeze handling: pending.
- Merge: pending Core Freeze approval and CI.

---

## Dependencies

**Depends on:**
- Core Freeze / Architecture Review Board approval or explicit approved-change path for `src/core` modifications.

**Blocks:**
- PR #153 merge while the hard Core Freeze CI gate remains red.

---

## Rollback Plan

1. Revert the two Core file changes if regression appears.
2. The schema/RPC remains untouched.
3. Product surfaces remain on the existing canonical payment action.
4. Haircut Go-Live payment retry proof returns to blocked/deferred until Core payment behavior is corrected.

---

## Approval

### Architecture Review

**Reviewed by:** Pending Architecture Review Board  
**Date:** Pending  
**Decision:** DEFER  
**Comments:** Core ownership has been established and the change is approved in principle by the requester, but the repository Core Freeze gate requires explicit ARB handling before merge.

### Technical Lead Review

**Reviewed by:** Pending  
**Date:** Pending  
**Decision:** DEFER  
**Comments:** Implementation and regression evidence are attached to PR #153.

---

## Implementation Tracking

**ADR Created:** This ACR documents the Core correction evidence.  
**Branch:** `codex/haircut-go-live`  
**PR:** #153  
**Merged:** Pending  
**Released:** Pending

---

## Post-Implementation Review

**Date:** 2 weeks after release

**Metrics:**
- Test pass rate: Pending
- Payment retry duplicate revenue count: 0 expected
- False retry failure reports: 0 expected

**Lessons Learned:**
- Product real DB E2E can uncover shared Core invariant defects.
- Core Freeze correctly escalates shared capability changes to review instead of allowing silent product-driven Core mutation.
