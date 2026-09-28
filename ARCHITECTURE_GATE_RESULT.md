# ARCHITECTURE GATE RESULT - BELLA HAIRCUT FINISH PAYROLL CONNECTION

> **Status:** PASS - minimum payroll connection repair and one real verification
> **Date:** 2026-09-28
> **Scope:** Payroll config read boundary plus salary dashboard persisted-truth display

---

## 1. Product Manifest (Capabilities & Scope)

This change finishes the existing Haircut payroll connection without creating a new payroll architecture. The workflow remains:

```
Settings -> tenant_payroll_config -> Salary Engine -> attendance + completed sessions -> salary_records -> Salary UI
```

Included:
- Fix the proven `PayrollConfigService.getProviderConfig` read boundary so persisted tenant provider config can be consumed during calculation.
- Make Salary UI data use existing `salary_records` financial values when a salary row exists, instead of presenting a parallel live total after recalculation.
- Run one real authenticated Haircut verification through `/dashboard/salary` and stop at the first unrelated failure.

Excluded:
- No new payroll engine.
- No formula change.
- No hard-coded `135000`.
- No change to `DEFAULT_CONFIGS = 120000`.
- No forced use of package `ktv_commission = 150000`.
- No attendance, payment, publication, approval, finalization, salary expense, Finance, RLS, schema, migration, or Preschool change.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `tenant_payroll_config` | Shared HR/Payroll configuration | Existing tenant-specific payroll policy |
| Salary Engine | Shared HR/Payroll calculation | Existing salary calculation and persistence contract |
| `salary_records` | Shared HR/Payroll result truth | Persisted payroll calculation result |
| `/dashboard/salary` | Payroll admin UI | Existing read/write surface for payroll admins |

## 3. Contract Dependency Map

```
/dashboard/settings salary config
        |
        v
tenant_payroll_config
        |
        v
PayrollConfigService.getProviderConfig
        |
        v
CommissionProvider / AttendanceProvider
        |
        v
Salary Engine
        |
        v
salary_records
        |
        v
/dashboard/salary displays persisted financial truth
```

## 4. Change Authority

Authorized layers: the proven payroll config read boundary and Salary UI persisted-result display boundary.

Not authorized: payroll formulas, provider strategies, attendance data, payroll lifecycle transitions, salary publication/approval/finalization, Finance/accounting, RLS, schema, migrations, or broad auth/UI refactors.

## 5. Verification Plan

- Focused service tests for persisted tenant config override and fallback behavior.
- Focused salary query test for existing draft `salary_records` as UI financial truth.
- Existing admin salary action focused tests.
- Scoped ESLint on touched files.
- `git diff --check`.
- One real authenticated Haircut UI recalculation and read-back.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H9A.2 PAYROLL CONFIG SERVICE AUTH CONTEXT

> **Status:** PASS - minimum auth-context repair for PayrollConfigService provider lookup
> **Date:** 2026-09-28
> **Scope:** `PayrollConfigService.getProviderConfig` tenant/provider read boundary only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not create or redesign payroll configuration, payroll calculation, commission policy, attendance, or Finance. It fixes the proven H9A.2 blocker where a real Haircut tenant payroll config row exists and the salary recalculation engine runs, but `PayrollConfigService` cannot read `tenant_payroll_config` from the nested provider path and therefore falls back to `DEFAULT_CONFIGS`.

Included:
- Use the established Haircut authenticated/dev server client pattern for `getProviderConfig`.
- Preserve tenant identity supplied by the salary engine/provider context.
- Preserve explicit `tenant_id` and `provider_key` predicates.
- Preserve default fallback behavior when tenant config is genuinely missing.

Excluded:
- No formula change.
- No `120000` default change.
- No forced use of `booking.ktv_commission = 150000`.
- No UI display fix for the deferred UI/DB truth mismatch.
- No salary record mutation or field retry in this task.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `tenant_payroll_config` | Shared HR/Payroll configuration | Existing tenant-scoped provider policy |
| `PayrollConfigService.getProviderConfig` | Payroll configuration read boundary | Existing provider lookup contract |
| `CommissionProvider` / `AttendanceProvider` | Payroll provider consumers | Existing engine inputs |
| `createDevelopmentBypassClient` | Established local/dev authenticated server-action context | Existing pattern verified by Haircut workflows |

## 3. Contract Dependency Map

```
recalculateAndSaveSalaryRecordEngine
        |
        v
CommissionProvider / AttendanceProvider
        |
        v
PayrollConfigService.getProviderConfig
        |
        +-- tenant_payroll_config tenant_id + provider_key
        +-- tenant config if present
        +-- DEFAULT_CONFIGS only if genuinely missing
```

## 4. Change Authority

Authorized layer: the `getProviderConfig` execution context required for the proven tenant payroll config lookup blocker.

Not authorized: `saveProviderConfig`, provider formulas, Salary Engine formulas, UI totals, attendance data, payment/Finance, publication/approval/finalization, RLS, migrations, or broad auth refactor.

## 5. Verification Plan

- Focused payroll config service tests proving persisted tenant commission config overrides default `120000`, missing config still falls back, tenant/provider predicates remain enforced, attendance lookup still works, and provider config reads do not mutate config.
- Scoped ESLint on touched files.
- `git diff --check`.
- No field retry and no salary DB mutation in this task.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H9A.1 RECALCULATION AUTH CONTEXT

> **Status:** PASS - minimum auth-context repair for draft-row pre-engine read
> **Date:** 2026-09-28
> **Scope:** `recalculateSalaryRecord` Supabase execution context only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add or redesign payroll. It fixes the proven H9A.1 blocker where the real Haircut salary UI reaches `recalculateSalaryRecord`, but the pre-engine draft salary row read cannot see the existing tenant-scoped row under the current development/authenticated UI context.

Included:
- Use the established Haircut authenticated/dev server client pattern for `recalculateSalaryRecord`.
- Preserve admin authorization, tenant source, tenant predicates, month/KTV filters, draft-only guard, and existing Salary Engine call.

Excluded:
- No Salary Engine, CommissionProvider, AttendanceProvider, payroll config, formula, schema, RLS, migration, Finance, attendance, or lifecycle change.
- No field retry in this task.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `salary_records` | Shared HR/Payroll | Existing payroll record for tenant/KTV/month |
| `recalculateSalaryRecord` | Payroll admin operation boundary | Existing H9A UI action |
| `createDevelopmentBypassClient` | Established local/dev authenticated server-action context | Existing pattern already verified by Haircut workflows |

## 3. Contract Dependency Map

```
/dashboard/salary "Tính lại"
        |
        v
recalculateSalaryRecord
        |
        +-- getSalaryAdminAuth -> tenant_id
        +-- createDevelopmentBypassClient
        +-- salary_records ktv_id + month_year + tenant_id
        +-- draft-only guard
        +-- recalculateAndSaveSalaryRecord existing engine
```

## 4. Change Authority

Authorized layer: `recalculateSalaryRecord` execution context for the proven pre-engine read blocker.

Not authorized: payroll calculation semantics, provider config, attendance data, payment/Finance, publication/approval/finalization, RLS, or broad auth refactor.

## 5. Verification Plan

- Focused admin salary action tests proving own-tenant draft row visibility through the dev/auth client, foreign tenant denial, identity/month guards, non-draft rejection, and engine call only after draft row is found.
- Scoped ESLint on touched files.
- `git diff --check`.
- No real recalculation field retry in this task.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H9A PAYROLL RECALCULATION OPERATION

> **Status:** PASS - minimum draft-only recalculation operation boundary
> **Date:** 2026-09-28
> **Scope:** Admin salary recalculation-only action and draft-row UI trigger

---

## 1. Product Manifest (Capabilities & Scope)

This change does not redesign Haircut payroll, commission policy, attendance, or Finance. It exposes the existing salary recalculation engine through a narrow admin operation so a draft salary row can be recalculated after tenant payroll configuration is established.

Included:
- Add a recalculation-only admin action for an existing draft salary row.
- Derive tenant identity from the authenticated admin context.
- Reuse the existing `recalculateAndSaveSalaryRecord` / engine path without overrides.
- Add a minimal `/dashboard/salary` UI trigger visible only for draft rows.

Excluded:
- No formula change.
- No `120000` default change.
- No forced use of `booking.ktv_commission = 150000`.
- No publish, approve, finalize, expense, attendance, Finance, schema, RLS, migration, or Preschool change.
- No field retry in this implementation pass.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `salary_records` | Shared HR/Payroll | Persisted salary row for tenant/KTV/month |
| `recalculateAndSaveSalaryRecordEngine` | Shared HR/Payroll calculation engine | Existing recalculation and salary row persistence contract |
| `/dashboard/salary` | Payroll admin UI | Existing operational salary admin surface |

## 3. Contract Dependency Map

```
/dashboard/salary draft row
        |
        v
recalculateSalaryRecord
        |
        +-- getSalaryAdminAuth -> tenant_id
        +-- salary_records tenant/ktv/month draft guard
        +-- recalculateAndSaveSalaryRecord without overrides
        |
        v
salary_records update by existing record id
```

## 4. Change Authority

Authorized layer: Payroll admin operation boundary and a draft-only UI command.

Not authorized: Salary Engine semantics, tenant payroll provider configuration, attendance source data, payroll lifecycle transitions, Finance/accounting, or broad HR refactor.

## 5. Verification Plan

- Focused admin salary action tests proving draft-only recalculation, tenant scoping, no lifecycle overrides, non-draft protection, and no publish/approve/finalize/expense side effects.
- Scoped ESLint on touched files.
- `git diff --check`.
- No DB mutation and no field retry in this pass.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H7B PAYROLL CONFIG BOOTSTRAP

> **Status:** PASS - minimum tenant payroll config first-save persistence repair
> **Date:** 2026-09-28
> **Scope:** `saveProviderConfig` persistence boundary for missing `tenant_payroll_config` rows only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add or redesign Haircut payroll. It fixes the proven H7/H9 configuration connection blocker where the Settings salary UI can submit provider configuration, but the first save uses an update against a row that may not exist for the tenant.

Included:
- Persist first-time provider config rows for a tenant/provider pair.
- Preserve existing Settings UI payload shape and `tenant_payroll_config` storage contract.
- Preserve Salary Engine and provider calculation semantics.
- Preserve `DEFAULT_CONFIGS` as intentional bootstrap fallback when no tenant config exists.

Excluded:
- No change to `120000` default commission.
- No forced use of `booking.ktv_commission = 150000`.
- No Salary Engine, CommissionProvider, PayrollConfigService, schema, RLS, migration, payroll recalculation, payment, Finance, attendance, or Preschool change.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `tenant_payroll_config` | Shared HR/Payroll configuration | Tenant-specific provider policy rows |
| `saveProviderConfig` | Settings payroll configuration action | Existing UI persistence boundary |
| `DEFAULT_CONFIGS` | Payroll provider bootstrap defaults | Fallback only when tenant config is absent |

## 3. Contract Dependency Map

```
/dashboard/settings salary UI
        |
        v
saveProviderConfig
        |
        v
tenant_payroll_config tenant_id + provider_key
        |
        v
PayrollConfigService.getProviderConfig
        |
        v
CommissionProvider / Salary Engine
```

## 4. Change Authority

Authorized layer: Settings payroll configuration persistence for missing tenant/provider rows.

Not authorized: payroll calculation policy, Salary Engine, commission defaults, package commission semantics, schema/RLS/migrations, payroll lifecycle, or downstream Finance.

## 5. Verification Plan

- Focused `saveProviderConfig` tests proving first-time persistence uses tenant/provider upsert and preserves provider config payload.
- Scoped ESLint on touched files.
- `git diff --check`.
- Real UI field verification remains a separate step because this local worktree has no Supabase env file.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H6 PAYMENT AUTH CONTEXT

> **Status:** PASS - minimum payment action auth-context repair for Haircut checkout retry
> **Date:** 2026-09-28
> **Scope:** `recordRemainingPayment` booking snapshot / payment RPC client boundary only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add a Haircut payment capability. It fixes the proven H6 blocker where the Haircut customer payment workflow reaches `recordRemainingPayment`, resolves the current tenant, but reads the target booking through a raw no-session Supabase client and fails before any payment mutation.

Included:
- Use the existing authenticated/dev server Supabase context already proven in Haircut order workflow.
- Preserve current payment amount validation, idempotency lookup, accounting-period check, RPC contract, and tenant predicates.
- Retry only the existing H6 customer UI payment workflow for the verified Haircut booking.

Excluded:
- No payment architecture redesign.
- No RPC/schema/RLS change.
- No Finance/account 6421 fix.
- No salary, commission, notification, inventory, catalog, H1/H3/H4A/H5, or Preschool change.
- No generic replacement of raw clients in other payment operations.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `bookings.id/status/deposit_amount` | Beauty OS booking/order lifecycle | Existing booking payment summary/projection |
| `revenue.booking_id/amount/status` | Current operational payment recording | Existing payment truth for this workflow |
| `recordRemainingPayment` | Order/payment service action | Existing checkout/payment action |
| `record_remaining_payment_atomic` | Database payment RPC | Existing atomic payment persistence contract |

## 3. Contract Dependency Map

```
Haircut customer UI
        |
        v
recordRemainingPayment
        |
        +-- getCurrentUser -> tenant_id
        +-- authenticated/dev server Supabase context
        +-- bookings.id + bookings.tenant_id snapshot
        +-- revenue tenant/idempotency lookup
        +-- amount validation from persisted truth
        +-- record_remaining_payment_atomic RPC
```

## 4. Change Authority

Authorized layer: order/payment server action execution context for the proven H6 payment workflow.

Not authorized: database RPC changes, Finance/accounting configuration, RLS, payment framework redesign, payroll/commission policy, or broad Order refactor.

## 5. Verification Plan

- Focused payment action tests.
- Focused source invariant test for auth context and tenant/payment contract.
- Scoped ESLint on touched files.
- `git diff --check`.
- Browser retry of exact Haircut H6 payment workflow; stop at first new blocker if any.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H3 PACKAGE VALIDATOR AUTH CONTEXT

> **Status:** PASS - minimum service-layer auth-context repair for Haircut booking package validation
> **Date:** 2026-09-28
> **Scope:** `createBooking` package-validation execution context only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add a Haircut business capability. It fixes the proven H3 blocker where Haircut booking creation supplies a canonical `packages.id`, but package scope validation runs through a raw no-auth Supabase client in local mock-auth execution and RLS hides the package.

Included:
- Use the existing request/dev-bypass Supabase server pattern already used by order query actions.
- Preserve `package exists`, `package.tenant_id === resolved booking tenant`, and module-scope validation.
- Retry only the H3 Customer -> Service -> Booking workflow.

Excluded:
- No H1 routing change.
- No catalog deduplication.
- No barber/resource, completion, checkout, commission, payroll, Finance, report, or Preschool change.
- No DB migration or RLS policy change.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `packages.id` | Beauty OS service catalog / tenant service packages | Existing package identity used by booking |
| `bookings.package_id` | Beauty OS booking/order lifecycle | Existing booking-to-package relationship |
| `createBooking` | Order/booking service action | Existing write workflow |

## 3. Contract Dependency Map

```
Haircut BookingModal
        |
        v
payload.package_id = packages.id
        |
        v
createBooking
        |
        v
validateBookingPackageScope
        |
        +-- package exists
        +-- package tenant equals resolved booking tenant
        +-- package module enabled for tenant
```

## 4. Change Authority

Authorized layer: order/booking service action execution context for package validation.

Not authorized: schema, migration, catalog cleanup, product routing, downstream booking/session architecture, Finance/Payroll.

## 5. Verification Plan

- Focused package-scope unit tests.
- Focused booking auth-context unit test.
- Scoped ESLint on touched files.
- `git diff --check`.
- Browser retry of exact Haircut H3 workflow; stop at first new blocker if any.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H5 SERVICE LIFECYCLE AUTH CONTEXT

> **Status:** PASS - bounded service-layer auth-context repair for Haircut service start/completion
> **Date:** 2026-09-28
> **Scope:** `updateSessionLog` and `completeSession` Supabase execution context only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add a Haircut business capability. It fixes the proven H5 blocker where the Haircut service lifecycle resolves the correct tenant but performs RLS-sensitive `session_logs`/`bookings` reads through a raw no-session Supabase client.

Included:
- Use the existing request/dev-bypass Supabase server pattern already proven by H3 `createBooking` and H4A `updateBooking`.
- Preserve `session_logs.id`, `bookings.id`, explicit `tenant_id` predicates, booking/session relationship validation, schedule/resource guards, lifecycle rules, and completion engine behavior.
- Retry only the H5 service lifecycle workflow: scheduled -> in_progress -> completed.

Excluded:
- No fix for `createSessionLog`, `rescheduleSession`, payment, invoice, online booking, reuse package, discount, session note, extra session, sync progress, or unrelated raw-client occurrences.
- No H1/H3/H4A/H4B reopen.
- No catalog, checkout/payment, commission, attendance, payroll architecture, Finance, reports, Preschool, migration, or RLS change.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `session_logs.id/status` | Beauty OS booking/session lifecycle | Existing service-session identity and lifecycle state |
| `bookings.id/status/progress` | Beauty OS booking/order lifecycle | Existing booking relation and progress state |
| `updateSessionLog` | Order/booking service action | Existing session update/start workflow |
| `completeSession` | Order/booking service action | Existing completion workflow and downstream completion engine entry |

## 3. Contract Dependency Map

```
Haircut session UI
        |
        v
updateSessionLog / completeSession
        |
        +-- getCurrentUser -> tenant_id
        +-- authenticated/dev server Supabase context
        +-- session_logs.id + session_logs.tenant_id read/update
        +-- bookings.id + bookings.tenant_id read where required
        +-- completion engine behavior unchanged
```

## 4. Change Authority

Authorized layer: order/booking service action execution context for `updateSessionLog` and `completeSession`.

Not authorized: schema, migration, RLS, lifecycle redesign, completion-engine redesign, resource configuration, payment/commission/payroll/Finance/report behavior, or cross-order refactor.

## 5. Verification Plan

- Focused session lifecycle auth-context/source invariant test.
- Focused `completeSession` regression test.
- Scoped ESLint on touched files.
- `git diff --check`.
- Browser retry of exact Haircut H5 lifecycle; stop at first new blocker if any.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H5B INVENTORY AUTOCONSUME AUTH CONTEXT

> **Status:** PASS - minimum inventory auto-consume auth-context repair for Haircut completion retry
> **Date:** 2026-09-28
> **Scope:** `autoConsumeForSession` tenant config / existing-consumption read boundary only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add a Haircut or Inventory capability. It fixes the proven H5B blocker where Haircut service completion reaches `autoConsumeForSession`, but the first RLS-sensitive tenant config read uses a raw no-session Supabase client and cannot determine that current inventory behavior should be a NOOP.

Included:
- Use the existing request/dev-bypass Supabase server pattern already proven in Haircut order workflow.
- Preserve `getCurrentUser()` tenant resolution, explicit tenant predicates, existing inventory rules, and NOOP behavior when `auto_consume_inventory` is disabled.
- Retry only the existing H5B completion workflow from `in_progress` to `completed`.

Excluded:
- No change to global `getSupabaseWithTenant`.
- No replacement of other raw inventory clients.
- No inventory configuration, fake consumables, RLS, schema, migration, salary/payroll, commission, checkout/payment, Finance, reports, H1/H3/H4A/H4B, or Preschool change.
- No fix for the deferred `COMPLETION_ROLLBACK_SALARY_SIDE_EFFECT` finding.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `tenants.salary_config.auto_consume_inventory` | Tenant/product configuration | Existing switch for automatic inventory consumption |
| `package_materials` | Inventory / Beauty OS package material configuration | Existing consumable definitions |
| `inventory_logs` | Inventory OS operational ledger | Existing inventory consumption records |
| `autoConsumeForSession` | Inventory integration called by session completion | Existing optional completion side effect |

## 3. Contract Dependency Map

```
Haircut completion
        |
        v
processSessionCompletion
        |
        v
autoConsumeForSession(package_id, session_log_id)
        |
        +-- getCurrentUser -> tenant_id
        +-- authenticated/dev server Supabase context
        +-- tenants.id + salary_config read
        +-- if disabled -> NOOP / bypass
        +-- if enabled -> existing inventory business rules
```

## 4. Change Authority

Authorized layer: inventory auto-consume server action execution context for the current completion boundary.

Not authorized: global inventory auth refactor, inventory data setup, salary rollback behavior, completion transaction redesign, Finance/Payroll, or cross-domain architecture changes.

## 5. Verification Plan

- Focused inventory auto-consume tests.
- Focused source invariant test for auth context and tenant predicates.
- Scoped ESLint on touched files.
- `git diff --check`.
- Browser retry of exact Haircut H5B completion; stop at first new blocker if any.

---

# ARCHITECTURE GATE RESULT - BELLA HAIRCUT H4A BARBER ASSIGNMENT AUTH CONTEXT

> **Status:** PASS - minimum service-layer auth-context repair for Haircut barber assignment
> **Date:** 2026-09-28
> **Scope:** `updateBooking` Supabase execution context only

---

## 1. Product Manifest (Capabilities & Scope)

This change does not add a Haircut business capability. It fixes the proven H4A blocker where `updateBooking` resolves the correct Haircut tenant but performs the first `bookings` read through a raw no-session Supabase client, causing RLS to hide the booking before the KTV assignment update can run.

Included:
- Use the existing request/dev-bypass Supabase server pattern proven by H3 booking creation.
- Preserve `bookings.id` identity, explicit `tenant_id` scoping, payload validation, and existing business rules.
- Retry only the H4A barber assignment workflow.

Excluded:
- No RLS policy change.
- No tenant routing redesign.
- No barber identity redesign.
- No chair/resource assignment.
- No customer CRUD, booking creation, session lifecycle, attendance, commission, payroll, checkout/payment, Finance, reports, or Preschool change.
- No DB migration.

## 2. Ownership Map

| Artifact | Owner Context | Data Definition |
|---|---|---|
| `bookings.id` | Beauty OS booking/order lifecycle | Existing booking identity |
| `bookings.assigned_ktv_id` | Beauty OS staff assignment on booking | Existing KTV assignment field |
| `updateBooking` | Order/booking service action | Existing booking update workflow |

## 3. Contract Dependency Map

```
Haircut ActiveBookingPanel
        |
        v
updateBooking(booking.id, assigned_ktv_id)
        |
        +-- getCurrentUser -> tenant_id
        +-- authenticated/dev server Supabase context
        +-- bookings.id + bookings.tenant_id read
        +-- bookings.id + bookings.tenant_id update
```

## 4. Change Authority

Authorized layer: order/booking service action execution context for `updateBooking`.

Not authorized: schema, migration, RLS, product routing, resource assignment, staff identity model, session lifecycle, Finance/Payroll, or cross-product refactor.

## 5. Verification Plan

- Focused `updateBooking` regression tests.
- Focused auth-context/source invariant test.
- Scoped ESLint on touched files.
- `git diff --check`.
- Browser retry of exact Haircut H4A barber assignment; stop at first new blocker if any.

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
