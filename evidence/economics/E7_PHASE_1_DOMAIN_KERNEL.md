# E7.1: Domain Kernel Construction

**Phase:** E7.1 (Domain Kernel)  
**Status:** Ready to Start  
**Date:** 2026-08-22

---

## Objective

Build Logistics OS Domain Kernel (P0 capabilities):
- Item / SKU master data
- Inventory domain model
- Inventory movement transactions
- Traceability (lot, serial, chain of custody)

**Success Criteria:**
- ✅ Domain models run independently (no Product dependencies)
- ✅ Database schema separated (OS vs Product)
- ✅ Unit tests pass in isolation
- ✅ Zero Warehouse-specific logic in OS

---

## Step 1: Warehouse Product Audit

**Goal:** Classify every E6 capability as Platform / OS / Product

### Audit Checklist

**Files to audit:**
- `src/products/warehouse/` (all implementation)
- `migrations/logistics/` (database schema)
- `scripts/e6/` (test scripts)

**Classification criteria:**

| Category | Test |
|----------|------|
| **Platform** | Cross-industry? (Tenant, Auth, Audit) |
| **Logistics OS** | Cross-logistics-product? (Inventory, Movement) |
| **Warehouse Product** | Warehouse-specific? (Receipt, Bin, Putaway) |

---

### Initial Classification (To Be Verified)

#### Platform (DO NOT move to OS)

- ✅ Tenant isolation (P0 Gate)
- ✅ RBAC / permissions
- ✅ Audit fields (created_at, updated_at, created_by, tenant_id)
- ✅ RLS policies

#### Logistics OS Candidates (Cross-Product Primitives)

**P0 (Must Extract):**
- Item / SKU entity
- Inventory balance
- Inventory movement (transaction log)
- Traceability (lot, serial)
- State primitives (PENDING, AVAILABLE, RESERVED, etc.)

**P1 (Should Extract):**
- Location (generic concept, not bin-specific)
- UOM (unit of measure)
- Quantity validation
- Balance aggregation queries

**P2 (Nice to Extract):**
- Operational events (INVENTORY_RECEIVED, INVENTORY_ISSUED)
- State transition validation
- Business rule primitives

#### Warehouse Product (Keep in Product)

- ✅ Receipt entity (GRN)
- ✅ Bin entity
- ✅ Putaway workflow
- ✅ Bin capacity logic
- ✅ Vendor entity (procurement-specific)
- ✅ Receipt-specific state (RECEIVED, PUTAWAY_PENDING, PUTAWAY_COMPLETE)

---

## Step 2: Domain Model Design

### Entity: Item (SKU Master Data)

**Purpose:** Cross-product item/SKU definition

**Schema (Draft):**
```sql
CREATE TABLE logistics.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.tenants(id),
  
  -- Identity
  sku_code VARCHAR(50) NOT NULL,
  item_name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Classification
  item_type VARCHAR(50), -- GOODS, SERVICE, KIT, etc.
  category VARCHAR(100),
  
  -- Physical attributes
  base_uom VARCHAR(10) NOT NULL, -- EA, KG, L, etc.
  weight_kg DECIMAL(12, 4),
  dimensions_json JSONB, -- { length, width, height, unit }
  
  -- Tracking requirements
  lot_tracked BOOLEAN DEFAULT false,
  serial_tracked BOOLEAN DEFAULT false,
  expiry_tracked BOOLEAN DEFAULT false,
  
  -- Status
  status VARCHAR(20) DEFAULT 'ACTIVE', -- ACTIVE, INACTIVE, DISCONTINUED
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  
  UNIQUE(tenant_id, sku_code)
);

CREATE INDEX idx_items_tenant ON logistics.items(tenant_id);
CREATE INDEX idx_items_sku ON logistics.items(tenant_id, sku_code);
```

---

### Entity: Inventory (Balance)

**Purpose:** Current inventory balance by item, location, lot

**Schema (Draft):**
```sql
CREATE TABLE logistics.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.tenants(id),
  
  -- Item reference
  item_id UUID NOT NULL REFERENCES logistics.items(id),
  
  -- Location (generic, not warehouse-specific bin)
  location_id UUID, -- Could be warehouse, store, 3PL, etc.
  location_type VARCHAR(50), -- WAREHOUSE, STORE, 3PL, TRANSIT, etc.
  
  -- Quantity
  quantity_on_hand DECIMAL(12, 4) NOT NULL DEFAULT 0,
  quantity_reserved DECIMAL(12, 4) NOT NULL DEFAULT 0,
  quantity_available DECIMAL(12, 4) GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  
  -- Traceability
  lot_number VARCHAR(50),
  serial_number VARCHAR(50),
  expiry_date DATE,
  
  -- State
  status VARCHAR(20) DEFAULT 'AVAILABLE', -- AVAILABLE, QUARANTINE, DAMAGED, etc.
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, item_id, location_id, lot_number, serial_number)
);

CREATE INDEX idx_inventory_tenant ON logistics.inventory(tenant_id);
CREATE INDEX idx_inventory_item ON logistics.inventory(tenant_id, item_id);
CREATE INDEX idx_inventory_location ON logistics.inventory(tenant_id, location_id);
CREATE INDEX idx_inventory_lot ON logistics.inventory(tenant_id, item_id, lot_number);
```

---

### Entity: Inventory Movement (Transaction Log)

**Purpose:** Immutable log of all inventory movements

**Schema (Draft):**
```sql
CREATE TABLE logistics.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.tenants(id),
  
  -- Identity
  movement_number VARCHAR(50) NOT NULL,
  movement_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Item
  item_id UUID NOT NULL REFERENCES logistics.items(id),
  
  -- Movement type
  movement_type VARCHAR(50) NOT NULL, -- RECEIPT, ISSUE, TRANSFER, ADJUSTMENT, etc.
  direction VARCHAR(10) NOT NULL, -- INBOUND, OUTBOUND
  
  -- Locations
  from_location_id UUID,
  from_location_type VARCHAR(50),
  to_location_id UUID,
  to_location_type VARCHAR(50),
  
  -- Quantity
  quantity DECIMAL(12, 4) NOT NULL,
  uom VARCHAR(10) NOT NULL,
  
  -- Traceability
  lot_number VARCHAR(50),
  serial_number VARCHAR(50),
  expiry_date DATE,
  
  -- Cost (hint for Finance OS, not authoritative)
  unit_cost DECIMAL(12, 4),
  total_cost DECIMAL(12, 4),
  currency VARCHAR(3) DEFAULT 'VND',
  
  -- Source document
  source_document_type VARCHAR(50), -- RECEIPT, SHIPMENT, ADJUSTMENT, etc.
  source_document_id UUID,
  source_document_number VARCHAR(50),
  
  -- State
  status VARCHAR(20) DEFAULT 'COMPLETED', -- PENDING, COMPLETED, CANCELLED
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  
  -- Immutable (movements cannot be updated)
  CONSTRAINT movements_immutable CHECK (updated_at IS NULL)
);

CREATE INDEX idx_movements_tenant ON logistics.inventory_movements(tenant_id);
CREATE INDEX idx_movements_item ON logistics.inventory_movements(tenant_id, item_id);
CREATE INDEX idx_movements_date ON logistics.inventory_movements(tenant_id, movement_date);
CREATE INDEX idx_movements_source ON logistics.inventory_movements(tenant_id, source_document_type, source_document_id);
```

---

### Entity: Traceability (Chain of Custody)

**Purpose:** Audit trail for regulated items (lot, serial tracking)

**Schema (Draft):**
```sql
CREATE TABLE logistics.traceability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES platform.tenants(id),
  
  -- Item
  item_id UUID NOT NULL REFERENCES logistics.items(id),
  
  -- Traceability identifiers
  lot_number VARCHAR(50),
  serial_number VARCHAR(50),
  
  -- Lifecycle
  manufactured_date DATE,
  expiry_date DATE,
  received_date DATE,
  
  -- Origin
  supplier_id UUID,
  supplier_name VARCHAR(255),
  supplier_lot_number VARCHAR(50),
  
  -- Chain of custody
  custody_events JSONB, -- Array of { timestamp, location, action, user }
  
  -- Compliance
  compliance_status VARCHAR(20) DEFAULT 'COMPLIANT',
  recall_status VARCHAR(20) DEFAULT 'NONE', -- NONE, RECALLED, DESTROYED
  
  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tenant_id, item_id, lot_number, serial_number)
);

CREATE INDEX idx_traceability_tenant ON logistics.traceability(tenant_id);
CREATE INDEX idx_traceability_lot ON logistics.traceability(tenant_id, lot_number);
CREATE INDEX idx_traceability_serial ON logistics.traceability(tenant_id, serial_number);
CREATE INDEX idx_traceability_expiry ON logistics.traceability(tenant_id, expiry_date) WHERE expiry_date IS NOT NULL;
```

---

## Step 3: Domain Logic (TypeScript)

### Domain Model: Item

**File:** `src/platform/logistics/domain/item.ts`

```typescript
export interface ItemId {
  value: string; // UUID
}

export interface SkuCode {
  value: string; // Unique per tenant
}

export type ItemType = 'GOODS' | 'SERVICE' | 'KIT' | 'BUNDLE';
export type ItemStatus = 'ACTIVE' | 'INACTIVE' | 'DISCONTINUED';

export interface Item {
  id: ItemId;
  tenantId: string;
  skuCode: SkuCode;
  name: string;
  description?: string;
  type: ItemType;
  category?: string;
  baseUom: string;
  weightKg?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'CM' | 'IN';
  };
  lotTracked: boolean;
  serialTracked: boolean;
  expiryTracked: boolean;
  status: ItemStatus;
  createdAt: Date;
  updatedAt: Date;
}

export class ItemDomain {
  static create(props: CreateItemProps): Result<Item> {
    // Validation
    if (!props.skuCode || props.skuCode.trim().length === 0) {
      return Result.fail('SKU code required');
    }
    if (!props.name || props.name.trim().length === 0) {
      return Result.fail('Item name required');
    }
    if (!props.baseUom || props.baseUom.trim().length === 0) {
      return Result.fail('Base UOM required');
    }
    
    // Domain invariants
    if (props.serialTracked && !props.lotTracked) {
      return Result.fail('Serial tracking requires lot tracking');
    }
    
    // Create
    const item: Item = {
      id: { value: generateUuid() },
      tenantId: props.tenantId,
      skuCode: { value: props.skuCode.trim().toUpperCase() },
      name: props.name.trim(),
      description: props.description?.trim(),
      type: props.type || 'GOODS',
      category: props.category,
      baseUom: props.baseUom.toUpperCase(),
      weightKg: props.weightKg,
      dimensions: props.dimensions,
      lotTracked: props.lotTracked || false,
      serialTracked: props.serialTracked || false,
      expiryTracked: props.expiryTracked || false,
      status: 'ACTIVE',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    
    return Result.ok(item);
  }
  
  static canDeactivate(item: Item): Result<void> {
    // Check no active inventory (future)
    return Result.ok();
  }
}
```

---

### Domain Model: Inventory

**File:** `src/platform/logistics/domain/inventory.ts`

```typescript
export interface Inventory {
  id: string;
  tenantId: string;
  itemId: string;
  locationId?: string;
  locationType?: string;
  quantityOnHand: number;
  quantityReserved: number;
  quantityAvailable: number; // Computed
  lotNumber?: string;
  serialNumber?: string;
  expiryDate?: Date;
  status: InventoryStatus;
  createdAt: Date;
  updatedAt: Date;
}

export type InventoryStatus = 
  | 'AVAILABLE'
  | 'RESERVED'
  | 'QUARANTINE'
  | 'DAMAGED'
  | 'EXPIRED';

export class InventoryDomain {
  static increaseOnHand(
    inventory: Inventory,
    quantity: number
  ): Result<Inventory> {
    if (quantity <= 0) {
      return Result.fail('Quantity must be positive');
    }
    
    return Result.ok({
      ...inventory,
      quantityOnHand: inventory.quantityOnHand + quantity,
      quantityAvailable: inventory.quantityOnHand + quantity - inventory.quantityReserved,
      updatedAt: new Date(),
    });
  }
  
  static decreaseOnHand(
    inventory: Inventory,
    quantity: number
  ): Result<Inventory> {
    if (quantity <= 0) {
      return Result.fail('Quantity must be positive');
    }
    if (inventory.quantityOnHand < quantity) {
      return Result.fail('Insufficient on-hand quantity');
    }
    
    return Result.ok({
      ...inventory,
      quantityOnHand: inventory.quantityOnHand - quantity,
      quantityAvailable: inventory.quantityOnHand - quantity - inventory.quantityReserved,
      updatedAt: new Date(),
    });
  }
  
  static reserve(
    inventory: Inventory,
    quantity: number
  ): Result<Inventory> {
    if (quantity <= 0) {
      return Result.fail('Quantity must be positive');
    }
    if (inventory.quantityAvailable < quantity) {
      return Result.fail('Insufficient available quantity');
    }
    
    return Result.ok({
      ...inventory,
      quantityReserved: inventory.quantityReserved + quantity,
      quantityAvailable: inventory.quantityAvailable - quantity,
      updatedAt: new Date(),
    });
  }
  
  static releaseReservation(
    inventory: Inventory,
    quantity: number
  ): Result<Inventory> {
    if (quantity <= 0) {
      return Result.fail('Quantity must be positive');
    }
    if (inventory.quantityReserved < quantity) {
      return Result.fail('Cannot release more than reserved');
    }
    
    return Result.ok({
      ...inventory,
      quantityReserved: inventory.quantityReserved - quantity,
      quantityAvailable: inventory.quantityAvailable + quantity,
      updatedAt: new Date(),
    });
  }
}
```

---

## Step 4: Tests (Isolated)

**File:** `src/platform/logistics/domain/__tests__/item.test.ts`

```typescript
describe('ItemDomain', () => {
  describe('create', () => {
    it('creates valid item', () => {
      const result = ItemDomain.create({
        tenantId: 'tenant-1',
        skuCode: 'SKU-001',
        name: 'Test Item',
        baseUom: 'EA',
        type: 'GOODS',
        lotTracked: false,
        serialTracked: false,
        expiryTracked: false,
      });
      
      expect(result.isSuccess).toBe(true);
      expect(result.value.skuCode.value).toBe('SKU-001');
      expect(result.value.status).toBe('ACTIVE');
    });
    
    it('fails if SKU code empty', () => {
      const result = ItemDomain.create({
        tenantId: 'tenant-1',
        skuCode: '',
        name: 'Test Item',
        baseUom: 'EA',
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('SKU code required');
    });
    
    it('fails if serial tracking without lot tracking', () => {
      const result = ItemDomain.create({
        tenantId: 'tenant-1',
        skuCode: 'SKU-001',
        name: 'Test Item',
        baseUom: 'EA',
        lotTracked: false,
        serialTracked: true, // Invalid
      });
      
      expect(result.isFailure).toBe(true);
      expect(result.error).toBe('Serial tracking requires lot tracking');
    });
  });
});
```

---

## Step 5: Repository Contracts

**File:** `src/platform/logistics/contracts/item.repository.ts`

```typescript
export interface IItemRepository {
  findById(tenantId: string, itemId: string): Promise<Item | null>;
  findBySkuCode(tenantId: string, skuCode: string): Promise<Item | null>;
  save(item: Item): Promise<void>;
  update(item: Item): Promise<void>;
  list(tenantId: string, filters?: ItemFilters): Promise<Item[]>;
}

export interface ItemFilters {
  status?: ItemStatus;
  category?: string;
  lotTracked?: boolean;
  serialTracked?: boolean;
}
```

---

## Step 6: Migration Plan

**Create separate schema for Logistics OS:**

```sql
-- Migration: 20260822_logistics_os_schema.sql
CREATE SCHEMA IF NOT EXISTS logistics;

-- (Item, Inventory, Movement, Traceability tables from above)
```

**RLS Policies:**

```sql
-- Tenant isolation (P0 Gate)
ALTER TABLE logistics.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY items_tenant_isolation ON logistics.items
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

ALTER TABLE logistics.inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY inventory_tenant_isolation ON logistics.inventory
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- (Same for movements, traceability)
```

---

## Acceptance Criteria (E7.1)

- ✅ Logistics OS schema created (separate from Warehouse Product)
- ✅ Item domain model implemented + tested
- ✅ Inventory domain model implemented + tested
- ✅ Movement domain model implemented + tested
- ✅ Traceability domain model implemented + tested
- ✅ Repository contracts defined
- ✅ RLS policies enforce tenant isolation (P0)
- ✅ Tests pass in isolation (no Warehouse dependencies)
- ✅ Zero Warehouse-specific logic in OS
- ✅ Zero accounting logic in OS

---

## Timeline Estimate

**E7.1 Duration:** 3-5 days

**Breakdown:**
- Audit Warehouse (0.5 day)
- Design domain models (0.5 day)
- Implement Item + tests (1 day)
- Implement Inventory + tests (1 day)
- Implement Movement + tests (1 day)
- Implement Traceability + tests (0.5 day)
- Integration smoke test (0.5 day)

---

## Next After E7.1

- ⏳ E7.2: Operational Kernel (State machine, Events)
- ⏳ E7.3: Rules & Traceability
- ⏳ E7.4: Finance Integration
- ⏳ E7.5: Warehouse Integration
- ⏳ E7.6: Measurement & Lock

---

**STATUS:** Ready to audit Warehouse Product  
**START:** 2026-08-22  
**PRINCIPLE:** Domain-driven design, not code extraction
