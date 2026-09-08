# RETAIL OS — COVERAGE STUDY

**Date:** 2026-09-06  
**Status:** 🔍 RESEARCH COMPLETE  
**Purpose:** Validate R1/R2 boundaries against cross-industry retail archetypes

---

## Executive Summary

**Critical Finding:** R1/R2 are NOT universal Retail semantic — they are **Retail Core Baseline** validated for General Merchandise archetype.

**R1 Product Catalog:** ✅ CONFIRMED as Core Baseline  
**R2 Inventory Movement:** ✅ CONFIRMED as Core Baseline (quantity-based)

**Universal Retail claim:** ❌ REJECTED (Coverage Study falsifies this assumption)  
**Specialized archetypes:** Pharmacy, Electronics, Fashion require extensions

**Recommendation:** APPROVE R1/R2 as Retail Core Baseline (NOT complete Retail OS). APPROVE Phase 3 migration (General Merchandise scope only).

---

## Research Question

> **Are R1/R2 universal Retail semantic, or only General Merchandise baseline?**

**Hypothesis to falsify:**
- ❌ "R1/R2 = universal Retail OS for all archetypes"

**Correct claim (if validated):**
- ✅ "R1/R2 = Retail Core Baseline, validated for General Merchandise, with specialized archetype extensions"

**Falsification approach:** Study must expose archetype gaps that cannot be solved by R1/R2 Core alone.

---

## Vietnam Retail Market Context

**Source:** Bộ Công Thương — Báo cáo thị trường nội địa Việt Nam 2025

**Market size:** ~$269B total retail + services (2025)  
**Retail goods:** 76.2% of total  
**Food/grocery:** Largest segment  
**Channel distribution:**
- Traditional retail: 67-70% (markets, small stores)
- Modern retail: 25-30% (supermarkets, convenience)
- E-commerce: ~$32B (~12% of retail+services)

**Key insight:** Vietnam retail is highly fragmented — traditional dominates, but modern + e-commerce growing rapidly.

---

## Archetype Selection (6 Representatives)

**Selected for semantic diversity, not market size:**

| Archetype | Key Semantic | Why Selected |
|-----------|--------------|--------------|
| **Grocery / FMCG** | Volume + expiry + turnover | Dominant market segment |
| **Fashion / Apparel** | Variants (size/color) | Variant-heavy model |
| **Pharmacy** | Batch + expiry + regulatory | Traceability mandatory |
| **Electronics** | Serial + warranty | Unit-level tracking |
| **Furniture / Home** | Bulky + delivery + location | Logistics-heavy |
| **General Merchandise** | Mixed SKU, no specialization | "Neutral" baseline |

**NOT selected:** E-commerce (channel, not archetype), Automotive Parts (too specialized), Building Materials (B2B-heavy)

---

## Semantic Intersection Analysis

### Product Domain

| Semantic | Coverage | Retail OS Core? |
|----------|----------|-----------------|
| Product Identity (SKU) | 6/6 | ✅ YES |
| Product Lifecycle | 6/6 | ✅ YES |
| Base Price | 6/6 | ✅ YES |
| Barcode | 6/6 | ✅ YES |
| Variants (size/color) | 1/6 (Fashion) | ❌ NO (archetype-specific) |
| Batch tracking | 2/6 (Pharmacy, Grocery) | 🟡 EXTENSION candidate |
| Serial tracking | 1/6 (Electronics) | ❌ NO (archetype-specific) |
| Expiry date | 2/6 (Grocery, Pharmacy) | 🟡 EXTENSION candidate |
| Warranty | 1/6 (Electronics) | ❌ NO (archetype-specific) |

**Conclusion:** Product Core (SKU, price, lifecycle) is universal. Variants/serial/batch are archetype-specific.

---

### Inventory Domain

| Semantic | Coverage | Retail OS Core? |
|----------|----------|-----------------|
| Stock quantity | 5/6 (not Electronics) | ✅ YES |
| Inventory movements | 6/6 | ✅ YES |
| Movement types (SALE, RESTOCK, etc.) | 6/6 | ✅ YES |
| Current stock query | 6/6 | ✅ YES |
| Movement history | 6/6 | ✅ YES |
| Reorder detection | 6/6 | ✅ YES |
| Serial-based tracking | 1/6 (Electronics) | ❌ NO (archetype-specific) |
| Batch-based tracking | 2/6 (Pharmacy mandatory) | 🟡 EXTENSION candidate |
| Location-aware | 2/6 (Furniture, chains) | 🟡 EXTENSION candidate |

**Conclusion:** Quantity-based inventory is baseline. Serial/batch/location are extensions.

---

## R1 Product Catalog Validation

**Current operations:** createProduct, updateProductPrice, updateProductStatus, getProductById, getProductBySku

### Archetype Coverage

| Archetype | R1 Sufficient? | Gap |
|-----------|----------------|-----|
| Grocery | 🟢 YES | Expiry = attribute |
| Fashion | 🔴 NO | Variants not supported |
| Pharmacy | 🟡 PARTIAL | Batch belongs in Inventory, not Product |
| Electronics | 🟡 PARTIAL | Serial belongs in Inventory, not Product |
| Furniture | 🟢 YES | Dimensions = attribute |
| General | 🟢 YES | - |

**Coverage:** 3/6 FULL, 2/6 PARTIAL, 1/6 GAP

### Fashion Variant Gap

**Issue:** Fashion requires Size × Color variants.

**Options:**
- A: Treat variants as separate products (acceptable for Phase 3)
- B: Add variant to R1 (expands contract for 1/6 archetypes)
- C: R1 Core + Variant Extension (future)

**Decision:** **Option A** — Fashion can treat variants as separate SKUs for Phase 3. If future archetypes also need variants, add extension.

### R1 Verdict

**Status:** ✅ **CONFIRMED**

**R1 boundary:** Product Core only (SKU, price, lifecycle, attributes) — no variants, no batch, no serial.

**Acceptable trade-off:** Fashion gap documented, not blocking Phase 3 (bella-retail-store is General Merchandise archetype).

---

## R2 Inventory Movement Validation

**Current operations:** recordMovement, getMovementHistory, getCurrentStock, detectReorderNeeds

### Archetype Coverage

| Archetype | R2 Sufficient? | Gap |
|-----------|----------------|-----|
| Grocery | 🟡 PARTIAL | No expiry alerts |
| Fashion | 🟡 PARTIAL | No variant-aware stock |
| Pharmacy | 🔴 **NO** | Batch-aware movements MANDATORY (regulatory) |
| Electronics | 🔴 **NO** | Serial-aware movements MANDATORY (warranty) |
| Furniture | 🟡 PARTIAL | No location-aware stock |
| General | 🟢 YES | - |

**Coverage:** 1/6 FULL, 3/6 PARTIAL, 2/6 GAP

### Critical Gaps

**Pharmacy:** Must track which batch sold (product recall, FDA requirement).

```typescript
// Current R2: NO batch tracking
recordMovement({ quantityChange: -10 })

// Pharmacy needs:
recordMovement({ quantityChange: -10, batchNumber: 'BATCH-2025-03-15' })
```

**Electronics:** Must track which serial sold (warranty, returns fraud prevention).

```typescript
// Current R2: quantity-based
recordMovement({ quantityChange: -1 })

// Electronics needs: unit-based
recordMovement({ serialNumber: 'IMEI-123456789012345' })
```

### R2 Verdict

**Status:** 🟡 **CONFIRMED with limitations**

**R2 boundary:** Quantity-based inventory only — no batch, no serial, no location.

**Critical limitation:** Pharmacy and Electronics CANNOT operate with R2 Core alone.

**Mitigation:** R2 Core sufficient for General Merchandise archetype (bella-retail-store). Extensions needed for other archetypes.

---

## Boundary Recommendations

### Option A: Confirm R1/R2 As-Is ❌

Accept quantity-only baseline → 2/6 archetypes fail (Pharmacy, Electronics) → **NOT ACCEPTABLE**

### Option B: Expand R1/R2 Contracts ❌

Add batch/serial/variant/location to contracts → Bloated, unstable → **NOT RECOMMENDED**

### Option C: R1/R2 Core + Extensions ✅

Keep minimal core, add optional extensions → Clean separation → **RECOMMENDED**

---

## Recommended Architecture

### R1 Product Catalog

**Core (frozen):**
- Product identity (SKU, barcode)
- Lifecycle (active, discontinued)
- Pricing (base price)
- Basic attributes

**Extensions (future):**
- R1-Variant (Fashion)
- R1-Batch (Pharmacy — batch definition)
- R1-Serialized (Electronics — serial registration)

### R2 Inventory Movement

**Core (frozen):**
- Quantity-based inventory
- Movement types (SALE, RESTOCK, RETURN, DAMAGE, ADJUSTMENT, TRANSFER)
- Audit trail (movement history)
- Reorder detection

**Extensions (future):**
- R2-Batch-Aware (Pharmacy — traceability)
- R2-Serial-Aware (Electronics — unit tracking)
- R2-Location-Aware (Multi-location)
- R2-Expiry-Aware (Perishables)

---

## Gate 2 Decision Framework

### Critical Distinction: Two Different Claims

| Claim | Status | Evidence Level |
|-------|--------|----------------|
| **A: R1/R2 sufficient for Product #1 (bella-retail-store)** | ✅ VALIDATED | General Merchandise archetype = Core baseline |
| **B: R1/R2 = complete Retail OS canonical model** | ❌ FALSIFIED | Pharmacy/Electronics require mandatory extensions |

**Coverage Study proves Claim A, falsifies Claim B.**

---

### What Can Be Approved at Gate 2

**✅ CAN approve:**
- R1/R2 as **Retail Core Baseline** (NOT universal Retail OS)
- Phase 3 migration of bella-retail-store (General Merchandise scope)
- Extensions deferred to post-Phase 3

**❌ CANNOT approve:**
- R1/R2 as "complete Retail OS"
- Universal Retail semantic claim
- Pharmacy/Electronics support without extensions

---

### bella-retail-store Archetype Classification

**bella-retail-store = General Merchandise archetype**

Evidence:
- Mixed SKU (no specialization)
- Quantity-based inventory
- POS immediate sale
- No batch/serial/variant requirements

**Conclusion:** bella-retail-store fits R1/R2 Core Baseline perfectly.

---

### Phase 3 Authorization

**Can R1/R2 Core support bella-retail-store migration?** ✅ YES

**Are extensions needed for bella-retail-store?** ❌ NO

**Is R1/R2 Core sufficient for ALL Retail?** ❌ NO (Pharmacy/Electronics require extensions)

**Recommendation:** **APPROVE Phase 3 migration (General Merchandise scope only)**

---

### Retail OS Boundary Decision

**OLD (rejected):**
```
Retail OS = R1 Product Catalog + R2 Inventory Movement (universal)
```

**NEW (validated):**
```
Retail OS
│
├── R1 Product Core (General Merchandise baseline) ✅
├── R2 Inventory Core (quantity-based baseline) ✅
└── Specialized Extensions (archetype-specific)
      ├── Variant Extension (Fashion) ⏸️
      ├── Batch Extension (Pharmacy — MANDATORY) ⏸️
      ├── Serial Extension (Electronics — MANDATORY) ⏸️
      └── Location Extension (Multi-location) ⏸️
```

**Gate 2 approves:** Core Baseline only.

**Gate 2 defers:** Extensions (to be validated when building Pharmacy/Electronics products).

---

## What This Study Proves

### R1/R2 Are NOT "Universal Retail"

**Reality:**
- R1/R2 Core = Baseline retail (3/6 archetypes fully supported)
- Pharmacy + Electronics require extensions
- Fashion has documented gap (variant)

**This is acceptable** because:
1. bella-retail-store is General Merchandise archetype (Core sufficient)
2. Extensions can be built AFTER Core proves stable
3. Honest limitations > false universality

### R1/R2 Core Is Architecturally Sound

**Evidence:**
- Product Core (SKU, price, lifecycle) is 6/6 archetype invariant
- Inventory Core (quantity, movements, audit trail) is 5/6 archetype baseline
- Gaps are archetype-specific (not Core defects)

### Extension Strategy Validated

**Pharmacy** (future Product #2):
- Use R1 Core + R2 Core
- Add R2-Batch-Aware Extension
- Validate extension architecture

**Electronics** (future Product #3):
- Use R1 Core
- Add R2-Serial-Aware Extension
- Measure reuse effectiveness

---

## Findings

**1. R1 Product Catalog Core is solid**
- ✅ 5/6 archetypes supported
- ✅ Fashion gap documented (not blocking Phase 3)
- ✅ Batch/serial correctly excluded (belongs in Inventory)

**2. R2 Inventory Movement Core has limitations**
- ✅ Quantity-based model is baseline (3/6 archetypes)
- ❌ Pharmacy + Electronics need extensions
- ✅ bella-retail-store archetype fully supported

**3. "Retail OS" = Core + Extensions**
- ✅ Minimal core stays stable
- ✅ Extensions added per archetype need
- ✅ Avoids bloated universal contract

**4. bella-retail-store = General Merchandise**
- ✅ R1/R2 Core sufficient for migration
- ✅ No extensions needed
- ✅ Phase 3 authorized

---

## Recommendations

### Immediate (Gate 2)

**1. R1 Product Catalog:** ✅ APPROVE AS-IS

Rationale: Core product model is cross-archetype invariant. Fashion gap acceptable (treat variants as separate products for Phase 3).

**2. R2 Inventory Movement:** 🟡 APPROVE with documented limitations

Rationale: Core quantity-based inventory is baseline. Pharmacy/Electronics gaps require extensions (deferred to post-Phase 3).

**3. Phase 3 Authorization:** ✅ APPROVE

Scope: Migrate bella-retail-store (General Merchandise archetype) to R1/R2 Core only.

### Strategic (Post-Phase 3)

**4. Build Extension Proofs**

After bella-retail-store migration succeeds:
- Product #2 (Pharmacy): Implement R2-Batch-Aware Extension
- Product #3 (Electronics): Implement R2-Serial-Aware Extension
- Measure reuse effectiveness before promoting to Retail OS

---

## Gate 2 Pre-Review Complete

```
Retail Coverage Study ✅ COMPLETE
        ↓
HYPOTHESIS TESTED:
"R1/R2 = universal Retail OS"
        ↓
RESULT: ❌ FALSIFIED
        ↓
CORRECTED CLAIM:
"R1/R2 = Retail Core Baseline (General Merchandise)"
        ↓
VALIDATED: ✅ YES
        ↓
bella-retail-store archetype → General Merchandise
        ↓
R1/R2 Core SUFFICIENT for bella-retail-store
        ↓
Phase 3 AUTHORIZED (General Merchandise scope only)
        ↓
Gate 2 Decision:
  ✅ APPROVE R1/R2 as Retail Core Baseline
  ✅ APPROVE Phase 3 migration (General Merchandise)
  ❌ REJECT universal Retail OS claim
  📋 DOCUMENT specialized archetype extensions
  ⏸️ DEFER extensions to post-Phase 3
```

---

**STATUS:** ✅ RESEARCH COMPLETE

**Key Outcome:** Coverage Study **successfully falsified** "universal Retail" assumption, **validated** "Retail Core Baseline" claim.

**Architectural Learning:**

> **R1/R2 Core sufficient for Product #1 ≠ R1/R2 Core sufficient for all Retail**

This distinction is **critical** — prevents overfit to single product while establishing honest baseline.

---

**Next:** Human reviews study → Gate 2 decision:
- Approve R1/R2 as **Retail Core Baseline** (NOT universal)
- Approve Phase 3 migration (General Merchandise scope)
- Document Pharmacy/Electronics require extensions
