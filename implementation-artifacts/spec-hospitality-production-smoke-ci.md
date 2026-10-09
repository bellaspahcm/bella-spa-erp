---
title: 'Hospitality Production Smoke CI'
type: 'chore'
created: '2026-10-09'
status: 'done'
route: 'one-shot'
---

# Hospitality Production Smoke CI

## Intent

**Problem:** Bella Hospitality still lacks authenticated production UI smoke evidence. Existing CI and Real DB gates prove merged code paths, but they do not prove a production E2E admin can log in and render `/hospitality/hotel-core-chain` without deploying or mutating data.

**Approach:** Add a manually dispatched, read-only GitHub Actions workflow with production-specific credentials, a focused Playwright production smoke config, and a Hospitality spec that verifies auth challenge, authenticated rendering, no same-origin mutations, no same-origin HTTP errors, and sanitized evidence only.

## Production Smoke Follow-Up

Manual run `37934133847` proved the workflow could run on `main` with Production secrets, but it failed before authenticated rendering because unauthenticated production HTML contained the Operations Console at `/hospitality/hotel-core-chain`. The follow-up fix is route-only: require the existing current-user session before rendering the console, redirect unauthenticated requests to `/login`, and keep the smoke assertion strict.

Manual run `37938715903` ran after the route guard was merged and the Vercel deployment completed. It failed because the smoke expected browser URL navigation to `/login`, while the production document now contains the Next server redirect digest to `/login?redirect=%2Fhospitality%2Fhotel-core-chain`. The follow-up fix keeps the auth challenge strict by accepting either `/login` navigation or the Next redirect digest, and still fails if unauthenticated HTML renders `Hotel Operations Console`.

Manual run `37942136475` ran after the redirect assertion fix merged. Direct unauthenticated HTTP production evidence still showed `NEXT_REDIRECT` and no Operations Console, but the Playwright browser-context probe in the same authenticated worker saw console RSC payload. The follow-up fix moves only the unauthenticated challenge probe to a fresh `APIRequestContext` with empty storage/cookies, while keeping the authenticated browser render and read-only checks unchanged.

## Suggested Review Order

**Workflow boundary**

- Production-only dispatch uses protected environment secrets and never deploys.
  [`hospitality-production-smoke.yml:17`](../.github/workflows/hospitality-production-smoke.yml#L17)

- Required secrets are production-specific; generic E2E fallback is not accepted.
  [`hospitality-production-smoke.yml:22`](../.github/workflows/hospitality-production-smoke.yml#L22)

- Artifacts are limited to JSON result and sanitized smoke evidence.
  [`hospitality-production-smoke.yml:62`](../.github/workflows/hospitality-production-smoke.yml#L62)

**Smoke behavior**

- The production route now performs server-side auth before rendering the Operations Console.
  [`hotel-core-chain/page.tsx:32`](../src/app/hospitality/hotel-core-chain/page.tsx#L32)

- Production URL and credentials are hard gates, not skips.
  [`40-hospitality-production-auth-smoke.spec.ts:119`](../e2e/tests/40-hospitality-production-auth-smoke.spec.ts#L119)

- Unauthenticated access is verified with an empty-storage HTTP request context before authenticated browser proof is accepted, and must not render the Operations Console.
  [`40-hospitality-production-auth-smoke.spec.ts:132`](../e2e/tests/40-hospitality-production-auth-smoke.spec.ts#L132)

- Read-only proof rejects same-origin mutations and HTTP errors.
  [`40-hospitality-production-auth-smoke.spec.ts:183`](../e2e/tests/40-hospitality-production-auth-smoke.spec.ts#L183)

- Evidence JSON excludes credentials, tokens, screenshots, video, and trace.
  [`40-hospitality-production-auth-smoke.spec.ts:190`](../e2e/tests/40-hospitality-production-auth-smoke.spec.ts#L190)

**Artifact controls**

- Dedicated config disables trace, screenshots, video, and HTML report.
  [`playwright.production-smoke.config.ts:14`](../playwright.production-smoke.config.ts#L14)

- The npm script uses only the production-smoke config and focused spec.
  [`package.json:96`](../package.json#L96)

- Architecture gate records the NOT_PROVEN boundary until workflow PASS on main.
  [`ARCHITECTURE_GATE_RESULT.md:6282`](../ARCHITECTURE_GATE_RESULT.md#L6282)
