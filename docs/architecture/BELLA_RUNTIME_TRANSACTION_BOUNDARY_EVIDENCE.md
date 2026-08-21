# Bella Runtime Transaction Boundary Evidence

**Status:** BLOCKED — Transaction boundary NOT PROVEN  
**Date:** 2026-08-19  
**Blocker for:** Week 2 Implementation Plan v1.1  
**Required Invariant:** `Outbox INSERT → Idempotency INSERT → Audit INSERT` MUST be atomic  

---

## Executive Summary

**DECISION: B. TRANSACTION BOUNDARY NOT PROVEN**

The current Bella Runtime stack **DOES NOT** support application-layer atomic transactions via `supabase-js@^2.108.2`. Week 2 implementation **REMAINS BLOCKED** until an architectural decision is made.

**Available Options:**
1. PostgreSQL stored procedure (RPC) — **Architectural review required**
2. Direct database connection (pg Pool) — **Architectural change required**
3. Accept non-atomic writes — **REJECTED by user**
4. Defer Week 2 until transaction infrastructure built

---

## Investigation Summary

### 1. Stack Evidence

**Current Dependencies:**
```json
{
  "@supabase/supabase-js": "^2.108.2",
  "pg": "^8.22.0"
}
```

**Database Access Architecture:**
- **Primary:** `@supabase/supabase-js` client → PostgREST → PostgreSQL
- **Integration Hub (H1.2):** Direct `pg.Pool` connections (Finance Outbox Worker)
- **Runtime Phase 3B:** Uses `supabase-js` client only (NO direct pg access)

---

## 2. Transaction Support Analysis

### A. Supabase JS Client (`@supabase/supabase-js`)

**Finding:** ❌ **NO application-layer transaction support**

**Evidence:**
- [GitHub Issue #472](https://github.com/supabase/supabase/issues/472): "It is technically possible, but something we are unlikely to do within the client libraries since it could cause a lock on a table if the transaction fails due to a network error. We could add timeouts, but it's much safer to just write a Postgres Function and call it with an rpc() request."
- [GitHub Discussion #526](https://github.com/orgs/supabase/discussions/526): "In general, there aren't any imminent plans to implement this feature outside of RPCs."
- [Marmelab Blog](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html): "The supabase-js client does not support transactions. It's based on PostgREST, which lacks transaction capabilities."

**Reason:**  
PostgREST (HTTP layer) cannot maintain stateful database connections for multi-operation transactions. Each HTTP request is isolated.

**Implication:**  
Sequential `supabase.from('runtime_outbox').insert()` → `supabase.from('runtime_idempotency_registry').insert()` → `supabase.from('runtime_audit_log').insert()` **is NOT atomic**.

---

### B. PostgreSQL RPC/Stored Procedure

**Finding:** ✅ **Atomic transactions SUPPORTED**

**Evidence:**
- Existing Bella pattern: `supabase/migrations/20260607023000_harden_accounting_outbox_idempotency.sql`
- Function: `enqueue_accounting_event()` performs multi-operation logic atomically
- RLS preserved: Stored procedures execute with caller's privileges (RLS enforced)
- Error handling: PostgreSQL `BEGIN/COMMIT/ROLLBACK` semantics

**Example from existing codebase:**
```sql
CREATE OR REPLACE FUNCTION public.enqueue_accounting_event(
    p_tenant_id UUID,
    p_event_type TEXT,
    p_reference_type TEXT,
    p_reference_id UUID,
    p_payload JSONB
) RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    -- Atomic: INSERT with ON CONFLICT idempotency
    INSERT INTO public.accounting_outbox (
        tenant_id, event_type, reference_type, reference_id, payload
    ) VALUES (
        p_tenant_id, p_event_type, p_reference_type, p_reference_id, p_payload
    )
    ON CONFLICT (tenant_id, event_type, reference_type, reference_id) DO NOTHING
    RETURNING id INTO v_id;

    -- Fallback SELECT on conflict
    IF v_id IS NULL THEN
        SELECT id INTO v_id
        FROM public.accounting_outbox
        WHERE tenant_id = p_tenant_id
          AND event_type = p_event_type
          AND reference_type = p_reference_type
          AND reference_id = p_reference_id
        LIMIT 1;
    END IF;

    RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Invocation from application:**
```typescript
const { data: outboxId, error } = await supabase.rpc('enqueue_accounting_event', {
  p_tenant_id: tenantId,
  p_event_type: eventType,
  p_reference_type: referenceType,
  p_reference_id: referenceId,
  p_payload: payload
});
```

**Architectural Precedent:**
- ✅ Used in Finance Outbox (H1.2)
- ✅ Used in Real Estate reservation (`reserve_product`)
- ✅ Used in Onboarding (`onboard_tenant`)
- ✅ Used in Legacy Ledger Sync (`sync_legacy_to_ledger_atomic`)

**Constraints:**
- Business logic moves to SQL (Developer Experience trade-off)
- Migration file for every RPC change
- No TypeScript type safety (SQL string)
- Migration history grows (harder to maintain)

**Security:**
- ✅ RLS preserved (authenticated role)
- ✅ Tenant isolation enforced
- ✅ JWT context available via `auth.uid()`, `public.get_auth_tenant_id()`

**Rollback Behavior:**
- ✅ Automatic on `RAISE EXCEPTION`
- ✅ Automatic on constraint violation
- ✅ All-or-nothing semantics

---

### C. Direct Database Connection (`pg.Pool`)

**Finding:** ✅ **Atomic transactions SUPPORTED**

**Evidence:**
- Existing Bella pattern: `src/platform/integration-hub/db-connection.ts`
- Finance Outbox Worker uses direct `pg.Pool` with `BEGIN/COMMIT/ROLLBACK`
- [Marmelab Blog](https://marmelab.com/blog/2025/12/08/supabase-edge-function-transaction-rls.html) documents pattern with RLS enforcement

**Example from existing codebase (Integration Hub):**
```typescript
export async function claimEvent(db?: Pool): Promise<OutboxEvent | null> {
  const pool = db || getWorkerPool();
  
  const result = await pool.query<OutboxEvent>(`
    UPDATE finance_outbox_events
    SET 
      status = 'PROCESSING',
      claimed_by = $1,
      claimed_at = now(),
      lease_expires_at = now() + interval '${LEASE_DURATION_SECONDS} seconds'
    WHERE event_id = (
      SELECT event_id
      FROM finance_outbox_events
      WHERE status IN ('PENDING', 'FAILED')
        AND (next_retry_at IS NULL OR next_retry_at <= now())
        AND (lease_expires_at IS NULL OR lease_expires_at < now())
        AND claimed_by IS NULL
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING *
  `, [WORKER_ID]);
  
  return result.rows[0];
}
```

**Pattern for atomic multi-operation:**
```typescript
const pool = getWorkerPool();
const client = await pool.connect();
try {
  await client.query('BEGIN');
  
  // Enable RLS for authenticated role
  await client.query('SET LOCAL ROLE authenticated');
  await client.query('SET LOCAL request.jwt.claim.sub = $1', [userId]);
  
  // Atomic operations
  const outboxResult = await client.query(
    'INSERT INTO runtime_outbox (...) VALUES (...) RETURNING outbox_id',
    [params]
  );
  
  await client.query(
    'INSERT INTO runtime_idempotency_registry (...) VALUES (...)',
    [outboxResult.rows[0].outbox_id, idempotencyKey]
  );
  
  await client.query(
    'INSERT INTO runtime_audit_log (...) VALUES (...)',
    [outboxResult.rows[0].outbox_id]
  );
  
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**Constraints:**
- Architecture change: Runtime Phase 3B currently uses `supabase-js` only
- Boilerplate: Connection management, `BEGIN/COMMIT/ROLLBACK`
- RLS enforcement: Manual role switching required
- Error handling: Manual rollback logic

**Security:**
- ✅ RLS preserved (requires `SET LOCAL ROLE authenticated`)
- ✅ Tenant isolation enforced (requires `SET LOCAL request.jwt.claim.sub`)
- ✅ Rollback on error

**Rollback Behavior:**
- ✅ Explicit rollback on exception
- ✅ All-or-nothing semantics

**Precedent:**
- ✅ Used in Integration Hub (H1.2) Finance Outbox Worker
- ❌ **NOT used in Runtime Phase 3B** (different architecture)

---

## 3. Week 2 Transaction Requirement

**Required Atomic Operation:**
```typescript
await atomicTransaction(async (tx) => {
  // 1. INSERT runtime_outbox → get outbox_id
  const outboxId = await outboxRepo.create(intent, tx);
  
  // 2. INSERT runtime_idempotency_registry (references outbox_id)
  await idempotencyRepo.register({
    tenant_id: tenantId,
    idempotency_key: idempotencyKey,
    outbox_id: outboxId  // FK constraint: NOT NULL
  }, tx);
  
  // 3. INSERT runtime_audit_log (references outbox_id)
  await auditRepo.log({
    outbox_id: outboxId,
    action: 'INTENT_SUBMITTED',
    tenant_id: tenantId
  }, tx);
});
```

**Failure States (if NOT atomic):**

| State | Outbox | Idempotency | Audit | Impact |
|-------|--------|-------------|-------|--------|
| **Partial Success 1** | ✅ CREATED | ❌ FAILED | ❌ NOT CREATED | Duplicate submission possible (idempotency not registered) |
| **Partial Success 2** | ✅ CREATED | ✅ CREATED | ❌ FAILED | No audit trail, compliance violation |
| **Partial Success 3** | ✅ CREATED | ❌ FAILED | ✅ CREATED | FK constraint violation (audit references missing idempotency) |

**User Decision:**  
❌ **Non-atomic writes REJECTED** — "Đó là reliability boundary bị phá."

---

## 4. Options Assessment

### Option A: PostgreSQL Stored Procedure (RPC)

**Mechanism:**
```sql
CREATE OR REPLACE FUNCTION public.submit_financial_intent(
    p_tenant_id UUID,
    p_idempotency_key TEXT,
    p_intent JSONB,
    p_actor_id UUID
) RETURNS UUID AS $$
DECLARE
    v_outbox_id UUID;
BEGIN
    -- 1. INSERT outbox
    INSERT INTO public.runtime_outbox (
        tenant_id, intent_type, intent_payload, status
    ) VALUES (
        p_tenant_id, p_intent->>'type', p_intent, 'PENDING'
    ) RETURNING outbox_id INTO v_outbox_id;

    -- 2. INSERT idempotency (catches concurrent duplicates)
    INSERT INTO public.runtime_idempotency_registry (
        tenant_id, idempotency_key, outbox_id, created_at
    ) VALUES (
        p_tenant_id, p_idempotency_key, v_outbox_id, now()
    );

    -- 3. INSERT audit
    INSERT INTO public.runtime_audit_log (
        outbox_id, action, tenant_id, actor_id, created_at
    ) VALUES (
        v_outbox_id, 'INTENT_SUBMITTED', p_tenant_id, p_actor_id, now()
    );

    RETURN v_outbox_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
```

**Application Usage:**
```typescript
const { data: outboxId, error } = await supabase.rpc('submit_financial_intent', {
  p_tenant_id: tenantId,
  p_idempotency_key: idempotencyKey,
  p_intent: intent,
  p_actor_id: actorId
});

if (error?.code === '23505') {
  // Duplicate idempotency key (database constraint)
  return { status: 'DUPLICATE', outbox_id: null };
}

if (error) {
  throw new Error(`Intent submission failed: ${error.message}`);
}

return { status: 'ACCEPTED', outbox_id: outboxId };
```

**Assessment:**

| Criteria | Status |
|----------|--------|
| **Atomicity** | ✅ Guaranteed (PostgreSQL transaction) |
| **Idempotency** | ✅ Database UNIQUE constraint enforced |
| **RLS** | ✅ Preserved (authenticated role) |
| **Rollback** | ✅ Automatic on error |
| **Architectural Fit** | 🟡 Requires review |
| **Precedent** | ✅ Existing Bella pattern (Finance Outbox, Real Estate, Onboarding) |
| **Developer Experience** | ❌ SQL string, no TypeScript types, migration maintenance |
| **Testability** | ✅ Database-level testing possible |

**Architectural Question:**
- Bella Runtime v1.1 specifies application-layer repositories
- Moving submission logic to RPC shifts business logic to database layer
- **Does this violate Week 2 Plan v1.1 architecture?**

---

### Option B: Direct Database Connection (`pg.Pool`)

**Mechanism:**
```typescript
import { Pool } from 'pg';

export async function submitIntent(
  tenantId: string,
  idempotencyKey: string,
  intent: FinancialIntent,
  actorId: string,
  pool: Pool
): Promise<{ status: 'ACCEPTED' | 'DUPLICATE', outboxId: string | null }> {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    await client.query('SET LOCAL ROLE authenticated');
    await client.query('SET LOCAL request.jwt.claim.sub = $1', [actorId]);
    
    // 1. INSERT outbox
    const outboxResult = await client.query(
      `INSERT INTO runtime_outbox (tenant_id, intent_type, intent_payload, status)
       VALUES ($1, $2, $3, 'PENDING') RETURNING outbox_id`,
      [tenantId, intent.type, JSON.stringify(intent)]
    );
    const outboxId = outboxResult.rows[0].outbox_id;
    
    // 2. INSERT idempotency
    await client.query(
      `INSERT INTO runtime_idempotency_registry (tenant_id, idempotency_key, outbox_id, created_at)
       VALUES ($1, $2, $3, now())`,
      [tenantId, idempotencyKey, outboxId]
    );
    
    // 3. INSERT audit
    await client.query(
      `INSERT INTO runtime_audit_log (outbox_id, action, tenant_id, actor_id, created_at)
       VALUES ($1, 'INTENT_SUBMITTED', $2, $3, now())`,
      [outboxId, tenantId, actorId]
    );
    
    await client.query('COMMIT');
    
    return { status: 'ACCEPTED', outboxId };
    
  } catch (error: any) {
    await client.query('ROLLBACK');
    
    if (error.code === '23505') {
      // Duplicate idempotency key
      return { status: 'DUPLICATE', outboxId: null };
    }
    
    throw error;
  } finally {
    client.release();
  }
}
```

**Assessment:**

| Criteria | Status |
|----------|--------|
| **Atomicity** | ✅ Guaranteed (PostgreSQL transaction) |
| **Idempotency** | ✅ Database UNIQUE constraint enforced |
| **RLS** | ✅ Manual role switching required |
| **Rollback** | ✅ Explicit rollback on error |
| **Architectural Fit** | 🔴 **Architecture change required** |
| **Precedent** | 🟡 Used in Integration Hub (H1.2), NOT in Runtime Phase 3B |
| **Developer Experience** | 🟡 More boilerplate, but TypeScript control |
| **Testability** | ✅ Unit testing with mocked Pool |

**Architectural Change Required:**
- Runtime Phase 3B currently uses `supabase-js` client only
- Adding `pg.Pool` diverges from Phase 3B's frozen architecture
- Requires connection management infrastructure
- **Does Runtime need its own database connection layer like Integration Hub?**

---

### Option C: Sequential Writes (Non-Atomic)

**Mechanism:**
```typescript
const { data: outbox, error: outboxError } = await supabase
  .from('runtime_outbox')
  .insert({ tenant_id: tenantId, intent_type: intent.type, intent_payload: intent })
  .select('outbox_id')
  .single();

if (outboxError) throw outboxError;

const { error: idempotencyError } = await supabase
  .from('runtime_idempotency_registry')
  .insert({ tenant_id: tenantId, idempotency_key: idempotencyKey, outbox_id: outbox.outbox_id });

if (idempotencyError) {
  // Rollback NOT possible — outbox already committed
  throw idempotencyError;
}

const { error: auditError } = await supabase
  .from('runtime_audit_log')
  .insert({ outbox_id: outbox.outbox_id, action: 'INTENT_SUBMITTED', tenant_id: tenantId });

if (auditError) {
  // Rollback NOT possible — outbox + idempotency already committed
  throw auditError;
}
```

**Assessment:**

| Criteria | Status |
|----------|--------|
| **Atomicity** | ❌ **NOT ATOMIC** |
| **Idempotency** | 🔴 Unreliable (outbox created, idempotency failed = duplicate submissions possible) |
| **RLS** | ✅ Preserved |
| **Rollback** | ❌ NOT POSSIBLE |
| **Architectural Fit** | ✅ Uses existing Phase 3B architecture |
| **Precedent** | ❌ Violates reliability boundary |
| **User Decision** | ❌ **REJECTED** — "Đó là reliability boundary bị phá" |

---

### Option D: Single-Table Outbox (Merge Idempotency)

**Mechanism:**
```sql
ALTER TABLE runtime_outbox
  ADD COLUMN idempotency_key TEXT;

ALTER TABLE runtime_outbox
  ADD CONSTRAINT runtime_outbox_idempotency UNIQUE (tenant_id, idempotency_key);
```

**Application:**
```typescript
const { data: outbox, error } = await supabase
  .from('runtime_outbox')
  .insert({
    tenant_id: tenantId,
    idempotency_key: idempotencyKey,
    intent_type: intent.type,
    intent_payload: intent
  })
  .select('outbox_id')
  .single();

if (error?.code === '23505') {
  return { status: 'DUPLICATE' };
}

// Still need separate audit INSERT (not atomic)
```

**Assessment:**

| Criteria | Status |
|----------|--------|
| **Atomicity** | 🟡 Partial (outbox + idempotency, but NOT audit) |
| **Idempotency** | ✅ Database UNIQUE constraint |
| **RLS** | ✅ Preserved |
| **Rollback** | 🟡 Partial |
| **Architectural Fit** | 🔴 Violates separated idempotency registry design |
| **Precedent** | ❌ Schema change required |
| **Schema Evidence** | 🔴 Contradicts `runtime_idempotency_registry` table design |

---

## 5. Architectural Compatibility Assessment

### Current Runtime Phase 3B Architecture

**Frozen Components:**
- `outbox-repository.ts` (Phase 3B)
- `idempotency-repository.ts` (Phase 3B)
- `audit-repository.ts` (Phase 3B)
- Database access: `supabase-js` client
- No direct `pg.Pool` usage

**Repositories Signature:**
```typescript
interface OutboxRepository {
  create(intent: FinancialIntent, tx?: TransactionContext): Promise<string>; // outbox_id
}

interface IdempotencyRepository {
  register(record: IdempotencyRecord, tx?: TransactionContext): Promise<void>;
}

interface AuditRepository {
  log(entry: AuditEntry, tx?: TransactionContext): Promise<void>;
}
```

**Current Implementation (Phase 3B):**
```typescript
// Uses supabase-js client (NO transaction context)
async create(intent: FinancialIntent): Promise<string> {
  const { data, error } = await this.supabase
    .from('runtime_outbox')
    .insert({ ... })
    .select('outbox_id')
    .single();
  
  if (error) throw error;
  return data.outbox_id;
}
```

**Question:** What is `TransactionContext`?
- Currently **UNDEFINED** in Phase 3B
- Interface exists, but NO implementation

---

### Option Compatibility Matrix

| Option | Requires Schema Change | Requires Architecture Change | Preserves Phase 3B Repositories | Preserves Frozen Architecture |
|--------|------------------------|------------------------------|--------------------------------|------------------------------|
| **A. RPC** | ✅ Yes (new RPC migration) | 🟡 Shifts logic to database | ❌ No (bypasses repositories) | 🟡 Requires review |
| **B. pg.Pool** | ❌ No | ✅ Yes (add connection layer) | ✅ Yes (add `tx` parameter) | 🔴 Architecture change |
| **C. Non-Atomic** | ❌ No | ❌ No | ✅ Yes | ❌ **REJECTED** (reliability violation) |
| **D. Single-Table** | ✅ Yes (schema merge) | ❌ No | 🔴 Violates idempotency registry design | 🔴 Schema redesign |

---

## 6. Security / RLS Implications

### RPC Approach (Option A)

**RLS Enforcement:**
```sql
-- RLS policies MUST exist on runtime_outbox, runtime_idempotency_registry, runtime_audit_log
CREATE POLICY runtime_outbox_tenant_isolation ON runtime_outbox
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY runtime_idempotency_tenant_isolation ON runtime_idempotency_registry
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());

CREATE POLICY runtime_audit_tenant_isolation ON runtime_audit_log
  FOR ALL USING (tenant_id = public.get_auth_tenant_id());
```

**RPC Execution Context:**
- Runs as `SECURITY DEFINER` (elevated privileges)
- RLS policies enforced based on `auth.uid()` / `public.get_auth_tenant_id()`
- Caller's JWT claims available

**Security Assessment:**
- ✅ Tenant isolation preserved (RLS)
- ✅ Authenticated user context preserved
- ✅ No privilege escalation (SECURITY DEFINER does NOT bypass RLS)

---

### pg.Pool Approach (Option B)

**RLS Enforcement:**
```typescript
await client.query('SET LOCAL ROLE authenticated');
await client.query('SET LOCAL request.jwt.claim.sub = $1', [userId]);
```

**Security Assessment:**
- ✅ Tenant isolation preserved (manual role switching)
- ✅ RLS enforced after role switch
- 🟡 Requires correct role switching (boilerplate risk)
- 🟡 Must pass `userId` from JWT (application responsibility)

**Risk:**
- If role switching omitted → RLS bypassed (security vulnerability)
- If wrong `userId` passed → RLS compromised

---

## 7. Rollback Behavior

### RPC Approach (Option A)

**Rollback Trigger:**
- `RAISE EXCEPTION` in RPC
- Constraint violation (e.g., `23505` duplicate idempotency key)
- Database error

**Rollback Behavior:**
- ✅ Automatic (PostgreSQL transaction semantics)
- ✅ All-or-nothing (all 3 INSERTs rolled back)
- ✅ Idempotency registry NOT polluted

---

### pg.Pool Approach (Option B)

**Rollback Trigger:**
```typescript
try {
  await client.query('BEGIN');
  // ... operations
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK'); // Explicit rollback required
  throw error;
}
```

**Rollback Behavior:**
- ✅ Explicit rollback (application responsibility)
- ✅ All-or-nothing (all 3 INSERTs rolled back)
- 🟡 Requires correct error handling

**Risk:**
- If `ROLLBACK` omitted → partial data committed (data corruption)

---

## 8. Existing Bella Transaction Patterns

### Pattern 1: Finance Outbox RPC (`enqueue_accounting_event`)

**Location:** `supabase/migrations/20260607023000_harden_accounting_outbox_idempotency.sql`

**Usage:**
- Atomic insertion with idempotency
- Returns `outbox_id` or existing ID on conflict
- Used by Finance domain

**Assessment:**
- ✅ Proven mechanism
- ✅ RLS preserved
- ✅ Idempotency enforced

---

### Pattern 2: Integration Hub Worker (`pg.Pool`)

**Location:** `src/platform/integration-hub/db-connection.ts`

**Usage:**
- Direct `pg.Pool` connections for background workers
- Role-based connection management (`h1_2_worker`, `h1_2_reconciliation_readonly`)
- Atomic claim via `FOR UPDATE SKIP LOCKED`

**Assessment:**
- ✅ Proven mechanism for worker processes
- ✅ Connection pool management
- 🔴 **NOT used in Runtime Phase 3B**

---

### Pattern 3: Legacy Ledger Sync (`sync_legacy_to_ledger_atomic`)

**Location:** `supabase/migrations/20260603040000_branch_legacy_revenue_sync_by_type.sql`

**Usage:**
- Complex multi-table atomic sync
- RPC with extensive business logic
- Tenant locking (`FOR UPDATE`)

**Assessment:**
- ✅ Proven for complex transactions
- ✅ RLS preserved
- ❌ Developer Experience: Difficult to maintain (complex SQL)

---

## 9. Decision Matrix

| Criterion | Option A (RPC) | Option B (pg.Pool) | Option C (Non-Atomic) | Option D (Single-Table) |
|-----------|----------------|--------------------|-----------------------|-------------------------|
| **Atomicity** | ✅ Guaranteed | ✅ Guaranteed | ❌ **NOT ATOMIC** | 🟡 Partial |
| **Idempotency** | ✅ Database enforced | ✅ Database enforced | 🔴 Unreliable | ✅ Database enforced |
| **RLS** | ✅ Preserved | ✅ Manual switching | ✅ Preserved | ✅ Preserved |
| **Rollback** | ✅ Automatic | ✅ Explicit | ❌ NOT POSSIBLE | 🟡 Partial |
| **Architectural Fit** | 🟡 Requires review | 🔴 Change required | ✅ No change | 🔴 Schema redesign |
| **Precedent** | ✅ Existing pattern | 🟡 Partial precedent | ❌ Violates reliability | ❌ No precedent |
| **Developer Experience** | 🔴 SQL string maintenance | 🟡 Boilerplate required | ✅ Simple | 🔴 Schema change |
| **Testability** | ✅ Database-level | ✅ Unit + integration | ✅ Unit testing | 🟡 Requires migration |
| **User Decision** | 🟢 **Not rejected** | 🟢 **Not rejected** | ❌ **REJECTED** | 🟢 **Not rejected** |

---

## 10. Blocker Status

**Current State:**
- ✅ Architecture v1.1 FROZEN
- ✅ Gate 0: 5/5 PASS
- ✅ Schema verified (database UNIQUE constraint exists)
- ✅ Idempotency authority verified (database constraint)
- ✅ Boundary review complete
- 🔴 **Transaction boundary NOT PROVEN**
- 🟡 Week 2 Plan v1.1 CONDITIONAL
- 🔒 **Implementation BLOCKED**

**Required Action:**
1. **Architectural Decision Required:**
   - Option A: Accept RPC pattern (shift logic to database layer)
   - Option B: Add `pg.Pool` to Runtime (architecture change)
   - Option C: ❌ **REJECTED** (non-atomic writes)
   - Option D: Redesign schema (merge idempotency into outbox)

2. **IF Option A selected:**
   - Create Migration 04: `submit_financial_intent` RPC
   - Update Week 2 Plan v1.1: Repository pattern → RPC invocation
   - Update test plan: Database-level transaction testing
   - Final approval → freeze → implement

3. **IF Option B selected:**
   - Create Runtime database connection layer (similar to Integration Hub)
   - Define `TransactionContext` type
   - Implement transaction wrapper
   - Update repositories with `tx` parameter
   - Update Week 2 Plan v1.1 with transaction infrastructure
   - Final approval → freeze → implement

4. **IF Option D selected:**
   - Redesign schema: Merge idempotency into outbox
   - Update Migration 01
   - Update Schema Evidence document
   - Update Week 2 Plan v1.1
   - Re-run Gate 0 (schema change impacts)

---

## 11. Recommendation

**Recommended Path: Option A (PostgreSQL RPC)**

**Rationale:**
1. ✅ **Proven Bella Pattern:** Existing precedent in Finance Outbox, Real Estate, Onboarding, Legacy Ledger Sync
2. ✅ **Minimal Architecture Change:** Reuses existing `supabase.rpc()` infrastructure
3. ✅ **Guaranteed Atomicity:** PostgreSQL transaction semantics
4. ✅ **Idempotency Enforced:** Database UNIQUE constraint catches concurrent duplicates
5. ✅ **RLS Preserved:** Authenticated role, tenant isolation
6. ✅ **Automatic Rollback:** No application rollback logic required
7. 🟡 **Developer Experience Trade-off:** SQL maintenance vs. reliability guarantee

**Alternative: Option B (pg.Pool) IF:**
- Runtime needs transaction infrastructure for future features
- TypeScript control prioritized over RPC pattern
- Architecture change acceptable

**Rejected:**
- ❌ Option C: User explicitly rejected non-atomic writes
- ❌ Option D: Schema redesign violates frozen architecture

---

## 12. Next Steps

### IF Option A (RPC) Approved:

1. **Create Migration 04:**
   ```sql
   CREATE OR REPLACE FUNCTION public.submit_financial_intent(
       p_tenant_id UUID,
       p_idempotency_key TEXT,
       p_intent JSONB,
       p_actor_id UUID
   ) RETURNS UUID AS $$
   -- Atomic: Outbox → Idempotency → Audit
   END;
   $$ LANGUAGE plpgsql SECURITY DEFINER;
   ```

2. **Update Week 2 Plan v1.1:**
   - `submitIntent()` invokes RPC (not repository)
   - Transaction boundary: PostgreSQL RPC
   - Test plan: Concurrent duplicate submission via database

3. **Update Repository Contracts (Optional):**
   - Keep repositories for `processOutbox`, `publishIntent`
   - Submission bypasses repositories (RPC direct)

4. **Verify Security:**
   - RLS policies on all 3 tables
   - JWT context available in RPC
   - Tenant isolation enforced

5. **Final Approval → Freeze → Implement**

---

### IF Option B (pg.Pool) Approved:

1. **Create Runtime Database Connection Layer:**
   - `src/platform/integration-runtime/database/db-connection.ts`
   - Similar to Integration Hub pattern
   - Role: `runtime_worker`

2. **Define `TransactionContext`:**
   ```typescript
   export interface TransactionContext {
     client: PoolClient;
   }
   ```

3. **Create Transaction Wrapper:**
   ```typescript
   export async function withTransaction<T>(
     fn: (tx: TransactionContext) => Promise<T>,
     pool: Pool
   ): Promise<T> {
     const client = await pool.connect();
     try {
       await client.query('BEGIN');
       await client.query('SET LOCAL ROLE authenticated');
       await client.query('SET LOCAL request.jwt.claim.sub = $1', [userId]);
       
       const result = await fn({ client });
       
       await client.query('COMMIT');
       return result;
     } catch (error) {
       await client.query('ROLLBACK');
       throw error;
     } finally {
       client.release();
     }
   }
   ```

4. **Update Repositories:**
   - Add `tx?: TransactionContext` parameter
   - Implement transaction-aware queries

5. **Update Week 2 Plan v1.1:**
   - Transaction boundary: `pg.Pool` with `BEGIN/COMMIT`
   - Connection management infrastructure required
   - Test plan: Transaction rollback on failure

6. **Final Approval → Freeze → Implement**

---

## Conclusion

**BLOCKED:** Week 2 implementation CANNOT proceed until transaction boundary decision made.

**Binary Decision Required:**
- **A.** PostgreSQL RPC (proven pattern, minimal change)
- **B.** Direct pg.Pool (architecture change, TypeScript control)
- **C.** ❌ Non-Atomic Writes (**REJECTED** by user)
- **D.** Single-Table Merge (schema redesign)

**User Input Required:**
- Which option preserves Bella Runtime v1.1 frozen architecture?
- Is shifting submission logic to RPC acceptable?
- Should Runtime build transaction infrastructure like Integration Hub?

**Status:**
```
Architecture v1.1       🔒 FROZEN
Gate 0                  ✅ 5/5
Schema                  ✅ VERIFIED
Idempotency authority   ✅ VERIFIED (database UNIQUE constraint)
Boundary review         ✅ COMPLETE
Transaction boundary    🔴 NOT PROVEN
Week 2 Plan v1.1        🟡 CONDITIONAL (awaiting transaction decision)
Implementation          🔒 BLOCKED
```

---

**Evidence complete. Architectural decision required before proceeding.**
