# Bella Runtime Phase 3C Week 2 — Implementation Plan v1.1

**Document Version:** 1.1.0  
**Date:** 2026-08-18  
**Status:** 🟡 DRAFT — Awaiting Final Approval  
**Phase:** Phase 3C Week 2 — Runtime Submission Boundary + E2E Happy Path  
**Supersedes:** Week 2 Plan v1.0.0 (REJECTED)

---

## Revision History

**v1.0.0 → v1.1.0 Changes:**
1. ✅ Clarified `submitIntent()` async boundary (persist only, no emission)
2. ✅ Renamed `processOutbox()` → `processOutboxOnce()` (test-controlled)
3. ✅ Clarified Finance OS boundary (Financial Intent, not posting)
4. ✅ Clarified idempotency authority (database UNIQUE constraint)
5. ✅ Verified transaction order (Outbox → Idempotency → Audit)
6. ⚠️ **IDENTIFIED BLOCKER:** Transaction boundary mechanism unclear

**Based On:**
- `BELLA_RUNTIME_WEEK_2_BOUNDARY_REVIEW.md` (architectural review)
- `BELLA_RUNTIME_WEEK_2_SCHEMA_EVIDENCE.md` (schema verification)
- Architecture v1.1 (FROZEN)
- Phase 3A/3B contracts (FROZEN)

---

## 🔴 CRITICAL BLOCKER IDENTIFIED

### Transaction Boundary Gap

**Required for Week 2:**
```typescript
await atomicTransaction(async (tx) => {
  await outboxRepo.create(intent, tx);        // 1. INSERT outbox
  await idempotencyRepo.register(record, tx); // 2. INSERT idempotency
  await auditRepo.log(entry, tx);             // 3. INSERT audit
  // All or none (atomic)
});
```

**Current Codebase Reality:**
- ❌ NO transaction management in Runtime repositories
- ❌ NO `.rpc()` transaction calls found
- ❌ NO `BEGIN`/`COMMIT`/`ROLLBACK` usage
- ❌ Supabase client used directly without transaction context

**Evidence:**
```typescript
// Current usage (Phase 3B tests)
const supabase = createClient(url, key);
const repository = new OutboxRepository(supabase);

await repository.create(intent);  // Single operation, no transaction
```

**Gap:** Multi-repository atomic operations NOT currently supported.

---

### Transaction Options Analysis

**Option A: PostgreSQL Stored Procedure (RPC)**
```sql
CREATE OR REPLACE FUNCTION runtime_submit_intent(
  p_tenant_id TEXT,
  p_intent JSONB,
  p_idempotency_key TEXT,
  p_correlation_id TEXT
) RETURNS JSONB AS $$
BEGIN
  -- INSERT outbox
  -- INSERT idempotency
  -- INSERT audit
  -- RETURN result
END;
$$ LANGUAGE plpgsql;
```

**Pros:**
- ✅ True database transaction
- ✅ Atomic guarantee
- ✅ Single RPC call from application

**Cons:**
- ❌ Requires new migration (Migration 04)
- ❌ Business logic in database (violates architecture)
- ❌ Not frozen architecture pattern

**Verdict:** ❌ **REJECTED** — Violates application-layer architecture

---

**Option B: Application-Level Sequential Writes**
```typescript
// Write operations sequentially (NO transaction)
const outboxId = await outboxRepo.create(intent);
await idempotencyRepo.register({ outbox_id: outboxId });
await auditRepo.log(entry);

// Risk: Partial failure leaves inconsistent state
```

**Pros:**
- ✅ No architecture changes
- ✅ No new migrations
- ✅ Uses existing repository contracts

**Cons:**
- ❌ NOT atomic
- ❌ Partial failure possible (outbox created, idempotency fails)
- ❌ Violates reliability guarantee

**Verdict:** ❌ **REJECTED** — Violates transactional integrity

---

**Option C: Database-Level Transaction via Supabase Client (RECOMMENDED)**
```typescript
// Research required: Does Supabase JS client support explicit transactions?
// Example pattern (IF supported):
const { data, error } = await supabase.rpc('begin_transaction');
try {
  await outboxRepo.create(intent);
  await idempotencyRepo.register(record);
  await auditRepo.log(entry);
  await supabase.rpc('commit_transaction');
} catch (e) {
  await supabase.rpc('rollback_transaction');
  throw e;
}
```

**Pros:**
- ✅ True atomicity (if supported)
- ✅ No repository contract changes
- ✅ No new migrations

**Cons:**
- ⚠️ **UNKNOWN**: Supabase JS client transaction support unverified
- ⚠️ Requires investigation

**Verdict:** 🟡 **CONDITIONAL** — Requires verification

---

**Option D: Single-Table Outbox with Metadata (FALLBACK)**
```typescript
// Store ALL state in outbox record initially
await outboxRepo.create({
  ...intent,
  metadata: {
    idempotency_key,
    submission_status: 'PENDING_IDEMPOTENCY_CHECK'
  }
});

// Asynchronously register idempotency + audit (eventual consistency)
// Risk: Idempotency check happens AFTER outbox creation
```

**Pros:**
- ✅ Single write operation (atomic)
- ✅ No transaction management needed

**Cons:**
- ❌ Idempotency check happens AFTER persistence
- ❌ Duplicate detection window exists
- ❌ NOT Week 2 proof (changes idempotency contract)

**Verdict:** ❌ **REJECTED** — Violates idempotency proof requirement

---

### 🔴 DECISION REQUIRED

**Week 2 Plan v1.1 CANNOT PROCEED until:**

1. **Verify Supabase client transaction support**
   - Does `@supabase/supabase-js` provide transaction API?
   - If YES → Use Option C
   - If NO → **ARCHITECTURAL DECISION REQUIRED**

2. **If NO transaction support:**
   - **Option E:** Create lightweight transaction wrapper (new architecture)
   - **Option F:** Defer Week 2 until transaction infrastructure built
   - **Option G:** Accept non-atomic writes (document risk)

**Recommendation:** **STOP implementation. Verify Supabase transaction support first.**

---

## Week 2 Scope (Conditional on Transaction Resolution)

### W2.1 — Runtime Submission Boundary

**`submitIntent()` — Entry Point**

**Signature:**
```typescript
export async function submitIntent(
  intent: FinancialIntent,
  client: SupabaseClient
): Promise<SubmissionResult>
```

**Responsibilities (CLARIFIED v1.1):**
1. Extract tenant context from JWT
2. Validate tenant context matches `intent.tenantId`
3. Validate intent **structure only** (NOT business semantics)
4. Check tenant active status
5. **Check idempotency BEFORE transaction** (optimization)
6. **[ATOMIC TRANSACTION - METHOD TBD]:**
   a. Insert outbox record (PENDING status) → Get `outbox_id`
   b. Register idempotency (with `outbox_id`)
   c. Log audit entry (SUBMISSION event)
7. Return `{ status: 'ACCEPTED', outboxId }` **immediately**
8. **[ASYNC BOUNDARY]** ← Finance OS delivery happens LATER

**NOT responsible for:**
- ❌ Emitting to Finance OS (deferred to `processOutboxOnce()`)
- ❌ Waiting for Finance OS response
- ❌ Retry logic
- ❌ Business semantic validation (Finance OS responsibility)

**Transaction Order (from Schema Evidence):**
```
1. INSERT runtime_outbox → outbox_id
2. INSERT runtime_idempotency_registry (outbox_id reference)
3. INSERT runtime_audit_log (outbox_id reference)
```

**Idempotency Check (BEFORE transaction):**
```typescript
// Optimization: Check before expensive transaction
const existing = await idempotencyRepo.check(tenantId, key);
if (existing) {
  return {
    status: 'DUPLICATE',
    originalSubmissionId: existing.outbox_id,
    correlationId: intent.correlationId,
  };
}

// If no duplicate, proceed with transaction
// Database UNIQUE constraint catches race conditions
```

---

**`processOutboxOnce()` — Test-Controlled Processor**

**Signature (RENAMED from v1.0):**
```typescript
export async function processOutboxOnce(
  serviceRoleClient: SupabaseClient,
  options?: { batchSize?: number }
): Promise<ProcessingResult>
```

**Responsibilities (SIMPLIFIED for Week 2):**
1. Query outbox for PENDING records (LIMIT: batchSize, default: 10)
2. Claim ONE batch with optimistic lock (UPDATE status = 'PROCESSING')
3. For each claimed record:
   a. Emit to Finance OS mock (`publishIntent()`)
   b. If success → UPDATE status = 'PUBLISHED', set `published_at`
   c. If failure → UPDATE status = 'FAILED', set `last_error`
   d. Log audit entry (PUBLISHED or FAILED)
4. Return processing summary

**Explicitly NOT responsible for (deferred to Week 3+):**
- ❌ Polling loop (test calls this method manually)
- ❌ Retry schedule (simple FAILED status sufficient)
- ❌ Exponential backoff (deferred)
- ❌ Quarantine workflow (deferred)
- ❌ Daemon/scheduler setup (deferred)
- ❌ Max attempts tracking (deferred)

**Optimistic Lock Pattern:**
```sql
UPDATE runtime_outbox
SET status = 'PROCESSING', processing_started_at = NOW()
WHERE id = ANY(
  SELECT id FROM runtime_outbox
  WHERE status = 'PENDING'
  ORDER BY created_at ASC
  LIMIT :batchSize
  FOR UPDATE SKIP LOCKED  -- Prevents double-processing
)
RETURNING *;
```

---

**`publishIntent()` — Finance OS Emission**

**Signature:**
```typescript
export async function publishIntent(
  intent: FinancialIntent,
  financeOSMock: FinanceOSMock
): Promise<PublishResult>
```

**Responsibilities:**
1. Transform Financial Intent to Finance OS contract format
2. Call Finance OS mock `emitIntent()` method
3. Return result with status

**Finance OS Contract (CLARIFIED v1.1):**
```typescript
interface FinanceOSIntent {
  // Domain event fields (semantic-level)
  intentType: IntentType;           // e.g., 'REVENUE_RECOGNIZED'
  tenantId: string;
  correlationId: string;
  amount: number;
  currency: string;
  effectiveDate: string;            // ISO 8601
  entityType: string;               // e.g., 'Invoice', 'Encounter'
  entityId: string;
  source: string;                   // e.g., 'Hospital', 'Education'
  metadata?: Record<string, any>;
  
  // ❌ NOT INCLUDED (Finance OS responsibility):
  // - account codes (e.g., '411', '1111')
  // - DR/CR entries
  // - posting instructions
  // - accounting policy
}
```

**Boundary (EXPLICIT):**
- ✅ Emits **Financial Intent** (domain event)
- ✅ Validates **structure** only (required fields, types)
- ❌ Does NOT emit **Posting Instruction** (no Dr/Cr)
- ❌ Does NOT validate **business semantics** (Finance OS responsibility)
- ❌ Does NOT select **accounts** (Finance OS responsibility)
- ❌ Does NOT interpret **accounting policy** (Finance OS responsibility)

**Validation Boundary:**

| Validation | Owner | Example |
|------------|-------|---------|
| **Structural** | Runtime | `amount` is number, `currency` is 3-char string |
| **Business** | Finance OS | `amount` > 0 for revenue, < 0 for expense |
| **Policy** | Finance OS | "Recognize revenue upon delivery, not payment" |
| **Account** | Finance OS | "REVENUE_RECOGNIZED → Account 411" |

**Finance OS Mock Behavior:**
```typescript
// Mock validates structure (NOT business rules)
private validateIntentStructure(intent: FinancialIntent): void {
  // Structure checks (Runtime contract)
  if (!intent.intentType) throw Error('intentType required');
  if (typeof intent.amount !== 'number') throw Error('amount must be number');
  if (intent.currency.length !== 3) throw Error('currency must be ISO 4217');
  
  // ❌ NO business rule validation in mock
  // Real Finance OS might reject amount <= 0, but mock accepts for testing
}
```

---

### W2.2 — E2E Happy Path Tests

**Test File:** `tests/e2e/runtime/3c-1-happy-path.e2e.test.ts`

**10-15 tests proving:**

#### 1. Single Intent Flow (CORRECTED)

```typescript
it('should process Financial Intent end-to-end', async () => {
  const intent = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: 'test-happy-001',
    amount: 1000.00,
  });

  // 1. Submit intent (async boundary)
  const result = await submitIntent(intent, context.tenantAClient);
  
  expect(result.status).toBe('ACCEPTED');
  expect(result.outboxId).toBeDefined();
  
  // 2. Verify outbox PENDING (persistence proof)
  const outbox = await getOutboxRecord(result.outboxId, context.serviceRoleClient);
  expect(outbox.status).toBe('PENDING');
  expect(outbox.tenant_id).toBe(E2E_TENANTS.TENANT_A.tenantId);
  
  // 3. Verify idempotency registered
  const idempotency = await getIdempotencyRecord(
    intent.tenantId,
    generateIdempotencyKey(intent.tenantId, intent.correlationId, intent.intentType),
    context.serviceRoleClient
  );
  expect(idempotency).toBeDefined();
  expect(idempotency.outbox_id).toBe(result.outboxId);
  
  // 4. Verify audit log entry
  const auditLogs = await getAuditLogsByCorrelation(intent.correlationId, context.serviceRoleClient);
  expect(auditLogs).toHaveLength(1);
  expect(auditLogs[0].status).toBe('SUBMISSION');
  
  // 5. Process outbox (test-controlled, NOT automatic)
  await processOutboxOnce(context.serviceRoleClient);
  
  // 6. Verify Finance OS received intent
  expect(financeOSMock.getEmissionCount()).toBe(1);
  expect(financeOSMock.wasIntentEmitted(intent.correlationId, intent.tenantId)).toBe(true);
  
  // 7. Verify outbox status updated to PUBLISHED
  const updatedOutbox = await getOutboxRecord(result.outboxId, context.serviceRoleClient);
  expect(updatedOutbox.status).toBe('PUBLISHED');
  expect(updatedOutbox.published_at).toBeDefined();
  
  // 8. Verify audit trail complete
  const finalAuditLogs = await getAuditLogsByCorrelation(intent.correlationId, context.serviceRoleClient);
  expect(finalAuditLogs.length).toBeGreaterThan(1); // Submission + Published
});
```

#### 2. Multiple Intents (Same Tenant)

```typescript
it('should process multiple intents independently', async () => {
  const intents = [
    createTestIntent({ correlationId: 'multi-001', amount: 100 }),
    createTestIntent({ correlationId: 'multi-002', amount: 200 }),
    createTestIntent({ correlationId: 'multi-003', amount: 300 }),
  ];
  
  // Submit all intents
  const results = await Promise.all(
    intents.map(intent => submitIntent(intent, context.tenantAClient))
  );
  
  expect(results.every(r => r.status === 'ACCEPTED')).toBe(true);
  
  // Process outbox
  await processOutboxOnce(context.serviceRoleClient, { batchSize: 10 });
  
  // Verify all 3 emitted
  expect(financeOSMock.getEmissionCount()).toBe(3);
  
  // Verify audit trail for each
  for (const intent of intents) {
    const auditLogs = await getAuditLogsByCorrelation(intent.correlationId, context.serviceRoleClient);
    expect(auditLogs.length).toBeGreaterThan(0);
  }
});
```

#### 3. Multi-Tenant Isolation

```typescript
it('should enforce tenant isolation (RLS)', async () => {
  // Tenant A submits intent
  const intentA = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: 'tenant-a-001',
  });
  const resultA = await submitIntent(intentA, context.tenantAClient);
  
  // Tenant B submits intent
  const intentB = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_B.tenantId,
    correlationId: 'tenant-b-001',
  });
  const resultB = await submitIntent(intentB, context.tenantBClient);
  
  // Tenant A cannot see Tenant B's outbox
  const { data: tenantAOutbox } = await context.tenantAClient
    .from('runtime_outbox')
    .select('*')
    .eq('correlation_id', 'tenant-b-001');
  
  expect(tenantAOutbox).toHaveLength(0); // RLS filtered
  
  // Tenant B cannot see Tenant A's audit logs
  const { data: tenantBAudit } = await context.tenantBClient
    .from('runtime_audit_log')
    .select('*')
    .eq('correlation_id', 'tenant-a-001');
  
  expect(tenantBAudit).toHaveLength(0); // RLS filtered
  
  // Both process correctly
  await processOutboxOnce(context.serviceRoleClient);
  expect(financeOSMock.getEmissionCount()).toBe(2);
});
```

#### 4-10. Additional Tests (see full plan)

---

### W2.3 — Idempotency E2E Tests

**Test File:** `tests/e2e/runtime/3c-2-idempotency.e2e.test.ts`

**8-12 tests proving:**

#### 1. Exact Duplicate Replay

```typescript
it('should prevent duplicate emissions for same intent', async () => {
  const intent = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: 'idempotency-001',
  });

  // First submission
  const result1 = await submitIntent(intent, context.tenantAClient);
  expect(result1.status).toBe('ACCEPTED');

  // Process outbox
  await processOutboxOnce(context.serviceRoleClient);

  // Verify Finance OS received once
  expect(financeOSMock.getEmissionCount()).toBe(1);

  // Second submission (exact duplicate)
  const result2 = await submitIntent(intent, context.tenantAClient);
  expect(result2.status).toBe('DUPLICATE');
  expect(result2.originalSubmissionId).toBe(result1.outboxId);

  // Verify Finance OS did NOT receive duplicate
  expect(financeOSMock.getEmissionCount()).toBe(1); // Still 1
  
  // Verify only ONE outbox record exists
  const { data: outboxRecords } = await context.serviceRoleClient
    .from('runtime_outbox')
    .select('*')
    .eq('correlation_id', 'idempotency-001');
  
  expect(outboxRecords).toHaveLength(1);
});
```

#### 2. Concurrent Duplicate Submissions (CRITICAL TEST)

```typescript
it('should handle concurrent duplicate submissions (race condition)', async () => {
  const intent = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: 'concurrent-001',
  });

  // Submit TWO identical requests concurrently
  const [result1, result2] = await Promise.all([
    submitIntent(intent, context.tenantAClient),
    submitIntent(intent, context.tenantAClient),  // Same intent, same time
  ]);

  // ONE should be ACCEPTED, ONE should be DUPLICATE
  const accepted = [result1, result2].filter(r => r.status === 'ACCEPTED');
  const duplicates = [result1, result2].filter(r => r.status === 'DUPLICATE');

  expect(accepted).toHaveLength(1);
  expect(duplicates).toHaveLength(1);

  // Verify only ONE outbox record created (database authority)
  const { data: outboxRecords } = await context.serviceRoleClient
    .from('runtime_outbox')
    .select('*')
    .eq('correlation_id', 'concurrent-001');

  expect(outboxRecords).toHaveLength(1);

  // Verify Finance OS receives only ONE emission
  await processOutboxOnce(context.serviceRoleClient);
  expect(financeOSMock.getEmissionCount()).toBe(1);
});
```

#### 3. Tenant-Scoped Idempotency

```typescript
it('should scope idempotency per tenant', async () => {
  const correlationId = 'cross-tenant-001';
  
  // Tenant A submits intent
  const intentA = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId,
  });
  const resultA = await submitIntent(intentA, context.tenantAClient);
  
  // Tenant B submits intent with SAME correlation ID
  const intentB = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_B.tenantId,
    correlationId,  // Same correlation ID, different tenant
  });
  const resultB = await submitIntent(intentB, context.tenantBClient);
  
  // Both should be ACCEPTED (tenant-scoped idempotency)
  expect(resultA.status).toBe('ACCEPTED');
  expect(resultB.status).toBe('ACCEPTED');
  
  // Process outbox
  await processOutboxOnce(context.serviceRoleClient);
  
  // Verify Finance OS receives BOTH (different tenants)
  expect(financeOSMock.getEmissionCount()).toBe(2);
  
  // Verify separate idempotency records
  const { data: idempotencyRecords } = await context.serviceRoleClient
    .from('runtime_idempotency_registry')
    .select('*')
    .eq('correlation_id', correlationId);
  
  expect(idempotencyRecords).toHaveLength(2);
  expect(idempotencyRecords[0].tenant_id).not.toBe(idempotencyRecords[1].tenant_id);
});
```

#### 4-8. Additional Tests (see full plan)

---

## Explicitly Deferred (NOT Week 2)

**❌ Production Infrastructure:**
- Outbox worker daemon (polling loop)
- Retry scheduler with exponential backoff
- Quarantine workflow (review/replay/discard)
- Max attempts tracking
- Worker health monitoring

**❌ Advanced Features:**
- Performance optimization (batching, parallelization)
- Observability platform integration (OpenTelemetry)
- SDK/Marketplace integration
- Product Vertical integration (Healthcare, Education)
- Finance OS accounting logic implementation
- COA mapping
- DR/CR generation

**❌ Architecture Changes:**
- Modifications to Phase 3B repository contracts
- New database migrations (except if transaction infrastructure required)
- Changes to frozen Architecture v1.1

---

## Architectural Invariants

**Week 2 MUST preserve:**

1. ✅ **Runtime → Finance OS boundary** (Financial Intent, NOT posting)
2. ✅ **Tenant isolation** (RLS enforced, cross-tenant access blocked)
3. ✅ **Idempotency** (database UNIQUE constraint authority)
4. ✅ **Audit immutability** (append-only, no UPDATE/DELETE)
5. ✅ **Async boundary** (`submitIntent` returns immediately)
6. ✅ **Phase 3B contracts** (no repository modifications)
7. ✅ **Database schema** (no new migrations except transaction infrastructure)

---

## Non-Goals

**Week 2 does NOT prove:**
- ❌ Production scalability (performance testing deferred)
- ❌ Multi-region deployment
- ❌ Finance OS accounting correctness (Finance OS responsibility)
- ❌ Product Vertical integration
- ❌ SDK usability
- ❌ Observability completeness

**Week 2 ONLY proves:**
- ✅ Runtime can persist Financial Intent correctly
- ✅ Runtime can emit to Finance OS boundary
- ✅ Idempotency prevents duplicate emissions
- ✅ Tenant isolation enforced
- ✅ Audit trail complete

---

## Success Criteria (Binary Gate)

### Week 2 PASS Requirements

**ALL must be true:**
- ✅ Transaction boundary resolved (implementation path confirmed)
- ✅ `submitIntent()` persists intents (async boundary confirmed)
- ✅ `processOutboxOnce()` emits to Finance OS mock
- ✅ Idempotency enforced by database (concurrent requests handled)
- ✅ Financial Intent emitted (NOT posting instruction)
- ✅ Runtime validates structure (NOT business semantics)
- ✅ W2.2: 10-15 Happy Path tests PASS
- ✅ W2.3: 8-12 Idempotency tests PASS (including race condition)
- ✅ **Phase 3A regression:** 79/79 PASS
- ✅ **Phase 3B regression:** 97/97 PASS
- ✅ **Gate 0 regression:** 5/5 PASS

### Week 2 FAIL if ANY:

- ❌ Transaction boundary unresolved
- ❌ `submitIntent()` emits synchronously (async boundary violated)
- ❌ Production worker infrastructure implemented (scope creep)
- ❌ Runtime validates business semantics (Finance OS boundary violated)
- ❌ Idempotency relies on application cache (database authority violated)
- ❌ Posting instructions emitted (Financial Intent boundary violated)
- ❌ Any Week 2 test fails
- ❌ Any regression detected (3A/3B/Gate 0)

---

## Revised Implementation Order

### ⚠️ PREREQUISITE: Resolve Transaction Boundary

**BEFORE Day 1:**
1. Verify Supabase client transaction support
2. If supported → Document usage pattern
3. If NOT supported → **STOP for architectural decision**

**Decision Tree:**
```
Supabase supports transactions?
├─ YES → Proceed with Week 2
└─ NO  → STOP
         ├─ Option: Build transaction wrapper (new architecture)
         ├─ Option: Use stored procedure (violates application-layer arch)
         └─ Option: Defer Week 2
```

---

### Day 1: Submission Boundary (IF transaction resolved)

1. Implement `submitIntent()` (persistence + transaction)
2. Test: Submit intent → verify outbox PENDING
3. Test: Submit duplicate → verify DUPLICATE status
4. Test: Verify idempotency + audit records created atomically

### Day 2: Concurrent Idempotency Proof

1. Implement concurrent submission test
2. Verify database UNIQUE constraint catches race
3. Verify only ONE outbox record created
4. Verify NO duplicate emissions to Finance OS

### Day 3: Processing Boundary

1. Implement `processOutboxOnce()` (test-controlled, no daemon)
2. Implement `publishIntent()` (Finance OS mock emission)
3. Test: Process outbox → verify emission
4. Test: Process outbox → verify outbox PUBLISHED

### Day 4: E2E Happy Path

1. Implement W2.2 tests (10-15 tests)
2. Run tests iteratively
3. Verify tenant isolation
4. Verify audit trail

### Day 5: Regression & Evidence

1. Run full regression (3A + 3B + Gate 0 + W2)
2. Generate Week 2 evidence document
3. Commit + push

---

## Evidence Requirements

**Week 2 evidence document must include:**
1. ✅ Transaction boundary implementation (how atomicity achieved)
2. ✅ Test results (W2.2 + W2.3 + regressions)
3. ✅ Concurrent idempotency proof (race condition test passed)
4. ✅ Finance OS boundary verification (Financial Intent, not posting)
5. ✅ Async boundary confirmation (`submitIntent` returns immediately)
6. ✅ Schema unchanged (no new migrations except transaction infrastructure)
7. ✅ Repository contracts unchanged (Phase 3B frozen)

---

## Final Approval Checklist

**Before FREEZE and implementation:**

**Transaction Boundary:**
- [ ] Supabase transaction support verified
- [ ] Implementation pattern documented
- [ ] Atomic guarantee confirmed

**Boundaries Clarified:**
- [ ] `submitIntent()` async boundary confirmed
- [ ] `processOutboxOnce()` scope confirmed (test-only, no daemon)
- [ ] Finance OS boundary confirmed (Financial Intent, not posting)
- [ ] Idempotency authority confirmed (database, not cache)

**Scope Verified:**
- [ ] Week 2 scope limited to proof (no production infrastructure)
- [ ] Out-of-scope items explicitly deferred
- [ ] No scope creep detected

**Architecture Protected:**
- [ ] Phase 3B contracts unchanged
- [ ] Database schema unchanged (except transaction infrastructure)
- [ ] Architecture v1.1 frozen maintained

---

## Status

```
Gate 0                      ✅ COMPLETE
Architecture v1.1           🔒 FROZEN
Schema Evidence             ✅ VERIFIED
Boundary Review             ✅ COMPLETE
Week 2 Plan v1.0            ❌ REJECTED
Week 2 Plan v1.1            🟡 DRAFT (awaiting transaction resolution)
Transaction Boundary        🔴 BLOCKER (unresolved)
Implementation              🔒 BLOCKED
```

---

## Recommendation

**🔴 DO NOT APPROVE Week 2 Plan v1.1 until:**

1. **Verify Supabase transaction support**
   - Research `@supabase/supabase-js` transaction API
   - Document actual usage pattern
   - Confirm atomic guarantee

2. **IF transaction support EXISTS:**
   - Update plan with concrete implementation pattern
   - Approve + freeze + implement

3. **IF transaction support DOES NOT EXIST:**
   - **STOP Week 2 implementation**
   - Escalate architectural decision:
     - Build transaction wrapper?
     - Use stored procedure?
     - Accept non-atomic writes (document risk)?
     - Defer Week 2?

---

**Plan Status:** 🟡 **CONDITIONAL APPROVAL** (pending transaction resolution)  
**Week 2 Implementation:** 🔒 **BLOCKED** (transaction boundary unresolved)  
**Architecture:** 🔒 **FROZEN** (v1.1) — No violations  
**Next Step:** Verify Supabase transaction support, then revise plan OR escalate decision

