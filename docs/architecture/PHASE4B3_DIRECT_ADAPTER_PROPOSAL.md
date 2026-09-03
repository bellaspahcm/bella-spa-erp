# Phase 4B.3 — Direct PostgreSQL Adapter Implementation Proposal

**Status:** 🟡 PROPOSAL — PENDING APPROVAL  
**Date:** 2026-08-25  
**Related:** ADR-001 (Adapter Deviation Review)  
**Contract:** P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544) 🔒 FROZEN  

---

## OBJECTIVE

Replace Supabase RPC-based adapter with direct PostgreSQL adapter using `pg` library to:

1. **Align with Contract v1.0.0** — PostgreSQL Adapter without uncontracted transport dependencies
2. **Simplify architecture** — Remove PostgREST coupling and 7 RPC functions
3. **Enable testing** — Resolve schema cache errors blocking T1-T7 execution
4. **Prepare for self-hosted** — Direct PostgreSQL works for both Supabase and VN deployment

---

## PROPOSED IMPLEMENTATION

### File Structure

```
src/platform/migration-governance/verification/
├── database-adapter.ts           ← UPDATE
│   ├── PostgreSQLAdapter (abstract, unchanged)
│   ├── DirectPostgreSQLAdapter (NEW — replaces SupabaseAdapter)
│   └── createDatabaseAdapter() (UPDATE factory)
├── verification-engine.ts        ← NO CHANGE (uses adapter interface)
├── types.ts                      ← NO CHANGE
└── index.ts                      ← NO CHANGE
```

### Code Changes

#### 1. DirectPostgreSQLAdapter (NEW)

```typescript
import { Pool, PoolClient } from 'pg';
import { DatabaseAdapter } from './types';

/**
 * Direct PostgreSQL Adapter
 * 
 * Uses pg library for direct PostgreSQL introspection.
 * Works with Supabase-hosted and self-hosted PostgreSQL.
 * 
 * Queries use standard information_schema and pg_catalog.
 */
export class DirectPostgreSQLAdapter implements DatabaseAdapter {
  private pool: Pool | null = null;
  private connected: boolean = false;

  constructor(private connectionString: string) {}

  async connect(): Promise<void> {
    try {
      this.pool = new Pool({
        connectionString: this.connectionString,
        max: 10, // Connection pool size
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.connected = true;
    } catch (error) {
      throw new Error(
        `Cannot connect to database: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  async disconnect(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.pool) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }

  async queryTables(schema: string = 'public'): Promise<string[]> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT tablename 
       FROM pg_tables 
       WHERE schemaname = $1 
       ORDER BY tablename`,
      [schema]
    );

    return result.rows.map((row) => row.tablename);
  }

  async queryTableExists(tableName: string): Promise<boolean> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT EXISTS (
        SELECT 1 
        FROM pg_tables 
        WHERE schemaname = 'public' 
          AND tablename = $1
      )`,
      [tableName]
    );

    return result.rows[0].exists;
  }

  async queryColumns(
    tableName: string
  ): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT 
        column_name AS name,
        udt_name AS type,
        is_nullable = 'YES' AS nullable
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = $1
       ORDER BY ordinal_position`,
      [tableName]
    );

    return result.rows;
  }

  async queryPrimaryKey(tableName: string): Promise<string[]> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT a.attname AS column_name
       FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
       WHERE i.indrelid = $1::regclass
         AND i.indisprimary
       ORDER BY array_position(i.indkey, a.attnum)`,
      [`public.${tableName}`]
    );

    return result.rows.map((row) => row.column_name);
  }

  async queryForeignKeys(
    tableName: string
  ): Promise<Array<{ column: string; references: string; referenced_column: string }>> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT
        kcu.column_name AS column,
        ccu.table_name AS references,
        ccu.column_name AS referenced_column
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON ccu.constraint_name = tc.constraint_name
         AND ccu.table_schema = tc.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_name = $1
         AND tc.table_schema = 'public'`,
      [tableName]
    );

    return result.rows;
  }

  async queryRLSStatus(tableName: string): Promise<{ enabled: boolean }> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT relrowsecurity AS enabled
       FROM pg_class
       WHERE oid = $1::regclass`,
      [`public.${tableName}`]
    );

    return { enabled: result.rows[0]?.enabled || false };
  }

  async queryRLSPolicies(
    tableName: string
  ): Promise<Array<{ name: string; command: string; using?: string; check?: string }>> {
    this.ensureConnected();

    const result = await this.pool!.query(
      `SELECT
        polname AS name,
        polcmd AS command,
        pg_get_expr(polqual, polrelid) AS using,
        pg_get_expr(polwithcheck, polrelid) AS check
       FROM pg_policy
       WHERE polrelid = $1::regclass`,
      [`public.${tableName}`]
    );

    return result.rows.map((row) => ({
      name: row.name,
      command: row.command,
      using: row.using || undefined,
      check: row.check || undefined,
    }));
  }
}
```

#### 2. Update createDatabaseAdapter Factory

```typescript
/**
 * Factory: Create database adapter
 * 
 * Currently returns DirectPostgreSQLAdapter for all cases.
 * Supabase-hosted and self-hosted PostgreSQL use same adapter.
 */
export function createDatabaseAdapter(
  connectionString: string,
  serviceRoleKey?: string // Unused for direct adapter, kept for backward compatibility
): DatabaseAdapter {
  return new DirectPostgreSQLAdapter(connectionString);
}
```

#### 3. Update verification-engine.ts (Environment Variable)

```typescript
private async connectToDatabase(databaseUrl: string, environment: string): Promise<DatabaseAdapter> {
  // For direct PostgreSQL adapter, use DATABASE_URL (PostgreSQL connection string)
  // not Supabase HTTP URL
  const connectionString = databaseUrl;
  
  const adapter = createDatabaseAdapter(connectionString);

  try {
    await adapter.connect();
    return adapter;
  } catch (error) {
    throw new Error(
      `Cannot connect to database (${environment}): ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
```

---

## REMOVED ARTIFACTS

### 1. SupabaseAdapter Class
- **File:** `src/platform/migration-governance/verification/database-adapter.ts`
- **Action:** DELETE SupabaseAdapter class
- **Reason:** Replaced by DirectPostgreSQLAdapter

### 2. Supabase RPC Migration
- **File:** `supabase/migrations/20260826154323_phase4b3_verification_rpc.sql`
- **Action:** ARCHIVE (move to `supabase/migrations/_archived/`)
- **Reason:** RPC functions no longer needed with direct adapter

### 3. Dependency on @supabase/supabase-js (in adapter)
- **File:** `src/platform/migration-governance/verification/database-adapter.ts`
- **Action:** REMOVE import
- **Reason:** No longer using Supabase client for introspection

**Note:** Keep `@supabase/supabase-js` in package.json for other parts of Bella application.

---

## ENVIRONMENT VARIABLE CHANGES

### Current (Supabase RPC Adapter)

```bash
# Supabase HTTP API URL
SUPABASE_URL=https://xxx.supabase.co

# Service role key for Supabase API
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# PostgreSQL connection string (unused by adapter)
SUPABASE_DB_URL=postgresql://postgres:xxx@...
```

### Proposed (Direct PostgreSQL Adapter)

```bash
# PostgreSQL connection string for verification engine
DATABASE_EXECUTOR_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres

# OR for self-hosted
DATABASE_EXECUTOR_URL=postgresql://executor:xxx@10.0.1.5:5432/bella_production
```

**Change Required in Test Runner:**
```typescript
// OLD
const databaseUrl = process.env.SUPABASE_URL;

// NEW
const databaseUrl = process.env.DATABASE_EXECUTOR_URL || process.env.SUPABASE_DB_URL;
```

---

## SECURITY CONSIDERATIONS

### Connection String Security

**Storage:**
- GitHub Secrets (for CI/CD)
- Vault / parameter store (for production runtime)

**Access Control:**
- Only verification engine has access
- Connection string never logged

**Database Role Permissions:**
```sql
-- Verification executor role should be read-only
CREATE ROLE verification_executor WITH LOGIN PASSWORD 'xxx';

-- Grant read access to information_schema and pg_catalog
GRANT USAGE ON SCHEMA public TO verification_executor;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO verification_executor;
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO verification_executor;

-- Explicitly deny write operations
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON ALL TABLES IN SCHEMA public FROM verification_executor;
```

### Network Security

**Supabase-Hosted:**
- Connection through Supabase connection pooler (db.xxx.supabase.co:5432)
- SSL/TLS enforced
- IP allowlist if needed

**Self-Hosted VN:**
- Connection within VPC
- Private network only
- No public internet exposure

### RLS Enforcement

**Important:** RLS is enforced at **PostgreSQL level**, not transport layer.

Even with direct connection, PostgreSQL enforces:
- Row-level security policies
- Column permissions
- Schema isolation

Verification executor role respects RLS policies defined on tables.

---

## TESTING PLAN

### Phase 1: Adapter Unit Tests

```typescript
// test/unit/direct-adapter.test.ts

describe('DirectPostgreSQLAdapter', () => {
  it('should connect to database', async () => {
    const adapter = new DirectPostgreSQLAdapter(testConnectionString);
    await adapter.connect();
    expect(adapter).toBeDefined();
    await adapter.disconnect();
  });

  it('should query tables', async () => {
    const tables = await adapter.queryTables('public');
    expect(tables).toContain('runtime_tenant_registry');
  });

  it('should check table existence', async () => {
    const exists = await adapter.queryTableExists('runtime_tenant_registry');
    expect(exists).toBe(true);
  });

  // ... similar for other methods
});
```

### Phase 2: Integration Tests (T1-T7)

Run actual T1-T7 tests against:
1. Supabase-hosted PostgreSQL (current)
2. Self-hosted PostgreSQL (Docker container for testing)

**Expected Results:**
- T1: PASS
- T2: FAIL (RLS missing)
- T3: FAIL (deletion)
- T4: WARNING (additive)
- T5: ERROR (unreachable)
- T6: FAIL (type mismatch)
- T7: WARNING (no declaration)

### Phase 3: Regression Tests

Run existing Kernel regression tests to ensure no impact:
- Healthcare OS: 52/52 tests
- Logistics OS: 547/547 tests

---

## ROLLOUT PLAN

### Step 1: Create DirectPostgreSQLAdapter (Parallel)

- Implement DirectPostgreSQLAdapter class
- Keep SupabaseAdapter temporarily
- Update factory to use feature flag

```typescript
export function createDatabaseAdapter(
  connectionString: string,
  serviceRoleKey?: string
): DatabaseAdapter {
  if (process.env.USE_DIRECT_ADAPTER === 'true') {
    return new DirectPostgreSQLAdapter(connectionString);
  }
  return new SupabaseAdapter(connectionString, serviceRoleKey!);
}
```

### Step 2: Test with Feature Flag

```bash
USE_DIRECT_ADAPTER=true npm run test:phase4b3
```

### Step 3: Validate T1-T7 with Direct Adapter

- All 7 tests must pass with expected outcomes
- Evidence artifacts generated correctly
- No errors at adapter layer

### Step 4: Remove SupabaseAdapter

- Delete SupabaseAdapter class
- Archive RPC migration
- Update factory to always use DirectPostgreSQLAdapter

### Step 5: Update Documentation

- Update Contract implementation notes
- Document environment variable changes
- Update deployment guide

---

## RISK ASSESSMENT

### Risk 1: Connection Pool Exhaustion

**Mitigation:**
- Configure max pool size (default: 10)
- Implement connection timeout
- Monitor connection usage

### Risk 2: Network Latency (Self-Hosted)

**Mitigation:**
- Run verification engine in same VPC as database
- Use connection pooler if needed
- Test latency in staging environment

### Risk 3: Credential Exposure

**Mitigation:**
- Store connection string in secrets manager
- Never log connection string
- Rotate credentials regularly

### Risk 4: Breaking Change for Existing Tests

**Mitigation:**
- Feature flag during transition
- Run parallel tests with both adapters
- Rollback plan: revert to SupabaseAdapter

---

## SUCCESS CRITERIA

### Implementation Complete When:

1. ✅ DirectPostgreSQLAdapter implemented
2. ✅ Unit tests pass (adapter-level)
3. ✅ T1-T7 integration tests pass with expected outcomes
4. ✅ Evidence artifacts generated correctly
5. ✅ No errors at adapter layer
6. ✅ SupabaseAdapter removed
7. ✅ RPC migration archived
8. ✅ Documentation updated
9. ✅ Security review approved
10. ✅ Kernel regression tests unchanged

### Certificate Eligible When:

```
T1: PASS → ELIGIBLE        ✅
T2: FAIL → BLOCKED         ✅
T3: FAIL → BLOCKED         ✅
T4: WARNING → ELIGIBLE     ✅
T5: ERROR → BLOCKED        ✅
T6: FAIL → BLOCKED         ✅
T7: WARNING → ELIGIBLE     ✅
Expected = Actual: 7/7     ✅
Evidence from 9a2494a5     ✅
Deployment consequence     ✅ PROVEN
Contract 37ae4544          🔒 UNCHANGED
Scope expansion            ✅ NONE
```

---

## TIMELINE ESTIMATE

**Optimistic:** 4-6 hours  
**Realistic:** 1-2 days  
**Pessimistic:** 3-4 days (if security review blocks)

---

## APPROVAL REQUIRED

**Technical Approval:**
- [ ] Human Architect (architecture deviation)
- [ ] Security team (DATABASE_EXECUTOR_URL boundary)

**Implementation Approval:**
- [ ] Lead developer review
- [ ] Test plan approval

**Deployment Approval:**
- [ ] Staging environment validation
- [ ] Production rollout approval

---

## STATUS

🟡 **PROPOSAL — PENDING APPROVAL**

**Next Action:** Security review + Architect approval

**Blocker:** Cannot proceed with implementation until:
1. Architecture deviation approved (ADR-001)
2. Security boundary approved (DATABASE_EXECUTOR_URL)

---

## REFERENCES

- ADR-001: `docs/architecture/ADR_001_ADAPTER_DEVIATION.md`
- Contract v1.0.0: `docs/architecture/P0_3_PHASE4B_3_CONTRACT.md` (commit 37ae4544)
- Implementation: commit 9a2494a5
- pg library: https://node-postgres.com/
