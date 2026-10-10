# Architecture Gate Result - Manufacturing Quality Disposition Contract

Date: 2026-10-10
Base commit: `99262c3819382e66caf63ad98504c357ad4fe447`
Result: `MINIMAL_RUNTIME_IMPLEMENTED_PENDING_REAL_DB_PROOF`

## 1. Bella OS/Product Development Process Gate

Manufacturing Slice 1, Production Consumption, Finished Goods Receipt, Production Execution, and Production Order Completion have been sealed on `main` for their current scope. The next unresolved Manufacturing behavior is quality disposition / nonconformance evidence for quantities that are rejected, scrap, conditionally accepted, or still pending quality decision.

This artifact first recorded the narrow Business Policy Contract and boundary-test design for Quality Disposition / Nonconformance Evidence. After review, the approved implementation scope is the minimal Manufacturing-owned runtime needed to record quality disposition evidence and block Production Order completion when rejected, scrap, pending, or rework quantities are not terminally resolved. It does not authorize ProductRegistry, UI/API, Finance posting, Logistics stock mutation, Go-Live, a separate Quality OS, CAPA, routing, work-center management, MES, or IoT scope.

Business semantic status:

- Repo-proven: Manufacturing records `acceptedQuantity`, `rejectedQuantity`, and `scrapQuantity` on production execution; Production Order completion reconciles execution quantities with FGR evidence.
- User-approved for next contract: disposition terminal semantics below.
- Not repo-proven as pre-existing policy: the disposition table below is a newly approved product/architecture decision for the next Manufacturing slice, not a historical repository fact.

Verdict:

```text
POLICY_CONTRACT = APPROVED_FOR_REVIEW
CONTRACT_BOUNDARY_TESTS = IMPLEMENTED
MINIMAL_RUNTIME = IMPLEMENTED_UNIT_VERIFIED
REAL_DB_PROOF = NOT_PROVEN_LOCAL_SKIPPED
```

## 2. Product Manifest

Capability in scope:

- Manufacturing-owned Quality Disposition / Nonconformance Evidence for Production Order Line output.
- Evidence references to Production Execution, Finished Goods Receipt evidence, Production Order, and Production Order Line.
- Disposition decisions for accepted, conditional accept, rework, scrap, discard/reject, and pending outcomes.
- Idempotency requirement for recording the same disposition command.
- Boundary tests proving terminal/non-terminal rules before runtime implementation.
- Minimal runtime and persistence for `QualityDispositionEvidence`.
- Completion reconciliation that requires terminal disposition evidence for rejected and scrap output and rejects open non-terminal dispositions.

Out of scope:

- Logistics stock mutation, quarantine movement, scrap movement, stock adjustment, or inventory ownership transfer.
- Finance posting, variance costing, accounting outbox, or ledger entry.
- UI/API routes, ProductRegistry, Go-Live, CAPA, Quality Management System, MES, IoT, routing, work centers, or broad workflow engine.

## 3. Ownership Map

| Capability | Owner | Decision |
| - | - | - |
| Production Order and Production Order Line | Manufacturing | Reuse existing sealed scope |
| Production Execution quantities | Manufacturing | Reuse existing sealed scope |
| Quality Disposition / Nonconformance Evidence | Manufacturing | Proposed minimal owned evidence |
| Inventory stock mutation | Logistics | Out of scope; must use public Logistics contract if later required |
| Warehouse quarantine/rework/scrap physical movement | Logistics | Not authorized in this gate |
| Finance posting / variance accounting | Finance | Not authorized |
| Tenant identity, user identity, org-unit access | Platform/IAM | Reuse existing boundary |
| UI/API/ProductRegistry | Product/Platform | Not authorized |

## 4. Contract Dependency Map

```text
Manufacturing Production Execution
  -> Manufacturing Quality Disposition / Nonconformance Evidence
  -> Manufacturing Production Order Completion reconciliation

Manufacturing FGR evidence
  -> public Logistics Stock-In contract
  -> Logistics inventory/movement/read-back evidence

Any future inventory movement for rejected/scrap/rework quantities
  -> public Logistics contract only
  -> no Manufacturing direct writes to Logistics tables
```

The quality-disposition contract must reference Manufacturing-owned execution/completion context and public Logistics evidence identifiers. It must not create a parallel inventory ledger or infer stock mutation from disposition status.

## 5. Business Policy Contract

`terminal` means quality handling for that quantity is complete. It does not mean the quantity is counted as accepted finished-goods output.

| Disposition | Terminal? | Minimum condition |
| - | - | - |
| `accepted` | Yes | Accepted under the active quality policy and reconciled with accepted output. |
| `conditional_accept` | Conditional | Terminal only when policy explicitly allows it and defines the quantity counted as accepted output. |
| `rework` | No | Requires later reprocessing and another quality result before completion can close. |
| `scrap` | Yes | Requires reason, quantity, actor/time, and evidence. Any stock movement belongs to Logistics. |
| `discard_reject` | Conditional | Terminal only with final handling decision, reason, quantity, actor/time, and evidence. It is not counted as accepted output by default. |
| `pending` | No | Not terminal; completion must reject open pending quantity. |

Completion policy:

1. Production execution and FGR evidence must exist and reconcile by Production Order Line.
2. All rejected, scrap, or pending quality-controlled quantities must have valid disposition evidence.
3. Completion must reject open `pending` and `rework` quantities.
4. Completion must not count `scrap`, `discard_reject`, or `conditional_accept` as accepted output unless policy explicitly permits that accepted-output treatment.
5. Manufacturing must not create stock movement for any disposition. Stock movement remains Logistics-owned.

## 6. Canonical Runtime Contract

Minimum domain shape:

```text
QualityDispositionEvidence
  id
  tenantId
  factoryOrgUnitId
  productionOrderId
  productionOrderLineId
  productionExecutionId
  receiptDocumentId? / receiptLineId?
  sourceQuantityType: accepted | rejected | scrap | pending
  disposition: accepted | conditional_accept | rework | scrap | discard_reject | pending
  quantity
  reasonCode
  reasonText?
  evidenceReference?
  terminal
  acceptedOutputQuantity
  decidedBy
  decidedAt
  idempotencyKey
```

Contract rules:

- `quantity` must be positive.
- `acceptedOutputQuantity` must be zero unless `disposition` is `accepted` or policy-approved `conditional_accept`.
- `terminal` must match the business-policy table above.
- Same tenant + operation + idempotency key + same payload must replay the stored evidence.
- Same tenant + operation + idempotency key + different payload must conflict.
- Evidence from another tenant or factory must be rejected.
- Disposition quantities must not exceed the corresponding execution/FGR quantities.

## 7. UI to Contract Reconciliation

No UI is changed or authorized. No UI state, KPI, action, route, or API is promised by this gate.

If future UI is requested, every visible quality status and action must trace to this contract or a later approved contract.

## 8. Additive Migration Plan

Additive Manufacturing-owned migration implemented:

- `supabase/migrations/20261010050000_create_manufacturing_quality_dispositions.sql`
- Creates `public.manufacturing_quality_dispositions`.
- Adds `quality_disposition_evidence` JSONB snapshot to `public.manufacturing_production_order_completions`.
- Enables RLS and authenticated/service_role grants.
- Does not create Logistics, Finance, UI/API, ProductRegistry, CAPA, or Quality OS surfaces.

## 9. Boundary Test Contract

Boundary tests implemented:

`src/platform/manufacturing/__tests__/manufacturing-quality-disposition-contract.test.ts`

These tests prove the approved policy boundary as an executable contract. They do not prove runtime persistence, RLS, repository behavior, or Production Order completion integration.

1. Records `accepted` evidence as terminal and reconciles accepted output.
2. Rejects completion when `pending` quantity exists.
3. Rejects completion when `rework` quantity remains open.
4. Allows `scrap` as terminal only with reason, quantity, actor/time, and evidence.
5. Allows `discard_reject` as terminal only with final handling decision, reason, quantity, actor/time, and evidence.
6. Allows `conditional_accept` as terminal only when the command provides an approved accepted-output treatment.
7. Rejects `conditional_accept` being counted as accepted output without policy flag/evidence.
8. Rejects disposition evidence whose tenant or factory does not match the Production Order Line.
9. Rejects disposition quantities exceeding the relevant execution/FGR quantity.
10. Replays same idempotency key and same payload without duplicate evidence.
11. Rejects same idempotency key with conflicting payload.
12. Proves concurrent duplicate commands create only one disposition evidence record at the contract boundary. Real-DB concurrency proof remains part of the separately authorized runtime implementation verification.

Runtime tests implemented:

- `src/platform/manufacturing/__tests__/manufacturing-slice1.service.test.ts`
- `src/platform/manufacturing/__tests__/manufacturing-quality-disposition-migration.test.ts`
- `src/platform/manufacturing/__tests__/manufacturing-slice1-real-db.test.ts`

The service tests prove local runtime behavior, idempotent replay/conflict, conditional-accept reconciliation, and completion blocking for unresolved quality disposition. The migration-shape test proves the additive table/RLS/grant shape. The Real-DB test has been wired to apply the new migration and exercise quality disposition persistence, but local execution skipped because the canonical E2E DB preflight was not satisfied.

## 10. Verification Results

```text
CONTRACT_BOUNDARY_TESTS = PASS (12/12)
SERVICE_AND_MIGRATION_TESTS = PASS (32/32 targeted total)
TYPECHECK_CHANGED_FULL_SCOPE = PASS (0 diagnostics)
ARCHITECTURE_GUARD = PASS
GIT_DIFF_CHECK = PASS
REAL_DB_E2E_LOCAL = SKIP / NOT_PROVEN
```

## 11. 11 Automated Verification Gates Plan

Required verification:

1. Business-policy contract test.
2. Manufacturing service unit tests.
3. Manufacturing repository persistence tests.
4. Migration-shape tests.
5. Real-DB persistence and read-back tests.
6. Real-DB RLS tenant isolation tests using authenticated role.
7. Real-DB idempotency retry/conflict/concurrency tests.
8. Production completion reconciliation tests with quality disposition evidence.
9. TypeScript changed/full scope as supported.
10. Architecture guard and Logistics regression if any public Logistics boundary is touched.
11. `git diff --check`.

Skipped, timed-out, unrouted, or not-run checks are not PASS.

## 12. Implementation Eligibility Verdict

```text
QUALITY_DISPOSITION_CONTRACT = REVIEWED
CONTRACT_BOUNDARY_TESTS = IMPLEMENTED
MINIMAL_RUNTIME = IMPLEMENTED_UNIT_VERIFIED
REAL_DB_E2E = NOT_PROVEN_LOCAL_SKIPPED
STOCK_MUTATION = NOT_AUTHORIZED
FINANCE_POSTING = NOT_AUTHORIZED
UI_API_PRODUCTREGISTRY = NOT_AUTHORIZED
GO_LIVE = NOT_AUTHORIZED
```

Minimum next action:

Run the updated Real-DB suite on the canonical E2E environment. If it passes, seal Quality Disposition / Nonconformance Evidence for the implemented scope. If it fails or skips, fix only the root cause required for that proof.

Stop boundary:

Do not implement ProductRegistry, UI/API, Logistics stock mutation, Finance posting, CAPA, Quality OS, or Go-Live from this slice.
