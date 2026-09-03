# Investigation: Full TypeScript Type-Check Hang

## Hand-off Brief

1. **What happened.** The repository-wide `npm.cmd run type-check -- --pretty false` does not return a verdict within the current observation window; it stalls with no diagnostics.
2. **Where the case stands.** Baseline gates outside the compiler are green (`db:migration:check`, `security:secrets`, `security:audit`, `arch:guard`), so the remaining open item is compiler isolation rather than broad remediation.
3. **What's needed next.** Reproduce the hang with scoped compiler configs, identify the smallest cluster or import graph that still hangs, and classify the root cause before any code change.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-09-01 |
| Status | Open |
| System | Windows workspace, Bella SPA ERP, branch `main` |
| Evidence sources | `npm.cmd run type-check -- --pretty false`, `npm.cmd run db:migration:check`, `npm.cmd run security:secrets`, `npm.cmd run security:audit`, `npm.cmd run arch:guard`, `docs/architecture/SYSTEM_VERIFICATION_P1_2026_09_01.md` |

## Problem Statement

The user asked for a fresh verification pass after another IDE changed the repository. The current question is not whether some clusters have been remediated in earlier evidence, but whether the full repository type-check now completes on the current worktree and, if not, which dependency cluster or compiler pattern still causes the hang.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| `npm.cmd run type-check -- --pretty false` | Available | Started in the current session, produced only the banner, and did not finish before being interrupted after repeated waits. |
| `npm.cmd run db:migration:check` | Available | Passed with local latest `20260831040000` and remote latest `20260831040000`. |
| `npm.cmd run security:secrets` | Available | Passed. |
| `npm.cmd run security:audit` | Available | Passed. |
| `npm.cmd run arch:guard` | Available | Passed. |
| `git status --short` | Available | Worktree is large and dirty; many docs, scripts, source files, migration deletions, and untracked forensic artifacts are present. |
| `docs/architecture/SYSTEM_VERIFICATION_P1_2026_09_01.md` | Partial | Documents earlier cluster-level compiler investigation and confirms the root graph is finite. |
| `tsconfig.c1-healthcare-foundation.tmp.json` | Available | Untracked scoped config found in the worktree; likely useful for differential isolation. |
| `tsconfig.c1-healthcare-engines.tmp.json` | Available | Untracked scoped config found in the worktree; likely useful for differential isolation. |

## Investigation Backlog

| # | Path to Explore | Priority | Status | Notes |
| --- | --- | --- | --- | --- |
| 1 | Inspect current `tsconfig.c1-healthcare-foundation.tmp.json` | High | Open | Need to know whether it is a minimal PASS scope, a failing scope, or a helper for binary search. |
| 2 | Inspect current `tsconfig.c1-healthcare-engines.tmp.json` | High | Open | Need to know which healthcare subgraph it covers and whether it reproduces the hang. |
| 3 | Re-run scoped `tsc` with the untracked configs | High | Open | Establish whether the hang persists in smaller clusters on the current worktree. |
| 4 | Compare current worktree against earlier compiler findings | Medium | Open | Determine whether another IDE introduced a new cycle, export conflict, or type-inference hotspot. |
| 5 | Inspect current `package.json` type-check script and tsconfig graph | Medium | Open | Confirm the current compiler entrypoint and excluded paths before deeper binary search. |

## Timeline of Events

| Time | Event | Source | Confidence |
| --- | --- | --- | --- |
| 2026-09-01 | Repository-wide `npm.cmd run type-check -- --pretty false` started and stalled with no diagnostics | Command output | Confirmed |
| 2026-09-01 | `db:migration:check` passed with local and remote migration latest both at `20260831040000` | Command output | Confirmed |
| 2026-09-01 | `security:secrets`, `security:audit`, and `arch:guard` all passed | Command output | Confirmed |
| 2026-09-01 | Worktree contains many uncommitted changes and untracked forensic artifacts from another IDE/session | `git status --short` | Confirmed |

## Confirmed Findings

### Finding 1: The full repository type-check remains unverified on the current worktree

**Evidence:** `npm.cmd run type-check -- --pretty false` produced only the command banner and did not finish within the observation window.

**Detail:** There is no diagnostic output yet, so the correct status is still blocked/unknown rather than pass or fail.

### Finding 2: Compiler-independent gates are green

**Evidence:** `db:migration:check`, `security:secrets`, `security:audit`, and `arch:guard` all passed in the current session.

**Detail:** This narrows the remaining open issue to compiler behavior rather than migration, security, or architecture policy gates.

### Finding 3: The worktree is mixed and not commit-ready

**Evidence:** `git status --short`.

**Detail:** The repository contains many modified docs/scripts/source files, deleted legacy migration files, new timestamped migration files, and several investigation artifacts. This means any compiler investigation must avoid accidental cleanup or commit drift.

## Hypothesized Paths

### Hypothesis 1: The hang is still a source-graph bottleneck in one of the previously problematic clusters

**Status:** Open

**Theory:** One cluster still contains a pathological import/type pattern that blocks the compiler even though earlier remediation work fixed other areas.

**Would confirm:** A scoped tsconfig for one cluster also hangs on the current worktree.

**Would refute:** All scoped cluster configs pass and only the full graph hangs.

### Hypothesis 2: Another IDE introduced a new dependency cycle or export conflict

**Status:** Open

**Theory:** The new uncommitted changes may have reintroduced a cycle, barrel export issue, or heavy inference path that the earlier documentation did not see.

**Would confirm:** A new scoped failure appears in the current worktree but not in the earlier evidence.

**Would refute:** The same scope passes now and only the broad root graph hangs.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Current scoped cluster behavior | Cannot tell whether the hang is still isolated to Healthcare, Finance, Logistics, Products, or a shared platform path | Run the untracked scoped tsconfig files and compare pass/hang behavior |
| Current compiler entry graph | Need to verify which files are in the live type-check graph for this exact worktree | Inspect `tsconfig.json` / `tsconfig.*.json` and current include/exclude rules |
| Minimal reproducer | Cannot classify the root cause without a smallest hanging scope | Binary-search clusters using the current untracked tsconfig files |

## Source Code Trace

| Element | Detail |
| --- | --- |
| Error origin | Repository-wide TypeScript compiler invocation |
| Trigger | `npm.cmd run type-check -- --pretty false` |
| Condition | No diagnostic output before timeout/interruption |
| Related files | `tsconfig.json`, untracked `tsconfig.c1-healthcare-foundation.tmp.json`, untracked `tsconfig.c1-healthcare-engines.tmp.json`, `docs/architecture/SYSTEM_VERIFICATION_P1_2026_09_01.md` |

## Conclusion

**Confidence:** Low

The current worktree still does not provide a full repository type-check verdict. The strongest current evidence says the healthcare engines cluster is no longer a silent hang: it fails fast with concrete diagnostics, including a missing `@/types/supabase` path and several contract/type drifts. The remaining open question is whether a second cluster still hangs independently at the root compiler level.

## Reproduction Plan

1. Inspect the current untracked scoped tsconfig files.
2. Run each scoped compiler config separately.
3. Record pass/hang boundaries and binary-search the smallest hanging graph.
4. Only after the smallest reproducer is known, decide whether the cause is source, toolchain, configuration, or mixed.

## Follow-up: 2026-09-01

### New Evidence

- `tsconfig.c1-healthcare-foundation.tmp.json` compiled cleanly with `npx.cmd tsc -p tsconfig.c1-healthcare-foundation.tmp.json --noEmit --pretty false` and exited code `0`.
- `tsconfig.c1-healthcare-engines.tmp.json` failed quickly with diagnostics instead of hanging.
- The healthcare engines cluster now shows explicit source/type problems in `cssd-engine`, `laboratory-engine`, `order-engine`, `pharmacy-engine`, `rule-engine`, `surgical-engine`, and the host event bus bridge.
- A fresh full repository `npm.cmd run type-check -- --pretty false` rerun again produced no diagnostics within a 60-second observation window and was interrupted.

### Confirmed Findings

#### Finding 4: Healthcare foundation scope is not the blocker

**Evidence:** clean exit from the foundation scoped compile.

**Detail:** The smaller `contracts/shared-kernel` slice is not the active compiler bottleneck.

#### Finding 5: Healthcare engines scope currently fails fast with concrete diagnostics

**Evidence:** `npx.cmd tsc -p tsconfig.c1-healthcare-engines.tmp.json --noEmit --pretty false`.

**Detail:** The errors are not a silent hang inside this scope. They include:

- missing `@/types/supabase` module references from order/pharmacy repositories and the order factory,
- `cssd-engine` traceability mapping type drift,
- laboratory event payload mismatch against the order event union,
- rule-engine payload shape drift,
- surgical repository/table typing gaps,
- surgical contract implementation drift,
- host event bus bridge accessing `event.eventType` from a narrowed `never`.

### Hypothesis Update

#### Hypothesis 1: The remaining blocker is no longer a pure hang inside the healthcare engines slice

**Status:** Confirmed for this scope

**Theory:** The current engines scope fails because of concrete type mismatches and missing module/type definitions.

**Resolution:** The earlier "hang" symptom at full repository level still needs a fresh end-to-end run, but the healthcare engines slice has moved from unknown hang behavior to explicit diagnostics.

#### Hypothesis 2: A missing or renamed Supabase type alias is amplifying engine failures

**Status:** Open

**Theory:** `@/types/supabase` now points to a missing path, and that missing alias cascades into repository/service diagnostics.

**Would confirm:** A direct replacement import to the current generated database types removes a meaningful subset of the errors.

**Would refute:** The alias is only one symptom and the same errors persist after restoring the type path.

#### Hypothesis 3: The full repository hang is a broad downstream effect of current healthcare engine errors plus another unseen scope

**Status:** Open

**Theory:** The root `tsc` invocation still stalls because healthcare engines are now emitting many diagnostics, and there may be at least one additional unresolved cluster elsewhere in the repo.

**Would confirm:** Another scoped cluster outside healthcare also reproduces a fail or hang boundary.

**Would refute:** All other scopes pass or fail fast and only the root graph remains silent.

#### Hypothesis 4: The missing `@/types/supabase` alias is a concrete root cause for part of the Healthcare engine failure surface

**Status:** Open

**Theory:** The repo now canonicalizes `Database` through `@/types/database.types`, but some Healthcare engine files still import the stale `@/types/supabase` path.

**Would confirm:** Replacing that alias with the canonical database type source removes a meaningful subset of order/pharmacy diagnostics.

**Would refute:** The alias path is only incidental and the same failures remain after a targeted fix.

### Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Current full repository verdict | Still need to know whether the root `tsc` invocation hangs, fails, or eventually emits the same diagnostics | Re-run full `npm.cmd run type-check -- --pretty false` after isolating the engines cluster further |
| Smallest failing engines subcluster | Need a tighter reproducer than the entire engines scope | Split engines into smaller sub-scopes around order/pharmacy/lab/surgical/cssd/rule |
| `@/types/supabase` provenance | Need to know whether the import path was intentionally renamed or accidentally orphaned | Trace repo history and current generated type location |
| Non-healthcare cluster status | Need to rule out a second independent blocker outside healthcare | Create or reuse scoped configs for finance, logistics, products, and platform core/runtime |
| Canonical type alias drift | Need to determine whether `@/types/supabase` is stale or intentionally retained somewhere | Trace imports and compare against `src/types/database.types.ts` |

### Subcluster Outcome Summary

| Scope | Result | Key signals |
| --- | --- | --- |
| `order-engine` | PASS | Canonical DB import restored, event bridge exhaustive branch fixed, idempotency helper aligned |
| `pharmacy-engine` | PASS | Canonical DB import restored, `PrescriptionRow` declared, `Json` mapping aligned |
| `rule-engine` | PASS | Missing type import resolved, stray timestamp removed from event payloads |
| `cssd-engine` | PASS | Traceability row shape aligned to joined query output |
| `laboratory-engine` | PASS | Repository mapper aligned, event payload boundary cast localized |
| `surgical-engine` | OPEN | Still emits `never`/contract drift diagnostics |
| `healthcare foundation` | PASS | No compiler errors in the contracts/shared-kernel slice |

### Controlled Replacement Result

**Experiment:** Replaced `@/types/supabase` with `@/types/database.types` in `src/platform/healthcare/engines/pharmacy-engine/repositories/supabase-pharmacy.repository.ts` and `src/platform/healthcare/engines/pharmacy-engine/repositories/supabase-clinical-order-reader.ts`.

**Observed effect:** The pharmacy scope no longer reports module-resolution errors for `@/types/supabase`. The remaining pharmacy failures moved to local type issues (`PrescriptionRow` in the service, `Json` mapping for `drugs`) plus one shared host-level schema validation error in `contract-registry.service.ts`.

**Interpretation:** The alias drift is **confirmed as a real contributor** to the Pharmacy failure surface, but it is **not the only root cause**. The controlled experiment changed the failure shape instead of eliminating all diagnostics.

### Follow-up Outcome

Order, Pharmacy, Rule, CSSD, and Laboratory are now passing their isolated tsconfig checks after narrow, contract-aligned fixes. The remaining Healthcare-engine blocker in the current isolation set is Surgical.

## Follow-up: 2026-09-01 #2

### New Evidence

- `src/platform/healthcare/engines/surgical-engine/surgical-engine.service.ts` now uses `SupabaseClient<Database>` instead of `SupabaseClient<Record<string, unknown>>`.
- `DefaultSterilizationContract` now implements the full `EngineContract` surface with `contractVersion` and `healthCheck`.
- `src/platform/healthcare/engines/surgical-engine/repositories/supabase-surgery.repository.ts` now uses canonical `Database` row/insert types for `hc_surgical_cases` and `hc_surgical_safety_checklists`.
- `npx.cmd tsc -p tsconfig.tmp.healthcare-surgical.json --noEmit --pretty false` exited `0`.
- A fresh `npm.cmd run type-check -- --pretty false` rerun still emitted only the banner and no diagnostics within the observation window before interruption.

### Confirmed Findings

#### Finding 6: Surgical isolate is no longer the blocker

**Evidence:** clean exit from `tsconfig.tmp.healthcare-surgical.json`.

**Detail:** The Surgical engine now type-checks in isolation after canonical row typing and contract-surface fixes.

#### Finding 7: The full repository type-check remains unresolved on the current worktree

**Evidence:** root `npm.cmd run type-check -- --pretty false` did not emit diagnostics within the observation window.

**Detail:** The full compiler still needs a broader cluster search outside the Healthcare isolate set, or a longer instrumented run if the user wants to keep pursuing the hang.

### Hypothesis Update

#### Hypothesis 4: Surgical was the last failing Healthcare isolate

**Status:** Confirmed

**Resolution:** Surgical passes after replacing generic DB typing with canonical `Database` row types and aligning the fallback contract to the full engine contract interface.

#### Hypothesis 3: The remaining full-repo issue lives outside the now-green Healthcare isolate set

**Status:** Open

**Theory:** The root compiler still stalls because another cluster outside the resolved Healthcare engines is active, or because the root graph itself is still too broad for the current observation window.

**Would confirm:** A new scoped tsconfig outside Healthcare reproduces the hang or emits fresh diagnostics.

**Would refute:** A full root run eventually emits diagnostics attributable to a remaining Healthcare edge.

### Conclusion

The current worktree has moved Healthcare from mixed diagnostics to isolated green scopes. That removes Surgical from the active blocker list. The full repository type-check is still not verified and needs the next differential cluster outside Healthcare.

## Follow-up: 2026-09-02

### New Evidence

- `tsconfig.tmp.finance-accounting.json` was created as a temporary probe for `src/platform/finance` plus `src/platform/accounting`, excluding tests/specs.
- `npx.cmd tsc -p tsconfig.tmp.finance-accounting.json --noEmit --pretty false --extendedDiagnostics --incremental false` exited `0` in about 3 seconds of compiler time.

### Confirmed Findings

#### Finding 8: Finance/Accounting is not the current full-type-check blocker in isolation

**Evidence:** clean exit from `tsconfig.tmp.finance-accounting.json`.

**Detail:** The prior Finance schema-name drift is not reproducing in the current worktree. Finance/Accounting should be removed from the active search space unless it reappears through a broader combined scope.

### Hypothesis Update

#### Hypothesis 3: The remaining full-repo issue lives outside the now-green Healthcare isolate set

**Status:** Still Open

**Resolution update:** Finance/Accounting has also been removed from the isolated search space. The next likely areas are Logistics, Products/Modules, or a cross-cluster interaction visible only in combined scopes.

### Logistics Probe

- `tsconfig.tmp.logistics.json` was created for `src/platform/logistics` excluding tests/specs.
- `npx.cmd tsc -p tsconfig.tmp.logistics.json --noEmit --pretty false --extendedDiagnostics --incremental false` emitted no diagnostics within the observation window and was interrupted.
- `tsconfig.tmp.logistics-contracts-domain.json` failed quickly with diagnostics.
- `tsconfig.tmp.logistics-warehouse.json` failed quickly with diagnostics.
- `tsconfig.tmp.logistics-repositories.json` and `tsconfig.tmp.logistics-engines.json` emitted no diagnostics within the observation window and were interrupted.
- Single-file repository probes for `item.repository.ts`, `inventory.repository.ts`, `movement.repository.ts`, and `repositories/index.ts` also emitted no diagnostics within the observation window.

### Confirmed Findings

#### Finding 9: Logistics is an active non-Healthcare failure cluster

**Evidence:** contracts/domain and warehouse scoped compiles failed quickly with diagnostics.

**Detail:** The diagnostics show stale module paths (`@/core/types/engine`), export collisions (`ItemId`), missing domain exports, and widespread `camelCase` runtime usage against `snake_case` domain contracts.

#### Finding 10: Logistics repository layer is a compiler hotspot candidate

**Evidence:** repository directory and individual repository-file probes did not emit diagnostics within the observation window.

**Detail:** The repository files reference `Database['logistics']`, but the generated `src/types/database.types.ts` has no `logistics` schema. A minimal probe confirmed `Database['logistics']` fails quickly by itself, so the hotspot appears to be the interaction between the absent schema, typed Supabase query builders, and repository imports rather than the indexed-access type alone.

### Hypothesis Update

#### Hypothesis 5: Logistics has independent type/source-of-truth drift

**Status:** Confirmed at cluster level

**Theory:** Logistics mixes multiple source models: generated DB types without a `logistics` schema, repository code expecting `Database['logistics']`, and domain code split between `snake_case` contract types and `camelCase` implementation usage.

**Resolution:** This is not safe to fix as a one-line compiler remediation. It requires Logistics canonical source selection before code changes.

#### Hypothesis 6: The remaining root type-check stall is at least partly attributable to Logistics

**Status:** Open

**Would confirm:** Removing or fixing Logistics repository hotspot causes the root compiler to emit diagnostics or pass within the observation window.

**Would refute:** Root type-check still stalls after Logistics is isolated or excluded and another cluster reproduces the same behavior.

### Products / Modules Probe

- `tsconfig.tmp.products-modules.json` was created for `src/products` plus `src/modules`, excluding tests/specs.
- The combined Products/Modules probe emitted no diagnostics within the observation window and was interrupted.
- `tsconfig.tmp.products.json` failed quickly with diagnostics.
- `tsconfig.tmp.modules.json` emitted no diagnostics within the observation window and was interrupted.

### Confirmed Findings

#### Finding 11: Products is a concrete diagnostics cluster, not a silent hotspot

**Evidence:** `tsconfig.tmp.products.json` failed quickly.

**Detail:** The product failures currently center on stale Healthcare contract imports in Bella Dental and Bella Hospital: missing `audit-compliance.contract` and missing `ICdsContract`/CDS DTO exports from `cds-engine.contract.ts`, plus one implicit `any` callback parameter.

#### Finding 12: Modules is an independent compiler hotspot candidate

**Evidence:** `tsconfig.tmp.modules.json` emitted no diagnostics within the observation window.

**Detail:** Modules should be split by top-level module directory before any code fix. It is currently separate from the Products diagnostics cluster.

### Current Search-Space Summary

| Scope | Current status | Interpretation |
| --- | --- | --- |
| Healthcare isolated scopes | PASS | Removed from active search space |
| Finance/Accounting | PASS | Removed from active search space |
| Logistics contracts/domain | FAIL fast | Concrete source/type drift |
| Logistics warehouse | FAIL fast | Concrete local diagnostics |
| Logistics repositories/engines | HOTSPOT | Needs smaller isolation |
| Products | FAIL fast | Stale Healthcare contract imports |
| Modules | HOTSPOT | Needs top-level module isolation |
| Full repository | OPEN | Still no verdict within observation window |

### Next Diagnostic Step

Split `src/modules` by top-level module directory and run probes in batches. Separately, decide whether to address Products stale Healthcare contract imports before or after the Modules hotspot, depending on whether the next objective is "make full tsc emit diagnostics" or "reduce known diagnostics first."

## Follow-up: 2026-09-02 #2

### New Evidence

- The `src/modules` probe was split one level by top-level module directory only.
- `src/modules/bella-healthcare-kernel` passed.
- `src/modules/product-sales` passed.
- `src/modules/salary` passed.
- `src/modules/booking` has no non-test inputs under the temporary include/exclude rules.
- `src/modules/beauty-spa` failed quickly through imported `src/modules/spa/adapters/SpaModuleAdapter.ts`.
- `src/modules/bella-healthcare` failed quickly with concrete diagnostics.
- `src/modules/bookings` failed quickly with concrete diagnostics.
- `src/modules/hr-salary` failed quickly with concrete diagnostics.
- `src/modules/real_estate` failed quickly with concrete diagnostics.
- `src/modules/spa` failed quickly with concrete diagnostics.
- `src/modules/support` failed quickly through imported `src/platform/capability-platform/resource-db-service.ts`.
- `src/modules/bella-auto` emitted no diagnostics within the observation window and was interrupted.

### Confirmed Findings

#### Finding 13: Modules is no longer only an opaque hotspot

**Evidence:** most top-level module probes returned PASS or FAIL diagnostics within seconds.

**Detail:** Actionable diagnostics now exist in `bella-healthcare`, `bookings`, `hr-salary`, `real_estate`, `spa`, and support's platform dependency.

#### Finding 14: Bella Auto remains the only top-level module hotspot candidate

**Evidence:** `tsconfig.tmp.module-bella-auto.json` emitted no diagnostics within the observation window.

**Detail:** Further splitting should be limited to Bella Auto only if the next objective is to eliminate the last module hotspot. Other modules now have ordinary diagnostics.

### Current Module Probe Summary

| Module | Current status | Key signal |
| --- | --- | --- |
| `beauty-spa` | FAIL fast | Imports `SpaModuleAdapter`, which has `capacity_config` on `{}` |
| `bella-auto` | HOTSPOT | No diagnostics within observation window |
| `bella-healthcare` | FAIL fast | Json/unknown/schema mapper drift plus shared platform errors |
| `bella-healthcare-kernel` | PASS | Removed from active search space |
| `booking` | NO INPUTS | No production inputs under temp probe |
| `bookings` | FAIL fast | Decision-engine operator literal typo and nullable conflict rows |
| `hr-salary` | FAIL fast | Unknown/object narrowing in query action |
| `product-sales` | PASS | Removed from active search space |
| `real_estate` | FAIL fast | Unknown/object narrowing and capability-platform generic event error |
| `salary` | PASS | Removed from active search space |
| `spa` | FAIL fast | Salary module import plus Spa adapter/verification unknown narrowing |
| `support` | FAIL fast | Capability-platform Supabase dependency typed as unknown |

### Updated Triage Rule

Do not keep splitting once a module emits actionable diagnostics. Only `bella-auto` currently justifies another split if hotspot elimination becomes the next target.

### Remediation Evidence

- `src/modules/bookings` now passes `npx.cmd tsc -p tsconfig.tmp.module-bookings.json --noEmit --pretty false --extendedDiagnostics --incremental false`.
- Fixes were limited to:
  - `src/lib/decision-engine/providers/booking/auto-assignment-provider.ts`: removed stale `'>= '` operator literal.
  - `src/modules/bookings/actions/ktv-suggestion-actions.ts`: preserved metadata object shape while reading `capacity_config`.
  - `src/lib/decision-engine/providers/booking/conflict-detection-provider.ts`: made required `conflictingBooking` payloads total by adding an explicit requested-slot fallback.
- `src/platform/capability-platform/resource-db-service.ts` no longer erases the shared Supabase client to `unknown`; it now narrows through a typed server-client getter.
- After that change, `src/modules/support` no longer returns the original `supabase is of type unknown` diagnostics, but the support scoped compile emitted no diagnostics within the observation window and was interrupted.

### Updated Module Probe Summary

| Module | Current status | Key signal |
| --- | --- | --- |
| `bookings` | PASS | Closed after narrow decision-engine/capacity/conflict fixes |
| `support` | HOTSPOT | Original unknown-Supabase diagnostics resolved; now stalls with no diagnostics |
| `bella-auto` | HOTSPOT | No diagnostics within observation window |
| `bella-healthcare` | FAIL fast | Json/unknown/schema mapper drift plus shared platform errors |
| `hr-salary` | FAIL fast | Unknown/object narrowing in query action |
| `real_estate` | FAIL fast | Unknown/object narrowing and capability-platform generic event error |
| `spa` | FAIL fast | Salary module import plus Spa adapter/verification unknown narrowing |
| `beauty-spa` | FAIL fast | Imports `SpaModuleAdapter`, which has `capacity_config` on `{}` |
| `bella-healthcare-kernel` | PASS | Removed from active search space |
| `product-sales` | PASS | Removed from active search space |
| `salary` | PASS | Removed from active search space |

## Follow-up: 2026-09-02 #3

### New Evidence

- `src/modules/hr-salary` now passes `npx.cmd tsc -p tsconfig.tmp.module-hr-salary.json --noEmit --pretty false --extendedDiagnostics --incremental false`.
- `src/modules/spa` now passes `npx.cmd tsc -p tsconfig.tmp.module-spa.json --noEmit --pretty false --extendedDiagnostics --incremental false`.
- `src/modules/beauty-spa` now passes `npx.cmd tsc -p tsconfig.tmp.module-beauty-spa.json --noEmit --pretty false --extendedDiagnostics --incremental false`.
- `src/modules/real_estate` now passes `npx.cmd tsc -p tsconfig.tmp.module-real-estate.json --noEmit --pretty false --extendedDiagnostics --incremental false`.
- `src/modules/bella-healthcare` still fails quickly, but the failure shape has narrowed.

### Remediation Evidence

- `src/modules/hr-salary/actions/query-salary-actions.ts` now narrows RPC output rows and avoids unknown/object leakage into `MatrixKtvUser` mapping.
- `src/modules/spa/adapters/SpaModuleAdapter.ts` now preserves metadata object shape while reading `capacity_config`.
- `src/modules/spa/verify-registration.ts` now narrows dynamic adapter method inspection through `Record<string, unknown>`.
- `src/platform/capability-platform/types.ts` now keeps `formatNotification` on the canonical `ResourceEvent` contract instead of a generic record.
- `src/modules/real_estate/contexts/product_catalog/domain/LegalApprovalSpecification.ts` and `src/modules/real_estate/contexts/reservation/application/ReservationService.ts` now narrow unknown metadata/RPC payloads before use.
- `src/platform/metadata-engine/metadata-engine.ts` and `src/platform/capability-platform/resource-db-service.ts` now use narrow structural Supabase client interfaces for dynamic platform tables that are not present in generated `Database` types.
- `src/modules/bella-healthcare/contexts/shared/ReadModelRepository.ts`, `src/modules/bella-healthcare/kernel/ai-agents.ts`, and `src/modules/bella-healthcare/adapters/healthcare-adapter.ts` had clear local diagnostics removed.

### Current Module Probe Summary

| Module | Current status | Key signal |
| --- | --- | --- |
| `bookings` | PASS | Closed after narrow decision-engine/capacity/conflict fixes |
| `hr-salary` | PASS | Closed after RPC row narrowing |
| `real_estate` | PASS | Closed after metadata/RPC/capability event narrowing |
| `spa` | PASS | Closed after salary dependency and adapter verification fixes |
| `beauty-spa` | PASS | Closed through shared Spa adapter fix |
| `bella-healthcare` | FAIL fast | Remaining diagnostics are concentrated in `kernel/repositories/supabase-repositories.ts` |
| `support` | HOTSPOT | Original unknown-Supabase diagnostics resolved; no further split in this lean pass |
| `bella-auto` | HOTSPOT | No diagnostics within the observation window; no further split in this lean pass |
| `bella-healthcare-kernel` | PASS | Removed from active search space |
| `product-sales` | PASS | Removed from active search space |
| `salary` | PASS | Removed from active search space |

### Current Interpretation

The reduced protocol is working: fast-failing scopes with clear diagnostics were remediated without further search-tree expansion. The only remaining fast-failing module in this pass is `bella-healthcare`, and its unresolved diagnostics now represent a larger repository mapper/schema reconciliation task in `src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts`, not a small local type-narrowing fix.

## Follow-up: 2026-09-02 #4

### New Evidence

- `src/modules/bella-healthcare` now passes `npx.cmd tsc -p tsconfig.tmp.module-bella-healthcare.json --noEmit --pretty false --extendedDiagnostics --incremental false`.
- Full repository `npm.cmd run type-check -- --pretty false` emitted only the TypeScript command banner and no diagnostics within the observation window, then was interrupted.

### Remediation Evidence

- `src/modules/bella-healthcare/kernel/repositories/supabase-repositories.ts` now imports generated `Database`/`Json` types and uses generated row types for Party, Journey, Timeline, Asset, Contract, and Knowledge persistence mapping.
- JSON persistence boundaries now use explicit helpers for DB JSON conversion and domain object recovery instead of assuming JSON columns are already `Record<string, unknown>`.
- Timeline event category mapping now conforms to the platform `TimelineEventCategory` contract (`business | audit | ai | system`) instead of leaking healthcare-specific category names into the platform event store contract.
- Journey mapping now follows the generated schema where `journey_sub_journeys` and `journey_milestones` do not expose a `description` column, and where `journey_journeys` does not expose `expected_end_at` or `updated_at`.
- Contract JSON fields are parsed into `ContractParty[]`, `ContractLineItem[]`, and `PaymentSchedule` only when the JSON shape satisfies the domain contract.

### Current Module Probe Summary

| Module | Current status | Key signal |
| --- | --- | --- |
| `bookings` | PASS | Closed |
| `hr-salary` | PASS | Closed |
| `real_estate` | PASS | Closed |
| `spa` | PASS | Closed |
| `beauty-spa` | PASS | Closed |
| `bella-healthcare` | PASS | Closed after repository mapper/schema reconciliation |
| `support` | HOTSPOT | Original unknown-Supabase diagnostics resolved; no further split in this lean pass |
| `bella-auto` | HOTSPOT | No diagnostics within the observation window; no further split in this lean pass |
| `bella-healthcare-kernel` | PASS | Removed from active search space |
| `product-sales` | PASS | Removed from active search space |
| `salary` | PASS | Removed from active search space |

### Current Interpretation

All fast-failing module scopes targeted by the lean pass are now closed. Full repository type-check remains unverified because the root compiler invocation still produced no diagnostics within the observation window. The remaining open work is not a `bella-healthcare` failure; it is full-graph hotspot investigation and should stay separate from the module remediation patch set.
