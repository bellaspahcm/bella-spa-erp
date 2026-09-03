# Logistics Compiler Remediation Plan

**Date:** 2026-09-03  
**Status:** EVIDENCE-BASED REMEDIATION READY  
**Root Cause:** PROVEN - Repository + Supabase Database type propagation

---

## Investigation Results (Phase 1B)

### Binary Isolation Evidence

| Scope | Duration | Result | Verdict |
|-------|----------|--------|---------|
| **Full Logistics** | >300s | Timeout | ❌ HOTSPOT |
| **Domain only** | 2.36s | 282 diagnostics | ✅ FAST (has fixable errors) |
| **Repositories + DB types** | >200s | Timeout | ❌ HOTSPOT |

### Conclusion

**Root Cause PROVEN:** Repository layer + Supabase `Database` type propagation

**Evidence:**
- Domain compiles quickly (2.36s) → Domain is NOT bottleneck
- Adding repositories + database.types.ts → Immediate timeout
- Causal link established

**Investigation STOPPED:** Sufficient evidence for targeted remediation. Further dissection would be over-engineering.

---

## Current Repository Pattern (Problematic)

```typescript
// src/platform/logistics/repositories/inventory.repository.ts

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

// Targeted types (good)
type LogisticsInventory = Database['logistics']['Tables']['inventory']['Row'];
type LogisticsInventoryInsert = Database['logistics']['Tables']['inventory']['Insert'];
type LogisticsInventoryUpdate = Database['logistics']['Tables']['inventory']['Update'];

export class InventoryRepository implements IInventoryRepository {
  constructor(private db: SupabaseClient<Database>) {}
  //                                       ^^^^^^^^
  //                     Full Database generic → Type instantiation explosion
  
  async findById(tenantId: string, inventoryId: string): Promise<Result<Inventory | null>> {
    const { data, error } = await this.db
      .from('inventory')
      .select('*')
      // ... query chain with inferred types propagating through Database generic
  }
}
```

**Problem:**
- `SupabaseClient<Database>` forces TypeScript to instantiate entire Database schema
- Every `.from(table).select()` chain infers types through full Database generic
- With 6+ Logistics tables + all other Platform tables, creates pathological type resolution

---

## Lean Remediation Strategy

### Approach: Add Explicit Return Types at Repository Boundary

**Principle:** Limit type inference propagation WITHOUT changing architecture

**NOT doing:**
- ❌ Creating new abstraction layers
- ❌ Building generic repository framework
- ❌ Custom database typing system
- ❌ Architecture changes
- ❌ Removing generated types

**Doing:**
- ✅ Add explicit return types to repository methods
- ✅ Use targeted `Tables<'table_name'>` imports
- ✅ Prevent inference cascade at boundary
- ✅ Keep generated database.types.ts canonical

### Pattern Fix

**From:**
```typescript
async findById(tenantId: string, inventoryId: string): Promise<Result<Inventory | null>> {
  const { data, error } = await this.db
    .from('inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', inventoryId)
    .maybeSingle();
  // data type inferred through Database generic → explosion
}
```

**To:**
```typescript
async findById(tenantId: string, inventoryId: string): Promise<Result<Inventory | null>> {
  const { data, error } = await this.db
    .from('inventory')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('id', inventoryId)
    .maybeSingle() as { data: LogisticsInventory | null; error: PostgrestError | null };
  // Explicit type assertion limits inference propagation
}
```

Or alternative (cleaner):
```typescript
async findById(tenantId: string, inventoryId: string): Promise<Result<Inventory | null>> {
  const response: { data: LogisticsInventory | null; error: PostgrestError | null } = 
    await this.db
      .from('inventory')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', inventoryId)
      .maybeSingle();
  
  if (response.error) {
    return Result.fail(`Database error: ${response.error.message}`, 'DB_ERROR');
  }
  // ... rest
}
```

---

## Execution Plan

### Step 1: Fix One Repository (Inventory - Smallest)

1. Read `inventory.repository.ts` fully
2. Add explicit return type annotations to query results
3. Use `LogisticsInventory` type already defined
4. Import `PostgrestError` from Supabase if needed
5. Commit with evidence

### Step 2: Test Compilation

Run canonical Gate B:
```bash
npx tsc -p tsconfig.platform-logistics.json --noEmit
```

**Expected outcomes:**

**A. PASS (<60s, 0 errors):**
- ✅ Root cause fixed
- ✅ STOP remediation
- ✅ Proceed to Architecture Guard + Regression
- ✅ Document as Known Pattern #6

**B. IMPROVED but still HOTSPOT (60-180s):**
- Partial fix, continue to other repositories
- Apply same pattern to item.repository.ts, movement.repository.ts
- Iterate until PASS

**C. NO IMPROVEMENT (>180s timeout):**
- Pattern insufficient
- Deeper investigation required
- Consider alternative: Supabase client scope reduction

### Step 3: If PASS - Verify Full Platform

Run full Gate B matrix:
```bash
npm run governance:typecheck
```

Ensure:
- Logistics: PASS
- All other scopes: PASS (no regression)
- Total compile time reasonable

### Step 4: Gates

1. Architecture Guard: PASS
2. Regression Protection: ALLOW
3. Commit + evidence

---

## Success Criteria

```
Logistics Repository Remediation = COMPLETE
    ↓
Canonical Gate B: PASS
    ↓
Compilation time < 60s (reasonable for 30K LOC)
    ↓
0 new diagnostics
    ↓
No workarounds (no skipLibCheck, no any, no exclusions)
    ↓
Architecture preserved
    ↓
Repository boundary explicit types added
    ↓
Known Pattern #6 documented
```

---

## Known Pattern #6 (If Successful)

**Pattern:** Supabase Database Generic Type Instantiation Explosion

**Symptom:** Compiler timeout (>180s) in repositories using `SupabaseClient<Database>`

**Root Cause:** Full `Database` generic forces instantiation of entire schema through query builder chains

**Fix:** Add explicit return type annotations at repository query boundaries using targeted table types

**Evidence:** Logistics repositories (this fix), potentially others

**Prevention:** 
- Use targeted `Tables<'table_name'>` types
- Add explicit return types to repository methods
- Limit inference propagation at data access boundary

---

## Constraints

**Lean Remediation Rules:**

✅ **DO:**
- Fix at proven bottleneck (repository + DB type boundary)
- Use targeted explicit types
- Test after each fix
- Stop when Gate B PASS achieved
- Document Known Pattern if successful

❌ **DO NOT:**
- Over-engineer abstraction layers
- Build generic framework
- Change architecture
- Continue investigation beyond evidence need
- Create custom type systems

**Governance Compliance:**
- ✅ Canonical tsconfig unchanged
- ✅ No skipLibCheck
- ✅ No any/suppression
- ✅ No workarounds
- ✅ Architecture preserved
- ✅ Type safety maintained

---

## References

- Investigation evidence: LOGISTICS_COMPILER_ROOT_CAUSE.md Phase 1B results
- Known Pattern Rule: AI_CODING_CONTRACT.md
- Lean principles: AGENTS.md Principle #7 (Minimal Complexity)

**Last Updated:** 2026-09-03  
**Status:** REMEDIATION READY  
**Root Cause:** PROVEN (Repository + DB type propagation)  
**Fix:** Explicit return types at repository boundary
