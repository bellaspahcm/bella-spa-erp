# Broader Any Cleanup Batch C59 Result — 2026-10-01

## Status

SEALED

## Scope

Finance F2 concurrency test typing:

- `src/platform/finance/__tests__/finance-f2-concurrency.test.ts`

## Result

```text
Before check:any-types  197 violations / 45 files
After check:any-types   184 violations / 44 files
Removed                 13 violations / 1 file
```

## Changes

- Added `expectRpcSuccess` helper for RPC response assertions.
- Removed unnecessary generated-type casts from direct cash position mutation attempts.
- Updated scanner-sensitive compliance comment.

## Boundary

```text
C59 type edits runtime behavior       NONE
C59 type edits Finance runtime        NONE
C59 type edits RPC semantics          NONE
C59 type edits test assertion intent  PRESERVED
Finance/RLS blocker repair            APPROVED SEPARATE PRIVILEGE REPAIR
F2 canonical contract                  PRESERVED
```

## Verification

```text
targeted explicit-any scan                  PASS
Finance/RLS negative verification           PASS: 6/6 rejected
Finance targeted Jest                       PASS: 10/10
targeted ESLint                             PASS
git diff --check                             PASS with existing LF/CRLF warnings
npm run check:any-types                      FAIL expected: 184 / 44 remaining
```

## Hold Reason

```text
Test
src/platform/finance/__tests__/finance-f2-concurrency.test.ts

Failure
T22 Direct Position Mutation Bypass Guard

Expected
direct UPDATE on finance_cash_positions is rejected

Actual
updateErr = null
```

The C59 edits are type-local or runtime-erased:

- compliance comment text
- `(data as any).success` assertions replaced by `expectRpcSuccess(data)`
- `as any` removed from generated-typed `finance_cash_positions` insert/update payloads

There is no evidence that C59 changed DB/RLS/trigger behavior. The observed failure was a Finance mutation-boundary baseline issue, so the batch was kept unsealed until the approved Finance/RLS privilege repair below restored the canonical boundary.

## T22 Triage Evidence

### Test Request Context

T22 uses an anonymous Supabase client:

```text
createSupabaseClient(requireSupabaseAdminEnv().url, NEXT_PUBLIC_SUPABASE_ANON_KEY)
```

The test is not running the direct `finance_cash_positions` update as an authenticated tenant user or as `service_role`.

### Canonical Contract

The canonical F2 cash engine migrations and frozen conformance docs require direct cash projection mutation to be rejected:

```text
finance_cash_positions
  direct INSERT / UPDATE / DELETE
  -> rejected by privilege/RLS/trigger boundary
```

Canonical grants revoke direct mutation from `public`, `authenticated`, and `anon`, while allowing `service_role` for controlled projection/reconstruction paths.

### Actual Database Baseline

Live database inspection shows drift from the canonical grants:

```text
anon          SELECT INSERT UPDATE DELETE = true
authenticated SELECT INSERT UPDATE DELETE = true
service_role  SELECT INSERT UPDATE DELETE = true
```

The active RLS policy on `finance_cash_positions` is scoped to:

```text
roles = authenticated
cmd   = ALL
```

There is no equivalent `anon` policy for the row matched by T22.

The mutation guard trigger still exists:

```text
trg_finance_cash_positions_mutation_guard
BEFORE INSERT OR DELETE OR UPDATE
EXECUTE FUNCTION finance_cash_mutation_guard()
```

### Reproduction Outside Jest

The exact anonymous update path was reproduced outside Jest:

```text
REST anon UPDATE finance_cash_positions
status = 204 No Content
error  = null
```

Direct SQL role reproduction showed:

```text
anon           UPDATE -> rowCount 0, error null
authenticated  UPDATE -> F2001 DIRECT_CASH_MUTATION_PROHIBITED
service_role   UPDATE -> F2001 direct position mutation rejected without projection/reconstruction GUC
```

### Likely Drift Source

Later broad grant migrations re-grant mutation privileges after the canonical F2 revoke migration:

```text
supabase/migrations/20260909000059_p73_finance_rls_grant.sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

supabase/migrations/20260909000064_p93_facilities_rls_grant.sql
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
```

## T22 Classification

```text
Failure caused by C59          NO EVIDENCE
Test fixture typo              NO
Finance runtime change needed  NOT PROVEN
Current live DB baseline       DRIFTED FROM CANONICAL F2 GRANTS
Anon update behavior           NO-OP SUCCESS / trigger not reached
Authenticated update behavior  REJECTED by Finance F2 trigger
Canonical contract             DIRECT POSITION MUTATION MUST BE REJECTED
```

Root cause classification:

```text
Environment/schema baseline drift
and
stale anon-specific test expectation
```

## Seal Resolution

Governance approved the canonical F2 boundary:

```text
finance_cash_positions
anon           direct INSERT / UPDATE / DELETE = forbidden
authenticated  direct INSERT / UPDATE / DELETE = forbidden
```

Minimal repair:

```text
supabase/migrations/20261001000001_restore_finance_f2_cash_positions_privilege_boundary.sql
```

The migration restores the canonical privilege boundary:

```text
anon           no direct table access
authenticated  SELECT only
service_role    trusted write path preserved
```

Verification after applying the repair to the current verification DB:

```text
anon INSERT          rejected: 42501 permission denied
anon UPDATE          rejected: 42501 permission denied
anon DELETE          rejected: 42501 permission denied
authenticated INSERT rejected: 42501 permission denied
authenticated UPDATE rejected: 42501 permission denied
authenticated DELETE rejected: 42501 permission denied
```

Finance F2 concurrency verification:

```text
npx jest src/platform/finance/__tests__/finance-f2-concurrency.test.ts --runInBand
PASS: 10/10
```

C59 is now `SEALED`. C60 remains not started.
