# Bella Runtime Phase 3C Week 2 — Implementation Plan

**Document Version:** 1.0.0  
**Date:** 2026-08-18  
**Status:** 🔴 DRAFT — Awaiting Approval  
**Phase:** Phase 3C Week 2 — Runtime Submission Boundary + E2E Happy Path

---

## Executive Summary

Week 2 implements the **Runtime Submission API** and proves end-to-end workflow from Financial Intent ingestion through Finance OS emission. This is the first time Runtime executes a complete business flow (not just repository contracts).

**Critical Milestone:**
> This week answers: "Can Bella Runtime receive a Financial Intent and deliver it to Finance OS boundary correctly, idempotently, and traceably?"

**Prerequisites:**
- ✅ Phase 3A complete (79/79 unit tests)
- ✅ Phase 3B complete (97/97 integration tests)
- ✅ Gate 0 complete (5/5 infrastructure tests)
- ✅ Architecture v1.1 FROZEN
- ✅ Database migrations applied (01, 02, 03)
- ✅ RLS enforced with JWT-based policies
- ✅ Test infrastructure ready (JWT helper, Finance OS mock, E2E fixtures)

---

## Week 2 Scope

### W2.1 — Runtime Submission Boundary ✅

**Deliverable:** `submitIntent()` API

**Responsibility:**
- Receive Financial Intent from authenticated client
- Validate tenant context matches JWT claim
- Validate intent structure (contract enforcement)
- Check idempotency (detect duplicates)
- Persist Runtime state (atomic transaction)
- Create outbox record (PENDING status)
- Log audit entry (submission event)
- Return submission result

**NOT in scope:**
- ❌ Outbox processing/worker (deferred to W2.2)
- ❌ Retry logic (deferred to W2.2)
- ❌ Finance OS emission (deferred to W2.2)
- ❌ Quarantine resolution UI (future phase)
- ❌ SDK/Marketplace integration (Phase 4)

---

### W2.2 — E2E Happy Path Tests ✅

**Deliverable:** 10-15 tests proving end-to-end workflow

**Test Coverage:**
1. Single intent submission → outbox → emission → Finance OS
2. Multiple intents (same tenant) → independent processing
3. Multi-tenant isolation → A cannot see B's data
4. Audit provenance → correlation ID chain intact
5. Outbox state transitions → PENDING → PROCESSING → PUBLISHED
6. Finance OS mock integration → accepts intent correctly

**Success Criteria:**
- Authenticated client submits intent
- Runtime validates + persists
- Outbox worker processes intent
- Finance OS receives intent
- Audit trail complete
- No cross-tenant leakage

---

### W2.3 — Idempotency E2E Tests ✅

**Deliverable:** 8-12 tests proving duplicate prevention

**Test Coverage:**
1. Exact duplicate → returns cached result, no second emission
2. Replay same correlation ID → idempotency registry blocks
3. Different intent, same correlation ID → conflict detected
4. Tenant-scoped idempotency → tenant-a:corr-001 ≠ tenant-b:corr-001
5. Replay after failure → allows retry after fix

**Success Criteria:**
- Duplicate submissions blocked
- Idempotency scoped per tenant
- Finance OS receives exactly one emission per intent
- Audit logs all submission attempts

---

## Out of Scope (Explicitly Deferred)

**NOT implementing this week:**
- ❌ Quarantine workflow (review/replay/discard UI)
- ❌ Retry backoff algorithms (simple retry sufficient)
- ❌ Performance optimization (baseline first)
- ❌ Observability/telemetry instrumentation (Phase 4)
- ❌ SDK for Product Verticals (Phase 4)
- ❌ Marketplace Product integration (Phase 4)
- ❌ Finance OS accounting logic (out of Runtime scope)
- ❌ Multi-region deployment (future)
- ❌ Horizontal scaling (Phase 4 performance)

---

## Architecture Contracts (Frozen)

### 1. Financial Intent (Domain Event)

**Type Definition:**
```typescript
interface FinancialIntent {
  // Identity
  tenantId: string;              // Tenant context (from JWT)
  correlationId: string;         // Unique per tenant (idempotency key)
  
  // Intent Classification
  intentType: IntentType;        // e.g., 'REVENUE_RECOGNIZED', 'PAYMENT_RECEIVED'
  entityType: string;            // e.g., 'Student', 'Invoice', 'Encounter'
  entityId: string;              // Domain entity ID
  
  // Financial Effect
  amount: number;                // Positive for revenue/asset, negative for expense/liability
  currency: string;              // ISO 4217 code (e.g., 'USD')
  effectiveDate: Date;           // When financial effect occurs
  
  // Metadata
  source: string;                // Originating Product Vertical (e.g., 'Education', 'Healthcare')
  metadata?: Record<string, any>; // Product-specific context
  timestamp: Date;               // When intent was generated
}
```

**Intent Types (Amendment 4):**
```typescript
type IntentType =
  | 'REVENUE_RECOGNIZED'    // Education: tuition, Healthcare: service rendered
  | 'PAYMENT_RECEIVED'      // Cash collected
  | 'EXPENSE_INCURRED'      // Goods/services consumed
  | 'ASSET_ACQUIRED'        // Asset purchase
  | 'LIABILITY_INCURRED'    // Debt/obligation created
  | 'ASSET_TRANSFERRED'     // Asset movement
  | 'LIABILITY_SETTLED';    // Debt payment
```

---

### 2. Submission Result

**Type Definition:**
```typescript
interface SubmissionResult {
  status: 'ACCEPTED' | 'REJECTED' | 'DUPLICATE';
  
  // On ACCEPTED
  outboxId?: string;            // Outbox record ID
  correlationId: string;        // Echo back for tracking
  
  // On REJECTED
  reason?: string;              // Validation failure reason
  errorCode?: string;           // Machine-readable error code
  
  // On DUPLICATE
  originalSubmissionId?: string; // Reference to first submission
  cachedResult?: any;           // Original submission result
}
```

---

### 3. Outbox State Machine

**States:**
```
PENDING      → Initial state after submission
PROCESSING   → Worker claimed for processing
PUBLISHED    → Successfully emitted to Finance OS
FAILED       → Finance OS rejected or network error
QUARANTINED  → Max retries exceeded, needs manual review
```

**Transitions:**
```
PENDING → PROCESSING   (worker claims)
PROCESSING → PUBLISHED (Finance OS accepts)
PROCESSING → FAILED    (Finance OS rejects or timeout)
FAILED → PROCESSING    (retry scheduled)
FAILED → QUARANTINED   (max retries exceeded)
```

**Invariants:**
- Once PUBLISHED, never transitions to other state
- Once QUARANTINED, requires manual resolution
- FAILED → PROCESSING requires retry schedule

---

### 4. Idempotency Contract

**Key Generation:**
```typescript
idempotencyKey = `${tenantId}:${correlationId}`
```

**Behavior:**
- First submission with key → process + cache result
- Duplicate submission → return cached result immediately
- No duplicate emission to Finance OS
- TTL: 24 hours (configurable)

**Edge Cases:**
- Different intent, same correlation ID → REJECT (conflict)
- Same intent, different tenant → process independently
- Replay after TTL expiry → treat as new submission

---

## Implementation Design

### File Structure

**New Files to Create:**
```
src/platform/integration-runtime/
  ├── runtime-api.ts                    # Main submission API
  ├── outbox-processor.ts               # Outbox worker logic
  └── finance-os-publisher.ts           # Finance OS emission logic

tests/e2e/runtime/
  ├── 3c-2-idempotency.e2e.test.ts      # W2.3 tests
  └── (3c-1 already exists)             # W2.2 tests (update)
```

**Files to Modify:**
```
tests/e2e/runtime/3c-1-happy-path.e2e.test.ts  # Implement skipped tests
```

**Files NOT to Modify:**
```
❌ src/platform/integration-runtime/database/*        # Repository contracts frozen
❌ src/platform/integration-runtime/validation/*      # Validation contracts frozen
❌ src/platform/integration-runtime/idempotency/*     # Idempotency contracts frozen
❌ supabase/migrations/*                              # Database schema frozen
❌ Any Healthcare Kernel files                        # Out of scope
❌ Any Product Vertical files                         # Out of scope
```

---

## W2.1: Runtime Submission API

### 1. `runtime-api.ts` — Entry Point

**Signature:**
```typescript
export async function submitIntent(
  intent: FinancialIntent,
  client: SupabaseClient
): Promise<SubmissionResult>
```

**Responsibilities:**
1. Extract tenant context from client JWT
2. Validate tenant context matches `intent.tenantId`
3. Validate intent structure (delegate to `IntentValidator`)
4. Check tenant active status (delegate to `TenantValidator`)
5. Check idempotency (delegate to `IdempotencyManager`)
6. Start database transaction
7. Insert outbox record (PENDING status)
8. Insert audit log entry (SUBMISSION event)
9. Register idempotency key
10. Commit transaction
11. Return submission result

**Error Handling:**
- Validation failure → return REJECTED with reason
- Tenant inactive → return REJECTED with "tenant inactive"
- Duplicate → return DUPLICATE with cached result
- Database error → rollback transaction, throw error
- Transaction boundary violation → rollback, log error

**Transaction Boundary:**
```typescript
// Pseudocode
try {
  await db.transaction(async (tx) => {
    const outboxId = await outboxRepo.create(intent, tx);
    await auditRepo.logSubmission(intent, outboxId, tx);
    await idempotencyRegistry.register(key, outboxId, tx);
    return { status: 'ACCEPTED', outboxId, correlationId };
  });
} catch (error) {
  // Rollback automatic
  throw new RuntimeError('Submission failed', error);
}
```

**Invariants:**
- Either all persist or none (atomic transaction)
- Outbox record always has corresponding audit entry
- Idempotency key registered IFF outbox created
- No partial state on failure

---

### 2. `outbox-processor.ts` — Worker Logic

**Signature:**
```typescript
export async function processOutbox(
  serviceRoleClient: SupabaseClient
): Promise<ProcessingResult>
```

**Responsibilities:**
1. Query outbox for PENDING or FAILED records (eligible for processing)
2. Claim records with optimistic lock (status → PROCESSING)
3. For each claimed record:
   a. Retrieve Financial Intent from outbox payload
   b. Emit to Finance OS (delegate to `FinanceOSPublisher`)
   c. If success → update status to PUBLISHED
   d. If failure → increment attempts, schedule retry or quarantine
   e. Log audit entry (PUBLISHED, FAILED, or QUARANTINED)
4. Return processing summary

**Processing Strategy:**
- Poll-based (simple, no event-driven complexity for Week 2)
- Batch size: 10 records per poll (configurable)
- Retry schedule: Exponential backoff (1min, 5min, 30min, 2hr, 24hr)
- Max attempts: 5 (then quarantine)

**Optimistic Locking:**
```sql
UPDATE runtime_outbox
SET status = 'PROCESSING', processing_started_at = NOW()
WHERE id = :outboxId
  AND status IN ('PENDING', 'FAILED')
  AND (next_retry_at IS NULL OR next_retry_at <= NOW())
RETURNING *;
```

**Invariants:**
- No double-processing (optimistic lock prevents race)
- Failed intents eventually quarantine (max attempts enforced)
- Audit trail updated for every state transition

---

### 3. `finance-os-publisher.ts` — Emission Logic

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
3. Return result with status + metadata

**Finance OS Contract (from Amendment 4):**
```typescript
interface FinanceOSIntent {
  intentType: IntentType;
  tenantId: string;
  correlationId: string;
  amount: number;
  currency: string;
  effectiveDate: string;      // ISO 8601
  entityType: string;
  entityId: string;
  source: string;
  metadata?: Record<string, any>;
}
```

**Result Types:**
```typescript
interface PublishResult {
  status: 'ACCEPTED' | 'REJECTED' | 'TIMEOUT';
  transactionId?: string;     // If accepted
  reason?: string;            // If rejected
  errorCode?: string;         // Machine-readable
}
```

**Error Handling:**
- Finance OS accepts → return ACCEPTED with transaction ID
- Finance OS rejects → return REJECTED with reason
- Network timeout → return TIMEOUT
- Unexpected error → throw (triggers FAILED state)

**NOT implemented:**
- HTTP client (use Finance OS mock directly)
- Authentication to real Finance OS (future)
- Circuit breaker pattern (deferred to Phase 4)
- Rate limiting (deferred to Phase 4)

---

## W2.2: E2E Happy Path Tests

### Test File: `tests/e2e/runtime/3c-1-happy-path.e2e.test.ts`

**Test Cases to Implement:**

#### 1. Single Intent Flow (currently skipped)

**Scenario:**
```typescript
it('should process Financial Intent end-to-end', async () => {
  const intent = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: 'test-happy-path-001',
    amount: 1000.00,
  });

  // Submit intent via Runtime API
  const result = await submitIntent(intent, context.tenantAClient);
  
  expect(result.status).toBe('ACCEPTED');
  expect(result.outboxId).toBeDefined();

  // Verify outbox record created (PENDING)
  const outbox = await getOutboxRecord(result.outboxId!);
  expect(outbox.status).toBe('PENDING');
  expect(outbox.tenant_id).toBe(E2E_TENANTS.TENANT_A.tenantId);

  // Verify audit log entry
  const auditLogs = await getAuditLogsByCorrelation(intent.correlationId);
  expect(auditLogs).toHaveLength(1);
  expect(auditLogs[0].status).toBe('SUBMISSION');

  // Process outbox
  await processOutbox(context.serviceRoleClient);

  // Verify Finance OS received intent
  expect(financeOSMock.getEmissionCount()).toBe(1);
  expect(financeOSMock.wasIntentEmitted(intent.correlationId, intent.tenantId)).toBe(true);

  // Verify outbox status updated to PUBLISHED
  const updatedOutbox = await getOutboxRecord(result.outboxId!);
  expect(updatedOutbox.status).toBe('PUBLISHED');

  // Verify audit log updated
  const finalAuditLogs = await getAuditLogsByCorrelation(intent.correlationId);
  expect(finalAuditLogs.length).toBeGreaterThan(1); // Submission + Published
});
```

#### 2. Multiple Intents (Same Tenant)

**Scenario:**
- Submit 3 different intents for Tenant A
- Process outbox
- Verify all 3 emitted to Finance OS
- Verify audit trail for each
- Verify outbox status for each

#### 3. Multi-Tenant Happy Path

**Scenario:**
- Tenant A submits intent A
- Tenant B submits intent B
- Process outbox for both
- Verify A cannot query B's outbox records
- Verify B cannot query A's audit logs
- Verify both intents delivered to Finance OS

#### 4. Audit Provenance Chain

**Scenario:**
- Submit intent
- Process outbox
- Query audit log by correlation ID
- Verify chronological chain: Submission → Processing → Published
- Verify all audit entries linked via correlation ID

#### 5. Outbox State Transitions

**Scenario:**
- Submit intent → verify PENDING
- Claim for processing → verify PROCESSING
- Emit to Finance OS → verify PUBLISHED
- Verify `processing_started_at` and `published_at` timestamps

---

## W2.3: Idempotency E2E Tests

### Test File: `tests/e2e/runtime/3c-2-idempotency.e2e.test.ts`

**Test Cases to Implement:**

#### 1. Exact Duplicate Replay

**Scenario:**
```typescript
it('should prevent duplicate emissions for same intent', async () => {
  const intent = createTestIntent({
    tenantId: E2E_TENANTS.TENANT_A.tenantId,
    correlationId: 'test-idempotency-001',
  });

  // First submission
  const result1 = await submitIntent(intent, context.tenantAClient);
  expect(result1.status).toBe('ACCEPTED');

  // Process outbox
  await processOutbox(context.serviceRoleClient);

  // Verify Finance OS received once
  expect(financeOSMock.getEmissionCount()).toBe(1);

  // Second submission (exact duplicate)
  const result2 = await submitIntent(intent, context.tenantAClient);
  expect(result2.status).toBe('DUPLICATE');
  expect(result2.originalSubmissionId).toBe(result1.outboxId);

  // Verify Finance OS did NOT receive duplicate
  expect(financeOSMock.getEmissionCount()).toBe(1); // Still 1
});
```

#### 2. Different Intent, Same Correlation ID

**Scenario:**
- Submit intent A with `corr-002`
- Submit intent B (different amount) with `corr-002`
- Verify second submission rejected (conflict)
- Verify audit logs both attempts
- Verify Finance OS only received first

#### 3. Tenant-Scoped Idempotency

**Scenario:**
- Tenant A submits intent with `corr-003`
- Tenant B submits intent with `corr-003`
- Verify both process independently
- Verify Finance OS receives both
- Verify idempotency scoped per tenant

#### 4. Replay After Failure

**Scenario:**
- Submit invalid intent → validation failure
- Verify intent NOT in outbox (rejected before persistence)
- Fix validation error
- Submit corrected intent (same correlation ID)
- Verify Runtime allows retry
- Verify intent persisted and emitted

#### 5. Idempotency TTL Expiry

**Scenario:**
- Submit intent with `corr-004`
- Process successfully
- Wait for TTL expiry (mock time advance)
- Submit same intent again
- Verify treated as new submission (TTL expired)

---

## Test Execution Strategy

### Phase 1: W2.1 Implementation (Day 1-2)

1. Implement `runtime-api.ts` (submitIntent)
2. Implement `outbox-processor.ts` (processOutbox)
3. Implement `finance-os-publisher.ts` (publishIntent)
4. Run Gate 0 regression (ensure infrastructure still works)

**Acceptance Criteria:**
- API compiles without errors
- Manual test: submit intent via API → outbox record created
- Manual test: process outbox → Finance OS mock receives intent

### Phase 2: W2.2 Implementation (Day 3-4)

1. Implement 10-15 E2E tests in `3c-1-happy-path.e2e.test.ts`
2. Run tests iteratively, fix failures
3. Verify all tests PASS

**Acceptance Criteria:**
- All W2.2 tests execute successfully
- No test flakiness (deterministic pass/fail)
- Audit trail verified in every test

### Phase 3: W2.3 Implementation (Day 4-5)

1. Create `3c-2-idempotency.e2e.test.ts`
2. Implement 8-12 idempotency tests
3. Run tests iteratively, fix failures
4. Verify all tests PASS

**Acceptance Criteria:**
- Duplicate submissions blocked correctly
- Finance OS never receives duplicates
- Tenant scoping enforced

### Phase 4: Regression & Evidence (Day 5)

1. Run full test suite:
   - Phase 3A: 79/79 unit tests
   - Phase 3B: 97/97 integration tests
   - Gate 0: 5/5 infrastructure tests
   - W2.2: 10-15 happy path E2E tests
   - W2.3: 8-12 idempotency E2E tests
2. Generate Week 2 evidence document
3. Commit + push to GitHub

**Acceptance Criteria:**
- All phases PASS (no regression)
- Evidence document created
- Week 2 code frozen

---

## Success Criteria

**Week 2 PASS if:**
- ✅ Runtime Submission API functional (`submitIntent()`)
- ✅ Outbox processor functional (`processOutbox()`)
- ✅ Finance OS publisher functional (`publishIntent()`)
- ✅ W2.2: 10-15 Happy Path E2E tests PASS
- ✅ W2.3: 8-12 Idempotency E2E tests PASS
- ✅ Phase 3A/3B/Gate 0 regression PASS (no breakage)
- ✅ Audit trail complete for all flows
- ✅ Tenant isolation enforced
- ✅ No duplicate emissions to Finance OS

**Week 2 FAIL if:**
- ❌ Any Week 2 test fails
- ❌ Phase 3A/3B/Gate 0 regression detected
- ❌ Duplicate emissions occur
- ❌ Cross-tenant data leakage detected
- ❌ Architecture violations introduced
- ❌ Out-of-scope features implemented

---

## Risk Mitigation

### Risk 1: Transaction Boundary Complexity

**Mitigation:**
- Use Supabase transaction API carefully
- Test both commit and rollback paths explicitly
- Verify no partial state on failure

### Risk 2: Idempotency Edge Cases

**Mitigation:**
- Comprehensive test coverage for W2.3
- Test tenant scoping explicitly
- Test TTL expiry scenarios

### Risk 3: Finance OS Mock Fidelity

**Mitigation:**
- Finance OS mock validates intent structure only (not business rules)
- Mock behavior documented in `finance-os-mock.ts`
- Real Finance OS integration deferred to Phase 4

### Risk 4: Outbox Polling Performance

**Mitigation:**
- Week 2 uses simple polling (good enough for proof)
- Performance optimization deferred to Phase 4
- Batch size configurable (default: 10)

---

## Governance Gates

**Week 2 → Week 3:**
- Evidence document required
- All Week 2 tests PASS
- No architecture violations
- Governance review approval

**Week 3 Scope Preview:**
- 3C-3: Cross-Tenant Attack Prevention
- 3C-4: Validation Attack Prevention
- 3C-5: Outbox Failure Handling

---

## Related Documents

- `BELLA_RUNTIME_ARCHITECTURE_V1_1.md` (v1.1 FROZEN)
- `BELLA_RUNTIME_PHASE_3C_TEST_PLAN.md` (overall 3C plan)
- `BELLA_RUNTIME_GATE_0_ROOT_CAUSE_ANALYSIS.md` (Gate 0 evidence)
- `F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md` (Finance OS contract)
- `BELLA_RUNTIME_PRIVILEGE_MATRIX_V1.md` (RLS privileges)

---

## Approval Checklist

**Before implementation begins:**
- [ ] Week 2 scope reviewed and approved
- [ ] Out-of-scope items explicitly documented
- [ ] Test strategy approved
- [ ] File structure approved
- [ ] Risk mitigation reviewed
- [ ] Success criteria agreed

**Architecture freeze maintained:**
- [ ] No modifications to Phase 3B repository contracts
- [ ] No modifications to database schema
- [ ] No modifications to validation logic
- [ ] No modifications to Healthcare Kernel
- [ ] No modifications to Product Verticals

---

**Document Control:**
- **Version:** 1.0.0
- **Status:** 🔴 DRAFT — Awaiting Approval
- **Gate 0:** ✅ COMPLETE (5/5 PASS)
- **Week 2:** 🔒 BLOCKED until plan approved
- **Next Review:** After plan approval → Implementation begins

---

## Prompt for Implementation (After Approval)

**Once this plan is approved, use this prompt:**

```
Implement Bella Runtime Phase 3C Week 2 according to the frozen Implementation Plan.

Scope:
- W2.1: Runtime Submission API (runtime-api.ts, outbox-processor.ts, finance-os-publisher.ts)
- W2.2: E2E Happy Path Tests (10-15 tests in 3c-1-happy-path.e2e.test.ts)
- W2.3: Idempotency E2E Tests (8-12 tests in 3c-2-idempotency.e2e.test.ts)

Constraints:
- Do NOT modify Phase 3B repository contracts
- Do NOT modify database schema
- Do NOT implement out-of-scope features
- Do NOT optimize performance (baseline first)
- Follow frozen architecture v1.1

After implementation:
- Run full regression: 3A (79/79) + 3B (97/97) + Gate 0 (5/5) + W2.2 + W2.3
- Generate evidence document
- Commit + push

Begin implementation.
```

