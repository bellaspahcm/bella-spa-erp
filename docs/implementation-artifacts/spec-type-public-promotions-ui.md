# Type Public Promotions UI

Date: 2026-06-02

## Goal

Make public promotion rendering safer by removing loose `promo: any` mappings from the landing page and customer portal, and by sharing promotion date filtering logic.

## Scope

- Add `src/lib/promotions.ts` with the shared `Promotion` type and active-date helpers.
- Type landing page promotion state as `Promotion[]`.
- Replace inline landing active-date filtering with `filterActivePromotions`.
- Type portal `active_promotions` rendering as `Promotion[]`.
- Make promotion copy-to-clipboard calls null-safe.
- Fix visible promotion labels in landing and portal offer sections.
- Add source contract tests for public promotion typing and readable labels.

## Acceptance Checks

- Given landing promotions load from Supabase, when the current date is outside a promotion range, then the shared active-date helper filters it out.
- Given public promotion UI maps promotions, when source is checked, then `promo: any` does not appear in landing or portal promotion mappings.
- Given a promotion discount code is nullable, when copy is clicked, then the handler receives a string.
- Given public promotion labels are checked, then readable Vietnamese labels are present in landing and portal source.

## Verification

- `npm.cmd test -- src/__tests__/public-promotions-ui.test.ts --runInBand`
- `npm.cmd run lint -- src/app/page.tsx src/app/portal/[token]/page.tsx src/lib/promotions.ts src/__tests__/public-promotions-ui.test.ts`
- `npx.cmd tsc --noEmit --pretty false`
