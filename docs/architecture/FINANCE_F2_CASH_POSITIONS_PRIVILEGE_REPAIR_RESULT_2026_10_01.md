# Finance F2 Cash Positions Privilege Repair Result - 2026-10-01

## Status

SEALED

## Scope

```text
finance_cash_positions
anon           direct INSERT / UPDATE / DELETE forbidden
authenticated  direct INSERT / UPDATE / DELETE forbidden
```

## Change

Added migration:

```text
supabase/migrations/20261001000001_restore_finance_f2_cash_positions_privilege_boundary.sql
```

The migration restores the canonical F2 least-privilege boundary:

```text
anon           no direct table access
authenticated  SELECT only
service_role    trusted write path preserved
```

## Verification

```text
direct anon INSERT              PASS: 42501 permission denied
direct anon UPDATE              PASS: 42501 permission denied
direct anon DELETE              PASS: 42501 permission denied
direct authenticated INSERT     PASS: 42501 permission denied
direct authenticated UPDATE     PASS: 42501 permission denied
direct authenticated DELETE     PASS: 42501 permission denied
Finance F2 targeted Jest        PASS: 10/10
targeted explicit-any scan      PASS
targeted ESLint                 PASS
git diff --check                PASS with existing LF/CRLF warnings
npm run check:any-types          FAIL expected: 184 / 44 remaining
```

## C59 Seal Status

```text
C59 = SEALED
```

The Finance/RLS privilege drift blocking C59 has been repaired and verified.
