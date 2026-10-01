# Integration Any-Type Batch I1 Result

Date: 2026-09-30

Status: SEALED FOR INTEGRATION TYPE-BOUNDARY SCOPE

## Scope

Batch I1 targeted the 15 production `any` violations in:

```text
src/platform/integration-hub/**
src/platform/integration-runtime/**
```

Out of scope:

```text
Logistics frozen
Finance/Core resolver
Partner Admin
Real Estate deferred contract gaps
next.config.ts
check:any-types Batch 21
```

## Count Evidence

Before I1:

```text
Production independent scan: 59 violations / 22 files
Integration subset:          15 violations / 10 files
```

After I1:

```text
Production independent scan: 44 violations / 12 files
Integration subset:           0 violations /  0 files
Removed by I1:               15 violations / 10 files cleared
```

## Implementation

Integration Hub:

- Replaced `Record<string, any>` outbox payload contracts with `Record<string, unknown>`.
- Added explicit `FinanceApiRequest` for Finance API delivery.
- Serialized `FinanceEventEnvelope` to generated `Json` before JSONB insert.
- Typed `finance_outbox_events` test-mode worker rows from generated Database.
- Typed replay `RETURNING event_id` rows with `pg` query generics.

Integration Runtime:

- Replaced mapper `data: any` with generated row types for:
  - `runtime_tenant_registry`
  - `runtime_quarantine`
  - `runtime_outbox`
  - `runtime_idempotency_registry`
  - `runtime_audit_log`
- Added runtime narrowing for outbox status, audit status, and quarantine resolution.
- Preserved `FinancialIntent` payloads as typed JSON object records.
- Removed the idempotency error-context cast.

## Verification

```text
targeted Integration any scan
PASS
0 violations

npm run lint -- <I1 touched files>
PASS

production independent scan
PASS
59 -> 44

git diff --check
PASS
```

Targeted Vitest:

```text
npx vitest run tests/unit/runtime tests/integration/h1_2_backward_compatibility.test.ts tests/integration/o1_retry_policy.test.ts tests/integration/o2_failure_classification.test.ts tests/integration/o6_replay.test.ts tests/integration/o9_bulk_recovery.test.ts

Unit runtime tests: PASS
Integration suites: FAIL before execution due local PostgreSQL connection refused
Error: connect ECONNREFUSED ::1:5432
Error: connect ECONNREFUSED 127.0.0.1:5432
```

The integration failure is classified as environment / missing local PostgreSQL, not as a demonstrated I1 regression. The affected integration suites require a live database worker environment.

## Decision

I1 is sealed for the authorized type-boundary scope.

Proceed to Partner Admin production any group.
