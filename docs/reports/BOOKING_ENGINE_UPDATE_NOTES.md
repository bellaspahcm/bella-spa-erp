# Booking Engine - Update Notes

**Date**: 2026-07-09  
**Type**: Terminology & Architecture Alignment

---

## 🔄 CHANGES MADE

### 1. Terminology Updates

**Before** (Inconsistent):
- ❌ "6 Core Engines"
- ❌ "Auto-Assignment Engine"
- ❌ "Capacity Management Engine"
- ❌ "Conflict Detection Engine"
- ❌ "Waitlist Management Engine"
- ❌ "Dynamic Pricing Engine"
- ❌ "Cancellation Logic Engine"

**After** (Consistent):
- ✅ "Booking Engine - 6 Core Providers"
- ✅ "Assignment Provider"
- ✅ "Capacity Provider"
- ✅ "Conflict Provider"
- ✅ "Waitlist Provider"
- ✅ "Pricing Provider"
- ✅ "Cancellation Provider"

---

## 🏗️ ARCHITECTURE CLARIFICATION

### Correct Structure

```
┌─────────────────────────────────────────┐
│         CORE PLATFORM LAYER             │
│                                         │
│  Decision Engine (Core)                 │
│    ├── Booking Provider      ✅        │
│    ├── Discount Provider     ✅        │
│    ├── Payroll Provider      ✅        │
│    ├── Commission Provider   ✅        │
│    └── Inventory Provider    ✅        │
│                                         │
│  Workflow Engine (Core)       ✅        │
│  BI Engine (Core)             ✅        │
│  Observability Layer          ✅        │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│       BUSINESS ENGINE LAYER             │
│                                         │
│  Booking Engine (Business)   ← NEW     │
│    ├── Assignment Provider              │
│    ├── Capacity Provider                │
│    ├── Conflict Provider                │
│    ├── Waitlist Provider                │
│    ├── Pricing Provider                 │
│    └── Cancellation Provider            │
│                                         │
│  Payroll Engine (Future)                │
│  POS Engine (Future)                    │
│  CRM Engine (Future)                    │
└─────────────────────────────────────────┘
```

### Key Distinctions

**Decision Engine Providers** (Core Platform):
- Generic, reusable decision logic
- Used across multiple business modules
- Example: `Booking Provider` evaluates booking approval (any module can use)

**Business Engine Providers** (Business Layer):
- Specific to one business domain
- Implements business-specific logic
- Example: `Assignment Provider` only for Booking Engine

---

## 📂 FILE STRUCTURE

### Updated Structure

```
src/lib/decision-engine/providers/
  ├── booking/                    ← Core Platform Provider
  │   ├── rules/
  │   ├── booking-provider.ts
  │   └── types.ts
  │
  ├── payroll/                    ← Core Platform Provider
  │   ├── rules/
  │   ├── payroll-provider.ts
  │   └── types.ts
  │
  └── commission/                 ← Core Platform Provider
      ├── rules/
      ├── commission-provider.ts
      └── types.ts

src/modules/booking/
  ├── engine/                     ← NEW: Business Engine
  │   ├── providers/
  │   │   ├── assignment/
  │   │   ├── capacity/
  │   │   ├── conflict/
  │   │   ├── waitlist/
  │   │   ├── pricing/
  │   │   └── cancellation/
  │   └── booking-engine.ts
  │
  ├── actions/
  ├── components/
  └── types/
```

**Alternative** (Keep all providers in decision-engine):
```
src/lib/decision-engine/providers/
  ├── booking/                    ← Core (approval decisions)
  ├── booking-engine/             ← Business-specific
  │   ├── assignment/
  │   ├── capacity/
  │   ├── conflict/
  │   ├── waitlist/
  │   ├── pricing/
  │   └── cancellation/
  ├── payroll/
  └── commission/
```

---

## 📋 UPDATED DOCUMENTS

### 1. `BOOKING_ENGINE_THIET_KE.md`
**Changes**:
- ✅ Đổi "6 Engine Cốt Lõi" → "Booking Engine - 6 Core Providers"
- ✅ Đổi tên 6 providers (Engine → Provider)
- ✅ Thêm architecture diagram
- ✅ Giải thích vị trí trong kiến trúc tổng thể

### 2. `BOOKING_ENGINE_DESIGN_SPEC.md`
**Changes**:
- ✅ Đổi "6 Core Engines" → "Booking Engine - 6 Core Providers"
- ✅ Đổi tên 6 providers
- ✅ Thêm architecture position section
- ✅ Phân biệt Core vs Business layer

### 3. `BOOKING_ENGINE_TASK_BREAKDOWN.md`
**Changes**:
- ✅ Đổi tên tasks (Auto-Assignment → Assignment, etc.)
- ✅ Update file paths (`providers/booking/assignment/` instead of `providers/auto-assignment/`)
- ✅ Thêm architecture note
- ✅ Ví dụ file structure

---

## 🎯 WHY THESE CHANGES?

### Problem Before
- Mixing terminology: "Engine" vs "Provider" used inconsistently
- Confusion: Is Booking Engine part of Decision Engine?
- Unclear hierarchy: What's Core vs Business?

### Solution After
- **Consistent terminology**: "Engine" = Platform or Business level, "Provider" = Component inside Engine
- **Clear hierarchy**: Core Platform → Business Engine → Provider
- **Matches existing patterns**: Payroll Engine → Commission Provider (same structure)

---

## 📖 NAMING CONVENTIONS (Platform-wide)

### Terminology Hierarchy

**Level 1: Core Platform**
- Decision Engine
- Workflow Engine
- BI Engine

**Level 2: Business Engine**
- Booking Engine
- Payroll Engine
- POS Engine
- CRM Engine

**Level 3: Provider/Capability**
- Assignment Provider (inside Booking Engine)
- Capacity Provider (inside Booking Engine)
- Commission Provider (inside Payroll Engine)

### Rules

1. **"Engine"** = Top-level system (Core or Business)
2. **"Provider"** = Component that implements specific logic
3. **"Module"** = Business domain grouping (e.g., `src/modules/booking/`)
4. **"Service"** = Utility/helper functions (e.g., `booking-service.ts`)

---

## ✅ WHAT DIDN'T CHANGE

**No code changes needed**:
- ✅ Existing Decision Engine Providers (Booking, Payroll, Commission, Inventory) unchanged
- ✅ Workflow Engine unchanged
- ✅ Observability Layer unchanged
- ✅ Database schema unchanged

**Only documentation updated**:
- 3 Booking Engine design docs
- Terminology alignment
- Architecture clarification

---

## 🚀 NEXT STEPS

1. ✅ Terminology aligned across 3 docs
2. 📋 Architecture conventions documented
3. 📋 Ready to start implementation (provider-first approach)
4. 📋 Consider creating `BELLA_ARCHITECTURE_CONVENTIONS.md` for platform-wide reference

---

**Created**: 2026-07-09  
**Author**: AI Assistant  
**Reviewed**: Pending
