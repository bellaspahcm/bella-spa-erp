# Finance OS Roadmap From 2026-08-29

> Direction: Finance OS moves from build to prove & harden. Do not open F6 or new Finance modules.

## Principle

Bella standardizes financial semantics and control mechanisms. Each tenant maps those semantics to its own Chart of Accounts and accounting policy.

```text
Financial Semantic
        ↓
Tenant Accounting Configuration
        ↓
COA / GL Account
        ↓
Posting + Reporting + Reconciliation
```

## Phase 1 — Accounting Configuration Foundation

Audit hardcoded account usage in Finance OS and classify each usage:

Inventory record: `docs/architecture/FINANCE_ACCOUNT_HARDCODING_INVENTORY_2026_08_29.md`.

Pilot checkpoint:

- `SERVICE_REVENUE` has an additive read-only mapping contract: `FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1`.
- Contract is effective-dated and tenant-scoped.
- Runtime COA resolution can consume the contract for `RECOGNIZE_REVENUE`.
- E2E runtime posting verified: the same `PATIENT_SERVICE_COMPLETED` event path posts tenant A revenue to `5113` and tenant B revenue to `5111`.
- Unconfigured tenants remain on the legacy default path during the pilot; removing that fallback requires a separate production cutover decision.
- Evidence: `finance-accounting-semantic-gl-map-contract.test.ts` + `coa-resolver-accounting-configuration.test.ts` + `finance-service-revenue-accounting-configuration-e2e.test.ts` = 11/11 PASS.
- Cutover audit: `docs/architecture/FINANCE_SERVICE_REVENUE_CUTOVER_AUDIT_2026_08_29.md`.

| Class | Meaning |
|---|---|
| 🔴 Must be configurable | Tenant accounting policy decides the GL account. |
| 🟡 Default with override | Country/profile default is acceptable, but tenant can override. |
| 🟢 System invariant | The account behavior is truly fixed for the selected accounting profile. |

Candidate semantics to inventory first:

| Semantic | Direction |
|---|---|
| `REVENUE_DEDUCTION` | tenant-configured |
| `SERVICE_REVENUE` | tenant-configured |
| `GOODS_REVENUE` | tenant-configured |
| `CUSTOMER_ADVANCE` | tenant-configured |
| `UNEARNED_REVENUE` | tenant-configured |
| `AR_OFFSET` | tenant-configured or policy-derived |
| `SALARY_EXPENSE` | tenant-configured |
| `COGS` | tenant-configured |
| `AR_CONTROL` | tenant-configured/default-with-override |
| `AP_CONTROL` | tenant-configured/default-with-override |
| `CASH_CONTROL` | tenant-configured via bank-account mapping |
| `PREPAYMENT_CONTROL` | already tenant-configured |

## Phase 2 — TT99 / TT133 Gap Closure

Implement only production-critical mappings from the inventory. Apply changes through the full semantic chain:

```text
Accounting Configuration
        ↓
Tenant / COA Mapping
        ↓
Event Template
        ↓
Runtime Posting
        ↓
Legacy Sync
        ↓
Report
        ↓
Regression
```

## Phase 3 — Workflow Accounting Integrity

- Salary payment must require a valid salary accrual or create one atomically.
- Commission accrual must have one source of truth across session-level and payroll-level posting.

## Phase 4 — Finance E2E Journey

Run one real journey without creating a new framework:

```text
Purchase
   ↓
AP
   ↓
Vendor Prepayment
   ↓
Payment / Application
   ↓
Cash
   ↓
F1 Ledger / GL
   ↓
AP + Cash + Prepayment Reconciliation
```

## Phase 5 — Production Hardening

- RLS and tenant isolation.
- Auditability and temporal integrity.
- Migration provenance and rollback evidence.
- Orphan data policy, including the 17 legacy prepayment facts in official test/pre-production DB.
- Production build.
- Reconciliation performance smoke.

## Phase 6 — Full Finance Regression

Verify:

```text
F1 Ledger + Outbox
F2 Cash Temporal + Bank → GL
F3 AR
F4 AP + Prepayment
F5 AP + F5.5 AR + F5.6 Cash/Prepayment
```

## Target

When the roadmap is complete:

> 🟢 Finance OS — Production Candidate

This does not mean Finance OS is finished forever. It means the current Finance foundation is compliant enough, proven end to end, and hardened enough for the selected production scope.
