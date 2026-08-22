# E6 REQUIREMENTS INVENTORY — WAREHOUSE MANAGEMENT

**Document Type:** Requirements Specification  
**Status:** 🔒 LOCKED (pending review)  
**Date:** 2026-08-21  
**Vertical:** Warehouse Management  
**Experiment:** E6 (Second Vertical Validation)

---

## 📋 REQUIREMENTS OVERVIEW

### Scope

**15 functional requirements** for Warehouse Management vertical, structured to match E3 (Freight Audit) for direct experimental comparison.

### Mapping to E3 Structure

| Category | E3 (Freight Audit) | E6 (Warehouse Management) |
|----------|-------------------|---------------------------|
| **CRUD** | R1: Create Invoice | R1: Receive Inventory |
| **Validation** | R2: Location validation | R2: SKU validation |
| | R3: Accessorial validation | R3: Location hierarchy validation |
| | R4: Unique constraint | R4: Unique constraint |
| | R5: Math validation | R5: Quantity reconciliation |
| **Workflow** | R6: Submit for approval | R6: Submit for putaway |
| | R7: Approve | R7: Complete putaway ✅ |
| | R8: Reject | R8: Hold/quarantine ✅ |
| | R9: State invariants | R9: State invariants ✅ |
| **Query** | R10: List with filters | R10: List inventory with filters ✅ |
| | R11: Get by ID | R11: Get by ID |
| **Metrics** | R12: Count | R12: Count |
| | R13: Bulk | R13: Bulk movement |
| | R14: Aggregation | R14: Value aggregation |
| **Constraints** | R15: Uniqueness | R15: Bin capacity |

---

## 🎯 DOMAIN CONTEXT

### Warehouse Management Core Entities

**Primary:**
- **Inventory Receipt** — incoming goods from supplier/transfer
- **SKU (Stock Keeping Unit)** — product definition
- **Location** — warehouse, zone, aisle, bin hierarchy
- **Movement** — inventory state transitions (receive → putaway → pick → ship)

**Supporting:**
- **Vendor** — supplier information
- **Purchase Order** — expected receipts
- **Bin** — physical storage location with capacity limits

### Core Workflow

```
Receive → Inspect → Putaway → Available → Pick → Stage → Ship
   ↓         ↓         ↓         ↓        ↓      ↓       ↓
Receipt   QC Hold  Movement  On-Hand  Allocation  Shipped
```

### Tenant Context

Each tenant represents a separate warehouse operation:
- Isolated inventory
- Separate location hierarchies
- Independent movements
- RLS-enforced boundaries

---

## 📝 REQUIREMENTS SPECIFICATION

### R1: Receive Inventory (CRUD - Create)

**Description:**
Create a new inventory receipt record with SKU, quantity, vendor, and expected vs actual quantity reconciliation.

**Acceptance Criteria:**

**AC1.1: Basic Receipt Creation**
```typescript
Given: authenticated user with tenant context
When: POST /api/warehouse/receipts
Body: {
  tenant_id: UUID,
  po_number: string,
  vendor_id: UUID,
  line_items: [
    {
      sku_id: UUID,
      expected_quantity: number,
      actual_quantity: number,
      uom: string  // "EA", "CS", "PLT"
    }
  ],
  received_date: ISO8601,
  receiver_notes: string?
}
Then: 
- Receipt created with status "pending_putaway"
- line_items stored with discrepancies calculated
- timestamp recorded
- RLS: only accessible to tenant
```

**AC1.2: Audit Trail**
```
Then:
- Created event logged to audit_logs
- creator_user_id captured
- receipt_id generated (UUID)
```

**AC1.3: Validation**
```
Validate:
- tenant_id exists and matches session
- vendor_id exists in tenant scope
- sku_id exists in tenant scope
- quantities > 0
- received_date ≤ current_date
```

**AC1.4: Discrepancy Calculation**
```
For each line_item:
  discrepancy = actual_quantity - expected_quantity
  discrepancy_status = "over" | "short" | "match"
```

**Expected Complexity:** 
- Similar to E3 R1 (Create Invoice)
- Domain contract: Receipt vs Invoice schema
- Platform reuse: CRUD, RLS, audit

---

### R2: SKU Validation (Validation)

**Description:**
Validate that SKU exists in tenant scope and is not discontinued before accepting receipt.

**Acceptance Criteria:**

**AC2.1: SKU Existence Check**
```typescript
Given: receipt with line_items containing sku_id
When: receipt submitted
Then:
- Query: SELECT * FROM skus WHERE id = sku_id AND tenant_id = session.tenant_id
- If not found → reject with "SKU not found in tenant inventory"
```

**AC2.2: SKU Status Check**
```
Then:
- Verify sku.status != "discontinued"
- If discontinued → reject with "Cannot receive discontinued SKU"
```

**AC2.3: Error Response**
```json
{
  "error": "validation_failed",
  "field": "line_items[0].sku_id",
  "message": "SKU XXX-123 not found in tenant inventory"
}
```

**Expected Complexity:**
- Similar to E3 R2 (Location validation)
- **Contract friction expected:** SKU schema vs platform entity patterns
- Platform reuse: Validation patterns, tenant scope queries

**E3 Lesson:** R2 had field naming mismatch bug. E6 may discover similar schema contract friction.

---

### R3: Location Hierarchy Validation (Validation)

**Description:**
Validate that target putaway location exists and follows warehouse → zone → aisle → bin hierarchy.

**Acceptance Criteria:**

**AC3.1: Location Existence**
```typescript
Given: putaway request with target_bin_id
When: putaway initiated
Then:
- Query: SELECT * FROM bins WHERE id = target_bin_id AND tenant_id = session.tenant_id
- If not found → reject
```

**AC3.2: Hierarchy Validation**
```
Then:
- Verify bin.aisle_id → aisle.zone_id → zone.warehouse_id chain exists
- All IDs must belong to same tenant
```

**AC3.3: Location Status**
```
Then:
- Verify bin.status = "active" (not "damaged", "reserved", "inactive")
```

**Expected Complexity:**
- Similar to E3 R3 (Accessorial validation)
- **Contract friction expected:** Hierarchy schema, type relationships
- Platform reuse: Validation, foreign key patterns

**E3 Lesson:** R3 had type hierarchy mismatch bug requiring migration. E6 may discover similar pattern.

---

### R4: Receipt Unique Constraint (Validation)

**Description:**
Ensure no duplicate receipts for same PO number + vendor + received_date within tenant.

**Acceptance Criteria:**

**AC4.1: Uniqueness Check**
```sql
CREATE UNIQUE INDEX idx_receipts_unique
ON receipts (tenant_id, po_number, vendor_id, received_date)
WHERE deleted_at IS NULL;
```

**AC4.2: Violation Handling**
```
When: duplicate receipt attempted
Then:
- Database rejects with unique constraint violation
- API returns 409 Conflict
- Error message: "Receipt for PO {po_number} from {vendor} on {date} already exists"
```

**Expected Complexity:**
- Similar to E3 R4 (Invoice uniqueness)
- Platform reuse: Constraint patterns, soft delete handling
- Clean pass expected (E3 R4 was clean)

---

### R5: Quantity Reconciliation Math (Validation)

**Description:**
Calculate and validate quantity discrepancies: actual vs expected, with tolerance thresholds.

**Acceptance Criteria:**

**AC5.1: Discrepancy Calculation**
```typescript
For each line_item:
  discrepancy = actual_quantity - expected_quantity
  discrepancy_percentage = (discrepancy / expected_quantity) * 100
  
  status = discrepancy_percentage match {
    0 → "exact_match"
    > 0 && ≤ 2% → "acceptable_over"
    > 2% → "significant_over"
    < 0 && ≥ -2% → "acceptable_short"
    < -2% → "significant_short"
  }
```

**AC5.2: Aggregate Receipt Status**
```
receipt.overall_status = line_items.any(significant_*) ? "requires_review" : "acceptable"
```

**AC5.3: Math Precision**
```
- All calculations use DECIMAL (not FLOAT)
- Percentages rounded to 2 decimal places
- Zero-division handling (expected_quantity = 0 → manual review)
```

**Expected Complexity:**
- Similar to E3 R5 (Math validation)
- Platform reuse: Financial math patterns, decimal precision
- Clean pass expected (E3 R5 was clean)

---

### R6: Submit for Putaway (Workflow)

**Description:**
Transition receipt from "pending_putaway" to "putaway_in_progress", triggering warehouse team notification.

**Acceptance Criteria:**

**AC6.1: State Transition**
```typescript
Given: receipt with status = "pending_putaway"
When: POST /api/warehouse/receipts/:id/submit-putaway
Then:
- Update status → "putaway_in_progress"
- Set submitted_at = NOW()
- Set submitted_by = session.user_id
```

**AC6.2: Preconditions**
```
Validate:
- Current status = "pending_putaway"
- All line_items have target_bin_id assigned
- No line_items in "hold" status
```

**AC6.3: Audit Event**
```
Log event:
  type: "receipt_submitted_for_putaway"
  actor: user_id
  receipt_id: UUID
  timestamp: NOW()
```

**Expected Complexity:**
- Similar to E3 R6 (Submit for approval)
- Platform reuse: Workflow state machine, audit events
- Clean pass expected (E3 R6 was clean)

---

### R7: Complete Putaway (Workflow)

**Description:**
Mark receipt as fully put away, updating inventory on-hand quantities and closing the receipt workflow.

**Acceptance Criteria:**

**AC7.1: State Transition**
```typescript
Given: receipt with status = "putaway_in_progress"
When: POST /api/warehouse/receipts/:id/complete-putaway
Then:
- Update status → "completed"
- Set completed_at = NOW()
- Set completed_by = session.user_id
```

**AC7.2: Inventory Update**
```
For each line_item:
  UPDATE inventory_on_hand
  SET quantity = quantity + line_item.actual_quantity
  WHERE tenant_id = receipt.tenant_id
    AND sku_id = line_item.sku_id
    AND bin_id = line_item.target_bin_id
```

**AC7.3: Audit Event**
```
Log event:
  type: "receipt_completed"
  actor: user_id
  receipt_id: UUID
  movements: [{sku, bin, qty}]
```

**AC7.4: Idempotency**
```
- If already completed → return 200 OK (no double update)
- Use completed_at != NULL as guard
```

**Expected Complexity:**
- Similar to E3 R7 (Approve invoice)
- Platform reuse: Workflow completion, inventory transaction patterns
- Clean pass expected (E3 R7 was clean)

---

### R8: Hold/Quarantine Receipt (Workflow)

**Description:**
Place receipt or specific line items on hold for quality issues, triggering review process.

**Acceptance Criteria:**

**AC8.1: State Transition**
```typescript
Given: receipt with status = "pending_putaway" | "putaway_in_progress"
When: POST /api/warehouse/receipts/:id/hold
Body: {
  line_item_ids: UUID[],  // optional, specific items
  hold_reason: "quality_issue" | "quantity_discrepancy" | "damaged_goods",
  notes: string
}
Then:
- If line_item_ids provided → mark those items as "on_hold"
- If not provided → mark entire receipt status = "on_hold"
- Set held_at = NOW()
- Set held_by = session.user_id
```

**AC8.2: Inventory Impact**
```
- On-hold items do NOT update inventory_on_hand
- Remain in "quarantine" state until released
```

**AC8.3: Audit Event**
```
Log event:
  type: "receipt_held"
  actor: user_id
  reason: hold_reason
  scope: "full_receipt" | "line_items"
```

**AC8.4: Reversal**
```
POST /api/warehouse/receipts/:id/release-hold
- Transition back to previous state
- Log release event
```

**Expected Complexity:**
- Similar to E3 R8 (Reject invoice)
- Platform reuse: State machine reversals, conditional updates
- Clean pass expected (E3 R8 was clean)

---

### R9: Workflow State Invariants (Workflow)

**Description:**
Enforce state machine invariants: no invalid transitions, audit trail integrity, idempotency.

**Acceptance Criteria:**

**AC9.1: Valid Transitions Only**
```
Allowed transitions:
pending_putaway → putaway_in_progress
pending_putaway → on_hold
putaway_in_progress → completed
putaway_in_progress → on_hold
on_hold → pending_putaway (released)

Invalid transitions:
completed → * (terminal state)
* → pending_putaway (except from on_hold)
```

**AC9.2: Audit Trail Completeness**
```
For every state transition:
- Event logged to audit_logs
- actor_user_id captured
- timestamp captured
- No missing transitions in audit trail
```

**AC9.3: Idempotency**
```
- Completing already-completed receipt → 200 OK (no error)
- Submitting already-submitted receipt → 200 OK
- No duplicate inventory updates
```

**AC9.4: Concurrency**
```
- Use optimistic locking (version or updated_at check)
- Prevent race conditions on state transitions
```

**Expected Complexity:**
- Similar to E3 R9 (State invariants)
- Platform reuse: State machine validation, audit patterns
- Clean pass expected (E3 R9 was clean)

---

### R10: List Inventory with Filters (Query)

**Description:**
Query inventory receipts with filters (status, date range, vendor, SKU) with pagination and tenant isolation.

**Acceptance Criteria:**

**AC10.1: Basic List Query**
```typescript
GET /api/warehouse/receipts?tenant_id={uuid}&page=1&limit=20
Then:
- Return paginated list of receipts
- Include: id, po_number, vendor, received_date, status, line_item_count
- RLS: only return receipts for session tenant
```

**AC10.2: Status Filter**
```
GET /api/warehouse/receipts?status=pending_putaway
Then: return only receipts with matching status
```

**AC10.3: Date Range Filter**
```
GET /api/warehouse/receipts?from=2026-01-01&to=2026-12-31
Then: return receipts where received_date BETWEEN from AND to
```

**AC10.4: Vendor Filter**
```
GET /api/warehouse/receipts?vendor_id={uuid}
Then: return receipts for specified vendor
```

**AC10.5: RLS Enforcement**
```
- All queries automatically filtered by tenant_id = session.tenant_id
- No cross-tenant data leakage
- Test: cannot see other tenant receipts
```

**Expected Complexity:**
- Similar to E3 R10 (List invoices)
- Platform reuse: Query patterns, RLS, pagination
- Clean pass expected (E3 R10 was clean)

---

### R11: Get Receipt by ID (Query)

**Description:**
Retrieve single receipt by ID with full line item details, tenant-scoped.

**Acceptance Criteria:**

**AC11.1: Basic Get**
```typescript
GET /api/warehouse/receipts/:id
Then:
- Return receipt with all fields
- Include line_items array with full details
- Include calculated discrepancies
```

**AC11.2: RLS Enforcement**
```
Given: receipt belongs to tenant A
When: user from tenant B requests receipt
Then: 404 Not Found (not 403, to prevent ID enumeration)
```

**AC11.3: Not Found Handling**
```
Given: receipt ID does not exist
Then: 404 Not Found with message "Receipt not found"
```

**Expected Complexity:**
- Similar to E3 R11 (Get invoice by ID)
- Platform reuse: Get by ID patterns, RLS
- Clean pass expected (E3 R11 was clean)

---

### R12: Count Receipts (Metrics)

**Description:**
Return count of receipts grouped by status for dashboard metrics.

**Acceptance Criteria:**

**AC12.1: Status Count**
```typescript
GET /api/warehouse/receipts/metrics/count-by-status
Then:
{
  "pending_putaway": 15,
  "putaway_in_progress": 8,
  "completed": 142,
  "on_hold": 3
}
```

**AC12.2: Tenant Scope**
```
- Count only receipts for session tenant
- RLS enforced
```

**AC12.3: Performance**
```
- Use COUNT aggregate (not fetch-and-count)
- Query should be <100ms for 10k receipts
```

**Expected Complexity:**
- Similar to E3 R12 (Count invoices)
- Platform reuse: Aggregation patterns, RLS
- Clean pass expected (E3 R12 was clean)

---

### R13: Bulk Inventory Movement (Metrics)

**Description:**
Record and query bulk inventory movements (e.g., cycle count adjustments, transfers).

**Acceptance Criteria:**

**AC13.1: Bulk Movement Creation**
```typescript
POST /api/warehouse/movements/bulk
Body: {
  tenant_id: UUID,
  movement_type: "cycle_count_adjustment" | "inter_bin_transfer",
  movements: [
    {
      sku_id: UUID,
      from_bin_id: UUID?,  // null for adjustments
      to_bin_id: UUID?,
      quantity: number,
      reason: string
    }
  ],
  approved_by: UUID
}
Then:
- Create movement records
- Update inventory_on_hand atomically
- Log audit events
```

**AC13.2: Atomic Transaction**
```
- All movements succeed or all fail (transaction boundary)
- No partial inventory updates
```

**AC13.3: Audit Trail**
```
- Each movement logged separately
- Bulk operation linked by batch_id
```

**Expected Complexity:**
- Similar to E3 R13 (Bulk operations)
- Platform reuse: Bulk patterns, transactions, audit
- Clean pass expected (E3 R13 was clean)

---

### R14: Inventory Value Aggregation (Metrics)

**Description:**
Calculate total inventory value by SKU, bin, or warehouse using unit cost and on-hand quantity.

**Acceptance Criteria:**

**AC14.1: Value by SKU**
```typescript
GET /api/warehouse/inventory/metrics/value-by-sku
Then:
{
  "sku_id": "uuid",
  "sku_code": "ABC-123",
  "on_hand_quantity": 500,
  "unit_cost": 12.50,
  "total_value": 6250.00
}
```

**AC14.2: Aggregation Query**
```sql
SELECT 
  sku_id,
  SUM(quantity) as on_hand_quantity,
  skus.unit_cost,
  SUM(quantity * skus.unit_cost) as total_value
FROM inventory_on_hand
JOIN skus ON skus.id = inventory_on_hand.sku_id
WHERE inventory_on_hand.tenant_id = session.tenant_id
GROUP BY sku_id, skus.unit_cost
```

**AC14.3: Precision**
```
- Monetary values use DECIMAL(12,2)
- No rounding errors in aggregation
```

**Expected Complexity:**
- Similar to E3 R14 (Aggregation)
- Platform reuse: Aggregation, financial math, RLS
- Clean pass expected (E3 R14 was clean)

---

### R15: Bin Capacity Constraint (Constraints)

**Description:**
Enforce bin capacity limits: cannot putaway more inventory than bin's max_capacity.

**Acceptance Criteria:**

**AC15.1: Capacity Check**
```typescript
Given: bin with max_capacity = 1000 units
When: putaway attempted with quantity that would exceed capacity
Then: reject with error "Bin capacity exceeded"
```

**AC15.2: Capacity Calculation**
```sql
SELECT SUM(quantity) as current_quantity
FROM inventory_on_hand
WHERE bin_id = target_bin_id AND tenant_id = session.tenant_id

IF (current_quantity + putaway_quantity) > bin.max_capacity
THEN reject
```

**AC15.3: Database Constraint**
```sql
CREATE OR REPLACE FUNCTION check_bin_capacity()
RETURNS TRIGGER AS $$
BEGIN
  -- trigger logic to enforce capacity on INSERT/UPDATE
END;
$$ LANGUAGE plpgsql;
```

**Expected Complexity:**
- Similar to E3 R15 (Uniqueness constraint)
- Platform reuse: Constraint patterns, triggers
- Clean pass expected (E3 R15 was clean)

---

## 📊 REQUIREMENTS SUMMARY

### Complexity Distribution

| Category | Count | Expected Platform Reuse | Expected Friction |
|----------|-------|------------------------|-------------------|
| CRUD | 1 | High (90%) | Low |
| Validation | 4 | Medium (60%) | **Medium-High** (R2-R3) |
| Workflow | 4 | High (85%) | Low |
| Query | 2 | High (95%) | Low |
| Metrics | 3 | High (90%) | Low |
| Constraints | 1 | High (90%) | Low |

### Expected Bug Distribution (Based on E3)

**High Risk (Contract Friction):**
- R2: SKU Validation — schema contract mismatch likely
- R3: Location Hierarchy — type/hierarchy contract mismatch likely

**Low Risk (Platform Patterns):**
- R1, R4-R15 — platform primitives well-tested in E3

### Comparison to E3

| Metric | E3 (Freight Audit) | E6 (Warehouse) |
|--------|-------------------|----------------|
| Requirements | 15 | 15 |
| CRUD | 1 | 1 |
| Validation | 4 | 4 |
| Workflow | 4 | 4 |
| Query | 2 | 2 |
| Metrics | 3 | 3 |
| Constraints | 1 | 1 |
| Expected bugs | 2 (R2, R3) | 2-3 (R2, R3) |
| Clean rate | 86.7% | Target: 80-90% |

---

## 🔒 ACCEPTANCE GATES

### Definition of Done

**Each requirement R1-R15 is considered VERIFIED when:**

1. ✅ Implementation complete (code committed)
2. ✅ Test script written and executed
3. ✅ All acceptance criteria PASS
4. ✅ RLS tenant isolation verified
5. ✅ Audit trail verified (where applicable)
6. ✅ Bugs reproduced, classified, reworked, retested
7. ✅ Testing effort timestamped
8. ✅ Rework effort timestamped (if any)

### Overall E6 Verification Complete When

✅ All 15 requirements VERIFIED  
✅ H1/H2/H3 measurements collected  
✅ C₆, T₆, LOC classified  
✅ Bug distribution analyzed  
✅ Contract friction patterns documented  

---

## 📋 NEXT STEPS

1. ✅ E6_DEFINITION.md
2. ✅ E6_REQUIREMENTS_INVENTORY.md (this document)
3. ⏳ E6_BASELINE.md (establish C₁, T₁ for Warehouse baseline)
4. ⏳ E6_PROTOCOL.md (lock measurement protocol, LOC classification rules)
5. ⏳ LOCK E6 Definition Package (commit E6 definition files)
6. ⏳ Implementation Phase
7. ⏳ Verification Phase (R1-R15)
8. ⏳ Analysis & Assessment

---

**Document Owner:** Kiro AI  
**Status:** 🔒 LOCKED (pending baseline + protocol)  
**Date:** 2026-08-21

---

**END OF E6 REQUIREMENTS INVENTORY**
