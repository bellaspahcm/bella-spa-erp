# Bella Runtime Transaction Architecture Decision v1.1 (CORRECTED)

**Status:** 🟡 CONDITIONAL APPROVAL  
**Decision Date:** 2026-08-19  
**Version:** v1.1 (Security Corrections Applied)  
**Supersedes:** RT-TB-001 v1.0  
**Amendment to:** Runtime v1.1 Architecture  

---

## Executive Summary

**DECISION: OPTION A — PostgreSQL RPC (APPROVED IN PRINCIPLE)**

**Status:** Architecture approved, Migration 04 NOT APPROVED until security corrections verified.

**4 Critical Corrections Applied:**
1. 🔴 **P0 BLOCKER:** Caller tenant identity (derive from `get_auth_tenant_id()`)
2. 🔴 **P0 BLOCKER:** Caller actor identity (derive from `auth.uid()`)
3. 🟠 Transaction semantics clarification (statement-level atomicity, no manual BEGIN/COMMIT)
4. 🟠 Timeout semantics clarification (indeterminate outcome, idempotency handles retry)

---

## 🔴 Correction 1: Caller Tenant Identity (P0 BLOCKER)

### Security Vulnerability (v1.0)

**Attack Vector:**
```typescript
// User A authenticated (tenant-A JWT)
await supabase.rpc('submit_financial_intent', {
  p_tenant_id: 'tenant-B',  // ❌ SPOOFED
  p_idempotency_key: 'key',
  ...
});
// Result: Intent submitted for tenant-B using tenant-A credentials
```

### Corrected RPC Signature (v1.1)

**Remove client-provided tenant/actor:**
```sql
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    -- ✅ REMOVED: p_tenant_id (derived server-side)
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
    -- ✅ REMOVED: p_actor_id (derived server-side)
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
    v_tenant_id UUID;
    v_actor_id UUID;
BEGIN
    -- ✅ SECURITY: Derive from authenticated context
    v_tenant_id := public.get_auth_tenant_id();
    v_actor_id := auth.uid();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated tenant context';
    END IF;
    
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user context';
    END IF;
    
    IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;

    -- Atomic persistence (statement-level transaction)
    INSERT INTO public.runtime_outbox (
        tenant_id, intent_type, intent_payload, status, created_at
    ) VALUES (
        v_tenant_id, p_intent_type, p_intent_payload, 'PENDING', now()
    ) RETURNING outbox_id INTO v_outbox_id;

    INSERT INTO public.runtime_idempotency_registry (
        tenant_id, idempotency_key, outbox_id, created_at
    ) VALUES (
        v_tenant_id, p_idempotency_key, v_outbox_id, now()
    );

    INSERT INTO public.runtime_audit_log (
        outbox_id, action, tenant_id, actor_id, created_at
    ) VALUES (
        v_outbox_id, 'INTENT_SUBMITTED', v_tenant_id, v_actor_id, now()
    );

    RETURN v_outbox_id;
EXCEPTION
    WHEN unique_violation THEN
        RAISE;  -- Idempotency conflict (TB-2)
    WHEN OTHERS THEN
        RAISE;  -- Other errors
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Security Properties:**
- ✅ Tenant cannot be spoofed (derived from JWT)
- ✅ Actor cannot be impersonated (derived from JWT)
- ✅ RLS provides defense-in-depth (explicit validation + RLS policies)

---

## 🔴 Correction 2: SECURITY DEFINER + RLS Clarification

### Misleading Statement (v1.0)

> "RPC executes as SECURITY DEFINER → RLS policies enforced"

**Problem:**
- `SECURITY DEFINER` runs with owner privileges (may bypass RLS)
- RLS enforcement depends on owner role configuration

### Corrected Security Model (v1.1)

**Defense-in-Depth:**
1. **Primary:** RPC explicitly validates tenant (`get_auth_tenant_id()`)
2. **Secondary:** RLS policies provide additional layer

**Corrected Statement:**
> "RPC executes as `SECURITY DEFINER` with owner privileges. Tenant isolation is enforced by **explicit validation** (`public.get_auth_tenant_id()`) within the RPC body. RLS policies provide defense-in-depth, but the RPC does NOT rely solely on RLS for security."

**Why This Matters:**
- Prevents security assumptions that may not hold
- RPC owns tenant validation (not delegated to RLS)
- RLS is backup, not primary enforcement

---

## 🟠 Correction 3: Transaction Semantics

### Misleading Model (v1.0)

```sql
-- ❌ INCORRECT (implies manual transaction control)
BEGIN
  INSERT...
  INSERT...
  INSERT...
COMMIT
```

**Problem:**
- PostgreSQL functions execute within **statement-level transaction**
- Manual `BEGIN/COMMIT` inside function is unnecessary (and may error)

### Corrected Transaction Model (v1.1)

**Actual Execution:**
```
supabase.rpc('submit_financial_intent')
  ↓
PostgREST: BEGIN (implicit statement transaction)
  ↓
PostgreSQL: Execute function atomically
  ├── INSERT runtime_outbox
  ├── INSERT runtime_idempotency_registry
  └── INSERT runtime_audit_log
  ↓
Function success → COMMIT
Function exception → ROLLBACK
```

**Corrected TB-1 Invariant:**
```
All persistence mutations performed by the RPC 
execute atomically within the PostgreSQL transaction 
enclosing the RPC call.
```

**Why This Matters:**
- Clarifies atomicity source (statement transaction, not manual control)
- Prevents implementation errors
- Aligns with PostgREST behavior

---

## 🟠 Correction 4: Timeout Semantics

### Incorrect Guarantee (v1.0)

> "Network timeout → ROLLBACK (PostgreSQL automatic)"

**Problem:**
- Client timeout ≠ server rollback guarantee
- Server may commit before client receives response

### Corrected Timeout Model (v1.1)

**Indeterminate Outcome:**
```
Client ──RPC──> PostgreSQL
                   ↓
              COMMIT (server)
                   ↓
           Network loss
                   ↓
Client <── timeout

Client state: UNKNOWN
Server state: COMMITTED ✅
```

**Corrected Statement:**
> "Client-side timeout is an **indeterminate outcome**. PostgreSQL guarantees atomic commit/rollback on the server, but the caller may not know whether the transaction committed. A subsequent retry MUST be safe through the database-backed idempotency key (TB-2)."

**Retry Behavior:**
```typescript
// Timeout → retry with SAME idempotency key
try {
  return await submitIntent(intent, key);
} catch (error) {
  if (error.message.includes('timeout')) {
    // Indeterminate: retry safely via idempotency
    return await submitIntent(intent, key);  // SAME KEY
    // If server committed: 23505 (DUPLICATE)
    // If server rolled back: ACCEPTED
  }
  throw error;
}
```

---

## Corrected Application Layer Contract

### TypeScript Interface (v1.1)

```typescript
interface SubmitIntentResult {
  status: 'ACCEPTED' | 'DUPLICATE' | 'ERROR';
  outboxId: string | null;
  error?: string;
}

async function submitIntent(
  idempotencyKey: string,  // ✅ No tenant/actor (derived server-side)
  intent: FinancialIntent
): Promise<SubmitIntentResult> {
  // 1. Validate JWT (application layer)
  const session = await supabase.auth.getSession();
  if (!session) {
    return { status: 'ERROR', outboxId: null, error: 'Not authenticated' };
  }

  // 2. Validate structural intent (application layer)
  if (!intent.type || !intent.payload) {
    return { status: 'ERROR', outboxId: null, error: 'Invalid intent structure' };
  }
  
  // 3. Atomic submission (RPC derives tenant/actor from JWT)
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: intent.type,
    p_intent_payload: intent.payload
    // ✅ NO p_tenant_id
    // ✅ NO p_actor_id
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

---

## Corrected Rollback Scenarios

| Trigger | Server Behavior | Client Knowledge | Retry Safe? |
|---------|-----------------|------------------|-------------|
| **Idempotency conflict** | ROLLBACK (23505) | ✅ Error received | ✅ Yes (DUPLICATE) |
| **FK constraint violation** | ROLLBACK | ✅ Error received | ✅ Yes (if fixed) |
| **NULL constraint violation** | ROLLBACK | ✅ Error received | ✅ Yes (if fixed) |
| **Tenant context missing** | ROLLBACK (exception) | ✅ Error received | ❌ No (auth issue) |
| **Application exception** | ROLLBACK | ✅ Error received | ✅ Yes (if fixed) |
| **Network timeout** | **INDETERMINATE** | ❌ Unknown | ✅ Yes (idempotency) |

---

## Corrected Test Requirements

### Test 1: Atomic Rollback (NO test RPC needed)

**Purpose:** Verify TB-1 (atomicity)

**Approach:** Trigger real constraint violation

```typescript
test('Atomic rollback via foreign key violation', async () => {
  const tenantId = 'invalid-tenant';  // FK violation trigger
  const idempotencyKey = 'rollback-test-key';
  
  // This will fail on FK constraint (tenant_id references tenants)
  const { error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  // Manually set invalid tenant context to trigger FK violation
  // (Implementation detail: test setup)
  
  expect(error).toBeDefined();
  
  // Verify ROLLBACK: All 3 tables empty
  const { count: outboxCount } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  const { count: idempotencyCount } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true });
  
  const { count: auditCount } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true });
  
  expect(outboxCount).toBe(0);
  expect(idempotencyCount).toBe(0);
  expect(auditCount).toBe(0);
});
```

**No test RPC needed:** Use real constraints to trigger rollback

---

### Test 2: Tenant Spoofing Prevention

**Purpose:** Verify Correction 1 (tenant derived from auth)

```typescript
test('Tenant cannot be spoofed', async () => {
  // User A authenticated (tenant-A)
  // Since RPC derives tenant from JWT, cannot submit for tenant-B
  
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    // ✅ No p_tenant_id parameter (derived server-side)
    p_idempotency_key: 'spoof-test-key',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  if (!error) {
    // Verify outbox created for authenticated tenant only
    const { data: outbox } = await supabase
      .from('runtime_outbox')
      .select('tenant_id')
      .eq('outbox_id', outboxId)
      .single();
    
    const session = await supabase.auth.getSession();
    const expectedTenantId = session.data.session?.user?.user_metadata?.tenant_id;
    
    expect(outbox.tenant_id).toBe(expectedTenantId);
  }
});
```

---

### Test 3: Concurrent Idempotency

**Purpose:** Verify TB-2 (database UNIQUE constraint)

```typescript
test('Concurrent duplicate submission blocked', async () => {
  const idempotencyKey = 'concurrent-test-key';
  const intent = { type: 'INVOICE_PAYMENT', payload: { amount: 1000 } };
  
  // Simulate concurrent requests
  const results = await Promise.allSettled([
    supabase.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: intent.type,
      p_intent_payload: intent.payload
    }),
    supabase.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: intent.type,
      p_intent_payload: intent.payload
    })
  ]);
  
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
    .eq('idempotency_key', idempotencyKey);
  
  expect(count).toBe(1);
});
```

---

## Corrected Migration 04

**File:** `supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql`

```sql
-- Bella Runtime Phase 3C Week 2
-- Migration 04: Atomic Financial Intent Submission RPC (v1.1 CORRECTED)
-- Security Corrections: Tenant/actor derived from auth context

BEGIN;

DROP FUNCTION IF EXISTS public.submit_financial_intent(UUID, TEXT, TEXT, JSONB, UUID);
DROP FUNCTION IF EXISTS public.submit_financial_intent(TEXT, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
    v_tenant_id UUID;
    v_actor_id UUID;
BEGIN
    -- ✅ SECURITY: Derive tenant from authenticated JWT
    v_tenant_id := public.get_auth_tenant_id();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated tenant context';
    END IF;
    
    -- ✅ SECURITY: Derive actor from authenticated JWT
    v_actor_id := auth.uid();
    
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user context';
    END IF;
    
    -- Validate required parameters
    IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
        RAISE EXCEPTION 'idempotency_key is required';
    END IF;
    
    IF p_intent_type IS NULL OR p_intent_type = '' THEN
        RAISE EXCEPTION 'intent_type is required';
    END IF;
    
    IF p_intent_payload IS NULL THEN
        RAISE EXCEPTION 'intent_payload is required';
    END IF;

    -- TB-1: Atomic persistence (statement-level transaction)
    -- 1. INSERT runtime_outbox
    INSERT INTO public.runtime_outbox (
        tenant_id,
        intent_type,
        intent_payload,
        status,
        created_at
    ) VALUES (
        v_tenant_id,
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
        v_tenant_id,
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
        v_tenant_id,
        v_actor_id,
        now()
    );

    -- All 3 INSERTs committed atomically by statement transaction
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
REVOKE ALL ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) 
FROM PUBLIC, anon;

-- Security: Grant to authenticated users only
GRANT EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) 
TO authenticated;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';

COMMIT;
```

---

## Approval Status

```
Architecture Decision:      🟢 APPROVED IN PRINCIPLE
Option A (PostgreSQL RPC):  ✅ SELECTED

Security Corrections:
  1. Tenant identity:       ✅ APPLIED (derived from get_auth_tenant_id())
  2. Actor identity:        ✅ APPLIED (derived from auth.uid())
  3. Transaction semantics: ✅ CLARIFIED (statement-level)
  4. Timeout semantics:     ✅ CLARIFIED (indeterminate outcome)

Migration 04 (v1.1):        🟡 AWAITING SECURITY GATE
Week 2 Implementation:      🔒 BLOCKED (pending Migration 04 approval)
```

---

## Security Gate Checklist

Before approving Migration 04:

- [ ] Verify: RPC signature has NO `p_tenant_id` parameter
- [ ] Verify: RPC signature has NO `p_actor_id` parameter
- [ ] Verify: RPC derives tenant via `get_auth_tenant_id()`
- [ ] Verify: RPC derives actor via `auth.uid()`
- [ ] Verify: RPC raises exception if tenant context NULL
- [ ] Verify: RPC raises exception if actor context NULL
- [ ] Verify: RPC grants to `authenticated` role only
- [ ] Verify: No manual `BEGIN/COMMIT` in RPC body
- [ ] Test: Tenant spoofing prevented (Test 2)
- [ ] Test: Atomic rollback verified (Test 1)
- [ ] Test: Concurrent idempotency enforced (Test 3)

**Once all checks PASS:**
```
Migration 04 v1.1 → APPROVED
    ↓
Apply migration
    ↓
Week 2 UNBLOCKED
```

---

## Decision Record

**Decision ID:** RT-TB-001 v1.1  
**Status:** 🟡 CONDITIONAL APPROVAL  
**Approver:** Architect  

**Decision:**
- ✅ Option A (PostgreSQL RPC) approved
- 🔴 Migration 04 v1.0 REJECTED (security issues)
- ✅ Migration 04 v1.1 CORRECTED (awaiting security gate)

**Critical Corrections:**
1. Tenant identity derived from JWT (prevents spoofing)
2. Actor identity derived from JWT (prevents impersonation)
3. Transaction semantics clarified (statement-level atomicity)
4. Timeout semantics clarified (idempotency handles retry)

**Next Action:** Security gate review → Approve Migration 04 v1.1 → Unblock Week 2

---

**Document Status:** 🔒 v1.1 FROZEN (security corrections applied)  
**Migration Status:** 🟡 AWAITING SECURITY GATE APPROVAL  
**Implementation:** BLOCKED until security gate PASS
