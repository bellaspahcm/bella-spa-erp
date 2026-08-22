# E7.3 Design — Generic Rule Model

**Purpose:** Define minimal Rule Contract for E7.3 (not a framework)  
**Date:** 2026-08-22  
**Status:** DRAFT

---

## Core Principle

> **"Rules evaluate constraints and produce evidence. Rules do NOT execute workflows or mutate state."**

E7.3 provides a **Rule Contract** for evaluation + evidence.  
E7.3 does NOT provide a workflow engine or DSL.

---

## 1. Rule Does One Thing

```
Context → Rule.evaluate() → RuleResult
```

**Example (Valid):**
```typescript
ExpiryRule
  input: { inventory, evaluationDate }
  evaluate: inventory.expiry_date < evaluationDate
  result: VIOLATION | PASS
```

**Example (Invalid):**
```typescript
// ❌ Rule with workflow
ExpiryRule
  input: { inventory }
  evaluate: check expiry
  if EXPIRED:
    quarantine()        // ❌ Workflow
    createTask()        // ❌ Workflow
    sendNotification()  // ❌ Workflow
```

**Rule stops at evaluation. Product interprets result.**

---

## 2. Rule Contract

### 2.1 Rule Interface

```typescript
interface Rule<TContext> {
  readonly id: string;           // Unique rule identifier
  readonly version: string;      // Rule version (for audit)
  readonly description: string;  // Human-readable description
  
  evaluate(context: TContext): RuleResult;
}
```

**Properties:**
- `id`: Machine-readable identifier (e.g., "INVENTORY_EXPIRY_CHECK")
- `version`: Semantic version (e.g., "1.0.0")
- `description`: Human explanation (e.g., "Inventory cannot be used after expiry")

**Method:**
- `evaluate(context)`: Pure function, deterministic, no side effects

### 2.2 RuleResult

```typescript
type RuleResult = RulePass | RuleViolation;

interface RulePass {
  status: 'PASS';
  ruleId: string;
  version: string;
  evaluatedAt: Date;
  evidence: RuleEvidence;
}

interface RuleViolation {
  status: 'VIOLATION';
  ruleId: string;
  version: string;
  evaluatedAt: Date;
  violation: ViolationDetail;
  evidence: RuleEvidence;
}
```

**Critical:**
- Result is **data**, not **command**
- Result does NOT contain workflow instructions
- Result contains typed violation code for Product interpretation

### 2.3 ViolationDetail

```typescript
interface ViolationDetail {
  code: string;              // Machine-readable code
  message: string;           // Human-readable message
  severity: 'ERROR' | 'WARNING';
  field?: string;            // Field that violated (optional)
  actual?: any;              // Actual value
  expected?: any;            // Expected value
}
```

**Violation codes are generic:**
- ✅ `INVENTORY_EXPIRED`
- ✅ `INSUFFICIENT_QUANTITY`
- ✅ `INVALID_LOT_TRACE`
- ✅ `COMPLIANCE_VIOLATION`

**NOT Product-specific:**
- ❌ `WAREHOUSE_QA_REQUIRED`
- ❌ `SALES_ORDER_UNAPPROVED`
- ❌ `FINANCE_POSTING_BLOCKED`

### 2.4 RuleEvidence

```typescript
interface RuleEvidence {
  input: Record<string, any>;   // Input context
  output: any;                  // Evaluation output
  metadata?: Record<string, any>; // Additional context
}
```

**Purpose:** Auditability and compliance reporting

**Example:**
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
    location_id: 'WH-001',
  }
}
```

---

## 3. Rule Must Be Deterministic

**Requirement:**
> Same context + same evaluation time → same result

**Rules MUST NOT depend on:**
- ❌ `Math.random()`
- ❌ Hidden `new Date()` inside rule
- ❌ Database queries
- ❌ Network calls
- ❌ Product workflow state
- ❌ Global mutable state

**Rules MUST receive all inputs explicitly:**
```typescript
// ✅ Deterministic
evaluate({
  inventory,
  evaluationDate: new Date('2026-08-22'),
})

// ❌ Non-deterministic
evaluate(inventory) {
  const now = new Date(); // Hidden dependency
  return inventory.expiry_date < now;
}
```

**Rationale:** Reproducible results for compliance, audit, testing.

---

## 4. Rule Composition

### 4.1 Evaluate Multiple Rules

```typescript
function evaluateAll<TContext>(
  rules: Rule<TContext>[],
  context: TContext
): CompositeRuleResult
```

**Pattern:**
```
Rule A
  AND
Rule B
  AND
Rule C
  ↓
All PASS → PASS
Any VIOLATION → VIOLATION (with all violations)
```

### 4.2 CompositeRuleResult

```typescript
interface CompositeRuleResult {
  status: 'PASS' | 'VIOLATION';
  evaluatedAt: Date;
  results: RuleResult[];         // Individual results
  violations: ViolationDetail[]; // All violations (if any)
  evidence: RuleEvidence[];      // All evidence
}
```

**Behavior:**
- All rules evaluated (no short-circuit)
- All violations collected
- All evidence preserved

**No complex DSL yet:**
- No `OR` / `XOR` logic
- No conditional evaluation
- No dynamic rule loading

**Rationale:** Prove composability with simple AND pattern first.

---

## 5. E7.3.4 Generic Rules (P0)

### 5.1 Expiry Rule

**ID:** `INVENTORY_EXPIRY_CHECK`  
**Version:** `1.0.0`  
**Description:** "Inventory cannot be used after expiry date"

**Context:**
```typescript
interface ExpiryRuleContext {
  inventory: Inventory;
  evaluationDate: Date;
}
```

**Evaluation:**
```typescript
if (inventory.expiry_date < evaluationDate) {
  return VIOLATION('INVENTORY_EXPIRED');
}
return PASS;
```

**Boundary:**
- ✅ Evaluates expiry status
- ❌ Does NOT quarantine inventory
- ❌ Does NOT send notifications

### 5.2 Quantity Positive Rule

**ID:** `QUANTITY_POSITIVE_CHECK`  
**Version:** `1.0.0`  
**Description:** "Quantity must be greater than zero"

**Context:**
```typescript
interface QuantityRuleContext {
  quantity: number;
  operation: string; // For evidence
}
```

**Evaluation:**
```typescript
if (quantity <= 0) {
  return VIOLATION('QUANTITY_MUST_BE_POSITIVE');
}
return PASS;
```

### 5.3 Available Quantity Rule

**ID:** `QUANTITY_AVAILABLE_CHECK`  
**Version:** `1.0.0`  
**Description:** "Requested quantity must not exceed available"

**Context:**
```typescript
interface AvailableQuantityContext {
  requested: number;
  available: number;
  inventory_id: string;
}
```

**Evaluation:**
```typescript
if (requested > available) {
  return VIOLATION('INSUFFICIENT_AVAILABLE_QUANTITY', {
    requested,
    available,
  });
}
return PASS;
```

### 5.4 Valid Lot Rule

**ID:** `TRACEABILITY_LOT_VALID`  
**Version:** `1.0.0`  
**Description:** "Lot number must be valid for lot-tracked items"

**Context:**
```typescript
interface LotValidityContext {
  item: Item;
  lot_number?: string;
}
```

**Evaluation:**
```typescript
if (item.lot_tracked && !lot_number) {
  return VIOLATION('LOT_NUMBER_REQUIRED');
}
return PASS;
```

### 5.5 Valid Serial Rule

**ID:** `TRACEABILITY_SERIAL_VALID`  
**Version:** `1.0.0`  
**Description:** "Serial number must be valid for serial-tracked items"

**Context:**
```typescript
interface SerialValidityContext {
  item: Item;
  serial_number?: string;
}
```

**Evaluation:**
```typescript
if (item.serial_tracked && !serial_number) {
  return VIOLATION('SERIAL_NUMBER_REQUIRED');
}
return PASS;
```

### 5.6 Traceability Chain Integrity Rule

**ID:** `TRACEABILITY_CHAIN_INTEGRITY`  
**Version:** `1.0.0`  
**Description:** "Traceability chain must be complete"

**Context:**
```typescript
interface ChainIntegrityContext {
  traceability: TraceabilityRecord;
  requiredEvents: string[]; // Expected custody actions
}
```

**Evaluation:**
```typescript
const actualActions = traceability.custody_events.map(e => e.action);
const missing = requiredEvents.filter(req => !actualActions.includes(req));

if (missing.length > 0) {
  return VIOLATION('BROKEN_TRACEABILITY_CHAIN', {
    missing_events: missing,
  });
}
return PASS;
```

### 5.7 Compliance Status Rule

**ID:** `TRACEABILITY_COMPLIANCE_STATUS`  
**Version:** `1.0.0`  
**Description:** "Traceability must be compliant"

**Context:**
```typescript
interface ComplianceContext {
  traceability: TraceabilityRecord;
}
```

**Evaluation:**
```typescript
if (traceability.compliance_status !== 'COMPLIANT') {
  return VIOLATION('COMPLIANCE_VIOLATION', {
    status: traceability.compliance_status,
    recall_status: traceability.recall_status,
  });
}
return PASS;
```

---

## 6. Rules MUST NOT Include Product Semantics

### ❌ Invalid Rules (Product-Specific):

**Warehouse QA Rule:**
```typescript
// ❌ Product workflow in rule
ID: 'WAREHOUSE_QA_APPROVAL_REQUIRED'
evaluate() {
  if (supplier.type === 'VIP') {
    routeToExpressQA(); // ❌ Workflow
  }
}
```

**Sales Order Approval:**
```typescript
// ❌ Product business logic
ID: 'SALES_ORDER_APPROVAL_REQUIRED'
evaluate() {
  if (order.amount > 10000) {
    requireManagerApproval(); // ❌ Workflow
  }
}
```

**Finance Posting:**
```typescript
// ❌ Product workflow
ID: 'FINANCE_POSTING_REQUIRED'
evaluate() {
  postToGeneralLedger(); // ❌ Workflow
}
```

**Boundary Test:**
> If rule knows "Warehouse" or "Sales" or "Finance" concepts → NOT E7.3 rule.

---

## 7. Architectural Tests for E7.3.4

### Test 1: Rule Must Not Mutate

```typescript
const inventory = { ...originalInventory };
const result = rule.evaluate({ inventory, evaluationDate });

// ✅ PASS: inventory unchanged
assert.deepEqual(inventory, originalInventory);
```

**Invariant:** Rule evaluation is side-effect-free.

### Test 2: Rule Must Not Execute Workflow

```typescript
const result = rule.evaluate(context);

// ✅ PASS: No tasks created
assert.equal(taskQueue.length, 0);

// ✅ PASS: No notifications sent
assert.equal(notifications.length, 0);

// ✅ PASS: No DB writes
assert.equal(dbWrites.length, 0);
```

**Invariant:** Rule produces Result, does not execute actions.

### Test 3: Rule Must Be Deterministic

```typescript
const context = { inventory, evaluationDate: new Date('2026-08-22') };

const result1 = rule.evaluate(context);
const result2 = rule.evaluate(context);

// ✅ PASS: Same result
assert.deepEqual(result1, result2);
```

**Invariant:** Same input → same output.

### Test 4: Rule Must Be Product-Agnostic

```typescript
// ✅ PASS: Generic context
type ValidContext = {
  inventory: Inventory;
  evaluationDate: Date;
};

// ❌ FAIL: Product-specific context
type InvalidContext = {
  warehouseOrder: WarehouseOrder;  // ❌ Product concept
  salesOrder: SalesOrder;          // ❌ Product concept
  qaWorkflow: QAWorkflow;          // ❌ Product concept
};
```

**Invariant:** Rule context uses E7.1/E7.2 entities only.

### Test 5: Violation Must Be Evidence-Backed

```typescript
const result = rule.evaluate(context);

if (result.status === 'VIOLATION') {
  // ✅ PASS: Has violation code
  assert.ok(result.violation.code);
  
  // ✅ PASS: Has evidence
  assert.ok(result.evidence);
  
  // ✅ PASS: Evidence contains input
  assert.ok(result.evidence.input);
}
```

**Invariant:** Violations are typed and auditable.

### Test 6: Rule Must Not Return Workflow Command

```typescript
const result = rule.evaluate(context);

// ❌ FAIL: Rule returns command
if ('command' in result) {
  throw new Error('Rule must not return workflow command');
}

// ❌ FAIL: Rule returns action
if ('action' in result) {
  throw new Error('Rule must not return workflow action');
}
```

**Invariant:** RuleResult is data, not command.

---

## 8. Rule Violation Codes (Machine-Readable)

### E7.3 Generic Codes:

| Code | Meaning | Source |
|------|---------|--------|
| `INVENTORY_EXPIRED` | Inventory past expiry date | Expiry rule |
| `QUANTITY_MUST_BE_POSITIVE` | Quantity ≤ 0 | Quantity rule |
| `INSUFFICIENT_AVAILABLE_QUANTITY` | Requested > available | Available quantity rule |
| `INSUFFICIENT_RESERVED_QUANTITY` | Released > reserved | Reserved quantity rule |
| `LOT_NUMBER_REQUIRED` | Lot-tracked item missing lot | Lot validity rule |
| `SERIAL_NUMBER_REQUIRED` | Serial-tracked item missing serial | Serial validity rule |
| `BROKEN_TRACEABILITY_CHAIN` | Missing custody events | Chain integrity rule |
| `COMPLIANCE_VIOLATION` | Non-compliant traceability | Compliance rule |

### Product Interprets Codes:

```typescript
// E7.3 evaluates:
const result = E7.3.evaluateRule('INVENTORY_EXPIRY_CHECK', context);

// Product interprets:
if (result.status === 'VIOLATION') {
  switch (result.violation.code) {
    case 'INVENTORY_EXPIRED':
      await WarehouseProduct.quarantineInventory(context.inventory.id);
      await NotificationService.alertManager(context.inventory);
      break;
    
    case 'INSUFFICIENT_AVAILABLE_QUANTITY':
      await OrderProduct.rejectOrder(context.order_id);
      break;
    
    // Product-specific workflow (NOT E7.3)
  }
}
```

**E7.3 provides code. Product executes workflow.**

---

## 9. Architectural Flow

```
           E7.3 Rule Layer
                 │
          Rule.evaluate()
                 │
                 ▼
            RuleResult
          (data, not command)
                 │
                 ▼
          Product Layer
                 │
         Interpret Result
                 │
                 ▼
         Execute Workflow
```

**Critical:** E7.3 does NOT have arrow back to Product.

---

## 10. E7.3.4 Scope Boundary

### ✅ E7.3.4 SHOULD Own:

1. **Rule Contract:**
   - `Rule<TContext>` interface
   - `RuleResult` type
   - `ViolationDetail` type
   - `RuleEvidence` type

2. **Generic Rules (P0):**
   - Expiry check
   - Quantity checks (positive, available, reserved)
   - Lot/serial validity
   - Traceability chain integrity
   - Compliance status

3. **Rule Composition:**
   - `evaluateAll(rules, context)`
   - Collect all violations
   - Preserve evidence

4. **Architectural Tests:**
   - No mutation
   - No workflow execution
   - Determinism
   - Product-agnostic
   - Evidence-backed violations

### ❌ E7.3.4 MUST NOT Own:

1. **Complex DSL:**
   - Rule expression language
   - Dynamic rule loading
   - Rule orchestration engine

2. **Product Rules:**
   - Warehouse QA approval
   - Sales order approval
   - Finance posting rules
   - Custom Product workflows

3. **Workflow Engine:**
   - Task orchestration
   - Approval routing
   - State machine transitions

4. **Rule Actions:**
   - Auto-quarantine
   - Auto-notification
   - Auto-task creation

---

## 11. Dependencies on E7.1/E7.2 (READ-ONLY)

### E7.3.4 READS (does not modify):

**From E7.1 (FROZEN):**
- ✅ `Inventory` entity (expiry_date field)
- ✅ `Item` entity (lot_tracked, serial_tracked flags)
- ✅ `TraceabilityRecord` entity (custody_events, compliance_status)
- ✅ `Result<T>` pattern

**From E7.2 (FROZEN):**
- ✅ `OperationContext` pattern (for evidence)
- ✅ Operational invariants (as rule examples)

### No Modifications Permitted

If E7.3.4 requires E7.1/E7.2 changes → **STOP** → ACR → Review → ADR.

---

## 12. E7.3.4 Success Criteria

E7.3.4 is successful if:

### Criterion 1: Rule Contract Minimal
- ✅ `Rule<TContext>` interface defined
- ✅ < 100 LOC for contract
- ✅ No complex DSL

### Criterion 2: Rules Are Deterministic
- ✅ Same input → same output
- ✅ No hidden dependencies
- ✅ All inputs explicit

### Criterion 3: Rules Do Not Mutate
- ✅ Side-effect-free evaluation
- ✅ Input unchanged after evaluation

### Criterion 4: Rules Do Not Execute Workflow
- ✅ Return data, not commands
- ✅ No task creation
- ✅ No notifications
- ✅ No state transitions

### Criterion 5: Rules Are Product-Agnostic
- ✅ Context uses E7.1/E7.2 entities only
- ✅ No Warehouse/Sales/Finance concepts
- ✅ Generic violation codes

### Criterion 6: Violations Are Evidence-Backed
- ✅ Typed violation codes
- ✅ Evidence includes input/output
- ✅ Auditability

### Criterion 7: Composition Works
- ✅ `evaluateAll()` collects violations
- ✅ All evidence preserved
- ✅ No short-circuit (all rules evaluated)

### Criterion 8: Architectural Tests Pass
- ✅ No mutation test
- ✅ No workflow test
- ✅ Determinism test
- ✅ Product-agnostic test
- ✅ Evidence test
- ✅ No command test

---

## 13. Design Lock Gate

Before proceeding to implementation, verify:

- [ ] Rule Contract defined (< 100 LOC)
- [ ] RuleResult type defined (PASS | VIOLATION)
- [ ] ViolationDetail structure defined
- [ ] RuleEvidence structure defined
- [ ] 7 generic rules identified (P0)
- [ ] Rule composition pattern defined
- [ ] 6 architectural tests specified
- [ ] Violation codes defined (machine-readable)
- [ ] Product interpretation pattern documented
- [ ] No E7.1/E7.2 modifications required
- [ ] Boundary clear (rules evaluate, Products execute)
- [ ] Success criteria measurable

---

## 14. Next Steps

1. ✅ **E7.3.1 Complete** — Capability inventory
2. ✅ **E7.3.2 Complete** — Boundary definition
3. ✅ **E7.3.3 Complete** — Traceability model
4. ⏳ **E7.3.4 Current** — Generic Rule Model (this document)
5. ⏳ **E7.3.5 Next** — Invariants + negative-path criteria
6. ⏳ **E7.3.6** — ADR + Design Lock

**No code yet. Design must be locked before implementation.**

---

## 15. Key Design Decisions

### Decision 1: No Complex DSL

**Rationale:** Prove rule pattern with simple AND composition before building expression language.

**Tradeoff:** Less flexibility, but clearer boundary and lower complexity.

### Decision 2: Evidence as First-Class

**Rationale:** Auditability and compliance require complete evaluation trail.

**Tradeoff:** More data to store, but better regulatory compliance.

### Decision 3: All Inputs Explicit

**Rationale:** Determinism requires no hidden dependencies.

**Tradeoff:** More verbose context, but reproducible results.

### Decision 4: Rules Return Data, Not Commands

**Rationale:** Maintain E7.3 → Product unidirectional flow.

**Tradeoff:** Product must interpret results, but boundary preserved.

### Decision 5: Generic Codes Only

**Rationale:** E7.3 must not know Product semantics.

**Tradeoff:** Product must map generic codes to workflows, but kernel stays clean.

---

**END OF E7.3 GENERIC RULE MODEL**
