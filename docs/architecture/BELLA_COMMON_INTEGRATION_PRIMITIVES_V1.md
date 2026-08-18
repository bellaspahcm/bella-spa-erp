# Bella Common Integration Primitives v1.0
**Version:** 1.0.0  
**Date:** 2026-08-18  
**Status:** DRAFT  
**Purpose:** Identify proven, reusable integration primitives from Hospital/Education/Retail evidence

---

## Document Purpose

**This artifact identifies:**
> Common mechanisms shared across Hospital, Education, and Retail integrations

**This artifact does NOT:**
- ❌ Design Runtime (comes after)
- ❌ Specify implementation (comes after Architecture Gate)
- ❌ Include domain logic (Revenue, COGS, AR, AP)
- ❌ Include accounting logic (DR/CR, GL accounts, posting rules)

**Objective:**
> Extract intersection of integration patterns, not union

```
Hospital ─────┐
Education ────┼──→ Common Pattern → Primitive
Retail ───────┘
```

---

## Primitive Classification

**CORE:**
- ✅ Evidence from 2+ industries
- ✅ General across industries (not domain-specific)
- ✅ Integration concern (not business or accounting logic)
- ✅ Reusable infrastructure
- **Result:** Runtime candidate

**CANDIDATE:**
- 🟡 Evidence exists but limited (1 industry or partial)
- 🟡 Needs validation
- **Result:** Defer to Runtime Design or reject

**REJECTED:**
- ❌ Domain-specific (Revenue engine, COGS calculator)
- ❌ Accounting-specific (DR/CR logic, GL account selection)
- ❌ Industry-specific (Hospital bed management, Retail inventory valuation)
- **Result:** Not a common integration primitive

---

## Critical Boundary

**Common Integration Runtime must stay in its lane:**

```
INDUSTRY OS
    │
    ↓ Business Truth
ADAPTER
    │
    ↓ Semantic Transformation
FINANCIAL INTENT
    │
    ↓
★ COMMON INTEGRATION RUNTIME ★
    │
    ↓ reliability / isolation /
      idempotency / audit / retry
FINANCE OS
    │
    ↓ Accounting Authority
F1-F5
```

**Runtime owns:**
- ✅ Reliability (retry, backoff, circuit breaker)
- ✅ Isolation (tenant context, idempotency)
- ✅ Observability (correlation, audit, trace)
- ✅ Contract enforcement (validation, versioning)
- ✅ Transport (outbox, delivery guarantee)

**Runtime does NOT own:**
- ❌ Business logic (Enrollment logic, Order logic)
- ❌ Accounting logic (Revenue recognition, COGS calculation)
- ❌ GL account selection
- ❌ DR/CR decision
- ❌ Policy decisions (P1-P4)

**If Runtime starts making business or accounting decisions → Runtime has become Finance OS v2 (REJECTED)**

---

## Primitive Catalog

**12 candidate primitives:**

| ID | Primitive | Status |
|----|-----------|--------|
| P-001 | Event → Financial Intent Transformation | TBD |
| P-002 | Financial Intent Validation | TBD |
| P-003 | 1:N Intent Generation | TBD |
| P-004 | Idempotency | TBD |
| P-005 | Transactional Outbox | TBD |
| P-006 | Retry / Backoff | TBD |
| P-007 | Quarantine / Poison Message Handling | TBD |
| P-008 | Tenant Context Enforcement | TBD |
| P-009 | Correlation / Trace Context | TBD |
| P-010 | Audit / Provenance | TBD |
| P-011 | Policy Reference Resolution | TBD |
| P-012 | Contract Versioning | TBD |

**Each primitive must prove:**
1. Evidence (where used in Hospital/Education/Retail?)
2. Generality (works across industries?)
3. Boundary (stays in integration lane?)

---

## P-001: Event → Financial Intent Transformation

### Description

**Semantic transformation from Industry business event to Financial Intent.**

**Pattern:**
```
Business Event (Industry domain)
    ↓
Adapter Logic
    ↓
Financial Intent (Finance domain)
```

**Example:**
- Hospital: `ENCOUNTER_COMPLETED` → `REVENUE_RECOGNIZED`
- Education: `ENROLLMENT_CONFIRMED` → `TUITION_OBLIGATION_RECOGNIZED`
- Retail: `ORDER_FULFILLED` → `REVENUE_RECOGNIZED`

---

### Evidence

**Hospital:**
- ✅ `finance-event-publisher.ts` transforms Hospital events → Financial Intents
- ✅ Events: `ENCOUNTER_COMPLETED`, `INVOICE_CREATED`, `PAYMENT_RECEIVED`, etc.
- ✅ Intents: `REVENUE_RECOGNIZED`, `ACCOUNTS_RECEIVABLE_DUE`, `PAYMENT_RECEIVED`, etc.

**Source:** `src/platform/integration-hub/finance-event-publisher.ts`

**Education:**
- ✅ Design specifies transformation: `ENROLLMENT_CONFIRMED` → `TUITION_OBLIGATION_RECOGNIZED`
- ✅ Touch Points document: 6 touch points mapped

**Source:** `EDUCATION_FINANCE_TOUCH_POINTS.md`

**Retail:**
- ✅ Discovery specifies transformation: `ORDER_FULFILLED` → `REVENUE_RECOGNIZED`, `INVENTORY_ISSUED` → `COST_OF_GOODS_RECOGNIZED`
- ✅ Complex case: `RETURN_CREATED` → `SALES_RETURN_RECOGNIZED` + `INVENTORY_RESTORED` (1:N)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (service-based)
- ✅ Education (tuition-based)
- ✅ Retail (product-based)

**Domain-agnostic?**
- ✅ Transformation logic varies by industry (correct — Adapter responsibility)
- ✅ Transformation mechanism common (pattern reusable)

**Boundary clear?**
- ✅ Adapter owns transformation logic (not Runtime)
- ✅ Runtime provides transformation infrastructure (if needed)

---

### Classification

**Status:** 🟡 **CANDIDATE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven
- **Boundary question:** Is "transformation infrastructure" a Runtime concern, or purely Adapter concern?

**Further analysis needed:**
> Does Runtime provide transformation utilities (e.g., schema mapping, validation hooks), or is transformation purely Adapter code?

**Recommendation:**
- If Runtime provides utilities (schema helpers, validation framework) → **CORE**
- If transformation is pure Adapter code → **REJECTED** (not a Runtime primitive)

**Defer to Runtime Design for final decision.**

---

## P-002: Financial Intent Validation

### Description

**Validation that Financial Intent conforms to Finance OS contract.**

**Pattern:**
```
Financial Intent
    ↓
Validation (schema, required fields, tenant, amount)
    ↓
Valid Intent → Finance OS
Invalid Intent → Reject / Quarantine
```

**Example:**
- Validate `tenantId` present
- Validate `amount` is number > 0
- Validate `entityType` matches expected types
- Validate `metadata` contains required fields

---

### Evidence

**Hospital:**
- ✅ Integration Hub validates intents before sending to Finance
- ✅ Validation: `tenantId`, `entityId`, `entityType`, `amount`, `metadata`

**Source:** `src/platform/integration-hub/finance-event-publisher.ts` (implicit validation)

**Education:**
- ✅ Product Definition specifies intent validation requirements
- ✅ Contract Design will include validation rules

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies validation needs (amount, inventory quantity, etc.)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital validates intents
- ✅ Education will validate intents
- ✅ Retail will validate intents

**Domain-agnostic?**
- ✅ Validation rules vary by intent type (correct)
- ✅ Validation mechanism common (schema validation, required fields)

**Boundary clear?**
- ✅ Runtime validates contract conformance (schema, required fields)
- ✅ Finance validates accounting semantics (GL account valid, posting rules exist)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven
- Boundary clear (Runtime validates contract, Finance validates accounting)
- Reusable infrastructure (schema validation, required field checks)

**Runtime Responsibility:**
- ✅ Schema validation (intent structure correct?)
- ✅ Required field validation (tenantId, amount present?)
- ✅ Type validation (amount is number?)

**Finance Responsibility:**
- ✅ Accounting validation (GL account exists? Posting rule defined?)

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-003: 1:N Intent Generation

### Description

**One business event generates multiple Financial Intents.**

**Pattern:**
```
Business Event
    ↓
Adapter Logic
    ↓
Financial Intent 1
Financial Intent 2
Financial Intent N
```

**Example:**
- Retail: `RETURN_CREATED` → `SALES_RETURN_RECOGNIZED` + `INVENTORY_RESTORED`

---

### Evidence

**Hospital:**
- 🟡 Partial evidence: Some events generate multiple intents (e.g., Insurance claim might trigger AR + Payment)
- 🟡 Not explicit 1:N pattern in current implementation

**Education:**
- 🟡 Design suggests potential 1:N (e.g., `ENROLLMENT_CANCELLED` → `REFUND_DUE` + `REVENUE_REVERSAL`)
- 🟡 Not yet implemented

**Retail:**
- ✅ Explicit 1:N: `RETURN_CREATED` → `SALES_RETURN_RECOGNIZED` + `INVENTORY_RESTORED` + `COGS_REVERSAL`

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- 🟡 Hospital (partial)
- 🟡 Education (design-level)
- ✅ Retail (explicit)

**Domain-agnostic?**
- ✅ Which intents generated = domain-specific (correct — Adapter decides)
- ✅ Mechanism to emit multiple intents = common pattern

**Boundary clear?**
- ✅ Adapter decides which intents to generate (business logic)
- ✅ Runtime handles multiple intents (delivery, ordering, atomicity)

---

### Classification

**Status:** 🟡 **CANDIDATE**

**Rationale:**
- Evidence moderate (1 explicit, 2 partial)
- Generality likely (pattern appears in Retail, could apply to Hospital/Education)
- Boundary clear (Adapter decides what, Runtime handles how)

**Question:**
> Is 1:N a distinct primitive, or just "Adapter emits array of intents"?

**Recommendation:**
- If Runtime provides 1:N-specific features (ordering guarantee, partial failure handling) → **CORE**
- If 1:N is just "Adapter calls publishIntent() multiple times" → **REJECTED** (no Runtime primitive needed)

**Defer to Runtime Design.**

---

## P-004: Idempotency

### Description

**Ensure Financial Intent processed exactly once, even if delivered multiple times.**

**Pattern:**
```
Financial Intent (with idempotency key)
    ↓
Runtime checks: Already processed?
    ↓
Yes → Skip (return success)
No → Process → Record processed
```

**Example:**
- Hospital sends `PAYMENT_RECEIVED` with `correlationId: "pay-12345"`
- If delivered twice (network retry), Finance processes once

---

### Evidence

**Hospital:**
- ✅ Integration Hub uses Transactional Outbox (ensures at-least-once delivery)
- ✅ Implicit idempotency via `correlationId`

**Source:** `src/platform/integration-hub/finance-event-publisher.ts`

**Education:**
- ✅ Design specifies idempotency requirement
- ✅ Contract will include `correlationId` or idempotency key

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies idempotency need (e.g., `ORDER_FULFILLED` must not create duplicate revenue)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (operational)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Idempotency key = domain-agnostic (correlationId, transactionId, etc.)
- ✅ Idempotency check = domain-agnostic (hash-based or key-based)

**Boundary clear?**
- ✅ Runtime enforces idempotency (check + record)
- ✅ Industry/Adapter provides idempotency key
- ✅ Finance processes intent (once)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven (all integrations need idempotency)
- Boundary clear (Runtime enforces, Adapter provides key)
- Critical reliability primitive

**Runtime Responsibility:**
- ✅ Idempotency key extraction (from intent)
- ✅ Duplicate detection (check if already processed)
- ✅ Processed record tracking (store processed keys)

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-005: Transactional Outbox

### Description

**Ensure Financial Intent published reliably, even if sender crashes after committing business transaction.**

**Pattern:**
```
Business Transaction
    ↓
Write to Outbox (same transaction)
    ↓
COMMIT
    ↓
Outbox Worker publishes to Finance
    ↓
Delete from Outbox
```

**Example:**
- Hospital: Encounter completed → Write to outbox → Publish `REVENUE_RECOGNIZED`
- If publish fails, outbox worker retries

---

### Evidence

**Hospital:**
- ✅ Integration Hub uses Transactional Outbox pattern
- ✅ Outbox table: `integration_outbox` (implied)

**Source:** `src/platform/integration-hub/finance-event-publisher.ts`

**Education:**
- ✅ Design specifies outbox requirement (reliability)

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies need for reliable publish (Order fulfillment → Revenue)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (operational)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Outbox pattern = domain-agnostic
- ✅ Payload varies by industry (correct)

**Boundary clear?**
- ✅ Runtime provides outbox infrastructure (table, worker, retry)
- ✅ Adapter writes to outbox (business event → intent)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven (all integrations need reliability)
- Boundary clear (Runtime provides infrastructure)
- Critical reliability primitive

**Runtime Responsibility:**
- ✅ Outbox table schema
- ✅ Outbox writer (transactional write)
- ✅ Outbox worker (polling, publish, delete)
- ✅ Retry logic

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-006: Retry / Backoff

### Description

**Retry failed Financial Intent delivery with exponential backoff.**

**Pattern:**
```
Publish Intent
    ↓
Delivery fails
    ↓
Wait (backoff: 1s, 2s, 4s, 8s, ...)
    ↓
Retry
    ↓
Success → Stop
Max retries → Quarantine
```

**Example:**
- Hospital sends `REVENUE_RECOGNIZED`, Finance OS down
- Retry with backoff until success or max retries

---

### Evidence

**Hospital:**
- ✅ Integration Hub implements retry (implied by outbox worker)
- 🟡 Backoff strategy not explicitly documented

**Source:** `src/platform/integration-hub/finance-event-publisher.ts`

**Education:**
- ✅ Design specifies retry requirement

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies retry need (transient failures)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (operational)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Retry logic = domain-agnostic
- ✅ Backoff strategy = domain-agnostic (exponential, jitter)

**Boundary clear?**
- ✅ Runtime handles retry (when, how many times)
- ✅ Runtime does NOT decide what to retry (Adapter/Finance decide if retryable)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven (all integrations need retry)
- Boundary clear (Runtime handles retry mechanism)
- Critical reliability primitive

**Runtime Responsibility:**
- ✅ Retry loop (attempt, backoff, re-attempt)
- ✅ Backoff strategy (exponential, jitter)
- ✅ Max retry limit
- ✅ Retry counter tracking

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-007: Quarantine / Poison Message Handling

### Description

**Move persistently failing intents to quarantine for manual review.**

**Pattern:**
```
Publish Intent
    ↓
Delivery fails
    ↓
Retry (with backoff)
    ↓
Max retries exceeded
    ↓
Move to Quarantine
    ↓
Alert / Manual review
```

**Example:**
- Hospital sends malformed `REVENUE_RECOGNIZED` (missing tenantId)
- Fails validation repeatedly → Quarantine

---

### Evidence

**Hospital:**
- 🟡 Quarantine not explicitly implemented (current system)
- ✅ Need identified (error handling)

**Education:**
- ✅ Design specifies quarantine requirement (for poison messages)

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies need (e.g., malformed inventory movement)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- 🟡 Hospital (not yet implemented)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Quarantine mechanism = domain-agnostic
- ✅ Quarantine triggers vary (validation fail, max retries, etc.)

**Boundary clear?**
- ✅ Runtime moves message to quarantine (mechanism)
- ✅ Finance/Adapter defines what is "poison" (business logic)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence moderate (2/3 design-level, 1/3 identified need)
- Generality proven (all integrations need error handling)
- Boundary clear (Runtime provides mechanism)
- Critical reliability primitive (prevents message loss)

**Runtime Responsibility:**
- ✅ Quarantine table/queue
- ✅ Move to quarantine (after max retries or permanent error)
- ✅ Quarantine monitoring/alerting

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-008: Tenant Context Enforcement

### Description

**Ensure every Financial Intent contains valid tenant context, enforced at Runtime boundary.**

**Pattern:**
```
Financial Intent
    ↓
Runtime checks: tenantId present? valid?
    ↓
Yes → Process
No → Reject (validation error)
```

**Example:**
- Hospital: Every intent has `tenantId: "hospital-abc"`
- Education: Every intent has `tenantId: "school-xyz"`
- Runtime rejects intents without tenantId

---

### Evidence

**Hospital:**
- ✅ All Financial Intents include `tenantId`
- ✅ Tenant isolation enforced (F1-F5 uses tenantId for all queries)

**Source:** `src/platform/integration-hub/finance-event-contract.types.ts`, Finance Kernel

**Education:**
- ✅ Design specifies `tenantId` required
- ✅ Tenant isolation critical (Gate 0 / P0)

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery specifies tenant context required

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (operational)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Tenant context = domain-agnostic (all multi-tenant systems need this)

**Boundary clear?**
- ✅ Runtime enforces tenantId presence (validation)
- ✅ Finance enforces tenant isolation (data access)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven (all multi-tenant integrations need this)
- Boundary clear (Runtime validates, Finance isolates)
- Critical security/isolation primitive

**Runtime Responsibility:**
- ✅ Tenant context extraction (from intent)
- ✅ Tenant context validation (tenantId present? valid format?)
- ✅ Tenant context propagation (pass to Finance)

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-009: Correlation / Trace Context

### Description

**Track Financial Intent through Industry → Integration → Finance for observability and debugging.**

**Pattern:**
```
Business Event (correlationId: "evt-12345")
    ↓
Adapter (preserve correlationId)
    ↓
Financial Intent (correlationId: "evt-12345")
    ↓
Finance (log correlationId)
```

**Example:**
- Hospital: `ENCOUNTER_COMPLETED` (correlationId: "enc-12345") → `REVENUE_RECOGNIZED` (correlationId: "enc-12345")
- Trace entire flow in logs

---

### Evidence

**Hospital:**
- ✅ Integration Hub includes `correlationId` in intents
- ✅ Used for tracing and debugging

**Source:** `src/platform/integration-hub/finance-event-contract.types.ts`

**Education:**
- ✅ Design specifies `correlationId` required

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies need for tracing (Order → Revenue → COGS)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (operational)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Correlation ID = domain-agnostic (tracing standard)

**Boundary clear?**
- ✅ Runtime propagates correlationId (infrastructure)
- ✅ Industry/Adapter generates correlationId (business event)
- ✅ Finance logs correlationId (observability)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven (all integrations need tracing)
- Boundary clear (Runtime propagates, Industry generates)
- Critical observability primitive

**Runtime Responsibility:**
- ✅ Correlation ID extraction (from intent)
- ✅ Correlation ID validation (present? format?)
- ✅ Correlation ID propagation (to Finance, logs)

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-010: Audit / Provenance

### Description

**Record who, what, when for every Financial Intent (audit trail).**

**Pattern:**
```
Financial Intent
    ↓
Runtime records:
  - Intent type
  - Timestamp
  - Source (Industry)
  - Tenant
  - CorrelationId
  - Status (pending/success/fail)
    ↓
Audit log
```

**Example:**
- Hospital: `REVENUE_RECOGNIZED` at 2026-08-18 10:00:00 from Hospital OS, tenant "hospital-abc"

---

### Evidence

**Hospital:**
- ✅ Integration Hub logs all intents
- ✅ Audit trail in Finance OS (O7 Observability)

**Source:** `docs/testing/O7_OBSERVABILITY_EVIDENCE.md`

**Education:**
- ✅ Design specifies audit requirement

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- ✅ Discovery identifies audit need (compliance, debugging)

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- ✅ Hospital (operational)
- ✅ Education (design)
- ✅ Retail (discovery)

**Domain-agnostic?**
- ✅ Audit trail = domain-agnostic (who, what, when)

**Boundary clear?**
- ✅ Runtime records audit trail (infrastructure)
- ✅ Finance audits accounting treatment (F5 audit)

---

### Classification

**Status:** 🟢 **CORE**

**Rationale:**
- Evidence strong (3/3 industries)
- Generality proven (all integrations need audit)
- Boundary clear (Runtime audits delivery, Finance audits accounting)
- Critical compliance/observability primitive

**Runtime Responsibility:**
- ✅ Audit log schema
- ✅ Record intent metadata (who, what, when)
- ✅ Record delivery status (pending, success, fail)

**Recommendation:** ✅ **INCLUDE IN RUNTIME**

---

## P-011: Policy Reference Resolution

### Description

**Resolve which policy profile applies to this tenant/industry for this intent.**

**Pattern:**
```
Financial Intent (tenantId: "school-xyz")
    ↓
Runtime resolves: Which policy profile?
    ↓
Policy Profile: "University Model"
    ↓
Pass to Finance (with policy reference)
```

**Example:**
- Education: Tenant "school-xyz" uses "University Model" (P1 = Revenue on payment)
- Runtime resolves policy profile, passes reference to Finance

---

### Evidence

**Hospital:**
- 🟡 Implicit policy (F3 Posting Rules)
- 🟡 No explicit policy profile resolution

**Education:**
- ✅ Design specifies policy profiles (P1-P4)
- ✅ Policy reference required for Finance to apply correct treatment

**Source:** `EDUCATION_FINANCE_P1_P4_PRODUCT_DEFINITION_PROPOSAL_V1.md`

**Retail:**
- ✅ Discovery identifies policy needs (COGS method: FIFO vs. LIFO)
- ✅ Policy resolution needed

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- 🟡 Hospital (implicit, not explicit)
- ✅ Education (explicit policy profiles)
- ✅ Retail (policy-dependent accounting)

**Domain-agnostic?**
- ✅ Policy resolution mechanism = domain-agnostic
- ✅ Policy content = domain-specific (correct — Finance decides)

**Boundary clear?**
- ✅ Runtime resolves which policy (lookup by tenant/industry)
- ✅ Finance applies policy (accounting treatment)
- ✅ Runtime does NOT interpret policy (Finance does)

---

### Classification

**Status:** 🟡 **CANDIDATE**

**Rationale:**
- Evidence moderate (1 implicit, 2 explicit)
- Generality likely (multi-policy systems need resolution)
- Boundary clear (Runtime resolves, Finance interprets)

**Question:**
> Is policy resolution a Runtime concern, or Finance concern?

**Option A:** Runtime resolves policy ID → Finance looks up policy  
**Option B:** Finance handles all policy resolution (Runtime just passes tenantId)

**Recommendation:**
- If policy resolution reusable across industries → **CORE**
- If policy resolution Finance-specific → **REJECTED**

**Defer to Runtime Design.**

---

## P-012: Contract Versioning

### Description

**Support multiple Financial Intent contract versions simultaneously (for migration, backward compatibility).**

**Pattern:**
```
Financial Intent (contractVersion: "v2")
    ↓
Runtime routes to correct parser/validator
    ↓
Finance processes (version-aware)
```

**Example:**
- Hospital uses contract v1 (old)
- Education uses contract v2 (new with policy fields)
- Runtime handles both

---

### Evidence

**Hospital:**
- 🟡 Implicit versioning (code version)
- 🟡 No explicit contract version field

**Education:**
- ✅ Design considers versioning (contract evolution)
- 🟡 Not yet implemented

**Source:** `EDUCATION_FINANCE_PRODUCT_DEFINITION_GATE.md`

**Retail:**
- 🟡 Versioning identified as future need

**Source:** `RETAIL_FINANCE_DISCOVERY_V1.md`

---

### Generality Test

**Works across industries?**
- 🟡 Hospital (implicit)
- 🟡 Education (design consideration)
- 🟡 Retail (future need)

**Domain-agnostic?**
- ✅ Versioning mechanism = domain-agnostic
- ✅ Contract changes = domain-specific (correct)

**Boundary clear?**
- ✅ Runtime routes by version (infrastructure)
- ✅ Finance processes version-specific intents

---

### Classification

**Status:** 🟡 **CANDIDATE**

**Rationale:**
- Evidence weak (not yet operational in any industry)
- Generality likely (all evolving systems need versioning)
- Boundary clear (Runtime routes, Finance processes)

**Question:**
> Is versioning needed now, or future need?

**Recommendation:**
- If Hospital/Education need migration soon → **CORE**
- If versioning future need → **DEFER** (not v1 priority)

**Defer to Runtime Design.**

---

## Primitives Summary

| ID | Primitive | Status | Evidence | Recommendation |
|----|-----------|--------|----------|----------------|
| P-001 | Event → Intent Transformation | 🟡 CANDIDATE | 3/3 | Defer (boundary question) |
| P-002 | Financial Intent Validation | 🟢 CORE | 3/3 | ✅ Include |
| P-003 | 1:N Intent Generation | 🟡 CANDIDATE | 1/3 explicit | Defer (mechanism question) |
| P-004 | Idempotency | 🟢 CORE | 3/3 | ✅ Include |
| P-005 | Transactional Outbox | 🟢 CORE | 3/3 | ✅ Include |
| P-006 | Retry / Backoff | 🟢 CORE | 3/3 | ✅ Include |
| P-007 | Quarantine / Poison Message | 🟢 CORE | 2/3 design | ✅ Include |
| P-008 | Tenant Context Enforcement | 🟢 CORE | 3/3 | ✅ Include |
| P-009 | Correlation / Trace Context | 🟢 CORE | 3/3 | ✅ Include |
| P-010 | Audit / Provenance | 🟢 CORE | 3/3 | ✅ Include |
| P-011 | Policy Reference Resolution | 🟡 CANDIDATE | 2/3 explicit | Defer (boundary question) |
| P-012 | Contract Versioning | 🟡 CANDIDATE | 0/3 operational | Defer (future need) |

**CORE primitives (8):**
1. P-002: Financial Intent Validation
2. P-004: Idempotency
3. P-005: Transactional Outbox
4. P-006: Retry / Backoff
5. P-007: Quarantine / Poison Message Handling
6. P-008: Tenant Context Enforcement
7. P-009: Correlation / Trace Context
8. P-010: Audit / Provenance

**CANDIDATE primitives (4):**
1. P-001: Event → Intent Transformation (boundary question)
2. P-003: 1:N Intent Generation (mechanism question)
3. P-011: Policy Reference Resolution (boundary question)
4. P-012: Contract Versioning (future need)

---

## REJECTED Primitives

**These are NOT common integration primitives:**

### R-001: Revenue Recognition Engine

**Rationale:**
- ❌ Domain-specific (varies by industry)
- ❌ Accounting logic (Finance OS responsibility)
- **Boundary violation:** If Runtime decides when to recognize revenue → Runtime becomes Finance OS v2

**Correct separation:**
- Industry: "Enrollment confirmed" (business truth)
- Integration: "TUITION_OBLIGATION_RECOGNIZED" (semantic intent)
- Finance: Apply revenue recognition policy (accounting treatment)

---

### R-002: COGS Calculator

**Rationale:**
- ❌ Retail-specific
- ❌ Accounting logic (Finance OS responsibility)
- **Boundary violation:** If Runtime calculates COGS (FIFO/LIFO) → Runtime becomes Finance OS v2

**Correct separation:**
- Retail: "Inventory issued" (business truth)
- Integration: "COST_OF_GOODS_RECOGNIZED" (semantic intent, quantity + product)
- Finance: Calculate COGS using FIFO/LIFO policy (accounting treatment)

---

### R-003: AR Aging Calculator

**Rationale:**
- ❌ Domain-specific
- ❌ Accounting logic (Finance OS responsibility)

**Correct separation:**
- Industry: "Payment overdue" (business truth)
- Finance: Age AR buckets (0-30, 31-60, etc.)

---

### R-004: GL Account Selector

**Rationale:**
- ❌ Accounting logic (Finance OS responsibility)
- **Boundary violation:** If Runtime selects GL accounts → Finance Protection violated

**Correct separation:**
- Integration: Semantic intent ("REVENUE_RECOGNIZED")
- Finance: Select GL account (via F3 Posting Rules)

---

### R-005: Payment Allocation Algorithm

**Rationale:**
- ❌ Domain-specific (varies by industry policy)
- ❌ Business logic (Finance OS applies policy)

**Correct separation:**
- Industry: "Payment received, amount $100"
- Integration: "PAYMENT_RECEIVED" (semantic)
- Finance: Allocate payment (FIFO, LIFO, oldest due, etc.) per policy

---

## Runtime Candidate Set

**From 12 candidate primitives:**

**8 CORE primitives recommended for Runtime v1:**
1. Financial Intent Validation
2. Idempotency
3. Transactional Outbox
4. Retry / Backoff
5. Quarantine / Poison Message Handling
6. Tenant Context Enforcement
7. Correlation / Trace Context
8. Audit / Provenance

**4 CANDIDATE primitives deferred:**
1. Event → Intent Transformation (defer to Runtime Design)
2. 1:N Intent Generation (defer to Runtime Design)
3. Policy Reference Resolution (defer to Runtime Design)
4. Contract Versioning (defer — not v1 priority)

---

## Boundary Verification

**Runtime Candidate Set stays in its lane:**

```
INDUSTRY OS
    │
    ↓ Business Truth (Enrollment, Order, Encounter)
ADAPTER
    │
    ↓ Semantic Transformation (Business Event → Financial Intent)
FINANCIAL INTENT
    │
    ↓
★ COMMON INTEGRATION RUNTIME (8 CORE PRIMITIVES) ★
    │
    ├─ Validation (schema, required fields)
    ├─ Idempotency (duplicate detection)
    ├─ Outbox (reliable publish)
    ├─ Retry (with backoff)
    ├─ Quarantine (poison messages)
    ├─ Tenant Context (isolation)
    ├─ Correlation (tracing)
    └─ Audit (provenance)
    │
    ↓
FINANCE OS
    │
    ├─ Accounting Treatment (P1-P4 policy application)
    ├─ GL Account Selection (F3 Posting Rules)
    ├─ DR/CR Decision (Finance authority)
    ├─ Revenue Recognition (accounting policy)
    └─ COGS Calculation (FIFO/LIFO)
    │
    ↓
F1-F5 (Financial Integrity)
```

**Verification:**
- ✅ Runtime does NOT decide accounting treatment
- ✅ Runtime does NOT select GL accounts
- ✅ Runtime does NOT calculate revenue, COGS, AR aging
- ✅ Runtime does NOT interpret policies (Finance does)
- ✅ Runtime provides reliability, isolation, observability ONLY

**Boundary respected:** ✅ PASS

---

## Next Steps

**After Primitives v1:**

```
Primitives v1 (THIS DOCUMENT)
    ↓
Primitive Review (validate boundary, feasibility)
    ↓
Runtime Candidate Set (8 CORE primitives)
    ↓
Common Integration Runtime Design
    ↓
Runtime Architecture Gate (E-ARCH)
    ↓
Implementation
    ↓
Verification
    ↓
Runtime v1 Freeze
```

**No code until:**
- ✅ Runtime Design complete
- ✅ Architecture Gate PASS

---

## Governance Reminder

**Education status unchanged:**
- 🟡 **AWAITING PRODUCT OWNER APPROVAL** (Phase 3 Gate)
- Primitives extraction does NOT bypass Product Definition Gate
- Education Phase 3 → 4 blocked until PO approves

**Template status:**
- 🔒 **FROZEN v1.0** (no changes)

**Constitution status:**
- 🔒 **FROZEN v1.0.0** (no changes)

---

## Document Status

**Version:** 1.0.0  
**Status:** DRAFT  
**Evidence:** Hospital (operational) + Education (design) + Retail (adversarial)

**CORE primitives:** 8  
**CANDIDATE primitives:** 4  
**REJECTED primitives:** 5

**Recommendation:** Proceed to Runtime Design with 8 CORE primitives

---

**END OF COMMON INTEGRATION PRIMITIVES V1**

**Primitives extracted. Boundary verified. Runtime candidate set defined.**
