# Logistics OS Kernel — Quick Reference

**Version:** 1.0.0  
**Last Updated:** 2026-08-22

---

## 🔒 Frozen Layers

| Layer | Status | Artifacts | Tests | Can Modify? |
|-------|--------|-----------|-------|-------------|
| E7.1 Domain | 🔒 SEALED | 12 | 366 | ❌ ACR Required |
| E7.2 Operations | 🔒 SEALED | 1 | 73 | ❌ ACR Required |
| E7.3 Rules | 🔒 SEALED | 9 | 108 | ❌ ACR Required |

---

## ⚡ Quick Commands

```bash
# Verify architecture before commit
npm run arch:guard

# Run all Logistics tests
npm run logistics:verify

# Run specific layer tests
npm test -- src/platform/logistics/domain/__tests__/          # E7.1 + E7.2
npm test -- src/platform/logistics/domain/rules/__tests__/    # E7.3
```

---

## 📦 What Each Layer Provides

### E7.1: Domain Kernel

**Use when:** Working with core inventory/movement entities

```typescript
import {
  InventoryItem,
  createInventoryItem,
  Movement,
  MovementType,
  TraceabilityMetadata,
  UnitOfMeasure,
  Location,
  Item,
} from '@/platform/logistics/domain';
```

**Key Capabilities:**
- Entity creation and validation
- State management (ACTIVE, QUARANTINE, EXPIRED, etc.)
- Movement tracking primitives
- Traceability metadata

### E7.2: Operational Kernel

**Use when:** Performing inventory operations

```typescript
import {
  reserveInventory,
  releaseReservation,
  confirmReception,
  confirmAdjustment,
  confirmTransfer,
} from '@/platform/logistics/domain/inventory-operations.domain';
```

**Key Capabilities:**
- Reserve/release inventory
- Confirm movements (reception, adjustment, transfer)
- Operational invariants
- Event generation

### E7.3: Rules & Traceability

**Use when:** Evaluating compliance or querying lineage

```typescript
import {
  evaluateInventoryCompliance,
  queryUpstreamLineage,
  queryDownstreamLineage,
  validateTraceabilityChain,
  composeRules,
} from '@/platform/logistics/domain/rules';
```

**Key Capabilities:**
- Rule evaluation (expiry, quantity, traceability)
- Compliance reporting
- Lineage queries (upstream/downstream)
- Chain validation

---

## 🚫 What You CANNOT Do

### ❌ Modify Frozen Files

```typescript
// ❌ BLOCKED by architecture guard
// File: src/platform/logistics/domain/inventory.types.ts
export type NewField = string; // ERROR: Frozen file
```

**Instead:** Create new types in your product layer

```typescript
// ✅ ALLOWED
// File: src/products/warehouse/types.ts
import { InventoryItem } from '@/platform/logistics/domain';

export type WarehouseInventory = InventoryItem & {
  warehouseSpecificField: string;
};
```

### ❌ Import Product Code in Kernel

```typescript
// ❌ BLOCKED by architecture guard
// File: src/platform/logistics/domain/rules/my-rule.ts
import { WarehouseService } from '@/products/warehouse'; // ERROR: Forbidden import
```

**Instead:** Product imports kernel, not the other way around

```typescript
// ✅ ALLOWED
// File: src/products/warehouse/services/inventory.service.ts
import { evaluateInventoryCompliance } from '@/platform/logistics/domain/rules';

export class WarehouseService {
  async checkCompliance(inventoryId: string) {
    const report = await evaluateInventoryCompliance(/* ... */);
    // Product decides what to do with report
    if (report.status === 'VIOLATION') {
      await this.handleViolation(report);
    }
  }
}
```

### ❌ Execute Workflows in Rules

```typescript
// ❌ BLOCKED by design
// File: src/platform/logistics/domain/rules/my-rule.ts
export const myRule: Rule<InventoryContext> = {
  evaluate(context) {
    if (context.inventory.state === 'EXPIRED') {
      sendNotification(); // ❌ ERROR: Side effect
      createTask(); // ❌ ERROR: Workflow execution
    }
  }
};
```

**Instead:** Return facts, let Product handle actions

```typescript
// ✅ ALLOWED
export const expiryRule: Rule<InventoryContext> = {
  evaluate(context) {
    if (context.inventory.state === 'EXPIRED') {
      return {
        status: 'VIOLATION',
        evidence: { /* facts */ },
      };
    }
    return { status: 'PASS' };
  }
};

// Product layer decides actions
if (ruleResult.status === 'VIOLATION') {
  await notificationService.send(/* ... */);
  await taskService.create(/* ... */);
}
```

---

## 📚 Common Patterns

### Pattern 1: Evaluate Compliance

```typescript
import { evaluateInventoryCompliance } from '@/platform/logistics/domain/rules';

const report = await evaluateInventoryCompliance(
  inventory,
  movements,
  new Date()
);

if (report.status === 'VIOLATION') {
  console.log('Violations found:', report.violations);
  // Product decides what to do
}
```

### Pattern 2: Query Lineage

```typescript
import {
  queryUpstreamLineage,
  queryDownstreamLineage,
} from '@/platform/logistics/domain/rules';

// Where did this come from?
const sources = queryUpstreamLineage(
  inventoryId,
  movements,
  new Date('2026-01-01') // optional cutoff
);

// Where did this go?
const destinations = queryDownstreamLineage(
  inventoryId,
  movements
);
```

### Pattern 3: Compose Multiple Rules

```typescript
import { composeRules } from '@/platform/logistics/domain/rules';
import {
  expiryRule,
  lowStockRule,
  traceabilityRule,
} from '@/platform/logistics/domain/rules';

const results = composeRules.evaluateAll(
  [expiryRule, lowStockRule, traceabilityRule],
  context,
  new Date()
);

// Check if any rule failed
const hasViolations = results.some(r => r.status === 'VIOLATION');
```

### Pattern 4: Extend with Product Rules

```typescript
// ✅ Product can create its own rules
import { Rule } from '@/platform/logistics/domain/rules';

export const warehouseSpecificRule: Rule<InventoryContext> = {
  id: 'warehouse-zone-check',
  version: '1.0.0',
  evaluate(context, evaluationDate) {
    // Product-specific logic
    if (context.inventory.locationId.startsWith('ZONE-X')) {
      // ...
    }
    return { status: 'PASS' };
  }
};

// Compose with kernel rules
const allResults = composeRules.evaluateAll(
  [...kernelRules, warehouseSpecificRule],
  context,
  new Date()
);
```

---

## 🔧 Need to Modify Frozen Code?

### Process

1. **Create ACR** (Architecture Change Request)
   - Template: `docs/architecture/templates/ACR_TEMPLATE.md`
   - Fill out: reason, impact, alternatives

2. **Submit for Review**
   - Send to: Platform Architecture Team
   - Expected timeline: 3-5 business days

3. **Document ADR**
   - After approval, create ADR
   - Template: `docs/architecture/decisions/ADR-XXXX-*.md`

4. **Unlock → Modify → Re-seal**
   - Architecture team will unlock layer
   - Make changes
   - Run full regression (547/547 must pass)
   - Re-seal layer

---

## 🆘 Troubleshooting

### Architecture Guard Blocks My Tool

**Error:**
```
🔒 FROZEN BOUNDARY VIOLATION BLOCKED
Layer: E7.3 Rules & Traceability
Artifact: src/platform/logistics/domain/rules/traceability.operations.ts
```

**Solution:**
- You're trying to modify a frozen file
- Check if you can implement your feature WITHOUT modifying frozen code
- If modification is truly needed, create ACR

### Import Is Forbidden

**Error:**
```
❌ FORBIDDEN_IMPORT
File: src/platform/logistics/domain/rules/my-rule.ts
Import: src/products/warehouse/service.ts
```

**Solution:**
- Kernel cannot import Product code
- Reverse the dependency: Product imports Kernel
- Move shared logic to a common utility

### Tests Fail After My Changes

**Error:**
```
npm run logistics:verify
Tests: 543 passed, 4 failed, 547 total
```

**Solution:**
- All 547 tests must pass before merge
- Fix failing tests
- Do not modify frozen test files
- If frozen tests are wrong, create ACR

---

## 📖 Full Documentation

- **Architecture:** `docs/architecture/FREEZE_POLICY.md`
- **E7.1 Docs:** `docs/implementation/E7_1_*.md`
- **E7.3 Docs:** `docs/implementation/E7_3_*.md`
- **Guard Details:** `docs/implementation/ARCHITECTURE_GUARD_IMPLEMENTATION.md`
- **Complete Summary:** `docs/implementation/LOGISTICS_OS_KERNEL_COMPLETE.md`

---

## 💡 Quick Tips

1. **Always import from kernel, never modify it**
2. **Run `npm run arch:guard` before committing**
3. **Rules return facts, Products make decisions**
4. **547 tests must always pass**
5. **When in doubt, ask Architecture Team**

---

**Need Help?** Contact: Platform Architecture Team  
**Frozen Layers:** E7.1, E7.2, E7.3  
**Status:** 🔒 SEALED
