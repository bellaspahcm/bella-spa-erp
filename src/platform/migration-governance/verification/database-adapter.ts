/**
 * Phase 4B.3 — PostgreSQL Database Adapter
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * Abstract adapter for PostgreSQL introspection.
 * Supabase-specific implementation provided as concrete adapter.
 * 
 * VN Migration: Swap Supabase adapter with Self-Hosted adapter.
 */

import { DatabaseAdapter } from './types';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient } from 'pg';

/**
 * Abstract PostgreSQL Adapter
 */
export abstract class PostgreSQLAdapter implements DatabaseAdapter {
  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;
  abstract queryTables(schema?: string): Promise<string[]>;
  abstract queryTableExists(tableName: string): Promise<boolean>;
  abstract queryColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>>;
  abstract queryPrimaryKey(tableName: string): Promise<string[]>;
  abstract queryForeignKeys(tableName: string): Promise<Array<{ column: string; references: string; referenced_column: string }>>;
  abstract queryRLSStatus(tableName: string): Promise<{ enabled: boolean }>;
  abstract queryRLSPolicies(tableName: string): Promise<Array<{ name: string; command: string; using?: string; check?: string }>>;
}

/**
 * Supabase Adapter (Concrete Implementation)
 * 
 * Uses Supabase client for database introspection.
 * Queries use standard PostgreSQL information_schema and pg_catalog.
 * 
 * VN Migration: Replace with Self-Hosted adapter using direct pg connection.
 */
export class SupabaseAdapter extends PostgreSQLAdapter {
  private client: SupabaseClient | null = null;
  private connected: boolean = false;

  constructor(private databaseUrl: string, private serviceRoleKey: string) {
    super();
  }

  async connect(): Promise<void> {
    try {
      // Extract URL and create Supabase client
      this.client = createClient(this.databaseUrl, this.serviceRoleKey);
      
      // Test connection with simple query
      const { error } = await this.client.from('runtime_tenant_registry').select('tenant_id').limit(1);
      
      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows, which is OK for connection test
        throw new Error(`Database connection failed: ${error.message}`);
      }

      this.connected = true;
    } catch (error) {
      throw new Error(`Cannot connect to database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async disconnect(): Promise<void> {
    this.client = null;
    this.connected = false;
  }

  private ensureConnected(): void {
    if (!this.connected || !this.client) {
      throw new Error('Database not connected. Call connect() first.');
    }
  }

  async queryTables(schema: string = 'public'): Promise<string[]> {
    this.ensureConnected();

    const { data, error } = await this.client!.rpc('query_tables', { schema_name: schema });

    if (error) {
      throw new Error(`Failed to query tables: ${error.message}`);
    }

    return data || [];
  }

  async queryTableExists(tableName: string): Promise<boolean> {
    this.ensureConnected();

    // Query information_schema.tables
    const { data, error } = await this.client!.rpc('query_table_exists', {
      table_name: tableName,
      schema_name: 'public',
    });

    if (error) {
      throw new Error(`Failed to check table existence: ${error.message}`);
    }

    return data === true;
  }

  async queryColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    this.ensureConnected();

    const { data, error } = await this.client!.rpc('query_columns', {
      table_name: tableName,
      schema_name: 'public',
    });

    if (error) {
      throw new Error(`Failed to query columns for ${tableName}: ${error.message}`);
    }

    return data || [];
  }

  async queryPrimaryKey(tableName: string): Promise<string[]> {
    this.ensureConnected();

    const { data, error } = await this.client!.rpc('query_primary_key', {
      table_name: tableName,
      schema_name: 'public',
    });

    if (error) {
      throw new Error(`Failed to query primary key for ${tableName}: ${error.message}`);
    }

    return data || [];
  }

  async queryForeignKeys(tableName: string): Promise<Array<{ column: string; references: string; referenced_column: string }>> {
    this.ensureConnected();

    const { data, error } = await this.client!.rpc('query_foreign_keys', {
      table_name: tableName,
      schema_name: 'public',
    });

    if (error) {
      throw new Error(`Failed to query foreign keys for ${tableName}: ${error.message}`);
    }

    return data || [];
  }

  async queryRLSStatus(tableName: string): Promise<{ enabled: boolean }> {
    this.ensureConnected();

    // Query pg_tables for RLS status
    const { data, error } = await this.client!.rpc('query_rls_status', {
      table_name: tableName,
      schema_name: 'public',
    });

    if (error) {
      throw new Error(`Failed to query RLS status for ${tableName}: ${error.message}`);
    }

    return { enabled: data === true };
  }

  async queryRLSPolicies(tableName: string): Promise<Array<{ name: string; command: string; using?: string; check?: string }>> {
    this.ensureConnected();

    // Query pg_policies
    const { data, error } = await this.client!.rpc('query_rls_policies', {
      table_name: tableName,
      schema_name: 'public',
    });

    if (error) {
      throw new Error(`Failed to query RLS policies for ${tableName}: ${error.message}`);
    }

    return data || [];
  }
}

/**
 * Direct PostgreSQL Adapter
 * 
 * ADR-001: Replaces Supabase RPC transport with direct PostgreSQL connection.
 * Uses pg library for introspection queries (information_schema, pg_catalog).
 * 
 * Contract Preservation: Same semantics as SupabaseAdapter, different transport only.
 * 
 * Security: Uses DATABASE_EXECUTOR_URL with verification_executor role.
 *   - Read-only on application tables
 *   - Append-only on verification_evidence
 *   - No superuser or RLS bypass privileges
 * 
 * Phase 1: Parallel implementation behind USE_DIRECT_ADAPTER feature flag.
 */
export class DirectPostgreSQLAdapter extends PostgreSQLAdapter {
  private pool: Pool | null = null;
  private connected: boolean = false;

  constructor(private connectionString: string) {
    super();
  }

  async connect(): Promise<void> {
    try {
      // R1: Security — Validate connection string doesn't bypass SSL verification
      if (this.connectionString.includes('sslmode=no-verify') || 
          this.connectionString.includes('sslmode=disable')) {
        throw new Error(
          'Security violation: sslmode=no-verify/disable not allowed in verification runtime.'
        );
      }
      
      // Remove sslmode from connection string to allow Pool ssl config control
      let connectionString = this.connectionString;
      if (connectionString.includes('?sslmode=')) {
        connectionString = connectionString.replace(/[?&]sslmode=[^&]+/, '');
      }
      
      // R1: SSL Configuration — Production-grade certificate verification (ALL ENVIRONMENTS)
      // 
      // SECURITY REQUIREMENT: Certificate verification ALWAYS enabled
      // - rejectUnauthorized: true (no exceptions)
      // - CA bundle via DATABASE_CA_CERT (optional for custom CAs)
      // 
      // Supabase Development:
      //   1. Export CA from Supabase dashboard
      //   2. Save to file: supabase-ca.pem
      //   3. Set: DATABASE_CA_CERT=/path/to/supabase-ca.pem
      // 
      // Production:
      //   - Use system default trusted CAs (DATABASE_CA_CERT not needed)
      //   - Or provide production CA bundle via DATABASE_CA_CERT
      // 
      // Reference: docs/security/VERIFICATION_EXECUTOR_SECURITY_SPEC.md
      const sslConfig: any = {
        rejectUnauthorized: true, // ALWAYS verify certificates (all environments)
      };
      
      // Optional: Explicit CA bundle for Supabase or custom CAs
      if (process.env.DATABASE_CA_CERT) {
        try {
          const fs = await import('fs');
          sslConfig.ca = fs.readFileSync(process.env.DATABASE_CA_CERT, 'utf8');
        } catch (error) {
          throw new Error(
            `Cannot read DATABASE_CA_CERT: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }
      // Otherwise: Node.js uses system default trusted CAs
      
      this.pool = new Pool({
        connectionString,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
        ssl: sslConfig,
      });

      // Test connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();

      this.connected = true;
    } catch (error) {
      // Provide actionable error message for certificate issues
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('self-signed certificate') || errorMsg.includes('certificate')) {
        throw new Error(
          `SSL certificate verification failed: ${errorMsg}\n\n` +
          `For Supabase development:\n` +
          `  1. Export CA certificate from Supabase dashboard\n` +
          `  2. Save to file (e.g., supabase-ca.pem)\n` +
          `  3. Set DATABASE_CA_CERT=/path/to/supabase-ca.pem\n` +
          `  4. Re-run verification\n\n` +
          `For production: Use CA-signed certificates (DATABASE_CA_CERT not needed)`
        );
      }
      throw new Error(
        `Cannot connect to database: ${errorMsg}`
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

    // D1: Normalize PostgreSQL polcmd codes to semantic command names
    // PostgreSQL stores: 'r' (SELECT), 'a' (INSERT), 'w' (UPDATE), 'd' (DELETE), '*' (ALL)
    // Contract expects: 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'ALL'
    const normalizePolcmd = (polcmd: string): string => {
      const mapping: Record<string, string> = {
        'r': 'SELECT',
        'a': 'INSERT',
        'w': 'UPDATE',
        'd': 'DELETE',
        '*': 'ALL',
      };
      return mapping[polcmd] || polcmd;
    };

    return result.rows.map((row) => ({
      name: row.name,
      command: normalizePolcmd(row.command), // Normalize at adapter boundary
      using: row.using || undefined,
      check: row.check || undefined,
    }));
  }
}

/**
 * Self-Hosted Adapter (Placeholder for VN Migration)
 * 
 * Implementation will use direct PostgreSQL connection (pg library).
 * Queries remain identical (standard PostgreSQL information_schema).
 */
export class SelfHostedAdapter extends PostgreSQLAdapter {
  constructor(private connectionString: string) {
    super();
  }

  async connect(): Promise<void> {
    throw new Error('SelfHostedAdapter not implemented yet. VN migration required.');
  }

  async disconnect(): Promise<void> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryTables(schema?: string): Promise<string[]> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryTableExists(tableName: string): Promise<boolean> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryColumns(tableName: string): Promise<Array<{ name: string; type: string; nullable: boolean }>> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryPrimaryKey(tableName: string): Promise<string[]> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryForeignKeys(tableName: string): Promise<Array<{ column: string; references: string; referenced_column: string }>> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryRLSStatus(tableName: string): Promise<{ enabled: boolean }> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }

  async queryRLSPolicies(tableName: string): Promise<Array<{ name: string; command: string; using?: string; check?: string }>> {
    throw new Error('SelfHostedAdapter not implemented yet.');
  }
}

/**
 * Adapter Factory
 * 
 * Phase 1: Feature flag USE_DIRECT_ADAPTER controls Direct vs Supabase RPC adapter.
 * Both adapters implement same Contract v1.0.0 semantics.
 * 
 * After T1-T7 validation, Direct adapter becomes default and Supabase RPC retired.
 */
export function createDatabaseAdapter(databaseUrl: string, serviceRoleKey?: string): DatabaseAdapter {
  const useDirect = process.env.USE_DIRECT_ADAPTER === 'true';

  if (useDirect) {
    // Phase 1: Direct PostgreSQL adapter (ADR-001 approved)
    console.log('🔧 Using DirectPostgreSQLAdapter (Phase 1 - experimental)');
    return new DirectPostgreSQLAdapter(databaseUrl);
  }

  // Current: Supabase RPC adapter (PostgREST transport)
  if (databaseUrl.includes('supabase.co')) {
    if (!serviceRoleKey) {
      throw new Error('Supabase adapter requires service_role_key');
    }
    console.log('🔧 Using SupabaseAdapter (current)');
    return new SupabaseAdapter(databaseUrl, serviceRoleKey);
  }

  // Self-hosted PostgreSQL (VN migration placeholder)
  return new SelfHostedAdapter(databaseUrl);
}
