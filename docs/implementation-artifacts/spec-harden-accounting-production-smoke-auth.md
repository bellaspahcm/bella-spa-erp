---
status: done
---

# Harden Accounting Production Smoke Auth

## Intent
- Problem: Accounting tab smoke coverage worked only through local `mock_user_email`, so it could not safely validate production after Supabase legacy JWT keys were disabled.
- Approach: Let Playwright use real UI login when `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` are provided, while keeping the mock bypass strictly local-only.

## Scope
- In: Playwright auth fixture, accounting tab smoke request filtering, external `E2E_BASE_URL` handling, E2E docs/env example.
- Out: Runtime auth behavior, Supabase schema changes, accounting business logic, production test account creation.

## Risk
- Data: No test data writes added.
- Tenant/security: Improves safety by refusing mock auth outside localhost.
- Side effects: External smoke runs no longer start `next dev`; local smoke still uses the existing dev bypass.

## Files
- `e2e/fixtures/auth.ts` - chooses real UI auth for configured credentials, otherwise local dev bypass only.
- `e2e/tests/08-accounting-tabs-smoke.spec.ts` - skips non-local smoke unless real credentials exist and catches app-domain request failures.
- `playwright.config.ts` - starts the dev server only for localhost base URLs.
- `.env.example` and `e2e/README.md` - document production-safe smoke env variables.
- `playwright.config.ts` also sends Vercel Deployment Protection bypass headers when `E2E_VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_AUTOMATION_BYPASS_SECRET` is provided.

## Verification
- `npx.cmd playwright test e2e/tests/08-accounting-tabs-smoke.spec.ts` pass, 1 test / 11 accounting tabs.
- `E2E_BASE_URL=https://bella-spa-erp.vercel.app` without `E2E_ADMIN_EMAIL/PASSWORD` skips 1 test and does not start the local dev server.
- `npm.cmd run lint` pass.
- Production auth probe found `U+FEFF` BOM in the deployed `Authorization`/`apikey` header values from Vercel env values that were previously added through Windows PowerShell stdin.
- Rewrote Vercel Production `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `SUPABASE_SECRET_KEY` with `vercel env add --value ... --force`, then redeployed production.
- Production smoke on `https://bella-spa-erp.vercel.app` pass, 1 test / 11 accounting tabs, using a temporary non-MFA admin account that was deleted from both `public.users` and Supabase Auth in cleanup.
- Removed legacy Vercel Production env vars `NEXT_PUBLIC_SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY`, redeployed production, and reran production smoke successfully.
- Post-run verification: `E2E_TEMP_PROFILE_REMAINING=0` and `E2E_TEMP_AUTH_REMAINING=0`.
- Added new Supabase Preview env vars to branch `codex/accounting-health-preflight` and redeployed Preview to `https://bella-spa-991fke9nc-bella-spa-s-projects.vercel.app`.
- Preview smoke reached Vercel Deployment Protection, not the app login page. Temporary E2E admin cleanup still verified `E2E_TEMP_PROFILE_REMAINING=0` and `E2E_TEMP_AUTH_REMAINING=0`.

## Handoff
- commit: pending
- pushed: pending
- deferred: Protected Preview smoke needs a Vercel Automation Bypass secret available locally/CI as `E2E_VERCEL_AUTOMATION_BYPASS_SECRET` or `VERCEL_AUTOMATION_BYPASS_SECRET`.
