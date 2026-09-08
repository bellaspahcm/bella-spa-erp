# Bella Fresh Food — Product #3

**Industry:** Retail (Fresh Food & Grocery)  
**Customer Demand:** Real requirement for fresh food/grocery store  
**Created:** 2026-09-06  
**Status:** Under Construction

---

## Business Model

**Target Customer:** Fresh food and grocery retail (perishables, dairy, produce, meat)

**Key Requirements:**
- Product catalog with expiry date tracking
- Batch/lot management for incoming shipments
- FEFO (First Expire, First Out) inventory logic
- Expiry alerts and waste detection
- Supplier batch tracking

---

## Architecture

**Platform Core Reuse:**
- ✅ Tenant isolation
- ✅ Authentication / Authorization
- ✅ RLS security

**Retail OS Reuse:**
- ✅ R1 Product Catalog (parent products)
- ✅ R2 Inventory Movement (stock tracking)
- ✅ R4 Batch/Lot Tracking (expiry dates, FEFO)

**Product-Specific:**
- Perishable product categories
- Supplier management
- Waste tracking interface
- Temperature-controlled zones (future)

---

## Domain Model

### Parent Product
- ID, SKU, name (e.g., "Organic Milk - Whole 1L")
- Base price
- Category (dairy, produce, meat, bakery, etc.)
- Perishable: true
- Shelf life (days)

### Product Batch (R4)
- Batch number (e.g., MILK-20260906-001)
- Manufactured date
- Expiry date (required)
- Stock per batch
- FEFO sorting

**Example:**
```
Product: "Organic Milk - Whole 1L" (parent)
├─ Batch #20260906-001 (mfg: 2026-09-06, exp: 2026-09-13, stock: 50)
├─ Batch #20260907-002 (mfg: 2026-09-07, exp: 2026-09-14, stock: 45)
└─ Batch #20260908-003 (mfg: 2026-09-08, exp: 2026-09-15, stock: 60)

FEFO Order: #001 → #002 → #003 (sell earliest expiry first)
```

---

## Evidence Tracking

### Baseline Estimate
**Standalone development (no Platform):** 320h
- Batch/lot tracking: 100h
- Expiry management: 70h
- Product catalog: 50h
- Sales/orders: 40h
- Infrastructure: 60h

### Platform-Based Actual
**Start:** 2026-09-06T17:00:00Z  
**Status:** IN PROGRESS

---

## Validation Criteria

### Functional
- ✅ Create parent product (perishable)
- ✅ Create batches with expiry dates
- ✅ Track stock per batch
- ✅ Get next batch (FEFO logic)
- ✅ Detect expiring soon (7-day threshold)
- ✅ Detect expired batches

### Non-Functional
- ✅ TypeScript compilation
- ✅ RLS enforcement (tenant isolation)
- ✅ Tests pass (contract compliance)
- ✅ Architecture Guard compliance

---

## Out of Scope (V1)

- ❌ Temperature monitoring
- ❌ Supplier portal
- ❌ Batch recall workflow
- ❌ Waste analytics
- ❌ Multi-location inventory
- ❌ Customer UI/frontend
- ❌ Batch-specific pricing
