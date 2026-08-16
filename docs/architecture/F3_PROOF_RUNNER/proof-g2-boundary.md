# Proof G2-02: Boundary Rights and Schema Verification

## Preconditions
- Database triggers trg_tmp_f3_ledger_guard and trg_tmp_f3_alloc_guard are active.

## Action
- Attempt direct UPDATE mutation on F3 proof subledger log table.
- Verify F1 and F2 table existence and schema state.

## Expected
- Direct UPDATE is blocked by trigger (returns code F3001).
- F1/F2 migrations, tables, and schemas are untouched.

## Observed
- Trigger mutation blocked: YES
- F1 tables count: 1
- F2 tables count: 1

## Verdict: PASS