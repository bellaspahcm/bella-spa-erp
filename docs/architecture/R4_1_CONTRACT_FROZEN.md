# R4.1 — Approval Contract FROZEN

**Date:** 2026-08-20 19:15  
**Status:** 🟢 FROZEN  
**Version:** 1.0.0

---

## 🔒 FREEZE DECLARATION

The R4.1 Approval Contract Specification is hereby **FROZEN** and ready for implementation.

---

## 📜 FROZEN ELEMENTS

### 1. Contract Schema

**Core fields:**
- Identity: `approval_id`, `migration_id`, `migration_hash`
- Authorization: `requester_id`, `approver_id`, `approver_role`, `approved_at`
- Scope: `target_environment`, `target_schema`, `expires_at`
- State: `status`, `used_at`, `used_by`
- Integrity: `approval_hash`

**Database constraint:**
```sql
CONSTRAINT no_self_approval CHECK (requester_id <> approver_id)
```

---

### 2. Eight Invariants

| ID | Invariant | Enforcement |
|----|-----------|-------------|
| I0 | No Self-Approval | requester_id ≠ approver_id |
| I1 | Migration Binding | approved_hash == executing_hash |
| I2 | Scope Binding | All scope components match |
| I3 | Single-Use | Atomic status update |
| I4 | Time Validity | Within validity window |
| I5 | Environment Match | Approved env == execution env |
| I6 | Approver Authority | Role authorized for environment |
| I7 | Integrity | Hash verification |

---

### 3. Two-Phase Workflow

```
Developer → CREATE REQUEST (status='requested')
         ↓
Authorized Approver → APPROVE (status='approved')
         ↓
verify_approval() → CONSUME (status='used')
```

**NOT ALLOWED:**
```sql
-- ❌ Direct INSERT with status='approved'
INSERT INTO bella_migration_approval (status, ...) VALUES ('approved', ...);
```

---

### 4. Design Decisions

**D1: Signature Requirement**
- Decision: Hash-only for R4.1 MVP
- Rationale: Sufficient for tamper detection
- Future: Signature in R4.x/R5

**D2: Approval Creation**
- Decision: Two-phase (REQUEST → APPROVE)
- Enforcement: `requester_id ≠ approver_id`
- Rationale: Prevents self-approval bypass

**D3: Emergency Override**
- Decision: Dedicated emergency authorization path
- NOT bypass, but stricter auth with:
  - Dual control
  - emergency_reason REQUIRED
  - Short validity window
  - Mandatory postflight review
- Rationale: Emergency ≠ bypass

---

### 5. Negative Test Matrix

**12 test cases:**
1. No approval → BLOCK
2. Self-approval → BLOCK
3. Hash mismatch → BLOCK
4. Wrong environment → BLOCK
5. Wrong schema → BLOCK
6. Expired → BLOCK
7. Not yet valid → BLOCK
8. Already used → BLOCK
9. Unauthorized approver → BLOCK
10. Tampered → BLOCK
11. Revoked → BLOCK
12. Valid approval → PASS

---

## 🚫 FROZEN CONSTRAINTS

### Cannot Be Changed Without Unfreeze

1. Contract schema fields
2. Eight invariants (I0-I7)
3. Two-phase workflow requirement
4. `no_self_approval` constraint
5. Negative test matrix

### Can Be Extended

1. Additional fields (backward compatible)
2. Additional invariants (additive only)
3. Additional test cases
4. Emergency authorization details (in separate spec)

---

## ✅ IMPLEMENTATION CHECKLIST

### R4.2 Can Now Begin

- [ ] Create `scripts/bdgf/r4-verify-approval.mjs`
- [ ] Implement all 8 invariant checks
- [ ] Create negative test suite (12 tests)
- [ ] Create database migration for approval table
- [ ] Document test results

### Implementation Constraints

1. **MUST check I0 first:** `requester_id ≠ approver_id`
2. **MUST verify hash:** `approved_hash == executing_hash`
3. **MUST be atomic:** Status update uses `WHERE status = 'approved'`
4. **MUST generate evidence:** Every BLOCK includes reason + evidence
5. **MUST test all 12 cases:** 11 negative + 1 positive

---

## 📊 SUCCESS CRITERIA

### R4.1 Complete ✅

- [x] Contract schema frozen
- [x] 8 invariants specified
- [x] Gate logic defined
- [x] 12 negative tests defined
- [x] Database schema specified
- [x] Design decisions locked

### R4.2 Entry Condition MET ✅

Contract frozen → Implementation can begin

---

## 🔐 SECURITY GUARANTEES (FROM CONTRACT)

### G1: No Self-Approval

Developer cannot approve their own migration (I0 + database constraint).

### G2: No Approval Forgery

Approval integrity protected by hash (I7).

### G3: No Approval Replay

Each approval single-use only (I3, atomic status update).

### G4: No Approval Transfer

Approval binds to exact migration content (I1).

### G5: No Scope Escalation

Approval binds to environment + schema + time (I2, I4, I5).

### G6: No Unauthorized Approval

Approver authority verified (I6).

---

## 📝 NEXT PHASE

**R4.2 — Implement verify_approval()**

**Tasks:**
1. Create approval verification function
2. Implement all 8 invariant checks
3. Write 12 negative tests
4. Create database table
5. Document test evidence

**After R4.2:**
- R4.3 — Migration integrity gate
- R4.4 — Preflight safety gate
- R4.5 — Execution authorization gate
- R4.6 — Controlled execution
- R4.7 — Postflight + evidence gate

---

**CONTRACT STATUS:** 🟢 FROZEN v1.0.0

**Principle:** "Contract before code, tests before implementation"

This contract defines WHAT the approval system must enforce. R4.2 will define HOW to implement it. Tests will prove it works.
