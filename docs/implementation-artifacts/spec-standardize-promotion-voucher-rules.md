---
status: done
date: 2026-06-08
---

# Standardize Promotion Voucher Rules

## Intent

- Problem: Promotion and voucher inputs normalized discount percent, voucher code, and dates in several UI/action places.
- Approach: Add a small pure helper for promotion/voucher payload rules and route existing callers through it. This is intentionally not a large pricing engine because booking price math is already owned by `payment.ts`.

## Scope

- In:
  - Normalize voucher code by trimming, uppercasing, and removing whitespace.
  - Normalize discount percent through the existing 0-100 percent parser.
  - Validate promotion start/end date order.
  - Build a normalized promotion payload for server actions and CRM voucher creation.
  - Add focused tests for pure rules and server action persistence payload.
- Out:
  - No schema change.
  - No change to booking/payment pricing formulas.
  - No new promotion redemption or usage-count engine.

## Risk

- Data: Low. Existing writes now receive normalized values before insert.
- Tenant/security: Tenant scoping stays in `promotions-actions`.
- Side effects: Existing audit rollback flow is unchanged.

## Files

- `src/lib/business-rules/promotion.ts` - small pure promotion/voucher helper.
- `src/services/promotions-actions.ts` - server-side final normalization before insert.
- `src/app/dashboard/crm/hooks/useCrmVoucherCampaigns.ts` - CRM voucher payload uses shared helper.
- `src/app/dashboard/settings/components/promotions/usePromotionsSettings.ts` - Settings submit uses shared helper.
- `src/app/dashboard/settings/components/promotions/PromotionForm.tsx` - Percent input uses shared normalization.
- `src/__tests__/business-rule-engines.test.ts` - pure rule coverage.
- `src/__tests__/promotions.test.ts` - server action payload coverage.

## Verification

- `npm.cmd test -- src/__tests__/business-rule-engines.test.ts src/__tests__/promotions.test.ts --runInBand` pass, 2 suites / 36 tests.
- `npm.cmd test -- src/__tests__/crm-ui.test.ts src/__tests__/promotions-ui.test.ts src/__tests__/public-promotions-ui.test.ts --runInBand` pass, 3 suites / 8 tests.
- `npm.cmd run lint` pass.
- `npm.cmd run build` pass.

## Handoff

- commit: pending
- pushed: no
- deferred:
  - Promotion redemption/usage counting can remain separate until real usage tracking is requested.
