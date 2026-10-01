# ARCHITECTURE GATE RESULT - MAIN CI REAL DB E2E ISOLATION

Date: 2026-10-01
Status: PASS

## 1. Bella OS/Product Development Process Gate

Problem: main commit `5ad03401837b74f78c7e35d767b4b977e4c57481` fails CI in `CI - Quality Gates / Real Database Business E2E`.

Root evidence: `src/__tests__/e2e-accounting-gl-verification.test.ts` invokes the global accounting worker and asserts the entire worker batch has `success: true` and `failureCount: 0`. The shared E2E database contained pending accounting outbox events for other tenants, so the worker returned `partial_failure` even while processing the test-owned event successfully.

Secondary CI evidence: after the test harness fix, PR CI routed the changed real-DB test into the default affected unit job. The default Jest config intentionally ignores real-DB E2E tests, producing "No tests found". CI routing must send real-DB test files to the real-DB job and exclude them from the default changed-test runner.

Non-goals:
- No production accounting worker behavior change.
- No Finance posting rule change.
- No schema or migration change.
- No Nail, Preschool, Haircut, Healthcare, or Logistics scope change.
- No type-debt or cleanup campaign.

## 2. Product Manifest

Affected capability: Accounting real database E2E verification.

Product scope: none. This is CI/test isolation for a shared real database test.

## 3. Ownership Map

| Data / Behavior | Owner | Change |
| --- | --- | --- |
| `accounting_outbox` worker semantics | Finance / Accounting platform | Read-only verification only |
| Test-created outbox event completion | Real DB E2E test harness | Verify by explicit outbox IDs |
| Cross-tenant stale queue entries | Shared E2E environment state | Do not mutate outside the test tenant |
| Real-DB test file routing | CI scripts | Route to real DB job, not default Jest |

## 4. Contract Dependency Map

```text
Test harness
  -> enqueue_accounting_event RPC
  -> accounting_outbox row id
  -> accounting worker route
  -> accounting_outbox.status read-back
  -> journal_entries / journal_lines read-back
```

Canonical proof for this test is the status and journal output of the event IDs created by the test, not the success status of unrelated events claimed in the same global worker batch.

## 5. Change Authority

Authorized layer: test harness only.

Authorized CI layer: changed-test routing for real-DB test files only.

Not authorized:
- Production worker route.
- RPC contract.
- Database schema.
- Finance posting mappings.
- Product runtime code.

## 6. UI -> Contract Reconciliation

Not applicable. No UI change.

## 7. Additive Migration Plan

No migration.

## 8. 11 Automated Verification Gates Plan

| Gate | Plan |
| --- | --- |
| Product Identity | Not applicable |
| Canonical Contract | Use existing `accounting_outbox.id/status/journal_entry_id` and journal read-back |
| Tenant Isolation | Test verifies only its own tenant event IDs |
| Unit/Integration | Targeted Jest real DB file |
| Real DB | `jest.real-db.config.ts` targeted suite |
| Browser | Not applicable |
| Architecture Guard | No frozen/runtime architecture change |
| Lint | Changed-file lint |
| Typecheck | CI Type Check remains required |
| Security | No secret or auth behavior change |
| Cleanup | Existing test cleanup for test tenant remains |

Conclusion: PASS. Minimal change may proceed in the Real DB E2E test harness.
