# Architecture Gate Result — Broader Any Cleanup Batch C47

## Status

PASS

## Scope

Remove one explicit `any` from the shared intelligence query batching utility:

- `src/services/intelligence/shared/query-optimizer.ts`

## Non-Goals

- No product/domain logic changes.
- No Finance/Core/Healthcare/Logistics changes.
- No DB, schema, generated type, or query behavior changes.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical contract |
| --- | --- | --- |
| Batched query queue | Local generic `batchQuery<T>` function | Each enqueued entry resolves the same `T` produced by its own query closure |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| Query batching utility | Intelligence shared service utility | Intelligence service callers |

## Contract Dependency Map

```text
batchQuery<T>
  -> stores type-erased queued entries internally
  -> resolves each caller's Promise<T> from its own query result
```

## Change Authority

Authorized layer: local generic storage typing only.

## Verification Plan

```text
targeted explicit-any scan
npx eslint src/services/intelligence/shared/query-optimizer.ts
git diff --check
npm run check:any-types
```

No direct targeted Jest suite exists for this utility; record as `NOT_APPLICABLE`.
