# ARCHITECTURE GATE RESULT - GLOBAL LINT BASELINE REMEDIATION

> **Status:** PASS - Platform/CI lint error baseline remediated
> **Date:** 2026-10-04
> **Scope:** Reduce pre-existing repo-wide `npm run lint` errors without touching Bella English business logic, product contracts, database schema, or frozen kernels.

## Additional Architecture Gate - Production Smoke Client Monitoring Hardening

> **Status:** PASS - minimal monitoring runtime and smoke-harness fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow run `37211453061` passed validate/build/immutable preview health but failed `Smoke Exact Preview` after real-auth login because client-side routine Sentry tunnel traffic emitted a transient `/monitoring` 503 console error; the first attempt also hit the single-test timeout while the page snapshot showed the system monitor content had rendered.

- Bella OS/Product Development Process Gate: PASS. This is Platform production smoke/runtime monitoring hardening, not Product Vertical behavior, schema, tenant model, auth architecture, or English business logic.
- Truth / Source of Truth: Playwright artifact from run `37211453061` shows `/api/tenant/context` returned `200`, dashboard routes rendered, one `/monitoring` request returned `503` while surrounding Sentry tunnel requests returned `200`, and the single smoke test timed out after serially visiting many routes.
- Canonical Contract: production smoke must prove authenticated core routes render without app runtime errors; routine client telemetry must not create false route failures. Real application errors still remain captured by browser `pageerror`, app error text checks, failed app routes, and Sentry error replay.
- Ownership Map: `instrumentation-client.ts` owns client-side monitoring sampling; `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` owns read-only production smoke route evidence.
- Change Authority: reduce routine browser telemetry traffic by disabling client traces/session replay while keeping error replay enabled; split the core route smoke into route-level cases so each route has independent timeout/evidence.
- UI -> Contract Reconciliation: no UI change.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, production data mutation, or credential change.
- Verification Gates Plan: targeted Sentry instrumentation test, targeted Playwright smoke syntax/lint, `typecheck:changed`, `git diff --check`, security/architecture gates as needed, PR CI, then production workflow after merge.
- Explicit non-goals: no auth bypass, no production credential change, no English business code, no monitoring tunnel removal, no broad E2E rewrite, no workflow gate bypass.

## Additional Architecture Gate - Tenant Context Runtime Auth Cookie Fix

> **Status:** PASS - Minimal runtime boundary fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker where `/api/tenant/context` receives a valid Supabase browser auth cookie but returns `401`.

- Bella OS/Product Development Process Gate: PASS. This is an existing Platform runtime/auth API boundary repair, not a Product Vertical feature, UI redesign, Kernel change, or schema change.
- Product Manifest: no new product capability; preserve existing contract `authenticated request -> Supabase user -> public.users.tenant_id -> public.tenants -> TenantContext`.
- Ownership Map: Platform runtime/auth API owns the route behavior; `users` and `tenants` remain the existing data owners.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase Auth + RLS-backed `users`/`tenants`.
- Change Authority: `src/app/api/tenant/context/route.ts` and targeted API route regression test only.
- UI -> Contract Reconciliation: no UI change; existing protected pages depend on successful tenant context resolution after real auth login.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: targeted API regression, lint/typecheck where available, `git diff --check`, CI, then production smoke workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, or `any` introduction.

## Additional Architecture Gate - Tenant Context Web Runtime Cookie Decoder

> **Status:** PASS - route-only runtime decoder fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker after PR #217 where `/api/tenant/context` still returns `401` even though sanitized Playwright trace shows same-origin requests carry the Supabase auth cookie.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Platform tenant-context API runtime compatibility repair, not an auth architecture change, Product Vertical feature, UI redesign, Kernel change, or schema change.
- Truth / Source of Truth: production workflow run `37204581799` on SHA `cec170c56fa0bfe1dc12f6a7fff8d25c2c16edd5` passed validate/build/immutable preview health but failed `Smoke Exact Preview`; sanitized trace metadata shows `/api/tenant/context` requests returned `401` with `cookie` header present.
- Product Manifest: no product capability change. Preserve existing contract `authenticated Supabase cookie -> verified user -> public.users.tenant_id -> public.tenants -> TenantContext`.
- Ownership Map: `src/app/api/tenant/context/route.ts` owns tenant-context route behavior; Supabase Auth remains authentication source of truth; `users`/`tenants` remain existing data owners.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase Auth cookie decode -> `auth.getUser(accessToken)` -> tenant profile lookup.
- Change Authority: `src/app/api/tenant/context/route.ts`, targeted regression test in `src/__tests__/api-tenant-context.test.ts`, and this gate note only.
- UI -> Contract Reconciliation: no UI change; existing protected pages depend on successful tenant context resolution after real auth login.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: unauthenticated request remains `401`; authenticated Supabase cookie decodes in a runtime without Node `Buffer`; targeted API regression; lint/typecheck; security/architecture gates; CI; production workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, broad abstraction, or `any` introduction.

## Additional Architecture Gate - Tenant Context Public Env Contract

> **Status:** PASS - route-only stale env consumer fix authorized
> **Date:** 2026-10-04
> **Scope:** Production smoke blocker after PR #218 where `/api/tenant/context` still returns `401` even though sanitized Playwright trace proves the Supabase auth cookie is present, base64-decodable, contains a non-expired `access_token`, and reaches the exact preview route.

- Bella OS/Product Development Process Gate: PASS. This is a minimal Platform tenant-context API env-contract repair, not an auth architecture change, Product Vertical feature, UI redesign, Kernel change, or schema change.
- Truth / Source of Truth: production workflow run `37206117376` on SHA `458ca060b73b0119b687bab17571897869db02dc` passed validate/build/immutable preview health but failed `Smoke Exact Preview`; sanitized trace shows `/api/tenant/context` requests include `sb-[project]-auth-token`, the cookie payload has `access_token`, and the token is not expired.
- Canonical Contract: browser Supabase clients use `requireSupabasePublicEnv()`, whose public key contract is `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- Stale Consumer: `/api/tenant/context` used `NEXT_PUBLIC_SUPABASE_ANON_KEY` directly for both SSR and bearer clients, diverging from production workflow/build config where publishable key is the canonical public key.
- Ownership Map: `src/app/api/tenant/context/route.ts` owns tenant-context route behavior; `src/lib/supabase-public-env.ts` owns public Supabase env resolution; Supabase Auth remains authentication source of truth.
- Contract Dependency Map: protected UI -> `TenantContextProvider` -> `/api/tenant/context` -> Supabase public env -> Supabase Auth token verification -> `users`/`tenants`.
- Change Authority: `src/app/api/tenant/context/route.ts`, targeted regression test in `src/__tests__/api-tenant-context.test.ts`, and this gate note only.
- Additive Migration Plan: none; no DDL, DML, tenant provisioning, or production data mutation.
- Verification Gates Plan: targeted API regression proving publishable-key-only env works; lint/typecheck; security/architecture gates; CI; production workflow after merge.
- Explicit non-goals: no auth redesign, middleware redesign, hard-coded tenant/user, credential change, English business logic change, bypass auth, migration, broad abstraction, or `any` introduction.

## Additional Architecture Gate - Vercel Exact Preview Archive Deploy

> **Status:** PASS - Minimal production workflow packaging fix authorized
> **Date:** 2026-10-04
> **Scope:** Production workflow exact preview deploy fails after successful Vercel build because `vercel deploy --prebuilt` hits Vercel upload request limits (`api-upload-free`, more than 5000); Vercel CLI recommends `--archive=tgz`.

- Bella OS/Product Development Process Gate: PASS. This is production workflow packaging, not Product Vertical code, UI, schema, Kernel, auth, tenant, or business logic.
- Product Manifest: no product capability change and no runtime contract change.
- Ownership Map: Platform/CI production deployment workflow owns exact preview packaging.
- Contract Dependency Map: `Deploy to Production` workflow -> immutable preview build -> exact preview deployment -> smoke -> promote.
- Change Authority: `.github/workflows/deploy-production.yml` deploy command only, plus this gate note.
- Additive Migration Plan: none.
- Verification Gates Plan: workflow syntax/diff review, `git diff --check`, PR CI, then re-dispatch `Deploy to Production`.
- Explicit non-goals: no Vercel project change, no secret change, no production domain promotion bypass, no application/runtime code change.

## Bella OS/Product Development Process Gate

- Problem: production workflow is blocked by a pre-existing global lint baseline (`53 errors + 73 warnings` in CI), proven unchanged before and after PR #204.
- Truth / Source of Truth: `npm run lint`, GitHub production workflow run `37171535585`, and parent comparison against `89e9c4b14da8cd358c9aed0ca3f22a7641268919`.
- Ownership: Platform/CI governance and repository hygiene. This is not Bella English product work.
- Boundary: fix only local lint errors whose runtime semantics are obvious and do not require product/domain contract changes.
- Gate result: `PASS`; `npm run lint` now exits 0 with `0 errors / 73 warnings`.

## Product Manifest

No new product capability. No UI redesign. No production data mutation.

In scope:
- Mobile tooling inline ESLint rule drift.
- Playwright fixture parameter false-positive from React Hooks lint.
- Malformed legacy utility/docs scripts that currently cannot parse.
- Mechanical JSX entity escaping for text nodes.
- Minimal React compiler compliance where functions were used before declaration, a tooltip component was created during render, or refs were updated during render.

Out of scope:
- Bella English business code.
- Education, Healthcare, Logistics, Finance business behavior.
- Schema, RPC, API, RLS, tenant, auth, or migration changes.
- Workflow/gate weakening or lint bypass.

## Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `npm run lint` | Platform/CI Governance | Production workflow quality gate |
| `apps/mobile/*.js` | Mobile tooling | CommonJS tooling scripts, not product runtime contracts |
| `e2e/fixtures/auth.ts` | E2E harness | Playwright fixture setup; no auth semantics change |
| `docs/reference/scripts/*`, `scripts/*` | Repository utility/archive scripts | Must be parseable or excluded by a deliberate governance decision |
| JSX text nodes | UI rendering surface | Preserve displayed text while satisfying `react/no-unescaped-entities` |
| React hooks/compiler checks | React runtime contract | Preserve hook order and behavior while satisfying compiler constraints |

## Contract Dependency Map

```text
production workflow
  -> npm run lint
  -> repository source parse/rule checks
  -> production workflow continuation
```

No Product -> Contract -> Kernel dependency is modified.

## Change Authority

Authorized:
- Local syntax repairs for malformed scripts.
- Local lint-rule naming repair where the referenced rule is unavailable.
- E2E fixture naming repair if Playwright fixture semantics remain unchanged.
- JSX text escaping that preserves rendered content.
- Function ordering / component extraction / effect-based ref updates for React compiler compliance.

Not authorized:
- Disabling `npm run lint` globally.
- Adding `continue-on-error`.
- Broad ESLint ignores for product source.
- Product behavior or business contract changes.

## UI -> Contract Reconciliation

No UI change.

## Additive Migration Plan

No migration.

## Verification Plan

1. Focused ESLint on Batch 1 files: `PASS`.
2. `npm run lint -- --quiet`: `PASS` (`0 errors`).
3. `npm run lint`: `PASS` (`0 errors / 73 warnings`).
4. `npm run typecheck:changed`: `PASS`, zero diagnostics.
5. `git diff --check`: `PASS`.

---

# Full System Typecheck Architecture Gate

> **Status:** DEFER for frozen/kernel-owned diagnostics; PASS for non-frozen, contract-proven, local cleanup batches
> **Date:** 2026-10-03
> **Scope:** System-wide TypeScript/typecheck cleanup. No new product capability, no schema/RPC invention, no strictness reduction, no suppressions.

## Baseline

- Canonical full command: `npm run typecheck:full`
- Raw full diagnostics: `849`
- Raw full warnings: `0`
- Raw full affected files: `91`
- CI script result: allowed by reviewed baseline, but this is `FAIL` for the zero-debt target.
- Adjunct mobile command: `npm run mobile:typecheck` fails before compiler because `apps/mobile` is not registered as an npm workspace.
- Direct mobile compiler diagnostics: `30`, mostly missing Expo/React Native dependency/type resolution.
- `npm run shared:typecheck`: PASS.
- `mcp-server/tsconfig.json`: PASS.

## Bella OS/Product Development Process Gate

- Problem: eliminate TypeScript/typecheck debt across the repository without suppressions, weakened strictness, or unrelated refactors.
- Truth: current diagnostics come from compiler output and scoped typecheck commands.
- Source of Truth: `package.json`, `tsconfig*.json`, `.github/workflows/type-check.yml`, `scripts/ci-run-typecheck.mjs`, generated DB types, frozen-layer policies, and vertical constitutions.
- Canonical Contract: consumers must follow public Platform/OS/generated DB contracts; generated types are evidence, not a repair surface.
- Boundary: cleanup may fix stale consumers, config resolution, or mapper typing only when the canonical contract is proven.
- Stop Conditions: frozen Logistics/Healthcare kernel edits without required governance process; schema/RPC invention; public-contract widening; suppressions/casts to hide mismatch.

## Product Manifest

This is not a new product or UI redesign. It covers:

- Root web/app TypeScript surface from `tsconfig.json`.
- Scoped platform/product configs.
- Workspace package scopes: `packages/shared`, `apps/mobile`, `mcp-server`.

Non-goals:

- No new OS/product capability.
- No database migration.
- No production mutation.
- No broad refactor.

## Ownership Map

- Typecheck orchestration: CI/platform tooling.
- Generated DB contracts: database/generated types source of truth.
- Logistics E7.1/E7.2/E7.3: sealed Logistics OS kernel; modifications require ACR/ADR/unlock/regression/re-seal.
- Healthcare H1-H12: frozen Healthcare OS kernel; Product/legacy services must use public contracts.
- Mobile app workspace: app/tooling configuration.
- Shared package: package-owned TypeScript config/source.
- Decision-engine archive: Platform/legacy service ownership; archive inclusion must be justified rather than patched as live product code.

## Contract Dependency Map

- Product/UI/legacy services -> public Platform/OS contracts -> generated DB types.
- Logistics consumers -> Logistics public/domain contracts; no sealed artifact edits without governance process.
- Healthcare product/legacy surfaces -> Healthcare public contracts; no H1-H12 internal table bypass.
- Mobile typecheck -> npm workspace registration -> mobile package dependencies -> Expo/React Native tsconfig.

## Change Authority

Authorized:

- Type-only cleanup and config fixes required to make compiler commands run correctly.
- Stale consumer repairs when canonical contract is proven.
- Tests/tooling fixes that do not hide diagnostics or reduce strictness.

Not authorized without explicit architecture unlock:

- Frozen Healthcare kernel changes.
- Sealed Logistics E7.1/E7.2/E7.3 artifact changes outside approved process.
- Generated type hand edits.
- Schema/RPC inventions.
- Compatibility aliases that change public contracts.

## UI To Contract Reconciliation

No UI redesign requested. UI diagnostics must still trace data/action assumptions to canonical API/service/generated DB contracts before repair.

## Additive Migration Plan

No migrations planned. Any diagnostic implying missing table/column/RPC is a contract/schema gap until proven by migrations/generated types.

## 11 Automated Verification Gates Plan

1. Canonical full typecheck: `npm run typecheck:full`
2. Changed typecheck: `npm run typecheck:changed`
3. Relevant scoped typechecks for touched configs.
4. `npm run healthcare:verify` if Healthcare code changes.
5. `npm run logistics:verify` if Logistics code changes.
6. Relevant unit/integration tests for touched areas.
7. `git diff --check`.
8. Diff inspection.
9. No new `as any`.
10. No new `@ts-ignore` / `@ts-expect-error`.
11. No abnormal tsconfig/source exclusions.

---

# ARCHITECTURE GATE RESULT - PLATFORM PWA CONTRACT V1

> **Status:** PASS - Platform-owned PWA V1 contract for manifest identity and installability only
> **Date:** 2026-10-03
> **Scope:** Platform PWA identity, generated manifest, Product Registry default route integration, tenant brand display overlay, PWA install copy, and focused automated tests. No Beauty V2-specific PWA, offline strategy, runtime cache, Workbox/Serwist, database migration, or product business logic changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change standardizes PWA as a Bella Platform capability consumed by products. Gate decision: `PASS` for a narrow Platform App Shell contract that generates a manifest from canonical Product Registry identity and tenant display branding while keeping offline/cache behavior explicitly out of V1.

## 2. Product Manifest

In scope:
- Platform PWA identity contract.
- Generated manifest route.
- Product Registry linkage for `productKey`, `displayName`, `subtitle`, and `defaultRoute`.
- Tenant brand overlay for display fields only.
- Root app manifest linkage.
- `PwaRegister` install copy without Bella Spa hard-code.
- Focused tests for manifest contract, start URL, scope, tenant overlay, PwaRegister source, SW boundary, and Beauty V2 shared consumption.

Out of scope:
- Product-specific PWA manifests.
- Beauty V2-specific PWA implementation.
- Runtime caching, precache, offline fallback, offline queue, Workbox, or Serwist.
- Database schema, auth, tenant provisioning, or product business logic changes.
- Healthcare H1-H12, Education OS, or Logistics E7.1/E7.2/E7.3 kernel changes.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| Product Registry | Platform product identity | Canonical `productKey`, display identity, subtitle, and `defaultRoute` |
| Tenant brand theme | Tenant configuration | Display overlay only: brand name, logo, and primary color |
| Platform PWA contract | Platform App Shell | Manifest fields, installability identity, fixed scope/display/security boundary |
| Service worker | Platform App Shell | Registration-only V1; no cache/offline capability |

## 4. Contract Dependency Map

```text
Authenticated tenant
  -> tenants.product_key
  -> ProductRegistry.get(productKey)
  -> ProductDefinition.defaultRoute
  -> PlatformPwaIdentity.startUrl
  -> generated manifest
  -> PwaRegister install copy
```

Tenant display brand may influence only display fields:

```text
tenant.brand_theme.brandName / logoUrl / primaryColor
  -> manifest name/short_name/theme_color
```

Tenant brand must not control:

```text
start_url
scope
display
service worker scope
manifest architecture
```

## 5. Change Authority

Authorized:
- Add Platform PWA resolver/contract if needed.
- Add generated manifest route matching current Next.js architecture.
- Update root manifest metadata to use generated manifest.
- Update `PwaRegister` install UI/copy to consume manifest identity.
- Add focused tests and source guards.

Not authorized:
- Add new PWA framework or offline engine.
- Modify product vertical business logic.
- Create Beauty V2-specific manifest or service worker.
- Allow tenant-provided start URLs or service worker scope.
- Change database schema or runtime tenant data.

## 6. UI -> Contract Reconciliation

The install banner is a Platform UI surface. Current implementation hard-codes Bella Spa copy and claims offline behavior while the service worker explicitly disables caching. V1 must map install display text to the generated Platform PWA identity and remove unsupported offline claims.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm Product Registry remains the canonical source for `defaultRoute`.
2. Confirm tenant brand overlay only affects display/branding fields.
3. Add generated manifest with required PWA fields.
4. Keep `scope = "/"` and `display = "standalone"`.
5. Confirm missing product falls back to `/dashboard`.
6. Confirm Beauty V2 uses shared `bella_spa` Product Registry default route rather than a product-specific PWA.
7. Confirm `PwaRegister` has no Bella Spa hard-code.
8. Confirm service worker remains no-cache/no-offline V1.
9. Run focused PWA tests.
10. Run targeted lint/typecheck where practical.
11. Run `git diff --check` and stop at V1.

## 9. Verification Evidence

Implemented V1:
- Added `src/platform/pwa/platform-pwa-contract.ts` as the Platform-owned resolver for `PlatformPwaIdentity`.
- Added generated `/manifest.webmanifest` route that resolves current tenant `product_key` through Product Registry and applies tenant brand overlay only to display fields.
- Updated root layout manifest metadata to `/manifest.webmanifest`.
- Kept `public/manifest.json` as neutral static fallback with `start_url = /dashboard`, `scope = /`, and `display = standalone`.
- Updated `PwaRegister` to fetch manifest identity for install UI/copy and removed Bella Spa/offline install copy.
- Simplified `public/sw.js` to registration/installability only: no precache, no runtime cache, no offline fallback.

Automated/local:
- `npx jest src/platform/pwa/platform-pwa-contract.test.ts --runInBand` -> PASS, 1 suite / 8 tests.
- `npx eslint src/platform/pwa/platform-pwa-contract.ts src/platform/pwa/platform-pwa-contract.test.ts src/app/manifest.webmanifest/route.ts src/app/layout.tsx src/components/common/PwaRegister.tsx` -> PASS.
- `rg "Bella Spa ERP|làm việc offline|Workbox|Serwist|cache\.addAll|caches\.open|respondWith"` over runtime PWA files -> runtime matches none; only test assertions contain the blocked strings.
- `git diff --check` -> PASS.

Not verified:
- `npm run typecheck:changed` invoked repository-wide strict `tsc`; stopped after 90 seconds without diagnostics. `TYPECHECK = NOT_VERIFIED`.

Gate result: `PLATFORM_PWA_CONTRACT = IMPLEMENTED_V1`.

---

# ARCHITECTURE GATE RESULT - HQ IDENTITY SEPARATION

> **Status:** PASS - HQ Identity Separation sealed; `TYPECHECK_NOT_VERIFIED`
> **Date:** 2026-10-03
> **Scope:** `/hq` identity and authorization only. Replace the experimental `tenant_type` slice with canonical `tenant.product_key = 'bella_hq'`, add direct HQ login, provision a separate HQ admin, and keep BabyCare data unchanged.

---

## 1. Bella OS/Product Development Process Gate

The requested change separates HQ portal identity from the BabyCare operating tenant. Gate decision: `PASS` for a narrow HQ auth/login change that reuses the existing Product Identity contract.

## 2. Product Manifest

In scope:
- HQ portal authorization.
- HQ direct login route.
- HQ tenant recognition by `product_key = 'bella_hq'`.
- HQ UI filters that exclude the HQ tenant from operating-tenant workflows.
- Inventory transfer central warehouse HQ tenant lookup.
- Runtime DB/Auth provisioning for HQ tenant/admin on the authorized target.
- Runtime smoke for HQ allow and BabyCare deny.

Out of scope:
- KPI/mock metric cleanup.
- Dashboard redesign.
- Healthcare H1-H12, Logistics E7.1/E7.2/E7.3, or product vertical kernel changes.
- Schema migration execution or changing the existing BabyCare tenant.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `tenants.product_key` | Platform product identity | Canonical tenant product identity |
| `checkHqAuth` | Platform/HQ auth boundary | Server-side HQ portal authorization |
| `/hq/login` | HQ portal auth entry | Direct HQ admin login |
| `/hq` components | HQ portal UI | Consume canonical identity for filters and labels |

## 4. Contract Dependency Map

```text
HQ Portal
  -> users.role
  -> users.tenant_id
  -> tenants.product_key = 'bella_hq'
  -> operating tenants where product_key != 'bella_hq'
```

## 5. Change Authority

Authorized:
- Replace experimental `tenant_type` consumers with `product_key = 'bella_hq'`.
- HQ server-action authorization update.
- Direct `/hq/login` route.
- HQ UI identity filters.
- Focused tests.
- Authorized runtime provisioning of `bella_hq` HQ tenant and HQ admin Auth user.
- Runtime smoke for `/hq/login`, `/hq`, `/hq/financial-overview`, and BabyCare admin denial.

Not authorized:
- New hardcoded HQ UUID.
- BabyCare-specific HQ identity.
- New `tenant_type` schema.
- Schema migration execution.
- BabyCare tenant mutation.
- KPI/mock data cleanup.
- Product vertical or kernel refactor.

## 6. UI -> Contract Reconciliation

Existing UI/action code treats `tenant.name === 'Bella Spa Headquarter'` as HQ identity. Tenant name is mutable display data and the current production record is also `product_key = 'bella_babycare'`. Canonical target for the separated HQ tenant is `product_key = 'bella_hq'`.

## 7. DB Provisioning Result

No migration in this code slice.

Completed with explicit runtime provisioning authority:
- Created HQ tenant `d33dd246-9d9c-4a95-bfff-03b4b51d4072` with `product_key = 'bella_hq'`.
- Created separate HQ Auth/public user `hq-admin@bellaspa.vn` with `role = 'admin'`.
- Bound HQ admin to tenant `d33dd246-9d9c-4a95-bfff-03b4b51d4072`.
- Left BabyCare tenant `0e66365b-42b0-420e-acca-f7d7692e125e` unchanged with `product_key = 'bella_babycare'`.
- Generated runtime smoke password was random, temporary, and not printed or stored in repo/docs/logs/commit.

## 8. 11 Automated Verification Gates Plan

1. Confirm no Healthcare/Logistics frozen kernel files changed.
2. Confirm no `tenant_type` code or migration remains in the HQ slice.
3. Confirm `checkHqAuth()` uses `product_key = 'bella_hq'`.
4. Confirm `/hq` pages redirect unauthorized users to `/hq/login`.
5. Confirm `/hq/login` verifies HQ auth after Supabase sign-in.
6. Confirm BabyCare admin with `product_key = 'bella_babycare'` is denied.
7. Confirm inventory HQ warehouse lookup uses `product_key = 'bella_hq'`.
8. Confirm `/hq` operating-tenant filters use canonical helper.
9. Run focused HQ auth/action tests.
10. Run `git diff --check`.
11. Provision HQ tenant/admin only after explicit authority, then run runtime smoke and stop.

## 9. Verification Evidence

Read-only/preflight:
- `.env.local` REST target read-back found `product_key = 'bella_hq'` count `0`.
- Existing BabyCare/HQ-shared tenant remains `product_key = 'bella_babycare'`; no DB mutation was executed.
- `supabase/migrations/20261003010000_add_hq_tenant_identity.sql` removed from the working tree; no replacement migration added.

Runtime provisioning:
- Target project ref: `lvnvkpyxtuilhrabtlwv`.
- HQ tenant created/read back: `d33dd246-9d9c-4a95-bfff-03b4b51d4072`, `name = Bella Spa Headquarter`, `status = active`, `product_key = bella_hq`.
- HQ admin created/read back: `hq-admin@bellaspa.vn`, `role = admin`, `tenant_id = d33dd246-9d9c-4a95-bfff-03b4b51d4072`.
- BabyCare admin read-back: `admin@bellaspa.vn`, `role = admin`, `tenant_id = 0e66365b-42b0-420e-acca-f7d7692e125e`, `product_key = bella_babycare`.
- Password was not printed or persisted.

Automated/local:
- `npx jest src/__tests__/hq-actions.test.ts src/__tests__/onboarding.test.ts --runInBand` -> PASS, 2 suites / 15 tests.
- `npx jest src/__tests__/inventory-transfer.test.ts --runInBand` -> PASS, 1 suite / 29 tests.
- `git diff --check` -> PASS.
- Focused `npx eslint` on HQ login/auth/action files -> PASS.
- `rg tenant_type` over HQ/auth/onboarding/domain slice -> no matches.

Runtime smoke:
- `hq-admin@bellaspa.vn` -> `/hq/login` -> `/hq` -> PASS.
- `hq-admin@bellaspa.vn` -> `/hq/financial-overview` -> PASS.
- `admin@bellaspa.vn` with BabyCare tenant context -> `/hq` -> `/hq/login` redirect -> DENIED/PASS.

Not verified:
- `npm run typecheck:changed` invoked repository-wide strict `tsc`; stopped after 90 seconds without diagnostics. `TYPECHECK = NOT_VERIFIED`.

Gate result: `HQ_IDENTITY_SEPARATION = SEALED`.
Residual: `TYPECHECK_NOT_VERIFIED`; rotate/change the temporary HQ admin password before operational handoff.

---

# ARCHITECTURE GATE RESULT - BEAUTY F5 REAL DB IDEMPOTENCY FIXTURE DRIFT

> **Status:** PASS - fixture-only repair for Beauty/F5 Real DB idempotency proof
> **Date:** 2026-10-03
> **Scope:** `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts` F5 AR reconciliation windows plus affected-test selector alignment for this Real DB file. No F5 RPC, Finance schema, Beauty business logic, tenant data, production DB, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

CI Real Database Business E2E failed because the Beauty/F5 idempotency proof called `f5_run_reconciliation` with an as-of timestamp before the AR ledger facts created by the fixture. The F5 AR read contract uses `finance_receivable_ledger.created_at <= p_reconciliation_as_of`, so the pass run could produce no persisted `f5_control_results` row for idempotent read-back and the mismatch leg could reconstruct AR from an incomplete F3 window. Gate decision: `PASS` for a fixture-only correction that derives the F5 as-of timestamp from the created AR ledger fact.

## 2. Product Manifest

In scope:
- Beauty/F5 Real DB test fixture windows for the matched and mismatch AR control runs.
- Preserve the same `passParams` object for duplicate idempotency proof.
- Keep `src/products/beauty-spa-v2/__tests__/beauty-spa-v2-real-db.test.ts` in the Real DB E2E lane, not the default unit Jest lane.

Out of scope:
- F5 RPC or schema changes.
- Finance F1/F3 posting semantics.
- Beauty session completion business logic.
- PR #200 HQ Identity Separation branch.
- Production or E2E database mutation outside the test run.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `finance_receivable_ledger.created_at` | Finance F3 AR canonical read basis | Timestamp used by F5 AR read contract |
| `finance_ar_facts_as_of` | Finance/F5 read contract | Filters AR facts by `created_at <= as_of` |
| Beauty/F5 Real DB test | Product integration proof | Must create a valid fixture inside the reconciliation window |
| `scripts/test-changed-files.mjs` | CI affected-test routing | Keeps Real DB files out of default Jest lane |

## 4. Contract Dependency Map

```text
Beauty completed service
  -> SemanticReceivableChargeService
  -> finance_receivable_ledger.created_at
  -> finance_ar_facts_as_of(as_of)
  -> f5_run_reconciliation
  -> f5_control_results idempotent read-back
```

## 5. Change Authority

Authorized:
- Adjust only the test fixture's F5 AR reconciliation timestamps.
- Add read-back of AR ledger timestamps inside the test if needed for deterministic fixture setup.
- Align affected-test direct exclusion with the existing Real DB scope router for the Beauty Real DB file.

Not authorized:
- Change F5 RPC behavior.
- Add migrations, constraints, or schema.
- Change Finance posting/ledger semantics.
- Change Beauty business logic or HQ PR #200.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm duplicate pass calls use the same params.
2. Confirm F5 AR read contract uses `finance_receivable_ledger.created_at <= as_of`.
3. Confirm Finance AR ledger facts are created before the test's F5 as-of timestamps.
4. Modify only the fixture timestamp/read-back.
5. Run Beauty/F5 targeted Real DB test.
6. Run Real DB E2E if credentials/environment are available.
7. Verify `passRun.run_id === duplicatePassRun.run_id`.
8. Run `git diff --check`.
9. Run affected tests where practical.
10. Keep PR #200 unchanged.
11. Stop after evidence; do not refactor F5 or Beauty logic.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BEAUTY SPA V2 TENANT DASHBOARD UI REDESIGN

> **Status:** PASS - Pure UI redesign for Beauty Spa V2 tenant dashboard matching reference design without changing any business logic or kernel contracts
> **Date:** 2026-10-03
> **Scope:** `src/app/dashboard/` Beauty Spa V2 view and sidebar tenant presentation. No database schema, RPC, RLS, business logic, accounting, Healthcare H1-H12, or Logistics E7.1-E7.3 changes.

---

## 1. Bella OS/Product Development Process Gate

The requested change is a complete visual redesign of the Beauty Spa V2 tenant dashboard (`beauty_spa`) to match the provided reference design (Bella BEAUTY SPA ERP dashboard layout). Gate decision: `PASS` for a dedicated frontend UI view that preserves all existing data services, real-time subscriptions, business invariants, and action contracts without altering any underlying business logic.

## 2. Product Manifest

In scope:
- `src/app/dashboard/components/BeautySpaV2DashboardView.tsx` matching the reference UI layout.
- Wiring `beauty_spa` tenant dashboard in `src/app/dashboard/page.tsx` to render the V2 UI view.
- Sidebar aesthetic alignment for `beauty_spa` tenant identity (Emerald theme `#062C24`, lotus logo, Playfair Display typography, exact navigation items).
- All 6 dashboard zones from reference image:
  1. Top Header & 5 Metric Summary Cards (Tổng Khách Hàng, Lịch Hẹn Hôm Nay, Doanh Thu Tháng 10, Đánh Giá Khách Hàng, Tỷ Lệ Khách Quay Lại)
  2. Column 1: Lịch Hẹn Hôm Nay (28) list with filter tabs (Tất cả, Đang phục vụ, Đang chờ, Hoàn thành)
  3. Column 2: Bella AI Copilot (BETA) insights card with purple gradient theme
  4. Column 3: Tài Chính Tháng 10 bar chart & financial summary breakdown
  5. Row 2: Hiệu Suất Kinh Doanh line chart, Top Kỹ Thuật Viên ranking table, Đánh Giá Khách Hàng rating breakdown
  6. Row 3: Cần Xử Lý Ngay (8) urgent cards list & Vật Tư & Tồn Kho summary grid

Out of scope:
- Backend database schema or RPC changes.
- Business logic or payment/session state transition modifications.
- Frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `BeautySpaV2DashboardView.tsx` | Beauty Spa Product UI | Render reference dashboard UI for `beauty_spa` tenant |
| `src/app/dashboard/page.tsx` | Dashboard Router | Routes `beauty_spa` tenant to `BeautySpaV2DashboardView` |
| `getDashboardPrimaryData` / `getDashboardSecondaryData` | Analytics / Core Services | Provides data facts to UI without logic mutation |

## 4. Contract Dependency Map

```text
Beauty Spa V2 Dashboard UI
  -> getDashboardPrimaryData()
  -> getDashboardSecondaryData()
  -> getImportantAlerts()
  -> Core/Spa Backend Data Services (Unchanged)
```

## 5. Change Authority

Authorized:
- Create `src/app/dashboard/components/BeautySpaV2DashboardView.tsx`.
- Update `src/app/dashboard/page.tsx` to render `BeautySpaV2DashboardView` when `tenantModuleKey === 'beauty_spa'` or `product.productKey === 'bella_spa'`.
- Update sidebar visual presets for Beauty Spa V2 tenant.

Not authorized:
- Modify business rules or server action handlers.
- Touch frozen Healthcare H1-H12 or Logistics E7.1-E7.3 kernels.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

All UI controls (date picker, branch selector, search input, notification bell, "+ TẠO BOOKING", appointment tabs, KTV table, AI copilot actions, urgent alert items) connect to existing contracts and state props.

## 7. Additive Migration Plan

No migration required. Pure UI enhancement.

## 8. 11 Automated Verification Gates Plan

1. Verify `beauty_spa` tenant identification.
2. Confirm no kernel files modified.
3. Build pixel-perfect Beauty Spa V2 dashboard view matching reference image.
4. Integrate with `src/app/dashboard/page.tsx`.
5. Ensure zero business logic mutations.
6. Verify responsive layout and interactive elements.
7. Run TypeScript type check.
8. Run ESLint check.
9. Run test suites.
10. Check git diff for cleanliness.
11. Output success summary and report `PASS`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - HAIRCUT PAYMENT TO F3 AR ALLOCATION HARDENING

> **Status:** PASS - narrow Core consumer hardening for Finance OS canonical payment-to-AR allocation
> **Date:** 2026-09-29
> **Scope:** `recordRemainingPayment` Finance AR allocation call only. Use persisted confirmed `revenue` fact for idempotent retries before calling the Finance OS allocation contract. No Finance schema/RPC migration, direct `finance_*` writes, Debt/Reconciliation, BabyCare, Healthcare, Education, Logistics, or Haircut audit reopen.

---

## 1. Bella OS/Product Development Process Gate

PR #168 merged the Finance OS canonical contract:

```text
confirmed payment
  -> F1 cash receipt
  -> F2 cash movement
  -> F3 receivable allocation
```

The remaining Haircut integration gap is the Core consumer boundary. On idempotent retry, the consumer may receive an existing persisted `revenue` row while the retry request payload has drifted. Gate decision: `PASS` for a minimum consumer fix that treats persisted `revenue` as the financial fact for allocation amount/status/payment metadata and leaves Finance OS ownership intact.

## 2. Product Manifest

In scope:
- `src/core/services/order/payment-actions.ts` allocation input selection.
- Existing idempotency lookup result from `revenue`.
- Focused unit regression for retry amount drift and pending payment skip.

Out of scope:
- Finance F1/F2/F3 invariant changes.
- Finance schema, RPC, RLS, or migration work.
- Product-owned AR allocation logic.
- Debt/Reconciliation.
- BabyCare, Healthcare, Education, or Logistics changes.
- Re-auditing completed Haircut areas.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `revenue` persisted payment row | Core/Product payment persistence | Authoritative payment fact supplied to Finance |
| Finance payment-to-AR allocation contract | Finance OS | Canonical F1/F2/F3 allocation orchestration |
| `recordRemainingPayment` | Core consumer | Bridges confirmed persisted payment fact to Finance OS contract |

## 4. Contract Dependency Map

```text
Haircut/Core confirmed persisted revenue
  -> recordRemainingPayment consumer
  -> allocateConfirmedBookingPaymentToFinanceAr
  -> Finance OS F1 cash receipt
  -> F2 cash movement
  -> F3 AR allocation
```

## 5. Change Authority

Authorized:
- Harden Core consumer input selection for Finance allocation.
- Use persisted `revenue.amount`, `revenue.status`, `revenue.payment_method`, `revenue.received_date`, and `revenue.notes` when present.
- Add focused tests proving retry payload drift does not change Finance allocation amount.

Not authorized:
- Change Finance OS invariants.
- Add or modify migrations/RPCs.
- Write directly to `finance_*` from Product/Core.
- Implement Debt/Reconciliation.
- Touch BabyCare or reopen Haircut audit.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm branch base is merged `origin/main` after PR #168.
2. Read Bella constitution and F3 AR constitution.
3. Confirm Finance OS allocation contract remains the authority.
4. Confirm current Core consumer calls Finance allocation after persisted payment/idempotency lookup.
5. Fix consumer to prefer persisted `revenue` financial fact on retries.
6. Add idempotent retry regression where request amount differs from persisted amount.
7. Add pending-payment skip regression.
8. Run focused Core payment action test.
9. Run Finance semantic allocation test.
10. Run `git diff --check`.
11. Stop at first real failure; do not wait on unrelated gates after a failure.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PR168 AFFECTED JEST REAL-DB ROUTING FIX

> **Status:** PASS - CI affected-test routing only, keep Finance real-DB verification suites out of the mock/unit integration lane
> **Date:** 2026-09-29
> **Scope:** `scripts/test-changed-files.mjs` related-test ignore list only. No Finance OS runtime, Product runtime, schema, RLS, Healthcare, Education, or Logistics change.

---

## 1. Bella OS/Product Development Process Gate

PR #168 became mergeable after the conflict resolution, but CI `Affected Unit and Integration Tests` selected Finance real-DB verification suites through Jest `--findRelatedTests` and failed with `TypeError: fetch failed`. The failing suites require real database credentials/environment and belong in the dedicated real-DB/Finance verification contract, not the mock affected unit/integration lane. Gate decision: `PASS` for a CI-only selector correction.

## 2. Product Manifest

In scope:
- Affected Jest routing in `scripts/test-changed-files.mjs`.
- Exclude Finance F1/F2 real-DB verification suites from the mock affected unit/integration lane.

Out of scope:
- Finance OS runtime behavior.
- Finance contract semantics.
- Product/Core payment behavior.
- Database schema, RLS, migrations, or data.
- Healthcare, Education, or Logistics kernel work.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `scripts/test-changed-files.mjs` | CI governance | Selects mock/unit integration tests related to changed files |
| `finance-f1-ledger-verification.test.ts` | Finance OS real-DB verification | Validates F1 ledger behavior against database-backed environment |
| `finance-f2-projection-worker.test.ts` | Finance OS real-DB verification | Validates F2 projection behavior against database-backed environment |

## 4. Contract Dependency Map

```text
PR changed Finance/Core source files
  -> affected Jest selector
  -> mock unit/integration lane
  -> exclude real-DB Finance verification suites
  -> dedicated real-DB/Finance verification remains responsible
```

## 5. Change Authority

Authorized:
- Add exact Finance real-DB verification test paths to the affected-test ignore list.

Not authorized:
- Change Finance runtime or tests to hide `fetch failed`.
- Disable the affected-test job.
- Remove dedicated real-DB verification coverage.
- Modify Product/Core payment logic.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

1. Confirm PR #168 conflict is resolved and mergeable.
2. Read failed CI log for `Affected Unit and Integration Tests`.
3. Identify failing suites as Finance F1/F2 database-backed verification suites.
4. Apply exact affected-test ignore patterns.
5. Run `node --check scripts/test-changed-files.mjs`.
6. Run affected selector locally for PR #168 changed files.
7. Run focused payment/Finance unit suites.
8. Run `git diff --check`.
9. Push CI-only selector fix.
10. Cancel stale/known-failed runs after failure to avoid wasting CI time.
11. Re-run PR CI and stop at first real failure.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - FINANCE OS CONFIRMED PAYMENT TO AR CONTRACT

> **Status:** PASS - minimal Finance OS canonical payment-to-AR allocation contract
> **Date:** 2026-09-29
> **Scope:** Confirmed payment -> F1 cash receipt -> F2 cash movement -> F3 receivable resolution/allocation. Haircut may only consume this contract after it is proven. No Haircut AR workaround, Payment Engine redesign, COA, Payroll, Debt/Reconciliation, BabyCare, Healthcare, Education, or Logistics change.

---

## 1. Bella OS/Product Development Process Gate

Source evidence proves the final Haircut Financial Truth gap is not Haircut core:

```text
Finance OS already has:
F1 postTransaction()
F2 CashProjectionWorker -> finance_cash_movements
F3 recognizeServiceReceivable()
F3 allocatePaymentToReceivable(invoiceId, cashMovementId)

Missing canonical path:
Confirmed Payment
  -> F1 Cash Receipt
  -> F2 Cash Movement
  -> Receivable Resolution
  -> Idempotent F3 Allocation
```

Gate decision: `PASS` for the smallest Finance OS semantic contract that accepts a confirmed payment, preserves tenant/idempotency, posts the cash receipt through F1, projects cash through the existing F2 worker/outbox path, resolves open receivables by canonical invoice metadata, and allocates without duplicate F3 allocation on retry.

## 2. Product Manifest

In scope:
- Finance OS payment-to-receivable semantic contract.
- Existing Finance OS primitives only: F1 ledger, F2 cash projection, F3 invoice/receivable/allocation.
- Minimal Haircut consumer wiring only after the Finance OS contract is tested.

Out of scope:
- Haircut-owned AR/cash movement implementation.
- Payment engine redesign.
- COA/accounting posting repair.
- Payroll/commission.
- Debt/Reconciliation implementation.
- BabyCare, Preschool, Healthcare, Education, Logistics.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| Confirmed payment semantic contract | Finance OS | Canonical bridge from external payment fact to financial truth |
| F1 cash receipt | Finance OS Ledger | Double-entry cash/AR receipt |
| F2 cash movement | Finance OS Cash/Treasury | Projected liquidity movement from F1 event |
| F3 invoice/receivable/allocation | Finance OS AR | Receivable truth and settlement |
| Haircut payment action | Product/Core consumer | Supplies tenant/payment/source facts only |

## 4. Contract Dependency Map

```text
Haircut confirmed payment
  -> Finance OS confirmed payment receivable allocation contract
  -> F1 Ledger postTransaction
  -> F1 outbox finance.transaction.posted.v2
  -> F2 CashProjectionWorker
  -> finance_cash_movements
  -> F3 invoice/receivable resolver
  -> finance_allocate_payment
```

## 5. Change Authority

Authorized:
- `src/platform/finance/contracts/receivable-charge.contract.ts`
- `src/platform/finance/services/semantic-receivable-charge.service.ts`
- `src/platform/finance/gateways/supabase-receivable-charge.gateway.ts`
- Focused Finance OS tests.
- Minimal Haircut/Core consumer call through `ACR-2026-007` metadata for PR #168 if `src/core` files must change.

Not authorized:
- New AR schema.
- Direct product writes to `finance_cash_movements`.
- Direct Haircut allocation workaround.
- COA changes.
- Payroll changes.
- Debt/Reconciliation feature work.
- Payment engine redesign.

## 6. UI -> Contract Reconciliation

No UI change. This is backend financial truth plumbing only.

## 7. Additive Migration Plan

No migration planned. Existing Finance OS primitives are sufficient unless implementation evidence proves a concrete contract gap.

## 8. 11 Automated Verification Gates Plan

1. Verify source contract evidence for F1/F2/F3 existing primitives.
2. Add generic confirmed-payment input/result types.
3. Add Finance OS service method for payment-to-AR allocation.
4. Keep account semantics scoped to proven TT99 AR mapping plus canonical cash/bank payment-method mapping.
5. Resolve receivables through invoice metadata, not product-owned AR tables.
6. Preserve payment idempotency key through F1 and F3 allocation retry checks.
7. Add focused Finance OS unit tests for allocation, retry, and over-allocation block.
8. Wire Haircut payment only through the Finance OS contract if required.
9. Run focused Finance/Haircut payment tests.
10. Run scoped TypeScript or repository-available equivalent.
11. Run `git diff --check` and stop before Debt/Reconciliation re-evaluation.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BABYCARE SPA SESSION REVIEW RLS FIX

> **Status:** PASS - keep Babycare/Beauty Spa session completion authorized by the existing server action, and write only the system-owned `session_reviews` placeholder through an operation client when service-role credentials are configured
> **Date:** 2026-09-29
> **Scope:** Babycare/Beauty Spa session completion review-placeholder side effect only; no schema migration, data migration, Product UI redesign, Healthcare/Education/Logistics kernel work, or accounting policy change

---

## 1. Bella OS/Product Development Process Gate

Observed runtime symptom: updating a Babycare/Spa session to completion fails with `new row violates row-level security policy for table "session_reviews"` while creating the `pending_review` placeholder. This is a product workflow bug in the shared Beauty/Spa completion path, not a new OS capability. Gate decision: `PASS` for a minimal server-side side-effect fix after existing tenant and action authorization have already succeeded.

## 2. Product Manifest

In scope:
- Existing Babycare/Beauty Spa session completion/update workflow.
- Existing `session_reviews` placeholder record created after a session is completed.
- Preserve tenant-scoped checks before writing the placeholder.
- Use existing Supabase admin env pattern for the placeholder write only.

Out of scope:
- Healthcare H1-H12, Logistics E7.1-E7.3, Education product contracts.
- Database schema, production data, RLS policy migration, UI redesign, salary/accounting policy redesign.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `session_logs` | Beauty/Spa booking workflow | Source session state and completion event |
| `bookings.customer_id`, `bookings.assigned_ktv_id`, `bookings.tenant_id` | Beauty/Spa booking workflow | Tenant-scoped source for placeholder review |
| `session_reviews` | Beauty/Spa customer feedback workflow | Analytics/customer-review target table |
| Server action authorization | Shared order/session service | Confirms current user tenant and role before completion side effects |

## 4. Contract Dependency Map

Admin/KTV session update -> existing server action tenant and role checks -> session completion side effects -> create pending `session_reviews` placeholder -> customer portal later updates the review.

## 5. Change Authority

Authorized:
- Change the internal server-side client used for `session_reviews` placeholder lookup/insert.
- Keep existing tenant equality checks before using the operation client.
- Preserve rollback behavior when placeholder creation still fails.

Not authorized:
- Loosen product UI permissions.
- Modify frozen Healthcare/Logistics kernel files.
- Change RLS policies or migrate data without explicit approval.
- Introduce `any` types.

## 6. UI -> Contract Reconciliation

No UI redesign. The current UI action "Cập nhật thông tin" maps to the existing `updateSessionLog` server action. The failing contract is the system side-effect that creates a review placeholder after a completed session.

## 7. Additive Migration Plan

No migration. The fix is code-only and does not create, alter, or backfill database objects.

## 8. 11 Automated Verification Gates Plan

1. Architecture scope check: no Healthcare/Logistics/Education kernel files touched.
2. Type-level check for changed order completion helper.
3. Focused regression where placeholder lookup/insert uses operation client fallback.
4. Existing completion rollback behavior remains unchanged.
5. Tenant check remains before placeholder creation.
6. No direct product access to `hc_*` tables.
7. No new `any` types.
8. No schema migration.
9. `git diff --check`.
10. Focused tests if an existing test target is available for this helper.
11. Manual runtime evidence remains required for deployed Supabase env/RLS state.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - BELLA AUTO PHASE 5 REAL DB E2E FIXTURE IDEMPOTENCY

> **Status:** PASS - test fixture idempotency fix only
> **Date:** 2026-09-29
> **Scope:** `src/__tests__/bella-auto-phase5-experience.test.ts` setup for `auto_journey_stages` only. No Bella Auto runtime behavior, schema, RPC, service contract, Haircut, Finance, Healthcare, Education, Logistics, Payment, Payroll, or COA change.

---

## 1. Bella OS/Product Development Process Gate

Evidence from PR #166 CI showed `Real Database Business E2E` failed before any Haircut assertion due to Bella Auto Phase 5 fixture setup:

```text
auto_journey_stages
tenant = Test Tenant Bella Auto Phase5 E2E
code = delivered
ERROR = duplicate key value violates unique constraint uq_auto_journey_stages_code
```

Source of truth:
- Migration `20260803230000_create_auto_journeys.sql` defines `auto_journey_stages` with unique `(tenant_id, code)`.
- The test intentionally reuses the same test tenant by name across runs.

Gate decision: `PASS` for a minimal test-only change that reuses an existing `delivered` stage for the test tenant when present, and only deletes the stage if this run created it.

## 2. Product Manifest

In scope:
- Bella Auto Phase 5 real-DB test fixture setup.
- `auto_journey_stages` lookup/insert idempotency for `code = delivered`.

Out of scope:
- Bella Auto production services.
- Journey schema or constraints.
- Haircut PR #166 implementation.
- Finance/accounting behavior.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `auto_journey_stages` | Bella Auto journey setup | Stage catalog rows scoped by tenant and code |
| `bella-auto-phase5-experience.test.ts` | Real DB E2E test fixture | Creates/reuses setup data for Phase 5 experience tests |

## 4. Contract Dependency Map

```text
Real DB test tenant
        ↓
auto_journey_stages(tenant_id, code = delivered)
        ↓
auto_customer_journeys.current_stage_id
        ↓
Bella Auto Phase 5 services under test
```

## 5. Change Authority

Authorized:
- Make the Real DB test fixture setup idempotent for the existing unique `(tenant_id, code)` stage contract.

Not authorized:
- Change Bella Auto stage semantics.
- Change `auto_journey_stages` schema/constraint.
- Change runtime services.
- Change unrelated verticals.

## 6. UI -> Contract Reconciliation

No UI change.

## 7. Additive Migration Plan

No migration. No DB mutation outside normal test fixture behavior.

## 8. 11 Automated Verification Gates Plan

1. Confirm CI failure is Bella Auto Phase 5 fixture setup.
2. Confirm canonical unique stage contract from migration.
3. Patch fixture lookup-before-insert.
4. Ensure reused stage is not deleted by cleanup.
5. Run focused Bella Auto Phase 5 real-DB test if feasible.
6. Run `git diff --check`.
7. Re-run PR CI and verify Real Database Business E2E.
8. Verify Haircut accounting files remain unchanged after this fix.
9. Verify no `src/core` diff is introduced.
10. Verify migration/build/unit checks still pass in CI.
11. Stop after CI evidence; no further Bella Auto scope expansion.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - HAIRCUT ACCOUNTING COA AND PACKAGE SALE FIX

> **Status:** PASS - exact Haircut tenant COA bootstrap plus minimal `PACKAGE_SALE` payment-method propagation
> **Date:** 2026-09-29
> **Scope:** Legacy accounting posting readiness for the 3 active `bella_haircut` tenants and the `PACKAGE_SALE` producer path only. No F3 payment allocation, Debt/Reconciliation, Payroll, BabyCare, Payment Engine redesign, or Finance OS kernel change.

---

## 1. Bella OS/Product Development Process Gate

Evidence proves two independent operational accounting gaps:

```text
A. Tenant COA/bootstrap configuration
   3 active bella_haircut tenants are missing active accounting_accounts:
   111, 112, 131, 334, 3387, 6421, 5113, 5111

B. PACKAGE_SALE producer mapping
   bank_transfer confirmed revenue emitted PACKAGE_SALE, but runtime path hard-coded 111.
   Canonical accounting template requires 111_OR_112 based on payment_method.
```

Gate decision: `PASS` for the minimum scoped implementation that seeds canonical existing COA definitions only for the 3 active Haircut tenants and propagates `paymentMethod` through `PACKAGE_SALE` to resolve `111/112`.

## 2. Product Manifest

In scope:
- `bella_haircut` tenants with current active status:
  - Haircut Shop
  - P1C-haircut-2055f3bb Tenant
  - P1D1-haircut-75b42702 Tenant
- Existing legacy accounting COA definitions from `seed_default_coa`.
- `PACKAGE_SALE` outbox payload and accounting worker producer path.
- Focused tests for `PACKAGE_SALE` payment-method account selection.

Out of scope:
- F3 Payment -> AR Allocation.
- Debt/Reconciliation.
- Payroll/Commission.
- BabyCare.
- Payment Engine redesign.
- Finance OS F1/F2/F3 kernel changes.
- Ad hoc account codes or accounting policy invention.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `accounting_accounts` rows | Tenant accounting configuration | Tenant-specific chart of accounts for legacy accounting postings |
| `seed_default_coa` definitions | Legacy accounting bootstrap | Canonical existing source for required legacy COA codes |
| `PACKAGE_SALE` outbox payload | Haircut/Beauty payment producer | Carries payment fact into legacy accounting worker |
| `RevenueRecognitionService.handlePackageSale` | Legacy accounting producer | Posts package/deposit/remaining-payment journal entry |
| `111_OR_112` template | Accounting event template | Canonical payment-method-dependent account selection |

## 4. Contract Dependency Map

```text
Haircut remaining payment / package sale revenue
        ↓
revenue.payment_method
        ↓
PACKAGE_SALE accounting outbox reference_id
        ↓
accounting worker
        ↓
payload.paymentMethod or revenue.payment_method fallback
        ↓
RevenueRecognitionService.handlePackageSale(paymentMethod)
        ↓
resolvePaymentAccountCode()
        ↓
111 or 112 + 3387 journal lines
```

COA bootstrap:

```text
Active bella_haircut tenant
        ↓
existing seed_default_coa canonical definitions
        ↓
tenant accounting_accounts
```

## 5. Change Authority

Authorized:
- Add an exact, idempotent migration scoped to the 3 verified active Haircut tenant IDs, using the existing canonical `seed_default_coa` function.
- Allow `PACKAGE_SALE` payloads to carry `paymentMethod` when known.
- Update `PACKAGE_SALE` worker handling to resolve `paymentMethod` from payload or the referenced revenue record.
- Update `handlePackageSale` to resolve `111/112` using existing `resolvePaymentAccountCode`.
- Add focused tests.

Not authorized:
- Create new accounting policy.
- Add arbitrary account definitions by hand when `seed_default_coa` exists.
- Touch Finance OS kernel primitives.
- Open F3 payment allocation, Debt/Reconciliation, Payroll, BabyCare, or Payment Engine redesign.

## 6. UI -> Contract Reconciliation

No UI redesign. No UI action contract is changed.

## 7. Additive Migration Plan

Additive/configuration-only migration:

```text
For exactly the 3 active bella_haircut tenant IDs:
  SELECT public.seed_default_coa(tenant_id)
  ensure 5113 from existing TT133 service revenue migration definition
```

The seed function is idempotent via `ON CONFLICT (tenant_id, account_code) DO NOTHING`. Account `5113` is also idempotent and uses the existing canonical definition from `20260603010000_tt133_service_revenue_5113.sql`, because the seed function predates that account.

## 8. 11 Automated Verification Gates Plan

1. Source evidence recheck for the 3 Haircut tenant IDs.
2. Migration scope inspection: exact tenant IDs only.
3. Focused unit test for `handlePackageSale` bank transfer -> account `112`.
4. Focused unit test for `handlePackageSale` cash -> account `111`.
5. Focused payload test or existing test update proving `paymentMethod` can be emitted when known.
6. Focused worker path test proving `paymentMethod` is resolved from the referenced revenue when absent from payload.
7. TypeScript scoped check if available/feasible.
8. Focused Jest for accounting/revenue recognition.
9. `git diff --check`.
10. Read-only post-migration DB verification after applying migration.
11. Focused accounting worker/runtime verification for prior `PACKAGE_SALE`/`SESSION_DONE` missing-account failures if safe and explicitly scoped.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - SPA COMPLETION ROLLBACK IS_IN_CARE FIX

> **Status:** PASS - restore pre-completion `bookings.is_in_care` during shared completion rollback
> **Date:** 2026-09-29
> **Scope:** Bella Spa shared completion rollback integrity only; no Payroll, Finance, Accounting, Haircut-specific code, schema, migration, UI redesign, or completion semantics redesign

---

## 1. Bella OS/Product Development Process Gate

The confirmed gap is rollback integrity, not a new product capability: the completion path can set `bookings.is_in_care = false` when the package reaches completion, while rollback currently restores only `completed_sessions` and `status`. Gate decision: `PASS` for the minimum rollback snapshot/payload correction that restores `is_in_care` to its pre-completion value when downstream completion side effects fail.

## 2. Product Manifest

In scope:
- Shared Beauty/Spa session completion rollback payload.
- Current booking snapshot captured before booking progress mutation.
- Focused regression proving failure-path rollback restores `completed_sessions`, `status`, and `is_in_care`.
- Focused regression preserving happy-path completion behavior where final package completion sets `is_in_care = false`.

Out of scope:
- Payroll, salary policy, Finance, Accounting policy, Haircut-specific code, UI, data migration, production data updates, or completion engine redesign.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `bookings.completed_sessions` | Beauty/Spa booking workflow | Completion progress counter |
| `bookings.status` | Beauty/Spa booking workflow | Booking lifecycle state |
| `bookings.is_in_care` | Beauty/Spa booking workflow | Active-care flag cleared on completed package |
| Completion rollback payload | Shared order/session completion service | Restores pre-completion booking workflow state after downstream failure |

## 4. Contract Dependency Map

```text
Session completion
        ↓
Count completed session logs
        ↓
Update booking progress/status/is_in_care
        ↓
Downstream completion side effects
        ↓
On failure: rollback booking fields to pre-completion snapshot
```

## 5. Change Authority

Authorized:
- Include `is_in_care` in the pre-completion booking snapshot.
- Include `is_in_care` in rollback payload with its original value.
- Add focused tests for the failure path and existing happy path.

Not authorized:
- Change the meaning of `is_in_care`.
- Change completion success semantics.
- Modify Payroll, Finance, Accounting, Haircut-specific code, schema, migrations, or UI.

## 6. UI -> Contract Reconciliation

No UI redesign. This is a service rollback integrity fix.

## 7. Additive Migration Plan

No database migration. `bookings.is_in_care` already exists in generated database types.

## 8. Verification Plan

- Reproduction test: completion reaches package completion with initial `is_in_care = true`, a downstream failure is forced, and rollback restores `completed_sessions`, `status`, and `is_in_care`.
- Happy-path test: successful package completion still sets `is_in_care = false`.
- Focused Jest for completion business rules and completion accounting side effects.
- `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 TUITION RECOGNITION POLICY FOUNDATION

> **Status:** PASS - decouple invoice issuance from tuition service recognition and add Product-owned PERIOD_COMPLETION policy foundation
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 recognition boundary only; no Finance OS, TT99 mapping, payment, prepayment, 3387, refund, tax, e-invoice, or browser/production mutation

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is a business-boundary mismatch: Preschool invoice issuance is not proof that tuition service has been performed. Gate decision: `PASS` for the smallest Product-owned correction that removes direct recognition from `InvoiceIssuanceService`, records tenant/effective-dated recognition policy vocabulary, records explicit service-period completion evidence, and emits Finance OS `TUITION_SERVICE_RECOGNIZED` only through a separate PERIOD_COMPLETION service.

## 2. Product Manifest

In scope:
- Preschool Product policy vocabulary: `PERIOD_COMPLETION`, `TIME_BASED`, `MILESTONE_EVENT`.
- Runtime execution for `PERIOD_COMPLETION` only.
- Explicit tuition service-period completion evidence.
- Tuition-only eligible amount guard.
- Reuse of sealed Finance OS semantic receivable contract after Preschool proves recognition eligibility.

Out of scope:
- Payment, prepayment, `111/112`, `3387`, refund, discount accounting, tax, VAT, e-invoice.
- Finance OS, TT99, 131/511, accounting periods, or semantic mapping changes.
- `TIME_BASED` or `MILESTONE_EVENT` execution.
- Generic policy framework or `edu_fin_*` cleanup.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `edu_fin_invoices` | Preschool Product Finance | Billing/invoice workflow state, not service-performance proof |
| `edu_fin_tuition_recognition_policies` | Preschool Product Finance | Tenant/effective-dated recognition policy vocabulary |
| `edu_fin_tuition_service_period_completions` | Preschool Product Finance | Explicit completion evidence for PERIOD_COMPLETION |
| `TUITION_SERVICE_RECOGNIZED` | Finance OS | Accounting execution after valid business semantic arrives |

## 4. Contract Dependency Map

```text
Invoice issuance
        ↓
Preschool invoice state only

Explicit service-period completion
        ↓
Tenant effective-dated recognition policy
        ↓
PERIOD_COMPLETION recognition service
        ↓
TUITION_SERVICE_RECOGNIZED
        ↓
Finance OS semantic receivable path
```

## 5. Change Authority

Authorized:
- Preschool Product Finance invoice issuance decoupling.
- Additive Preschool Product finance policy/completion tables.
- Separate Product-owned recognition service for PERIOD_COMPLETION only.
- Focused regression tests and this gate record.

Not authorized:
- Finance OS changes.
- Payment/prepayment/accounting slices.
- Generic policy framework.
- Production policy/config/completion creation.

## 6. UI -> Contract Reconciliation

No UI redesign. Existing invoice issue action remains a billing workflow action and must not claim revenue/service recognition.

## 7. Additive Migration Plan

One additive migration:

```text
supabase/migrations/20260928000000_preschool_tuition_recognition_policy_foundation.sql
```

It creates only Product-owned tuition recognition policy and service-period completion evidence tables plus tenant RLS/overlap guard.

## 8. Verification Plan

- Focused Jest proves invoice issuance emits zero Finance recognition.
- PERIOD_COMPLETION fails closed without completion evidence.
- Valid completion + effective policy emits one Finance semantic request.
- No policy, overlapping policy, unsupported policy types, cross-tenant invoice scope, and non-tuition amount all fail closed.
- Scoped ESLint, `git diff --check`, and one `typecheck:changed` attempt.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 BILLING PERIOD PROVENANCE FIX

> **Status:** PASS - remove hardcoded September 2026 billing-period provenance from Preschool P7 invoice compilation
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 invoice compile API/UI only; no Finance OS, payment, accounting policy, runtime config, or production data mutation

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is `BLOCKED_BY_HARDCODED_BILLING_PERIOD_PROVENANCE`: the P7 finance API manufactured a September 2026 billing period from source-code constants before invoice compilation. Gate decision: `PASS` for the smallest Product-owned consumer fix that requires a tenant-scoped `billingPeriodId` and derives invoice due date from the persisted P7 billing period.

## 2. Product Manifest

In scope:
- Preschool Product Finance API `compileDraftInvoice`.
- Preschool Finance UI billing-period selection.
- Existing `edu_fin_billing_periods` repository contract.
- Focused provenance regression tests.

Out of scope:
- Creating fee structures, billing periods, invoices, or Finance periods.
- Finance kernel, TT99, account mapping, payments, 3387, refund, tax, VAT, e-invoice.
- Generic billing configuration framework or legacy `edu_fin_*` cleanup.

## 3. Ownership Map

| Artifact | Owner Context | Role |
|---|---|---|
| `edu_fin_billing_periods` | Preschool Product Finance | Product billing-period configuration |
| `edu_fin_invoices` | Preschool Product Finance | Product invoice workflow/read model |
| Finance OS semantic receivable contract | Finance OS | Downstream accounting recognition boundary |

## 4. Contract Dependency Map

```text
Preschool operator selects configured billingPeriodId
        ↓
API resolves tenant-scoped edu_fin_billing_periods row
        ↓
TuitionBillingService.compileDraftInvoice
        ↓
Invoice dueDate comes from persisted billing period
        ↓
Later issueInvoice may recognize tuition through Finance OS
```

## 5. Change Authority

Authorized:
- Remove source-code billing-period/date hardcodes from Preschool Product API/UI.
- Require tenant-scoped billing-period lookup for invoice compilation.
- Add focused regression tests and gate record.

Not authorized:
- Finance OS changes.
- Runtime setup or production data mutation.
- New billing framework or accounting policy.

## 6. UI -> Contract Reconciliation

The staff billing UI previously collected only student and a due-date field while the API supplied the billing period. The corrected UI consumes real active billing periods from the API and sends only the selected `billingPeriodId`; source-code dates no longer create business truth.

## 7. Additive Migration Plan

No migration. This is a Product API/UI consumer correction over existing P7 tables.

## 8. Verification Plan

- Focused static provenance tests prove the route no longer contains September 2026 constants or `createBillingPeriod`.
- API guard test proves invoice compilation requires `billingPeriodId`, tenant-scoped lookup, active status, and due date from the persisted period.
- Existing tuition recognition test proves Finance connector dates come from billing-period fields rather than source-code September constants.
- Scoped ESLint and `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL P7 FINANCE OS TUITION RECOGNITION CONNECTION

> **Status:** PASS - connect Preschool P7 issued tuition invoice to sealed Finance OS semantic receivable path
> **Date:** 2026-09-28
> **Scope:** Preschool Product P7 -> Finance OS `TUITION_SERVICE_RECOGNIZED` only; no payment, 3387, refund, discount, tax, e-invoice, or `edu_fin_*` cleanup

---

## 1. Bella OS/Product Development Process Gate

The sealed Finance OS milestone proves `TUITION_SERVICE_RECOGNIZED -> TRADE_RECEIVABLE 131 / SERVICE_REVENUE 511 -> F1 ledger + F3 AR` with recovery and idempotency. The current Preschool blocker is a stale P7 consumer: issuing a Preschool invoice updates `edu_fin_invoices` but does not cross the Finance OS semantic boundary. Gate decision: `PASS` for the smallest Product-owned connector that sends issued tuition-only invoices to the sealed Finance OS semantic receivable contract.

## 2. Product Manifest

In scope:
- Preschool Product invoice issuance path.
- Reuse existing `SemanticReceivableChargeService` and `SupabaseReceivableChargeGateway`.
- Source identity: `PRESCHOOL_P7_TUITION_INVOICE` + `edu_fin_invoices.id`.
- Canonical student identity: `edu_fin_invoices.student_party_id`.
- Billing period dates as service period and recognition date.
- Fail-closed for non-tuition invoice lines so meal/discount/tax are not silently posted.

Out of scope:
- Payment, cash, `111/112`, customer advance, `3387`, refund, discount, tax, VAT, e-invoice.
- Deleting or refactoring `edu_fin_*`.
- New Finance kernel, Billing kernel, or generic integration framework.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_fin_invoices` | Preschool Product Finance | Product invoice workflow/read model |
| `TUITION_SERVICE_RECOGNIZED` contract | Finance OS | Canonical business semantic for recognized service receivable |
| `finance_invoices` / `finance_transactions` / AR | Finance OS | Canonical financial truth |

## 4. Contract Dependency Map

```text
Preschool P7 issueInvoice
        ↓
edu_fin_invoices(student_party_id, tuition line, billing period)
        ↓
Finance OS semantic receivable contract
        ↓
TRADE_RECEIVABLE / SERVICE_REVENUE
        ↓
131 / 511
        ↓
Finance invoice + ledger + AR position
```

P7 does not supply account code, chart-of-account regime, tax treatment, or payment semantics.

## 5. Change Authority

Authorized:
- Preschool Product Finance issuance service.
- Preschool Product Finance API service construction.
- Tenant-scoped repository read for billing period.
- Focused service tests and this architecture gate artifact.

Not authorized:
- Finance kernel/accounting policy changes.
- Education Kernel changes.
- `edu_fin_*` cleanup or broad migration/RLS work.
- Payment/refund/discount/tax/e-invoice implementation.

## 6. UI -> Contract Reconciliation

No UI redesign. Existing UI `issueInvoice` action should now be truthful: success requires the Product invoice issuance service to invoke Finance OS recognition when configured by the server API.

## 7. Additive Migration Plan

No migration. This connector consumes already deployed P7 and Finance OS contracts.

## 8. Verification Plan

- Focused service tests prove tuition-only issuance calls Finance OS semantic contract.
- Recovery/idempotency: already issued P7 invoice still calls Finance OS by same business source.
- Unsupported non-tuition lines fail closed before P7 status update.
- Existing canonical student connection tests remain green.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - FINANCE OS TT99 SLICE 1 ACCOUNTING ACTIVATION

> **Status:** PASS - TT99 Slice 1 accounting policy proven for tuition service recognition and target-tenant semantic mapping activation
> **Date:** 2026-09-27
> **Scope:** Finance OS `TUITION_SERVICE_RECOGNIZED` receivable contract + TT99 Slice 1 semantic mappings only; no Preschool connector, no payment, no 3387, no tax, no e-invoice

---

## 1. Bella OS/Product Development Process Gate

The proven blocker is not Preschool Finance UI logic. The Finance OS F3 AR kernel already supports draft invoice, invoice line, finalization, F1 transaction posting, AR ledger, and AR position creation, but the public usable path still requires callers to supply `revenue_account_code`. Under the Accounting Legal-Source Rule, the owner has now provided an authoritative accounting specification for Slice 1 only: `TUITION_SERVICE_RECOGNIZED`, where the education service obligation has already been performed and the amount is eligible for accounting revenue recognition under TT99-effective 2026 enterprise accounting. Gate decision: `PASS` for a Finance-owned contract that maps that semantic to `TRADE_RECEIVABLE -> 131` and `SERVICE_REVENUE -> 511` through Finance-owned, source-backed semantic GL mappings.

## 2. Product Manifest

In scope:
- Finance OS public contract for a semantic receivable charge.
- Finance-owned service/facade that creates/finalizes one AR invoice through existing F3 RPCs.
- Finance-owned implementation of only the accounting mappings specified by authoritative evidence: `TRADE_RECEIVABLE` and `SERVICE_REVENUE`.
- Forward-only activation of the minimum proven TT99 Slice 1 accounts and semantic mappings for the isolated Preschool browser-smoke tenant.
- Idempotency based on Finance-owned source identity.
- Focused tests proving account-code-free caller contract and AR RPC orchestration.

Out of scope:
- Preschool connector/payment implementation.
- P7 `edu_fin_*` runtime changes.
- TT133, TT200, or full TT99 regime engine.
- Customer advance / 3387 / payment / refund / tax / e-invoice treatment.
- New payment allocation flow.
- New Billing Kernel redesign.
- Broad Finance RLS/migration repair.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| semantic receivable charge contract | Finance OS | Vertical-neutral request to recognize a receivable charge |
| semantic GL mapping | Finance OS / authoritative accounting specification | Internal account code selection by semantic and effective date; never vertical supplied and never AI-guessed |
| `finance_invoices` / `finance_invoice_lines` | Finance F3 AR | Canonical invoice header and lines |
| `finance_transactions` / `finance_transaction_lines` | Finance F1 Ledger | Posted accounting transaction |
| `finance_receivable_ledger` / `finance_receivable_positions` | Finance F3 AR | AR subledger fact and derived position |

## 4. Contract Dependency Map

```text
Vertical/Product semantic charge
        ↓
Finance OS semantic receivable charge contract
        ↓
Finance-owned semantic GL mapping as of recognition date
        ↓
finance_create_draft_invoice
        ↓
finance_add_invoice_line
        ↓
finance_finalize_invoice
        ↓
finance_post_transaction
        ↓
finance_transactions + finance_receivable_ledger + finance_receivable_positions
```

The product/vertical caller must not provide `revenue_account_code`, account code, chart-of-account regime, or TT policy.

## 5. Change Authority

Authorized:
- Finance OS contract/service files for `TUITION_SERVICE_RECOGNIZED`.
- Finance-owned semantic GL mapping resolution for `TRADE_RECEIVABLE` and `SERVICE_REVENUE`.
- Finance-owned runtime migration for effective-dated semantic mapping resolution and target-tenant TT99 Slice 1 activation.
- Focused Finance OS tests for semantic input, account-code-free caller boundary, posting orchestration, and idempotency.
- This architecture gate artifact.

Not authorized:
- Education Kernel changes.
- Preschool Finance connector/payment path.
- Existing P7 product runtime changes.
- Regime-specific chart-of-accounts policy beyond Slice 1 proven semantics.
- Historical migration rewrite or migration-history repair.

## 6. UI -> Contract Reconciliation

No UI change in this gate. The stale consumer is any vertical that would otherwise call F3 AR RPCs directly and supply account codes. The canonical contract is now Finance OS semantic charge input.

## 7. Additive Migration Plan

One forward-only migration is required:

```text
supabase/migrations/20260927080000_finance_tt99_slice1_accounting_activation.sql
```

The migration:
- reuses `public.finance_control_account_mappings` as the Finance-owned semantic mapping storage;
- adds effective-date and authority metadata only if missing;
- replaces the semantic mapping RPCs so unsupported semantics fail closed;
- activates only target tenant account `131` and account `511`;
- saves `TRADE_RECEIVABLE -> 131` and `SERVICE_REVENUE -> 511` effective `2026-01-01`;
- does not seed a full chart of accounts, activate `5111`, post tuition, connect Preschool, or touch other tenants.

Post-deploy verification found a narrow PostgREST overload ambiguity between the repo-owned `uuid, varchar, date, varchar` RPC signature and an older `uuid, text, date, text` signature. A follow-up migration may drop only the obsolete `text` overload:

```text
supabase/migrations/20260927081000_finance_drop_legacy_semantic_gl_text_overload.sql
```

This follow-up does not alter accounts, mappings, COA data, accounting semantics, invoices, journals, or AR state.

The runtime must refuse to post if the required semantic mappings are absent or not marked as proven for `VI_TT99_2025|99/2025/TT-BTC|PROVEN`.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Finance OS files only.
- Gate 2 Contract Boundary: vertical request contains semantic charge only; no account code.
- Gate 3 Tenant Isolation: tenant id is required and passed through every F3 RPC/query.
- Gate 4 RLS & Authorization: no RLS change; existing F3 RPC privileges unchanged.
- Gate 5 Database Migration Safety: one bounded forward-only Finance migration; no historical migration rewrite.
- Gate 6 Event-After-Persistence: no new event path.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: semantic GL mapping is effective-date aware.
- Gate 9 Rule Governance: accounting regime and posting rule are source-backed for Slice 1 only.
- Gate 10 Audit Evidence Integrity: F3/F1 idempotency and request hash preserved.
- Gate 11 Platform Regression: focused Finance OS tests, scoped lint, scoped TypeScript, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL FINANCE TENANT + ACTOR AUTHORIZATION

> **Status:** PASS - bounded Preschool Product Finance server authorization boundary
> **Date:** 2026-09-27
> **Scope:** F2 active finance UI/API path only; no Finance RLS hardening, no billing redesign, no browser field verification

---

## 1. Bella OS/Product Development Process Gate

F1 cut over Preschool Finance identity to canonical `student_party_id`. The next proven blocker is that the active Finance UI still supplies hardcoded tenant/staff/parent IDs from the browser. Gate decision: `PASS` for the smallest server boundary that derives tenant and actor from the authenticated session, permits only existing Bella finance roles, and preserves P7 fee/invoice/payment/reconciliation semantics.

## 2. Product Manifest

In scope:
- Preschool Product Finance API boundary for active Finance page read/actions.
- Finance page consumer change from direct Supabase/service calls to server API calls.
- Role mapping for existing Bella roles `admin` and `accountant`.
- Focused tests proving server-derived tenant/actor and parent denial.

Out of scope:
- Broad `edu_fin_*` RLS/grant remediation.
- Generic authorization framework.
- Finance/Billing Kernel redesign.
- Browser field verification before F3 RLS hardening.
- Parent Finance redesign or notification workflow expansion.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| authenticated user/session | Platform Auth / Bella user profile | Source for current user id, role, tenant |
| `admin` / `accountant` user roles | Bella existing user model | Allowed active Preschool finance operators |
| P7 Finance actions | Preschool Product Finance | Compile/issue invoices, payment reconciliation, finance projections |
| `edu_fin_*` RLS policies | Preschool Product Finance / DB security | Deferred F3 hardening target |

## 4. Contract Dependency Map

```text
Finance UI
        ↓
/api/education/finance
        ↓
getCurrentUser()
        ↓
server-derived tenant + actor + role
        ↓
P7 Finance services
        ↓
edu_fin_* canonical student_party_id rows
```

Client-supplied `tenantId`, `createdBy`, `payerPartyId`, or authorization status is not trusted.

## 5. Change Authority

Authorized:
- Preschool Product Finance route/UI boundary.
- Bounded finance authorization helper/service.
- Directly affected finance service call signatures where actor/guardian derivation must move server-side.
- Focused tests and this gate artifact.

Not authorized:
- Education Kernel changes.
- Generic Auth/RBAC framework.
- Broad RLS policy repair.
- Migration history or BDGF work.

## 6. UI -> Contract Reconciliation

| UI element/action | Old authority | New authority | Conclusion |
|---|---|---|---|
| Finance data load | browser Supabase + hardcoded tenant | server API derives tenant from authenticated profile | STALE UI |
| Draft invoice | browser sends `DEFAULT_TENANT_ID` / `DEFAULT_STAFF_ID` | server derives tenant/actor | STALE UI |
| Issued notice projection | browser sends `DEFAULT_PARENT_ID` | server derives guardians via canonical `guardian_of` relationship | STALE UI |
| Payment/reconciliation | browser sends payer/staff constants | server derives payer guardian and actor | STALE UI |

## 7. Additive Migration Plan

No migration in F2. Existing broad/permissive Finance RLS is recorded as F3:

```text
edu_fin_fee_structures
edu_fin_billing_periods
edu_fin_student_discount_profiles
edu_fin_invoices
edu_fin_invoice_line_items
edu_fin_payments
edu_fin_reconciliation_ledger
edu_fin_receipts
```

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Preschool Product Finance only; no Education Kernel change.
- Gate 2 Contract Boundary: API mediates UI to P7 services.
- Gate 3 Tenant Isolation: server derives tenant and repository filters by tenant.
- Gate 4 RLS & Authorization: app-layer roles `admin` and `accountant` allowed; `parent` denied; DB RLS hardening deferred to F3.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: no new domain event.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence Integrity: existing invoice/receipt fingerprints preserved.
- Gate 11 Platform Regression: F1/F2 focused tests, scoped ESLint, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL FINANCE CANONICAL STUDENT CONNECTION

> **Status:** PASS - bounded Preschool Product cutover from legacy `student_id` to canonical `student_party_id`
> **Date:** 2026-09-27
> **Scope:** P7 Preschool Finance student identity only; no Billing Kernel redesign or broad RLS/auth repair

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain now creates canonical Student Parties through Enrollment. The next Market Ready blocker is that P7 Preschool Finance still selects and persists legacy `students.student_id`, while the real enrolled student identity is:

```text
edu_enrollments.student_party_id
        ↓
students.party_id
        ↓
party_parties.id
```

Gate decision: `PASS` for the smallest Preschool Product-owned finance cutover that writes and reads canonical `student_party_id` for new invoice/payment/discount operations while preserving legacy rows.

## 2. Product Manifest

In scope:
- P7 finance domain types, repository, invoice compilation, inbound payment recording, issuance fingerprint identity, and the finance UI student selector/action path.
- One additive migration on directly affected `edu_fin_*` tables.
- Focused service/static tests proving canonical enrollment validation and legacy compatibility.

Out of scope:
- Generic Finance/Billing redesign.
- Finance RLS/grant hardening.
- Server auth/actor/tenant hardcode removal.
- Parent Communication or Notice redesign beyond the directly affected finance projection belonging check.
- Browser field verification before owner deployment.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_enrollments.student_party_id` | Education Enrollment / Preschool consumer | Canonical enrolled student identity |
| `party_parties.id` | Platform Party | Canonical Party identity |
| `edu_fin_student_discount_profiles.student_party_id` | Preschool Product Finance | Canonical student identity for discounts |
| `edu_fin_invoices.student_party_id` | Preschool Product Finance | Canonical student identity for invoices |
| `edu_fin_payments.student_party_id` | Preschool Product Finance | Canonical student identity for payments |

## 4. Contract Dependency Map

```text
Finance UI
        ↓
edu_enrollments(active/pending)
        ↓
Student Party
        ↓
P7 Finance services
        ↓
edu_fin_* rows keyed by student_party_id
```

Payer identity remains separate as `payer_party_id`.

## 5. Change Authority

Authorized:
- Preschool Product finance code and UI path.
- Additive/cutover migration on P7 finance tables.
- Direct finance projection check required by issued-invoice notice creation.

Not authorized:
- Education Kernel changes.
- Finance OS Kernel changes.
- Generic billing engine rebuild.
- Broad RLS/security remediation.

## 6. UI -> Contract Reconciliation

| UI element | Old source | New source | Conclusion |
|---|---|---|---|
| Student selector | `students.student_id` with hardcoded P7 fallback | `edu_enrollments.student_party_id -> party_parties` | CUT OVER |
| Draft invoice action | legacy `studentId` | canonical `studentPartyId` | CUT OVER |
| Payment action | invoice legacy student key | invoice canonical `studentPartyId` | CUT OVER |

Known hardcoded tenant/staff/parent IDs remain a separate F2/auth-boundary finding and are not fixed in this F1 identity slice.

## 7. Additive Migration Plan

One migration:

```text
edu_fin_student_discount_profiles
edu_fin_invoices
edu_fin_payments
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD CHECK (student_id IS NOT NULL OR student_party_id IS NOT NULL)
  ADD tenant + student_party_id indexes
```

Legacy columns are preserved. No backfill, cleanup, RLS, grant, migration history, or data mutation is included.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned Preschool finance only; no Education/Finance Kernel change.
- Gate 2 Contract Boundary: validate canonical enrollment before new finance obligation/payment creation.
- Gate 3 Tenant Isolation: enrollment validation is scoped by tenant and `student_party_id`.
- Gate 4 RLS & Authorization: no policy change in this slice; existing broad finance RLS is deferred.
- Gate 5 Database Migration Safety: one bounded additive/cutover migration; no legacy drop/backfill.
- Gate 6 Event-After-Persistence: not applicable; no domain event emitted.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence Integrity: invoice publication fingerprint uses canonical student identity.
- Gate 11 Platform Regression: focused Preschool finance tests, scoped ESLint, `git diff --check`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT USER ROLE ENABLEMENT

> **Status:** PASS - minimum auth/profile contract amendment for legitimate parent accounts
> **Date:** 2026-09-27
> **Scope:** `public.users.users_role_check` only; prerequisite for Parent Daily browser field verification

---

## 1. Bella OS/Product Development Process Gate

The Parent Daily backend, canonical Guardian Party mapping, and focused access tests are implemented. Browser field verification is blocked because a real parent account cannot have a legitimate `public.users` profile:

```text
Supabase Auth user
        ↓
public.users profile
        ↓
users_role_check rejects 'parent'
```

Gate decision: `PASS` for the smallest database contract amendment that permits a `parent` actor without granting staff/admin authority.

## 2. Product Manifest

In scope:
- Preserve all currently accepted `public.users.role` values.
- Add exactly one canonical role: `parent`.
- Keep role validation bounded by `users_role_check`.

Out of scope:
- Auth redesign, invitation workflow, password management, RBAC framework.
- Staff/admin permission changes.
- Parent Daily business semantics, Attendance, Daily Care, Handover, Guardian Authorization, Enrollment, R3, Course RLS.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.users.role` | Platform Auth/Profile | User profile role label used by app guards and tenant context |
| `parent` | Preschool Product consumer of Platform profile | External guardian/parent login actor; not staff/admin |

## 4. Contract Dependency Map

```text
Supabase Auth user
        ↓
public.users(role = parent, tenant_id, phone)
        ↓
Parent Daily access service
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
```

Pickup authorization remains excluded from parent data-access authority.

## 5. Change Authority

Authorized:
- One bounded migration changing only `public.users.users_role_check`.
- Focused static migration test and existing Parent Daily access tests.

Not authorized:
- Generic RBAC/permission engine.
- Staff/admin route permission expansion.
- Product workflow changes.

## 6. UI -> Contract Reconciliation

No UI change in this slice. This is a contract prerequisite for using a real parent browser session in the already implemented Parent Inbox.

## 7. Additive Migration Plan

One migration:

```sql
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check
CHECK (role IN (... existing roles ..., 'parent'));
```

No RLS, policy, grant, profile data, or auth-user mutation.

## 8. Verification Plan

- Focused migration static test:
  - existing roles remain valid
  - `parent` is accepted
  - arbitrary roles are not accepted
  - validation is not weakened
- Existing Parent Daily access tests still pass.
- Scoped ESLint/diff check.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL PARENT DAILY EXPERIENCE

> **Status:** PASS - complete parent daily view from canonical Preschool operational truth
> **Date:** 2026-09-27
> **Scope:** Parent daily read model, canonical guardian access, Parent Digest `student_party_id` cutover, `/dashboard/education/parent-inbox`

---

## 1. Bella OS/Product Development Process Gate

The sealed Preschool operational chain is:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance
-> Daily Care -> Guardian Authorization -> Safe Pickup/Handover
= FIELD VERIFIED
```

The next proven product blocker is:

```text
Parent Daily Experience = PARTIAL
```

Operational truth exists for Attendance, Daily Care, and Handover, but Parent Digest and Parent Inbox still consume legacy/static paths. Gate decision: `PASS` for the minimum Preschool Product connection that exposes today's real child-day truth to an authenticated canonical Guardian Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve authenticated user to Guardian Party using existing tenant-scoped guardian phone identifier.
- Validate `Guardian Party --guardian_of--> Student Party` before returning any child data.
- Cut Parent Digest operational key from legacy `student_id` to canonical `student_party_id`.
- Read today's Attendance, Daily Care, and Handover truth from existing FIELD VERIFIED sources.
- Replace operational Parent Inbox mock path with real backend read-back.

Out of scope:
- QR, SMS, push, mobile app, billing, medication workflow, temperature, staff scheduling, facilities.
- Generic parent authorization framework.
- Pickup authorization as parent data-access authority.
- Reopening R3, Enrollment, Roster, Attendance, Daily Care source semantics, Guardian Authorization, Safe Pickup/Handover, Course RLS.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_relationships guardian_of` | Platform Party | Family/guardian relationship between Guardian Party and Student Party |
| `edu_attendance_daily_state` | Education Attendance / Preschool consumer | Daily attendance state |
| `edu_daily_care_records.student_party_id` | Preschool Product | Daily care state for a canonical Student Party |
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable pickup handover event |
| `edu_daily_parent_digests.student_party_id` | Preschool Product | Parent digest projection keyed by canonical Student Party |
| `/dashboard/education/parent-inbox` | Preschool Product UI | Parent daily experience read surface |

## 4. Contract Dependency Map

```text
Authenticated user
        ↓
public.users.phone
        ↓
party_identifiers(preschool_guardian_phone)
        ↓
Guardian Party
        ↓
party_relationships guardian_of
        ↓
Student Party
        ↓
Attendance + Daily Care + Handover read model
        ↓
Parent Inbox UI
```

Pickup authorization is not part of the parent data-access contract.

## 5. Change Authority

Authorized:
- Preschool Product service/API/UI for parent daily read model.
- Additive/cutover migration on Preschool-owned `edu_daily_parent_digests`.
- Focused tests for related child access, unrelated child denial, cross-tenant denial, pickup authorization not granting data access, and canonical sources.

Not authorized:
- Platform identity redesign.
- Education Kernel changes.
- Generic authorization framework.
- Notification delivery, QR, mobile app, or parent communication redesign.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Parent daily child card | Shows real child | `party_relationships guardian_of -> party_parties` | MATCH |
| Attendance | Present/absent/excused/unmarked | `edu_attendance_daily_state` through canonical enrollment | MATCH |
| Arrival/meal/hygiene/nap | Today's care state | `edu_daily_care_records.student_party_id` | MATCH |
| Handover | Pickup complete/time/guardian | `edu_preschool_pickup_handover_events` | MATCH |
| Static NOT-* notices | Mock operational data | No real parent daily contract | STALE UI |

## 7. Additive Migration Plan

One migration only:

```text
edu_daily_parent_digests
  ADD student_party_id UUID REFERENCES party_parties(id)
  ALTER student_id DROP NOT NULL
  ADD unique/indexes for session + student_party_id
```

No legacy cleanup/drop.

## 8. Verification Plan

- Focused parent daily service tests.
- Focused Parent Digest canonical tests where practical.
- Scoped ESLint.
- `git diff --check`.
- Typecheck changed once; if it stalls, report `NOT_VERIFIED_STALL`.

Gate result: `PASS`.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY CARE CANONICAL CONNECTION

> **Status:** PASS - minimum Preschool-owned Daily Care connection to canonical enrolled students
> **Date:** 2026-09-27
> **Scope:** `/dashboard/education/care`, Daily Care product service/API, canonical `student_party_id` persistence

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization -> Safe Pickup/Handover = FIELD VERIFIED
```

The next proven blocker is:

```text
Daily Care / Care & Wellbeing = PARTIAL
```

The existing Care UI is a real Preschool menu capability, but still uses hardcoded tenant/class/student/date/static students and writes care records through legacy `students.student_id`.

Gate decision: `PASS` for the minimum Preschool Product connection that lets the existing Care workspace operate on the same canonical enrolled students already proven by Enrollment/Roster/Attendance.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Load real active courses and enrolled students for the authenticated Preschool tenant.
- Persist Daily Care records by canonical `student_party_id`.
- Preserve existing Care semantics for arrival, meal, hygiene, and nap.
- Return DB read-back so browser refresh can show persisted truth.

Out of scope:
- Parent Digest publishing.
- QR, pickup, handover, Attendance changes, Guardian Authorization changes.
- Medication authorization redesign.
- Platform/Education-wide Care engine or generic workflow framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_daily_care_sessions` | Preschool Product | Care session per course/date |
| `edu_daily_care_records` | Preschool Product | Care state for one canonical student/day |
| `edu_enrollments` | Education OS Enrollment | Canonical course membership |
| `students.party_id` / `party_parties.id` | Education Student / Platform Party | Canonical student identity |
| `/dashboard/education/care` | Preschool Product UI | Staff care action workspace |

## 4. Contract Dependency Map

```text
Care UI
        ↓
GET /api/education/courses
        ↓
GET /api/education/care/bulk?courseId&date
        ↓
DailyCareService
        ↓
edu_enrollments.student_party_id
        ↓
edu_daily_care_records.student_party_id
        ↓
Care UI DB read-back
```

## 5. Change Authority

Authorized:
- One bounded migration for canonical Daily Care identity on existing product-owned table.
- `DailyCareService` and its product-local contract.
- `/api/education/care/bulk` server boundary.
- Existing Care page operational data/action wiring.
- Focused tests for canonical student persistence and tenant/course denial.

Not authorized:
- R3, Enrollment, Attendance, Guardian Authorization, Safe Pickup/Handover.
- Parent Digest, Parent Engagement, QR, Haircut, BDGF, migration history.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Course selector | Real Preschool class/course | `GET /api/education/courses` | MATCH |
| Student roster | Real enrolled students | `edu_enrollments.student_party_id -> party_parties` | MATCH |
| Care action | Persist care for current student/day | `edu_daily_care_records.student_party_id` | CONTRACT CHANGE REQUIRED |
| Temperature | Health check input | No real current input in Care page | DEFER |
| Parent Digest | Publish parent-facing snapshot | Existing separate digest projection | DEFER |

## 7. Additive Migration Plan

Minimum table correction:

```text
edu_daily_care_records.student_party_id -> party_parties.id
student_id DROP NOT NULL for canonical rows
unique session + student_party_id
index tenant + student_party_id
```

No parent digest migration, attendance change, guardian change, or R3 change.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; no Education Kernel modification.
- Gate 2 Contract Boundary: Product consumes canonical enrollment/party identity only.
- Gate 3 Tenant Isolation: API derives tenant server-side and service validates tenant/course membership.
- Gate 4 RLS/Auth: no RLS weakening; server-side route owns mutation.
- Gate 5 Migration Safety: bounded product table identity correction only.
- Gate 6 Event-After-Persistence: not applicable; success after DB update/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: daily record update semantics preserved.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused tests prove DB-shaped persistence and denial.
- Gate 11 Regression: focused Daily Care tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL SAFE PICKUP HANDOVER EVENT

> **Status:** PASS - minimum Preschool-owned handover event truth
> **Date:** 2026-09-27
> **Scope:** Safe Pickup handover event persistence, API action, Attendance/Safe Pickup UI connection

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance -> Guardian Authorization = FIELD VERIFIED
```

Discovery proved:

```text
Safe Pickup authorization != handover event
Existing canonical handover capability = NONE
Owner = Preschool Product
```

Gate decision: `PASS` for one minimum product-owned event record proving that an authorized guardian received a specific student from an authenticated operator at a specific time.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Create one Preschool-owned handover event table.
- Validate the active pickup authorization before recording handover.
- Derive tenant, operator, and timestamp server-side.
- Add one minimal API action for the existing Safe Pickup panel.
- Show persisted handover read-back in the existing Attendance/Safe Pickup UI.

Out of scope:
- QR, scanner/camera, pickup token, biometrics, signature capture.
- Notifications, pickup schedules, custody rules, effective authorization windows.
- Guardian Authorization semantic changes.
- Enrollment, Student/R3, Attendance status semantics, Course RLS, BDGF, migration history.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `edu_preschool_pickup_handover_events` | Preschool Product | Immutable handover business event |
| `edu_preschool_pickup_authorizations` | Preschool Product | Active authorization prerequisite |
| `party_parties` | Platform Party | Canonical Student and Guardian identities |
| Safe Pickup UI | Preschool Product UI | Action surface and truthful read-back |

## 4. Contract Dependency Map

```text
Safe Pickup UI
        ↓
POST /api/education/attendance/handover
        ↓
PreschoolSafePickupHandoverService
        ↓
Validate active authorization
        ↓
Insert edu_preschool_pickup_handover_events
        ↓
GET /api/education/attendance read-back
        ↓
Safe Pickup panel shows "Đã bàn giao"
```

## 5. Change Authority

Authorized:
- One additive Preschool Product migration.
- Product-owned service for handover event.
- Attendance API route read-back and one new handover endpoint.
- Existing Attendance/Safe Pickup UI action wiring.
- Focused tests for handover validation and failure paths.

Not authorized:
- Education Kernel handover engine.
- Guardian Authorization redesign.
- QR/custody/notification/Parent Engagement.
- Broad regression repair or migration history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Authorized guardian display | Existing active authorization shown | `edu_preschool_pickup_authorizations` | MATCH |
| Bàn giao action | Persist real handover event | New `edu_preschool_pickup_handover_events` | CONTRACT CHANGE REQUIRED |
| QR copy/status | QR verification | No canonical capability in this slice | DEFER |
| Handover success message | Only after persisted event read-back | Handover API + roster refresh | MATCH after slice |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_handover_events
tenant_id
student_party_id
guardian_party_id
pickup_authorization_id
handed_over_at
handed_over_by
created_at
```

No mutation of authorization, enrollment, student identity, attendance, QR, Parent Engagement, or legacy tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI only.
- Gate 2 Contract Boundary: No Education Kernel modification.
- Gate 3 Tenant Isolation: tenant derived server-side; service validates same tenant.
- Gate 4 RLS/Auth: new table has tenant RLS policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: success only after insert/read-back.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: immutable event record.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: focused test/read-back proves event truth.
- Gate 11 Regression: focused handover test, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL DAILY ATTENDANCE STATE

> **Status:** PASS - canonical Education daily attendance state projection for Preschool roll call
> **Date:** 2026-09-26
> **Scope:** Education Attendance public contract extension, additive daily-state projection, Preschool Attendance UI wiring

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool workflow has reached:

```text
New Student → Enrollment → Classroom Roster = FIELD VERIFIED
```

The next blocker is daily roll call. Discovery proved two distinct semantics:

```text
edu_attendance = event history
Preschool roll call = current daily state
```

Gate decision: `PASS` for the minimum canonical Education Attendance contract extension that preserves event history and adds a bounded daily-state projection.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Add an Education-owned daily attendance state projection.
- Preserve `edu_attendance` append-only event semantics.
- Add atomic write boundary: append event + upsert daily state.
- Add canonical read path for course/date roster attendance.
- Wire Preschool Attendance UI to the canonical Education Attendance service/API.

Out of scope:
- Pickup, temperature, Care, Parent notification, Billing, Reporting.
- R3, BDGF, migration history, credential debugging.
- Legacy `attendances` cleanup or dual-write.
- Generic timezone framework or event-sourcing framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.edu_attendance` | Education OS Attendance | Append-only attendance event history |
| Daily attendance state projection | Education OS Attendance | Effective state for tenant + enrollment + school_day |
| `public.edu_enrollments` | Education OS Enrollment | Canonical roster membership by course |
| `public.students` / `public.party_parties` | Education Student / Platform Party | Canonical student identity for roster display |
| Preschool Attendance page | Preschool Product UI | Presentation and user action surface only |

## 4. Contract Dependency Map

```text
Preschool Attendance UI
        ↓
Education Attendance API
        ↓
AttendanceProductService
        ↓
IEducationAttendanceContract
        ↓
AttendanceContractImpl
        ↓
Education DB boundary
        ├── edu_attendance event append
        └── daily attendance state upsert
```

Read path:

```text
course + school_day
        ↓
edu_enrollments
        ↓
students.party_id
        ↓
party_parties
        ↓
daily attendance state (nullable/unmarked)
```

## 5. Change Authority

Authorized:
- One additive Education attendance migration.
- `src/platform/education/contracts/attendance.contract.ts`
- `src/platform/education/contracts/attendance.contract.impl.ts`
- `src/products/bella-education/services/attendance.service.ts`
- Minimal Attendance API route(s).
- `src/app/dashboard/education/attendance/page.tsx`
- Focused tests for daily-state semantics and UI/API mapping.

Not authorized:
- Healthcare, Logistics, R3, BDGF, legacy cleanup.
- Legacy `attendances` dual-write.
- Product-specific attendance engine separate from Education.

## 6. UI → Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Class/course selector | Real course list | Existing Education courses API | MATCH |
| Roster rows | Enrolled students for selected course | `edu_enrollments.student_party_id → students.party_id → party_parties` | MATCH |
| Present/Absent/Excused action | One effective state for school day | New Education daily-state projection | CONTRACT CHANGE REQUIRED |
| History/correction evidence | Correction preserves history | Existing `edu_attendance` event log | MATCH |
| Pickup/temperature panels | Not proven for attendance mutation | Out of scope | DEFER |

## 7. Additive Migration Plan

Create only a new Education daily attendance state projection with:

```text
tenant_id
enrollment_id
school_day
status present|absent|excused
created_at
updated_at
UNIQUE (tenant_id, enrollment_id, school_day)
RLS tenant isolation consistent with Education tables
```

No modification to `edu_attendance`, `attendances`, `persons`, identity mappings, or enrollment tables.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Education contract and Product UI only; no cross-industry imports.
- Gate 2 Contract Boundary: Product calls public Education Attendance service/contract.
- Gate 3 Tenant Isolation: mutation/read validates tenant owns enrollment/course.
- Gate 4 RLS/Auth: new table has RLS and tenant policy.
- Gate 5 Migration Safety: additive table only.
- Gate 6 Event-After-Persistence: event + state mutation must be transactional/atomic.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: event history remains append-only.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: correction test proves two history events and one effective state.
- Gate 11 Regression: focused attendance tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL GUARDIAN AUTHORIZATION

> **Status:** PASS - minimal Preschool-owned guardian pickup authorization truth
> **Date:** 2026-09-27
> **Scope:** New Enrollment guardian identity/relationship/authorization; Safe Pickup panel read-only truth display

---

## 1. Bella OS/Product Development Process Gate

The verified Preschool operational chain has reached:

```text
New Student -> Enrollment -> Classroom Roster -> Daily Attendance = FIELD VERIFIED
```

The next blocker is not QR or pickup event execution. Discovery proved the first missing truth is:

```text
Student Party
      ↓
Guardian Party
      ↓
Guardian identity relationship
      ↓
Preschool pickup authorization
```

Gate decision: `PASS` for the minimum product-owned model answering only which Guardian Party is currently authorized to pick up which Student Party.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Resolve/create a tenant-scoped Guardian Party from required enrollment guardian input.
- Store a bounded tenant-scoped guardian phone identifier for this Preschool flow.
- Link Guardian Party to Student Party through `guardian_of` identity relationship.
- Create/read a separate Preschool pickup authorization.
- Extend the existing enrollment response and Safe Pickup panel to display real authorized guardian truth.

Out of scope:
- QR token/scanner.
- Pickup/handover/release event.
- Temperature or Daily Care changes.
- Parent Engagement refactor.
- Generic identity, phone, or authorization framework.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `party_parties` | Platform Party | Canonical Guardian and Student identity |
| `party_identifiers` | Platform Party | Tenant-scoped Preschool guardian phone resolution key |
| `party_relationships` | Platform Party | Guardian -> Student identity/family relationship |
| `edu_preschool_pickup_authorizations` | Preschool Product | Operational truth that a guardian is currently authorized for pickup |
| Attendance Safe Pickup panel | Preschool Product UI | Read-only display of authorization truth; no pickup event/QR claim |

## 4. Contract Dependency Map

```text
Preschool Enrollment API
        ↓
Student Party
        ↓
Guardian Party resolve/create
        ↓
party_relationships guardian_of
        ↓
edu_preschool_pickup_authorizations
        ↓
Student + Enrollment
```

Read path:

```text
Attendance roster
        ↓
student_party_id
        ↓
edu_preschool_pickup_authorizations
        ↓
guardian party display + phone identifier
        ↓
Safe Pickup panel
```

## 5. Change Authority

Authorized:
- One additive Preschool-owned authorization migration.
- Product service for guardian authorization.
- Enrollment API integration.
- Attendance API/UI read-only display of authorized guardian.
- Focused tests for identity, duplicate boundaries, and false-success prevention.

Not authorized:
- Education Attendance engine redesign.
- Parent Engagement refactor.
- QR, pickup event, custody scheduling, temperature, or Daily Care.
- BDGF/R3/migration-history work.

## 6. UI -> Contract Reconciliation

| UI element | UI expectation | Canonical contract | Conclusion |
|---|---|---|---|
| Enrollment guardian fields | Required guardian info becomes operational truth | Guardian Party + relationship + pickup authorization | CONTRACT CHANGE REQUIRED |
| Safe Pickup guardian display | Show who is authorized | `edu_preschool_pickup_authorizations` + Party identity | MATCH after slice |
| QR action | Verify pickup via QR | No canonical capability yet | DEFER |
| Pickup completion | Child released/handover event | No canonical capability yet | DEFER |
| Temperature | Care/health check | Daily Care capability, not Attendance | DEFER |

## 7. Additive Migration Plan

Create one table only:

```text
edu_preschool_pickup_authorizations
tenant_id
student_party_id
guardian_party_id
status authorized|revoked
created_at
updated_at
```

Add a partial unique boundary for active authorization:

```text
tenant_id + student_party_id + guardian_party_id WHERE status = authorized
```

No pickup event, QR token, schedule, custody, photo, signature, or geolocation fields.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: Product-owned service/API/UI; Platform Party tables only for identity.
- Gate 2 Contract Boundary: Education attendance/enrollment contracts remain unchanged.
- Gate 3 Tenant Isolation: guardian phone resolution and authorization are tenant scoped.
- Gate 4 RLS/Auth: new table has RLS tenant policy.
- Gate 5 Migration Safety: additive table/index/policy only.
- Gate 6 Event-After-Persistence: no event behavior added.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: read-back proves authorization truth.
- Gate 11 Regression: enrollment and attendance focused tests, scoped lint, diff check.

---

# ARCHITECTURE GATE RESULT - PRESCHOOL NEW STUDENT ENROLLMENT PATH

> **Status:** PASS - minimal Product UI to canonical Education enrollment wiring
> **Date:** 2026-09-26
> **Scope:** Preschool New Student modal, product-owned API boundary, canonical Party/Student/Enrollment chain

---

## 1. Bella OS/Product Development Process Gate

Request targets the proven Preschool blocker:

```text
Enrollment UI
        ↓
static/local completion
        ↓
no canonical Party
no Student contract call
no edu_enrollments persistence/read-back
```

R3 Student identity is sealed; new canonical Student creation now supports:

```text
party_id = public.party_parties.id
person_id = NULL
```

Gate decision: `PASS` for a minimal Product-layer server boundary plus UI submit wiring.

## 2. Product Manifest (Capabilities & Scope)

In scope:
- Use the existing Preschool Enrollment UI/modal.
- Create one product-owned API route for the admission operation.
- Create a canonical person Party in `public.party_parties`.
- Register the Student through `StudentContractImpl`.
- Enroll through `EnrollmentProductService` and `EnrollmentContractImpl`.
- Report success only after Student and Enrollment read-back.

Out of scope:
- Attendance, Care, Parent Inbox, Pickup, Finance, Reporting.
- R3, BDGF, migration history, credential/debug work.
- New identity framework, fake `persons`, fake `identity_migration_mapping`, or compatibility layer.
- Broad Preschool redesign.

## 3. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.party_parties` | Platform Party identity | Canonical person identity for the new student |
| `public.students` | Education OS Student | Student role bound to canonical Party |
| `public.edu_enrollments` | Education OS Enrollment | Canonical enrollment persistence/read-back |
| Enrollment modal state | Preschool Product UI | User input only; not source of operational truth |

## 4. Contract Dependency Map

```text
Preschool Enrollment UI
        ↓
POST /api/education/enrollments
        ↓
party_parties insert
        ↓
StudentContractImpl.registerStudent()
        ↓
EnrollmentProductService.enrollStudent()
        ↓
EnrollmentContractImpl
        ↓
EducationEngineService
        ↓
SupabaseEducationRepository
        ↓
edu_enrollments
        ↓
getStudent() + getEnrollment() read-back
```

## 5. Change Authority

Authorized:
- `src/app/dashboard/education/enrollments/page.tsx`
- `src/app/api/education/enrollments/route.ts`
- Focused tests for the new product API boundary.
- This architecture gate artifact.

Not authorized:
- Education Kernel schema changes.
- Attendance/Care/Parent/Finance/Reporting.
- Migration deployment, BDGF, or production credential work.

## 6. UI → Contract Reconciliation

The previous button only closed the modal. The new path must submit the UI payload to the product API and display failure if the server chain fails. Course/class identity must come from the existing `GET /api/education/courses` source, not from a hardcoded ID.

Browser smoke discovered a direct mapping bug in that existing course source:

```text
Enrollment modal
        ↓
GET /api/education/courses
        ↓
hardcoded tenant fallback
        ↓
classrooms: []
        ↓
submit blocked before canonical enrollment request
```

Authorized minimal correction: the course API must prefer the authenticated
user's tenant context before legacy fallback so the Enrollment UI can submit a
canonical course/class ID for the current Preschool tenant.

## 7. Additive Migration Plan

No migration in this task.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: product API uses public Education contracts.
- Gate 2 Contract Boundary: Student registration uses `partyId`; enrollment uses `studentPartyId`.
- Gate 3 Tenant Isolation: API resolves tenant from authenticated user context before writes.
- Gate 4 RLS/Auth: no RLS/grant changes.
- Gate 5 Migration Safety: no schema change.
- Gate 6 Event-After-Persistence: Enrollment engine remains responsible.
- Gate 7 Academic Safety Routing: course validation remains in Education engine.
- Gate 8 Temporal Provenance: not changed.
- Gate 9 Rule Governance: not changed.
- Gate 10 Audit Evidence: API response includes persisted/read-back IDs.
- Gate 11 Regression: focused route tests, existing R3 Student tests, scoped lint/diff checks.

---

# ARCHITECTURE GATE RESULT - R3 STUDENT CREATE-SIDE COMPLETION

> **Status:** PASS - minimal R3 create-side cutover for canonical Party-backed Students
> **Date:** 2026-09-26
> **Scope:** Education Student create path only; prerequisite for Preschool New Student enrollment

---

## 1. Product Manifest (Capabilities & Scope)

This change completes the proven R3 create-side gap:

```text
New canonical Party
        ↓
Student role creation
        ↓
students.party_id = party_parties.id
students.person_id = NULL
```

Included:
- Relax the transitional `students.person_id` NOT NULL requirement.
- Preserve `students.person_id` column, FK, index, and legacy read path.
- Preserve canonical `partyId` requirement at the Student application/contract boundary.
- Stop requiring `identity_migration_mapping` for brand-new canonical Student creation.
- Fix the proven semantic bug where `studentPartyId` was queried against `students.person_id`.

Excluded:
- No Preschool Enrollment implementation in this task.
- No `persons` creation for new Students.
- No fake `identity_migration_mapping` rows.
- No `students.party_id NOT NULL` schema hardening.
- No legacy cleanup, mapping removal, BDGF, migration history, or production deployment.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `public.students` | Education OS Student bounded context | Student role state for canonical Party identity |
| `public.party_parties` | Platform Party identity | Canonical person Party identity |
| `public.persons` | Legacy Platform Host Person | Transitional legacy identity retained for existing rows |
| `public.identity_migration_mapping` | R3 migration bridge | Legacy mapping for migrated rows only |

## 3. Contract Dependency Map

```text
Preschool Product
        ↓
Education Student Contract
        ↓
StudentService
        ↓
StudentAggregate
        ↓
StudentRepository
        ↓
public.students
        ↓
party_id → public.party_parties(id)
```

Legacy compatibility remains:

```text
Existing legacy consumers
        ↓
StudentRepository.findByPersonId()
        ↓
students.person_id → public.persons(id)
```

## 4. Change Authority

Authorized by owner prompt:
- Education Student create path.
- One additive/transitional schema migration: `ALTER COLUMN person_id DROP NOT NULL`.
- Generated DB type refresh/update for `students.person_id` nullability.
- Focused tests for Student create/read-back/legacy compatibility.

Not authorized:
- Preschool UI/backend wiring.
- BDGF/governance changes.
- Production migration execution.
- Broad Education architecture refactor.

## 5. UI → Contract Reconciliation

No UI changes in this task. Preschool UI remains out of scope until R3 create-side is reviewed and deployed.

## 6. Additive Migration Plan

One migration only:

```sql
ALTER TABLE public.students
ALTER COLUMN person_id DROP NOT NULL;
```

No data mutation, backfill, FK/index removal, Party hardening, or legacy cleanup.

## 7. Verification Gates Plan

- Gate 1 Architecture Compliance: scoped Education changes only; no cross-industry imports.
- Gate 2 Contract Boundary: Student public contract remains Party-based.
- Gate 3 Tenant Isolation: preserve tenant filters in StudentRepository/Service.
- Gate 4 RLS/Auth: no RLS or grant changes.
- Gate 5 Migration Safety: transitional nullable change only; no destructive column/FK removal.
- Gate 6 Event-After-Persistence: not applicable; no event behavior changed.
- Gate 7 Academic Safety Routing: not applicable.
- Gate 8 Temporal Provenance: not applicable.
- Gate 9 Rule Governance: not applicable.
- Gate 10 Audit Evidence: not applicable.
- Gate 11 Regression: focused Student tests, affected Education tests where available, scoped TypeScript/lint.

---

# ARCHITECTURE GATE RESULT - BELLA ENGLISH CENTER POST-RC ENVIRONMENT CLOSURE

> **Status:** PASS - dev-only API auth-context repair for Post-RC runtime validation
> **Date:** 2026-09-15
> **Canonical base:** `origin/main@fbff36721c3f53067cbd3992157dbb3ba04e634a`
> **Scope:** English Center API runtime validation path only

---

## 1. Product Manifest (Capabilities & Scope)

This closure does not add a new English Center business capability. It fixes the local Post-RC browser validation path where development mock authentication resolves a tenant/user but the API repository Supabase client remains anonymous, causing RLS-backed Command Center reads to fail against `public.user_org_unit_access`.

Included:
- Keep E6-E9 product surfaces unchanged.
- Keep canonical Education OS contracts unchanged.
- Use a service-role Supabase client only for the existing development mock-user branch.
- Preserve production cookie/JWT Supabase client behavior.

Excluded:
- No Education Kernel modification.
- No Healthcare, Logistics, Finance, or cross-industry dependency.
- No `anon` database grant expansion to make tests pass.
- No new database table, policy, or migration in code.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/english-center/_shared.ts` | Bella English Center API boundary | API context resolution only |
| `public.user_org_unit_access` | Platform Authorization projection | Existing branch/org-unit access read model |
| English Center E2-E8 tables | Bella English Center Product | Existing product-owned projections and runtime data |

## 3. Contract Dependency Map

```
Post-RC browser gate
        |
        v
English Center API context
        |
        +-- production auth: SSR Supabase client with user JWT
        |
        +-- development mock auth: service-role Supabase client
        |
        v
English Center repositories
        |
        v
Platform Authorization projection (user_org_unit_access)
        |
        v
Product RLS / tenant / branch scope
```

No Product -> Education Kernel bypass is introduced.

## 4. Additive Migration Plan

No code migration is added. Environment closure applied canonical existing migrations/grants to the linked Supabase project and refreshed PostgREST schema cache separately from this source patch.

## 5. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no `src/platform/education/` change; no cross-industry import.
- Gate 2 Contract Boundary: no Education contract bypass change.
- Gate 3 Tenant Isolation: preserve tenant lookup and RLS-backed branch filtering.
- Gate 4 RLS & Authorization: do not grant `anon`; development mock uses controlled admin client.
- Gate 5 Database Migration Safety: no new migration.
- Gate 6 Event-After-Persistence: not applicable; read-only API context path.
- Gate 7 Academic Safety Routing: not applicable; no assessment calculation change.
- Gate 8 Temporal Provenance: not applicable; no temporal write.
- Gate 9 Rule Governance: not applicable; no grading rule change.
- Gate 10 Audit Evidence Integrity: not applicable; no transcript/export change.
- Gate 11 Platform Regression: run Post-RC browser gate and targeted English Center API tests.

---

# ARCHITECTURE GATE RESULT — PR82 CI REMEDIATION

> **Status:** PASS — CI-only remediation, no Product Vertical or Kernel impact
> **Date:** 2026-09-13
> **Scope:** GitHub Actions checks for PR #82 (`infra/git-workflow-constitution-install`)

---

## 1. Product Manifest (Capabilities & Scope)

This change is limited to CI workflow execution policy:
- Bound API documentation checks to API/API-documentation changes.
- Bound live Supabase/DB checks to database, application, or DB-check changes.
- Remove unsafe direct GitHub context interpolation from shell `run:` blocks.
- Pin the branch-cleanup GitHub Action to an immutable commit SHA.

No Healthcare, Education, Logistics, Finance, or Product Vertical runtime capability is added or changed.

## 2. Ownership Map ("WHO OWNS THIS DATA?")

No business data or domain entity is owned or modified by this change.

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/*` | Repository CI Governance | Automation policy only |
| `docs/api-reference.md` | API Documentation Governance | Referenced deliverable, not created in this change |

## 3. Contract Dependency Map

```
GitHub PR event
        │
        ▼
GitHub Actions workflow checks
        │
        ├── Repo scripts (`npm run docs:api:*`)
        └── GitHub Advanced Security Semgrep OSS
```

No Product -> Contract -> Kernel dependency exists in this remediation.

## 4. Additive Migration Plan

No database migration. No schema change. No RLS policy change.

## 5. 11 Automated Verification Gates Plan

The Healthcare/Education 11-gate product-vertical suite is not applicable because no vertical or kernel code is touched.

Targeted verification for this CI remediation:
- YAML parse / workflow syntax validation.
- Semgrep OSS annotations addressed without disabling scanner.
- API docs check remains enforced for API/API-doc changes and is skipped for infra-only PRs.
- Live DB checks remain enforced for DB/application/DB-check changes and are skipped for infra-only PRs.
- GitHub Actions status rechecked after commit/push.

---

# ARCHITECTURE GATE RESULT — BELLA FINANCE OS KERNEL F1

> **Status:** APPROVED BY HUMAN ARCHITECT  
> **Milestone:** Phase F1.1 & F1.2 Initialization  
> **Author:** Architecture Review AI (Antigravity)  
> **Date:** 2026-08-15  

---

## 1. Product Manifest (Capabilities & Scope)

Finance OS Kernel F1 Ledger Engine provides core double-entry bookkeeping and accounting capabilities to the Bella Platform. It handles the financial truth layer without any business vertical dependencies.

### Capabilities Exposed:
- **COA Management**: Chart of accounts definition with strict normal balances (Debit/Credit).
- **Accounting Periods**: Open, close, and lock periods. Prevent posting to closed/locked periods.
- **Double-Entry Posting**: Balanced journal entry transactions.
- **Traceable Sourcing**: Map financial records back to vertical business events via opaque `source_type`/`source_id` references.
- **Immutability Enforcement**: Voiding and reversing transactions. No direct updates to posted entries.
- **Idempotent Dispatch**: Prevent duplicate posting using client-provided unique idempotency keys.
- **Decimal Precision**: Represent money in string-based minor units (`amount_minor`) to avoid floating-point math errors.
- **Reporting Dimensions**: Support cost center, BU, location, and department dimensions natively.

---

## 2. Ownership Map ("WHO OWNS THIS DATA?")

| Table Name | Owner Context | Data Definition |
|---|---|---|
| `finance_accounts` | F1 Ledger | Chart of accounts list |
| `finance_accounting_periods` | F1 Ledger | Accounting periods & locks |
| `finance_transactions` | F1 Ledger | Transaction headers, idempotency keys, source mapping |
| `finance_transaction_lines` | F1 Ledger | Double-entry line items, debit/credit string amounts, dimensions |
| `finance_outbox_events` | F1 Ledger | Transactional outbox records for event publishing |
| `finance_audit_trail` | F1 Ledger | Immutable log of all updates to financial state |

---

## 3. Contract Dependency Map

```
Vertical Layer (Spa, Hospital, etc.)
               │
               ▼
Vertical Finance Bridge (ACL)
               │
               ▼ (Calls via Public Contracts only)
ILedgerEngine Contract (F1)
               │
               ▼
LedgerEngineService (F1 Implementation)
               │
               ├── Updates database (finance_*)
               └── Writes to transactional outbox (finance_outbox_events)
```

---

## 4. Additive Migration Plan

No existing accounting or business tables will be deleted or modified. The migration strictly creates new tables.

### SQL Migrations Proposed:
- `CREATE TABLE finance_accounting_periods` with columns for period range and status.
- `CREATE TABLE finance_accounts` with code, normal balance, and status.
- `CREATE TABLE finance_transactions` with status, functional/transaction currency, source type/id, and idempotency key.
- `CREATE TABLE finance_transaction_lines` with debit/credit string representation and dimensions.
- `CREATE TABLE finance_outbox_events` with payload and status.
- `CREATE TABLE finance_audit_trail` for immutable history tracking.
- Enable RLS on all tables with policies asserting `tenant_id = auth.jwt()->>'tenant_id'`.

---

## 5. 10 Automated Verification Gates Plan

| Gate | Verification Target | Test Method |
|---|---|---|
| **Gate F-1** | Architecture Compliance | Static analysis to ensure no vertical imports in F1, and strict typing (no `any` type). |
| **Gate F-2** | Contract Boundary | Verify vertical layers cannot query `finance_*` tables directly, only via contracts. |
| **Gate F-3** | Tenant Isolation (P0) | Assert that data from Tenant A is never visible/accessible to Tenant B across all F1 methods. |
| **Gate F-4** | Double-Entry Invariant | Assert that trying to post an imbalanced entry (Σ debit ≠ Σ credit) throws `DOUBLE_ENTRY_IMBALANCE`. |
| **Gate F-5** | Transaction Immutability | Assert that updating a transaction with status `POSTED` throws an exception, and that reversing creates mirror lines. |
| **Gate F-6** | Idempotency | Assert that two consecutive `postTransaction` calls with the same key return the same transaction ID without duplication. |
| **Gate F-7** | Period Control | Assert that posting to a `CLOSED` or `LOCKED` period is blocked with `PERIOD_NOT_OPEN`. |
| **Gate F-8** | Event-After-Persistence | Verify that `finance_outbox_events` has the event record committed in the same transaction, and the dispatcher publishes it successfully. |
| **Gate F-9** | Full Regression | Run all Finance OS test suites to ensure 100% test coverage. |
| **Gate F-10** | Financial State Reconstruction | Rebuild materialized state from authoritative records and verify equality. |

---

# Additional Architecture Gate - Production Smoke Network Evidence

> **Status:** PASS - production workflow diagnostics only
> **Date:** 2026-10-04
> **Scope:** `Deploy to Production` smoke evidence for exact preview gate

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37189982072` passed immutable config, lint, critical tests, security, migration, build, exact preview deploy, and exact preview health, then failed in `Smoke Exact Preview` because `/dashboard` stayed on the TenantContextProvider loading screen.

Source of Truth: GitHub Actions run logs and the existing Playwright smoke route contract.

Canonical Contract: production smoke must use real authentication and must not bypass app auth, mutate business data, or infer readiness from health alone.

Ownership: `.github/workflows/deploy-production.yml` is Repository CI/Production Ops governance. `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` is read-only production smoke evidence.

Boundary: diagnostic-only. No runtime route, auth architecture, tenant model, database, credential, or English business logic is changed.

## 2. Product Manifest

This change adds no product capability. It improves failure evidence for the existing production smoke gate by:

- recording sanitized app network status metadata for the smoke browser session;
- surfacing `/api/tenant/context` status/path evidence when a route remains stuck before expected content renders;
- uploading Playwright artifacts from the production smoke job for RCA.
- keeping Playwright E2E specs out of the direct Jest changed-test runner.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `.github/workflows/deploy-production.yml` | Platform/CI Governance | Production workflow artifact collection |
| `e2e/tests/12-authenticated-core-routes-smoke.spec.ts` | Production Ops Evidence | Read-only browser smoke diagnostics |
| `scripts/test-changed-files.mjs` | CI Governance | Changed-file Jest routing only |

## 4. Contract Dependency Map

```text
Deploy to Production workflow
        ↓
Exact preview
        ↓
Real-auth Playwright smoke
        ↓
Sanitized browser network evidence
        ↓
RCA for first failing production gate
```

No Product -> Contract -> Kernel path is modified.

## 5. Change Authority

Authorized by Production Ops Go-Live audit boundary. The change is limited to evidence collection for the current production smoke blocker.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior, route content, or user-facing component is changed.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Education, Logistics, Finance, or Product runtime code changed.
- Gate 2 Contract Boundary: production smoke remains real-auth and read-only.
- Gate 3 Tenant Isolation: no tenant query or policy change.
- Gate 4 Permission: no auth bypass or credential change.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: not modified.
- Gate 8 Runtime Evidence: exact preview smoke gets sanitized network diagnostics.
- Gate 9 Secret Hygiene: diagnostics exclude headers, cookies, tokens, and secrets.
- Gate 10 CI Governance: artifacts retained for failed smoke RCA.
- Gate 11 Regression: run targeted lint/typecheck/diff checks.

---

# Additional Architecture Gate - Tenant Context Route Session Resolution

> **Status:** PASS - minimal runtime fix authorized
> **Date:** 2026-10-04
> **Scope:** `/api/tenant/context` production smoke authentication blocker

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37192393312` passed immutable config, lint, critical tests, security, migration, build, exact preview deploy, and exact preview health, then failed in `Smoke Exact Preview` because `/api/tenant/context` returned `401` while `/dashboard` loaded as an authenticated document.

Source of Truth: GitHub Actions smoke artifact `production-smoke-artifacts`, sanitized Playwright network evidence, and the Supabase SSR cookie contract.

Canonical Contract: `/api/tenant/context` must resolve a verified Supabase Auth user from the request session and then read that user's tenant profile. It must not bypass authentication, hard-code tenant/user identity, or convert health/auth smoke into a fake PASS.

Ownership: `src/app/api/tenant/context/route.ts` owns the tenant-context API route session resolution. Supabase Auth remains the authentication source of truth. `public.users.tenant_id` remains the tenant ownership source.

Boundary: route-handler session handling only. No English business logic, tenant model, schema, migration, credential, middleware redesign, or broad auth abstraction is changed.

## 2. Product Manifest

This change adds no product capability. It restores the existing tenant context route's ability to read production Supabase SSR auth cookies, including chunked cookies.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/tenant/context/route.ts` | Platform tenant context API | Authenticated user -> tenant context read |
| `src/__tests__/api-tenant-context.test.ts` | Route regression coverage | Unauthenticated and authenticated cookie/session paths |

## 4. Contract Dependency Map

```text
Browser Supabase Auth cookie
        ↓
Supabase SSR Route Handler client
        ↓
Verified auth user
        ↓
public.users.tenant_id
        ↓
public.tenants
        ↓
TenantContext response
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by Production Smoke RCA for a hẹp runtime blocker: valid authenticated production session reaches `/api/tenant/context` as `401`. The allowed change is limited to session/cookie resolution in the route handler.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: route continues to require verified Supabase Auth user.
- Gate 3 Tenant Isolation: tenant context still derives from authenticated user's `tenant_id`.
- Gate 4 Permission: unauthenticated request must remain `401`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/api/tenant/context 401`.
- Gate 9 Secret Hygiene: no credential logging or fixture secrets.
- Gate 10 CI Governance: targeted route test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Tenant Context Raw Cookie Header Fallback

> **Status:** PASS - route-only follow-up authorized
> **Date:** 2026-10-04
> **Scope:** `/api/tenant/context` production smoke authentication blocker follow-up

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37198145961` deployed merge SHA `9bd313b8c9398788234f2cc8ef182f012c1e922f`; validate/build/preview health passed, but `Smoke Exact Preview` still failed with `/api/tenant/context` returning `401`. Sanitized trace evidence shows the request includes a Supabase Auth cookie named `sb-lvnvkpyxtuilhrabtlwv-auth-token`; decoded JWT metadata confirms the token is unexpired, `aud=authenticated`, `role=authenticated`, and issued by the matching Supabase project. The blocker is therefore narrower than credential, cookie-domain, or English business logic.

Source of Truth: GitHub Actions smoke artifact `production-smoke-artifacts` from run `37198145961`, sanitized Playwright trace network headers, and `/api/tenant/context` route session resolution code.

Canonical Contract: `/api/tenant/context` may only return tenant context after resolving a verified Supabase Auth user. It may read the raw `Cookie` header only as an additional source of the same Supabase Auth cookie already present on the request, then still validate the access token through Supabase Auth.

Ownership: `src/app/api/tenant/context/route.ts` owns this fallback. Supabase Auth remains the authentication source of truth. `public.users.tenant_id` remains the tenant ownership source.

Boundary: route-only cookie candidate resolution. No provider change, middleware redesign, schema/migration, credential, tenant model, permission redesign, English business logic, or auth bypass.

## 2. Product Manifest

No product capability is added. This follow-up hardens existing production Route Handler session resolution when `Cookie` is present in the HTTP request but the route cookie abstraction does not expose the auth cookie.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/app/api/tenant/context/route.ts` | Platform tenant context API | Raw Cookie header fallback to verified Supabase Auth user |
| `src/__tests__/api-tenant-context.test.ts` | Route regression coverage | Header-present/cookie-abstraction-empty authenticated request |

## 4. Contract Dependency Map

```text
HTTP Cookie header
        ↓
Supabase auth cookie candidate
        ↓
Decoded access token
        ↓
Supabase auth.getUser(accessToken)
        ↓
public.users.tenant_id
        ↓
TenantContext response
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by production smoke RCA after the first route session fix merged cleanly but the same production 401 remained. The new evidence shows the auth cookie is present in the browser request; the minimal permitted change is to read that raw request header as a fallback and still verify the token through Supabase.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: route still requires Supabase Auth verification.
- Gate 3 Tenant Isolation: tenant context still derives from authenticated user's `tenant_id`.
- Gate 4 Permission: unauthenticated request must remain `401`.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/api/tenant/context 401`.
- Gate 9 Secret Hygiene: no credential, cookie, or token value logging.
- Gate 10 CI Governance: targeted route test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.

---

# Additional Architecture Gate - Supabase Server Client Public Env Contract

> **Status:** PASS - runtime client follow-up authorized
> **Date:** 2026-10-04
> **Scope:** Dashboard production smoke server-action authentication blocker

## 1. Bella OS/Product Development Process Gate

Truth: production workflow run `37208465631` deployed merge SHA `fec5eb0110833cd50e9c00010159849f446e54e7`; validate/build immutable preview passed, `/api/tenant/context` returned `200`, and `X-Environment` was `production`. The remaining blocker is `Smoke Exact Preview`, where the dashboard layout server-action sequence returned one `/dashboard` POST `200` followed by one `/dashboard` POST `500` with React Server Component digest `2492357065`.

Source of Truth: GitHub Actions run `37208465631`, sanitized Playwright trace artifact `production-smoke-artifacts`, dashboard layout client chunk mapping, and `src/lib/supabase-server.ts`.

Canonical Contract: server-side Supabase clients must use the shared public environment contract: `NEXT_PUBLIC_SUPABASE_URL` plus `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with legacy `NEXT_PUBLIC_SUPABASE_ANON_KEY` fallback. Runtime auth must continue to validate the Supabase session through Supabase Auth; no mock, bypass, hard-coded user, or credential fallback is allowed.

Ownership: `src/lib/supabase-server.ts` owns the server-side SSR Supabase client. `src/lib/supabase-public-env.ts` owns public Supabase environment resolution. `src/services/user-actions.ts` consumes the server client but does not own environment resolution.

Boundary: shared runtime client environment resolution only. No English business code, schema/migration, production data mutation, credential logging, auth bypass, tenant model, or dashboard UX redesign.

## 2. Product Manifest

No product capability is added. This change aligns the server-action auth path with the existing production public-env contract already used by browser and tenant-context code.

## 3. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `src/lib/supabase-server.ts` | Platform runtime Supabase SSR client | Server-side Supabase URL/key resolution and cookie-bound auth client |
| `src/lib/supabase-public-env.ts` | Platform env contract | Canonical public URL/key fallback logic |
| `src/__tests__/supabase-server-env.test.ts` | Runtime env regression coverage | Server SSR client must work when only publishable key is configured |

## 4. Contract Dependency Map

```text
DashboardLayout client
        ↓
getCurrentUser server action
        ↓
createClient() / Supabase SSR client
        ↓
Canonical public env contract
        ↓
Supabase auth.getUser()
        ↓
public.users.tenant_id
```

No Product -> Education Kernel contract is modified.

## 5. Change Authority

Authorized by production smoke RCA after tenant-context moved from `401` to `200` and the first failing runtime boundary became dashboard server-action auth. The minimal permitted change is to reuse the shared public Supabase env resolver in the server client.

## 6. UI -> Contract Reconciliation

Not applicable. No UI behavior or visual contract changes.

## 7. Additive Migration Plan

No migration. No schema change. No production data mutation.

## 8. 11 Automated Verification Gates Plan

- Gate 1 Architecture Compliance: no Healthcare, Logistics, Finance, or Education Kernel files changed.
- Gate 2 Contract Boundary: runtime continues to require verified Supabase Auth session.
- Gate 3 Tenant Isolation: current user still derives `tenant_id` from `public.users`.
- Gate 4 Permission: unauthenticated behavior remains login redirect / unauthorized.
- Gate 5 Database Migration Safety: no migration.
- Gate 6 Event-After-Persistence: not applicable.
- Gate 7 Business Flow: English business logic not modified.
- Gate 8 Runtime Evidence: production smoke should move past `/dashboard` server-action auth 500.
- Gate 9 Secret Hygiene: no credential, cookie, or token value logging.
- Gate 10 CI Governance: targeted auth test, lint, typecheck, architecture, security.
- Gate 11 Regression: production workflow remains final authority after merge.
