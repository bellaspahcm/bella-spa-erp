# Host Platform Blockers Analysis

**Date:** 2026-09-03  
**Status:** BLOCKED — Architectural Decisions Required  
**Context:** Host remediation 47→21 diagnostics, 2 independent blockers remain

---

## Blocker 1: ContractDefinition Type Missing (4 errors)

### Root Cause
Four contract files import non-existent type `ContractDefinition` from contract-registry.service:

```typescript
import { ContractDefinition } from '@/platform/host/contract-registry/contract-registry.service';
```

### Affected Files
1. `src/platform/host/analytics-engine/analytics-engine.contract.ts`
2. `src/platform/host/rollback-engine/rollback-engine.contract.ts`
3. `src/platform/host/rule-engine/rule-engine.contract.ts`
4. `src/platform/host/temporal-engine/temporal-engine.contract.ts`

### Error
```
TS2305: Module '"@/platform/host/contract-registry/contract-registry.service"' 
has no exported member 'ContractDefinition'.
```

### Evidence

**What exists in contract-registry:**
- `ContractMetadata` interface (exported from types.ts)
- Fields: `name`, `version`, `type`, `owner`, `status`, `endpoints`, `schemas`, `dependencies`, `registeredAt`, `updatedAt`

**What contract files use:**
- `ContractDefinition` (undefined type)
- Fields: `id`, `name`, `version`, `description`, `provider`, `consumers`, `methods`, `events`, `featureFlag`, `status`, `createdAt`

### Semantic Question

**Two different contract models exist:**

**Model A: ContractMetadata (registry-centric)**
- Formal REST API contract registration
- Endpoint definitions with OpenAPI-style schemas
- Versioning and deprecation management
- Designed for Constitution Law 8 (Registry-First & ADR)

**Model B: ContractDefinition (engine-centric)**
- Lightweight engine capability declaration
- Method list with JSON schemas
- Provider/consumer relationships
- Feature flag integration

**Decision Required:**
1. Are these two distinct contract types (public API vs internal engine capability)?
2. Should engine contracts use ContractMetadata?
3. Should ContractDefinition be created as separate type?
4. Is there semantic ownership conflict?

### Possible Resolutions

**Option 1: Create ContractDefinition type**
- Define proper interface matching current usage
- Export from contract-registry/types.ts
- Clarify relationship with ContractMetadata

**Option 2: Adapt to ContractMetadata**
- Convert engine contracts to use ContractMetadata structure
- Map `methods` → `endpoints`
- Requires semantic alignment

**Option 3: Inline type definition**
- Define contract type locally in each file
- Decouple from registry
- May lose centralized contract management

### Recommendation

**STOP — Architectural decision required.**

This is NOT a mechanical fix. Requires clarity on:
- Contract registry ownership model
- Distinction between API contracts vs engine capabilities
- Constitution Law 8 implementation intent

**Do NOT:**
- Create `type ContractDefinition = any`
- Use suppression or skipLibCheck
- Duplicate ContractMetadata with different name

---

## Blocker 2: rollback-engine → Healthcare Access (17 errors)

### Root Cause
Host Platform rollback-engine.service.ts directly accesses Healthcare Kernel tables and RPCs that are not in platform-wide database.types.ts.

### Affected File
`src/platform/host/rollback-engine/rollback-engine.service.ts`

### Errors (17 total)

**1. Healthcare table access (lines 156, 182):**
```typescript
// Line 156
.from('hc_bed_allocations')  // ❌ Not in database.types.ts

// Line 182  
.from('commission')           // ❌ Type mismatch
```

**Error:**
```
TS2769: No overload matches this call.
Argument of type '"hc_bed_allocations"' is not assignable to parameter of type [known tables]
```

**2. Field type mismatches (lines 126, 145, 158-160, 184-190):**
```typescript
// Line 126
status: string  // ❌ Should be specific enum type

// Lines 158-160, 184-190
Type 'string' is not assignable to type 'never'
Type 'number' is not assignable to type 'never'
```

**3. RPC access (line 196):**
```typescript
.rpc('increment_inventory')  // ❌ Not in database.types.ts
```

**Error:**
```
TS2345: Argument of type '"increment_inventory"' is not assignable to parameter of type [known RPCs]
```

### Architecture Boundary Violation

**Current situation:**
```
Host Platform (rollback-engine)
    ↓ (direct DB access)
Healthcare Kernel (hc_bed_allocations, commission)
```

**Problem:**
- Host is cross-industry Platform Core
- Healthcare is Industry Kernel
- Direct table/RPC access creates tight coupling
- Violates layer boundary (Platform should not know Healthcare schema)

### Evidence

**database.types.ts does NOT include:**
- `hc_bed_allocations` table
- `commission` table (or has different structure)
- `increment_inventory` RPC
- Healthcare-specific enums/status types

**rollback-engine.service.ts implements:**
- Compensating transactions for Healthcare operations
- Direct schema knowledge of Healthcare tables
- Hardcoded Healthcare business logic

### Semantic Question

**Is this a legitimate use case or boundary violation?**

**Scenario A: Rollback is Platform capability**
- Platform Core can provide generic compensating transaction pattern
- But should NOT have Healthcare-specific compensation logic
- Healthcare Kernel should own its own rollback handlers

**Scenario B: Rollback needs Healthcare knowledge**
- Platform rollback-engine coordinates across Kernels
- Requires schema knowledge to perform compensation
- But then it's Healthcare-specific, not Platform Core

### Architectural Decision Required

**Options:**

**Option 1: Move Healthcare compensation to Healthcare Kernel**
- Create `healthcare/engines/compensation.service.ts`
- Platform rollback-engine provides interface/coordinator only
- Each Kernel implements its own compensation handlers
- ✅ Preserves layer boundaries
- ✅ Kernel-first principle
- ❌ Requires refactor

**Option 2: Make rollback-engine Healthcare-aware**
- Accept that rollback needs cross-Kernel visibility
- Import Healthcare types properly
- Document as intentional coupling
- ❌ Violates Platform/Kernel boundary
- ❌ Not reusable for other Industries

**Option 3: Generic compensation pattern**
- Rollback-engine provides event-based compensation API
- Healthcare registers compensation handlers
- Platform coordinates without schema knowledge
- ✅ Preserves boundaries
- ✅ Reusable pattern
- ❌ Requires design work

### Recommendation

**STOP — Architectural decision required.**

This is NOT a type-casting fix. Questions to resolve:

1. Should Platform Core have Healthcare-specific logic?
2. Is compensation a Kernel responsibility or Platform service?
3. How should cross-Kernel transactions be coordinated?
4. What is the correct ownership boundary?

**Do NOT:**
- Cast to `any` to bypass type errors
- Add Healthcare tables to Platform database.types.ts
- Suppress errors with `@ts-ignore`
- Create fake interfaces to satisfy compiler

**Evidence needed:**
- Architectural decision on compensation ownership
- If Platform: design generic pattern without schema coupling
- If Healthcare: move compensation logic to Healthcare Kernel

---

## Summary

**Both blockers are SEMANTIC/ARCHITECTURAL, not mechanical.**

| Blocker | Errors | Type | Resolution |
|---------|--------|------|------------|
| ContractDefinition | 4 | Semantic ownership | Define proper contract model |
| rollback → Healthcare | 17 | Architecture boundary | Clarify layer responsibility |

**Total remaining diagnostics:** 21 (47→21, 26 resolved)

**Next steps:**
1. Architectural decisions on both blockers
2. Do NOT use workarounds (any, suppression, fake types)
3. Evidence-based resolution with proper ownership

**Status:** Host remediation at MAXIMUM SAFE point. Further progress requires architectural clarity.

**Governance:** ✅ AI_CODING_CONTRACT "Never Guess Semantics" principle upheld

---

**References:**
- Bella Development Principles (AGENTS.md)
- AI_CODING_CONTRACT v1.2
- Host Remediation Report (HOST_REMEDIATION_2026_09_03.md)
