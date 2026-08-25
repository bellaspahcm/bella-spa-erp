/**
 * Phase 4B.3 — Verification Engine (Orchestrator)
 * 
 * Contract: P0_3_PHASE4B_3_CONTRACT.md v1.0.0 (commit 37ae4544)
 * 
 * Main orchestrator for database verification.
 * Follows Contract 6-step process exactly.
 * 
 * NO auto-repair, auto-rollback, heuristics, or hidden fallback.
 * Unknown state → FAIL/ERROR → BLOCK.
 */

import { VerificationInput, VerificationResult, ExpectedState, ActualState, DatabaseAdapter } from './types';
import { ExpectedStateResolver } from './expected-state-resolver';
import { createDatabaseAdapter } from './database-adapter';
import { verifyRLS } from './checks/rls-verification';
import { verifySchema } from './checks/schema-verification';
import { verifyConstraints } from './checks/constraint-verification';
import { detectDrift } from './checks/drift-detection';
import { aggregateResult } from './result-aggregator';
import { generateEvidence } from './evidence-generator';
import { v4 as uuidv4 } from 'uuid';

/**
 * Verification Engine
 * 
 * Process (from Contract):
 * Step 1: Connect to database
 * Step 2: Derive expected state
 * Step 3: Query actual state
 * Step 4: Run verification checks
 *   ├── 4.1: RLS Verification
 *   ├── 4.2: Schema Structure
 *   ├── 4.3: Constraint Verification
 *   └── 4.4: Drift Detection
 * Step 5: Aggregate result
 * Step 6: Record verification evidence
 */
export class VerificationEngine {
  private adapter: DatabaseAdapter | null = null;
  private resolver: ExpectedStateResolver;

  constructor() {
    this.resolver = new ExpectedStateResolver();
  }

  /**
   * Execute verification
   * 
   * @param input - Verification input (from BDGF/4B.2)
   * @returns Verification result
   */
  async execute(input: VerificationInput): Promise<VerificationResult> {
    const verification_id = `v-${uuidv4()}`;
    const startTime = Date.now();

    try {
      // Step 1: Connect to database
      this.adapter = await this.connectToDatabase(input.database_url, input.environment);

      // Step 2: Derive expected state (Contract + Declaration)
      const expectedState = await this.resolver.resolve(input.migration_file);

      // Step 3: Query actual state (PostgreSQL introspection)
      const actualState = await this.queryActualState(expectedState);

      // Step 4: Run verification checks
      const checks = await this.runVerificationChecks(expectedState, actualState);

      // Step 5: Aggregate result
      const result = aggregateResult({
        verification_id,
        migration_id: input.migration_id,
        commit_sha: input.commit_sha,
        approval_id: input.approval_id,
        environment: input.environment,
        checks,
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      });

      // Step 6: Record verification evidence
      await generateEvidence(result, this.adapter);

      return result;
    } catch (error) {
      // Error handling: Database unreachable, unknown state, etc.
      // Error → Deployment BLOCKED (fail-closed)
      const errorResult: VerificationResult = {
        verification_id,
        migration_id: input.migration_id,
        commit_sha: input.commit_sha,
        approval_id: input.approval_id,
        environment: input.environment,
        overall_result: 'ERROR',
        deployment_eligible: false,
        checks: [],
        summary: {
          total_checks: 0,
          passed: 0,
          warnings: 0,
          failed: 0,
          errors: 1,
        },
        error: {
          type: error instanceof Error ? error.constructor.name : 'UNKNOWN_ERROR',
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: new Date().toISOString(),
        },
        execution_time_ms: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      // Still generate evidence for ERROR (audit trail)
      if (this.adapter) {
        await generateEvidence(errorResult, this.adapter);
      }

      return errorResult;
    } finally {
      // Cleanup: Disconnect from database
      if (this.adapter) {
        await this.adapter.disconnect();
      }
    }
  }

  /**
   * Step 1: Connect to Database
   * 
   * @throws Error if connection fails → ERROR → BLOCK
   */
  private async connectToDatabase(databaseUrl: string, environment: string): Promise<DatabaseAdapter> {
    // Phase 1: Support both Direct and Supabase RPC adapters
    const useDirect = process.env.USE_DIRECT_ADAPTER === 'true';
    
    const serviceRoleKey = 
      process.env.DATABASE_EXECUTOR_SERVICE_ROLE_KEY || 
      process.env.SUPABASE_SERVICE_ROLE_KEY;

    // Direct adapter uses PostgreSQL connection string
    // Supabase adapter uses HTTP URL + service role key
    if (useDirect) {
      // Use DATABASE_EXECUTOR_URL (PostgreSQL connection string)
      const connectionString = process.env.DATABASE_EXECUTOR_URL;
      if (!connectionString) {
        throw new Error('DATABASE_EXECUTOR_URL environment variable required for Direct adapter');
      }
      
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
    
    // Supabase RPC adapter (current)
    if (!serviceRoleKey && databaseUrl.includes('supabase.co')) {
      throw new Error('DATABASE_EXECUTOR_SERVICE_ROLE_KEY or SUPABASE_SERVICE_ROLE_KEY environment variable required for Supabase');
    }

    const adapter = createDatabaseAdapter(databaseUrl, serviceRoleKey);

    try {
      await adapter.connect();
      return adapter;
    } catch (error) {
      throw new Error(
        `Cannot connect to database (${environment}): ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Step 3: Query Actual State
   * 
   * Query PostgreSQL for actual database state.
   * 
   * CRITICAL: This is introspection (what IS), NOT expectation (what SHOULD BE).
   */
  private async queryActualState(expectedState: ExpectedState): Promise<ActualState> {
    if (!this.adapter) {
      throw new Error('Database adapter not initialized');
    }

    const actualState: ActualState = {
      tables: {},
    };

    // Query all security-critical tables
    const tablesToCheck = new Set<string>();

    // Add security-critical tables from Contract
    for (const table of expectedState.securityInvariants.tenantIsolation.tables) {
      tablesToCheck.add(table);
    }

    // Add migration-specific tables from declaration
    if (expectedState.migrationExpectations.tables) {
      for (const table of Object.keys(expectedState.migrationExpectations.tables)) {
        tablesToCheck.add(table);
      }
    }

    // Query each table
    for (const tableName of Array.from(tablesToCheck)) {
      const exists = await this.adapter.queryTableExists(tableName);

      if (!exists) {
        actualState.tables[tableName] = { exists: false };
        continue;
      }

      // Query table details
      const [columns, primary_key, foreign_keys, rlsStatus, rlsPolicies] = await Promise.all([
        this.adapter.queryColumns(tableName),
        this.adapter.queryPrimaryKey(tableName),
        this.adapter.queryForeignKeys(tableName),
        this.adapter.queryRLSStatus(tableName),
        this.adapter.queryRLSPolicies(tableName),
      ]);

      actualState.tables[tableName] = {
        exists: true,
        columns,
        primary_key,
        foreign_keys,
        rls: {
          enabled: rlsStatus.enabled,
          policies: rlsPolicies.map(p => ({
            name: p.name,
            command: p.command as 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE',
            using: p.using,
            check: p.check,
          })),
        },
      };
    }

    return actualState;
  }

  /**
   * Step 4: Run Verification Checks
   * 
   * Execute all 4 check types:
   * 4.1: RLS Verification (CRITICAL)
   * 4.2: Schema Structure
   * 4.3: Constraint Verification
   * 4.4: Drift Detection
   */
  private async runVerificationChecks(
    expectedState: ExpectedState,
    actualState: ActualState
  ): Promise<VerificationResult['checks']> {
    const checks: VerificationResult['checks'] = [];

    // 4.1: RLS Verification (CRITICAL — highest priority)
    const rlsChecks = await verifyRLS(expectedState, actualState);
    checks.push(...rlsChecks);

    // 4.2: Schema Structure Verification
    const schemaChecks = await verifySchema(expectedState, actualState);
    checks.push(...schemaChecks);

    // 4.3: Constraint Verification
    const constraintChecks = await verifyConstraints(expectedState, actualState);
    checks.push(...constraintChecks);

    // 4.4: Drift Detection
    const driftChecks = await detectDrift(expectedState, actualState);
    checks.push(...driftChecks);

    return checks;
  }
}
