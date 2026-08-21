# Bella Runtime Test Quality Requirements

**Version:** 1.0  
**Date:** 2026-08-19  
**Applies To:** Runtime 3C Security Tests (CMG-RT-001.1 through 001.10)  
**Status:** 🔴 MANDATORY (not guidelines)  

---

## Purpose

Define concrete quality standards for runtime security tests. 10/10 tests PASS is NOT sufficient if test quality is poor.

**Core Principle:**

> "10/10 PASS with weak assertions does not prove security boundary. Tests must provide behavioral proof, not status snapshots."

---

## Quality Standards (Mandatory)

### Standard 1: Behavioral Proof (Not Status Snapshot)

**Requirement:** Test must prove behavior, not just check a status field.

**Example: Async Boundary Test (001.9)**

**❌ FAILS Quality Standard:**
```typescript
test('Async boundary', async () => {
  const { data: outboxId } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'test-key',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  await new Promise(resolve => setTimeout(resolve, 100));
  
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.status).toBe('PENDING'); // ❌ Status snapshot only
});
```

**Problem:** Fast worker or different scheduler could process asynchronously without test detecting it. Test only checks status at one point in time.

**✅ PASSES Quality Standard:**
```typescript
test('Async boundary behavioral proof', async () => {
  // Baseline: Check Finance OS emission count BEFORE
  const emissionsBefore = await getFinanceEmissionCount();
  
  // Submit intent
  const { data: outboxId } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'test-key',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(outboxId).toBeDefined();
  
  // Verify: Outbox PENDING
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.status).toBe('PENDING');
  
  // Wait reasonable time for any async processing
  await new Promise(resolve => setTimeout(resolve, 500));
  
  // Behavioral proof: NO Finance side effect
  const emissionsAfter = await getFinanceEmissionCount();
  expect(emissionsAfter).toBe(emissionsBefore); // ✅ Proves no automatic processing
  
  // Behavioral proof: Status still PENDING
  const { data: outboxStill } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outboxStill.status).toBe('PENDING'); // ✅ No state transition
  
  // Trigger manual processing
  await processOutboxOnce();
  
  // Verify: Status PUBLISHED
  const { data: outboxProcessed } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outboxProcessed.status).toBe('PUBLISHED');
  
  // Verify: Finance side effect NOW present
  const emissionsFinal = await getFinanceEmissionCount();
  expect(emissionsFinal).toBe(emissionsBefore + 1); // ✅ Processing happened
});
```

**Proof Provided:**
1. submitIntent() does NOT trigger processing
2. Finance OS receives NO event
3. Status remains PENDING (not transitioning)
4. processOutboxOnce() required for processing
5. Finance OS receives event ONLY after manual trigger

**This proves TB-4 (Async Boundary).**

---

### Standard 2: Database State Verification (Not Just API Response)

**Requirement:** Verify actual database state, not just API response.

**Example: Concurrent Idempotency Test (001.3)**

**❌ FAILS Quality Standard:**
```typescript
test('Concurrent idempotency', async () => {
  const results = await Promise.allSettled([
    supabase.rpc('submit_financial_intent', { p_idempotency_key: 'key', ... }),
    supabase.rpc('submit_financial_intent', { p_idempotency_key: 'key', ... })
  ]);
  
  const successes = results.filter(r => r.status === 'fulfilled' && !r.value.error);
  const failures = results.filter(r => r.status === 'fulfilled' && r.value.error?.code === '23505');
  
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1); // ❌ Only verifies API response
});
```

**Problem:** API response could indicate success/failure, but database could have:
- 2 outbox entries (race condition in application)
- 1 outbox + 0 idempotency (partial write)
- Orphaned records in audit log

**✅ PASSES Quality Standard:**
```typescript
test('Concurrent idempotency with database verification', async () => {
  const idempotencyKey = `test-concurrent-${Date.now()}`;
  
  // Concurrent requests
  const results = await Promise.allSettled([
    supabase.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    }),
    supabase.rpc('submit_financial_intent', {
      p_idempotency_key: idempotencyKey,
      p_intent_type: 'INVOICE_PAYMENT',
      p_intent_payload: { amount: 1000 }
    })
  ]);
  
  // Verify API responses
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.data && !r.value.error);
  const failures = results.filter(r => r.status === 'fulfilled' && r.value.error?.code === '23505');
  
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1);
  
  // Extract outbox_id from success
  const successResult = results.find(r => r.status === 'fulfilled' && r.value.data);
  const outboxId = successResult.value.data;
  
  // ✅ Verify database: Exactly 1 idempotency record
  const { data: idempotencyRecords } = await supabase
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('idempotency_key', idempotencyKey);
  
  expect(idempotencyRecords).toHaveLength(1);
  expect(idempotencyRecords[0].outbox_id).toBe(outboxId);
  
  // ✅ Verify database: Exactly 1 outbox record
  const { data: outboxRecords } = await supabase
    .from('runtime_outbox')
    .select('*')
    .eq('outbox_id', outboxId);
  
  expect(outboxRecords).toHaveLength(1);
  
  // ✅ Verify database: Exactly 1 audit record
  const { data: auditRecords } = await supabase
    .from('runtime_audit_log')
    .select('*')
    .eq('outbox_id', outboxId)
    .eq('action', 'INTENT_SUBMITTED');
  
  expect(auditRecords).toHaveLength(1);
});
```

**Proof Provided:**
1. PostgreSQL UNIQUE constraint prevents duplicate
2. Database contains exactly 1 outbox (not 2)
3. Database contains exactly 1 idempotency record
4. Database contains exactly 1 audit record
5. All 3 records reference same outbox_id (atomicity)

**This proves TB-2 (Idempotency) + TB-1 (Atomicity).**

---

### Standard 3: Negative Assertions (What Did NOT Happen)

**Requirement:** Verify what did NOT happen, not just what did happen.

**Example: Atomic Rollback Test (001.5)**

**❌ FAILS Quality Standard:**
```typescript
test('Atomic rollback', async () => {
  const { error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: null, // Trigger error
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined(); // ❌ Only verifies error occurred
});
```

**Problem:** Error returned, but partial writes could still exist in database.

**✅ PASSES Quality Standard:**
```typescript
test('Atomic rollback with negative assertions', async () => {
  const idempotencyKey = `test-rollback-${Date.now()}`;
  
  // Count records BEFORE failure
  const { count: outboxBefore } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  const { count: idempotencyBefore } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true });
  
  const { count: auditBefore } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true });
  
  // Trigger constraint violation
  const { error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: null, // NULL violation
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined();
  
  // ✅ Negative assertion: NO new outbox records
  const { count: outboxAfter } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  expect(outboxAfter).toBe(outboxBefore);
  
  // ✅ Negative assertion: NO new idempotency records
  const { count: idempotencyAfter } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true });
  
  expect(idempotencyAfter).toBe(idempotencyBefore);
  
  // ✅ Negative assertion: NO new audit records
  const { count: auditAfter } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true });
  
  expect(auditAfter).toBe(auditBefore);
  
  // ✅ Verify specific key does NOT exist
  const { data: idempotencyCheck } = await supabase
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('idempotency_key', idempotencyKey);
  
  expect(idempotencyCheck).toHaveLength(0);
});
```

**Proof Provided:**
1. Error returned (positive assertion)
2. No outbox record created (negative assertion)
3. No idempotency record created (negative assertion)
4. No audit record created (negative assertion)
5. Specific test key does not exist (negative assertion)

**This proves TB-1 (Atomicity) — all-or-nothing.**

---

### Standard 4: Complete Atomicity Verification

**Requirement:** Verify ALL 3 tables (outbox, idempotency, audit) in consistent state.

**Example: Atomic Success Test (001.6)**

**❌ FAILS Quality Standard:**
```typescript
test('Atomic success', async () => {
  const { data: outboxId } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'test-key',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(outboxId).toBeDefined(); // ❌ Only verifies RPC returned ID
});
```

**Problem:** RPC could return ID but:
- Idempotency record missing (race condition)
- Audit record missing (exception after outbox insert)
- Records reference different IDs (consistency violation)

**✅ PASSES Quality Standard:**
```typescript
test('Atomic success with complete verification', async () => {
  const idempotencyKey = `test-success-${Date.now()}`;
  
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  // ✅ Verify outbox record exists
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('*')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox).toBeDefined();
  expect(outbox.intent_type).toBe('INVOICE_PAYMENT');
  expect(outbox.status).toBe('PENDING');
  
  // ✅ Verify idempotency record exists
  const { data: idempotency } = await supabase
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('idempotency_key', idempotencyKey)
    .single();
  
  expect(idempotency).toBeDefined();
  expect(idempotency.outbox_id).toBe(outboxId); // ✅ References same outbox
  
  // ✅ Verify audit record exists
  const { data: audit } = await supabase
    .from('runtime_audit_log')
    .select('*')
    .eq('outbox_id', outboxId)
    .eq('action', 'INTENT_SUBMITTED')
    .single();
  
  expect(audit).toBeDefined();
  expect(audit.outbox_id).toBe(outboxId); // ✅ References same outbox
  expect(audit.action).toBe('INTENT_SUBMITTED');
  
  // ✅ Verify tenant/actor consistency
  expect(outbox.tenant_id).toBe(idempotency.tenant_id);
  expect(outbox.actor_id).toBe(idempotency.created_by);
  expect(audit.actor_id).toBe(outbox.actor_id);
});
```

**Proof Provided:**
1. RPC returns outbox_id
2. Outbox record exists with correct data
3. Idempotency record exists with correct data
4. Audit record exists with correct data
5. All 3 records reference same outbox_id
6. Tenant/actor consistent across all 3 tables

**This proves TB-1 (Atomicity) — all 3 tables commit together.**

---

### Standard 5: Race Condition Proof (Concurrent Tests)

**Requirement:** Concurrent tests must prove serialization, not just "multiple requests handled."

**Example: Concurrent Idempotency Test (001.3)**

**Quality Checklist:**
- [ ] Multiple requests sent concurrently (Promise.allSettled)
- [ ] Database UNIQUE constraint is enforcement mechanism (not application logic)
- [ ] Exactly 1 success, exactly N-1 failures (23505)
- [ ] Database contains exactly 1 record set (not N partial writes)
- [ ] All 3 tables consistent (same outbox_id)

**This proves PostgreSQL enforces idempotency, not application code.**

---

## Quality Gate Checklist (Per Test)

Before marking test as PASS, verify:

- [ ] **Behavioral proof** — Not just status snapshot
- [ ] **Database state verified** — Not just API response
- [ ] **Negative assertions** — What did NOT happen
- [ ] **Complete atomicity** — All 3 tables verified
- [ ] **No race conditions** — Concurrent tests prove serialization
- [ ] **Test isolation** — No dependency on empty database
- [ ] **Deterministic** — No flaky assertions (timeouts, polling)
- [ ] **Traceable** — Test-specific keys/identifiers
- [ ] **Documented** — Comments explain WHAT is proven

---

## Enforcement

**Review Process:**

1. Test code written
2. Pre-flight validation run
3. **Quality review** — Apply checklist to each test
4. If quality insufficient → FAIL test (even if technically passes)
5. Fix test quality
6. Re-run pre-flight
7. Quality gate PASS → Proceed to runtime gate

**Quality Review Authority:** Architect or designated reviewer

**Failure Response:**
```
IF test quality insufficient:
    Mark test as FAIL (quality)
    Document quality issue
    Fix test (behavioral proof required)
    Re-run pre-flight
```

**DO NOT:**
- ❌ Accept "10/10 PASS" if quality poor
- ❌ Skip quality review because "tests pass"
- ❌ Declare runtime proven with weak assertions

---

## Test-Specific Quality Requirements

### CMG-RT-001.1 (Tenant Identity)
- [ ] Query `users.tenant_id` (source of truth for get_auth_tenant_id())
- [ ] Verify outbox.tenant_id matches users.tenant_id
- [ ] Verify outbox.actor_id matches auth.uid()
- [ ] No client-provided tenant_id accepted

### CMG-RT-001.2 (Unauthenticated Rejection)
- [ ] Anon client blocked at privilege layer
- [ ] Error code indicates permission denied
- [ ] No RPC execution (privilege boundary enforced)

### CMG-RT-001.3 (Concurrent Idempotency)
- [ ] Promise.allSettled with same key
- [ ] Exactly 1 success, exactly 1 × 23505
- [ ] Database: exactly 1 outbox
- [ ] Database: exactly 1 idempotency
- [ ] Database: exactly 1 audit
- [ ] All 3 reference same outbox_id

### CMG-RT-001.4 (Anon Privilege Denied)
- [ ] Document overlap with 001.2
- [ ] Verify privilege layer enforcement
- [ ] Acknowledge environment limitation (cannot test RPC body independently)

### CMG-RT-001.5 (Atomic Rollback)
- [ ] Count before/after failure
- [ ] No new outbox records
- [ ] No new idempotency records
- [ ] No new audit records
- [ ] Specific test key does NOT exist

### CMG-RT-001.6 (Atomic Success)
- [ ] Outbox record exists
- [ ] Idempotency record exists
- [ ] Audit record exists
- [ ] All 3 reference same outbox_id
- [ ] Tenant/actor consistent

### CMG-RT-001.7 (Sequential Idempotency)
- [ ] First request → success
- [ ] Second request → 23505
- [ ] Database: exactly 1 outbox (from first request)

### CMG-RT-001.8 (Submission Does Not Trigger Processing)
- [ ] Outbox status = PENDING
- [ ] No processor invocation
- [ ] No automatic state transition

### CMG-RT-001.9 (Async Boundary Behavioral Proof)
- [ ] Baseline Finance emission count
- [ ] submitIntent() → PENDING
- [ ] Wait → still PENDING
- [ ] Finance emission count unchanged (behavioral proof)
- [ ] processOutboxOnce() → PUBLISHED
- [ ] Finance emission count +1 (behavioral proof)

### CMG-RT-001.10 (Business/Structural Boundary)
- [ ] Structural invalid → REJECT (e.g., amount = "string")
- [ ] Business invalid (but structurally valid) → ACCEPT
- [ ] RPC persists, Finance OS validates business rules

---

## Status

```
Quality Standards:      🔴 DEFINED (mandatory)
Test Implementation:    ⬜ NOT YET CREATED
Quality Review:         ⬜ PENDING (after implementation)
Pre-Flight Validation:  🔴 BLOCKED (5 blockers + quality gate)
```

---

**Version:** 1.0  
**Status:** 🔴 MANDATORY  
**Applies To:** All Runtime 3C security tests  
**Review Required:** YES (before declaring 10/10 PASS)
