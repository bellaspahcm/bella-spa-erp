---
title: 'Refactor CRM Page Hooks and Chrome'
type: 'refactor'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/implementation-artifacts/spec-improve-crm-page-load-error-handling.md'
---

# Refactor CRM Page Hooks and Chrome

## Intent

**Problem:** `src/app/dashboard/crm/page.tsx` owned data loading, Zalo actions, header controls, tab navigation, load error UI, and all tab content in one large client component. This made follow-up CRM changes risky after the quota/error-hardening work.

**Approach:** Split the low-risk boundaries first: shared CRM page types, `useCrmPageData`, `useCrmPageActions`, and chrome components for header, tabs, and load error banner. Keep tab content behavior unchanged for this pass while reducing page-level state/action responsibility.

## Suggested Review Order

1. `../../src/app/dashboard/crm/hooks/useCrmPageData.ts` -- loading, fail-fast error state, CRM data snapshots, and Zalo config state.
2. `../../src/app/dashboard/crm/hooks/useCrmPageActions.ts` -- manual scan, single reminder, birthday greeting, and Zalo config action handlers.
3. `../../src/app/dashboard/crm/components/` -- extracted header, tabs, and load error banner UI.
4. `../../src/app/dashboard/crm/page.tsx` -- page wiring, remaining tab content, and behavior preservation.
5. `../../src/__tests__/crm-ui.test.ts` -- source-contract coverage for the refactor boundaries.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/crm-ui.test.ts src/__tests__/crm-zalo-quota.test.ts --runInBand` -- expected: all tests pass.
- `npm.cmd run lint -- src/app/dashboard/crm/page.tsx src/app/dashboard/crm/hooks/useCrmPageData.ts src/app/dashboard/crm/hooks/useCrmPageActions.ts src/app/dashboard/crm/components/CrmHeader.tsx src/app/dashboard/crm/components/CrmTabs.tsx src/app/dashboard/crm/components/CrmLoadErrorBanner.tsx src/__tests__/crm-ui.test.ts` -- expected: no lint errors or warnings.
- `npx.cmd tsc --noEmit --pretty false` -- expected: no type errors.
