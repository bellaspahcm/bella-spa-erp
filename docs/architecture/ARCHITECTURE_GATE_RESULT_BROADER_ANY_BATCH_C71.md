# Architecture Gate Result - Broader Any Batch C71

Date: 2026-10-01
Scope: `src/platform/finance/resolvers/kernel-client.service.ts`
Status: PASS

## Problem / Non-goals

Remove local `any` usages from the Finance kernel client resolver by typing the already-existing journal request shape.

Non-goals: do not change Finance posting semantics, account resolution, accounting policy, journal schema, DB migrations, RLS, generated database types, C60 HOLD, Finance F1 baseline, Logistics, Healthcare, Nail Shop, Preschool, or Education kernel.

## Truth And Source Of Truth

- Bella Constitution: `docs/governance/BELLA_AI_CODING_CONSTITUTION.md`
- Finance posting input contract: `src/platform/finance/finance-event-handler.ts`
- Generated journal table contracts: `src/types/database.types.ts`

`PostingInstruction` already defines the source entries. `journal_entries` and `journal_lines` generated insert contracts define the persistence target.

## Ownership

- Owner: Finance resolver layer.
- Contract owner: Finance event handler input contract and generated DB table contracts.

## Contract Dependency Map

```text
PostingInstruction
  -> DefaultFinanceKernelClient.convertToKernelRequest
  -> journal_entries / journal_lines generated insert contracts
```

## Change Authority

Authorized: resolver-local typing of the internal request object.

Not authorized: changing Finance accounting behavior, posting policy, account lookup semantics, DB schema, RLS, migrations, generated types, or journal amount units.

## Minimal Plan

1. Define a local `KernelJournalLine` type from `journal_lines` insert shape.
2. Define a local `KernelJournalRequest` type for the object returned by `convertToKernelRequest`.
3. Replace `Promise<any>` and `(line: any)` with those local types.
4. Run targeted scan, ESLint, diff check, architecture guard, and raw any scan.

