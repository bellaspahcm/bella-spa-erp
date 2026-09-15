# H3 BabyCare Financial Reconciliation - Assignment to Accounting Evidence Pass

**Date:** 2026-09-16

**Branch:** `feat/haircut-h2-contract-extraction`

**Status:** RECONCILIATION COMPLETE

**Scope:** Read-only audit of the BabyCare/Beauty operational chain from assignment and actual service execution through commission, payroll, finance, and accounting.

**Purpose:** Determine what existing Bella implementation proves before Haircut defines financial requirements or contract boundaries.

---

## Guardrails

This pass does not design Haircut Commission, Payroll, Finance, or Accounting contracts.

It does not:

1. Promote `IPaymentEngine` into a finance umbrella.
2. Claim that Commission, Payroll, Finance, and Accounting are the same capability.
3. Claim a Platform contract exists only because BabyCare/Beauty has implementation.
4. Change the H1/H2 contract inventory.
5. Copy BabyCare implementation shape into Haircut.

Evidence from BabyCare is implementation evidence. Haircut still needs Product/UX validation before boundary decisions.

```yaml
babycare_financial_reconciliation:
  evidence_source: EXISTING_IMPLEMENTATION
  haircut_contract_design_allowed: false
  platform_promotion_allowed: false
  contract_inventory_change_allowed: false
  boundary_decision: NONE
```

---

## Evidence Scale

```yaml
evidence_scale:
  IMPLEMENTED:
    meaning: "Code path and persistence behavior were found."
  PARTIAL:
    meaning: "Related behavior exists, but required lifecycle/history/ownership shape is incomplete or indirect."
  NOT_FOUND:
    meaning: "No confirming code path was found in this narrow pass."
  NOT_ASSESSED:
    meaning: "Out of this pass scope or not verified end-to-end here."
```

---

## Executive Finding

BabyCare/Beauty already contains a meaningful financial chain:

```text
Booking
  -> primary assignment
  -> session actual execution
  -> completed_by_ktv_id
  -> booking/package commission basis
  -> salary recalculation
  -> salary_records
  -> finance confirmation / salary paid side effect
  -> accounting outbox
  -> journal_entries / journal_lines
```

However, the chain is not one single "Payment" capability.

```text
Payment != Revenue
Revenue != Commission
Commission != Payroll
Payroll != Accounting
```

Current evidence supports this classification:

```yaml
financial_chain:
  assignment_to_execution: IMPLEMENTED
  execution_to_commission: IMPLEMENTED
  reassignment_to_commission: IMPLEMENTED_BY_COMPLETED_BY_KTV_ID
  commission_history: PARTIAL
  commission_to_payroll: IMPLEMENTED
  finance_source_of_truth: IMPLEMENTED_FOR_REVENUE_EXPENSE_SALARY_PAYMENT
  accounting_posting: IMPLEMENTED_VIA_OUTBOX_AND_WORKER
  standalone_commission_ledger: NOT_FOUND
  standalone_payroll_contract: NOT_FOUND
  haircuts_financial_boundary_decision: NONE
```

---

## 1. Assigned Professional vs Actual Service Provider

Evidence found:

- `bookings.assigned_ktv_id` stores the primary booking-level KTV assignment.
- `session_logs.completed_by_ktv_id` stores the KTV who actually performs or is assigned to the session.
- KTV dashboards and session queries distinguish primary assignment from reassigned/actual session performer.
- `startSession()` and `completeKTVSession()` set `completed_by_ktv_id` to the KTV who performs the session.
- `updateSessionLog()` can change `completed_by_ktv_id` for a specific session and sends reassignment notifications.

References:

- `supabase/migrations/20260511000000_initial_schema.sql`
- `src/services/ktv-actions.ts`
- `src/core/services/order/update-session-log-action.ts`
- `src/core/services/order/session-query-actions.ts`

Assessment:

```yaml
assignment_to_execution:
  primary_assignment: bookings.assigned_ktv_id
  actual_session_provider: session_logs.completed_by_ktv_id
  session_level_provider_preserved: true
  multi_session_actual_provider_tracking: true
  structured_assignment_history: PARTIAL
  evidence_strength: IMPLEMENTED
```

Reconciliation:

BabyCare proves that Bella already distinguishes "who was assigned at booking level" from "who actually did this session." This is directly relevant to Haircut because commission should normally follow actual service execution, not only original assignment.

---

## 2. Commission Basis

Evidence found:

- Booking creation locks `ktv_commission` on the booking, resolving from explicit booking input, package commission, or default fallback.
- Session completion reads booking `ktv_commission`.
- Salary recalculation counts completed sessions where `session_logs.completed_by_ktv_id = ktvId` and reads `bookings.ktv_commission`.
- Service-level commission exists through `booking_service_items.calculated_commission`.
- Product-sale commission exists through `product_sales.calculated_commission`.
- Tenant commission defaults exist through `tenants.commission_config`.

References:

- `src/core/services/order/commission-actions.ts`
- `src/core/services/order/create-booking-helpers.ts`
- `src/core/services/order/session-completion-helpers.ts`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `src/modules/bookings/actions/service-items-actions.ts`
- `supabase/migrations/20260622163000_create_booking_service_items.sql`
- `supabase/migrations/20260622172000_extend_tenants_commission_config.sql`

Assessment:

```yaml
commission_basis:
  booking_level_ktv_commission: IMPLEMENTED
  package_default_commission: IMPLEMENTED
  completed_session_basis: IMPLEMENTED
  service_line_commission: IMPLEMENTED
  product_sales_commission: IMPLEMENTED
  payment_received_basis: PARTIAL
  policy_version_snapshot: NOT_FOUND
  evidence_strength: IMPLEMENTED_WITH_MIXED_BASIS
```

Reconciliation:

BabyCare/Beauty does not use a single commission basis. Some commission comes from booking/package session completion, while advanced commission comes from completed service items and product sales. Payment/revenue is present for accounting and revenue recognition, but commission entitlement is primarily tied to completed work and configured amounts, not purely cash receipt.

---

## 3. Reassignment to Commission

Evidence found:

- Leave-driven reassignment updates `session_logs.completed_by_ktv_id`.
- Session completion syncs salary for the resolved KTV ID passed from the completed session.
- Salary recalculation filters completed sessions by `completed_by_ktv_id`, not `bookings.assigned_ktv_id`.
- If a completed session's KTV changes, session-log actions verify salary records are not locked/finalized and recalculate old/new KTV months.
- This avoids obvious double commission because the salary query attributes each completed session to one `completed_by_ktv_id`.

References:

- `src/services/attendance-actions.ts`
- `src/core/services/order/session-completion-engine.ts`
- `src/core/services/order/session-completion-helpers.ts`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `src/modules/bookings/actions/session-log-actions.ts`

Assessment:

```yaml
reassignment_to_commission:
  commission_follows_actual_session_provider: IMPLEMENTED
  uses_completed_by_ktv_id: IMPLEMENTED
  old_new_salary_recalculation_on_completed_session_ktv_change: IMPLEMENTED
  salary_lock_prevents_late_mutation: IMPLEMENTED
  explicit_reassignment_commission_ledger: NOT_FOUND
  double_commission_prevention: IMPLEMENTED_BY_SINGLE_COMPLETED_BY_KTV_ID
  evidence_strength: IMPLEMENTED
```

Reconciliation:

BabyCare gives strong evidence that commission follows the actual session performer. For Haircut, this argues against using only appointment-level `stylist_id` as commission truth.

---

## 4. Commission History

Evidence found:

- `booking_service_items` persists `override_commission_type`, `override_commission_value`, and `calculated_commission`.
- `product_sales` has analogous calculated commission fields in generated types and salary queries.
- `salary_records` stores computed components: `session_bonus`, `service_commission`, `product_sales_commission`, `position_bonus`, `seniority_bonus`, `manual_adjustments`, and `total_salary`.
- Salary recalculation preserves stored values for non-draft records in several paths.
- Salary records can be locked/finalized, preventing changes in service item/session update flows.

Missing or partial:

- No standalone commission ledger table for BabyCare/Beauty was found in this pass.
- No explicit commission policy version field was found for service/session commission.
- Tenant config history was not confirmed as active source-of-truth for BabyCare commission policies.

References:

- `supabase/migrations/20260622163000_create_booking_service_items.sql`
- `supabase/migrations/20260622170000_extend_salary_records_commission.sql`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `src/modules/bookings/actions/service-items-actions.ts`

Assessment:

```yaml
commission_history:
  transaction_calculated_commission_snapshot: IMPLEMENTED
  salary_component_snapshot: IMPLEMENTED
  non_draft_salary_preservation: IMPLEMENTED
  locked_finalized_salary_protection: IMPLEMENTED
  policy_version_snapshot: NOT_FOUND
  standalone_commission_ledger: NOT_FOUND
  evidence_strength: PARTIAL
```

Reconciliation:

BabyCare/Beauty has enough persisted values to prevent simple retroactive recalculation in many cases, but it does not prove a complete commission-history ledger with policy versions. Haircut should not assume changing commission policy later can be audited correctly unless this requirement is explicitly designed.

---

## 5. Commission to Payroll / Finance

Evidence found:

- Session completion triggers `recalculateAndSaveSalaryRecord()`.
- Salary recalculation writes or updates `salary_records`.
- `salary_records` stores payroll components and total salary.
- KTV salary confirmation exists (`published -> confirmed`).
- Finance transaction confirmation can update salary record to `paid`, set `paid_date` / `paid_method`, and enqueue `SALARY_PAID` accounting outbox.
- `salary_adjustments` supports manual bonus/deduction approval workflow.
- Revenue and expense tables exist separately from salary records.

References:

- `src/core/services/order/session-completion-engine.ts`
- `src/core/services/order/session-completion-helpers.ts`
- `src/modules/hr-salary/actions/salary-recalculation-engine.ts`
- `src/modules/hr-salary/actions/ktv-salary-actions.ts`
- `src/core/services/finance/transaction-mutations.ts`
- `supabase/migrations/20260511000000_initial_schema.sql`
- `supabase/migrations/20260622165000_create_salary_adjustments.sql`

Assessment:

```yaml
commission_to_payroll:
  commission_creates_salary_component: IMPLEMENTED
  payroll_record: IMPLEMENTED
  ktv_salary_confirmation: IMPLEMENTED
  manual_adjustments: IMPLEMENTED
  salary_paid_finance_flow: IMPLEMENTED
  revenue_expense_finance_tables: IMPLEMENTED
  standalone_payroll_contract: NOT_FOUND
  evidence_strength: IMPLEMENTED
```

Reconciliation:

BabyCare/Beauty proves commission is not merely a display value; it flows into payroll records. Finance is also broader than payroll because it owns revenue, expenses, salary payment confirmation, and accounting side effects.

---

## 6. Finance Source of Truth

Evidence found:

- `revenue` records booking payments and revenue-related rows.
- `expenses` records operational expenses.
- `salary_records` records payroll outcomes.
- Session completion can create revenue for single-session bookings.
- Finance transaction confirmation approves expenses and salary payment side effects.
- Revenue recognition uses actual confirmed payments for earned/deferred/receivable split on session completion.

References:

- `supabase/migrations/20260511000000_initial_schema.sql`
- `src/core/services/order/session-completion-helpers.ts`
- `src/lib/business-rules/payment.ts`
- `src/core/services/finance/transaction-mutations.ts`

Assessment:

```yaml
finance_source_of_truth:
  revenue_table: IMPLEMENTED
  expenses_table: IMPLEMENTED
  salary_records: IMPLEMENTED
  confirmed_payment_amount_used_for_revenue_recognition: IMPLEMENTED
  refunds_discounts_present_in_finance_paths: IMPLEMENTED
  finance_not_same_as_accounting: true
  evidence_strength: IMPLEMENTED
```

Reconciliation:

`IPaymentEngine` cannot represent this full chain. Payment is one input into Finance. Finance tracks revenue, debt/receivable logic, expenses, salary payment status, discounts, refunds, and accounting metadata.

---

## 7. Accounting Posting

Evidence found:

- Accounting core tables exist: `accounting_accounts`, `accounting_periods`, `journal_entries`, and `journal_lines`.
- Journal posting enforces balanced debit/credit before `POSTED`.
- Session completion enqueues `SESSION_DONE` accounting outbox with earned revenue, deferred revenue, receivable amount, commission amount, and KTV ID.
- Accounting worker processes `SESSION_DONE` outbox and calls `RevenueRecognitionService.handleSessionDone()`.
- `handleSessionDone()` creates journal lines for revenue recognition and commission payable:
  - Debit deferred revenue / receivable
  - Credit service revenue
  - Debit commission expense
  - Credit salary/payable account
- Salary payment confirmation enqueues `SALARY_PAID` outbox.
- Salary accrual support exists for base salary and non-session components.

References:

- `supabase/migrations/20260524000000_accounting_core.sql`
- `supabase/migrations/20260525130000_accounting_outbox.sql`
- `src/lib/accounting-outbox.ts`
- `src/lib/business-rules/accounting-outbox.ts`
- `src/app/api/cron/accounting-worker/route.ts`
- `src/services/revenue-recognition.ts`
- `src/services/accounting-engine.ts`
- `src/core/services/accounting/salary-accrual.ts`

Assessment:

```yaml
accounting_posting:
  journal_entries_and_lines: IMPLEMENTED
  balanced_posting_guard: IMPLEMENTED
  session_done_outbox: IMPLEMENTED
  session_done_worker_to_journal: IMPLEMENTED
  commission_expense_and_payable_journal_lines: IMPLEMENTED
  salary_paid_outbox: IMPLEMENTED
  salary_accrual_support: IMPLEMENTED
  synchronous_accounting_inside_session_completion: false
  evidence_strength: IMPLEMENTED_VIA_OUTBOX_AND_WORKER
```

Reconciliation:

It is legitimate to call this Accounting evidence because double-entry ledger tables and posting logic exist. The session completion transaction itself does not directly post the journal; it enqueues outbox and relies on the accounting worker. That is a design choice, not absence of accounting.

---

## Cross-Product Financial Matrix

Legend:

- `IMPLEMENTED`: code-confirmed in this pass.
- `PARTIAL`: related behavior exists, but not complete for Haircut requirement shape.
- `NOT_FOUND`: not confirmed in this pass.
- `PROPOSED_BY_PRODUCT`: Haircut requirement still needs Product/UX validation.
- `H2_EVIDENCE_NOT_REAUDITED`: existing Spa/H2 evidence exists, but Spa was intentionally not re-audited in H3.

| Capability | Spa | BabyCare/Beauty | Haircut | Reconciliation |
| --- | --- | --- | --- | --- |
| Assignment vs Actual Execution | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Haircut should distinguish assigned stylist from actual service provider. |
| Execution to Commission | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Commission follows completed sessions and actual performer. |
| Reassignment to Commission | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Reassigned performer can receive commission via `completed_by_ktv_id`. |
| Commission Basis | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED_WITH_MIXED_BASIS | PROPOSED_BY_PRODUCT | Basis may be booking/package, service line, product sale, and completed work. |
| Commission History | H2_EVIDENCE_NOT_REAUDITED | PARTIAL | PROPOSED_BY_PRODUCT | Snapshots exist, but no complete policy-version ledger was found. |
| Payroll / Salary Records | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Commission flows into salary records and salary lifecycle. |
| Finance Source of Truth | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED | PROPOSED_BY_PRODUCT | Finance includes revenue, expenses, discounts/refunds, and salary payment status. |
| Accounting Posting | H2_EVIDENCE_NOT_REAUDITED | IMPLEMENTED_VIA_OUTBOX_AND_WORKER | PROPOSED_BY_PRODUCT | Accounting is real double-entry infrastructure, not merely finance labels. |
| Standalone Commission Contract | H2_EVIDENCE_NOT_REAUDITED | NOT_FOUND | TBD | BabyCare evidence does not automatically authorize a new contract. |
| Standalone Payroll Contract | H2_EVIDENCE_NOT_REAUDITED | NOT_FOUND | TBD | Payroll implementation exists, contract boundary remains unresolved. |

---

## Boundary Impact

This pass changes the financial framing for Haircut:

```text
IPaymentEngine is not enough.
```

Haircut should validate at least these separate ownership questions before contract design:

```yaml
financial_boundary_questions:
  payment:
    owns: "Cash/payment receipt events."
  revenue:
    owns: "Earned/deferred/receivable recognition policy."
  commission:
    owns: "Who earned what and by which basis."
  payroll:
    owns: "Employee salary records, adjustments, confirmation, payment status."
  finance:
    owns: "Operational money records: revenue, expense, salary payment, discount/refund facts."
  accounting:
    owns: "Double-entry posting, COA, journal entries, periods, ledger integrity."
```

Current H3 state:

```yaml
haircut_financial_scope:
  ipayment_engine_represents_full_money_domain: false
  commission_independent_capability_signal: STRONG_REUSE_SIGNAL
  payroll_independent_capability_signal: STRONG_REUSE_SIGNAL
  accounting_independent_capability_signal: IMPLEMENTED_EXISTING_INFRA
  haircut_requirement_status: NOT_VALIDATED
  contract_design_allowed: false
  contract_inventory_change_allowed: false
  boundary_decision: NONE
```

---

## Next Validation Questions For Haircut

Before Haircut financial contract design, H3 should answer:

1. Does Haircut commission follow the assigned stylist, actual stylist, or split roles within a service?
2. Does Haircut commission depend on full appointment completion, service line completion, add-on upsell, product sale, customer payment, or a combination?
3. Can one haircut/nail appointment have multiple commission earners?
4. Must commission policy/version be snapshotted per transaction?
5. Is payroll needed in Haircut MVP, or only commission entitlement export?
6. Which financial facts are Finance truth and which are Accounting postings?

Until answered:

```yaml
haircut_financial_reconciliation_status: READY_FOR_PRODUCT_VALIDATION
haircut_contract_design_allowed: false
platform_promotion_allowed: false
boundary_decision: NONE
```
