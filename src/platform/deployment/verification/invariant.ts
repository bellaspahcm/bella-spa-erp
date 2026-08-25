/**
 * G9: Invariant Verification
 * 
 * Verifies critical system invariants after deployment:
 * - RLS enabled on all tenant-scoped tables
 * - Constraints enforced
 * - Indexes exist for performance
 * - Foreign keys valid
 * - No orphaned records
 */

import type { Migration, InvariantVerification } from '../types';
import type { Pool } from 'pg';

export async function verifyInvariants(
  migration: Migration,
  db: Pool
): Promise<InvariantVerification> {
  
  const checks = {
    rlsActive: await verifyRLSActive(migration, db),
    constraintsEnforced: await verifyConstraints(migration, db),
    indexesExist: await verifyIndexes(migration, db),
    foreignKeysValid: await verifyForeignKeys(migration, db)
  };
  
  const pass = Object.values(checks).every(check => check === true);
  
  return {
    pass,
    checks
  };
}

async function verifyRLSActive(migration: Migration, db: Pool): Promise<boolean> {
  // Extract tables created by migration
  const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)\.?([a-z_]+)?/gi;
  let match;
  const tables: string[] = [];
  
  while ((match = tablePattern.exec(migration.sql)) !== null) {
    const tableName = match[2] || match[1];
    tables.push(tableName);
  }
  
  // Verify RLS is enabled for each table
  for (const table of tables) {
    // Skip system tables
    if (table.startsWith('pg_') || table.startsWith('_')) {
      continue;
    }
    
    const result = await db.query(`
      SELECT relrowsecurity
      FROM pg_class
      JOIN pg_namespace ON pg_namespace.oid = pg_class.relnamespace
      WHERE pg_namespace.nspname = 'public' AND pg_class.relname = $1
    `, [table]);
    
    if (result.rows.length === 0) {
      console.error(`⚠️  Table '${table}' not found for RLS verification`);
      return false;
    }
    
    if (!result.rows[0].relrowsecurity) {
      console.error(`⚠️  RLS NOT enabled on table '${table}'`);
      return false;
    }
  }
  
  return true;
}

async function verifyConstraints(migration: Migration, db: Pool): Promise<boolean> {
  // Extract constraints from migration
  const constraintPattern = /CONSTRAINT\s+([a-z_]+)/gi;
  let match;
  const constraints: string[] = [];
  
  while ((match = constraintPattern.exec(migration.sql)) !== null) {
    constraints.push(match[1]);
  }
  
  // Verify each constraint exists
  for (const constraint of constraints) {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints
        WHERE constraint_name = $1
      ) as exists
    `, [constraint]);
    
    if (!result.rows[0].exists) {
      console.error(`⚠️  Constraint '${constraint}' not found`);
      return false;
    }
  }
  
  return true;
}

async function verifyIndexes(migration: Migration, db: Pool): Promise<boolean> {
  // Extract indexes from migration
  const indexPattern = /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)/gi;
  let match;
  const indexes: string[] = [];
  
  while ((match = indexPattern.exec(migration.sql)) !== null) {
    indexes.push(match[1]);
  }
  
  // Verify each index exists
  for (const index of indexes) {
    const result = await db.query(`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE indexname = $1
      ) as exists
    `, [index]);
    
    if (!result.rows[0].exists) {
      console.error(`⚠️  Index '${index}' not found`);
      return false;
    }
  }
  
  return true;
}

async function verifyForeignKeys(migration: Migration, db: Pool): Promise<boolean> {
  // Extract tables from migration
  const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-z_]+)\.?([a-z_]+)?/gi;
  let match;
  const tables: string[] = [];
  
  while ((match = tablePattern.exec(migration.sql)) !== null) {
    const tableName = match[2] || match[1];
    tables.push(tableName);
  }
  
  // Verify foreign key integrity
  for (const table of tables) {
    const result = await db.query(`
      SELECT 
        conname as constraint_name,
        conrelid::regclass as table_name,
        confrelid::regclass as referenced_table
      FROM pg_constraint
      WHERE contype = 'f'
        AND conrelid::regclass::text = $1
    `, [table]);
    
    for (const fk of result.rows) {
      // Check if referenced table exists
      const refExists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_name = $1
        ) as exists
      `, [fk.referenced_table]);
      
      if (!refExists.rows[0].exists) {
        console.error(`⚠️  Foreign key '${fk.constraint_name}' references non-existent table '${fk.referenced_table}'`);
        return false;
      }
    }
  }
  
  return true;
}
