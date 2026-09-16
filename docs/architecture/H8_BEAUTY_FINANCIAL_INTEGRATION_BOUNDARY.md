# H8 Beauty Financial Integration Boundary

Status: FROZEN AS INTEGRATION GUARDRAIL
Parent: H6 `a9a49d3c`, H7 `9ab02534`, H8 `67ce25c6`

Financial integration is planned early but implemented after Beauty operational truth is stable. This document defines the handoff boundary; it does not add a Finance contract or change Finance ownership.

## Operational Truth First

```text
Service Catalog
    -> Appointment
    -> Professional Assignment + Resource Allocation
    -> Session Tracking
    -> actual operational facts
    -> Finance / Commission / Payroll / Accounting consumers
```

The financial layer must not infer execution facts from a booking, planned assignment, or requested resource.

## Required Financial Inputs from Beauty OS

```yaml
financial_inputs:
  service_reference: required
  appointment_reference: required
  service_commitment_reference: required
  actual_service_outcome: required_before_final_settlement
  actual_performer: required_for_commission_when_applicable
  actual_resource_usage: available_when_costing_requires_it
  tenant_context: required
  branch_context: required
  event_time: required
```

The canonical actual performer is `Session Tracking.actual_performer_id`. The canonical actual resource usage is produced by Resource Allocation execution facts. Both remain operational facts and are consumed through the established OS-to-OS contract/event path.

## Ownership Boundary

| Concern | Owner | Beauty OS role |
|---|---|---|
| Service price/presentation policy | Service Catalog / Beauty policy | Provides configured service facts |
| Customer commitment | Appointment | Provides appointment reference and lifecycle |
| Planned professional | Professional Assignment | Provides assignment history, not final execution truth |
| Actual performer | Session Tracking | Provides canonical execution fact |
| Actual resource usage | Resource Allocation | Provides canonical allocation/execution fact |
| Payment/revenue/refund | Finance capabilities | Consumer and financial source of truth |
| Commission entitlement/result | Commission/Payroll capability | Consumer and policy owner |
| Journal/ledger/accounting | Accounting/Finance capability | Consumer and accounting source of truth |

Beauty OS must not own payment, commission result, payroll, journal entries, general ledger, or accounting policy.

## Integration Rules

1. Finance consumes committed operational facts only after the relevant Beauty transaction commits.
2. Commission resolves the actual performer from Session Tracking, never from `assigned_ktv_id` or an appointment summary.
3. Reassignment must not create duplicate commission entitlement; downstream consumers use stable operational references and idempotency keys.
4. Cancellation, refund, correction, and policy-version effects are resolved by the financial owner without mutating Beauty assignment or execution history.
5. A missing or conflicting execution fact produces a reviewable integration error; it must not be silently guessed.
6. Beauty never writes Finance-owned tables directly.

## Readiness Gate

```yaml
H8_financial_integration:
  boundary_defined: true
  operational_inputs_defined: true
  canonical_actual_performer: SESSION_TRACKING
  canonical_actual_resource_usage: RESOURCE_ALLOCATION
  finance_implementation_started: false
  finance_ownership_changed: false
  payment_contract_added: false
  commission_contract_added: false
  accounting_schema_changed: false
  ready_for_integration_after:
    - H8_operational_workflows_verified
    - H9_tenant_concurrency_recovery_regression_verified
```

This is a boundary and readiness guardrail, not field-verified Finance integration evidence.
