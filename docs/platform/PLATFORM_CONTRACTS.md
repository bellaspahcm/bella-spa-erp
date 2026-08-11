# Platform Contracts

**Purpose:** Define strict contracts between Platform and Product Packs to prevent runtime errors.

---

## 1. Database Column Types (UUID Contract)

**Rule:** All entity IDs and foreign keys MUST be UUID, not TEXT.

| Column Pattern | Required Type | Example |
|----------------|---------------|---------|
| `*_id` (primary key) | `UUID` | `student_id UUID PRIMARY KEY` |
| `*_id` (foreign key) | `UUID` | `person_id UUID REFERENCES persons(id)` |
| `tenant_id` | `UUID` | `tenant_id UUID NOT NULL` |
| `created_by` | `UUID` (nullable) | `created_by UUID` |
| `updated_by` | `UUID` (nullable) | `updated_by UUID` |

**Why:** Postgres FK checks require matching types. UUID → TEXT causes parse errors before FK validation.

**Test Pattern:**
```typescript
// ✅ CORRECT: Use valid UUID for FK tests
const NON_EXISTENT_UUID = '99999999-9999-9999-9999-999999999999';

// ❌ WRONG: String causes Postgres parse error
const NON_EXISTENT_ID = 'non-existent-person-id';
```

---

## 2. Audit Fields Contract

**Rule:** All tables MUST have audit fields for traceability.

| Field | Type | Nullable | Default | Purpose |
|-------|------|----------|---------|---------|
| `created_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | When record created |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL | `NOW()` | When record last updated |
| `created_by` | `UUID` | NULL | - | Who created (user ID) |
| `updated_by` | `UUID` | NULL | - | Who last updated |

**Trigger:** Auto-update `updated_at`:
```sql
CREATE TRIGGER trigger_update_updated_at
  BEFORE UPDATE ON public.table_name
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

---

## 3. Tenant Isolation Contract

**Rule:** ALL tables MUST have `tenant_id` and RLS policy.

**Required:**
1. Column: `tenant_id UUID NOT NULL`
2. Index: `CREATE INDEX idx_table_tenant_id ON table(tenant_id);`
3. FK: `FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE`
4. RLS: `ALTER TABLE table ENABLE ROW LEVEL SECURITY;`
5. Policy:
   ```sql
   CREATE POLICY table_tenant_isolation ON table
     FOR ALL
     USING (tenant_id = (SELECT auth.jwt() ->> 'tenant_id')::UUID);
   ```

**Test Pattern:**
```typescript
// Create data in tenant A
await service.create({ tenantId: 'tenant-a', ... });

// Query from tenant B → should return NULL/empty
const result = await service.getById(id, 'tenant-b');
expect(result).toBeNull();
```

---

## 4. Foreign Key Contract

**Rule:** FK columns MUST reference existing aggregate roots.

| FK Pattern | References | Cascade Behavior |
|------------|------------|------------------|
| `person_id` | `persons(id)` | `ON DELETE CASCADE` |
| `tenant_id` | `tenants(id)` | `ON DELETE CASCADE` |
| `organization_id` | `organizations(id)` | `ON DELETE CASCADE` |
| `program_id` | Application-specific | `ON DELETE RESTRICT` |

**Test Pattern:**
```typescript
// ✅ FK validation: Person must exist before Student
const person = await PersonService.create({ ... });
const student = await StudentService.create({ personId: person.id, ... });

// ❌ FK validation: Non-existent person should reject
await expect(
  StudentService.create({ personId: NON_EXISTENT_UUID, ... })
).rejects.toThrow('Person with ID ... does not exist');
```

---

## 5. Status Enum Contract

**Rule:** Status fields MUST use CHECK constraints, not TEXT.

**Pattern:**
```sql
status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'deleted'))
```

**TypeScript Mapping:**
```typescript
export type Status = 'active' | 'inactive' | 'deleted';
```

**Why:** Prevents typos at database level, not just application level.

---

## 6. JSONB Metadata Contract

**Rule:** Extension fields MUST use `metadata JSONB`, not `TEXT`.

**Pattern:**
```sql
metadata JSONB DEFAULT '{}'::JSONB
```

**Index (for queries):**
```sql
CREATE INDEX idx_table_metadata ON table USING GIN (metadata);
```

**TypeScript:**
```typescript
metadata?: Record<string, unknown>; // NOT `any`
```

---

## 7. Repository Method Contract

**Rule:** All repositories MUST implement standard methods.

| Method | Signature | Purpose |
|--------|-----------|---------|
| `create` | `(entity: T) => Promise<T>` | Insert new record |
| `findById` | `(id: string, tenantId: string) => Promise<T \| null>` | Get by ID with tenant isolation |
| `update` | `(entity: T) => Promise<T>` | Update existing record |
| `delete` | `(id: string, tenantId: string) => Promise<void>` | Delete record |
| `findByTenant` | `(tenantId: string, options?) => Promise<T[]>` | List records for tenant |

**Anti-patterns:**
- ❌ `findById(id)` without `tenantId` → breaks isolation
- ❌ `update(id, data)` → should accept full entity, not partial
- ❌ Returning `undefined` instead of `null` → inconsistent

---

## 8. Service Method Contract

**Rule:** Services orchestrate, aggregates enforce business rules.

**Service responsibilities:**
- ✅ Validate FK existence (e.g., Person exists before Student)
- ✅ Orchestrate repository calls
- ✅ Publish domain events (if applicable)
- ❌ **NOT:** Business logic (belongs in aggregate)
- ❌ **NOT:** Direct database queries (use repository)

**Example:**
```typescript
// ✅ CORRECT: Service validates FK, aggregate validates business rules
class StudentService {
  static async createStudent(request: CreateStudentRequest): Promise<Student> {
    // 1. Service validates FK
    const person = await PersonRepository.findById(request.personId, request.tenantId);
    if (!person) {
      throw new Error('Person does not exist');
    }

    // 2. Aggregate validates business rules
    const aggregate = StudentAggregate.create(request); // throws if invalid
    const student = aggregate.getStudent();

    // 3. Repository persists
    return await StudentRepository.create(student);
  }
}
```

---

## 9. Migration Contract

**Rule:** All migrations MUST be idempotent and additive.

**Idempotent patterns:**
```sql
CREATE TABLE IF NOT EXISTS ...
CREATE INDEX IF NOT EXISTS ...
ALTER TABLE ... ADD COLUMN IF NOT EXISTS ...

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE ...) THEN
    CREATE POLICY ...
  END IF;
END $$;
```

**Forbidden (breaking changes):**
```sql
❌ ALTER TABLE ... DROP COLUMN ...
❌ ALTER TABLE ... ALTER COLUMN ... SET NOT NULL (on existing column)
❌ ALTER TABLE ... ALTER COLUMN ... TYPE ... (type change)
❌ DROP TABLE ...
```

**Required at end:**
```sql
NOTIFY pgrst, 'reload schema'; -- Refresh PostgREST cache
```

---

## 10. Test Contract

**Rule:** Integration tests MUST verify all contracts.

**Required test scenarios:**
1. ✅ FK validation (valid and invalid)
2. ✅ Tenant isolation (cross-tenant access blocked)
3. ✅ CRUD operations (create, read, update, delete)
4. ✅ Business rules (via aggregate)
5. ✅ Unique constraints (duplicates rejected)
6. ✅ Status transitions (valid and invalid)

**Test structure:**
```typescript
describe('Entity Integration Tests', () => {
  beforeAll(async () => {
    await ensureTestTenantExists();
    // Setup test data
  });

  afterAll(async () => {
    await cleanupTestTenant();
  });

  describe('FK Validation', () => { ... });
  describe('Tenant Isolation', () => { ... });
  describe('CRUD Operations', () => { ... });
  describe('Business Rules', () => { ... });
});
```

---

## Compliance Checklist

Before merging any new entity (e.g., Enrollment, Course):

- [ ] All ID columns are UUID, not TEXT
- [ ] `tenant_id UUID NOT NULL` with index and FK
- [ ] RLS enabled with tenant isolation policy
- [ ] Audit fields (`created_at`, `updated_at`, `created_by`, `updated_by`)
- [ ] Status fields use CHECK constraints
- [ ] Metadata uses JSONB, not TEXT
- [ ] Repository implements standard methods with tenant isolation
- [ ] Service validates FK existence before aggregate
- [ ] Migration is idempotent (IF NOT EXISTS patterns)
- [ ] Migration ends with `NOTIFY pgrst, 'reload schema';`
- [ ] Integration tests cover FK validation and tenant isolation
- [ ] TypeScript types use strict typing, no `any`

**Violations result in runtime errors, test failures, or security vulnerabilities.**
