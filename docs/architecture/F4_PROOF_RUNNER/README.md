# F4 Accounts Payable — Pre-Coding Proof Runner Results

> **Status: ✅ ALL PASS — 2026-08-16T06:15:38.152Z**

## Proof Evidence Table

| Proof | Description | Expected | Actual | Result | Evidence |
|:---|:---|:---|:---|:---:|:---|
| G1-01 | Lock key hash identity | Both functions produce identical integers | keys_match=(true,true) | ✅ PASS | [proof-g1-01-lock-identity.md](./proof-g1-01-lock-identity.md) |
| G1-02 | Resource type namespace isolation | CASH_MOVEMENT ≠ VENDOR_BILL keys | distinct=true | ✅ PASS | [proof-g1-02-namespace-isolation.md](./proof-g1-02-namespace-isolation.md) |
| G1-03 | Tenant isolation in lock keys | Different tenants → different lock integers | isolated=true | ✅ PASS | [proof-g1-03-tenant-isolation.md](./proof-g1-03-tenant-isolation.md) |
| G2-01 | Validation failure → zero mutation | Zero F4 records, F1 not called | delta_allocs=0, delta_f1=0 | ✅ PASS | [proof-g2-01-validation-failure.md](./proof-g2-01-validation-failure.md) |
| G2-02 | F1 rejection → zero F4 orphans | Zero AP records when F1 rejects | f1_rejected=true, delta_allocs=0 | ✅ PASS | [proof-g2-02-f1-rejection-rollback.md](./proof-g2-02-f1-rejection-rollback.md) |
| G2-03 | Successful disbursement — 4 mutations atomic | +1 F1 tx, allocation, ledger, position all committed | f1_delta=1, position_version=1 | ✅ PASS | [proof-g2-03-atomic-commit.md](./proof-g2-03-atomic-commit.md) |
| G3-01 | Retry returns canonical allocation ID | Same alloc_id, count=1 | ids_match=true, count=1 | ✅ PASS | [proof-g3-01-idempotency-retry.md](./proof-g3-01-idempotency-retry.md) |
| G3-02 | Different attempt_id → independent disbursements | count=2 | count=2 | ✅ PASS | [proof-g3-02-different-attempt-id.md](./proof-g3-02-different-attempt-id.md) |
| G4-01 | Advisory lock protects outflow ceiling (I-AP-21) | 1 success, 1 ERROR_AP_EXCEEDS_OUTFLOW_CEILING | total_used=600000, connB_err=ERROR_AP_EXCEEDS_OUTFLOW_CEILING | ✅ PASS | [proof-g4-01-outflow-ceiling-concurrency.md](./proof-g4-01-outflow-ceiling-concurrency.md) |
| G4-02 | Bill row lock protects bill ceiling (I-AP-2) | 1 success, 1 ERROR_AP_EXCEEDS_BILL_BALANCE | connB_err=ERROR_AP_EXCEEDS_BILL_BALANCE | ✅ PASS | [proof-g4-02-bill-ceiling-concurrency.md](./proof-g4-02-bill-ceiling-concurrency.md) |
| G5-01 | PREPAYMENT_RECORDED append-only + F1 GL | 1 fact, unapplied=300000, F1 POSTED | facts=1, unapplied=300000 | ✅ PASS | [proof-g5-01-prepayment-recorded.md](./proof-g5-01-prepayment-recorded.md) |
| G5-02 | PREPAYMENT_APPLIED append-only + three-value check | +1 new fact, unapplied=0, net=1000000 | delta_facts=+1, gross=1000000, unapplied=0, net=1000000 | ✅ PASS | [proof-g5-02-prepayment-applied.md](./proof-g5-02-prepayment-applied.md) |
| G5-03 | PREPAYMENT_REFUNDED append-only, unapplied=0 | unapplied=0 after refund | unapplied=0 | ✅ PASS | [proof-g5-03-prepayment-refunded.md](./proof-g5-03-prepayment-refunded.md) |
| G5-04 | Full lifecycle three-value reconstruction | gross=800k, unapplied=300k, net=500k, PP_APPLIED not in ledger | gross=800000, unapplied=300000, net=500000, pp_in_ledger=0 | ✅ PASS | [proof-g5-04-full-lifecycle-reconstruction.md](./proof-g5-04-full-lifecycle-reconstruction.md) |
| G6-01 | calculate() is pure read — zero side effects | version unchanged, correct gross_payable | version_delta=0, gross=1000000 | ✅ PASS | [proof-g6-01-calculate-pure-read.md](./proof-g6-01-calculate-pure-read.md) |
| G6-02+03 | rebuild() restores cache from facts; idempotent | disbursed=300k restored; version=2 after 2 rebuilds | rebuilt=300000, version=2 | ✅ PASS | [proof-g6-02-03-rebuild-idempotent.md](./proof-g6-02-03-rebuild-idempotent.md) |
| G7-01 | Cross-tenant bill not visible | 0 rows returned | rows=0 | ✅ PASS | [proof-g7-01-cross-tenant-rls.md](./proof-g7-01-cross-tenant-rls.md) |
| G7-02 | F2 direct access blocked | Privilege or guard blocks direct F2 mutation | privilege_blocked=true | ✅ PASS | [proof-g7-02-privilege-boundary.md](./proof-g7-02-privilege-boundary.md) |
| G7-03 | F2 contract returns NULL for wrong tenant | NULL | result=null | ✅ PASS | [proof-g7-03-f2-contract-tenant-isolation.md](./proof-g7-03-f2-contract-tenant-isolation.md) |
| F5-X | F5 reconciliation formula pre-validation | gross(800000) ≠ F1_AP(500000) | gross=800000, f1_ap=-500000 | ✅ PASS | [proof-f5-cross-check.md](./proof-f5-cross-check.md) |

## Verdict

```
✅ G1-01      Lock key hash identity
✅ G1-02      Resource type namespace isolation
✅ G1-03      Tenant isolation in lock keys
✅ G2-01      Validation failure → zero mutation
✅ G2-02      F1 rejection → zero F4 orphans
✅ G2-03      Successful disbursement — 4 mutations atomic
✅ G3-01      Retry returns canonical allocation ID
✅ G3-02      Different attempt_id → independent disbursements
✅ G4-01      Advisory lock protects outflow ceiling (I-AP-21)
✅ G4-02      Bill row lock protects bill ceiling (I-AP-2)
✅ G5-01      PREPAYMENT_RECORDED append-only + F1 GL
✅ G5-02      PREPAYMENT_APPLIED append-only + three-value check
✅ G5-03      PREPAYMENT_REFUNDED append-only, unapplied=0
✅ G5-04      Full lifecycle three-value reconstruction
✅ G6-01      calculate() is pure read — zero side effects
✅ G6-02+03   rebuild() restores cache from facts; idempotent
✅ G7-01      Cross-tenant bill not visible
✅ G7-02      F2 direct access blocked
✅ G7-03      F2 contract returns NULL for wrong tenant
✅ F5-X       F5 reconciliation formula pre-validation

FINAL: 20/20 PASS
→ F4.1 Database & RLS: UNLOCKED
```
