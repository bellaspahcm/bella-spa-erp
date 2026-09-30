# Architecture Gate Result - Integration Any-Type Batch I1

Date: 2026-09-30

Status: PASS FOR INTEGRATION TYPE-BOUNDARY SCOPE

## Bella OS/Product Development Process Gate

Batch I1 targets the 15 production `any` violations in Integration Hub and Integration Runtime after Real Estate RE2:

```text
src/platform/integration-hub/**
src/platform/integration-runtime/**
```

This gate does not authorize Logistics frozen changes, Finance/Core resolver changes, `next.config.ts`, generated Database edits, migrations, or `check:any-types` Batch 21.

## Product Manifest

Area:

```text
Integration Hub
Common Integration Runtime
Finance outbox delivery boundary
```

Capabilities:

```text
Runtime tenant registry
Runtime idempotency registry
Runtime outbox
Runtime quarantine
Runtime audit log
Finance outbox writer/worker/replay
```

## Ownership Map

```text
runtime_* tables                  -> Integration Runtime database contract
finance_outbox_events             -> Integration Hub / Finance outbox contract
FinancialIntent                   -> Integration Runtime boundary object
FinanceEventEnvelope              -> Integration Hub finance event envelope
Finance API request/response      -> Integration Hub delivery boundary
```

## Contract Dependency Map

```text
Integration Runtime repositories
  -> local runtime application records
  -> generated Database runtime table rows

Finance Outbox Writer
  -> FinanceEventEnvelope
  -> generated Database Json payload
  -> finance_outbox_events

Finance Outbox Worker / Replay
  -> OutboxEvent / FinanceApiResponse
  -> pg query rows
```

Canonical evidence:

```text
src/platform/integration-runtime/types/database.types.ts
src/platform/integration-runtime/types/financial-intent.types.ts
src/platform/integration-hub/types/outbox.types.ts
src/platform/integration-hub/finance-event-contract.types.ts
src/types/database.types.ts
supabase/migrations/20260818000001_runtime_tables.sql
supabase/migrations/20260815000000_finance_kernel_v1.sql
```

## Change Authority

Authorized:

- Replace `any` in runtime repository mappers with generated row types.
- Preserve Financial Intent JSON payload through typed serialization.
- Replace `any` payload boundaries with `Record<string, unknown>` or explicit request/response contracts.
- Type `pg` replay rows using generic row result types.
- Fix stale local typing where current canonical contracts are clear.

Not authorized:

- Change runtime table schema or generated Database types.
- Change Finance accounting policy or posting behavior.
- Change outbox retry/quarantine semantics.
- Touch Logistics frozen files.
- Touch Finance/Core resolver files.
- Touch Partner Admin until this batch is sealed.

## UI -> Contract Reconciliation

Not applicable. This is integration runtime/service code, not UI work.

## Additive Migration Plan

No migration.

## 11 Automated Verification Gates Plan

Run after implementation:

```text
targeted Integration any scan
npm run lint -- <touched integration files>
targeted Jest if matching tests exist
production independent any scan
git diff --check
```

Scoped TypeScript may be attempted, but timeout is not PASS.

## Decision

PASS.

Proceed with minimal type-boundary cleanup for the 15 Integration Hub/Runtime violations only.
