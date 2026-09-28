# ARCHITECTURE GATE RESULT — PRESCHOOL FINANCE IDENTITY CUTOVER V1

STATUS: PASS

## Problem / Non-Goals

Move Preschool Finance to one canonical identity semantic:

- `edu_fin_*.student_id` means `party_parties.id` for the Student Party.
- `edu_fin_payments.payer_party_id` means `party_parties.id` for the Payer Party.

Non-goals:

- No compatibility layer for legacy `students.student_id`.
- No Platform Party contract change.
- No Education Enrollment or Attendance contract change.
- No payer authority enforcement in V1.
- No global Education reset.

## Truth And Source Of Truth

- Platform identity truth: `party_parties.id`.
- Education enrollment truth: `edu_enrollments.student_party_id`.
- Attendance truth: `edu_attendance.enrollment_id`.
- Finance product truth for V1: `edu_fin_*.student_id = party_parties.id`.
- Data reset truth: prior DB evidence proved relevant Preschool Finance rows are test/synthetic.

## Ownership

| Capability | Owner | Change Authority |
| --- | --- | --- |
| Party identity | Platform Party | Consume only |
| Enrollment identity | Education public contract / DB contract | Consume only |
| Attendance enrollment link | Education public contract / DB contract | Consume only |
| Preschool Finance billing/payment | Preschool Finance Product | Modify |
| Parent communication projection | Preschool Parent Engagement consumer | Minimal stale consumer fix |
| Analytics finance aggregate | Preschool Analytics consumer | Classify only unless stale |

## Contract Dependency Map

`Preschool Finance Product -> Platform Party identity -> party_parties.id`

`Preschool operational flow -> edu_enrollments.student_party_id -> edu_attendance.enrollment_id -> edu_fin_*.student_id`

## Change Authority

Authorized:

- Preschool Finance Product implementation.
- Preschool Finance test fixtures.
- Minimum downstream consumer correction where proven stale.
- Scoped destructive reset of proven Preschool Finance test/synthetic rows only.

Not authorized:

- Platform Party changes.
- Education Kernel contract changes.
- Schema changes.
- Compatibility branches for legacy student identity.

## Additive Migration Plan

No schema migration required for V1. Existing Finance columns are UUID fields without FK enforcement and will receive canonical Party IDs.

## Downstream Consumer Reconciliation

| Consumer | Contract Finding | Classification |
| --- | --- | --- |
| FinanceProjectionBridge | Verifies `students.student_id`, stale under canonical Finance payload | STALE_CONSUMER |
| Parent Engagement storage | Stores `student_id` as current Preschool communication student identity | DEFERRED unless minimum P72 path requires more |
| Analytics finance aggregate | Aggregates invoice/payment totals by tenant and does not require student identity in Finance raw query | CANONICAL_COMPATIBLE |

## Verification Plan

- P71 Finance billing.
- P72 Finance communication.
- Axis4 truth/projection.
- Enrollment/Attendance real DB flow through canonical Party ID.
- New Finance canonical identity real DB E2E.
- Tenant isolation negative cases.
- Changed-file ESLint.
- Affected TypeScript.
- Education architecture guard where relevant.
- `git diff --check`.

## Result

PASS. Proceed with minimum Product-level implementation and scoped data reset only after target rows are recalculated and proven test/synthetic immediately before delete.
