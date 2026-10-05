# Beauty V2 Finance Mapping Contract V1

Status: DEFINED_PENDING_IMPLEMENTATION_GATE
Date: 2026-10-05
Scope: Finance mapping contract for `SALARY_PAID` only; no Finance runtime change, no migration, no F5/control expansion, no Chain, Attendance, Payroll, Commission, Governance, or H8 session changes.

## Decision

```yaml
Finance_Mapping_Contract: DEFINED
Target_Event: SALARY_PAID
Canonical_Branch_Source: salary_records.branch_id
Finance_OS_Extension: NOT_REQUIRED
Legacy_Null_Branch: NOT_PROVEN_REJECT
TenantId_As_Branch: FORBIDDEN
Current_Membership_As_Branch: FORBIDDEN
Request_Context_As_Branch: FORBIDDEN
Finance_Runtime_Implementation: NOT_STARTED
Finance_Implementation_Authorized_By_This_Artifact: false
Finance_Gate: DEFER_PENDING_IMPLEMENTATION_PROOF
Beauty_V2_Go_Live: NOT_READY
```

## Boundary

Chain, Attendance, Payroll, and Commission are sealed. Finance must consume their proven branch facts through the existing Finance OS boundary instead of introducing a Beauty-local ledger, branch, payroll, commission, or permission subsystem.

```text
Attendance.branch_id
        -> salary_records.branch_id
        -> SALARY_PAID accounting outbox payload.branchId
        -> RevenueRecognitionService.handleSalaryPaid(branchId)
        -> journal_lines.branch_id
```

This contract does not authorize runtime implementation. It defines the mapping that a later minimal implementation gate must follow.

## Existing Evidence

### Upstream branch truth is sealed

Payroll now persists the branch of a KTV salary period:

```text
attendance.branch_id
        -> salary_records.branch_id
```

Commission is proven to keep source branch aligned with the salary record branch before saving commission components.

Evidence:

- `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_PAYROLL_IMPLEMENTATION_GATE_2026_10_04.md`
- `docs/architecture/ARCHITECTURE_GATE_RESULT_BEAUTY_V2_COMMISSION_IMPLEMENTATION_GATE_2026_10_04.md`

### Existing Finance OS can carry branch

Finance already has a line-level branch dimension and the salary payment receiver accepts `branchId`.

Evidence:

- `supabase/migrations/20260524000000_accounting_core.sql:44-57`
- `src/services/accounting-engine.ts:6-19`
- `src/services/accounting-engine.ts:76-84`
- `src/services/revenue-recognition.ts:226-258`
- `src/app/api/cron/accounting-worker/route.ts:866-875`

Result:

```yaml
finance_os_branch_dimension: PRESENT
finance_receiver_extension_required: false
```

### Current producer mapping gap

The current salary payment producer does not read `salary_records.branch_id` for Finance and the outbox helper currently falls back to tenant id as branch id.

Evidence:

- `src/core/services/finance/transaction-mutations.ts:290-355`
- `src/lib/business-rules/accounting-outbox.ts:84-103`

Result:

```yaml
salary_records.branch_id_to_outbox: NOT_PRESENT
current_payload.branchId: tenantId
finance_branch_truth: NOT_PROVEN
```

## Canonical Branch Rule

For Beauty V2 `SALARY_PAID`, the only canonical branch truth is:

```text
salary_records.branch_id
```

This is valid because Payroll and Commission have already proven the branch identity of the saved salary result.

The following are not valid Finance branch truth:

```text
tenant_id
current user membership
current staff profile branch
request context branch
expense tenant
expense category
expense description text
ktv_id
salary record id alone
```

## Producer Contract

The salary payment producer must map:

```text
salary_records.id
        -> salary_records.tenant_id
        -> salary_records.ktv_id
        -> salary_records.branch_id
        -> accounting_outbox.payload.branchId
```

Required invariant:

```text
accounting_outbox.payload.branchId
  = salary_records.branch_id
```

The producer must not enqueue `SALARY_PAID` when `salary_records.branch_id` is null or missing.

If a future caller supplies an expected branch context, it must match `salary_records.branch_id`. A mismatch must reject before Finance side-effects.

## Receiver Contract

The accounting worker must preserve the outbox branch:

```text
accounting_outbox.payload.branchId
        -> RevenueRecognitionService.handleSalaryPaid({ branchId })
        -> journal_lines.branch_id
```

Required invariant:

```text
journal_lines.branch_id
  = accounting_outbox.payload.branchId
  = salary_records.branch_id
```

The receiver must not derive a replacement branch from tenant, membership, request context, or employee profile.

## Rejection Rules

### Null legacy salary branch

```text
salary_records.branch_id = NULL
```

Decision:

```yaml
finance_branch_mapping: NOT_PROVEN
automatic_backfill: FORBIDDEN
required_behavior: reject_before_salary_paid_outbox
```

### Tenant mismatch

If the salary record cannot be loaded by both `id` and `tenant_id`, the Finance handoff is invalid.

Decision:

```yaml
required_behavior: reject_before_salary_paid_outbox
finance_side_effect: none
```

### Branch mismatch

If an implementation has an expected branch context and it differs from `salary_records.branch_id`, the handoff is invalid.

Decision:

```yaml
required_behavior: reject_before_salary_paid_outbox
finance_side_effect: none
```

### Multi-branch salary period

Finance does not recalculate Payroll or Commission source branches. Multi-branch validation is owned upstream by Payroll/Commission. A persisted `salary_records.branch_id` is the canonical Finance input for V1.

## Minimal Implementation Gate

The next implementation gate, if authorized, must be minimal:

```text
confirm salary expense
        -> load salary_records.branch_id by id + tenant_id
        -> reject null or missing branch
        -> build SALARY_PAID outbox with branchId = salary_records.branch_id
        -> worker handles SALARY_PAID
        -> journal_lines.branch_id read-back
```

Allowed changes for that later gate:

- Select `branch_id` when loading `salary_records` for salary payment confirmation.
- Include `branchId` in the `buildSalaryPaidOutboxEvent` input.
- Remove the `tenantId` fallback for `SALARY_PAID` branch.
- Add focused unit tests for mapping and rejection.
- Add Real DB proof for outbox and journal branch read-back.

Not allowed:

- No new Finance subsystem.
- No new accounting legal mapping.
- No F5/control expansion.
- No salary recalculation rewrite.
- No Chain/Attendance/Payroll/Commission reopening.
- No historical backfill.

## Proof Requirements

The future proof must include:

```yaml
Unit_Proof:
  - branch-proven salary record enqueues SALARY_PAID payload.branchId from salary_records.branch_id
  - payload.branchId never falls back to tenantId
  - null salary_records.branch_id rejects before SALARY_PAID outbox
  - missing or cross-tenant salary record rejects before SALARY_PAID outbox
  - accounting worker passes payload.branchId to handleSalaryPaid

Real_DB_Proof:
  - Branch A salary record -> SALARY_PAID outbox payload.branchId = Branch A
  - worker posts salary payment journal lines with branch_id = Branch A
  - null branch salary record rejects with no outbox/journal side-effect
  - Tenant A cannot pay Tenant B salary record
  - denied operation leaves salary/outbox/journal state unchanged
  - cleanup current proof residual = 0
```

## Gate Result

```yaml
Finance_Mapping_Contract: DEFINED
Finance_Runtime_Implementation: NOT_STARTED
Finance_Runtime_Mapping: NOT_PROVEN
Finance_Branch_Isolation: NOT_PROVEN
Finance_Tenant_Isolation: PARTIAL_EXISTING_PROVEN
Finance_Real_DB_Proof: NOT_RUN
Finance_Gate: DEFER_PENDING_IMPLEMENTATION_PROOF
Beauty_V2_Go_Live: NOT_READY
```

Finance can proceed only through a separate minimal implementation gate that follows this contract. H8 session Finance, Chain, Attendance, Payroll, Commission, Governance, and historical DB maintenance remain closed.
