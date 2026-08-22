# Logistics OS ↔ Finance OS Integration Contract

**Date:** 2026-08-22  
**Status:** Design (Locked Before Implementation)  
**Purpose:** Define OS-to-OS boundary between Logistics and Finance

---

## Strategic Context

> **"Logistics OS emits business events. Finance OS interprets financial meaning."**

This document defines the integration contract between Logistics OS and Finance OS, following the proven pattern from Healthcare OS → Finance OS integration.

**Critical Principle:** Logistics OS does NOT perform accounting. Finance OS is authoritative for all financial semantics.

---

## Architecture Overview

```
                    BELLA PLATFORM
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
 Healthcare OS     Logistics OS      Finance OS
        │                 │                 ▲
        │                 │                 │
        └────────┐        │        ┌────────┘
                 ▼        ▼        │
            FinanceEventEnvelope ◄─┘
                      │
                      ▼
              Integration Hub
            ┌──────────────────┐
            │ Publisher        │
            │ Outbox Pattern   │
            │ Idempotency      │
            │ Retry Logic      │
            └────────┬─────────┘
                     ▼
               Finance OS
                     │
        ┌────────────┴────────────┐
        │                         │
  Semantic Resolver       Intent Generator
        │                         │
        └────────────┬────────────┘
                     ▼
              COA Resolver
                     │
                     ▼
            Finance Kernel (F1-F4)
```

---

## Boundary Definition

### Logistics OS Responsibilities

✅ **Physical Operations:**
- Goods received/issued
- Inventory movements
- Location tracking
- Operational state management
- Traceability/chain of custody

✅ **Business Event Publishing:**
- Emit events when operations complete
- Include business context (what happened)
- Include financial hints (quantity, unit cost)
- Ensure idempotency

❌ **What Logistics OS Does NOT Do:**
- Calculate COGS (Finance OS responsibility)
- Create journal entries (Finance OS responsibility)
- Post to GL accounts (Finance OS responsibility)
- Apply accounting policies (Finance OS responsibility)
- Determine debit/credit (Finance OS responsibility)

---

### Finance OS Responsibilities

✅ **Financial Interpretation:**
- Semantic resolution (business event → financial meaning)
- Intent generation (what to recognize)
- COA resolution (intent → GL account)
- Policy application (accounting standards, regulations)
- Valuation (FIFO, LIFO, weighted average)

✅ **Accounting Operations:**
- Journal entry creation
- GL account posting
- Financial statement generation
- Reconciliation
- Audit trail

❌ **What Finance OS Does NOT Do:**
- Track physical inventory (Logistics OS responsibility)
- Manage warehouse operations (Logistics OS responsibility)
- Enforce business rules for receiving/shipping (Logistics OS responsibility)

---

## Integration Contract

### 1. Event Envelope Structure

**Standard Envelope:** `FinanceEventEnvelope` (proven pattern from Healthcare OS)

```typescript
interface FinanceEventEnvelope {
  // ========== Identity ==========
  event_id: string;              // UUID
  event_type: string;            // e.g., "INVENTORY_RECEIVED"
  idempotency_key: string;       // Prevent duplicate processing
  
  // ========== Temporal ==========
  occurred_at: string;           // ISO 8601
  created_at: string;            // ISO 8601
  
  // ========== Tenant (P0 Gate) ==========
  tenant_id: string;             // MANDATORY
  org_unit_id?: string;
  
  // ========== Source ==========
  source_system: string;         // "LOGISTICS_OS"
  source_version: string;        // Version for compatibility
  correlation_id: string;        // Distributed tracing
  
  // ========== Financial ==========
  amount: string;                // Decimal as string
  currency: string;              // ISO 4217 (VND, USD, etc.)
  
  // ========== Business Context ==========
  business_context: BusinessContext;
  
  // ========== References ==========
  business_references: BusinessReference[];
  
  // ========== Metadata ==========
  metadata?: Record<string, unknown>;
}
```

---

### 2. Business Context Extension

**Add Logistics-specific context to existing `BusinessContext`:**

```typescript
interface BusinessContext {
  // ========== Existing (Healthcare, etc.) ==========
  patient?: PatientContext;
  encounter?: EncounterContext;
  service?: ServiceContext;
  billing?: BillingContext;
  pharmacy?: PharmacyContext;
  procurement?: ProcurementContext;
  
  // ========== NEW: Logistics ==========
  logistics?: LogisticsContext;
  inventory?: InventoryContext;
  shipment?: ShipmentContext;
  warehouse?: WarehouseContext;
}
```

---

### 3. Logistics Context Definitions

```typescript
/**
 * Logistics Context
 * 
 * High-level logistics operation context
 */
interface LogisticsContext {
  operation_type: 'RECEIVING' | 'SHIPPING' | 'TRANSFER' | 'ADJUSTMENT' | 'FULFILLMENT';
  facility_id?: string;
  facility_code?: string;
  location_id?: string;
  location_code?: string;
}

/**
 * Inventory Context
 * 
 * Item and quantity details
 */
interface InventoryContext {
  item_id: string;
  item_code: string;              // SKU, UPC, etc.
  item_name: string;
  quantity: number;
  unit_of_measure: string;        // EA, CS, KG, etc.
  
  // Traceability
  lot_number?: string;
  serial_numbers?: string[];
  expiry_date?: string;
  
  // Costing hints (Finance OS is authoritative)
  unit_cost?: number;             // Hint only, Finance OS may override
  valuation_method?: 'FIFO' | 'LIFO' | 'WEIGHTED_AVERAGE' | 'STANDARD';
  
  // Location tracking
  from_location_id?: string;
  to_location_id?: string;
  current_location_id?: string;
}

/**
 * Shipment Context
 * 
 * Shipping/delivery details
 */
interface ShipmentContext {
  shipment_id: string;
  shipment_number: string;
  shipment_date: string;
  carrier_id?: string;
  carrier_name?: string;
  tracking_number?: string;
  destination?: {
    address: string;
    city: string;
    country: string;
  };
}

/**
 * Warehouse Context
 * 
 * Warehouse-specific operation details
 */
interface WarehouseContext {
  receipt_id?: string;
  receipt_number?: string;
  receipt_type?: 'PURCHASE' | 'RETURN' | 'TRANSFER' | 'PRODUCTION';
  vendor_id?: string;
  vendor_name?: string;
  purchase_order_id?: string;
}
```

---

### 4. Logistics Financial Event Types

```typescript
/**
 * Logistics Finance Event Types
 * 
 * Events that trigger financial accounting
 */
type LogisticsFinanceEventType =
  // ========== Inventory Inbound ==========
  | 'INVENTORY_RECEIVED'           // Goods received (increase inventory asset)
  | 'INVENTORY_RETURN_RECEIVED'    // Customer return received
  
  // ========== Inventory Outbound ==========
  | 'INVENTORY_ISSUED'              // Goods issued/sold (recognize COGS)
  | 'INVENTORY_SHIPPED'             // Order shipped (revenue recognition trigger)
  | 'INVENTORY_CONSUMED'            // Consumed in production/operations
  
  // ========== Inventory Adjustments ==========
  | 'INVENTORY_ADJUSTED'            // Physical count adjustment (variance)
  | 'INVENTORY_DAMAGED'             // Damage/shrinkage (expense)
  | 'INVENTORY_OBSOLETE'            // Obsolescence (write-off)
  
  // ========== Procurement ==========
  | 'SUPPLIER_GOODS_RECEIVED'       // GRN posted (accrued liability)
  | 'SUPPLIER_INVOICE_MATCHED'      // 3-way match complete
  
  // ========== Fulfillment ==========
  | 'ORDER_FULFILLED'                // Customer order fulfilled
  | 'ORDER_CANCELLED'                // Order cancellation
  
  // ========== Transportation ==========
  | 'FREIGHT_COST_INCURRED'         // Transportation expense
  | 'DELIVERY_COMPLETED'            // Delivery confirmed
  
  // ========== Returns ==========
  | 'RETURN_PROCESSED'              // Return processed (credit customer)
  | 'RETURN_RESTOCKED'              // Return restocked (inventory back)
  
  // ========== Logistics Services ==========
  | 'WAREHOUSING_FEE_INCURRED'      // Storage/handling fees
  | 'CUSTOMS_DUTY_PAID'             // Import duties/taxes
;
```

---

### 5. Responsibility Matrix

| Responsibility | Logistics OS | Finance OS |
|----------------|--------------|------------|
| **Physical Operations** | | |
| Goods received | ✅ | ❌ |
| Inventory movement | ✅ | ❌ |
| Location tracking | ✅ | ❌ |
| Operational state | ✅ | ❌ |
| Traceability | ✅ | ❌ |
| **Business Events** | | |
| Publish events | ✅ | ❌ |
| Business context | ✅ | ❌ |
| Idempotency key | ✅ | ❌ |
| **Financial Interpretation** | | |
| Semantic resolution | ❌ | ✅ |
| Intent generation | ❌ | ✅ |
| Revenue recognition | ❌ | ✅ |
| COGS calculation | ❌ | ✅ |
| Inventory valuation | ❌ | ✅ |
| **Accounting** | | |
| COA resolution | ❌ | ✅ |
| Debit/Credit | ❌ | ✅ |
| Journal entries | ❌ | ✅ |
| GL posting | ❌ | ✅ |
| Financial statements | ❌ | ✅ |
| **Policy & Compliance** | | |
| Accounting policy | ❌ | ✅ |
| Tax compliance | ❌ | ✅ |
| Audit requirements | ✅ (operational) | ✅ (financial) |

---

## Integration Patterns

### 1. Event Publishing (Logistics OS)

```typescript
// Logistics OS publishes event after operation completes
async function completeGoodsReceipt(receiptId: string) {
  // 1. Complete business operation
  const receipt = await receiptService.complete(receiptId);
  
  // 2. Publish financial event
  await financeEventPublisher.publish({
    event_type: 'INVENTORY_RECEIVED',
    amount: (receipt.quantity * receipt.unit_cost).toString(),
    currency: 'VND',
    business_context: {
      logistics: {
        operation_type: 'RECEIVING',
        facility_id: receipt.warehouse_id,
        location_id: receipt.location_id,
      },
      inventory: {
        item_id: receipt.item_id,
        item_code: receipt.sku_code,
        item_name: receipt.item_name,
        quantity: receipt.quantity,
        unit_of_measure: 'EA',
        unit_cost: receipt.unit_cost,
        valuation_method: 'FIFO',
      },
      warehouse: {
        receipt_id: receipt.id,
        receipt_number: receipt.receipt_number,
        receipt_type: 'PURCHASE',
        vendor_id: receipt.vendor_id,
        purchase_order_id: receipt.po_id,
      },
    },
    business_references: [
      { entity_type: 'receipt', entity_id: receipt.id },
      { entity_type: 'item', entity_id: receipt.item_id },
      { entity_type: 'vendor', entity_id: receipt.vendor_id },
    ],
  });
}
```

---

### 2. Event Processing (Finance OS)

```typescript
// Finance OS processes event (existing handler)
async function handleFinanceEvent(envelope: FinanceEventEnvelope) {
  // 1. Idempotency check
  if (await idempotencyStore.exists(envelope.idempotency_key)) {
    return 'ALREADY_PROCESSED';
  }
  
  // 2. Semantic resolution
  const semantic = await semanticResolver.resolve(envelope);
  // Result: "INVENTORY_ASSET_INCREASE"
  
  // 3. Intent generation
  const intents = await intentGenerator.generate(semantic, envelope);
  // Result: [
  //   { intent_type: 'RECOGNIZE_INVENTORY_ASSET', debit: amount },
  //   { intent_type: 'RECOGNIZE_ACCRUED_LIABILITY', credit: amount }
  // ]
  
  // 4. COA resolution
  const accounts = await coaResolver.resolve(tenant_id, intents);
  // Result: [
  //   { intent: 'RECOGNIZE_INVENTORY_ASSET', account: '1510' },
  //   { intent: 'RECOGNIZE_ACCRUED_LIABILITY', account: '2110' }
  // ]
  
  // 5. Create posting instruction
  const posting = {
    entries: [
      { account: '1510', debit: amount, description: 'Inventory received' },
      { account: '2110', credit: amount, description: 'Accrued liability' },
    ],
    source_event_id: envelope.event_id,
  };
  
  // 6. Persist to Finance Kernel
  const transaction = await financeKernel.persist(posting);
  
  // 7. Store idempotency
  await idempotencyStore.store(envelope.idempotency_key, transaction.id);
  
  return 'CREATED';
}
```

---

### 3. Integration Hub Patterns

**Outbox Pattern:**
- Logistics OS writes to outbox table (same transaction as business operation)
- Background worker publishes from outbox to Finance OS
- Ensures reliability even if Finance OS is down

**Idempotency:**
- Every event has unique `idempotency_key`
- Finance OS checks key before processing
- Prevents duplicate accounting entries

**Retry Logic:**
- Exponential backoff on failure
- Max retries configurable
- Dead letter queue for permanent failures

**Correlation:**
- `correlation_id` links related events
- Enables distributed tracing
- Supports reconciliation

---

## Event Catalog

### INVENTORY_RECEIVED

**When:** Goods received into warehouse  
**Financial Impact:** Increase inventory asset, recognize liability

```typescript
{
  event_type: 'INVENTORY_RECEIVED',
  amount: '1000000',  // VND
  currency: 'VND',
  business_context: {
    logistics: { operation_type: 'RECEIVING', ... },
    inventory: { item_id, quantity, unit_cost, ... },
    warehouse: { receipt_id, vendor_id, po_id, ... },
  },
}
```

**Finance OS Actions:**
- Dr. Inventory Asset
- Cr. Accounts Payable (or Accrued Liability)

---

### INVENTORY_ISSUED

**When:** Goods issued/sold  
**Financial Impact:** Recognize COGS, decrease inventory asset

```typescript
{
  event_type: 'INVENTORY_ISSUED',
  amount: '800000',  // VND (cost)
  currency: 'VND',
  business_context: {
    logistics: { operation_type: 'SHIPPING', ... },
    inventory: { item_id, quantity, unit_cost, ... },
    shipment: { shipment_id, customer_id, order_id, ... },
  },
}
```

**Finance OS Actions:**
- Dr. Cost of Goods Sold (COGS)
- Cr. Inventory Asset

---

### INVENTORY_ADJUSTED

**When:** Physical count adjustment  
**Financial Impact:** Adjust inventory value, recognize variance

```typescript
{
  event_type: 'INVENTORY_ADJUSTED',
  amount: '50000',  // VND (variance)
  currency: 'VND',
  business_context: {
    logistics: { operation_type: 'ADJUSTMENT', ... },
    inventory: { 
      item_id, 
      quantity_delta: -5,  // Negative = shrinkage
      reason: 'cycle_count',
      ...
    },
  },
}
```

**Finance OS Actions:**
- Dr. Inventory Variance Expense
- Cr. Inventory Asset

---

## Versioning & Compatibility

### Contract Version

**Current:** v1.0  
**Backwards Compatibility:** Finance OS must support old contract versions

```typescript
interface FinanceEventEnvelope {
  contract_version: string;  // "1.0", "1.1", etc.
  source_version: string;    // Logistics OS version
}
```

### Schema Evolution

**Adding fields:** Safe (Finance OS ignores unknown fields)  
**Removing fields:** Breaking change (requires migration)  
**Changing semantics:** Breaking change (new event type)

---

## Tenant Isolation (P0 Gate)

**MANDATORY:** Every event MUST include `tenant_id`

```typescript
// Finance OS validates tenant isolation
if (!envelope.tenant_id) {
  throw new Error('P0 Gate violation: tenant_id required');
}

// Kernel enforces isolation
await financeKernel.persist({
  tenant_id: envelope.tenant_id,  // Enforced at DB level
  ...
});
```

---

## Error Handling

### Event Validation Failure

**Logistics OS:** Publishes to dead letter queue  
**Finance OS:** Returns validation error  
**Resolution:** Manual intervention or retry with corrected event

### Semantic Resolution Failure

**Finance OS:** Cannot map business event to financial meaning  
**Resolution:** Configure semantic mapping, republish event

### COA Resolution Failure

**Finance OS:** Cannot map intent to GL account  
**Resolution:** Configure account mapping, republish event

### Posting Failure

**Finance OS:** Kernel rejects posting (unbalanced, constraint violation)  
**Resolution:** Fix business logic, republish event

---

## Key Principles

### 1. Single Responsibility

> **"Each OS owns its domain. Finance OS does NOT dictate Logistics operations. Logistics OS does NOT perform accounting."**

### 2. Loose Coupling

> **"Logistics and Finance communicate via events, not direct calls. Either OS can be updated independently."**

### 3. Event Sourcing

> **"Events are immutable facts. Finance OS can replay events to rebuild financial state."**

### 4. Idempotency

> **"Publishing same event multiple times = same financial result. No duplicate entries."**

### 5. Tenant Isolation

> **"Tenant data never crosses boundaries. Enforced at Platform, OS, and Kernel levels."**

---

## Anti-Patterns (DO NOT DO)

❌ **Logistics OS creates journal entries**
- Finance OS is authoritative for accounting

❌ **Finance OS queries Logistics database directly**
- Use events, not direct database access

❌ **Logistics includes debit/credit in events**
- Finance OS determines accounting treatment

❌ **Finance OS modifies Logistics inventory**
- Logistics OS owns operational data

❌ **Shared god contract with all contexts**
- Keep contexts modular and extensible

---

## Future Extensions

### Cross-OS Events (Future)

```
Order Management OS
        ↓
Logistics OS (fulfill order)
        ↓
Finance OS (recognize revenue)
```

### Multi-OS Orchestration (Future)

```
Healthcare OS → Pharmacy fulfillment
        ↓
Logistics OS (dispense medication)
        ↓
Finance OS (revenue + inventory)
```

---

## Success Criteria

✅ **Logistics OS emits events for all financial operations**  
✅ **Finance OS processes Logistics events without Logistics-specific code**  
✅ **Both OS can be deployed/updated independently**  
✅ **Idempotency ensures no duplicate accounting**  
✅ **Tenant isolation enforced at all layers**  
✅ **Event replay can reconstruct financial state**  
✅ **Contract is versioned and backward-compatible**  

---

**STATUS:** Integration contract locked (design phase, no code yet)  
**Next:** Implement Logistics OS event publisher (reuse existing pattern)  
**Date:** 2026-08-22  
**Principle:** Boundary before implementation
