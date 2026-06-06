# Eliminate Internal Clearing From Consolidated P&L

## Problem

Inter-branch clearing posts branch-level accounting entries so each branch can see settlement impact:

- Creditor branch: revenue account `511`
- Debtor branch: COGS account `632`

Those entries are valid for branch operations, but they are internal transfers at HQ level. If the consolidated P&L sums them directly, network revenue and cost are overstated.

## Change

`get_consolidated_pnl` now excludes journal entries where:

```sql
reference_type = 'INTER_BRANCH_CLEARING'
```

from:

- gross revenue (`511%`)
- cost of goods sold (`632%`)

Other posted journal lines remain included.

The RPC also returns two transparency fields:

- `internal_revenue_eliminated`
- `internal_cogs_eliminated`

These fields explain how much internal branch activity was removed from the consolidated report. They do not change the main KPI formulas, which already use the external-only revenue and COGS values.

## Expected Business Result

HQ consolidated P&L shows external business performance only:

- customer revenue stays included;
- real operating expenses stay included;
- internal inter-branch transfer revenue and COGS are eliminated;
- branch-level P&L can still reflect local clearing impact.
- HQ users can see the eliminated totals in the financial overview instead of reconciling the difference manually.

## Verification

Added regression coverage in `src/__tests__/consolidated-pnl.test.ts` to ensure the migration keeps the internal clearing exclusion on both revenue and COGS, returns the eliminated totals, and keeps anon access revoked for the HQ RPC.
