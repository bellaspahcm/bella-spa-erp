# Finance Account Hardcoding Inventory — 2026-08-29

> Scope: Read-only inventory for Accounting Configuration Foundation. No runtime code changes.
>
> Goal: Identify where Finance still encodes GL account codes directly, then classify what should become tenant-configurable versus what can remain default or invariant.

## Summary

Finance OS now has a proven pattern for tenant-configured account mapping through `finance_control_account_mappings` and `F4_PREPAYMENT_GL_MAP:v1`. The remaining hardcoding is concentrated in two layers:

1. Legacy/SIMPLE accounting core: `accounting_accounts`, `accounting_event_templates`, legacy sync, dashboard reports.
2. Finance Kernel reconciliation/AP/AR defaults: F5 AP/AR comparisons and F4 AP posting still assume `331`/`131` in several migrations.

Tests contain many account-code fixtures. Those are not production debt unless they mirror a runtime semantic that should become configurable.

## Inventory

| Semantic / Account Use | Current Hardcoding | Location | Classification | Recommendation |
|---|---|---|---|---|
| `PREPAYMENT_CONTROL` | Tenant-configured mapping; no `331P/242` fallback | `finance_control_account_mappings`, `finance_get_prepayment_gl_map_as_of()` | 🟢 Done | Keep as reference pattern. |
| Cash / bank GL target | `finance_bank_accounts.linked_finance_account_id` via `F2_BANK_ACCOUNT_GL_MAP:v1`; older `CASH_CONTROL` fallback still maps to `111` | `finance_bank_account_gl_map()`, `finance_get_control_account()` | 🟢 Done for F5.6, 🟡 legacy fallback | Keep bank-account map. Later audit whether `CASH_CONTROL` fallback should become config-required. |
| `AP_CONTROL` | `331` fallback and direct F5 AP comparison | `finance_get_control_account()`, `f5_run_reconciliation()` AP branches, F4 AP posting migrations | 🟡 Default with override needed | Treat `331` as TT133/tenant default, not platform truth. Add tenant-configured AP map before changing AP runtime/reconciliation. |
| `AR_CONTROL` | `131` fallback and direct F5 AR comparison | `finance_get_control_account()`, `f5_run_reconciliation()` AR branches, F3 AR tests/runtime | 🟡 Default with override needed | Treat `131` as TT133/tenant default, not platform truth. Add tenant-configured AR map before changing AR runtime/reconciliation. |
| `SERVICE_REVENUE` | `5111` in old fixtures/runtime; `5113` in TT133 hardening migrations/templates | `accounting_event_templates`, `sync_legacy_to_ledger_atomic()`, finance tests | 🔴 Must be configurable | Introduce semantic mapping key `SERVICE_REVENUE`; keep TT133 profile default only as seed/config, not runtime truth. |
| `GOODS_REVENUE` | `5112` appears in invoice/product-sale paths and tests | F3 invoice tests, legacy/product reconciliation migrations | 🔴 Must be configurable | Introduce `GOODS_REVENUE`; map per tenant/industry. |
| `REVENUE_DEDUCTION` | Former `521`; later TT133 hardening updates refund template to debit `5113` | refund templates/migrations, accounting investigation notes | 🔴 Must be configurable | Introduce `REVENUE_DEDUCTION`; tenant policy decides account/debit-side treatment. Runtime/templates/reports must agree. |
| `CUSTOMER_ADVANCE` / `UNEARNED_REVENUE` | `3387` for package/deposit money | accounting templates, legacy sync, reports | 🔴 Must be configurable by semantic | Split semantics: `CUSTOMER_ADVANCE`, `UNEARNED_REVENUE`, `AR_OFFSET`. Tenant policy maps each to COA. |
| `SALARY_EXPENSE` | `642`, `6421`, and category-specific `6423/6424/6425/6427` | accounting templates, legacy sync, salary/expense paths | 🔴 Must be configurable | Introduce `SALARY_EXPENSE` first; later consider category-specific expense semantics only if production requires them. |
| Salary payable | `334` | salary templates, legacy sync, reports | 🟡 Default with override | Likely `SALARY_PAYABLE` mapping; not urgent unless payroll production scope is included. |
| `COGS` | `632` | inventory consumed/materials templates, product-sales reconciliation | 🔴 Must be configurable | Introduce `COGS`; tenant/industry policy decides account. |
| Inventory asset | `152`, `1521` | inventory templates, COA resolver | 🟡 Default with override | Add `INVENTORY_ASSET` mapping if inventory production scope is included. |
| VAT payable | `3331` | revenue templates/tests | 🟡 Default with override / regulatory profile | Keep as TT133 profile default for now; tenant/profile override may be needed for multi-country. |
| Healthcare COA resolver defaults | `4111`, `1311`, `1521`, `3311`, `6211`, `1412` | `src/platform/finance/resolvers/coa-resolver.service.ts` | 🔴 Must be configurable before production use | Resolver already documents future tenant COA lookup. Replace defaults with tenant mapping before using as production Finance posting source. |
| Dashboard report display lines | Labels include `131`, `331`, `3387`; mock/sample rows include `5113`, `6421` | `src/app/dashboard/accounting/reports/page.tsx` | 🟡 Report dependency | Reports must resolve configured semantic groups instead of assuming fixed account codes before production compliance claim. |

## Production-Critical First Slice

Do not convert every mapping at once. The minimum next slice should cover the semantics already flagged by Completion Review:

1. `SERVICE_REVENUE`
2. `REVENUE_DEDUCTION`
3. `CUSTOMER_ADVANCE`
4. `UNEARNED_REVENUE`
5. `AR_OFFSET`
6. `SALARY_EXPENSE`
7. `AP_CONTROL`
8. `AR_CONTROL`

`PREPAYMENT_CONTROL` and bank-account cash mapping are already proven and should be reused as patterns.

## Implementation Boundary

Next implementation should be additive and small:

```text
Hardcoded Account Inventory
        ↓
Semantic Mapping Keys
        ↓
Tenant Effective-Dated Mapping
        ↓
Runtime/Template/Legacy/Report alignment
        ↓
Regression
```

No F6, no universal accounting engine, no broad refactor.
