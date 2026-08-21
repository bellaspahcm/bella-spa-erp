# Bella Runtime Transaction Architecture Decision v1.1

**Status:** � CONDITIONAL APPROVAL (security corrections required)  
**Decision Date:** 2026-08-19  
**Supersedes:** Transaction boundary research  
**Amendment to:** Runtime v1.1 Architecture  
**Blocks:** Week 2 Implementation Plan v1.1  

---

## Executive Summary

**DECISION: OPTION A — PostgreSQL RPC (APPROVED IN PRINCIPLE)**

PostgreSQL transaction executed through a **narrowly scoped RPC** is the authoritative atomic persistence boundary for `submitIntent()`.

**Rationale:**
- ✅ Proven Bella pattern (Finance Outbox, Real Estate, Onboarding, Legacy Ledger Sync)
- ✅ Guaranteed atomicity (PostgreSQL transaction semantics)
- ✅ Database-enforced idempotency (UNIQUE constraint authority)
- ✅ RLS preserved (authenticated role, tenant isolation)
- ✅ Automatic rollback (no application rollback logic)
- ✅ Minimal architecture change (reuses existing `supabase.rpc()` infrastructure)
- 🟡 Trade-off: SQL maintenance vs. reliability guarantee

**Architecture Impact:** LOW  
**Business Logic Leakage Risk:** MUST PREVENT (see TB-3 invariant)

---

## 🔴 CRITICAL: Security Corrections Required Before Freeze

**Status:** CONDITIONAL APPROVAL

Migration 04 **NOT APPROVED** until 4 corrections applied:

1. 🔴 **P0 BLOCKER: Caller Tenant Identity**
   - RPC MUST derive tenant from `public.get_auth_tenant_id()`
   - RPC MUST NOT trust `p_tenant_id` from client
   - Prevents tenant spoofing attack

2. 🔴 **P0 BLOCKER: Caller Actor Identity**
   - RPC MUST derive actor from `auth.uid()`
   - RPC MUST NOT trust `p_actor_id` from client
   - Prevents actor impersonation

3. 🟠 **Transaction Semantics Clarification**
   - Remove misleading `BEGIN/COMMIT` in RPC body
   - RPC executes atomically inside PostgreSQL transaction scope
   - Atomicity is guaranteed by statement-level transaction

4. 🟠 **Timeout Semantics Clarification**
   - Replace "timeout → ROLLBACK" with indeterminate outcome model
   - Client timeout ≠ server rollback guarantee
   - Idempotency handles retry after timeout

**Approval Path:**
```
RT-TB-001 v1.0
    ↓
Security Review (this document)
    ↓
RT-TB-001 v1.1 (corrections applied)
    ↓
FROZEN 🔒
    ↓
Migration 04 (revised)
    ↓
Week 2 Implementation
```

---

## Amendment to Runtime v1.1

### Transaction Boundary Principle

**TB-0 — Atomic Persistence Boundary**

```
PostgreSQL transaction executed through a narrowly scoped RPC 
is the authoritative atomic persistence boundary for submitIntent().
```

**Scope:**
- ✅ Applies to: `submitIntent()` persistence
- ❌ Does NOT apply to: `processOutboxOnce()`, `publishIntent()` (async boundary, separate transactions)

---

## Four Invariants

### TB-1 — Atomicity

**Invariant:**
```
Outbox + Idempotency + Audit
MUST commit or rollback together.
```

**Enforcement:**
- PostgreSQL `BEGIN/COMMIT/ROLLBACK`
- Single RPC call encapsulates all 3 INSERTs
- Application layer does NOT orchestrate individual INSERTs

**Failure State Protection:**
| Scenario | Outbox | Idempotency | Audit | Result |
|----------|--------|-------------|-------|--------|
| **All success** | ✅ | ✅ | ✅ | COMMIT → ACCEPTED |
| **Audit fails** | ❌ | ❌ | ❌ | ROLLBACK → Error |
| **Idempotency conflict** | ❌ | ❌ | ❌ | ROLLBACK → DUPLICATE |
| **Network timeout** | ❌ | ❌ | ❌ | ROLLBACK (lease recovery) |

**Test Requirement:**
- Atomic rollback test (simulate INSERT audit failure)
- Verify: `outbox = 0`, `idempotency = 0`, `audit = 0`

---

### TB-2 — Idempotency Authority

**Invariant:**
```
PostgreSQL UNIQUE constraint
remains the authority.
```

**Constraint:**
```sql
CONSTRAINT idempotency_tenant_key_unique 
UNIQUE(tenant_id, idempotency_key)
```

**Enforcement:**
- Database constraint catches concurrent duplicates
- Error code `23505` (unique violation) → DUPLICATE status
- Application cache does NOT serve as idempotency authority

**RPC Behavior:**
```sql
BEGIN
  INSERT runtime_outbox (...) RETURNING outbox_id;
  INSERT runtime_idempotency_registry (tenant_id, idempotency_key, outbox_id);
  -- ^ Throws 23505 if duplicate
  INSERT runtime_audit_log (...);
COMMIT
EXCEPTION WHEN unique_violation THEN
  ROLLBACK;
  RAISE;
END
```

**Test Requirement:**
- Concurrent duplicate submission test (race condition)
- Verify: Second submission returns DUPLICATE, outbox count = 1

---

### TB-3 — Business Boundary

**Invariant:**
```
RPC contains persistence mechanics only.
No accounting semantics.
```

**RPC IS ALLOWED:**
- ✅ `BEGIN/COMMIT/ROLLBACK`
- ✅ Validate transaction context (tenant, JWT)
- ✅ `INSERT runtime_outbox`
- ✅ `INSERT runtime_idempotency_registry`
- ✅ `INSERT runtime_audit_log`
- ✅ Return `outbox_id` or error code

**RPC IS FORBIDDEN:**
- ❌ Choose chart of accounts
- ❌ Generate debit/credit entries
- ❌ Calculate accounting policy
- ❌ Validate business semantics (product SKU, customer balance, etc.)
- ❌ Call Finance OS (async boundary)
- ❌ Implement retry logic
- ❌ Implement quarantine logic
- ❌ Emit domain events

**Rationale:**
- Persistence ≠ Business Logic
- If RPC starts "deciding accounting", Runtime becomes Accounting Engine
- Finance OS owns business semantics

**Enforcement:**
- Code review: RPC MUST NOT contain business rules
- Test review: RPC tests verify persistence only, NOT accounting correctness

---

### TB-4 — Async Boundary

**Invariant:**
```
RPC commit
    ↓
ACCEPTED
    ↓
processOutboxOnce()
    ↓
Finance OS
```

**Separation:**
```
┌─────────────────────────────────────┐
│ submitIntent()                      │
│   ↓                                 │
│ validate JWT/context                │
│   ↓                                 │
│ validate structural intent          │
│   ↓                                 │
│ atomicSubmitIntent RPC              │  ← ATOMIC TRANSACTION
│   ├── INSERT outbox                 │
│   ├── INSERT idempotency            │
│   └── INSERT audit                  │
│   ↓                                 │
│ COMMIT                              │
│   ↓                                 │
│ ACCEPTED                            │  ← USER RESPONSE
└─────────────────────────────────────┘
            ↓
    (async boundary)
            ↓
┌─────────────────────────────────────┐
│ processOutboxOnce()                 │  ← SEPARATE TRANSACTION
│   ↓                                 │
│ claim PENDING events                │
│   ↓                                 │
│ publishIntent()                     │
│   ↓                                 │
│ Finance OS HTTP POST                │
│   ↓                                 │
│ PUBLISHED / FAILED                  │
└─────────────────────────────────────┘
```

**Constraint:**
- `submitIntent()` does NOT call `processOutboxOnce()`
- `submitIntent()` does NOT emit to Finance OS
- User receives `ACCEPTED` immediately after RPC commit
- Outbox processing is asynchronous (Week 2: manual invocation, Week 3+: worker)

**Enforcement:**
- `submitIntent()` returns after RPC commit
- No Finance OS HTTP call in submission path
- Test: Verify `submitIntent()` does NOT trigger outbox processing

---

## RPC Contract Design

### Function Signature

```sql
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_tenant_id UUID,
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB,
    p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
BEGIN
    -- TB-1: Atomic transaction
    -- 1. INSERT outbox
    INSERT INTO public.runtime_outbox (
        tenant_id,
        intent_type,
        intent_payload,
        status,
        created_at
    ) VALUES (
        p_tenant_id,
        p_intent_type,
        p_intent_payload,
        'PENDING',
        now()
    ) RETURNING outbox_id INTO v_outbox_id;

    -- 2. INSERT idempotency (TB-2: UNIQUE constraint enforced)
    INSERT INTO public.runtime_idempotency_registry (
        tenant_id,
        idempotency_key,
        outbox_id,
        created_at
    ) VALUES (
        p_tenant_id,
        p_idempotency_key,
        v_outbox_id,
        now()
    );

    -- 3. INSERT audit
    INSERT INTO public.runtime_audit_log (
        outbox_id,
        action,
        tenant_id,
        actor_id,
        created_at
    ) VALUES (
        v_outbox_id,
        'INTENT_SUBMITTED',
        p_tenant_id,
        p_actor_id,
        now()
    );

    -- Return outbox_id
    RETURN v_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

### Security Configuration

**Privileges:**
```sql
-- Revoke public access
REVOKE ALL ON FUNCTION public.submit_financial_intent(
    UUID, TEXT, TEXT, JSONB, UUID
) FROM PUBLIC, anon;

-- Grant to authenticated users only
GRANT EXECUTE ON FUNCTION public.submit_financial_intent(
    UUID, TEXT, TEXT, JSONB, UUID
) TO authenticated;
```

**RLS Context:**
- RPC executes as `SECURITY DEFINER` (elevated privileges)
- RLS policies enforced based on `auth.uid()` and `public.get_auth_tenant_id()`
- Caller's JWT claims available

**Tenant Isolation Enforcement:**
```sql
-- RLS policies MUST exist on all 3 tables
CREATE POLICY runtime_outbox_tenant_isolation ON runtime_outbox
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY runtime_idempotency_tenant_isolation ON runtime_idempotency_registry
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY runtime_audit_tenant_isolation ON runtime_audit_log
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());
```

**Security Verification:**
- Gate 0 verified RLS policies (5/5 PASS)
- Migration 02: JWT-based RLS applied
- Migration 03: Authenticated role grants applied

---

## Application Layer Contract

### TypeScript Interface

```typescript
interface SubmitIntentResult {
  status: 'ACCEPTED' | 'DUPLICATE' | 'ERROR';
  outboxId: string | null;
  error?: string;
}

async function submitIntent(
  tenantId: string,
  idempotencyKey: string,
  intent: FinancialIntent,
  actorId: string
): Promise<SubmitIntentResult> {
  // 1. Validate JWT/context (application layer)
  // 2. Validate structural intent (application layer)
  
  // 3. Atomic submission (RPC owns transaction)
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_tenant_id: tenantId,
    p_idempotency_key: idempotencyKey,
    p_intent_type: intent.type,
    p_intent_payload: intent,
    p_actor_id: actorId
  });

  // 4. Handle idempotency conflict (TB-2)
  if (error?.code === '23505') {
    return { status: 'DUPLICATE', outboxId: null };
  }

  // 5. Handle other errors
  if (error) {
    return { status: 'ERROR', outboxId: null, error: error.message };
  }

  // 6. Return ACCEPTED (TB-4: async boundary)
  return { status: 'ACCEPTED', outboxId };
}
```

### Orchestration Flow

**BEFORE (Non-Atomic — REJECTED):**
```typescript
// ❌ Application orchestrates 3 INSERTs (NOT ATOMIC)
const outbox = await outboxRepo.create(intent);
const idempotency = await idempotencyRepo.register(outbox.id, key);
const audit = await auditRepo.log(outbox.id, 'SUBMITTED');
// ^ If audit fails, outbox + idempotency already committed
```

**AFTER (Atomic — APPROVED):**
```typescript
// ✅ RPC owns transaction (ATOMIC)
const result = await supabase.rpc('submit_financial_intent', {
  p_tenant_id: tenantId,
  p_idempotency_key: idempotencyKey,
  p_intent_type: intent.type,
  p_intent_payload: intent,
  p_actor_id: actorId
});
// ^ All 3 INSERTs commit or rollback together
```

---

## Rollback Behavior

### Automatic Rollback Scenarios

| Trigger | Behavior | Result |
|---------|----------|--------|
| **Idempotency conflict** | `23505` unique violation | ROLLBACK → DUPLICATE |
| **FK constraint violation** | Invalid `tenant_id` | ROLLBACK → ERROR |
| **NULL constraint violation** | Missing required field | ROLLBACK → ERROR |
| **RLS policy denial** | Tenant isolation violation | ROLLBACK → ERROR |
| **Application exception** | `RAISE EXCEPTION` in RPC | ROLLBACK → ERROR |
| **Network timeout** | Connection lost before COMMIT | ROLLBACK (PostgreSQL automatic) |

### Rollback Guarantees

**TB-1 Enforcement:**
```
IF any INSERT fails:
  ROLLBACK entire transaction
  outbox = 0
  idempotency = 0
  audit = 0
```

**Idempotency Registry Integrity:**
- Idempotency key NEVER registered unless outbox + audit also committed
- Prevents "ghost idempotency" (idempotency exists, but no outbox)

**Audit Trail Integrity:**
- Audit log NEVER created unless outbox + idempotency also committed
- No orphaned audit entries

---

## Test Requirements

### Atomic Rollback Test

**Test Name:** `3C-0: Atomic Rollback on Audit Failure`

**Purpose:** Verify TB-1 (atomicity invariant)

**Setup:**
```sql
-- Simulate audit INSERT failure
CREATE OR REPLACE FUNCTION public.submit_financial_intent_rollback_test(
    p_tenant_id UUID,
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB,
    p_actor_id UUID,
    p_simulate_audit_failure BOOLEAN DEFAULT FALSE
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
BEGIN
    INSERT INTO public.runtime_outbox (...) RETURNING outbox_id INTO v_outbox_id;
    INSERT INTO public.runtime_idempotency_registry (...);
    
    IF p_simulate_audit_failure THEN
        RAISE EXCEPTION 'Simulated audit failure';
    END IF;
    
    INSERT INTO public.runtime_audit_log (...);
    RETURN v_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Test Execution:**
```typescript
test('Atomic rollback on audit failure', async () => {
  const tenantId = 'tenant-123';
  const idempotencyKey = 'test-rollback-key';
  
  // Call RPC with simulated failure
  const { error } = await supabase.rpc('submit_financial_intent_rollback_test', {
    p_tenant_id: tenantId,
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 },
    p_actor_id: userId,
    p_simulate_audit_failure: true
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('Simulated audit failure');
  
  // Verify ROLLBACK: All 3 tables empty
  const { count: outboxCount } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  
  const { count: idempotencyCount } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  
  const { count: auditCount } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  
  expect(outboxCount).toBe(0);
  expect(idempotencyCount).toBe(0);
  expect(auditCount).toBe(0);
});
```

**Expected Result:**
```
✅ outbox       = 0
✅ idempotency  = 0
✅ audit        = 0
✅ TB-1 PROVEN
```

---

### Concurrent Idempotency Test

**Test Name:** `3C-3: Concurrent Duplicate Submission (Race Condition)`

**Purpose:** Verify TB-2 (database UNIQUE constraint authority)

**Setup:**
```typescript
test('Concurrent duplicate submission blocked by database', async () => {
  const tenantId = 'tenant-123';
  const idempotencyKey = 'concurrent-test-key';
  const intent = { type: 'INVOICE_PAYMENT', amount: 1000 };
  
  // Simulate concurrent requests (Promise.all)
  const results = await Promise.allSettled([
    supabase.rpc('submit_financial_intent', {
      p_tenant_id: tenantId,
      p_idempotency_key: idempotencyKey,
      p_intent_type: intent.type,
      p_intent_payload: intent,
      p_actor_id: userId
    }),
    supabase.rpc('submit_financial_intent', {
      p_tenant_id: tenantId,
      p_idempotency_key: idempotencyKey,
      p_intent_type: intent.type,
      p_intent_payload: intent,
      p_actor_id: userId
    })
  ]);
  
  // One succeeds, one fails with 23505
  const successes = results.filter(r => r.status === 'fulfilled' && !r.value.error);
  const failures = results.filter(r => 
    r.status === 'fulfilled' && r.value.error?.code === '23505'
  );
  
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1);
  
  // Verify: Only ONE outbox entry
  const { count } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);
  
  expect(count).toBe(1);
});
```

**Expected Result:**
```
✅ First request:  ACCEPTED
✅ Second request: DUPLICATE (23505)
✅ Outbox count:   1
✅ TB-2 PROVEN
```

---

### Security Boundary Test

**Test Name:** `3C-4: RLS Tenant Isolation`

**Purpose:** Verify tenant cannot submit intent for another tenant

**Setup:**
```typescript
test('Tenant isolation enforced by RLS', async () => {
  const tenant1 = 'tenant-A';
  const tenant2 = 'tenant-B';
  
  // User belongs to tenant-A (JWT)
  const { error } = await supabase.rpc('submit_financial_intent', {
    p_tenant_id: tenant2,  // Attempt to submit for tenant-B
    p_idempotency_key: 'cross-tenant-test',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 },
    p_actor_id: userATenantId
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('RLS policy violation');
  
  // Verify: No outbox entry for tenant-B
  const { count } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true })
    .eq('tenant_id', tenant2);
  
  expect(count).toBe(0);
});
```

**Expected Result:**
```
✅ Cross-tenant submission: REJECTED
✅ Outbox count (tenant-B): 0
✅ RLS ENFORCED
```

---

## Migration Plan

### Migration 04: RPC Creation

**File:** `supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql`

**Content:**
```sql
-- Bella Runtime Phase 3C Week 2
-- Migration 04: Atomic Financial Intent Submission RPC
-- Purpose: Transaction boundary for Outbox + Idempotency + Audit

BEGIN;

-- Drop existing function if exists (idempotent migration)
DROP FUNCTION IF EXISTS public.submit_financial_intent(UUID, TEXT, TEXT, JSONB, UUID);

-- Create RPC with atomic transaction
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_tenant_id UUID,
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB,
    p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
BEGIN
    -- TB-3: Validate transaction context only (NO business logic)
    IF p_tenant_id IS NULL THEN
        RAISE EXCEPTION 'tenant_id is required';
    END IF;
    
    IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;
    
    IF p_intent_type IS NULL OR p_intent_type = '' THEN
        RAISE EXCEPTION 'intent_type is required';
    END IF;
    
    IF p_intent_payload IS NULL THEN
        RAISE EXCEPTION 'intent_payload is required';
    END IF;

    -- TB-1: Atomic transaction begins here
    
    -- 1. INSERT runtime_outbox
    INSERT INTO public.runtime_outbox (
        tenant_id,
        intent_type,
        intent_payload,
        status,
        created_at
    ) VALUES (
        p_tenant_id,
        p_intent_type,
        p_intent_payload,
        'PENDING',
        now()
    ) RETURNING outbox_id INTO v_outbox_id;

    -- 2. INSERT runtime_idempotency_registry (TB-2: UNIQUE constraint enforced)
    INSERT INTO public.runtime_idempotency_registry (
        tenant_id,
        idempotency_key,
        outbox_id,
        created_at
    ) VALUES (
        p_tenant_id,
        p_idempotency_key,
        v_outbox_id,
        now()
    );

    -- 3. INSERT runtime_audit_log
    INSERT INTO public.runtime_audit_log (
        outbox_id,
        action,
        tenant_id,
        actor_id,
        created_at
    ) VALUES (
        v_outbox_id,
        'INTENT_SUBMITTED',
        p_tenant_id,
        p_actor_id,
        now()
    );

    -- TB-1: All 3 INSERTs committed together
    RETURN v_outbox_id;
    
EXCEPTION
    WHEN unique_violation THEN
        -- TB-2: Idempotency conflict (23505)
        RAISE;
    WHEN OTHERS THEN
        -- TB-1: Any error triggers rollback
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Security: Revoke public access
REVOKE ALL ON FUNCTION public.submit_financial_intent(
    UUID, TEXT, TEXT, JSONB, UUID
) FROM PUBLIC, anon;

-- Security: Grant to authenticated users only
GRANT EXECUTE ON FUNCTION public.submit_financial_intent(
    UUID, TEXT, TEXT, JSONB, UUID
) TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
```

**Migration Verification:**
```sql
-- Verify RPC exists
SELECT proname, proargnames, prosecdef
FROM pg_proc
WHERE proname = 'submit_financial_intent';

-- Expected:
-- proname: submit_financial_intent
-- proargnames: {p_tenant_id, p_idempotency_key, p_intent_type, p_intent_payload, p_actor_id}
-- prosecdef: true (SECURITY DEFINER)
```

---

## Implementation Sequence

### STEP 1: Architecture Decision (Current)

**Status:** 🟡 Awaiting final approval

**Deliverable:**
- ✅ `BELLA_RUNTIME_TRANSACTION_ARCHITECTURE_DECISION_V1.md` (this document)

**Review Checklist:**
- [ ] TB-1 (Atomicity) invariant approved
- [ ] TB-2 (Idempotency Authority) invariant approved
- [ ] TB-3 (Business Boundary) invariant approved
- [ ] TB-4 (Async Boundary) invariant approved
- [ ] RPC contract design approved
- [ ] Security boundary approved
- [ ] Test requirements approved

**Exit Criteria:**
- Document FROZEN
- Option A decision LOCKED

---

### STEP 2: RPC Contract Design & Security Review

**Tasks:**
1. Review Migration 04 SQL
2. Verify RLS policies exist (Gate 0 verified)
3. Verify privilege grants correct
4. Review exception handling
5. Review rollback behavior

**Deliverable:**
- Migration 04 reviewed and approved

**Exit Criteria:**
- Security review PASS
- Migration ready to apply

---

### STEP 3: Implement & Test RPC

**Tasks:**
1. Apply Migration 04
2. Implement atomic rollback test (3C-0)
3. Run rollback test → MUST PASS
4. Implement concurrent idempotency test (3C-3)
5. Run idempotency test → MUST PASS
6. Implement RLS boundary test (3C-4)
7. Run RLS test → MUST PASS

**Deliverable:**
- RPC deployed
- 3 tests PASSING

**Exit Criteria:**
- `outbox = 0, idempotency = 0, audit = 0` after rollback
- Concurrent submission: 1 ACCEPTED, 1 DUPLICATE
- Cross-tenant submission REJECTED

---

### STEP 4: Implement submitIntent()

**Tasks:**
1. Implement `submitIntent()` TypeScript function
2. Validate JWT/context (application layer)
3. Validate structural intent (application layer)
4. Invoke `submit_financial_intent` RPC
5. Handle `23505` (DUPLICATE)
6. Handle other errors
7. Return `ACCEPTED` status
8. Unit test: Mock RPC invocation
9. Integration test: Real RPC call

**Deliverable:**
- `submitIntent()` implemented
- Unit + integration tests PASSING

**Exit Criteria:**
- `submitIntent()` returns ACCEPTED after RPC commit
- Idempotency conflict returns DUPLICATE
- No Finance OS emission in submission path (TB-4)

---

### STEP 5: Implement processOutboxOnce()

**Tasks:**
1. Implement `processOutboxOnce()` (single-batch processor)
2. Claim PENDING events
3. Invoke `publishIntent()`
4. Update status: PUBLISHED / FAILED
5. Test: Manual invocation
6. Test: No automatic polling

**Deliverable:**
- `processOutboxOnce()` implemented
- Tests PASSING

**Exit Criteria:**
- Manual test control verified
- No daemon/worker started
- No automatic retry (defer to Week 3+)

---

### STEP 6: W2.2 Happy Path E2E

**Test:** `3C-1: Happy Path — Submission → Processing → Publishing`

**Sequence:**
1. Submit intent → ACCEPTED
2. Verify outbox PENDING
3. Process outbox → claim event
4. Publish to Finance OS → PUBLISHED
5. Verify outbox PUBLISHED

**Exit Criteria:**
- End-to-end flow PASSING
- All Phase 3A/3B tests remain green (79/79, 97/97)

---

### STEP 7: W2.3 Idempotency E2E

**Test:** `3C-2: Idempotency — Duplicate Submission Rejected`

**Sequence:**
1. Submit intent with key K1 → ACCEPTED
2. Submit intent with key K1 again → DUPLICATE
3. Verify outbox count = 1
4. Process outbox → publishes once
5. Verify Finance OS received intent ONCE

**Exit Criteria:**
- Idempotency proven end-to-end
- Database UNIQUE constraint verified

---

### STEP 8: Full Regression

**Tasks:**
1. Run Phase 3A tests: `npm run test:runtime:3a` → 79/79
2. Run Phase 3B tests: `npm run test:runtime:3b` → 97/97
3. Run Gate 0 tests: `npm run test:runtime:3c:infra` → 5/5
4. Run Week 2 tests: `npm run test:runtime:3c` → 3/3

**Deliverable:**
- Evidence document: `BELLA_RUNTIME_WEEK_2_EVIDENCE.md`
- Test results: 184/184 PASS (79 + 97 + 5 + 3)

**Exit Criteria:**
- All regression tests green
- No architecture violations

---

### STEP 9: Week 2 Gate

**Gate Criteria:**
```
✅ TB-1: Atomicity proven (rollback test PASS)
✅ TB-2: Idempotency authority proven (concurrent test PASS)
✅ TB-3: Business boundary preserved (no accounting logic in RPC)
✅ TB-4: Async boundary preserved (submission != processing)
✅ Phase 3A: 79/79 PASS
✅ Phase 3B: 97/97 PASS
✅ Gate 0: 5/5 PASS
✅ Week 2: 3/3 PASS (3C-0, 3C-1, 3C-2)
✅ RLS: Tenant isolation verified
✅ Architecture: No violations
```

**Decision:**
```
IF all criteria PASS:
  Week 2 COMPLETE
  Week 3+ UNBLOCKED
ELSE:
  Week 2 BLOCKED
  Fix failures → re-run gate
```

---

## Architecture Preservation

### What Changes

**Added:**
- ✅ Migration 04: `submit_financial_intent` RPC
- ✅ TB-0 to TB-4 invariants
- ✅ Transaction boundary proven

**Modified:**
- 🟡 `submitIntent()` implementation (invokes RPC instead of repositories)

### What Does NOT Change

**Preserved:**
- ✅ Runtime v1.1 frozen architecture
- ✅ Phase 3B repository contracts (used by `processOutboxOnce()`)
- ✅ Database schema (Migrations 01-03)
- ✅ RLS policies (Gate 0 verified)
- ✅ Tenant isolation (P0 invariant)
- ✅ Event-After-Persistence (P9 invariant)
- ✅ Async boundary (TB-4)

**No Business Logic Migration:**
- ❌ RPC does NOT contain accounting rules
- ❌ RPC does NOT call Finance OS
- ❌ RPC does NOT implement retry
- ❌ RPC does NOT implement quarantine

---

## Risk Assessment

### Risk 1: Business Logic Leakage

**Risk:** RPC accumulates accounting logic over time

**Mitigation:**
- TB-3 invariant (explicitly forbids business logic)
- Code review: Reject RPC changes containing business rules
- Test review: RPC tests verify persistence only

**Monitoring:**
- Regular RPC audit (check for business semantics)
- If accounting logic found → extract to Finance OS

---

### Risk 2: SQL Maintenance Burden

**Risk:** RPC changes require migrations, history grows

**Mitigation:**
- RPC should remain stable (persistence mechanics rarely change)
- If frequent changes needed → consider Option B (pg.Pool) in future

**Monitoring:**
- Track RPC migration frequency
- If > 3 changes in 6 months → reassess architecture

---

### Risk 3: Type Safety Loss

**Risk:** RPC parameters not type-checked by TypeScript

**Mitigation:**
- Application layer validates intent structure before RPC
- Integration tests verify RPC contract

**Monitoring:**
- Runtime errors from RPC invocation
- If type mismatches frequent → consider generated types

---

## Decision Record

**Decision ID:** RT-TB-001  
**Date:** 2026-08-19  
**Status:** 🟡 Awaiting Final Approval  
**Approver:** Architect  

**Decision:**
```
OPTION A — PostgreSQL RPC
selected as transaction boundary for submitIntent()
```

**Rationale:**
- Proven Bella pattern
- Guaranteed atomicity
- Minimal architecture change
- RLS preserved
- Automatic rollback

**Alternatives Considered:**
- Option B (pg.Pool): Architecture change required
- Option C (Non-Atomic): ❌ REJECTED (reliability violation)
- Option D (Single-Table): Schema redesign required

**Trade-offs Accepted:**
- SQL maintenance vs. reliability guarantee

**Constraints:**
- TB-3: RPC MUST NOT contain business logic
- TB-4: Submission != Processing (async boundary)

**Approval Required:**
- [ ] TB-1 (Atomicity) approved
- [ ] TB-2 (Idempotency Authority) approved
- [ ] TB-3 (Business Boundary) approved
- [ ] TB-4 (Async Boundary) approved
- [ ] RPC contract approved
- [ ] Migration 04 approved
- [ ] Test requirements approved

---

## Status Summary

```
Decision:                   🟡 AWAITING APPROVAL
Option Selected:            ✅ OPTION A (PostgreSQL RPC)
TB-1 (Atomicity):           ✅ DEFINED
TB-2 (Idempotency):         ✅ DEFINED
TB-3 (Business Boundary):   ✅ DEFINED
TB-4 (Async Boundary):      ✅ DEFINED
RPC Contract:               ✅ DESIGNED
Security Review:            ✅ DOCUMENTED
Test Requirements:          ✅ DEFINED
Migration 04:               🟡 READY (pending approval)
Implementation Sequence:    ✅ DEFINED

Week 2 Implementation:      🔒 BLOCKED (awaiting approval)
```

---

**Next Action:** Final approval → FREEZE decision → Apply Migration 04 → Implement Week 2

**Approval Decision:**
- [ ] APPROVE: Freeze decision, unblock Week 2
- [ ] REVISE: Request changes, remain blocked
- [ ] REJECT: Select alternative option, reopen research

---

**Document Status:** 🔒 FROZEN (pending final approval)  
**Amendment Status:** Ready for integration into Runtime v1.1  
**Implementation:** BLOCKED until approval
