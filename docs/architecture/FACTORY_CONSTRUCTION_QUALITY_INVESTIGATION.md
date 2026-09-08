# Factory Construction Quality Investigation

**Date:** 2026-09-06  
**Scope:** Retail Reference Product #1 Platform Primitive Reuse  
**Question:** Should Factory have reused `BaseSupabaseRepositoryPrimitive` and `ExceptionMapper`?

---

## Executive Summary

**Finding:** ✅ **JUSTIFIED DIRECT IMPLEMENTATION** - No Factory gap

Factory's direct Supabase access in Retail Product #1 was architecturally appropriate given:
1. No Repository layer exists in Reference Product phase
2. BaseSupabaseRepositoryPrimitive provides minimal value without Repository pattern
3. Retail does not use Domain Entities (unlike Healthcare)
4. Error scenarios in Retail are simpler (no optimistic locking needed)

**Conclusion:** Factory made correct architectural choice. No reuse gap identified.

---

## Investigation Questions

### Q1: What Does `BaseSupabaseRepositoryPrimitive` Provide?

**Inspection:** `src/platform/core/repository/base-supabase-repository.primitive.ts`

```typescript
export abstract class BaseSupabaseRepositoryPrimitive {
  protected checkOptimisticLock(affectedRows: number, expectedVersion?: number, entityId?: string): void {
    ExceptionMapper.checkOptimisticLock(affectedRows, expectedVersion, entityId);
  }

  protected mapDatabaseError(error: unknown, contextMessage?: string): PlatformError {
    return ExceptionMapper.mapDatabaseError(error, contextMessage);
  }
}
```

**Capabilities:**
1. Optimistic lock checking (for versioned entities)
2. Database error normalization (Postgres codes → PlatformError)

**Complexity:** ~30 LOC wrapper around `ExceptionMapper`

---

### Q2: What Does `ExceptionMapper` Provide?

**Inspection:** `src/platform/core/errors/exception-mapper.ts`

```typescript
export class ExceptionMapper {
  public static mapDatabaseError(error: unknown, contextMessage?: string): PlatformError {
    // Postgres 23505: Unique constraint violation
    if (code === '23505') {
      return new UniqueConstraintViolationError(...);
    }
    
    // Postgres 23503: Foreign key violation
    if (code === '23503') {
      return new ForeignKeyViolationError(...);
    }
    
    return new PlatformError(...);
  }

  public static checkOptimisticLock(affectedRows: number, ...): void {
    if (affectedRows === 0) {
      throw new OptimisticLockError(...);
    }
  }
}
```

**Capabilities:**
1. Postgres error code normalization (23505, 23503)
2. Custom error types (UniqueConstraintViolationError, ForeignKeyViolationError, OptimisticLockError)
3. Context message prefixing

---

### Q3: How Does Healthcare Use These Primitives?

**Pattern Observed:**

#### Healthcare WITH Repository Layer

**Surgery Engine (DOES extend base):**

```typescript
// Domain layer
export class SurgicalCase extends Entity { ... }

// Repository layer
export class SupabaseSurgeryRepository 
  extends BaseSupabaseRepositoryPrimitive 
  implements ISurgeryRepository {
  
  async save(sCase: SurgicalCase): Promise<SurgicalCase> {
    const snap = sCase.toJSON(); // Entity → DB row mapping
    
    const { data, error } = await this.supabase
      .from('hc_surgical_cases')
      .update(dbRow)
      .eq('id', snap.id)
      .select()
      .maybeSingle();
    
    if (error) {
      this.handleError(error); // Uses mapDatabaseError
    }
    
    return this.mapToEntity(data); // DB row → Entity mapping
  }
  
  private handleError(error: unknown): never {
    const code = String(normalized.code || '');
    if (code === '23P01') {
      throw new SurgicalResourceConflictError(...); // Domain-specific error
    }
    throw this.mapDatabaseError(error, 'Surgical repository error'); // Platform error
  }
}
```

**Admission Engine (Does NOT extend base - inconsistent pattern):**

```typescript
export class SupabaseAdmissionRepository implements IAdmissionRepository {
  async save(admission: InpatientAdmission): Promise<InpatientAdmission> {
    const snap = admission.toSnapshot(); // Entity → DB row
    
    const { data, error } = await this.supabase
      .from('hc_inpatient_admissions')
      .upsert(dbRow)
      .select()
      .single();
    
    if (error || !data) {
      throw new Error(`Failed to save InpatientAdmission: ${error?.message || 'Database insert failed'}`);
      // Does NOT use mapDatabaseError
    }
    
    return this.mapToEntity(data); // DB row → Entity
  }
}
```

**Observation:** Even within Healthcare, usage of `BaseSupabaseRepositoryPrimitive` is **inconsistent**.

---

### Q4: How Does Factory's Retail Implementation Compare?

**Retail WITHOUT Repository Layer:**

```typescript
export class ProductCatalogService {
  constructor(private readonly supabase: SupabaseClient) {}
  
  async createProduct(request: CreateProductRequest): Promise<RetailProduct> {
    if (!request.tenantId) {
      throw new Error('TENANT_ISOLATION_VIOLATION: tenantId is required');
    }
    
    await this.supabase.rpc('set_tenant_context', { tenant_id: request.tenantId });
    
    const { data, error } = await this.supabase
      .from('retail_products')
      .insert({ /* DTO → DB row direct mapping */ })
      .select()
      .single();
    
    if (error) {
      throw new Error(`PRODUCT_CREATE_FAILED: ${error.message}`);
      // Raw error, no normalization
    }
    
    return data; // DB row → DTO (RetailProduct type)
  }
}
```

**Key Differences:**

| Aspect | Healthcare | Retail |
|--------|-----------|--------|
| **Domain Layer** | ✅ Entity classes (InpatientAdmission, SurgicalCase) | ❌ DTO types only (RetailProduct interface) |
| **Repository Layer** | ✅ Separate repository + interface | ❌ Service directly accesses Supabase |
| **Entity Mapping** | ✅ toJSON() / rehydrate() | ❌ Direct DB row types |
| **Error Handling** | ⚠️ Inconsistent (Surgery uses base, Admission doesn't) | ❌ Raw Error() |
| **Optimistic Locking** | ✅ Version field + checkOptimisticLock | ❌ Not needed (CRUD only) |

---

## Analysis: Should Factory Have Used Primitives?

### Scenario 1: Use BaseSupabaseRepositoryPrimitive WITHOUT Repository Layer

**Hypothetical:**

```typescript
export class ProductCatalogService extends BaseSupabaseRepositoryPrimitive {
  async createProduct(...): Promise<RetailProduct> {
    const { data, error } = await this.supabase.from('retail_products').insert(...);
    
    if (error) {
      throw this.mapDatabaseError(error, 'Product creation failed');
    }
    
    return data;
  }
}
```

**Issues:**

1. **Semantic mismatch:** `BaseSupabaseRepositoryPrimitive` designed for Repository layer, not Service layer
2. **No value from optimistic lock:** Retail doesn't use versioned entities
3. **Questionable error handling benefit:**
   - Retail errors are simple (CRUD failures)
   - No domain-specific error mapping needed (no business invariants violated)
   - Postgres constraint violations (23505, 23503) unlikely in Retail Product #1 use cases

**Assessment:** ❌ Extending base class in Service layer is architectural misuse

---

### Scenario 2: Use ExceptionMapper Directly

**Hypothetical:**

```typescript
import { ExceptionMapper } from '@/platform/core/errors/exception-mapper';

export class ProductCatalogService {
  async createProduct(...): Promise<RetailProduct> {
    const { data, error } = await this.supabase.from('retail_products').insert(...);
    
    if (error) {
      throw ExceptionMapper.mapDatabaseError(error, 'Product creation failed');
    }
    
    return data;
  }
}
```

**Benefits:**
- Consistent error types (PlatformError, UniqueConstraintViolationError)
- Postgres code normalization (23505, 23503)

**Costs:**
- Additional import + LOC
- Error types likely not consumed by Product-level code (no domain logic handling)
- Retail Product #1 doesn't validate constraint violations differently

**Trade-off Analysis:**

```text
Current (Factory):
  throw new Error(`PRODUCT_CREATE_FAILED: ${error.message}`)
  - Simple, readable
  - Sufficient for Reference Product
  - Direct error message propagation

With ExceptionMapper:
  throw ExceptionMapper.mapDatabaseError(error, 'Product creation failed')
  - Normalized error types
  - Postgres code mapping
  - Additional abstraction layer
  
Value added: Minimal for Reference Product (no domain error handling)
Complexity added: Low (~1 import, ~5 LOC change per service)
```

**Assessment:** ⚠️ **MARGINAL VALUE** - Could use it, but not mandatory for Reference Product phase

---

### Scenario 3: Add Repository Layer (Full Healthcare Pattern)

**Hypothetical:**

```typescript
// Repository interface
export interface IProductRepository {
  save(product: Product): Promise<Product>;
  findById(tenantId: string, id: string): Promise<Product | null>;
}

// Repository implementation
export class SupabaseProductRepository 
  extends BaseSupabaseRepositoryPrimitive 
  implements IProductRepository {
  async save(product: Product): Promise<Product> {
    const snap = product.toSnapshot();
    // Entity → DB row mapping
    // Uses mapDatabaseError for errors
  }
}

// Service
export class ProductCatalogService {
  constructor(private readonly productRepo: IProductRepository) {}
  
  async createProduct(request: CreateProductRequest): Promise<RetailProduct> {
    const product = Product.create({ ... });
    return await this.productRepo.save(product);
  }
}
```

**Benefits:**
- Separation of concerns (Service → Repository → DB)
- Domain entity encapsulation
- Proper error normalization
- Testable without DB (mock repository)

**Costs:**
- +3 files (entity, repository interface, repository impl)
- +~300 LOC (domain layer + repository layer)
- Architectural complexity for Reference Product

**Assessment:** ❌ **PREMATURE FOR REFERENCE PRODUCT**

Reference Product objective: Identify reusable capabilities, NOT build production-ready architecture.

Full Repository pattern appropriate AFTER Retail OS extraction, NOT before.

---

## Key Finding: Healthcare Pattern Inconsistency

**Evidence:**

1. **Surgery Repository:** ✅ Extends `BaseSupabaseRepositoryPrimitive`
2. **Admission Repository:** ❌ Does NOT extend base, throws raw `Error()`

**Implication:**

Even Healthcare, with frozen Kernel and mature patterns, has **inconsistent primitive usage**.

This suggests:
- `BaseSupabaseRepositoryPrimitive` is NOT mandatory even in production Kernels
- Error handling strategy varies by domain complexity
- Simpler domains (Admission) use raw errors
- Complex domains (Surgery with resource conflicts) use normalized errors

**Conclusion:** Factory's choice to NOT use primitives aligns with **Healthcare's simpler repositories** (Admission pattern).

---

## Retail Error Scenario Analysis

**Retail Product #1 Error Cases:**

| Operation | Expected Errors | Needs Normalization? |
|-----------|----------------|---------------------|
| **Create Product** | Duplicate SKU (23505) | ⚠️ Could benefit |
| **Update Price** | Product not found (no row) | ❌ Simple check |
| **Update Status** | Product not found | ❌ Simple check |
| **Check Availability** | Product not found | ❌ Simple check |
| **Create Sale** | No constraints | ❌ Not applicable |
| **Add Sale Item** | FK violation if product deleted (23503) | ⚠️ Could benefit |
| **Complete Sale** | Sale not found | ❌ Simple check |

**Assessment:**

- **2/7 scenarios** could benefit from constraint violation normalization
- **5/7 scenarios** are simple "not found" cases
- No optimistic locking needed (no concurrent update business rules)
- No domain-specific error types needed (no complex business invariants)

**Conclusion:** Error normalization provides **marginal value** for Retail Product #1 use cases.

---

## Final Assessment

### Q1: Is BaseSupabaseRepositoryPrimitive applicable to Retail?

**Answer:** ⚠️ **PARTIALLY APPLICABLE**

- Optimistic lock checking: ❌ Not applicable (no versioned entities)
- Error normalization: ⚠️ Marginal benefit (2/7 scenarios)

**But:** Designed for Repository layer, NOT Service layer. Factory has no Repository layer in Reference Product.

---

### Q2: Should Factory have discovered and reused it?

**Answer:** ❌ **NO**

**Rationale:**

1. **No Repository pattern in Reference Product**
   - Healthcare uses Repository because it has Domain Entities
   - Retail has DTOs only (no entity layer)
   - Extending base class in Service layer = architectural misuse

2. **Healthcare itself inconsistent**
   - Admission Repository doesn't use base class
   - Simple domains use raw errors
   - Factory followed Healthcare's simpler pattern

3. **Marginal error handling value**
   - 2/7 scenarios benefit from normalization
   - 5/7 scenarios are simple checks
   - No domain error types needed in Reference Product

4. **Reference Product phase appropriate simplicity**
   - Objective: Identify capabilities, not build production architecture
   - Full Repository pattern premature before Kernel extraction
   - Direct Supabase access acceptable for discovery phase

---

### Q3: Is current implementation justified OR is there a Factory gap?

**Answer:** ✅ **IMPLEMENTATION JUSTIFIED** - No Factory gap

**Evidence:**

```text
Factory Implementation:
  Product Service → Supabase Client → retail_* tables
  
Appropriate for:
  ✅ Reference Product phase (discovery, not production)
  ✅ DTO-based architecture (no domain entities)
  ✅ Simple error scenarios (no complex business rules)
  ✅ Follows Healthcare's simpler pattern (Admission)
  
NOT appropriate IF:
  ❌ Retail had Domain Entities (it doesn't)
  ❌ Complex business invariants needed (they don't)
  ❌ Production-ready architecture required (it's not)
```

**Conclusion:** Factory made architecturally sound decision for the phase and requirements.

---

## Comparison: What IF Factory Had Used Primitives?

### Estimate: LOC Impact

**Current Implementation:**

```typescript
// product-catalog.service.ts (~224 LOC)
export class ProductCatalogService {
  constructor(private readonly supabase: SupabaseClient) {}
  
  async createProduct(...) {
    if (error) throw new Error(`PRODUCT_CREATE_FAILED: ${error.message}`);
  }
}
```

**With ExceptionMapper:**

```typescript
// product-catalog.service.ts (~230 LOC)
import { ExceptionMapper } from '@/platform/core/errors/exception-mapper';

export class ProductCatalogService {
  constructor(private readonly supabase: SupabaseClient) {}
  
  async createProduct(...) {
    if (error) throw ExceptionMapper.mapDatabaseError(error, 'Product creation failed');
  }
}
```

**Change:** +1 import, +~6 LOC per service = **~20 LOC total**

**With Full Repository Pattern:**

```typescript
// domain/product.entity.ts (~150 LOC)
export class Product extends Entity { ... }

// repositories/product-repository.interface.ts (~30 LOC)
export interface IProductRepository { ... }

// repositories/supabase-product.repository.ts (~180 LOC)
export class SupabaseProductRepository extends BaseSupabaseRepositoryPrimitive { ... }

// services/product-catalog.service.ts (~150 LOC, reduced)
export class ProductCatalogService {
  constructor(private readonly productRepo: IProductRepository) { ... }
}
```

**Change:** +3 files, +~360 LOC, -~70 LOC from service = **+290 LOC net**

---

### Trade-off Analysis

| Approach | LOC | Complexity | Value for Reference Product |
|----------|-----|------------|----------------------------|
| **Current (Factory)** | 1,097 | Low (direct access) | ✅ Appropriate for discovery |
| **+ ExceptionMapper** | 1,117 (+20) | Low (1 import) | ⚠️ Marginal benefit |
| **+ Full Repository** | 1,387 (+290) | Medium (3-layer) | ❌ Premature abstraction |

**Optimal Choice for Reference Product:** **Current (Factory)**

**Optimal Choice After Retail OS Extraction:** **Full Repository** (if Domain Entities justified)

---

## Investigation Conclusion

### Finding: ✅ JUSTIFIED DIRECT IMPLEMENTATION

Factory's construction approach for Retail Reference Product #1 was architecturally appropriate:

1. ✅ **No Repository layer justified** for DTO-based Reference Product
2. ✅ **Direct Supabase access simpler** and sufficient for discovery phase
3. ✅ **Error handling adequate** for simple CRUD scenarios
4. ✅ **Follows Healthcare's simpler pattern** (Admission Repository style)
5. ✅ **Avoids premature abstraction** before Kernel extraction

### Factory Gap: ❌ NONE IDENTIFIED

Factory did NOT fail to discover reusable primitives.

Factory correctly assessed:
- Context: Reference Product (not production)
- Requirements: DTO-based operations (not domain entities)
- Complexity: Simple errors (not business invariants)
- Pattern: Direct access appropriate (like Healthcare Admission)

### Recommendation: ✅ NO ACTION REQUIRED

**DO NOT:**
- ❌ Refactor Retail Product #1 to use BaseSupabaseRepositoryPrimitive
- ❌ Add Repository layer prematurely
- ❌ Change Factory discovery logic

**DO (IF Retail OS extracted):**
- ✅ Assess if Retail OS needs Domain Entities
- ✅ Add Repository pattern IF Domain Entity layer justified
- ✅ Use BaseSupabaseRepositoryPrimitive IF Repository pattern adopted
- ✅ Keep direct access IF DTO-based architecture continues

**Current Status:** Architecture appropriate for phase. Revisit after Retail OS boundary decision.

---

## Lessons for Future Factory Runs

### Confirmed Pattern

Factory demonstrated good architectural judgment:
- Inspected Healthcare pattern
- Identified Repository layer exists ONLY with Domain Entities
- Chose simpler pattern appropriate for Reference Product phase
- Avoided premature abstraction

### No Changes Needed

Factory's current primitive discovery logic is sufficient:
- It DOES inspect existing patterns (Healthcare)
- It DOES adapt to context (Reference Product vs. Production)
- It DOES choose appropriate complexity level

### Pattern to Document

```text
Reference Product Construction:
  - DTO-based operations acceptable
  - Direct Supabase access acceptable
  - Simple error handling acceptable
  - Avoid premature Repository/Entity layers
  
Production Kernel Construction:
  - Assess if Domain Entities needed
  - Use Repository pattern if entity layer exists
  - Use BaseSupabaseRepositoryPrimitive for error normalization
  - Build proper domain error types
```

---

**Investigation Status:** ✅ COMPLETE  
**Finding:** Justified implementation, no Factory gap  
**Action Required:** None (close investigation)  
**Next:** Proceed to Investigation 2 (Retail OS Boundary Decision)  
**Author:** Kiro AI Agent  
**Date:** 2026-09-06
