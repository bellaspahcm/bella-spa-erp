# Investigation: BabyCare Legacy Save Path Audit

## Hand-off Brief

1. **What happened.** User requested READ-ONLY audit of Bella BabyCare legacy save/create/update/edit paths, focused on slow save performance, with no code, migration, commit, or production mutation.
2. **Where the case stands.** Active; stronghold found in shared BabyCare/Spa legacy server actions (`createBooking`, `updateBooking`, `completeSession`, customer and attendance actions), but latency baseline and root cause are not proven.
3. **What's needed next.** Build an executable proof/staging baseline for the top slow flows and measure latency/round trips before any minimal fix proposal.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-10-02 |
| Status | Active |
| System | Bella Spa ERP, BabyCare legacy shared Spa/BabyCare save paths |
| Evidence sources | Source code read-only; governance constitution; local memory notes |

## Problem Statement

The user reports BabyCare save/create/update/edit operations feel slow and asks for a read-only save path audit. The initial hypothesis is that multiple sequential save operations may be causing long save time, but this must be proven with baseline evidence before any code change.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `docs/governance/BELLA_AI_CODING_CONSTITUTION.md` | Available | Requires Truth -> Source of Truth -> Contract -> Ownership -> minimal change; no evidence means no closure. |
| `docs/architecture/HEALTHCARE_VERTICAL_CODING_CONSTITUTION.md` | Available | Read because AGENTS requires it before vertical work; no Healthcare modification authorized. |
| `docs/architecture/EDUCATION_VERTICAL_CODING_CONSTITUTION.md` | Available | Read because AGENTS requires it before vertical work; no Education modification authorized. |
| `src/core/services/order/create-booking-action.ts` | Available | Primary booking creation path calls helpers sequentially. |
| `src/core/services/order/create-booking-helpers.ts` | Available | Contains customer creation, package scope, booking upsert, revenue/outbox, session log creation. |
| `src/core/services/order/update-booking-action.ts` | Available | Booking update path includes validation, conflict checks, audit, notification, session sync, progress sync. |
| `src/core/services/order/complete-session-action.ts` | Available | Session completion entrypoint. |
| `src/core/services/order/session-completion-engine.ts` | Available | Completion side-effect orchestrator explicitly runs sequentially. |
| `src/services/customer-actions.ts` | Available | Customer create/update/delete paths include audit and optional geocoding. |
| `src/services/attendance-actions.ts` | Available | Attendance and leave approval paths include audit, reassignment, notifications. |
| Executable latency baseline | Missing | No proof/staging run performed in this phase. |
| DB/network timing | Missing | Requires instrumentation or proof environment, not production. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| - | --- | --- | --- | --- |
| 1 | Create booking round-trip baseline | High | Open | Candidate hot path; source shows many sequential awaited operations. |
| 2 | Complete session round-trip baseline | High | Open | Source comment claims typical 2-3s, but current proof missing. |
| 3 | Update booking reschedule/reassign baseline | High | Open | Candidate N-per-session conflict loop and sync. |
| 4 | Customer create/update with geocoding baseline | Medium | Open | External geocode may block save when address changes. |
| 5 | Attendance leave approval with reassignment baseline | Medium | Open | Reassignment loop and notifications may be sequential. |

## Confirmed Findings

### Finding 1: `createBooking` executes a sequential critical path

**Evidence:** `src/core/services/order/create-booking-action.ts:170`, `src/core/services/order/create-booking-action.ts:197`, `src/core/services/order/create-booking-action.ts:202`, `src/core/services/order/create-booking-action.ts:232`, `src/core/services/order/create-booking-action.ts:235`, `src/core/services/order/create-booking-action.ts:241`, `src/core/services/order/create-booking-action.ts:258`, `src/core/services/order/create-booking-action.ts:268`, `src/core/services/order/create-booking-action.ts:278`, `src/core/services/order/create-booking-action.ts:335`

**Detail:** The source path awaits package scope validation, optional customer creation, pending booking lookup, tenant context, booking payload/pricing, booking upsert, deposit revenue/outbox, session log creation, optional service items, then path revalidation.

### Finding 2: `recordBookingDepositRevenue` keeps accounting period, revenue insert, and accounting outbox inside the create-booking save path

**Evidence:** `src/core/services/order/create-booking-helpers.ts:452`, `src/core/services/order/create-booking-helpers.ts:486`, `src/core/services/order/create-booking-helpers.ts:508`, `src/core/services/order/create-booking-helpers.ts:536`

**Detail:** Deposit handling validates the accounting period, inserts revenue, and enqueues accounting outbox before returning success. If outbox enqueue fails, it deletes the revenue and booking.

### Finding 3: `completeSession` writes the session first, then delegates to a sequential side-effect engine

**Evidence:** `src/core/services/order/complete-session-action.ts:18`, `src/core/services/order/complete-session-action.ts:101`, `src/core/services/order/complete-session-action.ts:118`, `src/core/services/order/session-completion-engine.ts:127`, `src/core/services/order/session-completion-engine.ts:145`, `src/core/services/order/session-completion-engine.ts:150`, `src/core/services/order/session-completion-engine.ts:156`, `src/core/services/order/session-completion-engine.ts:168`, `src/core/services/order/session-completion-engine.ts:183`, `src/core/services/order/session-completion-engine.ts:199`, `src/core/services/order/session-completion-engine.ts:221`, `src/core/services/order/session-completion-engine.ts:240`

**Detail:** Completion validates accounting period, consumes inventory, syncs booking progress, records revenue, recalculates salary, creates review placeholder, enqueues outbox, and invokes adapter completion callback.

### Finding 4: Audit logging is blocking in customer and booking mutations

**Evidence:** `src/services/customer-actions.ts:480`, `src/services/customer-actions.ts:530`, `src/services/customer-actions.ts:558`, `src/services/customer-actions.ts:622`, `src/core/services/order/create-booking-helpers.ts:143`, `src/core/services/order/create-booking-helpers.ts:398`, `src/core/services/order/update-booking-action.ts:249`

**Detail:** Audit failure triggers rollback in several paths. This is correctness-preserving behavior, not yet a proven performance root cause.

### Finding 5: Some notifications are best-effort, but still awaited inside certain save paths

**Evidence:** `src/core/services/order/update-booking-action.ts:279`, `src/services/attendance-actions.ts:703`, `src/services/attendance-actions.ts:800`

**Detail:** Notification failures are caught/logged, but notification sends are awaited before action return in booking reassignment and leave approval flows.

## Deduced Conclusions

### Deduction 1: The most plausible first baseline targets are create booking, complete session, and update booking

**Based on:** Findings 1, 2, and 3.

**Reasoning:** These paths combine multiple DB writes, read-after-write/selects, audit/outbox/revenue/side effects, and revalidation. They are more likely to expose save latency than isolated single-row updates.

**Conclusion:** Start baseline with those three flows before broadening to customer, attendance, payroll, or inventory.

## Hypothesized Paths

### Hypothesis 1: Create booking latency is dominated by sequential DB round trips and blocking accounting/outbox work

**Status:** Open

**Theory:** The create path waits for package validation, tenant context, pricing package fetch, booking write, audit, revenue, outbox, session log creation, and revalidation.

**Supporting indicators:** Source trace shows these awaits in one request.

**Would confirm:** Proof/staging timing showing these calls dominate total latency.

**Would refute:** Timing showing frontend, network, Supabase auth/session resolution, or another untraced layer dominates.

**Resolution:** Pending baseline.

### Hypothesis 2: Complete session latency is dominated by mandatory side-effect sequencing

**Status:** Open

**Theory:** Inventory, booking progress, revenue, salary, review, and outbox are all awaited before success.

**Supporting indicators:** The engine comment describes sequential execution and typical 2-3 seconds, but current run evidence is missing.

**Would confirm:** Timed proof run with per-step measurements.

**Would refute:** Timed proof run showing a single DB query, external service, or environment overhead dominates.

**Resolution:** Pending baseline.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Proof/staging environment identity | Cannot mutate or benchmark safely | Identify dedicated non-production DB/tenant with equivalent schema. |
| Latency baseline | Cannot prove save performance root cause | Instrument or log per-step timing in proof/staging only. |
| Current DB query duration/round trips | Cannot separate DB vs app vs network | Use Supabase logs, server timing, or wrapper instrumentation in proof/staging. |
| Production observation without mutation | Cannot tie code paths to user-reported slow flow | Read-only production logs/telemetry if available. |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | No error origin yet; performance complaint only. |
| Trigger | BabyCare/Spa legacy save actions from dashboard/customer/session/booking UI. |
| Condition | Multiple sequential awaited DB/service calls in shared legacy server actions. |
| Related files | `create-booking-action.ts`, `create-booking-helpers.ts`, `update-booking-action.ts`, `complete-session-action.ts`, `session-completion-engine.ts`, `customer-actions.ts`, `attendance-actions.ts`. |

## Conclusion

**Confidence:** Low

Read-only source audit confirms several save paths have long sequential critical paths, but it does not yet prove why BabyCare save is slow in production or proof. Root cause remains NOT_PROVEN until a dedicated proof/staging baseline measures latency, DB round trips, side effects, retries, and revalidation cost.

## Recommended Next Steps

### Diagnostic

Run `BABYCARE_SAVE_BASELINE` in a dedicated non-production environment for create booking, update booking, complete session, customer update, and leave approval. Capture total latency and per-step timing without mutating production.

### Fix direction

No fix yet. After baseline, propose exactly one minimal fix for the proven root cause.

## Reproduction Plan

1. Confirm proof/staging DB/tenant.
2. Seed or identify non-production BabyCare package, customer, KTV, booking, session, attendance, and payroll records.
3. Execute the target flows once for functional correctness and repeated enough for rough timing.
4. Collect per-step timing and DB call count.
5. Classify each flow as KEEP, HARDEN, MIGRATE, DEFER, or REPLACE.

## Current Checkpoint

```text
BABYCARE_LEGACY_HARDENING

Production mutation        = FORBIDDEN
Runtime code changes       = NONE
Commit                     = NONE

Source trace               = DONE / IN PROGRESS
Save performance           = NOT_PROVEN
Baseline                   = NOT_STARTED
Root cause                 = NOT_PROVEN

Rollback                   = SOURCE_TRACE_STARTED
Audit/history              = SOURCE_TRACE_STARTED
Tenant isolation           = SOURCE_TRACE_STARTED
Finance                    = DEFERRED

Next action                = BABYCARE_SAVE_BASELINE
```

## Baseline Principle

Multiple awaited calls in the source trace are not enough to prove sequential execution is the bottleneck.

```text
Many awaits
  !=
Sequential execution is the bottleneck
```

The next phase must measure the dedicated proof/staging execution path before selecting any minimal fix. Rollback, audit/history, tenant isolation, and Finance findings remain recorded here, but they do not open implementation scope unless the measured root cause requires it and the user explicitly approves that boundary.

## BABYCARE_SAVE_BASELINE - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Proof/staging mutation     = .env.e2e only
Runtime code changes       = NONE
Commit                     = NONE
Baseline harness           = scripts/babycare-save-baseline.mjs
Latest report              = implementation-artifacts/investigations/babycare-save-baseline-1790914296924.md
```

The baseline harness refuses to run unless `BABYCARE_BASELINE_ENV_FILE` resolves to `.env.e2e` and the Supabase host is `bmnbqbcdbuklhopfbopv.supabase.co`.

### Result

```text
Status                     = PASS_DB_CRITICAL_PATH_ONLY
Server action total        = NOT_MEASURED
UI latency                 = NOT_MEASURED
Root cause                 = NOT_PROVEN
Cleanup                    = PASS
```

### Measured DB Critical Path

| Flow | DB steps | Total measured ms | Failed steps | Classification |
| --- | ---: | ---: | ---: | --- |
| Create booking | 15 | 2864.14 | 0 | HARDEN_CANDIDATE |
| Update booking | 7 | 620.30 | 0 | KEEP / DEFER |
| Complete session | 11 | 1308.73 | 0 | HARDEN_CANDIDATE |

### Slowest Steps

| Flow | Step | ms |
| --- | --- | ---: |
| Create booking | insert_booking_select | 591.34 |
| Create booking | insert_initial_session_logs | 281.20 |
| Create booking | insert_deposit_revenue | 231.55 |
| Create booking | package_scope_package_select | 197.12 |
| Create booking | find_pending_booking_for_customer | 174.93 |
| Update booking | fetch_scheduled_sessions_for_conflict | 106.29 |
| Update booking | fetch_old_booking_for_audit | 104.79 |
| Complete session | update_booking_progress | 238.86 |
| Complete session | fetch_booking_for_completion | 238.72 |
| Complete session | fetch_current_booking_for_progress | 118.48 |

### Interpretation

This baseline proves that the E2E proof DB critical path is measurable and that `create_booking` is the heaviest of the three traced flows. It does not yet prove production root cause or full user-visible save latency because server action overhead, revalidation, frontend waterfall, network conditions, and production DB execution are not measured here.

### Harness Calibration Notes

Earlier calibration runs failed on proof-schema constraints before the full pass:

| Marker | Result | Calibration finding |
| --- | --- | --- |
| babycare-save-baseline-1790914120132 | PARTIAL_NOT_PROVEN | `revenue.accounting_review_status` must use accounting statuses such as `NEEDS_REVIEW`, not `PENDING_REVIEW`. |
| babycare-save-baseline-1790914159654 | PARTIAL_NOT_PROVEN | `salary_records` in proof DB has no matching `ON CONFLICT` target for the attempted upsert. |
| babycare-save-baseline-1790914186311 | PARTIAL_NOT_PROVEN | `session_reviews.status` must use domain review statuses such as `pending_review`, not accounting status `NEEDS_REVIEW`. |

These were harness/schema alignment issues, not runtime BabyCare fixes.

### Next Action

```text
Next action                = SERVER_ACTION_TIMING_BASELINE
Allowed scope              = instrumentation or wrapper timing in proof/staging only
Minimal fix                = NOT_SELECTED
```

Do not optimize sequential execution yet. The next baseline must measure full server action spans for create booking and complete session, including validation, DB calls, audit/outbox, revalidation, and response timing, before selecting exactly one minimal fix.

## SERVER_ACTION_TIMING_BASELINE - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Proof/staging mutation     = .env.e2e only
Runtime code changes       = NONE
Commit                     = NONE
Baseline harness           = scripts/babycare-server-action-timing-baseline.ts
Latest report              = implementation-artifacts/investigations/babycare-server-action-baseline-1790914882004.md
```

The harness measures an action-path wrapper on the E2E proof database. It does not call the exported Next server action directly because that path requires request-bound current-user context. Audit is measured as an equivalent `audit_logs` insert. Revalidation is only a probe outside the Next static generation store and is therefore not proof of real revalidation latency.

### Result

```text
Status                     = PASS_ACTION_WRAPPER_ONLY
Cleanup                    = PASS
Browser/UI latency         = NOT_MEASURED
Direct Next server action  = NOT_MEASURED
Root cause                 = NOT_PROVEN
Minimal fix                = NOT_SELECTED
```

### Action-Path Wrapper Timing

| Flow | Action wrapper ms | DB ms | Audit ms | Outbox ms | Validation ms | Revalidation probe ms | Failed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Create booking | 2919.83 | 2055.50 | 300.70 | 134.03 | 1.90 | 224.23 | 0 |
| Complete session | 1109.76 | 1021.97 | 0.00 | 82.93 | 0.06 | 2.10 | 0 |

### Slowest Steps

| Flow | Step | Category | ms |
| --- | --- | --- | ---: |
| Create booking | insert_initial_session_logs | DB | 306.93 |
| Create booking | safe_revalidate_paths | revalidation probe | 224.23 |
| Create booking | insert_deposit_revenue | DB | 197.95 |
| Create booking | audit_customers_insert | audit | 184.15 |
| Create booking | find_pending_booking_for_customer | DB | 169.33 |
| Create booking | tenant_resolution_probe | DB | 164.22 |
| Complete session | fetch_booking_for_completion | DB | 154.20 |
| Complete session | fetch_existing_session_security_check | DB | 125.69 |
| Complete session | update_session_completed | DB | 105.05 |
| Complete session | fetch_current_booking_for_progress | DB | 102.89 |
| Complete session | insert_salary_record_probe | DB | 100.75 |

### Interpretation

The action-path wrapper strengthens the hypothesis that proof/staging latency is concentrated in the DB/audit/outbox critical path, especially for `create_booking`. However, this is still not a production root cause because the exported Next server action, request-bound auth/current-user resolution, real revalidation context, browser waterfall, and UI render/update are not measured.

```text
Create booking DB+audit+outbox share      = STRONG_CANDIDATE
Complete session DB+outbox share          = STRONG_CANDIDATE
Sequential execution as root cause        = NOT_PROVEN
Production user-visible bottleneck        = NOT_PROVEN
```

### Next Action

```text
Next action                = DIRECT_NEXT_OR_UI_TIMING_BASELINE
Allowed scope              = proof/staging only
Minimal fix                = NOT_SELECTED
```

The next measurement should either capture a direct Next/dev-server server-action request or a Playwright/browser submit timing on `.env.e2e`, then compare:

```text
DB/audit/outbox wrapper time
vs
actual server-action or browser-observed save time
```

Only after that comparison should a minimal fix be proposed.

## DIRECT_NEXT_OR_UI_TIMING_BASELINE - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Proof/staging mutation     = .env.e2e only
Runtime code changes       = NONE
Commit                     = NONE
Baseline harness           = scripts/babycare-direct-ui-timing-baseline.ts
Latest report              = implementation-artifacts/investigations/babycare-direct-ui-baseline-1790916270511.md
```

The harness starts a local Next dev server against `.env.e2e`, drives `/dashboard` through Playwright, opens `BookingModal`, and attempts the Create booking UI flow. It reuses an existing E2E BabyCare baseline tenant/user pair and creates only marker-scoped package/customer/booking data for the attempted flow.

### Result

```text
Status                     = PARTIAL_NOT_PROVEN
Cleanup                    = PASS
Browser submit latency     = NOT_MEASURED
Direct Next server action  = PRE_SUBMIT_MEASURED
Root cause                 = NOT_PROVEN
Minimal fix                = NOT_SELECTED
Blocker                    = PACKAGE_MODULE_KEY_SCHEMA_CODE_DRIFT
```

### Evidence

| Evidence | Detail |
| --- | --- |
| Proof DB module-key shape | E2E proof DB package count query returned `babycare = 4`, `beauty_spa = 845`, `baby_care = 0`. |
| DB constraint | `supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql:43-44` defines `packages_module_key_check` as `module_key IN ('babycare', 'beauty_spa')`. |
| Runtime package scope | `src/services/package-actions.ts:108` maps enabled `babycare` to `baby_care`; `src/services/package-actions.ts:260` filters `packages.module_key` by those scoped keys. |
| Harness calibration | Marker `babycare-direct-ui-baseline-1790916177257` failed inserting a `baby_care` package with `packages_module_key_check`. |
| Direct UI run | Marker `babycare-direct-ui-baseline-1790916270511` inserted a `babycare` package, opened dashboard and modal, then failed at package selection because the modal displayed `Chưa có dữ liệu gói dịch vụ`. |
| Cleanup | Marker `babycare-direct-ui-baseline-1790916270511` cleanup passed; `cleanup_delete_packages` removed the marker-scoped package. |

### Interpretation

The direct UI baseline cannot currently measure Create booking save latency in this proof environment because the UI package-selection prerequisite is blocked by schema/code drift:

```text
Proof DB accepts/stores          = babycare
Runtime scoped package filter    = baby_care
BookingModal visible packages    = empty
Create booking submit latency    = NOT_MEASURED
```

This is a valid blocker for `DIRECT_NEXT_OR_UI_TIMING_BASELINE`, but it is not evidence that BabyCare save performance is slow because of sequential DB writes, audit, outbox, or UI rendering.

### Proof Cleanup Caveat

A follow-up read of the E2E proof DB found older marker tenants still present:

```text
babycare-direct-ui-baseline-1790915517756 tenant
babycare-save-baseline-1790914120132 tenant
babycare-save-baseline-1790914159654 tenant
babycare-save-baseline-1790914186311 tenant
babycare-save-baseline-1790914296924 tenant
```

Therefore prior `cleanup = PASS` entries should be interpreted as "the cleanup delete calls returned no API error", not as verified row-count deletion. The latest direct UI marker package for `babycare-direct-ui-baseline-1790916270511` was separately checked and was absent after cleanup. Future proof harnesses should verify cleanup with post-delete reads or returning row counts before writing `Cleanup = PASS`.

### Classification

```text
Save performance root cause      = NOT_PROVEN
Direct UI baseline               = BLOCKED
Package module-key drift         = HARDEN_CANDIDATE / CONTRACT GAP
Performance minimal fix          = NOT_SELECTED
Runtime fix approval             = REQUIRED BEFORE CODE
```

### Next Action

```text
Next action                = PROOF_ENV_CONTRACT_ALIGNMENT_DECISION
Allowed scope              = no runtime implementation without approval
Options                    = align dedicated proof schema/data to runtime contract, or approve a narrow package module-key compatibility investigation
```

Do not treat the package module-key drift as the selected save-performance fix. It is a blocker to measuring the UI save path. The save-performance stream should resume only after the proof environment can create/select a BabyCare package through the same UI path without mutating production.

## Current Checkpoint - 2026-10-02

```text
BABYCARE_LEGACY_HARDENING

Production mutation        = FORBIDDEN
Runtime code changes       = NONE
Commit                     = NONE

Source trace               = DONE
DB baseline                = PASS_DB_CRITICAL_PATH_ONLY
Action wrapper baseline    = PASS_ACTION_WRAPPER_ONLY
Direct UI baseline         = BLOCKED_BY_PACKAGE_MODULE_KEY_DRIFT
Proof cleanup hygiene      = PARTIAL_NEEDS_VERIFIED_ROW_COUNT

Create booking             = 2864.14 ms DB critical path
Create booking action      = 2919.83 ms action-path wrapper
Complete session           = 1308.73 ms DB critical path
Complete session action    = 1109.76 ms action-path wrapper

Root cause                 = NOT_PROVEN
Minimal fix                = NOT_SELECTED

Rollback                   = SOURCE_TRACE_STARTED
Audit/history              = SOURCE_TRACE_STARTED
Tenant isolation           = SOURCE_TRACE_STARTED
Finance                    = DEFERRED

Next action                = PROOF_ENV_CONTRACT_ALIGNMENT_DECISION
```

## PROOF_ENV_CONTRACT_ALIGNMENT_DECISION - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Proof/staging mutation     = no new mutation needed for this decision
Runtime code changes       = NONE
Commit                     = NONE
Decision scope             = packages.module_key BabyCare canonical contract
```

### Confirmed Evidence

| Evidence | Finding |
| --- | --- |
| `supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql:15-18` | Existing or missing `packages.module_key` values are normalized to `babycare`. |
| `supabase/migrations/20260608110000_create_beauty_spa_phase2_foundation.sql:28-44` | `packages.module_key` default is `babycare`; DB check constraint allows only `babycare` and `beauty_spa`. |
| Proof DB package count | `.env.e2e` proof DB currently has `babycare = 4`, `beauty_spa = 845`, `baby_care = 0`. |
| Direct UI calibration `babycare-direct-ui-baseline-1790916177257` | Inserting `module_key = baby_care` failed on `packages_module_key_check`. |
| `src/lib/business-rules/tenant-modules.ts:3-4` | Tenant module contract names include `babycare`, not `baby_care`. |
| `src/lib/business-rules/service-package.ts:124-128` | Service package module normalization falls back to `babycare`. |
| `src/core/services/order/public-booking-packages.ts:54-61` and `:80-81` | Public BabyCare package loading filters `module_key` as null or `babycare`. |
| `src/app/dashboard/services/hooks/useServicesPageState.ts:210-225`, `:496-500`, `:656-661`, `:795-801` | Services UI seed/edit/default module handling uses `babycare`. |
| `src/services/package-actions.ts:105-108`, `:256-260`, `:294-301` | Admin package actions map enabled `babycare` to persisted/filter value `baby_care`. |
| Git commit `13417962b` | Commit titled `fix babycare service packages load mapping error` introduced the `babycare -> baby_care` mapping in `src/services/package-actions.ts` and adjusted `src/__tests__/package-actions.test.ts` to expect `baby_care`. |

### Decision

```text
Persisted packages.module_key canonical for current proof schema = babycare
Runtime package-actions value                         = baby_care
Classification                                        = CONTRACT / SCHEMA DRIFT
Fixture-only drift                                    = REFUTED
Harness-only fix                                      = NOT_VALID
```

Reasoning:

1. The DB migration and actual E2E proof DB accept/store `babycare`.
2. Multiple non-admin package paths still use `babycare`.
3. The failing BookingModal path imports `getPackages` through `src/core/services/order/query-actions.ts`, which delegates to `src/services/package-actions.ts`.
4. `package-actions` converts enabled `babycare` tenants into a `packages.module_key IN ('baby_care')` filter, so a valid `babycare` fixture is invisible.
5. Changing the harness to `baby_care` cannot work on the current proof schema, and changing it to another module would no longer measure BabyCare.

### Direct UI Baseline Impact

```text
Package fixture            = can be inserted only as babycare
BookingModal package list  = filters as baby_care
Submit save path           = unreachable
UI save latency            = NOT_MEASURED
Save root cause            = NOT_PROVEN
```

### Next Action

```text
Next action                = REQUEST NARROW RUNTIME CONTRACT APPROVAL
Allowed implementation     = none until approved
Candidate scope            = package module-key compatibility only
Not in scope               = save performance optimization, Promise.all, audit/outbox redesign, transaction rewrite
```

If approval is granted, the minimal follow-up should be a narrow compatibility repair or contract migration decision for `packages.module_key` so `getPackages` and `createPackage/updatePackage` agree with the persisted DB contract. Only after that passes proof and BookingModal can see the package should `DIRECT_NEXT_OR_UI_TIMING_BASELINE` be rerun.

### Narrow Runtime Approval Gate

Runtime implementation is not authorized yet. The only runtime change that has enough evidence to request approval is:

```text
Scope                  = src/services/package-actions.ts only
Allowed mechanism      = remove/reverse the babycare -> baby_care persistence/filter mapping
Target contract        = persisted packages.module_key = babycare
Immediate objective    = BookingModal can see a valid BabyCare package and submit becomes reachable
```

Explicitly not authorized:

```text
No package-system refactor
No migration/schema change
No public UI contract expansion beyond the required package visibility path
No save-performance optimization
No Promise.all conversion
No audit/outbox change
No transaction rewrite
No broader BabyCare scope
```

If this narrow runtime fix is later approved, the required sequence is:

```text
Minimal runtime fix
-> targeted package-actions test/typecheck
-> Direct UI baseline
-> measure real Create Booking submit latency
-> compare UI timing with DB/action-wrapper baselines
-> only then decide whether any save-performance fix is needed
```

## Updated Checkpoint - 2026-10-02

```text
BABYCARE_LEGACY_HARDENING

Production mutation        = FORBIDDEN
Runtime code changes       = NONE
Commit                     = NONE

DB baseline                = PASS_DB_CRITICAL_PATH_ONLY
Action wrapper baseline    = PASS_ACTION_WRAPPER_ONLY
Direct UI baseline         = BLOCKED_BY_PACKAGE_MODULE_KEY_DRIFT
Proof contract decision    = DONE

Canonical package key      = babycare for current persisted proof schema
Runtime drift              = package-actions maps BabyCare to baby_care
Fixture-only drift         = REFUTED
Harness-only fix           = NOT_VALID

Save root cause            = NOT_PROVEN
Minimal fix                = NOT_SELECTED
Runtime fix                = NOT_AUTHORIZED

Next action                = REQUEST NARROW RUNTIME CONTRACT APPROVAL
```

## NARROW_RUNTIME_CONTRACT_FIX - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Runtime fix scope          = package module-key contract only
Performance fix            = NONE
Commit                     = NONE
```

### Changed Files

| File | Change |
| --- | --- |
| `src/services/package-actions.ts` | Removed `babycare -> baby_care` conversion from package filter, create payload, and update payload. Kept existing tenant module entitlement checks. |
| `src/__tests__/package-actions.test.ts` | Updated targeted package-action expectations to canonical `babycare`. |
| `docs/architecture/ARCHITECTURE_GATE_RESULT_BABYCARE_PACKAGE_MODULE_KEY_CONTRACT_REPAIR_2026_10_02.md` | Added mandatory Architecture Gate for the narrow runtime contract repair. |

### Verification

```text
npx jest src/__tests__/package-actions.test.ts --runInBand
PASS: 16/16 tests
```

Initial red/green note:

```text
Before test update after runtime fix:
14/16 passed, 2 failed only because tests expected old baby_care drift.
After test contract update:
16/16 passed.
```

### Direct UI Baseline After Runtime Fix

Report:

```text
implementation-artifacts/investigations/babycare-direct-ui-baseline-1790922970612.md
```

Result:

```text
Status                         = PASS_UI_BASELINE
Browser submit -> save complete = 2962.97 ms
Proof tenant                    = existing E2E BabyCare baseline tenant
Performance code change         = NONE
```

Cleanup:

```text
Generated cleanup               = PASS
Post-cleanup verification       = VERIFIED
Remaining marker customers      = 0
Remaining marker bookings       = 0
Remaining marker revenue        = 0
Remaining marker sessions       = 0
```

### Interpretation

The narrow contract drift is fixed enough for the direct UI Create Booking path to become reachable in proof/staging.

```text
Package module-key drift        = HARDENED
Direct UI baseline              = PASS
Create Booking UI latency       = MEASURED_ONCE
Save performance root cause     = NOT_PROVEN
Minimal performance fix         = NOT_SELECTED
```

Comparison with prior baselines:

| Flow | Measurement | Timing |
| --- | --- | ---: |
| Create booking | DB critical path baseline | 2864.14 ms |
| Create booking | Action-path wrapper baseline | 2919.83 ms |
| Create booking | Direct UI submit -> save-complete business rows | 2962.97 ms |

The UI submit timing is in the same order of magnitude as the DB/action baselines, so the DB/audit/outbox critical path remains a strong candidate. It is still not a proven root cause because this is one UI run, the submit Next action is not isolated from other Next action POSTs, and the measurements were not collected in one correlated trace.

### Next Action

```text
Next action                = CORRELATED_CREATE_BOOKING_TRACE
Allowed scope              = measurement only
Not authorized             = performance optimization, Promise.all, audit/outbox rewrite, transaction rewrite
```

Recommended next diagnostic:

1. Tag or isolate the actual Create Booking submit server action in the UI baseline.
2. Capture correlated timing for submit action total, DB, audit, outbox, revalidation, and response in the same run.
3. Only then choose whether there is a single minimal performance fix.

## Updated Checkpoint After Approval - 2026-10-02

```text
BABYCARE_LEGACY_HARDENING

Production mutation        = FORBIDDEN
Runtime contract fix       = DONE
Performance code change    = NONE
Commit                     = NONE

Package module-key drift   = HARDENED
Package-actions test       = PASS 16/16
Direct UI baseline         = PASS_UI_BASELINE
Create booking UI latency  = 2962.97 ms

Save root cause            = NOT_PROVEN
Minimal performance fix    = NOT_SELECTED

Next action                = CORRELATED_CREATE_BOOKING_TRACE
```

## CORRELATED_CREATE_BOOKING_TRACE - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Runtime performance change = NONE
Flow                       = Create Booking only
Direct server-action patch = NONE
Commit                     = NONE
```

Report:

```text
implementation-artifacts/investigations/babycare-correlated-create-booking-trace-1790923604477.md
```

### Correlation Result

| Layer | Measurement | Timing |
| --- | --- | ---: |
| Direct UI | submit -> save-complete business rows | 2962.97 ms |
| Direct UI | likely submit Next-Action POST | 2350.82 ms |
| Action-equivalent trace | full measured path | 2286.35 ms |

The likely submit POST is inferred from the latest UI baseline ordering and action-id capture, not direct symbol mapping.

### Action-Equivalent Bucket Breakdown

| Bucket | Timing | Share of action-equivalent total |
| --- | ---: | ---: |
| DB | 1538.65 ms | 67.3% |
| Revalidation probe | 214.61 ms | 9.4% |
| Audit | 204.37 ms | 8.9% |
| Outbox | 83.27 ms | 3.6% |
| Validation | 2.97 ms | 0.1% |
| Service compute | 0.16 ms | 0.0% |
| Response shaping | 0.06 ms | 0.0% |

### Slowest Measured Steps

| Step | Category | Timing |
| --- | --- | ---: |
| resolve_booking_tenant_probe | DB | 250.56 ms |
| insert_initial_session_logs | DB | 224.83 ms |
| safe_revalidate_paths_probe | Revalidation | 214.61 ms |
| insert_deposit_revenue | DB | 143.92 ms |
| insert_customer_select | DB | 113.19 ms |
| deposit_accounting_period_probe | DB | 106.99 ms |
| audit_customers_insert | Audit | 106.98 ms |
| find_pending_booking_for_customer | DB | 103.61 ms |
| audit_bookings_insert | Audit | 97.39 ms |
| package_scope_package_select | DB | 94.40 ms |

### Interpretation

```text
Dominant candidate         = DB critical path / distributed round trips
Single dominant query      = NOT_PROVEN
Audit as primary bottleneck = NOT_PROVEN
Outbox as primary bottleneck = NOT_PROVEN
UI-only bottleneck          = NOT_SUPPORTED_BY_CURRENT_EVIDENCE
Exact root cause            = NOT_PROVEN
Minimal performance fix     = NOT_SELECTED
```

The DB bucket is the dominant measured bucket in the action-equivalent trace and aligns closely with the likely submit POST timing. However, the trace was produced by a measurement harness that mirrors the Create Booking sequence rather than by instrumenting the exported Next server action in the exact browser request. Therefore this narrows the root-cause candidate strongly but does not convert it into a final PASS root-cause claim.

The slowest DB call is 250.56 ms, while the total DB bucket is 1538.65 ms. Current evidence points more toward accumulated DB round trips / critical-path shape than toward one isolated slow query.

Revalidation was measured as a probe outside a normal Next request context and emitted static-generation-store warnings. Treat its 214.61 ms as diagnostic only, not a production-equivalent revalidation proof.

### Cleanup

```text
Generated cleanup          = PASS
Post-cleanup customers     = 0
Post-cleanup bookings      = 0
Post-cleanup revenue       = 0
Post-cleanup sessions      = 0
```

### Next Action

```text
Next action                = MINIMAL_FIX_PROPOSAL_DECISION
Allowed                    = propose one bounded DB critical-path reduction candidate
Not authorized             = implement performance fix, Promise.all, transaction rewrite, audit/outbox rewrite
```

Candidate direction for review only:

```text
Reduce DB critical-path round trips / read-after-write probes in Create Booking,
starting from duplicated tenant/package/accounting/session/revenue probes only if
their dependency and invariant boundaries are proven safe.
```

No runtime performance code has been changed.

## Updated Checkpoint After Correlated Trace - 2026-10-02

```text
BABYCARE_SAVE_PERFORMANCE

Production mutation        = FORBIDDEN
Runtime contract fix       = DONE
Runtime performance fix    = NONE
Commit                     = NONE

Direct UI baseline         = PASS
Create booking UI latency  = 2962.97 ms
Correlated trace           = PASS
Action-equivalent total    = 2286.35 ms
DB bucket                  = 1538.65 ms / 67.3%
Audit bucket               = 204.37 ms
Outbox bucket              = 83.27 ms
Revalidation probe         = 214.61 ms / LIMITED

Dominant candidate         = DB critical path / distributed round trips
Exact root cause           = NOT_PROVEN
Minimal performance fix    = NOT_SELECTED

Next action                = MINIMAL_FIX_PROPOSAL_DECISION
```

## MINIMAL_FIX_PROPOSAL_DECISION - 2026-10-02

### Proposal Boundary

```text
Production mutation        = FORBIDDEN
Runtime performance change = NOT_AUTHORIZED
Proposal scope             = Create Booking only
Commit                     = NONE
```

### Selected Proposal For Approval

```text
Minimal fix candidate      = Skip pending-booking lookup for newly-created customers
Classification             = HARDEN
Root-cause category        = Redundant DB round trip on DB critical path
Implementation status      = NOT_IMPLEMENTED
```

### Evidence

Current Create Booking path:

```text
createCustomerForBookingIfNeeded
  -> inserts a brand-new customers row when customer_id = "new"

findPendingBookingForCustomer
  -> immediately queries bookings by the newly-created customer_id
```

Measured trace step:

```text
find_pending_booking_for_customer = 103.61 ms
```

For the new-customer path measured in the direct UI/proof flow, this lookup is redundant because the `customer_id` was generated by the preceding insert in the same request. No pre-existing booking can reference that newly-generated customer id before the insert exists.

### Why This Is The First Minimal Fix

This change is narrower than restructuring package/tenant/context reads:

```text
Package/tenant snapshot reuse
  would touch shared helper return shapes used by create/update/online/reuse flows.

Skipping pending lookup for a new customer
  touches only the Create Booking decision branch and preserves the existing lookup for existing customers.
```

It also avoids changing:

```text
audit behavior
outbox behavior
transaction semantics
tenant isolation
package scope validation
adapter validation
session creation
revalidation
```

### Required Runtime Shape If Approved

```text
createCustomerForBookingIfNeeded
  returns { customerId, created }

createBooking
  if created:
    existingBooking = null
  else:
    existingBooking = await findPendingBookingForCustomer(...)
```

Existing customer flow remains unchanged.

### Expected Impact

```text
DB round trips reduced    = 1 on new-customer Create Booking path
Measured candidate saving = ~103.61 ms action-equivalent
UI latency impact         = modest but evidence-backed
```

This is not expected to eliminate the full ~2.96s UI save time. It is the safest first hardening step against a proven redundant DB call. Larger DB critical-path reductions, such as package/tenant snapshot reuse, remain DEFERRED until this minimal fix is approved and verified.

### Proof Required

```text
Targeted unit test:
  new customer -> does not call findPendingBookingForCustomer
  existing customer -> still calls findPendingBookingForCustomer

Functional regression:
  create booking with new customer PASS
  create booking with existing customer PASS

Real DB proof on dedicated staging/proof only:
  direct UI Create Booking PASS
  cleanup PASS with row-count/read-back verification

Performance proof:
  direct UI Create Booking before/after
  action-equivalent trace before/after
```

### Updated Decision

```text
Minimal fix proposal      = SELECTED_FOR_APPROVAL
Runtime performance fix   = NOT_AUTHORIZED
Root cause                = PARTIAL_PROVEN_REDUNDANT_DB_ROUND_TRIP
Full save root cause      = NOT_PROVEN

Next action               = REQUEST_APPROVAL_TO_IMPLEMENT_MINIMAL_FIX
```

## MINIMAL_FIX_IMPLEMENTED_AND_VERIFIED - 2026-10-02

### Boundary

```text
Production mutation        = FORBIDDEN
Runtime performance fix    = SKIP_PENDING_LOOKUP_FOR_NEW_CUSTOMER_APPLIED
Scope                      = Create Booking new-customer branch only
Transaction rewrite        = NONE
Audit change               = NONE
Outbox change              = NONE
Revalidation change        = NONE
Schema/migration           = NONE
Parallelization            = NONE
```

### Implementation

Runtime change:

```text
createCustomerForBookingIfNeeded
  now returns { customerId, created }

createBooking
  if customerResult.created:
    existingBooking = null
  else:
    existingBooking = await findPendingBookingForCustomer(...)
```

The existing-customer path keeps the pending-booking lookup.

### Targeted Tests

```text
npx jest src/__tests__/create-booking-auth-context.test.ts --runInBand
PASS: 3/3

npx jest src/__tests__/booking-tenant-scope.test.ts --runInBand
PASS: 4/4

npx jest src/__tests__/transaction-safety.test.ts --runInBand
PASS: 14/14
```

### Proof / Real DB Baseline After Fix

Direct UI proof:

```text
Report                     = babycare-direct-ui-baseline-1790924281618
Status                     = PASS_UI_BASELINE
Cleanup                    = PASS
Browser submit -> complete = 2924.73 ms
Likely submit POST         = 2075.98 ms
Production mutation        = FORBIDDEN
```

Correlated trace after fix:

```text
Report                     = babycare-correlated-create-booking-trace-1790924315399
Status                     = PASS_CORRELATED_TRACE
Cleanup                    = PASS
Action-equivalent total    = 1925.38 ms
DB bucket                  = 1239.04 ms / 64.4%
Audit bucket               = 159.43 ms
Outbox bucket              = 79.89 ms
Skip marker                = find_pending_booking_for_customer_skipped_new_customer
Skip marker duration       = 0.03 ms
```

Cleanup verification:

```text
customers                  = 0
bookings                   = 0
revenue                    = 0
sessions                   = 0
```

### Before / After Evidence

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Direct UI submit -> complete | 2962.97 ms | 2924.73 ms | -38.24 ms |
| Likely submit POST | 2350.82 ms | 2075.98 ms | -274.84 ms |
| Action-equivalent total | 2286.35 ms | 1925.38 ms | -360.97 ms |
| DB bucket | 1538.65 ms | 1239.04 ms | -299.61 ms |
| Redundant pending lookup | 103.61 ms | 0.03 ms skip marker | removed |

The direct UI timing is a single dev-server/browser proof sample and should not be overclaimed as a stable user-visible performance benchmark. The hard PASS for this fix is narrower: the redundant DB call was removed on the new-customer path, existing-customer behavior remains covered, Create Booking still succeeds through browser proof, and cleanup remains verified.

### Final Classification

```text
Redundant pending lookup   = HARDENED / PASS
Minimal fix                = SEALED
Full save root cause       = NOT_PROVEN
Further optimization       = DEFER
```

### Final Checkpoint

```text
BABYCARE_SAVE_PERFORMANCE

Production mutation        = FORBIDDEN
Runtime contract fix       = DONE
Runtime performance fix    = DONE_MINIMAL
Commit                     = PENDING

Targeted tests             = PASS
Direct UI proof            = PASS
Correlated trace           = PASS
Cleanup                    = PASS

Removed query              = findPendingBookingForCustomer on newly-created customer
Existing customer path     = UNCHANGED
Audit/outbox/revalidation  = UNCHANGED
Transaction semantics      = UNCHANGED

Full save root cause       = NOT_PROVEN
Next action                = COMMIT_AND_STOP
```
