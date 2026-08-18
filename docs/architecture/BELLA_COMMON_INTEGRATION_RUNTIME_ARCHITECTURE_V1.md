# Bella Common Integration Runtime — Architecture Design v1.1
**Version:** 1.1.0  
**Date:** 2026-08-18  
**Status:** 🔒 **FROZEN** (Architecture Gate v2 PASS — 6/6)  
**Gate Approval:** 2026-08-18 (Architecture Gate Review v2)  
**Previous Version:** v1.0.0 (Architecture Gate v1 FAIL — 3 critical gaps, now fixed)  
**Purpose:** Define Runtime contract, boundary, and responsibilities (NOT implementation)

---

## v1.1 Change Log (Architecture Gate Fixes)

**Critical Gap Fixes:**

1. **Gap 1 (CRITICAL):** Idempotency key NOW tenant-scoped + intent-type-scoped
   - v1.0: `Idempotency Key = correlationId`
   - v1.1: `Idempotency Key = HASH(tenantId + correlationId + intentType)`
   - **Impact:** Cross-tenant replay vulnerability eliminated ✅

2. **Gap 2 (MODERATE):** "Exactly-once" claim removed
   - v1.0: "Idempotency — exactly-once processing"
   - v1.1: "At-least-once delivery + idempotent processing → no duplicate financial effect"
   - **Impact:** Distributed systems reality acknowledged ✅

3. **Gap 3 (HIGH):** Financial Intent contract enforcement added
   - v1.0: Boundary specified, no enforcement
   - v1.1: Contract MUST NOT include `glAccount`, `debit`, `credit`, accounting fields
   - **Impact:** Finance Protection structurally enforced ✅

**Conditional Requirements Addressed:**

4. **Fail-safe quarantine:** Quarantine write failure → Keep in outbox (QUARANTINE_PENDING)
5. **Durable idempotency registry:** Registry must be persistent database (NOT in-memory)
6. **CorrelationId required:** Validation error if missing (no fallback UUID generation)
7. **Audit log immutability:** Append-only table, no DELETE/UPDATE permissions
8. **Finance-side tenant validation:** Defense in depth (Finance validates tenantId on receive)

**Re-evaluation Required:** Architecture Gate Review v2 (all 6 gates must PASS)

---

## Document Purpose

**This document defines:**
- ✅ Runtime responsibilities (what Runtime owns)
- ✅ Runtime boundary (where Runtime stops)
- ✅ Primitive contracts (input → guarantee → failure)
- ✅ Failure model
- ✅ Security & isolation requirements
- ✅ Observability & provenance requirements
- ✅ Architecture gate criteria

**This document does NOT:**
- ❌ Specify implementation (code, libraries, frameworks)
- ❌ Choose technology (database, message queue, language)
- ❌ Define API signatures (TypeScript interfaces)
- ❌ Write code

**Architecture Design answers:**
> "What must Runtime provide as a contract?"

**NOT:**
> "How to implement Runtime?"

---

## Foundational Principle

**Runtime's single responsibility:**

```
Runtime makes Financial Intent TRUSTWORTHY
Finance OS decides Financial Intent MEANING
```

**Trustworthy = Reliable, Isolated, Observable**  
**Meaning = Accounting treatment (DR/CR, GL accounts, revenue recognition)**

**Runtime is NOT:**
- ❌ Finance OS v2
- ❌ Policy engine
- ❌ Accounting engine
- ❌ Business logic engine

**Runtime IS:**
- ✅ Reliability infrastructure (idempotency, retry, outbox)
- ✅ Isolation infrastructure (tenant context, validation)
- ✅ Observability infrastructure (correlation, audit, trace)

---

## R1: Runtime Responsibility

### Runtime OWNS

**Reliability:**
1. **Transactional Outbox** — Ensure intent published reliably (at-least-once delivery)
2. **Idempotency** — Ensure intent processed exactly once by Finance
3. **Retry / Backoff** — Retry transient failures with exponential backoff
4. **Quarantine** — Move poison messages to quarantine after max retries

**Isolation:**
5. **Tenant Context Enforcement** — Validate every intent has valid tenant context
6. **Financial Intent Validation** — Validate intent schema, required fields, types

**Observability:**
7. **Correlation / Trace Context** — Propagate correlation ID for tracing
8. **Audit / Provenance** — Record who, what, when for every intent

---

### Runtime DOES NOT OWN

**Accounting Authority:**
- ❌ Revenue recognition logic (when to recognize revenue)
- ❌ COGS calculation (FIFO, LIFO, Weighted Average)
- ❌ GL account selection (which account for this intent)
- ❌ DR/CR decision (which side for this intent)
- ❌ Tax calculation (sales tax, VAT)
- ❌ AR aging (0-30, 31-60, 61-90 days)

**Business Logic:**
- ❌ Domain event semantics (what "Enrollment Confirmed" means)
- ❌ Business policy decisions (P1-P4 Education policies)
- ❌ Payment allocation strategy (FIFO, LIFO, oldest due)
- ❌ Refund calculation (full, prorated, policy-based)

**Semantic Transformation:**
- ❌ Business event → Financial intent mapping (Adapter responsibility)
- ❌ Domain entity extraction (Student, Order, Encounter)
- ❌ Policy evaluation (which policy applies?)

**Finance OS Concerns:**
- ❌ Posting Rules (F3)
- ❌ Ledger writes (F1, F2)
- ❌ Balance calculation (F4)
- ❌ Audit (F5) — Runtime audits *delivery*, Finance audits *accounting*

---

### Responsibility Boundary Summary

| Concern | Owner |
|---------|-------|
| Business truth (Enrollment, Order) | **Industry OS** |
| Semantic transformation (Event → Intent) | **Adapter** |
| Intent reliability (outbox, retry) | **Runtime** ✅ |
| Intent isolation (tenant, validation) | **Runtime** ✅ |
| Intent observability (trace, audit) | **Runtime** ✅ |
| Accounting treatment (DR/CR, GL) | **Finance OS** |
| Revenue recognition policy | **Finance OS** |
| COGS calculation | **Finance OS** |
| Tax calculation | **Finance OS** |

**Runtime stays in middle layer — reliability/isolation/observability ONLY.**

---

## R2: Runtime Boundary

### Architectural Boundary Diagram

```
┌─────────────────────────────────────────────────┐
│              INDUSTRY OS                        │
│  (Hospital, Education, Retail, ...)            │
│                                                 │
│  Owns: Business Truth                          │
│  - Entities (Patient, Student, Order)          │
│  - Events (Enrollment, Payment, Encounter)     │
│  - Business Rules                              │
└─────────────────────────────────────────────────┘
                     │
                     ↓ Domain Event
                     │
┌─────────────────────────────────────────────────┐
│          INDUSTRY ADAPTER                       │
│  (Hospital Adapter, Education Adapter, ...)    │
│                                                 │
│  Owns: Semantic Transformation                 │
│  - Domain Event → Financial Intent             │
│  - Business semantics → Finance semantics      │
│  - Policy-aware mapping                        │
└─────────────────────────────────────────────────┘
                     │
                     ↓ Financial Intent
                     │
┌─────────────────────────────────────────────────┐
│    ★ COMMON INTEGRATION RUNTIME ★              │
│                                                 │
│  Owns: Reliability + Isolation + Observability │
│                                                 │
│  P-002: Financial Intent Validation            │
│         Schema, required fields, types         │
│                                                 │
│  P-004: Idempotency                            │
│         Duplicate detection                    │
│                                                 │
│  P-005: Transactional Outbox                   │
│         Reliable publish (at-least-once)       │
│                                                 │
│  P-006: Retry / Backoff                        │
│         Exponential backoff, max retries       │
│                                                 │
│  P-007: Quarantine                             │
│         Poison message handling                │
│                                                 │
│  P-008: Tenant Context Enforcement             │
│         Tenant validation, isolation           │
│                                                 │
│  P-009: Correlation / Trace Context            │
│         Correlation ID propagation             │
│                                                 │
│  P-010: Audit / Provenance                     │
│         Intent delivery audit trail            │
│                                                 │
└─────────────────────────────────────────────────┘
                     │
                     ↓ Trustworthy Financial Intent
                     │
┌─────────────────────────────────────────────────┐
│              FINANCE OS                         │
│          (F1-F5 Kernel)                        │
│                                                 │
│  Owns: Accounting Authority                    │
│  - GL Account Selection (F3 Posting Rules)     │
│  - DR/CR Decision                              │
│  - Revenue Recognition (policy application)    │
│  - COGS Calculation (FIFO/LIFO)               │
│  - Tax Calculation                             │
│  - Ledger Writes (F1, F2)                     │
│  - Balance Calculation (F4)                    │
│  - Accounting Audit (F5)                       │
└─────────────────────────────────────────────────┘
```

---

### Boundary Enforcement Rules

**Rule B1: Runtime does NOT cross UP into Adapter**
- ❌ Runtime does NOT decide how to transform business events
- ❌ Runtime does NOT contain domain logic
- ✅ Runtime receives Financial Intents (already transformed by Adapter)

**Rule B2: Runtime does NOT cross DOWN into Finance**
- ❌ Runtime does NOT decide accounting treatment
- ❌ Runtime does NOT select GL accounts
- ❌ Runtime does NOT calculate revenue, COGS, tax
- ✅ Runtime delivers trustworthy intents to Finance

**Rule B3: Runtime operates ONLY in the middle layer**
- ✅ Runtime validates intent structure (schema, required fields)
- ✅ Runtime ensures delivery (outbox, retry)
- ✅ Runtime prevents duplicates (idempotency)
- ✅ Runtime isolates tenants (tenant context)
- ✅ Runtime traces intents (correlation)
- ✅ Runtime audits delivery (provenance)

**Rule B4: If Runtime starts making accounting decisions → STOP**
- 🚨 Runtime choosing GL accounts → Finance Protection violated
- 🚨 Runtime recognizing revenue → Accounting authority violated
- 🚨 Runtime calculating COGS → Domain boundary violated
- 🚨 Runtime interpreting policies → Policy engine violation

---

## R3: Primitive Contracts

**For each CORE primitive, define:**
1. **Input** — What does primitive receive?
2. **Guarantee** — What does primitive promise?
3. **Failure Behavior** — What happens on error?
4. **Boundary** — What does primitive NOT do?

---

### P-002: Financial Intent Validation

**CRITICAL FIX (v1.1 — Architecture Gate Gap 3):**

**Input:**
- Financial Intent (unvalidated)
- Contract Schema (version-specific)

**Guarantee:**
- ✅ Intent conforms to schema (structure correct)
- ✅ Required fields present (`tenantId`, `entityId`, `entityType`, `amount`, `metadata`, `correlationId`)
- ✅ Field types correct (`amount` is number, `tenantId` is string, etc.)
- ✅ Intent version valid (if versioning enabled)
- ✅ **Finance Protection enforced (v1.1): Intent does NOT contain accounting authority fields**

**Finance Protection Gate (v1.1 — Structural Enforcement):**

**Financial Intent contract MUST NOT include:**
- ❌ `glAccount` (GL account selection)
- ❌ `debit` / `credit` (DR/CR decision)
- ❌ `journalEntry` (journal entry specification)
- ❌ `chartOfAccountsMapping` (account mapping)
- ❌ `revenueRecognitionMethod` (accounting policy decision)
- ❌ `cogsCalculationMethod` (FIFO/LIFO/Weighted Average)
- ❌ Any accounting treatment field

**Financial Intent contract MUST include:**
- ✅ `intentType` (semantic intent: "REVENUE_RECOGNIZED", "PAYMENT_RECEIVED", etc.)
- ✅ `tenantId` (tenant context)
- ✅ `entityId` (business entity ID: enrollment ID, order ID, etc.)
- ✅ `entityType` (business entity type: "ENROLLMENT", "ORDER", etc.)
- ✅ `amount` (financial amount, semantic)
- ✅ `currency` (currency code, if multi-currency)
- ✅ `correlationId` (correlation for tracing)
- ✅ `effectiveAt` (when financial effect occurs, optional)
- ✅ `metadata` (business context: studentId, programId, orderId, etc. — opaque to Runtime)
- ✅ `policyReference` (policy profile reference, optional — opaque to Runtime)

**Example Financial Intent (COMPLIANT):**
```json
{
  "intentType": "REVENUE_RECOGNIZED",
  "tenantId": "school-xyz",
  "entityId": "enr-12345",
  "entityType": "ENROLLMENT",
  "amount": 5000000,
  "currency": "VND",
  "correlationId": "enr-12345",
  "effectiveAt": "2026-08-18T10:00:00Z",
  "metadata": {
    "studentId": "stu-789",
    "programId": "prog-456",
    "enrollmentDate": "2026-08-01"
  },
  "policyReference": "UniversityModel"
}
```

**Example Financial Intent (VIOLATION — REJECTED):**
```json
{
  "intentType": "REVENUE_RECOGNIZED",
  "tenantId": "school-xyz",
  "amount": 5000000,
  "glAccount": "511",  // ❌ VIOLATION: Accounting authority field
  "debit": "Cash",     // ❌ VIOLATION: DR/CR decision
  "credit": "Revenue"  // ❌ VIOLATION: DR/CR decision
}
```

**Runtime Validation:**
```
❌ VALIDATION_FAILED: Intent contains prohibited field 'glAccount' (Finance Protection violation)
Result: Reject (do NOT send to Finance)
```

**Failure Behavior:**
- **Invalid intent** → Reject immediately (do NOT retry)
- **Validation error** → Return error to Adapter (VALIDATION_FAILED)
- **Missing required field** → Return specific error (MISSING_TENANT_ID, MISSING_AMOUNT, etc.)
- **Prohibited field present (v1.1)** → Return error (PROHIBITED_FIELD: glAccount — Finance Protection violation)

**Boundary:**
- ✅ Runtime validates contract conformance (schema, required fields, prohibited fields)
- ✅ **Runtime enforces Finance Protection (v1.1): Rejects intents with accounting fields**
- ❌ Runtime does NOT validate accounting semantics (GL account exists, posting rule defined — Finance validates)
- ❌ Runtime does NOT validate business semantics (Student enrolled, Order fulfilled — Adapter validates)

**Example (Finance Protection Enforcement):**
```
Input:
  {
    intentType: "REVENUE_RECOGNIZED",
    tenantId: "school-xyz",
    entityId: "enr-12345",
    amount: 5000000,
    glAccount: "511"  // ❌ PROHIBITED FIELD
  }

Runtime Validation:
  ❌ VALIDATION_FAILED: Prohibited field 'glAccount' (Finance Protection violation)
  ❌ Intent rejected — Runtime does NOT forward to Finance

Rationale:
  - Finance selects GL account via F3 Posting Rules
  - Runtime does NOT allow Adapter to bypass Finance authority
```

---

### P-004: Idempotency

**CRITICAL FIX (v1.1 — Architecture Gate Gap 1 & 2):**

**Corrected Description:**
> Runtime provides **at-least-once delivery** + **idempotent processing** + **durable deduplication** → **no duplicate financial effect**

**NOT "exactly-once processing"** (distributed systems impossibility)

**Input:**
- Financial Intent (with tenant-scoped idempotency key)
- Processed Intent Registry (tenant-scoped, already-processed keys)

**Idempotency Key Formula (v1.1):**
```
Idempotency Key = HASH(tenantId + correlationId + intentType)
```

**OR (content-based, if stricter uniqueness needed):**
```
Idempotency Key = HASH(tenantId + correlationId + intentType + amount + effectiveAt)
```

**Critical Invariant:**
> **Tenant A CANNOT consume, deduplicate, or replay on Tenant B's idempotency namespace.**

**Guarantee:**
- ✅ Intent processed **at most once** by Finance per tenant (no duplicate financial effect)
- ✅ Duplicate intents skipped (return success without re-processing)
- ✅ Idempotency key **tenant-scoped** (cross-tenant replay prevented)
- ✅ Idempotency key **intent-type-scoped** (different intent types with same correlationId NOT treated as duplicate)

**Failure Behavior:**
- **Duplicate detected (same tenant + same correlation + same intent type)** → Skip processing, return SUCCESS (idempotent)
- **Idempotency key missing** → Treat as validation error (MISSING_IDEMPOTENCY_KEY)
- **Idempotency registry unavailable** → FAIL_SAFE: Reject intent (do NOT risk duplicate)

**Boundary:**
- ✅ Runtime detects duplicates (via tenant-scoped idempotency key)
- ✅ Runtime records processed keys (tenant-scoped registry)
- ❌ Runtime does NOT decide what constitutes "same intent" (Adapter provides correlationId)
- ❌ Runtime does NOT decide accounting consequence of duplicate (Finance ignores)

**Example (Tenant-Scoped):**
```
Tenant A Intent 1:
  tenantId: "hospital-a"
  correlationId: "pay-12345"
  intentType: "PAYMENT_RECEIVED"
  amount: 100

Idempotency Key: HASH("hospital-a" + "pay-12345" + "PAYMENT_RECEIVED") = "abc123"

Runtime:
  ✅ First time seen → Process → Record ("abc123", tenantId: "hospital-a")

Tenant A Intent 2 (retry):
  tenantId: "hospital-a"
  correlationId: "pay-12345"
  intentType: "PAYMENT_RECEIVED"
  amount: 100

Idempotency Key: HASH("hospital-a" + "pay-12345" + "PAYMENT_RECEIVED") = "abc123"

Runtime:
  ✅ Already processed (tenant A) → Skip → Return SUCCESS
```

**Example (Cross-Tenant Isolation):**
```
Tenant B Intent (malicious replay attempt):
  tenantId: "hospital-b"
  correlationId: "pay-12345"  // same correlationId as Tenant A!
  intentType: "PAYMENT_RECEIVED"
  amount: 999999

Idempotency Key: HASH("hospital-b" + "pay-12345" + "PAYMENT_RECEIVED") = "def456" (different!)

Runtime:
  ✅ NOT a duplicate (different tenant) → Process normally
  ✅ Tenant B cannot replay Tenant A's intent ✅
```

**Example (Intent Type Isolation):**
```
Intent 1:
  tenantId: "hospital-a"
  correlationId: "enc-12345"
  intentType: "REVENUE_RECOGNIZED"
  amount: 5000

Idempotency Key: HASH("hospital-a" + "enc-12345" + "REVENUE_RECOGNIZED") = "xyz789"

Runtime: Process ✅

Intent 2 (different intent type, same correlationId):
  tenantId: "hospital-a"
  correlationId: "enc-12345"
  intentType: "ACCOUNTS_RECEIVABLE_DUE"
  amount: 5000

Idempotency Key: HASH("hospital-a" + "enc-12345" + "ACCOUNTS_RECEIVABLE_DUE") = "uvw456" (different!)

Runtime:
  ✅ NOT a duplicate (different intent type) → Process ✅
```

---

### P-005: Transactional Outbox

**Input:**
- Financial Intent (from Adapter)
- Business Transaction Context (Adapter's DB transaction)

**Guarantee:**
- ✅ Intent written to outbox **in same transaction** as business event
- ✅ Intent published **at least once** (eventually)
- ✅ Intent NOT lost if Adapter crashes after business transaction commits

**Failure Behavior:**
- **Outbox write fails** → Business transaction rolls back (atomicity preserved)
- **Publish fails** → Retry later (outbox worker retries)
- **Outbox worker down** → Intents queued until worker restarts

**Boundary:**
- ✅ Runtime provides outbox infrastructure (table, writer, worker)
- ✅ Runtime ensures at-least-once delivery
- ❌ Runtime does NOT decide when to publish (publishes all outbox intents)
- ❌ Runtime does NOT decide intent priority (FIFO order by default)

**Example:**
```
Adapter Business Transaction:
  1. UPDATE st_enrollments SET status = 'CONFIRMED'
  2. INSERT INTO integration_outbox (intent = TUITION_OBLIGATION_RECOGNIZED)
  3. COMMIT

Runtime Outbox Worker:
  1. SELECT * FROM integration_outbox WHERE published = false
  2. Publish intent to Finance
  3. UPDATE integration_outbox SET published = true
  4. (If publish fails, retry later)
```

---

### P-006: Retry / Backoff

**Input:**
- Financial Intent (failed to deliver)
- Failure Type (transient vs. permanent)
- Retry Count (current attempt number)

**Guarantee:**
- ✅ Transient failures retried with exponential backoff
- ✅ Max retries enforced (e.g., 5 attempts)
- ✅ Backoff prevents thundering herd (jitter applied)

**Failure Behavior:**
- **Transient failure** (network timeout, Finance OS down) → Retry with backoff
- **Permanent failure** (validation error, Finance rejects) → Do NOT retry, quarantine
- **Max retries exceeded** → Move to quarantine (poison message)

**Boundary:**
- ✅ Runtime retries transient failures (mechanism)
- ✅ Runtime enforces backoff strategy (exponential, jitter)
- ❌ Runtime does NOT decide retry strategy per intent type (uniform policy)
- ❌ Runtime does NOT decide what is "transient" vs. "permanent" (Finance/Adapter signals)

**Example:**
```
Attempt 1: Publish intent → Network timeout
  ↓
  Wait 1s (backoff)
  ↓
Attempt 2: Publish intent → Finance OS down (503)
  ↓
  Wait 2s (backoff)
  ↓
Attempt 3: Publish intent → Finance OS down (503)
  ↓
  Wait 4s (backoff)
  ↓
Attempt 4: Publish intent → Success ✅
```

---

### P-007: Quarantine / Poison Message Handling

**Input:**
- Financial Intent (persistently failing)
- Failure Reason (validation error, max retries exceeded, Finance rejection)

**Guarantee:**
- ✅ Poison messages do NOT block other intents (moved to quarantine)
- ✅ Quarantine allows manual review (intent not lost)
- ✅ Quarantine triggers alert (monitoring, notification)

**Failure Behavior:**
- **Poison message detected** → Move to quarantine table/queue
- **Quarantine write fails (v1.1 fix)** → FAIL-SAFE: Keep in outbox, mark as QUARANTINE_PENDING, retry quarantine write later, alert (do NOT delete from outbox until quarantine confirmed)

**Boundary:**
- ✅ Runtime moves message to quarantine (mechanism)
- ✅ Runtime records failure reason (validation error, max retries, etc.)
- ❌ Runtime does NOT fix poison messages (manual review required)
- ❌ Runtime does NOT decide accounting consequence of quarantine (Finance/Adapter reviews)

**Example:**
```
Intent: REVENUE_RECOGNIZED
  amount: "invalid" (should be number)

Runtime Validation:
  ❌ VALIDATION_FAILED: amount must be number

Runtime Retry:
  ❌ Permanent error → Do NOT retry

Runtime Quarantine:
  1. INSERT INTO quarantine (intent, reason = VALIDATION_FAILED)
  2. ALERT: Poison message quarantined
  3. Manual review required
```

---

### P-008: Tenant Context Enforcement

**Input:**
- Financial Intent (with `tenantId`)
- Tenant Registry (valid tenant IDs)

**Guarantee:**
- ✅ Every intent has valid `tenantId`
- ✅ Tenant context propagated to Finance (isolation enforced)
- ✅ Invalid tenant rejected (TENANT_VIOLATION)

**Failure Behavior:**
- **Missing `tenantId`** → Reject (MISSING_TENANT_ID)
- **Invalid `tenantId`** (not in registry) → Reject (INVALID_TENANT_ID)
- **Tenant context lost** → FAIL_SAFE: Reject intent (do NOT risk tenant leak)

**Boundary:**
- ✅ Runtime validates tenant context (presence, validity)
- ✅ Runtime propagates tenant context to Finance
- ❌ Runtime does NOT decide tenant-specific policies (Finance/Adapter decides)
- ❌ Runtime does NOT enforce tenant data isolation within Finance (Finance responsibility)

**Example:**
```
Intent:
  tenantId: "school-xyz"
  amount: 5000

Runtime:
  1. Validate tenantId present ✅
  2. Validate tenantId in registry ✅
  3. Propagate tenantId to Finance ✅

Finance:
  1. Receive intent (tenantId: "school-xyz")
  2. Apply tenant-scoped posting rules (Finance responsibility)
  3. Write to tenant-scoped ledger (Finance responsibility)
```

---

### P-009: Correlation / Trace Context

**Input:**
- Financial Intent (with `correlationId`)
- Trace Context (optional: span ID, trace ID)

**Guarantee:**
- ✅ Correlation ID propagated from Industry → Adapter → Runtime → Finance
- ✅ Trace context enables end-to-end observability (distributed tracing)
- ✅ Correlation ID logged at every stage (Runtime logs, Finance logs)

**Failure Behavior:**
- **Missing `correlationId` (v1.1 fix)** → Reject as validation error (MISSING_CORRELATION_ID) — do NOT generate fallback UUID (fail-fast for provenance)
- **Trace context lost** → Log warning (observability degraded, but NOT fatal)

**Boundary:**
- ✅ Runtime propagates correlation ID (infrastructure)
- ✅ Runtime logs correlation ID (observability)
- ❌ Runtime does NOT generate business correlation IDs (Adapter/Industry generates)
- ❌ Runtime does NOT interpret correlation ID semantics (opaque string)

**Example:**
```
Hospital Event:
  ENCOUNTER_COMPLETED (correlationId: "enc-12345")
  ↓
Adapter:
  Transform → REVENUE_RECOGNIZED (correlationId: "enc-12345")
  ↓
Runtime:
  Log: [correlationId: enc-12345] Publishing REVENUE_RECOGNIZED
  ↓
Finance:
  Log: [correlationId: enc-12345] Received REVENUE_RECOGNIZED
  Log: [correlationId: enc-12345] Applied posting rules
  Log: [correlationId: enc-12345] Ledger write complete

Result: End-to-end trace via correlationId ✅
```

---

### P-010: Audit / Provenance

**Input:**
- Financial Intent
- Timestamp
- Source (Industry, Adapter)
- Tenant
- Correlation ID

**Guarantee:**
- ✅ Every intent delivery recorded (audit trail)
- ✅ Audit log immutable (append-only — v1.1: enforced via database permissions, no DELETE/UPDATE allowed)
- ✅ Audit log queryable (by tenant, by correlationId, by timestamp)
- ✅ Audit log durable (persisted, survives crashes)

**Failure Behavior:**
- **Audit write fails** → Log error (CRITICAL: provenance lost)
- **Audit log unavailable** → Continue processing (do NOT block intent delivery)

**Boundary:**
- ✅ Runtime audits intent delivery (who, what, when, status)
- ✅ Runtime records delivery status (pending, success, failed, quarantined)
- ❌ Runtime does NOT audit accounting treatment (Finance audits via F5)
- ❌ Runtime does NOT audit business events (Industry audits)

**Example:**
```
Runtime Audit Log:
  timestamp: 2026-08-18 10:00:00
  tenantId: school-xyz
  intentType: TUITION_OBLIGATION_RECOGNIZED
  entityId: enr-12345
  correlationId: enr-12345
  amount: 5000
  status: SUCCESS
  source: Education Adapter
  deliveryAttempts: 1
```

---

## R4: Failure Model

**Runtime categorizes failures into 5 types:**

### F1: SUCCESS

**Definition:** Intent delivered successfully to Finance OS

**Runtime Action:**
- ✅ Record audit log (status: SUCCESS)
- ✅ Remove from outbox (if using outbox)
- ✅ Mark idempotency key as processed

**Example:**
```
Intent: REVENUE_RECOGNIZED
  ↓
Finance: 200 OK
  ↓
Runtime: SUCCESS ✅
```

---

### F2: RETRYABLE_FAILURE

**Definition:** Transient failure (network timeout, Finance OS down, temporary error)

**Runtime Action:**
- ✅ Retry with exponential backoff
- ✅ Increment retry counter
- ✅ Record audit log (status: RETRYING, attempt: N)
- ✅ If max retries exceeded → F5: QUARANTINED

**Example:**
```
Intent: PAYMENT_RECEIVED
  ↓
Finance: 503 Service Unavailable
  ↓
Runtime: RETRYABLE_FAILURE → Retry with backoff
```

---

### F3: INVALID

**Definition:** Intent validation failed (schema error, missing required field, type error)

**Runtime Action:**
- ❌ Do NOT retry (permanent error)
- ❌ Do NOT send to Finance
- ✅ Return error to Adapter (VALIDATION_FAILED: reason)
- ✅ Record audit log (status: INVALID, reason)
- ✅ Move to quarantine (manual review)

**Example:**
```
Intent: REVENUE_RECOGNIZED
  amount: "invalid" (should be number)
  ↓
Runtime Validation: INVALID → Missing amount type
  ↓
Runtime: F3: INVALID → Quarantine ❌
```

---

### F4: DUPLICATE

**Definition:** Intent already processed (idempotency key match)

**Runtime Action:**
- ✅ Skip processing (idempotent)
- ✅ Return SUCCESS (intent already processed)
- ✅ Record audit log (status: DUPLICATE, originalTimestamp)

**Example:**
```
Intent 1: PAYMENT_RECEIVED (correlationId: pay-12345)
  ↓
Runtime: Process → SUCCESS ✅

Intent 2: PAYMENT_RECEIVED (correlationId: pay-12345)
  ↓
Runtime: DUPLICATE → Skip → SUCCESS ✅
```

---

### F5: QUARANTINED

**Definition:** Poison message (max retries exceeded, permanent error, Finance rejection)

**Runtime Action:**
- ✅ Move to quarantine table/queue
- ✅ Record failure reason (max retries, validation error, Finance rejection)
- ✅ Trigger alert (monitoring, notification)
- ✅ Manual review required

**Example:**
```
Intent: REVENUE_RECOGNIZED
  ↓
Attempt 1: Network timeout → Retry
  ↓
Attempt 2: Finance OS down → Retry
  ↓
Attempt 3: Finance OS down → Retry
  ↓
Attempt 4: Finance OS down → Retry
  ↓
Attempt 5: Finance OS down → Max retries
  ↓
Runtime: F5: QUARANTINED → Alert 🚨
```

---

### Failure Model Summary

| Failure Type | Retry? | Send to Finance? | Audit Status | Action |
|--------------|--------|------------------|--------------|--------|
| **F1: SUCCESS** | No | Yes ✅ | SUCCESS | Complete |
| **F2: RETRYABLE_FAILURE** | Yes ✅ | Later | RETRYING | Backoff + Retry |
| **F3: INVALID** | No | No ❌ | INVALID | Quarantine |
| **F4: DUPLICATE** | No | No (already sent) | DUPLICATE | Skip |
| **F5: QUARANTINED** | No | No ❌ | QUARANTINED | Alert + Manual review |

---

### Critical Failure Rule

**Runtime does NOT decide accounting consequence of failure.**

**Example:**
- Runtime: "Intent quarantined due to validation error"
- ❌ Runtime does NOT: "Reverse revenue because intent failed"
- ✅ Finance decides: "Should we reverse revenue for this failed intent?"

**Separation maintained:** Runtime audits delivery, Finance audits accounting.

---

## R5: Security & Isolation

**Security & Isolation is first-class architecture concern.**

### Tenant Isolation Guarantee

**Every Financial Intent must be tenant-scoped.**

**Runtime enforces:**
1. ✅ `tenantId` present (validation)
2. ✅ `tenantId` valid (registry check)
3. ✅ `tenantId` propagated to Finance (context propagation)
4. ✅ `tenantId` audited (provenance)

**Runtime does NOT:**
- ❌ Enforce tenant data isolation within Finance (Finance responsibility)
- ❌ Decide tenant-specific policies (Finance/Adapter responsibility)

---

### Tenant Context Flow

```
Industry OS
  Business Event (tenant: school-xyz)
  ↓
Adapter
  Extract tenant → Add to intent (tenantId: school-xyz)
  ↓
Runtime
  1. Validate tenantId present ✅
  2. Validate tenantId valid ✅
  3. Record audit (tenantId: school-xyz)
  4. Propagate to Finance ✅
  ↓
Finance OS
  1. Receive intent (tenantId: school-xyz)
  2. Apply tenant-scoped rules
  3. Write to tenant-scoped ledger
  4. Enforce tenant isolation (Finance responsibility)
```

---

### Tenant Violation Handling

**If `tenantId` missing or invalid:**
1. ❌ Reject intent immediately (do NOT send to Finance)
2. ✅ Return error: TENANT_VIOLATION
3. ✅ Record audit log (status: TENANT_VIOLATION)
4. ✅ Quarantine (manual review)

**Example:**
```
Intent:
  entityType: "ENROLLMENT"
  amount: 5000
  // tenantId missing!

Runtime:
  ❌ TENANT_VIOLATION: Missing tenantId
  → Quarantine
  → Alert 🚨
```

---

### Tenant Registry

**Runtime maintains tenant registry (or queries tenant service):**

**Tenant Registry responsibilities:**
- ✅ List of valid tenant IDs
- ✅ Tenant status (active, suspended, deleted)
- ✅ Tenant metadata (name, industry type)

**Runtime queries registry:**
- ✅ Is `tenantId` valid?
- ✅ Is tenant active (not suspended/deleted)?

**If tenant invalid or suspended:**
- ❌ Reject intent (TENANT_VIOLATION)

---

### Security Principle

**Runtime does NOT trust Adapter.**

**Adapter provides `tenantId`, but Runtime validates:**
- ✅ Tenant exists
- ✅ Tenant active
- ✅ Tenant format valid

**No implicit trust → Explicit validation → Security enforced**

---

## R6: Observability & Provenance

**Observability enables end-to-end tracing: Industry → Adapter → Runtime → Finance**

### Observability Requirements

**Runtime must provide:**
1. ✅ Correlation ID propagation (trace intent across systems)
2. ✅ Audit trail (who, what, when for every intent)
3. ✅ Delivery status (pending, success, failed, quarantined)
4. ✅ Retry history (how many attempts, when, failure reasons)
5. ✅ Quarantine visibility (which intents failed permanently)

---

### Correlation Flow

```
Hospital
  ENCOUNTER_COMPLETED (correlationId: enc-12345)
  ↓
Hospital Adapter
  REVENUE_RECOGNIZED (correlationId: enc-12345)
  ↓
Runtime
  [correlationId: enc-12345] Validating intent
  [correlationId: enc-12345] Writing to outbox
  [correlationId: enc-12345] Publishing to Finance
  ↓
Finance OS
  [correlationId: enc-12345] Received REVENUE_RECOGNIZED
  [correlationId: enc-12345] Applied posting rules
  [correlationId: enc-12345] Ledger write complete

Result: End-to-end trace via correlationId ✅
```

---

### Audit Trail Schema

**Runtime audit log must record:**

| Field | Type | Description |
|-------|------|-------------|
| `id` | UUID | Unique audit record ID |
| `timestamp` | Timestamp | When intent received |
| `tenantId` | String | Tenant context |
| `intentType` | Enum | Financial intent type |
| `entityId` | String | Business entity ID |
| `entityType` | String | Business entity type |
| `amount` | Number | Intent amount (if applicable) |
| `correlationId` | String | Correlation ID (tracing) |
| `source` | String | Source system (Hospital Adapter, Education Adapter, etc.) |
| `status` | Enum | SUCCESS, RETRYING, INVALID, DUPLICATE, QUARANTINED |
| `deliveryAttempts` | Number | How many times attempted |
| `failureReason` | String | Why failed (if failed) |
| `quarantinedAt` | Timestamp | When moved to quarantine (if applicable) |

---

### Provenance Guarantee

**For any Financial Intent, must be able to answer:**
1. ✅ Where did this intent come from? (source system, entity ID)
2. ✅ When was this intent created? (timestamp)
3. ✅ Who created this intent? (tenant, user if available)
4. ✅ What happened to this intent? (success, failed, quarantined)
5. ✅ How many times was delivery attempted? (retry history)
6. ✅ What was the failure reason (if failed)?

**Provenance is immutable (append-only audit log).**

---

### Observability Boundary

**Runtime audits delivery.**  
**Finance audits accounting.**

**Separation:**
- ✅ Runtime: "Intent delivered successfully at 10:00:00"
- ✅ Finance: "Revenue recognized, GL entries posted at 10:00:01"

**Runtime does NOT audit:**
- ❌ Which GL accounts used
- ❌ DR/CR entries
- ❌ Ledger balances
- ❌ Accounting treatment

**Finance audits accounting via F5 Audit.**

---

## R7: Runtime Architecture Gate

**Before proceeding to implementation, Runtime Design must pass Architecture Gate.**

### Gate Criteria

**6 tests must PASS:**

---

#### Gate 1: Finance Protection

**Test:**
> Does Runtime violate Finance Protection?

**Pass criteria:**
- ✅ Runtime does NOT select GL accounts
- ✅ Runtime does NOT decide DR/CR
- ✅ Runtime does NOT calculate revenue, COGS, tax
- ✅ Runtime does NOT interpret accounting policies
- ✅ Finance remains sole accounting authority

**Fail criteria:**
- ❌ Runtime makes accounting decisions
- ❌ Runtime becomes Finance OS v2

---

#### Gate 2: Tenant Isolation

**Test:**
> Does Runtime enforce tenant isolation?

**Pass criteria:**
- ✅ Every intent has `tenantId` (validated)
- ✅ Invalid tenants rejected
- ✅ Tenant context propagated to Finance
- ✅ Tenant context audited

**Fail criteria:**
- ❌ Tenant validation missing
- ❌ Tenant context lost

---

#### Gate 3: Idempotency

**Test:**
> Does Runtime prevent duplicate processing?

**Pass criteria:**
- ✅ Idempotency key required
- ✅ Duplicate detection functional
- ✅ Duplicate intents skipped (return success)

**Fail criteria:**
- ❌ Duplicate intents processed twice
- ❌ Idempotency not enforced

---

#### Gate 4: Failure Safety

**Test:**
> Does Runtime handle failures gracefully?

**Pass criteria:**
- ✅ Transient failures retried (with backoff)
- ✅ Permanent failures quarantined (not lost)
- ✅ Poison messages do NOT block other intents
- ✅ Max retries enforced

**Fail criteria:**
- ❌ Failures lost (no quarantine)
- ❌ Poison messages block queue

---

#### Gate 5: Provenance

**Test:**
> Does Runtime provide end-to-end traceability?

**Pass criteria:**
- ✅ Correlation ID propagated
- ✅ Audit trail complete (who, what, when, status)
- ✅ Audit log immutable (append-only)
- ✅ Quarantine visible

**Fail criteria:**
- ❌ Audit trail incomplete
- ❌ Correlation lost

---

#### Gate 6: Generality

**Test:**
> Does Runtime work for Hospital, Education, Retail (and future industries)?

**Pass criteria:**
- ✅ Runtime domain-agnostic (no Hospital/Education/Retail-specific logic)
- ✅ Runtime works with any Financial Intent type
- ✅ Runtime does NOT contain industry-specific rules

**Fail criteria:**
- ❌ Runtime contains Hospital-specific logic
- ❌ Runtime hard-coded for Education policies

---

### Architecture Gate Summary

| Gate | Test | Pass Criteria |
|------|------|---------------|
| **Gate 1** | Finance Protection | Runtime does NOT make accounting decisions |
| **Gate 2** | Tenant Isolation | Runtime validates + propagates tenant context |
| **Gate 3** | Idempotency | Runtime prevents duplicate processing |
| **Gate 4** | Failure Safety | Runtime retries + quarantines gracefully |
| **Gate 5** | Provenance | Runtime provides end-to-end traceability |
| **Gate 6** | Generality | Runtime works for all industries |

**All 6 gates must PASS before implementation.**

---

## Runtime Design Summary

**8 CORE Primitives:**
1. ✅ P-002: Financial Intent Validation
2. ✅ P-004: Idempotency (v1.1 — tenant-scoped, at-least-once + idempotent processing)
3. ✅ P-005: Transactional Outbox
4. ✅ P-006: Retry / Backoff
5. ✅ P-007: Quarantine / Poison Message Handling
6. ✅ P-008: Tenant Context Enforcement
7. ✅ P-009: Correlation / Trace Context
8. ✅ P-010: Audit / Provenance

**Runtime Responsibility:**
- ✅ Reliability (outbox, retry, idempotency)
- ✅ Isolation (tenant context, validation)
- ✅ Observability (correlation, audit)

**Runtime Boundary:**
- ✅ Runtime makes Financial Intent TRUSTWORTHY
- ❌ Runtime does NOT decide Financial Intent MEANING (Finance decides)

**Idempotency Guarantee (v1.1 — CORRECTED):**
> **At-least-once delivery + idempotent processing + durable deduplication → no duplicate financial effect**

**NOT "exactly-once processing"** (distributed systems impossibility)

**Failure Model:**
- F1: SUCCESS
- F2: RETRYABLE_FAILURE
- F3: INVALID
- F4: DUPLICATE
- F5: QUARANTINED

**Security & Isolation:**
- ✅ Tenant context required
- ✅ Tenant validation enforced
- ✅ Tenant context propagated
- ✅ Tenant context audited
- ✅ **Idempotency key tenant-scoped (v1.1 fix)**

**Observability & Provenance:**
- ✅ Correlation ID propagated
- ✅ Audit trail immutable
- ✅ End-to-end traceability

**Architecture Gate:**
- 6 tests must PASS before implementation

---

## Next Steps

**After Runtime Architecture Design v1:**

```
Runtime Architecture Design v1 (THIS DOCUMENT)
    ↓
Architecture Gate Review (validate 6 gates)
    ↓
If PASS: Runtime Implementation Design
    ↓
Implementation
    ↓
Verification
    ↓
Runtime v1 Freeze
```

**No code until:**
- ✅ Architecture Gate PASS (6/6)
- ✅ Implementation Design complete

---

## Governance Reminder

**Education status unchanged:**
- 🟡 **AWAITING PRODUCT OWNER APPROVAL** (Phase 3 Gate)
- Runtime Design does NOT bypass Product Definition Gate
- Education Phase 3 → 4 blocked until PO approves

**Constitution status:**
- 🔒 **FROZEN v1.0.0** (no changes)

**Template status:**
- 🔒 **FROZEN v1.0** (no changes)

**Primitives status:**
- ✅ **COMPLETE v1.0** (8 CORE, 4 CANDIDATE)

---

## Document Status

**Version:** 1.0.0  
**Status:** DRAFT  
**Purpose:** Architecture Design (contract + boundary)

**Does NOT contain:**
- ❌ Implementation (code, libraries, frameworks)
- ❌ Technology choices (database, message queue)
- ❌ API signatures (TypeScript interfaces)

**Next:** Architecture Gate Review

---

**END OF COMMON INTEGRATION RUNTIME ARCHITECTURE DESIGN V1**

**Runtime contract defined. Boundary protected. Architecture gate criteria established.**

**Runtime makes Financial Intent trustworthy. Finance OS decides Financial Intent meaning.**
