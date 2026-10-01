# Broader Any Cleanup Batch C65 Result

Date: 2026-10-01
Status: SEALED

## Scope

- `src/__tests__/f5-reconciliation.integration.test.ts`

## Baseline

Official before C65: 170 violations / 38 files

C60 remains HOLD / NOT SEALED and is not counted into the official baseline.

## Change

Removed local `any` use from generated F5 RPC calls, generated AP facts rows, and nullable test transaction state.

Runtime behavior: unchanged.
Contract changes: none.
DB/RLS changes: none.
Nail Shop: untouched.
Preschool: untouched / excluded.

## Verification

- Targeted any scan: PASS
- Targeted ESLint: PASS
- Scoped `git diff --check`: PASS
- Targeted Jest: PASS, 12/12 passed, 1 skipped

Approved Finance/F5 fixture and expectation updates:
- `PERIOD_INTEGRITY` now asserts the current producer contract: `F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED`.
- AP orphan GL is verified through the canonical F1/F4 read contracts instead of expecting `f5_run_reconciliation` to create an orphan result row.
- AP currency mismatch now asserts current `AP_GL_BALANCE` behavior: functional amount match. Currency integrity remains a separate F5 control.
- Duplicate AP accrual now asserts current producer classification: `VARIANCE`.
- Cash GL branch now documents the current `QUARANTINED` boundary when reconstructed expected cash is unavailable.
- Prepayment fixture now links the prepayment fact to a posted F1 transaction.

## Result

C65 is SEALED.

Official after C65: 164 violations / 37 files.

Removed: 6 violations / 1 file.

F5.6 Cash remains a documented capability gap for MATCHED cash reconciliation; C65 does not declare F5.6 ready. The scoped test now verifies the current live boundary instead of asserting a false matched state.

