---
title: 'Improve CRM Page Load Error Handling'
type: 'bugfix'
created: '2026-06-02'
status: 'done'
route: 'one-shot'
context:
  - '{project-root}/AGENTS.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-crm-zalo-quota-side-effects.md'
---

# Improve CRM Page Load Error Handling

## Intent

**Problem:** CRM server actions now fail fast on database errors, but the CRM page only logged load failures to the browser console. Users could see empty tables and mistake a load failure for “no CRM data”.

**Approach:** Add explicit CRM load error state, show a visible retry banner, and make empty table states distinguish load failures from genuine empty results. Also keep quota-skipped batch reminder details visible in the manual scan alert.

## Suggested Review Order

1. `../../src/app/dashboard/crm/page.tsx` -- load error state, retry banner, typed CRM row data, and failure-aware empty states.
2. `../../src/__tests__/crm-ui.test.ts` -- static UI contract for visible CRM load failures and quota skip messaging.

## Verification

**Commands:**
- `npm.cmd run lint -- src/app/dashboard/crm/page.tsx src/__tests__/crm-ui.test.ts` -- expected: no lint errors or warnings.
- `npm.cmd test -- src/__tests__/crm-ui.test.ts src/__tests__/crm-zalo-quota.test.ts --runInBand` -- expected: all tests pass.
- `npx.cmd tsc --noEmit --pretty false` -- expected: no type errors.
