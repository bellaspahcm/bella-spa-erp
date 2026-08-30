# Finance Policy Separation Audit

**Date:** 2026-08-30  
**Status:** Architecture principle established; implementation gaps identified  
**Scope:** Finance OS F1, F2, F4, F5, F5.5, F5.6 and legacy accounting runtime

## Principle

**Finance Policy Separation**

Bella owns financial mechanics and invariants. Enterprise owns accounting policy, Chart of Accounts, mapping, and effective-dated treatment.

**Account codes are enterprise policy, not Bella financial semantics.**

Bella Finance OS may define that a business event is revenue, cash movement, receivable, payable, prepayment, settlement, reversal, reconciliation, or period activity. It must not treat a specific GL account code as universal Finance Kernel truth unless that code is explicitly bounded to a tenant configuration, legacy compatibility path, migration, fixture, or regulatory/system invariant.

## Classification

Every account-code assumption in Finance code, migrations, reports, or tests should be classified into exactly one group:

| Class | Meaning | Examples |
| --- | --- | --- |
| System invariant | Bella-owned mechanics and correctness constraints | debit equals credit, immutable posted ledger, atomic transaction, tenant isolation, audit, period integrity, currency invariants, reconciliation invariants |
| Tenant policy | Enterprise-owned accounting treatment | COA, GL mapping, revenue account, expense account, tax account, COGS account, payroll account, prepayment account, effective-dated treatment |
| Legacy compatibility | Existing bounded behavior retained for migration/backward compatibility | old fallback account codes, historical product flows, migration support |
| Test fixture | Deterministic test data only | seeded account codes in contract tests, proof fixtures, E2E setup |

An account-code reference is not automatically a bug. The risk is only when a tenant policy or legacy fixture is represented as canonical Bella Finance Kernel authority.

## Current Inventory

| Area | Status | Direction |
| --- | --- | --- |
| F1 Ledger | Green | Keep Bella authority over ledger mechanics, double-entry, immutability, periods, audit, currency and transaction integrity. COA remains tenant data. |
| F2 Cash | Green | Keep cash movement and temporal mechanics in Bella; keep bank-to-GL mapping as contract/configuration. Do not add hardcoded cash-account fallback. |
| F4 Prepayment Reconciliation | Green | Keep `PREPAYMENT_CONTROL` tenant-configured and effective-dated through `F4_PREPAYMENT_GL_MAP:v1`; keep F5.6 using contracts only. |
| F4 Prepayment Lifecycle Posting | Yellow | Priority gap. Legacy posting still contains symbolic/hardcoded treatment such as `PREPAYMENT_ASSET` and `331`; close through tenant accounting policy/configuration without rewriting F5.6. |
| F5 AP | Green/Yellow | Keep AP lifecycle and settlement mechanics in Bella; audit remaining account policy coupling before production claims. |
| F5.5 AR | Green/Yellow | Keep receivable lifecycle and settlement mechanics in Bella; route revenue/AR/tax treatment through tenant policy as production scope requires. |
| F5.6 Reconciliation | Green | Do not rewrite. Bella owns reconciliation mechanics and evidence. Future tolerance, matching and approval policies should be enterprise-configurable only when required. |
| Revenue Mapping | Green | `SERVICE_REVENUE`, `REVENUE_DEDUCTION`, and `GOODS_REVENUE` prove semantic-to-tenant-COA mapping and effective dating. |
| Legacy Revenue Recognition | Yellow | Hardcoded or fallback account-code paths remain. Treat as production-scope debt, not immediate global refactor. |
| COGS / Inventory | Yellow | Future production scope. Convert only when business requirement needs configurable treatment. |
| Salary / Payroll | Yellow | Future production scope. Separate payroll mechanics from payroll account mapping before production compliance claims. |
| Tax / VAT | Yellow | Compliance scope. Tax calculation mechanics may be Bella-owned; tax codes, rates, accounts, exemptions and treatment are enterprise/regime policy. |
| Reports / Intelligence | Yellow | Separate reporting taxonomy from accounting authority; account groups/ranges must not silently become tenant policy. |

## Roadmap

This is not a mandate to refactor all Finance code. Use the smallest production-relevant closure path:

1. **F4 Lifecycle Posting Closure**
   - Replace `PREPAYMENT_ASSET` / `331` policy coupling with tenant-configured accounting treatment.
   - Verify lifecycle, effective date, reversal, audit, GL trace and idempotency.
   - Do not change F5.6 reconciliation unless a verified dependency requires it.

2. **Revenue Legacy Runtime**
   - Audit `revenue-recognition` and resolver paths.
   - Ensure canonical runtime uses semantic mapping rather than hardcoded account authority.
   - Keep legacy fallback only as explicit compatibility during cutover.

3. **COGS / Inventory**
   - Open only when production scope requires it.
   - Use the proven semantic mapping pattern instead of a new accounting engine.

4. **Payroll**
   - Open only when payroll is in Finance production scope.
   - Keep salary calculation/workflow mechanics separate from salary account mapping.

5. **Tax / VAT**
   - Open with compliance scope.
   - Do not hardcode one jurisdiction or enterprise policy into Finance Kernel.

## Non-Goals

This principle does not make Bella responsible for determining each enterprise's accounting treatment.

It also does not require immediate elimination of every legacy account-code reference. Legacy references may remain where required for compatibility, migration, fixtures, reports, or explicitly bounded legacy paths, provided they are not represented as canonical Finance Kernel authority.

Do not create a universal accounting rules engine, country accounting engine, large mapping framework, or broad Finance refactor without demonstrated production need.

## Checkpoint

| Item | Status |
| --- | --- |
| Finance Policy Separation | Green - architecture principle established |
| F4 Prepayment Capability | Yellow - lifecycle posting gap identified |
| F5.6 Prepayment Reconciliation | Green - verified through contracts |
| Finance Legacy Accounting Runtime | Yellow - policy coupling identified |
| Runtime code changes in this checkpoint | None |
| Next implementation candidate | F4 Lifecycle Posting Closure |

