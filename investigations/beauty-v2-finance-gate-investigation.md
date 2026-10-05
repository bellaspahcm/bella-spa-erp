# Investigation: Beauty V2 Finance Gate Audit

## Hand-off Brief

1. **What happened.** Beauty V2 Chain, Attendance, Payroll, and Commission were sealed before opening Finance. Finance must now be audited before implementation.
2. **Where the case stands.** Status: Closed as `DEFER_PENDING_FINANCE_MAPPING_CONTRACT`.
3. **What's needed next.** Define a Finance Mapping Contract for branch-aware salary payment posting before any runtime change.

## Case Info

| Field | Value |
| --- | --- |
| Ticket | N/A |
| Date opened | 2026-10-04 |
| Date closed | 2026-10-04 |
| Status | Closed / DEFER |
| System | BELLA SPA ERP / Beauty V2 / Finance OS |
| Evidence sources | Source code, migrations, tests, architecture docs, memory-derived prior Finance boundary |

## Problem Statement

Audit whether Finance consumes branch-aware Payroll/Commission facts and preserves branch/tenant isolation, without reopening Chain, Attendance, Payroll, Commission, Governance, or building a new Finance subsystem.

## Evidence Inventory

| Source | Status | Notes |
| --- | --- | --- |
| Bella AI Coding Constitution | Available | Read on 2026-10-04 |
| Finance prior boundary memory | Available | Finance OS owns accounting/outbox/facts; Beauty provides committed operational facts |
| Beauty H8 Finance docs | Available | H8 `SESSION_DONE` path was previously Real DB proven |
| Source code trace | Complete | Salary payment branch mapping gap found |
| Real DB Finance branch proof for Payroll/Commission | Missing | Not authorized until mapping contract/runtime support exists |

## Confirmed Findings

### 1. Existing Beauty H8 `SESSION_DONE` Finance path is branch-aware

Evidence:

- `src/products/beauty-spa-v2/finance-outbox.ts:25-36`
- `src/app/api/cron/accounting-worker/route.ts:551-600`
- `src/app/api/cron/accounting-worker/route.ts:835-850`
- `src/__tests__/accounting-outbox.test.ts:589-752`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_FINANCE_MINIMAL_WIRING_FIX_2026_10_02.md:100-112`

Result:

```yaml
beauty_h8_session_done_finance: PROVEN_EXISTING
branch_source: appointment.branch_id
finance_worker_branch_passthrough: PRESENT
```

### 2. Finance OS can persist branch dimensions when payload branch is correct

Evidence:

- `supabase/migrations/20260524000000_accounting_core.sql:44-57`
- `src/services/accounting-engine.ts:6-19`
- `src/services/accounting-engine.ts:76-84`
- `src/services/revenue-recognition.ts:99-169`
- `src/services/revenue-recognition.ts:226-258`
- `src/app/api/cron/accounting-worker/route.ts:866-875`

Result:

```yaml
finance_os_branch_dimension: PRESENT
journal_lines.branch_id: SUPPORTED
salary_paid_worker_branch_passthrough: PRESENT
```

### 3. Salary payment Finance handoff does not consume `salary_records.branch_id`

Evidence:

- `src/core/services/finance/transaction-mutations.ts:290-355`
- `src/lib/business-rules/accounting-outbox.ts:84-103`
- `src/__tests__/finance-transaction-mutations.test.ts:723-733`
- `src/__tests__/accounting-outbox.test.ts:887-950`

Observed behavior:

- `confirmTransaction` fetches salary records without selecting `branch_id`.
- `buildSalaryPaidOutboxEvent` has no `branchId` input.
- `buildSalaryPaidOutboxEvent` writes `payload.branchId = input.tenantId`.
- Existing tests assert `SALARY_PAID` enqueue and worker routing, but not branch truth.

Result:

```yaml
salary_records.branch_id_to_outbox: NOT_PRESENT
salary_paid_payload_branch_truth: NOT_PROVEN
current_salary_paid_payload_branch: tenantId
payroll_commission_finance_branch_isolation: NOT_PROVEN
```

### 4. Upstream Payroll/Commission branch proof does not automatically prove Finance

Evidence:

- `supabase/migrations/20261004020000_add_branch_id_to_salary_records.sql`
- `supabase/migrations/20261004030000_add_branch_id_to_commission_sources.sql`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_COMMISSION_GATE_2026_10_04.md:45-138`

Result:

```yaml
attendance_payroll_commission_branch_truth: SEALED_UPSTREAM
finance_consumption_of_salary_branch_truth: NOT_PROVEN
```

## Deduced Conclusions

| Conclusion | Confidence |
| --- | --- |
| Finance OS does not need a new subsystem for this gate. | High |
| Existing Beauty H8 `SESSION_DONE` Finance wiring remains proven and should not be reopened. | High |
| Payroll/Commission to Finance salary payment branch mapping is missing. | High |
| Running Real DB Finance proof now would risk a false PASS because `SALARY_PAID` can post without proving Platform Branch identity. | High |

## Source Code Trace

```text
salary_records.branch_id
        |
        |  MISSING SELECT / MISSING PAYLOAD MAP
        v
confirmTransaction(...)
        |
        v
buildSalaryPaidOutboxEvent(...)
        |
        | current payload.branchId = tenantId
        v
accounting_outbox SALARY_PAID
        |
        v
accounting worker
        |
        v
RevenueRecognitionService.handleSalaryPaid(...)
        |
        v
journal_lines.branch_id
```

The receiving Finance path can persist `branch_id`; the gap is at the producer-side mapping boundary.

## Missing Evidence

| Gap | Impact | How to Obtain |
| --- | --- | --- |
| Finance Mapping Contract for `SALARY_PAID` branch truth | Cannot authorize implementation | Define source, rejection rules, and proof expectations |
| Unit proof for branch-aware `SALARY_PAID` outbox | Cannot prove runtime mapping | After contract authorizes implementation |
| Real DB proof for salary payment branch journal lines | Cannot seal Finance Gate | After implementation passes unit/static checks |

## Conclusion

```yaml
Beauty_H8_Session_Finance: PROVEN_EXISTING
Finance_OS_Branch_Dimension: PRESENT
Payroll_Commission_Finance_Mapping: NOT_PROVEN
Finance_Branch_Isolation: NOT_PROVEN
Finance_Real_DB_Proof: NOT_RUN
Finance_Gate: DEFER_PENDING_FINANCE_MAPPING_CONTRACT
Implementation_Authorized: false
```

## Recommended Next Steps

1. Create `Beauty V2 Finance Mapping Contract V1` focused only on `SALARY_PAID`.
2. Set canonical branch source to `salary_records.branch_id`.
3. Reject salary payment Finance handoff when `salary_records.branch_id` is `NULL`.
4. Require `accounting_outbox.payload.branchId` and resulting `journal_lines.branch_id` to equal the proven Platform Branch.
5. After contract approval, implement the minimal producer-side mapping and prove it with unit and Real DB tests.

## Out of Scope

- No Chain changes.
- No Attendance/Payroll/Commission reopening.
- No Finance OS replacement.
- No F5/control expansion in this gate.
- No payroll recalculation changes.
- No historical backfill.
