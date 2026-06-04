# Harden Error Monitoring

## Intent
- Problem: The evaluation report flagged error monitoring as high priority because production errors still depended too much on manual Vercel log inspection.
- Approach: Use the Next 16 instrumentation conventions so Sentry captures server/request errors, edge/node bootstrap runs explicitly, and client navigation monitoring is wired from `instrumentation-client.ts`.

## Scope
- In:
  - Add `instrumentation.ts` with runtime-specific Sentry bootstrap and `onRequestError`.
  - Move client Sentry init from deprecated `sentry.client.config.ts` to `instrumentation-client.ts`.
  - Allow Sentry Replay's blob worker in the production CSP.
  - Add regression tests for request-error and client router instrumentation.
- Out:
  - Do not add a public test-error endpoint.
  - Do not enable Sentry sourcemap upload in this slice.

## Risk
- Data: no database writes.
- Tenant/security: Sentry event redaction remains enforced by `sentryBeforeSend`; client replay keeps `maskAllText` and `blockAllMedia`.
- Side effects: monitoring bootstrap only runs when `NEXT_PUBLIC_SENTRY_DSN` is configured.

## Files
- `instrumentation.ts` - Next server/edge observability entry point.
- `instrumentation-client.ts` - Next client observability entry point.
- `next.config.ts` - production CSP must allow the Sentry Replay blob worker.
- `src/__tests__/sentry-instrumentation.test.ts` - regression guard for Sentry hooks.
- `eslint.config.mjs` - keeps root instrumentation files in the same config/test exemption bucket.

## Verification
- `npm.cmd test -- src\__tests__\sentry-instrumentation.test.ts src\__tests__\log-redactor.test.ts --runInBand` pass, 2 suites / 22 tests.
- `npm.cmd run lint` pass.
- `npm.cmd run build` pass.
- `npm.cmd test -- --runInBand` pass, 80 suites / 855 tests.

## Handoff
- commit: pending
- pushed: false
- deferred: consider Sentry sourcemap upload after verifying Vercel `SENTRY_AUTH_TOKEN` and source-map privacy expectations.
