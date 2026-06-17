# Cross-Boundary Import Violations Report

**Date:** 2026-06-17  
**Scope:** Core ↔ Modules boundary enforcement

## Summary

✅ **No cross-boundary import violations found!**

## Architecture Boundaries

### Rule 1: Core → Modules (FORBIDDEN)

```
src/core/  ❌→  src/modules/
```

**Status:** ✅ **COMPLIANT**

Core services do NOT import from modules. This ensures:
- Core remains industry-agnostic
- Core can be reused across industries
- Modules are truly optional

**Verification:**
```bash
grep -r "from ['\"]@/modules/" src/core/
# Result: No matches found
```

### Rule 2: Modules → Core (ALLOWED via Interfaces)

```
src/modules/  ✓→  src/core/
```

**Status:** ✅ **COMPLIANT**

Modules correctly import from core through:
- Public service interfaces
- Shared types and contracts
- Utility functions
- Business rule constants

**Examples:**
```typescript
// ✅ Correct - Module imports from core
import { createBooking } from '@/core/services/order';
import { BUSINESS_RULES } from '@/constants/business-rules';
import type { CoreBookingOrder } from '@/core/types';
```

### Rule 3: Modules → Modules (FORBIDDEN)

```
src/modules/spa/  ❌→  src/modules/hr-salary/
```

**Status:** ✅ **COMPLIANT**

Modules are independent and don't import from each other.
Shared functionality is in core, not cross-module.

## Adapter Pattern Implementation

Modules integrate with core through **adapter pattern**:

### Spa Module Adapter

```typescript
// src/modules/spa/adapters/spa-booking-adapter.ts
export const spaBookingAdapter = {
  validateBooking(input) {
    // Spa-specific validation
  },
  
  calculatePrice(input) {
    // Spa-specific pricing
  },
  
  onBookingCompleted(booking) {
    // Spa-specific side effects
  }
};
```

### Core Uses Adapters

```typescript
// src/core/services/order/create-booking-action.ts
const adapter = await resolveBookingAdapter(tenantContext);
const validationResult = await adapter.validateBooking(payload);
```

This pattern ensures:
- ✅ Core doesn't know about specific modules
- ✅ Modules can be added/removed without changing core
- ✅ Clear extension points for new industries

## Import Guidelines

### ✅ Allowed Patterns

```typescript
// Modules can import from core
import { createBooking } from '@/core/services/order';
import { BUSINESS_RULES } from '@/constants/business-rules';
import type { Database } from '@/types/database.types';

// Core can import from shared libraries
import { calculateProRata } from '@/lib/business-rules/salary';
import { safeRevalidatePath } from '@/lib/revalidate';

// Modules can import from lib
import { buildSalaryDisplayComponents } from '@/lib/business-rules/salary';
```

### ❌ Forbidden Patterns

```typescript
// Core MUST NOT import from modules
import { SpaSalaryService } from '@/modules/spa/services'; // ❌ FORBIDDEN

// Modules MUST NOT import from each other
import { RetailInventory } from '@/modules/retail/services'; // ❌ FORBIDDEN
```

## Architecture Diagram

```
┌─────────────────────────────────────┐
│          UI Layer (App)              │
│     Can import from anywhere         │
└─────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────┐
│       Services Layer (Actions)       │
│     Orchestrates core + modules      │
└─────────────────────────────────────┘
         ↓               ↓
┌──────────────┐  ┌──────────────────┐
│    Core      │  │    Modules       │
│  (Generic)   │←─│  (Industry)      │
└──────────────┘  └──────────────────┘
         ↓               ↓
┌─────────────────────────────────────┐
│       Shared Libraries (Lib)         │
│   Business rules, utilities, types   │
└─────────────────────────────────────┘
```

## ESLint Rule Recommendation

Add to `.eslintrc.json` to enforce boundaries:

```json
{
  "rules": {
    "no-restricted-imports": ["error", {
      "patterns": [{
        "group": ["**/modules/**"],
        "message": "Core services must not import from modules. Use adapters instead."
      }]
    }]
  },
  "overrides": [{
    "files": ["src/core/**/*.ts", "src/core/**/*.tsx"],
    "rules": {
      "no-restricted-imports": ["error", {
        "patterns": [{
          "group": ["**/modules/**"],
          "message": "Core must not import from modules."
        }]
      }]
    }
  }]
}
```

## Monitoring

### Manual Check

```bash
# Check core doesn't import from modules
grep -r "from ['\"]@/modules/" src/core/

# Check modules don't import from each other
grep -r "from ['\"]@/modules/" src/modules/spa/
grep -r "from ['\"]@/modules/" src/modules/hr-salary/
```

### Automated Check (CI/CD)

Add to `package.json`:

```json
{
  "scripts": {
    "check:boundaries": "eslint src/core --rule 'no-restricted-imports: [\"error\", {\"patterns\": [\"**/modules/**\"]}]'"
  }
}
```

## Conclusion

The Bella ERP codebase maintains **excellent architectural boundaries**:

- ✅ Core is module-agnostic
- ✅ Modules depend on core (not vice versa)
- ✅ Modules are independent of each other
- ✅ Adapter pattern used correctly
- ✅ Clear separation of concerns

**Status:** ✅ COMPLIANT  
**Action Required:** None - maintain current standards

---

**Related Documentation:**
- Circular dependencies: `/docs/architecture/CIRCULAR_DEPENDENCIES_REPORT.md`
- Architecture overview: `/docs/index.md`
- Module development: `/docs/INDUSTRY_MODULE_DEVELOPMENT_PLAYBOOK.md`
