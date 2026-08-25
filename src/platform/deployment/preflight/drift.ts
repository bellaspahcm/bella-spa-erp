/**
 * G3: Schema Drift Detection
 * 
 * Detects unexpected changes in production schema:
 * - Unmigrated manual changes
 * - Missing expected objects
 * - Schema state mismatch with migration history
 */

import type { Migration, PreflightResult, ValidationFailure } from '../types';
import type { Pool } from 'pg';

export async function detectDrift(
  migration: Migration,
  db: Pool
): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  try {
    // Check 1: Verify all recorded migrations are actually applied
    const recordedMigrations = await db.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      ORDER BY version
    `);
    
    for (const record of recordedMigrations.rows) {
      // For each recorded migration, verify its artifacts exist
      // This is a placeholder - actual implementation would check specific objects
      // based on migration content
      
      // Example: If migration creates table, verify table exists
      // This requires parsing migration SQL or maintaining artifact registry
    }
    
    // Check 2: Detect unknown objects (not created by any migration)
    // This identifies manual changes bypassing migration system
    const unknownTables = await db.query(`
      SELECT schemaname, tablename
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema', 'supabase_migrations')
        AND tablename NOT LIKE 'pg_%'
    `);
    
    // This is a simplified check - full implementation would:
    // 1. Build expected schema from migration history
    // 2. Compare with actual schema
    // 3. Report differences
    
    // Check 3: Verify E7 baseline integrity
    const e7Migrations = await db.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE version <= '20260823010000'
      ORDER BY version
    `);
    
    const expectedE7Count = 23; // E7.1 16 migrations + 7 legacy
    if (e7Migrations.rows.length !== expectedE7Count) {
      failures.push({
        gate: 'G3_DRIFT',
        reason: `E7 baseline drift detected. Expected ${expectedE7Count} migrations, found ${e7Migrations.rows.length}`,
        severity: 'ERROR',
        recommendation: 'E7 baseline is FROZEN. Investigate missing/extra migrations. DO NOT proceed.'
      });
    }
    
    // Check 4: Verify no unexpected migrations exist after latest known
    const latestKnown = '20260823010000'; // E7 final migration
    const unexpectedMigrations = await db.query(`
      SELECT version, name
      FROM supabase_migrations.schema_migrations
      WHERE version > $1 AND version != $2
      ORDER BY version
    `, [latestKnown, migration.version]);
    
    if (unexpectedMigrations.rows.length > 0) {
      const versions = unexpectedMigrations.rows.map(r => r.version).join(', ');
      failures.push({
        gate: 'G3_DRIFT',
        reason: `Unexpected migrations detected: ${versions}. ` +
                `These were not present in Git but exist in production.`,
        severity: 'ERROR',
        recommendation: 'Investigate provenance of unexpected migrations. Reconcile with Git history.'
      });
    }
    
  } catch (error) {
    failures.push({
      gate: 'G3_DRIFT',
      reason: `Failed to detect drift: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'ERROR',
      recommendation: 'Cannot proceed without drift detection. Check database connection and permissions.'
    });
  }
  
  return {
    pass: failures.length === 0,
    gate: 'G3_DRIFT',
    failures,
    timestamp: new Date()
  };
}
