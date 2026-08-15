# F3 Accounts Receivable & Invoicing — Pre-Coding Proof Index

> **🔒 Status: 7/7 PASS — 2026-08-16T04:52:44+07:00**
> This directory houses the cryptographic and runtime proof evidence that confirms the feasibility, safety, and correctness of F3's G1 (atomicity, nested calling, rollback, outbox emission, crash/retry idempotency) and G2 (advisory lock concurrency, deadlock prevention) architecture designs before production coding begins.
>
> All tests were executed against the frozen F1/F2 database schemas using Jest integration connection blocks.

---

## 🔬 Proof Evidence Inventory

| Proof ID | Focus | Description | Verification Target | Audit Link |
|---|---|---|---|---|
| **G1-01** | Nested PL/pgSQL Calling | Verifies that F3's wrapper RPC can invoke F1's trusted posting primitive nested without transaction control errors. | Compile & Execute | [`proof-g1-nested-call.md`](proof-g1-nested-call.md) |
| **G1-02** | F1 Failure Rollback | Proves that if F1's validation fails (e.g., double-entry imbalance), the F3 transaction is rolled back, leaving the invoice as DRAFT. | Failure Injection (F1) | [`proof-g1-rollback-f1.md`](proof-g1-rollback-f1.md) |
| **G1-03** | F3 Failure Rollback | Proves that if F3's subledger insert fails after F1 has succeeded, the entire transaction is rolled back, leaving F1 clean (no orphan postings). | Failure Injection (F3) | [`proof-g1-rollback-f3.md`](proof-g1-rollback-f3.md) |
| **G1-04** | Crash/Retry Idempotency | Simulates a lost response, retrying finalization, and proving only 1 F1 transaction and 1 F3 subledger entry are created. | Idempotent Retry | [`proof-g1-idempotency.md`](proof-g1-idempotency.md) |
| **G1-05** | Outbox Event Atomicity | Verifies that F1's `posted.v2` outbox event is inserted atomically inside the wrapper transaction block (never emitted on rollback). | Outbox Behavior | [`proof-g1-outbox.md`](proof-g1-outbox.md) |
| **G2-01** | Advisory Lock Concurrency | Proves that tenant-scoped transaction advisory locks block and serialize race allocations, preventing over-allocating cash. | Concurrent Race | [`proof-g2-advisory-lock.md`](proof-g2-advisory-lock.md) |
| **G2-02** | Boundary Rights | Confirms that triggers block direct modifications on logs and that F1/F2 schemas and migrations remain completely unchanged. | Privilege Boundary | [`proof-g2-boundary.md`](proof-g2-boundary.md) |

---

## 📊 Summary Verdict

```
═══════════════════════════════════════════════════════════════════════
  F3 RUNTIME ARCHITECTURE PROOF RESULTS
═══════════════════════════════════════════════════════════════════════

G1 Accrual Atomicity
  ├── G1-01 Nested calling compile/execution  ✅ PASS
  ├── G1-02 Rollback on F1 failure            ✅ PASS (double-entry imbalance)
  ├── G1-03 Rollback on F3 failure            ✅ PASS (F1 reverted cleanly)
  ├── G1-04 Nested crash/retry idempotency    ✅ PASS (status-bypass fixed)
  └── G1-05 Outbox event atomicity            ✅ PASS (posted.v2 committed)

G2 Payment Allocation Concurrency
  ├── G2-01 Advisory-lock serialization      ✅ PASS (700+500 blocked/aborted)
  └── G2-02 Privilege boundary & trigger      ✅ PASS (immutable F3 logs)

CLEANUP & INTEGRITY
  ├── Temporary tables dropped               ✅ PASS
  ├── F1 frozen schema unchanged             ✅ PASS
  └── F2 frozen schema unchanged             ✅ PASS

FINAL STATUS: 🎉 7 / 7 TARGETS PASS — READY FOR ARCHITECT APPROVED STATUS
═══════════════════════════════════════════════════════════════════════
```
