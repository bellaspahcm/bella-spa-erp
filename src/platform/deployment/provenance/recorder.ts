/**
 * G8: Provenance Recording
 * 
 * Records immutable evidence of migration deployment:
 * - Migration identity
 * - File checksum
 * - Git commit SHA
 * - Actor
 * - Timestamp
 * - Execution result
 * - Preflight evidence
 * - Verification evidence
 */

import type { Migration, ExecutionResult, ProvenanceRecord, PreflightResult, VerificationResult } from '../types';
import type { Pool } from 'pg';

export class ProvenanceRecorder {
  private db: Pool;
  
  constructor(db: Pool) {
    this.db = db;
  }
  
  /**
   * Record provenance after successful deployment
   * 
   * Provenance is IMMUTABLE - no updates or deletes allowed
   */
  async record(
    migration: Migration,
    execution: ExecutionResult,
    preflight: PreflightResult[],
    verification: VerificationResult
  ): Promise<ProvenanceRecord> {
    
    // Count objects created/modified
    const objectsCreated = this.extractCreatedObjects(migration.sql);
    const objectsModified = this.extractModifiedObjects(migration.sql);
    const objectsDeleted = this.extractDeletedObjects(migration.sql);
    
    // Count SQL statements
    const sqlStatements = migration.sql.split(';').filter(s => s.trim().length > 0).length;
    
    const provenance: ProvenanceRecord = {
      migrationVersion: migration.version,
      migrationName: migration.name,
      fileChecksum: migration.checksum,
      gitCommitSHA: migration.gitSHA,
      executor: 'deployment_engine',
      executedAt: execution.endTime,
      executionDurationMs: execution.durationMs,
      result: execution.success ? 'SUCCESS' : 'FAILED',
      evidence: {
        preflight,
        execution: {
          sqlStatements,
          objectsCreated,
          objectsModified,
          objectsDeleted
        },
        verification
      }
    };
    
    // Write to provenance table
    await this.db.query(`
      INSERT INTO deployment_provenance (
        migration_version,
        migration_name,
        file_checksum,
        git_commit_sha,
        executor,
        executed_at,
        execution_duration_ms,
        result,
        preflight_evidence,
        execution_evidence,
        verification_evidence
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      provenance.migrationVersion,
      provenance.migrationName,
      provenance.fileChecksum,
      provenance.gitCommitSHA,
      provenance.executor,
      provenance.executedAt,
      provenance.executionDurationMs,
      provenance.result,
      JSON.stringify(provenance.evidence.preflight),
      JSON.stringify(provenance.evidence.execution),
      JSON.stringify(provenance.evidence.verification)
    ]);
    
    console.log(`\n📝 Provenance recorded for ${migration.version}\n`);
    
    return provenance;
  }
  
  /**
   * Retrieve provenance for a migration
   */
  async retrieve(migrationVersion: string): Promise<ProvenanceRecord | null> {
    const result = await this.db.query(`
      SELECT * FROM deployment_provenance
      WHERE migration_version = $1
      ORDER BY executed_at DESC
      LIMIT 1
    `, [migrationVersion]);
    
    if (result.rows.length === 0) {
      return null;
    }
    
    const row = result.rows[0];
    
    return {
      migrationVersion: row.migration_version,
      migrationName: row.migration_name,
      fileChecksum: row.file_checksum,
      gitCommitSHA: row.git_commit_sha,
      executor: row.executor,
      executedAt: row.executed_at,
      executionDurationMs: row.execution_duration_ms,
      result: row.result,
      evidence: {
        preflight: JSON.parse(row.preflight_evidence),
        execution: JSON.parse(row.execution_evidence),
        verification: JSON.parse(row.verification_evidence)
      }
    };
  }
  
  private extractCreatedObjects(sql: string): string[] {
    const objects: string[] = [];
    
    // Tables
    const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+\.?[a-z_]+)/gi;
    let match;
    while ((match = tablePattern.exec(sql)) !== null) {
      objects.push(`TABLE:${match[1]}`);
    }
    
    // Functions
    const funcPattern = /CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+([a-z_]+\.?[a-z_]+)/gi;
    while ((match = funcPattern.exec(sql)) !== null) {
      objects.push(`FUNCTION:${match[1]}`);
    }
    
    // Indexes
    const indexPattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi;
    while ((match = indexPattern.exec(sql)) !== null) {
      objects.push(`INDEX:${match[1]}`);
    }
    
    // Policies
    const policyPattern = /CREATE\s+POLICY\s+([a-z_]+)/gi;
    while ((match = policyPattern.exec(sql)) !== null) {
      objects.push(`POLICY:${match[1]}`);
    }
    
    return objects;
  }
  
  private extractModifiedObjects(sql: string): string[] {
    const objects: string[] = [];
    
    const alterPattern = /ALTER\s+TABLE\s+([a-z_]+\.?[a-z_]+)/gi;
    let match;
    while ((match = alterPattern.exec(sql)) !== null) {
      objects.push(`TABLE:${match[1]}`);
    }
    
    return objects;
  }
  
  private extractDeletedObjects(sql: string): string[] {
    const objects: string[] = [];
    
    // Drop table
    const dropTablePattern = /DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([a-z_]+\.?[a-z_]+)/gi;
    let match;
    while ((match = dropTablePattern.exec(sql)) !== null) {
      objects.push(`TABLE:${match[1]}`);
    }
    
    // Drop function
    const dropFuncPattern = /DROP\s+FUNCTION\s+(?:IF\s+EXISTS\s+)?([a-z_]+\.?[a-z_]+)/gi;
    while ((match = dropFuncPattern.exec(sql)) !== null) {
      objects.push(`FUNCTION:${match[1]}`);
    }
    
    return objects;
  }
}
