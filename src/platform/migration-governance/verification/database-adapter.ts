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
 */
export function createDatabaseAdapter(databaseUrl: string, serviceRoleKey?: string): DatabaseAdapter {
  if (databaseUrl.includes('supabase.co')) {
    if (!serviceRoleKey) {
      throw new Error('Supabase adapter requires service_role_key');
    }
    return new SupabaseAdapter(databaseUrl, serviceRoleKey);
  }

  // Self-hosted PostgreSQL
  return new SelfHostedAdapter(databaseUrl);
}
