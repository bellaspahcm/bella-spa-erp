# Architecture Gate Result - Broader Any Cleanup Batch C63

## Status

PASS

## Scope

Remove explicit `any` usage from F5 hardening cleanup RPC calls:

- `src/__tests__/f5-hardening.integration.test.ts`

## Non-Goals

- No Finance F3 changes.
- No F5 runtime, DB, migration, RLS, RPC, or business behavior changes.
- No test expectation changes.
- No Nail Shop changes.
- No Preschool changes.
- No commit.

## Truth / Source Of Truth

| Code point | Source of truth | Canonical behavior |
| --- | --- | --- |
| `f5_admin_cleanup_test_data` RPC | `src/types/database.types.ts` | Generated RPC exists with args `{ p_tenant_ids: string[]; p_delete_master?: boolean }` |

## Ownership Map

| Data / behavior | Owner | Consumer |
| --- | --- | --- |
| F5 cleanup RPC contract | Generated DB type / Finance F5 test support | F5 integration tests |

## Contract Dependency Map

```text
F5 hardening integration test
  -> Supabase rpc('f5_admin_cleanup_test_data')
  -> generated Database RPC contract
```

## Change Authority

Authorized layer:

```text
F5 test-local generated RPC type usage only
```

## Minimal Implementation Plan

1. Remove `as any` from the two cleanup RPC calls.
2. Preserve cleanup parameters and assertions.

## Verification Plan

```text
targeted explicit-any scan
npx jest src/__tests__/f5-hardening.integration.test.ts --runInBand
npx eslint src/__tests__/f5-hardening.integration.test.ts
git diff --check
```

## Gate Conclusion

PASS. C63 is limited to generated RPC typing in one F5 test file.
