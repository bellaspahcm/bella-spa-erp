# H2 Contract #2 Semantic Preflight — Service Catalog vs Service Inventory

**Date:** 2026-09-15  
**Status:** ⚠️ **SEMANTIC CONFLICT DETECTED**

---

## Problem Statement

**Contract #2 was named `IServiceInventoryEngine`** but investigation reveals:

**Source implementation:** Bella Spa `packages` table = **SERVICE CATALOG**, NOT service inventory

**Semantic confusion:**
- **Service Catalog:** What services does salon offer? (name, price, duration, category)
- **Service Inventory:** What consumables does service use? (product usage, quantity, stock deduction)

**Risk:** Contract name (`IServiceInventoryEngine`) does NOT match source semantics (service catalog)

---

## Source Implementation Audit

### Spa `packages` Table Schema

**File:** `supabase/migrations/20260515040000_create_packages_table.sql`

```sql
CREATE TABLE packages (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL,
  
  -- SERVICE CATALOG FIELDS
  name TEXT NOT NULL,                    -- Service name (e.g., "Haircut Basic")
  price BIGINT,                          -- Service price
  duration TEXT,                         -- Service duration (e.g., "90 phút/buổi")
  details TEXT[],                        -- Service description
  ktv_commission BIGINT,                 -- Staff commission
  offer TEXT,                            -- Promotional offer
  full_price BIGINT,                     -- Original price (before discount)
  
  -- PRODUCT USAGE (added later)
  product_usage JSONB DEFAULT '{}'       -- ⚠️ THIS IS INVENTORY, not catalog
)
```

---

### Product Usage Field (Migration: 20260716000000)

```sql
-- Add product_usage column to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS product_usage JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN packages.product_usage IS 
  'Product usage per session. Format: {"product_id": quantity}. 
   Used for inventory forecasting.';

-- Example: 
-- { "uuid-dau-massage": 2, "uuid-khan": 1 }
-- = 2 bottles of massage oil + 1 towel per session
```

---

### Semantic Analysis

**`packages` table = 95% SERVICE CATALOG + 5% INVENTORY**

**Service Catalog semantics (95%):**
- name, price, duration, details, offer, full_price, ktv_commission
- **Bounded context:** What services does salon offer?
- **Consumer:** Booking system, pricing, service selection

**Service Inventory semantics (5%):**
- product_usage JSONB (consumables per service)
- **Bounded context:** What products does service consume?
- **Consumer:** Inventory forecasting, stock deduction

---

## Bounded Context Separation

### Service Catalog (Primary)

**Purpose:** Define services offered by salon

**Responsibilities:**
- Service identity (id, name, code)
- Service classification (category, subcategory)
- Service pricing (base price, discounts, packages)
- Service duration
- Service availability (branches, staff skills)
- Service lifecycle (active, archived)

**Data Ownership:** Product vertical (Spa, Haircut, Nail)

**Contract Name:** `IServiceCatalog` ✅ CORRECT

---

### Service Inventory (Secondary)

**Purpose:** Track consumables used by services

**Responsibilities:**
- Product usage definition (service → products mapping)
- Quantity per service
- Stock deduction rules
- Inventory forecasting based on bookings
- Reorder alerts

**Data Ownership:** Logistics integration (Service → E7 Logistics)

**Contract Name:** `IServiceInventoryEngine` ❌ MISLEADING (this is E7 integration, not service catalog)

---

## Contract Naming Decision

### Option 1: Extract Service Catalog ONLY (Recommended)

**Contract Name:** `IServiceCatalog` ✅

**Scope:**
- Service definition (name, price, duration, category)
- Service variants (Basic, Premium, Deluxe)
- Service packages (bundles)
- Service availability (branches, staff)
- Service lifecycle (CRUD operations)

**Exclude:**
- ❌ `product_usage` field (this is inventory, not catalog)
- ❌ Stock deduction logic (this is E7 Logistics integration)
- ❌ Inventory forecasting (this is separate capability)

**Source:** Spa `packages` table (catalog fields only)

---

### Option 2: Extract Both Catalog + Inventory (NOT Recommended)

**Contract Name:** `IServiceInventoryEngine` ⚠️

**Scope:**
- Service catalog (name, price, duration) + Service inventory (product usage)
- Mixed bounded contexts in one contract

**Problem:**
- Semantic confusion (catalog ≠ inventory)
- Violates single responsibility principle
- Forces consumers to import inventory logic even if they only need catalog

---

### Option 3: Two Separate Contracts (Overkill for H2)

**Contract #2A:** `IServiceCatalog` (service definitions)  
**Contract #2B:** `IServiceInventoryEngine` (product usage tracking)

**Problem:**
- Overengineering for current needs
- Spa `product_usage` is JSONB (basic tracking, not full inventory engine)
- Can split later if inventory grows complex

---

## Decision: Extract Service Catalog ONLY

**Contract Name:** ✅ `IServiceCatalog`

**Rationale:**
1. **Semantic clarity:** Catalog = service definitions, NOT inventory management
2. **Single responsibility:** Contract focuses on one bounded context (service catalog)
3. **Source alignment:** 95% of Spa `packages` table is catalog, 5% is inventory (JSONB field)
4. **Consumer fit:** Spa, Haircut, Nail need service catalog; inventory is optional/future

**Defer inventory:**
- `product_usage` JSONB field is basic tracking (not full inventory engine)
- Can add `IServiceInventoryEngine` later if Haircut needs advanced inventory features
- For now: Haircut can use E7 Logistics directly for product inventory (ADR-005 investigation)

---

## Contract #2 Corrected Scope

### IServiceCatalog (Platform Contract)

**Purpose:** Define services offered across verticals (Beauty, Healthcare, Auto, Education)

**Capabilities:**
1. **Service Definition:**
   - Create, read, update, delete services
   - Service identity (id, code, name, description)
   - Service classification (category, subcategory)
   - Service pricing (base price, discount price)
   - Service duration (minutes)

2. **Service Variants:**
   - Define service variants (Basic, Premium, Deluxe)
   - Variant-specific pricing and duration

3. **Service Packages:**
   - Bundle multiple services into packages
   - Package pricing (discount vs individual services)

4. **Service Availability:**
   - Branch-specific availability (which branches offer which services)
   - Staff skill requirements (which staff can perform which services)

5. **Service Lifecycle:**
   - Activate/deactivate services
   - Archive services
   - Visibility control (public, internal)

---

### What IServiceCatalog Does NOT Include

**Excluded (inventory management):**
- ❌ Product usage tracking (`product_usage` JSONB field)
- ❌ Stock deduction rules
- ❌ Inventory forecasting
- ❌ Reorder alerts

**Reason:** These belong to `IServiceInventoryEngine` or E7 Logistics integration (separate capability)

**Future:** If Haircut needs service inventory, create `IServiceInventoryEngine` later

---

## Extraction Plan

### Step 1: Audit Spa Service Catalog Implementation

**Find:**
- Service repository/service (`src/core/services/order/public-booking-packages.ts`?)
- Service types (from `packages` table schema)
- Service CRUD operations

**Focus:** Catalog fields ONLY (name, price, duration, category, availability)

**Ignore:** `product_usage` field (inventory, not catalog)

---

### Step 2: Define IServiceCatalog Contract

**Create:**
- `src/platform/contracts/v1/service-catalog.contract.ts` ✅ CORRECT NAME
- **NOT:** `service-inventory-engine.contract.ts` ❌ WRONG NAME

**Interface:**
```typescript
export interface IServiceCatalog {
  // Service CRUD
  getService(serviceId, tenantId): Promise<Service | null>;
  listServices(filters): Promise<ServiceListResponse>;
  createService(input): Promise<CreateServiceOutput>;
  updateService(input): Promise<UpdateServiceOutput>;
  deleteService(serviceId, tenantId): Promise<{ success: boolean }>;
  
  // Service variants
  getServiceVariants(serviceId): Promise<ServiceVariant[]>;
  createServiceVariant(input): Promise<CreateVariantOutput>;
  
  // Service packages
  getServicePackages(tenantId): Promise<ServicePackage[]>;
  createServicePackage(input): Promise<CreatePackageOutput>;
  
  // Service availability
  getServicesByBranch(branchId, tenantId): Promise<Service[]>;
  setServiceBranchAvailability(input): Promise<{ success: boolean }>;
  setServiceStaffRequirement(input): Promise<{ success: boolean }>;
  
  // Service lifecycle
  activateService(serviceId, tenantId): Promise<{ success: boolean }>;
  deactivateService(serviceId, tenantId): Promise<{ success: boolean }>;
}
```

**Entity:**
```typescript
export interface Service {
  id: string;
  tenant_id: string;
  service_code: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  
  // Pricing
  base_price: number;
  discount_price?: number;
  currency: string;
  
  // Duration
  duration_minutes: number;
  
  // Availability
  available_at_branches: string[];
  required_staff_skills: string[];
  
  // Lifecycle
  is_active: boolean;
  is_visible: boolean;
  
  // Audit
  created_at: string;
  updated_at: string;
}
```

**NO `product_usage` field in Service entity** — this is inventory, not catalog

---

### Step 3: Document Extraction

**Evidence:**
- Methods extracted from Spa service catalog
- Types defined (Service, ServiceVariant, ServicePackage)
- Invariants documented
- **Semantic scope:** Service catalog ONLY (no inventory)

---

### Step 4: Update H0/H1 References

**H0 assessment listed:**
- "Service Inventory" capability

**Correct to:**
- "Service Catalog" capability (service definitions)
- "Service Inventory" (deferred to future / E7 integration)

---

## Impact on H2 Contract Extraction

### Contract #2: IServiceCatalog (Corrected)

**Source:** Spa `packages` table (catalog fields)  
**Ownership:** Platform Contracts  
**Semantics:** Service definitions (name, price, duration, availability)

---

### Contract #?: IServiceInventoryEngine (Deferred)

**Source:** TBD (Haircut product usage requirements)  
**Ownership:** TBD (Platform or Logistics integration)  
**Semantics:** Product usage per service, stock deduction, forecasting

**Decision:** Defer until Haircut actually needs this capability

**Alternative:** Haircut uses E7 Logistics directly for product inventory (ADR-005 allows this)

---

## Semantic Preflight Result

```
CONTRACT #2 SEMANTIC PREFLIGHT

Source Implementation:       Spa packages table
Source Semantics:            95% Service Catalog + 5% Inventory
Contract Name (proposed):    IServiceInventoryEngine
Contract Name (actual need): IServiceCatalog

Semantic Conflict:           ❌ DETECTED
Resolution:                  ✅ Rename contract to IServiceCatalog
Scope Correction:            ✅ Extract catalog only (defer inventory)

Status:                      ✅ PREFLIGHT COMPLETE
Next:                        Extract IServiceCatalog (NOT IServiceInventoryEngine)
```

---

## Revised H2 Contract List

**Original (from H1):**
1. ✅ IWaitlistEngine (walk-in queue) — COMPLETE
2. ❌ IServiceInventoryEngine (service + inventory) — **SPLIT:**
   - 2A. ✅ **IServiceCatalog** (service definitions) — Extract now
   - 2B. ⏳ IServiceInventoryEngine (product usage) — Defer
3. ⏳ IProviderEngine (staff assignment)
4. ⏳ IScheduleEngine (availability)
5. ⏳ IPatientEngine (customer profile)
6. ⏳ IAppointmentEngine (booking)
7. ⏳ Finance Platform (payment)
8. ⏳ E7 Logistics (inventory)

**Corrected count:** 8 contracts → 9 contracts (inventory split from catalog)

**OR:** 8 contracts (defer inventory to future, not H2 scope)

---

## Action Items

1. ✅ **Semantic preflight:** COMPLETE (this document)
2. ⏭️ **Contract name:** Change to `IServiceCatalog`
3. ⏭️ **Scope:** Extract service catalog ONLY (no `product_usage`)
4. ⏭️ **Evidence:** Document Spa catalog fields → contract mapping
5. ⏭️ **H0/H1 update:** Clarify "Service Inventory" = future capability, not H2

---

**Preflight Version:** 1.0.0  
**Date:** 2026-09-15  
**Status:** ⚠️ **SEMANTIC CONFLICT RESOLVED**  
**Next:** Extract IServiceCatalog (corrected name)
