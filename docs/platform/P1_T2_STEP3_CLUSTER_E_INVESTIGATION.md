# Cluster E Investigation: Healthcare Diagnostics in Education Scope

**Date:** 2026-09-16  
**Checkpoint:** `c29ada87`  
**Issue:** 54 Healthcare event bus diagnostics appearing in Education TypeScript compilation

---

## Problem Statement

**Observed:** `tsconfig.education.json` compilation includes 54 TypeScript diagnostics from Healthcare event bus files:
- `platform/host/event-bus/wiring/medication-to-timeline.wiring.ts` (23 errors)
- `platform/host/event-bus/wiring/vitals-to-ai-alerts.wiring.ts` (16 errors)
- `platform/host/event-bus/wiring/bed-to-billing.wiring.ts` (15 errors)

**Total impact:** 54/231 diagnostics (23% of Education baseline)

**Question:** Why are Healthcare files included when `tsconfig.education.json` explicitly excludes `src/platform/host`?

---

## tsconfig.education.json Configuration

**Include patterns:**
```json
"include": [
  "src/platform/education/**/*.ts",
  "src/products/bella-education/**/*.ts",
  "src/app/dashboard/education/**/*.ts",
  "src/app/api/education/**/*.ts"
]
```

**Exclude patterns:**
```json
"exclude": [
  "src/platform/host",  // ← EXPLICITLY EXCLUDED
  "src/platform/healthcare",
  "src/platform/logistics",
  "src/services"
]
```

**Expected:** Healthcare event bus files should NOT be compiled  
**Actual:** 54 diagnostics from Healthcare event bus files appear

---

## Root Cause: Transitive Import Chain

### Direct Import

**File:** `src/platform/education/contracts/enrollment.contract.impl.ts` (line 5)

```typescript
import { eventBus } from '@/platform/host/event-bus';
```

**Purpose:** Education needs to publish enrollment events

---

### Barrel Export Chain

**File:** `src/platform/host/event-bus/index.ts`

```typescript
export * from './types';
export * from './event-bus.service';
export * from './memory-adapter';
export * from './initialize';  // ← PROBLEM: Pulls in wiring

export { eventBus } from './event-bus.service';
```

---

### Initialize Module

**File:** `src/platform/host/event-bus/initialize.ts`

```typescript
import { initializeEventWirings } from './wiring';  // ← Pulls in ALL wirings

export function initializeEventBus(): void {
  cleanupFn = initializeEventWirings();
}
```

---

### Wiring Index

**File:** `src/platform/host/event-bus/wiring/index.ts`

```typescript
import { wireBedToBilling } from './bed-to-billing.wiring';           // ← Healthcare
import { wireMedicationToTimeline } from './medication-to-timeline.wiring';  // ← Healthcare
import { wireVitalsToAIAlerts } from './vitals-to-ai-alerts.wiring';  // ← Healthcare

export function initializeEventWirings(): () => void {
  const unsubscribers = [
    wireBedToBilling(),           // ← Healthcare specific
    wireMedicationToTimeline(),   // ← Healthcare specific
    wireVitalsToAIAlerts(),      // ← Healthcare specific
  ];
  return () => unsubscribers.forEach(unsub => unsub());
}
```

---

## Complete Dependency Chain

```
Education enrollment.contract.impl.ts
  → imports @/platform/host/event-bus
    → barrel exports initialize.ts
      → imports wiring/index.ts
        → imports bed-to-billing.wiring.ts (Healthcare)
          → imports Healthcare types
          → 15 TypeScript diagnostics
        → imports medication-to-timeline.wiring.ts (Healthcare)
          → imports Healthcare types
          → 23 TypeScript diagnostics
        → imports vitals-to-ai-alerts.wiring.ts (Healthcare)
          → imports Healthcare types
          → 16 TypeScript diagnostics

TOTAL: 54 diagnostics from Healthcare pulled into Education scope
```

---

## Classification: UNINTENDED SCOPE LEAK

**Verdict:** ❌ UNINTENDED SCOPE LEAK

**Evidence:**
1. Education only needs `eventBus` singleton
2. Education does NOT need Healthcare-specific event wirings
3. Barrel export unnecessarily pulls initialization code
4. Initialization code unnecessarily pulls ALL wirings (including Healthcare)

**Impact:**
- Education scope polluted with Healthcare types
- 54 false-positive diagnostics
- Compilation time increased
- Circular dependency risk

---

## Legitimate vs Illegitimate Dependencies

### Legitimate

✅ Education → `eventBus` (publish/subscribe to domain events)  
✅ Education → event-bus types (`DomainEvent`, `EventHandler`)  
✅ Education → event-bus service (runtime event dispatch)

### Illegitimate (Scope Leak)

❌ Education → Healthcare wiring initialization  
❌ Education → Healthcare event handlers  
❌ Education → Healthcare domain types (Medication, Vitals, Bed)

---

## Solution Options

### Option A: Selective Barrel Export (RECOMMENDED)

**Change:** `src/platform/host/event-bus/index.ts`

**Before:**
```typescript
export * from './initialize';  // Pulls in all wirings
```

**After:**
```typescript
// Do NOT export initialize here - it pulls Healthcare wirings
// Initialize should be called explicitly by app entry point only
```

**Rationale:**
- Barrel export should only include runtime dependencies (eventBus, types)
- Initialization is app startup concern, not module import concern
- Prevents transitive import of domain-specific wirings

**Impact:** 54 Healthcare diagnostics removed from Education scope

---

### Option B: Lazy Wiring Initialization

**Change:** `src/platform/host/event-bus/initialize.ts`

**Before:**
```typescript
import { initializeEventWirings } from './wiring';  // Eager import
```

**After:**
```typescript
export async function initializeEventBus(): Promise<void> {
  // Lazy import - only loads when actually called
  const { initializeEventWirings } = await import('./wiring');
  cleanupFn = initializeEventWirings();
}
```

**Rationale:**
- Defer wiring imports until runtime initialization
- TypeScript won't analyze wirings unless initialize is called
- Preserves existing API

**Impact:** 54 Healthcare diagnostics removed from Education scope

---

### Option C: Separate Initialization Module (FUTURE)

**Create:** `src/app/initialize-event-bus.ts` (app-level, not platform)

```typescript
import { eventBus } from '@/platform/host/event-bus';
import { wireBedToBilling } from '@/platform/host/event-bus/wiring/bed-to-billing';
// ... other wirings based on app configuration

export function initializeAppEventBus(): void {
  const wirings = [];
  
  if (featureFlags.healthcare) {
    wirings.push(wireBedToBilling());
    wirings.push(wireMedicationToTimeline());
    wirings.push(wireVitalsToAIAlerts());
  }
  
  if (featureFlags.education) {
    // Education-specific wirings only
  }
  
  return () => wirings.forEach(unsub => unsub());
}
```

**Rationale:**
- App-level knows which OSs are active
- Platform provides building blocks
- Prevents cross-OS coupling at platform layer

**Impact:** Complete separation of OS-specific event wirings

---

## Recommendation

**Immediate (P1-T2):** **Option A** - Remove `initialize` from barrel export

**Rationale:**
- Minimal code change
- Immediately fixes scope leak
- Education baseline drops from 231 → 177
- No behavioral changes (initialize still callable directly)

**Implementation:**
1. Remove `export * from './initialize'` from `event-bus/index.ts`
2. Update app entry point to import initialize directly
3. Re-run Education TypeScript compilation
4. Verify: 54 diagnostics removed

**Future (post-hardening):** Consider Option C for better OS isolation

---

## Impact on Education Baseline

**Current:** 231 diagnostics (includes 54 Healthcare)  
**After fix:** 177 diagnostics (Education-owned only)

**Revised cluster analysis:**
- Cluster A (SupabaseClient): 24 diagnostics
- Cluster B (payroll-provider): 49 diagnostics  
- Cluster C (supabase-education.repository): 48 diagnostics
- Cluster D (Property naming): 15 diagnostics
- ~~Cluster E (Healthcare leak): 54 diagnostics~~ → REMOVED

**Remaining:** 177 Education-owned diagnostics

---

## Verification Plan

1. ✅ Dependency chain traced
2. ✅ Root cause identified (barrel export)
3. ✅ Classification: UNINTENDED SCOPE LEAK
4. ⏳ Implement Option A
5. ⏳ Verify baseline: 231 → 177
6. ⏳ Confirm no behavioral regression
7. ⏳ Update Education cluster analysis

---

**Status:** Investigation complete, solution identified  
**Next:** Implement Option A → verify new Education baseline → resume cluster-based cleanup
