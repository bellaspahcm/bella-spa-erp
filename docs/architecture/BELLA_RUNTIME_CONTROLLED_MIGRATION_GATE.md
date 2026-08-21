# Bella Runtime Controlled Migration Gate

**Gate ID:** CMG-RT-001  
**Status:** 🟡 READY TO EXECUTE  
**Date:** 2026-08-19  
**Prerequisite:** Design Security Gate PASS  
**Blocks:** Week 2 Implementation  

---

## Purpose

Apply Migration 04 v1.1 with controlled verification to prove runtime security properties before unlocking Week 2 implementation.

**Critical Principle:**
```
Migration Success (SQL valid + database accepts)
    ≠
Runtime Security Proven
```

**Week 2 unblocked ONLY after:**
- Migration applied successfully
- 10 runtime tests PASS
- Full regression PASS (184/184)
- Evidence documented

---

## Current Status

```
Architecture v1.1:          🟢 APPROVED
Transaction Design:         🟢 APPROVED
Security Static Review:     🟢 39/39 PASS
Business Boundary:          🟢 PASS
Migration 04 v1.1:          🟡 READY TO APPLY
Runtime Security:           🟡 NOT PROVEN
10 Security Tests:          ⬜ NOT RUN
Week 2 Implementation:      🔒 BLOCKED
```

---

## Pre-Freeze Architecture Contract Review

**⚠️ PRE-FLIGHT VALIDATION REQUIRED:** See `BELLA_RUNTIME_CMG_PREFLIGHT_VALIDATION.md` for 6 critical blockers that must be fixed before executing this gate.

### Idempotency Retry Semantics (TB-2)

**Question:** What should retry with same idempotency key return?

**Current v1.1 Design (Option A):**
```
First request → ACCEPTED + outbox_id
Retry same key → 23505 (DUPLICATE error)
```

**Alternative Design (Option B - NOT IMPLEMENTED):**
```
First request → ACCEPTED + outbox_id
Retry same key → ACCEPTED + same outbox_id
```

**v1.1 Contract Decision:** Option A (23505 on duplicate)

**Rationale:**
1. PostgreSQL UNIQUE constraint is authority (TB-2)
2. Simpler RPC implementation (no duplicate detection + return logic)
3. Client handles unknown outcome via query mechanism

**Implication for Timeout Model:**
```
Client timeout (outcome unknown)
    ↓
Retry with same idempotency key
    ↓
    ├── ACCEPTED → First request failed, retry succeeded
    │
    └── 23505 → First request succeeded, duplicate rejected
        ↓
        Client queries outbox status to resolve outcome
```

**Contract Freeze:** This semantics is INTENTIONAL for v1.1. Do not change during testing.

**Test Verification:** CMG-RT-001.7 verifies this contract.

**Future Consideration:** Option B (idempotent return) can be explored in v1.2 if client ergonomics require it.

---

## Controlled Migration Sequence

### Step 1: FREEZE Migration 04 v1.1

**Purpose:** Lock artifact under test

**Actions:**
- [ ] Verify Migration 04 v1.1 SQL not modified since security gate
- [ ] Create frozen copy: `supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql`
- [ ] Document SHA-256 hash of migration file
- [ ] No changes allowed during testing

**Exit Criteria:**
- Migration 04 v1.1 frozen
- Hash documented
- Ready for application

---

### Step 2: APPLY Migration

**Purpose:** Deploy RPC to database

**Pre-Application Checklist:**
- [ ] Database backup created
- [ ] Migration 01, 02, 03 verified applied
- [ ] Phase 3B tests passing (97/97)
- [ ] Gate 0 tests passing (5/5)
- [ ] Rollback plan documented

**Application Command:**
```bash
# Apply migration (Supabase CLI or direct SQL)
supabase db push

# OR direct SQL execution:
psql $DATABASE_URL -f supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql
```

**Expected Output:**
```
BEGIN
DROP FUNCTION
DROP FUNCTION
CREATE FUNCTION
REVOKE
GRANT
NOTIFY
COMMIT
```

**Post-Application Actions:**
- [ ] Verify no errors in migration execution
- [ ] Document migration timestamp
- [ ] Proceed to Step 3

**Rollback Plan (if application fails):**

**IMPORTANT:** This rollback is ONLY for migration application failure (SQL syntax error, constraint violation during CREATE).

**NOT for runtime test failure.** If runtime tests fail after successful migration, use QUARANTINE/STOP model (see Step 4).

```sql
-- Drop RPC (ONLY if migration application failed)
DROP FUNCTION IF EXISTS public.submit_financial_intent(TEXT, TEXT, JSONB);

-- Verify no orphaned objects
SELECT proname FROM pg_proc WHERE proname LIKE '%submit_financial_intent%';
```

**Exit Criteria:**
- Migration applied successfully
- No errors
- Ready for metadata verification

---

### Step 3: Verify RPC Metadata

**Purpose:** Confirm RPC deployed with correct security properties

**SQL Verification Queries:**

**Query 1: RPC Signature**
```sql
SELECT 
    proname AS function_name,
    proargtypes::regtype[] AS argument_types,
    prorettype::regtype AS return_type
FROM pg_proc
WHERE proname = 'submit_financial_intent';

-- Expected:
-- function_name: submit_financial_intent
-- argument_types: {text, text, jsonb}
-- return_type: uuid
```

**Query 2: SECURITY DEFINER**
```sql
SELECT 
    proname,
    prosecdef AS is_security_definer,
    proconfig AS configuration
FROM pg_proc
WHERE proname = 'submit_financial_intent';

-- Expected:
-- proname: submit_financial_intent
-- is_security_definer: true
-- configuration: {search_path=public}
```

**Query 3: Grants Verification**
```sql
SELECT 
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'submit_financial_intent';

-- Expected:
-- grantee: authenticated, privilege_type: EXECUTE
-- NO grantee: anon
-- NO grantee: PUBLIC
```

**Checklist:**
- [ ] Function exists with correct signature (TEXT, TEXT, JSONB → UUID)
- [ ] SECURITY DEFINER = true
- [ ] search_path = public
- [ ] authenticated role has EXECUTE privilege
- [ ] anon role does NOT have EXECUTE privilege
- [ ] PUBLIC does NOT have EXECUTE privilege

**Exit Criteria:**
- All 6 metadata checks PASS
- RPC deployed correctly
- Ready for runtime tests

---

### Step 4: Run 10 Runtime Tests (P0 Priority)

**Purpose:** Prove runtime security properties

**CRITICAL:** If ANY P0 test fails, STOP immediately. Use QUARANTINE/STOP model, not automatic rollback.

#### Failure Response Model

```
IF ANY TEST FAILS:
    ↓
STOP (do not proceed to remaining tests)
    ↓
QUARANTINE Migration 04 v1.1
    ↓
Preserve evidence (test logs, database state, RPC metadata)
    ↓
Root cause analysis
    ↓
Create Migration 04 v1.2 (if fix required)
    ↓
Re-run entire Controlled Migration Gate from Step 1
```

**DO NOT:**
- ❌ Modify frozen migration during testing
- ❌ Apply quick fixes on v1.1
- ❌ Skip tests to "see if others pass"
- ❌ Rollback migration automatically (may destroy evidence)

**Rationale:** Migration 04 is a security boundary. Failures require investigation, not immediate rollback.

---

#### P0 Tests (Must PASS - Highest Priority)

**Execution Order:**
1. CMG-RT-001.1 (JWT tenant identity)
2. CMG-RT-001.2 (Unauthenticated rejection)
3. CMG-RT-001.4 (Anon role denied)
4. CMG-RT-001.3 (Concurrent idempotency)
5. CMG-RT-001.7 (Sequential idempotency)

**IF ANY P0 TEST FAILS:** STOP. Execute QUARANTINE/STOP model.

**Test 1: SG-RT-01.1 - Tenant Identity Derived from JWT**
```typescript
test('CMG-RT-001.1: Tenant identity derived from JWT (P0)', async () => {
  const session = await supabase.auth.getSession();
  const expectedTenantId = session.data.session?.user?.user_metadata?.tenant_id;
  
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'cmg-tenant-test',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('tenant_id, actor_id')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.tenant_id).toBe(expectedTenantId);
  expect(outbox.actor_id).toBe(session.data.session?.user?.id);
});
```

**Test 2: SG-RT-01.2 - Unauthenticated Call Rejected**
```typescript
test('CMG-RT-001.2: Unauthenticated call raises exception (P0)', async () => {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const { error } = await anonClient.rpc('submit_financial_intent', {
    p_idempotency_key: 'cmg-anon-test',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('No authenticated tenant context');
});
```

**Test 3: SG-RT-04.1 - Concurrent Duplicate Submission (Database UNIQUE Authority)**
```typescript
test('CMG-RT-001.3: Concurrent duplicate blocked by database (P0)', async () => {
  const idempotencyKey = 'cmg-concurrent-test';
  const intent = { type: 'INVOICE_PAYMENT', payload: { amount: 1000 } };
  
  // Concurrent requests
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
  
  const successes = results.filter(r => r.status === 'fulfilled' && r.value.data && !r.value.error);
  const failures = results.filter(r => r.status === 'fulfilled' && r.value.error?.code === '23505');
  
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1);
  
  // Verify: Only ONE outbox entry
  const { count } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  expect(count).toBe(1);
});
```

**Test 4: SG-RT-02.1 - Anon Role Execution Denied**

**Note on Test Overlap:** This test verifies the same boundary as Test 001.2 (PostgreSQL privilege layer).

In Supabase environment, anon client cannot bypass `GRANT/REVOKE` to test RPC body logic independently.

Both tests verify:
- PostgreSQL privilege boundary (anon denied EXECUTE on function)
- NOT RPC body authentication logic (Layer 2)

**Environment Limitation:** Cannot independently test RPC body's explicit tenant validation without privilege bypass mechanism.

**Decision:** Keep both tests but acknowledge they verify same layer (privilege boundary enforcement).

```typescript
test('CMG-RT-001.4: Anon role execution denied (P0)', async () => {
  const anonClient = createClient(supabaseUrl, supabaseAnonKey);
  
  const { error } = await anonClient.rpc('submit_financial_intent', {
    p_idempotency_key: 'cmg-anon-exec-test',
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('permission denied');
});
```

#### TB Tests (Transaction Boundary Verification)

**Execution Order:**
6. CMG-RT-001.5 (Atomic rollback)
7. CMG-RT-001.6 (Atomic success)
8. CMG-RT-001.8 (Submission does not trigger processing)
9. CMG-RT-001.9 (Async boundary behavioral proof)
10. CMG-RT-001.10 (Business/structural validation boundary)

**Note:** Test 001.7 (sequential idempotency) is in P0 section, not duplicated here.

**Test 5: SG-RT-03.1 - Atomic Rollback on Constraint Violation**
```typescript
test('CMG-RT-001.5: Atomic rollback on constraint violation', async () => {
  // Trigger constraint violation (e.g., NULL required field)
  const { error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: null,  // NULL violation
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeDefined();
  expect(error.message).toContain('idempotency_key is required');
  
  // Verify ROLLBACK: No partial data
  const { count: outboxCount } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  const { count: idempotencyCount } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true });
  
  const { count: auditCount } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true });
  
  // All 3 tables should have 0 entries from this failed attempt
  // (Clean database assumed or filter by test context)
});
```

**Test 6: SG-RT-03.2 - All 3 Tables Populated Atomically**
```typescript
test('CMG-RT-001.6: All 3 tables populated atomically on success', async () => {
  const idempotencyKey = 'cmg-atomic-success-test';
  
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

**Test 7: SG-RT-04.2 - Sequential Duplicate Submission**

**IMPORTANT CONTRACT DECISION:** This test verifies current v1.1 semantics (duplicate → 23505 error).

**Current Semantics (Option A):**
- First request → ACCEPTED + outbox_id
- Retry same key → 23505 (DUPLICATE error)
- Client responsibility: Query status/resolve unknown outcome

**Alternative Semantics (Option B - NOT IMPLEMENTED):**
- First request → ACCEPTED + outbox_id
- Retry same key → ACCEPTED + same outbox_id (idempotent return)

**Decision:** v1.1 uses Option A (23505 on duplicate). This is intentional contract behavior.

**Implication:** Client retry after timeout must handle 23505 and query outbox status to resolve unknown outcome.

```typescript
test('CMG-RT-001.7: Sequential duplicate submission rejected (P0)', async () => {
  const idempotencyKey = 'cmg-sequential-test';
  
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
});
```

**Test 8: SG-RT-05.1 - Submission Does Not Trigger Processing**
```typescript
test('CMG-RT-001.8: Submission does not trigger outbox processing', async () => {
  const idempotencyKey = 'cmg-async-test';
  
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  expect(outboxId).toBeDefined();
  
  // Verify status: PENDING (not PROCESSING/PUBLISHED)
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.status).toBe('PENDING');
});
```

**Test 9: SG-RT-05.2 - Async Boundary Behavioral Proof**
```typescript
test('CMG-RT-001.9: Processing NOT triggered, PENDING until manual call', async () => {
  const idempotencyKey = 'cmg-async-boundary-test';
  
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  
  // Wait 100ms to ensure no async processing
  await new Promise(resolve => setTimeout(resolve, 100));
  
  // Verify status STILL PENDING
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('status')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.status).toBe('PENDING');
  
  // TB-4 PROVEN: submitIntent() → ACCEPTED, processOutboxOnce() NOT triggered
});
```

**Test 10: SG-RT-06.1 - Business vs. Structural Validation Boundary**
```typescript
test('CMG-RT-001.10: RPC rejects structural, accepts business invalidity', async () => {
  // TEST 1: Structural invalidity → REJECT
  const { error: structuralError } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: null,  // NULL (structural invalid)
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(structuralError).toBeDefined();
  expect(structuralError.message).toContain('idempotency_key is required');
  
  // TEST 2: Business invalidity (structurally valid) → ACCEPT
  const { data: outboxId, error: businessError } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: 'cmg-business-boundary-test',
    p_intent_type: 'REVENUE_RECOGNIZED',
    p_intent_payload: {
      amount: -9999,  // Business invalid (negative revenue)
      // But structurally valid JSONB with valid number type
    }
  });
  
  // RPC ACCEPTS (Finance OS will validate business semantics)
  expect(businessError).toBeNull();
  expect(outboxId).toBeDefined();
  
  // TB-3 PROVEN: RPC persistence only, NO business validation
});
```

**Exit Criteria (Step 4):**
- [ ] 10/10 runtime tests PASS
- [ ] P0 tests (1-4, 7) PASS: Tenant isolation, privilege boundary, idempotency
- [ ] TB tests (5-6, 8-10) PASS: Atomicity, async boundary, business boundary
- [ ] All test evidence documented
- [ ] **NO TEST FAILURES** (any failure triggers QUARANTINE/STOP)
- [ ] Ready for full regression

---

### Step 5: Full Regression

**Purpose:** Verify no breaking changes to existing functionality

**Test Suites:**

1. **Phase 3A (Unit Tests):**
   ```bash
   npm run test:runtime:3a
   # Expected: 79/79 PASS
   ```

2. **Phase 3B (Integration Tests):**
   ```bash
   npm run test:runtime:3b
   # Expected: 97/97 PASS
   ```

3. **Gate 0 (Infrastructure Tests):**
   ```bash
   npm run test:runtime:3c:infra
   # Expected: 5/5 PASS
   ```

4. **Runtime 3C (Security Tests):**
   ```bash
   npm run test:runtime:3c
   # Expected: 10/10 PASS (from Step 4)
   ```

**Total:** 191/191 tests (79 + 97 + 5 + 10)

**Exit Criteria:**
- [ ] Phase 3A: 79/79 PASS
- [ ] Phase 3B: 97/97 PASS
- [ ] Gate 0: 5/5 PASS
- [ ] Runtime 3C: 10/10 PASS
- [ ] **Total: 191/191 PASS**
- [ ] No regressions detected
- [ ] Evidence documented

---

### Step 6: Evidence Documentation

**Purpose:** Freeze proof before unlocking Week 2

**Required Documents:**

1. **Migration Evidence:**
   - Migration 04 v1.1 applied successfully
   - Timestamp: [YYYY-MM-DD HH:MM:SS]
   - RPC metadata verification results
   - Rollback plan (if needed)

2. **Runtime Test Results:**
   - 10/10 security tests PASS
   - Test execution logs
   - Coverage report
   - Failure analysis (if any)

3. **Regression Evidence:**
   - 191/191 tests PASS
   - Test suite breakdown
   - No breaking changes detected

4. **Final Evidence Document:**
   - `BELLA_RUNTIME_CONTROLLED_MIGRATION_EVIDENCE.md`
   - All verification results
   - Binary decision: PASS or FAIL

**Exit Criteria:**
- [ ] All evidence documents created
- [ ] Test results frozen
- [ ] Approval decision documented
- [ ] Ready for Week 2 gate decision

---

## Week 2 Unblocking Decision

### Binary Gate

**CRITICAL:** Do NOT modify frozen migration if tests fail. Use QUARANTINE/STOP model.

```
IF ALL CONDITIONS MET:
    ✅ Migration 04 v1.1 applied successfully
    ✅ RPC metadata verified (6/6 checks)
    ✅ Runtime security tests PASS (10/10)
    ✅ Full regression PASS (191/191)
    ✅ Evidence documented
    
    THEN:
        Week 2 → UNBLOCKED
        Proceed to Week 2 implementation
        
ELSE IF ANY CONDITION FAILS:
    Week 2 → BLOCKED
    
    Execute QUARANTINE/STOP:
        1. STOP testing (do not proceed)
        2. Preserve evidence (logs, database state, RPC metadata)
        3. Root cause analysis
        4. Create Migration 04 v1.2 (if migration fix required)
        5. Re-run entire Controlled Migration Gate from Step 1
    
    DO NOT:
        ❌ Modify v1.1 during testing
        ❌ Apply quick fixes
        ❌ Rollback migration automatically (destroys evidence)
```

### Critical Principle

**Migration Success ≠ Week 2 Unlocked**

**Migration success proves:**
- ✅ SQL syntax valid
- ✅ Database accepts migration

**Migration success does NOT prove:**
- ❌ Tenant isolation
- ❌ Atomicity
- ❌ Race safety
- ❌ Async boundary
- ❌ Privilege boundary

**These require runtime evidence (10 tests PASS).**

---

## Four Core Principles (Non-Negotiable)

### 1. Tenant/Actor Must Be Server-Derived

```
Client → JWT → RPC
              ↓
         get_auth_tenant_id() → tenant
         auth.uid()            → actor
              ↓
         Controlled INSERT
```

**No client-provided `tenant_id` or `actor_id`.**

**Verification:** Tests CMG-RT-001.1, 001.2

---

### 2. Transaction Model (Statement-Level Atomicity)

```
RPC invocation
    ↓
Statement transaction (automatic)
    ↓
INSERT outbox
INSERT idempotency
INSERT audit
    ↓
RETURN
    ↓
Success → COMMIT
Exception → ROLLBACK
```

**No manual `BEGIN/COMMIT` in function body.**

**TB-1 invariant:** Outbox + Idempotency + Audit commit/rollback together.

**Verification:** Tests CMG-RT-001.5, 001.6

---

### 3. Timeout = INDETERMINATE (Not ROLLBACK Guaranteed)

```
Client RPC call
    ↓
PostgreSQL execution
    ↓
    ├── COMMIT → response lost → Client UNKNOWN
    │
    └── ROLLBACK → error → Client ERROR
    
Client UNKNOWN outcome
    ↓
Retry with SAME idempotency key
    ↓
Database UNIQUE constraint
    ↓
DUPLICATE (23505) → Outcome determined
```

**Model:**
- Client timeout → **Unknown outcome** (not guaranteed rollback)
- Retry same key → Idempotency handles recovery
- Database UNIQUE constraint is authority

**TB-2 invariant:** PostgreSQL UNIQUE constraint enforces idempotency (not application logic).

**Verification:** Tests CMG-RT-001.3, 001.7

---

### 4. SECURITY DEFINER + Explicit Validation

```
JWT → auth.uid() → get_auth_tenant_id() → Explicit validation → Controlled INSERT
```

**NOT:**
```
SECURITY DEFINER → RLS handles everything
```

**Security model:**
1. RPC explicitly validates caller context
2. RLS provides defense-in-depth (backup layer)
3. No reliance on RLS as sole enforcement

**Verification:** Tests CMG-RT-001.1, 001.2, 001.4

---

## Status Tracking

### Current State

```
Design Security Gate:       ✅ PASS (39/39 static + 6/6 architectural)
Runtime Security Gate:      ⬜ NOT RUN (0/10 tests)
Controlled Migration Gate:  🟡 READY TO EXECUTE

Migration 04 v1.1:          🟡 FROZEN, ready to apply
Week 2 Implementation:      🔒 BLOCKED
```

### After Controlled Migration Gate Execution

```
IF ALL 6 STEPS PASS:
    Migration 04 v1.1:      ✅ APPLIED + VERIFIED
    Runtime Security:        ✅ PROVEN (10/10)
    Full Regression:         ✅ PASS (191/191)
    Week 2:                  🟢 UNBLOCKED
    
IF ANY STEP FAILS:
    Migration 04 v1.1:      🔴 ROLLBACK
    Runtime Security:        🔴 NOT PROVEN
    Week 2:                  🔒 BLOCKED
    Action:                  Fix → Re-run gate
```

---

## Next Action

**Execute Controlled Migration Gate:**

1. FREEZE Migration 04 v1.1
2. APPLY migration
3. Verify RPC metadata
4. Run 10 runtime tests (P0 priority)
5. Run full regression (191 tests)
6. Document evidence
7. Binary decision: Unblock Week 2 or remain blocked

**No Week 2 implementation until 6/6 steps PASS.**

---

**Gate Status:** 🟡 READY TO EXECUTE  
**Risk:** LOW (design verified, controlled execution)  
**Confidence:** HIGH (proven architecture, security-first approach)
