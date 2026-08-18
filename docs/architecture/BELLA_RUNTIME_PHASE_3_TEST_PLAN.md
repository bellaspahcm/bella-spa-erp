# Bella Runtime — Phase 3 Runtime Enforcement Test Plan

**Date:** 2026-08-18  
**Version:** 1.1 (Amended)  
**Phase:** Phase 3 — Runtime Enforcement  
**Status:** 🟡 TEST PLAN v1.1 (Implementation Pending)

---

## Objective

**Chứng minh những gì đã tuyên bố trong Architecture/Implementation Design thực sự được enforce khi chạy.**

NOT just:
- TypeScript compile-time type checking
- Unit tests của validator functions

BUT:
- End-to-end flow enforcement
- Attack path rejection
- Boundary protection in real scenarios

---

## 6 Enforcement Gates

### P3-1: Finance Protection

**Claim:** Runtime REJECTS intents with prohibited accounting fields

**Prohibited fields:**
```typescript
const PROHIBITED_FIELDS = [
  'glAccount',
  'debit',
  'credit',
  'journalEntry',
  'chartOfAccountsMapping',
  'revenueRecognitionMethod',
  'cogsCalculationMethod',
  'postingRules',
  'ledgerEntry',
  'accountingTreatment',
];
```

**Tests required:**

#### T1.1: Single prohibited field rejection
```typescript
const intent = {
  intentType: 'REVENUE_RECOGNIZED',
  tenantId: 'hospital-a',
  correlationId: 'test-001',
  // ... valid fields
  glAccount: '4000',  // ❌ PROHIBITED
};

await publishIntent(intent);
// Expected: FinanceProtectionError
// Expected: Error message includes 'glAccount'
// Expected: Intent NOT in outbox
// Expected: Audit log records INVALID
```

#### T1.2: Multiple prohibited fields rejection
```typescript
const intent = {
  // ... valid fields
  glAccount: '4000',
  debit: 1000,
  credit: 0,
};

// Expected: FinanceProtectionError (first detected field)
```

#### T1.3: Nested prohibited field rejection (RECURSIVE SCAN)

**CRITICAL ARCHITECTURAL DECISION:**

Runtime MUST recursively scan prohibited fields in nested objects (including `metadata`).

**Rationale:** Finance Protection is boundary security. Cannot rely on "Industry won't nest accounting data in metadata."

**Implementation requirement:**
```typescript
function validateNoProhibitedFields(obj: unknown, path: string = ''): void {
  if (typeof obj !== 'object' || obj === null) return;
  
  for (const [key, value] of Object.entries(obj)) {
    // Check current level
    if (PROHIBITED_FIELDS.includes(key)) {
      throw new FinanceProtectionError(
        `${path}${key}`,
        { path: `${path}${key}`, value }
      );
    }
    
    // Recurse into nested objects
    if (typeof value === 'object' && value !== null) {
      validateNoProhibitedFields(value, `${path}${key}.`);
    }
  }
}
```

**Test cases:**

```typescript
// T1.3a: Top-level metadata with prohibited field
const intent1 = {
  // ... valid fields
  metadata: {
    glAccount: '4000',  // ❌ Nested prohibited field
  },
};
// Expected: FinanceProtectionError
// Expected: prohibitedField === 'metadata.glAccount'

// T1.3b: Deeply nested prohibited field
const intent2 = {
  // ... valid fields
  metadata: {
    context: {
      financials: {
        debit: 1000,  // ❌ Deeply nested
      },
    },
  },
};
// Expected: FinanceProtectionError
// Expected: prohibitedField === 'metadata.context.financials.debit'

// T1.3c: Array with prohibited field
const intent3 = {
  // ... valid fields
  metadata: {
    items: [
      { name: 'valid' },
      { glAccount: '4000' },  // ❌ In array element
    ],
  },
};
// Expected: FinanceProtectionError
// Expected: prohibitedField === 'metadata.items[1].glAccount'

// T1.3d: Valid nested metadata (no prohibited fields)
const intent4 = {
  // ... valid fields
  metadata: {
    patientId: 'pat-001',
    encounter: {
      type: 'Outpatient',
      provider: {
        id: 'doc-001',
        name: 'Dr. Smith',
      },
    },
  },
};
// Expected: SUCCESS (no prohibited fields)
```

#### T1.4: Valid intent acceptance
```typescript
const intent = {
  intentType: 'REVENUE_RECOGNIZED',
  tenantId: 'hospital-a',
  correlationId: 'test-002',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 1000.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital',
  metadata: {
    patientId: 'pat-001',
    encounterType: 'Outpatient',
  },
};

await publishIntent(intent);
// Expected: SUCCESS
// Expected: Intent in outbox (status: PENDING)
// Expected: Idempotency registered
```

---

### P3-2: Strict Contract

**Claim:** Fields outside Financial Intent contract are REJECTED

**Tests required:**

#### T2.1: Unknown field rejection
```typescript
const intent = {
  // ... valid fields
  unknownField: 'should-be-rejected',  // ❌ Not in contract
};

// Expected: ValidationError
// Expected: Error message includes 'unknownField'
```

#### T2.2: Typo field rejection
```typescript
const intent = {
  // ... valid fields
  entityTYpe: 'Encounter',  // ❌ Typo (correct: entityType)
};

// Expected: ValidationError (missing required field 'entityType')
```

#### T2.3: Extra nested field rejection
```typescript
const intent = {
  // ... valid fields
  metadata: {
    validField: 'ok',
    accounting: {  // ❌ Suspicious nested structure
      glAccount: '4000',
    },
  },
};

// Expected: FinanceProtectionError (glAccount detected)
```

---

### P3-3: Tenant Isolation

**Claim:** Tenant A cannot access/replay Tenant B's state

**Tests required:**

#### T3.1: Cross-tenant outbox access denied (DATABASE RLS)

**CRITICAL:** This test MUST verify database-level RLS, not just application parameter filtering.

**Test requirement:**
- Set database session tenant context (NOT just pass tenantId parameter)
- Verify PostgreSQL RLS policies enforce isolation
- Prove: "Tenant isolation enforced by database, not trusted application code"

```typescript
// Setup: Tenant A publishes intent
await publishIntent({
  tenantId: 'tenant-a',
  correlationId: 'rls-test-001',
  // ... valid fields
});

// Verify: Intent in database
const allRecords = await supabase
  .rpc('admin_get_all_outbox')  // Admin bypass RLS
  .eq('tenant_id', 'tenant-a');
expect(allRecords.data.length).toBe(1);

// Attack: Tenant B attempts to read Tenant A's data
// Set database session context to Tenant B
await supabase.rpc('set_tenant_context', { tenant_id: 'tenant-b' });

// Query outbox (RLS should filter)
const { data: tenantBView, error } = await supabase
  .from('runtime_outbox')
  .select('*')
  .eq('correlation_id', 'rls-test-001');  // Try to find Tenant A's record

// Expected: Empty result (RLS blocks cross-tenant read)
expect(tenantBView).toEqual([]);
expect(error).toBeNull();  // No error, just empty (RLS filter)

// Attack: Tenant B attempts direct access by ID
const tenantAOutboxId = allRecords.data[0].id;

const { data: directAccess, error: directError } = await supabase
  .from('runtime_outbox')
  .select('*')
  .eq('id', tenantAOutboxId);

// Expected: Empty result (RLS blocks)
expect(directAccess).toEqual([]);

// Verify: Switch context to Tenant A
await supabase.rpc('set_tenant_context', { tenant_id: 'tenant-a' });

const { data: tenantAView } = await supabase
  .from('runtime_outbox')
  .select('*')
  .eq('correlation_id', 'rls-test-001');

// Expected: Tenant A can see own record
expect(tenantAView.length).toBe(1);
```

**NOTE:** If `set_tenant_context` RPC doesn't exist, create it:
```sql
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_id TEXT)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_id, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

#### T3.2: Cross-tenant idempotency collision prevented

**RENAMED:** This test proves "Cross-tenant idempotency collision does NOT occur", not "replay denied".

```typescript
// Tenant A publishes intent
const intentA = {
  tenantId: 'tenant-a',
  correlationId: 'shared-corr-001',
  intentType: 'REVENUE_RECOGNIZED',
  // ... valid fields
};
await publishIntent(intentA);

// Tenant B publishes with same correlation + intent type
const intentB = {
  tenantId: 'tenant-b',  // Different tenant
  correlationId: 'shared-corr-001',  // Same correlation
  intentType: 'REVENUE_RECOGNIZED',  // Same intent type
  // ... valid fields
};
await publishIntent(intentB);

// Expected: SUCCESS (different tenant → different idempotency key)
// Expected: Both intents in outbox
// Expected: No IdempotencyError
```

#### T3.2b: Cross-tenant replay attack (SECURITY TEST)

**NEW TEST:** Attacker attempts to replay/access another tenant's intent

```typescript
// Setup: Tenant A creates intent
const tenantAIntent = {
  tenantId: 'tenant-a',
  correlationId: 'security-test-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 5000.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital-A',
};

const resultA = await publishIntent(tenantAIntent);
const outboxIdA = resultA.outboxId;

// Attack 1: Tenant B attempts to read Tenant A's outbox record
await supabase.rpc('set_tenant_context', { tenant_id: 'tenant-b' });

const { data: stolenOutbox } = await supabase
  .from('runtime_outbox')
  .select('*')
  .eq('id', outboxIdA);

// Expected: Empty (RLS blocks)
expect(stolenOutbox).toEqual([]);

// Attack 2: Tenant B attempts to read Tenant A's idempotency record
const keyA = deriveIdempotencyKey({
  tenantId: 'tenant-a',
  correlationId: 'security-test-001',
  intentType: 'REVENUE_RECOGNIZED',
});

const { data: stolenIdempotency } = await supabase
  .from('runtime_idempotency_registry')
  .select('*')
  .eq('idempotency_key', keyA);

// Expected: Empty (RLS blocks)
expect(stolenIdempotency).toEqual([]);

// Attack 3: Tenant B attempts to read Tenant A's audit log
const { data: stolenAudit } = await supabase
  .from('runtime_audit_log')
  .select('*')
  .eq('correlation_id', 'security-test-001');

// Expected: Empty (RLS blocks)
expect(stolenAudit).toEqual([]);

// Attack 4: Tenant B attempts to update Tenant A's outbox (if RLS failed)
const { error: updateError } = await supabase
  .from('runtime_outbox')
  .update({ status: 'QUARANTINED' })
  .eq('id', outboxIdA);

// Expected: Error or no rows affected (RLS blocks)
expect(updateError).not.toBeNull();

// Attack 5: Tenant B attempts to delete Tenant A's outbox
const { error: deleteError } = await supabase
  .from('runtime_outbox')
  .delete()
  .eq('id', outboxIdA);

// Expected: Error or no rows affected (RLS blocks)
expect(deleteError).not.toBeNull();
```

#### T3.3: Tenant-scoped idempotency key verification
```typescript
const keyA = deriveIdempotencyKey({
  tenantId: 'tenant-a',
  correlationId: 'corr-001',
  intentType: 'REVENUE_RECOGNIZED',
});

const keyB = deriveIdempotencyKey({
  tenantId: 'tenant-b',
  correlationId: 'corr-001',
  intentType: 'REVENUE_RECOGNIZED',
});

// Expected: keyA !== keyB (tenant-scoped)
```

#### T3.4: Database-level tenant isolation
```typescript
// Set tenant context to Tenant A
await supabase.rpc('set_tenant_context', { tenant_id: 'tenant-a' });

// Query outbox (should only see Tenant A records)
const { data, error } = await supabase
  .from('runtime_outbox')
  .select('*');

// Expected: data contains only tenant_id = 'tenant-a'
// Expected: No tenant_id = 'tenant-b' records visible
```

---

### P3-4: Idempotency

**CORRECTED CLAIM:**

Runtime guarantees that the same idempotency identity (tenantId + correlationId + intentType) is NOT delivered as a new financial intent more than once **within the TTL window**.

Finance OS remains responsible for ultimate financial-effect idempotency, including:
- Duplicate detection after Runtime TTL expiry
- Business-level event deduplication
- Cross-system idempotency (if events arrive from multiple sources)

**Tests required:**

#### T4.1: Duplicate intent rejection
```typescript
const intent = {
  tenantId: 'tenant-a',
  correlationId: 'corr-duplicate-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 1000.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital',
};

// Publish 1st time
const result1 = await publishIntent(intent);
// Expected: SUCCESS
// Expected: Outbox record created

// Publish 2nd time (exact duplicate)
const result2 = await publishIntent(intent);
// Expected: IdempotencyError
// Expected: No new outbox record
// Expected: result2.originalOutboxId === result1.outboxId
```

#### T4.2: Different entity, same correlation (allowed)
```typescript
// Intent 1
await publishIntent({
  tenantId: 'tenant-a',
  correlationId: 'corr-multi-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityId: 'enc-001',
  // ... valid fields
});

// Intent 2 (different entity, same correlation, DIFFERENT intentType)
await publishIntent({
  tenantId: 'tenant-a',
  correlationId: 'corr-multi-001',
  intentType: 'PAYMENT_RECEIVED',  // Different intent type
  entityId: 'enc-001',
  // ... valid fields
});

// Expected: Both SUCCESS (different intentType → different idempotency key)
```

#### T4.3: Idempotency TTL semantics (CORRECTED)

**🔴 CRITICAL CORRECTION:**

**WRONG CLAIM (v1.0):**
> "After TTL expiry, same intent can be replayed → SUCCESS"

**PROBLEM:** This creates duplicate financial effect.

**Example:**
```
Day 1: REVENUE_RECOGNIZED (10M) → Finance OS records 10M
Day 2: TTL expired → Same intent replayed → Finance OS records ANOTHER 10M
Result: 20M instead of 10M (duplicate financial effect)
```

**CORRECTED CLAIM:**

TTL is a **retention/cleanup mechanism**, NOT an automatic replay authorization.

**Architectural principle:**
- Idempotency identity = (tenantId + correlationId + intentType)
- This identity should be **business-unique** (not time-bound)
- If business needs to re-execute same financial event, it must use:
  - Different `correlationId` (new business event)
  - Different `intentType` (different financial meaning)
  - Explicit `replayId` or `eventVersion` field (if added to contract)

**What TTL DOES guarantee:**
1. Idempotency protection within TTL window (e.g., 24 hours)
2. Cleanup of old registry records (storage management)
3. Provenance preserved in audit log (even after cleanup)

**What TTL does NOT guarantee:**
- Automatic prevention of duplicate financial effect after expiry

**Test (REVISED):**

```typescript
// T4.3a: TTL expiry does NOT automatically allow duplicate financial effect
const intent = {
  tenantId: 'tenant-a',
  correlationId: 'corr-ttl-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 10000.00,
  currency: 'USD',
  effectiveDate: new Date('2026-01-01'),
  source: 'Hospital',
};

// Publish 1st time
const result1 = await publishIntent(intent);
expect(result1.status).toBe('SUCCESS');

// Fast-forward time (mock TTL expiry)
await mockTimeTravel(25 * 60 * 60 * 1000);  // 25 hours

// Cleanup expired idempotency records
const cleanedCount = await idempotencyRepository.cleanupExpired();
expect(cleanedCount).toBeGreaterThan(0);

// Verify: Idempotency record gone
const idempotencyRecord = await idempotencyRepository.check(
  'tenant-a',
  deriveIdempotencyKey({
    tenantId: 'tenant-a',
    correlationId: 'corr-ttl-001',
    intentType: 'REVENUE_RECOGNIZED',
  })
);
expect(idempotencyRecord).toBeNull();  // Expired and cleaned

// Attempt to publish 2nd time (after TTL expiry)
// ARCHITECTURAL QUESTION: What should happen?
// 
// Option A: Runtime allows (relies on Finance OS idempotency)
//   → Runtime emits, Finance OS detects duplicate
// 
// Option B: Runtime still prevents (audit log check)
//   → Runtime checks audit log, sees historical record, rejects
//
// CURRENT IMPLEMENTATION: Option A (simpler, Finance OS owns financial-effect idempotency)

await publishIntent(intent);
// Expected: Runtime allows (new outbox record created)
// Expected: Finance OS MUST have own idempotency check
// Expected: Finance OS MUST NOT create duplicate financial effect

// T4.3b: Provenance preserved after TTL expiry
const auditRecords = await auditRepository.getByCorrelationId('corr-ttl-001');
// Expected: Audit records still present (audit has longer retention)
// Expected: Can trace that this correlation was already processed
```

**AMENDED RESPONSIBILITY BOUNDARY:**

**Runtime guarantees:**
- Same idempotency identity NOT emitted twice **within TTL window**
- Audit trail preserved (longer retention than idempotency registry)

**Finance OS responsibility:**
- Ultimate financial-effect idempotency (including after Runtime TTL expiry)
- Business-level duplicate detection (e.g., via business event ID)

**RECOMMENDATION FOR FUTURE:**
If business requires stronger replay protection, add explicit fields:
- `businessEventId` (unique per business event, never reused)
- `eventVersion` (v1, v2, etc. for same business event)
- `replayContext` (explicit provenance for intentional replays)
```

#### T4.4: Idempotency audit trail
```typescript
const intent = {
  tenantId: 'tenant-a',
  correlationId: 'corr-audit-001',
  intentType: 'REVENUE_RECOGNIZED',
  // ... valid fields
};

// Publish 1st time
await publishIntent(intent);

// Publish 2nd time (duplicate within TTL)
try {
  await publishIntent(intent);
} catch (error) {
  expect(error).toBeInstanceOf(IdempotencyError);
}

// Check audit log
const auditRecords = await auditRepository.getByCorrelationId('corr-audit-001');

// Expected: 2 audit records
// Expected: Record 1 status = 'SUCCESS'
// Expected: Record 2 status = 'DUPLICATE'
// Expected: Both records permanent (audit retention > idempotency TTL)
```

---

### P3-5: Error Classification

**Claim:** Validation/architecture violations do NOT retry; transient failures DO retry

**Tests required:**

#### T5.1: Validation error (not retryable)
```typescript
const intent = {
  tenantId: '',  // ❌ Invalid (empty)
  // ... other fields
};

try {
  await publishIntent(intent);
} catch (error) {
  // Expected: ValidationError
  // Expected: error.retryable === false
  // Expected: Intent NOT in outbox
}
```

#### T5.2: Finance Protection error (not retryable)
```typescript
const intent = {
  // ... valid fields
  glAccount: '4000',  // ❌ Prohibited
};

try {
  await publishIntent(intent);
} catch (error) {
  // Expected: FinanceProtectionError
  // Expected: error.retryable === false
  // Expected: Intent NOT in outbox
}
```

#### T5.3: Idempotency error (not retryable, not a failure)
```typescript
// Publish twice
await publishIntent(validIntent);

try {
  await publishIntent(validIntent);
} catch (error) {
  // Expected: IdempotencyError
  // Expected: error.retryable === false
  // Expected: Error is informational (not a failure)
}
```

#### T5.4: Database error (retryable)
```typescript
// Mock database connection failure
mockSupabaseConnectionError();

try {
  await publishIntent(validIntent);
} catch (error) {
  // Expected: OutboxError or DatabaseError
  // Expected: error.retryable === true
}
```

#### T5.5: Network error (retryable)
```typescript
// Mock network timeout
mockNetworkTimeout();

try {
  await financePublisher.publish(validIntent);
} catch (error) {
  // Expected: FinanceServiceError
  // Expected: error.retryable === true
}
```

#### T5.6: Error classification mapping
```typescript
const testCases = [
  { error: new ValidationError('test'), expected: false },
  { error: new FinanceProtectionError('glAccount'), expected: false },
  { error: new TenantIsolationError('test', 'msg'), expected: false },
  { error: new IdempotencyError('key', 'outbox'), expected: false },
  { error: new OutboxError('test'), expected: true },
  { error: new FinanceServiceError('test', true), expected: true },
  { error: new Error('ECONNREFUSED'), expected: true },
  { error: new Error('timeout'), expected: true },
];

for (const { error, expected } of testCases) {
  const retryable = isRetryableError(error);
  // Expected: retryable === expected
}
```

---

### P3-6: Provenance

**Claim:** correlationId, tenant context, and intent provenance are NOT lost in flow

**Tests required:**

#### T6.1: Correlation ID propagation
```typescript
const intent = {
  tenantId: 'tenant-a',
  correlationId: 'corr-trace-001',
  intentType: 'REVENUE_RECOGNIZED',
  // ... valid fields
};

await publishIntent(intent);

// Check outbox
const outboxRecords = await outboxRepository.getByCorrelationId('corr-trace-001');
// Expected: 1 record
// Expected: outboxRecords[0].correlation_id === 'corr-trace-001'

// Check idempotency registry
const idempotencyRecords = await idempotencyRepository.getRecordsByCorrelation('corr-trace-001');
// Expected: 1 record
// Expected: idempotencyRecords[0].correlation_id === 'corr-trace-001'

// Check audit log
const auditRecords = await auditRepository.getByCorrelationId('corr-trace-001');
// Expected: At least 1 record
// Expected: All records have correlation_id === 'corr-trace-001'
```

#### T6.2: Tenant context propagation
```typescript
const intent = {
  tenantId: 'tenant-a',
  // ... valid fields
};

await publishIntent(intent);

// Check all tables have tenant_id
const outbox = await outboxRepository.getById(result.outboxId);
const idempotency = await idempotencyRepository.getRecord(tenantId, key);
const audit = await auditRepository.getByTenant('tenant-a');

// Expected: outbox.tenant_id === 'tenant-a'
// Expected: idempotency.tenant_id === 'tenant-a'
// Expected: All audit records have tenant_id === 'tenant-a'
```

#### T6.3: Full intent payload preservation (quarantine)
```typescript
const intent = {
  tenantId: 'tenant-a',
  correlationId: 'corr-quarantine-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 1000.00,
  currency: 'USD',
  effectiveDate: new Date('2026-01-01'),
  source: 'Hospital',
  metadata: {
    patientId: 'pat-001',
    encounterType: 'Outpatient',
    nested: {
      deep: 'value',
    },
  },
};

// Mock failure scenario (simulate quarantine)
await simulateRepeatedFailure(intent);

// Check quarantine
const quarantineRecords = await quarantineRepository.getByCorrelationId('corr-quarantine-001');
// Expected: 1 record
// Expected: quarantineRecords[0].intent_payload === intent (deep equal)
// Expected: All nested metadata preserved
```

#### T6.4: Audit trail immutability
```typescript
await publishIntent(validIntent);

// Get audit record
const auditRecords = await auditRepository.getByCorrelationId(validIntent.correlationId);
const auditId = auditRecords[0].id;

// Attempt to modify audit record
try {
  await supabase
    .from('runtime_audit_log')
    .update({ amount: 9999.99 })
    .eq('id', auditId);
  
  // Expected: UPDATE rejected (RLS policy)
  fail('Audit UPDATE should be rejected');
} catch (error) {
  // Expected: Permission denied or policy violation
}

// Attempt to delete audit record
try {
  await supabase
    .from('runtime_audit_log')
    .delete()
    .eq('id', auditId);
  
  // Expected: DELETE rejected (RLS policy)
  fail('Audit DELETE should be rejected');
} catch (error) {
  // Expected: Permission denied or policy violation
}
```

---

## End-to-End Flow Tests

### E2E-1: Happy Path (Success Flow)

**Scenario:** Valid intent → outbox → audit SUCCESS

```typescript
const intent = {
  tenantId: 'hospital-a',
  correlationId: 'e2e-success-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 1500.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital',
  metadata: { patientId: 'pat-001' },
};

// Step 1: Publish
const result = await publishIntent(intent);

// Verify: Outbox created
const outbox = await outboxRepository.getById(result.outboxId);
expect(outbox.status).toBe('PENDING');
expect(outbox.tenant_id).toBe('hospital-a');
expect(outbox.correlation_id).toBe('e2e-success-001');

// Verify: Idempotency registered
const idempotency = await idempotencyRepository.check('hospital-a', result.idempotencyKey);
expect(idempotency).not.toBeNull();
expect(idempotency.outbox_id).toBe(result.outboxId);

// Verify: Audit log created
const audit = await auditRepository.getByCorrelationId('e2e-success-001');
expect(audit.length).toBeGreaterThan(0);
expect(audit[0].status).toBe('SUCCESS');
```

---

### E2E-2: Attack Path — Prohibited Field

**Scenario:** Industry attempts to bypass Finance OS by including `glAccount`

```typescript
const attackIntent = {
  tenantId: 'hospital-a',
  correlationId: 'attack-glaccount-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 1500.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital',
  glAccount: '4000',  // ❌ ATTACK: Bypass Finance OS
};

// Attempt to publish
try {
  await publishIntent(attackIntent);
  fail('Should reject prohibited field');
} catch (error) {
  // Expected: FinanceProtectionError
  expect(error).toBeInstanceOf(FinanceProtectionError);
  expect(error.prohibitedField).toBe('glAccount');
}

// Verify: NOT in outbox
const outbox = await outboxRepository.getByCorrelationId('attack-glaccount-001');
expect(outbox.length).toBe(0);

// Verify: Audit recorded as INVALID
const audit = await auditRepository.getByCorrelationId('attack-glaccount-001');
expect(audit.length).toBeGreaterThan(0);
expect(audit[0].status).toBe('INVALID');
expect(audit[0].failure_reason).toContain('glAccount');
```

---

### E2E-3: Attack Path — Cross-Tenant Replay

**Scenario:** Tenant B attempts to replay Tenant A's intent

```typescript
// Tenant A publishes
const tenantAIntent = {
  tenantId: 'tenant-a',
  correlationId: 'cross-tenant-replay-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 1000.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital-A',
};

await publishIntent(tenantAIntent);

// Tenant B attempts replay (same correlation + intentType, different tenant)
const tenantBIntent = {
  ...tenantAIntent,
  tenantId: 'tenant-b',  // Different tenant
  source: 'Hospital-B',
};

// Expected: SUCCESS (different tenant → different idempotency key)
const result = await publishIntent(tenantBIntent);
expect(result.status).toBe('SUCCESS');

// Verify: Both intents in outbox
const outboxA = await outboxRepository.getByTenant('tenant-a');
const outboxB = await outboxRepository.getByTenant('tenant-b');
expect(outboxA.length).toBe(1);
expect(outboxB.length).toBe(1);

// Verify: Different idempotency keys
const keyA = deriveIdempotencyKey({
  tenantId: 'tenant-a',
  correlationId: 'cross-tenant-replay-001',
  intentType: 'REVENUE_RECOGNIZED',
});
const keyB = deriveIdempotencyKey({
  tenantId: 'tenant-b',
  correlationId: 'cross-tenant-replay-001',
  intentType: 'REVENUE_RECOGNIZED',
});
expect(keyA).not.toBe(keyB);
```

---

### E2E-4: Idempotency Protection (Within TTL Window)

**Scenario:** Runtime prevents duplicate intent emission within TTL window

```typescript
const intent = {
  tenantId: 'hospital-a',
  correlationId: 'idempotency-test-001',
  intentType: 'REVENUE_RECOGNIZED',
  entityType: 'Encounter',
  entityId: 'enc-001',
  amount: 2000.00,
  currency: 'USD',
  effectiveDate: new Date(),
  source: 'Hospital',
};

// Publish 1st time
const result1 = await publishIntent(intent);
expect(result1.status).toBe('SUCCESS');

// Verify: Outbox created
const outboxBefore = await outboxRepository.getByTenant('hospital-a');
expect(outboxBefore.length).toBe(1);

// Publish 2nd time (exact duplicate)
try {
  await publishIntent(intent);
  fail('Should reject duplicate');
} catch (error) {
  expect(error).toBeInstanceOf(IdempotencyError);
  expect(error.originalOutboxId).toBe(result1.outboxId);
}

// Verify: No new outbox record
const outboxAfter = await outboxRepository.getByTenant('hospital-a');
expect(outboxAfter.length).toBe(1);  // Still 1 (no duplicate)

// Verify: Audit records both attempts
const audit = await auditRepository.getByCorrelationId('idempotency-test-001');
expect(audit.length).toBe(2);
expect(audit[0].status).toBe('SUCCESS');
expect(audit[1].status).toBe('DUPLICATE');
```

---

## Test Implementation Plan

### Phase 3A: Unit Tests (Validators)
**Files:**
- `tests/unit/runtime/intent-validator.test.ts`
- `tests/unit/runtime/tenant-validator.test.ts`
- `tests/unit/runtime/idempotency-key.test.ts`

**Focus:** Individual validator functions

---

### Phase 3B: Integration Tests (Repositories)
**Files:**
- `tests/integration/runtime/tenant-repository.test.ts`
- `tests/integration/runtime/idempotency-repository.test.ts`
- `tests/integration/runtime/outbox-repository.test.ts`
- `tests/integration/runtime/audit-repository.test.ts`
- `tests/integration/runtime/quarantine-repository.test.ts`

**Focus:** Database operations + RLS enforcement

---

### Phase 3C: End-to-End Tests (Full Flow)
**Files:**
- `tests/e2e/runtime/finance-protection.e2e.test.ts`
- `tests/e2e/runtime/tenant-isolation.e2e.test.ts`
- `tests/e2e/runtime/idempotency.e2e.test.ts`
- `tests/e2e/runtime/error-classification.e2e.test.ts`
- `tests/e2e/runtime/provenance.e2e.test.ts`

**Focus:** Full `publishIntent()` flow + attack paths

---

### Phase 3D: Database Enforcement Tests
**Files:**
- `tests/integration/runtime/database-constraints.test.ts`

**Tests:**
- RLS policy enforcement (cross-tenant access denied)
- Audit append-only enforcement (UPDATE/DELETE denied)
- Unique constraint enforcement (duplicate idempotency key)

---

## Success Criteria

Phase 3 PASS if:

| Gate | Criteria | Status |
|------|----------|--------|
| P3-1 | All prohibited fields REJECTED at runtime | ⏳ |
| P3-2 | Unknown fields REJECTED (strict contract) | ⏳ |
| P3-3 | Cross-tenant access DENIED (database + app) | ⏳ |
| P3-4 | Duplicate intents NOT emitted twice (within TTL) | ⏳ |
| P3-5 | Error classification correct (retryable vs not) | ⏳ |
| P3-6 | Provenance preserved across all tables | ⏳ |
| E2E-1 | Happy path SUCCESS | ⏳ |
| E2E-2 | Attack path (prohibited field) REJECTED | ⏳ |
| E2E-3 | Attack path (cross-tenant) ISOLATED | ⏳ |
| E2E-4 | Idempotency protection WORKS | ⏳ |

---

## Definition of Done

Phase 3 complete when:
- ✅ All 6 gates have passing tests
- ✅ All 4 E2E scenarios pass
- ✅ Database enforcement verified (RLS + constraints)
- ✅ Test coverage ≥ 90% for validation + repositories
- ✅ No TODO/FIXME in test files
- ✅ Test execution time < 30 seconds (unit + integration)
- ✅ E2E tests can run in CI/CD

---

## What Phase 3 Does NOT Include

❌ Retry manager implementation  
❌ Outbox worker implementation  
❌ Finance OS publisher implementation  
❌ Observability/tracing implementation  
❌ Performance/load testing  

Those are Phase 4 (Reliability) and Phase 5 (Observability).

---

## Next Phase

**Phase 4 — Reliability Flow:**
- Outbox worker (polling + delivery)
- Retry manager (exponential backoff + jitter)
- Quarantine manager (poison message handling)
- Finance publisher (deliver to Finance OS)

**Phase 5 — Observability:**
- Correlation manager (distributed tracing)
- Audit logger (structured logging)
- Metrics collector (monitoring)

---

## Governance Checkpoint

**Before writing ANY test code:**
- ✅ Test plan reviewed and approved
- ✅ Success criteria defined
- ✅ Attack paths identified
- ✅ E2E scenarios documented

**After tests pass:**
- ✅ Phase 3 PASS document created
- ✅ Evidence collected (test results)
- ✅ Gate review completed
- ✅ Approval to proceed Phase 4

---

---

## Amendments v1.0 → v1.1

### 🔴 Amendment 1: Recursive prohibited-field scanning
- **Issue:** Nested metadata could hide prohibited fields
- **Fix:** Recursive validation required (including arrays)
- **Impact:** Strengthens Finance Protection boundary

### 🔴 Amendment 2: Database-level RLS testing
- **Issue:** T3.1 tested application parameter, not database security
- **Fix:** Test with database session context (RLS enforcement)
- **Impact:** Proves "security by database, not trusted code"

### 🟠 Amendment 3: Cross-tenant security test
- **Issue:** T3.2 named "replay denied" but tested collision prevention
- **Fix:** Renamed + added T3.2b (replay attack test)
- **Impact:** Distinguishes isolation from security attack prevention

### 🔴 Amendment 4: TTL semantics correction
- **Issue:** TTL expiry allowing replay creates duplicate financial effect
- **Fix:** TTL = retention mechanism, NOT replay authorization
- **Impact:** Corrects responsibility boundary (Runtime vs Finance OS)

### � Amendment 5: Claim precision
- **Issue:** Runtime claimed "no duplicate financial effect" (overreach)
- **Fix:** Runtime guarantees delivery idempotency; Finance OS owns financial-effect idempotency
- **Impact:** Accurate boundary responsibility

---

## Responsibility Boundary (CLARIFIED)

```
┌─────────────────────────────────────────────────────┐
│ Runtime Responsibility                              │
├─────────────────────────────────────────────────────┤
│ ✅ Validate Financial Intent structure              │
│ ✅ Enforce Finance Protection (prohibited fields)   │
│ ✅ Tenant isolation (database + application)        │
│ ✅ Idempotency within TTL window                    │
│ ✅ At-least-once delivery guarantee                 │
│ ✅ Audit trail (provenance)                         │
│ ✅ Retry/quarantine management                      │
└─────────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────────┐
│ Finance OS Responsibility                           │
├─────────────────────────────────────────────────────┤
│ ✅ Interpret Financial Intent semantics             │
│ ✅ Apply accounting rules                           │
│ ✅ GL account selection                             │
│ ✅ DR/CR generation                                 │
│ ✅ Financial-effect idempotency (ultimate)          │
│ ✅ Cross-system deduplication                       │
│ ✅ Business event replay detection                  │
└─────────────────────────────────────────────────────┘
```

**Runtime does NOT claim:** "Duplicate financial effect never occurs"  
**Runtime DOES claim:** "Same intent identity not emitted twice within TTL"  
**Finance OS ensures:** "Duplicate financial effect never occurs (ultimate authority)"

---

**Status:** 🟢 TEST PLAN v1.1 FROZEN  
**Amendments:** 5 targeted fixes (no architecture change)  
**Next:** Implement tests (Phase 3A → 3B → 3C → 3D)  
**Then:** Gate review → Phase 4 UNBLOCKED

---

**This test plan v1.1 defines WHAT to prove with architectural precision.**

**No false positives. No overclaimed boundaries. Evidence-driven governance.**
