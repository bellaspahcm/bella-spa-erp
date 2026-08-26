# ADR-001: Phase 4B.3 PostgreSQL Adapter Implementation Deviation

**Status:** 🟡 ARCHITECTURE REVIEW REQUIRED  
**Date:** 2026-08-25  
**Related Contract:** P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544) 🔒 FROZEN  
**Implementation:** commit 9a2494a5  

---

## CONTEXT

Phase 4B.3 implementation (9a2494a5) introduced a Supabase RPC/PostgREST dependency that was not specified in the frozen Contract v1.0.0 (37ae4544).

During runtime testing (T1-T7 execution), the following error occurred:

```
Error: Could not find the function public.query_table_exists(schema_name, table_name) 
in the schema cache
```

This error revealed an **architectural coupling** that requires review.

---

## PROBLEM STATEMENT

### What Contract v1.0.0 Says

**Contract (37ae4544):**
```
4B.3 Verification Engine
         │
         ▼
PostgreSQL Adapter (Interface)
         │
         ▼
Supabase Adapter (Implementation)
         │
         ▼
Supabase PostgreSQL (US/Singapore)
```

**Contract Step 1: Connect to Database**
```javascript
const adapter = createPostgreSQLAdapter({
  connectionString: process.env.DATABASE_EXECUTOR_URL,
  environment,
});
```

**Contract does NOT specify:**
- ❌ Supabase RPC functions
- ❌ PostgREST transport layer
- ❌ Edge functions or custom RPC infrastructure

**Contract DOES specify:**
- ✅ PostgreSQL Adapter (abstract interface)
- ✅ Database introspection
- ✅ information_schema / pg_catalog queries

---

### What Implementation (9a2494a5) Does

**Actual Implementation:**
```
Verification Engine
        ↓
SupabaseAdapter (src/platform/migration-governance/verification/database-adapter.ts)
        ↓
@supabase/supabase-js client
        ↓
client.rpc('query_tables', ...)
client.rpc('query_table_exists', ...)
client.rpc('query_columns', ...)
client.rpc('query_primary_key', ...)
client.rpc('query_foreign_keys', ...)
client.rpc('query_rls_status', ...)
client.rpc('query_rls_policies', ...)
        ↓
PostgREST (API Gateway)
        ↓
PostgREST Schema Cache ← COUPLING POINT
        ↓
RPC Functions (supabase/migrations/20260825120000_phase4b3_verification_rpc.sql)
        ↓
PostgreSQL
```

**Implementation added:**
1. 7 custom RPC functions (query_*)
2. Migration file: `20260825120000_phase4b3_verification_rpc.sql`
3. Dependency on PostgREST schema cache
4. Dependency on Supabase HTTP API transport

---

## ROOT CAUSE ANALYSIS

### Symptom
```
PostgREST schema cache error when calling RPC functions
```

### Surface Cause
```
Schema cache mismatch or function signature not recognized
```

### **Root Architectural Cause**
```
Verification Engine was implemented through a transport layer 
(Supabase RPC/PostgREST) that Contract v1.0.0 did NOT require.

This is an implementation-specific dependency introduced AFTER Contract freeze.
```

---

## DEVIATION ANALYSIS

### Is This a Contract Violation?

**Answer:** Not necessarily.

Contract specified:
- PostgreSQL Adapter (interface)
- Database introspection

SupabaseAdapter implements DatabaseAdapter interface correctly.

**However:**

The transport mechanism (RPC vs direct PostgreSQL) creates:
1. **Runtime dependency** on PostgREST infrastructure
2. **Migration dependency** on 7 RPC functions
3. **Coupling** to Supabase-specific API layer
4. **Complexity** for self-hosted PostgreSQL migration

These were **uncontracted implementation details**.

### Severity Assessment

**Architecture Coupling:** 🟡 MODERATE

- ✅ Contract interface preserved (DatabaseAdapter)
- ✅ Introspection semantics correct (queries information_schema)
- ❌ Transport layer adds uncontracted dependency
- ❌ Self-hosted migration path complicated
- ❌ Runtime errors at infrastructure layer (not verification logic)

**Status:** Implementation is **architecturally deviant** but not **contract-breaking**.

---

## OPTION ANALYSIS

### Option A: Keep Supabase RPC Adapter

**Architecture:**
```
Verification Engine
  ↓
PostgreSQL Adapter (interface)
  ↓
SupabaseAdapter
  ↓
Supabase RPC/PostgREST
  ↓
PostgreSQL
```

**Pros:**
- ✅ Leverages Supabase infrastructure
- ✅ RLS/service-role boundary explicit
- ✅ No direct database connection from runtime
- ✅ API-based introspection

**Cons:**
- ❌ Depends on PostgREST schema cache
- ❌ Requires maintaining 7 custom RPC functions
- ❌ Adds migration infrastructure complexity
- ❌ Self-hosted PostgreSQL migration requires reimplementing RPC layer
- ❌ Abstraction no longer "database direct"
- ❌ Error at transport layer (not verification layer)

**Verdict:** Functional but **over-engineered** for a verification engine.

---

### Option B: Direct PostgreSQL Adapter

**Architecture:**
```
Verification Engine
  ↓
PostgreSQL Adapter (interface)
  ↓
DirectPostgreSQLAdapter (using pg library)
  ↓
PostgreSQL
```

**Pros:**
- ✅ Closer to Contract intent ("PostgreSQL Adapter")
- ✅ Fewer layers
- ✅ No dependency on PostgREST
- ✅ No custom RPC functions needed
- ✅ Self-hosted PostgreSQL natural
- ✅ Direct introspection via information_schema / pg_catalog
- ✅ Standard PostgreSQL connection pooling

**Cons:**
- ⚠️ Must manage connection/pooling directly
- ⚠️ Credential/database-network boundary must be designed carefully
- ⚠️ DATABASE_EXECUTOR_URL security model needs review

**Verdict:** **More aligned with Contract** and simpler architecture.

---

## RECOMMENDATION

### Primary Recommendation: Option B (Direct PostgreSQL Adapter)

**Rationale:**

1. **Contract Alignment**
   - Contract v1.0.0 specified "PostgreSQL Adapter" for introspection
   - Direct `pg` connection is the most straightforward implementation
   - No contract requirement for RPC/PostgREST transport

2. **Simplicity**
   - Removes 7 RPC functions
   - Removes PostgREST dependency
   - Removes schema cache coupling
   - Standard PostgreSQL introspection pattern

3. **Self-Hosted Migration**
   - VN self-hosted PostgreSQL will not have Supabase RPC infrastructure
   - Direct adapter works identically for Supabase-hosted and self-hosted PostgreSQL

4. **Current Error Resolution**
   - Schema cache issues disappear
   - No transport layer coupling
   - Verification logic runs directly against database

### Implementation Path

**Step 1: Create DirectPostgreSQLAdapter**
```typescript
export class DirectPostgreSQLAdapter extends PostgreSQLAdapter {
  private pool: Pool;
  
  async connect(): Promise<void> {
    this.pool = new Pool({ connectionString: this.databaseUrl });
    await this.pool.query('SELECT 1'); // Test connection
  }
  
  async queryTableExists(tableName: string): Promise<boolean> {
    const result = await this.pool.query(
      `SELECT EXISTS (
        SELECT 1 FROM pg_tables 
        WHERE schemaname = 'public' AND tablename = $1
      )`,
      [tableName]
    );
    return result.rows[0].exists;
  }
  
  // ... similar for other methods using information_schema/pg_catalog
}
```

**Step 2: Update createDatabaseAdapter Factory**
```typescript
export function createDatabaseAdapter(
  databaseUrl: string, 
  serviceRoleKey?: string
): DatabaseAdapter {
  if (databaseUrl.includes('supabase.co')) {
    // Use direct PostgreSQL even for Supabase
    return new DirectPostgreSQLAdapter(databaseUrl);
  }
  return new DirectPostgreSQLAdapter(databaseUrl);
}
```

**Step 3: Remove Supabase RPC Migration**
- Archive `supabase/migrations/20260825120000_phase4b3_verification_rpc.sql`
- Document in ADR why RPC functions were removed

**Step 4: Re-run T1-T7 Tests**
- Execute against actual database
- Verify 7/7 expected outcomes match actual

**Step 5: Update Documentation**
- Note in implementation that direct PostgreSQL adapter was chosen
- Document security boundary (DATABASE_EXECUTOR_URL credentials)

---

## SECURITY CONSIDERATIONS

### DATABASE_EXECUTOR_URL Credentials

**Current (Supabase RPC):**
```
Service Role Key → Supabase HTTP API → PostgREST → RPC → PostgreSQL
```

**Proposed (Direct PostgreSQL):**
```
PostgreSQL Connection String → PostgreSQL
```

**Security Review Required:**

1. **Credential Storage**
   - Where is DATABASE_EXECUTOR_URL stored? (GitHub Secrets? Vault?)
   - Who has access?

2. **Network Boundary**
   - Does verification engine run in same VPC as database?
   - Firewall rules for direct PostgreSQL connection?

3. **Connection Pooling**
   - Max connections limit
   - Timeout configuration
   - Connection lifecycle

4. **Least Privilege**
   - Does executor role have read-only access?
   - RLS policies still enforced at PostgreSQL level?

**Recommendation:** Direct PostgreSQL is **acceptable** if:
- ✅ Executor runs in trusted environment (GitHub Actions runner / VPN)
- ✅ Connection string stored securely (GitHub Secrets)
- ✅ Database role is read-only for verification
- ✅ RLS enforced at PostgreSQL level (not transport layer)

---

## CONTRACT COMPATIBILITY

### Does Option B Violate Contract v1.0.0?

**Answer:** **NO**

Contract specified:
```
PostgreSQL Adapter (Interface)
  ↓
Supabase Adapter (Implementation)
```

Contract did NOT specify:
- Transport mechanism (RPC vs direct)
- How adapter connects to PostgreSQL

Contract DID specify:
- Adapter queries database state
- Uses information_schema / pg_catalog
- Introspection only (read-only)

**DirectPostgreSQLAdapter satisfies all Contract requirements.**

### Amendment Required?

**Answer:** **NO**

This is an **implementation detail change**, not a contract semantic change.

**ADR is sufficient.** No Contract v1.1.0 needed.

---

## DECISION

**Status:** 🟡 PENDING ARCHITECT APPROVAL

**Proposed Decision:**

> Replace SupabaseAdapter (RPC-based) with DirectPostgreSQLAdapter (pg-based) 
> to simplify architecture, remove uncontracted dependencies, and align with 
> Contract v1.0.0 intent.
>
> This change preserves Contract v1.0.0 semantics while removing 
> implementation coupling to Supabase RPC/PostgREST infrastructure.

**Approval Required From:**
- Human Architect (Bella team)
- Security review for DATABASE_EXECUTOR_URL boundary

**Next Steps:**
1. ✅ Architecture Review (this document)
2. ⏳ Security review
3. ⏳ Architect approval
4. ⏳ Implementation (DirectPostgreSQLAdapter)
5. ⏳ Remove RPC migration
6. ⏳ Run T1-T7 tests
7. ⏳ Certificate (if 7/7 PASS)

---

## REFERENCES

- Contract v1.0.0: `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md` (commit 37ae4544) 🔒 FROZEN
- Implementation: commit 9a2494a5
- RPC Migration: `supabase/migrations/20260825120000_phase4b3_verification_rpc.sql`
- Test Evidence Baseline: commit ab135cea
- Decisions: `docs/architecture/P0_3_PHASE4B_3_DECISIONS.md` (commit 2c64341f) 🔒 FROZEN

---

## APPENDIX: Error Log

**Runtime Error (2026-08-25 T1 execution):**
```
Error: Could not find the function public.query_table_exists(schema_name, table_name) 
in the schema cache
    at SupabaseAdapter.queryTableExists (database-adapter.ts:97:13)
    at VerificationEngine.queryActualState (verification-engine.ts:188:22)
```

**Root Cause:**
PostgREST schema cache not recognizing custom RPC function signature.

**Why This Matters:**
Error occurred at **transport layer**, not verification logic layer.
Verification engine cannot be tested until transport layer is resolved.

**Status:**
🟡 ARCHITECTURE REVIEW REQUIRED — DO NOT CERTIFY

Implementation has introduced an uncontracted Supabase-specific dependency 
that requires architectural review before runtime certification.
