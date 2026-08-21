# Bella Runtime Pre-Flight Execution Plan

**Date:** 2026-08-19  
**Phase:** Pre-Flight Validation  
**Scope:** ⚠️ **EXTREMELY NARROW** (test harness fixes ONLY)  
**Status:** 🔴 READY TO EXECUTE  

---

## Execution Scope (RESTRICTED)

### ✅ ALLOWED

**Fix 5 Pre-Flight Blockers:**
1. Test count documentation (remove duplicate 001.7)
2. Concurrent idempotency test (filter by key, not global count)
3. Atomic rollback test (before/after comparison, not empty DB assumption)
4. Tenant source test (query `users.tenant_id`, not `user_metadata`)
5. Test overlap documentation (document 001.2 vs 001.4 limitation)

**Verify:**
6. Re-run pre-flight validation (6/6 PASS)
7. Freeze test artifact
8. Hash Migration 04 v1.1 (SHA-256)

**Document:**
9. Pre-flight completion evidence
10. Request Migration APPLY approval

---

### ❌ NOT ALLOWED

**DO NOT:**
- ❌ Modify Migration 04 v1.1 (frozen for validation)
- ❌ APPLY migration to database
- ❌ Run runtime security tests (requires migration applied)
- ❌ Implement Week 2 features
- ❌ Create new architecture documents
- ❌ Research alternative transaction models
- ❌ Modify existing runtime code
- ❌ Push to database (supabase db push)
- ❌ Proceed past STOP boundary

---

## 4-Step Pre-Flight Sequence

```
Step 1: FIX TEST HARNESS
    ↓ (5 blockers, test code/documentation only)
    
Step 2: PRE-FLIGHT 6/6
    ↓ (verify all blockers resolved)
    
Step 3: FREEZE ARTIFACTS
    ↓ (test artifact + migration SHA-256)
    
Step 4: ⛔ STOP
    ↓
    REQUEST MIGRATION APPLY APPROVAL
    ↓
    [BOUNDARY — DO NOT CROSS]
```

**Current Position:** Ready for Step 1

**STOP Boundary:** After Step 4, agent MUST NOT proceed without explicit Migration APPLY approval.

---

## Step 1: Fix Test Harness (5 Blockers)

### Blocker 1: Test Count Documentation

**Issue:** Test 001.7 counted twice (P0 and TB sections)

**File to Update:** `docs/architecture/BELLA_RUNTIME_CONTROLLED_MIGRATION_GATE.md`

**Fix:**
- Remove 001.7 from TB section
- Keep 001.7 only in P0 Idempotency section
- Update execution order to reflect 10 tests (not 11)

**Test Allocation (Corrected):**
| Category | Tests | Count |
|----------|-------|-------|
| Caller Identity | 001.1, 001.2 | 2 |
| Privilege Boundary | 001.4 | 1 |
| Idempotency | 001.3, 001.7 | 2 |
| Atomicity | 001.5, 001.6 | 2 |
| Async Boundary | 001.8, 001.9 | 2 |
| Business Boundary | 001.10 | 1 |
| **TOTAL** | | **10** |

**Validation:** Count tests in documentation = 10 (not 11)

---

### Blocker 2: Concurrent Idempotency Test

**Issue:** Test assumes empty database (counts all records)

**File to Create:** `tests/e2e/runtime/3c-security-gate.e2e.test.ts` (when ready)

**Fix (Test Code):**
```typescript
test('CMG-RT-001.3: Concurrent idempotency (P0)', async () => {
  const idempotencyKey = `cmg-concurrent-${Date.now()}-${Math.random()}`;
  
  // Concurrent requests with SAME key
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
  const successes = results.filter(r => 
    r.status === 'fulfilled' && r.value.data && !r.value.error
  );
  const failures = results.filter(r => 
    r.status === 'fulfilled' && r.value.error?.code === '23505'
  );
  
  expect(successes.length).toBe(1);
  expect(failures.length).toBe(1);
  
  // Extract outbox_id
  const outboxId = successes[0].value.data;
  
  // ✅ Verify database: Filter by THIS idempotency key
  const { data: idempotencyRecords } = await supabase
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('idempotency_key', idempotencyKey);
  
  expect(idempotencyRecords).toHaveLength(1);
  
  const { data: outboxRecords } = await supabase
    .from('runtime_outbox')
    .select('*')
    .eq('outbox_id', outboxId);
  
  expect(outboxRecords).toHaveLength(1);
  
  const { data: auditRecords } = await supabase
    .from('runtime_audit_log')
    .select('*')
    .eq('outbox_id', outboxId)
    .eq('action', 'INTENT_SUBMITTED');
  
  expect(auditRecords).toHaveLength(1);
});
```

**Key Change:** Filter by `idempotency_key` (test-specific), NOT count all records.

---

### Blocker 3: Atomic Rollback Test

**Issue:** Test assumes empty database (checks global count = 0)

**Fix (Test Code):**
```typescript
test('CMG-RT-001.5: Atomic rollback (TB)', async () => {
  const idempotencyKey = `cmg-rollback-${Date.now()}-${Math.random()}`;
  
  // Count BEFORE failure
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
  
  // Count AFTER failure
  const { count: outboxAfter } = await supabase
    .from('runtime_outbox')
    .select('*', { count: 'exact', head: true });
  
  const { count: idempotencyAfter } = await supabase
    .from('runtime_idempotency_registry')
    .select('*', { count: 'exact', head: true });
  
  const { count: auditAfter } = await supabase
    .from('runtime_audit_log')
    .select('*', { count: 'exact', head: true });
  
  // ✅ Verify NO NEW RECORDS (compare before/after)
  expect(outboxAfter).toBe(outboxBefore);
  expect(idempotencyAfter).toBe(idempotencyBefore);
  expect(auditAfter).toBe(auditBefore);
  
  // ✅ Verify specific test key does NOT exist
  const { data: idempotencyCheck } = await supabase
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('idempotency_key', idempotencyKey);
  
  expect(idempotencyCheck).toHaveLength(0);
});
```

**Key Change:** Snapshot counts before/after, NOT assume empty database.

---

### Blocker 4: Tenant Source Test

**Issue:** Test queries `user_metadata.tenant_id` (wrong source)

**Correct Source:** `public.users.tenant_id` (verified from migration 20260521000004)

**Fix (Test Code):**
```typescript
test('CMG-RT-001.1: Tenant identity from JWT (P0)', async () => {
  const session = await supabase.auth.getSession();
  const userId = session.data.session?.user?.id;
  
  expect(userId).toBeDefined();
  
  // ✅ Query users.tenant_id (source of truth for get_auth_tenant_id())
  const { data: userData } = await supabase
    .from('users')
    .select('tenant_id')
    .eq('id', userId)
    .single();
  
  const expectedTenantId = userData?.tenant_id;
  expect(expectedTenantId).toBeDefined();
  
  // Submit intent
  const idempotencyKey = `cmg-tenant-${Date.now()}-${Math.random()}`;
  const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
    p_idempotency_key: idempotencyKey,
    p_intent_type: 'INVOICE_PAYMENT',
    p_intent_payload: { amount: 1000 }
  });
  
  expect(error).toBeNull();
  
  // Verify tenant_id derived from JWT (via users table)
  const { data: outbox } = await supabase
    .from('runtime_outbox')
    .select('tenant_id, actor_id')
    .eq('outbox_id', outboxId)
    .single();
  
  expect(outbox.tenant_id).toBe(expectedTenantId);
  expect(outbox.actor_id).toBe(userId);
});
```

**Key Change:** Query `users.tenant_id`, NOT `user_metadata.tenant_id`.

---

### Blocker 5: Test Overlap Documentation

**Issue:** Tests 001.2 and 001.4 verify same privilege layer

**File to Update:** `docs/architecture/BELLA_RUNTIME_CONTROLLED_MIGRATION_GATE.md`

**Fix (Documentation):**

Add note to Test 001.4:
```markdown
**Test 4: SG-RT-02.1 - Anon Role Execution Denied**

**Note:** This test verifies the same boundary as Test 001.2 (PostgreSQL privilege layer).

In Supabase environment, anon client cannot bypass `GRANT/REVOKE` to test RPC body logic independently.

Both tests verify:
- PostgreSQL privilege boundary (anon denied EXECUTE on function)
- NOT RPC body authentication logic (Layer 2)

**Environment Limitation:** Cannot independently test RPC body's explicit tenant validation without privilege bypass mechanism.

**Decision:** Keep both tests but acknowledge they verify same layer (privilege boundary enforcement).
```

**Key Change:** Document that both tests verify privilege layer, acknowledge environment limitation.

---

## Step 2: Pre-Flight 6/6 Verification

**Actions:**

1. Re-count tests in documentation (should be 10)
2. Review test code fixes (Blockers 2-4)
3. Review documentation fixes (Blockers 1, 5)
4. Verify baseline still 191 (no regression)
5. Verify Migration 04 v1.1 unchanged (frozen)

**Exit Criteria:**
- [ ] Blocker 1: Test count = 10 (documentation corrected)
- [ ] Blocker 2: Concurrent test filters by key (code corrected)
- [ ] Blocker 3: Rollback test compares before/after (code corrected)
- [ ] Blocker 4: Tenant source = `users.tenant_id` (code corrected)
- [ ] Blocker 5: Test overlap documented (documentation corrected)
- [ ] Blocker 6: Baseline 191 verified ✅ (already complete)

**Validation Command:**
```bash
# Verify no regression in existing tests
npm run test:runtime:3a  # Should still be 79/79
npm run test:runtime:3b  # Should still be 97/97
npm run test:runtime:3c:infra  # Should still be 5/5
```

**Result:** Pre-flight 6/6 PASS

---

## Step 3: Freeze Artifacts

### 3.1 Freeze Test Artifact

**File:** `tests/e2e/runtime/3c-security-gate.e2e.test.ts` (when created)

**Action:**
1. Finalize test code (10 tests with quality standards)
2. No further changes allowed after freeze
3. Document test version: `CMG Runtime Tests v1.0`

**Freeze Declaration:**
```markdown
# Test Artifact Freeze

**File:** tests/e2e/runtime/3c-security-gate.e2e.test.ts
**Version:** CMG Runtime Tests v1.0
**Date:** 2026-08-19
**Tests:** 10 (001.1 through 001.10)
**Status:** FROZEN (no changes during gate execution)

**SHA-256:** [to be calculated after file creation]
```

---

### 3.2 Hash Migration Artifact

**File:** `supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql`

**Action:**
```bash
# Calculate SHA-256 hash
certutil -hashfile "supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql" SHA256
```

**Document Hash:**
```markdown
# Migration Artifact Freeze

**File:** supabase/migrations/20260819000004_runtime_submit_intent_rpc.sql
**Version:** Migration 04 v1.1
**Date:** 2026-08-19
**Status:** FROZEN FOR VALIDATION (not applied)

**SHA-256:** [hash value]

**Immutability Declaration:** 
This migration artifact is frozen for validation. Any modifications require:
1. Version bump to v1.2
2. Gate restart from Step 1
3. Re-approval from Architect
```

---

## Step 4: ⛔ STOP — Request Migration APPLY Approval

**MANDATORY STOP BOUNDARY**

After completing Steps 1-3, agent MUST:

1. ✅ Document pre-flight completion
2. ✅ Document artifact freeze (both test + migration)
3. ⛔ **STOP execution**
4. 📋 **REQUEST Migration APPLY approval**

**DO NOT:**
- ❌ APPLY migration automatically
- ❌ Run `supabase db push`
- ❌ Proceed to runtime tests
- ❌ Continue to Week 2 implementation

**Request Format:**
```markdown
# Migration APPLY Approval Request

**Pre-Flight Status:** 6/6 PASS
**Test Artifact:** FROZEN (CMG Runtime Tests v1.0, SHA-256: [hash])
**Migration Artifact:** FROZEN (Migration 04 v1.1, SHA-256: [hash])
**Canonical Baseline:** 191 (79 + 97 + 5 + 10)

**Requesting Approval To:**
- APPLY Migration 04 v1.1 to Supabase database
- Proceed to Step 5: Verify RPC metadata (6 checks)
- Proceed to Step 6: Run 10 runtime tests

**Blocked Until:** Architect approves Migration APPLY

**Status:** ⛔ AWAITING APPROVAL
```

---

## Approval Boundary

```
┌───────────────────────────┐
│ PRE-FLIGHT COMPLETE       │
│ - 6/6 blockers resolved   │
│ - Test artifact frozen    │
│ - Migration artifact hash │
└──────────┬────────────────┘
           │
           ▼
     ⛔ STOP HERE ⛔
           │
           │ [APPROVAL REQUIRED]
           │
           ▼
┌───────────────────────────┐
│ Migration APPLY Approval  │
│ (Architect or Authorized) │
└──────────┬────────────────┘
           │
           ▼
┌───────────────────────────┐
│ APPLY Migration 04 v1.1   │
│ → Metadata Verification   │
│ → Runtime Tests 10/10     │
│ → Regression 191/191      │
└───────────────────────────┘
```

**Current Position:** Steps 1-4 authorized, Steps 5-10 require separate approval

---

## Success Criteria (Pre-Flight Phase)

**Checkpoint Complete When:**
- [x] Architecture v1.1 approved ✅
- [x] Design security gate PASS ✅
- [x] Baseline 191 verified ✅
- [ ] 5 blockers fixed ⬜
- [ ] Pre-flight 6/6 PASS ⬜
- [ ] Test artifact frozen ⬜
- [ ] Migration artifact hashed ⬜
- [ ] STOP boundary reached ⬜
- [ ] Migration APPLY approval requested ⬜

**NOT Required for Pre-Flight:**
- ❌ Migration applied
- ❌ Runtime tests executed
- ❌ Week 2 implementation

---

## Risk Mitigation

### Risk 1: Agent Proceeds Past STOP Boundary

**Mitigation:** Explicit STOP boundary documented, agent instructions clear

**If Violated:** Rollback unauthorized actions, restart from pre-flight

---

### Risk 2: Migration Modified During Pre-Flight

**Mitigation:** Migration 04 v1.1 frozen, SHA-256 hash verification

**If Violated:** Gate invalidated, restart from Step 1 with v1.2

---

### Risk 3: Test Quality Insufficient

**Mitigation:** Test Quality Requirements document (behavioral proof mandatory)

**If Violated:** Mark tests as FAIL (quality), fix tests, restart pre-flight

---

## Execution Status

```
Pre-Flight Plan:         🟢 DEFINED
Step 1 (Fix 5 Blockers): ⬜ READY TO EXECUTE
Step 2 (Verify 6/6):     ⬜ PENDING
Step 3 (Freeze):         ⬜ PENDING
Step 4 (STOP):           ⛔ BOUNDARY NOT YET REACHED

Migration APPLY:         🔒 NOT AUTHORIZED
Runtime Tests:           🔒 NOT AUTHORIZED
Week 2:                  🔒 NOT AUTHORIZED
```

---

## Document References

1. `BELLA_RUNTIME_CMG_PREFLIGHT_VALIDATION.md` — 6 blockers detailed
2. `BELLA_RUNTIME_TEST_QUALITY_REQUIREMENTS.md` — Quality standards
3. `BELLA_RUNTIME_CONTROLLED_MIGRATION_GATE.md` — Full gate plan
4. `BELLA_RUNTIME_PHASE_3C_ARCHITECT_SIGN_OFF.md` — Approval scope

---

**Execution Authority:** ✅ APPROVED (Pre-Flight Phase Only)  
**STOP Boundary:** ⛔ MANDATORY (after Step 4)  
**Next Approval Required:** Migration APPLY (Steps 5-10)
