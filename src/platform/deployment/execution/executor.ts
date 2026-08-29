/**
 * G7: Controlled Execution Layer
 * 
 * Enforces controlled database execution:
 * - Only through Deployment Engine
 * - Transaction semantics enforced
 * - Fail-closed behavior
 * - No direct SQL execution outside this layer
 * - Execution evidence recorded
 */

import type { Migration, ExecutionResult } from '../types';
import type { Pool, PoolClient } from 'pg';

export class ControlledExecutor {
  private db: Pool;
  private actor: string;
  
  constructor(db: Pool, actor: string) {
    this.db = db;
    this.actor = actor;
    
    // Enforce: Only deployment engine can execute
    if (actor !== 'deployment_engine') {
      throw new Error(
        'GOVERNANCE VIOLATION: Direct database execution not allowed. ' +
        'All migrations must go through Deployment Engine.'
      );
    }
  }
  
  /**
   * Execute migration with full transaction control
   * 
   * ⚠️  PRODUCTION DATABASE MODIFICATION
   */
  async execute(migration: Migration): Promise<ExecutionResult> {
    const startTime = new Date();
    let client: PoolClient | null = null;
    
    try {
      // Acquire dedicated connection
      client = await this.db.connect();
      
      console.log(`\n🔧 Executing Migration: ${migration.version}`);
      console.log(`  Name: ${migration.name}`);
      console.log(`  Recovery Strategy: ${migration.recoveryStrategy}\n`);
      
      // Begin transaction
      await client.query('BEGIN');
      
      try {
        // Execute migration SQL
        await client.query(migration.sql);
        
        // Record in schema_migrations
        await client.query(`
          INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
          VALUES ($1, $2, $3)
        `, [
          migration.version,
          migration.name,
          [{ sql: migration.sql }]
        ]);
        
        // Commit transaction
        await client.query('COMMIT');
        
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        
        console.log(`\n✅ Migration executed successfully`);
        console.log(`  Duration: ${durationMs}ms\n`);
        
        return {
          success: true,
          migrationVersion: migration.version,
          startTime,
          endTime,
          durationMs
        };
        
      } catch (executionError) {
        // Rollback on failure
        await client.query('ROLLBACK');
        
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        
        console.error(`\n❌ Migration execution failed`);
        console.error(`  Error: ${executionError instanceof Error ? executionError.message : String(executionError)}`);
        console.error(`  Transaction rolled back\n`);
        
        return {
          success: false,
          migrationVersion: migration.version,
          startTime,
          endTime,
          durationMs,
          error: executionError instanceof Error ? executionError : new Error(String(executionError))
        };
      }
      
    } catch (connectionError) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      return {
        success: false,
        migrationVersion: migration.version,
        startTime,
        endTime,
        durationMs,
        error: connectionError instanceof Error ? connectionError : new Error(String(connectionError))
      };
      
    } finally {
      // Release connection
      if (client) {
        client.release();
      }
    }
  }
  
  /**
   * Dry-run execution (no database modification)
   * 
   * Validates SQL syntax without committing changes
   */
  async dryRun(migration: Migration): Promise<ExecutionResult> {
    const startTime = new Date();
    let client: PoolClient | null = null;
    
    try {
      client = await this.db.connect();
      
      console.log(`\n🧪 Dry-Run Migration: ${migration.version}\n`);
      
      // Begin transaction (will be rolled back)
      await client.query('BEGIN');
      
      try {
        // Execute SQL
        await client.query(migration.sql);
        
        // Always rollback (dry-run)
        await client.query('ROLLBACK');
        
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        
        console.log(`\n✅ Dry-run successful (rolled back)`);
        console.log(`  Duration: ${durationMs}ms\n`);
        
        return {
          success: true,
          migrationVersion: migration.version,
          startTime,
          endTime,
          durationMs
        };
        
      } catch (executionError) {
        await client.query('ROLLBACK');
        
        const endTime = new Date();
        const durationMs = endTime.getTime() - startTime.getTime();
        
        console.error(`\n❌ Dry-run failed`);
        console.error(`  Error: ${executionError instanceof Error ? executionError.message : String(executionError)}\n`);
        
        return {
          success: false,
          migrationVersion: migration.version,
          startTime,
          endTime,
          durationMs,
          error: executionError instanceof Error ? executionError : new Error(String(executionError))
        };
      }
      
    } catch (connectionError) {
      const endTime = new Date();
      const durationMs = endTime.getTime() - startTime.getTime();
      
      return {
        success: false,
        migrationVersion: migration.version,
        startTime,
        endTime,
        durationMs,
        error: connectionError instanceof Error ? connectionError : new Error(String(connectionError))
      };
      
    } finally {
      if (client) {
        client.release();
      }
    }
  }
}
