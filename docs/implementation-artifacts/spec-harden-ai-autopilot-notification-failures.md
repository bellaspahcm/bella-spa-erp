---
title: 'Harden AI autopilot notification failures'
type: 'bugfix'
created: '2026-06-03'
status: 'done'
context:
  - '{project-root}/docs/index.md'
  - '{project-root}/docs/implementation-artifacts/spec-harden-ai-autopilot-cron.md'
---

<frozen-after-approval reason="human-owned intent - do not modify unless human renegotiates">

## Intent

**Problem:** `GET /api/cron/ai-autopilot` can finish with `success: true` even when an active tenant's Telegram delivery failed, and it currently skips a Telegram config DB error as if the tenant simply had no config. That hides the exact alert path operators depend on for daily Autopilot warnings.

**Approach:** Keep the existing cron contract and per-tenant processing model, but treat Telegram config query failures and Telegram API delivery failures as tenant-scoped failures. The cron should continue processing later tenants, return `partial_failure` when any configured tenant alert path fails, and include enough tenant detail for operations to investigate without guessing from server logs.

## Boundaries & Constraints

**Always:** Preserve CRON_SECRET guard behavior, service-role Supabase client creation, tenant-by-tenant continuation, and the current HTTP 200 body for partial tenant failures. Required DB/RPC failures must be explicit and must not become false-empty state.

**Ask First:** Changing the schedule, adding retry/outbox infrastructure, changing Telegram provider payload format, changing partial failure to HTTP 500, or storing notification delivery state in new tables.

**Never:** Do not alter the AI anomaly thresholds, reconciliation RPC contract, attendance KPI RPC contract, tenant status filter, or Telegram message content beyond what is required for failure handling.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Active tenant without Telegram config | `maybeSingle()` returns no config and no DB error | Tenant is skipped as before; cron can still return success | No error |
| Telegram config DB failure | `ai_agent_configs` query returns error | Tenant is counted as failed, later tenants still process | Response has `success: false`, `status: "partial_failure"`, and tenant error detail |
| Telegram API failure | Anomalies exist and Telegram `fetch` returns non-2xx | Alert is not counted as sent; tenant is reported failed | Response has `success: false`, `status: "partial_failure"`, and Telegram error text |
| Telegram API success | Anomalies exist and Telegram returns 2xx | Alert count increments exactly once | No error |

</frozen-after-approval>

## Code Map

- `src/app/api/cron/ai-autopilot/route.ts` -- cron route that loads tenants/config, queries anomaly RPCs, and sends Telegram alerts.
- `src/__tests__/ai-autopilot-cron.test.ts` -- new focused route-level regression tests for cron auth, config DB failure, Telegram failure, and successful alert count.
- `docs/implementation-artifacts/spec-harden-ai-autopilot-cron.md` -- previous hardening artifact that explicitly deferred Telegram failure semantics.
- `docs/DEVELOPMENT_LOG.md` -- append implementation evidence and verification commands after completion.

## Tasks & Acceptance

**Execution:**
- [x] `src/app/api/cron/ai-autopilot/route.ts` -- throw tenant-scoped errors for Telegram config DB failures and Telegram non-2xx responses -- prevents false-success daily cron summaries.
- [x] `src/__tests__/ai-autopilot-cron.test.ts` -- add side-effect assertions around Telegram fetch, alert counts, tenant error details, and continuation contract -- prevents regressions in operational delivery visibility.
- [x] `docs/DEVELOPMENT_LOG.md` -- add a dated log entry with artifact, files changed, and verification -- keeps future agent onboarding traceable.

**Acceptance Criteria:**
- Given a tenant Telegram config query fails, when the cron runs, then the response is `partial_failure` with that tenant in `tenant_errors`.
- Given a tenant has anomalies and Telegram API returns non-2xx, when the cron runs, then `alerts_sent` is not incremented and the response includes a tenant-scoped delivery error.
- Given a tenant has anomalies and Telegram API succeeds, when the cron runs, then `alerts_sent` increments and the response remains `success`.
- Given one tenant fails and another tenant can still be processed, when the cron runs, then the handler continues tenant iteration and returns combined partial results.

## Spec Change Log

## Design Notes

Partial tenant failures should remain HTTP 200 because the current cron route already uses body-level `status: "partial_failure"` to avoid full cron retry after some tenants have been processed. This slice only makes the notification side-effect visible inside that existing contract.

## Verification

**Commands:**
- `npm.cmd test -- src/__tests__/ai-autopilot-cron.test.ts --runInBand` -- expected: all focused cron tests pass.
- `npx.cmd tsc --noEmit --incremental false` -- expected: no TypeScript errors.
- `npx.cmd eslint src/app/api/cron/ai-autopilot/route.ts src/__tests__/ai-autopilot-cron.test.ts` -- expected: no ESLint errors.
- `npm.cmd test -- --runInBand` -- expected: full Jest suite passes.
- `npm.cmd run build` -- expected: production build succeeds.
