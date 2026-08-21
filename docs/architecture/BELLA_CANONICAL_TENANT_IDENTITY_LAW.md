# Bella Canonical Tenant Identity Law

**Date:** 2026-08-19  
**Status:** ✅ APPROVED (Platform Architecture)  
**Authority:** Platform Architect  
**Scope:** All Bella OS domains  

---

## Law Statement

> **`tenant_id` is UUID throughout Bella platform.**
>
> Canonical tenant identity is UUID. No domain, module, or subsystem may own an independent tenant identity representation. All tenant references SHALL derive from Core `public.tenants.id`.

---

## Identity Chain (Canonical)

```
┌─────────────────────────────────────────────────────────────┐
│                    BELLA PLATFORM                            │
│                                                              │
│  ┌────────────────────────────────────────────────────┐    │
│  │              Core Domain                            │    │
│  │                                                      │    │
│  │  auth.users.id (UUID)                               │    │
│  │       ↓                                              │    │
│  │  public.users.id (UUID)                             │    │
│  │       ↓                                              │    │
│  │  public.users.tenant_id (UUID)                      │    │
│  │       ↓                                              │    │
│  │  public.tenants.id (UUID) ← CANONICAL SOURCE        │    │
│  │                                                      │    │
│  └────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  ┌────────────────────────────────────────────────────┐    │
│  │         Identity Resolution Function                │    │
│  │                                                      │    │
│  │  get_auth_tenant_id() RETURNS UUID                  │    │
│  │                                                      │    │
│  └────────────────────────────────────────────────────┘    │
│                           ↓                                  │
│  ┌─────────────────────────────────────────────────────────┤
│  │              OS Domains (All)                       │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │    │
│  │  │ Finance OS   │  │ Healthcare   │  │ Education │  │    │
│  │  │ tenant_id    │  │ tenant_id    │  │ tenant_id │  │    │
│  │  │ UUID         │  │ UUID         │  │ UUID      │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │    │
│  │                                                      │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  │    │
│  │  │ Real Estate  │  │ Automotive   │  │ [Future] │  │    │
│  │  │ tenant_id    │  │ tenant_id    │  │ tenant_id │  │    │
│  │  │ UUID         │  │ UUID         │  │ UUID      │  │    │
│  │  └──────────────┘  └──────────────┘  └──────────┘  │    │
│  │                                                      │    │
│  │  ┌──────────────────────────────────────────────┐  │    │
│  │  │     Runtime Integration Kernel               │  │    │
│  │  │     tenant_id UUID                            │  │    │
│  │  └──────────────────────────────────────────────┘  │    │
│  │                                                      │    │
│  └─────────────────────────────────────────────────────────┘
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prohibited Patterns

### ❌ Domain-Specific Identity Types

**NOT ALLOWED:**
```
Finance OS:   tenant_id TEXT
Healthcare:   tenant_id UUID
Education:    tenant_id INTEGER
```

**REQUIRED:**
```
All OS domains: tenant_id UUID
```

---

### ❌ Dual Identity Systems

**NOT ALLOWED:**
```
Core:         tenant_id UUID
Runtime:      tenant_id TEXT
JWT:          tenant_id TEXT
Conversion:   UUID ↔ TEXT at boundaries
```

**REQUIRED:**
```
Core:         tenant_id UUID
Runtime:      tenant_id UUID
JWT:          tenant_id UUID-formatted string
No conversion layer
```

---

### ❌ Independent Tenant Authority

**NOT ALLOWED:**
```
Domain module defines its own tenant registry
Domain module assigns tenant identities
Domain module maintains separate tenant UUID space
```

**REQUIRED:**
```
public.tenants.id is the ONLY source of canonical tenant identity
Domains consume tenant identity, do not create it
```

---

## JWT Contract

**JSON Representation:**
```json
{
  "sub": "user-uuid-string",
  "tenant_id": "tenant-uuid-string"
}
```

**Semantic Type:** UUID (even though JSON serializes as string)

**Authority:**
- JWT `tenant_id` claim is **derived**, not canonical
- Canonical source: `auth.uid() → public.users → tenant_id`
- RLS policies cast: `(auth.jwt() ->> 'tenant_id')::uuid`

**If JWT Does Not Contain `tenant_id`:**
- Architecture remains valid
- Use `get_auth_tenant_id()` for resolution

---

## Enforcement Mechanisms

### 1. Schema Constraints

**All tenant_id columns:**
```sql
tenant_id UUID NOT NULL REFERENCES public.tenants(id)
```

**NO TEXT tenant_id permitted in production schema.**

---

### 2. RLS Policies

**Tenant isolation:**
```sql
CREATE POLICY tenant_isolation ON table_name
  FOR ALL
  USING (tenant_id = public.get_auth_tenant_id());
```

**JWT-based (where applicable):**
```sql
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
```

---

### 3. Identity Resolution Function

**Canonical implementation:**
```sql
CREATE OR REPLACE FUNCTION public.get_auth_tenant_id()
RETURNS UUID AS $$
DECLARE
    t_id UUID;
BEGIN
    SELECT tenant_id INTO t_id 
    FROM public.users 
    WHERE id = auth.uid();
    
    RETURN t_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**No TEXT return type permitted.**

---

### 4. Type Safety

**TypeScript:**
```typescript
type TenantId = string;  // UUID-formatted string

interface Tenant {
  id: TenantId;  // Always UUID
  name: string;
}

// NOT ALLOWED
type TenantId = string | number | any;
```

---

## Migration Policy

**When legacy TEXT tenant_id discovered:**

1. ❌ DO NOT cast or convert TEXT → UUID
2. ❌ DO NOT promote legacy identifiers to canonical
3. ✅ Classify as ORPHAN / TEST_FIXTURE / LEGACY
4. ✅ Create canonical UUID in `public.tenants`
5. ✅ Retire legacy identifiers
6. ✅ Migrate schema to UUID

**Example:** Runtime Migration 05 (RCA #6)
- Found 5 TEXT tenant identifiers
- Classified as TEST_FIXTURE
- Created canonical Core UUIDs
- Retired TEXT identifiers
- Migrated schema TEXT → UUID

---

## Verification Gates

### Pre-Deployment

**Schema audit:**
```sql
-- Find non-UUID tenant_id columns
SELECT 
  table_schema,
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE column_name = 'tenant_id'
  AND data_type != 'uuid'
  AND table_schema = 'public';

-- Expected: 0 rows
```

---

### Runtime Verification

**Orphan check:**
```sql
-- Find tenant references not in public.tenants
SELECT 
  schemaname,
  tablename,
  COUNT(*) AS orphan_count
FROM (
  SELECT 'runtime_tenant_registry' AS tablename, 'public' AS schemaname, tenant_id
  FROM runtime_tenant_registry
  WHERE NOT EXISTS (
    SELECT 1 FROM public.tenants WHERE id = runtime_tenant_registry.tenant_id
  )
  -- Add UNION for each tenant_id column
) orphans
GROUP BY schemaname, tablename;

-- Expected: 0 rows
```

---

## Exception Policy

**NO exceptions permitted.**

Any domain, module, or subsystem requiring tenant identity MUST use UUID from `public.tenants.id`.

If a use case appears to require non-UUID tenant representation:
1. Escalate to Platform Architect
2. Re-evaluate use case design
3. Maintain UUID as canonical identity
4. Consider derived/display representations separately

---

## Historical Context

**Origin:** RCA #6 (Phase 3C Runtime Security Gate)

**Discovery:** Runtime tables used TEXT while Core used UUID

**Decision:** UUID is canonical (2026-08-19)

**Impact:** 
- Prevented dual identity system
- Established platform-wide standard
- Enabled cross-OS identity consistency

---

## Related Documents

- `BELLA_RUNTIME_TENANT_IDENTITY_AUDIT_RCA_6.md`
- `BELLA_RUNTIME_MIGRATION_05_IDENTITY_RECONCILIATION.md`
- `BELLA_RUNTIME_QUARANTINE_INCIDENT_001.md`

---

**Status:** ✅ ACTIVE (Platform Law)  
**Enforcement:** ALL domains, ALL migrations, ALL new development  
**Exceptions:** NONE PERMITTED
