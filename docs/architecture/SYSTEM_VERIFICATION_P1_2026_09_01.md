# System Verification P1 - 2026-09-01

Status: P1 full type-check investigation checkpoint.

## Context

P0 migration governance is closed on the authorized test/pre-production Supabase target:

- `db:migration:check` passed with local latest `20260831040000` and remote latest `20260831040000`.
- Security gates and Architecture Guard passed in the P0 checkpoint.

This P1 checkpoint starts the next verification layer: TypeScript compiler evidence before broad regression.

## Full Type-check Result

`npm.cmd run type-check -- --pretty false --extendedDiagnostics` was started and allowed to run for several minutes. It produced no diagnostics before being interrupted.

This is not recorded as PASS. It is also not useful to keep extending the timeout without isolating the graph.

## Compiler Graph Evidence

`npx.cmd tsc --showConfig` completed and showed the root `tsconfig.json` includes the Next/app source graph while excluding `scripts`, `tests`, `src/__tests__`, `e2e`, `apps`, and `packages`.

`npx.cmd tsc --noEmit --strict --pretty false --listFilesOnly` completed in about 23 seconds and listed about 5,097 files.

Interpretation: the root compiler graph is finite and discoverable. The issue is not an infinite include glob.

## Scoped Type-check Results

Temporary diagnostic tsconfigs were used only to classify the failure surface. They should not be treated as permanent production scope changes.

| Scope | Result | Evidence |
| --- | --- | --- |
| `src/core` | FAIL | Compile errors in tenant context/example code and booking update nullability |
| `src/platform/finance` + `src/platform/accounting` | FAIL | Schema type mismatch in `accounting.service.ts` (`code`/`debit`/`credit` vs typed `account_code`/`debit_amount`/`credit_amount`) |
| `src/platform/healthcare` | FAIL | Export conflicts, missing shared-kernel imports, event envelope drift, repository types resolving to `never`, and contract implementation gaps |
| `src/platform/runtime` + `src/platform/security` + `src/platform/migration-governance` | FAIL | `rls-verification.ts` compares `ALL` against a command union that excludes `ALL` |
| `src/platform/logistics` | INCONCLUSIVE / HOTSPOT | No output after about two minutes; interrupted to avoid unbounded run |
| `src/products` + `src/modules` | INCONCLUSIVE / HOTSPOT | No output after about 90 seconds; interrupted to avoid unbounded run |

## Representative Error Clusters

### Core

- `src/core/examples/TenantInfoExample.tsx`: unknown/object values rendered or passed into React/DOM props.
- `src/core/providers/TenantContextProvider.tsx`: enabled module ids and unknown `modules` data do not satisfy the `ModuleId` contract.
- `src/core/services/order/update-booking-action.ts`: nullable IDs are passed into string-only helpers and payload fields.

### Finance / Accounting

- `src/platform/accounting/engines/accounting.service.ts`: code assumes legacy column names:
  - `code`
  - `debit`
  - `credit`

  Current generated Supabase types expose:
  - `account_code`
  - `debit_amount`
  - `credit_amount`

### Healthcare

- Multiple barrel exports conflict in `src/platform/healthcare/contracts/index.ts` and `src/platform/healthcare/index.ts`.
- Several engine files import missing `shared-kernel/types` paths.
- Event publishing calls include `eventId`, but the host event envelope type does not accept it.
- Surgical/clinical repositories hit `never` for missing or unmodeled Supabase tables.
- Several services do not fully implement declared contracts.

### Runtime / Security

- `src/platform/migration-governance/verification/checks/rls-verification.ts` expects policy command `ALL`, but the local TypeScript union only permits `SELECT | INSERT | UPDATE | DELETE`.

## Decision

Full type-check is now classified as FAIL / NOT GREEN, not merely unverified.

**UPDATE 2026-09-01 (Partial Remediation):**

Core layer type errors have been forensically remediated:
- ✅ API route ModuleId validation added
- ✅ Provider network boundary validation added
- ⏸️ Booking action nullable IDs deferred (pending schema evidence)

Full type-check still BLOCKED by unrelated syntax error:
```
src/platform/healthcare/engines/cssd-engine/cssd-engine.service.ts(768,1):
error TS1010: '*/' expected.
```

See detailed analysis: `P1_TYPE_CHECK_PARTIAL_REMEDIATION_2026_09_01.md`

---

This should block broad full-regression claims because compiler correctness has real failures. The next work should be a targeted type-check closure track, ordered by blast radius:

1. ~~Runtime/security one-line contract mismatch~~ (deferred - not Core)
2. ~~Finance/accounting schema-name drift~~ (deferred - requires schema evidence)
3. ✅ Core tenant/update-booking nullability (PARTIAL: tenant done, booking deferred)
4. Healthcare contract/export/import drift (NEXT: fix cssd-engine syntax first)
5. Logistics/products compiler hotspot investigation

Do not modify `tsconfig.json` to exclude these failures just to make the gate green.

## Verification Commands Run

- `npm.cmd run type-check -- --pretty false --extendedDiagnostics` - no diagnostics after several minutes, interrupted.
- `npx.cmd tsc --showConfig` - PASS.
- `npx.cmd tsc --noEmit --strict --pretty false --listFilesOnly` - PASS, finite graph.
- `npx.cmd tsc -p tsconfig.typecheck.core.tmp.json --noEmit --pretty false --extendedDiagnostics --incremental false` - FAIL with diagnostics.
- `npx.cmd tsc -p tsconfig.typecheck.platform-finance.tmp.json --noEmit --pretty false --extendedDiagnostics --incremental false` - FAIL with diagnostics.
- `npx.cmd tsc -p tsconfig.typecheck.platform-healthcare.tmp.json --noEmit --pretty false --extendedDiagnostics --incremental false` - FAIL with diagnostics.
- `npx.cmd tsc -p tsconfig.typecheck.platform-runtime-security.tmp.json --noEmit --pretty false --extendedDiagnostics --incremental false` - FAIL with diagnostics.
- `npx.cmd tsc -p tsconfig.typecheck.platform-logistics.tmp.json --noEmit --pretty false --extendedDiagnostics --incremental false` - no diagnostics after about two minutes, interrupted.
- `npx.cmd tsc -p tsconfig.typecheck.products.tmp.json --noEmit --pretty false --extendedDiagnostics --incremental false` - no diagnostics after about 90 seconds, interrupted.
