# Harden Supabase API Key Aliases

## Intent
- Problem: Legacy Supabase JWT API keys were disabled after a leak, but app and E2E code still read only legacy env names.
- Approach: Prefer new Supabase API key env names while keeping legacy env names as fallback during rollout.

## Scope
- In: Environment variable helpers, Supabase client creation sites, E2E env helper, env example docs, focused alias tests.
- Out: Re-enabling leaked JWT keys, database schema changes, auth/session behavior changes, accounting business logic changes.

## Risk
- Data: None. No database writes or migrations.
- Tenant/security: Improves key hygiene by supporting server-only `SUPABASE_SECRET_KEY` and public `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Side effects: Existing environments using old vars continue to work through fallback.

## Files
- `src/lib/supabase-public-env.ts` - browser-safe public Supabase URL/key resolution.
- `src/lib/supabase-admin-env.ts` - server/admin Supabase URL/secret resolution.
- `e2e/helpers/supabase-admin.ts` - E2E support for new key names.

## Verification
- `npm.cmd test -- src\__tests__\supabase-env.test.ts --runInBand` pass, 1 suite / 5 tests.
- `npm.cmd test -- src\__tests__\accounting-outbox.test.ts src\__tests__\accounting-engine.test.ts src\__tests__\accounting-reports.test.ts src\__tests__\payment-webhook.test.ts src\__tests__\onboarding.test.ts src\__tests__\tenant-actions.test.ts src\__tests__\user-actions.test.ts src\__tests__\portal-chat.test.ts src\__tests__\customer-actions.test.ts --runInBand` pass, 9 suites / 94 tests.
- `npm.cmd run lint -- <changed code files>` pass; `e2e/helpers/supabase-admin.ts` is ignored by project ESLint config.
- `npm.cmd run build` pass.
- `npm.cmd test -- --runInBand` pass, 79 suites / 851 tests.
- `git diff --check` pass, with expected Windows LF/CRLF warnings.

## Handoff
- commit: included with this change set
- pushed: see git history/final handoff
- deferred: none
