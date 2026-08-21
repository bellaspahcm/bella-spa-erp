# Bella Runtime Week 2 Status Checkpoint

**Date:** 2026-08-19  
**Checkpoint:** Security Gate Execution Pending  
**Status:** Design Complete, Implementation Blocked  

---

## Current State

```
Runtime v1.1 Architecture      🟢 APPROVED
PostgreSQL RPC Decision        🟢 APPROVED
Transaction Model              🟢 APPROVED
Tenant Identity Model          🟢 APPROVED
Idempotency Model              🟢 APPROVED
Async Boundary Model           🟢 APPROVED

Security Gate SG-RT-01→06      🟡 EXECUTE NOW
Migration 04 v1.1              🔒 BLOCKED (pending gate)
Week 2 Implementation          🔒 BLOCKED (pending gate)
```

---

## Architecture Decisions Finalized

### Decision: Option A — PostgreSQL RPC

**Approved Components:**

1. **Transaction Boundary (TB-0):**
   ```
   PostgreSQL transaction executed through narrowly scoped RPC
   is the authoritative atomic persistence boundary for submitIntent()
   ```

2. **Four Invariants (TB-1 to TB-4):**
   - **TB-1 (Atomicity):** Outbox + Idempotency + Audit commit/rollback together
   - **TB-2 (Idempotency Authority):** PostgreSQL UNIQUE constraint is authority
   - **TB-3 (Business Boundary):** RPC contains persistence mechanics ONLY
   - **TB-4 (Async Boundary):** RPC commit → ACCEPTED → processOutboxOnce() → Finance OS

3. **Security Model:**
   - Tenant derived from `public.get_auth_tenant_id()` (no client-provided tenant)
   - Actor derived from `auth.uid()` (no client-provided actor)
   - Explicit validation (not reliant on RLS alone)
   - Defense-in-depth (RPC validation + RLS policies)

4. **Transaction Semantics:**
   - Statement-level atomicity (no manual BEGIN/COMMIT)
   - Exception → automatic rollback
   - Idempotency handles timeout retry

---

## Security Corrections Applied (v1.1)

### 🔴 P0 BLOCKER 1: Tenant Spoofing Prevention

**Before (v1.0 - REJECTED):**
```sql
CREATE FUNCTION submit_financial_intent(
    p_tenant_id UUID,  -- ❌ Client-controlled
    ...
)
```

**After (v1.1 - APPROVED):**
```sql
CREATE FUNCTION submit_financial_intent(
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
) AS $$
DECLARE
    v_tenant_id UUID;
    v_actor_id UUID;
BEGIN
    v_tenant_id := public.get_auth_tenant_id();  -- ✅ Derived from JWT
    v_actor_id := auth.uid();                     -- ✅ Derived from JWT
    ...
END;
$$
```

### 🔴 P0 BLOCKER 2: Transaction Model Clarification

**Before:** Misleading `BEGIN/COMMIT` model  
**After:** Statement-level transaction (automatic atomicity)

### 🟠 Timeout Semantics Clarification

**Before:** "Timeout → ROLLBACK guaranteed"  
**After:** "Timeout → indeterminate outcome, idempotency handles retry"

### 🟠 SECURITY DEFINER Clarification

**Before:** "RLS enforces isolation"  
**After:** "RPC explicitly validates tenant, RLS provides defense-in-depth"

---

## Security Gate Definition (SG-RT-01 to SG-RT-06)

### Gate Overview

| Gate ID | Purpose | Verification Method |
|---------|---------|---------------------|
| **SG-RT-01** | Caller Identity | Static analysis + 2 tests |
| **SG-RT-02** | SECURITY DEFINER Safety | Static analysis + 1 test + SQL verification |
| **SG-RT-03** | Atomicity | Static analysis + 2 tests |
| **SG-RT-04** | Idempotency | Schema verification + 2 tests |
| **SG-RT-05** | Async Boundary | Static analysis + 2 tests |
| **SG-RT-06** | Business Boundary | Static analysis + code review + 1 test |

### Critical Gates

**Most Critical (P0):**

1. **SG-RT-02 (Caller Identity):**
   ```
   Client → JWT → auth.uid() → get_auth_tenant_id() → RPC → writes
   
   NO path: Client → arbitrary tenant_id → RPC
   ```

2. **SG-RT-04 (Idempotency):**
   ```
   Request A ──┐
               ├── UNIQUE constraint → 1 outbox
   Request B ──┘
   
   NOT: Request A → app check
        Request B → app check
               ↓
             race → 2 outboxes ❌
   ```

3. **SG-RT-05 (Async Boundary):**
   ```
   submitIntent() → RPC → COMMIT → ACCEPTED
       ↓
   outbox.status = PENDING
   FinanceOS.emissionCount = 0
       ↓
   processOutboxOnce() manually called
       ↓
   outbox.status = PUBLISHED
   FinanceOS.emissionCount = 1
   ```

### Gate Exit Criteria

**ALL 6 GATES MUST PASS:**
```
✅ SG-RT-01: 6/6 static checks + 2/2 tests PASS
✅ SG-RT-02: 7/7 static checks + 1/1 test + SQL verification PASS
✅ SG-RT-03: 6/6 static checks + 2/2 tests PASS
✅ SG-RT-04: Schema verified + 2/2 tests PASS
✅ SG-RT-05: 7/7 static checks + 2/2 tests PASS
✅ SG-RT-06: 9/9 static checks + code review PASS + 1/1 test PASS

Total Verifications: 41 static checks + 10 tests + 1 code review + 1 SQL verification
```

**IF ANY GATE FAILS:**
```
Migration 04 v1.1 → BLOCKED
Fix issues → Re-run gate
```

---

## Implementation Sequence (After Gate PASS)

```
Security Gate PASS (6/6)
    ↓
1. FREEZE Migration 04 v1.1
    ↓
2. Apply Migration 04 to database
    ↓
3. Verify RPC exists (SQL query)
    ↓
4. Run TB-1 Atomicity Test
    ↓
5. Run TB-2 Idempotency Test
    ↓
6. Run TB-4 Async Boundary Test
    ↓
7. Implement submitIntent() (TypeScript)
    ↓
8. Implement processOutboxOnce() (TypeScript)
    ↓
9. Run W2.2 (Happy Path E2E)
    ↓
10. Run W2.3 (Idempotency E2E)
    ↓
11. Full Regression (Phase 3A: 79/79, Phase 3B: 97/97, Gate 0: 5/5, Week 2: 3/3)
    ↓
12. Week 2 Gate (Binary PASS/FAIL)
    ↓
13. Week 2 Evidence Document
    ↓
Week 2 COMPLETE
```

---

## Three Enforcement Principles

### 1. No Code Before Gate

**Current Status:** ✅ COMPLIANT
```
No implementation performed.
No Migration 04 applied.
No TypeScript business code written.
```

**Rule:**
- Gate evaluates artifact under review
- If changes needed → fix → re-run gate (do NOT fix during gate execution)

### 2. SG-RT-02 and SG-RT-04 Are Most Critical

**SG-RT-02 (Caller Identity):**
```
MUST prove:
  Client → JWT → derived context → RPC
  
MUST prevent:
  Client → arbitrary tenant_id → RPC
```

**SG-RT-04 (Idempotency):**
```
MUST prove:
  Concurrent requests → Database UNIQUE constraint → 1 outbox
  
MUST prevent:
  Concurrent requests → Application check → Race → 2 outboxes
```

### 3. SG-RT-05 Proves Async Boundary by Behavior

**Behavioral Proof Required:**
```
submitIntent() executed
    ↓
outbox.status = PENDING
FinanceOS.emissionCount = 0
    ↓
processOutboxOnce() NOT called automatically
    ↓
outbox.status STILL = PENDING
    ↓
processOutboxOnce() called manually
    ↓
outbox.status = PUBLISHED
FinanceOS.emissionCount = 1
```

**Not sufficient:** Code inspection only  
**Required:** Behavioral test proving separation

---

## SG-RT-06 Clarification

### Business vs. Structural Validation

**Runtime Validates (Structural):**
- Required fields (NOT NULL)
- Type correctness (string, number, object)
- Parameter existence

**Runtime Does NOT Validate (Business):**
- Account codes
- Customer existence
- Amount limits
- Currency codes
- Debit/Credit rules
- Accounting policy

**Example:**
```
amount = "1000"        → Runtime REJECT ❌ (wrong type)
amount = -1000         → Runtime ACCEPT ✅ (valid number, Finance OS decides)

currency = null        → Runtime REJECT ❌ (required field)
currency = "INVALID"   → Runtime ACCEPT ✅ (valid string, Finance OS validates)

payload = "string"     → Runtime REJECT ❌ (must be JSONB object)
payload = { invalid_business_ref } → Runtime ACCEPT ✅ (valid JSONB, Finance OS validates)
```

**Test SG-RT-06.1 Proves:**
- RPC rejects structural invalidity
- RPC accepts business invalidity (Finance OS's responsibility)
- TB-3 (Business Boundary) preserved

---

## Application Layer Responsibility

**FinancialIntent Structural Validation (Required):**
```typescript
interface FinancialIntent {
  type: string;                    // ✅ App validates: typeof = string
  correlationId: string;           // ✅ App validates: typeof = string
  amount: number;                  // ✅ App validates: typeof = number
  currency: string;                // ✅ App validates: typeof = string
  entityReference: {               // ✅ App validates: shape
    type: string;
    id: string;
  };
  payload: Record<string, any>;    // ✅ App validates: is object
}
```

**Application Layer Contract:**
```
FinancialIntent (TypeScript type)
    ↓
submitIntent() validates structure
    ↓
RPC persists (no business validation)
    ↓
ACCEPTED
    ↓
processOutboxOnce() publishes
    ↓
Finance OS validates business semantics
```

---

## Documents Created

### Research & Evidence

1. **`BELLA_RUNTIME_TRANSACTION_BOUNDARY_EVIDENCE.md`**
   - Stack investigation
   - Transaction support analysis (Supabase JS, RPC, pg.Pool)
   - Options assessment (A, B, C, D)
   - Decision: Option A recommended

### Architecture Decisions

2. **`BELLA_RUNTIME_TRANSACTION_ARCHITECTURE_DECISION_V1.md`**
   - Decision v1.0
   - Status: REJECTED (security issues)

3. **`BELLA_RUNTIME_TRANSACTION_ARCHITECTURE_DECISION_V1_1_CORRECTED.md`**
   - Decision v1.1 (security corrections applied)
   - Status: APPROVED IN PRINCIPLE
   - 4 P0 blockers fixed

### Security Gate

4. **`BELLA_RUNTIME_SECURITY_GATE_SG_RT_01.md`**
   - 6 security gates (SG-RT-01 to SG-RT-06)
   - 41 static checks
   - 10 tests
   - 1 code review
   - 1 SQL verification
   - Status: PENDING EXECUTION

### Status Checkpoint

5. **`BELLA_RUNTIME_WEEK_2_STATUS_CHECKPOINT.md`** (this document)
   - Current state summary
   - Architecture decisions finalized
   - Security gate overview
   - Implementation sequence
   - Enforcement principles

---

## Key Architectural Insights

### What Week 2 Proves

**NOT "Build and see if it works"**

**BUT "Implement a proven transaction boundary":**

1. **Atomicity Proven:** TB-1 test (rollback on failure → 0/0/0)
2. **Idempotency Proven:** TB-2 test (concurrent requests → 1 outbox)
3. **Security Proven:** SG-RT-01 to SG-RT-06 (no tenant spoofing)
4. **Async Boundary Proven:** TB-4 test (submission ≠ processing)

### Why This Matters

**Before Security Gate:**
- Transaction boundary theory
- Security assumptions
- Atomicity claims

**After Security Gate:**
- Transaction boundary proven
- Security verified
- Atomicity tested

**Week 2 Implementation:**
- NOT experimental ("try and see")
- Implementing proven mechanism
- High confidence in correctness

---

## Verdict

### Approvals

```
🟢 Runtime v1.1 Architecture:       APPROVED
🟢 PostgreSQL RPC Decision:         APPROVED
🟢 Transaction Model:                APPROVED
🟢 Tenant Identity Model:            APPROVED
🟢 Actor Identity Model:             APPROVED
🟢 Idempotency Model:                APPROVED
🟢 Async Boundary Model:             APPROVED
🟢 Business Boundary Model:          APPROVED
🟢 Security Corrections (v1.1):      APPLIED
🟢 Security Gate Definition:         COMPLETE
🟢 Implementation Sequence:          DEFINED
```

### Pending

```
🟡 Security Gate Execution:          EXECUTE NOW
```

### Blocked

```
🔒 Migration 04 v1.1:                BLOCKED (pending gate PASS)
🔒 Week 2 Implementation:            BLOCKED (pending gate PASS)
```

---

## Next Action

**SINGLE NEXT STEP:**
```
Execute Security Gate SG-RT-01 → SG-RT-06
    ↓
Static Analysis (41 checks)
    ↓
Run Tests (10 tests)
    ↓
Code Review (SG-RT-06)
    ↓
SQL Verification (SG-RT-02)
    ↓
IF ALL PASS:
    Migration 04 v1.1 → FREEZE → APPLY
    Week 2 → UNBLOCKED
    
IF ANY FAIL:
    BLOCKED → Fix → Re-run gate
```

**Do NOT:**
- ❌ Implement code during gate execution
- ❌ Apply Migration 04 before gate PASS
- ❌ "Fix" issues found during gate (document → re-run)
- ❌ Skip any gate verification

**Do:**
- ✅ Execute all 6 gates completely
- ✅ Document all results
- ✅ Binary decision: PASS or FAIL
- ✅ If FAIL: Fix → Re-run (do not proceed)

---

## Success Criteria

**Week 2 is NOT "done" when code runs.**

**Week 2 is "done" when:**
```
✅ Security Gate: 6/6 PASS
✅ Migration 04: Applied
✅ TB-1 Test: Atomicity proven (0/0/0 on rollback)
✅ TB-2 Test: Idempotency proven (1 outbox, concurrent)
✅ TB-4 Test: Async boundary proven (PENDING until processOutboxOnce)
✅ W2.2 Test: Happy path E2E proven
✅ W2.3 Test: Idempotency E2E proven
✅ Regression: Phase 3A (79/79) + Phase 3B (97/97) + Gate 0 (5/5) + Week 2 (3/3) = 184/184
✅ Evidence: Week 2 documentation complete
✅ Week 2 Gate: Binary PASS
```

---

**Status:** Design complete, awaiting security verification  
**Blocker:** Security Gate execution  
**Confidence:** High (proven architecture, security-first design)  
**Risk:** Low (no code written until gate PASS)

---

**Checkpoint Status:** 🟡 READY FOR SECURITY GATE EXECUTION  
**Next Milestone:** Security Gate PASS → Migration 04 FREEZE → Week 2 UNBLOCKED
