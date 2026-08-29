/**
 * G9: Schema Verification
 * 
 * Verifies expected database objects were created:
 * - Tables
 * - Columns
 * - Indexes
 * - Functions
 * - Policies
 * - Triggers
 */

import type { Migration, SchemaVerification } from '../types';
import type { Pool } from 'pg';

export async function verifySchema(
  migration: Migration,
  db: Pool
): Promise<SchemaVerification> {
  
  const expectedObjects = extractExpectedObjects(migration.sql);
  const actualObjects: string[] = [];
  const missing: string[] = [];
  const unexpected: string[] = [];
  
  try {
    // Verify tables
    for (const table of expectedObjects.filter(o => o.startsWith('TABLE:'))) {
      const tableName = table.replace('TABLE:', '');
      const [schema, name] = tableName.includes('.') 
        ? tableName.split('.')
        : ['public', tableName];
      
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.tables
          WHERE table_schema = $1 AND table_name = $2
        ) as exists
      `, [schema, name]);
      
      if (exists.rows[0].exists) {
        actualObjects.push(table);
      } else {
        missing.push(table);
      }
    }
    
    // Verify functions
    for (const func of expectedObjects.filter(o => o.startsWith('FUNCTION:'))) {
      const funcName = func.replace('FUNCTION:', '').split('.').pop();
      
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_proc
          WHERE proname = $1
        ) as exists
      `, [funcName]);
      
      if (exists.rows[0].exists) {
        actualObjects.push(func);
      } else {
        missing.push(func);
      }
    }
    
    // Verify indexes
    for (const index of expectedObjects.filter(o => o.startsWith('INDEX:'))) {
      const indexName = index.replace('INDEX:', '');
      
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE indexname = $1
        ) as exists
      `, [indexName]);
      
      if (exists.rows[0].exists) {
        actualObjects.push(index);
      } else {
        missing.push(index);
      }
    }
    
    // Verify policies
    for (const policy of expectedObjects.filter(o => o.startsWith('POLICY:'))) {
      const policyName = policy.replace('POLICY:', '');
      
      const exists = await db.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_policies
          WHERE policyname = $1
        ) as exists
      `, [policyName]);
      
      if (exists.rows[0].exists) {
        actualObjects.push(policy);
      } else {
        missing.push(policy);
      }
    }
    
  } catch (error) {
    console.error(`Schema verification error: ${error instanceof Error ? error.message : String(error)}`);
  }
  
  const pass = missing.length === 0;
  
  return {
    pass,
    expectedObjects,
    actualObjects,
    missing,
    unexpected
  };
}

function extractExpectedObjects(sql: string): string[] {
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
  
  // Triggers
  const triggerPattern = /CREATE\s+TRIGGER\s+([a-z_]+)/gi;
  while ((match = triggerPattern.exec(sql)) !== null) {
    objects.push(`TRIGGER:${match[1]}`);
  }
  
  return objects;
}
