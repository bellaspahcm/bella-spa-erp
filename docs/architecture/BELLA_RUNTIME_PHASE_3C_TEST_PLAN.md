# Bella Runtime Phase 3C Test Plan

**Document Version:** 1.0.0  
**Date:** 2026-08-18  
**Status:** 🟢 OPEN  
**Phase:** Phase 3C — End-to-End Runtime Testing  

---

## Executive Summary

Phase 3C verifies **end-to-end runtime behavior** from Financial Intent ingestion through emission to Finance OS. Unlike Phase 3B (repository isolation), 3C tests **complete workflows** including validation, tenant context, idempotency, outbox, audit, and failure recovery.

**Critical Distinction:**
- Phase 3B: Repository + Database contract ✅
- Phase 3C: Full Runtime workflow + Security boundary
- Phase 3D: Adversarial verification + RLS enforcement (future)

**Prerequisites:**
- ✅ Phase 3A complete (79/79 unit tests)
- ✅ Phase 3B complete (97/97 integration tests)
- ✅ Architecture v1.1 FROZEN
- ✅ Database migration applied

---

## Test Philosophy

### What Phase 3C Tests

**E2E Runtime Workflow:**
```
Financial Intent (input)
    ↓
Validation (tenant context)
    ↓
Idempotency Check
    ↓
Outbox Insert (transactional)
    ↓
Audit Log (append-only)
    ↓
Emission (to Finance OS boundary)
    ↓
Status Tracking
```

**Cross-Cutting Concerns:**
- Tenant isolation under user context
- Idempotent replay detection
- Failure → Quarantine → Recovery
- Correlation ID provenance
- Transaction boundaries
- RLS enforcement (with `anon` key)

### What Phase 3C Does NOT Test

**Out of Scope:**
- ❌ Finance OS internal behavior (black box beyond boundary)
- ❌ Performance/load testing (Phase 4)
- ❌ Observability/monitoring (Phase 4)
- ❌ Multi-tenant concurrency at scale (Phase 4)
- ❌ Healthcare Kernel integration (separate phase)
- ❌ Education Product integration (separate phase)

**Deferred to Phase 3D:**
- Database enforcement under adversarial conditions
- RLS policy exhaustive verification
- Permission boundary testing
- SQL injection / attack surface

---

## Test Categories

### 3C-1: Happy Path E2E ✅

**Purpose:** Verify complete workflow from intent submission to Finance OS emission.

**Scenarios:**
1. **Single Intent Flow**
   - Submit valid Financial Intent
   - Verify tenant context attached
   - Verify idempotency key generated
   - Verify outbox record created (PENDING)
   - Verify audit log entry created
   - Verify emission to Finance OS
   - Verify outbox status → PUBLISHED
   - Verify no duplicate emission

2. **Multiple Intents (Same Tenant)**
   - Submit 3 different intents
   - Verify all processed independently
   - Verify correct correlation IDs
   - Verify audit trail preserved
   - Verify outbox isolation

3. **Multi-Tenant Happy Path**
   - Tenant A submits intent A
   - Tenant B submits intent B
   - Verify A cannot see B's data
   - Verify B cannot see A's data
   - Verify both process correctly

**Success Criteria:**
- All intents reach Finance OS boundary
- Audit trail complete with provenance
- No cross-tenant leakage
- Outbox state transitions correct

---

### 3C-2: Idempotent Replay ✅

**Purpose:** Verify Runtime prevents duplicate emissions for same intent.

**Critical Boundary:**
> Runtime ensures **delivery idempotency** (same intent emitted once).  
> Finance OS ensures **financial-effect idempotency** (same intent processed once).

**Scenarios:**
1. **Exact Duplicate Replay**
   - Submit intent with correlation ID `corr-001`
   - Verify emission successful
   - Re-submit **identical** intent
   - Verify Runtime returns cached result
   - Verify **no second emission** to Finance OS
   - Verify outbox has single PUBLISHED record

2. **Different Intent, Same Correlation ID**
   - Submit intent A with `corr-002`
   - Verify emission successful
   - Submit intent B (different amount) with `corr-002`
   - Verify Runtime detects conflict
   - Verify second intent rejected or quarantined
   - Verify audit logs both attempts

3. **Replay After Failure**
   - Submit intent, force validation failure
   - Verify intent quarantined
   - Fix validation error
   - Re-submit corrected intent (same correlation ID)
   - Verify Runtime allows retry
   - Verify emission successful
   - Verify audit shows failure → retry → success

**Success Criteria:**
- Duplicate intents do not cause duplicate emissions
- Idempotency registry correctly caches results
- Correlation ID uniqueness enforced per tenant
- Audit trail shows all replay attempts

**Not Tested in 3C:**
- Finance OS duplicate processing (out of scope)
- Financial effect idempotency (Finance OS responsibility)

---

### 3C-3: Cross-Tenant Attack Prevention ✅

**Purpose:** Verify tenant isolation under **authenticated user context** (not service_role).

**Critical Change from 3B:**
- Phase 3B: Used `service_role` key (bypasses RLS)
- Phase 3C: Must use `anon` key with tenant JWT claims

**Scenarios:**
1. **Read Attack**
   - Tenant A user authenticated
   - Attempt to read Tenant B's:
     - Financial Intents
     - Audit logs
     - Outbox records
     - Quarantine entries
     - Idempotency keys
   - Verify **all queries return empty** (not error, just empty)

2. **Write Attack**
   - Tenant A user authenticated
   - Attempt to insert intent with `tenantId: 'tenant-b'`
   - Verify RLS blocks insert
   - Verify audit logs attack attempt (optional)

3. **Update Attack**
   - Tenant A user authenticated
   - Attempt to update Tenant B's outbox status
   - Verify RLS blocks update

4. **Correlation ID Hijack**
   - Tenant A submits intent with `corr-123`
   - Tenant B attempts to submit with `corr-123`
   - Verify idempotency scoped per tenant
   - Verify both intents process independently

**Success Criteria:**
- Zero cross-tenant data leakage
- RLS policies enforce tenant boundary
- Idempotency scoped per tenant
- No SQL injection vulnerabilities

**Implementation Note:**
- Must create test helper for tenant JWT generation
- Must test with `anon` key, not `service_role`
- RLS policies must be enabled in Supabase project

---

### 3C-4: Validation Attack Prevention ✅

**Purpose:** Verify Runtime validates intent structure before persistence.

**Scenarios:**
1. **Missing Required Fields**
   - Submit intent without `tenantId`
   - Submit intent without `intentType`
   - Submit intent without `amount`
   - Verify validation error (not database constraint error)
   - Verify intent **not persisted** to outbox
   - Verify audit logs validation failure

2. **Invalid Field Types**
   - Submit intent with `amount: "abc"` (string instead of number)
   - Submit intent with `effectiveDate: "invalid-date"`
   - Verify validation error before database

3. **Invalid Tenant Context**
   - User authenticated as Tenant A
   - Submit intent with `tenantId: 'tenant-b'`
   - Verify Runtime rejects (tenant context mismatch)
   - Verify audit logs authorization failure

4. **SQL Injection Attempt**
   - Submit intent with malicious `entityId: "'; DROP TABLE--"`
   - Verify parameterized queries prevent injection
   - Verify intent processes normally (escaped)

**Success Criteria:**
- Validation occurs **before** database persistence
- Invalid intents do not corrupt database
- Audit logs validation failures
- No SQL injection vulnerabilities

---

### 3C-5: Outbox Failure Handling ✅

**Purpose:** Verify Runtime handles outbox delivery failures gracefully.

**Scenarios:**
1. **Transient Failure**
   - Submit intent
   - Simulate Finance OS unavailable (network error)
   - Verify intent moves to FAILED status
   - Verify retry scheduled via `next_retry_at`
   - Simulate Finance OS recovery
   - Trigger retry
   - Verify intent moves to PUBLISHED
   - Verify single emission (no duplicate)

2. **Permanent Failure**
   - Submit intent
   - Simulate Finance OS rejects intent (validation error)
   - Verify intent moves to FAILED status
   - Verify max retry attempts reached
   - Verify intent moves to QUARANTINE
   - Verify audit logs failure reason

3. **Partial Batch Failure**
   - Submit 3 intents as batch
   - Simulate Finance OS accepts 2, rejects 1
   - Verify 2 intents → PUBLISHED
   - Verify 1 intent → FAILED → retry or quarantine
   - Verify outbox state consistent

**Success Criteria:**
- Transient failures trigger retry
- Permanent failures move to quarantine
- No intents lost during failure
- Audit trail shows failure → retry → resolution

---

### 3C-6: Retry & Recovery Workflow ✅

**Purpose:** Verify Runtime can recover quarantined intents.

**Scenarios:**
1. **Manual Quarantine Review**
   - Submit invalid intent → quarantined
   - Human reviewer marks intent as "FIXED"
   - Trigger replay
   - Verify intent reprocesses successfully
   - Verify audit logs: failure → review → replay → success

2. **Automatic Retry**
   - Submit intent → transient failure
   - Wait for `next_retry_at` expiry
   - Runtime polls outbox
   - Verify automatic retry triggered
   - Verify intent moves to PUBLISHED
   - Verify delivery_attempts incremented

3. **Discard Workflow**
   - Submit invalid intent → quarantined
   - Human reviewer marks intent as "DISCARDED"
   - Verify intent status → RESOLVED
   - Verify no further processing
   - Verify audit logs: failure → review → discard

**Success Criteria:**
- Quarantined intents can be replayed
- Automatic retry respects backoff schedule
- Discard workflow prevents unnecessary retries
- Audit trail complete for all paths

---

### 3C-7: Quarantine Workflow ✅

**Purpose:** Verify poison message handling preserves intent for investigation.

**Scenarios:**
1. **Quarantine Entry**
   - Submit intent with schema violation
   - Verify Runtime catches error
   - Verify intent stored in quarantine
   - Verify original payload preserved
   - Verify error details captured
   - Verify correlation ID preserved

2. **Quarantine Query**
   - Create 5 quarantined intents for Tenant A
   - Create 3 quarantined intents for Tenant B
   - Tenant A queries quarantine
   - Verify returns only A's intents (tenant isolation)

3. **Quarantine Resolution**
   - Quarantine intent with `corr-789`
   - Reviewer marks as REPLAYED
   - Verify intent reprocesses
   - Verify outbox record created
   - Verify audit shows quarantine → replay path

**Success Criteria:**
- No intent lost during failure
- Quarantine preserves full payload + error context
- Tenant isolation in quarantine
- Resolution workflow functional

---

### 3C-8: Audit Provenance ✅

**Purpose:** Verify audit trail captures complete intent lifecycle.

**Scenarios:**
1. **Happy Path Provenance**
   - Submit intent with `corr-456`
   - Verify audit entries:
     1. Intent received
     2. Validation passed
     3. Outbox inserted
     4. Emission attempted
     5. Emission confirmed (PUBLISHED)
   - Verify all entries linked via `corr-456`
   - Verify chronological order

2. **Failure Path Provenance**
   - Submit invalid intent
   - Verify audit entries:
     1. Intent received
     2. Validation failed
     3. Quarantined
   - Query audit by correlation ID
   - Verify complete failure trail

3. **Retry Path Provenance**
   - Submit intent → transient failure
   - Trigger retry → success
   - Verify audit entries:
     1. Intent received
     2. Emission failed (attempt 1)
     3. Retry scheduled
     4. Emission retry (attempt 2)
     5. Emission confirmed (PUBLISHED)
   - Verify attempt counter in audit

**Success Criteria:**
- Every intent has complete audit trail
- Correlation ID links all related events
- Chronological order preserved
- Audit immutable (no UPDATE/DELETE)

---

### 3C-9: Finance OS Boundary ✅

**Purpose:** Verify Runtime correctly emits Financial Intents to Finance OS contract.

**Critical Boundary:**
> Runtime emits **Financial Intent** (domain event).  
> Finance OS receives intent and produces **accounting entries** (not Runtime's responsibility).

**Scenarios:**
1. **Intent Emission Format**
   - Submit Healthcare revenue intent
   - Verify emitted event matches Finance OS contract:
     - `intentType: 'REVENUE_RECOGNIZED'`
     - `amount`, `currency`, `effectiveDate`
     - `tenantId`, `correlationId`
     - `source: 'Hospital'`
   - Verify no accounting logic in Runtime

2. **Finance OS Mock Response**
   - Mock Finance OS to return acceptance
   - Verify Runtime marks outbox PUBLISHED
   - Verify audit logs emission success

3. **Finance OS Rejection**
   - Mock Finance OS to return rejection (e.g., "invalid currency")
   - Verify Runtime marks outbox FAILED
   - Verify error message captured
   - Verify retry scheduled

**Success Criteria:**
- Runtime emits domain events, not accounting commands
- Finance OS contract respected
- Runtime does not interpret financial semantics
- Boundary between Runtime and Finance OS clear

**Not Tested in 3C:**
- Finance OS internal processing (black box)
- Accounting entry generation (Finance OS responsibility)
- Double-entry bookkeeping (Finance OS responsibility)

---

### 3C-10: End-to-End Invariants ✅

**Purpose:** Verify system-level invariants hold across all workflows.

**Invariants:**
1. **No Lost Intents**
   - Submit intent
   - Verify intent in outbox OR quarantine
   - Verify intent never disappears
   - Even on failure, intent persisted

2. **Exactly-Once Emission (per tenant)**
   - Submit intent with correlation ID
   - Verify Finance OS receives exactly 1 emission
   - Submit duplicate
   - Verify Finance OS does not receive duplicate

3. **Tenant Isolation Absolute**
   - All workflows respect tenant boundary
   - No cross-tenant data leakage
   - Idempotency scoped per tenant

4. **Audit Completeness**
   - Every intent has audit trail
   - Audit trail never breaks correlation chain
   - Audit immutable (append-only)

5. **State Consistency**
   - Outbox status reflects reality
   - PUBLISHED ↔ Finance OS confirmed
   - FAILED ↔ Finance OS rejected or unavailable
   - Quarantine ↔ unprocessable poison message

**Success Criteria:**
- All invariants hold under normal operation
- All invariants hold under failure scenarios
- No race conditions violate invariants

---

## Test Environment

### Database Setup
- **Connection:** Supabase PostgreSQL
- **Authentication:** 
  - Phase 3B: `service_role` key (RLS bypass) ✅
  - Phase 3C: `anon` key + tenant JWT (RLS enforced) ✅
- **RLS Policies:** ENABLED (critical change from 3B)
- **Tables:** `runtime_tenant_registry`, `runtime_audit_log`, `runtime_idempotency_registry`, `runtime_outbox`, `runtime_quarantine`

### Tenant Context
- **Test Tenants:**
  - `test-e2e-tenant-a` (authenticated user context)
  - `test-e2e-tenant-b` (authenticated user context)
  - `test-e2e-tenant-attacker` (for security tests)
- **JWT Generation:** Test helper to create valid Supabase JWT with tenant claims
- **Isolation:** Each test suite cleans up own data via tenant prefix

### Finance OS Mock
- **Implementation:** In-memory mock service or HTTP mock server
- **Responses:** Configurable (accept, reject, timeout)
- **Verification:** Track all received emissions for assertion

---

## Test Execution Plan

### Phase 1: Test Infrastructure (Week 1)
- [ ] Create tenant JWT generation helper
- [ ] Create Finance OS mock service
- [ ] Configure Supabase RLS policies
- [ ] Verify `anon` key authentication
- [ ] Create E2E test fixtures

### Phase 2: Happy Path (Week 2)
- [ ] Implement 3C-1 tests
- [ ] Verify end-to-end flow
- [ ] Verify multi-tenant isolation
- [ ] Document any infrastructure gaps

### Phase 3: Idempotency & Replay (Week 2-3)
- [ ] Implement 3C-2 tests
- [ ] Verify duplicate detection
- [ ] Verify replay scenarios
- [ ] Test correlation ID conflicts

### Phase 4: Security Boundary (Week 3)
- [ ] Implement 3C-3 tests (cross-tenant attacks)
- [ ] Implement 3C-4 tests (validation attacks)
- [ ] Verify RLS enforcement
- [ ] Document security findings

### Phase 5: Failure Handling (Week 4)
- [ ] Implement 3C-5 tests (outbox failures)
- [ ] Implement 3C-6 tests (retry/recovery)
- [ ] Implement 3C-7 tests (quarantine)
- [ ] Verify failure invariants

### Phase 6: Audit & Boundary (Week 4)
- [ ] Implement 3C-8 tests (audit provenance)
- [ ] Implement 3C-9 tests (Finance OS boundary)
- [ ] Implement 3C-10 tests (invariants)
- [ ] Final integration verification

### Phase 7: Evidence & Gate (Week 5)
- [ ] Execute full 3C test suite
- [ ] Generate Phase 3C evidence document
- [ ] Governance review
- [ ] Phase 3D unblock decision

---

## Success Criteria

**Phase 3C PASS if:**
- ✅ All 10 test categories execute successfully
- ✅ RLS enforced under user context (not service_role)
- ✅ Tenant isolation proven under attack scenarios
- ✅ End-to-end workflow functional (intent → emission)
- ✅ Failure paths preserve intents (no data loss)
- ✅ Idempotency prevents duplicate emissions
- ✅ Audit trail complete with provenance
- ✅ Finance OS boundary respected
- ✅ All invariants hold

**Phase 3C FAIL if:**
- ❌ Cross-tenant data leakage detected
- ❌ Duplicate emissions occur
- ❌ Intents lost during failure
- ❌ RLS bypassed under user context
- ❌ Audit trail incomplete or corrupted
- ❌ Architecture violations introduced

---

## Known Risks

### Risk 1: RLS Policy Gaps
**Mitigation:** Comprehensive 3C-3 attack tests will reveal gaps early.

### Risk 2: Finance OS Mock Fidelity
**Mitigation:** Mock must match real Finance OS contract. Document assumptions.

### Risk 3: JWT Generation Complexity
**Mitigation:** Use Supabase official JWT helper or well-tested library.

### Risk 4: Transaction Boundary Verification
**Mitigation:** Test both commit and rollback scenarios explicitly.

---

## Governance Gates

**Phase 3C → Phase 3D:**
- Evidence document required
- All 10 test categories PASS
- Security boundary verified
- Governance review approval

**Phase 3D → Production:**
- Adversarial testing complete
- RLS exhaustive verification
- Performance baseline established
- Observability instrumented

---

## Related Documents

- `BELLA_RUNTIME_ARCHITECTURE_V1.md` (v1.1 FROZEN)
- `BELLA_RUNTIME_IMPLEMENTATION_DESIGN_V1.md` (v1.1)
- `BELLA_RUNTIME_PHASE_3_TEST_PLAN.md` (v1.1 — original plan)
- `BELLA_RUNTIME_PHASE_3B_EVIDENCE.md` (3B results)
- `F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md` (Finance OS contract)

---

**Document Control:**
- **Version:** 1.0.0
- **Status:** 🟢 OPEN (Phase 3C unblocked)
- **Phase 3B:** ✅ COMPLETE (97/97 PASS)
- **Approval:** Pending Phase 3C execution
- **Next Review:** After Phase 3C evidence generation
