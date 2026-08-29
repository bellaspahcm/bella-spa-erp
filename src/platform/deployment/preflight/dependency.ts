/**
 * G4: Dependency Validation
 * 
 * Validates migration dependencies:
 * - Required prior migrations exist
 * - References to tables/functions exist
 * - Extensions are installed
 * - Sequential ordering maintained
 */

import type { Migration, PreflightResult, ValidationFailure } from '../types';
import type { Pool } from 'pg';
import * as fs from 'fs';

export async function validateDependencies(
  migration: Migration,
  db: Pool
): Promise<PreflightResult> {
  const failures: ValidationFailure[] = [];
  
  try {
    // Check 1: All prior migrations are applied
    const allLocalMigrations = getLocalMigrations();
    const priorMigrations = allLocalMigrations.filter(v => v < migration.version);
    
    const appliedMigrations = await db.query(`
      SELECT version
      FROM supabase_migrations.schema_migrations
      ORDER BY version
    `);
    
    const appliedVersions = new Set(appliedMigrations.rows.map(r => r.version));
    
    const missingMigrations = priorMigrations.filter(v => !appliedVersions.has(v));
    
    if (missingMigrations.length > 0) {
      failures.push({
        gate: 'G4_DEPENDENCY',
        reason: `Missing prerequisite migrations: ${missingMigrations.join(', ')}. ` +
                `These must be applied before ${migration.version}.`,
        severity: 'ERROR',
        recommendation: 'Apply missing migrations in chronological order first'
      });
    }
    
    // Check 2: No future migrations already applied
    const futureMigrations = allLocalMigrations.filter(v => v > migration.version);
    const appliedFutureMigrations = futureMigrations.filter(v => appliedVersions.has(v));
    
    if (appliedFutureMigrations.length > 0) {
      failures.push({
        gate: 'G4_DEPENDENCY',
        reason: `Future migrations already applied: ${appliedFutureMigrations.join(', ')}. ` +
                `Cannot apply ${migration.version} after future migrations.`,
        severity: 'ERROR',
        recommendation: 'Migrations must be applied in strict chronological order'
      });
    }
    
    // Check 3: Parse SQL for dependencies (basic detection)
    const sqlDependencies = parseSQLDependencies(migration.sql);
    
    // Check referenced tables exist
    for (const table of sqlDependencies.referencedTables) {
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        ) as exists
      `, [table.schema || 'public', table.name]);
      
      if (!exists.rows[0].exists) {
        failures.push({
          gate: 'G4_DEPENDENCY',
          reason: `Referenced table '${table.schema || 'public'}.${table.name}' does not exist`,
          severity: 'ERROR',
          recommendation: 'Ensure all referenced tables are created by prior migrations'
        });
      }
    }
    
    // Check referenced functions exist
    for (const func of sqlDependencies.referencedFunctions) {
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc
          WHERE proname = $1
        ) as exists
      `, [func.name]);
      
      if (!exists.rows[0].exists) {
        failures.push({
          gate: 'G4_DEPENDENCY',
          reason: `Referenced function '${func.name}' does not exist`,
          severity: 'ERROR',
          recommendation: 'Ensure all referenced functions are created by prior migrations'
        });
      }
    }
    
    // Check 4: Required extensions
    for (const ext of sqlDependencies.requiredExtensions) {
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = $1
        ) as exists
      `, [ext]);
      
      if (!exists.rows[0].exists) {
        failures.push({
          gate: 'G4_DEPENDENCY',
          reason: `Required extension '${ext}' is not installed`,
          severity: 'ERROR',
          recommendation: `Install extension: CREATE EXTENSION IF NOT EXISTS ${ext};`
        });
      }
    }
    
  } catch (error) {
    failures.push({
      gate: 'G4_DEPENDENCY',
      reason: `Failed to validate dependencies: ${error instanceof Error ? error.message : String(error)}`,
      severity: 'ERROR',
      recommendation: 'Cannot proceed without dependency validation'
    });
  }
  
  return {
    pass: failures.length === 0,
    gate: 'G4_DEPENDENCY',
    failures,
    timestamp: new Date()
  };
}

function getLocalMigrations(): string[] {
  const migrationDir = 'supabase/migrations';
  const files = fs.readdirSync(migrationDir);
  
  return files
    .filter(f => f.endsWith('.sql'))
    .map(f => f.split('_')[0])
    .filter(v => /^\d{14}$/.test(v))
    .sort();
}

interface SQLDependencies {
  referencedTables: Array<{ schema?: string; name: string }>;
  referencedFunctions: Array<{ name: string }>;
  requiredExtensions: string[];
}

function parseSQLDependencies(sql: string): SQLDependencies {
  const dependencies: SQLDependencies = {
    referencedTables: [],
    referencedFunctions: [],
    requiredExtensions: []
  };
  
  // Simple regex-based parsing (production would use SQL parser)
  
  // Detect CREATE EXTENSION
  const extPattern = /CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+(\w+)/gi;
  let match;
  while ((match = extPattern.exec(sql)) !== null) {
    dependencies.requiredExtensions.push(match[1]);
  }
  
  // Detect FOREIGN KEY references
  const fkPattern = /REFERENCES\s+([a-z_]+)\.?([a-z_]+)?\s*\(/gi;
  while ((match = fkPattern.exec(sql)) !== null) {
    if (match[2]) {
      dependencies.referencedTables.push({ schema: match[1], name: match[2] });
    } else {
      dependencies.referencedTables.push({ name: match[1] });
    }
  }
  
  // Detect function calls (basic pattern)
  const funcPattern = /([a-z_]+)\s*\(/gi;
  while ((match = funcPattern.exec(sql)) !== null) {
    const funcName = match[1].toLowerCase();
    // Filter out SQL keywords
    const keywords = ['create', 'alter', 'drop', 'insert', 'update', 'delete', 'select', 'where', 'from', 'join'];
    if (!keywords.includes(funcName)) {
      dependencies.referencedFunctions.push({ name: funcName });
    }
  }
  
  return dependencies;
}
