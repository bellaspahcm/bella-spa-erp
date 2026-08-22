# E7.3 Design — Invariants + Negative-Path Criteria

**Purpose:** Lock E7.3 invariants before implementation  
**Date:** 2026-08-22  
**Status:** DRAFT

---

## Core Principle

> **"E7.3 has the right to say 'invalid', but NOT the right to decide 'what to do next'."**

This boundary prevents E7.3 from becoming a workflow engine.

---

## P0 — Rule Safety (Invariants 1-5)

### Invariant 1: Rule Evaluation Must Not Mutate Entity

**Statement:**
> Rule evaluation is side-effect-free. Input entities remain unchanged.

**Test:**
```typescript
const inventory = { ...originalInventory };
const result = rule.evaluate({ inventory, evaluationDate });

// ✅ PASS: inventory unchanged
assert.deepEqual(inventory, originalInventory);
```

**Violation Example:**
```typescript
// ❌ FORBIDDEN
evaluate(inventory) {
  inventory.status = 'QUARANTINE'; // ❌ Mutation
  return VIOLATION('INVENTORY_EXPIRED');
}
```

**Enforcement:** All rule implementations tested for mutation.

---

### Invariant 2: Rule Evaluation Must Not Call Product Services

**Statement:**
> Rules do not invoke Product workflows, services, or external systems.

**Test:**
```typescript
const result = rule.evaluate(context);

// ✅ PASS: No external calls
assert.equal(externalCalls.length, 0);
assert.equal(dbWrites.length, 0);
assert.equal(taskQueue.length, 0);
assert.equal(notifications.length, 0);
```

**Violation Example:**
```typescript
// ❌ FORBIDDEN
evaluate(inventory) {
  WarehouseService.quarantine(inventory); // ❌ Product service
  NotificationService.alert(inventory);   // ❌ External system
  return VIOLATION('INVENTORY_EXPIRED');
}
```

**Enforcement:** Rule execution monitored for side effects.

---

### Invariant 3: Rule Must Be Deterministic

**Statement:**
> Same input context + same evaluation time → identical RuleResult.

**Test:**
```typescript
const context = {
  inventory,
  evaluationDate: new Date('2026-08-22T10:00:00Z'),
};

const result1 = rule.evaluate(context);
const result2 = rule.evaluate(context);

// ✅ PASS: Identical results
assert.deepEqual(result1, result2);
```

**Violation Example:**
```typescript
// ❌ FORBIDDEN
evaluate(inventory) {
  const now = new Date(); // ❌ Hidden clock dependency
  if (Math.random() > 0.5) { // ❌ Non-deterministic
    return VIOLATION('RANDOM_FAILURE');
  }
  return PASS;
}
```

**Critical Requirement:**
> If rule depends on time, time MUST be in evaluation context.

**Correct Pattern:**
```typescript
// ✅ ALLOWED
evaluate(context: { inventory, evaluationDate: Date }) {
  if (inventory.expiry_date < context.evaluationDate) {
    return VIOLATION('INVENTORY_EXPIRED');
  }
  return PASS;
}
```

**Enforcement:** 
- All time-dependent rules require `evaluationDate` in context
- No hidden `new Date()` calls allowed
- No `Math.random()` or non-deterministic functions

---

### Invariant 4: Rule Must Not Depend on Product-Specific Concepts

**Statement:**
> Rule context uses only E7.1/E7.2 frozen entities. No Warehouse/Finance/QA concepts.

**Test:**
```typescript
// ✅ PASS: Generic context
type ValidContext = {
  inventory: Inventory;        // E7.1
  item: Item;                  // E7.1
  traceability: TraceabilityRecord; // E7.1
  evaluationDate: Date;
};

// ❌ FAIL: Product-specific context
type InvalidContext = {
  warehouseOrder: WarehouseOrder;  // ❌ Product
  qaWorkflow: QAWorkflow;          // ❌ Product
  salesOrder: SalesOrder;          // ❌ Product
  financePosting: GLEntry;         // ❌ Product
};
```

**Violation Example:**
```typescript
// ❌ FORBIDDEN
interface WarehouseReceivingContext {
  supplier: Supplier;
  qaApproval: QAApproval; // ❌ Warehouse concept
  binAssignment: Bin;     // ❌ Warehouse concept
}
```

**Enforcement:** Context type definitions reviewed for Product imports.

---

### Invariant 5: Rule Must Have Stable ID + Version

**Statement:**
> Rule `id` and `version` must be immutable for audit trail.

**Test:**
```typescript
const rule = new ExpiryRule();

// ✅ PASS: ID stable
assert.equal(rule.id, 'INVENTORY_EXPIRY_CHECK');
assert.equal(rule.version, '1.0.0');

// ❌ FAIL: ID changes
rule.id = 'NEW_ID'; // Mutation forbidden
```

**Requirement:**
- `id`: Unique, machine-readable, immutable
- `version`: Semantic versioning (e.g., "1.0.0")
- Version bump for rule logic changes (auditability)

**Enforcement:** Rule properties are `readonly`.

---

## P0 — Violation Integrity (Invariants 6-10)

### Invariant 6: Every VIOLATION Must Have Machine-Readable Code

**Statement:**
> Violations must include typed error code for Product interpretation.

**Test:**
```typescript
const result = rule.evaluate(context);

if (result.status === 'VIOLATION') {
  // ✅ PASS: Has code
  assert.ok(result.violation.code);
  assert.match(result.violation.code, /^[A-Z_]+$/);
}
```

**Valid Codes:**
- ✅ `INVENTORY_EXPIRED`
- ✅ `INSUFFICIENT_QUANTITY`
- ✅ `LOT_NUMBER_REQUIRED`

**Invalid Codes:**
- ❌ `ERROR` (too generic)
- ❌ `WAREHOUSE_QA_FAILED` (Product-specific)
- ❌ `contact support` (not machine-readable)

**Enforcement:** Violation codes validated against registry.

---

### Invariant 7: Every Violation Must Have Evidence

**Statement:**
> Violations must include RuleEvidence for audit trail.

**Test:**
```typescript
const result = rule.evaluate(context);

if (result.status === 'VIOLATION') {
  // ✅ PASS: Has evidence
  assert.ok(result.evidence);
  assert.ok(result.evidence.input);
  assert.ok(result.evidence.output);
}
```

**Evidence Structure:**
```typescript
{
  input: {
    inventory_id: 'INV-001',
    expiry_date: '2026-08-20',
    evaluation_date: '2026-08-22',
  },
  output: {
    is_expired: true,
    days_past_expiry: 2,
  },
  metadata: {
    item_sku: 'SKU-123',
    rule_version: '1.0.0',
  }
}
```

**Enforcement:** Evidence required for all violations.

---

### Invariant 8: Evaluation Time Must Be Explicit (No Hidden Clock)

**Statement:**
> If rule depends on time, time MUST be in context. No hidden `new Date()`.

**Test:**
```typescript
// ✅ PASS: Explicit time
const result = rule.evaluate({
  inventory,
  evaluationDate: new Date('2026-08-22'),
});

// ❌ FAIL: Hidden clock
const result = rule.evaluate(inventory); // Where is time?
```

**Critical for Determinism:**
```typescript
// ✅ ALLOWED
function evaluateExpiry(
  inventory: Inventory,
  evaluationDate: Date // Explicit
): RuleResult {
  if (inventory.expiry_date < evaluationDate) {
    return VIOLATION('INVENTORY_EXPIRED');
  }
  return PASS;
}

// ❌ FORBIDDEN
function evaluateExpiry(
  inventory: Inventory
): RuleResult {
  const now = new Date(); // ❌ Hidden clock
  if (inventory.expiry_date < now) {
    return VIOLATION('INVENTORY_EXPIRED');
  }
  return PASS;
}
```

**Enforcement:** 
- Time-dependent rules audited for explicit time context
- No `new Date()` allowed inside rule evaluation
- All rule tests pass fixed `evaluationDate`

---

### Invariant 9: No Fabricated Violations (Evidence Must Be Sufficient)

**Statement:**
> Violations require actual evidence. No fabrication or speculation.

**Test:**
```typescript
const result = rule.evaluate(context);

if (result.status === 'VIOLATION') {
  // ✅ PASS: Evidence supports violation
  const evidence = result.evidence;
  assert.ok(evidence.output.is_expired === true);
}
```

**Violation Example:**
```typescript
// ❌ FORBIDDEN
evaluate(inventory) {
  if (!inventory.expiry_date) {
    // ❌ No evidence of expiry, but returning violation
    return VIOLATION('INVENTORY_EXPIRED');
  }
}

// ✅ ALLOWED
evaluate(inventory) {
  if (!inventory.expiry_date) {
    // ✅ Different violation with actual evidence
    return VIOLATION('EXPIRY_DATE_MISSING');
  }
}
```

**Enforcement:** Violation code must match evidence output.

---

### Invariant 10: No Silent Entity Fixes (No Auto-Correction)

**Statement:**
> Rules do NOT fix entities to make violations disappear.

**Test:**
```typescript
const inventory = { expiry_date: new Date('2026-08-20') };
const result = rule.evaluate({
  inventory,
  evaluationDate: new Date('2026-08-22'),
});

// ❌ FAIL: Rule auto-corrected entity
assert.notEqual(inventory.expiry_date, null); // Rule must not nullify
```

**Violation Example:**
```typescript
// ❌ FORBIDDEN
evaluate(inventory) {
  if (inventory.expiry_date < evaluationDate) {
    inventory.expiry_date = null; // ❌ Auto-correction
    return PASS; // ❌ False pass
  }
  return PASS;
}
```

**Enforcement:** Mutation tests ensure no silent fixes.

---

## P0 — Traceability Safety (Invariants 11-16)

### Invariant 11: Tenant Isolation Is Mandatory

**Statement:**
> Lineage traversal must not cross tenant boundaries.

**Test:**
```typescript
const movements = await traceDownstream('tenant-a', 'LOT-001');

// ✅ PASS: All movements belong to tenant-a
movements.forEach(mov => {
  assert.equal(mov.tenant_id, 'tenant-a');
});
```

**Enforcement:**
- All lineage queries scoped by `tenantId`
- Cross-tenant movements rejected
- Cross-tenant links treated as broken chain

---

### Invariant 12: Lineage Traversal Must Be Deterministic

**Statement:**
> Same lot + same tenant → same lineage order.

**Test:**
```typescript
const result1 = await traceDownstream(tenantId, 'LOT-001');
const result2 = await traceDownstream(tenantId, 'LOT-001');

// ✅ PASS: Identical order
assert.deepEqual(result1, result2);
```

**Ordering:**
1. Primary: `movement_date` (ascending)
2. Secondary: `created_at` (ascending)
3. Tertiary: `movement_id` (lexicographic)

**Enforcement:** Lineage query tests verify deterministic ordering.

---

### Invariant 13: Cycles Must Not Crash or Create Fabricated Lineage

**Statement:**
> Cyclic movements terminate safely with warning.

**Test:**
```typescript
// Setup: Create cycle
// LOT-001: WH-A → WH-B → WH-A (cycle)

const result = await traceDownstream(tenantId, 'LOT-001');

// ✅ PASS: Terminates safely
assert.ok(result.isSuccess);
assert.ok(result.warnings);

// ✅ PASS: Reports cycle
const cycleWarning = result.warnings.find(w => 
  w.code === 'LINEAGE_CYCLE_DETECTED'
);
assert.ok(cycleWarning);

// ✅ PASS: Includes movements (not fabricated)
assert.ok(result.value.length > 0);
```

**Behavior:**
- Track visited `movement_id`
- Stop when cycle detected
- Return `LINEAGE_CYCLE_DETECTED` warning
- Include actual movements (no fabrication)

**Enforcement:** Cycle detection tested with synthetic data.

---

### Invariant 14: Broken Chains Must Be Reported (No Fabrication)

**Statement:**
> Missing movements reported as broken chain. No inference or reconstruction.

**Test:**
```typescript
// Setup: Create broken chain
// LOT-001: Movement A → Movement B → [Missing C] → Movement D

const result = await traceDownstream(tenantId, 'LOT-001');

// ✅ PASS: Returns warning
assert.ok(result.warnings);
const brokenWarning = result.warnings.find(w => 
  w.code === 'LINEAGE_BROKEN_CHAIN'
);
assert.ok(brokenWarning);

// ✅ PASS: Partial result (A, B)
assert.equal(result.value.length, 2);

// ❌ FAIL: Fabricated movement C
assert.ok(!result.value.find(m => m.id === 'movement-c'));
```

**Critical:**
> E7.3 does NOT create missing movements. Broken chains are reality.

**Enforcement:** Broken chain tests verify no fabrication.

---

### Invariant 15: Depth Limit Is Mandatory

**Statement:**
> Lineage traversal must have depth limit to prevent infinite loops.

**Test:**
```typescript
const result = await traceDownstream(tenantId, 'LOT-001', {
  maxDepth: 10,
});

// ✅ PASS: Stops at depth limit
assert.ok(result.value.length <= 10);

// ✅ PASS: Reports depth exceeded (if applicable)
if (result.value.length === 10) {
  const depthWarning = result.warnings.find(w =>
    w.code === 'LINEAGE_DEPTH_EXCEEDED'
  );
  assert.ok(depthWarning);
}
```

**Default:** 100 movements  
**Rationale:** Prevent infinite traversal in corrupted data

**Enforcement:** Depth limit tested with deep chains.

---

### Invariant 16: Lineage Query Must Not Mutate Entities

**Statement:**
> Querying lineage does not mutate Movement/Inventory/TraceabilityRecord.

**Test:**
```typescript
const movement = { ...originalMovement };
const result = await traceDownstream(tenantId, movement.lot_number);

// ✅ PASS: Movement unchanged
assert.deepEqual(movement, originalMovement);

// ✅ PASS: No DB writes
assert.equal(dbWrites.length, 0);
```

**Enforcement:** Query operations are read-only.

---

## P0 — Boundary Integrity (Invariants 17-20)

### Invariant 17: RuleResult Contains Facts, Not Commands

**Statement:**
> RuleResult is data (facts + evidence), not commands (actions + workflows).

**Test:**
```typescript
const result = rule.evaluate(context);

// ✅ PASS: Result is data
assert.ok(['PASS', 'VIOLATION'].includes(result.status));

// ❌ FAIL: Result contains command
assert.ok(!('command' in result));
assert.ok(!('action' in result));
assert.ok(!('workflow' in result));
```

**Valid Result:**
```typescript
{
  status: 'VIOLATION',
  ruleId: 'INVENTORY_EXPIRY_CHECK',
  violation: {
    code: 'INVENTORY_EXPIRED',
    message: 'Inventory expired 2 days ago',
  },
  evidence: { ... }
}
```

**Invalid Result:**
```typescript
// ❌ FORBIDDEN
{
  status: 'VIOLATION',
  command: 'QUARANTINE_INVENTORY',  // ❌ Command
  action: 'CREATE_QA_TASK',         // ❌ Action
  workflow: 'INITIATE_RECALL',      // ❌ Workflow
}
```

**Enforcement:** Result type validation forbids command fields.

---

### Invariant 18: E7.3 Must Not Decide Workflow Next Step

**Statement:**
> E7.3 produces Result. Product interprets Result and decides workflow.

**Test:**
```typescript
const result = E7.3.evaluateRule('INVENTORY_EXPIRY_CHECK', context);

// ✅ PASS: E7.3 stopped at Result
assert.equal(result.status, 'VIOLATION');

// ✅ PASS: No workflow executed by E7.3
assert.equal(taskQueue.length, 0);
assert.equal(notifications.length, 0);

// Product interprets (NOT E7.3):
if (result.status === 'VIOLATION') {
  await WarehouseProduct.handleExpiry(context.inventory);
}
```

**Architectural Flow:**
```
E7.3 → RuleResult → Product → Workflow
```

**NOT:**
```
E7.3 → Workflow (❌ FORBIDDEN)
```

**Enforcement:** E7.3 execution monitored for workflow triggers.

---

### Invariant 19: Product Must Not Force E7.3 to Execute Workflow

**Statement:**
> Product cannot pass workflow callbacks/commands to E7.3 rules.

**Test:**
```typescript
// ❌ FORBIDDEN: Passing callback to rule
const result = rule.evaluate({
  inventory,
  onViolation: () => quarantine(), // ❌ Callback
});

// ✅ ALLOWED: Pure context
const result = rule.evaluate({
  inventory,
  evaluationDate: new Date(),
});
```

**Enforcement:** Rule context type forbids function properties.

---

### Invariant 20: E7.1/E7.2 Frozen Artifacts Must Not Be Modified

**Statement:**
> E7.3 reads E7.1/E7.2 contracts. No modifications permitted.

**Test:**
```typescript
// ✅ PASS: E7.3 reads frozen types
import { Inventory } from '@/platform/logistics/domain/inventory.types';

// ❌ FAIL: E7.3 modifies frozen type
interface Inventory {
  // ... frozen fields
  e7_3_rule_id?: string; // ❌ New field
}
```

**Enforcement:**
- E7.1/E7.2 files monitored for changes
- Frozen boundary hook active
- 439 regression tests must pass

---

## Negative-Path Tests (Mandatory)

### Test 1: Expired Inventory → Violation + No Mutation

```typescript
const inventory = {
  id: 'INV-001',
  expiry_date: new Date('2026-08-20'),
  status: 'AVAILABLE',
};

const result = E7.3.evaluateExpiry(inventory, new Date('2026-08-22'));

// ✅ PASS: Violation returned
assert.equal(result.status, 'VIOLATION');
assert.equal(result.violation.code, 'INVENTORY_EXPIRED');

// ✅ PASS: Inventory unchanged
assert.equal(inventory.status, 'AVAILABLE');
assert.equal(inventory.expiry_date.toISOString(), '2026-08-20T00:00:00.000Z');
```

---

### Test 2: Broken Chain → Warning + No Fabrication

```typescript
// Setup: LOT-001 has movements A, B, [missing C], D
const result = await E7.3.traceDownstream('tenant-a', 'LOT-001');

// ✅ PASS: Returns partial result
assert.equal(result.value.length, 2); // A, B

// ✅ PASS: Reports broken chain
const warning = result.warnings.find(w => w.code === 'LINEAGE_BROKEN_CHAIN');
assert.ok(warning);

// ✅ PASS: No fabricated movement C
assert.ok(!result.value.find(m => m.id === 'movement-c'));
```

---

### Test 3: Cyclic Lineage → Terminates + Reports Cycle

```typescript
// Setup: LOT-001 forms cycle: A → B → C → A
const result = await E7.3.traceDownstream('tenant-a', 'LOT-001');

// ✅ PASS: Terminates (not infinite)
assert.ok(result.isSuccess);
assert.ok(result.value.length < 1000); // Not infinite

// ✅ PASS: Reports cycle
const warning = result.warnings.find(w => w.code === 'LINEAGE_CYCLE_DETECTED');
assert.ok(warning);
```

---

### Test 4: Missing Lot → Violation + No Mutation

```typescript
const item = { lot_tracked: true };
const inventory = { item_id: 'item-1', lot_number: null };

const result = E7.3.evaluateRule('TRACEABILITY_LOT_VALID', {
  item,
  lot_number: inventory.lot_number,
});

// ✅ PASS: Violation returned
assert.equal(result.status, 'VIOLATION');
assert.equal(result.violation.code, 'LOT_NUMBER_REQUIRED');

// ✅ PASS: Inventory unchanged
assert.equal(inventory.lot_number, null);
```

---

### Test 5: Same Context → Identical Result (Determinism)

```typescript
const context = {
  inventory: { expiry_date: new Date('2026-08-20') },
  evaluationDate: new Date('2026-08-22T10:00:00Z'),
};

const result1 = E7.3.evaluateExpiry(context.inventory, context.evaluationDate);
const result2 = E7.3.evaluateExpiry(context.inventory, context.evaluationDate);

// ✅ PASS: Identical results
assert.deepEqual(result1, result2);
```

---

### Test 6: Rule Violation → No Workflow Execution

```typescript
const inventory = { expiry_date: new Date('2026-08-20') };
const result = E7.3.evaluateExpiry(inventory, new Date('2026-08-22'));

// ✅ PASS: Violation returned
assert.equal(result.status, 'VIOLATION');

// ✅ PASS: No workflow executed
assert.equal(taskQueue.length, 0);
assert.equal(notifications.length, 0);
assert.equal(dbWrites.length, 0);

// ✅ PASS: No quarantine (Product responsibility)
assert.notEqual(inventory.status, 'QUARANTINE');
```

---

## Invariant Summary

| Group | Invariants | Critical Principle |
|-------|-----------|-------------------|
| **P0 — Rule Safety** | 1-5 | Rules evaluate, don't mutate or trigger workflows |
| **P0 — Violation Integrity** | 6-10 | Violations are typed, evidence-backed, deterministic |
| **P0 — Traceability Safety** | 11-16 | Lineage queries are deterministic, tenant-isolated, read-only |
| **P0 — Boundary Integrity** | 17-20 | E7.3 produces facts; Products execute workflows |

**Total:** 20 invariants

---

## Enforcement Strategy

### Design-Time:
- [ ] Contract types forbid workflow commands
- [ ] Context types forbid Product concepts
- [ ] Rule interfaces enforce readonly id/version

### Implementation-Time:
- [ ] All 20 invariants tested
- [ ] 6 negative-path tests pass
- [ ] No E7.1/E7.2 modifications
- [ ] Frozen boundary hook active

### Runtime:
- [ ] Tenant isolation enforced at query level
- [ ] Depth limits enforced (prevent infinite loops)
- [ ] Cycle detection active
- [ ] Broken chain warnings returned

---

## Success Criteria

E7.3.5 is complete when:

1. ✅ All 20 invariants documented
2. ✅ All 6 negative-path tests specified
3. ✅ Enforcement strategy defined
4. ✅ No E7.1/E7.2 modifications required
5. ✅ Boundary clear: E7.3 evaluates, Products execute

---

## Next Steps

1. ✅ **E7.3.1 Complete** — Capability inventory
2. ✅ **E7.3.2 Complete** — Boundary definition
3. ✅ **E7.3.3 Complete** — Traceability model
4. ✅ **E7.3.4 Complete** — Generic Rule Model
5. ⏳ **E7.3.5 Current** — Invariants + negative-path (this document)
6. ⏳ **E7.3.6 Next** — ADR + Design Lock

**Design lock gate ready after E7.3.6.**

---

**END OF E7.3 INVARIANTS + NEGATIVE-PATH CRITERIA**
