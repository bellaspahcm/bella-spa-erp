# E7.3 Design — Traceability Domain Model

**Purpose:** Define concrete traceability operations for E7.3  
**Date:** 2026-08-22  
**Status:** DRAFT

---

## 0. E7.1 Existing Primitives (READ-ONLY 🔒)

### E7.1 Already Has:

**TraceabilityRecord Entity:**
- ✅ `lot_number`, `serial_number` identifiers
- ✅ `custody_events: CustodyEvent[]` (immutable chain)
- ✅ `compliance_status`, `recall_status` enums
- ✅ `expiry_date`, `manufactured_date`, `received_date`
- ✅ `supplier` reference

**CustodyEvent Structure:**
```typescript
{
  timestamp: Date;
  location_id: string;
  location_type: LocationType;
  action: 'RECEIVED' | 'MOVED' | 'QUARANTINED' | 'RELEASED' | 'SHIPPED' | 'DAMAGED' | 'DESTROYED';
  user_id?: string;
  notes?: string;
}
```

**TraceabilityDomain Operations (E7.1 FROZEN):**
- ✅ `create(props)` — Create traceability record
- ✅ `addCustodyEvent(traceability, props)` — Append custody event
- ✅ `initiateRecall(traceability, reason)` — Mark as recalled
- ✅ `markAsDestroyed(traceability)` — Mark destroyed
- ✅ `changeComplianceStatus(traceability, status)` — Change compliance
- ✅ `hasExpired(traceability, date)` — Check expiry
- ✅ `daysUntilExpiry(traceability, date)` — Calculate days
- ✅ `isNearExpiry(traceability, threshold, date)` — Near expiry check
- ✅ `getLastCustodyEvent(traceability)` — Get last event

**Key Finding:**
> **E7.1 already has comprehensive traceability primitives.**  
> E7.3 does NOT need to rebuild these. E7.3 adds:
> 1. Automatic custody event generation from movements
> 2. Lineage query (upstream/downstream traversal)
> 3. Movement → Traceability linkage

---

## 1. E7.3 Capability 1: Custody Event Generation

### 1.1 Responsibility

**E7.3 provides:**
> Automatic custody event generation from InventoryMovement

**Pattern:**
```
Movement (E7.1/E7.2) → E7.3 Traceability → CustodyEvent (E7.1)
```

### 1.2 Operation: `generateCustodyEvent`

**Signature:**
```typescript
function generateCustodyEvent(
  movement: InventoryMovement
): Result<CustodyEvent>
```

**Input:**
- `movement: InventoryMovement` (E7.1 entity)

**Output:**
- `Result<CustodyEvent>` (E7.1 type)

**Mapping Logic:**

| MovementType (E7.1) | CustodyAction (E7.1) |
|---------------------|----------------------|
| RECEIPT | RECEIVED |
| RETURN_RECEIPT | RECEIVED |
| TRANSFER_IN | MOVED |
| TRANSFER_OUT | MOVED |
| RELOCATION | MOVED |
| ISSUE | SHIPPED |
| SHIPMENT | SHIPPED |
| ADJUSTMENT_DECREASE (reason: DAMAGE) | DAMAGED |
| ADJUSTMENT_DECREASE (reason: OBSOLESCENCE) | DESTROYED |

**Event Structure:**
```typescript
{
  timestamp: movement.movement_date,
  location_id: movement.to_location_id?.value || movement.from_location_id?.value,
  location_type: movement.to_location_type || movement.from_location_type,
  action: mapMovementTypeToCustodyAction(movement.movement_type),
  user_id: movement.created_by,
  notes: movement.notes || movement.reason,
}
```

### 1.3 Invariants

1. **Event must reference valid movement**
   - Custody event MUST be generated from a COMPLETED movement
   - PENDING/CANCELLED/FAILED movements do NOT generate events

2. **Event is immutable**
   - Once recorded, custody events cannot be modified
   - Follow E7.1 append-only pattern

3. **Location required**
   - At least one location (from or to) must be present
   - Use `to_location` for inbound, `from_location` for outbound

4. **Tenant isolation**
   - Event tenant_id MUST match movement tenant_id
   - Cross-tenant events forbidden

5. **Quantity/UOM consistency**
   - Event should reference movement quantity (via notes/metadata)
   - UOM from movement preserved in lineage

### 1.4 Error Cases

| Error | Code | Condition |
|-------|------|-----------|
| Movement not completed | MOVEMENT_NOT_COMPLETED | status != 'COMPLETED' |
| No location | LOCATION_REQUIRED | Both from/to null |
| Invalid movement type | INVALID_MOVEMENT_TYPE | Unknown type |
| Tenant mismatch | TENANT_ISOLATION_VIOLATION | Cross-tenant |

### 1.5 E7.3 Boundary

**✅ E7.3 does:**
- Map movement → custody event
- Validate movement status
- Preserve audit metadata

**❌ E7.3 does NOT:**
- Execute workflows after event generation
- Send notifications
- Create tasks
- Trigger external systems

**Product responsibility:**
```typescript
// E7.3 generates event:
const eventResult = E7.3.generateCustodyEvent(movement);

// Product decides action:
if (eventResult.isSuccess) {
  const event = eventResult.value;
  await traceabilityRepository.recordEvent(event);
  
  // Product workflow (NOT E7.3):
  if (event.action === 'QUARANTINED') {
    await WarehouseProduct.handleQuarantine(event);
  }
}
```

---

## 2. E7.3 Capability 2: Lineage Query

### 2.1 Responsibility

**E7.3 provides:**
> Query lot/serial lineage (upstream/downstream traversal)

**Pattern:**
```
Lot/Serial ID → E7.3 Lineage → Movement[] (chain)
```

### 2.2 Operations

#### 2.2.1 `traceUpstream`

**Signature:**
```typescript
function traceUpstream(
  tenantId: string,
  lotNumber: string,
  options?: LineageOptions
): Result<Movement[]>
```

**Purpose:** Find source movements contributing to this lot

**Traversal:**
```
Supplier → RECEIPT → Lot L001 (current)
```

**Returns:** Movements in **chronological order** (oldest first)

#### 2.2.2 `traceDownstream`

**Signature:**
```typescript
function traceDownstream(
  tenantId: string,
  lotNumber: string,
  options?: LineageOptions
): Result<Movement[]>
```

**Purpose:** Find destination movements consuming this lot

**Traversal:**
```
Lot L001 (current) → SHIPMENT → Customer
```

**Returns:** Movements in **chronological order** (oldest first)

#### 2.2.3 `getLotHistory`

**Signature:**
```typescript
function getLotHistory(
  tenantId: string,
  lotNumber: string,
  options?: LineageOptions
): Result<Movement[]>
```

**Purpose:** Complete movement history for lot (upstream + downstream)

**Returns:** All movements affecting lot, chronologically ordered

#### 2.2.4 `getSerialHistory`

**Signature:**
```typescript
function getSerialHistory(
  tenantId: string,
  serialNumber: string,
  options?: LineageOptions
): Result<Movement[]>
```

**Purpose:** Complete movement history for serial number

**Returns:** All movements affecting serial, chronologically ordered

### 2.3 LineageOptions

```typescript
interface LineageOptions {
  maxDepth?: number;          // Traversal depth limit (default: 100)
  includeStatus?: MovementStatus[];  // Filter by status (default: ['COMPLETED'])
  dateFrom?: Date;            // Filter by date range
  dateTo?: Date;
  includeCancelled?: boolean; // Include CANCELLED movements (default: false)
}
```

### 2.4 Traversal Rules

#### 2.4.1 Direction

**Upstream (source chain):**
- Follow `from_location` links
- Stop at: RECEIPT (supplier → warehouse)
- Stop at: PRODUCTION_OUTPUT (manufactured goods)

**Downstream (destination chain):**
- Follow `to_location` links
- Stop at: SHIPMENT (warehouse → customer)
- Stop at: DESTROYED (end of life)

#### 2.4.2 Cycle Handling

**Problem:** Movements could form cycles (e.g., returns)

**Solution:**
- Track visited movement_ids
- Stop traversal if cycle detected
- Return `LINEAGE_CYCLE_DETECTED` warning (not error)
- Include cycle movements in result with flag

**Example:**
```typescript
{
  movements: [...],
  warnings: [{
    code: 'LINEAGE_CYCLE_DETECTED',
    movement_id: 'mov-123',
  }]
}
```

#### 2.4.3 Depth Limit

**Default:** 100 movements  
**Reason:** Prevent infinite traversal in case of data errors

**Behavior:**
- If depth exceeds limit, stop traversal
- Return `LINEAGE_DEPTH_EXCEEDED` warning
- Partial result returned (not error)

#### 2.4.4 Missing Links (Broken Chain)

**Problem:** Movement references location/lot that doesn't exist

**Solution:**
- Do NOT fabricate missing movements
- Return `LINEAGE_BROKEN_CHAIN` warning
- Include last valid movement in result

**Example:**
```typescript
{
  movements: [mov1, mov2], // mov3 missing
  warnings: [{
    code: 'LINEAGE_BROKEN_CHAIN',
    message: 'Movement mov-3 not found',
    last_valid_movement: 'mov-2',
  }]
}
```

**Critical boundary:**
> E7.3 does NOT infer or create missing data. Broken chains are reported as-is.

#### 2.4.5 Tenant Isolation

**Invariant:** Lineage traversal MUST NOT cross tenant boundaries

**Enforcement:**
- All queries scoped by `tenantId`
- Cross-tenant movements rejected
- Cross-tenant links treated as broken chain

### 2.5 Deterministic Ordering

**Requirement:** Lineage query must return deterministic results

**Ordering:**
1. Primary: `movement_date` (ascending for chronological)
2. Secondary: `created_at` (if same date)
3. Tertiary: `movement_id` (UUID lexicographic)

**Rationale:** Reproducible results for compliance reporting

### 2.6 E7.3 Boundary

**✅ E7.3 does:**
- Query movements by lot/serial
- Traverse upstream/downstream
- Detect cycles and broken chains
- Return warnings (not fabricate data)

**❌ E7.3 does NOT:**
- Execute recalls based on lineage
- Notify customers
- Quarantine affected inventory
- Create recall records

**Product responsibility:**
```typescript
// E7.3 provides lineage:
const lineageResult = E7.3.traceDownstream(tenantId, 'LOT-001');

if (lineageResult.isSuccess) {
  const affectedMovements = lineageResult.value;
  
  // Product orchestrates recall (NOT E7.3):
  await RecallProduct.initiateRecall({
    lotNumber: 'LOT-001',
    affectedMovements,
    reason: 'Contamination detected',
  });
}
```

---

## 3. E7.3 Capability 3: Compliance / Expiry Evaluation

### 3.1 Responsibility

**E7.3 provides:**
> Evaluate compliance and expiry status without triggering workflows

**Pattern:**
```
Traceability + Rules → E7.3 Evaluation → ComplianceResult
```

### 3.2 Operations

#### 3.2.1 `evaluateExpiry`

**Signature:**
```typescript
function evaluateExpiry(
  inventory: Inventory,
  referenceDate: Date = new Date()
): Result<ExpiryEvaluation>
```

**Input:**
- `inventory: Inventory` (E7.1 entity with expiry_date)
- `referenceDate: Date` (default: now)

**Output:**
```typescript
interface ExpiryEvaluation {
  status: 'VALID' | 'NEAR_EXPIRY' | 'EXPIRED';
  expiry_date: Date | null;
  days_until_expiry: number | null;
  evaluation_date: Date;
}
```

**Logic:**
- EXPIRED: expiry_date < referenceDate
- NEAR_EXPIRY: 0 < days_until_expiry ≤ threshold (default: 30 days)
- VALID: expiry_date ≥ referenceDate + threshold

**Boundary:**
> E7.3 evaluates status. E7.3 does NOT mutate inventory or trigger workflow.

#### 3.2.2 `evaluateCompliance`

**Signature:**
```typescript
function evaluateCompliance(
  traceability: TraceabilityRecord
): Result<ComplianceEvaluation>
```

**Input:**
- `traceability: TraceabilityRecord` (E7.1 entity)

**Output:**
```typescript
interface ComplianceEvaluation {
  status: ComplianceStatus; // E7.1 enum
  violations: ComplianceViolation[];
  evaluation_date: Date;
}

interface ComplianceViolation {
  code: string;
  message: string;
  severity: 'ERROR' | 'WARNING';
  field?: string;
}
```

**Checks:**
1. Recall status (RECALLED/DESTROYED → NON_COMPLIANT)
2. Expiry (expired → NON_COMPLIANT)
3. Missing required data (lot/serial for tracked items → WARNING)
4. Chain of custody completeness (gaps → WARNING)

**Boundary:**
> E7.3 evaluates compliance. E7.3 does NOT execute QA workflow or block operations.

#### 3.2.3 `findExpiringSoon`

**Signature:**
```typescript
function findExpiringSoon(
  tenantId: string,
  thresholdDays: number = 30,
  referenceDate: Date = new Date()
): Result<Inventory[]>
```

**Purpose:** Query inventory nearing expiry

**Returns:** Inventory with `expiry_date` within threshold

**Boundary:**
> E7.3 queries data. E7.3 does NOT send alerts or create tasks.

### 3.3 E7.3 Boundary

**✅ E7.3 does:**
- Evaluate expiry status (VALID/NEAR_EXPIRY/EXPIRED)
- Evaluate compliance status (COMPLIANT/NON_COMPLIANT)
- Return violations and warnings
- Query expiring inventory

**❌ E7.3 does NOT:**
- Auto-quarantine expired inventory
- Send expiry notifications
- Create disposal tasks
- Execute QA workflows
- Mutate inventory status based on time

**Product responsibility:**
```typescript
// E7.3 evaluates:
const expiryResult = E7.3.evaluateExpiry(inventory);

if (expiryResult.value.status === 'EXPIRED') {
  // Product decides action (NOT E7.3):
  await WarehouseProduct.quarantineInventory(inventory.id);
  await NotificationService.alertManager(inventory);
}
```

---

## 4. E7.3 Traceability Invariants

### 4.1 Core Invariants

1. **Custody event must reference valid movement**
   - Event MUST be generated from COMPLETED movement
   - Event tenant_id MUST match movement tenant_id

2. **Custody events are immutable**
   - Once recorded, events cannot be modified or deleted
   - Append-only pattern (E7.1 contract)

3. **Lineage must not fabricate data**
   - Missing movements reported as broken chain
   - No inference or reconstruction
   - Warnings returned, not errors

4. **Quantity/UOM consistency**
   - Event quantity MUST match source movement
   - UOM MUST match source movement
   - No silent conversions

5. **Tenant isolation**
   - Cross-tenant lineage forbidden
   - Cross-tenant events forbidden
   - Tenant boundary enforced at query level

6. **Lineage traversal is deterministic**
   - Same input → same output order
   - Chronological ordering enforced
   - Tie-breakers defined (movement_date → created_at → id)

7. **Broken chains are explicit**
   - Missing links return warning
   - Partial results provided
   - No silent failures

### 4.2 Negative-Path Invariants

**What MUST NOT happen:**

1. ❌ Custody event for PENDING/CANCELLED movement
2. ❌ Cross-tenant lineage traversal
3. ❌ Automatic state mutation based on expiry
4. ❌ Fabrication of missing movements
5. ❌ Silent failure on broken chain (must warn)
6. ❌ Non-deterministic lineage order
7. ❌ Workflow execution from E7.3 primitives

---

## 5. E7.3 Operations Summary

| Operation | Input | Output | Boundary |
|-----------|-------|--------|----------|
| `generateCustodyEvent` | Movement | CustodyEvent | No workflow |
| `traceUpstream` | lotNumber | Movement[] | No recall |
| `traceDownstream` | lotNumber | Movement[] | No notification |
| `getLotHistory` | lotNumber | Movement[] | Query only |
| `getSerialHistory` | serialNumber | Movement[] | Query only |
| `evaluateExpiry` | Inventory | ExpiryEvaluation | No mutation |
| `evaluateCompliance` | TraceabilityRecord | ComplianceEvaluation | No workflow |
| `findExpiringSoon` | thresholdDays | Inventory[] | No alerts |

---

## 6. Dependencies on E7.1/E7.2 (READ-ONLY)

### E7.3 READS (does not modify):

**From E7.1 (FROZEN):**
- ✅ `InventoryMovement` entity
- ✅ `TraceabilityRecord` entity
- ✅ `CustodyEvent` structure
- ✅ `Inventory.expiry_date` field
- ✅ `ComplianceStatus`, `RecallStatus` enums
- ✅ `Result<T>` pattern

**From E7.2 (FROZEN):**
- ✅ `MovementRepository.list()` interface
- ✅ Movement status validation pattern

### No Modifications Permitted

If E7.3 design requires E7.1/E7.2 changes:
1. **STOP** design
2. Document gap
3. Create ACR (Architecture Change Request)
4. Architecture review
5. ADR if approved
6. Re-baseline E7.1/E7.2
7. Re-run 439 tests

**No silent modifications.**

---

## 7. Gaps Identified

### 7.1 Movement → TraceabilityRecord Link

**Current State:**
- Movement has `lot_number`, `serial_number` fields
- TraceabilityRecord exists independently
- No explicit link between Movement and TraceabilityRecord

**Gap:**
> How to link Movement to TraceabilityRecord for lineage?

**Options:**

**Option A:** Query by lot/serial (current E7.1 capability)
```typescript
// ✅ E7.1 already supports this
movementRepository.list(tenantId, { lot_number: 'LOT-001' });
```

**Option B:** Add `traceability_id` to Movement (requires E7.1 modification)
```typescript
// ❌ Violates frozen boundary
interface InventoryMovement {
  traceability_id?: string; // NEW FIELD
}
```

**Decision:** Use Option A (query by lot/serial). No E7.1 modification required.

### 7.2 MovementRepository Query by Lot/Serial

**Current State:**
- `MovementRepository.list(filters)` exists (E7.2)
- `MovementFilters` includes `lot_number` and `serial_number`

**Verification Needed:**
- ✅ Check if `lot_number` filter implemented
- ✅ Check if `serial_number` filter implemented

**If NOT implemented:** This is E7.2 repository concern, not E7.3 traceability concern.

**Action:** Document as implementation requirement, not design gap.

### 7.3 TraceabilityRepository

**Current State:**
- E7.1 has `TraceabilityDomain` (business logic)
- E7.1 has `TraceabilityRecord` entity
- **Gap:** No `TraceabilityRepository` interface defined

**Question:** Does E7.3 need TraceabilityRepository?

**Answer:**
- If E7.3 only generates custody events → NO (Products persist)
- If E7.3 queries traceability records → YES (need repository)

**Decision:** E7.3 provides **domain operations**. Products provide persistence.

Pattern:
```typescript
// E7.3 domain operation:
const event = E7.3.generateCustodyEvent(movement);

// Product persistence:
await productRepository.recordCustodyEvent(event);
```

**No TraceabilityRepository in E7.3.** Products implement as needed.

---

## 8. Next Steps

1. ✅ **E7.3.1 Complete** — Capability inventory
2. ✅ **E7.3.2 Complete** — Boundary definition
3. ⏳ **E7.3.3 Current** — Traceability model (this document)
4. ⏳ **E7.3.4 Next** — Generic Rule Model
5. ⏳ **E7.3.5** — Invariants + negative-path criteria
6. ⏳ **E7.3.6** — ADR + Design Lock

**No code yet.**

---

## 9. E7.3.3 Gate Checklist

Before proceeding to E7.3.4, verify:

- [x] Custody event generation defined (concrete operation)
- [x] Lineage query operations defined (upstream/downstream/history)
- [x] Compliance/expiry evaluation defined (no workflow trigger)
- [x] Traceability invariants documented (7 core + 7 negative)
- [x] Traversal rules defined (cycles, depth, broken chains)
- [x] Deterministic ordering specified
- [x] Tenant isolation enforced
- [x] E7.1/E7.2 dependencies read-only (no modifications)
- [x] Gaps identified (movement link, repository)
- [x] Boundary clear (E7.3 provides data, Products execute workflows)

---

**END OF E7.3 TRACEABILITY DOMAIN MODEL**
