# Architecture Gate Result: Beauty V2 Finance Gate Audit

Date: 2026-10-04

Status: `DEFER_PENDING_FINANCE_MAPPING_CONTRACT`

Implementation authorized: `false`

## 1. Bella OS/Product Development Process Gate

This is a read-only Finance Gate Audit. It follows the Bella rule:

```text
Truth -> Ownership -> Canonical Contract -> Boundary -> Proof
```

No runtime code, migration, product-local Finance subsystem, Chain work, Attendance work, Payroll work, Commission work, or Governance work is authorized by this gate.

## 2. Product Manifest

| Product / Capability | Status |
| --- | --- |
| Platform Chain | `SEALED` |
| Beauty V2 Attendance | `PROVEN` |
| Beauty V2 Payroll | `PROVEN` |
| Beauty V2 Commission | `PROVEN` |
| Beauty V2 Finance | `DEFER_PENDING_FINANCE_MAPPING_CONTRACT` |
| Beauty V2 Go-Live | `NOT_READY` |

## 3. Ownership Map

| Fact | Owner | Gate result |
| --- | --- | --- |
| Chain, Branch, Membership, Authorization | Platform Chain | Sealed / consume only |
| Attendance branch | Beauty Attendance | Proven upstream |
| Salary result branch | Beauty Payroll / HR Salary | Proven upstream |
| Commission source branch | Beauty Commission / HR Salary | Proven upstream |
| Accounting outbox | Finance OS | Existing shared boundary |
| Journal entries and journal lines | Finance OS | Branch dimension supported |
| Salary payment Finance branch mapping | Beauty-to-Finance producer boundary | `NOT_PROVEN` |

## 4. Contract Dependency Map

Existing proven upstream contract:

```text
Attendance.branch_id
        v
salary_records.branch_id
        v
commission source/result branch
```

Existing Finance receiver capability:

```text
accounting_outbox.payload.branchId
        v
RevenueRecognitionService.handleSalaryPaid(branchId)
        v
journal_lines.branch_id
```

Missing mapping:

```text
salary_records.branch_id
        X
accounting_outbox.payload.branchId for SALARY_PAID
```

## 5. Change Authority

This audit authorizes:

- Reading existing Finance, Payroll, Commission, and architecture evidence.
- Writing audit/gate documentation only.

This audit does not authorize:

- Runtime implementation.
- New migration.
- New Finance subsystem.
- Platform Chain changes.
- Payroll/Commission recalculation changes.
- F5/control expansion.

## 6. UI -> Contract Reconciliation

No UI change is in scope.

## 7. Additive Migration Plan

No migration is authorized by this gate.

Current schema evidence shows Finance already supports branch dimensions:

- `journal_lines.branch_id` exists as an optional dimension.
- `AccountingEngineService.postJournalEntry` persists line-level `branch_id`.
- `RevenueRecognitionService.handleSalaryPaid` accepts `branchId` and writes it to both salary payment journal lines.

## 8. Confirmed Evidence

### Existing Beauty H8 session Finance path is branch-aware

Evidence:

- `src/products/beauty-spa-v2/finance-outbox.ts:25-36`
- `src/app/api/cron/accounting-worker/route.ts:551-600`
- `src/app/api/cron/accounting-worker/route.ts:835-850`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_FINANCE_MINIMAL_WIRING_FIX_2026_10_02.md:100-112`

Result:

```yaml
beauty_h8_session_done_finance: PROVEN_EXISTING
branch_source: appointment.branch_id
```

### Finance OS can carry branch once the payload is correct

Evidence:

- `supabase/migrations/20260524000000_accounting_core.sql:44-57`
- `src/services/accounting-engine.ts:6-19`
- `src/services/accounting-engine.ts:76-84`
- `src/services/revenue-recognition.ts:226-258`
- `src/app/api/cron/accounting-worker/route.ts:866-875`

Result:

```yaml
finance_os_branch_dimension: PRESENT
salary_paid_branch_receiver: PRESENT
```

### `SALARY_PAID` producer does not consume `salary_records.branch_id`

Evidence:

- `src/core/services/finance/transaction-mutations.ts:290-355`
- `src/lib/business-rules/accounting-outbox.ts:84-103`
- `src/__tests__/finance-transaction-mutations.test.ts:723-733`
- `src/__tests__/accounting-outbox.test.ts:887-950`

Result:

```yaml
salary_records.branch_id_selected_for_finance: false
salary_paid_outbox_branch_input: missing
salary_paid_payload_branchId: tenantId
branch_truth_to_finance: NOT_PROVEN
```

## 9. 11 Automated Verification Gates Plan

Because this is audit-only, runtime verification is not executed.

| Gate | Status | Evidence / reason |
| --- | --- | --- |
| Architecture boundary | `PASS` | Audit stayed read-only and did not reopen sealed gates. |
| Product manifest | `PASS` | Finance is next gate after Commission. |
| Ownership map | `PASS` | Producer mapping gap isolated. |
| Contract dependency map | `PASS` | Missing `salary_records.branch_id -> SALARY_PAID payload.branchId` identified. |
| UI reconciliation | `N/A` | No UI change. |
| Migration plan | `N/A` | No migration authorized. |
| Unit proof | `NOT_RUN` | Implementation not authorized. |
| Real DB proof | `NOT_RUN` | Mapping contract/runtime support missing. |
| Tenant isolation | `NOT_PROVEN_FOR_THIS_GATE` | Requires Real DB Finance proof after mapping. |
| Branch isolation | `NOT_PROVEN_FOR_THIS_GATE` | Current `SALARY_PAID` payload does not carry proven branch truth. |
| Diff hygiene | `PASS` | `git diff --check` passed after docs-only audit artifact update. |

## Decision

```yaml
Beauty_H8_Session_Finance: PROVEN_EXISTING
Finance_OS_Branch_Dimension: PRESENT
Payroll_Commission_Finance_Mapping: NOT_PROVEN
Finance_Branch_Isolation: NOT_PROVEN
Finance_Real_DB_Proof: NOT_RUN
Finance_Gate: DEFER_PENDING_FINANCE_MAPPING_CONTRACT
Implementation_Authorized: false
```

## Required Next Gate

Create a minimal Finance Mapping Contract V1 for `SALARY_PAID`:

```text
salary_records.branch_id
        v
accounting_outbox.payload.branchId
        v
RevenueRecognitionService.handleSalaryPaid(branchId)
        v
journal_lines.branch_id
```

The contract must require:

- `salary_records.branch_id` is the canonical branch truth for salary payment Finance posting.
- `branch_id = NULL` is rejected before outbox enqueue.
- `payload.branchId` must equal `salary_records.branch_id`.
- Real DB proof must read back `journal_lines.branch_id`.
- Cross-tenant and cross-branch cases must deny with no Finance side-effect.

## Stop Condition

Stop here. Do not implement Finance until the Finance Mapping Contract is defined and approved.
