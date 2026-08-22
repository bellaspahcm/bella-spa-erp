# E7.3 Design — Boundary Definition

**Purpose:** Lock E7.3 scope and ownership boundaries before any implementation  
**Date:** 2026-08-22  
**Status:** DRAFT

---

## Core Principle

> **"E7.3 evaluates and enforces rules; Products interpret rule outcomes and execute workflows."**

E7.3 provides primitives for rule evaluation and traceability.  
E7.3 does NOT orchestrate Product workflows or make business decisions.

---

## 1. E7.3 Ownership (What E7.3 MUST Own)

### 1.1 Generic Rule Primitives

**E7.3 owns the rule abstraction:**

```
Rule
 ├─ ruleId         — unique identifier
 ├─ version        — rule version (for audit)
 ├─ input/context  — what data to evaluate
 ├─ condition      — constraint to check
 ├─ evaluation     — evaluation logic
 ├─ violation      — typed error if fails
 └─ evidence       — audit trail
```

**Rule must be evaluable without knowing Product workflow.**

**Example (Valid E7.3 Rule):**
```typescript
// ✅ Generic constraint
Rule: "Inventory cannot be used after expiry"
Input: { inventory, currentDate }
Condition: inventory.expiry_date >= currentDate
Violation: INVENTORY_EXPIRED
```

**Example (Invalid E7.3 Rule):**
```typescript
// ❌ Product workflow embedded
Rule: "When supplier is VIP, route to express QA workflow"
// This contains Warehouse business logic
```

### 1.2 Rule Enforcement

**E7.3 can:**
- ✅ Evaluate rule against input
- ✅ Reject invalid operation
- ✅ Produce typed violation
- ✅ Record evidence
- ✅ Determine compliance status

**E7.3 CANNOT:**
- ❌ Decide workflow next step
- ❌ Execute Product actions
- ❌ Route tasks to users
- ❌ Trigger external systems

**Flow:**
```
Input → E7.3 Rule Evaluation → Result<void> | Violation
                                      ↓
                                   Product
                                      ↓
                           Product Workflow Decision
```

E7.3 stops at producing Result. Product interprets Result.

### 1.3 Traceability Operations

**E7.3 can:**
- ✅ Generate custody event from movement
- ✅ Link source → movement → destination
- ✅ Query lineage (upstream/downstream)
- ✅ Query lot/serial history
- ✅ Determine expiry state
- ✅ Determine compliance status

**E7.3 CANNOT:**
- ❌ Execute recall workflow
- ❌ Send notifications
- ❌ Create warehouse tasks
- ❌ Approve/reject shipments
- ❌ Post to finance

**Flow:**
```
Movement → E7.3 Traceability → CustodyEvent
                                     ↓
                                  Product
                                     ↓
                          Product Workflow (if needed)
```

E7.3 generates events. Product decides what to do with them.

### 1.4 Lineage Query Primitives

**E7.3 provides:**
- ✅ `findMovementsByLot(lotNumber)` → Movement[]
- ✅ `findMovementsBySerial(serialNumber)` → Movement[]
- ✅ `traceUpstream(movement)` → Movement[] (source chain)
- ✅ `traceDownstream(movement)` → Movement[] (destination chain)
- ✅ `findOrigin(lotNumber)` → SupplierReference | Movement

**E7.3 does NOT provide:**
- ❌ `initiateRecall(lotNumber)` — Product responsibility
- ❌ `notifyCustomers(lotNumber)` — Product responsibility
- ❌ `quarantineAllAffected(lotNumber)` — Product responsibility

**Boundary:**
```
E7.3 answers: "Where did this lot come from?"
Product decides: "What should we do about it?"
```

### 1.5 Expiry/Compliance Evaluation

**E7.3 provides:**
- ✅ `isExpired(inventory, atDate)` → boolean
- ✅ `evaluateCompliance(traceability)` → ComplianceStatus
- ✅ `findExpiringSoon(days)` → Inventory[]
- ✅ `checkRecallStatus(lot)` → RecallStatus

**E7.3 does NOT provide:**
- ❌ Auto-quarantine expired inventory
- ❌ Execute QA workflow
- ❌ Send expiry alerts
- ❌ Create disposal tasks

**Critical Boundary:**
> **E7.3 does NOT mutate inventory state based on time.**

Time-based state changes require explicit Product action.

**Example:**
```typescript
// ✅ E7.3 provides:
const expired = E7.3.isExpired(inventory, new Date());
if (expired.isFailure) {
  // → Product decides: quarantine? discard? notify?
}

// ❌ E7.3 does NOT do:
E7.3.autoQuarantineExpired(); // NO automatic workflow
```

---

## 2. E7.3 Non-Ownership (What E7.3 MUST NOT Own)

### ❌ Product Workflows

E7.3 **MUST NOT** contain:
- Warehouse receiving workflow
- Putaway strategy
- Bin selection logic
- QA approval process
- Purchase order workflow
- Sales order workflow
- Finance posting logic
- Approval routing
- Task assignment
- Notification triggers

**If a rule contains knowledge like:**
> "When goods arrive at Warehouse A from Supplier Group B, route to QA Workflow C"

→ **NOT an E7.3 rule.** This is Product business logic.

**E7.3 can only provide:**
> "Item requires QA approval before status → AVAILABLE"

Product decides HOW to get QA approval.

### ❌ Product-Specific State Machines

E7.1/E7.2 have **generic** state machines (AVAILABLE, RESERVED, TRANSIT, etc.).

Products can extend with **Product-specific** states (e.g., "AWAITING_QA", "IN_PUTAWAY").

**E7.3 boundary:**
- ✅ E7.3 can validate generic states (E7.1/E7.2 frozen enums)
- ❌ E7.3 cannot define Product-specific states

### ❌ Conditional Workflow Logic

**Invalid E7.3 patterns:**
```typescript
// ❌ Product workflow in rule
if (supplier.type === 'VIP') {
  routeToExpressQA();
} else {
  routeToStandardQA();
}

// ❌ Product decision in traceability
if (lot.contaminated) {
  initiateRecall();
  notifyCustomers();
  quarantineInventory();
}

// ❌ Product action in compliance check
if (inventory.expired) {
  moveToQuarantine();
  createDisposalTask();
}
```

**Valid E7.3 patterns:**
```typescript
// ✅ Rule evaluation (no workflow)
const violation = evaluateRule('ITEM_REQUIRES_QA', { item });
return violation; // Product interprets

// ✅ Lineage query (no workflow)
const affectedMovements = traceDownstream(lot);
return affectedMovements; // Product decides action

// ✅ Expiry check (no mutation)
const expired = isExpired(inventory, now);
return expired; // Product decides action
```

---

## 3. Architectural Flow (Rule ≠ Workflow)

```
             E7.3 Layer
              │
       ┌──────┴──────┐
       │             │
   Rule Engine   Traceability
       │             │
   evaluate()    generateEvent()
   isExpired()   traceLineage()
       │             │
       └──────┬──────┘
              │
        Result<T>
        Violation
        Evidence
              │
              ▼
          Product Layer
              │
    Interpret Result
    Execute Workflow
    Orchestrate Actions
```

**Critical:** E7.3 does NOT have downward arrow to Product.  
E7.3 produces output. Product consumes output.

---

## 4. Boundary Test Cases

### Test A: Generic Rule (Valid E7.3)

**Rule:** "Inventory cannot be used after expiry"

**E7.3 Implementation:**
```typescript
function evaluateExpiryRule(
  inventory: Inventory,
  currentDate: Date
): Result<void> {
  if (inventory.expiry_date && inventory.expiry_date < currentDate) {
    return err({
      code: 'INVENTORY_EXPIRED',
      message: 'Inventory expired',
      expiry_date: inventory.expiry_date,
    });
  }
  return ok();
}
```

**Verdict:** ✅ **Valid E7.3** — Generic constraint, no workflow

---

### Test B: Product Workflow (Invalid E7.3)

**Rule:** "Expired inventory → create QA task → notify warehouse manager"

**Attempted Implementation:**
```typescript
function handleExpiredInventory(inventory: Inventory) {
  // ❌ Product workflow in E7.3
  createQATask({
    type: 'EXPIRY_REVIEW',
    inventory_id: inventory.id,
  });
  
  notifyWarehouseManager({
    message: `Inventory ${inventory.id} expired`,
  });
}
```

**Verdict:** ❌ **Invalid E7.3** — Contains Product workflow orchestration

**Correct Approach:**
```typescript
// E7.3 only evaluates:
const violation = E7.3.isExpired(inventory, now);

// Product orchestrates workflow:
if (violation.isFailure) {
  WarehouseProduct.createQATask(...);
  WarehouseProduct.notifyManager(...);
}
```

---

### Test C: Generic Lineage (Valid E7.3)

**Query:** "Find all movements contributing to Lot L001"

**E7.3 Implementation:**
```typescript
function findMovementsByLot(
  tenantId: string,
  lotNumber: string
): Result<InventoryMovement[]> {
  // Query movements with lot_number = L001
  return movementRepository.list(tenantId, {
    lot_number: lotNumber,
  });
}
```

**Verdict:** ✅ **Valid E7.3** — Generic query, no workflow

---

### Test D: Product Workflow (Invalid E7.3)

**Workflow:** "Lot L001 contaminated → initiate recall campaign"

**Attempted Implementation:**
```typescript
function handleContaminatedLot(lotNumber: string) {
  // ❌ Product workflow in E7.3
  const affectedMovements = findMovementsByLot(lotNumber);
  
  for (const movement of affectedMovements) {
    quarantineInventory(movement.to_location_id);
    notifyCustomers(movement.customer_id);
    createRecallRecord(movement);
  }
}
```

**Verdict:** ❌ **Invalid E7.3** — Contains Product recall workflow

**Correct Approach:**
```typescript
// E7.3 only provides data:
const affectedMovements = E7.3.traceDownstream(lotNumber);

// Product orchestrates recall:
RecallProduct.initiateRecall(affectedMovements);
```

---

### Test E: Custody Event Generation (Valid E7.3)

**Operation:** "Generate custody event from movement"

**E7.3 Implementation:**
```typescript
function generateCustodyEvent(
  movement: InventoryMovement
): CustodyEvent {
  // Map movement_type → custody action
  const action = mapMovementTypeToCustodyAction(movement.movement_type);
  
  return {
    timestamp: movement.movement_date,
    location_id: movement.to_location_id?.value || '',
    location_type: movement.to_location_type || 'WAREHOUSE',
    action,
    user_id: movement.created_by,
    notes: movement.notes,
  };
}
```

**Verdict:** ✅ **Valid E7.3** — Generic event generation, no workflow

---

### Test F: Workflow Trigger (Invalid E7.3)

**Operation:** "Custody event → send email to QA → create warehouse task"

**Attempted Implementation:**
```typescript
function onCustodyEvent(event: CustodyEvent) {
  // ❌ Product workflow in E7.3
  if (event.action === 'QUARANTINED') {
    sendEmailToQA({
      subject: 'Inventory quarantined',
      event,
    });
    
    createWarehouseTask({
      type: 'QA_REVIEW',
      location_id: event.location_id,
    });
  }
}
```

**Verdict:** ❌ **Invalid E7.3** — Contains Product notification/task workflow

**Correct Approach:**
```typescript
// E7.3 only generates event:
const event = E7.3.generateCustodyEvent(movement);

// Product subscribes to events and decides action:
EventBus.on('CUSTODY_EVENT', (event) => {
  if (event.action === 'QUARANTINED') {
    WarehouseProduct.handleQuarantine(event);
  }
});
```

---

## 5. Architectural Boundary Proof

### Positive Cases (E7.3 SHOULD own):

| Capability | Rationale |
|------------|-----------|
| `evaluateRule(rule, input)` | Generic evaluation, no workflow |
| `isExpired(inventory, date)` | Time-based check, no mutation |
| `generateCustodyEvent(movement)` | Generic consequence of movement |
| `traceLineage(lot)` | Generic query, no workflow decision |
| `findExpiringSoon(days)` | Generic query, no notification |
| `checkCompliance(traceability)` | Status evaluation, no action |

### Negative Cases (E7.3 MUST NOT own):

| Capability | Rationale |
|------------|-----------|
| `autoQuarantineExpired()` | Automatic workflow execution |
| `routeToQA(item)` | Warehouse business logic |
| `initiateRecall(lot)` | Product-specific orchestration |
| `notifyManager(event)` | External system trigger |
| `createTask(type, data)` | Workflow task management |
| `approveShipment(order)` | Approval workflow logic |

---

## 6. E7.3 Dependencies (Read-Only)

E7.3 **READS** (does not modify) frozen contracts:

### From E7.1 (FROZEN):
- ✅ `Inventory` entity (lot, serial, expiry fields)
- ✅ `Item` entity (tracking flags)
- ✅ `Movement` entity (immutable log)
- ✅ `TraceabilityRecord` entity (custody events)
- ✅ Status enums (InventoryStatus, etc.)
- ✅ `Result<T>` pattern

### From E7.2 (FROZEN):
- ✅ `OperationContext` pattern (reason + actor)
- ✅ Operational invariants (precondition pattern)
- ✅ Domain Service pattern (entity tuples)
- ✅ MovementRepository interface

**No modifications to E7.1/E7.2 permitted.**

If E7.3 design reveals defects → **STOP** → ACR → Review → ADR → Re-baseline.

---

## 7. E7.3 Success Criteria

E7.3 boundary is correct if:

### Criterion 1: E7.1/E7.2 Unchanged
- ✅ E7.3 uses frozen primitives as-is
- ✅ No modifications to E7.1/E7.2 files
- ✅ E7.3 extends, does not replace

### Criterion 2: Rule Evaluation is Generic
- ✅ Rules evaluate constraints without Product knowledge
- ✅ Rules produce typed violations
- ✅ Rules do not trigger workflows

### Criterion 3: Traceability is Query-Based
- ✅ Traceability generates events and queries lineage
- ✅ Traceability does not execute recalls or notifications
- ✅ Traceability provides data, Products interpret

### Criterion 4: No Product Workflow in E7.3
- ✅ No Warehouse receiving logic
- ✅ No QA approval workflow
- ✅ No Finance posting
- ✅ No task orchestration

### Criterion 5: Boundary Tests Pass
- ✅ All positive cases (A, C, E) valid
- ✅ All negative cases (B, D, F) rejected

### Criterion 6: Products Can Extend Without Kernel Modification
- ✅ Product adds rule: uses E7.3 primitive, E7.1/E7.2 unchanged
- ✅ Product adds workflow: orchestrates E7.3 results, E7.3 unchanged

---

## 8. Design Constraints for E7.3.3 and E7.3.4

### Do NOT Design Generic Rule DSL Yet

E7.3.2 locks boundary and ownership.  
E7.3.3 will design **Traceability Model** (concrete, not abstract).  
E7.3.4 will design **Rule Model** (based on proven needs, not speculation).

**Avoid:**
- Over-engineered rule DSL before knowing Product needs
- Generic workflow engine disguised as rule engine
- Premature abstraction

**Prefer:**
- Concrete traceability operations first
- Simple rule patterns based on actual E7.1/E7.2 invariants
- Defer complexity until proven necessary

---

## 9. Next Steps

1. ✅ **E7.3.1 Complete** — Capability inventory
2. ⏳ **E7.3.2 Current** — Boundary definition (this document)
3. ⏳ **E7.3.3 Next** — Traceability Domain Model (custody events, lineage queries)
4. ⏳ **E7.3.4** — Rule Model (based on E7.2 operational invariants)
5. ⏳ **E7.3.5** — Invariants + negative-path criteria
6. ⏳ **E7.3.6** — ADR + Design Lock

**No code yet.**

---

## 10. Boundary Lock Checklist

Before proceeding to E7.3.3, verify:

- [ ] E7.3 ownership clearly defined
- [ ] E7.3 non-ownership (Product workflows) clearly excluded
- [ ] Architectural flow shows E7.3 → Product (not bidirectional)
- [ ] Boundary tests include positive AND negative cases
- [ ] Rule ≠ Workflow principle stated
- [ ] Expiry does NOT auto-mutate inventory
- [ ] Traceability provides data, does NOT execute recalls
- [ ] No modifications to E7.1/E7.2 required
- [ ] Success criteria measurable
- [ ] Design constraints for E7.3.3/E7.3.4 stated

---

**END OF E7.3 BOUNDARY DEFINITION**
