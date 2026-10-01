# Architecture Gate Result - Finance F2 Cash Positions Privilege Repair - 2026-10-01

## Status

PASS

## Problem

C59 is on hold because T22 exposed a Finance F2 privilege baseline drift:

```text
finance_cash_positions
anon direct UPDATE -> 204 / error null
```

The failure was reproduced outside Jest. It is not caused by the C59 type-local edits.

## Non-Goals

- No C60.
- No Finance runtime or business logic changes.
- No RLS policy redesign.
- No F2 contract change.
- No test expectation weakening.
- No Nail Shop or Preschool changes.

## Truth And Source Of Truth

| Question | Source of truth | Result |
| --- | --- | --- |
| May `anon` directly mutate `finance_cash_positions`? | Governance approval for C59 + canonical F2 grants | No |
| May `authenticated` directly mutate `finance_cash_positions`? | Governance approval for C59 + canonical F2 grants | No |
| What drifted? | Live DB grants + later broad grant migrations | `anon` and `authenticated` regained table mutation privileges |
| What remains canonical? | `20260816010000_finance_cash_engine_grants.sql` | `authenticated` has SELECT only; service_role owns trusted write path |

## Ownership Map

| Asset | Owner | Consumer |
| --- | --- | --- |
| `finance_cash_positions` | Finance F2 Cash Engine | F2 projection/reconstruction RPCs and read consumers |
| Direct table mutation boundary | Finance F2 + Core execution boundary | Tests and DB privilege model |
| Trusted write path | `service_role` / SECURITY DEFINER Finance path | Projection and reconstruction operations |

## Contract Dependency Map

```text
Finance F2 cash position projection
  -> public.finance_cash_positions
  -> direct anon/authenticated mutation forbidden
  -> service_role / trusted RPC path remains allowed
```

## Change Authority

Approved by user/governance in this task:

```text
finance_cash_positions
anon           direct INSERT / UPDATE / DELETE = forbidden
authenticated  direct INSERT / UPDATE / DELETE = forbidden
```

Authorized layer:

```text
Database privilege restoration for finance_cash_positions only
```

## Minimal Implementation Plan

1. Add a migration that restores the canonical least-privilege boundary for `finance_cash_positions`.
2. Revoke broad table privileges from `PUBLIC`, `anon`, and `authenticated`.
3. Re-grant only `SELECT` to `authenticated`.
4. Keep the trusted service_role path intact.
5. Apply the same repair to the current verification DB for targeted evidence.

## Verification Plan

```text
direct anon INSERT          -> rejected
direct anon UPDATE          -> rejected
direct anon DELETE          -> rejected
direct authenticated INSERT -> rejected
direct authenticated UPDATE -> rejected
direct authenticated DELETE -> rejected
trusted server path         -> still works through existing F2 test
T22 targeted Jest           -> PASS
targeted explicit-any scan  -> PASS
targeted ESLint             -> PASS
git diff --check            -> PASS
```

## Gate Conclusion

PASS. The approved fix is a minimal privilege-boundary restoration, not a Finance runtime or contract change.
