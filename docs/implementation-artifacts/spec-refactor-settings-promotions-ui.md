# Refactor Settings Promotions UI

Date: 2026-06-02

## Goal

Make the Settings promotions module maintainable and consistent with CRM by splitting its large client component into focused hook/form/list modules and fixing visible Vietnamese UI copy.

## Scope

- Keep existing `promotions` table and server actions unchanged.
- Keep audit rollback and tenant scoping behavior in `promotions-actions`.
- Move data loading, create, toggle, and delete UI handlers into `usePromotionsSettings`.
- Move the create form into `PromotionForm`.
- Move promotion cards and empty state into `PromotionList`.
- Keep `PromotionsTab` as a thin settings page container.
- Add source contract tests for component boundaries and mojibake prevention.

## Acceptance Checks

- Given Settings promotions is opened, when data loads, then `usePromotionsSettings` owns promotion state and server action calls.
- Given a promotion is created, toggled, or deleted, when the action succeeds, then the UI updates through the hook without duplicating server logic.
- Given the source files are checked, when mojibake markers appear in promotions UI, then `promotions-ui.test.ts` fails.
- Given existing promotions server action tests run, then tenant scoping, DB failure propagation, and audit rollback behavior remain covered.

## Verification

- `npm.cmd test -- src/__tests__/promotions-ui.test.ts src/__tests__/promotions.test.ts --runInBand`
- `npm.cmd run lint -- src/app/dashboard/settings/components/PromotionsTab.tsx src/app/dashboard/settings/components/promotions/types.ts src/app/dashboard/settings/components/promotions/usePromotionsSettings.ts src/app/dashboard/settings/components/promotions/PromotionForm.tsx src/app/dashboard/settings/components/promotions/PromotionList.tsx src/__tests__/promotions-ui.test.ts`
- `npx.cmd tsc --noEmit --pretty false`
