# Bella Runtime Week 2 — Architectural Boundary Review

**Document Version:** 1.0.0  
**Date:** 2026-08-18  
**Status:** 🔴 CRITICAL REVIEW — DO NOT IMPLEMENT UNTIL APPROVED  
**Review Type:** Pre-Implementation Architectural Boundary Analysis

---

## Executive Summary

**Purpose:** Review Week 2 Implementation Plan against frozen Runtime v1.1 architecture to identify scope creep, architectural ambiguity, and boundary violations **before implementation begins**.

**Critical Finding:** ⚠️ **4 ARCHITECTURAL AMBIGUITIES DETECTED**

**Status:** 🔴 **WEEK 2 PLAN BLOCKED** — Requires clarification and correction

---

## Review Context

**What We're Reviewing:**
- `BELLA_RUNTIME_PHASE_3C_WEEK_2_IMPLEMENTATION_PLAN.md` (v1.0.0 DRAFT)

**Against What Standards:**
- `BELLA_RUNTIME_ARCHITECTURE_V1_1.md` (FROZEN)
- `BELLA_RUNTIME_IMPLEMENTATION_DESIGN_V1.md` (FROZEN)
- `F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md` (Financial Intent boundary)
- Phase 3A/3B repository contracts (FROZEN)

**Review Principles:**
1. Runtime emits **Financial Intent** (domain event), NOT accounting entries
2. Runtime ensures **delivery reliability**, NOT financial-effect idempotency
3. Runtime validates **intent structure**, NOT business semantics
4. Finance OS is **black box beyond boundary**, NOT Runtime responsibility

---

## Four Critical Ambiguities

### Ambiguity 1: `submitIntent()` Responsibility Scope

**Plan States (W2.1):**
```typescript
export async function submitIntent(
  intent: FinancialIntent,
  client: SupabaseClient
): Promise<SubmissionResult>

Responsibilities:
1. Extract tenant context from client JWT
2. Validate tenant context matches `intent.tenantId`
3. Validate intent structure
4. Check tenant active status
5. Check idempotency
6. Start database transaction
7. Insert outbox record (PENDING status)
8. Insert audit log entry (SUBMISSION event)
9. Register idempotency key
10. Commit transaction
11. Return submission result
```

**Ambiguity Detected:**

**Question 1.1:** Does `submitIntent()` **emit** to Finance OS, or only **persist**?

**From Plan:**
- Step 7: "Insert outbox record (PENDING status)"
- Step 11: "Return submission result"

**Implies:** `submitIntent()` does NOT emit (only persists to outbox)

**But W2.2 test states:**
```typescript
// Submit intent via Runtime API
const result = await submitIntent(intent, context.tenantAClient);

// Process outbox
await processOutbox(context.serviceRoleClient);

// Verify Finance OS received intent
expect(financeOSMock.getEmissionCount()).toBe(1);
```

**Confirms:** `submitIntent()` + `processOutbox()` are **separate steps**

**✅ CLARIFICATION NEEDED:**
> **Does `submitIntent()` return immediately after persisting outbox (async delivery), or does it wait for Finance OS response (sync delivery)?**

**Recommended Boundary:**
```typescript
submitIntent()
    ↓
Validate + Persist (outbox PENDING)
    ↓
Return { status: 'ACCEPTED', outboxId }  ← Async boundary
    ↓
(Later, asynchronously)
processOutbox()
    ↓
Emit to Finance OS
    ↓
Update outbox (PUBLISHED / FAILED)
```

**NOT:**
```typescript
submitIntent()
    ↓
Validate + Persist
    ↓
Emit to Finance OS  ← Sync delivery (wrong)
    ↓
Return { status: 'PUBLISHED', transactionId }
```

**Risk if ambiguous:**
- Week 2 implementation might mix sync/async delivery
- Tests might assume wrong execution model
- Outbox pattern purpose defeated (reliability decoupled from submission)

---

### Ambiguity 2: `processOutbox()` — Production Worker vs Test Helper?

**Plan States (W2.1):**
```typescript
export async function processOutbox(
  serviceRoleClient: SupabaseClient
): Promise<ProcessingResult>

Responsibilities:
1. Query outbox for PENDING or FAILED records
2. Claim records with optimistic lock
3. For each claimed record:
   a. Retrieve Financial Intent from outbox payload
   b. Emit to Finance OS
   c. Update status (PUBLISHED / FAILED)
   d. Log audit entry
4. Return processing summary

Processing Strategy:
- Poll-based (simple, no event-driven complexity for Week 2)
- Batch size: 10 records per poll (configurable)
- Retry schedule: Exponential backoff
- Max attempts: 5 (then quarantine)
```

**Ambiguity Detected:**

**Question 2.1:** Is `processOutbox()` a **test-only helper**, or **production worker**?

**Evidence for test-only:**
- W2.2 tests call `processOutbox()` manually
- No mention of daemon/scheduler/cron setup
- No deployment architecture (how worker runs in production)

**Evidence for production:**
- Detailed retry schedule (1min, 5min, 30min, 2hr, 24hr)
- Exponential backoff implementation
- Batch size configuration
- Max attempts + quarantine logic

**✅ CLARIFICATION NEEDED:**
> **Is Week 2 building a production-ready outbox worker, or a controlled test processor to prove E2E flow?**

**Recommended for Week 2 (MINIMAL):**
```typescript
// Test-controlled processor (NOT production worker)
export async function processOutboxOnce(
  serviceRoleClient: SupabaseClient,
  batchSize: number = 10
): Promise<ProcessingResult>

// Processes ONE batch, returns immediately
// Test calls this method explicitly
// NO polling loop, NO daemon, NO scheduler
```

**Deferred to Week 3+ (PRODUCTION):**
```typescript
// Production worker with polling loop
export async function startOutboxWorker(
  config: WorkerConfig
): Promise<void>

// Runs continuously (daemon)
// Polls outbox at interval
// Handles signals (SIGTERM, SIGINT)
// Requires deployment architecture
```

**Risk if ambiguous:**
- Week 2 scope creeps into production infrastructure
- Tests become flaky (polling timing issues)
- Deployment complexity introduced prematurely

---

### Ambiguity 3: Finance OS Boundary — Intent vs Accounting Entry

**Plan States (W2.1):**
```typescript
export async function publishIntent(
  intent: FinancialIntent,
  financeOSMock: FinanceOSMock
): Promise<PublishResult>

Responsibilities:
1. Transform Financial Intent to Finance OS contract format
2. Call Finance OS mock emitIntent() method
3. Return result with status + metadata

Finance OS Contract:
interface FinanceOSIntent {
  intentType: IntentType;
  tenantId: string;
  correlationId: string;
  amount: number;
  currency: string;
  effectiveDate: string;
  entityType: string;
  entityId: string;
  source: string;
  metadata?: Record<string, any>;
}
```

**Ambiguity Detected:**

**Question 3.1:** Does Runtime emit **Financial Intent** (domain event), or **Posting Instruction** (accounting command)?

**From F5_6_C2 (Accounting Intent Boundary):**
```
Intent = Pre-Realization (semantic-level):
    RECOGNIZE_VENDOR_PREPAYMENT
    Amount: 100,000,000 VND
    Direction: INCREASE_ASSET

Posting Instruction = Post-Realization (account-level):
    Dr Account 3311: 100,000,000
    Cr Account 1111: 100,000,000
```

**Plan Contract (FinanceOSIntent):**
```typescript
{
  intentType: 'REVENUE_RECOGNIZED',  ← Semantic intent ✅
  amount: 1000.00,                   ← Financial effect ✅
  currency: 'USD',                   ← Measurement ✅
  effectiveDate: '2026-08-18',       ← Timing ✅
  entityType: 'Student',             ← Domain entity ✅
  entityId: 'ST-001',                ← Entity reference ✅
  // NO account codes ✅
  // NO Dr/Cr ✅
}
```

**✅ APPEARS CORRECT** (Intent, not Posting)

**But requires explicit confirmation:**

**Question 3.2:** Does Finance OS mock validate **intent structure only**, or **business semantics**?

**From `finance-os-mock.ts`:**
```typescript
private validateIntentStructure(intent: FinancialIntent): void {
  const required = ['intentType', 'tenantId', 'correlationId', 'amount', 'currency'];
  
  // Schema validation ✅
  for (const field of required) {
    if (!(field in intent)) throw Error(`missing ${field}`);
  }
  
  // Structural validation ✅
  if (typeof intent.amount !== 'number') throw Error('amount must be number');
  if (intent.amount <= 0) throw Error('amount must be positive');
  
  // ⚠️ Business rule: "amount must be positive"
  // Is this Runtime responsibility or Finance OS responsibility?
}
```

**Ambiguity:** Is "amount must be positive" a **structural** constraint (Runtime validates) or **business** constraint (Finance OS validates)?

**✅ CLARIFICATION NEEDED:**
> **What validations belong to Runtime (structure), vs Finance OS (business semantics)?**

**Recommended Boundary:**

| Validation | Owner | Example |
|------------|-------|---------|
| **Structural** | Runtime | `amount` is number, `currency` is 3-letter string |
| **Business** | Finance OS | `amount` > 0 for revenue, `amount` < 0 for expense |
| **Policy** | Finance OS | "Recognize revenue upon delivery, not payment" |
| **Account** | Finance OS | "REVENUE_RECOGNIZED → Account 411" |

**Risk if ambiguous:**
- Runtime implements business logic (violates boundary)
- Finance OS cannot enforce its own rules (authority violated)
- Tests pass but production Finance OS rejects

---

### Ambiguity 4: Idempotency Authority — Application vs Database

**Plan States (W2.1):**
```typescript
submitIntent() responsibilities:
5. Check idempotency (delegate to IdempotencyManager)
9. Register idempotency key
```

**Ambiguity Detected:**

**Question 4.1:** Is idempotency check **before transaction** (application memory) or **inside transaction** (database registry)?

**Scenario: Concurrent Requests**
```
Time T0: Request A starts → check idempotency (not found) → proceed
Time T1: Request B starts → check idempotency (not found) → proceed  ← Race!
Time T2: Request A inserts outbox + registers key
Time T3: Request B inserts outbox + registers key  ← Duplicate!
```

**✅ CLARIFICATION NEEDED:**
> **Does idempotency check use database UNIQUE constraint (authority) or application-level cache (optimization)?**

**Recommended Architecture:**

**Option A: Database as Authority (SAFE)**
```typescript
async function submitIntent(intent, client) {
  await client.transaction(async (tx) => {
    // 1. Compute key
    const key = `${tenant}:${correlationId}`;
    
    // 2. Try insert idempotency record (UNIQUE constraint)
    const { error } = await tx
      .from('runtime_idempotency_registry')
      .insert({ idempotency_key: key, tenant_id: tenant });
    
    // 3. If duplicate key error → return cached result
    if (error?.code === '23505') {  // PostgreSQL unique violation
      const cached = await getIdempotencyResult(key, tx);
      return { status: 'DUPLICATE', cachedResult: cached };
    }
    
    // 4. Insert outbox (new submission)
    const outboxId = await insertOutbox(intent, tx);
    
    // 5. Commit transaction
  });
}
```

**Database schema enforces:**
```sql
CREATE UNIQUE INDEX idx_idempotency_key_unique 
ON runtime_idempotency_registry (tenant_id, correlation_id);
```

**Option B: Application Cache (UNSAFE for concurrent requests)**
```typescript
async function submitIntent(intent, client) {
  // 1. Check cache BEFORE transaction
  const cached = await idempotencyCache.get(key);  ← Race condition!
  if (cached) return { status: 'DUPLICATE', cachedResult: cached };
  
  // 2. Proceed (race window)
  await client.transaction(async (tx) => {
    await insertOutbox(intent, tx);
    await registerIdempotency(key, tx);
  });
}
```

**Risk if ambiguous:**
- Concurrent requests create duplicate outbox records
- Finance OS receives duplicate emissions
- Idempotency broken under load

---

## Scope Creep Detection

### In-Scope (Week 2 APPROVED per plan)

- ✅ `submitIntent()` API (persistence boundary)
- ✅ Outbox record creation (PENDING status)
- ✅ Idempotency checking (database-backed)
- ✅ Audit log entry (submission event)
- ✅ Transaction boundary enforcement
- ✅ Controlled outbox processing (test-driven)
- ✅ Finance OS mock emission (intent structure)
- ✅ E2E tests (10-15 happy path + 8-12 idempotency)

### Out-of-Scope (Week 2 EXPLICITLY DEFERRED)

- ❌ Production outbox worker daemon
- ❌ Retry scheduler infrastructure
- ❌ Quarantine resolution UI
- ❌ Performance optimization
- ❌ Observability instrumentation
- ❌ SDK/Marketplace integration
- ❌ Finance OS accounting logic
- ❌ Product Vertical integration

### Potential Scope Creep (DETECTED in plan)

**1. Retry Schedule Complexity:**
```
Plan states: "1min, 5min, 30min, 2hr, 24hr"
```
**Question:** Does Week 2 need full retry schedule, or simple "retry once" sufficient for proof?

**Recommendation:** Defer complex backoff to Week 3+. Week 2: simple retry (no schedule).

**2. Outbox Polling Loop:**
```
Plan states: "Poll-based, Batch size: 10, configurable"
```
**Question:** Does Week 2 need polling loop, or manual `processOutbox()` call sufficient?

**Recommendation:** Defer polling to Week 3+. Week 2: manual test-driven processing.

**3. Quarantine Logic:**
```
Plan states: "Max attempts: 5, then quarantine"
```
**Question:** Does Week 2 need quarantine, or FAILED status sufficient?

**Recommendation:** Defer quarantine to Week 3+. Week 2: FAILED status only.

---

## Corrected Week 2 Scope

### W2.1 — Runtime Submission Boundary (CORRECTED)

**`submitIntent()` — Entry Point**

**Signature:**
```typescript
export async function submitIntent(
  intent: FinancialIntent,
  client: SupabaseClient
): Promise<SubmissionResult>
```

**Responsibilities (CLARIFIED):**
1. Extract tenant context from JWT
2. Validate tenant context matches `intent.tenantId`
3. Validate intent **structure** (NOT business semantics)
4. Check tenant active status
5. **[INSIDE TRANSACTION]** Check idempotency (database UNIQUE constraint as authority)
6. **[INSIDE TRANSACTION]** Insert outbox record (PENDING status)
7. **[INSIDE TRANSACTION]** Insert audit log entry
8. **[INSIDE TRANSACTION]** Commit
9. Return `{ status: 'ACCEPTED', outboxId }` **immediately** (async delivery)

**NOT responsible for:**
- ❌ Emitting to Finance OS (deferred to `processOutbox()`)
- ❌ Waiting for Finance OS response (async boundary)
- ❌ Retry logic (deferred to worker)
- ❌ Business semantic validation (Finance OS responsibility)

---

**`processOutboxOnce()` — Test-Controlled Processor (NEW NAME)**

**Signature:**
```typescript
export async function processOutboxOnce(
  serviceRoleClient: SupabaseClient,
  options?: { batchSize?: number }
): Promise<ProcessingResult>
```

**Responsibilities (SIMPLIFIED for Week 2):**
1. Query outbox for PENDING records (limit: batchSize, default: 10)
2. Claim ONE batch with optimistic lock (status → PROCESSING)
3. For each claimed record:
   a. Emit to Finance OS mock
   b. If success → update status to PUBLISHED
   c. If failure → update status to FAILED (no retry logic yet)
   d. Log audit entry
4. Return processing summary

**NOT responsible for (deferred to Week 3+):**
- ❌ Polling loop (test calls this method explicitly)
- ❌ Retry schedule (simple FAILED status sufficient)
- ❌ Exponential backoff (deferred)
- ❌ Quarantine (deferred)
- ❌ Daemon/scheduler setup (deferred)

---

**`publishIntent()` — Finance OS Emission (CLARIFIED)**

**Signature:**
```typescript
export async function publishIntent(
  intent: FinancialIntent,
  financeOSMock: FinanceOSMock
): Promise<PublishResult>
```

**Responsibilities:**
1. Transform Financial Intent to Finance OS contract (no account codes)
2. Call Finance OS mock `emitIntent()` method
3. Return result with status

**Boundary (EXPLICIT):**
- ✅ Emits **Financial Intent** (domain event)
- ✅ Validates **structure** only (required fields, types)
- ❌ Does NOT emit **Posting Instruction** (no Dr/Cr)
- ❌ Does NOT validate **business semantics** (Finance OS responsibility)
- ❌ Does NOT select **accounts** (Finance OS responsibility)

**Finance OS Mock Boundary:**
```typescript
// Mock validates structure (Runtime contract)
if (typeof intent.amount !== 'number') throw Error('...');
if (!intent.currency || intent.currency.length !== 3) throw Error('...');

// Mock does NOT validate business rules
// (Real Finance OS might reject amount <= 0, but mock accepts for testing)
```

---

### W2.2 — E2E Happy Path Tests (UNCHANGED)

**10-15 tests proving:**
- Single intent submission → persistence → emission
- Multi-tenant isolation
- Audit provenance
- Outbox state transitions

**Key test pattern:**
```typescript
it('should process Financial Intent end-to-end', async () => {
  // 1. Submit intent (async boundary)
  const result = await submitIntent(intent, context.tenantAClient);
  expect(result.status).toBe('ACCEPTED');
  
  // 2. Verify outbox PENDING
  const outbox = await getOutboxRecord(result.outboxId);
  expect(outbox.status).toBe('PENDING');
  
  // 3. Process outbox (test-controlled)
  await processOutboxOnce(context.serviceRoleClient);
  
  // 4. Verify emission
  expect(financeOSMock.getEmissionCount()).toBe(1);
  
  // 5. Verify outbox PUBLISHED
  const updatedOutbox = await getOutboxRecord(result.outboxId);
  expect(updatedOutbox.status).toBe('PUBLISHED');
});
```

---

### W2.3 — Idempotency E2E Tests (STRENGTHENED)

**8-12 tests proving:**
- Duplicate submissions blocked (database UNIQUE constraint)
- Tenant-scoped idempotency
- Concurrent request handling (race condition test)
- Replay after failure

**Critical test addition:**
```typescript
it('should handle concurrent duplicate submissions (race condition)', async () => {
  const intent = createTestIntent({ correlationId: 'concurrent-001' });
  
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
  
  // Verify only ONE outbox record created
  const outboxRecords = await getOutboxByCorrelation('concurrent-001');
  expect(outboxRecords).toHaveLength(1);
  
  // Verify Finance OS receives only ONE emission
  await processOutboxOnce(context.serviceRoleClient);
  expect(financeOSMock.getEmissionCount()).toBe(1);
});
```

---

## Architectural Boundaries (EXPLICIT)

### Boundary 1: Runtime vs Finance OS

**Runtime Owns:**
- ✅ Financial Intent emission (domain event)
- ✅ Delivery reliability (at-least-once)
- ✅ Tenant isolation
- ✅ Idempotency (delivery-level)
- ✅ Audit trail
- ✅ Structural validation

**Finance OS Owns:**
- ✅ Financial Intent processing
- ✅ Financial-effect idempotency
- ✅ Account selection (COA mapping)
- ✅ DR/CR generation
- ✅ Business semantic validation
- ✅ Accounting policy execution

**NOT shared:**
- ❌ Runtime does NOT know about accounts
- ❌ Finance OS does NOT know about outbox
- ❌ Runtime does NOT interpret accounting policy
- ❌ Finance OS does NOT manage delivery retry

---

### Boundary 2: Submission vs Processing

**`submitIntent()` Boundary:**
```
User Request
    ↓
Validate + Persist (outbox PENDING)
    ↓
Return { status: 'ACCEPTED' }
    ↓
[ASYNC BOUNDARY]  ← User's HTTP request completes here
```

**`processOutboxOnce()` Boundary:**
```
[Later, asynchronously]
    ↓
Poll outbox (PENDING records)
    ↓
Emit to Finance OS
    ↓
Update outbox (PUBLISHED / FAILED)
```

**NOT:**
```
User Request
    ↓
Validate + Persist
    ↓
Emit to Finance OS  ← Sync (wrong, blocks user request)
    ↓
Return { status: 'PUBLISHED' }
```

---

### Boundary 3: Structure vs Semantics

**Runtime Validates (Structure):**
```typescript
// Required fields present
if (!intent.intentType) throw Error('intentType required');

// Type correctness
if (typeof intent.amount !== 'number') throw Error('amount must be number');

// Format correctness
if (intent.currency.length !== 3) throw Error('currency must be ISO 4217');
```

**Finance OS Validates (Semantics):**
```typescript
// Business rules
if (intent.intentType === 'REVENUE_RECOGNIZED' && intent.amount <= 0) {
  reject('Revenue must be positive');
}

// Policy compliance
if (intent.intentType === 'REVENUE_RECOGNIZED' && !deliveryConfirmed) {
  reject('Cannot recognize revenue before delivery');
}

// Account existence
if (!tenantCOA.hasAccount(semanticToAccount(intent.intentType))) {
  reject('Account not configured for this intent type');
}
```

---

### Boundary 4: Idempotency Authority

**Database is Authority (NOT application cache):**

```sql
-- Database schema enforces idempotency
CREATE UNIQUE INDEX idx_idempotency_unique 
ON runtime_idempotency_registry (tenant_id, correlation_id);

-- Concurrent requests handled by PostgreSQL
-- First insert wins, second gets unique constraint violation
```

**Application logic:**
```typescript
try {
  await tx.from('runtime_idempotency_registry').insert({
    tenant_id: tenant,
    correlation_id: correlationId,
    ...
  });
  // Success → new submission
} catch (error) {
  if (error.code === '23505') {  // PostgreSQL unique violation
    // Duplicate detected by database
    const cached = await getIdempotencyResult(key, tx);
    return { status: 'DUPLICATE', cachedResult: cached };
  }
  throw error;  // Other error
}
```

**NOT:**
```typescript
// Application cache check (unsafe for concurrent requests)
if (await cache.has(key)) {  ← Race condition
  return { status: 'DUPLICATE' };
}
```

---

## Revised Implementation Order

### Day 1: Submission Boundary

1. Implement `submitIntent()` (persistence only, no emission)
2. Test: Submit intent → verify outbox PENDING
3. Test: Submit duplicate → verify DUPLICATE status
4. Test: Concurrent submissions → verify database prevents duplicates

### Day 2: Processing Boundary

1. Implement `processOutboxOnce()` (test-controlled, no polling)
2. Implement `publishIntent()` (Finance OS mock emission)
3. Test: Process outbox → verify emission
4. Test: Process outbox → verify outbox PUBLISHED

### Day 3: E2E Happy Path

1. Implement W2.2 tests (10-15 tests)
2. Run tests iteratively
3. Verify tenant isolation
4. Verify audit trail

### Day 4: Idempotency Proof

1. Implement W2.3 tests (8-12 tests)
2. **Critical:** Concurrent request test (race condition)
3. Verify database authority
4. Verify Finance OS receives no duplicates

### Day 5: Regression & Evidence

1. Run full regression (3A + 3B + Gate 0 + W2)
2. Generate evidence document
3. Commit + push

---

## Corrected Success Criteria

**Week 2 PASS if:**
- ✅ `submitIntent()` persists intents (ASYNC boundary confirmed)
- ✅ `processOutboxOnce()` emits to Finance OS mock (test-controlled)
- ✅ Idempotency enforced by database (concurrent requests handled)
- ✅ Financial Intent emitted (NOT posting instruction)
- ✅ Runtime validates structure (NOT business semantics)
- ✅ W2.2: 10-15 Happy Path tests PASS
- ✅ W2.3: 8-12 Idempotency tests PASS (including race condition)
- ✅ Phase 3A/3B/Gate 0 regression PASS

**Week 2 FAIL if:**
- ❌ `submitIntent()` emits synchronously (async boundary violated)
- ❌ Production worker infrastructure implemented (scope creep)
- ❌ Runtime validates business semantics (Finance OS boundary violated)
- ❌ Idempotency relies on application cache (database authority violated)
- ❌ Posting instructions emitted (Financial Intent boundary violated)

---

## Recommendation

**🔴 DO NOT APPROVE current Week 2 plan until:**

1. **Clarify `submitIntent()` async boundary**
   - Confirm: Returns immediately after persistence
   - Confirm: Does NOT wait for Finance OS response

2. **Clarify `processOutbox()` scope**
   - Rename to `processOutboxOnce()` (test-controlled)
   - Defer: Production worker daemon (Week 3+)
   - Defer: Retry schedule complexity (Week 3+)
   - Defer: Quarantine logic (Week 3+)

3. **Clarify Finance OS boundary**
   - Confirm: Runtime emits Financial Intent (NOT posting)
   - Confirm: Runtime validates structure (NOT semantics)
   - Confirm: Finance OS mock validates structure only

4. **Clarify idempotency authority**
   - Confirm: Database UNIQUE constraint is authority
   - Confirm: Handles concurrent requests correctly
   - Add: Race condition test to W2.3

**After clarifications → Revised plan v1.1 → FREEZE → Approve → Implement**

---

**Review Status:** ⚠️ **4 AMBIGUITIES DETECTED**  
**Week 2 Plan:** 🔴 **BLOCKED** — Requires correction  
**Architecture:** 🔒 **FROZEN** (v1.1) — No violations detected, clarification needed  
**Next Step:** Revise plan addressing 4 ambiguities, then re-submit for approval

