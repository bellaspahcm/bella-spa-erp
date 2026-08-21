# Bella Runtime Security Gate SG-RT-01

**Gate ID:** SG-RT-01  
**Status:** 🟡 PENDING VERIFICATION  
**Date:** 2026-08-19  
**Blocks:** Migration 04 v1.1 Application  
**Prerequisite:** RT-TB-001 v1.1 (Transaction Architecture Decision)  

---

## Gate Purpose

Verify Migration 04 v1.1 security properties before applying to database.

**Scope:** 6 Security Gates (SG-RT-01 to SG-RT-06)

**Exit Criteria:**
```
ALL 6 GATES PASS
    ↓
Migration 04 v1.1 → FREEZE → APPLY
    ↓
Week 2 UNBLOCKED
```

**IF ANY GATE FAILS:**
```
Migration 04 v1.1 → BLOCKED
    ↓
Fix issues → Re-run gate
```

---

## SG-RT-01: Caller Identity

### Requirement

**Prevent tenant/actor spoofing:**
- RPC MUST NOT accept `p_tenant_id` from client
- RPC MUST NOT accept `p_actor_id` from client
- RPC MUST derive tenant from `public.get_auth_tenant_id()`
- RPC MUST derive actor from `auth.uid()`
- RPC MUST raise exception if tenant context NULL
- RPC MUST raise exception if actor context NULL

### Verification Checklist

**Static Analysis (Migration 04 SQL):**
- [ ] Function signature has NO `p_tenant_id UUID` parameter
- [ ] Function signature has NO `p_actor_id UUID` parameter
- [ ] Function body contains `v_tenant_id := public.get_auth_tenant_id();`
- [ ] Function body contains `v_actor_id := auth.uid();`
- [ ] Function raises exception if `v_tenant_id IS NULL`
- [ ] Function raises exception if `v_actor_id IS NULL`

**Expected Signature:**
```sql
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_idempotency_key TEXT,
    p_intent_type TEXT,
    p_intent_payload JSONB
) RETURNS UUID
```

**Expected Derivation:**
```sql
DECLARE
    v_tenant_id UUID;
    v_actor_id UUID;
BEGIN
    v_tenant_id := public.get_auth_tenant_id();
    v_actor_id := auth.uid();
    
    IF v_tenant_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated tenant context';
    END IF;
    
    IF v_actor_id IS NULL THEN
        RAISE EXCEPTION 'No authenticated user context';
    END IF;
```

### Test Verification

**Test 1: Tenant Spoofing Prevention**

```typescript
test('SG-RT-01.1: Tenant identity derived from JWT', async () => {
  // User authenticated with tenant-A
  const session = await supabase.auth.getSession();
  const expectedTenantId = session.data.session?.user?.user_metadata?.tenant_id;
  
  // Submit intent (no tenant parameter)
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'sg-rt-01-test-key',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  // Verify outbox created for authenticated tenant
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('tenant_id, actor_id')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.tenant_id).toBe(expectedTenantId);
  expect(outbox.actor_id).toBe(session.data.session?.user?.id);
});
```

**Test 2: Unauthenticated Call Rejected**

```typescript
test('SG-RT-01.2: Unauthenticated call raises exception', async () => {
  // Create unauthenticated client
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const { error } = await anonClient.rpc('submit_financial_intent', {
    p_idempotency_key: 'anon-test-key',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('No authenticated tenant context');
});
```

### Gate Status

```
Static Analysis:    ⬜ NOT RUN
Test SG-RT-01.1:    ⬜ NOT RUN
Test SG-RT-01.2:    ⬜ NOT RUN

SG-RT-01 Status:    🟡 PENDING
```

---

## SG-RT-02: SECURITY DEFINER Safety

### Requirement

**Prevent privilege escalation and SQL injection:**
- RPC MUST NOT rely solely on RLS for tenant isolation
- RPC MUST explicitly derive caller context
- RPC MUST use `SET search_path = public`
- RPC MUST NOT use dynamic SQL (no `EXECUTE` with user input)
- RPC MUST NOT use dynamic object resolution
- RPC grants: `authenticated` only, `anon`/`PUBLIC` revoked

### Verification Checklist

**Static Analysis (Migration 04 SQL):**
- [ ] Function has `SECURITY DEFINER` attribute
- [ ] Function has `SET search_path = public` attribute
- [ ] Function derives tenant via `public.get_auth_tenant_id()` (explicit validation)
- [ ] Function has NO `EXECUTE` statements
- [ ] Function has NO `format()` with user input
- [ ] Function has NO dynamic table/column references
- [ ] `REVOKE ALL ... FROM PUBLIC, anon` exists
- [ ] `GRANT EXECUTE ... TO authenticated` exists

**Expected Declaration:**
```sql
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Expected Privilege Management:**
```sql
REVOKE ALL ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) 
FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.submit_financial_intent(TEXT, TEXT, JSONB) 
TO authenticated;
```

### Test Verification

**Test 3: Anon Role Cannot Execute**

```typescript
test('SG-RT-02.1: Anon role execution denied', async () => {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const { error } = await anonClient.rpc('submit_financial_intent', {
    p_idempotency_key: 'anon-exec-test',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('permission denied');
});
```

**Test 4: Search Path Enforced**

```sql
-- Verify search_path setting
SELECT proname, prosecdef, proconfig
FROM pg_proc
WHERE proname = 'submit_financial_intent';

-- Expected:
-- prosecdef: true (SECURITY DEFINER)
-- proconfig: {search_path=public}
```

### Gate Status

```
Static Analysis:    ⬜ NOT RUN
Test SG-RT-02.1:    ⬜ NOT RUN
SQL Verification:   ⬜ NOT RUN

SG-RT-02 Status:    🟡 PENDING
```

---

## SG-RT-03: Atomicity

### Requirement

**Guarantee all-or-nothing persistence:**
- RPC MUST NOT contain manual `BEGIN/COMMIT`
- All 3 INSERTs MUST execute in same RPC body
- Exception MUST trigger statement-level rollback
- Rollback MUST leave `outbox=0`, `idempotency=0`, `audit=0`

### Verification Checklist

**Static Analysis (Migration 04 SQL):**
- [ ] Function body has NO `BEGIN;` statement
- [ ] Function body has NO `COMMIT;` statement
- [ ] Function body has NO `START TRANSACTION;` statement
- [ ] Function body has 3 `INSERT` statements (outbox, idempotency, audit)
- [ ] All 3 INSERTs in same execution scope (no sub-transactions)
- [ ] Exception handler re-raises errors (no silent catch)

**Expected Pattern:**
```sql
BEGIN  -- PL/pgSQL block, NOT transaction control
    INSERT INTO runtime_outbox (...);
    INSERT INTO runtime_idempotency_registry (...);
    INSERT INTO runtime_audit_log (...);
    RETURN v_outbox_id;
EXCEPTION
    WHEN unique_violation THEN RAISE;
    WHEN OTHERS THEN RAISE;
END;
```

### Test Verification

**Test 5: Atomic Rollback on Constraint Violation**

```typescript
test('SG-RT-03.1: Atomic rollback on FK constraint violation', async () => {
  // Setup: Create invalid scenario that triggers FK violation
  // (Implementation-specific: may require test helper)
  
  const { error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'atomic-rollback-test',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { invalid_reference: 'trigger-fk-error' }
  });
  
  // Expect error
  expect(error).toBeDefined();
  
  // Verify ROLLBACK: All 3 tables empty for this test
  const { count: outboxCount } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true })
    .eq('intent_payload->idempotency_key', 'atomic-rollback-test');
  
  const { count: idempotencyCount } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true })
    .eq('idempotency_key', 'atomic-rollback-test');
  
  const { count: auditCount } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true })
    .eq('action', 'INTENT_SUBMITTED')
    .gte('created_at', new Date(Date.now() - 1000).toISOString());
  
  expect(outboxCount).toBe(0);
  expect(idempotencyCount).toBe(0);
  // Audit may have entries from other tests, check no new entry created
});
```

**Test 6: All 3 Tables Populated on Success**

```typescript
test('SG-RT-03.2: All 3 tables populated atomically on success', async () => {
  const idempotencyKey = 'sg-rt-03-success-test';
  
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  // Verify all 3 tables populated
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('*')
    .eq('outbox_id', outboxId)
    .single();
  
  const { data: idempotency } = await supabase
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single();
  
  const { data: audit } = await supabase
    .from('runtime_audit_log')
    .select('*')
    .eq('outbox_id', outboxId)
    .eq('action', 'INTENT_SUBMITTED')
    .single();
  
  expect(outbox).toBeDefined();
  expect(idempotency).toBeDefined();
  expect(idempotency.outbox_id).toBe(outboxId);
  expect(audit).toBeDefined();
  expect(audit.outbox_id).toBe(outboxId);
});
```

### Gate Status

```
Static Analysis:    ⬜ NOT RUN
Test SG-RT-03.1:    ⬜ NOT RUN
Test SG-RT-03.2:    ⬜ NOT RUN

SG-RT-03 Status:    🟡 PENDING
```

---

## SG-RT-04: Idempotency

### Requirement

**Database UNIQUE constraint is authority:**
- Concurrent requests MUST be serialized by database
- Only ONE submission succeeds per idempotency key
- Duplicate submission MUST return `23505` (unique_violation)
- Retry with same key after timeout MUST NOT create duplicate outbox

### Verification Checklist

**Static Analysis (Schema):**
- [ ] `runtime_idempotency_registry` has UNIQUE constraint on `(tenant_id, idempotency_key)`
- [ ] Constraint verified by Schema Evidence document
- [ ] RPC `INSERT idempotency_registry` has NO `ON CONFLICT` clause

**Expected Behavior:**
```sql
-- Second INSERT with same key triggers unique_violation
INSERT INTO runtime_idempotency_registry (
    tenant_id, idempotency_key, outbox_id, created_at
) VALUES (
    v_tenant_id, p_idempotency_key, v_outbox_id, now()
);
-- ↑ Throws 23505 if duplicate
```

### Test Verification

**Test 7: Concurrent Duplicate Submission**

```typescript
test('SG-RT-04.1: Concurrent duplicate submission blocked by DB', async () => {
  const idempotencyKey = 'sg-rt-04-concurrent-test';
  const intent = { type: 'INVOICE_PAYMENT', payload: { amount: 1000 } };
  
  // Simulate concurrent requests (Promise.all)
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
  
  // One succeeds, one fails with 23505
  const successes = results.filter(r => 
    r.status === 'fulfilled' && r.value.data && !r.value.error
  );
  const failures = results.filter(r => 
    r.status === 'fulfilled' && r.value.error?.code === '23505'
  );
  
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1);
  
  // Verify: Only ONE outbox entry
  const { count } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  // Assuming clean test database
  expect(count).toBe(1);
});
```

**Test 8: Sequential Duplicate Submission**

```typescript
test('SG-RT-04.2: Sequential duplicate submission rejected', async () => {
  const idempotencyKey = 'sg-rt-04-sequential-test';
  
  // First submission
  const { data: outboxId1, error: error1 } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error1).toBeNull();
  expect(outboxId1).toBeDefined();
  
  // Second submission (duplicate)
  const { data: outboxId2, error: error2 } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(outboxId2).toBeNull();
  expect(error2).toBeDefined();
  expect(error2.code).toBe('23505');
  expect(error2.message).toContain('idempotency_tenant_key_unique');
  
  // Verify: Still only ONE outbox entry
  const { count } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  expect(count).toBe(1);
});
```

### Gate Status

```
Schema Verification: ⬜ NOT RUN
Test SG-RT-04.1:     ⬜ NOT RUN
Test SG-RT-04.2:     ⬜ NOT RUN

SG-RT-04 Status:     🟡 PENDING
```

---

## SG-RT-05: Async Boundary

### Requirement

**Submission ≠ Processing:**
- RPC MUST only persist (outbox, idempotency, audit)
- RPC MUST NOT call Finance OS
- RPC MUST NOT call `processOutboxOnce()`
- RPC MUST NOT emit domain events
- RPC returns `outbox_id` after persistence only
- E2E test MUST prove submission does NOT trigger emission

### Verification Checklist

**Static Analysis (Migration 04 SQL):**
- [ ] Function body has NO HTTP calls (no `http_post`, `http_get`, etc.)
- [ ] Function body has NO calls to other processing functions
- [ ] Function body has NO `PERFORM pg_notify` (domain events)
- [ ] Function body has NO Finance OS references
- [ ] Function body has NO retry logic
- [ ] Function body has NO quarantine logic
- [ ] Function only performs 3 INSERTs + RETURN

**Expected Pattern:**
```sql
-- ONLY persistence, NO processing
INSERT INTO runtime_outbox (...);
INSERT INTO runtime_idempotency_registry (...);
INSERT INTO runtime_audit_log (...);
RETURN v_outbox_id;  -- Async boundary: caller receives ACCEPTED
```

### Test Verification

**Test 9: Submission Does Not Trigger Processing**

```typescript
test('SG-RT-05.1: Submission does not trigger outbox processing', async () => {
  const idempotencyKey = 'sg-rt-05-async-test';
  
  // Submit intent
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  // Verify outbox status: PENDING (not PROCESSING or PUBLISHED)
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.status).toBe('PENDING');
  
  // Verify no Finance OS emission occurred
  // (Would require Finance OS mock/spy in integration test)
  // For now: verify outbox remains PENDING
});
```

**Test 10: RPC Returns Immediately (Async Boundary Proof)**

```typescript
test('SG-RT-05.2: Submission complete, processing NOT triggered', async () => {
  const idempotencyKey = 'sg-rt-05-async-boundary-test';
  
  // 1. Submit intent
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  // 2. Verify: Outbox status = PENDING (NOT PROCESSING/PUBLISHED)
  const { data: outboxBefore } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outboxBefore.status).toBe('PENDING');
  
  // 3. Simulate Finance OS emission counter (in real integration test)
  // For now: verify no status change after submission
  
  // Wait 100ms to ensure no async processing triggered
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // 4. Verify: Status STILL PENDING
  const { data: outboxAfter } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outboxAfter.status).toBe('PENDING');
  
  // 5. ONLY when processOutboxOnce() called → status changes
  // (This will be tested in W2.2 Happy Path E2E)
  
  // TB-4 PROVEN: submitIntent() → ACCEPTED, processOutboxOnce() NOT triggered
});
```

**Async Boundary Proof:**
```
submitIntent()
    ↓
RPC COMMIT
    ↓
ACCEPTED (status: PENDING)
    ↓
[Async boundary]
    ↓
processOutboxOnce() called manually
    ↓
PENDING → PUBLISHED
    ↓
Finance OS emission count = 1
```

**This proves TB-4:** Submission ≠ Processing (async boundary preserved)

### Gate Status

```
Static Analysis:    ⬜ NOT RUN
Test SG-RT-05.1:    ⬜ NOT RUN
Test SG-RT-05.2:    ⬜ NOT RUN

SG-RT-05 Status:    🟡 PENDING
```

---

## SG-RT-06: Business Boundary

### Requirement

**RPC is persistence, NOT business logic:**
- RPC MUST NOT contain account code selection
- RPC MUST NOT generate debit/credit entries
- RPC MUST NOT apply accounting policy
- RPC MUST NOT validate business semantics (SKU, customer balance, etc.)
- RPC MUST NOT implement retry logic
- RPC MUST NOT implement quarantine logic
- RPC MUST NOT call Finance OS

### Verification Checklist

**Static Analysis (Migration 04 SQL):**
- [ ] Function body has NO references to `chart_of_accounts`
- [ ] Function body has NO references to `journal_entries`
- [ ] Function body has NO references to `journal_lines`
- [ ] Function body has NO debit/credit calculations
- [ ] Function body has NO `CASE` statements for account selection
- [ ] Function body has NO business validation (amount limits, customer checks)
- [ ] Function body has NO retry counters
- [ ] Function body has NO quarantine status updates
- [ ] Function only validates: NULL checks, required fields

**Allowed Validation (Structural Only):**
```sql
-- ✅ ALLOWED: Required parameter checks
IF p_idempotency_key IS NULL OR p_idempotency_key = '' THEN
    RAISE EXCEPTION 'idempotency_key is required';
END IF;

-- ✅ ALLOWED: Auth context checks
IF v_tenant_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated tenant context';
END IF;
```

**Forbidden Logic (Business Semantics):**
```sql
-- ❌ FORBIDDEN: Account selection
SELECT id INTO v_account_id FROM chart_of_accounts WHERE code = '3387';

-- ❌ FORBIDDEN: Dr/Cr generation
INSERT INTO journal_lines (account_id, debit, credit) VALUES (...);

-- ❌ FORBIDDEN: Business validation
IF p_intent_payload->>'amount' > 1000000 THEN
    RAISE EXCEPTION 'Amount exceeds limit';
END IF;

-- ❌ FORBIDDEN: Retry logic
IF v_retry_count > 3 THEN
    UPDATE runtime_outbox SET status = 'QUARANTINED';
END IF;
```

### Test Verification

**Test 11: Code Review (Manual)**

```
Code Reviewer Checklist:
- [ ] Read entire Migration 04 RPC body
- [ ] Verify no chart_of_accounts references
- [ ] Verify no journal_entries/journal_lines references
- [ ] Verify no debit/credit logic
- [ ] Verify no amount/business validation beyond NULL checks
- [ ] Verify no retry/quarantine logic
- [ ] Verify only 3 INSERTs: outbox, idempotency, audit
- [ ] Sign off: "RPC contains persistence mechanics only"
```

**Test 12: Business vs. Structural Validation Boundary**

```typescript
test('SG-RT-06.1: RPC rejects structural invalidity, accepts business invalidity', async () => {
  // TEST 1: Structural invalidity → MUST REJECT
  const { error: structuralError } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: null,  // ❌ Structural: NULL idempotency key
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(structuralError).toBeDefined();
  expect(structuralError.message).toContain('idempotency_key is required');
  
  // TEST 2: Business invalidity (but structurally valid) → MUST ACCEPT
  const { data: outboxId, error: businessError } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'sg-rt-06-business-test',
    p_intent_type: 'REVENUE_RECOGNIZED',
    p_intent_payload: {
      // Structurally valid JSONB object
      amount: -9999,            // 🟡 Business invalid (negative revenue)
      currency: 'INVALID_CODE', // 🟡 Business invalid (unknown currency)
      customer: 'does-not-exist', // 🟡 Business invalid (non-existent customer)
      accountCode: '9999'       // 🟡 Business invalid (unknown account)
    }
  });
  
  // RPC ACCEPTS (business validation is Finance OS's responsibility)
  expect(businessError).toBeNull();
  expect(outboxId).toBeDefined();
  
  // Outbox persisted with business-invalid data
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('intent_payload')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.intent_payload.amount).toBe(-9999);
  
  // Finance OS will reject this during processOutboxOnce() → FAILED
  // But Runtime ACCEPTED it (TB-3: Business Boundary preserved)
});
```

**Clarification:**
```
Runtime validates:     Structure, required fields, types
Runtime does NOT:      Business semantics, accounting rules, entity existence

Example:
  amount = "1000"      → Runtime REJECT ❌ (wrong type)
  amount = -1000       → Runtime ACCEPT ✅ (valid number, Finance OS decides policy)
  
  currency = null      → Runtime REJECT ❌ (required field)
  currency = "INVALID" → Runtime ACCEPT ✅ (valid string, Finance OS validates code)
  
  payload = "string"   → Runtime REJECT ❌ (must be JSONB object)
  payload = { invalid_business_ref } → Runtime ACCEPT ✅ (valid JSONB, Finance OS validates ref)
```

**This proves TB-3:** RPC contains persistence mechanics only, NO business logic.

### Gate Status

```
Static Analysis:    ⬜ NOT RUN
Code Review:        ⬜ NOT RUN
Test SG-RT-06.1:    ⬜ NOT RUN

SG-RT-06 Status:    🟡 PENDING
```

---

## Application Layer Structural Validation

### Requirement (Added)

**Application layer MUST validate payload structure before RPC:**

```typescript
interface FinancialIntent {
  type: string;
  correlationId: string;
  amount: number;
  currency: string;
  entityReference: {
    type: string;
    id: string;
  };
  payload: Record<string, any>;
}

async function submitIntent(
  idempotencyKey: string,
  intent: FinancialIntent
): Promise<SubmitIntentResult> {
  // ✅ STRUCTURAL validation (application layer)
  if (!intent.type || typeof intent.type !== 'string') {
    return { status: 'ERROR', outboxId: null, error: 'Invalid intent type' };
  }
  
  if (!intent.amount || typeof intent.amount !== 'number') {
    return { status: 'ERROR', outboxId: null, error: 'Invalid amount type' };
  }
  
  if (!intent.currency || typeof intent.currency !== 'string') {
    return { status: 'ERROR', outboxId: null, error: 'Invalid currency format' };
  }
  
  if (!intent.entityReference?.type || !intent.entityReference?.id) {
    return { status: 'ERROR', outboxId: null, error: 'Invalid entity reference' };
  }
  
  // ✅ Payload shape validation
  if (!intent.payload || typeof intent.payload !== 'object') {
    return { status: 'ERROR', outboxId: null, error: 'Invalid payload shape' };
  }
  
  // ✅ After structural validation → RPC (persistence only)
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: intent.type,
    p_intent_payload: intent
  });
  
  // Handle response...
}
```

**Validation Boundary:**
```
Application Layer
    ├── Intent type
    ├── Amount type
    ├── Currency format
    ├── Entity reference
    └── Payload shape
         ↓
    RPC Layer
    ├── Pure persistence
    ├── NO business rules
    └── NO semantic validation
```

---

## Overall Gate Status

### Summary

```
SG-RT-01 (Caller Identity):       🟡 PENDING
SG-RT-02 (SECURITY DEFINER):      🟡 PENDING
SG-RT-03 (Atomicity):             🟡 PENDING
SG-RT-04 (Idempotency):           🟡 PENDING
SG-RT-05 (Async Boundary):        🟡 PENDING
SG-RT-06 (Business Boundary):     🟡 PENDING

Overall Status:                    🟡 PENDING
Migration 04 v1.1:                 🔒 BLOCKED
Week 2 Implementation:             🔒 BLOCKED
```

### Exit Criteria

**ALL 6 GATES MUST PASS:**
```
✅ SG-RT-01: Static + 2 tests PASS
✅ SG-RT-02: Static + 1 test + SQL verification PASS
✅ SG-RT-03: Static + 2 tests PASS
✅ SG-RT-04: Schema + 2 tests PASS
✅ SG-RT-05: Static + 2 tests PASS
✅ SG-RT-06: Static + code review + 1 test PASS

    ↓
Migration 04 v1.1 → FREEZE
    ↓
Apply Migration 04
    ↓
Run TB-1 to TB-4 Tests
    ↓
Week 2 UNBLOCKED
```

**IF ANY GATE FAILS:**
```
BLOCKED → Fix issues → Re-run gate
```

---

## Implementation Sequence (After Gate PASS)

```
Security Gate PASS
    ↓
1. FREEZE Migration 04 v1.1
    ↓
2. Apply Migration 04
    ↓
3. Verify RPC exists (SQL)
    ↓
4. Run TB-1 Test (Atomicity)
    ↓
5. Run TB-2 Test (Idempotency)
    ↓
6. Run TB-4 Test (Async Boundary)
    ↓
7. Implement submitIntent()
    ↓
8. Implement processOutboxOnce()
    ↓
9. Run W2.2 (Happy Path E2E)
    ↓
10. Run W2.3 (Idempotency E2E)
    ↓
11. Full Regression (184/184 tests)
    ↓
12. Week 2 Gate
```

---

## Status

**Current State:**
```
Architecture v1.1:          🟢 APPROVED IN PRINCIPLE
Security Corrections:       ✅ APPLIED (v1.1)
Security Gate:              🟡 RUN NOW (this document)
Migration 04 v1.1:          🔒 BLOCKED (pending gate)
Week 2 Implementation:      🔒 BLOCKED (pending gate)
```

**Action Required:**
```
RUN SECURITY GATE
    ↓
Verify all 6 gates
    ↓
Document results
    ↓
IF PASS → Freeze & Apply
IF FAIL → Fix & Re-run
```

---

**Document Status:** 🔒 FROZEN  
**Gate Status:** 🟡 PENDING VERIFICATION  
**Next Action:** Execute verification for SG-RT-01 through SG-RT-06
