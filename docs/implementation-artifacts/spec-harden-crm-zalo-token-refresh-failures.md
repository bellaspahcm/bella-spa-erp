---
title: 'Harden CRM Zalo token refresh failures'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
baseline_commit: '483ace8f081dc01dc2291d65a8712fa2c84e8342'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-crm-zalo-config-read-failures.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `getOrRefreshZaloToken` currently collapses DB read failures, OAuth refresh failures, invalid OAuth responses, and token-save failures into `null` or logs only. Callers can misread operational failures as "Zalo is not configured" and continue with simulated/sandbox-like behavior.

**Approach:** Keep `null` only for the valid "Zalo credential config is absent or masked" case. Throw explicit errors for DB read failures, missing tenant rows, OAuth HTTP/response failures, unexpected exceptions, and DB save failures after refresh.

## Boundaries & Constraints

**Always:** Preserve `Promise<string | null>` return type. Return the existing decrypted access token if it is still valid. Return `null` when required Zalo credentials are absent or masked. Save refreshed access/refresh tokens before returning a refreshed token. Let `sendZaloZNS` surface thrown errors through its existing error response.

**Ask First:** Changing Zalo API endpoints, changing SMS quota accounting, changing notification/audit side effects, adding retry/backoff, or changing batch reminder scheduling.

**Never:** Do not return `null` for DB/OAuth/save failures. Do not return a newly refreshed token if saving it to the tenant row fails. Do not broaden this slice into UI copy or Zalo send payload formatting.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Missing config | Tenant row loads but app id/secret/access/refresh token is absent or masked | Return `null` | Caller reports invalid/incomplete config |
| Valid token | Existing token expires after 5-minute buffer | Return decrypted access token | No OAuth call |
| Tenant DB failure | Tenant token query errors | Reject with explicit DB error | No silent null |
| Missing tenant row | Tenant query returns no row | Reject with not-found error | No silent null |
| OAuth HTTP failure | Refresh request returns non-2xx | Reject with OAuth HTTP error | No token returned |
| OAuth invalid body | Refresh body lacks `access_token` | Reject with OAuth response error | No token returned |
| Save refreshed token failure | OAuth succeeds but tenant update fails | Reject with save error | Do not return refreshed token |
| Refresh success | OAuth succeeds and save succeeds | Return new access token | No error |

</frozen-after-approval>

## Code Map

- `src/services/crm/zalo-config.ts` -- `getOrRefreshZaloToken` lifecycle to harden.
- `src/services/crm/zalo-messaging.ts` -- caller; existing `sendZaloZNS` catch converts thrown token failures to error responses.
- `src/__tests__/crm-zalo-config.test.ts` -- extend focused tests for token lifecycle.
- `docs/DEVELOPMENT_LOG.md` -- implementation handoff log.

## Tasks & Acceptance

**Execution:**
- [x] `src/services/crm/zalo-config.ts` -- throw explicit failures for token DB/OAuth/save errors while preserving missing-config null.
- [x] `src/__tests__/crm-zalo-config.test.ts` -- cover valid token, missing config, DB failure, missing row, OAuth failure, invalid response, save failure, refresh success.
- [x] `docs/DEVELOPMENT_LOG.md` -- append dated implementation and verification evidence.
- [x] `docs/implementation-artifacts/spec-harden-crm-zalo-token-refresh-failures.md` -- mark completed after verification.

**Acceptance Criteria:**
- Given Zalo config is missing or masked, when token retrieval runs, then it returns `null`.
- Given any DB/OAuth/save failure, when token retrieval runs, then it rejects with a specific error.
- Given token is still valid, when token retrieval runs, then no OAuth request or tenant update occurs.
- Given refresh succeeds and save succeeds, when token retrieval runs, then it returns the new access token.

## Spec Change Log

## Design Notes

The chosen contract keeps "not configured" distinct from "configured but operationally failing". This avoids turning real incidents into sandbox-style message logs while preserving the existing UI path for genuinely incomplete Zalo setup.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/crm-zalo-config.test.ts --runInBand` -- expected: focused CRM Zalo tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/services/crm/zalo-config.ts src/__tests__/crm-zalo-config.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
