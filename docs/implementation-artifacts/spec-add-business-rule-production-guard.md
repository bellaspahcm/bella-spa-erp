---
status: done
date: 2026-06-08
---

# Add Business Rule Production Guard

## Intent

- Problem: `db:business:check` already protects CI, but the cross-module rule engines were not yet watched as a scheduled production guard with app notifications.
- Approach: Reuse the existing business invariant engine, wrap it in a production smoke script, add a scheduled GitHub Actions step, and surface unread rule-engine alerts in System Monitor.

## Scope

- In:
  - Add `scripts/check-business-rule-production-guard.cjs`.
  - Add `npm run cron:business-rules:smoke`.
  - Run the guard inside `.github/workflows/production-cron-smoke.yml`.
  - Create deduped `business_rule_health_alert` notifications for admin visibility.
  - Show business-rule production alerts in `getSystemMonitorSummary` and the System Monitor quick metrics.
  - Add focused Jest coverage for guard config, summary, notification insert/dedupe, and System Monitor alert display.
- Out:
  - No change to the business invariant formulas themselves.
  - No database schema change.
  - No automatic repair action in this slice.

## Risk

- Data: read-only business checks; only writes app notifications when production guard fails.
- Tenant/security: alert tenant uses `BUSINESS_RULE_ALERT_TENANT_ID`, falling back to `ACCOUNTING_ALERT_TENANT_ID` or first active tenant lookup.
- Side effects: notification writes are explicit and fail loudly if Supabase write fails; the GitHub workflow still fails on unhealthy guard results.

## Files

- `scripts/check-business-rule-production-guard.cjs` - production wrapper around existing business invariant engine.
- `.github/workflows/production-cron-smoke.yml` - scheduled production execution.
- `src/services/system-monitor-actions.ts` - includes `business_rule_health_alert` in open system alerts.
- `src/app/dashboard/system-monitor/page.tsx` - quick metric for open rule alerts.
- `src/__tests__/business-rule-production-guard.test.ts` - production guard regression coverage.
- `src/__tests__/system-monitor-actions.test.ts` - System Monitor alert coverage.

## Verification

- `npm.cmd test -- src/__tests__/business-rule-production-guard.test.ts src/__tests__/system-monitor-actions.test.ts --runInBand` pass, 2 suites / 11 tests.
- `npm.cmd test -- src/__tests__/accounting-worker-cron-smoke.test.ts src/__tests__/business-invariants-check.test.ts --runInBand` pass, 2 suites / 22 tests.
- `npm.cmd run lint` pass.
- `npm.cmd run build` pass.
- `npm.cmd run test:critical` pass, 10 suites / 122 tests.
- `git diff --check` pass; only LF/CRLF warnings from Windows.

## Handoff

- commit: pending
- pushed: no
- deferred:
  - optional: add a dedicated System Monitor filter for alert type once alert volume grows.
